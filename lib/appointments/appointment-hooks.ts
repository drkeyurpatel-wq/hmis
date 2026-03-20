// lib/appointments/appointment-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export interface DoctorSchedule {
  id: string; doctorId: string; doctorName: string; specialisation: string;
  dayOfWeek: number; startTime: string; endTime: string;
  slotDuration: number; maxPatients: number; room: string; fee: number; isActive: boolean;
}

export interface Appointment {
  id: string; patientId: string; patientName: string; uhid: string; phone: string;
  doctorId: string; doctorName: string; specialisation: string;
  date: string; time: string; endTime: string; type: string;
  status: string; priority: string; token: number;
  visitReason: string; source: string; createdAt: string;
}

export interface TimeSlot {
  time: string; endTime: string; available: boolean; booked: number; max: number;
}

// ============================================================
// DOCTOR SCHEDULES
// ============================================================
export function useDoctorSchedules(centreId: string | null) {
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!centreId || !sb()) return;
    setLoading(true);
    sb().from('hmis_doctor_schedules')
      .select('*, doctor:hmis_staff!inner(full_name, specialisation)')
      .eq('centre_id', centreId).eq('is_active', true).order('day_of_week, start_time')
      .then(({ data }: any) => {
        setSchedules((data || []).map((s: any) => ({
          id: s.id, doctorId: s.doctor_id, doctorName: s.doctor?.full_name,
          specialisation: s.doctor?.specialisation || '', dayOfWeek: s.day_of_week,
          startTime: s.start_time, endTime: s.end_time, slotDuration: s.slot_duration_min,
          maxPatients: s.max_patients, room: s.room_number || '', fee: parseFloat(s.consultation_fee || 0),
          isActive: s.is_active,
        })));
        setLoading(false);
      });
  }, [centreId]);

  const addSchedule = useCallback(async (data: {
    doctorId: string; dayOfWeek: number; startTime: string; endTime: string;
    slotDuration?: number; maxPatients?: number; room?: string; fee?: number;
  }) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_doctor_schedules').insert({
      centre_id: centreId, doctor_id: data.doctorId, day_of_week: data.dayOfWeek,
      start_time: data.startTime, end_time: data.endTime,
      slot_duration_min: data.slotDuration || 15, max_patients: data.maxPatients || 20,
      room_number: data.room || null, consultation_fee: data.fee || 0,
    });
    return { success: !error, error: error?.message };
  }, [centreId]);

  return { schedules, loading, addSchedule };
}

