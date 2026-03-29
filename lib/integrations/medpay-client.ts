// lib/integrations/medpay-client.ts
// HMIS → MedPay integration: push finalized bills as billing_rows
// MedPay integration (project ID in env vars)

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ── MedPay Supabase client (server-side only) ──
const MEDPAY_URL = process.env.MEDPAY_SUPABASE_URL || '';
const MEDPAY_KEY = process.env.MEDPAY_SERVICE_ROLE_KEY || '';

export function getMedPayClient() {
  if (!MEDPAY_URL) throw new Error('MEDPAY_SUPABASE_URL not set');
  if (!MEDPAY_KEY) throw new Error('MEDPAY_SERVICE_ROLE_KEY not set');
  return createSupabaseClient(MEDPAY_URL, MEDPAY_KEY);
}

// ── Sponsor Mapping (HMIS payor_type → MedPay sponsor) ──
export function mapPayorToSponsor(payorType: string, insurerName?: string): string {
  switch (payorType) {
    case 'self': return 'CASH';
    case 'insurance': return insurerName?.toUpperCase() || 'CASHLESS';
    case 'corporate': return insurerName?.toUpperCase() || 'CORPORATE';
    case 'govt_pmjay': return 'PMJAY';
    case 'govt_cghs': return 'CGHS';
    case 'govt_esi': return 'ESI';
    default: return 'CASH';
  }
}

// ── Centre Mapping ──
const CENTRE_NAMES: Record<string, string> = {
  'c0000001-0000-0000-0000-000000000001': 'Shilaj',
  'c0000001-0000-0000-0000-000000000002': 'Vastral',
  'c0000001-0000-0000-0000-000000000003': 'Modasa',
  'c0000001-0000-0000-0000-000000000004': 'Gandhinagar',
  'c0000001-0000-0000-0000-000000000005': 'Udaipur',
};

// ── Billing Row (MedPay format) ──
export interface MedPayBillingRow {
  upload_id: number;
  centre: string;
  month: string; // '2026-03'
  bill_no: string;
  bill_date: string; // 'DD/MM/YYYY'
  patient_name: string;
  ip_no: string;
  consulting_dr: string;
  service_doctor: string;
  ref_doctor: string;
  sponsor: string;
  department: string;
  service_name: string;
  service_amt: number;
  doctor_amt: number;
  net_amt: number;
  hospital_amt: number;
  qty: number;
  billing_category: string;
  package_name: string;
  case_type: string;
}

// ── Transform HMIS Bill → MedPay billing_rows ──
export interface HMISBillForMedPay {
  bill_id: string;
  bill_number: string;
  bill_date: string; // 'YYYY-MM-DD'
  bill_type: string;
  centre_id: string;
  payor_type: string;
  insurer_name?: string;
  patient_name: string;
  ipd_number?: string;
  consulting_doctor_name: string;
  referring_doctor_name?: string;
  billing_category?: string; // room category
  package_name?: string;
  items: {
    description: string;
    department: string;
    quantity: number;
    unit_rate: number;
    amount: number;
    net_amount: number;
    service_doctor_name: string;
    consulting_doctor_name: string;
    category?: string;
  }[];
}

