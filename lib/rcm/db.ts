// ============================================================
// HMIS RCM — Supabase Data Access Layer
//
// Bridge between the pure computation engine (lib/rcm/) and
// the Supabase database. All DB reads and writes go through here.
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  DoctorContract,
  DeptMapEntry,
  FixedPayoutRule,
  PayoutItemResult,
  SettlementResult,
  mapDbRowToContract,
} from './types';

// ---- Read: Contracts ----

export async function getActiveContract(
  sb: SupabaseClient,
  doctorId: string,
  centreId: string
): Promise<DoctorContract | null> {
  const { data, error } = await sb
    .from('hmis_doctor_contracts')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('centre_id', centreId)
    .eq('is_active', true)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return mapDbRowToContract(data);
}

export async function getActiveContractsForCentre(
  sb: SupabaseClient,
  centreId: string
): Promise<Map<string, DoctorContract>> {
  const { data, error } = await sb
    .from('hmis_doctor_contracts')
    .select('*')
    .eq('centre_id', centreId)
    .eq('is_active', true)
    .is('effective_to', null);

  if (error || !data) return new Map();

  const map = new Map<string, DoctorContract>();
  for (const row of data) {
    const contract = mapDbRowToContract(row);
    map.set(contract.doctor_id, contract);
  }
  return map;
}

export async function getAllActiveContracts(
  sb: SupabaseClient
): Promise<Map<string, DoctorContract>> {
  const { data, error } = await sb
    .from('hmis_doctor_contracts')
    .select('*')
    .eq('is_active', true)
    .is('effective_to', null);

  if (error || !data) return new Map();

  const map = new Map<string, DoctorContract>();
  for (const row of data) {
    const contract = mapDbRowToContract(row);
    map.set(contract.doctor_id, contract);
  }
  return map;
}

// ---- Read: Department Map ----

export async function getDepartmentMap(
  sb: SupabaseClient
): Promise<Map<string, DeptMapEntry>> {
  const { data, error } = await sb
    .from('hmis_department_payout_map')
    .select('department_name, category');

  if (error || !data) return new Map();

  const map = new Map<string, DeptMapEntry>();
  for (const row of data) {
    map.set(row.department_name, {
      department_name: row.department_name,
      category: row.category,
    });
  }
  return map;
}

// ---- Read: Fixed Payouts ----

export async function getActiveFixedPayouts(
  sb: SupabaseClient
): Promise<FixedPayoutRule[]> {
  const { data, error } = await sb
    .from('hmis_fixed_payouts')
    .select('*')
    .eq('is_active', true);

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id,
    doctor_id: row.doctor_id,
    centre_id: row.centre_id,
    package_name: row.package_name,
    payor: row.payor,
    specialty: row.specialty,
    amount_from: Number(row.amount_from ?? 0),
    amount_to: Number(row.amount_to ?? 0),
    doctor_payout: Number(row.doctor_payout),
  }));
}

// ---- Read: Bill Items for a Bill ----