// ============================================================
// APPOINTMENTS — booking, status, check-in
// ============================================================
export function useAppointments(centreId: string | null) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { date?: string; doctorId?: string; status?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const date = filters?.date || new Date().toISOString().split('T')[0];

    let q = sb().from('hmis_appointments')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid, phone_primary), doctor:hmis_staff!inner(full_name, specialisation)')
      .eq('centre_id', centreId).eq('appointment_date', date)
      .order('appointment_time');

    if (filters?.doctorId) q = q.eq('doctor_id', filters.doctorId);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);

    const { data } = await q;
    setAppointments((data || []).map((a: any) => ({
      id: a.id, patientId: a.patient_id,
      patientName: `${a.patient.first_name} ${a.patient.last_name}`,
      uhid: a.patient.uhid, phone: a.patient.phone_primary,
      doctorId: a.doctor_id, doctorName: a.doctor?.full_name, specialisation: a.doctor?.specialisation || '',
      date: a.appointment_date, time: a.appointment_time, endTime: a.slot_end_time || '',
      type: a.appointment_type, status: a.status, priority: a.priority,
      token: a.token_number, visitReason: a.visit_reason || '', source: a.booking_source,
      createdAt: a.created_at,
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: appointments.length,
    booked: appointments.filter(a => a.status === 'booked' || a.status === 'confirmed').length,
    checkedIn: appointments.filter(a => a.status === 'checked_in').length,
    inConsult: appointments.filter(a => a.status === 'in_consultation').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
  }), [appointments]);

  // Get available slots for a doctor on a date
  const getAvailableSlots = useCallback(async (doctorId: string, date: string): Promise<TimeSlot[]> => {
    if (!centreId || !sb()) return [];
    const dayOfWeek = new Date(date).getDay();

    // Get schedule
    const { data: schedules } = await sb().from('hmis_doctor_schedules')
      .select('*').eq('centre_id', centreId).eq('doctor_id', doctorId)
      .eq('day_of_week', dayOfWeek).eq('is_active', true);

    if (!schedules?.length) return [];

    // Get existing appointments
    const { data: existing } = await sb().from('hmis_appointments')
      .select('appointment_time').eq('centre_id', centreId).eq('doctor_id', doctorId)
      .eq('appointment_date', date).not('status', 'in', '(cancelled,rescheduled)');

    const bookedTimes = new Set((existing || []).map((a: any) => a.appointment_time));

    const slots: TimeSlot[] = [];
    for (const sched of schedules) {
      const [sh, sm] = sched.start_time.split(':').map(Number);
      const [eh, em] = sched.end_time.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const dur = sched.slot_duration_min;

      for (let m = startMin; m + dur <= endMin; m += dur) {
        const h = Math.floor(m / 60); const min = m % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
        const eh2 = Math.floor((m + dur) / 60); const em2 = (m + dur) % 60;
        const endStr = `${String(eh2).padStart(2, '0')}:${String(em2).padStart(2, '0')}:00`;
        const bookedCount = [...bookedTimes].filter(t => t === timeStr).length;

        slots.push({
          time: timeStr, endTime: endStr,
          available: bookedCount < (sched.max_patients / Math.ceil((endMin - startMin) / dur)),
          booked: bookedCount, max: Math.ceil(sched.max_patients / Math.ceil((endMin - startMin) / dur)),
        });
      }
    }
    return slots;
  }, [centreId]);

  // Book appointment
  const bookAppointment = useCallback(async (data: {
    patientId: string; doctorId: string; date: string; time: string;
    type?: string; visitReason?: string; priority?: string; source?: string; staffId: string;
  }): Promise<{ success: boolean; error?: string; appointment?: any }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };

    // Generate token
    const { data: tokenResult } = await sb().rpc('generate_appointment_token', {
      p_centre_id: centreId, p_doctor_id: data.doctorId, p_date: data.date,
    });

    const { data: appt, error } = await sb().from('hmis_appointments').insert({
      centre_id: centreId, patient_id: data.patientId, doctor_id: data.doctorId,
      appointment_date: data.date, appointment_time: data.time,
      appointment_type: data.type || 'new', visit_reason: data.visitReason || '',
      priority: data.priority || 'routine', booking_source: data.source || 'counter',
      booked_by: data.staffId, token_number: tokenResult || 1, status: 'booked',
    }).select('id, token_number').single();

    if (error) return { success: false, error: error.message };
    load();
    return { success: true, appointment: appt };
  }, [centreId, load]);

  // Check in
  const checkIn = useCallback(async (appointmentId: string) => {
    await sb().from('hmis_appointments').update({
      status: 'checked_in', checked_in_at: new Date().toISOString(),
    }).eq('id', appointmentId);
    load();
  }, [load]);

  // Start consultation
  const startConsultation = useCallback(async (appointmentId: string) => {
    await sb().from('hmis_appointments').update({
      status: 'in_consultation', consultation_start: new Date().toISOString(),
    }).eq('id', appointmentId);
    load();
  }, [load]);

  // Complete
  const complete = useCallback(async (appointmentId: string) => {
    await sb().from('hmis_appointments').update({
      status: 'completed', consultation_end: new Date().toISOString(),
    }).eq('id', appointmentId);
    load();
  }, [load]);

  // Cancel
  const cancel = useCallback(async (appointmentId: string, reason: string, staffId: string) => {
    await sb().from('hmis_appointments').update({
      status: 'cancelled', cancel_reason: reason, cancelled_by: staffId, cancelled_at: new Date().toISOString(),
    }).eq('id', appointmentId);
    load();
  }, [load]);

  // Reschedule
  const reschedule = useCallback(async (appointmentId: string, newDate: string, newTime: string, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { data: old } = await sb().from('hmis_appointments').select('*').eq('id', appointmentId).single();
    if (!old) return { success: false, error: 'Not found' };

    // Mark old as rescheduled
    await sb().from('hmis_appointments').update({ status: 'rescheduled' }).eq('id', appointmentId);

    // Create new
    const result = await bookAppointment({
      patientId: old.patient_id, doctorId: old.doctor_id,
      date: newDate, time: newTime, type: old.appointment_type,
      visitReason: old.visit_reason, priority: old.priority,
      source: old.booking_source, staffId,
    });

    if (result.success && result.appointment) {
      await sb().from('hmis_appointments').update({ rescheduled_from: appointmentId }).eq('id', result.appointment.id);
    }
    return result;
  }, [centreId, bookAppointment]);

  // Mark no-show
  const markNoShow = useCallback(async (appointmentId: string) => {
    await sb().from('hmis_appointments').update({ status: 'no_show' }).eq('id', appointmentId);
    load();
  }, [load]);

  return {
    appointments, loading, stats, load,
    getAvailableSlots, bookAppointment, checkIn, startConsultation,
    complete, cancel, reschedule, markNoShow,
  };
}

