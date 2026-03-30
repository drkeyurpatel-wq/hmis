// lib/ambulance/ambulance-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';


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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const addVehicle = useCallback(async (data: any) => {
    if (!centreId || !sb()) return { success: false, error: "Not initialized" };
    const { error } = await sb().from('hmis_ambulances').insert({ centre_id: centreId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
  }, [centreId, load]);

  const createRequest = useCallback(async (data: any, staffId: string) => {
    if (!centreId || !sb()) return { success: false, error: "Not initialized" };
    const num = `TRQ-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb().from('hmis_transport_requests').insert({ centre_id: centreId, request_number: num, requested_by: staffId, ...data });
    if (!error) load();
    return { success: !error, error: error?.message };
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
