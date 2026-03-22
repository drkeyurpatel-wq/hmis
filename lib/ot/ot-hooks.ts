// lib/ot/ot-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// OT SCHEDULE
// ============================================================
export function useOTSchedule(centreId: string | null) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRooms = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb()!.from('hmis_ot_rooms').select('*').eq('centre_id', centreId).eq('is_active', true).order('name');
    setRooms(data || []);
  }, [centreId]);

  const loadBookings = useCallback(async (date?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = date || new Date().toISOString().split('T')[0];
    const { data } = await sb()!.from('hmis_ot_bookings')
      .select(`*, patient:hmis_admissions!inner(ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender)),
        surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name),
        anaesthetist:hmis_staff!hmis_ot_bookings_anaesthetist_id_fkey(full_name),
        ot_room:hmis_ot_rooms(name, type)`)
      .eq('ot_room.centre_id', centreId).eq('scheduled_date', d)
      .order('scheduled_start', { ascending: true });
    setBookings(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { loadRooms(); loadBookings(); }, [loadRooms, loadBookings]);

  const create = useCallback(async (data: any): Promise<{ success: boolean; error?: string; booking?: any }> => {
    if (!sb()) return { success: false, error: 'Database not available' };

    // ---- VALIDATION ----
    if (!data.admission_id) return { success: false, error: 'Patient (admission) is required' };
    if (!data.ot_room_id) return { success: false, error: 'OT room is required' };
    if (!data.surgeon_id) return { success: false, error: 'Surgeon is required' };
    if (!data.procedure_name) return { success: false, error: 'Procedure name is required' };
    if (!data.scheduled_date) return { success: false, error: 'Date is required' };
    if (!data.scheduled_start) return { success: false, error: 'Start time is required' };

    const duration = data.estimated_duration_min || 60;
    const [startH, startM] = data.scheduled_start.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = startMin + duration;

    // ---- ROOM CONFLICT CHECK ----
    // Fetch all non-cancelled bookings in the same room on the same date
    const { data: existingBookings } = await sb()!.from('hmis_ot_bookings')
      .select('id, scheduled_start, estimated_duration_min, procedure_name, status')
      .eq('ot_room_id', data.ot_room_id)
      .eq('scheduled_date', data.scheduled_date)
      .neq('status', 'cancelled');

    if (existingBookings?.length) {
      for (const existing of existingBookings) {
        const [eH, eM] = (existing.scheduled_start || '09:00').split(':').map(Number);
        const eStart = eH * 60 + eM;
        const eEnd = eStart + (existing.estimated_duration_min || 60);
        // Overlap: new starts before existing ends AND new ends after existing starts
        if (startMin < eEnd && endMin > eStart) {
          const conflictTime = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
          return { success: false, error: `Room conflict: "${existing.procedure_name}" is booked at ${conflictTime} (${existing.estimated_duration_min}min). Your surgery (${data.scheduled_start}, ${duration}min) overlaps.` };
        }
      }
    }

    // ---- SURGEON CONFLICT CHECK ----
    const { data: surgeonBookings } = await sb()!.from('hmis_ot_bookings')
      .select('id, scheduled_start, estimated_duration_min, procedure_name, ot_room:hmis_ot_rooms(name)')
      .eq('surgeon_id', data.surgeon_id)
      .eq('scheduled_date', data.scheduled_date)
      .neq('status', 'cancelled');

    if (surgeonBookings?.length) {
      for (const existing of surgeonBookings) {
        const [eH, eM] = (existing.scheduled_start || '09:00').split(':').map(Number);
        const eStart = eH * 60 + eM;
        const eEnd = eStart + (existing.estimated_duration_min || 60);
        if (startMin < eEnd && endMin > eStart) {
          return { success: false, error: `Surgeon conflict: already booked for "${existing.procedure_name}" in ${existing.ot_room?.name} at ${existing.scheduled_start}` };
        }
      }
    }

    // ---- ANAESTHETIST CONFLICT CHECK ----
    if (data.anaesthetist_id) {
      const { data: anaesBookings } = await sb()!.from('hmis_ot_bookings')
        .select('id, scheduled_start, estimated_duration_min, procedure_name, ot_room:hmis_ot_rooms(name)')
        .eq('anaesthetist_id', data.anaesthetist_id)
        .eq('scheduled_date', data.scheduled_date)
        .neq('status', 'cancelled');

      if (anaesBookings?.length) {
        for (const existing of anaesBookings) {
          const [eH, eM] = (existing.scheduled_start || '09:00').split(':').map(Number);
          const eStart = eH * 60 + eM;
          const eEnd = eStart + (existing.estimated_duration_min || 60);
          if (startMin < eEnd && endMin > eStart) {
            return { success: false, error: `Anaesthetist conflict: already assigned to "${existing.procedure_name}" in ${existing.ot_room?.name} at ${existing.scheduled_start}` };
          }
        }
      }
    }

    // ---- CREATE ----
    const { data: result, error } = await sb()!.from('hmis_ot_bookings').insert(data).select().single();
    if (error) return { success: false, error: error.message };

    loadBookings(data.scheduled_date);
    return { success: true, booking: result };
  }, [loadBookings]);

  const updateStatus = useCallback(async (id: string, status: string, extra?: any) => {
    if (!sb()) return;
    const update: any = { status, updated_at: new Date().toISOString(), ...extra };
    if (status === 'in_progress' && !extra?.actual_start) update.actual_start = new Date().toISOString();
    if (status === 'completed' && !extra?.actual_end) update.actual_end = new Date().toISOString();
    await sb()!.from('hmis_ot_bookings').update(update).eq('id', id);
    loadBookings();
  }, [loadBookings]);

  const cancel = useCallback(async (id: string, reason: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_ot_bookings').update({ status: 'cancelled', cancel_reason: reason, updated_at: new Date().toISOString() }).eq('id', id);
    loadBookings();
  }, [loadBookings]);

  // By room
  const byRoom = useMemo(() => {
    const map = new Map<string, any[]>();
    rooms.forEach(r => map.set(r.id, []));
    bookings.forEach(b => { const list = map.get(b.ot_room_id) || []; list.push(b); map.set(b.ot_room_id, list); });
    return map;
  }, [bookings, rooms]);

  // Stats
  const stats = useMemo(() => ({
    total: bookings.length,
    scheduled: bookings.filter(b => b.status === 'scheduled').length,
    inProgress: bookings.filter(b => b.status === 'in_progress').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    emergency: bookings.filter(b => b.is_emergency).length,
    robotic: bookings.filter(b => b.is_robotic).length,
    avgDuration: bookings.filter(b => b.actual_start && b.actual_end).reduce((s, b) => {
      const dur = (new Date(b.actual_end).getTime() - new Date(b.actual_start).getTime()) / 60000;
      return s + dur;
    }, 0) / Math.max(1, bookings.filter(b => b.actual_start && b.actual_end).length),
  }), [bookings]);

  return { bookings, rooms, loading, byRoom, stats, loadBookings, loadRooms, create, updateStatus, cancel };
}

// ============================================================
// OT NOTES (Pre-op / Intra-op / Post-op)
// ============================================================
export function useOTNotes(bookingId: string | null) {
  const [notes, setNotes] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!bookingId || !sb()) return;
    const { data } = await sb()!.from('hmis_ot_notes').select('*, author:hmis_staff(full_name)').eq('ot_booking_id', bookingId).order('created_at');
    setNotes(data || []);
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data: any) => {
    if (!bookingId || !sb()) return;
    // Upsert: check if note of this type exists
    const existing = notes.find(n => n.note_type === data.note_type);
    if (existing) {
      await sb()!.from('hmis_ot_notes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await sb()!.from('hmis_ot_notes').insert({ ...data, ot_booking_id: bookingId });
    }
    load();
  }, [bookingId, notes, load]);

  const preOp = notes.find(n => n.note_type === 'pre_op');
  const intraOp = notes.find(n => n.note_type === 'intra_op');
  const postOp = notes.find(n => n.note_type === 'post_op');

  return { notes, preOp, intraOp, postOp, load, save };
}

