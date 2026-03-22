// lib/physiotherapy/physio-hooks.ts — Sports medicine + therapeutic rehab
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export const BODY_REGIONS = ['knee','shoulder','spine_cervical','spine_lumbar','spine_thoracic','hip','ankle','foot','wrist','hand','elbow','neck','jaw_tmj','pelvis'];
export const SPORTS = ['cricket','football','running','gym_fitness','tennis','badminton','swimming','kabaddi','basketball','hockey','volleyball','cycling','boxing_mma','yoga','dance','athletics'];
export const COMP_LEVELS = ['recreational','amateur','sub_elite','professional','elite'];
export const MODALITIES = ['ift','tens','us_therapeutic','swd','laser_lllt','wax_therapy','cervical_traction','lumbar_traction','cpm','hot_pack','cold_pack','cryo','cupping','dry_needling','kinesio_tape','shockwave_eswt','prf','manual_therapy'];
export const SESSION_TYPES = ['assessment','treatment','review','fms_screen','rts_test','maintenance','prevention'];
export const PLAN_TYPES = ['therapeutic','preventive','sports_rehab','post_surgical','cardiac_rehab','neuro_rehab','pelvic_floor','occupational'];
export const RTS_PHASES = ['phase_1_protection','phase_2_controlled_motion','phase_3_strengthening','phase_4_sport_specific','phase_5_return_to_play','cleared'];
export const OUTCOME_MEASURES = ['vas','nprs','koos','dash','lefs','sf36','oswestry','ndi','groc','fms','y_balance','hop_test','berg_balance','tug','30sec_chair_stand'];

