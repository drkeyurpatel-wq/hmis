// POST /api/brain/antibiotic-scan
// Scan active antibiotic prescriptions and generate stewardship alerts.
// Body: { centre_id: string }

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import {
  classifyAntibiotic, isBroadSpectrum, isRestricted,
  checkDurationExceeded, checkBroadSpectrumNoCulture,
  checkDuplicateClass, checkIVToOralOpportunity,
  checkProphylaxisExceeded, checkRestrictedAntibiotic,
  type AntibioticPrescription, type AntibioticAlertResult,
} from '@/lib/brain/engine';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function adminSb() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { centre_id } = body;

    if (!centre_id) {
      return NextResponse.json({ error: 'centre_id is required' }, { status: 400 });
    }

    const sb = adminSb();

    // Load all active antibiotic prescriptions for this centre
    const { data: prescriptions, error: rxErr } = await sb
      .from('hmis_prescriptions')
      .select('id, patient_id, admission_id, drug_name, route, created_at, prescribed_by, duration_days, is_active, drug_class')
      .eq('centre_id', centre_id)
      .eq('is_active', true)
      .ilike('drug_class', '%antibiotic%');

    if (rxErr) {
      return NextResponse.json({ error: rxErr.message }, { status: 500 });
    }

    const allRx: AntibioticPrescription[] = (prescriptions ?? []).map((rx: Record<string, unknown>) => ({
      id: rx.id as string,
      patient_id: rx.patient_id as string,
      admission_id: rx.admission_id as string | null,
      drug_name: rx.drug_name as string,
      route: rx.route as string | null,
      prescribed_at: rx.created_at as string,
      prescribing_doctor_id: rx.prescribed_by as string | null,
      duration_days: rx.duration_days as number | null,
      is_surgical_prophylaxis: false,
    }));

    const alertsToInsert: Array<Record<string, unknown>> = [];

    for (const rx of allRx) {
      const alerts: AntibioticAlertResult[] = [];
      const daysSinceStart = Math.floor(
        (Date.now() - new Date(rx.prescribed_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check duration exceeded
      const durAlert = checkDurationExceeded(rx, false);
      if (durAlert) alerts.push(durAlert);

      // Check broad-spectrum without culture
      const broadAlert = checkBroadSpectrumNoCulture(rx, false);
      if (broadAlert) alerts.push(broadAlert);

      // Check duplicate class
      const patientRx = allRx.filter((r) => r.patient_id === rx.patient_id);
      const dupAlert = checkDuplicateClass(rx, patientRx);
      if (dupAlert) alerts.push(dupAlert);

      // Check IV-to-oral opportunity
      const ivAlert = checkIVToOralOpportunity(rx, daysSinceStart);
      if (ivAlert) alerts.push(ivAlert);

      // Check prophylaxis exceeded (approximate)
      const prophAlert = checkProphylaxisExceeded(rx, daysSinceStart * 24);
      if (prophAlert) alerts.push(prophAlert);

      // Check restricted antibiotic
      const restrictAlert = checkRestrictedAntibiotic(rx);
      if (restrictAlert) alerts.push(restrictAlert);

      for (const alert of alerts) {
        alertsToInsert.push({
          centre_id,
          patient_id: rx.patient_id,
          admission_id: rx.admission_id,
          prescription_id: rx.id,
          alert_type: alert.alert_type,
          drug_name: alert.drug_name,
          drug_class: alert.drug_class,
          severity: alert.severity,
          description: alert.description,
          recommendation: alert.recommendation,
          prescribing_doctor_id: rx.prescribing_doctor_id,
          status: 'active',
        });
      }
    }

    // Batch insert new alerts (skip if duplicate exists)
    let insertedCount = 0;
    if (alertsToInsert.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < alertsToInsert.length; i += 50) {
        const batch = alertsToInsert.slice(i, i + 50);
        const { data, error: insertErr } = await sb
          .from('brain_antibiotic_alerts')
          .insert(batch)
          .select('id');

        if (!insertErr && data) insertedCount += data.length;
      }
    }

    return NextResponse.json({
      prescriptions_scanned: allRx.length,
      alerts_generated: insertedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/brain/antibiotic-scan?centre_id=...&status=active
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) {
    return NextResponse.json({ error: 'centre_id is required' }, { status: 400 });
  }

  const status = request.nextUrl.searchParams.get('status') || 'active';
  const sb = adminSb();

  const { data, error } = await sb
    .from('brain_antibiotic_alerts')
    .select('*, patient:hmis_patients(id, uhid, first_name, last_name), prescribing_doctor:hmis_staff!brain_antibiotic_alerts_prescribing_doctor_id_fkey(id, full_name)')
    .eq('centre_id', centreId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
