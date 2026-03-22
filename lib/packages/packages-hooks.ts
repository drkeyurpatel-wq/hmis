// lib/packages/packages-hooks.ts — Package management + utilization tracking
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export const CATEGORIES = ['surgical','medical','daycare','diagnostic','maternity','trauma','transplant','robotic','cardiac','neuro'];
export const ROOMS = ['general','semi_private','private','deluxe','icu','transplant_icu'];
export const RATE_TYPES = ['self','insurance','pmjay','cghs','esi','corporate'];
export const INCLUSION_CATS = ['room','surgeon','anaesthesia','ot','pharmacy','lab','nursing','consumables','implant','blood','radiology','physiotherapy','dietician','other'];

export function usePackages(centreId: string | null) {
  const [packages, setPackages] = useState<any[]>([]);
  const [utilizations, setUtilizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_packages').select('*').eq('centre_id', centreId).eq('is_active', true).order('package_name');
    if (search) q = q.ilike('package_name', `%${search}%`);
    const [pRes, uRes] = await Promise.all([
      q,
      sb().from('hmis_package_utilization')
        .select(`*, patient:hmis_patients(first_name, last_name, uhid), pkg:hmis_packages(package_name, package_code)`)
        .eq('centre_id', centreId).in('status', ['active','completed']).order('created_at', { ascending: false }).limit(100),
    ]);
    setPackages(pRes.data || []);
    setUtilizations((uRes.data || []).map((u: any) => ({
      ...u, patient_name: `${u.patient?.first_name || ''} ${u.patient?.last_name || ''}`.trim(),
      uhid: u.patient?.uhid || '', pkg_name: u.pkg?.package_name || '', pkg_code: u.pkg?.package_code || '',
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const createPackage = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const code = data.package_code || `PKG-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_packages').insert({ centre_id: centreId, package_code: code, created_by: staffId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updatePackage = useCallback(async (id: string, data: any) => {
    if (!sb()) return;
    await sb().from('hmis_packages').update(data).eq('id', id);
    load();
  }, [load]);

  const assignPackage = useCallback(async (data: { admission_id: string; package_id: string; patient_id: string; package_rate: number; rate_type: string; insurer_name?: string; expected_los: number }) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_package_utilization').insert({ centre_id: centreId, ...data, expected_los: data.expected_los });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const updateUtilization = useCallback(async (id: string, data: any) => {
    if (!sb()) return;
    const actual_total = (data.actual_room_charges || 0) + (data.actual_surgeon_fee || 0) + (data.actual_anaesthesia_fee || 0) + (data.actual_pharmacy || 0) + (data.actual_lab || 0) + (data.actual_consumables || 0) + (data.actual_nursing || 0) + (data.actual_ot_charges || 0) + (data.actual_other || 0);
    await sb().from('hmis_package_utilization').update({ ...data, actual_total, variance: data.package_rate ? data.package_rate - actual_total : 0, variance_pct: data.package_rate ? ((data.package_rate - actual_total) / data.package_rate * 100) : 0 }).eq('id', id);
    load();
  }, [load]);

  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    packages.forEach(p => { byCategory[p.category || 'other'] = (byCategory[p.category || 'other'] || 0) + 1; });
    const activeUtils = utilizations.filter(u => u.status === 'active');
    const completedUtils = utilizations.filter(u => u.status === 'completed');
    const totalVariance = completedUtils.reduce((s, u) => s + (u.variance || 0), 0);
    const losses = completedUtils.filter(u => (u.variance || 0) < 0);
    const avgVariancePct = completedUtils.length > 0 ? completedUtils.reduce((s, u) => s + (u.variance_pct || 0), 0) / completedUtils.length : 0;
    return {
      total: packages.length, byCategory,
      activeUtils: activeUtils.length,
      completedUtils: completedUtils.length,
      totalVariance, avgVariancePct: avgVariancePct.toFixed(1),
      lossCount: losses.length,
      totalLoss: losses.reduce((s, u) => s + Math.abs(u.variance || 0), 0),
    };
  }, [packages, utilizations]);

  return { packages, utilizations, loading, stats, load, createPackage, updatePackage, assignPackage, updateUtilization };
}
