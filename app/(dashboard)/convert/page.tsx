'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { formatCurrency } from '@/lib/utils';
import { useConversionFunnel, useDoctorConversionRates } from '@/lib/convert/useConvert';
import {
  PIPELINE_STAGES, STATUS_LABELS, STATUS_COLORS,
  type DoctorConversionRate,
} from '@/lib/convert/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, Users, Clock, AlertTriangle,
  ArrowRight, ChevronUp, ChevronDown, RefreshCw, ListChecks,
} from 'lucide-react';

const fmtCompact = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  return n.toLocaleString('en-IN');
};

function ConvertDashboard() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  const today = new Date().toISOString().split('T')[0];
  const ninetyAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(ninetyAgo);
  const [dateTo, setDateTo] = useState(today);

  const { data: funnel, loading: funnelLoading, refetch: refetchFunnel } = useConversionFunnel(centreId, dateFrom, dateTo);
  const { data: doctors, loading: doctorsLoading, refetch: refetchDoctors } = useDoctorConversionRates(centreId, dateFrom, dateTo);

  const [doctorSort, setDoctorSort] = useState<{ col: string; asc: boolean }>({ col: 'total_advised', asc: false });

  // Derive KPIs from funnel data
  const kpis = useMemo(() => {
    const stageMap = new Map(funnel.map(f => [f.status, f]));
    const activeStatuses = PIPELINE_STAGES;
    const activePipeline = funnel.filter(f => activeStatuses.includes(f.status as any));
    const activeCount = activePipeline.reduce((s, f) => s + f.lead_count, 0);
    const activeRevenue = activePipeline.reduce((s, f) => s + f.total_estimated_revenue, 0);

    const totalAdvised = funnel.reduce((s, f) => s + f.lead_count, 0);
    const converted = (stageMap.get('admitted')?.lead_count || 0) + (stageMap.get('completed')?.lead_count || 0);
    const conversionRate = totalAdvised > 0 ? (converted / totalAdvised * 100) : 0;

    const admittedStage = stageMap.get('admitted');
    const completedStage = stageMap.get('completed');
    const avgDays = admittedStage?.avg_days_in_stage || completedStage?.avg_days_in_stage || 0;

    const advisedStage = stageMap.get('advised');
    const atRisk = advisedStage?.total_estimated_revenue || 0;

    const lostStages = funnel.filter(f => f.status.startsWith('lost_'));
    const totalLost = lostStages.reduce((s, f) => s + f.lead_count, 0);

    return { activeCount, activeRevenue, conversionRate, avgDays, atRisk, totalLost, totalAdvised, converted };
  }, [funnel]);

  // Funnel chart data (pipeline stages only)
  const funnelChartData = useMemo(() => {
    const stageMap = new Map(funnel.map(f => [f.status, f]));
    return PIPELINE_STAGES.map(status => ({
      name: STATUS_LABELS[status],
      count: stageMap.get(status)?.lead_count || 0,
      revenue: stageMap.get(status)?.total_estimated_revenue || 0,
      fill: STATUS_COLORS[status],
    }));
  }, [funnel]);

  // Loss breakdown for donut chart
  const lossData = useMemo(() => {
    return funnel
      .filter(f => f.status.startsWith('lost_'))
      .map(f => ({
        name: STATUS_LABELS[f.status as keyof typeof STATUS_LABELS] || f.status,
        value: f.lead_count,
        fill: STATUS_COLORS[f.status] || '#94a3b8',
      }))
      .filter(d => d.value > 0);
  }, [funnel]);

  // Sorted doctors
  const STRING_COLS = new Set(['doctor_name', 'department', 'top_loss_reason']);
  const sortedDoctors = useMemo(() => {
    const col = doctorSort.col as keyof DoctorConversionRate;
    return [...doctors].sort((a, b) => {
      if (STRING_COLS.has(col)) {
        const av = String(a[col] ?? '');
        const bv = String(b[col] ?? '');
        return doctorSort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = (a[col] ?? 0) as number;
      const bv = (b[col] ?? 0) as number;
      return doctorSort.asc ? av - bv : bv - av;
    });
  }, [doctors, doctorSort]);

  const handleDoctorSort = (col: string) => {
    setDoctorSort(prev => ({ col, asc: prev.col === col ? !prev.asc : false }));
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (doctorSort.col !== col) return null;
    return doctorSort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const refreshAll = () => { refetchFunnel(); refetchDoctors(); };

  if (funnelLoading || doctorsLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Convert: OPD to IPD Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track advised admissions from consultation to conversion</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm" />
            <span className="text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm" />
          </div>
          <button onClick={refreshAll} className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Refresh">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
          <Link href="/convert/tasks"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer">
            <ListChecks size={15} /> Task List
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Active Pipeline" value={`${kpis.activeCount} leads`} sub={`${formatCurrency(kpis.activeRevenue)} estimated`} color="indigo" />
        <KPICard icon={TrendingUp} label="Conversion Rate" value={`${kpis.conversionRate.toFixed(1)}%`} sub={`${kpis.converted} of ${kpis.totalAdvised} advised`} color="emerald" />
        <KPICard icon={Clock} label="Avg Days to Convert" value={`${kpis.avgDays} days`} sub="From advised to admitted" color="blue" />
        <KPICard icon={AlertTriangle} label="Revenue at Risk" value={formatCurrency(kpis.atRisk)} sub="Advised, no follow-up" color="red" />
      </div>

      {/* Funnel Visualization */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Conversion Funnel</h2>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {funnelChartData.map((stage, i) => (
            <React.Fragment key={stage.name}>
              <div className="flex-1 min-w-[120px] rounded-lg p-3 text-center"
                style={{ backgroundColor: stage.fill + '15', borderLeft: `3px solid ${stage.fill}` }}>
                <div className="text-2xl font-bold" style={{ color: stage.fill }}>{stage.count}</div>
                <div className="text-xs font-medium text-gray-600 mt-0.5">{stage.name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{fmtCompact(stage.revenue)}</div>
              </div>
              {i < funnelChartData.length - 1 && (
                <ArrowRight size={16} className="text-gray-300 shrink-0" />
              )}
            </React.Fragment>
          ))}
          {kpis.totalLost > 0 && (
            <>
              <div className="w-px h-12 bg-gray-200 mx-2 shrink-0" />
              <div className="min-w-[100px] rounded-lg p-3 text-center bg-red-50 border-l-[3px] border-red-400">
                <div className="text-2xl font-bold text-red-500">{kpis.totalLost}</div>
                <div className="text-xs font-medium text-red-600">Lost</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel Bar Chart */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Distribution</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(val: number) => [val, 'Leads']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funnelChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Loss Reason Donut */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Loss Reasons</h2>
          {lossData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie data={lossData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {lossData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {lossData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-gray-600 flex-1">{d.name}</span>
                    <span className="font-semibold text-gray-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
              No lost leads in this period
            </div>
          )}
        </div>
      </div>

      {/* Doctor Conversion Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Doctor-wise Conversion</h2>
          <span className="text-xs text-gray-400">{doctors.length} doctors</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {[
                  { key: 'doctor_name', label: 'Doctor' },
                  { key: 'department', label: 'Department' },
                  { key: 'total_advised', label: 'Advised' },
                  { key: 'total_converted', label: 'Converted' },
                  { key: 'conversion_rate', label: 'Rate %' },
                  { key: 'total_lost', label: 'Lost' },
                  { key: 'top_loss_reason', label: 'Top Loss' },
                  { key: 'estimated_lost_revenue', label: 'Lost Revenue' },
                  { key: 'avg_conversion_days', label: 'Avg Days' },
                ].map(col => (
                  <th key={col.key} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap cursor-pointer hover:text-gray-800 select-none"
                    onClick={() => handleDoctorSort(col.key)}>
                    <span className="flex items-center gap-1">{col.label} <SortIcon col={col.key} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDoctors.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No conversion data in this period</td></tr>
              ) : sortedDoctors.map(doc => {
                const isHighRisk = doc.conversion_rate < 30 && doc.estimated_lost_revenue >= 500000;
                return (
                  <tr key={doc.doctor_id} className={`border-t hover:bg-gray-50 ${isHighRisk ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{doc.doctor_name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{doc.department || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-800">{doc.total_advised}</td>
                    <td className="px-4 py-2.5 text-emerald-600 font-medium">{doc.total_converted}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-medium ${doc.conversion_rate >= 50 ? 'text-emerald-600' : doc.conversion_rate >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                        {doc.conversion_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-red-500">{doc.total_lost}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {doc.top_loss_reason ? STATUS_LABELS[doc.top_loss_reason as keyof typeof STATUS_LABELS] || doc.top_loss_reason : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-red-600 font-medium">{formatCurrency(doc.estimated_lost_revenue)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{doc.avg_conversion_days ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
  };
  const iconBg = colorMap[color] || colorMap.indigo;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
          <p className="text-[11px] text-gray-400">{sub}</p>
        </div>
      </div>
    </div>
  );
}

export default function ConvertPage() {
  return (
    <RoleGuard>
      <ConvertDashboard />
    </RoleGuard>
  );
}
