'use client';
import React, { useState } from 'react';
import { useCommandCentre } from '@/lib/command-centre/hooks';

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtL = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return fmt(n);
};
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

function OccupancyBar({ occupied, total, label, color }: { occupied: number; total: number; label: string; color: string }) {
  const p = pct(occupied, total);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-gray-500 text-right">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2.5">
        <div className={`h-full rounded-full ${p > 90 ? 'bg-red-500' : p > 70 ? 'bg-yellow-500' : color}`} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <span className={`w-16 text-right font-bold ${p > 90 ? 'text-red-600' : ''}`}>{occupied}/{total} ({p}%)</span>
    </div>
  );
}

export default function CommandCentrePage() {
  const { centres, totals, loading, lastRefresh, deptRevenue, doctorRevenue, alerts, arSummary, refresh } = useCommandCentre();
  const [selectedCentre, setSelectedCentre] = useState<string | null>(null);

  const alertColor = (t: string) => t === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : t === 'warning' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-blue-100 text-blue-700 border-blue-200';
  const alertIcon = (t: string) => t === 'critical' ? '🔴' : t === 'warning' ? '🟡' : '🔵';

  if (loading) return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-5 gap-3">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Health1 Command Centre</h1>
          <p className="text-xs text-gray-400">Multi-centre real-time operations dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400">Last refresh: {lastRefresh.toLocaleTimeString('en-IN')}</span>
          <button onClick={refresh} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Refresh</button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && <div className="space-y-1">
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${alertColor(a.type)}`}>
            <span>{alertIcon(a.type)}</span>
            <span className="font-bold">{a.centre}</span>
            <span>{a.message}</span>
          </div>
        ))}
      </div>}

      {/* GROUP TOTALS — Top strip */}
      <div className="grid grid-cols-10 gap-2">
        {[
          ['Total Beds', `${totals.occupiedBeds}/${totals.totalBeds}`, `${pct(totals.occupiedBeds, totals.totalBeds)}%`, totals.occupiedBeds / totals.totalBeds > 0.85 ? 'text-red-700' : 'text-green-700'],
          ['ICU', `${totals.icuOccupied}/${totals.icuTotal}`, `${pct(totals.icuOccupied, totals.icuTotal)}%`, totals.icuOccupied >= totals.icuTotal ? 'text-red-700' : 'text-blue-700'],
          ['OPD Today', `${fmt(totals.opdToday)}`, `${totals.opdWaiting} waiting`, 'text-blue-700'],
          ['Admissions', `${fmt(totals.admissionsToday)}`, 'today', 'text-green-700'],
          ['Discharges', `${fmt(totals.dischargesToday)}`, 'today', 'text-orange-700'],
          ['Revenue', `₹${fmtL(totals.revenueToday)}`, 'today', 'text-green-700'],
          ['Collected', `₹${fmtL(totals.collectedToday)}`, `${pct(totals.collectedToday, totals.revenueToday)}%`, 'text-blue-700'],
          ['OT', `${totals.otCompleted}/${totals.otScheduled}`, `${totals.otRunning} live`, 'text-purple-700'],
          ['Pre-Auth', `${totals.preAuthPending}`, 'pending', 'text-yellow-700'],
          ['Claims', `${totals.claimsPending}`, 'pending', 'text-red-700'],
        ].map(([label, value, sub, color], i) => (
          <div key={i} className="bg-white rounded-xl border p-2 text-center">
            <div className="text-[9px] text-gray-500 uppercase tracking-wide">{label as string}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-gray-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* CENTRE CARDS */}
      <div className="grid grid-cols-5 gap-3">
        {centres.map(c => {
          const bedPct = pct(c.occupiedBeds, c.totalBeds);
          const isSelected = selectedCentre === c.centreId;
          return (
            <div key={c.centreId} onClick={() => setSelectedCentre(isSelected ? null : c.centreId)}
              className={`bg-white rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-blue-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm">{c.centreCode}</div>
                <div className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${bedPct > 90 ? 'bg-red-100 text-red-700' : bedPct > 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{bedPct}%</div>
              </div>

              {/* Mini bed bar */}
              <OccupancyBar occupied={c.occupiedBeds} total={c.totalBeds} label="Beds" color="bg-blue-500" />
              {c.icuTotal > 0 && <OccupancyBar occupied={c.icuOccupied} total={c.icuTotal} label="ICU" color="bg-red-400" />}

              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 text-[10px]">
                <div className="text-gray-500">OPD</div><div className="text-right font-bold">{c.opdToday} <span className="text-gray-400">({c.opdWaiting} wait)</span></div>
                <div className="text-gray-500">Adm/Dis</div><div className="text-right font-bold text-green-600">{c.admissionsToday}<span className="text-gray-300">/</span><span className="text-orange-600">{c.dischargesToday}</span></div>
                <div className="text-gray-500">Revenue</div><div className="text-right font-bold text-green-700">₹{fmtL(c.revenueToday)}</div>
                <div className="text-gray-500">Collected</div><div className="text-right font-bold text-blue-600">₹{fmtL(c.collectedToday)}</div>
                <div className="text-gray-500">OT</div><div className="text-right font-bold">{c.otCompleted}/{c.otScheduled} {c.otRunning > 0 && <span className="text-red-500">({c.otRunning} live)</span>}</div>
                {(c.preAuthPending > 0 || c.claimsPending > 0) && <>
                  <div className="text-gray-500">Insurance</div><div className="text-right"><span className="text-yellow-600 font-bold">{c.preAuthPending}PA</span> <span className="text-red-600 font-bold">{c.claimsPending}CL</span></div>
                </>}
              </div>

              {c.pendingDischarges > 0 && <div className="mt-1.5 px-2 py-0.5 bg-orange-50 rounded text-[10px] text-orange-700 text-center font-medium">{c.pendingDischarges} discharge{c.pendingDischarges > 1 ? 's' : ''} pending</div>}
              {c.pendingLabs > 0 && <div className="mt-0.5 px-2 py-0.5 bg-purple-50 rounded text-[10px] text-purple-700 text-center">{c.pendingLabs} lab results pending</div>}
            </div>
          );
        })}
        {centres.length === 0 && <div className="col-span-5 text-center py-8 bg-white rounded-xl border text-gray-400">No centres configured</div>}
      </div>

      {/* SELECTED CENTRE DETAIL */}
      {selectedCentre && (() => {
        const c = centres.find(x => x.centreId === selectedCentre);
        if (!c) return null;
        return (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-bold text-sm mb-3">{c.centreName} — Detailed View</h2>
            <div className="grid grid-cols-6 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-blue-600">Bed Occupancy</div>
                <div className="text-2xl font-bold text-blue-700">{pct(c.occupiedBeds, c.totalBeds)}%</div>
                <div className="text-xs text-blue-500">{c.occupiedBeds} of {c.totalBeds}</div>
                <div className="text-[10px] text-blue-400">{c.availableBeds} available</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-red-600">ICU</div>
                <div className="text-2xl font-bold text-red-700">{c.icuOccupied}/{c.icuTotal}</div>
                <div className="text-xs text-red-500">{c.icuTotal - c.icuOccupied} available</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-green-600">Today Revenue</div>
                <div className="text-2xl font-bold text-green-700">₹{fmtL(c.revenueToday)}</div>
                <div className="text-xs text-green-500">{c.billsToday} bills</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-purple-600">OT Today</div>
                <div className="text-2xl font-bold text-purple-700">{c.otScheduled}</div>
                <div className="text-xs text-purple-500">{c.otCompleted} done, {c.otRunning} live</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-orange-600">Pending Discharges</div>
                <div className="text-2xl font-bold text-orange-700">{c.pendingDischarges}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-yellow-600">Insurance Pending</div>
                <div className="text-2xl font-bold text-yellow-700">{c.preAuthPending + c.claimsPending}</div>
                <div className="text-xs text-yellow-500">{c.preAuthPending} PA / {c.claimsPending} claims</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BOTTOM ROW: Revenue breakdown + AR + Doctor revenue */}
      <div className="grid grid-cols-3 gap-3">
        {/* Department Revenue */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-2">Revenue by Department (Today)</h3>
          {deptRevenue.length === 0 ? <div className="text-center py-4 text-gray-400 text-xs">No data</div> :
            <div className="space-y-1.5">{deptRevenue.slice(0, 8).map((d, i) => {
              const maxAmt = deptRevenue[0]?.amount || 1;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-gray-600 truncate">{d.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(d.amount / maxAmt) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right font-bold">₹{fmtL(d.amount)}</span>
                </div>
              );
            })}</div>}
        </div>

        {/* AR Aging */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-2">Accounts Receivable</h3>
          <div className="text-center mb-3">
            <div className="text-[10px] text-gray-500">Total Outstanding</div>
            <div className="text-2xl font-bold text-red-700">₹{fmtL(arSummary.total)}</div>
          </div>
          <div className="space-y-1.5">
            {[['0-30 days', arSummary.current, 'bg-green-500'],
              ['31-60 days', arSummary.d60, 'bg-yellow-500'],
              ['61-90 days', arSummary.d90, 'bg-orange-500'],
              ['90+ days', arSummary.over90, 'bg-red-500']].map(([label, amount, color], i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-gray-500">{label as string}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${arSummary.total > 0 ? ((amount as number) / arSummary.total) * 100 : 0}%` }} />
                </div>
                <span className="w-16 text-right font-bold">₹{fmtL(amount as number)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Doctor Revenue */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-2">Doctor Revenue (Today)</h3>
          {doctorRevenue.length === 0 ? <div className="text-center py-4 text-gray-400 text-xs">No data</div> :
            <div className="space-y-1">{doctorRevenue.slice(0, 10).map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-0.5 border-b border-gray-50">
                <span className="text-gray-700 truncate max-w-[60%]">{i + 1}. {d.name}</span>
                <span className="font-bold text-green-700">₹{fmtL(d.amount)}</span>
              </div>
            ))}</div>}
        </div>
      </div>

      {/* CENTRE COMPARISON TABLE */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Centre</th>
            <th className="p-2 text-center">Beds</th><th className="p-2 text-center">ICU</th>
            <th className="p-2 text-center">OPD</th><th className="p-2 text-center">Adm</th><th className="p-2 text-center">Dis</th>
            <th className="p-2 text-right">Revenue</th><th className="p-2 text-right">Collected</th>
            <th className="p-2 text-center">OT</th><th className="p-2 text-center">Pend Dis</th><th className="p-2 text-center">Insurance</th>
          </tr></thead>
          <tbody>
            {centres.map(c => {
              const bedPct = pct(c.occupiedBeds, c.totalBeds);
              return (
                <tr key={c.centreId} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedCentre(c.centreId)}>
                  <td className="p-2 font-bold">{c.centreName}</td>
                  <td className="p-2 text-center"><span className={`font-bold ${bedPct > 90 ? 'text-red-600' : bedPct > 70 ? 'text-yellow-600' : 'text-green-600'}`}>{c.occupiedBeds}/{c.totalBeds}</span></td>
                  <td className="p-2 text-center"><span className={c.icuOccupied >= c.icuTotal && c.icuTotal > 0 ? 'text-red-600 font-bold' : ''}>{c.icuOccupied}/{c.icuTotal}</span></td>
                  <td className="p-2 text-center">{c.opdToday} <span className="text-gray-400">({c.opdWaiting}w)</span></td>
                  <td className="p-2 text-center text-green-600 font-bold">{c.admissionsToday}</td>
                  <td className="p-2 text-center text-orange-600">{c.dischargesToday}</td>
                  <td className="p-2 text-right font-bold text-green-700">₹{fmtL(c.revenueToday)}</td>
                  <td className="p-2 text-right text-blue-600">₹{fmtL(c.collectedToday)}</td>
                  <td className="p-2 text-center">{c.otCompleted}/{c.otScheduled}{c.otRunning > 0 && <span className="text-red-500 ml-1">({c.otRunning})</span>}</td>
                  <td className="p-2 text-center">{c.pendingDischarges > 0 ? <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">{c.pendingDischarges}</span> : '—'}</td>
                  <td className="p-2 text-center">{(c.preAuthPending + c.claimsPending) > 0 ? <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">{c.preAuthPending + c.claimsPending}</span> : '—'}</td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
              <td className="p-2">GROUP TOTAL</td>
              <td className="p-2 text-center">{totals.occupiedBeds}/{totals.totalBeds}</td>
              <td className="p-2 text-center">{totals.icuOccupied}/{totals.icuTotal}</td>
              <td className="p-2 text-center">{totals.opdToday}</td>
              <td className="p-2 text-center text-green-700">{totals.admissionsToday}</td>
              <td className="p-2 text-center text-orange-700">{totals.dischargesToday}</td>
              <td className="p-2 text-right text-green-700">₹{fmtL(totals.revenueToday)}</td>
              <td className="p-2 text-right text-blue-700">₹{fmtL(totals.collectedToday)}</td>
              <td className="p-2 text-center">{totals.otCompleted}/{totals.otScheduled}</td>
              <td className="p-2 text-center">{totals.pendingDischarges}</td>
              <td className="p-2 text-center">{totals.preAuthPending + totals.claimsPending}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
