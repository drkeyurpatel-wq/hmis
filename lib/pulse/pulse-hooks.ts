// lib/pulse/pulse-hooks.ts
// Hooks for Pulse (Daily MIS) module — calls Supabase RPCs for snapshot generation and retrieval.

import { useState, useCallback, useEffect } from 'react';
import { sb } from '@/lib/supabase/browser';

// ═══ TYPES ═══

export interface PulseSnapshot {
  id: string;
  centre_id: string;
  snapshot_date: string;
  centre_name: string;
  centre_code: string;

  // Patient flow
  opd_count: number;
  emergency_count: number;
  new_admissions: number;
  discharges: number;
  ipd_census: number;
  surgeries: number;

  // Revenue
  billing_amount: number;
  collection_amount: number;
  pharmacy_sales: number;

  // Beds
  beds_total: number;
  beds_occupied: number;
  occupancy_pct: number;
  arpob: number;

  // Claims
  claims_new: number;
  claims_settled: number;
  claims_settled_amount: number;

  // Previous day for comparison
  prev_opd_count: number;
  prev_emergency_count: number;
  prev_new_admissions: number;
  prev_discharges: number;
  prev_surgeries: number;
  prev_billing_amount: number;
  prev_collection_amount: number;
  prev_occupancy_pct: number;

  created_at: string;
}

export interface PulseTrendPoint {
  snapshot_date: string;
  centre_id: string;
  centre_name: string;
  centre_code: string;
  opd_count: number;
  new_admissions: number;
  surgeries: number;
  billing_amount: number;
  collection_amount: number;
  occupancy_pct: number;
}

// ═══ FORMATTING HELPERS ═══

/** Format number in Indian lakhs/crore notation */
export function formatLakhs(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Format ARPOB with comma separators */
export function formatARPOB(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Format date as DD Mon YYYY */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Calculate percentage change */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/** Get trend direction */
export function trendDirection(current: number, previous: number): 'up' | 'down' | 'flat' {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

// ═══ HOOKS ═══

export function usePulse() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<PulseSnapshot[]>([]);
  const [trend, setTrend] = useState<PulseTrendPoint[]>([]);
  const [whatsappText, setWhatsappText] = useState('');
  const [generating, setGenerating] = useState(false);

  /** Generate snapshot for a single centre */
  const generateSnapshot = useCallback(async (centreId: string, date: string) => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: rpcError } = await sb().rpc('generate_pulse_snapshot', {
        p_centre_id: centreId,
        p_date: date,
      });
      if (rpcError) throw new Error(rpcError.message);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  /** Generate snapshots for all active centres */
  const generateAllSnapshots = useCallback(async (date: string) => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: rpcError } = await sb().rpc('generate_pulse_all_centres', {
        p_date: date,
      });
      if (rpcError) throw new Error(rpcError.message);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  /** Load dashboard data for a specific date and optional centre */
  const getDashboard = useCallback(async (date: string, centreId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { p_date: date };
      if (centreId) params.p_centre_id = centreId;
      const { data, error: rpcError } = await sb().rpc('get_pulse_dashboard', params);
      if (rpcError) throw new Error(rpcError.message);
      setDashboard(data || []);
      return data || [];
    } catch (err: any) {
      setError(err.message);
      setDashboard([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /** Load trend data for charts */
  const getTrend = useCallback(async (centreId?: string, days?: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (centreId) params.p_centre_id = centreId;
      if (days) params.p_days = days;
      const { data, error: rpcError } = await sb().rpc('get_pulse_trend', params);
      if (rpcError) throw new Error(rpcError.message);
      setTrend(data || []);
      return data || [];
    } catch (err: any) {
      setError(err.message);
      setTrend([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /** Get WhatsApp formatted text */
  const getWhatsAppText = useCallback(async (date: string) => {
    setError(null);
    try {
      const { data, error: rpcError } = await sb().rpc('get_pulse_whatsapp_text', {
        p_date: date,
      });
      if (rpcError) throw new Error(rpcError.message);
      setWhatsappText(data || '');
      return data || '';
    } catch (err: any) {
      setError(err.message);
      return '';
    }
  }, []);

  /** Direct insert/update of snapshot row (for manual entry) */
  const upsertSnapshot = useCallback(async (row: Partial<PulseSnapshot> & { centre_id: string; snapshot_date: string }) => {
    setError(null);
    try {
      const { error: upsertError } = await sb()
        .from('pulse_daily_snapshots')
        .upsert(row, { onConflict: 'centre_id,snapshot_date' });
      if (upsertError) throw new Error(upsertError.message);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  /** Get list of snapshots for history view */
  const getHistory = useCallback(async (centreId: string | null, startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      let query = sb()
        .from('pulse_daily_snapshots')
        .select('*')
        .gte('snapshot_date', startDate)
        .lte('snapshot_date', endDate)
        .order('snapshot_date', { ascending: false });
      if (centreId) query = query.eq('centre_id', centreId);
      const { data, error: qError } = await query;
      if (qError) throw new Error(qError.message);
      return data || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    generating,
    dashboard,
    trend,
    whatsappText,
    generateSnapshot,
    generateAllSnapshots,
    getDashboard,
    getTrend,
    getWhatsAppText,
    upsertSnapshot,
    getHistory,
  };
}

/** Hook to get active centres list */
export function useCentres() {
  const [centres, setCentres] = useState<{ id: string; name: string; code: string; beds_operational: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await sb()
          .from('hmis_centres')
          .select('id, name, code, beds_operational')
          .eq('is_active', true)
          .order('name');
        setCentres(data || []);
      } catch {
        // Silently fail — centres will be empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { centres, loading };
}
