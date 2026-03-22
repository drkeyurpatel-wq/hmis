// lib/housekeeping/housekeeping-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface HKTask {
  id: string; centre_id: string;
  task_type: 'routine' | 'discharge' | 'deep_clean' | 'infection' | 'spill' | 'terminal';
  area_type: 'room' | 'ward' | 'ot' | 'icu' | 'common_area' | 'toilet';
  area_name: string; room_id: string | null; bed_id: string | null;
  priority: 'emergency' | 'high' | 'routine';
  assigned_to: string | null; requested_by: string | null;
  requested_at: string; started_at: string | null; completed_at: string | null;
  verified_by: string | null; verified_at: string | null;
  checklist: { item: string; done: boolean }[];
  chemicals_used: string[]; status: 'pending' | 'in_progress' | 'completed' | 'verified';
  infection_type: string | null; notes: string | null;
  assignee?: { full_name: string }; requester?: { full_name: string };
  verifier?: { full_name: string };
}

export interface HKSchedule {
  id: string; centre_id: string; area_name: string;
  area_type: string; frequency: string; shift: string;
  assigned_team: string[]; checklist: { item: string; done: boolean }[];
  is_active: boolean;
}

// ============================================================
// TASKS
// ============================================================
export function useHousekeepingTasks(centreId: string | null) {
  const [tasks, setTasks] = useState<HKTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_housekeeping_tasks')
      .select('*, assignee:hmis_staff!hmis_housekeeping_tasks_assigned_to_fkey(full_name), requester:hmis_staff!hmis_housekeeping_tasks_requested_by_fkey(full_name), verifier:hmis_staff!hmis_housekeeping_tasks_verified_by_fkey(full_name)')
      .eq('centre_id', centreId)
      .order('requested_at', { ascending: false }).limit(300);
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setTasks(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for discharge cleaning auto-tasks
  useEffect(() => {
    if (!centreId || !sb()) return;
    const ch = sb().channel('hk-beds')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hmis_beds', filter: `status=eq.housekeeping` }, () => load())
      .subscribe();
    return () => { sb().removeChannel(ch); };
  }, [centreId, load]);

  const stats = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'verified');
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'verified');
    const avgTAT = completed.filter(t => t.started_at && t.completed_at).length > 0
      ? completed.filter(t => t.started_at && t.completed_at)
          .reduce((s, t) => s + (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000, 0) /
        completed.filter(t => t.started_at && t.completed_at).length : 0;
    const now = Date.now();
    const overdue = tasks.filter(t =>
      t.status === 'pending' &&
      (now - new Date(t.requested_at).getTime()) > (t.priority === 'emergency' ? 30 * 60000 : t.priority === 'high' ? 60 * 60000 : 120 * 60000)
    ).length;
    return {
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      verified: tasks.filter(t => t.status === 'verified').length,
      overdue,
      discharge: tasks.filter(t => t.task_type === 'discharge' && t.status !== 'verified').length,
      infection: tasks.filter(t => t.task_type === 'infection' && t.status !== 'verified').length,
      avgTAT: Math.round(avgTAT),
    };
  }, [tasks]);

  const createTask = useCallback(async (data: {
    taskType: string; areaType: string; areaName: string;
    priority: string; assignedTo?: string; staffId: string;
    roomId?: string; bedId?: string; infectionType?: string;
    checklist?: { item: string; done: boolean }[]; notes?: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_housekeeping_tasks').insert({
      centre_id: centreId, task_type: data.taskType,
      area_type: data.areaType, area_name: data.areaName,
      priority: data.priority, assigned_to: data.assignedTo || null,
      requested_by: data.staffId, room_id: data.roomId || null,
      bed_id: data.bedId || null, infection_type: data.infectionType || null,
      checklist: data.checklist || getDefaultChecklist(data.taskType),
      notes: data.notes || null, status: 'pending',
    });
    load();
  }, [centreId, load]);

  const updateTask = useCallback(async (id: string, updates: Partial<HKTask> & { staffId?: string }) => {
    if (!sb()) return;
    const upd: any = { ...updates };
    delete upd.staffId;
    if (updates.status === 'in_progress' && !updates.started_at) upd.started_at = new Date().toISOString();
    if (updates.status === 'completed' && !updates.completed_at) upd.completed_at = new Date().toISOString();
    if (updates.status === 'verified') {
      upd.verified_by = updates.staffId || null;
      upd.verified_at = new Date().toISOString();
      // If discharge cleaning, update bed to available
      const task = tasks.find(t => t.id === id);
      if (task?.bed_id && task.task_type === 'discharge') {
        await sb().from('hmis_beds').update({ status: 'available' }).eq('id', task.bed_id);
      }
    }
    await sb().from('hmis_housekeeping_tasks').update(upd).eq('id', id);
    load();
  }, [tasks, load]);

  return { tasks, loading, stats, load, createTask, updateTask };
}

