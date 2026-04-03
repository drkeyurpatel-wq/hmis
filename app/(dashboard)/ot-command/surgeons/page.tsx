'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useSurgeonPerformance } from '@/lib/ot/ot-command-hooks';
import Link from 'next/link';
import { ArrowLeft, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

type SortKey = 'surgeon_name' | 'total_cases' | 'completed_cases' | 'avg_duration_min' |
  'total_ot_hours' | 'on_time_pct' | 'cancellation_rate' | 'robotic_cases' | 'emergency_cases' | 'avg_delay_min';

function SurgeonsInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { surgeons, loading, load } = useSurgeonPerformance(centreId);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(today);
  const [sortKey, setSortKey] = useState<SortKey>('total_cases');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null);

  useEffect(() => { load(dateFrom, dateTo); }, [dateFrom, dateTo, centreId, load]);

  const sorted = [...surgeons].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  // Department averages for benchmarks
  const avg = surgeons.length ? {
    cases: Math.round(surgeons.reduce((s, r) => s + Number(r.total_cases || 0), 0) / surgeons.length),
    duration: Math.round(surgeons.reduce((s, r) => s + Number(r.avg_duration_min || 0), 0) / surgeons.length),
    onTime: Math.round(surgeons.reduce((s, r) => s + Number(r.on_time_pct || 0), 0) / surgeons.length),
    cancelRate: (surgeons.reduce((s, r) => s + Number(r.cancellation_rate || 0), 0) / surgeons.length).toFixed(1),
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ot-command" className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surgeon Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">OT performance metrics by surgeon</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-gray-600">From</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm" />
        <label className="text-sm text-gray-600">To</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm" />
        {avg && (
          <span className="ml-auto text-xs text-gray-400">
            Dept avg: {avg.cases} cases, {avg.duration} min, {avg.onTime}% on-time, {avg.cancelRate}% cancel
          </span>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
          {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-gray-100 rounded w-full mb-2" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {([
                    ['surgeon_name', 'Surgeon', 'left'],
                    ['total_cases', 'Cases', 'right'],
                    ['completed_cases', 'Completed', 'right'],
                    ['total_ot_hours', 'OT Hours', 'right'],
                    ['avg_duration_min', 'Avg Duration', 'right'],
                    ['on_time_pct', 'On-Time %', 'right'],
                    ['cancellation_rate', 'Cancel Rate', 'right'],
                    ['robotic_cases', 'Robotic', 'right'],
                    ['emergency_cases', 'Emergency', 'right'],
                    ['avg_delay_min', 'Avg Delay', 'right'],
                  ] as [SortKey, string, string][]).map(([key, label, align]) => (
                    <th key={key}
                      onClick={() => toggleSort(key)}
                      className={`p-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors duration-150 text-${align} select-none`}>
                      <span className="inline-flex items-center gap-1">
                        {label} <SortIcon col={key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s: any) => (
                  <tr key={s.surgeon_id}
                    onClick={() => setSelectedSurgeon(selectedSurgeon === s.surgeon_id ? null : s.surgeon_id)}
                    className={`border-t cursor-pointer transition-colors duration-150 ${
                      selectedSurgeon === s.surgeon_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}>
                    <td className="p-3 font-medium text-gray-900">{s.surgeon_name}</td>
                    <td className="p-3 text-right">{s.total_cases}</td>
                    <td className="p-3 text-right text-green-700">{s.completed_cases}</td>
                    <td className="p-3 text-right">{s.total_ot_hours}h</td>
                    <td className="p-3 text-right">{s.avg_duration_min} min</td>
                    <td className="p-3 text-right">
                      <span className={Number(s.on_time_pct) >= 80 ? 'text-green-700' : Number(s.on_time_pct) >= 60 ? 'text-amber-600' : 'text-red-600'}>
                        {s.on_time_pct}%
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={Number(s.cancellation_rate) <= 5 ? 'text-green-700' : Number(s.cancellation_rate) <= 10 ? 'text-amber-600' : 'text-red-600'}>
                        {s.cancellation_rate}%
                      </span>
                    </td>
                    <td className="p-3 text-right">{s.robotic_cases}</td>
                    <td className="p-3 text-right">{s.emergency_cases}</td>
                    <td className="p-3 text-right">{s.avg_delay_min} min</td>
                  </tr>
                ))}
                {!sorted.length && (
                  <tr><td colSpan={10} className="p-8 text-center text-gray-400">No surgeon data for selected period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SurgeonLeaderboardPage() {
  return <RoleGuard module="ot"><SurgeonsInner /></RoleGuard>;
}
