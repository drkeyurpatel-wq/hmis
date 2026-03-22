// lib/linen/linen-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export const LINEN_TYPES = ['bedsheet', 'pillow_cover', 'blanket', 'curtain', 'towel', 'gown', 'drape'] as const;
export type LinenType = typeof LINEN_TYPES[number];

export interface LinenInventory {
  id: string; centre_id: string; item_type: LinenType;
  total_qty: number; in_circulation: number; in_laundry: number;
  damaged: number; ward: string; par_level: number;
}

export interface LinenExchange {
  id: string; centre_id: string; ward: string; item_type: LinenType;
  exchange_date: string; exchange_type: 'routine' | 'discharge' | 'emergency';
  soiled_count: number; clean_received: number; damaged_count: number;
  exchanged_by: string; notes: string;
  exchanger?: { full_name: string };
}

// ============================================================
// INVENTORY
// ============================================================
export function useLinenInventory(centreId: string | null) {
  const [inventory, setInventory] = useState<LinenInventory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_linen_inventory')
      .select('*').eq('centre_id', centreId).order('ward').order('item_type');
    setInventory(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const totalItems = inventory.reduce((s, i) => s + i.total_qty, 0);
    const inCirc = inventory.reduce((s, i) => s + i.in_circulation, 0);
    const inLaundry = inventory.reduce((s, i) => s + i.in_laundry, 0);
    const damaged = inventory.reduce((s, i) => s + i.damaged, 0);
    const shortages = inventory.filter(i => i.par_level > 0 && i.in_circulation < i.par_level).length;
    const wards = [...new Set(inventory.map(i => i.ward))];
    return { totalItems, inCirc, inLaundry, damaged, shortages, wardCount: wards.length };
  }, [inventory]);

  const byWard = useMemo(() => {
    const map = new Map<string, LinenInventory[]>();
    for (const item of inventory) {
      if (!map.has(item.ward)) map.set(item.ward, []);
      map.get(item.ward)!.push(item);
    }
    return map;
  }, [inventory]);

  const addInventory = useCallback(async (data: { itemType: string; ward: string; totalQty: number; parLevel?: number }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_linen_inventory').upsert({
      centre_id: centreId, item_type: data.itemType, ward: data.ward,
      total_qty: data.totalQty, in_circulation: data.totalQty,
      in_laundry: 0, damaged: 0, par_level: data.parLevel || 0,
    }, { onConflict: 'centre_id,item_type,ward' });
    load();
  }, [centreId, load]);

  const updateInventory = useCallback(async (id: string, data: Partial<LinenInventory>) => {
    if (!sb()) return;
    await sb().from('hmis_linen_inventory').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }, [load]);

  return { inventory, loading, stats, byWard, load, addInventory, updateInventory };
}

// ============================================================
// EXCHANGE LOG
// ============================================================
export function useLinenExchange(centreId: string | null) {
  const [exchanges, setExchanges] = useState<LinenExchange[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (dateFilter?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const dt = dateFilter || new Date().toISOString().split('T')[0];
    const { data } = await sb().from('hmis_linen_exchange')
      .select('*, exchanger:hmis_staff!hmis_linen_exchange_exchanged_by_fkey(full_name)')
      .eq('centre_id', centreId).eq('exchange_date', dt)
      .order('created_at', { ascending: false });
    setExchanges(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const todayStats = useMemo(() => ({
    totalSoiled: exchanges.reduce((s, e) => s + e.soiled_count, 0),
    totalClean: exchanges.reduce((s, e) => s + e.clean_received, 0),
    totalDamaged: exchanges.reduce((s, e) => s + e.damaged_count, 0),
    exchangeCount: exchanges.length,
  }), [exchanges]);

  const logExchange = useCallback(async (data: {
    ward: string; itemType: string; exchangeType: string;
    soiledCount: number; cleanReceived: number; damagedCount: number;
    staffId: string; notes?: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_linen_exchange').insert({
      centre_id: centreId, ward: data.ward, item_type: data.itemType,
      exchange_type: data.exchangeType,
      soiled_count: data.soiledCount, clean_received: data.cleanReceived,
      damaged_count: data.damagedCount, exchanged_by: data.staffId,
      notes: data.notes || null,
    });
    // Update inventory counts
    const { data: inv } = await sb().from('hmis_linen_inventory')
      .select('id, in_circulation, in_laundry, damaged')
      .eq('centre_id', centreId).eq('item_type', data.itemType).eq('ward', data.ward)
      .maybeSingle();
    if (inv) {
      await sb().from('hmis_linen_inventory').update({
        in_circulation: Math.max(0, inv.in_circulation - data.soiledCount + data.cleanReceived),
        in_laundry: Math.max(0, inv.in_laundry + data.soiledCount - data.cleanReceived),
        damaged: inv.damaged + data.damagedCount,
        updated_at: new Date().toISOString(),
      }).eq('id', inv.id);
    }
    load();
  }, [centreId, load]);

  return { exchanges, loading, todayStats, load, logExchange };
}
