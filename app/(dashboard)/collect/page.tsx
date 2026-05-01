'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  useAgingSummary, useInsurerPerformance, useMonthlyTrend,
  useARClaims, useDashboardStats, type ClaimFilters,
} from '@/lib/collect/useARDashboard';
import {
  AGING_COLORS, AGING_BAR_COLORS, PRIORITY_COLORS, STATUS_COLORS,
  type ARClaim,
} from '@/lib/collect/ar-types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line, Cell,
} from 'recharts';
import {
  IndianRupee, AlertTriangle, MessageSquareWarning, Clock,
  TrendingUp, ChevronUp, ChevronDown, RefreshCw, Filter,
  ChevronLeft, ChevronRight, ListChecks, ArrowUpDown,
} from 'lucide-react';

const fmtINR = (n: number) => formatCurrency(n);
const fmtCompact = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  return n.toLocaleString('en-IN');
};

const AGING_BUCKETS = ['0-15', '16-30', '31-60', '61-90', '90+'] as const;

function CollectDashboard() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  // Date range for insurer perf (default: last 90 days)
  const today = new Date().toISOString().split('T')[0];
  const ninetyAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const [perfFrom, setPerfFrom] = useState(ninetyAgo);
  const [perfTo, setPerfTo] = useState(today);

  // Data hooks
  const { data: aging, loading: agingLoading, refetch: refetchAging } = useAgingSummary(centreId);
  const { stats, loading: statsLoading, refetch: refetchStats } = useDashboardStats(centreId);
  const { data: insurerPerf, loading: perfLoading } = useInsurerPerformance(centreId, perfFrom, perfTo);
  const { data: trend, loading: trendLoading } = useMonthlyTrend(centreId, 12);

  // Claims table filters
  const [filters, setFilters] = useState<ClaimFilters>({ page: 0, pageSize: 25 });
  const [showFilters, setShowFilters] = useState(false);
  const { data: claims, loading: claimsLoading, total: totalClaims } = useARClaims(centreId, filters);

  // Insurers + TPAs + Staff for filter dropdowns
  const [insurers, setInsurers] = useState<{ id: string; name: string }[]>([]);
  const [tpas, setTpas] = useState<{ id: string; name: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);

  React.useEffect(() => {
    const loadLookups = async () => {
      const { sb } = await import('@/lib/supabase/browser');
      if (!sb()) return;
      const [ins, tp, st] = await Promise.all([
        sb().from('hmis_insurers').select('id, name').eq('is_active', true).order('name'),
        sb().from('hmis_tpas').select('id, name').eq('is_active', true).order('name'),
        sb().from('hmis_staff').select('id, full_name').eq('is_active', true).order('full_name'),
      ]);
      setInsurers(ins.data || []);
      setTpas(tp.data || []);
      setStaffList(st.data || []);
    };
    loadLookups();
  }, []);

  const [trendView, setTrendView] = useState<'amount' | 'count'>('amount');

  const handleBucketClick = (bucket: string) => {
    setFilters(f => ({ ...f, agingBucket: f.agingBucket === bucket ? undefined : bucket, page: 0 }));
  };

  const handleSort = (col: string) => {
    setFilters(f => ({
      ...f,
      sortBy: col,
      sortAsc: f.sortBy === col ? !f.sortAsc : false,
    }));
  };

  const refreshAll = () => { refetchAging(); refetchStats(); };

  const totalPages = Math.ceil(totalClaims / (filters.pageSize || 25));

  // Aging chart data
  const agingChartData = AGING_BUCKETS.map(bucket => {
    const row = aging.find(a => a.aging_bucket === bucket);
    return {
      bucket,
      count: row?.claim_count || 0,
      amount: row?.total_outstanding || 0,
      fill: AGING_BAR_COLORS[bucket],
    };
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collect (AR Tracker)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Accounts Receivable — Insurance Claims Recovery</p>
        </div>
        <div className="flex gap-2">
          <Link href="/collect/tasks"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer transition-colors duration-200">
            <ListChecks size={16} /> Daily Tasks
          </Link>
          <button onClick={refreshAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors duration-200">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Section A — Summary Cards */}
      {statsLoading ? <SkeletonCards /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <SummaryCard
            label="Total Outstanding"
            value={fmtINR(stats.totalOutstanding)}
            sub={`${stats.totalClaims} open claims`}
            color="border-teal-500"
            icon={<IndianRupee size={18} className="text-teal-600" />}
          />
          <SummaryCard
            label="Claims 60+ Days"
            value={fmtINR(stats.over60Amount)}
            sub={`${stats.over60Count} claims`}
            color="border-red-500"
            icon={<AlertTriangle size={18} className="text-red-600" />}
            danger
          />
          <SummaryCard
            label="Open Queries"
            value={String(stats.openQueries)}
            sub="Needs action"
            color="border-amber-500"
            icon={<MessageSquareWarning size={18} className="text-amber-600" />}
          />
          <SummaryCard
            label="Avg Days to Settle"
            value={String(stats.avgDaysToSettle)}
            sub="This month"
            color="border-blue-500"
            icon={<Clock size={18} className="text-blue-600" />}
          />
          <SummaryCard
            label="Settlement Rate"
            value={`${stats.settlementRate}%`}
            sub="This month"
            color="border-emerald-500"
            icon={<TrendingUp size={18} className="text-emerald-600" />}
          />
        </div>
      )}

      {/* Section B — Aging Waterfall Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Aging Waterfall</h2>
        {agingLoading ? <SkeletonChart /> : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `${fmtCompact(v)}`} />
                <YAxis type="category" dataKey="bucket" width={60} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [fmtINR(value), 'Outstanding']}
                  labelFormatter={(label) => `Bucket: ${label} days`}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(entry) => handleBucketClick(entry.bucket)}>
                  {agingChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} opacity={filters.agingBucket && filters.agingBucket !== entry.bucket ? 0.3 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-3">
          {agingChartData.map(b => (
            <button key={b.bucket} onClick={() => handleBucketClick(b.bucket)}
              className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors duration-200 ${
                filters.agingBucket === b.bucket ? 'ring-2 ring-offset-1 ring-gray-400' : ''
              } ${AGING_COLORS[b.bucket]}`}>
              {b.bucket}d: {b.count} claims / {fmtCompact(b.amount)}
            </button>
          ))}
        </div>
      </div>

      {/* Section C — Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <Filter size={14} /> Filters
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {Object.keys(filters).filter(k => !['page', 'pageSize', 'sortBy', 'sortAsc'].includes(k) && (filters as Record<string, any>)[k]).length > 0 && (
            <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded-full">
              {Object.keys(filters).filter(k => !['page', 'pageSize', 'sortBy', 'sortAsc'].includes(k) && (filters as Record<string, any>)[k]).length} active
            </span>
          )}
        </button>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
            <FilterSelect label="Insurer" value={filters.insurerId || ''} onChange={v => setFilters(f => ({ ...f, insurerId: v || undefined, page: 0 }))}
              options={insurers.map(i => ({ value: i.id, label: i.name }))} />
            <FilterSelect label="TPA" value={filters.tpaId || ''} onChange={v => setFilters(f => ({ ...f, tpaId: v || undefined, page: 0 }))}
              options={tpas.map(t => ({ value: t.id, label: t.name }))} />
            <FilterSelect label="Status" value={filters.status || ''} onChange={v => setFilters(f => ({ ...f, status: v || undefined, page: 0 }))}
              options={[
                { value: 'submitted', label: 'Submitted' }, { value: 'under_review', label: 'Under Review' },
                { value: 'query_raised', label: 'Query Raised' }, { value: 'approved', label: 'Approved' },
                { value: 'partially_settled', label: 'Partially Settled' }, { value: 'settled', label: 'Settled' },
                { value: 'rejected', label: 'Rejected' }, { value: 'appealed', label: 'Appealed' },
              ]} />
            <FilterSelect label="Priority" value={filters.priority || ''} onChange={v => setFilters(f => ({ ...f, priority: v || undefined, page: 0 }))}
              options={[
                { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
              ]} />
            <FilterSelect label="Assigned To" value={filters.assignedTo || ''} onChange={v => setFilters(f => ({ ...f, assignedTo: v || undefined, page: 0 }))}
              options={staffList.map(s => ({ value: s.id, label: s.full_name }))} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Date From</label>
              <input type="date" value={filters.dateFrom || ''} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined, page: 0 }))}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Date To</label>
              <input type="date" value={filters.dateTo || ''} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined, page: 0 }))}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!filters.hasOpenQuery} onChange={e => setFilters(f => ({ ...f, hasOpenQuery: e.target.checked || undefined, page: 0 }))}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Open query only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!filters.overdueOnly} onChange={e => setFilters(f => ({ ...f, overdueOnly: e.target.checked || undefined, page: 0 }))}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Overdue follow-ups
            </label>
            <button onClick={() => setFilters({ page: 0, pageSize: 25 })}
              className="text-xs text-red-600 hover:text-red-700 cursor-pointer self-end pb-2">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Section D — Claims Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Claims {filters.agingBucket && <span className="text-sm font-normal text-gray-500">({filters.agingBucket} days)</span>}
          </h2>
          <span className="text-sm text-gray-500">{totalClaims} total</span>
        </div>
        {claimsLoading ? <SkeletonTable /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {[
                      { key: 'claim_number', label: 'Claim #' },
                      { key: 'patient', label: 'Patient (UHID)' },
                      { key: 'insurer', label: 'Insurer' },
                      { key: 'tpa', label: 'TPA' },
                      { key: 'claimed_amount', label: 'Claimed' },
                      { key: 'approved_amount', label: 'Approved' },
                      { key: 'settled_amount', label: 'Settled' },
                      { key: 'outstanding', label: 'Outstanding' },
                      { key: 'days_outstanding', label: 'Days' },
                      { key: 'aging_bucket', label: 'Bucket' },
                      { key: 'priority', label: 'Priority' },
                      { key: 'has_open_query', label: 'Query' },
                      { key: 'next_followup_date', label: 'Next F/U' },
                      { key: 'assigned_to', label: 'Assigned' },
                    ].map(col => (
                      <th key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors duration-200">
                        <span className="flex items-center gap-1">
                          {col.label}
                          {filters.sortBy === col.key && (
                            filters.sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {claims.map(claim => (
                    <ClaimRow key={claim.id} claim={claim} />
                  ))}
                  {claims.length === 0 && (
                    <tr><td colSpan={14} className="px-4 py-12 text-center text-gray-400">No claims found matching filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Page {(filters.page || 0) + 1} of {totalPages || 1}
              </span>
              <div className="flex gap-1">
                <button disabled={(filters.page || 0) === 0}
                  onClick={() => setFilters(f => ({ ...f, page: (f.page || 0) - 1 }))}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer transition-colors duration-200">
                  <ChevronLeft size={16} />
                </button>
                <button disabled={(filters.page || 0) >= totalPages - 1}
                  onClick={() => setFilters(f => ({ ...f, page: (f.page || 0) + 1 }))}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer transition-colors duration-200">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Section E — Insurer Performance */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Insurer Performance</h2>
          <div className="flex items-center gap-2">
            <input type="date" value={perfFrom} onChange={e => setPerfFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={perfTo} onChange={e => setPerfTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
        </div>
        {perfLoading ? <SkeletonTable /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {['Insurer', 'Claims', 'Claimed', 'Settled', 'Settlement %', 'Avg Days', 'Open Claims', 'Open Amount', 'Query Rate %', 'Disallowance %'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {insurerPerf.filter(i => i.claim_count > 0).map(i => (
                  <tr key={i.insurer_id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-3 py-2 font-medium">{i.insurer_name}</td>
                    <td className="px-3 py-2">{i.claim_count}</td>
                    <td className="px-3 py-2">{fmtINR(i.claimed_amount)}</td>
                    <td className="px-3 py-2">{fmtINR(i.settled_amount)}</td>
                    <td className={`px-3 py-2 font-medium ${i.settlement_pct < 80 ? 'text-red-600' : 'text-emerald-600'}`}>{i.settlement_pct}%</td>
                    <td className={`px-3 py-2 ${i.avg_days > 45 ? 'text-red-600 font-medium' : ''}`}>{i.avg_days}</td>
                    <td className="px-3 py-2">{i.open_claims}</td>
                    <td className="px-3 py-2">{fmtINR(i.open_amount)}</td>
                    <td className="px-3 py-2">{i.query_rate_pct}%</td>
                    <td className="px-3 py-2">{i.disallowance_pct}%</td>
                  </tr>
                ))}
                {insurerPerf.filter(i => i.claim_count > 0).length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No insurer data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section F — Monthly Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Monthly Trend</h2>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTrendView('amount')}
              className={`px-3 py-1 text-xs rounded-md cursor-pointer transition-colors duration-200 ${trendView === 'amount' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              Amount
            </button>
            <button onClick={() => setTrendView('count')}
              className={`px-3 py-1 text-xs rounded-md cursor-pointer transition-colors duration-200 ${trendView === 'count' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              Count
            </button>
          </div>
        </div>
        {trendLoading ? <SkeletonChart /> : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ left: 10, right: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month_label" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                <YAxis yAxisId="left" tickFormatter={v => trendView === 'amount' ? fmtCompact(v) : String(v)} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Avg Days', angle: 90, position: 'insideRight', fontSize: 11 }} />
                <Tooltip formatter={(value: number, name: string) => {
                  if (name === 'avg_settlement_days') return [value, 'Avg Days'];
                  if (trendView === 'amount') return [fmtINR(value), name === 'claimed_amount' || name === 'claim_count' ? 'Claimed' : 'Settled'];
                  return [value, name === 'claimed_amount' || name === 'claim_count' ? 'Claimed' : 'Settled'];
                }} />
                <Legend />
                <Bar yAxisId="left" dataKey={trendView === 'amount' ? 'claimed_amount' : 'claim_count'}
                  name="Claimed" fill="#0D9488" opacity={0.7} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey={trendView === 'amount' ? 'settled_amount' : 'settled_count'}
                  name="Settled" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avg_settlement_days"
                  name="Avg Days" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Claim Row Component ----
function ClaimRow({ claim }: { claim: ARClaim }) {
  const outstanding = (parseFloat(String(claim.claimed_amount)) || 0)
    - (parseFloat(String(claim.settled_amount)) || 0)
    - (parseFloat(String(claim.tds_amount)) || 0)
    - (parseFloat(String(claim.disallowance_amount)) || 0);

  return (
    <tr className={`hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${
      claim.aging_bucket === '90+' ? 'bg-red-50/40' :
      claim.aging_bucket === '61-90' ? 'bg-red-50/20' :
      claim.aging_bucket === '31-60' ? 'bg-orange-50/20' : ''
    }`}>
      <td className="px-3 py-2">
        <Link href={`/collect/${claim.id}`} className="text-teal-700 hover:underline font-medium">
          {claim.claim_number || '-'}
        </Link>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {claim.patient ? `${claim.patient.first_name} ${claim.patient.last_name}` : '-'}
        {claim.patient?.uhid && <span className="text-xs text-gray-400 ml-1">({claim.patient.uhid})</span>}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{claim.insurer?.name || '-'}</td>
      <td className="px-3 py-2 whitespace-nowrap">{claim.tpa?.name || '-'}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtINR(parseFloat(String(claim.claimed_amount)) || 0)}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">{claim.approved_amount ? fmtINR(parseFloat(String(claim.approved_amount))) : '-'}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">{claim.settled_amount ? fmtINR(parseFloat(String(claim.settled_amount))) : '-'}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{fmtINR(outstanding)}</td>
      <td className="px-3 py-2 text-center">{claim.days_outstanding}</td>
      <td className="px-3 py-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${AGING_COLORS[claim.aging_bucket] || 'bg-gray-100 text-gray-600'}`}>
          {claim.aging_bucket}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[claim.priority] || ''}`}>
          {claim.priority}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        {claim.has_open_query && <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full" title="Open query" />}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs">
        {claim.next_followup_date ? formatDate(claim.next_followup_date) : '-'}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs">
        {claim.assigned_staff?.full_name || '-'}
      </td>
    </tr>
  );
}

// ---- Summary Card ----
function SummaryCard({ label, value, sub, color, icon, danger }: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border-l-4 ${color} border border-gray-200 p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${danger ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

// ---- Filter Select ----
function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer">
        <option value="">All</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ---- Skeleton Loaders ----
function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
          <div className="h-7 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="h-[250px] bg-gray-50 rounded-lg animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-300">Loading chart...</span>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded" />
      ))}
    </div>
  );
}

// ---- Page Export with RoleGuard ----
export default function CollectPage() {
  return (
    <RoleGuard module="billing">
      <CollectDashboard />
    </RoleGuard>
  );
}
