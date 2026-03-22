// lib/cssd/cssd-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export interface InstrumentSet {
  id: string; set_name: string; set_code: string; department: string; category: string;
  instruments: any[]; total_instruments: number;
  status: string; pack_type: string; barcode: string; location: string;
  last_sterilized_at: string | null; sterility_expires_at: string | null;
  sterility_expiry_hours: number; sterilization_count: number; max_cycles: number;
  is_active: boolean;
  // Computed
  isExpired: boolean; hoursUntilExpiry: number | null; cycleLifePct: number;
}

export interface SterilizationCycle {
  id: string; cycle_number: string; autoclave_number: string; autoclave_id: string | null;
  cycle_type: string; load_items: any[]; temperature: number; pressure: number;
  duration_minutes: number; exposure_time_min: number | null; dry_time_min: number | null;
  bi_test_result: string; bi_reading_24h: string; bi_reading_48h: string;
  bowie_dick_result: string; ci_result: string; printout_attached: boolean;
  operator_name: string; start_time: string | null; end_time: string | null;
  status: string; recalled: boolean; recall_reason: string;
  created_at: string;
}

export interface IssueReturn {
  id: string; set_id: string; set_name: string; set_code: string;
  issued_to: string; issued_to_location: string;
  patient_name: string | null; surgery_name: string;
  pack_integrity: string; ci_indicator: string;
  issued_by_name: string; issued_at: string;
  returned_at: string | null; returned_by_name: string | null;
  condition_on_return: string; missing_items: any[];
  instrument_count_verified: boolean; sharps_count_match: boolean | null;
  contamination_level: string;
}

