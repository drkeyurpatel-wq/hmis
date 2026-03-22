'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useReportEngine, type ReportFilters } from '@/lib/reports/report-engine';
import { exportToExcel, type ExcelSheet, type ExcelColumn } from '@/lib/reports/excel-export';
import { exportToPDF } from '@/lib/reports/pdf-export';
import { sb } from '@/lib/supabase/browser';

type ReportType = 'revenue'|'doctors'|'occupancy'|'opd'|'discharge_tat'|'insurance'|'pharmacy'|'lab'|'radiology'|'ar_aging'|'charges'|'centre_comparison';

const REPORT_META: Record<ReportType, { label: string; icon: string; desc: string }> = {
  revenue: { label: 'Revenue MIS', icon: '💰', desc: 'Multi-centre P&L by date, payor, type' },
  doctors: { label: 'Doctor Performance', icon: '👨‍⚕️', desc: 'OPD/IPD volume, surgeries, revenue per doctor' },
  occupancy: { label: 'Bed Occupancy', icon: '🛏️', desc: 'Utilization, ALOS, ARPOB by ward and centre' },
  opd: { label: 'OPD Analytics', icon: '🏥', desc: 'Footfall, wait time, doctor-wise, department-wise' },
  discharge_tat: { label: 'Discharge TAT', icon: '⏱️', desc: 'LOS analysis, discharge type, payor-wise TAT' },
  insurance: { label: 'Insurance Claims', icon: '🛡️', desc: 'Claims pipeline, TAT, disallowance, settlement' },
  pharmacy: { label: 'Pharmacy Stock', icon: '💊', desc: 'Stock value, expiry alerts, category breakdown' },
  lab: { label: 'Lab Volume', icon: '🔬', desc: 'Test volume, pending, by test type' },
  radiology: { label: 'Radiology', icon: '🩻', desc: 'Study volume, TAT, by modality' },
  ar_aging: { label: 'AR Aging', icon: '📊', desc: 'Outstanding receivables, aging buckets, payor-wise' },
  charges: { label: 'Charge Capture', icon: '⚡', desc: 'Auto + manual charges by source, category, date' },
  centre_comparison: { label: 'Centre Comparison', icon: '🏢', desc: '5-centre side-by-side: revenue, OPD, IPD, beds' },
};

const fmt = (n: number) => n >= 10000000 ? '₹' + (n / 10000000).toFixed(2) + ' Cr' : n >= 100000 ? '₹' + (n / 100000).toFixed(2) + ' L' : '₹' + Math.round(n).toLocaleString('en-IN');
const fmtN = (n: number) => Math.round(n).toLocaleString('en-IN');

