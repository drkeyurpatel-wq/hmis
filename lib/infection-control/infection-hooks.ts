// lib/infection-control/infection-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';


export function useHAISurveillance(centreId: string | null) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { type?: string; status?: string; year?: number }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb()!.from('hmis_hai_surveillance')
      .select('*, patient:hmis_patients!inner(first_name, last_name, uhid), reporter:hmis_staff!hmis_hai_surveillance_reported_by_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    if (filters?.type && filters.type !== 'all') q = q.eq('infection_type', filters.type);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    const { data } = await q;
    setCases(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const report = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb()!.from('hmis_hai_surveillance').insert({ centre_id: centreId, reported_by: staffId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb()!.from('hmis_hai_surveillance').update(updates).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => {
    const confirmed = cases.filter(c => c.status === 'confirmed');
    return {
      total: cases.length,
      confirmed: confirmed.length,
      suspected: cases.filter(c => c.status === 'suspected').length,
      ssi: confirmed.filter(c => c.infection_type === 'ssi').length,
      cauti: confirmed.filter(c => c.infection_type === 'cauti').length,
      clabsi: confirmed.filter(c => c.infection_type === 'clabsi').length,
      vap: confirmed.filter(c => c.infection_type === 'vap').length,
      mrsa: confirmed.filter(c => c.infection_type === 'mrsa').length,
      deviceRelated: confirmed.filter(c => c.device_related).length,
      mortality: confirmed.filter(c => c.outcome === 'death').length,
      byWard: confirmed.reduce((a: Record<string, number>, c: any) => { const w = c.ward || 'Unknown'; a[w] = (a[w] || 0) + 1; return a; }, {}),
      byOrganism: confirmed.reduce((a: Record<string, number>, c: any) => { if (c.organism) a[c.organism] = (a[c.organism] || 0) + 1; return a; }, {}),
    };
  }, [cases]);

  return { cases, loading, stats, load, report, update };
}

export function useAntibiogramData(centreId: string | null, year?: number) {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    if (!centreId || !sb()) return;
    const y = year || new Date().getFullYear();
    sb()!.from('hmis_antibiogram').select('*').eq('centre_id', centreId).eq('year', y)
      .order('organism').order('antibiotic')
      .then(({ data: d }: any) => setData(d || []));
  }, [centreId, year]);

  const heatmap = useMemo(() => {
    const organisms = [...new Set(data.map(d => d.organism))];
    const antibiotics = [...new Set(data.map(d => d.antibiotic))];
    const matrix: Record<string, Record<string, { sensitive: number; total: number; pct: number }>> = {};
    organisms.forEach(o => {
      matrix[o] = {};
      antibiotics.forEach(a => {
        const row = data.find(d => d.organism === o && d.antibiotic === a);
        if (row && row.samples_tested > 0) {
          matrix[o][a] = { sensitive: row.sensitive_count, total: row.samples_tested, pct: Math.round((row.sensitive_count / row.samples_tested) * 100) };
        }
      });
    });
    return { organisms, antibiotics, matrix };
  }, [data]);

  return { data, heatmap };
}

export function useHandHygiene(centreId: string | null) {
  const [audits, setAudits] = useState<any[]>([]);
  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb()!.from('hmis_hand_hygiene_audit')
      .select('*, auditor:hmis_staff!hmis_hand_hygiene_audit_auditor_id_fkey(full_name)')
      .eq('centre_id', centreId).order('audit_date', { ascending: false }).limit(100);
    setAudits(data || []);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const addAudit = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb()!.from('hmis_hand_hygiene_audit').insert({ centre_id: centreId, auditor_id: staffId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const wardCompliance = useMemo(() => {
    const byWard: Record<string, { opp: number; comp: number }> = {};
    audits.forEach(a => {
      if (!byWard[a.ward]) byWard[a.ward] = { opp: 0, comp: 0 };
      byWard[a.ward].opp += a.opportunities_observed || 0;
      byWard[a.ward].comp += a.compliant || 0;
    });
    return Object.entries(byWard).map(([ward, v]) => ({ ward, ...v, pct: v.opp > 0 ? Math.round((v.comp / v.opp) * 100) : 0 })).sort((a, b) => b.pct - a.pct);
  }, [audits]);

  const overallCompliance = useMemo(() => {
    const total = audits.reduce((s, a) => s + (a.opportunities_observed || 0), 0);
    const comp = audits.reduce((s, a) => s + (a.compliant || 0), 0);
    return total > 0 ? Math.round((comp / total) * 100) : 0;
  }, [audits]);

  return { audits, wardCompliance, overallCompliance, load, addAudit };
}
