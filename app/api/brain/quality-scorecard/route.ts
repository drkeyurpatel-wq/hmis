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

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { centre_id, month } = body;

    if (!centre_id || !month) {
      return NextResponse.json({ error: 'centre_id and month are required' }, { status: 400 });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month must be in YYYY-MM format' }, { status: 400 });
    }

    const sb = adminSb();
    const monthStart = `${month}-01`;
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    // Aggregate from source tables
    // Total admissions and discharges in the month
    const { count: totalAdmissions } = await sb
      .from('hmis_admissions')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', centre_id)
      .gte('admission_date', monthStart)
      .lt('admission_date', monthEnd);

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

    // Surgery count for SSI rate
    const { count: surgeryCount } = await sb
      .from('hmis_ot_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', centre_id)
      .gte('surgery_date', monthStart)
      .lt('surgery_date', monthEnd);

    const ssiRate = surgeryCount && surgeryCount > 0
      ? Math.round((ssiCount ?? 0) / surgeryCount * 100 * 100) / 100
      : 0;

    // Build quality input with available data (defaults for metrics we cannot yet compute)
    const qualityInput = {
      fall_rate: 0,
      medication_error_rate: 0,
      wrong_site_surgery_count: 0,
      mortality_rate: 0,
      readmission_30_day_rate: readmissionRate,
      ssi_rate: ssiRate,
      antibiotic_prophylaxis_compliance: 90,
      surgical_safety_checklist_compliance: 90,
      ed_wait_time_avg_min: 30,
      patient_satisfaction_score: 7.5,
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
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/brain/quality-scorecard?centre_id=...&months=12
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) {
    return NextResponse.json({ error: 'centre_id is required' }, { status: 400 });
  }

  const months = parseInt(request.nextUrl.searchParams.get('months') || '12', 10);
  const sb = adminSb();

  const { data, error } = await sb
    .from('brain_quality_indicators')
    .select('*')
    .eq('centre_id', centreId)
    .order('month', { ascending: false })
    .limit(months);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
