'use client';
// lib/collect/useARDashboard.ts
// Hooks for the AR Dashboard: aging summary, insurer performance, monthly trend.

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { AgingSummary, InsurerPerformance, MonthlyTrend, ARClaim } from './ar-types';

// ---- Aging Summary ----
export function useAgingSummary(centreId: string | null) {
  const [data, setData] = useState<AgingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data: rows, error: err } = await sb().rpc('get_ar_aging_summary', { p_centre_id: centreId });
    if (err) { setError(err.message); setData([]); }
    else { setData(rows || []); }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refetch: load };
}

// ---- Insurer Performance ----
export function useInsurerPerformance(centreId: string | null, from: string, to: string) {
  const [data, setData] = useState<InsurerPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data: rows, error: err } = await sb().rpc('get_ar_insurer_performance', {
      p_centre_id: centreId, p_from: from, p_to: to,
    });
    if (err) { setError(err.message); setData([]); }
    else { setData(rows || []); }
    setLoading(false);
  }, [centreId, from, to]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refetch: load };
}

// ---- Monthly Trend ----
export function useMonthlyTrend(centreId: string | null, months = 12) {
  const [data, setData] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data: rows, error: err } = await sb().rpc('get_ar_monthly_trend', {
      p_centre_id: centreId, p_months: months,
    });
    if (err) { setError(err.message); setData([]); }
    else { setData(rows || []); }
    setLoading(false);
  }, [centreId, months]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refetch: load };
}

// ---- Claims list with filters ----
export interface ClaimFilters {
  agingBucket?: string;
  insurerId?: string;
  tpaId?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  hasOpenQuery?: boolean;
  overdueOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortAsc?: boolean;
  page?: number;
  pageSize?: number;
}

export function useARClaims(centreId: string | null, filters: ClaimFilters) {
  const [data, setData] = useState<ARClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    const page = filters.page || 0;
    const size = filters.pageSize || 50;
    const from = page * size;
    const to = from + size - 1;

    let q = sb()
      .from('hmis_claims')
      .select(`
        *,
        patient:hmis_patients!hmis_claims_patient_id_fkey(id, uhid, first_name, last_name, phone_primary),
        insurer:hmis_insurers(id, name),
        tpa:hmis_tpas(id, name),
        bill:hmis_bills(id, bill_number, net_amount, paid_amount, balance_amount),
        assigned_staff:hmis_staff!hmis_claims_assigned_to_fkey(id, full_name)
      `, { count: 'exact' })
      .eq('centre_id', centreId)
      .range(from, to);

    // Apply filters
    if (filters.agingBucket) q = q.eq('aging_bucket', filters.agingBucket);
    if (filters.insurerId) q = q.eq('insurer_id', filters.insurerId);
    if (filters.tpaId) q = q.eq('tpa_id', filters.tpaId);
    if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters.priority && filters.priority !== 'all') q = q.eq('priority', filters.priority);
    if (filters.assignedTo) q = q.eq('assigned_to', filters.assignedTo);
    if (filters.hasOpenQuery) q = q.eq('has_open_query', true);
    if (filters.overdueOnly) q = q.lte('next_followup_date', new Date().toISOString().split('T')[0]);
    if (filters.dateFrom) q = q.gte('submitted_at', filters.dateFrom);
    if (filters.dateTo) q = q.lte('submitted_at', filters.dateTo + 'T23:59:59');

    // Sort
    const sortCol = filters.sortBy || 'days_outstanding';
    q = q.order(sortCol, { ascending: filters.sortAsc ?? false });

    const { data: rows, error: err, count } = await q;
    if (err) { setError(err.message); setData([]); }
    else { setData((rows as ARClaim[]) || []); setTotal(count || 0); }
    setLoading(false);
  }, [centreId, filters]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, total, refetch: load };
}

// ---- Dashboard summary stats (computed from aging data) ----
export function useDashboardStats(centreId: string | null) {
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    totalClaims: 0,
    over60Amount: 0,
    over60Count: 0,
    openQueries: 0,
    avgDaysToSettle: 0,
    settlementRate: 0,
    prevAvgDays: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);

    // Total outstanding from open claims
    const { data: openClaims } = await sb()
      .from('hmis_claims')
      .select('claimed_amount, settled_amount, tds_amount, disallowance_amount, aging_bucket, has_open_query, days_outstanding, status')
      .eq('centre_id', centreId)
      .not('status', 'in', '("settled","written_off","closed","rejected")');

    const all = openClaims || [];
    const totalOutstanding = all.reduce((s, c) => {
      const claimed = parseFloat(c.claimed_amount) || 0;
      const settled = parseFloat(c.settled_amount) || 0;
      const tds = parseFloat(c.tds_amount) || 0;
      const dis = parseFloat(c.disallowance_amount) || 0;
      return s + (claimed - settled - tds - dis);
    }, 0);

    const over60 = all.filter(c => c.aging_bucket === '61-90' || c.aging_bucket === '90+');
    const over60Amount = over60.reduce((s, c) => {
      const claimed = parseFloat(c.claimed_amount) || 0;
      const settled = parseFloat(c.settled_amount) || 0;
      const tds = parseFloat(c.tds_amount) || 0;
      const dis = parseFloat(c.disallowance_amount) || 0;
      return s + (claimed - settled - tds - dis);
    }, 0);

    const openQueries = all.filter(c => c.has_open_query).length;

    // Settled claims this month for settlement rate + avg days
    const monthStart = new Date();
    monthStart.setDate(1);
    const { data: settledThisMonth } = await sb()
      .from('hmis_claims')
      .select('claimed_amount, settled_amount, days_outstanding')
      .eq('centre_id', centreId)
      .eq('status', 'settled')
      .gte('settled_at', monthStart.toISOString());

    const sm = settledThisMonth || [];
    const settledAmt = sm.reduce((s, c) => s + (parseFloat(c.settled_amount) || 0), 0);
    const claimedSettled = sm.reduce((s, c) => s + (parseFloat(c.claimed_amount) || 0), 0);
    const avgDays = sm.length > 0 ? Math.round(sm.reduce((s, c) => s + (c.days_outstanding || 0), 0) / sm.length) : 0;
    const settlementRate = claimedSettled > 0 ? Math.round((settledAmt / claimedSettled) * 100) : 0;

    setStats({
      totalOutstanding,
      totalClaims: all.length,
      over60Amount,
      over60Count: over60.length,
      openQueries,
      avgDaysToSettle: avgDays,
      settlementRate,
      prevAvgDays: 0,
    });
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);
  return { stats, loading, refetch: load };
}
