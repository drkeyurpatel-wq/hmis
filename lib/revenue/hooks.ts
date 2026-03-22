// lib/revenue/hooks.ts
// Supabase hooks for OPD → Billing → Pharmacy revenue loop

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendOPDTokenConfirmation, sendPharmacyReady, sendPaymentReceipt } from '@/lib/notifications/whatsapp';

let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (typeof window === 'undefined') return null as any;
  if (!_sb) { try { _sb = createClient(); } catch { return null as any; } }
  return _sb;
}

// ============================================================
// OPD QUEUE
// ============================================================
export interface OPDVisit {
  id: string; visitNumber: string; tokenNumber: number; status: string;
  checkInTime: string | null; consultStart: string | null; consultEnd: string | null;
  chiefComplaint: string | null; appointmentId: string | null;
  patient: { id: string; uhid: string; name: string; age: number | null; gender: string; phone: string };
  doctor: { id: string; name: string; department: string };
}

export function useOPDQueue(centreId: string | null, doctorId?: string | null) {
  const [visits, setVisits] = useState<OPDVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ waiting: 0, withDoctor: 0, completed: 0, total: 0 });

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    let query = sb().from('hmis_opd_visits')
      .select(`id, visit_number, token_number, status, check_in_time, consultation_start, consultation_end, chief_complaint, appointment_id,
        patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, phone_primary),
        doctor:hmis_staff!inner(id, full_name, specialisation)`)
      .eq('centre_id', centreId)
      .gte('created_at', today + 'T00:00:00')
      .lte('created_at', today + 'T23:59:59')
      .order('token_number', { ascending: true });

    if (doctorId) query = query.eq('doctor_id', doctorId);

    const { data } = await query;
    const mapped = (data || []).map((v: any) => ({
      id: v.id, visitNumber: v.visit_number, tokenNumber: v.token_number,
      status: v.status, checkInTime: v.check_in_time, consultStart: v.consultation_start,
      consultEnd: v.consultation_end, chiefComplaint: v.chief_complaint,
      appointmentId: v.appointment_id,
      patient: { id: v.patient.id, uhid: v.patient.uhid, name: v.patient.first_name + ' ' + (v.patient.last_name || ''), age: v.patient.age_years, gender: v.patient.gender, phone: v.patient.phone_primary },
      doctor: { id: v.doctor.id, name: v.doctor.full_name, department: v.doctor.specialisation || '' },
    }));
    setVisits(mapped);
    setStats({
      waiting: mapped.filter((v: OPDVisit) => v.status === 'waiting').length,
      withDoctor: mapped.filter((v: OPDVisit) => v.status === 'with_doctor').length,
      completed: mapped.filter((v: OPDVisit) => v.status === 'completed').length,
      total: mapped.length,
    });
    setLoading(false);
  }, [centreId, doctorId]);

  useEffect(() => { load(); }, [load]);

  // Real-time
  useEffect(() => {
    if (!centreId || !sb()) return;
    const channel = sb().channel('opd-queue-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_opd_visits', filter: `centre_id=eq.${centreId}` }, () => load())
      .subscribe();
    return () => { sb().removeChannel(channel); };
  }, [centreId, load]);

  const createVisit = useCallback(async (patientId: string, drId: string, type: string = 'new', complaint?: string) => {
    if (!centreId || !sb()) return null;
    const { data: visitNum } = await sb().rpc('hmis_next_visit_number', { p_centre_id: centreId });
    const { data: tokenNum } = await sb().rpc('hmis_next_token', { p_centre_id: centreId, p_doctor_id: drId });
    const { data, error } = await sb().from('hmis_opd_visits').insert({
      centre_id: centreId, patient_id: patientId, doctor_id: drId,
      visit_number: visitNum || 'V-' + Date.now(), token_number: tokenNum || 1,
      chief_complaint: complaint || null, status: 'waiting',
      check_in_time: new Date().toISOString(),
    }).select().single();
    if (!error && data) {
      load();
      // WhatsApp: send token confirmation
      try {
        const { data: pt } = await sb().from('hmis_patients').select('phone_primary, first_name').eq('id', patientId).single();
        const { data: dr } = await sb().from('hmis_staff').select('full_name').eq('id', drId).single();
        if (pt?.phone_primary) {
          sendOPDTokenConfirmation(pt.phone_primary, pt.first_name || 'Patient', 'T-' + String(tokenNum || 1).padStart(3, '0'), dr?.full_name || 'Doctor');
        }
      } catch { /* WhatsApp send is non-blocking */ }
    }
    return { data, error };
  }, [centreId, load]);

  const updateStatus = useCallback(async (visitId: string, status: string) => {
    if (!sb()) return;
    const updates: any = { status };
    if (status === 'with_doctor') updates.consultation_start = new Date().toISOString();
    if (status === 'completed') updates.consultation_end = new Date().toISOString();
    await sb().from('hmis_opd_visits').update(updates).eq('id', visitId);
    load();
  }, [load]);

  return { visits, loading, stats, load, createVisit, updateStatus };
}

