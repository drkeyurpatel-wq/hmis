// lib/billing/encounter-hooks.ts
// Hooks for billing encounters, line items, invoices, and payments
// Uses the new billing_encounters / billing_line_items / billing_payments tables

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import type {
  BillingEncounter, BillingLineItem, BillingPayment,
  BillingInvoice, EncounterType, PayorType, EncounterStatus,
  BillingDashboardStats,
} from './types';

const ENCOUNTER_SELECT = `
  *,
  patient:hmis_patients!billing_encounters_patient_id_fkey(id, first_name, last_name, uhid, phone_primary, age_years, gender)
`;

// ═══════════════════════════════════════════════════════════
// ENCOUNTERS
// ═══════════════════════════════════════════════════════════

export function useEncounters(centreId: string | null) {
  const [encounters, setEncounters] = useState<BillingEncounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<BillingDashboardStats>({
    todayCollection: 0, pendingBills: 0, insurancePending: 0,
    advanceBalance: 0, todayBillCount: 0, opdCollection: 0,
    ipdCollection: 0, pharmacyCollection: 0,
  });

  const load = useCallback(async (filters?: {
    status?: string; encounterType?: string; search?: string;
    dateFrom?: string; dateTo?: string;
  }) => {
    if (!centreId) return;
    setLoading(true);
    let q = sb().from('billing_encounters')
      .select(ENCOUNTER_SELECT)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.encounterType && filters.encounterType !== 'all') q = q.eq('encounter_type', filters.encounterType);
    if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
    if (filters?.dateTo) q = q.lte('created_at', filters.dateTo);

    const { data } = await q;
    const all = (data || []) as BillingEncounter[];
    setEncounters(all);

    // Calculate dashboard stats
    const today = new Date().toISOString().split('T')[0];
    const todayEnc = all.filter(e => e.created_at?.startsWith(today));
    setStats({
      todayCollection: todayEnc.reduce((s, e) => s + Number(e.total_paid || 0), 0),
      pendingBills: all.filter(e => e.status === 'OPEN' && Number(e.balance_due) > 0).length,
      insurancePending: all.filter(e => e.primary_payor_type !== 'SELF_PAY' && e.status !== 'SETTLED').length,
      advanceBalance: 0,
      todayBillCount: todayEnc.length,
      opdCollection: todayEnc.filter(e => e.encounter_type === 'OPD').reduce((s, e) => s + Number(e.total_paid || 0), 0),
      ipdCollection: todayEnc.filter(e => e.encounter_type === 'IPD').reduce((s, e) => s + Number(e.total_paid || 0), 0),
      pharmacyCollection: 0,
    });
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (params: {
    patientId: string;
    encounterType: EncounterType;
    payorType: PayorType;
    consultingDoctorId?: string;
    admissionId?: string;
    appointmentId?: string;
    staffId: string;
  }): Promise<BillingEncounter | null> => {
    if (!centreId) return null;

    // Generate encounter number
    const seq = Date.now().toString().slice(-6);
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const encNumber = `H1-${params.encounterType}-${dateStr}-${seq}`;

    const insert: Record<string, unknown> = {
      centre_id: centreId,
      patient_id: params.patientId,
      encounter_type: params.encounterType,
      encounter_number: encNumber,
      primary_payor_type: params.payorType,
      status: 'OPEN',
      created_by: params.staffId,
    };

    if (params.encounterType === 'OPD') {
      insert.consulting_doctor_id = params.consultingDoctorId || null;
      insert.appointment_id = params.appointmentId || null;
      insert.visit_date = new Date().toISOString();
    }
    if (params.encounterType === 'IPD') {
      insert.admission_id = params.admissionId || null;
      insert.admitting_doctor_id = params.consultingDoctorId || null;
      insert.admission_date = new Date().toISOString();
    }

    const { data, error } = await sb().from('billing_encounters')
      .insert(insert).select(ENCOUNTER_SELECT).single();

    if (error) { console.error('Create encounter error:', error.message); return null; }
    load();
    return data as BillingEncounter;
  }, [centreId, load]);

  const updateStatus = useCallback(async (encounterId: string, status: EncounterStatus) => {
    await sb().from('billing_encounters')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', encounterId);
    load();
  }, [load]);

  return { encounters, loading, stats, load, create, updateStatus };
}

// ═══════════════════════════════════════════════════════════
// LINE ITEMS
// ═══════════════════════════════════════════════════════════