export function useCssd(centreId: string | null) {
  const [sets, setSets] = useState<InstrumentSet[]>([]);
  const [cycles, setCycles] = useState<SterilizationCycle[]>([]);
  const [issues, setIssues] = useState<IssueReturn[]>([]);
  const [autoclaves, setAutoclaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const now = new Date();
    const [sRes, cRes, iRes, aRes] = await Promise.all([
      sb().from('hmis_cssd_instrument_sets').select('*').eq('centre_id', centreId).eq('is_active', true).order('set_name'),
      sb().from('hmis_cssd_cycles').select('*, operator:hmis_staff!hmis_cssd_cycles_operator_id_fkey(full_name)')
        .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(100),
      sb().from('hmis_cssd_issue_return')
        .select(`*, set:hmis_cssd_instrument_sets(set_name, set_code),
          issuer:hmis_staff!hmis_cssd_issue_return_issued_by_fkey(full_name),
          returner:hmis_staff!hmis_cssd_issue_return_returned_by_fkey(full_name),
          patient:hmis_patients(first_name, last_name)`)
        .eq('centre_id', centreId).order('issued_at', { ascending: false }).limit(100),
      sb().from('hmis_cssd_autoclaves').select('*').eq('centre_id', centreId).eq('is_active', true).order('autoclave_number'),
    ]);

    setSets((sRes.data || []).map((s: any) => {
      const expiresAt = s.sterility_expires_at ? new Date(s.sterility_expires_at) : null;
      const isExpired = expiresAt ? expiresAt < now : false;
      const hoursUntilExpiry = expiresAt ? Math.round((expiresAt.getTime() - now.getTime()) / 3600000) : null;
      return {
        ...s, isExpired,
        hoursUntilExpiry,
        cycleLifePct: s.max_cycles > 0 ? Math.round((s.sterilization_count || 0) / s.max_cycles * 100) : 0,
      };
    }));

    setCycles((cRes.data || []).map((c: any) => ({
      id: c.id, cycle_number: c.cycle_number, autoclave_number: c.autoclave_number || '',
      autoclave_id: c.autoclave_id, cycle_type: c.cycle_type || 'prevacuum',
      load_items: c.load_items || [], temperature: c.temperature, pressure: c.pressure,
      duration_minutes: c.duration_minutes, exposure_time_min: c.exposure_time_min,
      dry_time_min: c.dry_time_min,
      bi_test_result: c.bi_test_result || 'pending',
      bi_reading_24h: c.bi_reading_24h || 'pending', bi_reading_48h: c.bi_reading_48h || 'pending',
      bowie_dick_result: c.bowie_dick_result || 'na', ci_result: c.ci_result || '',
      printout_attached: c.printout_attached || false,
      operator_name: c.operator?.full_name || '', start_time: c.start_time, end_time: c.end_time,
      status: c.status, recalled: c.recalled || false, recall_reason: c.recall_reason || '',
      created_at: c.created_at,
    })));

    setIssues((iRes.data || []).map((i: any) => ({
      id: i.id, set_id: i.set_id, set_name: i.set?.set_name || '', set_code: i.set?.set_code || '',
      issued_to: i.issued_to || '', issued_to_location: i.issued_to_location || '',
      patient_name: i.patient ? `${i.patient.first_name} ${i.patient.last_name}` : null,
      surgery_name: i.surgery_name || '',
      pack_integrity: i.pack_integrity || 'intact', ci_indicator: i.ci_indicator || 'changed',
      issued_by_name: i.issuer?.full_name || '', issued_at: i.issued_at,
      returned_at: i.returned_at, returned_by_name: i.returner?.full_name || '',
      condition_on_return: i.condition_on_return || '',
      missing_items: i.missing_items || [],
      instrument_count_verified: i.instrument_count_verified || false,
      sharps_count_match: i.sharps_count_match,
      contamination_level: i.contamination_level || '',
    })));

    setAutoclaves(aRes.data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // ── Instrument Sets ──
  const createSet = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_cssd_instrument_sets').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateSet = useCallback(async (id: string, data: any) => {
    if (!sb()) return;
    await sb().from('hmis_cssd_instrument_sets').update(data).eq('id', id);
    load();
  }, [load]);

  // ── Cycles ──
  const startCycle = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const cycleNum = `CY-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_cssd_cycles').insert({
      centre_id: centreId, cycle_number: cycleNum, operator_id: staffId,
      start_time: new Date().toISOString(), status: 'in_progress', ...data,
    });
    // Mark sets as sterilizing
    for (const item of (data.load_items || [])) {
      if (item.set_id) await sb().from('hmis_cssd_instrument_sets').update({ status: 'sterilizing' }).eq('id', item.set_id);
    }
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const completeCycle = useCallback(async (cycleId: string, biResult: string, updates?: any) => {
    if (!sb()) return;
    const { data: cycle } = await sb().from('hmis_cssd_cycles').select('load_items').eq('id', cycleId).single();
    await sb().from('hmis_cssd_cycles').update({
      status: biResult === 'pass' ? 'completed' : 'failed',
      bi_test_result: biResult, end_time: new Date().toISOString(), ...updates,
    }).eq('id', cycleId);

    if (cycle?.load_items) {
      for (const item of cycle.load_items) {
        if (!item.set_id) continue;
        if (biResult === 'pass') {
          await sb().from('hmis_cssd_instrument_sets').update({
            status: 'available', last_sterilized_at: new Date().toISOString(),
            location: 'cssd_store',
          }).eq('id', item.set_id);
          // Increment sterilization_count
          await sb().rpc('increment_cssd_cycle_count', { p_set_id: item.set_id }).catch(() => {
            // Fallback if RPC doesn't exist
          });
        } else {
          // Failed — mark for re-sterilization
          await sb().from('hmis_cssd_instrument_sets').update({ status: 'available' }).eq('id', item.set_id);
        }
      }
    }
    load();
  }, [load]);

  const updateCycle = useCallback(async (id: string, data: any) => {
    if (!sb()) return;
    await sb().from('hmis_cssd_cycles').update(data).eq('id', id);
    load();
  }, [load]);

  // ── Issue / Return ──
  const issueSet = useCallback(async (data: {
    set_id: string; issued_to: string; issued_to_location: string;
    patient_id?: string; surgery_name?: string; staffId: string;
    ot_booking_id?: string;
  }) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_cssd_issue_return').insert({
      centre_id: centreId, set_id: data.set_id, issued_to: data.issued_to,
      issued_to_location: data.issued_to_location,
      patient_id: data.patient_id || null, surgery_name: data.surgery_name || '',
      issued_by: data.staffId, ot_booking_id: data.ot_booking_id || null,
    });
    if (!error) {
      await sb().from('hmis_cssd_instrument_sets').update({ status: 'in_use', location: data.issued_to_location }).eq('id', data.set_id);
      load();
    }
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const returnSet = useCallback(async (issueId: string, setId: string, staffId: string, data: {
    condition: string; missing_items?: any[]; instrument_count_verified: boolean;
    sharps_count_match?: boolean; contamination_level?: string; return_wash_done?: boolean;
  }) => {
    if (!sb()) return { success: false };
    const { error } = await sb().from('hmis_cssd_issue_return').update({
      returned_at: new Date().toISOString(), returned_by: staffId,
      condition_on_return: data.condition, missing_items: data.missing_items || [],
      instrument_count_verified: data.instrument_count_verified,
      sharps_count_match: data.sharps_count_match, contamination_level: data.contamination_level,
      return_wash_done: data.return_wash_done,
    }).eq('id', issueId);
    if (!error) {
      await sb().from('hmis_cssd_instrument_sets').update({ status: 'available', location: 'cssd_store' }).eq('id', setId);
      load();
    }
    return { success: !error };
  }, [load]);

  // ── Recall ──
  const recallCycle = useCallback(async (cycleId: string, reason: string, staffId: string) => {
    if (!centreId || !sb()) return;
    const { data: cycle } = await sb().from('hmis_cssd_cycles').select('load_items').eq('id', cycleId).single();
    await sb().from('hmis_cssd_cycles').update({ recalled: true, recall_reason: reason }).eq('id', cycleId);

    for (const item of (cycle?.load_items || [])) {
      if (!item.set_id) continue;
      // Find if set was issued
      const { data: issue } = await sb().from('hmis_cssd_issue_return').select('id, patient_id')
        .eq('set_id', item.set_id).is('returned_at', null).order('issued_at', { ascending: false }).limit(1).single();

      await sb().from('hmis_cssd_recall_log').insert({
        centre_id: centreId, cycle_id: cycleId, set_id: item.set_id,
        issue_id: issue?.id || null, recall_reason: reason,
        set_location: 'unknown', patient_affected_id: issue?.patient_id || null,
        was_used: !!issue, recalled_by: staffId,
      });
    }
    load();
  }, [centreId, load]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const expiringSoon = sets.filter(s => s.hoursUntilExpiry !== null && s.hoursUntilExpiry > 0 && s.hoursUntilExpiry <= 12);
    const expired = sets.filter(s => s.isExpired && s.status === 'available');
    const highCycleLife = sets.filter(s => s.cycleLifePct >= 90);
    const pendingReturn = issues.filter(i => !i.returned_at);
    const todayCycles = cycles.filter(c => c.created_at?.startsWith(today));

    return {
      totalSets: sets.length,
      available: sets.filter(s => s.status === 'available' && !s.isExpired).length,
      inUse: sets.filter(s => s.status === 'in_use').length,
      sterilizing: sets.filter(s => s.status === 'sterilizing').length,
      expired: expired.length, expiringSoon: expiringSoon.length,
      highCycleLife: highCycleLife.length,
      cyclesToday: todayCycles.length,
      failedCycles: cycles.filter(c => c.status === 'failed').length,
      recalledCycles: cycles.filter(c => c.recalled).length,
      pendingReturn: pendingReturn.length,
      autoclaves: autoclaves.length,
      autoclavesBusy: autoclaves.filter(a => a.status === 'running').length,
    };
  }, [sets, cycles, issues, autoclaves]);

  return { sets, cycles, issues, autoclaves, loading, stats, load, createSet, updateSet, startCycle, completeCycle, updateCycle, issueSet, returnSet, recallCycle };
}
