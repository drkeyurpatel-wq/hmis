// lib/modules/module-hooks-2.ts
// Hooks for: Infection Control, Grievance, Telemedicine, Documents
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ═══ 18. INFECTION CONTROL ═══
export function useHAISurveillance(centreId: string | null) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { type?: string; status?: string; year?: number }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_hai_surveillance')
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
    const { error } = await sb().from('hmis_hai_surveillance').insert({ centre_id: centreId, reported_by: staffId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_hai_surveillance').update(updates).eq('id', id);
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
    sb().from('hmis_antibiogram').select('*').eq('centre_id', centreId).eq('year', y)
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
    const { data } = await sb().from('hmis_hand_hygiene_audit')
      .select('*, auditor:hmis_staff!hmis_hand_hygiene_audit_auditor_id_fkey(full_name)')
      .eq('centre_id', centreId).order('audit_date', { ascending: false }).limit(100);
    setAudits(data || []);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const addAudit = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_hand_hygiene_audit').insert({ centre_id: centreId, auditor_id: staffId, ...data });
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

// ═══ 19. GRIEVANCE ═══
export function useGrievances(centreId: string | null) {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; type?: string; severity?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_grievances')
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
    if (!centreId || !sb()) return { success: false };
    const num = `GRV-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_grievances').insert({ centre_id: centreId, grievance_number: num, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_grievances').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
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

// ═══ 20. TELEMEDICINE ═══
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
    const roomId = `health1-${Date.now().toString(36)}`;
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

// ═══ 21. DOCUMENTS ═══
export function useDocuments(centreId: string | null) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { type?: string; dept?: string; status?: string; search?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_documents')
      .select('*, creator:hmis_staff!hmis_documents_created_by_fkey(full_name), approver:hmis_staff!hmis_documents_approved_by_fkey(full_name)')
      .eq('centre_id', centreId).order('updated_at', { ascending: false }).limit(200);
    if (filters?.type && filters.type !== 'all') q = q.eq('doc_type', filters.type);
    if (filters?.dept && filters.dept !== 'all') q = q.eq('department', filters.dept);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.search) q = q.or(`title.ilike.%${filters.search}%,doc_number.ilike.%${filters.search}%`);
    const { data } = await q;
    setDocuments(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const num = `DOC-${data.doc_type?.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_documents').insert({ centre_id: centreId, doc_number: num, created_by: staffId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_documents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const approve = useCallback(async (id: string, staffId: string) => {
    return update(id, { status: 'approved', approved_by: staffId, approved_at: new Date().toISOString() });
  }, [update]);

  const newVersion = useCallback(async (docId: string, data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const { data: old } = await sb().from('hmis_documents').select('version, doc_number').eq('id', docId).single();
    if (!old) return { success: false };
    // Supersede old
    await sb().from('hmis_documents').update({ status: 'superseded', superseded_date: new Date().toISOString().split('T')[0] }).eq('id', docId);
    // Create new version
    const { error } = await sb().from('hmis_documents').insert({
      centre_id: centreId, ...data, doc_number: old.doc_number, version: (old.version || 1) + 1,
      previous_version_id: docId, created_by: staffId, status: 'draft',
    });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const next30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    return {
      total: documents.length,
      approved: documents.filter(d => d.status === 'approved').length,
      draft: documents.filter(d => d.status === 'draft').length,
      underReview: documents.filter(d => d.status === 'under_review').length,
      reviewDueSoon: documents.filter(d => d.status === 'approved' && d.review_date && d.review_date <= next30).length,
      reviewOverdue: documents.filter(d => d.status === 'approved' && d.review_date && d.review_date < today).length,
      nabh: documents.filter(d => d.is_nabh_required).length,
      byType: documents.reduce((a: Record<string, number>, d: any) => { a[d.doc_type] = (a[d.doc_type] || 0) + 1; return a; }, {}),
      byDept: documents.reduce((a: Record<string, number>, d: any) => { if (d.department) a[d.department] = (a[d.department] || 0) + 1; return a; }, {}),
    };
  }, [documents]);

  return { documents, loading, stats, load, create, update, approve, newVersion };
}
