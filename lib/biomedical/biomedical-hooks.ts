// lib/biomedical/biomedical-hooks.ts
// Equipment registry, maintenance tracking, PM scheduling hooks
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// EQUIPMENT REGISTRY
// ============================================================
export interface Equipment {
  id: string; centre_id: string; name: string; category: string;
  brand: string; model: string; serial_number: string;
  location: string; department: string;
  purchase_date: string; purchase_cost: number;
  warranty_expiry: string; amc_vendor: string; amc_expiry: string; amc_cost: number;
  status: 'active' | 'maintenance' | 'condemned' | 'out_of_order';
  last_pm_date: string; next_pm_date: string;
  criticality: 'high' | 'medium' | 'low';
  notes: string; is_active: boolean; created_at: string;
}

export function useEquipment(centreId: string | null) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_equipment')
      .select('*').eq('centre_id', centreId).eq('is_active', true)
      .order('name');
    setEquipment(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: equipment.length,
      active: equipment.filter(e => e.status === 'active').length,
      maintenance: equipment.filter(e => e.status === 'maintenance').length,
      condemned: equipment.filter(e => e.status === 'condemned').length,
      outOfOrder: equipment.filter(e => e.status === 'out_of_order').length,
      amcExpiring: equipment.filter(e => e.amc_expiry && e.amc_expiry <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]).length,
      overduePM: equipment.filter(e => e.next_pm_date && e.next_pm_date < today).length,
      highCriticality: equipment.filter(e => e.criticality === 'high').length,
    };
  }, [equipment]);

  const addEquipment = useCallback(async (data: Partial<Equipment>) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_equipment').insert({ ...data, centre_id: centreId });
    load();
  }, [centreId, load]);

  const updateEquipment = useCallback(async (id: string, data: Partial<Equipment>) => {
    if (!sb()) return;
    await sb().from('hmis_equipment').update(data).eq('id', id);
    load();
  }, [load]);

  const deleteEquipment = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb().from('hmis_equipment').update({ is_active: false }).eq('id', id);
    load();
  }, [load]);

  return { equipment, loading, stats, load, addEquipment, updateEquipment, deleteEquipment };
}

// ============================================================
// MAINTENANCE LOG
// ============================================================
export interface MaintenanceTicket {
  id: string; equipment_id: string; centre_id: string;
  type: 'preventive' | 'breakdown' | 'calibration';
  reported_by: string; reported_at: string;
  issue_description: string; priority: 'critical' | 'high' | 'medium' | 'low';
  assigned_to: string; started_at: string; completed_at: string;
  resolution: string; parts_used: any[]; cost: number;
  downtime_hours: number; status: 'open' | 'in_progress' | 'completed' | 'pending_parts';
  equipment?: Equipment;
  reporter?: { full_name: string };
}

