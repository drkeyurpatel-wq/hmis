// lib/homecare/homecare-hooks.ts
import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// ENROLLMENTS
// ============================================================
export function useEnrollments(centreId: string | null) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, paused: 0, completed: 0 });

  const load = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_hc_enrollments')
      .select('*, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, phone_primary), nurse:hmis_staff!hmis_hc_enrollments_primary_nurse_id_fkey(full_name), doctor:hmis_staff!hmis_hc_enrollments_primary_doctor_id_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setEnrollments(data || []);
    const all = data || [];
    setStats({ total: all.length, active: all.filter((e: any) => e.status === 'active').length, paused: all.filter((e: any) => e.status === 'paused').length, completed: all.filter((e: any) => e.status === 'completed' || e.status === 'discharged').length });
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const enroll = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return null;
    const { data: num } = await sb()!.rpc('hmis_next_hc_number');
    const { data: result, error } = await sb()!.from('hmis_hc_enrollments').insert({
      ...data, enrollment_number: num || `HC-${Date.now()}`, centre_id: centreId,
    }).select().single();
    if (!error) load();
    return result;
  }, [centreId, load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_hc_enrollments').update({ status, ...(status === 'completed' || status === 'discharged' ? { end_date: new Date().toISOString().split('T')[0] } : {}) }).eq('id', id);
    load();
  }, [load]);

  return { enrollments, loading, stats, load, enroll, updateStatus };
}

// ============================================================
// VISITS
// ============================================================
export function useVisits(enrollmentId: string | null, nurseId?: string) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_hc_visits')
      .select('*, nurse:hmis_staff!hmis_hc_visits_assigned_nurse_id_fkey(full_name), enrollment:hmis_hc_enrollments!inner(enrollment_number, patient:hmis_patients!inner(first_name, last_name, uhid))')
      .order('scheduled_date', { ascending: false }).order('scheduled_time').limit(100);
    if (enrollmentId) q = q.eq('enrollment_id', enrollmentId);
    if (nurseId) q = q.eq('assigned_nurse_id', nurseId);
    if (dateFilter) q = q.eq('scheduled_date', dateFilter);
    const { data } = await q;
    setVisits(data || []);
    setLoading(false);
  }, [enrollmentId, nurseId]);

  useEffect(() => { load(); }, [load]);

  const schedule = useCallback(async (visit: any) => {
    if (!sb()) return;
    await sb()!.from('hmis_hc_visits').insert(visit);
    load();
  }, [load]);

  const checkin = useCallback(async (visitId: string) => {
    if (!sb()) return;
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch (e: any) { console.error("[HMIS Homecare]", e?.message || e); }
    await sb()!.from('hmis_hc_visits').update({
      status: 'in_progress', checkin_time: new Date().toISOString(), checkin_lat: lat, checkin_lng: lng,
    }).eq('id', visitId);
    load();
  }, [load]);

  const checkout = useCallback(async (visitId: string, notes: { assessmentNotes?: string; planNotes?: string; generalCondition?: string; needsEscalation?: boolean; escalationReason?: string }) => {
    if (!sb()) return;
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch (e: any) { console.error("[HMIS Homecare]", e?.message || e); }
    await sb()!.from('hmis_hc_visits').update({
      status: 'completed', checkout_time: new Date().toISOString(), checkout_lat: lat, checkout_lng: lng,
      assessment_notes: notes.assessmentNotes, plan_notes: notes.planNotes,
      general_condition: notes.generalCondition, needs_escalation: notes.needsEscalation || false,
      escalation_reason: notes.escalationReason,
    }).eq('id', visitId);
    load();
  }, [load]);

  const saveVitals = useCallback(async (visitId: string, vitals: any) => {
    if (!sb()) return;
    await sb()!.from('hmis_hc_visits').update(vitals).eq('id', visitId);
    load();
  }, [load]);

  return { visits, loading, load, schedule, checkin, checkout, saveVitals };
}

