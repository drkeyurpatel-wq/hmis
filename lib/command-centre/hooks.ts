// lib/command-centre/hooks.ts
// Production-grade multi-centre dashboard data layer
// Strategy: 4 parallel RPC calls (server-side aggregation) with client-side fallback
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// Types
// ============================================================
export interface CentreData {
  centreId: string; centreName: string; centreCode: string;
  // Beds
  totalBeds: number; occupied: number; available: number; maintenance: number;
  icuTotal: number; icuOccupied: number; icuAvailable: number;
  occupancyPct: number; icuOccupancyPct: number;
  // OPD
  opdTotal: number; opdWaiting: number; opdInConsult: number; opdCompleted: number;
  avgWaitMin?: number;
  // IPD
  admissions: number; discharges: number; dischargePending: number;
  // OT
  otScheduled: number; otInProgress: number; otCompleted: number; otCancelled: number; otEmergency: number; otRobotic: number;
  // Revenue
  billsCount: number; grossRevenue: number; netRevenue: number; collected: number; outstanding: number;
  collectionPct: number; insuranceBilled: number;
  // Insurance
  preauthPending: number; claimsPending: number; totalClaimed: number; totalOutstanding: number;
  // Lab
  labPending: number;
}

export interface Alert {
  severity: 'critical' | 'warning' | 'info';
  centre: string;
  centreId: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

// ============================================================
// Main Hook
// ============================================================
export function useCommandCentre() {
  const [centres, setCentres] = useState<CentreData[]>([]);
  const [centreList, setCentreList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const loadingRef = useRef(false);

  // Fetch centres list once
  useEffect(() => {
    if (!sb()) return;
    sb()!.from('hmis_centres').select('id, name, code').eq('is_active', true).order('name')
      .then(({ data }: any) => setCentreList(data || []));
  }, []);

  const load = useCallback(async () => {
    if (!sb() || !centreList.length || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const errs: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Initialize centre map
    const map = new Map<string, CentreData>();
    centreList.forEach(c => {
      map.set(c.id, {
        centreId: c.id, centreName: c.name, centreCode: c.code || c.name?.substring(0, 3).toUpperCase(),
        totalBeds: 0, occupied: 0, available: 0, maintenance: 0,
        icuTotal: 0, icuOccupied: 0, icuAvailable: 0, occupancyPct: 0, icuOccupancyPct: 0,
        opdTotal: 0, opdWaiting: 0, opdInConsult: 0, opdCompleted: 0,
        admissions: 0, discharges: 0, dischargePending: 0,
        otScheduled: 0, otInProgress: 0, otCompleted: 0, otCancelled: 0, otEmergency: 0, otRobotic: 0,
        billsCount: 0, grossRevenue: 0, netRevenue: 0, collected: 0, outstanding: 0,
        collectionPct: 0, insuranceBilled: 0,
        preauthPending: 0, claimsPending: 0, totalClaimed: 0, totalOutstanding: 0,
        labPending: 0,
      });
    });

    // ---- 4 PARALLEL QUERIES ----
    // Try RPCs first, fall back to direct queries
    const [bedResult, opsResult, revResult, insResult] = await Promise.allSettled([
      // 1. Beds — try RPC, fallback to direct
      Promise.resolve(sb()!.rpc('get_bed_census').then(({ data, error }: any) => {
        if (error) throw error;
        return data;
      })).catch(async () => {
        // Fallback: single query, group client-side
        const { data } = await sb()!.from('hmis_beds')
          .select('id, status, room:hmis_rooms!inner(ward:hmis_wards!inner(centre_id, type))');
        return data || [];
      }),

      // 2. Daily ops — try RPC, fallback to 3 parallel direct queries
      Promise.resolve(sb()!.rpc('get_daily_ops_summary', { p_date: today }).then(({ data, error }: any) => {
        if (error) throw error;
        return { type: 'rpc', data };
      })).catch(async () => {
        const [opd, ipd, ot, lab] = await Promise.all([
          sb()!.from('hmis_opd_visits').select('centre_id, status').gte('visit_date', today),
          sb()!.from('hmis_admissions').select('centre_id, status, admission_date, actual_discharge'),
          sb()!.from('hmis_ot_bookings').select('ot_room_id, status, is_emergency, is_robotic, ot_room:hmis_ot_rooms!inner(centre_id)').eq('scheduled_date', today),
          sb()!.from('hmis_lab_orders').select('centre_id, status').gte('created_at', today + 'T00:00:00').in('status', ['ordered', 'collected', 'processing']),
        ]);
        return { type: 'fallback', opd: opd.data || [], ipd: ipd.data || [], ot: ot.data || [], lab: lab.data || [] };
      }),

      // 3. Revenue — try RPC, fallback to direct
      Promise.resolve(sb()!.rpc('get_revenue_summary', { p_date: today }).then(({ data, error }: any) => {
        if (error) throw error;
        return { type: 'rpc', data };
      })).catch(async () => {
        const { data } = await sb()!.from('hmis_bills')
          .select('centre_id, gross_amount, net_amount, paid_amount, balance_amount, discount_amount, payor_type, status')
          .eq('bill_date', today).neq('status', 'cancelled');
        return { type: 'fallback', data: data || [] };
      }),

      // 4. Insurance pipeline — try RPC, fallback to direct
      Promise.resolve(sb()!.rpc('get_insurance_pipeline').then(({ data, error }: any) => {
        if (error) throw error;
        return { type: 'rpc', data };
      })).catch(async () => {
        const { data } = await sb()!.from('hmis_claims')
          .select('centre_id, status, claimed_amount, approved_amount, settled_amount')
          .not('status', 'in', '(cancelled)');
        return { type: 'fallback', data: data || [] };
      }),
    ]);

    // ---- PROCESS BED DATA ----
    if (bedResult.status === 'fulfilled') {
      const bedData = bedResult.value;
      if (Array.isArray(bedData)) {
        // Could be RPC result (grouped) or fallback (raw beds)
        if (bedData[0]?.centre_name) {
          // RPC result
          bedData.forEach((r: any) => {
            const c = map.get(r.centre_id);
            if (!c) return;
            c.totalBeds += Number(r.ward_total) || 0;
            c.occupied += Number(r.ward_occupied) || 0;
            if (r.ward_type === 'icu') {
              c.icuTotal += Number(r.ward_total) || 0;
              c.icuOccupied += Number(r.ward_occupied) || 0;
            }
          });
        } else {
          // Fallback: raw beds
          bedData.forEach((b: any) => {
            const cId = b.room?.ward?.centre_id;
            const c = map.get(cId);
            if (!c) return;
            c.totalBeds++;
            if (b.status === 'occupied') c.occupied++;
            else if (b.status === 'available') c.available++;
            else if (b.status === 'maintenance') c.maintenance++;
            if (b.room?.ward?.type === 'icu') {
              c.icuTotal++;
              if (b.status === 'occupied') c.icuOccupied++;
            }
          });
        }
      }
    } else { errs.push('Bed data failed'); }

    // ---- PROCESS OPS DATA ----
    if (opsResult.status === 'fulfilled') {
      const ops = opsResult.value as any;
      if (ops.type === 'rpc' && ops.data) {
        ops.data.forEach((r: any) => {
          const c = map.get(r.centre_id);
          if (!c) return;
          c.opdTotal = Number(r.opd_total); c.opdWaiting = Number(r.opd_waiting);
          c.opdInConsult = Number(r.opd_in_consult); c.opdCompleted = Number(r.opd_completed);
          c.admissions = Number(r.admissions); c.discharges = Number(r.discharges);
          c.dischargePending = Number(r.discharge_pending);
          c.otScheduled = Number(r.ot_scheduled); c.otInProgress = Number(r.ot_in_progress);
          c.otCompleted = Number(r.ot_completed); c.otCancelled = Number(r.ot_cancelled);
          c.otEmergency = Number(r.ot_emergency); c.otRobotic = Number(r.ot_robotic);
          c.labPending = Number(r.lab_pending);
        });
      } else if (ops.type === 'fallback') {
        // Group OPD by centre
        (ops.opd || []).forEach((v: any) => {
          const c = map.get(v.centre_id); if (!c) return;
          c.opdTotal++;
          if (v.status === 'waiting') c.opdWaiting++;
          else if (v.status === 'in_consultation') c.opdInConsult++;
          else if (v.status === 'completed' || v.status === 'checked_out') c.opdCompleted++;
        });
        // IPD
        const todayStr = today;
        (ops.ipd || []).forEach((a: any) => {
          const c = map.get(a.centre_id); if (!c) return;
          if (a.admission_date?.startsWith(todayStr)) c.admissions++;
          if (a.status === 'discharged' && a.actual_discharge?.startsWith(todayStr)) c.discharges++;
          if (a.status === 'discharge_initiated') c.dischargePending++;
        });
        // OT
        (ops.ot || []).forEach((o: any) => {
          const cId = o.ot_room?.centre_id;
          const c = map.get(cId); if (!c) return;
          c.otScheduled++;
          if (o.status === 'in_progress') c.otInProgress++;
          else if (o.status === 'completed') c.otCompleted++;
          else if (o.status === 'cancelled') c.otCancelled++;
          if (o.is_emergency) c.otEmergency++;
          if (o.is_robotic) c.otRobotic++;
        });
        // Lab
        (ops.lab || []).forEach((l: any) => {
          const c = map.get(l.centre_id); if (!c) return;
          c.labPending++;
        });
      }
    } else { errs.push('Operations data failed'); }

    // ---- PROCESS REVENUE DATA ----
    if (revResult.status === 'fulfilled') {
      const rev = revResult.value as any;
      if (rev.type === 'rpc' && rev.data) {
        rev.data.forEach((r: any) => {
          const c = map.get(r.centre_id); if (!c) return;
          c.billsCount = Number(r.bills_count); c.grossRevenue = Number(r.gross_amount);
          c.netRevenue = Number(r.net_amount); c.collected = Number(r.paid_amount);
          c.outstanding = Number(r.balance_amount); c.insuranceBilled = Number(r.insurance_billed);
          c.collectionPct = Number(r.collection_rate);
        });
      } else if (rev.type === 'fallback') {
        (rev.data || []).forEach((b: any) => {
          const c = map.get(b.centre_id); if (!c) return;
          c.billsCount++;
          c.grossRevenue += parseFloat(b.gross_amount || 0);
          c.netRevenue += parseFloat(b.net_amount || 0);
          c.collected += parseFloat(b.paid_amount || 0);
          c.outstanding += parseFloat(b.balance_amount || 0);
          if (b.payor_type !== 'self') c.insuranceBilled += parseFloat(b.net_amount || 0);
        });
      }
    } else { errs.push('Revenue data failed'); }

    // ---- PROCESS INSURANCE DATA ----
    if (insResult.status === 'fulfilled') {
      const ins = insResult.value as any;
      if (ins.type === 'rpc' && ins.data) {
        ins.data.forEach((r: any) => {
          const c = map.get(r.centre_id); if (!c) return;
          c.preauthPending = Number(r.preauth_pending);
          c.claimsPending = Number(r.claims_pending);
          c.totalClaimed = Number(r.total_claimed);
          c.totalOutstanding = Number(r.total_outstanding);
        });
      } else if (ins.type === 'fallback') {
        (ins.data || []).forEach((cl: any) => {
          const c = map.get(cl.centre_id); if (!c) return;
          if (['preauth_initiated', 'preauth_submitted'].includes(cl.status)) c.preauthPending++;
          if (['claim_submitted', 'query_raised', 'query_responded'].includes(cl.status)) c.claimsPending++;
          c.totalClaimed += parseFloat(cl.claimed_amount || 0);
          c.totalOutstanding += parseFloat(cl.claimed_amount || 0) - parseFloat(cl.settled_amount || 0);
        });
      }
    } else { errs.push('Insurance data failed'); }

    // ---- COMPUTE DERIVED METRICS ----
    map.forEach(c => {
      c.available = c.totalBeds > 0 ? c.totalBeds - c.occupied - c.maintenance : 0;
      c.icuAvailable = c.icuTotal - c.icuOccupied;
      c.occupancyPct = c.totalBeds > 0 ? Math.round((c.occupied / c.totalBeds) * 100) : 0;
      c.icuOccupancyPct = c.icuTotal > 0 ? Math.round((c.icuOccupied / c.icuTotal) * 100) : 0;
      if (c.netRevenue > 0 && c.collectionPct === 0) {
        c.collectionPct = Math.round((c.collected / c.netRevenue) * 100);
      }
    });

    setCentres(Array.from(map.values()));
    setErrors(errs);
    setLoading(false);
    setLastRefresh(new Date());
    loadingRef.current = false;
  }, [centreList]);

  useEffect(() => { if (centreList.length) load(); }, [centreList, load]);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    const interval = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  // ---- GROUP TOTALS ----
  const totals = useMemo(() => centres.reduce((acc, c) => {
    const keys: (keyof CentreData)[] = ['totalBeds','occupied','available','maintenance','icuTotal','icuOccupied',
      'opdTotal','opdWaiting','opdInConsult','opdCompleted','admissions','discharges','dischargePending',
      'otScheduled','otInProgress','otCompleted','otCancelled','otEmergency','otRobotic',
      'billsCount','grossRevenue','netRevenue','collected','outstanding','insuranceBilled',
      'preauthPending','claimsPending','totalClaimed','totalOutstanding','labPending'];
    keys.forEach(k => { (acc as any)[k] = ((acc as any)[k] || 0) + (c[k] as number || 0); });
    return acc;
  }, {
    totalBeds: 0, occupied: 0, available: 0, maintenance: 0, icuTotal: 0, icuOccupied: 0,
    occupancyPct: 0, icuOccupancyPct: 0, icuAvailable: 0,
    opdTotal: 0, opdWaiting: 0, opdInConsult: 0, opdCompleted: 0,
    admissions: 0, discharges: 0, dischargePending: 0,
    otScheduled: 0, otInProgress: 0, otCompleted: 0, otCancelled: 0, otEmergency: 0, otRobotic: 0,
    billsCount: 0, grossRevenue: 0, netRevenue: 0, collected: 0, outstanding: 0,
    collectionPct: 0, insuranceBilled: 0,
    preauthPending: 0, claimsPending: 0, totalClaimed: 0, totalOutstanding: 0,
    labPending: 0, centreName: 'GROUP', centreCode: 'ALL', centreId: '',
  } as CentreData), [centres]);

  // Compute group-level derived metrics
  useMemo(() => {
    totals.occupancyPct = totals.totalBeds > 0 ? Math.round((totals.occupied / totals.totalBeds) * 100) : 0;
    totals.icuOccupancyPct = totals.icuTotal > 0 ? Math.round((totals.icuOccupied / totals.icuTotal) * 100) : 0;
    totals.icuAvailable = totals.icuTotal - totals.icuOccupied;
    totals.collectionPct = totals.netRevenue > 0 ? Math.round((totals.collected / totals.netRevenue) * 100) : 0;
  }, [totals]);

  // ---- ALERTS ----
  const alerts = useMemo(() => {
    const a: Alert[] = [];
    centres.forEach(c => {
      // Critical: ICU full
      if (c.icuTotal > 0 && c.icuOccupied >= c.icuTotal) {
        a.push({ severity: 'critical', centre: c.centreCode, centreId: c.centreId, message: 'ICU FULL — zero beds available', metric: 'icu', value: c.icuOccupied, threshold: c.icuTotal });
      }
      // Critical: OT running past expected
      if (c.otInProgress > 0) {
        a.push({ severity: 'info', centre: c.centreCode, centreId: c.centreId, message: `${c.otInProgress} surgery in progress`, metric: 'ot_live' });
      }
      // Warning: Bed occupancy > 90%
      if (c.totalBeds > 0 && c.occupancyPct > 90) {
        a.push({ severity: 'warning', centre: c.centreCode, centreId: c.centreId, message: `Bed occupancy at ${c.occupancyPct}% — ${c.available} beds left`, metric: 'beds', value: c.occupancyPct, threshold: 90 });
      }
      // Warning: Pending discharges > 3
      if (c.dischargePending > 3) {
        a.push({ severity: 'warning', centre: c.centreCode, centreId: c.centreId, message: `${c.dischargePending} discharges pending — may be blocking admissions`, metric: 'discharge' });
      }
      // Warning: OPD waiting > 15
      if (c.opdWaiting > 15) {
        a.push({ severity: 'warning', centre: c.centreCode, centreId: c.centreId, message: `${c.opdWaiting} patients waiting in OPD`, metric: 'opd_wait' });
      }
      // Warning: Low collection rate
      if (c.netRevenue > 50000 && c.collectionPct < 50) {
        a.push({ severity: 'warning', centre: c.centreCode, centreId: c.centreId, message: `Collection rate only ${c.collectionPct}% — ₹${Math.round(c.outstanding / 100000 * 100) / 100}L outstanding`, metric: 'collection' });
      }
      // Info: Emergency OT
      if (c.otEmergency > 0) {
        a.push({ severity: 'info', centre: c.centreCode, centreId: c.centreId, message: `${c.otEmergency} emergency surger${c.otEmergency > 1 ? 'ies' : 'y'} today`, metric: 'ot_emergency' });
      }
      // Info: Pending labs > 20
      if (c.labPending > 20) {
        a.push({ severity: 'info', centre: c.centreCode, centreId: c.centreId, message: `${c.labPending} lab results pending`, metric: 'lab' });
      }
    });
    // Sort: critical first, then warning, then info
    return a.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [centres]);

  return { centres, totals, loading, errors, lastRefresh, alerts, refresh: load };
}