// ============================================================
// DOCTORS LIST (for assignment)
// ============================================================
export function useDoctors(centreId: string | null) {
  const [doctors, setDoctors] = useState<any[]>([]);
  useEffect(() => {
    if (!centreId || !sb()) return;
    async function load() {
      const { data } = await sb().from('hmis_staff')
        .select('id, full_name, specialisation, designation')
        .eq('staff_type', 'doctor').eq('is_active', true);
      setDoctors(data || []);
    }
    load();
  }, [centreId]);
  return doctors;
}

// ============================================================
// BILLING
// ============================================================
export interface Bill {
  id: string; billNumber: string; billType: string; billDate: string;
  patientName: string; patientUhid: string; patientId: string;
  payorType: string; grossAmount: number; discountAmount: number;
  netAmount: number; paidAmount: number; balanceAmount: number;
  status: string; encounterId: string | null; items: BillItem[];
}

export interface BillItem {
  id: string; description: string; quantity: number; unitRate: number;
  amount: number; discount: number; netAmount: number;
}

export function useBilling(centreId: string | null) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [tariffs, setTariffs] = useState<any[]>([]);

  // Load today's bills
  const loadBills = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const dt = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_bills')
      .select(`id, bill_number, bill_type, bill_date, payor_type, gross_amount, discount_amount, net_amount, paid_amount, balance_amount, status, encounter_id,
        patient:hmis_patients!inner(id, uhid, first_name, last_name)`)
      .eq('centre_id', centreId).eq('bill_date', dt)
      .order('created_at', { ascending: false });

    setBills((data || []).map((b: any) => ({
      id: b.id, billNumber: b.bill_number, billType: b.bill_type, billDate: b.bill_date,
      patientName: b.patient.first_name + ' ' + (b.patient.last_name || ''),
      patientUhid: b.patient.uhid, patientId: b.patient.id,
      payorType: b.payor_type, grossAmount: b.gross_amount, discountAmount: b.discount_amount,
      netAmount: b.net_amount, paidAmount: b.paid_amount, balanceAmount: b.balance_amount,
      status: b.status, encounterId: b.encounter_id, items: [],
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { loadBills(); }, [loadBills]);

  // Real-time billing updates
  useEffect(() => {
    if (!centreId || !sb()) return;
    const channel = sb().channel('billing-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_bills', filter: `centre_id=eq.${centreId}` }, () => loadBills())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_payments' }, () => loadBills())
      .subscribe();
    return () => { sb().removeChannel(channel); };
  }, [centreId, loadBills]);

  // Load tariff master
  useEffect(() => {
    if (!centreId || !sb()) return;
    async function load() {
      const { data } = await sb().from('hmis_tariff_master').select('*').eq('centre_id', centreId).eq('is_active', true).order('category');
      setTariffs(data || []);
    }
    load();
  }, [centreId]);

  // Create bill from encounter
  const createBillFromEncounter = useCallback(async (
    patientId: string, encounterId: string, staffId: string,
    items: { description: string; quantity: number; unitRate: number; tariffId?: string }[],
    payorType: string = 'self'
  ) => {
    if (!centreId || !sb()) return null;
    const { data: billNum } = await sb().rpc('hmis_next_bill_number', { p_centre_id: centreId, p_type: 'opd' });
    const gross = items.reduce((s, i) => s + i.quantity * i.unitRate, 0);
    const { data: bill, error } = await sb().from('hmis_bills').insert({
      centre_id: centreId, patient_id: patientId, bill_number: billNum || 'BL-' + Date.now(),
      bill_type: 'opd', encounter_type: 'opd', encounter_id: encounterId,
      payor_type: payorType, gross_amount: gross, discount_amount: 0, tax_amount: 0,
      net_amount: gross, paid_amount: 0, balance_amount: gross,
      status: 'draft', bill_date: new Date().toISOString().split('T')[0], created_by: staffId,
    }).select().single();

    if (bill && !error) {
      const billItems = items.map(i => ({
        bill_id: bill.id, description: i.description, quantity: i.quantity,
        unit_rate: i.unitRate, amount: i.quantity * i.unitRate,
        discount: 0, tax: 0, net_amount: i.quantity * i.unitRate,
        service_date: new Date().toISOString().split('T')[0],
        tariff_id: i.tariffId || null,
      }));
      await sb().from('hmis_bill_items').insert(billItems);
      loadBills();
    }
    return { bill, error };
  }, [centreId, loadBills]);

  // Load bill items
  const loadBillItems = useCallback(async (billId: string): Promise<BillItem[]> => {
    if (!sb()) return [];
    const { data } = await sb().from('hmis_bill_items').select('*').eq('bill_id', billId);
    return (data || []).map((i: any) => ({
      id: i.id, description: i.description, quantity: i.quantity,
      unitRate: i.unit_rate, amount: i.amount, discount: i.discount, netAmount: i.net_amount,
    }));
  }, []);

  // Add item to bill
  const addBillItem = useCallback(async (billId: string, item: { description: string; quantity: number; unitRate: number; tariffId?: string }) => {
    if (!sb()) return;
    const net = item.quantity * item.unitRate;
    await sb().from('hmis_bill_items').insert({
      bill_id: billId, description: item.description, quantity: item.quantity,
      unit_rate: item.unitRate, amount: net, discount: 0, tax: 0, net_amount: net,
      service_date: new Date().toISOString().split('T')[0], tariff_id: item.tariffId || null,
    });
    // Update bill totals
    const items = await loadBillItems(billId);
    const gross = items.reduce((s, i) => s + i.netAmount, 0);
    const bill = bills.find(b => b.id === billId);
    const paid = bill?.paidAmount || 0;
    await sb().from('hmis_bills').update({ gross_amount: gross, net_amount: gross, balance_amount: gross - paid }).eq('id', billId);
    loadBills();
  }, [loadBillItems, loadBills, bills]);

  // Collect payment
  const collectPayment = useCallback(async (billId: string, amount: number, mode: string, staffId: string) => {
    if (!centreId || !sb()) return null;
    const { data: rcpNum } = await sb().rpc('hmis_next_receipt_number', { p_centre_id: centreId });
    const { data: payment, error } = await sb().from('hmis_payments').insert({
      bill_id: billId, amount, payment_mode: mode,
      receipt_number: rcpNum || 'RCP-' + Date.now(),
      payment_date: new Date().toISOString().split('T')[0], received_by: staffId,
    }).select().single();

    if (!error) {
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        const newPaid = bill.paidAmount + amount;
        const newBalance = bill.netAmount - newPaid;
        const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'draft';
        await sb().from('hmis_bills').update({ paid_amount: newPaid, balance_amount: Math.max(0, newBalance), status: newStatus }).eq('id', billId);

        // WhatsApp: send payment receipt
        try {
          const { data: pt } = await sb().from('hmis_patients').select('phone_primary, first_name').eq('id', bill.patientId).single();
          if (pt?.phone_primary) {
            sendPaymentReceipt(pt.phone_primary, pt.first_name || 'Patient', `Rs.${amount.toLocaleString('en-IN')}`, rcpNum || 'RCP');
          }
        } catch { /* non-blocking */ }
      }
      loadBills();
    }
    return { payment, error };
  }, [centreId, bills, loadBills]);

  // Finalize bill
  const finalizeBill = useCallback(async (billId: string) => {
    if (!sb()) return;
    await sb().from('hmis_bills').update({ status: 'final' }).eq('id', billId);
    loadBills();
  }, [loadBills]);

  // Apply discount
  const applyDiscount = useCallback(async (billId: string, discount: number) => {
    if (!sb()) return;
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    const net = bill.grossAmount - discount;
    const balance = net - bill.paidAmount;
    await sb().from('hmis_bills').update({ discount_amount: discount, net_amount: net, balance_amount: Math.max(0, balance) }).eq('id', billId);
    loadBills();
  }, [bills, loadBills]);

  // Load payments for a bill
  const loadPayments = useCallback(async (billId: string) => {
    if (!sb()) return [];
    const { data } = await sb().from('hmis_payments').select('*').eq('bill_id', billId).order('created_at', { ascending: false });
    return (data || []).map((p: any) => ({
      id: p.id, amount: p.amount, mode: p.payment_mode,
      receipt: p.receipt_number, date: p.payment_date, createdAt: p.created_at,
    }));
  }, []);

  return { bills, loading, tariffs, loadBills, createBillFromEncounter, loadBillItems, addBillItem, collectPayment, finalizeBill, applyDiscount, loadPayments };
}

