// lib/appointments/appointment-hooks.ts — Rebuilt to match actual schema
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export interface DoctorSchedule {
  id: string; doctorId: string; doctorName: string; specialisation: string;
  departmentId: string; departmentName: string;
  dayOfWeek: number; startTime: string; endTime: string;
  slotDuration: number; maxPatients: number; room: string; fee: number; isActive: boolean;
}

export interface Appointment {
  id: string; patientId: string; patientName: string; uhid: string; phone: string;
  age: number; gender: string;
  doctorId: string; doctorName: string; specialisation: string;
  departmentId: string; departmentName: string;
  date: string; time: string; endTime: string; type: string;
  status: string; priority: string; token: number;
  visitReason: string; source: string; createdAt: string;
  checkedInAt: string | null; consultStart: string | null; consultEnd: string | null;
  waitMinutes: number | null;
}

export interface TimeSlot { time: string; endTime: string; available: boolean; booked: number; }

// ── Doctor Schedules ──
export function useDoctorSchedules(centreId: string | null) {
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSchedules = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_doctor_schedules')
      .select('*, doctor:hmis_staff!inner(full_name, specialisation), department:hmis_departments(name)')
      .eq('centre_id', centreId).eq('is_active', true).order('day_of_week').order('start_time');
    setSchedules((data || []).map((s: any) => ({
      id: s.id, doctorId: s.doctor_id, doctorName: s.doctor?.full_name,
      specialisation: s.doctor?.specialisation || '',
      departmentId: s.department_id, departmentName: s.department?.name || '',
      dayOfWeek: s.day_of_week, startTime: s.start_time, endTime: s.end_time,
      slotDuration: s.slot_duration_min, maxPatients: s.max_patients || 20,
      room: s.room_number || '', fee: parseFloat(s.consultation_fee || 0), isActive: s.is_active,
    })));
    setLoading(false);
  }, [centreId]);

  const loadLeaves = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_doctor_leaves').select('*, doctor:hmis_staff(full_name)')
      .gte('leave_date', new Date().toISOString().split('T')[0]).order('leave_date');
    setLeaves(data || []);
  }, [centreId]);

  useEffect(() => { loadSchedules(); loadLeaves(); }, [loadSchedules, loadLeaves]);

  const addSchedule = useCallback(async (data: {
    doctorId: string; departmentId: string; dayOfWeek: number;
    startTime: string; endTime: string;
    slotDuration?: number; maxPatients?: number; room?: string; fee?: number;
  }) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_doctor_schedules').insert({
      centre_id: centreId, doctor_id: data.doctorId, department_id: data.departmentId,
      day_of_week: data.dayOfWeek, start_time: data.startTime + ':00', end_time: data.endTime + ':00',
      slot_duration_min: data.slotDuration || 15, max_patients: data.maxPatients || 20,
      room_number: data.room || null, consultation_fee: data.fee || 0,
    });
    if (!error) loadSchedules();
    return { success: !error, error: error?.message };
  }, [centreId, loadSchedules]);

  const removeSchedule = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb().from('hmis_doctor_schedules').update({ is_active: false }).eq('id', id);
    loadSchedules();
  }, [loadSchedules]);

  const addLeave = useCallback(async (doctorId: string, date: string, reason: string, approvedBy: string) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_doctor_leaves').insert({
      doctor_id: doctorId, leave_date: date, reason, approved_by: approvedBy,
    });
    if (!error) loadLeaves();
    return { success: !error, error: error?.message };
  }, [loadLeaves]);

  return { schedules, leaves, loading, addSchedule, removeSchedule, addLeave, reload: loadSchedules };
}

