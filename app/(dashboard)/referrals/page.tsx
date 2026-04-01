'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/ui/shared';
import { CardSkeleton, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useReferralDashboard } from '@/lib/referrals/useReferralDashboard';
import { useReferralSourceTypes } from '@/lib/referrals/useReferralSources';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { ReferralDashboardData } from '@/lib/referrals/types';

const INR = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const TYPE_COLORS: Record<string, string> = {
  doctor: 'bg-blue-100 text-blue-700',
  hospital: 'bg-purple-100 text-purple-700',
  insurance_agent: 'bg-amber-100 text-amber-700',
  campaign: 'bg-green-100 text-green-700',
  walkin_source: 'bg-gray-100 text-gray-700',
};

const CHART_COLORS: Record<string, string> = {
  doctor: '#3b82f6',
  hospital: '#8b5cf6',
  insurance_agent: '#f59e0b',
  campaign: '#10b981',
  walkin_source: '#6b7280',
};

type DatePreset = '30d' | '90d' | 'fy' | 'custom';
type ChartMode = 'count' | 'revenue';
type SortKey = 'patient_count' | 'total_revenue' | 'conversion_pct' | 'source_name';

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  switch (preset) {
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { start: d.toISOString().split('T')[0], end };
    }
    case '90d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return { start: d.toISOString().split('T')[0], end };
    }
    case 'fy': {
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { start: `${year}-04-01`, end };
    }
    default:
      return { start: `${now.getFullYear()}-01-01`, end };
  }
}

function DashboardInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [chartMode, setChartMode] = useState<ChartMode>('count');
  const [sortKey, setSortKey] = useState<SortKey>('patient_count');
  const [sortAsc, setSortAsc] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { types: sourceTypes } = useReferralSourceTypes();

  const dateRange = datePreset === 'custom' && customStart && customEnd
    ? { start: customStart, end: customEnd }
    : getDateRange(datePreset);

  const { rows, trend, summary, dormantSources, loading, error, refetch } = useReferralDashboard({
    centreId,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let result = selectedTypes.length > 0
      ? rows.filter(r => selectedTypes.includes(r.type_code))
      : rows;

    if (tableSearch) {
      const term = tableSearch.toLowerCase();
      result = result.filter(r => r.source_name.toLowerCase().includes(term));
    }

    return result.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [rows, selectedTypes, tableSearch, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const toggleType = (code: string) => {
    setSelectedTypes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-gray-300 ml-0.5">↕</span>;
    return <span className="text-h1-teal ml-0.5">{sortAsc ? '↑' : '↓'}</span>;
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <div className="bg-white rounded-2xl border p-8">
          <svg className="mx-auto mb-3 text-red-400" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <h2 className="text-sm font-bold text-gray-900">Failed to load dashboard</h2>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
          <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-h1-navy text-white text-sm rounded-lg cursor-pointer">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Referral Tracker</h1>
          <p className="text-sm text-gray-500">Track patient acquisition by referral source</p>
        </div>
        <div className="flex gap-2">
          <Link href="/referrals/sources" className="px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            Manage Sources
          </Link>
          <Link href="/referrals/fees" className="px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            Referral Fees
          </Link>
        </div>
      </div>

      {/* Section A — Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Referrals"
            value={summary.totalReferrals.toLocaleString('en-IN')}
            sub={`${datePreset === '30d' ? 'Last 30 days' : datePreset === '90d' ? 'Last 90 days' : 'This FY'}`}
            color="blue"
          />
          <SummaryCard
            label="Top Source Type"
            value={summary.topSourceType}
            sub={`${summary.topSourceCount} patients`}
            color="purple"
          />
          <SummaryCard
            label="IPD Conversion"
            value={`${summary.ipdConversionRate}%`}
            sub="OPD to IPD conversion"
            color="teal"
          />
          <SummaryCard
            label="Revenue from Referrals"
            value={INR(summary.totalRevenue)}
            sub="Total billed amount"
            color="green"
          />
        </div>
      )}

      {/* Section B — Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {([['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['fy', 'This FY'], ['custom', 'Custom']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDatePreset(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                datePreset === key ? 'bg-h1-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="flex gap-2 items-center">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="px-2 py-1.5 text-xs border rounded-lg" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="px-2 py-1.5 text-xs border rounded-lg" />
          </div>
        )}

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex gap-1.5 flex-wrap">
          {sourceTypes.map(t => (
            <button
              key={t.id}
              onClick={() => toggleType(t.code)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors cursor-pointer ${
                selectedTypes.includes(t.code)
                  ? 'bg-h1-teal text-white border-h1-teal'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-h1-teal'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section C — Top Referrers Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Top Referrers</h2>
          <input
            className="px-3 py-1.5 text-xs border rounded-lg w-56"
            placeholder="Search referrers..."
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
          />
        </div>

        {loading ? <TableSkeleton rows={8} cols={8} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 font-medium">
                  <th className="px-4 py-2.5 w-10">#</th>
                  <th className="px-4 py-2.5 cursor-pointer" onClick={() => toggleSort('source_name')}>Name <SortIcon col="source_name" /></th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Details</th>
                  <th className="px-4 py-2.5 text-right cursor-pointer" onClick={() => toggleSort('patient_count')}>Patients <SortIcon col="patient_count" /></th>
                  <th className="px-4 py-2.5 text-right">OPD</th>
                  <th className="px-4 py-2.5 text-right">IPD</th>
                  <th className="px-4 py-2.5 text-right cursor-pointer" onClick={() => toggleSort('conversion_pct')}>Conv % <SortIcon col="conversion_pct" /></th>
                  <th className="px-4 py-2.5 text-right cursor-pointer" onClick={() => toggleSort('total_revenue')}>Revenue <SortIcon col="total_revenue" /></th>
                  <th className="px-4 py-2.5">Last Referral</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No referral data for this period. Add referral sources via the patient registration form or source management.</td></tr>
                ) : filteredRows.map((r, i) => (
                  <React.Fragment key={r.source_id}>
                    <tr
                      className={`border-t hover:bg-gray-50 transition-colors cursor-pointer ${expandedRow === r.source_id ? 'bg-blue-50' : ''}`}
                      onClick={() => setExpandedRow(expandedRow === r.source_id ? null : r.source_id)}
                    >
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        <Link href={`/referrals/${r.source_id}`} className="hover:text-h1-teal" onClick={e => e.stopPropagation()}>
                          {r.source_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_COLORS[r.type_code] || 'bg-gray-100 text-gray-600'}`}>
                          {r.type_label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{r.speciality || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{r.patient_count}</td>
                      <td className="px-4 py-2.5 text-right">{r.opd_count}</td>
                      <td className="px-4 py-2.5 text-right">{r.ipd_count}</td>
                      <td className="px-4 py-2.5 text-right">{r.conversion_pct}%</td>
                      <td className="px-4 py-2.5 text-right font-medium">{INR(r.total_revenue)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.last_referral_date ? new Date(r.last_referral_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                      <td className="px-4 py-2.5">
                        {r.is_dormant && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Dormant</span>}
                        {r.is_new && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">New</span>}
                        {!r.is_dormant && !r.is_new && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">Active</span>}
                      </td>
                    </tr>
                    {expandedRow === r.source_id && (
                      <tr className="bg-blue-50/50">
                        <td colSpan={11} className="px-6 py-3">
                          <div className="flex gap-4 text-[11px]">
                            <Link href={`/referrals/${r.source_id}`} className="text-h1-teal hover:underline font-medium cursor-pointer">
                              View full details →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section D — Trend Chart */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Referral Trend</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setChartMode('count')}
              className={`px-3 py-1 text-[11px] font-medium rounded-lg cursor-pointer ${chartMode === 'count' ? 'bg-h1-navy text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              Patient Count
            </button>
            <button
              onClick={() => setChartMode('revenue')}
              className={`px-3 py-1 text-[11px] font-medium rounded-lg cursor-pointer ${chartMode === 'revenue' ? 'bg-h1-navy text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              Revenue
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
        ) : trend.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No trend data available for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={chartMode === 'revenue' ? (v: number) => INR(v) : undefined} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value: number, name: string) => [
                  chartMode === 'revenue' ? INR(value) : value,
                  name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="doctor" stackId="a" fill={CHART_COLORS.doctor} name="Doctor" />
              <Bar dataKey="hospital" stackId="a" fill={CHART_COLORS.hospital} name="Hospital" />
              <Bar dataKey="insurance_agent" stackId="a" fill={CHART_COLORS.insurance_agent} name="Insurance Agent" />
              <Bar dataKey="campaign" stackId="a" fill={CHART_COLORS.campaign} name="Campaign" />
              <Bar dataKey="walkin_source" stackId="a" fill={CHART_COLORS.walkin_source} name="Walk-in" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Section E — Dormant Referrers Alert */}
      {dormantSources.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m10.29 3.86-1.57 2.7H4.2a.6.6 0 0 0-.51.9l5.56 9.6a.6.6 0 0 0 1.04 0l1.72-2.97 1.72 2.97a.6.6 0 0 0 1.04 0l5.56-9.6a.6.6 0 0 0-.51-.9h-4.52l-1.57-2.7a.6.6 0 0 0-1.04 0Z"/></svg>
            <h2 className="text-sm font-bold text-gray-900">Dormant Referrers</h2>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded-full">{dormantSources.length}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">These sources have not referred patients in the last 60 days</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {dormantSources.slice(0, 9).map(d => (
              <Link
                key={d.source_id}
                href={`/referrals/${d.source_id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50/50 border border-red-100 hover:border-red-200 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{d.source_name}</p>
                  <p className="text-[10px] text-gray-500">
                    {d.type_label} — Last: {d.last_referral_date ? new Date(d.last_referral_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 rounded shrink-0 cursor-pointer">
                  Follow-up
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
    teal: 'border-l-teal-500',
    green: 'border-l-green-500',
  };
  return (
    <div className={`bg-white rounded-xl border border-l-4 ${colors[color] || colors.blue} p-4`}>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

export default function ReferralDashboardPage() {
  return (
    <RoleGuard module="referrals">
      <DashboardInner />
    </RoleGuard>
  );
}