export function transformBillToMedPayRows(
  bill: HMISBillForMedPay,
  uploadId: number
): MedPayBillingRow[] {
  const [year, month, day] = bill.bill_date.split('-');
  const billDateFormatted = `${day}/${month}/${year}`;
  const monthStr = `${year}-${month}`;
  const centreName = CENTRE_NAMES[bill.centre_id] || 'Unknown';
  const sponsor = mapPayorToSponsor(bill.payor_type, bill.insurer_name);

  return bill.items.map(item => {
    // MedPay logic: Net Amt is the base for calculations
    // doctor_amt = net_amt * doctor's percentage (calculated by MedPay engine, not here)
    // hospital_amt = service_amt - doctor_amt
    // For now, push net_amt as both service_amt and net_amt; MedPay recalculates
    const serviceAmt = item.amount;
    const netAmt = item.net_amount;
    // doctor_amt and hospital_amt will be 0 — MedPay's engine calculates these
    // from contracts. We just provide the raw billing data.

    return {
      upload_id: uploadId,
      centre: centreName,
      month: monthStr,
      bill_no: bill.bill_number,
      bill_date: billDateFormatted,
      patient_name: bill.patient_name,
      ip_no: bill.ipd_number || '',
      consulting_dr: item.consulting_doctor_name || bill.consulting_doctor_name || '',
      service_doctor: item.service_doctor_name !== item.consulting_doctor_name ? item.service_doctor_name : '',
      ref_doctor: bill.referring_doctor_name || '',
      sponsor,
      department: item.department || '',
      service_name: item.description,
      service_amt: serviceAmt,
      doctor_amt: 0, // MedPay recalculates from contracts
      net_amt: netAmt,
      hospital_amt: 0, // MedPay recalculates
      qty: item.quantity,
      billing_category: bill.billing_category || '',
      package_name: bill.package_name || '',
      case_type: bill.bill_type === 'ipd' ? 'IP' : bill.bill_type === 'opd' ? 'OP' : '',
    };
  });
}

// ── Create upload record in MedPay ──
export async function createMedPayUpload(
  centre: string,
  month: string,
  rowCount: number,
  source: string = 'hmis_auto'
): Promise<{ id: number | null; error?: string }> {
  try {
    const mp = getMedPayClient();
    const { data, error } = await mp.from('file_uploads').insert({
      centre,
      month,
      filename: `hmis_sync_${centre}_${month}_${new Date().toISOString().slice(0, 10)}`,
      file_type: source,
      row_count: rowCount,
      active: true,
      notes: `Auto-synced from HMIS at ${new Date().toISOString()}`,
    }).select('id').single();

    if (error) return { id: null, error: error.message };
    return { id: data.id };
  } catch (e: any) {
    return { id: null, error: e.message };
  }
}

// ── Push billing rows to MedPay ──
export async function pushBillingRows(rows: MedPayBillingRow[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (rows.length === 0) return { success: true, count: 0 };

  try {
    const mp = getMedPayClient();
    // Batch in chunks of 100
    let pushed = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await mp.from('billing_rows').insert(chunk);
      if (error) return { success: false, count: pushed, error: error.message };
      pushed += chunk.length;
    }
    return { success: true, count: pushed };
  } catch (e: any) {
    return { success: false, count: 0, error: e.message };
  }
}

// ── Lookup MedPay doctor by name (fuzzy via aliases) ──
export async function lookupMedPayDoctor(name: string): Promise<{ id: number; name: string } | null> {
  if (!name) return null;
  try {
    const mp = getMedPayClient();
    const normalized = name.toLowerCase().trim();

    // Try exact alias match
    const { data: alias } = await mp.from('doctor_aliases')
      .select('doctor_id, doctor:doctors(name)')
      .eq('alias', normalized)
      .limit(1)
      .single();

    if (alias) return { id: alias.doctor_id, name: (alias as any).doctor?.name || name };

    // Try name ILIKE
    const { data: doc } = await mp.from('doctors')
      .select('id, name')
      .ilike('name', `%${name.replace(/^dr\.?\s*/i, '')}%`)
      .limit(1)
      .single();

    if (doc) return { id: doc.id, name: doc.name };
    return null;
  } catch {
    return null;
  }
}

// ── Get all MedPay doctors (for mapping UI) ──
export async function getMedPayDoctors(): Promise<{ id: number; name: string; specialty: string | null }[]> {
  try {
    const mp = getMedPayClient();
    const { data } = await mp.from('doctors').select('id, name, specialty').eq('active', true).order('name');
    return data || [];
  } catch {
    return [];
  }
}
