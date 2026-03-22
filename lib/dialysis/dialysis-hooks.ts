// lib/dialysis/dialysis-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface DialysisMachine {
  id: string; machine_number: string; brand: string; model: string;
  serial_number: string; status: string;
  last_maintenance_date: string; next_maintenance_date: string;
  total_sessions: number; is_active: boolean;
}

export interface DialysisSession {
  id: string; patient_id: string; patient_name: string; uhid: string; age: number; gender: string;
  machine_id: string; machine_number: string;
  session_date: string; shift: string; session_number: number | null;
  dialysis_type: string; access_type: string; is_emergency: boolean;
  // Pre
  pre_weight: number | null; pre_bp: string; pre_pulse: number | null; pre_temp: number | null;
  pre_bun: number | null; pre_creatinine: number | null; pre_potassium: number | null; pre_hemoglobin: number | null;
  // Params
  dialyzer_type: string; blood_flow_rate: number; dialysate_flow_rate: number;
  dialysate_sodium: number; dialysate_potassium: number; dialysate_calcium: number; dialysate_bicarb: number; dialysate_temp: number;
  anticoag_type: string; anticoag_bolus: string; anticoag_maintenance: string;
  heparin_dose: string; target_uf: number | null; duration_minutes: number;
  // Post
  post_weight: number | null; post_bp: string; post_pulse: number | null; post_temp: number | null;
  post_bun: number | null; post_creatinine: number | null; post_potassium: number | null;
  actual_uf: number | null; kt_v: number | null; urr: number | null;
  // Status
  status: string; actual_start: string | null; actual_end: string | null;
  complications: string[]; intradialytic_events: string;
  doctor_name: string; tech_name: string;
  billing_done: boolean; notes: string; created_at: string;
}

export interface DialysisPatientProfile {
  id: string; patient_id: string; patient_name: string; uhid: string;
  ckd_stage: string; etiology: string; dialysis_start_date: string;
  dry_weight: number | null; current_access_type: string; access_limb: string;
  schedule_pattern: string; preferred_shift: string;
  standing_dialyzer: string; standing_bfr: number; standing_dfr: number; standing_duration_min: number;
  standing_anticoag_type: string; standing_anticoag_dose: string;
  preferred_machine_id: string | null;
  last_kt_v: number | null; last_hb: number | null;
  total_sessions: number; is_active: boolean;
}

