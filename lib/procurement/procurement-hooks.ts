// lib/procurement/procurement-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

// ═══ INDENTS ═══
export function useIndents(centreId: string | null, staffId?: string) {
  const [indents, setIndents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { status?: string; dept?: string; mine?: boolean }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_purchase_indents')
      .select('*, requester:hmis_staff!hmis_purchase_indents_requested_by_fkey(full_name), approver:hmis_staff!hmis_purchase_indents_approved_by_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.dept && filters.dept !== 'all') q = q.eq('department', filters.dept);
    if (filters?.mine && staffId) q = q.eq('requested_by', staffId);
    const { data } = await q;
    setIndents(data || []);
    setLoading(false);
  }, [centreId, staffId]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any, requesterId: string) => {
    if (!centreId || !sb()) return { success: false };
    const num = `IND-${Date.now().toString(36).toUpperCase()}`;
    const items = data.items || [];
    const totalEst = items.reduce((s: number, i: any) => s + (parseFloat(i.estimated_cost || 0) * parseFloat(i.qty || 1)), 0);
    const { error } = await sb().from('hmis_purchase_indents').insert({
      centre_id: centreId, indent_number: num, requested_by: requesterId,
      total_estimated_cost: totalEst, ...data,
    });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const submit = useCallback(async (id: string) => {
    if (!sb()) return;
    await sb().from('hmis_purchase_indents').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const approve = useCallback(async (id: string, approverId: string) => {
    if (!sb()) return;
    await sb().from('hmis_purchase_indents').update({
      status: 'approved', approved_by: approverId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  }, [load]);

  const reject = useCallback(async (id: string, rejectedBy: string, reason: string) => {
    if (!sb()) return;
    await sb().from('hmis_purchase_indents').update({
      status: 'rejected', rejected_by: rejectedBy, rejected_at: new Date().toISOString(), rejection_reason: reason, updated_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: indents.length,
    draft: indents.filter(i => i.status === 'draft').length,
    submitted: indents.filter(i => i.status === 'submitted').length,
    approved: indents.filter(i => i.status === 'approved').length,
    rejected: indents.filter(i => i.status === 'rejected').length,
    ordered: indents.filter(i => i.status === 'ordered').length,
    received: indents.filter(i => i.status === 'received').length,
    totalValue: indents.reduce((s, i) => s + parseFloat(i.total_estimated_cost || 0), 0),
    pendingApproval: indents.filter(i => i.status === 'submitted').length,
  }), [indents]);

  return { indents, loading, stats, load, create, submit, approve, reject };
}

// ═══ PURCHASE ORDERS (read-only from pharmacy_po) ═══
export function usePurchaseOrders(centreId: string | null) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_pharmacy_po')
      .select('*, creator:hmis_staff!hmis_pharmacy_po_created_by_fkey(full_name)')
      .eq('centre_id', centreId).order('order_date', { ascending: false }).limit(100);
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: orders.length,
    draft: orders.filter(o => o.status === 'draft').length,
    sent: orders.filter(o => o.status === 'sent').length,
    received: orders.filter(o => o.status === 'received').length,
    totalValue: orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0),
  }), [orders]);

  return { orders, loading, stats, load };
}

// ═══ GRN (read-only from pharmacy_grn) ═══
export function useGRNs(centreId: string | null) {
  const [grns, setGrns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (statusFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_pharmacy_grn')
      .select('*, receiver:hmis_staff!hmis_pharmacy_grn_received_by_fkey(full_name), po:hmis_pharmacy_po(po_number)')
      .eq('centre_id', centreId).order('received_date', { ascending: false }).limit(100);
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setGrns(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: grns.length,
    pending: grns.filter(g => g.status === 'pending').length,
    verified: grns.filter(g => g.status === 'verified').length,
    totalValue: grns.reduce((s, g) => s + parseFloat(g.total_amount || 0), 0),
  }), [grns]);

  return { grns, loading, stats, load };
}

// ═══ VENDORS ═══
export function useVendors(centreId: string | null) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { category?: string; search?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_vendors').select('*')
      .eq('centre_id', centreId).eq('is_active', true).order('name').limit(200);
    if (filters?.category && filters.category !== 'all') q = q.eq('category', filters.category);
    if (filters?.search) q = q.or(`name.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%,gst_number.ilike.%${filters.search}%`);
    const { data } = await q;
    setVendors(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const code = `VND-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_vendors').insert({ centre_id: centreId, code, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_vendors').update(updates).eq('id', id);
    load();
  }, [load]);

  return { vendors, loading, load, create, update };
}