// ============================================================
// PHARMACY
// ============================================================
export interface PharmacyOrder {
  id: string; patientName: string; patientUhid: string; patientId: string;
  encounterId: string | null; prescriptions: any[];
  status: string; totalAmount: number; billId: string | null;
  dispensedBy: string | null; dispensedAt: string | null;
  createdAt: string;
}

export function usePharmacy(centreId: string | null) {
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOrders = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let query = sb().from('hmis_pharmacy_dispensing')
      .select(`id, prescription_data, status, total_amount, bill_id, dispensed_by, dispensed_at, created_at, encounter_id,
        patient:hmis_patients!inner(id, uhid, first_name, last_name)`)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter) query = query.eq('status', statusFilter);
    else query = query.in('status', ['pending', 'in_progress', 'partially_dispensed']);

    const { data } = await query;
    setOrders((data || []).map((o: any) => ({
      id: o.id, patientName: o.patient.first_name + ' ' + (o.patient.last_name || ''),
      patientUhid: o.patient.uhid, patientId: o.patient.id,
      encounterId: o.encounter_id, prescriptions: o.prescription_data || [],
      status: o.status, totalAmount: o.total_amount || 0, billId: o.bill_id,
      dispensedBy: o.dispensed_by, dispensedAt: o.dispensed_at, createdAt: o.created_at,
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Real-time
  useEffect(() => {
    if (!centreId || !sb()) return;
    const channel = sb().channel('pharmacy-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_pharmacy_dispensing', filter: `centre_id=eq.${centreId}` }, () => loadOrders())
      .subscribe();
    return () => { sb().removeChannel(channel); };
  }, [centreId, loadOrders]);

  // Create pharmacy order from EMR encounter
  const createFromEncounter = useCallback(async (patientId: string, encounterId: string, prescriptions: any[]) => {
    if (!centreId || !sb()) return null;
    const { data, error } = await sb().from('hmis_pharmacy_dispensing').insert({
      centre_id: centreId, patient_id: patientId, encounter_id: encounterId,
      prescription_data: prescriptions, status: 'pending',
    }).select().single();
    if (!error) loadOrders();
    return { data, error };
  }, [centreId, loadOrders]);

  // Dispense order
  const dispenseOrder = useCallback(async (orderId: string, dispensedItems: any[], staffId: string, totalAmount: number) => {
    if (!sb()) return;
    // Get patient info before update for WhatsApp
    const { data: order } = await sb().from('hmis_pharmacy_dispensing').select('patient_id').eq('id', orderId).single();
    await sb().from('hmis_pharmacy_dispensing').update({
      dispensed_items: dispensedItems, status: 'dispensed',
      total_amount: totalAmount, dispensed_by: staffId,
      dispensed_at: new Date().toISOString(),
    }).eq('id', orderId);
    // WhatsApp: pharmacy ready
    if (order?.patient_id) {
      try {
        const { data: pt } = await sb().from('hmis_patients').select('phone_primary, first_name').eq('id', order.patient_id).single();
        if (pt?.phone_primary) {
          sendPharmacyReady(pt.phone_primary, pt.first_name || 'Patient');
        }
      } catch { /* non-blocking */ }
    }
    loadOrders();
  }, [loadOrders]);

  // Mark in progress
  const startDispensing = useCallback(async (orderId: string) => {
    if (!sb()) return;
    await sb().from('hmis_pharmacy_dispensing').update({ status: 'in_progress' }).eq('id', orderId);
    loadOrders();
  }, [loadOrders]);

  return { orders, loading, loadOrders, createFromEncounter, dispenseOrder, startDispensing };
}
