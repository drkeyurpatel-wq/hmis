// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb, billingRpc } from '@/lib/billing/api-helpers';

export async function GET(request: NextRequest) {
  const supabase = billingDb();
  const sp = request.nextUrl.searchParams;
  const centreId = sp.get('centre_id');
  const status = sp.get('status');
  const type = sp.get('type');
  const patientId = sp.get('patient_id');
  const search = sp.get('search');
  const limit = parseInt(sp.get('limit') || '100');

  let query = supabase.from('billing_encounters')
    .select('*, billing_tpa_masters!billing_encounters_tpa_id_fkey (tpa_name, tpa_code), billing_insurance_companies!billing_encounters_insurance_company_id_fkey (company_name, company_code)')
    .order('created_at', { ascending: false }).limit(limit);
  if (centreId) query = query.eq('centre_id', centreId);
  if (status) query = query.in('status', status.split(','));
  if (type) query = query.eq('encounter_type', type);
  if (patientId) query = query.eq('patient_id', patientId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const patientIds = [...new Set((data || []).map((e: any) => e.patient_id))];
  let patientMap: Record<string, any> = {};
  if (patientIds.length > 0) {
    const { data: patients } = await supabase.from('patients')
      .select('id, first_name, last_name, uhid, phone, gender, date_of_birth').in('id', patientIds);
    (patients || []).forEach((p: any) => { patientMap[p.id] = p; });
  }

  let results = (data || []).map((enc: any) => {
    const p = patientMap[enc.patient_id];
    return { ...enc,
      patient_name: p ? `${p.first_name} ${p.last_name || ''}`.trim() : null,
      patient_uhid: p?.uhid || null, patient_phone: p?.phone || null,
      tpa: enc.billing_tpa_masters || null, insurance_company: enc.billing_insurance_companies || null,
    };
  });

  if (search) {
    const term = search.toLowerCase();
    results = results.filter((e: any) =>
      e.patient_name?.toLowerCase().includes(term) || e.patient_uhid?.toLowerCase().includes(term) ||
      e.encounter_number?.toLowerCase().includes(term) || e.patient_phone?.includes(term));
  }
  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const supabase = billingDb();
  const body = await request.json();
  const user = { id: 'service-role' };
  if (!body.centre_id || !body.patient_id || !body.encounter_type)
    return NextResponse.json({ error: 'centre_id, patient_id, encounter_type required' }, { status: 400 });

  try {
    const { data: encNumber } = await billingRpc('billing_next_number', {
      p_centre_id: body.centre_id, p_sequence_type: 'ENCOUNTER', p_prefix: `H1-${body.encounter_type}`,
    });
    const isIPD = ['IPD', 'ER', 'DAYCARE'].includes(body.encounter_type);

    const { data, error } = await supabase.from('billing_encounters').insert({
      centre_id: body.centre_id, patient_id: body.patient_id,
      encounter_type: body.encounter_type, encounter_number: encNumber,
      primary_payor_type: body.primary_payor_type || 'SELF_PAY',
      primary_payor_id: body.primary_payor_id || null,
      insurance_company_id: body.insurance_company_id || null,
      tpa_id: body.tpa_id || null,
      insurance_policy_number: body.insurance_policy_number || null,
      consulting_doctor_id: body.consulting_doctor_id || null,
      admitting_doctor_id: body.admitting_doctor_id || null,
      bed_id: body.bed_id || null, package_id: body.package_id || null,
      visit_date: !isIPD ? new Date().toISOString() : null,
      admission_date: isIPD ? new Date().toISOString() : null,
      notes: body.notes || null, status: 'OPEN', created_by: user.id,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('billing_audit_log').insert({
      entity_type: 'billing_encounters', entity_id: data.id,
      action: 'CREATE', new_values: data, performed_by: user.id,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
