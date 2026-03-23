// app/api/instrument/route.ts
// Instrument Results Receiver API
// Middleware agent sends parsed results here → auto-populates LIMS

import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// GET — health check + instrument status
export async function GET(request: NextRequest) {
  const { error: authError } = requireApiKey(request);
  if (authError) return authError;

  return NextResponse.json({
    status: 'ok',
    service: 'LIMS Instrument Interface',
    version: '1.0',
    supabaseConfigured: !!SUPABASE_URL && !!SUPABASE_SERVICE_KEY,
    endpoints: {
      'POST /api/instrument': 'Receive instrument results',
      'POST /api/instrument?action=match': 'Match sample barcode to order',
    },
  });
}

// POST — receive results from middleware
export async function POST(request: NextRequest) {
  const { error: authError } = requireApiKey(request);
  if (authError) return authError;

  try {
    const sb = getAdminClient();
    if (!sb) return NextResponse.json({ error: 'Supabase not configured. Set SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });

    const body = await request.json();
    const action = request.nextUrl.searchParams.get('action') || 'results';

    switch (action) {
      // ============================================================
      // MATCH: Find order by sample barcode
      // ============================================================
      case 'match': {
        const { barcode } = body;
        if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 });

        // Find sample by barcode
        const { data: sample } = await sb.from('hmis_lab_samples')
          .select('*, order:hmis_lab_orders!inner(id, test_id, patient_id, status, test:hmis_lab_test_master(test_code, test_name))')
          .eq('barcode', barcode).single();

        if (!sample) return NextResponse.json({ error: 'No sample found for barcode', barcode }, { status: 404 });

        // Get test parameters
        const { data: params } = await sb.from('hmis_lab_test_parameters')
          .select('id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high')
          .eq('test_id', sample.order.test_id).eq('is_active', true).order('sort_order');

        return NextResponse.json({
          matched: true,
          orderId: sample.order.id,
          testCode: sample.order.test?.test_code,
          testName: sample.order.test?.test_name,
          patientId: sample.order.patient_id,
          parameters: params || [],
        });
      }

      // ============================================================
      // RESULTS: Receive and auto-populate results
      // ============================================================
      case 'results': {
        const { instrumentId, sampleBarcode, results } = body;
        if (!results || !Array.isArray(results) || results.length === 0) {
          return NextResponse.json({ error: 'results array required' }, { status: 400 });
        }

        // Find order by barcode
        let orderId: string | null = null;
        let testId: string | null = null;
        let patientId: string | null = null;

        if (sampleBarcode) {
          const { data: sample } = await sb.from('hmis_lab_samples')
            .select('order_id, order:hmis_lab_orders!inner(id, test_id, patient_id)')
            .eq('barcode', sampleBarcode).single();
          if (sample) {
            orderId = sample.order_id;
            testId = (sample.order as any).test_id;
            patientId = (sample.order as any).patient_id;
          }
        }

        if (!orderId) {
          return NextResponse.json({ error: 'Could not match barcode to order', sampleBarcode }, { status: 404 });
        }

        // Get parameter mappings
        const { data: params } = await sb.from('hmis_lab_test_parameters')
          .select('id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high')
          .eq('test_id', testId).eq('is_active', true);

        const paramMap = new Map((params || []).map(p => [p.parameter_code, p]));
        const savedResults: any[] = [];
        const unmapped: string[] = [];
        const criticalAlerts: any[] = [];

        for (const r of results) {
          const param = paramMap.get(r.limsParameterCode || r.parameterCode);
          if (!param) {
            unmapped.push(r.limsParameterCode || r.parameterCode);
            continue;
          }

          const numVal = parseFloat(r.value);
          const isAbnormal = !isNaN(numVal) && param.ref_range_min != null && param.ref_range_max != null &&
            (numVal < parseFloat(param.ref_range_min) || numVal > parseFloat(param.ref_range_max));
          const isCritical = !isNaN(numVal) && (
            (param.critical_low != null && numVal < parseFloat(param.critical_low)) ||
            (param.critical_high != null && numVal > parseFloat(param.critical_high))
          );

          // Upsert result
          const { data: saved, error } = await sb.from('hmis_lab_results').upsert({
            order_id: orderId,
            parameter_id: param.id,
            parameter_name: param.parameter_name,
            result_value: r.value,
            unit: param.unit || r.unit,
            normal_range_min: param.ref_range_min,
            normal_range_max: param.ref_range_max,
            is_abnormal: isAbnormal,
            is_critical: isCritical,
            is_auto_validated: !isCritical && !isAbnormal, // Auto-validate if normal
            result_date: new Date().toISOString(),
          }, { onConflict: 'order_id,parameter_id' }).select().single();

          if (saved) savedResults.push(saved);

          // Create critical alert if needed
          if (isCritical) {
            await sb.from('hmis_lab_critical_alerts').insert({
              order_id: orderId,
              parameter_name: param.parameter_name,
              result_value: r.value,
              critical_type: numVal < parseFloat(param.critical_low || '0') ? 'low' : 'high',
              status: 'pending',
            });
            criticalAlerts.push({ parameter: param.parameter_name, value: r.value, type: 'critical' });
          }
        }

        // Update order status to processing
        await sb.from('hmis_lab_orders').update({
          status: 'processing',
        }).eq('id', orderId).in('status', ['sample_collected', 'ordered']);

        // Log instrument event

        return NextResponse.json({
          success: true,
          orderId,
          saved: savedResults.length,
          unmapped,
          criticalAlerts,
          autoValidated: savedResults.filter(r => r.is_auto_validated).length,
          message: `${savedResults.length} results saved${criticalAlerts.length > 0 ? ` — ${criticalAlerts.length} CRITICAL ALERTS` : ''}`,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action. Use: match, results' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[INSTRUMENT] Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
