// lib/billing/billing-hooks.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { auditCreate, auditUpdate } from '@/lib/audit/audit-logger';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// BILLS
// ============================================================
export function useBillsV2(centreId: string | null) {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalBills: 0, totalRevenue: 0, collected: 0, outstanding: 0, todayCount: 0, todayRevenue: 0 });

  const load = useCallback(async (filters?: { dateFrom?: string; dateTo?: string; status?: string; payorType?: string; billType?: string; search?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_bills')
      .select('*, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, phone_primary)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    if (filters?.dateFrom) q = q.gte('bill_date', filters.dateFrom);
    if (filters?.dateTo) q = q.lte('bill_date', filters.dateTo);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.payorType && filters.payorType !== 'all') q = q.eq('payor_type', filters.payorType);
    if (filters?.billType && filters.billType !== 'all') q = q.eq('bill_type', filters.billType);
    const { data } = await q;
    setBills(data || []);
    // Stats
    const all = data || [];
    const today = new Date().toISOString().split('T')[0];
    const todayBills = all.filter((b: any) => b.bill_date === today);
    setStats({
      totalBills: all.length, totalRevenue: all.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0),
      collected: all.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || 0), 0),
      outstanding: all.reduce((s: number, b: any) => s + parseFloat(b.balance_amount || 0), 0),
      todayCount: todayBills.length, todayRevenue: todayBills.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0),
    });
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const createBill = useCallback(async (data: { patientId: string; billType: string; payorType: string; items: any[]; admissionId?: string; encounterId?: string }, staffId: string) => {
    if (!centreId || !sb()) return null;
    const gross = data.items.reduce((s, i) => s + (i.quantity || 1) * (i.unitRate || 0), 0);
    const { data: bill } = await sb().from('hmis_bills').insert({
      centre_id: centreId, patient_id: data.patientId, bill_number: `BL-${Date.now()}`,
      bill_type: data.billType, payor_type: data.payorType, bill_date: new Date().toISOString().split('T')[0],
      gross_amount: gross, net_amount: gross, balance_amount: gross, created_by: staffId,
      ...(data.admissionId ? { encounter_type: 'ipd', encounter_id: data.admissionId } : {}),
    }).select().single();
    if (bill) {
      for (const item of data.items) {
        const amt = (item.quantity || 1) * (item.unitRate || 0);
        await sb().from('hmis_bill_items').insert({
          bill_id: bill.id, description: item.description, quantity: item.quantity || 1,
          unit_rate: item.unitRate, amount: amt, discount: 0, tax: 0, net_amount: amt,
          service_date: new Date().toISOString().split('T')[0],
          tariff_id: item.tariffId || null, department_id: item.departmentId || null, doctor_id: item.doctorId || null,
        });
      }
      load();
    }
    return bill;
  }, [centreId, load]);

  const finalize = useCallback(async (billId: string) => {
    if (!sb()) return;
    await sb().from('hmis_bills').update({ status: 'final' }).eq('id', billId);
    load();
  }, [load]);

  const cancel = useCallback(async (billId: string, reason: string) => {
    if (!sb()) return;
    await sb().from('hmis_bills').update({ status: 'cancelled' }).eq('id', billId);
    load();
  }, [load]);

  const applyDiscount = useCallback(async (billId: string, amount: number, reason: string, staffId: string) => {
    if (!sb()) return;
    const { data: bill } = await sb().from('hmis_bills').select('gross_amount, discount_amount, paid_amount').eq('id', billId).single();
    if (!bill) return;
    const newDiscount = parseFloat(bill.discount_amount) + amount;
    const newNet = parseFloat(bill.gross_amount) - newDiscount;
    const newBal = newNet - parseFloat(bill.paid_amount);
    await sb().from('hmis_bills').update({ discount_amount: newDiscount, net_amount: newNet, balance_amount: newBal }).eq('id', billId);
    await sb().from('hmis_discount_log').insert({ bill_id: billId, discount_type: 'flat', discount_amount: amount, reason, authorized_by: staffId });
    load();
  }, [load]);

  return { bills, loading, stats, load, createBill, finalize, cancel, applyDiscount };
}

