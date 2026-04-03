// POST /api/brain/antibiotic-scan
// Scan active antibiotic prescriptions and generate stewardship alerts.
// Body: { centre_id: string }

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import {
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

async function verifyCentreAccess(sb: ReturnType<typeof adminSb>, staffId: string, centreId: string): Promise<boolean> {
  const { count } = await sb.from('hmis_staff_centres')
    .select('id', { count: 'exact', head: true })
    .eq('staff_id', staffId)
    .eq('centre_id', centreId);
  return (count ?? 0) > 0;
}

export async function POST(request: NextRequest) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { centre_id } = body;

    if (!centre_id) {
      return NextResponse.json({ error: 'centre_id is required' }, { status: 400 });
    }

    const sb = adminSb();

    if (!await verifyCentreAccess(sb, staff!.id, centre_id)) {
      return NextResponse.json({ error: 'Access denied for this centre' }, { status: 403 });
    }

    // Load active prescriptions via orders (join through hmis_orders for encounter and prescriber info)
    // hmis_prescriptions: id, order_id, patient_id, drug_name, route, duration_days
    // hmis_orders: encounter_type, encounter_id, ordered_by, status
    const { data: prescriptions, error: rxErr } = await sb
      .from('hmis_prescriptions')
      .select('id, patient_id, drug_name, route, duration_days, created_at, order:hmis_orders!inner(encounter_id, encounter_type, ordered_by, status)')
      .eq('hmis_orders.status', 'ordered')
      .neq('hmis_orders.status', 'cancelled');

    if (rxErr) {
      return NextResponse.json({ error: 'Failed to scan prescriptions' }, { status: 500 });
    }

    // Filter to antibiotics by checking against our classification engine
    // (since drug_class column does not exist on hmis_prescriptions)
    const { classifyAntibiotic } = await import('@/lib/brain/engine');

    const allRx: AntibioticPrescription[] = (prescriptions ?? [])
      .filter((rx: Record<string, unknown>) => {
        const drugName = (rx.drug_name as string) || '';
        return classifyAntibiotic(drugName) !== null;
      })
      .map((rx: Record<string, unknown>) => {
        const order = rx.order as Record<string, unknown> | null;
        return {
          id: rx.id as string,
          patient_id: rx.patient_id as string,
          admission_id: order?.encounter_type === 'ipd' ? (order?.encounter_id as string) : null,
          drug_name: rx.drug_name as string,
          route: rx.route as string | null,
          prescribed_at: rx.created_at as string,
          prescribing_doctor_id: (order?.ordered_by as string) ?? null,
          duration_days: rx.duration_days as number | null,
          is_surgical_prophylaxis: false,
        };
      });

    // Check if culture was ordered for each patient (batch lookup)
    const patientIds = [...new Set(allRx.map((rx) => rx.patient_id))];
    const patientCultureMap = new Map<string, boolean>();
    if (patientIds.length > 0) {
      const { data: cultureOrders } = await sb
        .from('hmis_lab_orders')
        .select('patient_id')
        .in('patient_id', patientIds)
        .ilike('test_name', '%culture%');
      (cultureOrders ?? []).forEach((co: Record<string, unknown>) => {
        patientCultureMap.set(co.patient_id as string, true);
      });
    }

    const alertsToInsert: Array<Record<string, unknown>> = [];

    for (const rx of allRx) {
      const alerts: AntibioticAlertResult[] = [];
      const daysSinceStart = Math.floor(
        (Date.now() - new Date(rx.prescribed_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const hasCulture = patientCultureMap.get(rx.patient_id) ?? false;

      // Check duration exceeded
      const durAlert = checkDurationExceeded(rx, hasCulture);
      if (durAlert) alerts.push(durAlert);

      // Check broad-spectrum without culture
      const broadAlert = checkBroadSpectrumNoCulture(rx, hasCulture);
      if (broadAlert) alerts.push(broadAlert);

      // Check duplicate class
      const patientRx = allRx.filter((r) => r.patient_id === rx.patient_id);
      const dupAlert = checkDuplicateClass(rx, patientRx);
      if (dupAlert) alerts.push(dupAlert);

      // Check IV-to-oral opportunity
      const ivAlert = checkIVToOralOpportunity(rx, daysSinceStart);
      if (ivAlert) alerts.push(ivAlert);

      // Check prophylaxis exceeded
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

    // Deduplicate: skip alerts that already exist for same prescription + alert_type
    let insertedCount = 0;
    for (const alert of alertsToInsert) {
      const { count: existing } = await sb
        .from('brain_antibiotic_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('prescription_id', alert.prescription_id)
        .eq('alert_type', alert.alert_type)
        .eq('status', 'active');

      if ((existing ?? 0) === 0) {
        const { error: insertErr } = await sb
          .from('brain_antibiotic_alerts')
          .insert(alert);
        if (!insertErr) insertedCount++;
      }
    }

    return NextResponse.json({
      prescriptions_scanned: allRx.length,
      alerts_generated: insertedCount,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/brain/antibiotic-scan?centre_id=...&status=active
export async function GET(request: NextRequest) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) {
    return NextResponse.json({ error: 'centre_id is required' }, { status: 400 });
  }

  const sb = adminSb();

  if (!await verifyCentreAccess(sb, staff!.id, centreId)) {
    return NextResponse.json({ error: 'Access denied for this centre' }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get('status') || 'active';

  const { data, error } = await sb
    .from('brain_antibiotic_alerts')
    .select('*, patient:hmis_patients(id, uhid, first_name, last_name), prescribing_doctor:hmis_staff!brain_antibiotic_alerts_prescribing_doctor_id_fkey(id, full_name)')
    .eq('centre_id', centreId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
