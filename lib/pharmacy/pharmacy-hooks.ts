// lib/pharmacy/pharmacy-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// DRUG MASTER
// ============================================================
export function useDrugMaster() {
  const [drugs, setDrugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_drug_master').select('*').eq('is_active', true).order('generic_name');
    setDrugs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const search = useCallback((q: string) => {
    if (q.length < 2) return [];
    const lq = q.toLowerCase();
    return drugs.filter(d => d.generic_name?.toLowerCase().includes(lq) || d.brand_name?.toLowerCase().includes(lq) || d.manufacturer?.toLowerCase().includes(lq)).slice(0, 15);
  }, [drugs]);

  const addDrug = useCallback(async (data: any) => {
    if (!sb()) return;
    await sb().from('hmis_drug_master').insert(data);
    load();
  }, [load]);

  const formulations = useMemo(() => [...new Set(drugs.map(d => d.formulation).filter(Boolean))].sort(), [drugs]);
  const schedules = useMemo(() => [...new Set(drugs.map(d => d.schedule).filter(Boolean))].sort(), [drugs]);

  return { drugs, loading, search, addDrug, load, formulations, schedules };
}

// ============================================================
// STOCK / INVENTORY
// ============================================================
export function usePharmacyStock(centreId: string | null) {
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filters?: { lowStock?: boolean; expiringSoon?: boolean; drugId?: string }) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_pharmacy_stock')
      .select('*, drug:hmis_drug_master(generic_name, brand_name, formulation, strength, unit, schedule, is_narcotic, is_antibiotic)')
      .eq('centre_id', centreId).gt('quantity_available', 0).order('expiry_date', { ascending: true });
    if (filters?.drugId) q = q.eq('drug_id', filters.drugId);
    const { data } = await q;
    let result = data || [];

    if (filters?.lowStock) {
      result = result.filter((s: any) => s.quantity_available <= 10);
    }
    if (filters?.expiringSoon) {
      const d90 = new Date(); d90.setDate(d90.getDate() + 90);
      result = result.filter((s: any) => new Date(s.expiry_date) <= d90);
    }
    setStock(result);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Aggregate: unique drugs with total qty
  const aggregated = useMemo(() => {
    const map = new Map<string, any>();
    stock.forEach(s => {
      const key = s.drug_id;
      if (!map.has(key)) {
        map.set(key, { drugId: key, drug: s.drug, totalQty: 0, batches: 0, earliestExpiry: s.expiry_date, avgCost: 0, totalCost: 0, mrp: s.mrp });
      }
      const agg = map.get(key)!;
      agg.totalQty += s.quantity_available;
      agg.batches++;
      agg.totalCost += s.purchase_rate * s.quantity_available;
      if (s.expiry_date < agg.earliestExpiry) agg.earliestExpiry = s.expiry_date;
    });
    map.forEach(v => { v.avgCost = v.totalQty > 0 ? v.totalCost / v.totalQty : 0; });
    return Array.from(map.values()).sort((a, b) => a.drug?.generic_name?.localeCompare(b.drug?.generic_name || '') || 0);
  }, [stock]);

  // Expiring within 90 days
  const expiringSoon = useMemo(() => {
    const d90 = new Date(); d90.setDate(d90.getDate() + 90);
    return stock.filter(s => new Date(s.expiry_date) <= d90);
  }, [stock]);

  // Already expired
  const expired = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return stock.filter(s => s.expiry_date <= today);
  }, [stock]);

  // Low stock (<=10 units)
  const lowStock = useMemo(() => aggregated.filter(a => a.totalQty <= 10), [aggregated]);

  // Stock value
  const totalValue = useMemo(() => stock.reduce((s, i) => s + (parseFloat(i.purchase_rate) * i.quantity_available), 0), [stock]);
  const totalMRPValue = useMemo(() => stock.reduce((s, i) => s + (parseFloat(i.mrp) * i.quantity_available), 0), [stock]);

  // Add stock (manual or GRN)
  const addStock = useCallback(async (data: any) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_pharmacy_stock').insert({ ...data, centre_id: centreId, quantity_dispensed: 0 });
    load();
  }, [centreId, load]);

  return { stock, aggregated, loading, expiringSoon, expired, lowStock, totalValue, totalMRPValue, load, addStock };
}

// ============================================================
// DISPENSING QUEUE
// ============================================================
export function useDispensingQueue(centreId: string | null) {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (status?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_pharmacy_dispensing')
      .select('*, patient:hmis_patients(first_name, last_name, uhid)')
      .eq('centre_id', centreId).order('created_at', { ascending: true }).limit(100);
    if (status && status !== 'all') q = q.eq('status', status);
    else q = q.in('status', ['pending','in_progress','partially_dispensed']);
    const { data } = await q;
    setQueue(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const dispense = useCallback(async (dispensingId: string, items: any[], staffId: string, totalAmount: number) => {
    if (!sb()) return;
    // Deduct stock for each item
    for (const item of items) {
      if (item.batchId && item.qty > 0) {
        const { data: batch } = await sb().from('hmis_pharmacy_stock').select('quantity_available, quantity_dispensed').eq('id', item.batchId).single();
        if (batch) {
          await sb().from('hmis_pharmacy_stock').update({
            quantity_available: batch.quantity_available - item.qty,
            quantity_dispensed: (batch.quantity_dispensed || 0) + item.qty,
          }).eq('id', item.batchId);
        }
      }
    }
    // Update dispensing record
    await sb().from('hmis_pharmacy_dispensing').update({
      status: 'dispensed', dispensed_items: items, total_amount: totalAmount,
      dispensed_by: staffId, dispensed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', dispensingId);
    load();
  }, [load]);

  const stats = useMemo(() => ({
    pending: queue.filter(q => q.status === 'pending').length,
    inProgress: queue.filter(q => q.status === 'in_progress').length,
    dispensed: queue.filter(q => q.status === 'dispensed').length,
  }), [queue]);

  return { queue, loading, stats, load, dispense };
}

// ============================================================
// PURCHASE ORDERS
// ============================================================
export function usePurchaseOrders(centreId: string | null) {
  const [orders, setOrders] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    // POs would come from VPMS integration — check hmis_integration_bridge
    const { data } = await sb().from('hmis_integration_bridge')
      .select('*').eq('centre_id', centreId).eq('entity_type', 'purchase_order').order('created_at', { ascending: false }).limit(50);
    setOrders(data || []);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);
  return { orders, load };
}

// ============================================================
// PHARMACY DASHBOARD STATS
// ============================================================
export function usePharmacyDashboard(centreId: string | null) {
  const [todayDispensed, setTodayDispensed] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);

  useEffect(() => {
    if (!centreId || !sb()) return;
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    (async () => {
      const { data: todayData } = await sb().from('hmis_pharmacy_dispensing')
        .select('total_amount').eq('centre_id', centreId).eq('status', 'dispensed')
        .gte('dispensed_at', today);
      const td = todayData || [];
      setTodayDispensed(td.length);
      setTodayRevenue(td.reduce((s: number, d: any) => s + parseFloat(d.total_amount || 0), 0));

      const { data: monthData } = await sb().from('hmis_pharmacy_dispensing')
        .select('total_amount').eq('centre_id', centreId).eq('status', 'dispensed')
        .gte('dispensed_at', monthStart);
      setMonthRevenue((monthData || []).reduce((s: number, d: any) => s + parseFloat(d.total_amount || 0), 0));
    })();
  }, [centreId]);

  return { todayDispensed, todayRevenue, monthRevenue };
}
