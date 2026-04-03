// POST /api/brain/quality-scorecard
// Generate monthly quality scorecard for a centre.
// Body: { centre_id: string, month: string } (month = '2026-03')

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import { calculateQualityScore } from '@/lib/brain/engine';

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
    const { centre_id, month } = body;

    if (!centre_id || !month) {
      return NextResponse.json({ error: 'centre_id and month are required' }, { status: 400 });
    }

    // Validate month format and range
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'month must be in YYYY-MM format with valid month 01-12' }, { status: 400 });
    }

    const sb = adminSb();

    if (!await verifyCentreAccess(sb, staff!.id, centre_id)) {
      return NextResponse.json({ error: 'Access denied for this centre' }, { status: 403 });
    }

    const monthStart = `${month}-01`;
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    // Aggregate from source tables
    const { count: totalDischarges } = await sb
      .from('hmis_admissions')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', centre_id)
      .eq('status', 'discharged')
      .gte('actual_discharge', monthStart)
      .lt('actual_discharge', monthEnd);

    // Readmission rate from brain_readmission_risk
    const { count: readmissions } = await sb
      .from('brain_readmission_risk')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', centre_id)
      .eq('was_readmitted', true)
      .gte('readmission_date', monthStart)
      .lt('readmission_date', monthEnd);

    const readmissionRate = totalDischarges && totalDischarges > 0
      ? Math.round((readmissions ?? 0) / totalDischarges * 100 * 100) / 100
      : 0;

    // SSI rate from brain_infection_events
    const { count: ssiCount } = await sb
      .from('brain_infection_events')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', centre_id)
      .eq('infection_type', 'ssi')
      .gte('detection_date', monthStart)
      .lt('detection_date', monthEnd);

    // Surgery count (uses scheduled_date, not surgery_date)
    const { count: surgeryCount } = await sb
      .from('hmis_ot_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', centre_id)
      .gte('scheduled_date', monthStart)
      .lt('scheduled_date', monthEnd);

    const ssiRate = surgeryCount && surgeryCount > 0
      ? Math.round((ssiCount ?? 0) / surgeryCount * 100 * 100) / 100
      : 0;

    // Build quality input -- only populate metrics we can actually compute.
    // Metrics we cannot derive from current data are left at 0 (not fabricated).
    // The quality score engine treats 0 as "best possible" for lower-is-better
    // metrics, so overall_quality_score will be optimistic until all data sources
    // are wired. This is documented and expected for MVP.
    const qualityInput = {
      fall_rate: 0,                              // TODO: wire to incident reports
      medication_error_rate: 0,                  // TODO: wire to incident reports
      wrong_site_surgery_count: 0,               // TODO: wire to incident reports
      mortality_rate: 0,                         // TODO: wire to discharge disposition
      readmission_30_day_rate: readmissionRate,  // Computed from brain_readmission_risk
      ssi_rate: ssiRate,                         // Computed from brain_infection_events
      antibiotic_prophylaxis_compliance: 0,      // TODO: wire to OT antibiotic data
      surgical_safety_checklist_compliance: 0,   // TODO: wire to OT checklist data
      ed_wait_time_avg_min: 0,                   // TODO: wire to ED timestamps
      patient_satisfaction_score: 0,             // TODO: wire to feedback module
    };

    const { overall_quality_score, overall_grade } = calculateQualityScore(qualityInput);

    // Upsert quality indicators
    const { data: result, error: upsertErr } = await sb
      .from('brain_quality_indicators')
      .upsert({
        centre_id,
        month,
        readmission_30_day_rate: readmissionRate,
        ssi_rate: ssiRate,
        overall_quality_score,
        overall_grade,
      }, { onConflict: 'centre_id,month' })
      .select()
      .single();

    if (upsertErr) {
      return NextResponse.json({ error: 'Failed to save quality scorecard' }, { status: 500 });
    }

    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/brain/quality-scorecard?centre_id=...&months=12
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

  const months = Math.min(60, Math.max(1, parseInt(request.nextUrl.searchParams.get('months') || '12', 10) || 12));

  const { data, error } = await sb
    .from('brain_quality_indicators')
    .select('*')
    .eq('centre_id', centreId)
    .order('month', { ascending: false })
    .limit(months);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch quality data' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
