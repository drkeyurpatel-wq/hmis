// POST /api/brain/predict-los
// Predict length of stay on new admission.
// Body: { admission_id: string, centre_id: string }

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import { predictLOS, isLOSOutlier, type LOSInput } from '@/lib/brain/engine';

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

    // Load admission
    const { data: admission, error: admErr } = await sb
      .from('hmis_admissions')
      .select('id, patient_id, admission_type, payor_type, department_id')
      .eq('id', admission_id)
      .single();

    if (admErr || !admission) {
      return NextResponse.json({ error: 'Admission not found' }, { status: 404 });
    }

    // Load patient
    const { data: patient } = await sb
      .from('hmis_patients')
      .select('id, age_years, date_of_birth')
      .eq('id', admission.patient_id)
      .single();

    // Load primary diagnosis
    const { data: diagnosis } = await sb
      .from('hmis_diagnoses')
      .select('icd_code, diagnosis_name')
      .eq('patient_id', admission.patient_id)
      .eq('admission_id', admission_id)
      .eq('is_primary', true)
      .single();

    // Count comorbidities
    const { count: comorbidityCount } = await sb
      .from('hmis_diagnoses')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', admission.patient_id)
      .eq('is_active', true);

    // Look up benchmark
    let benchmark = null;
    if (diagnosis?.icd_code) {
      const { data: bench } = await sb
        .from('brain_los_benchmarks')
        .select('avg_los, stddev_los')
        .eq('category', 'diagnosis')
        .eq('code', diagnosis.icd_code)
        .or(`centre_id.eq.${centre_id},centre_id.is.null`)
        .order('centre_id', { ascending: false, nullsFirst: false })
        .limit(1)
        .single();

      if (bench) benchmark = bench;
    }

    let age: number | null = patient?.age_years ?? null;
    if (!age && patient?.date_of_birth) {
      const dob = new Date(patient.date_of_birth);
      age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const input: LOSInput = {
      diagnosisCode: diagnosis?.icd_code ?? null,
      procedureType: null,
      age,
      comorbidityCount: comorbidityCount ?? 0,
      admissionType: admission.admission_type,
      payorType: admission.payor_type,
    };

    const prediction = predictLOS(input, benchmark);

    // Upsert prediction
    const { data: result, error: upsertErr } = await sb
      .from('brain_los_predictions')
      .upsert({
        centre_id,
        admission_id,
        predicted_los_days: prediction.predicted_los_days,
        prediction_confidence: prediction.prediction_confidence,
        prediction_model: 'rule_based',
        diagnosis_code: diagnosis?.icd_code ?? null,
        procedure_type: null,
        age_group: prediction.age_group,
        comorbidity_count: comorbidityCount ?? 0,
        admission_type: admission.admission_type,
        payor_type: admission.payor_type,
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

// GET /api/brain/predict-los?centre_id=...&outliers_only=true
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) {
    return NextResponse.json({ error: 'centre_id is required' }, { status: 400 });
  }

  const outliersOnly = request.nextUrl.searchParams.get('outliers_only') === 'true';
  const sb = adminSb();

  let query = sb
    .from('brain_los_predictions')
    .select('*, admission:hmis_admissions(id, ipd_number, patient_id, admission_date, actual_discharge, status, patient:hmis_patients(id, uhid, first_name, last_name))')
    .eq('centre_id', centreId)
    .order('calculated_at', { ascending: false })
    .limit(100);

  if (outliersOnly) {
    query = query.eq('is_outlier', true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
