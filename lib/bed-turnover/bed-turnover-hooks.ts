// lib/bed-turnover/bed-turnover-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface BedTurnover {
  id: string; centre_id: string; bed_id: string;
  room_id: string | null; ward_id: string | null;
  discharged_admission_id: string | null;
  discharge_confirmed_at: string; discharge_confirmed_by: string | null;
  hk_task_id: string | null; hk_assigned_to: string | null;
  hk_started_at: string | null; hk_completed_at: string | null;
  hk_checklist: { item: string; done: boolean }[];
  inspected_by: string | null; inspected_at: string | null;
  inspection_passed: boolean | null; inspection_remarks: string | null;
  bed_available_at: string | null;
  next_admission_id: string | null; next_patient_notified_at: string | null;
  sla_target_minutes: number; total_turnaround_minutes: number | null;
  sla_status: string; status: string; notes: string | null;
  created_at: string; updated_at: string;
  // Joined
  bed?: { bed_number: string; room: { name: string; ward: { name: string } | null } | null } | null;
  hk_assignee?: { full_name: string } | null;
  inspector?: { full_name: string } | null;
  discharged_patient?: { first_name: string; last_name: string; uhid: string } | null;
}

export interface BedWaitlistEntry {
  id: string; centre_id: string; patient_id: string; admission_id: string | null;
  ward_id: string | null; bed_type: string; priority: string;
  requested_at: string; requested_by: string | null;
  assigned_bed_id: string | null; assigned_at: string | null;
  notified_at: string | null; status: string; notes: string | null;
  // Joined
  patient?: { first_name: string; last_name: string; uhid: string } | null;
  ward?: { name: string } | null;
}

const SELECT_TURNOVER = `*, 
  bed:hmis_beds!hmis_bed_turnover_bed_id_fkey(bed_number, room:hmis_rooms(name, ward:hmis_wards(name))),
  hk_assignee:hmis_staff!hmis_bed_turnover_hk_assigned_to_fkey(full_name),
  inspector:hmis_staff!hmis_bed_turnover_inspected_by_fkey(full_name)`;

