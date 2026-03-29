// lib/cathlab/cathlab-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface CathProcedure {
  id: string; patient_id: string; patient_name: string; uhid: string; age: number; gender: string;
  admission_id: string | null;
  procedure_date: string; scheduled_time: string | null; procedure_type: string; procedure_name: string;
  indication: string; access_site: string; is_emergency: boolean; priority: string;
  // Pre
  pre_creatinine: number | null; pre_hb: number | null; pre_platelet: number | null;
  pre_inr: number | null; pre_echo_ef: number | null; pre_ecg_findings: string;
  pre_procedure_checklist: any;
  // Findings
  cag_findings: string; vessel_findings: VesselFinding[]; vessels_involved: string[];
  hemodynamics: any; imaging_used: string[]; ffr_ifr_data: any[];
  // Implants
  stents_placed: StentEntry[]; balloon_used: any[];
  implant_details: any;
  // Radiation
  fluoroscopy_time_min: number | null; radiation_dose_mgy: number | null;
  contrast_volume_ml: number | null; contrast_type: string;
  // Team
  primary_operator_id: string; primary_operator_name: string;
  secondary_operator_id: string | null; secondary_operator_name: string;
  anesthetist_id: string | null; anesthetist_name: string;
  // Outcome
  procedure_status: string; outcome: string; complications: string[];
  start_time: string | null; end_time: string | null; estimated_duration_min: number;
  // Post
  sheath_removal_time: string | null; hemostasis_method: string; post_procedure_notes: string;
  billing_done: boolean; notes: string; created_at: string;
}

export interface VesselFinding {
  vessel: string; segment: string; stenosis_pct: number; type: string;
  calcification: string; thrombus: boolean; flow: string;
  intervention: string; stent_result: string; ffr: number | null;
}

export interface StentEntry {
  vessel: string; type: string; brand: string; size: string; serial: string;
  cost_price?: number; inventory_id?: string;
}

export interface InventoryItem {
  id: string; item_type: string; brand: string; model: string; size: string;
  serial_number: string; lot_number: string; expiry_date: string;
  cost_price: number; mrp: number; vendor: string; status: string;
}

