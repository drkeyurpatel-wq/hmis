// lib/surgical-planning/surgical-planning-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface SurgicalPlanning {
  id: string; centre_id: string; ot_booking_id: string;
  admission_id: string | null; patient_id: string;
  surgeon_id: string | null; planned_date: string;
  procedure_name: string; priority: string;
  overall_status: string; readiness_pct: number;
  notes: string | null;
  cleared_by: string | null; cleared_at: string | null;
  created_by: string | null; created_at: string; updated_at: string;
  // Joined
  patient?: { first_name: string; last_name: string; uhid: string; age_years: number; gender: string };
  surgeon?: { full_name: string };
  ot_booking?: { scheduled_date: string; scheduled_start: string; ot_room: { name: string } | null; status: string };
  items?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string; planning_id: string; centre_id: string;
  category: string; item_name: string;
  is_mandatory: boolean; status: string;
  assigned_to: string | null; due_date: string | null;
  actual_date: string | null; remarks: string | null;
  lab_order_id: string | null; pre_auth_id: string | null;
  consent_id: string | null; cssd_issue_id: string | null; bed_id: string | null;
  completed_by: string | null; completed_at: string | null;
  sort_order: number;
  created_at: string; updated_at: string;
  // Joined
  assignee?: { full_name: string } | null;
  completer?: { full_name: string } | null;
}

const DEFAULT_CHECKLIST: { category: string; item_name: string; is_mandatory: boolean; sort_order: number }[] = [
  { category: 'pre_op_investigation', item_name: 'CBC, BMP, Coagulation panel ordered', is_mandatory: true, sort_order: 1 },
  { category: 'pre_op_investigation', item_name: 'Chest X-ray / ECG done', is_mandatory: true, sort_order: 2 },
  { category: 'pre_op_investigation', item_name: 'All investigation results received', is_mandatory: true, sort_order: 3 },
  { category: 'anaesthesia_fitness', item_name: 'Pre-anaesthesia check-up (PAC) done', is_mandatory: true, sort_order: 4 },
  { category: 'anaesthesia_fitness', item_name: 'ASA grade documented', is_mandatory: true, sort_order: 5 },
  { category: 'insurance_preauth', item_name: 'Pre-authorisation submitted to TPA/insurer', is_mandatory: false, sort_order: 6 },
  { category: 'insurance_preauth', item_name: 'Pre-authorisation approved', is_mandatory: false, sort_order: 7 },
  { category: 'consent', item_name: 'Surgical consent signed', is_mandatory: true, sort_order: 8 },
  { category: 'consent', item_name: 'Anaesthesia consent signed', is_mandatory: true, sort_order: 9 },
  { category: 'blood_arrangement', item_name: 'Blood group & cross-match done', is_mandatory: true, sort_order: 10 },
  { category: 'blood_arrangement', item_name: 'Blood units reserved/arranged', is_mandatory: false, sort_order: 11 },
  { category: 'cssd_booking', item_name: 'CSSD instrument set booked', is_mandatory: true, sort_order: 12 },
  { category: 'ot_slot', item_name: 'OT slot confirmed', is_mandatory: true, sort_order: 13 },
  { category: 'bed_reservation', item_name: 'Post-op bed/ICU reserved', is_mandatory: true, sort_order: 14 },
];

