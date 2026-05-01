// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: { preAuthId: string } }
) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const { data, error } = await supabase
    .from('billing_pre_auths')
    .select(`*, billing_insurance_companies (company_name, company_code, company_type, is_cashless), billing_tpa_masters (tpa_name, tpa_code, settlement_tat_days)`)
    .eq('id', params.preAuthId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });

  let treatingDoctorName = null;
  if (data.treating_doctor_id) {
    const { data: doc } = await supabase.from('doctors').select('name').eq('id', data.treating_doctor_id).single();
    treatingDoctorName = doc?.name;
  }

  return NextResponse.json({
    ...data,
    insurance_company: data.billing_insurance_companies || null,
    tpa: data.billing_tpa_masters || null,
    treating_doctor_name: treatingDoctorName,
  });
}
