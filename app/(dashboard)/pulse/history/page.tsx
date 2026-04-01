'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { usePulse, useCentres, formatLakhs, formatDate } from '@/lib/pulse/pulse-hooks';
import { StatsSkeleton } from '@/components/ui/shared';
import {
  History, ArrowLeft, Download, Calendar, Table2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// ═══ DATE HELPERS ═══

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getPresetRange(preset: string): [string, string] {
  const now = new Date();
  const today = toDateStr(now);

  switch (preset) {
    case 'this_week': {
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return [toDateStr(mon), today];
    }
    case 'last_7': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return [toDateStr(d), today];
    }
    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return [toDateStr(first), today];
    }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return [toDateStr(first), toDateStr(last)];
    }
    default:
      return [toDateStr(new Date(now.getTime() - 7 * 86400000)), today];
  }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ═══ MAIN ═══

export default function PulseHistoryPage() {
  const { staff } = useAuthStore();
  const pulse = usePulse();
  const { centres } = useCentres();

  const [centreFilter, setCentreFilter] = useState('');
  const [preset, setPreset] = useState('last_7');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Calendar state
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // Set initial date range
  useEffect(() => {
    const [s, e] = getPresetRange('last_7');
    setStartDate(s);
    setEndDate(e);
  }, []);

  // Load data
  useEffect(() => {
    if (!startDate || !endDate) return;
    (async () => {
      setLoading(true);
      const data = await pulse.getHistory(centreFilter || null, startDate, endDate);
      setRows(data);
      setLoading(false);
    })();
  }, [startDate, endDate, centreFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== 'custom') {
      const [s, e] = getPresetRange(p);
      setStartDate(s);
      setEndDate(e);
    }
  };

  // Export CSV
  const exportCSV = () => {
    if (rows.length === 0) return;
    const headers = ['Date', 'Centre', 'OPD', 'ER', 'Admissions', 'Discharges', 'Surgeries', 'Census', 'Billing', 'Collection', 'Pharmacy', 'Occupancy %', 'ARPOB'];
    const csvRows = rows.map((r: any) => [
      r.snapshot_date, r.centre_name || r.centre_code || '',
      r.opd_count, r.emergency_count, r.new_admissions, r.discharges,
      r.surgeries, r.ipd_census, r.billing_amount, r.collection_amount,
      r.pharmacy_sales, r.occupancy_pct?.toFixed(1), r.arpob?.toFixed(0),
    ].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse_history_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calendar data lookup
  const calSnapshotMap = (() => {
    const map: Record<string, any[]> = {};
    rows.forEach((r: any) => {
      const d = r.snapshot_date;
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  })();

  // Load calendar month data
  useEffect(() => {
    if (viewMode !== 'calendar') return;
    const s = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
    const lastDay = getDaysInMonth(calYear, calMonth);
    const e = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setStartDate(s);
    setEndDate(e);
  }, [viewMode, calYear, calMonth]);

  const role = staff?.staff_type || '';
  const allowed = ['admin', 'md', 'ceo', 'coo', 'centre_head'].includes(role);
  if (!allowed && role) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <History size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">Access Restricted</h2>
        <p className="text-sm text-gray-500 mt-1">History view is available to leadership roles only.</p>
      </div>
    );
  }

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // 0=Sun

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/pulse" className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <History size={20} className="text-teal-600" />
              Historical Data
            </h1>
          </div>
          <p className="text-sm text-gray-500 ml-7">Browse past daily MIS snapshots</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-teal-100 text-teal-700' : 'text-gray-400 hover:text-gray-600'}`}
            title="Table view"
          >
            <Table2 size={18} />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${viewMode === 'calendar' ? 'bg-teal-100 text-teal-700' : 'text-gray-400 hover:text-gray-600'}`}
            title="Calendar view"
          >
            <Calendar size={18} />
          </button>
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={centreFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCentreFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
        >
          <option value="">All Centres</option>
          {centres.map((c: { id: string; name: string }) => (
            <option key={c.id} value={c.id}>
              {c.name.replace('Health1 Super Speciality Hospitals — ', '').replace('Health1 ', '')}
            </option>
          ))}
        </select>

        {viewMode === 'table' && (
          <>
            {['this_week', 'last_7', 'this_month', 'last_month', 'custom'].map(p => (
              <button
                key={p}
                onClick={() => handlePreset(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  preset === p ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p === 'this_week' ? 'This Week' : p === 'last_7' ? 'Last 7 Days' : p === 'this_month' ? 'This Month' : p === 'last_month' ? 'Last Month' : 'Custom'}
              </button>
            ))}
            {preset === 'custom' && (
              <>
                <input type="date" value={startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                <span className="text-gray-400 text-sm">to</span>
                <input type="date" value={endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
              </>
            )}
          </>
        )}
      </div>

      {pulse.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{pulse.error}</div>
      )}

      {/* ═══ TABLE VIEW ═══ */}
      {viewMode === 'table' && (
        loading ? (
          <StatsSkeleton count={6} />
        ) : rows.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
            No snapshot data found for the selected period.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Centre</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">OPD</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">ER</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Admit</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">DC</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">OT</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Billing</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Collection</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Occ %</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">ARPOB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <Link href={`/pulse?date=${r.snapshot_date}`} className="text-teal-700 hover:underline cursor-pointer">
                        {formatDate(r.snapshot_date)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {(r.centre_name || r.centre_code || '').replace('Health1 Super Speciality Hospitals — ', '').replace('Health1 ', '')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-900 font-medium">{r.opd_count || 0}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.emergency_count || 0}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.new_admissions || 0}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.discharges || 0}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.surgeries || 0}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 font-medium">{formatLakhs(r.billing_amount || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatLakhs(r.collection_amount || 0)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-medium ${
                        (r.occupancy_pct || 0) >= 80 ? 'text-emerald-600' : (r.occupancy_pct || 0) >= 60 ? 'text-amber-600' : 'text-red-600'
                      }`}>{(r.occupancy_pct || 0).toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.arpob ? `₹${Math.round(r.arpob).toLocaleString('en-IN')}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ═══ CALENDAR VIEW ═══ */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear((y: number) => y - 1); }
                else setCalMonth((m: number) => m - 1);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <h3 className="text-lg font-semibold text-gray-800">
              {new Date(calYear, calMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear((y: number) => y + 1); }
                else setCalMonth((m: number) => m + 1);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start (Mon-based) */}
            {Array.from({ length: (firstDayOfWeek + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const snapshots = calSnapshotMap[dateStr] || [];
              const hasData = snapshots.length > 0;
              const totalBilling = snapshots.reduce((s: number, r: any) => s + (r.billing_amount || 0), 0);
              const totalOPD = snapshots.reduce((s: number, r: any) => s + (r.opd_count || 0), 0);

              return (
                <Link
                  key={day}
                  href={`/pulse?date=${dateStr}`}
                  className={`h-20 rounded-lg p-1.5 border transition-all cursor-pointer ${
                    hasData
                      ? 'bg-teal-50 border-teal-200 hover:bg-teal-100 hover:shadow-sm'
                      : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <div className={`text-xs font-medium ${hasData ? 'text-teal-700' : 'text-gray-400'}`}>{day}</div>
                  {hasData && (
                    <div className="mt-1 space-y-0.5">
                      <div className="text-[10px] text-gray-600 truncate">OPD: {totalOPD}</div>
                      <div className="text-[10px] font-semibold text-teal-700 truncate">{formatLakhs(totalBilling)}</div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {loading && (
            <div className="text-center py-4 text-sm text-gray-400">Loading calendar data...</div>
          )}
        </div>
      )}
    </div>
  );
}
