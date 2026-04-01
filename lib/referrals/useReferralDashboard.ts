'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { ReferralDashboardData, ReferralTrendPoint, DashboardSummary } from './types';

interface DashboardFilters {
  centreId: string;
  startDate: string;
  endDate: string;
  typeIds?: string[];
}

export function useReferralDashboard(filters: DashboardFilters) {
  const [rows, setRows] = useState<ReferralDashboardData[]>([]);
  const [trend, setTrend] = useState<ReferralTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!filters.centreId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      // Fetch dashboard data via RPC
      const { data: dashData, error: dashErr } = await sb().rpc('get_referral_dashboard', {
        p_centre_id: filters.centreId,
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
      });

      if (!mountedRef.current) return;

      if (dashErr) {
        // Fallback: query directly if RPC not available
        await loadFallback();
        return;
      }

      setRows((dashData || []).map((r: any) => ({
        source_id: r.source_id,
        source_name: r.source_name,
        type_code: r.type_code,
        type_label: r.type_label,
        speciality: r.speciality,
        patient_count: parseInt(r.patient_count || '0'),
        opd_count: parseInt(r.opd_count || '0'),
        ipd_count: parseInt(r.ipd_count || '0'),
        conversion_pct: parseFloat(r.conversion_pct || '0'),
        total_revenue: parseFloat(r.total_revenue || '0'),
        last_referral_date: r.last_referral_date,
        is_dormant: r.is_dormant || false,
        is_new: r.is_new || false,
      })));

      // Fetch trend data
      const { data: trendData } = await sb().rpc('get_referral_trend', {
        p_centre_id: filters.centreId,
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
      });

      if (mountedRef.current) {
        setTrend((trendData || []).map((t: any) => ({
          month: t.month,
          doctor: parseInt(t.doctor || '0'),
          hospital: parseInt(t.hospital || '0'),
          insurance_agent: parseInt(t.insurance_agent || '0'),
          campaign: parseInt(t.campaign || '0'),
          walkin_source: parseInt(t.walkin_source || '0'),
          total: parseInt(t.total || '0'),
        })));
      }
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message || 'Failed to load dashboard');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [filters.centreId, filters.startDate, filters.endDate]);

  // Fallback direct query when RPC is unavailable
  const loadFallback = useCallback(async () => {
    try {
      const { data, error: fbErr } = await sb()
        .from('patient_referrals')
        .select(`
          id, visit_type, bill_amount, collection_amount, created_at,
          source:referral_sources(id, name, speciality, type_id,
            type:referral_source_types(code, label),
            last_referral_date, first_referral_date
          )
        `)
        .eq('centre_id', filters.centreId)
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (fbErr) { setError(fbErr.message); return; }

      // Aggregate by source
      const bySource: Record<string, ReferralDashboardData> = {};
      const now = new Date();
      const dormantCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const newCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      (data || []).forEach((r: any) => {
        const src = r.source;
        if (!src) return;
        const key = src.id;
        if (!bySource[key]) {
          bySource[key] = {
            source_id: src.id,
            source_name: src.name,
            type_code: src.type?.code || '',
            type_label: src.type?.label || '',
            speciality: src.speciality,
            patient_count: 0,
            opd_count: 0,
            ipd_count: 0,
            conversion_pct: 0,
            total_revenue: 0,
            last_referral_date: src.last_referral_date,
            is_dormant: src.last_referral_date ? src.last_referral_date < dormantCutoff : false,
            is_new: src.first_referral_date ? src.first_referral_date >= newCutoff : false,
          };
        }
        bySource[key].patient_count++;
        if (r.visit_type === 'ipd') bySource[key].ipd_count++;
        else bySource[key].opd_count++;
        bySource[key].total_revenue += parseFloat(r.bill_amount || '0');
      });

      // Calculate conversion rates
      Object.values(bySource).forEach(s => {
        s.conversion_pct = s.patient_count > 0
          ? Math.round((s.ipd_count / s.patient_count) * 100)
          : 0;
      });

      setRows(Object.values(bySource).sort((a, b) => b.patient_count - a.patient_count));

      // Build trend from raw data
      const byMonth: Record<string, Record<string, number>> = {};
      (data || []).forEach((r: any) => {
        const month = r.created_at?.substring(0, 7) || '';
        const typeCode = r.source?.type?.code || 'walkin_source';
        if (!byMonth[month]) byMonth[month] = { doctor: 0, hospital: 0, insurance_agent: 0, campaign: 0, walkin_source: 0, total: 0 };
        byMonth[month][typeCode] = (byMonth[month][typeCode] || 0) + 1;
        byMonth[month].total++;
      });

      setTrend(
        Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, counts]) => ({
            month,
            doctor: counts.doctor || 0,
            hospital: counts.hospital || 0,
            insurance_agent: counts.insurance_agent || 0,
            campaign: counts.campaign || 0,
            walkin_source: counts.walkin_source || 0,
            total: counts.total || 0,
          }))
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard data');
    }
  }, [filters.centreId, filters.startDate, filters.endDate]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const summary: DashboardSummary = useMemo(() => {
    const totalReferrals = rows.reduce((s, r) => s + r.patient_count, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.total_revenue, 0);
    const totalIpd = rows.reduce((s, r) => s + r.ipd_count, 0);
    const totalOpd = rows.reduce((s, r) => s + r.opd_count, 0);
    const ipdConversionRate = totalReferrals > 0 ? Math.round((totalIpd / totalReferrals) * 100) : 0;

    // Top source type
    const byType: Record<string, number> = {};
    rows.forEach(r => {
      byType[r.type_label] = (byType[r.type_label] || 0) + r.patient_count;
    });
    const topEntry = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

    return {
      totalReferrals,
      topSourceType: topEntry?.[0] || 'N/A',
      topSourceCount: topEntry?.[1] || 0,
      ipdConversionRate,
      totalRevenue,
      periodChange: 0, // Would need previous period data for comparison
    };
  }, [rows]);

  const dormantSources = useMemo(() => rows.filter(r => r.is_dormant), [rows]);

  // Filtered rows by type
  const filterByType = useCallback((typeIds: string[]) => {
    if (!typeIds.length) return rows;
    return rows.filter(r => typeIds.includes(r.type_code));
  }, [rows]);

  return { rows, trend, summary, dormantSources, loading, error, refetch: load, filterByType };
}
