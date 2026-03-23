// lib/billing/billing-engine.ts
// Core billing engine — every service from tariff → bill → payment → receipt

import { sb } from '@/lib/supabase/browser';
import { resolveCostCentre } from './cost-centre-hooks';

// ============================================================
// TYPES
// ============================================================
export interface TariffItem {
  id: string;
  service_name: string;
  service_code: string;
  category: string;
  rate_self: number;
  rate_insurance: number;
  rate_pmjay: number;
  rate_cghs: number;
  cost_price: number;
}

export interface BillLineItem {
  id: string;
  tariff_id: string | null;
  description: string;
  category: string;
  quantity: number;
  days: number;
  unit_rate: number;
  unit_cost: number;     // cost per unit (from tariff, pharmacy purchase_rate, implant cost)
  amount: number;        // qty × days × rate
  cost_amount: number;   // qty × days × unit_cost
  margin: number;        // net_amount - cost_amount
  margin_pct: number;    // margin / net_amount × 100
  discount_pct: number;
  discount_amt: number;
  tax_pct: number;
  tax_amt: number;
  net_amount: number;    // amount - discount + tax
  service_date: string;
  doctor_id?: string;
  doctor_name?: string;
  department?: string;
}

export interface PaymentEntry {
  mode: 'cash' | 'card' | 'upi' | 'neft' | 'cheque' | 'insurance_settlement';
  amount: number;
  reference: string;
}

export interface BillSummary {
  gross: number;
  totalDiscount: number;
  totalTax: number;
  net: number;
  totalCost: number;
  margin: number;
  marginPct: number;
  paid: number;
  balance: number;
  itemCount: number;
}

// ============================================================
// PMJAY PACKAGE SEARCH — when payor is PMJAY
// ============================================================
export interface PmjayPackage {
  id: string;
  procedure_code: string;
  package_code: string;
  specialty: string;
  package_name: string;
  procedure_name: string;
  base_rate: number;
  nabh_incentive: number;
  effective_rate: number;
  implant_name: string;
  implant_cost: number;
  total_with_implant: number;
  level_of_care: string;
  alos: number;
  is_day_care: boolean;
  auto_approved: boolean;
  pre_auth_docs: string;
}

export async function searchPmjayPackages(centreId: string, query: string): Promise<PmjayPackage[]> {
  if (!query || query.length < 2) return [];
  const { data } = await sb()!.from('hmis_pmjay_packages')
    .select('*').eq('centre_id', centreId).eq('is_active', true)
    .or(`package_name.ilike.%${query}%,procedure_name.ilike.%${query}%,specialty.ilike.%${query}%,procedure_code.ilike.%${query}%`)
    .order('package_name').limit(20);
  return data || [];
}

export async function getPmjaySpecialties(centreId: string): Promise<string[]> {
  const { data } = await sb()!.from('hmis_pmjay_packages')
    .select('specialty').eq('centre_id', centreId).eq('is_active', true);
  const specs: string[] = (data || []).map((d: any) => String(d.specialty).split(',')[0].trim());
  return [...new Set(specs)].sort();
}

// ============================================================
// TARIFF SEARCH — with PMJAY fallback
// ============================================================
export async function searchTariff(
  centreId: string,
  query: string,
  category?: string
): Promise<TariffItem[]> {
  if (!query || query.length < 2) return [];
  let q = sb()!.from('hmis_tariff_master')
    .select('id, service_name, service_code, category, rate_self, rate_insurance, rate_pmjay, rate_cghs, cost_price')
    .eq('centre_id', centreId).eq('is_active', true)
    .ilike('service_name', `%${query}%`)
    .order('category').limit(20);
  if (category) q = q.eq('category', category);
  const { data } = await q;
  return data || [];
}

export async function getTariffCategories(centreId: string): Promise<string[]> {
  const { data } = await sb()!.from('hmis_tariff_master')
    .select('category').eq('centre_id', centreId).eq('is_active', true);
  const cats: string[] = (data || []).map((d: any) => String(d.category));
  return [...new Set(cats)].sort();
}

