// lib/reports/report-engine.ts
import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// Helper: conditionally add centre_id filter
function cq(query: any, centreId?: string, col: string = 'centre_id') {
  return centreId ? query.eq(col, centreId) : query;
}

export interface ReportFilters {
  dateFrom: string; dateTo: string;
  centreId?: string; // null = all centres
  departmentId?: string; doctorId?: string;
}

// ============================================================
// MASTER REPORT HOOK — runs any report type
// ============================================================
export function useReportEngine() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- 1. Revenue Summary (multi-centre) ----
  const runRevenue = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: bills } = await sb().from('hmis_bills')
      .select('id, bill_number, bill_date, bill_type, payor_type, gross_amount, discount_amount, net_amount, paid_amount, balance_amount, status, centre_id, centre:hmis_centres(name, code)')
      .gte('bill_date', f.dateFrom).lte('bill_date', f.dateTo)
      
      .neq('status', 'cancelled').order('bill_date');

    const rows = bills || [];
    const byDate = new Map<string, any>();
    const byCentre = new Map<string, any>();
    const byPayor = new Map<string, any>();
    const byType = new Map<string, any>();
    let totals = { gross: 0, discount: 0, net: 0, paid: 0, balance: 0, count: 0 };

    rows.forEach((b: any) => {
      const g = parseFloat(b.gross_amount); const d = parseFloat(b.discount_amount);
      const n = parseFloat(b.net_amount); const p = parseFloat(b.paid_amount); const bal = parseFloat(b.balance_amount);
      totals.gross += g; totals.discount += d; totals.net += n; totals.paid += p; totals.balance += bal; totals.count++;

      // By date
      const dt = b.bill_date;
      if (!byDate.has(dt)) byDate.set(dt, { date: dt, gross: 0, net: 0, paid: 0, count: 0 });
      const dd = byDate.get(dt)!; dd.gross += g; dd.net += n; dd.paid += p; dd.count++;

      // By centre
      const cn = b.centre?.name || 'Unknown';
      if (!byCentre.has(cn)) byCentre.set(cn, { centre: cn, code: b.centre?.code, gross: 0, net: 0, paid: 0, balance: 0, count: 0 });
      const cc = byCentre.get(cn)!; cc.gross += g; cc.net += n; cc.paid += p; cc.balance += bal; cc.count++;

      // By payor
      if (!byPayor.has(b.payor_type)) byPayor.set(b.payor_type, { payor: b.payor_type, gross: 0, net: 0, paid: 0, count: 0 });
      const pp = byPayor.get(b.payor_type)!; pp.gross += g; pp.net += n; pp.paid += p; pp.count++;

      // By type
      if (!byType.has(b.bill_type)) byType.set(b.bill_type, { type: b.bill_type, gross: 0, net: 0, paid: 0, count: 0 });
      const tt = byType.get(b.bill_type)!; tt.gross += g; tt.net += n; tt.paid += p; tt.count++;
    });

    setData({
      totals, bills: rows,
      byDate: Array.from(byDate.values()), byCentre: Array.from(byCentre.values()),
      byPayor: Array.from(byPayor.values()), byType: Array.from(byType.values()),
    });
    setLoading(false);
  }, []);

  // ---- 2. Doctor Performance ----
  const runDoctorPerformance = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    // OPD visits by doctor
    const { data: opd } = await sb().from('hmis_opd_visits')
      .select('doctor_id, doctor:hmis_staff!inner(full_name, department:hmis_departments(name))')
      .gte('created_at', f.dateFrom + 'T00:00:00').lte('created_at', f.dateTo + 'T23:59:59')
      ;

    // Admissions by doctor
    const { data: adm } = await sb().from('hmis_admissions')
      .select('primary_doctor_id, primary_doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
      .gte('admission_date', f.dateFrom + 'T00:00:00').lte('admission_date', f.dateTo + 'T23:59:59')
      ;

    // Surgeries by surgeon
    const { data: surg } = await sb().from('hmis_ot_bookings')
      .select('surgeon_id, surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name), status')
      .gte('scheduled_date', f.dateFrom).lte('scheduled_date', f.dateTo)
      .neq('status', 'cancelled');

    // Bill items by doctor (revenue)
    const { data: rev } = await sb().from('hmis_bill_items')
      .select('doctor_id, net_amount, doctor:hmis_staff!hmis_bill_items_doctor_id_fkey(full_name)')
      .gte('service_date', f.dateFrom).lte('service_date', f.dateTo)
      .not('doctor_id', 'is', null);

    const docMap = new Map<string, any>();
    const ensure = (id: string, name: string, dept?: string) => {
      if (!docMap.has(id)) docMap.set(id, { doctorId: id, name, department: dept || '', opd: 0, ipd: 0, surgeries: 0, revenue: 0 });
      return docMap.get(id)!;
    };

    (opd || []).forEach((v: any) => ensure(v.doctor_id, v.doctor?.full_name, v.doctor?.department?.name).opd++);
    (adm || []).forEach((a: any) => ensure(a.primary_doctor_id, a.primary_doctor?.full_name).ipd++);
    (surg || []).forEach((s: any) => { if (s.status === 'completed') ensure(s.surgeon_id, s.surgeon?.full_name).surgeries++; });
    (rev || []).forEach((r: any) => ensure(r.doctor_id, r.doctor?.full_name).revenue += parseFloat(r.net_amount || 0));

    const doctors = Array.from(docMap.values()).sort((a, b) => b.revenue - a.revenue);
    setData({ doctors, totalDoctors: doctors.length });
    setLoading(false);
  }, []);

  // ---- 3. Bed Occupancy ----
  const runOccupancy = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: admissions } = await sb().from('hmis_admissions')
      .select('id, admission_date, actual_discharge, status, bed:hmis_beds(room:hmis_rooms(ward:hmis_wards(name, type))), centre:hmis_centres(name, code)')
      .gte('admission_date', f.dateFrom + 'T00:00:00')
      ;

    const { data: beds } = await sb().from('hmis_beds')
      .select('id, status, room:hmis_rooms!inner(ward:hmis_wards!inner(name, type, centre_id, centre:hmis_centres(name)))')
      .eq('is_active', true);

    // Calculate ALOS
    const discharged = (admissions || []).filter((a: any) => a.actual_discharge);
    const totalLOS = discharged.reduce((s: number, a: any) => {
      const los = Math.max(1, Math.ceil((new Date(a.actual_discharge).getTime() - new Date(a.admission_date).getTime()) / 86400000));
      return s + los;
    }, 0);
    const alos = discharged.length > 0 ? (totalLOS / discharged.length).toFixed(1) : '0';

    // By ward type
    const wardMap = new Map<string, { total: number; occupied: number }>();
    (beds || []).forEach((b: any) => {
      const wt = b.room?.ward?.type || 'unknown';
      if (!wardMap.has(wt)) wardMap.set(wt, { total: 0, occupied: 0 });
      const w = wardMap.get(wt)!; w.total++;
      if (b.status === 'occupied') w.occupied++;
    });

    // By centre
    const centreMap = new Map<string, { total: number; occupied: number }>();
    (beds || []).forEach((b: any) => {
      const cn = b.room?.ward?.centre?.name || 'Unknown';
      if (!centreMap.has(cn)) centreMap.set(cn, { total: 0, occupied: 0 });
      const c = centreMap.get(cn)!; c.total++;
      if (b.status === 'occupied') c.occupied++;
    });

    setData({
      totalBeds: (beds || []).length,
      occupied: (beds || []).filter((b: any) => b.status === 'occupied').length,
      available: (beds || []).filter((b: any) => b.status === 'available').length,
      alos, totalAdmissions: (admissions || []).length, totalDischarges: discharged.length,
      byWard: Array.from(wardMap.entries()).map(([type, d]) => ({ type, ...d, pct: d.total > 0 ? Math.round(d.occupied / d.total * 100) : 0 })),
      byCentre: Array.from(centreMap.entries()).map(([centre, d]) => ({ centre, ...d, pct: d.total > 0 ? Math.round(d.occupied / d.total * 100) : 0 })),
    });
    setLoading(false);
  }, []);

  // ---- 4. OPD Analytics ----
  const runOPD = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: visits } = await sb().from('hmis_opd_visits')
      .select('id, status, check_in_time, consultation_start, consultation_end, created_at, doctor:hmis_staff!inner(full_name, department:hmis_departments(name)), centre:hmis_centres(name)')
      .gte('created_at', f.dateFrom + 'T00:00:00').lte('created_at', f.dateTo + 'T23:59:59')
      ;

    const rows = visits || [];
    const byDoctor = new Map<string, number>();
    const byDept = new Map<string, number>();
    const byCentre = new Map<string, number>();
    const byDate = new Map<string, number>();
    let totalWait = 0; let waitCount = 0;

    rows.forEach((v: any) => {
      const doc = v.doctor?.full_name || 'Unknown';
      byDoctor.set(doc, (byDoctor.get(doc) || 0) + 1);
      const dept = v.doctor?.department?.name || 'Unknown';
      byDept.set(dept, (byDept.get(dept) || 0) + 1);
      const cn = v.centre?.name || 'Unknown';
      byCentre.set(cn, (byCentre.get(cn) || 0) + 1);
      const dt = v.created_at?.split('T')[0] || '';
      byDate.set(dt, (byDate.get(dt) || 0) + 1);

      if (v.check_in_time && v.consultation_start) {
        const wait = (new Date(v.consultation_start).getTime() - new Date(v.check_in_time).getTime()) / 60000;
        if (wait > 0 && wait < 300) { totalWait += wait; waitCount++; }
      }
    });

    setData({
      total: rows.length, completed: rows.filter((v: any) => v.status === 'completed').length,
      avgWaitMin: waitCount > 0 ? Math.round(totalWait / waitCount) : 0,
      byDoctor: Array.from(byDoctor.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      byDept: Array.from(byDept.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      byCentre: Array.from(byCentre.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      byDate: Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count })),
    });
    setLoading(false);
  }, []);

  // ---- 5. Discharge TAT ----
  const runDischargeTAT = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: admissions } = await sb().from('hmis_admissions')
      .select('id, ipd_number, admission_date, actual_discharge, status, discharge_type, payor_type, patient:hmis_patients!inner(first_name, last_name, uhid), centre:hmis_centres(name)')
      .in('status', ['discharged', 'discharge_initiated'])
      .gte('actual_discharge', f.dateFrom + 'T00:00:00').lte('actual_discharge', f.dateTo + 'T23:59:59')
      ;

    const rows = (admissions || []).map((a: any) => {
      const admDt = new Date(a.admission_date);
      const disDt = a.actual_discharge ? new Date(a.actual_discharge) : null;
      const losHours = disDt ? Math.round((disDt.getTime() - admDt.getTime()) / 3600000) : null;
      return {
        ipd: a.ipd_number, patient: `${a.patient.first_name} ${a.patient.last_name}`, uhid: a.patient.uhid,
        admissionDate: a.admission_date?.split('T')[0], dischargeDate: a.actual_discharge?.split('T')[0],
        losHours, losDays: losHours ? Math.ceil(losHours / 24) : null,
        dischargeType: a.discharge_type, payorType: a.payor_type, centre: a.centre?.name,
      };
    });

    const losValues = rows.filter((r: any) => r.losHours).map((r: any) => r.losHours);
    const sorted = [...losValues].sort((a, b) => a - b);

    setData({
      discharges: rows,
      total: rows.length,
      avgLOS: losValues.length > 0 ? (losValues.reduce((s: number, v: number) => s + v, 0) / losValues.length / 24).toFixed(1) : '0',
      medianLOS: sorted.length > 0 ? (sorted[Math.floor(sorted.length / 2)] / 24).toFixed(1) : '0',
      byPayor: rows.reduce((acc: Record<string, number[]>, r: any) => {
        if (!acc[r.payorType]) acc[r.payorType] = [];
        if (r.losHours) acc[r.payorType].push(r.losHours);
        return acc;
      }, {}),
    });
    setLoading(false);
  }, []);

  // ---- 6. Insurance / Claims ----
  const runInsurance = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: claims } = await sb().from('hmis_claims')
      .select('id, claim_number, claim_type, claimed_amount, approved_amount, settled_amount, tds_amount, disallowance_amount, status, submitted_at, settled_at, bill:hmis_bills!inner(bill_number, patient:hmis_patients!inner(first_name, last_name, uhid), centre:hmis_centres(name))')
      .gte('submitted_at', f.dateFrom + 'T00:00:00').lte('submitted_at', f.dateTo + 'T23:59:59');

    const rows = (claims || []).map((c: any) => ({
      claimNumber: c.claim_number, billNumber: c.bill?.bill_number,
      patient: `${c.bill?.patient?.first_name} ${c.bill?.patient?.last_name}`, uhid: c.bill?.patient?.uhid,
      centre: c.bill?.centre?.name, claimType: c.claim_type, status: c.status,
      claimed: parseFloat(c.claimed_amount || 0), approved: parseFloat(c.approved_amount || 0),
      settled: parseFloat(c.settled_amount || 0), tds: parseFloat(c.tds_amount || 0),
      disallowance: parseFloat(c.disallowance_amount || 0),
      submittedAt: c.submitted_at?.split('T')[0], settledAt: c.settled_at?.split('T')[0],
      tatDays: c.settled_at && c.submitted_at ? Math.ceil((new Date(c.settled_at).getTime() - new Date(c.submitted_at).getTime()) / 86400000) : null,
    }));

    const settled = rows.filter((r: any) => r.tatDays);
    setData({
      claims: rows, total: rows.length,
      totalClaimed: rows.reduce((s: number, r: any) => s + r.claimed, 0),
      totalSettled: rows.reduce((s: number, r: any) => s + r.settled, 0),
      totalDisallowance: rows.reduce((s: number, r: any) => s + r.disallowance, 0),
      avgTAT: settled.length > 0 ? Math.round(settled.reduce((s: number, r: any) => s + r.tatDays, 0) / settled.length) : 0,
      byStatus: rows.reduce((acc: Record<string, number>, r: any) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
    });
    setLoading(false);
  }, []);

  // ---- 7. Pharmacy ----
  const runPharmacy = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: stock } = await sb().from('hmis_pharmacy_stock')
      .select('drug_id, quantity, cost_price, mrp, expiry_date, batch_number, drug:hmis_drug_master(drug_name, generic_name, category)')
      
      .gt('quantity', 0);

    const rows = (stock || []).map((s: any) => ({
      drug: s.drug?.drug_name, generic: s.drug?.generic_name, category: s.drug?.category,
      batch: s.batch_number, qty: parseFloat(s.quantity),
      cost: parseFloat(s.cost_price || 0), mrp: parseFloat(s.mrp || 0),
      stockValue: parseFloat(s.quantity) * parseFloat(s.cost_price || 0),
      expiry: s.expiry_date,
      expiresIn: s.expiry_date ? Math.ceil((new Date(s.expiry_date).getTime() - Date.now()) / 86400000) : null,
    }));

    const expiring30 = rows.filter((r: any) => r.expiresIn !== null && r.expiresIn <= 30 && r.expiresIn > 0);
    const expired = rows.filter((r: any) => r.expiresIn !== null && r.expiresIn <= 0);

    setData({
      stock: rows, totalItems: rows.length,
      totalStockValue: rows.reduce((s: number, r: any) => s + r.stockValue, 0),
      expiring30: expiring30.length, expiredCount: expired.length,
      expiredValue: expired.reduce((s: any, r: any) => s + r.stockValue, 0),
      byCategory: rows.reduce((acc: Record<string, number>, r: any) => { acc[r.category || 'Other'] = (acc[r.category || 'Other'] || 0) + r.stockValue; return acc; }, {}),
    });
    setLoading(false);
  }, []);

  // ---- 8. Lab Volume ----
  const runLab = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: orders } = await sb().from('hmis_lab_orders')
      .select('id, status, created_at, updated_at, test:hmis_lab_test_master(test_name, department)')
      .gte('created_at', f.dateFrom + 'T00:00:00').lte('created_at', f.dateTo + 'T23:59:59')
      ;

    const rows = orders || [];
    const byTest = new Map<string, number>();
    const byStatus = new Map<string, number>();
    rows.forEach((o: any) => {
      byTest.set(o.test?.test_name || 'Unknown', (byTest.get(o.test?.test_name || 'Unknown') || 0) + 1);
      byStatus.set(o.status, (byStatus.get(o.status) || 0) + 1);
    });

    setData({
      total: rows.length, pending: rows.filter((o: any) => ['ordered', 'sample_collected', 'processing'].includes(o.status)).length,
      completed: rows.filter((o: any) => o.status === 'completed').length,
      byTest: Array.from(byTest.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      byStatus: Object.fromEntries(byStatus),
    });
    setLoading(false);
  }, []);

  // ---- 9. Radiology Volume ----
  const runRadiology = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: orders } = await sb().from('hmis_radiology_orders')
      .select('id, modality, status, urgency, tat_minutes, created_at, test:hmis_radiology_test_master(test_name)')
      .gte('created_at', f.dateFrom + 'T00:00:00').lte('created_at', f.dateTo + 'T23:59:59')
      ;

    const rows = orders || [];
    const byModality = new Map<string, number>();
    const tatValues: number[] = [];
    rows.forEach((o: any) => {
      byModality.set(o.modality || 'Other', (byModality.get(o.modality || 'Other') || 0) + 1);
      if (o.tat_minutes) tatValues.push(o.tat_minutes);
    });

    setData({
      total: rows.length, reported: rows.filter((o: any) => ['reported', 'verified'].includes(o.status)).length,
      stat: rows.filter((o: any) => o.urgency === 'stat').length,
      avgTAT: tatValues.length > 0 ? Math.round(tatValues.reduce((s: any, v: any) => s + v, 0) / tatValues.length) : 0,
      byModality: Array.from(byModality.entries()).sort((a, b) => b[1] - a[1]).map(([mod, count]) => ({ modality: mod, count })),
    });
    setLoading(false);
  }, []);

  // ---- 10. AR Aging ----
  const runARAging = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: bills } = await sb().from('hmis_bills')
      .select('id, bill_number, bill_date, payor_type, net_amount, paid_amount, balance_amount, status, patient:hmis_patients!inner(first_name, last_name, uhid), centre:hmis_centres(name)')
      .gt('balance_amount', 0).neq('status', 'cancelled')
      ;

    const now = Date.now();
    const rows = (bills || []).map((b: any) => {
      const age = Math.ceil((now - new Date(b.bill_date).getTime()) / 86400000);
      const bucket = age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+';
      return {
        billNumber: b.bill_number, patient: `${b.patient.first_name} ${b.patient.last_name}`,
        uhid: b.patient.uhid, centre: b.centre?.name, billDate: b.bill_date,
        payor: b.payor_type, net: parseFloat(b.net_amount), paid: parseFloat(b.paid_amount),
        balance: parseFloat(b.balance_amount), ageDays: age, bucket,
      };
    });

    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    rows.forEach((r: any) => { buckets[r.bucket as keyof typeof buckets] += r.balance; });

    setData({
      outstanding: rows, total: rows.reduce((s: number, r: any) => s + r.balance, 0),
      count: rows.length, buckets,
      byPayor: rows.reduce((acc: Record<string, number>, r: any) => { acc[r.payor] = (acc[r.payor] || 0) + r.balance; return acc; }, {}),
    });
    setLoading(false);
  }, []);

  // ---- 11. Charge Capture Summary ----
  const runCharges = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: charges } = await sb().from('hmis_charge_log')
      .select('id, description, category, source, amount, status, service_date')
      .gte('service_date', f.dateFrom).lte('service_date', f.dateTo)
      
      .neq('status', 'reversed');

    const rows = charges || [];
    const bySource = new Map<string, number>();
    const byCat = new Map<string, number>();
    const byDate = new Map<string, number>();
    rows.forEach((c: any) => {
      const amt = parseFloat(c.amount);
      bySource.set(c.source, (bySource.get(c.source) || 0) + amt);
      byCat.set(c.category, (byCat.get(c.category) || 0) + amt);
      byDate.set(c.service_date, (byDate.get(c.service_date) || 0) + amt);
    });

    setData({
      total: rows.reduce((s: number, c: any) => s + parseFloat(c.amount), 0), count: rows.length,
      captured: rows.filter((c: any) => c.status === 'captured').length,
      posted: rows.filter((c: any) => c.status === 'posted').length,
      bySource: Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).map(([source, amount]) => ({ source, amount })),
      byCategory: Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount })),
      byDate: Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, amount]) => ({ date, amount })),
    });
    setLoading(false);
  }, []);

  // ---- 12. Centre Comparison (the GT audit report) ----
  const runCentreComparison = useCallback(async (f: ReportFilters) => {
    if (!sb()) return;
    setLoading(true); setError(null);

    const { data: centres } = await sb().from('hmis_centres').select('id, name, code').eq('is_active', true);

    const results: any[] = [];
    for (const c of (centres || [])) {
      const { data: bills } = await sb().from('hmis_bills')
        .select('net_amount, paid_amount, balance_amount').eq('centre_id', c.id)
        .gte('bill_date', f.dateFrom).lte('bill_date', f.dateTo).neq('status', 'cancelled');

      const { count: opdCount } = await sb().from('hmis_opd_visits').select('id', { count: 'exact', head: true })
        .eq('centre_id', c.id).gte('created_at', f.dateFrom + 'T00:00:00').lte('created_at', f.dateTo + 'T23:59:59');

      const { count: ipdCount } = await sb().from('hmis_admissions').select('id', { count: 'exact', head: true })
        .eq('centre_id', c.id).gte('admission_date', f.dateFrom + 'T00:00:00').lte('admission_date', f.dateTo + 'T23:59:59');

      const { data: beds } = await sb().from('hmis_beds')
        .select('id, status, room:hmis_rooms!inner(ward:hmis_wards!inner(centre_id))')
        .eq('room.ward.centre_id', c.id).eq('is_active', true);

      const bRows = bills || [];
      const bAll = beds || [];
      results.push({
        centre: c.name, code: c.code,
        revenue: bRows.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0),
        collected: bRows.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || 0), 0),
        outstanding: bRows.reduce((s: number, b: any) => s + parseFloat(b.balance_amount || 0), 0),
        bills: bRows.length, opd: opdCount || 0, ipd: ipdCount || 0,
        totalBeds: bAll.length, occupiedBeds: bAll.filter((b: any) => b.status === 'occupied').length,
        occupancy: bAll.length > 0 ? Math.round(bAll.filter((b: any) => b.status === 'occupied').length / bAll.length * 100) : 0,
      });
    }

    setData({ centres: results });
    setLoading(false);
  }, []);

  return {
    loading, data, error,
    runRevenue, runDoctorPerformance, runOccupancy, runOPD,
    runDischargeTAT, runInsurance, runPharmacy, runLab,
    runRadiology, runARAging, runCharges, runCentreComparison,
  };
}