// ── Appointments ──
export function useAppointments(centreId: string | null) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { date?: string; doctorId?: string; deptId?: string; status?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const date = filters?.date || new Date().toISOString().split('T')[0];

    let q = sb().from('hmis_appointments')
      .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid, phone_primary, age_years, gender),
        doctor:hmis_staff!hmis_appointments_doctor_id_fkey(full_name, specialisation),
        department:hmis_departments(name)`)
      .eq('centre_id', centreId).eq('appointment_date', date).order('token_number', { nullsFirst: false }).order('appointment_time');

    if (filters?.doctorId) q = q.eq('doctor_id', filters.doctorId);
    if (filters?.deptId) q = q.eq('department_id', filters.deptId);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);

    const { data } = await q;
    const now = new Date();

    setAppointments((data || []).map((a: any) => {
      const checkedIn = a.checked_in_at ? new Date(a.checked_in_at) : null;
      const consultStart = a.consultation_start ? new Date(a.consultation_start) : null;
      let waitMin: number | null = null;
      if (checkedIn && !consultStart) waitMin = Math.round((now.getTime() - checkedIn.getTime()) / 60000);
      else if (checkedIn && consultStart) waitMin = Math.round((consultStart.getTime() - checkedIn.getTime()) / 60000);

      return {
        id: a.id, patientId: a.patient_id,
        patientName: `${a.patient.first_name} ${a.patient.last_name}`.trim(),
        uhid: a.patient.uhid, phone: a.patient.phone_primary || '',
        age: a.patient.age_years || 0, gender: a.patient.gender || '',
        doctorId: a.doctor_id, doctorName: a.doctor?.full_name || '', specialisation: a.doctor?.specialisation || '',
        departmentId: a.department_id, departmentName: a.department?.name || '',
        date: a.appointment_date, time: a.appointment_time || '', endTime: a.slot_end_time || '',
        type: a.type, status: a.status, priority: a.priority || 'normal',
        token: a.token_number || 0, visitReason: a.visit_reason || '', source: a.booking_source || 'counter',
        createdAt: a.created_at,
        checkedInAt: a.checked_in_at, consultStart: a.consultation_start, consultEnd: a.consultation_end,
        waitMinutes: waitMin,
      };
    }));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!centreId || !sb()) return;
    const ch = sb().channel('appts-' + centreId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_appointments', filter: `centre_id=eq.${centreId}` }, () => load())
      .subscribe();
    return () => { sb().removeChannel(ch); };
  }, [centreId, load]);

  const stats = useMemo(() => ({
    total: appointments.length,
    booked: appointments.filter(a => ['scheduled', 'booked', 'confirmed'].includes(a.status)).length,
    checkedIn: appointments.filter(a => a.status === 'checked_in').length,
    inConsult: appointments.filter(a => ['in_progress', 'in_consultation'].includes(a.status)).length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
    avgWait: Math.round(appointments.filter(a => a.waitMinutes !== null).reduce((s, a) => s + (a.waitMinutes || 0), 0) / Math.max(1, appointments.filter(a => a.waitMinutes !== null).length)),
  }), [appointments]);

  // Available slots
  const getAvailableSlots = useCallback(async (doctorId: string, date: string): Promise<TimeSlot[]> => {
    if (!centreId || !sb()) return [];
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();

    // Check leave
    const { data: leave } = await sb().from('hmis_doctor_leaves').select('id')
      .eq('doctor_id', doctorId).eq('leave_date', date).limit(1);
    if (leave?.length) return []; // On leave

    const { data: schedules } = await sb().from('hmis_doctor_schedules')
      .select('*').eq('centre_id', centreId).eq('doctor_id', doctorId)
      .eq('day_of_week', dayOfWeek).eq('is_active', true);
    if (!schedules?.length) return [];

    const { data: existing } = await sb().from('hmis_appointments')
      .select('appointment_time').eq('centre_id', centreId).eq('doctor_id', doctorId)
      .eq('appointment_date', date).not('status', 'in', '(cancelled,rescheduled)');
    const bookedSet = new Set((existing || []).map((a: any) => a.appointment_time));

    const slots: TimeSlot[] = [];
    for (const sched of schedules) {
      const [sh, sm] = sched.start_time.split(':').map(Number);
      const [eh, em] = sched.end_time.split(':').map(Number);
      const dur = sched.slot_duration_min;
      for (let m = sh * 60 + sm; m + dur <= eh * 60 + em; m += dur) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        const timeStr = `${hh}:${mm}:00`;
        const endM = m + dur;
        const endStr = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}:00`;
        const booked = [...bookedSet].filter(t => t === timeStr).length;
        slots.push({ time: timeStr, endTime: endStr, available: booked === 0, booked });
      }
    }
    return slots;
  }, [centreId]);

  // Book
  const bookAppointment = useCallback(async (data: {
    patientId: string; doctorId: string; departmentId: string; date: string; time: string;
    type?: string; visitReason?: string; priority?: string; source?: string; staffId: string;
  }): Promise<{ success: boolean; error?: string; appointment?: any }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };

    // Token
    const { data: tokenResult } = await sb().rpc('generate_appointment_token', {
      p_centre_id: centreId, p_doctor_id: data.doctorId, p_date: data.date,
    });

    const { data: appt, error } = await sb().from('hmis_appointments').insert({
      centre_id: centreId, patient_id: data.patientId, doctor_id: data.doctorId,
      department_id: data.departmentId,
      appointment_date: data.date, appointment_time: data.time,
      type: data.type || 'new', visit_reason: data.visitReason || '',
      priority: data.priority || 'normal', booking_source: data.source || 'counter',
      booked_by: data.staffId, token_number: tokenResult || 1, status: 'scheduled',
    }).select('id, token_number').single();

    if (error) return { success: false, error: error.message };
    load();
    return { success: true, appointment: appt };
  }, [centreId, load]);

  // Status transitions
  const checkIn = useCallback(async (id: string) => {
    const { error } = await sb().from('hmis_appointments').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', id);
    if (!error) load();
    return { error: error?.message };
  }, [load]);

  const startConsultation = useCallback(async (id: string) => {
    const { error } = await sb().from('hmis_appointments').update({ status: 'in_consultation', consultation_start: new Date().toISOString() }).eq('id', id);
    if (!error) load();
  }, [load]);

  const complete = useCallback(async (id: string) => {
    const { error } = await sb().from('hmis_appointments').update({ status: 'completed', consultation_end: new Date().toISOString() }).eq('id', id);
    if (!error) load();
  }, [load]);

  const cancel = useCallback(async (id: string, reason: string, staffId: string) => {
    const { error } = await sb().from('hmis_appointments').update({
      status: 'cancelled', cancel_reason: reason, cancelled_by: staffId, cancelled_at: new Date().toISOString(),
    }).eq('id', id);
    if (!error) load();
  }, [load]);

  const reschedule = useCallback(async (id: string, newDate: string, newTime: string, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { data: old } = await sb().from('hmis_appointments').select('*').eq('id', id).single();
    if (!old) return { success: false, error: 'Not found' };
    await sb().from('hmis_appointments').update({ status: 'rescheduled' }).eq('id', id);
    const result = await bookAppointment({
      patientId: old.patient_id, doctorId: old.doctor_id, departmentId: old.department_id,
      date: newDate, time: newTime, type: old.type, visitReason: old.visit_reason,
      priority: old.priority, source: old.booking_source, staffId,
    });
    if (result.success && result.appointment) {
      await sb().from('hmis_appointments').update({ rescheduled_from: id }).eq('id', result.appointment.id);
    }
    return result;
  }, [centreId, bookAppointment]);

  const markNoShow = useCallback(async (id: string) => {
    await sb().from('hmis_appointments').update({ status: 'no_show' }).eq('id', id);
    load();
  }, [load]);

  return { appointments, loading, stats, load, getAvailableSlots, bookAppointment, checkIn, startConsultation, complete, cancel, reschedule, markNoShow };
}