export async function getBillItemsForBill(
  sb: SupabaseClient,
  billId: string
) {
  // Get bill header for payor info
  const { data: bill } = await sb
    .from('hmis_bills')
    .select('id, centre_id, bill_number, bill_date, patient_id, payor_type, payor_name:insurer_name, encounter_type, case_type, billing_category, package_id, admission_id')
    .eq('id', billId)
    .single();

  if (!bill) return { bill: null, items: [] };

  // Get bill items
  const { data: items } = await sb
    .from('hmis_bill_items')
    .select('id, bill_id, tariff_id, description, quantity, unit_rate, amount, discount, net_amount, service_date, department_id, doctor_id, service_doctor_id, consulting_doctor_id, referring_doctor_id, referring_doctor_name, billing_category, service_category, package_id, service_name, service_code, category')
    .eq('bill_id', billId);

  // Get patient name
  const { data: patient } = await sb
    .from('hmis_patients')
    .select('full_name, uhid')
    .eq('id', bill.patient_id)
    .single();

  // Get department names for items
  const deptIds = [...new Set((items || []).filter(i => i.department_id).map(i => i.department_id))];
  let deptNames: Record<string, string> = {};
  if (deptIds.length > 0) {
    const { data: depts } = await sb
      .from('hmis_departments')
      .select('id, name')
      .in('id', deptIds);
    for (const d of depts || []) {
      deptNames[d.id] = d.name;
    }
  }

  // Get admission IP number if available
  let ipNo: string | null = null;
  if (bill.admission_id) {
    const { data: admission } = await sb
      .from('hmis_admissions')
      .select('ip_number')
      .eq('id', bill.admission_id)
      .single();
    ipNo = admission?.ip_number || null;
  }

  // Get package info if applicable
  let packageAmount = 0;
  let packageName: string | null = null;
  if (bill.package_id) {
    const { data: pkg } = await sb
      .from('hmis_packages')
      .select('name, total_amount')
      .eq('id', bill.package_id)
      .single();
    packageAmount = Number(pkg?.total_amount ?? 0);
    packageName = pkg?.name || null;
  }

  return {
    bill,
    patient,
    ipNo,
    packageAmount,
    packageName,
    items: (items || []).map(item => ({
      id: item.id,
      bill_id: item.bill_id,
      centre_id: bill.centre_id,
      bill_date: bill.bill_date || new Date().toISOString().substring(0, 10),
      bill_no: bill.bill_number || '',
      patient_name: patient?.full_name || 'Unknown',
      ip_no: ipNo,
      encounter_type: (bill.encounter_type || 'IPD') as 'OPD' | 'IPD',
      payor_type: bill.payor_type || 'Cash',
      payor_name: bill.payor_name || null,
      billing_category: item.billing_category || bill.billing_category || null,
      case_type: bill.case_type || 'Hospital Case',
      package_name: packageName,
      package_amount: packageAmount,
      service_doctor_id: item.service_doctor_id || null,
      consulting_doctor_id: item.consulting_doctor_id || null,
      referring_doctor_id: item.referring_doctor_id || null,
      department: deptNames[item.department_id] || item.category || item.service_category || 'Unknown',
      service_name: item.service_name || item.description || '',
      service_amt: Number(item.amount ?? 0),
      doctor_amt: Number(item.net_amount ?? item.amount ?? 0),
      net_amt: Number(item.net_amount ?? 0),
      hospital_amt: Number(item.amount ?? 0) - Number(item.net_amount ?? 0),
      quantity: Number(item.quantity ?? 1),
    })),
  };
}

// ---- Write: Payout Items ----

export async function insertPayoutItems(
  sb: SupabaseClient,
  items: PayoutItemResult[]
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  // Batch insert in chunks of 50
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50).map(item => ({
      centre_id: item.centre_id,
      bill_id: item.bill_id,
      bill_item_id: item.bill_item_id,
      doctor_id: item.doctor_id,
      contract_id: item.contract_id,
      payout_role: item.payout_role,
      service_month: item.service_month,
      bill_date: item.bill_date,
      patient_name: item.patient_name,
      bill_no: item.bill_no,
      ip_no: item.ip_no,
      encounter_type: item.encounter_type,
      payor_type: item.payor_type,
      payor_name: item.payor_name,
      department: item.department,
      service_name: item.service_name,
      billing_category: item.billing_category,
      case_type: item.case_type,
      package_name: item.package_name,
      service_amt: item.service_amt,
      doctor_amt: item.doctor_amt,
      net_amt: item.net_amt,
      hospital_amt: item.hospital_amt,
      base_method_used: item.base_method_used,
      pct_applied: item.pct_applied,
      is_self_case: item.is_self_case,
      calculated_amount: item.calculated_amount,
      expense_deductions_applied: item.expense_deductions_applied,
      fixed_payout_id: item.fixed_payout_id,
      formula_description: item.formula_description,
      is_held: item.is_held,
      hold_reason: item.hold_reason,
      hold_release_date: item.hold_release_date,
    }));

    const { error } = await sb.from('hmis_doctor_payout_items').insert(chunk);
    if (error) {
      errors.push(`Batch ${i / 50}: ${error.message}`);
    } else {
      inserted += chunk.length;
    }
  }

  return { inserted, errors };
}

// ---- Write: Hold Bucket Entries ----

export async function insertHoldEntries(
  sb: SupabaseClient,
  items: PayoutItemResult[]
): Promise<number> {
  const holdItems = items.filter(i => i.is_held && i.hold_release_date);
  if (holdItems.length === 0) return 0;

  const rows = holdItems.map(item => ({
    doctor_id: item.doctor_id,
    centre_id: item.centre_id,
    payout_item_id: item.bill_item_id,
    service_month: item.service_month,
    patient_name: item.patient_name,
    bill_no: item.bill_no,
    ip_no: item.ip_no,
    payor_type: item.payor_type,
    payor_name: item.payor_name,
    calculated_amount: item.calculated_amount,
    expected_release: item.hold_release_date,
  }));

  const { error } = await sb.from('hmis_doctor_hold_bucket').insert(rows);
  return error ? 0 : rows.length;
}