export function useSurgicalPlanning(centreId: string | null) {
  const [cases, setCases] = useState<SurgicalPlanning[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFrom?: string, dateTo?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_surgical_planning')
      .select(`*, patient:hmis_patients!hmis_surgical_planning_patient_id_fkey(first_name, last_name, uhid, age_years, gender),
        surgeon:hmis_staff!hmis_surgical_planning_surgeon_id_fkey(full_name),
        ot_booking:hmis_ot_bookings!hmis_surgical_planning_ot_booking_id_fkey(scheduled_date, scheduled_start, status, ot_room:hmis_ot_rooms(name))`)
      .eq('centre_id', centreId)
      .order('planned_date', { ascending: true });
    if (dateFrom) q = q.gte('planned_date', dateFrom);
    if (dateTo) q = q.lte('planned_date', dateTo);
    const { data } = await q;
    setCases(data || []);
    setLoading(false);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadItems = useCallback(async (planningId: string): Promise<ChecklistItem[]> => {
    if (!sb()) return [];
    const { data } = await sb().from('hmis_surgical_checklist_items')
      .select(`*, assignee:hmis_staff!hmis_surgical_checklist_items_assigned_to_fkey(full_name),
        completer:hmis_staff!hmis_surgical_checklist_items_completed_by_fkey(full_name)`)
      .eq('planning_id', planningId)
      .order('sort_order', { ascending: true });
    return (data || []) as ChecklistItem[];
  }, []);

  const createCase = useCallback(async (input: {
    ot_booking_id: string; admission_id?: string; patient_id: string;
    surgeon_id?: string; planned_date: string; procedure_name: string;
    priority?: string; notes?: string; created_by: string;
  }) => {
    if (!centreId || !sb()) return null;
    const { data: plan, error } = await sb().from('hmis_surgical_planning')
      .insert({ ...input, centre_id: centreId })
      .select().single();
    if (error || !plan) return null;
    // Seed default checklist items
    const items = DEFAULT_CHECKLIST.map(d => ({
      planning_id: plan.id,
      centre_id: centreId,
      ...d,
    }));
    await sb().from('hmis_surgical_checklist_items').insert(items);
    // Compute initial readiness
    await recalcReadiness(plan.id);
    return plan;
  }, [centreId]);

  const updateItemStatus = useCallback(async (itemId: string, status: string, staffId: string, remarks?: string) => {
    if (!sb()) return;
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'done') { updates.completed_by = staffId; updates.completed_at = new Date().toISOString(); updates.actual_date = new Date().toISOString().split('T')[0]; }
    if (remarks !== undefined) updates.remarks = remarks;
    await sb().from('hmis_surgical_checklist_items').update(updates).eq('id', itemId);
  }, []);

  const addCustomItem = useCallback(async (planningId: string, item: { item_name: string; is_mandatory: boolean; category?: string; assigned_to?: string; due_date?: string }) => {
    if (!centreId || !sb()) return;
    const { data: existing } = await sb().from('hmis_surgical_checklist_items').select('sort_order').eq('planning_id', planningId).order('sort_order', { ascending: false }).limit(1);
    const nextSort = (existing?.[0]?.sort_order || 0) + 1;
    await sb().from('hmis_surgical_checklist_items').insert({
      planning_id: planningId, centre_id: centreId,
      category: item.category || 'custom', item_name: item.item_name,
      is_mandatory: item.is_mandatory, assigned_to: item.assigned_to || null,
      due_date: item.due_date || null, sort_order: nextSort,
    });
  }, [centreId]);

  const recalcReadiness = useCallback(async (planningId: string) => {
    if (!sb()) return;
    const { data: items } = await sb().from('hmis_surgical_checklist_items').select('is_mandatory, status').eq('planning_id', planningId);
    if (!items || items.length === 0) return;
    const mandatory = items.filter(i => i.is_mandatory);
    const mandatoryDone = mandatory.filter(i => i.status === 'done' || i.status === 'waived').length;
    const pct = mandatory.length > 0 ? Math.round((mandatoryDone / mandatory.length) * 100 * 100) / 100 : 100;
    const hasBlocker = mandatory.some(i => i.status === 'blocked');
    const allDone = mandatory.every(i => i.status === 'done' || i.status === 'waived');
    const status = hasBlocker ? 'blocked' : allDone ? 'ready' : 'planning';
    await sb().from('hmis_surgical_planning').update({ readiness_pct: pct, overall_status: status, updated_at: new Date().toISOString() }).eq('id', planningId);
  }, []);

  const clearForSurgery = useCallback(async (planningId: string, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_surgical_planning').update({
      overall_status: 'ready', cleared_by: staffId, cleared_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', planningId);
  }, []);

  const cancelCase = useCallback(async (planningId: string, reason: string) => {
    if (!sb()) return;
    await sb().from('hmis_surgical_planning').update({
      overall_status: 'cancelled', notes: reason, updated_at: new Date().toISOString(),
    }).eq('id', planningId);
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = cases.length;
    const ready = cases.filter(c => c.overall_status === 'ready').length;
    const blocked = cases.filter(c => c.overall_status === 'blocked').length;
    const planning = cases.filter(c => c.overall_status === 'planning').length;
    return { total, ready, blocked, planning };
  }, [cases]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  return { cases, loading, stats, load, loadItems, createCase, updateItemStatus, addCustomItem, recalcReadiness, clearForSurgery, cancelCase };
}