// ============================================================
// BILL ITEMS
// ============================================================
export function useBillItems(billId: string | null) {
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!billId || !sb()) return;
    const { data } = await sb().from('hmis_bill_items').select('*, tariff:hmis_tariff_master(service_code, service_name, category), department:hmis_departments(name), doctor:hmis_staff!hmis_bill_items_doctor_id_fkey(full_name)').eq('bill_id', billId).order('service_date');
    setItems(data || []);
  }, [billId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (item: any) => {
    if (!billId || !sb()) return;
    const amt = (item.quantity || 1) * (item.unitRate || 0);
    await sb().from('hmis_bill_items').insert({
      bill_id: billId, description: item.description, quantity: item.quantity || 1,
      unit_rate: item.unitRate, amount: amt, discount: item.discount || 0,
      tax: item.tax || 0, net_amount: amt - (item.discount || 0),
      service_date: item.serviceDate || new Date().toISOString().split('T')[0],
      tariff_id: item.tariffId, department_id: item.departmentId, doctor_id: item.doctorId,
    });
    // Update bill totals
    const { data: allItems } = await sb().from('hmis_bill_items').select('net_amount').eq('bill_id', billId);
    const gross = (allItems || []).reduce((s: number, i: any) => s + parseFloat(i.net_amount), 0);
    const { data: bill } = await sb().from('hmis_bills').select('discount_amount, paid_amount').eq('id', billId).single();
    const net = gross - parseFloat(bill?.discount_amount || 0);
    await sb().from('hmis_bills').update({ gross_amount: gross, net_amount: net, balance_amount: net - parseFloat(bill?.paid_amount || 0) }).eq('id', billId);
    load();
  }, [billId, load]);

  const remove = useCallback(async (itemId: string) => {
    if (!billId || !sb()) return;
    await sb().from('hmis_bill_items').delete().eq('id', itemId);
    // Recalculate
    const { data: allItems } = await sb().from('hmis_bill_items').select('net_amount').eq('bill_id', billId);
    const gross = (allItems || []).reduce((s: number, i: any) => s + parseFloat(i.net_amount), 0);
    const { data: bill } = await sb().from('hmis_bills').select('discount_amount, paid_amount').eq('id', billId).single();
    const net = gross - parseFloat(bill?.discount_amount || 0);
    await sb().from('hmis_bills').update({ gross_amount: gross, net_amount: net, balance_amount: net - parseFloat(bill?.paid_amount || 0) }).eq('id', billId);
    load();
  }, [billId, load]);

  return { items, load, add, remove };
}

// ============================================================
// PAYMENTS
// ============================================================
export function usePaymentsV2(billId: string | null) {
  const [payments, setPayments] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!billId || !sb()) return;
    const { data } = await sb().from('hmis_payments').select('*, staff:hmis_staff!hmis_payments_received_by_fkey(full_name)').eq('bill_id', billId).order('payment_date', { ascending: false });
    setPayments(data || []);
  }, [billId]);

  useEffect(() => { load(); }, [load]);

  const collect = useCallback(async (amount: number, mode: string, reference: string, staffId: string) => {
    if (!billId || !sb()) return;
    const rcpt = `RCP-${Date.now()}`;
    await sb().from('hmis_payments').insert({
      bill_id: billId, amount, payment_mode: mode, reference_number: reference || null,
      receipt_number: rcpt, payment_date: new Date().toISOString().split('T')[0], received_by: staffId,
    });
    // Update bill
    const { data: bill } = await sb().from('hmis_bills').select('paid_amount, net_amount').eq('id', billId).single();
    if (bill) {
      const newPaid = parseFloat(bill.paid_amount) + amount;
      const newBal = parseFloat(bill.net_amount) - newPaid;
      await sb().from('hmis_bills').update({
        paid_amount: newPaid, balance_amount: newBal,
        status: newBal <= 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'final',
      }).eq('id', billId);
    }
    load();
    return rcpt;
  }, [billId, load]);

  return { payments, load, collect };
}