export function useLineItems(encounterId: string | null) {
  const [items, setItems] = useState<BillingLineItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!encounterId) return;
    setLoading(true);
    const { data } = await sb().from('billing_line_items')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('service_date')
      .order('created_at');
    setItems((data || []) as BillingLineItem[]);
    setLoading(false);
  }, [encounterId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (item: {
    centreId: string;
    serviceCode: string;
    serviceName: string;
    department: string;
    serviceCategory: string;
    quantity: number;
    unitRate: number;
    serviceMasterId?: string;
    serviceDoctorId?: string;
    sourceType?: string;
    sourceId?: string;
    staffId: string;
    discountAmount?: number;
    taxAmount?: number;
  }) => {
    if (!encounterId) return;
    const gross = item.quantity * item.unitRate;
    const disc = item.discountAmount || 0;
    const tax = item.taxAmount || 0;
    const net = gross - disc + tax;

    await sb().from('billing_line_items').insert({
      encounter_id: encounterId,
      centre_id: item.centreId,
      service_master_id: item.serviceMasterId || null,
      service_code: item.serviceCode,
      service_name: item.serviceName,
      department: item.department,
      service_category: item.serviceCategory,
      quantity: item.quantity,
      unit_rate: item.unitRate,
      gross_amount: gross,
      discount_amount: disc,
      tax_amount: tax,
      net_amount: net,
      service_doctor_id: item.serviceDoctorId || null,
      source_type: item.sourceType || 'MANUAL',
      source_id: item.sourceId || null,
      service_date: new Date().toISOString(),
      status: 'ACTIVE',
      created_by: item.staffId,
    });

    // Recalc encounter totals
    await recalcEncounterTotals(encounterId);
    load();
  }, [encounterId, load]);

  const cancel = useCallback(async (lineItemId: string, reason: string, staffId: string) => {
    if (!encounterId) return;
    await sb().from('billing_line_items').update({
      status: 'CANCELLED',
      cancel_reason: reason,
      cancelled_by: staffId,
      cancelled_at: new Date().toISOString(),
    }).eq('id', lineItemId);

    await recalcEncounterTotals(encounterId);
    load();
  }, [encounterId, load]);

  const summary = {
    totalGross: items.filter(i => i.status === 'ACTIVE').reduce((s, i) => s + Number(i.gross_amount), 0),
    totalDiscount: items.filter(i => i.status === 'ACTIVE').reduce((s, i) => s + Number(i.discount_amount), 0),
    totalTax: items.filter(i => i.status === 'ACTIVE').reduce((s, i) => s + Number(i.tax_amount), 0),
    totalNet: items.filter(i => i.status === 'ACTIVE').reduce((s, i) => s + Number(i.net_amount), 0),
    activeCount: items.filter(i => i.status === 'ACTIVE').length,
    cancelledCount: items.filter(i => i.status === 'CANCELLED').length,
  };

  return { items, loading, load, add, cancel, summary };
}

// ═══════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════

export function useEncounterPayments(encounterId: string | null) {
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!encounterId) return;
    setLoading(true);
    const { data } = await sb().from('billing_payments')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });
    setPayments((data || []) as BillingPayment[]);
    setLoading(false);
  }, [encounterId]);

  useEffect(() => { load(); }, [load]);

  const collect = useCallback(async (params: {
    centreId: string;
    patientId: string;
    amount: number;
    paymentMode: string;
    paymentReference?: string;
    paymentType?: string;
    isAdvance?: boolean;
    invoiceId?: string;
    staffId: string;
  }) => {
    if (!encounterId) return null;

    const seq = Date.now().toString().slice(-8);
    const receiptNumber = `H1-RCP-${seq}`;

    const { data, error } = await sb().from('billing_payments').insert({
      encounter_id: encounterId,
      centre_id: params.centreId,
      patient_id: params.patientId,
      invoice_id: params.invoiceId || null,
      receipt_number: receiptNumber,
      payment_date: new Date().toISOString(),
      amount: params.amount,
      payment_mode: params.paymentMode,
      payment_reference: params.paymentReference || null,
      payment_type: params.paymentType || 'COLLECTION',
      is_advance: params.isAdvance || false,
      advance_balance: params.isAdvance ? params.amount : 0,
      status: 'COMPLETED',
      created_by: params.staffId,
    }).select().single();

    if (error) { console.error('Payment error:', error.message); return null; }

    await recalcEncounterTotals(encounterId);
    load();
    return data as BillingPayment;
  }, [encounterId, load]);

  const voidPayment = useCallback(async (paymentId: string, reason: string, staffId: string) => {
    if (!encounterId) return;
    await sb().from('billing_payments').update({
      status: 'VOIDED',
      void_reason: reason,
      voided_by: staffId,
      voided_at: new Date().toISOString(),
    }).eq('id', paymentId);

    await recalcEncounterTotals(encounterId);
    load();
  }, [encounterId, load]);

  const totalPaid = payments.filter(p => p.status === 'COMPLETED' && p.payment_type !== 'REFUND')
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalRefunded = payments.filter(p => p.payment_type === 'REFUND')
    .reduce((s, p) => s + Number(p.amount), 0);

  return { payments, loading, load, collect, voidPayment, totalPaid, totalRefunded };
}

