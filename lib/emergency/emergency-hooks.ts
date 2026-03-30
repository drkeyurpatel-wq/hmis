// lib/modules/module-hooks.ts
// Hooks for: Emergency, Dietary, CSSD, Dialysis, CathLab, Endoscopy, Physio, Referrals, Packages
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

// ═══ 1. EMERGENCY / TRIAGE ═══
export function useEmergency(centreId: string | null) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_er_visits')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender), doctor:hmis_staff!hmis_er_visits_attending_doctor_id_fkey(full_name), triage_staff:hmis_staff!hmis_er_visits_triage_by_fkey(full_name)')
      .eq('centre_id', centreId).gte('arrival_time', d + 'T00:00:00').order('arrival_time', { ascending: false }).limit(100);
    setVisits(data || []);
    setLoading(false);
  }, [centreId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const register = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_er_visits').insert({ centre_id: centreId, triage_by: staffId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateStatus = useCallback(async (id: string, status: string, extras?: any) => {
    if (!sb()) return;
    await sb().from('hmis_er_visits').update({ status, ...extras, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: visits.length,
    red: visits.filter(v => v.triage_category === 'red').length,
    orange: visits.filter(v => v.triage_category === 'orange').length,
    yellow: visits.filter(v => v.triage_category === 'yellow').length,
    green: visits.filter(v => v.triage_category === 'green').length,
    mlc: visits.filter(v => v.is_mlc).length,
    active: visits.filter(v => !['discharged', 'admitted', 'referred', 'expired'].includes(v.status)).length,
  }), [visits]);

  return { visits, loading, stats, load, register, updateStatus };
}

// ═══ 2. DIETARY / KITCHEN ═══