export function useBedTurnover(centreId: string | null) {
  const [turnovers, setTurnovers] = useState<BedTurnover[]>([]);
  const [waitlist, setWaitlist] = useState<BedWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const [tRes, wRes] = await Promise.all([
      sb().from('hmis_bed_turnover')
        .select(SELECT_TURNOVER)
        .eq('centre_id', centreId)
        .not('status', 'eq', 'completed')
        .order('discharge_confirmed_at', { ascending: false })
        .limit(200),
      sb().from('hmis_bed_waitlist')
        .select('*, patient:hmis_patients!hmis_bed_waitlist_patient_id_fkey(first_name, last_name, uhid), ward:hmis_wards!hmis_bed_waitlist_ward_id_fkey(name)')
        .eq('centre_id', centreId)
        .eq('status', 'waiting')
        .order('priority', { ascending: true })
        .order('requested_at', { ascending: true }),
    ]);
    setTurnovers((tRes.data || []) as BedTurnover[]);
    setWaitlist((wRes.data || []) as BedWaitlistEntry[]);
    setLoading(false);
  }, [centreId]);

  // Initiate turnover when discharge confirmed
  const initiateTurnover = useCallback(async (input: {
    bed_id: string; room_id?: string; ward_id?: string;
    discharged_admission_id?: string; discharge_confirmed_by: string;
  }) => {
    if (!centreId || !sb()) return null;
    // Create turnover record
    const { data: turnover, error } = await sb().from('hmis_bed_turnover').insert({
      centre_id: centreId,
      bed_id: input.bed_id,
      room_id: input.room_id || null,
      ward_id: input.ward_id || null,
      discharged_admission_id: input.discharged_admission_id || null,
      discharge_confirmed_by: input.discharge_confirmed_by,
      discharge_confirmed_at: new Date().toISOString(),
    }).select().single();
    if (error || !turnover) return null;

    // Auto-create housekeeping task
    const bedInfo = await sb().from('hmis_beds')
      .select('bed_number, room:hmis_rooms(name, ward:hmis_wards(name))')
      .eq('id', input.bed_id).single();
    const b = bedInfo.data as any;
    const areaName = `${b?.room?.ward?.name || 'Ward'} - ${b?.room?.name || 'Room'} - Bed ${b?.bed_number || '?'}`;

    const { data: hkTask } = await sb().from('hmis_housekeeping_tasks').insert({
      centre_id: centreId,
      task_type: 'discharge',
      area_type: 'room',
      area_name: areaName,
      bed_id: input.bed_id,
      room_id: input.room_id || null,
      priority: 'high',
      requested_by: input.discharge_confirmed_by,
      checklist: turnover.hk_checklist || [],
    }).select().single();

    if (hkTask) {
      await sb().from('hmis_bed_turnover').update({ hk_task_id: hkTask.id, updated_at: new Date().toISOString() }).eq('id', turnover.id);
    }

    // Update bed status to cleaning
    await sb().from('hmis_beds').update({ status: 'cleaning', current_admission_id: null }).eq('id', input.bed_id);

    return turnover;
  }, [centreId]);

  // Assign housekeeping staff
  const assignHK = useCallback(async (turnoverId: string, staffId: string) => {
    if (!sb()) return;
    const now = new Date().toISOString();
    const { data: t } = await sb().from('hmis_bed_turnover').select('hk_task_id').eq('id', turnoverId).single();
    await sb().from('hmis_bed_turnover').update({
      hk_assigned_to: staffId, status: 'housekeeping_in_progress', hk_started_at: now, updated_at: now,
    }).eq('id', turnoverId);
    if (t?.hk_task_id) {
      await sb().from('hmis_housekeeping_tasks').update({ assigned_to: staffId, started_at: now, status: 'in_progress' }).eq('id', t.hk_task_id);
    }
  }, []);

  // Update checklist item
  const updateChecklist = useCallback(async (turnoverId: string, index: number, done: boolean) => {
    if (!sb()) return;
    const { data } = await sb().from('hmis_bed_turnover').select('hk_checklist').eq('id', turnoverId).single();
    if (!data) return;
    const checklist = [...(data.hk_checklist || [])];
    if (checklist[index]) checklist[index] = { ...checklist[index], done };
    await sb().from('hmis_bed_turnover').update({ hk_checklist: checklist, updated_at: new Date().toISOString() }).eq('id', turnoverId);
  }, []);

  // Complete housekeeping
  const completeHK = useCallback(async (turnoverId: string) => {
    if (!sb()) return;
    const now = new Date().toISOString();
    const { data: t } = await sb().from('hmis_bed_turnover').select('hk_task_id').eq('id', turnoverId).single();
    await sb().from('hmis_bed_turnover').update({
      hk_completed_at: now, status: 'inspection_pending', updated_at: now,
    }).eq('id', turnoverId);
    if (t?.hk_task_id) {
      await sb().from('hmis_housekeeping_tasks').update({ completed_at: now, status: 'completed' }).eq('id', t.hk_task_id);
    }
  }, []);

  // Inspect bed
  const inspectBed = useCallback(async (turnoverId: string, staffId: string, passed: boolean, remarks?: string) => {
    if (!sb()) return;
    const now = new Date().toISOString();
    if (passed) {
      // Get turnover for SLA calculation
      const { data: t } = await sb().from('hmis_bed_turnover').select('discharge_confirmed_at, bed_id, sla_target_minutes').eq('id', turnoverId).single();
      const elapsed = t ? Math.round((Date.now() - new Date(t.discharge_confirmed_at).getTime()) / 60000) : 0;
      const slaStatus = elapsed <= (t?.sla_target_minutes || 45) ? 'on_track' : elapsed <= 90 ? 'warning' : 'breached';

      await sb().from('hmis_bed_turnover').update({
        inspected_by: staffId, inspected_at: now, inspection_passed: true,
        inspection_remarks: remarks || null,
        bed_available_at: now, status: 'ready',
        total_turnaround_minutes: elapsed, sla_status: slaStatus,
        updated_at: now,
      }).eq('id', turnoverId);

      // Update bed status to available
      if (t?.bed_id) {
        await sb().from('hmis_beds').update({ status: 'available' }).eq('id', t.bed_id);
      }

      // Auto-check waitlist
      if (t?.bed_id) {
        await autoAssignWaitlist(turnoverId, t.bed_id);
      }
    } else {
      // Failed inspection — back to housekeeping
      await sb().from('hmis_bed_turnover').update({
        inspected_by: staffId, inspected_at: now, inspection_passed: false,
        inspection_remarks: remarks || 'Inspection failed — needs re-cleaning',
        status: 'housekeeping_pending', hk_completed_at: null,
        updated_at: now,
      }).eq('id', turnoverId);
    }
  }, []);

  // Auto-assign from waitlist
  const autoAssignWaitlist = useCallback(async (turnoverId: string, bedId: string) => {
    if (!centreId || !sb()) return;
    // Get bed ward
    const { data: bed } = await sb().from('hmis_beds').select('room:hmis_rooms(ward_id)').eq('id', bedId).single();
    const wardId = (bed?.room as any)?.ward_id;
    if (!wardId) return;

    // Find first waiting patient for this ward
    const { data: waiting } = await sb().from('hmis_bed_waitlist')
      .select('*')
      .eq('centre_id', centreId)
      .eq('ward_id', wardId)
      .eq('status', 'waiting')
      .order('priority', { ascending: true })
      .order('requested_at', { ascending: true })
      .limit(1);

    if (waiting && waiting.length > 0) {
      const entry = waiting[0];
      const now = new Date().toISOString();
      await sb().from('hmis_bed_waitlist').update({
        assigned_bed_id: bedId, assigned_at: now, notified_at: now, status: 'notified',
      }).eq('id', entry.id);
      await sb().from('hmis_bed_turnover').update({
        next_admission_id: entry.admission_id, next_patient_notified_at: now,
        status: 'assigned', updated_at: now,
      }).eq('id', turnoverId);
    }
  }, [centreId]);

  // Mark complete (next patient admitted)
  const markComplete = useCallback(async (turnoverId: string) => {
    if (!sb()) return;
    await sb().from('hmis_bed_turnover').update({
      status: 'completed', updated_at: new Date().toISOString(),
    }).eq('id', turnoverId);
  }, []);

  // Add to waitlist
  const addToWaitlist = useCallback(async (input: {
    patient_id: string; admission_id?: string; ward_id?: string;
    bed_type?: string; priority?: string; requested_by: string; notes?: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_bed_waitlist').insert({
      centre_id: centreId, ...input,
    });
  }, [centreId]);

  // Cancel waitlist entry
  const cancelWaitlist = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb().from('hmis_bed_waitlist').update({ status: 'cancelled' }).eq('id', id);
  }, []);

  // Stats
  const stats = useMemo(() => {
    const inTurnaround = turnovers.filter(t => !['ready', 'assigned', 'completed'].includes(t.status));
    const ready = turnovers.filter(t => t.status === 'ready');
    const breached = turnovers.filter(t => t.sla_status === 'breached');
    const warning = turnovers.filter(t => t.sla_status === 'warning');
    const avgMinutes = turnovers.filter(t => t.total_turnaround_minutes).reduce((s, t) => s + (t.total_turnaround_minutes || 0), 0) / (turnovers.filter(t => t.total_turnaround_minutes).length || 1);
    return {
      inTurnaround: inTurnaround.length,
      ready: ready.length,
      breached: breached.length,
      warning: warning.length,
      waitlistCount: waitlist.length,
      avgMinutes: Math.round(avgMinutes),
    };
  }, [turnovers, waitlist]);

  // Compute live elapsed minutes
  const getElapsed = useCallback((t: BedTurnover) => {
    return Math.round((Date.now() - new Date(t.discharge_confirmed_at).getTime()) / 60000);
  }, []);

  const getLiveSLA = useCallback((t: BedTurnover) => {
    const elapsed = getElapsed(t);
    if (elapsed <= t.sla_target_minutes) return 'on_track';
    if (elapsed <= 90) return 'warning';
    return 'breached';
  }, [getElapsed]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  return {
    turnovers, waitlist, loading, stats,
    load, initiateTurnover, assignHK, updateChecklist, completeHK,
    inspectBed, markComplete, addToWaitlist, cancelWaitlist,
    getElapsed, getLiveSLA,
  };
}