export function useMaintenance(centreId: string | null) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_equipment_maintenance')
      .select('*, equipment:hmis_equipment(id, name, category, serial_number, location), reporter:hmis_staff!hmis_equipment_maintenance_reported_by_fkey(full_name)')
      .eq('centre_id', centreId)
      .order('reported_at', { ascending: false }).limit(200);
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setTickets(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    pendingParts: tickets.filter(t => t.status === 'pending_parts').length,
    completed: tickets.filter(t => t.status === 'completed').length,
    critical: tickets.filter(t => t.priority === 'critical' && t.status !== 'completed').length,
    breakdowns: tickets.filter(t => t.type === 'breakdown' && t.status !== 'completed').length,
    totalCost: tickets.reduce((s, t) => s + parseFloat(String(t.cost || 0)), 0),
    avgDowntime: tickets.filter(t => t.downtime_hours > 0).length > 0
      ? tickets.reduce((s, t) => s + parseFloat(String(t.downtime_hours || 0)), 0) / tickets.filter(t => t.downtime_hours > 0).length : 0,
  }), [tickets]);

  const createTicket = useCallback(async (data: {
    equipmentId: string; type: string; issueDescription: string;
    priority: string; assignedTo?: string; staffId: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_equipment_maintenance').insert({
      equipment_id: data.equipmentId, centre_id: centreId,
      type: data.type, issue_description: data.issueDescription,
      priority: data.priority, assigned_to: data.assignedTo || null,
      reported_by: data.staffId, status: 'open',
    });
    // If breakdown, mark equipment as maintenance
    if (data.type === 'breakdown') {
      await sb().from('hmis_equipment').update({ status: 'maintenance' }).eq('id', data.equipmentId);
    }
    load();
  }, [centreId, load]);

  const updateTicket = useCallback(async (id: string, updates: Partial<MaintenanceTicket>) => {
    if (!sb()) return;
    const upd: any = { ...updates };
    if (updates.status === 'in_progress' && !updates.started_at) upd.started_at = new Date().toISOString();
    if (updates.status === 'completed' && !updates.completed_at) {
      upd.completed_at = new Date().toISOString();
      // Calculate downtime
      const ticket = tickets.find(t => t.id === id);
      if (ticket?.started_at) {
        upd.downtime_hours = Math.round((Date.now() - new Date(ticket.started_at).getTime()) / 3600000 * 10) / 10;
      }
    }
    await sb().from('hmis_equipment_maintenance').update(upd).eq('id', id);
    // If completing, restore equipment to active
    if (updates.status === 'completed') {
      const ticket = tickets.find(t => t.id === id);
      if (ticket) {
        await sb().from('hmis_equipment').update({
          status: 'active',
          ...(ticket.type === 'preventive' ? { last_pm_date: new Date().toISOString().split('T')[0] } : {}),
        }).eq('id', ticket.equipment_id);
      }
    }
    load();
  }, [tickets, load]);

  return { tickets, loading, stats, load, createTicket, updateTicket };
}

// ============================================================
// PM SCHEDULE
// ============================================================
export interface PMSchedule {
  id: string; equipment_id: string; centre_id: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  checklist: { item: string; done: boolean }[];
  last_done: string; next_due: string; assigned_to: string;
  is_active: boolean;
  equipment?: { id: string; name: string; category: string; location: string };
}

export function usePMSchedule(centreId: string | null) {
  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_equipment_pm_schedule')
      .select('*, equipment:hmis_equipment(id, name, category, location)')
      .eq('centre_id', centreId).eq('is_active', true)
      .order('next_due', { ascending: true });
    setSchedules(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    return {
      total: schedules.length,
      overdue: schedules.filter(s => s.next_due && s.next_due < today).length,
      dueThisWeek: schedules.filter(s => s.next_due && s.next_due >= today && s.next_due <= weekAhead).length,
      completed: schedules.filter(s => s.last_done === today).length,
    };
  }, [schedules]);

  const addSchedule = useCallback(async (data: {
    equipmentId: string; frequency: string; checklist: { item: string; done: boolean }[];
    nextDue: string; assignedTo?: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_equipment_pm_schedule').insert({
      equipment_id: data.equipmentId, centre_id: centreId,
      frequency: data.frequency, checklist: data.checklist,
      next_due: data.nextDue, assigned_to: data.assignedTo || null,
    });
    load();
  }, [centreId, load]);

  const completePM = useCallback(async (scheduleId: string) => {
    if (!sb()) return;
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    const today = new Date().toISOString().split('T')[0];
    // Calculate next due based on frequency
    const nextDue = calcNextDue(today, schedule.frequency);
    await sb().from('hmis_equipment_pm_schedule').update({
      last_done: today, next_due: nextDue,
    }).eq('id', scheduleId);
    // Update equipment's PM dates
    await sb().from('hmis_equipment').update({
      last_pm_date: today, next_pm_date: nextDue,
    }).eq('id', schedule.equipment_id);
    load();
  }, [schedules, load]);

  const updateSchedule = useCallback(async (id: string, data: Partial<PMSchedule>) => {
    if (!sb()) return;
    await sb().from('hmis_equipment_pm_schedule').update(data).eq('id', id);
    load();
  }, [load]);

  return { schedules, loading, stats, load, addSchedule, completePM, updateSchedule };
}

function calcNextDue(from: string, freq: string): string {
  const d = new Date(from + 'T12:00:00');
  switch (freq) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}