// ============================================================
// PATIENT DOCUMENTS
// ============================================================
export function usePatientDocuments(patientId: string | null) {
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (!patientId || !sb()) return;
    sb().from('hmis_patient_documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }: any) => setDocuments(data || []));
  }, [patientId]);

  const upload = useCallback(async (file: File, docType: string, staffId: string): Promise<{ success: boolean; error?: string }> => {
    if (!patientId || !sb()) return { success: false };
    // Upload to Supabase Storage
    const ext = file.name.split('.').pop();
    const path = `patients/${patientId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await sb().storage.from('documents').upload(path, file);
    if (uploadErr) return { success: false, error: uploadErr.message };

    const { data: urlData } = sb().storage.from('documents').getPublicUrl(path);

    const { error } = await sb().from('hmis_patient_documents').insert({
      patient_id: patientId, document_type: docType, document_name: file.name,
      file_url: urlData.publicUrl, file_size: file.size, mime_type: file.type,
      uploaded_by: staffId,
    });
    if (error) return { success: false, error: error.message };
    // Reload
    const { data } = await sb().from('hmis_patient_documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    setDocuments(data || []);
    return { success: true };
  }, [patientId]);

  return { documents, upload };
}

// ============================================================
// PATIENT EMERGENCY CONTACTS
// ============================================================
export function useEmergencyContacts(patientId: string | null) {
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    if (!patientId || !sb()) return;
    sb().from('hmis_patient_emergency_contacts').select('*').eq('patient_id', patientId).order('is_primary', { ascending: false })
      .then(({ data }: any) => setContacts(data || []));
  }, [patientId]);

  const add = useCallback(async (name: string, relationship: string, phone: string, isPrimary: boolean = false) => {
    if (!patientId || !sb()) return;
    await sb().from('hmis_patient_emergency_contacts').insert({ patient_id: patientId, name, relationship, phone, is_primary: isPrimary });
    const { data } = await sb().from('hmis_patient_emergency_contacts').select('*').eq('patient_id', patientId);
    setContacts(data || []);
  }, [patientId]);

  const remove = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb().from('hmis_patient_emergency_contacts').delete().eq('id', id);
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);

  return { contacts, add, remove };
}

// ============================================================
// PATIENT INSURANCE
// ============================================================
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
