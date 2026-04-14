import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

export async function GET(request: NextRequest, { params }: { params: { encounterId: string } }) {
  const supabase = billingDb();

  const { data: encounter, error } = await supabase.from('billing_encounters')
    .select(`*, billing_line_items (*), billing_payments (*), billing_invoices (*),
      billing_pre_auths (*, billing_insurance_companies (company_name, company_code), billing_tpa_masters (tpa_name, tpa_code)),
      billing_tpa_masters!billing_encounters_tpa_id_fkey (tpa_name, tpa_code),
      billing_insurance_companies!billing_encounters_insurance_company_id_fkey (company_name, company_code, company_type),
      billing_packages!billing_encounters_package_id_fkey (package_name, package_code, base_price, inclusions, package_type)`)
    .eq('id', params.encounterId).single();

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });

  const { data: patient } = await supabase.from('patients')
    .select('first_name, last_name, uhid, phone, gender, date_of_birth')
    .eq('id', encounter.patient_id).single();

  const doctorIds = new Set<string>();
  (encounter.billing_line_items || []).forEach((li: any) => {
    if (li.service_doctor_id) doctorIds.add(li.service_doctor_id);
    if (li.referring_doctor_id) doctorIds.add(li.referring_doctor_id);
  });
  if (encounter.consulting_doctor_id) doctorIds.add(encounter.consulting_doctor_id);
  if (encounter.admitting_doctor_id) doctorIds.add(encounter.admitting_doctor_id);

  let doctorMap: Record<string, string> = {};
  if (doctorIds.size > 0) {
    const { data: doctors } = await supabase.from('doctors').select('id, name').in('id', Array.from(doctorIds));
    (doctors || []).forEach((d: any) => { doctorMap[d.id] = d.name; });
  }

  const result = {
    ...encounter,
    patient_name: patient ? `${patient.first_name} ${patient.last_name || ''}`.trim() : null,
    patient_uhid: patient?.uhid || null, patient_phone: patient?.phone || null,
    consulting_doctor_name: encounter.consulting_doctor_id ? doctorMap[encounter.consulting_doctor_id] : null,
    admitting_doctor_name: encounter.admitting_doctor_id ? doctorMap[encounter.admitting_doctor_id] : null,
    tpa: encounter.billing_tpa_masters || null,
    insurance_company: encounter.billing_insurance_companies || null,
    package: encounter.billing_packages || null,
    line_items: (encounter.billing_line_items || [])
      .map((li: any) => ({ ...li,
        service_doctor_name: li.service_doctor_id ? doctorMap[li.service_doctor_id] : null,
        referring_doctor_name: li.referring_doctor_id ? doctorMap[li.referring_doctor_id] : null,
      }))
      .sort((a: any, b: any) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime()),
    payments: (encounter.billing_payments || [])
      .filter((p: any) => p.status === 'COMPLETED')
      .sort((a: any, b: any) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()),
    invoices: (encounter.billing_invoices || [])
      .sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()),
    pre_auth: encounter.billing_pre_auths?.[0] ? {
      ...encounter.billing_pre_auths[0],
      insurance_company: encounter.billing_pre_auths[0].billing_insurance_companies || null,
      tpa: encounter.billing_pre_auths[0].billing_tpa_masters || null,
    } : null,
  };

  delete result.billing_line_items; delete result.billing_payments;
  delete result.billing_invoices; delete result.billing_pre_auths;
  delete result.billing_tpa_masters; delete result.billing_insurance_companies;
  delete result.billing_packages;

  return NextResponse.json(result);
}