// ============================================================
// SCHEDULES
// ============================================================
export function useHousekeepingSchedules(centreId: string | null) {
  const [schedules, setSchedules] = useState<HKSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_housekeeping_schedules')
      .select('*').eq('centre_id', centreId).eq('is_active', true)
      .order('area_name');
    setSchedules(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const addSchedule = useCallback(async (data: Partial<HKSchedule>) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_housekeeping_schedules').insert({ ...data, centre_id: centreId });
    load();
  }, [centreId, load]);

  const updateSchedule = useCallback(async (id: string, data: Partial<HKSchedule>) => {
    if (!sb()) return;
    await sb().from('hmis_housekeeping_schedules').update(data).eq('id', id);
    load();
  }, [load]);

  const deleteSchedule = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb().from('hmis_housekeeping_schedules').update({ is_active: false }).eq('id', id);
    load();
  }, [load]);

  return { schedules, loading, load, addSchedule, updateSchedule, deleteSchedule };
}

// ============================================================
// DEFAULT CHECKLISTS BY TYPE
// ============================================================
function getDefaultChecklist(taskType: string): { item: string; done: boolean }[] {
  switch (taskType) {
    case 'discharge':
      return [
        { item: 'Remove all linen and dispose', done: false },
        { item: 'Clean mattress with disinfectant', done: false },
        { item: 'Wipe all surfaces (bed rail, table, locker)', done: false },
        { item: 'Clean and disinfect bathroom', done: false },
        { item: 'Mop floor with disinfectant', done: false },
        { item: 'Replace fresh linen', done: false },
        { item: 'Check IV stand, suction, O2 port', done: false },
        { item: 'Restock amenities (soap, towel, glass)', done: false },
      ];
    case 'infection':
      return [
        { item: 'Wear full PPE (gown, gloves, mask, goggles)', done: false },
        { item: 'Remove all linen in infectious waste bag', done: false },
        { item: 'Spray 1% sodium hypochlorite on all surfaces', done: false },
        { item: 'Allow 10 min contact time', done: false },
        { item: 'Wipe all high-touch surfaces', done: false },
        { item: 'Clean bathroom with 1% hypochlorite', done: false },
        { item: 'Mop floor twice (disinfectant → clean)', done: false },
        { item: 'Terminal UV/fogging if required', done: false },
        { item: 'Replace linen, restock', done: false },
        { item: 'Remove PPE, hand hygiene', done: false },
      ];
    case 'terminal':
      return [
        { item: 'Full PPE on', done: false },
        { item: 'Remove all items from room', done: false },
        { item: 'Clean ceiling to floor', done: false },
        { item: 'Disinfect all surfaces with hospital-grade disinfectant', done: false },
        { item: 'Clean air vents and light fixtures', done: false },
        { item: 'Deep clean bathroom', done: false },
        { item: 'UV disinfection or fogging', done: false },
        { item: 'ATP testing for verification', done: false },
      ];
    case 'spill':
      return [
        { item: 'Cordon off area', done: false },
        { item: 'Apply spill kit absorbent', done: false },
        { item: 'Allow absorption (5 min)', done: false },
        { item: 'Collect with dustpan into infectious waste', done: false },
        { item: 'Disinfect area with 1% sodium hypochlorite', done: false },
        { item: 'Mop and dry', done: false },
      ];
    default: // routine, deep_clean
      return [
        { item: 'Dust all surfaces', done: false },
        { item: 'Mop floors', done: false },
        { item: 'Clean bathroom', done: false },
        { item: 'Empty trash bins', done: false },
        { item: 'Restock consumables', done: false },
      ];
  }
}