// ============================================================
// ADVANCES
// ============================================================
export function useAdvances(patientId: string | null) {
  const [advances, setAdvances] = useState<any[]>([]);
  const [totalActive, setTotalActive] = useState(0);

  const load = useCallback(async () => {
    if (!patientId || !sb()) return;
    const { data } = await sb().from('hmis_advances').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    setAdvances(data || []);
    setTotalActive((data || []).filter((a: any) => a.status === 'active').reduce((s: number, a: any) => s + parseFloat(a.amount), 0));
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const collect = useCallback(async (amount: number, mode: string, admissionId?: string) => {
    if (!patientId || !sb()) return;
    await sb().from('hmis_advances').insert({
      patient_id: patientId, admission_id: admissionId || null,
      amount, payment_mode: mode, receipt_number: `ADV-${Date.now()}`,
    });
    load();
  }, [patientId, load]);

  const adjust = useCallback(async (advanceId: string, billId: string) => {
    if (!sb()) return;
    await sb().from('hmis_advances').update({ status: 'adjusted', adjusted_against_bill_id: billId }).eq('id', advanceId);
    load();
  }, [load]);

  const refund = useCallback(async (advanceId: string, reason: string, staffId: string) => {
    if (!patientId || !sb()) return;
    const adv = advances.find(a => a.id === advanceId);
    if (!adv) return;
    await sb().from('hmis_refunds').insert({
      advance_id: advanceId, patient_id: patientId, amount: adv.amount,
      reason, approved_by: staffId, refund_mode: adv.payment_mode, refund_date: new Date().toISOString().split('T')[0],
    });
    await sb().from('hmis_advances').update({ status: 'refunded' }).eq('id', advanceId);
    load();
  }, [patientId, advances, load]);

  return { advances, totalActive, load, collect, adjust, refund };
}

// ============================================================
// TARIFF MASTER
// ============================================================
export function useTariffs(centreId: string | null) {
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_tariff_master').select('*').eq('centre_id', centreId).eq('is_active', true).order('category').order('service_name');
    setTariffs(data || []);
    const cats = [...new Set((data || []).map((t: any) => t.category))] as string[];
    setCategories(cats);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const search = useCallback((query: string, category?: string) => {
    const q = query.toLowerCase();
    return tariffs.filter(t => {
      if (category && t.category !== category) return false;
      return t.service_name.toLowerCase().includes(q) || t.service_code.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [tariffs]);

  const getRate = useCallback((tariffId: string, payorType: string) => {
    const t = tariffs.find(t => t.id === tariffId);
    if (!t) return 0;
    switch (payorType) {
      case 'insurance': return parseFloat(t.rate_insurance || t.rate_self);
      case 'govt_pmjay': return parseFloat(t.rate_pmjay || t.rate_self);
      case 'govt_cghs': return parseFloat(t.rate_cghs || t.rate_self);
      default: return parseFloat(t.rate_self);
    }
  }, [tariffs]);

  return { tariffs, categories, load, search, getRate };
}

// ============================================================
// ESTIMATES
// ============================================================
export function useEstimates(centreId: string | null) {
  const [estimates, setEstimates] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_estimates')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(50);
    setEstimates(data || []);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return;
    const num = `EST-${Date.now()}`;
    await sb().from('hmis_estimates').insert({ ...data, centre_id: centreId, estimate_number: num, created_by: staffId });
    load();
  }, [centreId, load]);

  return { estimates, load, create };
}

// ============================================================
// PACKAGES
// ============================================================