function ReportsInner() {
  const { activeCentreId } = useAuthStore();
  const engine = useReportEngine();
  const [report, setReport] = useState<ReportType>('revenue');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [centreId, setCentreId] = useState<string>('');
  const [centres, setCentres] = useState<any[]>([]);

  useEffect(() => {
    if (!sb()) return;
    sb().from('hmis_centres').select('id, name, code').eq('is_active', true).order('name')
      .then(({ data }: any) => setCentres(data || []));
  }, []);

  const filters: ReportFilters = { dateFrom, dateTo, centreId: centreId || undefined };

  const runReport = (type: ReportType) => {
    setReport(type);
    const runners: Record<ReportType, (f: ReportFilters) => void> = {
      revenue: engine.runRevenue, doctors: engine.runDoctorPerformance, occupancy: engine.runOccupancy,
      opd: engine.runOPD, discharge_tat: engine.runDischargeTAT, insurance: engine.runInsurance,
      pharmacy: engine.runPharmacy, lab: engine.runLab, radiology: engine.runRadiology,
      ar_aging: engine.runARAging, charges: engine.runCharges, centre_comparison: engine.runCentreComparison,
    };
    runners[type](filters);
  };

  useEffect(() => { runReport('revenue'); }, []);

  const d = engine.data;

  // ---- BUILD SHEETS for export ----
  const buildSheets = (): { sheets: ExcelSheet[]; title: string } => {
    if (!d) return { sheets: [], title: '' };
    const centreLabel = centreId ? centres.find(c => c.id === centreId)?.name || 'Centre' : 'All Centres';
    const period = `${dateFrom} to ${dateTo}`;
    const title = `Health1 — ${REPORT_META[report].label} — ${centreLabel} — ${period}`;
    const sheets: ExcelSheet[] = [];

    if (report === 'revenue') {
      sheets.push({ name: 'Daily', title, columns: [
        { key: 'date', label: 'Date', type: 'date', width: 12 }, { key: 'count', label: 'Bills', type: 'number' },
        { key: 'gross', label: 'Gross (₹)', type: 'currency', width: 14 }, { key: 'net', label: 'Net (₹)', type: 'currency', width: 14 }, { key: 'paid', label: 'Collected (₹)', type: 'currency', width: 14 },
      ], data: d.byDate });
      sheets.push({ name: 'By Centre', title, columns: [
        { key: 'centre', label: 'Centre', width: 25 }, { key: 'count', label: 'Bills', type: 'number' },
        { key: 'gross', label: 'Gross', type: 'currency' }, { key: 'net', label: 'Net', type: 'currency' }, { key: 'paid', label: 'Collected', type: 'currency' }, { key: 'balance', label: 'Outstanding', type: 'currency' },
      ], data: d.byCentre });
      sheets.push({ name: 'By Payor', title, columns: [
        { key: 'payor', label: 'Payor Type', width: 18 }, { key: 'count', label: 'Bills', type: 'number' },
        { key: 'gross', label: 'Gross', type: 'currency' }, { key: 'net', label: 'Net', type: 'currency' }, { key: 'paid', label: 'Collected', type: 'currency' },
      ], data: d.byPayor });
    } else if (report === 'doctors') {
      sheets.push({ name: 'Doctors', title, columns: [
        { key: 'name', label: 'Doctor', width: 25 }, { key: 'department', label: 'Department', width: 20 },
        { key: 'opd', label: 'OPD', type: 'number' }, { key: 'ipd', label: 'IPD', type: 'number' }, { key: 'surgeries', label: 'Surgeries', type: 'number' }, { key: 'revenue', label: 'Revenue (₹)', type: 'currency', width: 14 },
      ], data: d.doctors });
    } else if (report === 'occupancy') {
      sheets.push({ name: 'By Ward', title, columns: [
        { key: 'type', label: 'Ward Type', width: 18 }, { key: 'total', label: 'Total Beds', type: 'number' },
        { key: 'occupied', label: 'Occupied', type: 'number' }, { key: 'pct', label: 'Occupancy %', type: 'number' },
      ], data: d.byWard });
      sheets.push({ name: 'By Centre', title, columns: [
        { key: 'centre', label: 'Centre', width: 25 }, { key: 'total', label: 'Total Beds', type: 'number' },
        { key: 'occupied', label: 'Occupied', type: 'number' }, { key: 'pct', label: 'Occupancy %', type: 'number' },
      ], data: d.byCentre });
    } else if (report === 'opd') {
      sheets.push({ name: 'By Doctor', title, columns: [
        { key: 'name', label: 'Doctor', width: 25 }, { key: 'count', label: 'Visits', type: 'number' },
      ], data: d.byDoctor });
      sheets.push({ name: 'By Department', title, columns: [
        { key: 'name', label: 'Department', width: 25 }, { key: 'count', label: 'Visits', type: 'number' },
      ], data: d.byDept });
    } else if (report === 'discharge_tat') {
      sheets.push({ name: 'Discharges', title, columns: [
        { key: 'ipd', label: 'IPD #', width: 12 }, { key: 'patient', label: 'Patient', width: 20 }, { key: 'uhid', label: 'UHID', width: 12 },
        { key: 'admissionDate', label: 'Admission', type: 'date' }, { key: 'dischargeDate', label: 'Discharge', type: 'date' },
        { key: 'losDays', label: 'LOS (days)', type: 'number' }, { key: 'dischargeType', label: 'Type', width: 12 }, { key: 'payorType', label: 'Payor', width: 12 }, { key: 'centre', label: 'Centre', width: 20 },
      ], data: d.discharges });
    } else if (report === 'insurance') {
      sheets.push({ name: 'Claims', title, columns: [
        { key: 'claimNumber', label: 'Claim #', width: 15 }, { key: 'patient', label: 'Patient', width: 20 }, { key: 'centre', label: 'Centre', width: 20 },
        { key: 'claimType', label: 'Type' }, { key: 'status', label: 'Status' },
        { key: 'claimed', label: 'Claimed (₹)', type: 'currency' }, { key: 'approved', label: 'Approved (₹)', type: 'currency' },
        { key: 'settled', label: 'Settled (₹)', type: 'currency' }, { key: 'disallowance', label: 'Disallowance (₹)', type: 'currency' },
        { key: 'tatDays', label: 'TAT (days)', type: 'number' },
      ], data: d.claims });
    } else if (report === 'ar_aging') {
      sheets.push({ name: 'Outstanding', title, columns: [
        { key: 'billNumber', label: 'Bill #', width: 14 }, { key: 'patient', label: 'Patient', width: 20 }, { key: 'uhid', label: 'UHID' },
        { key: 'centre', label: 'Centre', width: 20 }, { key: 'billDate', label: 'Bill Date', type: 'date' }, { key: 'payor', label: 'Payor' },
        { key: 'net', label: 'Net (₹)', type: 'currency' }, { key: 'paid', label: 'Paid (₹)', type: 'currency' },
        { key: 'balance', label: 'Balance (₹)', type: 'currency' }, { key: 'ageDays', label: 'Age (days)', type: 'number' }, { key: 'bucket', label: 'Bucket' },
      ], data: d.outstanding });
    } else if (report === 'centre_comparison') {
      sheets.push({ name: 'Centres', title, columns: [
        { key: 'centre', label: 'Centre', width: 25 }, { key: 'code', label: 'Code' },
        { key: 'revenue', label: 'Revenue (₹)', type: 'currency', width: 14 }, { key: 'collected', label: 'Collected (₹)', type: 'currency', width: 14 },
        { key: 'outstanding', label: 'Outstanding (₹)', type: 'currency', width: 14 },
        { key: 'opd', label: 'OPD', type: 'number' }, { key: 'ipd', label: 'IPD', type: 'number' },
        { key: 'totalBeds', label: 'Beds', type: 'number' }, { key: 'occupiedBeds', label: 'Occupied', type: 'number' }, { key: 'occupancy', label: 'Occ %', type: 'number' },
      ], data: d.centres });
    }

    return { sheets, title };
  };

  const exportReport = () => {
    const { sheets } = buildSheets();
    if (sheets.length > 0) exportToExcel(sheets, `Health1_${report}_${dateFrom}_${dateTo}`);
  };

  const exportPDFReport = () => {
    const { sheets, title } = buildSheets();
    if (sheets.length > 0) exportToPDF(sheets, title);
  };

  // Render helpers
  const Table = ({ cols, rows, max = 50 }: { cols: { key: string; label: string; fmt?: (v: any) => string; align?: string }[]; rows: any[]; max?: number }) => (
    <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
      {cols.map(c => <th key={c.key} className={`p-2 font-medium text-gray-500 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}>{c.label}</th>)}
    </tr></thead><tbody>{rows.slice(0, max).map((r, i) => (
      <tr key={i} className="border-b hover:bg-gray-50">{cols.map(c => <td key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>{c.fmt ? c.fmt(r[c.key]) : r[c.key]}</td>)}</tr>
    ))}</tbody></table>{rows.length > max && <div className="text-center text-[10px] text-gray-400 py-2">Showing {max} of {rows.length}</div>}</div>
  );

  const KPI = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) => (
    <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500 uppercase">{label}</div><div className={`text-xl font-bold ${color || ''}`}>{value}</div>{sub && <div className="text-[10px] text-gray-400">{sub}</div>}</div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Reports &amp; MIS</h1><p className="text-xs text-gray-500">Health1 Super Speciality — Multi-centre Analytics</p></div>
        <div className="flex gap-2">
          <button onClick={exportPDFReport} disabled={!d} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg disabled:opacity-40">Export PDF</button>
          <button onClick={exportReport} disabled={!d} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-40">Export to Excel</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap bg-white rounded-xl border p-3">
        {[['Today', () => { const t = new Date().toISOString().split('T')[0]; setDateFrom(t); setDateTo(t); }],
          ['This Week', () => { const n = new Date(); const m = new Date(n); m.setDate(n.getDate() - n.getDay() + 1); setDateFrom(m.toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]); }],
          ['This Month', () => { const n = new Date(); setDateFrom(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]); }],
          ['Last Month', () => { const n = new Date(); setDateFrom(new Date(n.getFullYear(), n.getMonth()-1, 1).toISOString().split('T')[0]); setDateTo(new Date(n.getFullYear(), n.getMonth(), 0).toISOString().split('T')[0]); }],
          ['This FY', () => { const n = new Date(); const fy = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear()-1; setDateFrom(`${fy}-04-01`); setDateTo(n.toISOString().split('T')[0]); }],
        ].map(([label, fn]) => (
          <button key={label as string} onClick={() => { (fn as Function)(); }} className="px-2 py-1 text-[10px] bg-gray-100 rounded hover:bg-blue-100">{label as string}</button>
        ))}
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-1 border rounded text-xs" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-1 border rounded text-xs" />
        <select value={centreId} onChange={e => setCentreId(e.target.value)} className="px-2 py-1 border rounded text-xs">
          <option value="">All Centres</option>
          {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => runReport(report)} className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg ml-auto">Run Report</button>
      </div>

      {/* Report selector */}
      <div className="grid grid-cols-6 gap-1.5">
        {(Object.entries(REPORT_META) as [ReportType, any][]).map(([key, meta]) => (
          <button key={key} onClick={() => runReport(key)}
            className={`p-2 rounded-xl border text-left transition-all ${report === key ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white hover:bg-gray-50'}`}>
            <div className="text-base">{meta.icon}</div>
            <div className="text-[10px] font-semibold mt-0.5">{meta.label}</div>
          </button>
        ))}
      </div>

      {/* Report content */}
      {engine.loading ? <div className="text-center py-12 text-gray-400 animate-pulse">Running {REPORT_META[report].label}...</div> :
      !d ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select a report and click Run</div> : <>

        {/* ===== REVENUE ===== */}
        {report === 'revenue' && d.totals && <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            <KPI label="Bills" value={fmtN(d.totals.count)} /><KPI label="Gross" value={fmt(d.totals.gross)} color="text-blue-700" />
            <KPI label="Net Revenue" value={fmt(d.totals.net)} color="text-green-700" /><KPI label="Collected" value={fmt(d.totals.paid)} color="text-green-700" />
            <KPI label="Outstanding" value={fmt(d.totals.balance)} color="text-red-700" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Centre</h3>
              <Table cols={[{ key: 'centre', label: 'Centre' }, { key: 'count', label: 'Bills', align: 'center' }, { key: 'net', label: 'Net Revenue', align: 'right', fmt: fmt }, { key: 'paid', label: 'Collected', align: 'right', fmt: fmt }, { key: 'balance', label: 'Outstanding', align: 'right', fmt: fmt }]} rows={d.byCentre} /></div>
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Payor</h3>
              <Table cols={[{ key: 'payor', label: 'Payor' }, { key: 'count', label: 'Bills', align: 'center' }, { key: 'net', label: 'Net', align: 'right', fmt: fmt }, { key: 'paid', label: 'Collected', align: 'right', fmt: fmt }]} rows={d.byPayor} /></div>
          </div>
          <h3 className="text-xs font-bold text-gray-500">Daily Trend</h3>
          <Table cols={[{ key: 'date', label: 'Date' }, { key: 'count', label: 'Bills', align: 'center' }, { key: 'gross', label: 'Gross', align: 'right', fmt: fmt }, { key: 'net', label: 'Net', align: 'right', fmt: fmt }, { key: 'paid', label: 'Collected', align: 'right', fmt: fmt }]} rows={d.byDate} max={31} />
        </div>}

        {/* ===== DOCTORS ===== */}
        {report === 'doctors' && d.doctors && <div className="space-y-4">
          <KPI label="Doctors" value={d.totalDoctors} />
          <Table cols={[{ key: 'name', label: 'Doctor' }, { key: 'department', label: 'Department' }, { key: 'opd', label: 'OPD', align: 'center' }, { key: 'ipd', label: 'IPD', align: 'center' }, { key: 'surgeries', label: 'Surgeries', align: 'center' }, { key: 'revenue', label: 'Revenue', align: 'right', fmt: fmt }]} rows={d.doctors} max={100} />
        </div>}

        {/* ===== OCCUPANCY ===== */}
        {report === 'occupancy' && <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            <KPI label="Total Beds" value={d.totalBeds} /><KPI label="Occupied" value={d.occupied} color="text-blue-700" />
            <KPI label="Available" value={d.available} color="text-green-700" />
            <KPI label="Occupancy" value={d.totalBeds > 0 ? Math.round(d.occupied / d.totalBeds * 100) + '%' : '0%'} color="text-blue-700" />
            <KPI label="Avg LOS" value={d.alos + 'd'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Ward Type</h3>
              <Table cols={[{ key: 'type', label: 'Ward' }, { key: 'total', label: 'Beds', align: 'center' }, { key: 'occupied', label: 'Occ', align: 'center' }, { key: 'pct', label: '%', align: 'center', fmt: (v: number) => v + '%' }]} rows={d.byWard} /></div>
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Centre</h3>
              <Table cols={[{ key: 'centre', label: 'Centre' }, { key: 'total', label: 'Beds', align: 'center' }, { key: 'occupied', label: 'Occ', align: 'center' }, { key: 'pct', label: '%', align: 'center', fmt: (v: number) => v + '%' }]} rows={d.byCentre} /></div>
          </div>
        </div>}

        {/* ===== OPD ===== */}
        {report === 'opd' && <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <KPI label="Total Visits" value={fmtN(d.total)} color="text-blue-700" /><KPI label="Completed" value={fmtN(d.completed)} color="text-green-700" />
            <KPI label="Avg Wait" value={d.avgWaitMin + ' min'} color={d.avgWaitMin > 30 ? 'text-red-700' : 'text-green-700'} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Doctor</h3><Table cols={[{ key: 'name', label: 'Doctor' }, { key: 'count', label: 'Visits', align: 'right' }]} rows={d.byDoctor} max={20} /></div>
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Department</h3><Table cols={[{ key: 'name', label: 'Department' }, { key: 'count', label: 'Visits', align: 'right' }]} rows={d.byDept} max={15} /></div>
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Centre</h3><Table cols={[{ key: 'name', label: 'Centre' }, { key: 'count', label: 'Visits', align: 'right' }]} rows={d.byCentre} /></div>
          </div>
        </div>}

        {/* ===== DISCHARGE TAT ===== */}
        {report === 'discharge_tat' && d.discharges && <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <KPI label="Discharges" value={d.total} /><KPI label="Avg LOS" value={d.avgLOS + 'd'} /><KPI label="Median LOS" value={d.medianLOS + 'd'} />
          </div>
          <Table cols={[{ key: 'ipd', label: 'IPD #' }, { key: 'patient', label: 'Patient' }, { key: 'uhid', label: 'UHID' }, { key: 'admissionDate', label: 'Admitted' }, { key: 'dischargeDate', label: 'Discharged' }, { key: 'losDays', label: 'LOS', align: 'center' }, { key: 'dischargeType', label: 'Type' }, { key: 'payorType', label: 'Payor' }, { key: 'centre', label: 'Centre' }]} rows={d.discharges} max={100} />
        </div>}

        {/* ===== INSURANCE ===== */}
        {report === 'insurance' && d.claims && <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            <KPI label="Claims" value={d.total} /><KPI label="Claimed" value={fmt(d.totalClaimed)} color="text-blue-700" />
            <KPI label="Settled" value={fmt(d.totalSettled)} color="text-green-700" /><KPI label="Disallowance" value={fmt(d.totalDisallowance)} color="text-red-700" />
            <KPI label="Avg TAT" value={d.avgTAT + 'd'} color={d.avgTAT > 30 ? 'text-red-700' : 'text-green-700'} />
          </div>
          <Table cols={[{ key: 'claimNumber', label: 'Claim #' }, { key: 'patient', label: 'Patient' }, { key: 'centre', label: 'Centre' }, { key: 'status', label: 'Status' }, { key: 'claimed', label: 'Claimed', align: 'right', fmt: fmt }, { key: 'settled', label: 'Settled', align: 'right', fmt: fmt }, { key: 'disallowance', label: 'Disallowance', align: 'right', fmt: fmt }, { key: 'tatDays', label: 'TAT', align: 'center' }]} rows={d.claims} max={100} />
        </div>}

        {/* ===== PHARMACY ===== */}
        {report === 'pharmacy' && <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <KPI label="Total Items" value={fmtN(d.totalItems)} /><KPI label="Stock Value" value={fmt(d.totalStockValue)} color="text-blue-700" />
            <KPI label="Expiring 30d" value={d.expiring30} color={d.expiring30 > 0 ? 'text-amber-700' : 'text-green-700'} />
            <KPI label="Expired" value={d.expiredCount} sub={fmt(d.expiredValue)} color={d.expiredCount > 0 ? 'text-red-700' : 'text-green-700'} />
          </div>
        </div>}

        {/* ===== LAB ===== */}
        {report === 'lab' && <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <KPI label="Total Orders" value={fmtN(d.total)} /><KPI label="Pending" value={d.pending} color="text-amber-700" />
            <KPI label="Completed" value={d.completed} color="text-green-700" />
          </div>
          <Table cols={[{ key: 'name', label: 'Test' }, { key: 'count', label: 'Orders', align: 'right' }]} rows={d.byTest} max={30} />
        </div>}

        {/* ===== RADIOLOGY ===== */}
        {report === 'radiology' && <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <KPI label="Total Studies" value={fmtN(d.total)} /><KPI label="Reported" value={d.reported} color="text-green-700" />
            <KPI label="STAT" value={d.stat} color={d.stat > 0 ? 'text-red-700' : ''} />
            <KPI label="Avg TAT" value={d.avgTAT > 0 ? (d.avgTAT >= 60 ? Math.floor(d.avgTAT/60) + 'h' : d.avgTAT + 'm') : '—'} />
          </div>
          <Table cols={[{ key: 'modality', label: 'Modality' }, { key: 'count', label: 'Studies', align: 'right' }]} rows={d.byModality} />
        </div>}

        {/* ===== AR AGING ===== */}
        {report === 'ar_aging' && d.outstanding && <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            <KPI label="Total Outstanding" value={fmt(d.total)} color="text-red-700" /><KPI label="0-30 days" value={fmt(d.buckets['0-30'])} color="text-green-700" />
            <KPI label="31-60 days" value={fmt(d.buckets['31-60'])} color="text-amber-700" /><KPI label="61-90 days" value={fmt(d.buckets['61-90'])} color="text-orange-700" />
            <KPI label="90+ days" value={fmt(d.buckets['90+'])} color="text-red-700" />
          </div>
          <Table cols={[{ key: 'billNumber', label: 'Bill #' }, { key: 'patient', label: 'Patient' }, { key: 'centre', label: 'Centre' }, { key: 'payor', label: 'Payor' }, { key: 'net', label: 'Net', align: 'right', fmt: fmt }, { key: 'paid', label: 'Paid', align: 'right', fmt: fmt }, { key: 'balance', label: 'Balance', align: 'right', fmt: fmt }, { key: 'ageDays', label: 'Age', align: 'center' }, { key: 'bucket', label: 'Bucket', align: 'center' }]} rows={d.outstanding} max={100} />
        </div>}

        {/* ===== CHARGES ===== */}
        {report === 'charges' && <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <KPI label="Total Charges" value={fmt(d.total)} color="text-blue-700" /><KPI label="Count" value={fmtN(d.count)} />
            <KPI label="Captured" value={fmtN(d.captured)} color="text-amber-700" /><KPI label="Posted" value={fmtN(d.posted)} color="text-green-700" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Source</h3><Table cols={[{ key: 'source', label: 'Source' }, { key: 'amount', label: 'Amount', align: 'right', fmt: fmt }]} rows={d.bySource} /></div>
            <div><h3 className="text-xs font-bold text-gray-500 mb-2">By Category</h3><Table cols={[{ key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', align: 'right', fmt: fmt }]} rows={d.byCategory} /></div>
          </div>
        </div>}

        {/* ===== CENTRE COMPARISON ===== */}
        {report === 'centre_comparison' && d.centres && <div className="space-y-4">
          <Table cols={[
            { key: 'centre', label: 'Centre' }, { key: 'code', label: 'Code', align: 'center' },
            { key: 'revenue', label: 'Revenue', align: 'right', fmt: fmt }, { key: 'collected', label: 'Collected', align: 'right', fmt: fmt }, { key: 'outstanding', label: 'Outstanding', align: 'right', fmt: fmt },
            { key: 'opd', label: 'OPD', align: 'center' }, { key: 'ipd', label: 'IPD', align: 'center' },
            { key: 'totalBeds', label: 'Beds', align: 'center' }, { key: 'occupiedBeds', label: 'Occ', align: 'center' }, { key: 'occupancy', label: 'Occ %', align: 'center', fmt: (v: number) => v + '%' },
          ]} rows={d.centres} />
        </div>}

      </>}
    </div>
  );
}

export default function ReportsPage() { return <RoleGuard module="mis"><ReportsInner /></RoleGuard>; }
