// components/radiology/tat-analytics.tsx
// TAT dashboard — average, median, by modality, breach tracking
'use client';
import React, { useMemo } from 'react';
import { type RadiologyOrder } from '@/lib/radiology/radiology-hooks';

const MOD_COLORS: Record<string, string> = { XR: 'bg-blue-400', CT: 'bg-purple-400', MRI: 'bg-indigo-400', USG: 'bg-green-400', ECHO: 'bg-red-400', DEXA: 'bg-teal-400', MAMMO: 'bg-pink-400', FLUORO: 'bg-amber-400' };
const fmtTat = (mins: number) => mins >= 1440 ? `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h` : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

interface Props { orders: RadiologyOrder[]; stats: any; }

export default function TATAnalytics({ orders, stats }: Props) {
  const tatByModality = useMemo(() => {
    const map = new Map<string, { total: number; count: number; min: number; max: number; breaches: number }>();
    orders.filter(o => o.tat_minutes && o.tat_minutes > 0).forEach(o => {
      const mod = o.modality || o.test?.modality || 'Other';
      if (!map.has(mod)) map.set(mod, { total: 0, count: 0, min: Infinity, max: 0, breaches: 0 });
      const m = map.get(mod)!;
      m.total += o.tat_minutes!; m.count++;
      m.min = Math.min(m.min, o.tat_minutes!); m.max = Math.max(m.max, o.tat_minutes!);
      const expected = (o.test?.tat_hours || 24) * 60;
      if (o.tat_minutes! > expected) m.breaches++;
    });
    return Array.from(map.entries()).map(([mod, d]) => ({
      modality: mod, avg: Math.round(d.total / d.count), min: d.min, max: d.max, count: d.count, breaches: d.breaches, breachPct: Math.round((d.breaches / d.count) * 100),
    })).sort((a, b) => b.avg - a.avg);
  }, [orders]);

  const recentOrders = useMemo(() =>
    orders.filter(o => o.tat_minutes && o.tat_minutes > 0).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 25)
  , [orders]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">Average TAT</div><div className="text-2xl font-bold">{stats.avgTatMinutes > 0 ? fmtTat(stats.avgTatMinutes) : '—'}</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">Median TAT</div><div className="text-2xl font-bold">{stats.medianTatMinutes > 0 ? fmtTat(stats.medianTatMinutes) : '—'}</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">TAT Breaches</div><div className={`text-2xl font-bold ${stats.tatBreaches > 0 ? 'text-red-700' : 'text-green-700'}`}>{stats.tatBreaches}</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">Reported</div><div className="text-2xl font-bold text-blue-700">{stats.reported + stats.verified}</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">Pending</div><div className="text-2xl font-bold text-amber-700">{stats.ordered + stats.scheduled + stats.inProgress}</div></div>
      </div>

      {/* TAT by modality */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">TAT by Modality</h3>
        {tatByModality.length === 0 ? <div className="text-center text-gray-400 text-sm py-4">No reported studies with TAT data</div> :
        <div className="space-y-3">{tatByModality.map(m => (
          <div key={m.modality} className="flex items-center gap-3">
            <div className={`w-12 text-center px-1 py-0.5 rounded text-[10px] text-white ${MOD_COLORS[m.modality] || 'bg-gray-400'}`}>{m.modality}</div>
            <div className="flex-1"><div className="bg-gray-100 rounded-full h-4 relative">
              <div className={`h-full rounded-full ${m.breachPct > 30 ? 'bg-red-400' : m.breachPct > 10 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, (m.avg / (24 * 60)) * 100)}%` }} />
            </div></div>
            <div className="text-xs w-20 text-right"><span className="font-bold">{fmtTat(m.avg)}</span><span className="text-gray-400"> avg</span></div>
            <div className="text-[10px] w-16 text-right text-gray-400">{m.count} studies</div>
            <div className={`text-[10px] w-16 text-right ${m.breachPct > 0 ? 'text-red-600 font-medium' : 'text-green-600'}`}>{m.breachPct}% breach</div>
          </div>
        ))}</div>}
      </div>

      {/* Recent TAT table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b"><h3 className="text-sm font-bold text-gray-700">Recent Studies — TAT Detail</h3></div>
        <table className="w-full text-xs"><thead><tr className="border-b text-gray-500"><th className="p-2 text-left font-medium">Test</th><th className="p-2">Patient</th><th className="p-2">Ordered</th><th className="p-2">Reported</th><th className="p-2">TAT</th><th className="p-2">Expected</th><th className="p-2">Result</th></tr></thead>
        <tbody>{recentOrders.map(o => {
          const expected = (o.test?.tat_hours || 24) * 60;
          const breached = o.tat_minutes! > expected;
          return (
            <tr key={o.id} className={`border-b ${breached ? 'bg-red-50/50' : ''}`}>
              <td className="p-2 font-medium">{o.test?.test_name}</td>
              <td className="p-2 text-center">{o.patient?.first_name} {o.patient?.last_name}</td>
              <td className="p-2 text-center text-[10px] text-gray-500">{new Date(o.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="p-2 text-center text-[10px] text-gray-500">{o.reported_at ? new Date(o.reported_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              <td className={`p-2 text-center font-bold ${breached ? 'text-red-700' : 'text-green-700'}`}>{fmtTat(o.tat_minutes!)}</td>
              <td className="p-2 text-center text-gray-400">{fmtTat(expected)}</td>
              <td className="p-2 text-center">{breached ? <span className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-[9px]">Breach</span> : <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[9px]">On Time</span>}</td>
            </tr>
          );
        })}</tbody></table>
      </div>
    </div>
  );
}
