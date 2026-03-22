// lib/assets/asset-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }


export function useAssets(centreId: string | null) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { category?: string; status?: string; dept?: string; search?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_assets')
      .select('*, custodian:hmis_staff!hmis_assets_custodian_id_fkey(full_name)')
      .eq('centre_id', centreId).eq('is_active', true).order('name').limit(500);
    if (filters?.category && filters.category !== 'all') q = q.eq('category', filters.category);
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.dept && filters.dept !== 'all') q = q.eq('department', filters.dept);
    if (filters?.search) q = q.or(`name.ilike.%${filters.search}%,asset_tag.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`);
    const { data } = await q;
    setAssets(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const bookValue = data.purchase_cost ? parseFloat(data.purchase_cost) : 0;
    const { error } = await sb().from('hmis_assets').insert({
      centre_id: centreId, current_book_value: bookValue, ...data,
    });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const update = useCallback(async (id: string, updates: any) => {
    if (!sb()) return;
    await sb().from('hmis_assets').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  const dispose = useCallback(async (id: string, method: string, value: number, staffId: string) => {
    if (!sb()) return;
    await sb().from('hmis_assets').update({
      status: 'disposed', disposal_method: method, disposal_value: value,
      disposed_date: new Date().toISOString().split('T')[0], disposal_approved_by: staffId,
      is_active: false, updated_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => {
    const totalCost = assets.reduce((s: number, a: any) => s + parseFloat(a.purchase_cost || 0), 0);
    const totalBook = assets.reduce((s: number, a: any) => s + parseFloat(a.current_book_value || 0), 0);
    const totalDepreciation = totalCost - totalBook;
    const today = new Date().toISOString().split('T')[0];
    const next30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    return {
      totalAssets: assets.length,
      totalCost, totalBook, totalDepreciation,
      inUse: assets.filter(a => a.status === 'in_use').length,
      maintenance: assets.filter(a => a.status === 'under_maintenance').length,
      condemned: assets.filter(a => a.status === 'condemned').length,
      warrantyExpiring: assets.filter(a => a.warranty_expiry && a.warranty_expiry >= today && a.warranty_expiry <= next30).length,
      amcExpiring: assets.filter(a => a.amc_expiry && a.amc_expiry >= today && a.amc_expiry <= next30).length,
      amcExpired: assets.filter(a => a.amc_expiry && a.amc_expiry < today).length,
      byCategory: assets.reduce((a: Record<string, { count: number; value: number }>, x: any) => {
        const c = x.category || 'other';
        if (!a[c]) a[c] = { count: 0, value: 0 };
        a[c].count++;
        a[c].value += parseFloat(x.purchase_cost || 0);
        return a;
      }, {}),
      byDepartment: assets.reduce((a: Record<string, number>, x: any) => { if (x.department) a[x.department] = (a[x.department] || 0) + 1; return a; }, {}),
    };
  }, [assets]);

  return { assets, loading, stats, load, create, update, dispose };
}