// ============================================================
// MEDICATIONS
// ============================================================
export function useMedications(enrollmentId: string | null) {
  const [meds, setMeds] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!enrollmentId || !sb()) return;
    const { data } = await sb()!.from('hmis_hc_medications').select('*').eq('enrollment_id', enrollmentId).eq('is_active', true).order('drug_name');
    setMeds(data || []);
  }, [enrollmentId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (med: any) => {
    if (!enrollmentId || !sb()) return;
    await sb()!.from('hmis_hc_medications').insert({ ...med, enrollment_id: enrollmentId });
    load();
  }, [enrollmentId, load]);

  const discontinue = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_hc_medications').update({ is_active: false, end_date: new Date().toISOString().split('T')[0] }).eq('id', id);
    load();
  }, [load]);

  const administerDose = useCallback(async (visitId: string, medId: string, given: boolean, doseGiven?: string, notes?: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_hc_med_admin').insert({
      visit_id: visitId, medication_id: medId, administered: given,
      dose_given: doseGiven, skip_reason: given ? null : notes, nurse_notes: notes,
    });
  }, []);

  return { meds, load, add, discontinue, administerDose };
}

// ============================================================
// WOUND CARE
// ============================================================
export function useWoundCare(enrollmentId: string | null) {
  const [records, setRecords] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!enrollmentId || !sb()) return;
    const { data } = await sb()!.from('hmis_hc_wound_care').select('*').eq('enrollment_id', enrollmentId).order('created_at', { ascending: false });
    setRecords(data || []);
  }, [enrollmentId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (visitId: string, wound: any) => {
    if (!enrollmentId || !sb()) return;
    await sb()!.from('hmis_hc_wound_care').insert({ visit_id: visitId, enrollment_id: enrollmentId, ...wound });
    load();
  }, [enrollmentId, load]);

  return { records, load, add };
}

// ============================================================
// EQUIPMENT
// ============================================================
export function useEquipment(enrollmentId: string | null) {
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!enrollmentId || !sb()) return;
    const { data } = await sb()!.from('hmis_hc_equipment').select('*').eq('enrollment_id', enrollmentId).order('issued_date', { ascending: false });
    setItems(data || []);
  }, [enrollmentId]);

  useEffect(() => { load(); }, [load]);

  const issue = useCallback(async (item: any) => {
    if (!enrollmentId || !sb()) return;
    await sb()!.from('hmis_hc_equipment').insert({ ...item, enrollment_id: enrollmentId });
    load();
  }, [enrollmentId, load]);

  const returnItem = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_hc_equipment').update({ status: 'returned', return_date: new Date().toISOString().split('T')[0] }).eq('id', id);
    load();
  }, [load]);

  return { items, load, issue, returnItem };
}

// ============================================================
// RATES
// ============================================================
export function useRates() {
  const [rates, setRates] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!sb()) return;
    const { data } = await sb()!.from('hmis_hc_rates').select('*').eq('is_active', true).order('category').order('service_name');
    setRates(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rates, load };
}

// ============================================================
// BILLING
// ============================================================
export function useHCBilling(enrollmentId: string | null) {
  const [bills, setBills] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!enrollmentId || !sb()) return;
    const { data } = await sb()!.from('hmis_hc_bills').select('*').eq('enrollment_id', enrollmentId).order('bill_date', { ascending: false });
    setBills(data || []);
  }, [enrollmentId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (bill: any, staffId: string) => {
    if (!enrollmentId || !sb()) return;
    await sb()!.from('hmis_hc_bills').insert({ ...bill, enrollment_id: enrollmentId, created_by: staffId });
    load();
  }, [enrollmentId, load]);

  const recordPayment = useCallback(async (billId: string, amount: number, mode: string) => {
    if (!sb()) return;
    const { data: bill } = await sb()!.from('hmis_hc_bills').select('paid, total').eq('id', billId).single();
    if (!bill) return;
    const newPaid = parseFloat(bill.paid) + amount;
    await sb()!.from('hmis_hc_bills').update({
      paid: newPaid, payment_mode: mode, status: newPaid >= parseFloat(bill.total) ? 'paid' : 'partial',
    }).eq('id', billId);
    load();
  }, [load]);

  return { bills, load, create, recordPayment };
}

// ============================================================
// NURSE DAILY SCHEDULE
// ============================================================
export function useNurseSchedule(nurseId: string | null, centreId: string | null) {
  const [todayVisits, setTodayVisits] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!nurseId || !sb()) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await sb()!.from('hmis_hc_visits')
      .select('*, enrollment:hmis_hc_enrollments!inner(enrollment_number, address_line1, landmark, latitude, longitude, patient:hmis_patients!inner(first_name, last_name, uhid, phone_primary))')
      .eq('assigned_nurse_id', nurseId).eq('scheduled_date', today)
      .order('scheduled_time');
    setTodayVisits(data || []);
  }, [nurseId]);

  useEffect(() => { load(); }, [load]);
  return { todayVisits, load };
}