export function usePhysio(centreId: string | null) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const [sRes, pRes, prRes] = await Promise.all([
      sb().from('hmis_physio_sessions')
        .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
          therapist:hmis_staff!hmis_physio_sessions_therapist_id_fkey(full_name),
          plan:hmis_physio_plans(plan_type, sport, diagnosis)`)
        .eq('centre_id', centreId).eq('session_date', d).order('created_at'),
      sb().from('hmis_physio_plans')
        .select(`*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
          therapist:hmis_staff!hmis_physio_plans_therapist_id_fkey(full_name),
          referring_doc:hmis_staff!hmis_physio_plans_referring_doctor_id_fkey(full_name)`)
        .eq('centre_id', centreId).in('status', ['active']).order('created_at', { ascending: false }),
      sb().from('hmis_physio_prevention_programs').select('*').eq('centre_id', centreId).eq('is_active', true).order('program_name'),
    ]);

    setSessions((sRes.data || []).map((s: any) => ({
      ...s,
      patient_name: `${s.patient?.first_name || ''} ${s.patient?.last_name || ''}`.trim(),
      uhid: s.patient?.uhid || '', age: s.patient?.age_years, gender: s.patient?.gender,
      therapist_name: s.therapist?.full_name || '',
      plan_type: s.plan?.plan_type, plan_sport: s.plan?.sport, plan_diagnosis: s.plan?.diagnosis,
    })));

    setPlans((pRes.data || []).map((p: any) => ({
      ...p,
      patient_name: `${p.patient?.first_name || ''} ${p.patient?.last_name || ''}`.trim(),
      uhid: p.patient?.uhid || '', age: p.patient?.age_years, gender: p.patient?.gender,
      therapist_name: p.therapist?.full_name || '',
      referring_doc_name: p.referring_doc?.full_name || '',
    })));

    setPrograms(prRes.data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const createPlan = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_physio_plans').insert({ centre_id: centreId, start_date: new Date().toISOString().split('T')[0], ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updatePlan = useCallback(async (id: string, data: any) => {
    if (!sb()) return;
    await sb().from('hmis_physio_plans').update(data).eq('id', id);
    load();
  }, [load]);

  const createSession = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_physio_sessions').insert({ centre_id: centreId, session_date: new Date().toISOString().split('T')[0], ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateSession = useCallback(async (id: string, data: any) => {
    if (!sb()) return;
    await sb().from('hmis_physio_sessions').update(data).eq('id', id);
    load();
  }, [load]);

  // Save outcome measure
  const saveOutcome = useCallback(async (data: { patient_id: string; plan_id?: string; measure_type: string; score: number; max_score?: number; subscales?: any; staffId: string }) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_physio_outcomes').insert({
      patient_id: data.patient_id, plan_id: data.plan_id || null,
      measure_type: data.measure_type, score: data.score,
      max_score: data.max_score || null, subscales: data.subscales || {},
      recorded_by: data.staffId,
    });
    return { success: !error, error: error?.message };
  }, []);

  // Save FMS screen
  const saveFMS = useCallback(async (data: any) => {
    if (!sb()) return { success: false };
    // Calculate total (use lower of L/R for bilateral tests)
    const bilateral = [
      Math.min(data.hurdle_step_l || 0, data.hurdle_step_r || 0),
      Math.min(data.inline_lunge_l || 0, data.inline_lunge_r || 0),
      Math.min(data.shoulder_mobility_l || 0, data.shoulder_mobility_r || 0),
      Math.min(data.active_slr_l || 0, data.active_slr_r || 0),
      Math.min(data.rotary_stability_l || 0, data.rotary_stability_r || 0),
    ];
    const total = (data.deep_squat || 0) + bilateral.reduce((s, v) => s + v, 0) + (data.trunk_stability_pushup || 0);
    const asymmetries: string[] = [];
    if (Math.abs((data.hurdle_step_l || 0) - (data.hurdle_step_r || 0)) >= 1) asymmetries.push('hurdle_step');
    if (Math.abs((data.inline_lunge_l || 0) - (data.inline_lunge_r || 0)) >= 1) asymmetries.push('inline_lunge');
    if (Math.abs((data.shoulder_mobility_l || 0) - (data.shoulder_mobility_r || 0)) >= 1) asymmetries.push('shoulder_mobility');
    if (Math.abs((data.active_slr_l || 0) - (data.active_slr_r || 0)) >= 1) asymmetries.push('active_slr');
    if (Math.abs((data.rotary_stability_l || 0) - (data.rotary_stability_r || 0)) >= 1) asymmetries.push('rotary_stability');
    const risk = total <= 14 ? 'high' : total <= 17 ? 'moderate' : 'low';

    const { error } = await sb().from('hmis_physio_fms').insert({ ...data, total_score: total, asymmetries, risk_level: risk });
    return { success: !error, error: error?.message };
  }, []);

  const stats = useMemo(() => {
    const sportPlans = plans.filter(p => p.plan_type === 'sports_rehab' || p.sport);
    const preventive = plans.filter(p => p.plan_type === 'preventive');
    const postSurg = plans.filter(p => p.plan_type === 'post_surgical');
    const rtsCleared = plans.filter(p => p.return_to_sport_phase === 'cleared');
    const byArea: Record<string, number> = {};
    sessions.forEach(s => { const a = s.treatment_area || 'other'; byArea[a] = (byArea[a] || 0) + 1; });
    const bySport: Record<string, number> = {};
    plans.filter(p => p.sport).forEach(p => { bySport[p.sport] = (bySport[p.sport] || 0) + 1; });

    return {
      todaySessions: sessions.length,
      completed: sessions.filter(s => s.status === 'completed').length,
      inProgress: sessions.filter(s => s.status === 'in_progress').length,
      noShows: sessions.filter(s => s.status === 'no_show').length,
      activePlans: plans.length,
      sportPlans: sportPlans.length,
      preventivePlans: preventive.length,
      postSurgical: postSurg.length,
      rtsCleared: rtsCleared.length,
      byArea, bySport,
      programs: programs.length,
    };
  }, [sessions, plans, programs]);

  return { sessions, plans, programs, loading, stats, load, createPlan, updatePlan, createSession, updateSession, saveOutcome, saveFMS };
}