// ═══════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════

export function useInvoices(encounterId: string | null) {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);

  const load = useCallback(async () => {
    if (!encounterId) return;
    const { data } = await sb().from('billing_invoices')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false });
    setInvoices((data || []) as BillingInvoice[]);
  }, [encounterId]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async (params: {
    centreId: string;
    patientId: string;
    invoiceType: string;
    lineItemIds: string[];
    staffId: string;
  }) => {
    if (!encounterId) return null;

    // Get line items for this invoice
    const { data: lineItems } = await sb().from('billing_line_items')
      .select('*')
      .in('id', params.lineItemIds)
      .eq('status', 'ACTIVE');

    if (!lineItems || lineItems.length === 0) return null;

    const subtotal = lineItems.reduce((s: number, i: Record<string, unknown>) => s + Number(i.gross_amount || 0), 0);
    const totalDiscount = lineItems.reduce((s: number, i: Record<string, unknown>) => s + Number(i.discount_amount || 0), 0);
    const totalTax = lineItems.reduce((s: number, i: Record<string, unknown>) => s + Number(i.tax_amount || 0), 0);
    const grandTotal = lineItems.reduce((s: number, i: Record<string, unknown>) => s + Number(i.net_amount || 0), 0);

    const seq = Date.now().toString().slice(-8);
    const invoiceNumber = `H1-INV-${seq}`;

    const { data: invoice, error } = await sb().from('billing_invoices').insert({
      encounter_id: encounterId,
      centre_id: params.centreId,
      patient_id: params.patientId,
      invoice_number: invoiceNumber,
      invoice_type: params.invoiceType,
      subtotal,
      total_discount: totalDiscount,
      total_tax: totalTax,
      grand_total: grandTotal,
      balance_due: grandTotal,
      status: 'GENERATED',
      created_by: params.staffId,
    }).select().single();

    if (error || !invoice) return null;

    // Link line items
    const links = params.lineItemIds.map(liId => {
      const li = lineItems.find((i: Record<string, unknown>) => i.id === liId);
      return { invoice_id: invoice.id, line_item_id: liId, amount: Number(li?.net_amount || 0) };
    });
    await sb().from('billing_invoice_line_items').insert(links);

    load();
    return invoice as BillingInvoice;
  }, [encounterId, load]);

  return { invoices, load, generate };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

async function recalcEncounterTotals(encounterId: string) {
  // Get active line items
  const { data: items } = await sb().from('billing_line_items')
    .select('gross_amount, discount_amount, tax_amount, net_amount')
    .eq('encounter_id', encounterId).eq('status', 'ACTIVE');

  const totalCharges = (items || []).reduce((s: number, i: Record<string, unknown>) => s + Number(i.gross_amount || 0), 0);
  const totalDiscounts = (items || []).reduce((s: number, i: Record<string, unknown>) => s + Number(i.discount_amount || 0), 0);
  const totalTax = (items || []).reduce((s: number, i: Record<string, unknown>) => s + Number(i.tax_amount || 0), 0);
  const netAmount = (items || []).reduce((s: number, i: Record<string, unknown>) => s + Number(i.net_amount || 0), 0);

  // Get completed payments
  const { data: payments } = await sb().from('billing_payments')
    .select('amount, payment_type')
    .eq('encounter_id', encounterId).eq('status', 'COMPLETED');

  const totalPaid = (payments || [])
    .filter((p: Record<string, unknown>) => p.payment_type !== 'REFUND')
    .reduce((s: number, p: Record<string, unknown>) => s + Number(p.amount || 0), 0);
  const totalRefunded = (payments || [])
    .filter((p: Record<string, unknown>) => p.payment_type === 'REFUND')
    .reduce((s: number, p: Record<string, unknown>) => s + Number(p.amount || 0), 0);

  await sb().from('billing_encounters').update({
    total_charges: totalCharges,
    total_discounts: totalDiscounts,
    total_tax: totalTax,
    net_amount: netAmount,
    total_paid: totalPaid,
    total_refunded: totalRefunded,
    balance_due: netAmount - totalPaid + totalRefunded,
    updated_at: new Date().toISOString(),
  }).eq('id', encounterId);
}
