// lib/telemedicine/telemedicine-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';


export function useTeleconsults(centreId: string | null, doctorId?: string) {
  const [consults, setConsults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const d = dateFilter || new Date().toISOString().split('T')[0];
    let q = sb().from('hmis_teleconsults')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender, phone_primary), doctor:hmis_staff!hmis_teleconsults_doctor_id_fkey(full_name, specialisation)')
      .eq('centre_id', centreId).gte('scheduled_at', d + 'T00:00:00').lte('scheduled_at', d + 'T23:59:59')
      .order('scheduled_at', { ascending: true });
    if (doctorId) q = q.eq('doctor_id', doctorId);
    const { data } = await q;
    setConsults(data || []);
    setLoading(false);
  }, [centreId, doctorId]);
  useEffect(() => { load(); }, [load]);

  const schedule = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const roomId = `hmis-${Date.now().toString(36)}`;
    const jitsiDomain = typeof window !== 'undefined' ? (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.jit.si' : 'meet.jit.si';
    const roomUrl = `https://${jitsiDomain}/${roomId}`;
    const { data: consult, error } = await sb().from('hmis_teleconsults').insert({
      centre_id: centreId, room_id: roomId, room_url: roomUrl, ...data,
    }).select('*').single();
    if (!error) load();
    return { success: !error, consult };
  }, [centreId, load]);

  const updateConsult = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_teleconsults').update(updates).eq('id', id);
    load();
  }, [load]);

  const startConsult = useCallback(async (id: string) => {
    return updateConsult(id, { status: 'in_progress', started_at: new Date().toISOString() });
  }, [updateConsult]);

  const endConsult = useCallback(async (id: string, notes?: string, prescriptions?: any[]) => {
    const consult = consults.find(c => c.id === id);
    const started = consult?.started_at ? new Date(consult.started_at) : new Date();
    const duration = Math.round((Date.now() - started.getTime()) / 60000);
    return updateConsult(id, {
      status: 'completed', ended_at: new Date().toISOString(), duration_minutes: duration,
      consultation_notes: notes || null, prescriptions: prescriptions || null,
    });
  }, [updateConsult, consults]);

  const stats = useMemo(() => ({
    total: consults.length,
    scheduled: consults.filter(c => c.status === 'scheduled').length,
    waiting: consults.filter(c => c.status === 'waiting').length,
    inProgress: consults.filter(c => c.status === 'in_progress').length,
    completed: consults.filter(c => c.status === 'completed').length,
    noShow: consults.filter(c => c.status === 'no_show').length,
    avgDuration: (() => { const done = consults.filter(c => c.duration_minutes); return done.length > 0 ? Math.round(done.reduce((s: number, c: any) => s + c.duration_minutes, 0) / done.length) : 0; })(),
  }), [consults]);

  return { consults, loading, stats, load, schedule, updateConsult, startConsult, endConsult };
}
