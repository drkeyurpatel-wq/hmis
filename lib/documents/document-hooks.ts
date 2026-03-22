// lib/documents/document-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }


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