// ---- Read: Payout Items for Settlement ----

export async function getPayoutItemsForSettlement(
  sb: SupabaseClient,
  doctorId: string,
  centreId: string,
  month: string
): Promise<PayoutItemResult[]> {
  const { data, error } = await sb
    .from('hmis_doctor_payout_items')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('centre_id', centreId)
    .eq('service_month', month)
    .is('settlement_id', null);

  if (error || !data) return [];

  return data.map(row => ({
    bill_id: row.bill_id,
    bill_item_id: row.bill_item_id || row.id,
    doctor_id: row.doctor_id,
    contract_id: row.contract_id,
    centre_id: row.centre_id,
    payout_role: row.payout_role || 'primary',
    service_month: row.service_month,
    bill_date: row.bill_date,
    patient_name: row.patient_name,
    bill_no: row.bill_no,
    ip_no: row.ip_no,
    encounter_type: row.encounter_type,
    payor_type: row.payor_type,
    payor_name: row.payor_name,
    department: row.department,
    service_name: row.service_name,
    billing_category: row.billing_category,
    case_type: row.case_type,
    package_name: row.package_name,
    service_amt: Number(row.service_amt ?? 0),
    doctor_amt: Number(row.doctor_amt ?? 0),
    net_amt: Number(row.net_amt ?? 0),
    hospital_amt: Number(row.hospital_amt ?? 0),
    base_method_used: row.base_method_used,
    pct_applied: Number(row.pct_applied ?? 0),
    is_self_case: row.is_self_case,
    calculated_amount: Number(row.calculated_amount ?? 0),
    expense_deductions_applied: row.expense_deductions_applied || {},
    fixed_payout_id: row.fixed_payout_id,
    formula_description: row.formula_description,
    is_held: row.is_held,
    hold_reason: row.hold_reason,
    hold_release_date: row.hold_release_date,
  }));
}

// ---- Write: Settlement ----

export async function upsertSettlement(
  sb: SupabaseClient,
  doctorId: string,
  centreId: string,
  contractId: string,
  month: string,
  cycle: string,
  result: SettlementResult,
  bills: any[]
): Promise<{ id: string | null; error: string | null }> {
  const row = {
    centre_id: centreId,
    doctor_id: doctorId,
    contract_id: contractId,
    month,
    cycle,
    cash_pool: result.cash_pool,
    tpa_pool: result.tpa_pool,
    pmjay_pool: result.pmjay_pool,
    govt_pool: result.govt_pool,
    total_pool: result.total_pool,
    opd_amount: result.opd_amount,
    mgm_triggered: result.mgm_triggered,
    mgm_topup: result.mgm_topup,
    incentive_triggered: result.incentive_triggered,
    incentive_amount: result.incentive_amount,
    retainer_amount: result.retainer_amount,
    gross_payout: result.gross_payout,
    immediate_payout: result.immediate_payout,
    held_payout: result.held_payout,
    tds_pct: result.tds_pct,
    tds_amount: result.tds_amount,
    net_payout: result.net_payout,
    status: 'computed',
    computed_at: new Date().toISOString(),
    bills,
    updated_at: new Date().toISOString(),
  };

  // Try upsert on unique constraint
  const { data, error } = await sb
    .from('hmis_doctor_settlements')
    .upsert(row, { onConflict: 'doctor_id,centre_id,month,cycle' })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

// ---- Write: Link payout items to settlement ----

export async function linkPayoutItemsToSettlement(
  sb: SupabaseClient,
  doctorId: string,
  centreId: string,
  month: string,
  settlementId: string
): Promise<number> {
  const { data, error } = await sb
    .from('hmis_doctor_payout_items')
    .update({ settlement_id: settlementId })
    .eq('doctor_id', doctorId)
    .eq('centre_id', centreId)
    .eq('service_month', month)
    .is('settlement_id', null)
    .select('id');

  return error ? 0 : (data?.length ?? 0);
}

// ---- Audit Log ----

export async function logPayoutAudit(
  sb: SupabaseClient,
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, any>
) {
  await sb.from('hmis_payout_audit_log').insert({
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    details,
  });
}
