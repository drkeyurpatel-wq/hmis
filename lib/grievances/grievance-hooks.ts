// lib/grievances/grievance-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';


export function useGrievances(centreId: string | null) {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; type?: string; severity?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_grievances')
      .select('*, patient:hmis_patients(first_name, last_name, uhid), assignee:hmis_staff!hmis_grievances_assigned_to_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.type && filters.type !== 'all') q = q.eq('complaint_type', filters.type);
    if (filters?.severity && filters.severity !== 'all') q = q.eq('severity', filters.severity);
    const { data } = await q;
    setGrievances(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false, error: "Not initialized" };
    const num = `GRV-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb()!.from('hmis_grievances').insert({ centre_id: centreId, grievance_number: num, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb()!.from('hmis_grievances').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const acknowledge = useCallback(async (id: string, staffId: string) => {
    return update(id, { status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: staffId });
  }, [update]);

  const resolve = useCallback(async (id: string, staffId: string, resolution: string) => {
    return update(id, { status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: staffId, resolution });
  }, [update]);

  const stats = useMemo(() => {
    const now = Date.now();
    const ack24 = grievances.filter(g => {
      if (g.status === 'received') { return (now - new Date(g.created_at).getTime()) > 24 * 3600000; }
      return false;
    }).length;
    const res7 = grievances.filter(g => {
      if (!['resolved', 'closed'].includes(g.status)) { return (now - new Date(g.created_at).getTime()) > 7 * 86400000; }
      return false;
    }).length;
    return {
      total: grievances.length,
      received: grievances.filter(g => g.status === 'received').length,
      acknowledged: grievances.filter(g => g.status === 'acknowledged').length,
      investigating: grievances.filter(g => g.status === 'investigating').length,
      resolved: grievances.filter(g => g.status === 'resolved').length,
      escalated: grievances.filter(g => g.escalated).length,
      overdue_ack: ack24, // not acknowledged within 24h
      overdue_res: res7, // not resolved within 7 days
      byType: grievances.reduce((a: Record<string, number>, g: any) => { a[g.complaint_type] = (a[g.complaint_type] || 0) + 1; return a; }, {}),
      byDept: grievances.reduce((a: Record<string, number>, g: any) => { if (g.department) a[g.department] = (a[g.department] || 0) + 1; return a; }, {}),
      satisfactionRate: (() => { const resolved = grievances.filter(g => g.patient_satisfied !== null); return resolved.length > 0 ? Math.round((resolved.filter(g => g.patient_satisfied).length / resolved.length) * 100) : 0; })(),
    };
  }, [grievances]);

  return { grievances, loading, stats, load, create, update, acknowledge, resolve };
}