// ============================================================
// RATE PICKER — based on payor
// ============================================================
export function getRateForPayor(tariff: TariffItem, payorType: string): number {
  switch (payorType) {
    case 'insurance': case 'cashless': return tariff.rate_insurance || tariff.rate_self;
    case 'pmjay': return tariff.rate_pmjay || tariff.rate_self;
    case 'cghs': case 'echs': return tariff.rate_cghs || tariff.rate_self;
    default: return tariff.rate_self;
  }
}

// ============================================================
// LINE ITEM MATH
// ============================================================
export function calcLineItem(item: Partial<BillLineItem>): BillLineItem {
  const qty = item.quantity || 1;
  const days = item.days || 1;
  const rate = item.unit_rate || 0;
  const cost = item.unit_cost || 0;
  const amount = qty * days * rate;
  const costAmount = qty * days * cost;
  const discPct = item.discount_pct || 0;
  const discAmt = item.discount_amt || Math.round(amount * discPct / 100);
  const taxPct = item.tax_pct || 0;
  const taxAmt = Math.round((amount - discAmt) * taxPct / 100);
  const net = amount - discAmt + taxAmt;
  const margin = net - costAmount;
  const marginPct = net > 0 ? Math.round((margin / net) * 1000) / 10 : 0;
  return {
    id: item.id || `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tariff_id: item.tariff_id || null,
    description: item.description || '',
    category: item.category || '',
    quantity: qty,
    days,
    unit_rate: rate,
    unit_cost: cost,
    amount,
    cost_amount: costAmount,
    margin,
    margin_pct: marginPct,
    discount_pct: discPct,
    discount_amt: discAmt,
    tax_pct: taxPct,
    tax_amt: taxAmt,
    net_amount: net,
    service_date: item.service_date || new Date().toISOString().split('T')[0],
    doctor_id: item.doctor_id,
    doctor_name: item.doctor_name,
    department: item.department,
  };
}

export function calcBillSummary(items: BillLineItem[], payments: PaymentEntry[]): BillSummary {
  const gross = items.reduce((s, i) => s + i.amount, 0);
  const totalDiscount = items.reduce((s, i) => s + i.discount_amt, 0);
  const totalTax = items.reduce((s, i) => s + i.tax_amt, 0);
  const net = items.reduce((s, i) => s + i.net_amount, 0);
  const totalCost = items.reduce((s, i) => s + i.cost_amount, 0);
  const margin = net - totalCost;
  const marginPct = net > 0 ? Math.round((margin / net) * 1000) / 10 : 0;
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return { gross, totalDiscount, totalTax, net, totalCost, margin, marginPct, paid, balance: net - paid, itemCount: items.length };
}

// ============================================================
// CREATE BILL — atomic: bill + items + payments
// ============================================================
export async function createBill(params: {
  centreId: string;
  patientId: string;
  billType: 'opd' | 'ipd' | 'pharmacy' | 'lab' | 'radiology' | 'package';
  payorType: string;
  encounterId?: string;
  admissionId?: string;
  items: BillLineItem[];
  payments: PaymentEntry[];
  staffId: string;
  globalDiscountPct?: number;
  notes?: string;
}): Promise<{ success: boolean; billId?: string; billNumber?: string; error?: string }> {
  const { centreId, patientId, items, payments, staffId, globalDiscountPct } = params;
  if (items.length === 0) return { success: false, error: 'No items' };

  // Apply global discount if any
  let finalItems = items;
  if (globalDiscountPct && globalDiscountPct > 0) {
    finalItems = items.map(i => calcLineItem({ ...i, discount_pct: globalDiscountPct }));
  }

  const summary = calcBillSummary(finalItems, payments);

  // Generate bill number
  const { data: billNumber, error: seqErr } = await sb()!.rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'bill' });
  if (seqErr || !billNumber) return { success: false, error: 'Bill number generation failed' };

  // Insert bill
  const { data: bill, error: billErr } = await sb()!.from('hmis_bills').insert({
    centre_id: centreId, patient_id: patientId,
    bill_number: billNumber, bill_type: params.billType,
    encounter_id: params.encounterId || null,
    payor_type: params.payorType,
    gross_amount: summary.gross, discount_amount: summary.totalDiscount,
    tax_amount: summary.totalTax, net_amount: summary.net,
    total_cost: summary.totalCost,
    paid_amount: summary.paid, balance_amount: summary.balance,
    status: summary.balance <= 0 ? 'paid' : summary.paid > 0 ? 'partially_paid' : 'final',
    bill_date: new Date().toISOString().split('T')[0],
    created_by: staffId, notes: params.notes,
  }).select('id').single();

  if (billErr) return { success: false, error: billErr.message };

  // Insert line items — resolve cost centre for each item
  const itemRows = await Promise.all(finalItems.map(async (i) => {
    const costCentreId = await resolveCostCentre(centreId, {
      departmentName: i.department, tariffCategory: i.category, billType: params.billType,
    });
    return {
      bill_id: bill.id, tariff_id: i.tariff_id,
      description: i.description, quantity: i.quantity * i.days,
      unit_rate: i.unit_rate, unit_cost: i.unit_cost, cost_amount: i.cost_amount,
      amount: i.amount,
      discount: i.discount_amt, tax: i.tax_amt, net_amount: i.net_amount,
      service_date: i.service_date, doctor_id: i.doctor_id,
      cost_centre_id: costCentreId,
    };
  }));
  await sb()!.from('hmis_bill_items').insert(itemRows);

  // Insert payments
  for (const p of payments) {
    if (p.amount <= 0) continue;
    const { data: receiptNo } = await sb()!.rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'receipt' });
    await sb()!.from('hmis_payments').insert({
      bill_id: bill.id, amount: p.amount, payment_mode: p.mode,
      reference_number: p.reference || null, receipt_number: receiptNo || `R-${Date.now()}`,
      payment_date: new Date().toISOString().split('T')[0], received_by: staffId,
    });
  }

  // BRIDGE: Auto-create insurance claim for insured IPD patients
  if (params.billType === 'ipd' && params.payorType !== 'self' && params.encounterId) {
    const { data: adm } = await sb()!.from('hmis_admissions')
      .select('patient_insurance_id').eq('id', params.encounterId).single();
    if (adm?.patient_insurance_id) {
      import('@/lib/bridge/module-events').then(({ onFinalBillCreatedForInsured }) =>
        onFinalBillCreatedForInsured({
          centreId, admissionId: params.encounterId!, billId: bill.id,
          patientInsuranceId: adm.patient_insurance_id,
          netAmount: summary.net, staffId,
        }).catch(() => {})
      );
    }
  }

  return { success: true, billId: bill.id, billNumber };
}

// ============================================================
// ADD PAYMENT TO EXISTING BILL
// ============================================================
export async function addPaymentToBill(
  billId: string, centreId: string, staffId: string, payment: PaymentEntry
): Promise<{ success: boolean; error?: string }> {
  const { data: receiptNo } = await sb()!.rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'receipt' });
  const { error: payErr } = await sb()!.from('hmis_payments').insert({
    bill_id: billId, amount: payment.amount, payment_mode: payment.mode,
    reference_number: payment.reference || null, receipt_number: receiptNo || `R-${Date.now()}`,
    payment_date: new Date().toISOString().split('T')[0], received_by: staffId,
  });
  if (payErr) return { success: false, error: payErr.message };

  // Update bill totals
  const { data: allPayments } = await sb()!.from('hmis_payments').select('amount').eq('bill_id', billId);
  const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
  const { data: bill } = await sb()!.from('hmis_bills').select('net_amount').eq('id', billId).single();
  const balance = parseFloat(bill?.net_amount || 0) - totalPaid;
  await sb()!.from('hmis_bills').update({
    paid_amount: totalPaid, balance_amount: balance,
    status: balance <= 0 ? 'paid' : 'partially_paid',
  }).eq('id', billId);
  return { success: true };
}

// ============================================================
// IPD: AUTO-POST DAILY CHARGES
// ============================================================
export async function postDailyIPDCharges(
  admissionId: string, centreId: string, staffId: string
): Promise<{ posted: number; total: number }> {
  // Get admission details
  const { data: admission } = await sb()!.from('hmis_admissions')
    .select('id, patient_id, bed:hmis_beds(room:hmis_rooms(ward:hmis_wards(name)))').eq('id', admissionId).single();
  if (!admission) return { posted: 0, total: 0 };

  const today = new Date().toISOString().split('T')[0];
  const charges: { name: string; category: string }[] = [
    { name: 'Bed Charges', category: 'ward_icu' },
    { name: 'Nursing Charges', category: 'hospital_services' },
    { name: 'MO Visit Charges', category: 'hospital_services' },
    { name: 'Diet Charges', category: 'hospital_services' },
  ];

  let posted = 0;
  let total = 0;

  for (const charge of charges) {
    // Look up tariff
    const { data: tariffs } = await sb()!.from('hmis_tariff_master')
      .select('id, service_name, rate_self, rate_insurance')
      .eq('centre_id', centreId).eq('is_active', true)
      .ilike('service_name', `%${charge.name}%`).limit(1);

    if (tariffs && tariffs.length > 0) {
      const tariff = tariffs[0];
      const rate = tariff.rate_self || 0;
      total += rate;

      // Check if already posted today
      const { count } = await sb()!.from('hmis_charge_log')
        .select('id', { count: 'exact', head: true })
        .eq('admission_id', admissionId).eq('service_date', today)
        .ilike('service_name', `%${charge.name}%`);

      if (count === 0 && rate > 0) {
        await sb()!.from('hmis_charge_log').insert({
          centre_id: centreId, patient_id: admission.patient_id,
          admission_id: admissionId, service_name: tariff.service_name,
          tariff_id: tariff.id, amount: rate, status: 'posted',
          service_date: today, posted_by: staffId, category: charge.category,
        });
        posted++;
      }
    }
  }

  return { posted, total };
}

// ============================================================
// IPD: BUILD BILL FROM CHARGE LOG
// ============================================================
export async function buildIPDBillFromCharges(
  admissionId: string, centreId: string, staffId: string, payorType: string
): Promise<BillLineItem[]> {
  const { data: charges } = await sb()!.from('hmis_charge_log')
    .select('*').eq('admission_id', admissionId).eq('status', 'posted')
    .order('service_date').order('service_name');
  if (!charges || charges.length === 0) return [];

  // Group by service_name + rate to consolidate
  const grouped: Record<string, { charge: any; count: number; dates: string[] }> = {};
  for (const c of charges) {
    const key = `${c.service_name}_${c.amount}`;
    if (!grouped[key]) grouped[key] = { charge: c, count: 0, dates: [] };
    grouped[key].count++;
    if (!grouped[key].dates.includes(c.service_date)) grouped[key].dates.push(c.service_date);
  }

  return Object.values(grouped).map(g => calcLineItem({
    tariff_id: g.charge.tariff_id,
    description: g.charge.service_name,
    category: g.charge.category || '',
    quantity: 1,
    days: g.count,
    unit_rate: parseFloat(g.charge.amount),
    unit_cost: parseFloat(g.charge.unit_cost || 0),
    service_date: g.dates[0],
  }));
}

// ============================================================
// LOAD BILL WITH ITEMS + PAYMENTS
// ============================================================
export async function loadBillDetails(billId: string): Promise<{
  bill: any; items: any[]; payments: any[];
} | null> {
  const { data: bill } = await sb()!.from('hmis_bills')
    .select('*, patient:hmis_patients(first_name, last_name, uhid, phone_primary)')
    .eq('id', billId).single();
  if (!bill) return null;

  const { data: items } = await sb()!.from('hmis_bill_items')
    .select('*').eq('bill_id', billId).order('service_date');
  const { data: payments } = await sb()!.from('hmis_payments')
    .select('*').eq('bill_id', billId).order('created_at');

  return { bill, items: items || [], payments: payments || [] };
}
