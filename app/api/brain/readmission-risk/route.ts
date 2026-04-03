// POST /api/brain/readmission-risk
// Calculate readmission risk for a discharged patient.
// Body: { admission_id: string, centre_id: string }

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import { calculateReadmissionRisk, type ReadmissionInput } from '@/lib/brain/engine';

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
    const { admission_id, centre_id } = body;

    if (!admission_id || !centre_id) {
      return NextResponse.json({ error: 'admission_id and centre_id are required' }, { status: 400 });
    }

    const sb = adminSb();

    // 1. Load admission + patient demographics
    const { data: admission, error: admErr } = await sb
      .from('hmis_admissions')
      .select('id, patient_id, admission_type, admission_date, actual_discharge, status, centre_id')
      .eq('id', admission_id)
      .single();

    if (admErr || !admission) {
      return NextResponse.json({ error: 'Admission not found' }, { status: 404 });
    }

    const { data: patient } = await sb
      .from('hmis_patients')
      .select('id, date_of_birth, age_years')
      .eq('id', admission.patient_id)
      .single();

    // 2. Count prior admissions in 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { count: priorAdmissions } = await sb
      .from('hmis_admissions')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', admission.patient_id)
      .eq('centre_id', centre_id)
      .neq('id', admission_id)
      .gte('admission_date', oneYearAgo.toISOString().slice(0, 10));

    // 3. Count comorbidities from diagnoses
    const { count: comorbidityCount } = await sb
      .from('hmis_diagnoses')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', admission.patient_id)
      .eq('is_active', true);

    // 4. Calculate LOS
    const admDate = new Date(admission.admission_date);
    const disDate = admission.actual_discharge
      ? new Date(admission.actual_discharge)
      : new Date();
    const losDays = Math.max(1, Math.round((disDate.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24)));

    // 5. Count abnormal labs at discharge (last 48 hours)
    const dischargeMinus48h = new Date(disDate.getTime() - 48 * 60 * 60 * 1000);
    const { count: abnormalLabs } = await sb
      .from('hmis_lab_results')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', admission.patient_id)
      .eq('is_abnormal', true)
      .gte('created_at', dischargeMinus48h.toISOString());

    // 6. Count discharge medications
    const { count: medCount } = await sb
      .from('hmis_prescriptions')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', admission.patient_id)
      .eq('admission_id', admission_id)
      .eq('is_active', true);

    // Calculate age
    let age: number | null = patient?.age_years ?? null;
    if (!age && patient?.date_of_birth) {
      const dob = new Date(patient.date_of_birth);
      age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const input: ReadmissionInput = {
      age,
      comorbidityCount: comorbidityCount ?? 0,
      priorAdmissions12m: priorAdmissions ?? 0,
      losDays,
      isEmergency: admission.admission_type === 'emergency',
      abnormalLabCount: abnormalLabs ?? 0,
      dischargeMedCount: medCount ?? 0,
      socialRiskFlag: false,
    };

    const scores = calculateReadmissionRisk(input);

    // Upsert into brain_readmission_risk
    const { data: result, error: upsertErr } = await sb
      .from('brain_readmission_risk')
      .upsert({
        centre_id,
        admission_id,
        patient_id: admission.patient_id,
        ...scores,
        procedure_complexity_score: 0,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'admission_id' })
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

// GET /api/brain/readmission-risk?centre_id=...&risk_category=...
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) {
    return NextResponse.json({ error: 'centre_id is required' }, { status: 400 });
  }

  const riskCategory = request.nextUrl.searchParams.get('risk_category');
  const sb = adminSb();

  let query = sb
    .from('brain_readmission_risk')
    .select('*, patient:hmis_patients(id, uhid, first_name, last_name, age_years, gender)')
    .eq('centre_id', centreId)
    .order('total_risk_score', { ascending: false })
    .limit(100);

  if (riskCategory) {
    query = query.eq('risk_category', riskCategory);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
