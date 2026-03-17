// lib/command-centre/hooks.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// Multi-Centre Stats
// ============================================================
export interface CentreSnapshot {
  centreId: string; centreName: string; centreCode: string;
  // Beds
  totalBeds: number; occupiedBeds: number; availableBeds: number; icuTotal: number; icuOccupied: number;
  // Today ops
  opdToday: number; opdWaiting: number; admissionsToday: number; dischargesToday: number;
  // Revenue
  revenueToday: number; collectedToday: number; outstandingToday: number; billsToday: number;
  // Pending
  pendingDischarges: number; pendingLabs: number; pendingRadiology: number;
  // OT
  otScheduled: number; otCompleted: number; otRunning: number;
  // Insurance
  preAuthPending: number; claimsPending: number;
}

export function useCommandCentre() {
  const [centres, setCentres] = useState<CentreSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Department revenue
  const [deptRevenue, setDeptRevenue] = useState<any[]>([]);
  // Doctor revenue
  const [doctorRevenue, setDoctorRevenue] = useState<any[]>([]);
  // Alerts
  const [alerts, setAlerts] = useState<any[]>([]);
  // AR summary
  const [arSummary, setArSummary] = useState<any>({ total: 0, current: 0, d30: 0, d60: 0, d90: 0, over90: 0 });

  const load = useCallback(async () => {
    if (!sb()) { setLoading(false); return; }
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Get all centres
      const { data: centreList } = await sb().from('hmis_centres').select('id, name, code').eq('is_active', true).order('name');
      if (!centreList?.length) { setLoading(false); return; }

      const snapshots: CentreSnapshot[] = [];

      for (const centre of centreList) {
        // Beds
        const { data: beds } = await sb().from('hmis_beds')
          .select('id, status, room:hmis_rooms!inner(ward:hmis_wards!inner(ward_type))')
          .eq('room.ward.centre_id', centre.id);
        const allBeds = beds || [];
        const occupied = allBeds.filter((b: any) => b.status === 'occupied').length;
        const icuBeds = allBeds.filter((b: any) => b.room?.ward?.ward_type === 'icu');
        const icuOcc = icuBeds.filter((b: any) => b.status === 'occupied').length;

        // OPD today
        const { count: opdCount } = await sb().from('hmis_opd_visits').select('id', { count: 'exact', head: true })
          .eq('centre_id', centre.id).gte('visit_date', today);
        const { count: opdWaiting } = await sb().from('hmis_opd_visits').select('id', { count: 'exact', head: true })
          .eq('centre_id', centre.id).gte('visit_date', today).eq('status', 'waiting');

        // Admissions / Discharges today
        const { count: admToday } = await sb().from('hmis_admissions').select('id', { count: 'exact', head: true })
          .eq('centre_id', centre.id).gte('admission_date', today);
        const { count: disToday } = await sb().from('hmis_admissions').select('id', { count: 'exact', head: true })
          .eq('centre_id', centre.id).eq('status', 'discharged').gte('actual_discharge', today);

        // Revenue today
        const { data: billsData } = await sb().from('hmis_bills')
          .select('net_amount, paid_amount, balance_amount, status')
          .eq('centre_id', centre.id).eq('bill_date', today);
        const todayBills = billsData || [];
        const revToday = todayBills.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0);
        const collToday = todayBills.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || 0), 0);
        const outToday = todayBills.reduce((s: number, b: any) => s + parseFloat(b.balance_amount || 0), 0);

        // Pending discharges
        const { count: pendDis } = await sb().from('hmis_admissions').select('id', { count: 'exact', head: true })
          .eq('centre_id', centre.id).eq('status', 'discharge_initiated');

        // Pending labs
        const { count: pendLabs } = await sb().from('hmis_lab_orders').select('id', { count: 'exact', head: true })
          .eq('centre_id', centre.id).in('status', ['ordered','collected','processing']);

        // OT today
        const { data: otData } = await sb().from('hmis_ot_schedules')
          .select('id, status')
          .eq('centre_id', centre.id).eq('schedule_date', today);
        const otAll = otData || [];

        // Insurance
        const { count: preAuth } = await sb().from('hmis_claims').select('id', { count: 'exact', head: true })
          .eq('centre_id', centre.id).in('status', ['preauth_initiated','preauth_submitted']);
        const { count: claimsPend } = await sb().from('hmis_claims').select('id', { count: 'exact', head: true })
          .eq('centre_id', centre.id).in('status', ['claim_submitted','query_raised']);

        snapshots.push({
          centreId: centre.id, centreName: centre.name, centreCode: centre.code || centre.name?.substring(0, 3).toUpperCase(),
          totalBeds: allBeds.length, occupiedBeds: occupied, availableBeds: allBeds.filter((b: any) => b.status === 'available').length,
          icuTotal: icuBeds.length, icuOccupied: icuOcc,
          opdToday: opdCount || 0, opdWaiting: opdWaiting || 0,
          admissionsToday: admToday || 0, dischargesToday: disToday || 0,
          revenueToday: revToday, collectedToday: collToday, outstandingToday: outToday, billsToday: todayBills.length,
          pendingDischarges: pendDis || 0, pendingLabs: pendLabs || 0, pendingRadiology: 0,
          otScheduled: otAll.length, otCompleted: otAll.filter((o: any) => o.status === 'completed').length, otRunning: otAll.filter((o: any) => o.status === 'in_progress').length,
          preAuthPending: preAuth || 0, claimsPending: claimsPend || 0,
        });
      }

      setCentres(snapshots);

      // Department revenue (all centres, today)
      const { data: deptRev } = await sb().from('hmis_bill_items')
        .select('net_amount, department:hmis_departments(name)')
        .gte('service_date', today);
      const deptMap: Record<string, number> = {};
      (deptRev || []).forEach((i: any) => {
        const dept = i.department?.name || 'Other';
        deptMap[dept] = (deptMap[dept] || 0) + parseFloat(i.net_amount || 0);
      });
      setDeptRevenue(Object.entries(deptMap).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount })));

      // Doctor revenue (all centres, today)
      const { data: docRev } = await sb().from('hmis_bill_items')
        .select('net_amount, doctor:hmis_staff!hmis_bill_items_doctor_id_fkey(full_name)')
        .gte('service_date', today).not('doctor_id', 'is', null);
      const docMap: Record<string, number> = {};
      (docRev || []).forEach((i: any) => {
        const doc = i.doctor?.full_name || 'Unknown';
        docMap[doc] = (docMap[doc] || 0) + parseFloat(i.net_amount || 0);
      });
      setDoctorRevenue(Object.entries(docMap).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount })));

      // AR summary
      const { data: arData } = await sb().from('hmis_ar_entries').select('balance_amount, aging_bucket, status').in('status', ['open','partial']);
      const arSum = { total: 0, current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
      (arData || []).forEach((a: any) => {
        const bal = parseFloat(a.balance_amount || 0);
        arSum.total += bal;
        if (a.aging_bucket === 'current' || a.aging_bucket === '30') arSum.current += bal;
        else if (a.aging_bucket === '60') arSum.d60 += bal;
        else if (a.aging_bucket === '90') arSum.d90 += bal;
        else arSum.over90 += bal;
      });
      setArSummary(arSum);

      // Alerts
      const alertList: any[] = [];
      snapshots.forEach(c => {
        if (c.icuTotal > 0 && c.icuOccupied >= c.icuTotal) alertList.push({ type: 'critical', centre: c.centreCode, message: 'ICU FULL — no beds available' });
        if (c.totalBeds > 0 && c.occupiedBeds / c.totalBeds > 0.9) alertList.push({ type: 'warning', centre: c.centreCode, message: `Bed occupancy ${Math.round(c.occupiedBeds / c.totalBeds * 100)}% — near capacity` });
        if (c.pendingDischarges > 3) alertList.push({ type: 'info', centre: c.centreCode, message: `${c.pendingDischarges} discharges pending` });
        if (c.opdWaiting > 10) alertList.push({ type: 'warning', centre: c.centreCode, message: `${c.opdWaiting} patients waiting in OPD` });
      });
      setAlerts(alertList);

    } catch (err) {
      console.error('[CommandCentre] Load error:', err);
    }

    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  // Aggregate stats
  const totals = centres.reduce((acc, c) => ({
    totalBeds: acc.totalBeds + c.totalBeds, occupiedBeds: acc.occupiedBeds + c.occupiedBeds,
    availableBeds: acc.availableBeds + c.availableBeds, icuTotal: acc.icuTotal + c.icuTotal, icuOccupied: acc.icuOccupied + c.icuOccupied,
    opdToday: acc.opdToday + c.opdToday, opdWaiting: acc.opdWaiting + c.opdWaiting,
    admissionsToday: acc.admissionsToday + c.admissionsToday, dischargesToday: acc.dischargesToday + c.dischargesToday,
    revenueToday: acc.revenueToday + c.revenueToday, collectedToday: acc.collectedToday + c.collectedToday,
    billsToday: acc.billsToday + c.billsToday,
    otScheduled: acc.otScheduled + c.otScheduled, otCompleted: acc.otCompleted + c.otCompleted, otRunning: acc.otRunning + c.otRunning,
    pendingDischarges: acc.pendingDischarges + c.pendingDischarges, pendingLabs: acc.pendingLabs + c.pendingLabs,
    preAuthPending: acc.preAuthPending + c.preAuthPending, claimsPending: acc.claimsPending + c.claimsPending,
  }), { totalBeds: 0, occupiedBeds: 0, availableBeds: 0, icuTotal: 0, icuOccupied: 0, opdToday: 0, opdWaiting: 0, admissionsToday: 0, dischargesToday: 0, revenueToday: 0, collectedToday: 0, billsToday: 0, otScheduled: 0, otCompleted: 0, otRunning: 0, pendingDischarges: 0, pendingLabs: 0, preAuthPending: 0, claimsPending: 0 });

  return { centres, totals, loading, lastRefresh, deptRevenue, doctorRevenue, alerts, arSummary, refresh: load };
}
