// lib/portal/portal-hooks.ts
// Patient portal data access hooks — queries Supabase filtered by patient_id

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

function getPatientId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('portal_patient_id') || '';
}

// ============================================================
// APPOINTMENTS
// ============================================================
export function usePortalAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const pid = getPatientId(); if (!pid || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_appointments')
      .select('*, doctor:hmis_staff!hmis_appointments_doctor_id_fkey(full_name, specialisation), department:hmis_departments(name)')
      .eq('patient_id', pid).order('appointment_date', { ascending: true }).order('slot_time', { ascending: true }).limit(20);
    setAppointments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const bookAppointment = useCallback(async (doctorId: string, date: string, slotTime: string, reason: string) => {
    const pid = getPatientId(); if (!pid || !sb()) return;
    await sb().from('hmis_appointments').insert({
      patient_id: pid, doctor_id: doctorId, appointment_date: date,
      slot_time: slotTime, visit_reason: reason, status: 'booked', source: 'portal',
    });
    load();
  }, [load]);

  const cancelAppointment = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb().from('hmis_appointments').update({ status: 'cancelled' }).eq('id', id);
    load();
  }, [load]);

  return { appointments, loading, load, bookAppointment, cancelAppointment };
}

// ============================================================
// LAB REPORTS
// ============================================================
export function usePortalLabReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const pid = getPatientId(); if (!pid || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_lab_orders')
      .select('*, results:hmis_lab_results(parameter_name, result_value, unit, reference_range, is_abnormal, is_critical)')
      .eq('patient_id', pid).eq('status', 'completed')
      .order('created_at', { ascending: false }).limit(30);
    setReports(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { reports, loading };
}

// ============================================================
// BILLS
// ============================================================
export function usePortalBills() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const pid = getPatientId(); if (!pid || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_bills')
      .select('id, bill_number, bill_date, bill_type, net_amount, paid_amount, balance_amount, status, payor_type')
      .eq('patient_id', pid).neq('status', 'cancelled')
      .order('bill_date', { ascending: false }).limit(20);
    setBills(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { bills, loading };
}

// ============================================================
// PRESCRIPTIONS
// ============================================================
export function usePortalPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const pid = getPatientId(); if (!pid || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_emr_encounters')
      .select('id, encounter_date, prescriptions, doctor:hmis_staff!hmis_emr_encounters_doctor_id_fkey(full_name)')
      .eq('patient_id', pid).not('prescriptions', 'is', null)
      .order('encounter_date', { ascending: false }).limit(15);
    setPrescriptions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const requestRefill = useCallback(async (encounterId: string, rxData: any) => {
    const pid = getPatientId(); if (!pid || !sb()) return;
    await sb().from('hmis_prescription_refill_requests').insert({
      patient_id: pid, encounter_id: encounterId, prescription_data: rxData, status: 'pending',
    });
  }, []);

  return { prescriptions, loading, requestRefill };
}

// ============================================================
// FEEDBACK
// ============================================================
export function usePortalFeedback() {
  const submitFeedback = useCallback(async (visitId: string, rating: number, comment: string, department?: string, doctorName?: string) => {
    const pid = getPatientId(); if (!pid || !sb()) return;
    await sb().from('hmis_patient_feedback').insert({
      patient_id: pid, visit_id: visitId || null, rating, comment,
      department: department || null, doctor_name: doctorName || null,
    });
  }, []);

  return { submitFeedback };
}

// ============================================================
// DOCTOR SLOTS (for booking)
// ============================================================
export function usePortalDoctorSlots(departmentId?: string) {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    if (!sb()) return;
    sb().from('hmis_departments').select('id, name').eq('is_active', true).order('name')
      .then(({ data }: any) => setDepartments(data || []));
  }, []);

  useEffect(() => {
    if (!sb() || !departmentId) return;
    sb().from('hmis_staff').select('id, full_name, specialisation, designation')
      .eq('department_id', departmentId).eq('staff_type', 'doctor').eq('is_active', true).order('full_name')
      .then(({ data }: any) => setDoctors(data || []));
  }, [departmentId]);

  const getSlots = useCallback(async (doctorId: string, date: string) => {
    if (!sb()) return [];
    const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const { data: schedules } = await sb().from('hmis_doctor_schedules')
      .select('slot_start, slot_end').eq('doctor_id', doctorId).eq('day_of_week', dayOfWeek).eq('is_active', true);
    if (!schedules || schedules.length === 0) return [];

    // Get existing appointments for that date
    const { data: booked } = await sb().from('hmis_appointments')
      .select('slot_time').eq('doctor_id', doctorId).eq('appointment_date', date)
      .in('status', ['booked', 'confirmed', 'checked_in']);
    const bookedSlots = new Set((booked || []).map((b: any) => b.slot_time));

    // Generate 15-min slots
    const slots: string[] = [];
    for (const sch of schedules) {
      let [h, m] = sch.slot_start.split(':').map(Number);
      const [eh, em] = sch.slot_end.split(':').map(Number);
      while (h < eh || (h === eh && m < em)) {
        const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        if (!bookedSlots.has(t)) slots.push(t);
        m += 15; if (m >= 60) { h++; m -= 60; }
      }
    }
    return slots;
  }, []);

  return { departments, doctors, getSlots };
}
