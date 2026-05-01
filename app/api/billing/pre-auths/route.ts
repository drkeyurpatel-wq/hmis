// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  const status = request.nextUrl.searchParams.get('status');

  let query = supabase.from('billing_pre_auths')
    .select('*, billing_insurance_companies (company_name, company_code, company_type), billing_tpa_masters (tpa_name, tpa_code)')
    .order('created_at', { ascending: false }).limit(200);
  if (centreId) query = query.eq('centre_id', centreId);
  if (status) query = query.in('status', status.split(','));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((pa: any) => ({
    ...pa, insurance_company: pa.billing_insurance_companies || null, tpa: pa.billing_tpa_masters || null,
  })));
}

export async function POST(request: NextRequest) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const body = await request.json();
  
  const required = ['encounter_id', 'centre_id', 'patient_id', 'insurance_company_id', 'policy_number', 'requested_amount'];
  for (const field of required) {
    if (!body[field]) return NextResponse.json({ error: `${field} is required` }, { status: 400 });
  }
  try {
    const { data, error } = await supabase.from('billing_pre_auths').insert({
      encounter_id: body.encounter_id, centre_id: body.centre_id, patient_id: body.patient_id,
      insurance_company_id: body.insurance_company_id, tpa_id: body.tpa_id || null,
      policy_number: body.policy_number, member_id: body.member_id || null,
      diagnosis_codes: body.diagnosis_codes || [], procedure_codes: body.procedure_codes || [],
      treating_doctor_id: body.treating_doctor_id || null, clinical_notes: body.clinical_notes || null,
      requested_amount: body.requested_amount, requested_stay_days: body.requested_stay_days || null,
      request_date: new Date().toISOString(),
      pmjay_package_code: body.pmjay_package_code || null, pmjay_package_name: body.pmjay_package_name || null,
      status: 'DRAFT', created_by: staff?.id || 'unknown',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from('billing_encounters')
      .update({ pre_auth_id: data.id, updated_at: new Date().toISOString() })
      .eq('id', body.encounter_id);
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
