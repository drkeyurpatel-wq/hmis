// lib/pharmacy/pharmacy-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { postPharmacyCharge } from '@/lib/bridge/cross-module-bridge';
import { auditCreate } from '@/lib/audit/audit-logger';

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

  // Add stock (manual or GRN) — with full validation
  const addStock = useCallback(async (data: any): Promise<{ success: boolean; error?: string }> => {
    if (!centreId || !sb()) return { success: false, error: 'Not ready' };

    // Required fields
    if (!data.drug_id) return { success: false, error: 'Drug is required' };
    if (!data.batch_number?.trim()) return { success: false, error: 'Batch number is required' };
    if (!data.expiry_date) return { success: false, error: 'Expiry date is required' };
    if (!data.purchase_rate || parseFloat(data.purchase_rate) < 0) return { success: false, error: 'Purchase rate must be >= 0' };
    if (!data.mrp || parseFloat(data.mrp) <= 0) return { success: false, error: 'MRP must be > 0' };
    if (!data.quantity_received || parseInt(data.quantity_received) <= 0) return { success: false, error: 'Quantity must be > 0' };

    // MRP should be >= purchase rate
    if (parseFloat(data.mrp) < parseFloat(data.purchase_rate)) {
      return { success: false, error: `MRP (₹${data.mrp}) cannot be less than purchase rate (₹${data.purchase_rate})` };
    }

    // Expiry date must be in the future
    const today = new Date().toISOString().split('T')[0];
    if (data.expiry_date <= today) {
      return { success: false, error: 'Cannot add stock that has already expired. Use Returns module for expired stock write-off.' };
    }

    // Check for duplicate batch in same centre
    const { data: existing } = await sb().from('hmis_pharmacy_stock')
      .select('id, quantity_available')
      .eq('centre_id', centreId).eq('drug_id', data.drug_id).eq('batch_number', data.batch_number.trim())
      .limit(1);

    if (existing?.length) {
      return { success: false, error: `Batch "${data.batch_number}" already exists for this drug at this centre (${existing[0].quantity_available} units remaining). Use GRN to add more to an existing batch.` };
    }

    const { error } = await sb().from('hmis_pharmacy_stock').insert({
      ...data,
      centre_id: centreId,
      batch_number: data.batch_number.trim(),
      quantity_available: parseInt(data.quantity_received),
      quantity_dispensed: 0,
      received_date: new Date().toISOString().split('T')[0],
    });

    if (error) return { success: false, error: error.message };

    load();
    return { success: true };
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

  const dispense = useCallback(async (dispensingId: string, items: any[], staffId: string, totalAmount: number): Promise<{ success: boolean; error?: string }> => {
    if (!sb() || !centreId) return { success: false, error: 'Not ready' };

    // Validate all items have drugId, qty > 0
    for (const item of items) {
      if (!item.drugId) return { success: false, error: `Drug not selected for "${item.drugName || 'item'}"` };
      if (!item.qty || item.qty <= 0) return { success: false, error: `Invalid quantity for ${item.drugName}` };
    }

    // FEFO batch auto-selection + stock deduction
    const dispensedItems: any[] = [];

    for (const item of items) {
      // Get available batches for this drug, sorted by expiry (FEFO)
      const { data: batches } = await sb().from('hmis_pharmacy_stock')
        .select('id, batch_number, expiry_date, quantity_available, quantity_dispensed, mrp, purchase_rate')
        .eq('centre_id', centreId).eq('drug_id', item.drugId)
        .gt('quantity_available', 0).gt('expiry_date', new Date().toISOString().split('T')[0])
        .order('expiry_date', { ascending: true }); // FEFO: earliest expiry first

      if (!batches?.length) return { success: false, error: `No stock available for ${item.drugName}` };

      // Check total available
      const totalAvail = batches.reduce((s: number, b: any) => s + b.quantity_available, 0);
      if (totalAvail < item.qty) return { success: false, error: `Insufficient stock for ${item.drugName}: need ${item.qty}, have ${totalAvail}` };

      // Pick from batches (FEFO)
      let remaining = item.qty;
      const pickedBatches: any[] = [];

      for (const batch of batches) {
        if (remaining <= 0) break;
        const pick = Math.min(remaining, batch.quantity_available);
        pickedBatches.push({ batchId: batch.id, batchNumber: batch.batch_number, expiry: batch.expiry_date, qty: pick, mrp: batch.mrp, cost: batch.purchase_rate });

        // Deduct stock
        const { error: deductErr } = await sb().from('hmis_pharmacy_stock').update({
          quantity_available: batch.quantity_available - pick,
          quantity_dispensed: (batch.quantity_dispensed || 0) + pick,
        }).eq('id', batch.id);

        if (deductErr) return { success: false, error: `Stock deduction failed for batch ${batch.batch_number}: ${deductErr.message}` };
        remaining -= pick;
      }

      dispensedItems.push({
        drugId: item.drugId, drugName: item.drugName, requestedQty: item.qty,
        dispensedQty: item.qty, batches: pickedBatches,
        totalMRP: pickedBatches.reduce((s: number, b: any) => s + (b.qty * parseFloat(b.mrp)), 0),
      });
    }

    // Calculate total
    const computedTotal = dispensedItems.reduce((s: number, i: any) => s + (i.totalMRP || 0), 0);

    // Update dispensing record
    const { error: updateErr } = await sb().from('hmis_pharmacy_dispensing').update({
      status: 'dispensed',
      dispensed_items: dispensedItems,
      total_amount: totalAmount > 0 ? totalAmount : computedTotal,
      dispensed_by: staffId,
      dispensed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', dispensingId);

    if (updateErr) return { success: false, error: `Update failed: ${updateErr.message}` };

    // Auto-post charges to billing
    const disp = await sb().from('hmis_pharmacy_dispensing').select('patient_id, encounter_id').eq('id', dispensingId).single();
    if (disp.data) {
      for (const item of dispensedItems) {
        await postPharmacyCharge({
          centreId, patientId: disp.data.patient_id, admissionId: disp.data.encounter_id || undefined,
          drugName: item.drugName, quantity: item.dispensedQty, amount: item.totalMRP,
          dispensingId, staffId,
        });
      }
      auditCreate(centreId, staffId, 'pharmacy_dispense', dispensingId, `Dispensed ${dispensedItems.length} items — ₹${computedTotal}`);
    }

    load();
    return { success: true };
  }, [centreId, load]);

  // FEFO batch lookup for a specific drug (used by UI for manual batch selection)
  const getBatchesForDrug = useCallback(async (drugId: string): Promise<any[]> => {
    if (!centreId || !sb()) return [];
    const today = new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_pharmacy_stock')
      .select('id, batch_number, expiry_date, quantity_available, mrp, purchase_rate')
      .eq('centre_id', centreId).eq('drug_id', drugId)
      .gt('quantity_available', 0).gt('expiry_date', today)
      .order('expiry_date', { ascending: true });
    return data || [];
  }, [centreId]);

  const stats = useMemo(() => ({
    pending: queue.filter(q => q.status === 'pending').length,
    inProgress: queue.filter(q => q.status === 'in_progress').length,
    dispensed: queue.filter(q => q.status === 'dispensed').length,
  }), [queue]);

  return { queue, loading, stats, load, dispense, getBatchesForDrug };
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
