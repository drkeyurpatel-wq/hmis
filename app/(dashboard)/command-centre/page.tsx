'use client';
import React, { useState } from 'react';
import { useCommandCentre, type CentreData, type Alert } from '@/lib/command-centre/hooks';

// ============================================================
// FORMATTERS — Indian number system, zero-safe
// ============================================================
function rupees(n: number): string {
  if (n === 0) return '₹0';
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const styles = {
    critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: '●', iconColor: 'text-red-600' },
    warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: '●', iconColor: 'text-amber-500' },
    info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: '●', iconColor: 'text-blue-500' },
  };
  return (
    <div className="space-y-1">{alerts.slice(0, 8).map((a, i) => {
      const s = styles[a.severity];
      return (
        <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${s.bg} ${s.text}`}>
          <span className={`text-[10px] ${s.iconColor}`}>{s.icon}</span>
          <span className="font-semibold min-w-[40px]">{a.centre}</span>
          <span>{a.message}</span>
        </div>
      );
    })}
    {alerts.length > 8 && <div className="text-xs text-gray-400 text-center">+ {alerts.length - 8} more alerts</div>}
    </div>
  );
}

function MetricCard({ label, value, sub, color, bgColor }: { label: string; value: string | number; sub?: string; color: string; bgColor?: string }) {
  return (
    <div className={`rounded-xl border p-2.5 text-center ${bgColor || 'bg-white'}`}>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider leading-tight">{label}</div>
      <div className={`text-lg font-bold leading-tight mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 leading-tight">{sub}</div>}
    </div>
  );
}

function OccupancyBar({ label, used, total, showLabel }: { label?: string; used: number; total: number; showLabel?: boolean }) {
  const p = pct(used, total);
  const barColor = p >= 95 ? 'bg-red-500' : p >= 80 ? 'bg-amber-500' : p >= 60 ? 'bg-blue-500' : 'bg-green-500';
  const textColor = p >= 95 ? 'text-red-700' : p >= 80 ? 'text-amber-700' : 'text-gray-700';
  return (
    <div className="flex items-center gap-1.5">
      {showLabel && label && <span className="text-[10px] text-gray-500 w-8 text-right">{label}</span>}
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <span className={`text-[10px] font-semibold w-20 text-right ${textColor}`}>{used}/{total} ({p}%)</span>
    </div>
  );
}

function CentreCard({ centre, isSelected, onClick }: { centre: CentreData; isSelected: boolean; onClick: () => void }) {
  const hasLiveSurgery = centre.otInProgress > 0;
  const borderColor = isSelected ? 'border-blue-500 ring-2 ring-blue-200' : hasLiveSurgery ? 'border-red-300' : 'border-gray-200 hover:border-blue-300';

  return (
    <div onClick={onClick} className={`bg-white rounded-xl border ${borderColor} p-3 cursor-pointer transition-all`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-sm">{centre.centreCode}</div>
        <div className="flex items-center gap-1">
          {hasLiveSurgery && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Surgery in progress" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            centre.occupancyPct >= 90 ? 'bg-red-100 text-red-700' : centre.occupancyPct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }`}>{centre.occupancyPct}%</span>
        </div>
      </div>

      {/* Bed bars */}
      <div className="space-y-1 mb-2">
        <OccupancyBar label="Beds" used={centre.occupied} total={centre.totalBeds} showLabel />
        {centre.icuTotal > 0 && <OccupancyBar label="ICU" used={centre.icuOccupied} total={centre.icuTotal} showLabel />}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        <div className="flex justify-between"><span className="text-gray-500">OPD</span><span className="font-semibold">{centre.opdTotal}{centre.opdWaiting > 0 && <span className="text-amber-600 ml-0.5">({centre.opdWaiting}w)</span>}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="font-semibold text-green-700">{rupees(centre.netRevenue)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Adm/Dis</span><span><span className="font-semibold text-green-600">{centre.admissions}</span><span className="text-gray-300">/</span><span className="font-semibold text-orange-600">{centre.discharges}</span></span></div>
        <div className="flex justify-between"><span className="text-gray-500">Collected</span><span className="font-semibold text-blue-700">{rupees(centre.collected)}{centre.collectionPct > 0 && <span className="text-gray-400 ml-0.5">({centre.collectionPct}%)</span>}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">OT</span><span className="font-semibold">{centre.otCompleted}/{centre.otScheduled}{centre.otInProgress > 0 && <span className="text-red-600 ml-0.5">({centre.otInProgress} live)</span>}</span></div>
        {(centre.preauthPending + centre.claimsPending) > 0 && <div className="flex justify-between"><span className="text-gray-500">Insurance</span><span><span className="text-amber-600 font-semibold">{centre.preauthPending}PA</span>{centre.claimsPending > 0 && <span className="text-red-600 font-semibold ml-0.5">{centre.claimsPending}CL</span>}</span></div>}
      </div>

      {/* Flags */}
      {(centre.dischargePending > 0 || centre.labPending > 5 || centre.otEmergency > 0 || centre.otRobotic > 0) && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {centre.dischargePending > 0 && <span className="text-[9px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">{centre.dischargePending} dis pending</span>}
          {centre.labPending > 5 && <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{centre.labPending} labs</span>}
          {centre.otEmergency > 0 && <span className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{centre.otEmergency} emergency</span>}
          {centre.otRobotic > 0 && <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{centre.otRobotic} robotic</span>}
        </div>
      )}
    </div>
  );
}

function CentreDetailPanel({ centre }: { centre: CentreData }) {
  return (
    <div className="bg-white rounded-xl border p-5 mt-3">
      <h2 className="font-bold mb-3">{centre.centreName}</h2>
      <div className="grid grid-cols-4 gap-4">
        {/* Beds */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Beds</h3>
          <div className="text-3xl font-bold">{centre.occupancyPct}<span className="text-lg text-gray-400">%</span></div>
          <OccupancyBar used={centre.occupied} total={centre.totalBeds} />
          <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
            <div><div className="font-bold text-green-700">{centre.available}</div><div className="text-gray-400">Available</div></div>
            <div><div className="font-bold">{centre.occupied}</div><div className="text-gray-400">Occupied</div></div>
            <div><div className="font-bold text-gray-500">{centre.maintenance}</div><div className="text-gray-400">Maint.</div></div>
          </div>
          {centre.icuTotal > 0 && <div className="bg-red-50 rounded-lg p-2">
            <div className="text-[10px] text-red-600 font-medium">ICU</div>
            <OccupancyBar used={centre.icuOccupied} total={centre.icuTotal} />
            <div className="text-[10px] text-red-700 mt-0.5">{centre.icuAvailable} ICU bed{centre.icuAvailable !== 1 ? 's' : ''} available</div>
          </div>}
        </div>

        {/* Operations */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Operations Today</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between bg-blue-50 rounded-lg px-3 py-2"><span>OPD Visits</span><span className="font-bold text-blue-700">{centre.opdTotal}</span></div>
            {centre.opdWaiting > 0 && <div className="flex justify-between bg-amber-50 rounded-lg px-3 py-2"><span>Waiting Now</span><span className="font-bold text-amber-700">{centre.opdWaiting}</span></div>}
            {centre.opdInConsult > 0 && <div className="flex justify-between bg-green-50 rounded-lg px-3 py-2"><span>In Consultation</span><span className="font-bold text-green-700">{centre.opdInConsult}</span></div>}
            <div className="flex justify-between bg-green-50 rounded-lg px-3 py-2"><span>Admissions</span><span className="font-bold text-green-700">{centre.admissions}</span></div>
            <div className="flex justify-between bg-orange-50 rounded-lg px-3 py-2"><span>Discharges</span><span className="font-bold text-orange-700">{centre.discharges}</span></div>
            {centre.dischargePending > 0 && <div className="flex justify-between bg-red-50 rounded-lg px-3 py-2"><span>Discharge Pending</span><span className="font-bold text-red-700">{centre.dischargePending}</span></div>}
          </div>
        </div>

        {/* Revenue */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Revenue Today</h3>
          <div className="text-2xl font-bold text-green-700">{rupees(centre.netRevenue)}</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Gross billed</span><span>{rupees(centre.grossRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Collected</span><span className="text-blue-700 font-semibold">{rupees(centre.collected)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className="text-red-700 font-semibold">{rupees(centre.outstanding)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Collection rate</span><span className={`font-semibold ${centre.collectionPct >= 80 ? 'text-green-700' : centre.collectionPct >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{centre.collectionPct}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bills</span><span>{centre.billsCount}</span></div>
            {centre.insuranceBilled > 0 && <div className="flex justify-between"><span className="text-gray-500">Insurance</span><span className="text-blue-600">{rupees(centre.insuranceBilled)}</span></div>}
          </div>
        </div>

        {/* OT + Insurance */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">OT &amp; Insurance</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between bg-purple-50 rounded-lg px-3 py-2"><span>OT Scheduled</span><span className="font-bold">{centre.otScheduled}</span></div>
            {centre.otInProgress > 0 && <div className="flex justify-between bg-red-50 rounded-lg px-3 py-2 animate-pulse"><span>In Progress</span><span className="font-bold text-red-700">{centre.otInProgress}</span></div>}
            <div className="flex justify-between bg-green-50 rounded-lg px-3 py-2"><span>Completed</span><span className="font-bold text-green-700">{centre.otCompleted}</span></div>
            {centre.otRobotic > 0 && <div className="flex justify-between bg-purple-50 rounded-lg px-3 py-2"><span>Robotic</span><span className="font-bold text-purple-700">{centre.otRobotic}</span></div>}
          </div>
          {(centre.preauthPending > 0 || centre.claimsPending > 0) && <div className="bg-amber-50 rounded-lg p-2 space-y-1">
            <div className="text-[10px] font-medium text-amber-700">Insurance Pipeline</div>
            {centre.preauthPending > 0 && <div className="flex justify-between text-xs"><span>Pre-auth pending</span><span className="font-bold text-amber-700">{centre.preauthPending}</span></div>}
            {centre.claimsPending > 0 && <div className="flex justify-between text-xs"><span>Claims pending</span><span className="font-bold text-red-700">{centre.claimsPending}</span></div>}
            {centre.totalOutstanding > 0 && <div className="flex justify-between text-xs"><span>Outstanding</span><span className="font-bold text-red-700">{rupees(centre.totalOutstanding)}</span></div>}
          </div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function CommandCentrePage() {
  const { centres, totals, loading, errors, lastRefresh, alerts, refresh } = useCommandCentre();
  const [selectedCentreId, setSelectedCentreId] = useState<string | null>(null);
  const selectedCentre = centres.find(c => c.centreId === selectedCentreId);

  if (loading && centres.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-8 gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
          <div className="grid grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-48 bg-gray-200 rounded-xl" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Health1 Command Centre</h1>
          <p className="text-[10px] text-gray-400">{centres.length} centres | Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} | Auto-refresh 3m</p>
        </div>
        <div className="flex items-center gap-2">
          {errors.length > 0 && <span className="text-[10px] text-red-500">{errors.length} error{errors.length > 1 ? 's' : ''}</span>}
          {loading && <span className="text-[10px] text-blue-500 animate-pulse">Refreshing...</span>}
          <button onClick={refresh} disabled={loading} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50">Refresh</button>
        </div>
      </div>

      {/* Alerts */}
      <AlertBanner alerts={alerts} />

      {/* Group KPIs */}
      <div className="grid grid-cols-10 gap-1.5">
        <MetricCard label="Beds" value={`${totals.occupied}/${totals.totalBeds}`} sub={`${totals.occupancyPct}% occ`}
          color={totals.occupancyPct > 85 ? 'text-red-700' : 'text-green-700'} />
        <MetricCard label="ICU" value={`${totals.icuOccupied}/${totals.icuTotal}`} sub={`${totals.icuAvailable} free`}
          color={totals.icuAvailable <= 2 ? 'text-red-700' : 'text-blue-700'} />
        <MetricCard label="OPD" value={totals.opdTotal} sub={`${totals.opdWaiting} waiting`} color="text-blue-700" />
        <MetricCard label="Admissions" value={totals.admissions} sub="today" color="text-green-700" />
        <MetricCard label="Discharges" value={totals.discharges} sub={totals.dischargePending > 0 ? `${totals.dischargePending} pending` : 'today'} color="text-orange-700" />
        <MetricCard label="Revenue" value={rupees(totals.netRevenue)} sub="today" color="text-green-700" />
        <MetricCard label="Collected" value={rupees(totals.collected)} sub={`${totals.collectionPct}%`}
          color={totals.collectionPct >= 80 ? 'text-blue-700' : 'text-amber-700'} />
        <MetricCard label="OT" value={`${totals.otCompleted}/${totals.otScheduled}`}
          sub={totals.otInProgress > 0 ? `${totals.otInProgress} live` : 'done/scheduled'} color="text-purple-700" />
        <MetricCard label="Pre-Auth" value={totals.preauthPending} sub="pending"
          color={totals.preauthPending > 5 ? 'text-red-700' : 'text-amber-700'} />
        <MetricCard label="Claims" value={totals.claimsPending} sub="pending"
          color={totals.claimsPending > 5 ? 'text-red-700' : 'text-amber-700'} />
      </div>

      {/* Centre Cards */}
      {centres.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border"><div className="text-gray-400 text-sm">No centres found. Add centres in Settings.</div></div>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {centres.map(c => (
            <CentreCard key={c.centreId} centre={c} isSelected={selectedCentreId === c.centreId}
              onClick={() => setSelectedCentreId(selectedCentreId === c.centreId ? null : c.centreId)} />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedCentre && <CentreDetailPanel centre={selectedCentre} />}

      {/* Comparison table */}
      {centres.length > 1 && <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b text-gray-500">
            <th className="p-2 text-left font-medium">Centre</th>
            <th className="p-2 text-center font-medium">Beds</th>
            <th className="p-2 text-center font-medium">ICU</th>
            <th className="p-2 text-center font-medium">OPD</th>
            <th className="p-2 text-center font-medium">Adm</th>
            <th className="p-2 text-center font-medium">Dis</th>
            <th className="p-2 text-right font-medium">Revenue</th>
            <th className="p-2 text-right font-medium">Collected</th>
            <th className="p-2 text-center font-medium">Coll%</th>
            <th className="p-2 text-center font-medium">OT</th>
            <th className="p-2 text-center font-medium">Pend</th>
          </tr></thead>
          <tbody>
            {centres.map(c => (
              <tr key={c.centreId} className={`border-b hover:bg-blue-50 cursor-pointer ${selectedCentreId === c.centreId ? 'bg-blue-50' : ''}`}
                onClick={() => setSelectedCentreId(selectedCentreId === c.centreId ? null : c.centreId)}>
                <td className="p-2 font-semibold">{c.centreName}</td>
                <td className="p-2 text-center">
                  <span className={`font-semibold ${c.occupancyPct > 90 ? 'text-red-700' : c.occupancyPct > 70 ? 'text-amber-700' : 'text-green-700'}`}>
                    {c.occupied}/{c.totalBeds}
                  </span>
                </td>
                <td className="p-2 text-center">
                  {c.icuTotal > 0 ? <span className={c.icuOccupied >= c.icuTotal ? 'text-red-700 font-bold' : ''}>{c.icuOccupied}/{c.icuTotal}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="p-2 text-center">{c.opdTotal}{c.opdWaiting > 0 && <span className="text-amber-600 text-[10px]"> ({c.opdWaiting}w)</span>}</td>
                <td className="p-2 text-center text-green-700 font-semibold">{c.admissions}</td>
                <td className="p-2 text-center text-orange-700">{c.discharges}</td>
                <td className="p-2 text-right font-semibold text-green-700">{rupees(c.netRevenue)}</td>
                <td className="p-2 text-right text-blue-700">{rupees(c.collected)}</td>
                <td className="p-2 text-center">
                  <span className={`font-semibold ${c.collectionPct >= 80 ? 'text-green-700' : c.collectionPct >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{c.collectionPct}%</span>
                </td>
                <td className="p-2 text-center">
                  {c.otCompleted}/{c.otScheduled}
                  {c.otInProgress > 0 && <span className="text-red-600 ml-0.5 font-bold">({c.otInProgress})</span>}
                </td>
                <td className="p-2 text-center">
                  {(c.dischargePending + c.preauthPending + c.claimsPending) > 0
                    ? <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">{c.dischargePending + c.preauthPending + c.claimsPending}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
            {/* Group total */}
            <tr className="bg-blue-50 font-bold border-t-2 border-blue-300">
              <td className="p-2">GROUP</td>
              <td className="p-2 text-center">{totals.occupied}/{totals.totalBeds}</td>
              <td className="p-2 text-center">{totals.icuOccupied}/{totals.icuTotal}</td>
              <td className="p-2 text-center">{totals.opdTotal}</td>
              <td className="p-2 text-center text-green-700">{totals.admissions}</td>
              <td className="p-2 text-center text-orange-700">{totals.discharges}</td>
              <td className="p-2 text-right text-green-700">{rupees(totals.netRevenue)}</td>
              <td className="p-2 text-right text-blue-700">{rupees(totals.collected)}</td>
              <td className="p-2 text-center">{totals.collectionPct}%</td>
              <td className="p-2 text-center">{totals.otCompleted}/{totals.otScheduled}</td>
              <td className="p-2 text-center">{totals.dischargePending + totals.preauthPending + totals.claimsPending}</td>
            </tr>
          </tbody>
        </table>
      </div>}
    </div>
  );
}