// ── Main Hook ──
export function useCathLab(centreId: string | null) {
  const [procedures, setProcedures] = useState<CathProcedure[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string, rangeStart?: string, rangeEnd?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);

    let q = sb()!.from('hmis_cathlab_procedures')
      .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
        op1:hmis_staff!hmis_cathlab_procedures_primary_operator_fkey(full_name),
        op2:hmis_staff!hmis_cathlab_procedures_secondary_operator_fkey(full_name),
        anaesth:hmis_staff!hmis_cathlab_procedures_anesthetist_id_fkey(full_name)`)
      .eq('centre_id', centreId);

    if (dateFilter) q = q.eq('procedure_date', dateFilter);
    else if (rangeStart && rangeEnd) q = q.gte('procedure_date', rangeStart).lte('procedure_date', rangeEnd);
    else q = q.eq('procedure_date', new Date().toISOString().split('T')[0]);

    q = q.order('scheduled_time', { nullsFirst: false }).order('created_at');
    const { data } = await q;

    setProcedures((data || []).map((p: any) => ({
      id: p.id, patient_id: p.patient_id,
      patient_name: `${p.patient?.first_name || ''} ${p.patient?.last_name || ''}`.trim(),
      uhid: p.patient?.uhid || '', age: p.patient?.age_years || 0, gender: p.patient?.gender || '',
      admission_id: p.admission_id,
      procedure_date: p.procedure_date, scheduled_time: p.scheduled_time,
      procedure_type: p.procedure_type, procedure_name: p.procedure_name || '',
      indication: p.indication || '', access_site: p.access_site || 'radial',
      is_emergency: p.is_emergency || false, priority: p.priority || 'elective',
      pre_creatinine: p.pre_creatinine, pre_hb: p.pre_hb, pre_platelet: p.pre_platelet,
      pre_inr: p.pre_inr, pre_echo_ef: p.pre_echo_ef, pre_ecg_findings: p.pre_ecg_findings || '',
      pre_procedure_checklist: p.pre_procedure_checklist || {},
      cag_findings: p.cag_findings || '', vessel_findings: p.vessel_findings || [],
      vessels_involved: p.vessels_involved || [], hemodynamics: p.hemodynamics || {},
      imaging_used: p.imaging_used || [], ffr_ifr_data: p.ffr_ifr_data || [],
      stents_placed: p.stents_placed || [], balloon_used: p.balloon_used || [],
      implant_details: p.implant_details || {},
      fluoroscopy_time_min: p.fluoroscopy_time_min, radiation_dose_mgy: p.radiation_dose_mgy,
      contrast_volume_ml: p.contrast_volume_ml, contrast_type: p.contrast_type || '',
      primary_operator_id: p.primary_operator, primary_operator_name: p.op1?.full_name || '',
      secondary_operator_id: p.secondary_operator, secondary_operator_name: p.op2?.full_name || '',
      anesthetist_id: p.anesthetist_id, anesthetist_name: p.anaesth?.full_name || '',
      procedure_status: p.procedure_status || 'scheduled', outcome: p.outcome || '',
      complications: p.complications || [], start_time: p.start_time, end_time: p.end_time,
      estimated_duration_min: p.estimated_duration_min || 60,
      sheath_removal_time: p.sheath_removal_time, hemostasis_method: p.hemostasis_method || '',
      post_procedure_notes: p.post_procedure_notes || '',
      billing_done: p.billing_done || false, notes: p.notes || '', created_at: p.created_at,
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const schedule = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false, error: "Not initialized" };
    const { error } = await sb()!.from('hmis_cathlab_procedures').insert({ centre_id: centreId, ...data });
    if (!error) load(data.procedure_date);
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateProcedure = useCallback(async (id: string, updates: any) => {
    if (!sb()) return { success: false, error: "Not initialized" };
    const { error } = await sb()!.from('hmis_cathlab_procedures').update(updates).eq('id', id);
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [load]);

  const startProcedure = useCallback(async (id: string) => {
    return updateProcedure(id, { procedure_status: 'in_progress', start_time: new Date().toISOString() });
  }, [updateProcedure]);

  const completeProcedure = useCallback(async (id: string, outcome: string = 'success') => {
    return updateProcedure(id, { procedure_status: 'completed', end_time: new Date().toISOString(), outcome });
  }, [updateProcedure]);

  const stats = useMemo(() => {
    const cag = procedures.filter(p => p.procedure_type === 'cag');
    const ptca = procedures.filter(p => ['ptca', 'pci'].includes(p.procedure_type));
    const device = procedures.filter(p => ['ppi', 'icd', 'crt'].includes(p.procedure_type));
    const totalStents = procedures.reduce((s, p) => s + (p.stents_placed?.length || 0), 0);
    const withComplications = procedures.filter(p => p.complications.length > 0 && !p.complications.includes('none'));
    const completed = procedures.filter(p => p.procedure_status === 'completed');
    const avgFluoro = completed.filter(p => p.fluoroscopy_time_min).reduce((s, p) => s + (p.fluoroscopy_time_min || 0), 0) / Math.max(1, completed.filter(p => p.fluoroscopy_time_min).length);
    const avgContrast = completed.filter(p => p.contrast_volume_ml).reduce((s, p) => s + (p.contrast_volume_ml || 0), 0) / Math.max(1, completed.filter(p => p.contrast_volume_ml).length);

    return {
      total: procedures.length, cag: cag.length, ptca: ptca.length, device: device.length,
      completed: completed.length,
      inProgress: procedures.filter(p => p.procedure_status === 'in_progress').length,
      emergency: procedures.filter(p => p.is_emergency).length,
      totalStents, avgStentsPerPTCA: ptca.length > 0 ? (totalStents / ptca.length).toFixed(1) : '0',
      complications: withComplications.length,
      complicationRate: completed.length > 0 ? ((withComplications.length / completed.length) * 100).toFixed(1) : '0',
      avgFluoro: Math.round(avgFluoro), avgContrast: Math.round(avgContrast),
      conversionRate: cag.length > 0 ? Math.round(ptca.length / (cag.length + ptca.length) * 100) : 0,
    };
  }, [procedures]);

  return { procedures, loading, stats, load, schedule, updateProcedure, startProcedure, completeProcedure };
}

// ── Inventory Hook ──
export function useCathLabInventory(centreId: string | null) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filter?: { type?: string; status?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_cathlab_inventory').select('*').eq('centre_id', centreId).order('created_at', { ascending: false });
    if (filter?.type) q = q.eq('item_type', filter.type);
    if (filter?.status) q = q.eq('status', filter.status);
    else q = q.eq('status', 'in_stock');
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const addItem = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false, error: "Not initialized" };
    const { error } = await sb()!.from('hmis_cathlab_inventory').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const markUsed = useCallback(async (itemId: string, procedureId: string, patientId: string) => {
    if (!sb()) return { success: false, error: "Not initialized" };
    const { error } = await sb()!.from('hmis_cathlab_inventory').update({
      status: 'used', used_in_procedure_id: procedureId, used_for_patient_id: patientId,
      used_date: new Date().toISOString().split('T')[0],
    }).eq('id', itemId);
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [load]);

  const stockStats = useMemo(() => {
    const byType: Record<string, number> = {};
    const expiringSoon = items.filter(i => {
      if (!i.expiry_date) return false;
      const days = (new Date(i.expiry_date).getTime() - Date.now()) / 86400000;
      return days <= 90 && days > 0;
    });
    items.forEach(i => { byType[i.item_type] = (byType[i.item_type] || 0) + 1; });
    return { total: items.length, byType, expiringSoon: expiringSoon.length };
  }, [items]);

  return { items, loading, stockStats, load, addItem, markUsed };
}

// ── Monitoring Hook ──
export function useCathLabMonitoring(procedureId: string | null) {
  const [checks, setChecks] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!procedureId || !sb()) return;
    const { data } = await sb()!.from('hmis_cathlab_monitoring').select('*, nurse:hmis_staff(full_name)')
      .eq('procedure_id', procedureId).order('check_time');
    setChecks(data || []);
  }, [procedureId]);

  useEffect(() => { load(); }, [load]);

  const addCheck = useCallback(async (staffId: string, data: any) => {
    if (!procedureId || !sb()) return;
    await sb()!.from('hmis_cathlab_monitoring').insert({ procedure_id: procedureId, checked_by: staffId, ...data });
    load();
  }, [procedureId, load]);

  return { checks, addCheck, load };
}
