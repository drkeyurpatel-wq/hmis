// lib/modules/module-hooks-3.ts
// Hooks for: Ambulance/Transport, Visitor Management, Asset Management
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ═══ 15. AMBULANCE / TRANSPORT ═══
export function useAmbulances(centreId: string | null) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const [v, r] = await Promise.all([
      sb().from('hmis_ambulances').select('*').eq('centre_id', centreId).eq('is_active', true).order('vehicle_number'),
      sb().from('hmis_transport_requests')
        .select('*, patient:hmis_patients(first_name, last_name, uhid), ambulance:hmis_ambulances(vehicle_number, type), requester:hmis_staff!hmis_transport_requests_requested_by_fkey(full_name)')
        .eq('centre_id', centreId).order('requested_at', { ascending: false }).limit(100),
    ]);
    setVehicles(v.data || []);
    setRequests(r.data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const addVehicle = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false };
    const { error } = await sb().from('hmis_ambulances').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const createRequest = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const num = `TRQ-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_transport_requests').insert({ centre_id: centreId, request_number: num, requested_by: staffId, ...data });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const dispatch = useCallback(async (requestId: string, ambulanceId: string) => {
    if (!sb()) return;
    const amb = vehicles.find(v => v.id === ambulanceId);
    await sb().from('hmis_transport_requests').update({
      ambulance_id: ambulanceId, status: 'dispatched', dispatched_at: new Date().toISOString(),
      driver_name: amb?.driver_name || null, emt_name: amb?.emt_name || null,
    }).eq('id', requestId);
    await sb().from('hmis_ambulances').update({ status: 'on_trip' }).eq('id', ambulanceId);
    load();
  }, [vehicles, load]);

  const updateRequestStatus = useCallback(async (id: string, status: string, extras?: any) => {
    if (!sb()) return;
    const updates: any = { status, ...extras };
    if (status === 'en_route') updates.en_route_at = new Date().toISOString();
    if (status === 'arrived') {
      updates.arrived_at = new Date().toISOString();
      const req = requests.find(r => r.id === id);
      if (req?.dispatched_at) updates.response_time_min = Math.round((Date.now() - new Date(req.dispatched_at).getTime()) / 60000);
    }
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
      const req = requests.find(r => r.id === id);
      if (req?.requested_at) updates.total_trip_time_min = Math.round((Date.now() - new Date(req.requested_at).getTime()) / 60000);
      if (req?.ambulance_id) await sb().from('hmis_ambulances').update({ status: 'available' }).eq('id', req.ambulance_id);
    }
    if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
      const req = requests.find(r => r.id === id);
      if (req?.ambulance_id) await sb().from('hmis_ambulances').update({ status: 'available' }).eq('id', req.ambulance_id);
    }
    await sb().from('hmis_transport_requests').update(updates).eq('id', id);
    load();
  }, [requests, load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayReqs = requests.filter(r => r.requested_at?.startsWith(today));
    const completed = todayReqs.filter(r => r.status === 'completed');
    const avgResponse = completed.filter(r => r.response_time_min).reduce((s: number, r: any) => s + r.response_time_min, 0) / (completed.filter(r => r.response_time_min).length || 1);
    return {
      totalVehicles: vehicles.length,
      available: vehicles.filter(v => v.status === 'available').length,
      onTrip: vehicles.filter(v => v.status === 'on_trip').length,
      maintenance: vehicles.filter(v => v.status === 'maintenance').length,
      todayRequests: todayReqs.length,
      activeRequests: requests.filter(r => !['completed', 'cancelled'].includes(r.status)).length,
      completedToday: completed.length,
      avgResponseMin: Math.round(avgResponse),
      emergency: todayReqs.filter(r => r.priority === 'emergency').length,
    };
  }, [vehicles, requests]);

  return { vehicles, requests, loading, stats, load, addVehicle, createRequest, dispatch, updateRequestStatus };
}

// ═══ 16. VISITOR MANAGEMENT ═══
export function useVisitors(centreId: string | null) {
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_visitor_passes')
      .select('*, patient:hmis_patients(first_name, last_name, uhid), issuer:hmis_staff!hmis_visitor_passes_issued_by_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    setPasses(data || []);
    setLoading(false);
  }, [centreId]);
  useEffect(() => { load(); }, [load]);

  const issuePass = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false };
    const num = `VP-${Date.now().toString(36).toUpperCase()}`;
    const validUntil = new Date(Date.now() + (data.pass_type === 'attendant' ? 24 * 3600000 : 4 * 3600000)).toISOString();
    const { error } = await sb().from('hmis_visitor_passes').insert({
      centre_id: centreId, pass_number: num, issued_by: staffId,
      valid_until: data.valid_until || validUntil, ...data,
    });
    if (!error) load();
    return { success: !error };
  }, [centreId, load]);

  const checkIn = useCallback(async (passId: string) => {
    if (!sb()) return;
    await sb().from('hmis_visitor_passes').update({ status: 'checked_in', check_in_time: new Date().toISOString() }).eq('id', passId);
    load();
  }, [load]);

  const checkOut = useCallback(async (passId: string) => {
    if (!sb()) return;
    await sb().from('hmis_visitor_passes').update({ status: 'checked_out', check_out_time: new Date().toISOString() }).eq('id', passId);
    load();
  }, [load]);

  const revoke = useCallback(async (passId: string, staffId: string, reason: string) => {
    if (!sb()) return;
    await sb().from('hmis_visitor_passes').update({ status: 'revoked', revoked_by: staffId, revocation_reason: reason }).eq('id', passId);
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

// ═══ 17. ASSET MANAGEMENT ═══
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