// ── Patient Documents ──
export function usePatientDocuments(patientId: string | null) {
  const [documents, setDocuments] = useState<any[]>([]);
  useEffect(() => {
    if (!patientId || !sb()) return;
    sb().from('hmis_patient_documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }: any) => setDocuments(data || []));
  }, [patientId]);
  const upload = useCallback(async (file: File, docType: string, staffId: string) => {
    if (!patientId || !sb()) return { success: false };
    const path = `patients/${patientId}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: ue } = await sb().storage.from('documents').upload(path, file);
    if (ue) return { success: false, error: ue.message };
    const { data: urlData } = sb().storage.from('documents').getPublicUrl(path);
    const { error } = await sb().from('hmis_patient_documents').insert({ patient_id: patientId, document_type: docType, document_name: file.name, file_url: urlData.publicUrl, file_size: file.size, mime_type: file.type, uploaded_by: staffId });
    if (!error) { const { data } = await sb().from('hmis_patient_documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }); setDocuments(data || []); }
    return { success: !error, error: error?.message };
  }, [patientId]);
  return { documents, upload };
}

// ── Emergency Contacts ──
export function useEmergencyContacts(patientId: string | null) {
  const [contacts, setContacts] = useState<any[]>([]);
  useEffect(() => {
    if (!patientId || !sb()) return;
    sb().from('hmis_patient_emergency_contacts').select('*').eq('patient_id', patientId).order('is_primary', { ascending: false })
      .then(({ data }: any) => setContacts(data || []));
  }, [patientId]);
  const add = useCallback(async (name: string, relationship: string, phone: string, isPrimary = false) => {
    if (!patientId || !sb()) return;
    await sb().from('hmis_patient_emergency_contacts').insert({ patient_id: patientId, name, relationship, phone, is_primary: isPrimary });
    const { data } = await sb().from('hmis_patient_emergency_contacts').select('*').eq('patient_id', patientId);
    setContacts(data || []);
  }, [patientId]);
  const remove = useCallback(async (id: string) => { if (!sb()) return; await sb().from('hmis_patient_emergency_contacts').delete().eq('id', id); setContacts(p => p.filter(c => c.id !== id)); }, []);
  return { contacts, add, remove };
}

// ── Patient Insurance ──
export function usePatientInsurance(patientId: string | null) {
  const [policies, setPolicies] = useState<any[]>([]);
  useEffect(() => {
    if (!patientId || !sb()) return;
    sb().from('hmis_patient_insurance').select('*').eq('patient_id', patientId).eq('is_active', true).order('valid_to', { ascending: false })
      .then(({ data }: any) => setPolicies(data || []));
  }, [patientId]);
  const add = useCallback(async (data: any) => {
    if (!patientId || !sb()) return;
    await sb().from('hmis_patient_insurance').insert({ patient_id: patientId, ...data });
    const { data: d } = await sb().from('hmis_patient_insurance').select('*').eq('patient_id', patientId).eq('is_active', true);
    setPolicies(d || []);
  }, [patientId]);
  return { policies, add };
}
