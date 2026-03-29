// lib/visitors/visitor-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';


export function useVisitors(centreId: string | null) {
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb()!.from('hmis_visitor_passes')
      .select('*, patient:hmis_patients(first_name, last_name, uhid), issuer:hmis_staff!hmis_visitor_passes_issued_by_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    setPasses(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const issuePass = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false, error: "Not initialized" };
    const num = `VP-${Date.now().toString(36).toUpperCase()}`;
    const validUntil = new Date(Date.now() + (data.pass_type === 'attendant' ? 24 * 3600000 : 4 * 3600000)).toISOString();
    const { error } = await sb()!.from('hmis_visitor_passes').insert({
      centre_id: centreId, pass_number: num, issued_by: staffId,
      valid_until: data.valid_until || validUntil, ...data,
    });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const checkIn = useCallback(async (passId: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_visitor_passes').update({ status: 'checked_in', check_in_time: new Date().toISOString() }).eq('id', passId);
    load();
  }, [load]);

  const checkOut = useCallback(async (passId: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_visitor_passes').update({ status: 'checked_out', check_out_time: new Date().toISOString() }).eq('id', passId);
    load();
  }, [load]);

  const revoke = useCallback(async (passId: string, staffId: string, reason: string) => {
    if (!sb()) return;
    await sb()!.from('hmis_visitor_passes').update({ status: 'revoked', revoked_by: staffId, revocation_reason: reason }).eq('id', passId);
    load();
  }, [load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayPasses = passes.filter(p => p.created_at?.startsWith(today));
    return {
      totalToday: todayPasses.length,
      active: passes.filter(p => p.status === 'active').length,
      checkedIn: passes.filter(p => p.status === 'checked_in').length,
      checkedOut: todayPasses.filter(p => p.status === 'checked_out').length,
      icuVisitors: passes.filter(p => ['icu', 'nicu', 'isolation'].includes(p.pass_type) && p.status === 'checked_in').length,
      attendants: passes.filter(p => p.pass_type === 'attendant' && ['active', 'checked_in'].includes(p.status)).length,
      revoked: todayPasses.filter(p => p.status === 'revoked').length,
    };
  }, [passes]);

  return { passes, loading, stats, load, issuePass, checkIn, checkOut, revoke };
}