// ── Main Hook ──
export function useDialysis(centreId: string | null) {
  const [sessions, setSessions] = useState<DialysisSession[]>([]);
  const [machines, setMachines] = useState<DialysisMachine[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const [sRes, mRes] = await Promise.all([
      sb().from('hmis_dialysis_sessions')
        .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
          machine:hmis_dialysis_machines(machine_number),
          tech:hmis_staff!hmis_dialysis_sessions_technician_id_fkey(full_name),
          doctor:hmis_staff!hmis_dialysis_sessions_doctor_id_fkey(full_name)`)
        .eq('centre_id', centreId).eq('session_date', d).order('shift').order('actual_start', { nullsFirst: false }),
      sb().from('hmis_dialysis_machines').select('*').eq('centre_id', centreId).eq('is_active', true).order('machine_number'),
    ]);

    setSessions((sRes.data || []).map((s: any) => ({
      id: s.id, patient_id: s.patient_id,
      patient_name: `${s.patient?.first_name || ''} ${s.patient?.last_name || ''}`.trim(),
      uhid: s.patient?.uhid || '', age: s.patient?.age_years || 0, gender: s.patient?.gender || '',
      machine_id: s.machine_id, machine_number: s.machine?.machine_number || '—',
      session_date: s.session_date, shift: s.shift || 'morning', session_number: s.session_number,
      dialysis_type: s.dialysis_type || 'hd', access_type: s.access_type || 'av_fistula', is_emergency: s.is_emergency || false,
      pre_weight: s.pre_weight, pre_bp: s.pre_bp || '', pre_pulse: s.pre_pulse, pre_temp: s.pre_temp,
      pre_bun: s.pre_bun, pre_creatinine: s.pre_creatinine, pre_potassium: s.pre_potassium, pre_hemoglobin: s.pre_hemoglobin,
      dialyzer_type: s.dialyzer_type || '', blood_flow_rate: s.blood_flow_rate || 300, dialysate_flow_rate: s.dialysate_flow_rate || 500,
      dialysate_sodium: s.dialysate_sodium || 140, dialysate_potassium: s.dialysate_potassium || 2.0,
      dialysate_calcium: s.dialysate_calcium || 2.5, dialysate_bicarb: s.dialysate_bicarb || 35, dialysate_temp: s.dialysate_temp || 36.5,
      anticoag_type: s.anticoag_type || 'heparin', anticoag_bolus: s.anticoag_bolus || '', anticoag_maintenance: s.anticoag_maintenance || '',
      heparin_dose: s.heparin_dose || '', target_uf: s.target_uf, duration_minutes: s.duration_minutes || 240,
      post_weight: s.post_weight, post_bp: s.post_bp || '', post_pulse: s.post_pulse, post_temp: s.post_temp,
      post_bun: s.post_bun, post_creatinine: s.post_creatinine, post_potassium: s.post_potassium,
      actual_uf: s.actual_uf, kt_v: s.kt_v, urr: s.urr,
      status: s.status || 'scheduled', actual_start: s.actual_start, actual_end: s.actual_end,
      complications: s.complications || [], intradialytic_events: s.intradialytic_events || '',
      doctor_name: s.doctor?.full_name || '', tech_name: s.tech?.full_name || '',
      billing_done: s.billing_done || false, notes: s.notes || '', created_at: s.created_at,
    })));
    setMachines((mRes.data || []).map((m: any) => ({ ...m })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const scheduleSession = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    // Auto-fill from patient profile if exists
    let profile: any = null;
    if (data.patient_id) {
      const { data: p } = await sb().from('hmis_dialysis_patients').select('*').eq('patient_id', data.patient_id).single();
      profile = p;
    }
    const payload = {
      centre_id: centreId, ...data,
      dialyzer_type: data.dialyzer_type || profile?.standing_dialyzer || '',
      blood_flow_rate: data.blood_flow_rate || profile?.standing_bfr || 300,
      dialysate_flow_rate: data.dialysate_flow_rate || profile?.standing_dfr || 500,
      duration_minutes: data.duration_minutes || profile?.standing_duration_min || 240,
    };
    const { error } = await sb().from('hmis_dialysis_sessions').insert(payload);
    if (!error) {
      // Update machine status
      if (data.machine_id) await sb().from('hmis_dialysis_machines').update({ status: 'in_use' }).eq('id', data.machine_id);
      load(data.session_date);
    }
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateSession = useCallback(async (id: string, updates: any) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_dialysis_sessions').update(updates).eq('id', id);
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [load]);

  const startSession = useCallback(async (id: string) => {
    return updateSession(id, { status: 'in_progress', actual_start: new Date().toISOString() });
  }, [updateSession]);

  const endSession = useCallback(async (id: string, postData?: any) => {
    const s = sessions.find(x => x.id === id);
    const started = s?.actual_start ? new Date(s.actual_start) : new Date();
    const dur = Math.round((Date.now() - started.getTime()) / 60000);
    const actualUf = postData?.post_weight && s?.pre_weight ? Math.round((s.pre_weight - (postData.post_weight || s.pre_weight)) * 1000) : null;
    return updateSession(id, {
      status: 'completed', actual_end: new Date().toISOString(), duration_minutes: dur,
      actual_uf: actualUf, ...postData,
    });
  }, [updateSession, sessions]);

  const stats = useMemo(() => {
    const completed = sessions.filter(s => s.status === 'completed');
    const avgURR = completed.filter(s => s.urr).reduce((sum, s) => sum + (s.urr || 0), 0) / Math.max(1, completed.filter(s => s.urr).length);
    const withComplications = completed.filter(s => s.complications.length > 0 && !s.complications.every(c => c === 'none'));
    return {
      totalToday: sessions.length,
      scheduled: sessions.filter(s => s.status === 'scheduled').length,
      inProgress: sessions.filter(s => s.status === 'in_progress').length,
      completed: completed.length,
      machinesAvailable: machines.filter(m => m.status === 'available').length,
      machinesInUse: machines.filter(m => m.status === 'in_use').length,
      machinesMaint: machines.filter(m => m.status === 'maintenance').length,
      machinesTotal: machines.length,
      avgURR: avgURR ? avgURR.toFixed(1) : '—',
      complications: withComplications.length,
    };
  }, [sessions, machines]);

  return { sessions, machines, loading, stats, load, scheduleSession, updateSession, startSession, endSession };
}

// ── Intra-dialytic monitoring ──
export function useDialysisMonitoring(sessionId: string | null) {
  const [checks, setChecks] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!sessionId || !sb()) return;
    const { data } = await sb().from('hmis_dialysis_monitoring').select('*, nurse:hmis_staff(full_name)')
      .eq('session_id', sessionId).order('check_time');
    setChecks(data || []);
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const addCheck = useCallback(async (staffId: string, data: any) => {
    if (!sessionId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_dialysis_monitoring').insert({
      session_id: sessionId, recorded_by: staffId, ...data,
    });
    if (!error) load();
    return { success: !error };
  }, [sessionId, load]);

  return { checks, addCheck, load };
}

// ── Patient profiles ──
export function useDialysisPatients(centreId: string | null) {
  const [patients, setPatients] = useState<DialysisPatientProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_dialysis_patients')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender)')
      .eq('centre_id', centreId).eq('is_active', true).order('created_at', { ascending: false });
    setPatients((data || []).map((p: any) => ({
      ...p,
      patient_name: `${p.patient?.first_name || ''} ${p.patient?.last_name || ''}`.trim(),
      uhid: p.patient?.uhid || '',
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const createProfile = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_dialysis_patients').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateProfile = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_dialysis_patients').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  return { patients, loading, load, createProfile, updateProfile };
}
