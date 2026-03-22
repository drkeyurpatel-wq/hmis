// lib/endoscopy/endoscopy-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface EndoProcedure {
  id: string; patient_id: string; patient_name: string; uhid: string; age: number; gender: string;
  admission_id: string | null; procedure_date: string; scheduled_time: string | null;
  procedure_type: string; indication: string; sedation_type: string; is_emergency: boolean;
  scope_code: string; scope_inventory_id: string | null;
  pre_procedure_checklist: any; prep_quality: string; asa_class: string;
  findings: string; structured_findings: any[]; biopsies: any[]; polyps_found: any[];
  biopsy_taken: boolean; biopsy_details: string;
  therapeutic_intervention: string; therapeutic_details: any;
  cecal_intubation: boolean | null; withdrawal_time_min: number | null; boston_bowel_prep_score: number | null;
  photo_documentation: boolean; complications: string[];
  endoscopist_name: string; endoscopist_id: string; nurse_name: string;
  start_time: string | null; end_time: string | null; status: string;
  report: string; recovery_notes: string; follow_up_plan: string;
  billing_done: boolean; created_at: string;
}

export interface Scope {
  id: string; scope_code: string; scope_type: string; brand: string; model: string;
  serial_number: string; status: string; total_procedures: number;
  last_service_date: string; next_service_date: string;
}

// ── Procedures Hook ──
export function useEndoscopy(centreId: string | null) {
  const [procedures, setProcedures] = useState<EndoProcedure[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const [pRes, sRes] = await Promise.all([
      sb().from('hmis_endoscopy_procedures')
        .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
          endoscopist:hmis_staff!hmis_endoscopy_procedures_endoscopist_id_fkey(full_name),
          nurse:hmis_staff!hmis_endoscopy_procedures_nurse_id_fkey(full_name)`)
        .eq('centre_id', centreId).eq('procedure_date', d)
        .order('scheduled_time', { nullsFirst: false }).order('created_at'),
      sb().from('hmis_endoscopy_scopes').select('*').eq('centre_id', centreId).eq('is_active', true).order('scope_code'),
    ]);

    setProcedures((pRes.data || []).map((p: any) => ({
      id: p.id, patient_id: p.patient_id,
      patient_name: `${p.patient?.first_name || ''} ${p.patient?.last_name || ''}`.trim(),
      uhid: p.patient?.uhid || '', age: p.patient?.age_years || 0, gender: p.patient?.gender || '',
      admission_id: p.admission_id, procedure_date: p.procedure_date, scheduled_time: p.scheduled_time,
      procedure_type: p.procedure_type, indication: p.indication || '', sedation_type: p.sedation_type || 'conscious',
      is_emergency: p.is_emergency || false,
      scope_code: p.scope_id || '', scope_inventory_id: p.scope_inventory_id,
      pre_procedure_checklist: p.pre_procedure_checklist || {},
      prep_quality: p.prep_quality || '', asa_class: p.asa_class || '',
      findings: p.findings || '', structured_findings: p.structured_findings || [],
      biopsies: p.biopsies || [], polyps_found: p.polyps_found || [],
      biopsy_taken: p.biopsy_taken || false, biopsy_details: p.biopsy_details || '',
      therapeutic_intervention: p.therapeutic_intervention || '', therapeutic_details: p.therapeutic_details || {},
      cecal_intubation: p.cecal_intubation, withdrawal_time_min: p.withdrawal_time_min,
      boston_bowel_prep_score: p.boston_bowel_prep_score,
      photo_documentation: p.photo_documentation || false, complications: p.complications || [],
      endoscopist_name: p.endoscopist?.full_name || '', endoscopist_id: p.endoscopist_id,
      nurse_name: p.nurse?.full_name || '',
      start_time: p.start_time, end_time: p.end_time, status: p.status || 'scheduled',
      report: p.report || '', recovery_notes: p.recovery_notes || '', follow_up_plan: p.follow_up_plan || '',
      billing_done: p.billing_done || false, created_at: p.created_at,
    })));
    setScopes((sRes.data || []).map((s: any) => ({ ...s })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const schedule = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_endoscopy_procedures').insert({ centre_id: centreId, ...data });
    if (!error) load(data.procedure_date);
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateProcedure = useCallback(async (id: string, updates: any) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_endoscopy_procedures').update(updates).eq('id', id);
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [load]);

  const startProcedure = useCallback(async (id: string) => {
    return updateProcedure(id, { status: 'in_progress', start_time: new Date().toISOString() });
  }, [updateProcedure]);

  const completeProcedure = useCallback(async (id: string) => {
    return updateProcedure(id, { status: 'completed', end_time: new Date().toISOString() });
  }, [updateProcedure]);

  const stats = useMemo(() => {
    const completed = procedures.filter(p => p.status === 'completed');
    const colonoscopies = completed.filter(p => p.procedure_type === 'colonoscopy');
    const cecalRate = colonoscopies.length > 0 ? Math.round(colonoscopies.filter(p => p.cecal_intubation).length / colonoscopies.length * 100) : 0;
    const avgWithdrawal = colonoscopies.filter(p => p.withdrawal_time_min).reduce((s, p) => s + (p.withdrawal_time_min || 0), 0) / Math.max(1, colonoscopies.filter(p => p.withdrawal_time_min).length);
    const withBiopsy = completed.filter(p => p.biopsy_taken);
    const withTherapy = completed.filter(p => p.therapeutic_intervention);
    const withComps = completed.filter(p => p.complications.length > 0 && !p.complications.includes('none'));

    return {
      total: procedures.length,
      completed: completed.length,
      inProgress: procedures.filter(p => p.status === 'in_progress').length,
      byType: procedures.reduce((a: Record<string, number>, p) => { a[p.procedure_type] = (a[p.procedure_type] || 0) + 1; return a; }, {}),
      biopsyRate: completed.length > 0 ? Math.round(withBiopsy.length / completed.length * 100) : 0,
      therapeuticRate: completed.length > 0 ? Math.round(withTherapy.length / completed.length * 100) : 0,
      cecalRate, avgWithdrawal: avgWithdrawal ? avgWithdrawal.toFixed(1) : '—',
      complications: withComps.length,
      complicationRate: completed.length > 0 ? ((withComps.length / completed.length) * 100).toFixed(1) : '0',
      scopesAvailable: scopes.filter(s => s.status === 'available').length,
      scopesTotal: scopes.length,
    };
  }, [procedures, scopes]);

  return { procedures, scopes, loading, stats, load, schedule, updateProcedure, startProcedure, completeProcedure };
}

// ── Decontamination Hook ──
export function useDecontamination(centreId: string | null) {
  const [logs, setLogs] = useState<any[]>([]);

  const load = useCallback(async (scopeId?: string) => {
    if (!centreId || !sb()) return;
    let q = sb().from('hmis_scope_decontamination').select('*, performed:hmis_staff(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(50);
    if (scopeId) q = q.eq('scope_id', scopeId);
    const { data } = await q;
    setLogs(data || []);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const addLog = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_scope_decontamination').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  return { logs, load, addLog };
}
