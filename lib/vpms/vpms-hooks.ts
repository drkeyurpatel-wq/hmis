// lib/vpms/vpms-hooks.ts
// Client-side hook for VPMS data — calls /api/vpms server route
import { useState, useEffect, useCallback } from 'react';

export interface VPMSData {
  configured: boolean;
  vendors: { active: number; pending: number; total: number };
  purchaseOrders: {
    total: number; draft: number; pendingApproval: number; approved: number;
    sentToVendor: number; partiallyReceived: number; totalValue: number;
    thisMonth: number; thisMonthValue: number;
  };
  grns: { pending: number; verified: number; discrepancy: number };
  invoices: { total: number; pending: number; matched: number; mismatch: number; totalValue: number };
  payables: { unpaidTotal: number; unpaidCount: number; overdueTotal: number; overdueCount: number; dueThisWeekTotal: number; dueThisWeekCount: number };
  recentPOs: any[];
}

export function useVPMS(centreCode?: string) {
  const [data, setData] = useState<VPMSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: 'summary' });
      if (centreCode) params.set('centre', centreCode);
      const res = await fetch(`/api/vpms?${params.toString()}`);
      const json = await res.json();
      if (json.error) { setError(json.error); setData(null); }
      else setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch VPMS data');
    }
    setLoading(false);
  }, [centreCode]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}

export function useVPMSOverdue(centreCode?: string) {
  const [overdue, setOverdue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'overdue_payments' });
      if (centreCode) params.set('centre', centreCode);
      const res = await fetch(`/api/vpms?${params.toString()}`);
      const json = await res.json();
      setOverdue(json.overdue || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [centreCode]);

  useEffect(() => { load(); }, [load]);
  return { overdue, loading, refresh: load };
}

export function useVPMSVendorPayables(centreCode?: string) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [totalPayable, setTotalPayable] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'vendor_payables' });
      if (centreCode) params.set('centre', centreCode);
      const res = await fetch(`/api/vpms?${params.toString()}`);
      const json = await res.json();
      setVendors(json.vendors || []);
      setTotalPayable(json.totalPayable || 0);
    } catch { /* silent */ }
    setLoading(false);
  }, [centreCode]);

  useEffect(() => { load(); }, [load]);
  return { vendors, totalPayable, loading, refresh: load };
}