// ============================================================
// SURGERY NOTES
// ============================================================
export function useSurgeryNote(bookingId: string | null) {
  const [note, setNote] = useState<any>(null);

  const load = useCallback(async () => {
    if (!bookingId || !sb()) return;
    const { data } = await sb()!.from('hmis_surgery_notes').select('*, surgeon:hmis_staff(full_name)').eq('ot_booking_id', bookingId).single();
    setNote(data);
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data: any) => {
    if (!bookingId || !sb()) return;
    if (note) {
      await sb()!.from('hmis_surgery_notes').update(data).eq('id', note.id);
    } else {
      await sb()!.from('hmis_surgery_notes').insert({ ...data, ot_booking_id: bookingId });
    }
    load();
  }, [bookingId, note, load]);

  return { note, load, save };
}

// ============================================================
// OT UTILIZATION
// ============================================================
export function useOTUtilization(centreId: string | null) {
  const [dailyData, setDailyData] = useState<any[]>([]);

  const loadRange = useCallback(async (from: string, to: string) => {
    if (!centreId || !sb()) return;
    const { data } = await sb()!.from('hmis_ot_bookings')
      .select('id, ot_room_id, scheduled_date, scheduled_start, estimated_duration_min, actual_start, actual_end, status, is_emergency, is_robotic, ot_room:hmis_ot_rooms(name)')
      .eq('ot_room.centre_id', centreId).gte('scheduled_date', from).lte('scheduled_date', to);
    setDailyData(data || []);
  }, [centreId]);

  // Utilization by room
  const roomUtilization = useMemo(() => {
    const map = new Map<string, { name: string; totalMin: number; usedMin: number; count: number; cancelled: number }>();
    dailyData.forEach(b => {
      const roomName = b.ot_room?.name || 'Unknown';
      if (!map.has(b.ot_room_id)) map.set(b.ot_room_id, { name: roomName, totalMin: 0, usedMin: 0, count: 0, cancelled: 0 });
      const entry = map.get(b.ot_room_id)!;
      if (b.status === 'cancelled') { entry.cancelled++; return; }
      entry.count++;
      if (b.actual_start && b.actual_end) {
        entry.usedMin += (new Date(b.actual_end).getTime() - new Date(b.actual_start).getTime()) / 60000;
      } else {
        entry.usedMin += b.estimated_duration_min || 60;
      }
    });
    // Assume 10h OT day per room
    const days = new Set(dailyData.map(b => b.scheduled_date)).size || 1;
    map.forEach(v => { v.totalMin = days * 600; });
    return Array.from(map.values());
  }, [dailyData]);

  // Surgeon utilization
  const surgeonStats = useMemo(() => {
    const map = new Map<string, { count: number; robotic: number; emergency: number; totalMin: number }>();
    dailyData.filter(b => b.status !== 'cancelled').forEach(b => {
      const key = b.surgeon_id || 'unknown';
      if (!map.has(key)) map.set(key, { count: 0, robotic: 0, emergency: 0, totalMin: 0 });
      const s = map.get(key)!;
      s.count++;
      if (b.is_robotic) s.robotic++;
      if (b.is_emergency) s.emergency++;
      if (b.actual_start && b.actual_end) s.totalMin += (new Date(b.actual_end).getTime() - new Date(b.actual_start).getTime()) / 60000;
    });
    return map;
  }, [dailyData]);

  return { dailyData, roomUtilization, surgeonStats, loadRange };
}
