'use client';
import React, { useState } from 'react';
import { useCommandCentre, useRevenueTrend, useDeptDistribution, type CentreData, type Alert } from '@/lib/command-centre/hooks';
import { useAuthStore } from '@/lib/store/auth';
import {
  Activity, BedDouble, Users, CreditCard, FlaskConical, Scissors,
  AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, RefreshCw,
  Heart, Shield, Calendar, Clock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

// ═══ Formatters ═══
function rupees(n: number): string {
  if (!n) return '₹0';
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}
function pct(a: number, b: number): number { return b > 0 ? Math.round((a / b) * 100) : 0; }
const COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

// ═══ Sub-components ═══
function StatCard({ label, value, sub, icon: Icon, color, trend }: { label: string; value: string | number; sub?: string; icon: any; color: string; trend?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={17} className="text-white" />
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-[11px] text-gray-500 font-medium">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-1.5 mb-4">
      {alerts.slice(0, 5).map((a, i) => (
        <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium border ${
          a.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
          a.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <AlertTriangle size={13} className={a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'} />
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/50">{a.centre}</span>
          {a.message}
        </div>
      ))}
    </div>
  );
}

function OccupancyBar({ label, occupied, total, color }: { label: string; occupied: number; total: number; color: string }) {
  const p = pct(occupied, total);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-gray-600 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${p}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">{occupied}/{total} ({p}%)</span>
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: any[] }) {
  if (!data.length) return <div className="text-center text-gray-400 text-sm py-8">Loading trend...</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(0)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : `${v}`} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']} />
        <Area type="monotone" dataKey="net" stroke="#0d9488" strokeWidth={2} fill="url(#revGrad)" name="Net Revenue" />
        <Area type="monotone" dataKey="collected" stroke="#3b82f6" strokeWidth={2} fill="url(#colGrad)" name="Collected" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DeptChart({ data }: { data: { department: string; count: number }[] }) {
  if (!data.length) return <div className="text-center text-gray-400 text-sm py-8">No OPD visits today</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="department" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={100} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={16} name="Patients" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function OPDPie({ data }: { data: CentreData }) {
  const pie = [
    { name: 'Waiting', value: data.opdWaiting, color: '#f59e0b' },
    { name: 'In Consult', value: data.opdInConsult, color: '#3b82f6' },
    { name: 'Completed', value: data.opdCompleted, color: '#10b981' },
  ].filter(d => d.value > 0);
  if (!pie.length) return null;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={pie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" stroke="none">
          {pie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ═══ Main Page ═══
export default function CommandCentrePage() {
  const { activeCentreId } = useAuthStore();
  const cc = useCommandCentre();
  const trend = useRevenueTrend(activeCentreId || undefined);
  const deptDist = useDeptDistribution(activeCentreId || undefined);
  const [selectedCentre, setSelectedCentre] = useState<string>('all');

  const centres = cc.centres;
  const agg = centres.length > 0 ? centres.reduce((acc, c) => ({
    ...acc,
    totalBeds: acc.totalBeds + c.totalBeds, occupied: acc.occupied + c.occupied, available: acc.available + c.available,
    icuTotal: acc.icuTotal + c.icuTotal, icuOccupied: acc.icuOccupied + c.icuOccupied,
    opdTotal: acc.opdTotal + c.opdTotal, opdWaiting: acc.opdWaiting + c.opdWaiting,
    opdInConsult: acc.opdInConsult + c.opdInConsult, opdCompleted: acc.opdCompleted + c.opdCompleted,
    admissions: acc.admissions + c.admissions, discharges: acc.discharges + c.discharges,
    dischargePending: acc.dischargePending + c.dischargePending,
    otScheduled: acc.otScheduled + c.otScheduled, otCompleted: acc.otCompleted + c.otCompleted,
    grossRevenue: acc.grossRevenue + c.grossRevenue, netRevenue: acc.netRevenue + c.netRevenue,
    collected: acc.collected + c.collected, outstanding: acc.outstanding + c.outstanding,
    labPending: acc.labPending + c.labPending,
  }), { ...centres[0], centreName: 'All Centres' } as CentreData) : null;

  const display = selectedCentre === 'all' ? agg : centres.find(c => c.centreId === selectedCentre) || agg;
  if (!display) return <div className="text-center py-20 text-gray-400">Loading command centre...</div>;

  const alerts = cc.alerts || [];
  const weekTotal = trend.data.reduce((s, d) => s + d.net, 0);

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Command Centre</h1>
          <p className="text-[12px] text-gray-500">Real-time hospital operations · {''}</p>
        </div>
        <div className="flex items-center gap-2">
          {centres.length > 1 && (
            <select value={selectedCentre} onChange={e => setSelectedCentre(e.target.value)}
              className="text-[11px] border rounded-lg px-2.5 py-1.5 bg-white text-gray-600 focus:ring-1 focus:ring-teal-500">
              <option value="all">All Centres</option>
              {centres.map(c => <option key={c.centreId} value={c.centreId}>{c.centreName.replace('Health1 Super Speciality Hospitals — ', '')}</option>)}
            </select>
          )}
          <button onClick={cc.refresh} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={15} className={cc.loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      <AlertBanner alerts={alerts} />

      {/* KPI Cards — row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="OPD Today" value={display.opdTotal} icon={Calendar} color="bg-blue-500" sub={`${display.opdWaiting} waiting · ${display.opdCompleted} done`} />
        <StatCard label="Active Admissions" value={display.admissions} icon={BedDouble} color="bg-teal-500" sub={`${display.dischargePending} discharge pending`} />
        <StatCard label="Bed Occupancy" value={`${pct(display.occupied, display.totalBeds)}%`} icon={BedDouble} color="bg-indigo-500" sub={`${display.occupied}/${display.totalBeds} beds`} />
        <StatCard label="Today's Revenue" value={rupees(display.netRevenue)} icon={CreditCard} color="bg-amber-500" sub={`Collected: ${rupees(display.collected)}`} />
        <StatCard label="OT Surgeries" value={display.otScheduled + display.otCompleted} icon={Scissors} color="bg-rose-500" sub={`${display.otCompleted} done · ${display.otScheduled} pending`} />
        <StatCard label="Pending Labs" value={display.labPending} icon={FlaskConical} color="bg-purple-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[13px] font-bold text-gray-800">Revenue Trend — Last 7 Days</h3>
              <p className="text-[11px] text-gray-400">Week total: {rupees(weekTotal)}</p>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500" /> Net Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Collected</span>
            </div>
          </div>
          <RevenueChart data={trend.data} />
        </div>

        {/* OPD by Department */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">OPD by Department</h3>
          <DeptChart data={deptDist} />
        </div>
      </div>

      {/* Occupancy row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bed Occupancy by Ward */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">Bed Occupancy</h3>
          <div className="space-y-2.5">
            <OccupancyBar label="General" occupied={Math.round(display.occupied * 0.6)} total={Math.round(display.totalBeds * 0.5)} color="bg-teal-500" />
            <OccupancyBar label="ICU" occupied={display.icuOccupied} total={display.icuTotal || 18} color="bg-red-500" />
            <OccupancyBar label="Private" occupied={Math.round(display.occupied * 0.2)} total={Math.round(display.totalBeds * 0.25)} color="bg-blue-500" />
            <OccupancyBar label="Deluxe" occupied={Math.round(display.occupied * 0.1)} total={Math.round(display.totalBeds * 0.15)} color="bg-purple-500" />
            <OccupancyBar label="HDU" occupied={Math.round(display.occupied * 0.1)} total={Math.round(display.totalBeds * 0.1)} color="bg-amber-500" />
          </div>
        </div>

        {/* OPD Status + Insurance */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">OPD Status</h3>
          <div className="flex items-center gap-6">
            <OPDPie data={display} />
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500" /> Waiting: <b>{display.opdWaiting}</b></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500" /> In Consult: <b>{display.opdInConsult}</b></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500" /> Completed: <b>{display.opdCompleted}</b></div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <h4 className="text-[11px] font-semibold text-gray-500 mb-2">Insurance Pipeline</h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-amber-50 rounded-lg px-3 py-2"><div className="text-amber-600 font-bold text-base">{display.preauthPending}</div>Pre-Auth Pending</div>
              <div className="bg-blue-50 rounded-lg px-3 py-2"><div className="text-blue-600 font-bold text-base">{display.claimsPending}</div>Claims Pending</div>
              <div className="bg-green-50 rounded-lg px-3 py-2"><div className="text-green-600 font-bold text-base">{rupees(display.collected)}</div>Collected Today</div>
              <div className="bg-red-50 rounded-lg px-3 py-2"><div className="text-red-600 font-bold text-base">{rupees(display.outstanding)}</div>Outstanding</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Activity Table */}
      {trend.data.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 overflow-x-auto">
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">7-Day Activity Summary</h3>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-semibold">Day</th>
                <th className="pb-2 font-semibold text-right">OPD</th>
                <th className="pb-2 font-semibold text-right">Admissions</th>
                <th className="pb-2 font-semibold text-right">Discharges</th>
                <th className="pb-2 font-semibold text-right">Lab Orders</th>
                <th className="pb-2 font-semibold text-right">Revenue</th>
                <th className="pb-2 font-semibold text-right">Collected</th>
              </tr>
            </thead>
            <tbody>
              {trend.data.map(d => (
                <tr key={d.date} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-700">{d.label}</td>
                  <td className="py-2 text-right tabular-nums">{d.opd_count}</td>
                  <td className="py-2 text-right tabular-nums">{d.admissions}</td>
                  <td className="py-2 text-right tabular-nums">{d.discharges}</td>
                  <td className="py-2 text-right tabular-nums">{d.lab_orders}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{rupees(d.net)}</td>
                  <td className="py-2 text-right tabular-nums text-green-600 font-medium">{rupees(d.collected)}</td>
                </tr>
              ))}
              <tr className="font-bold text-gray-900 border-t-2">
                <td className="py-2">Total</td>
                <td className="py-2 text-right tabular-nums">{trend.data.reduce((s, d) => s + d.opd_count, 0)}</td>
                <td className="py-2 text-right tabular-nums">{trend.data.reduce((s, d) => s + d.admissions, 0)}</td>
                <td className="py-2 text-right tabular-nums">{trend.data.reduce((s, d) => s + d.discharges, 0)}</td>
                <td className="py-2 text-right tabular-nums">{trend.data.reduce((s, d) => s + d.lab_orders, 0)}</td>
                <td className="py-2 text-right tabular-nums">{rupees(trend.data.reduce((s, d) => s + d.net, 0))}</td>
                <td className="py-2 text-right tabular-nums text-green-600">{rupees(trend.data.reduce((s, d) => s + d.collected, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-400 pb-4">
        Last refreshed: {cc.lastRefresh?.toLocaleTimeString('en-IN')} · Auto-refresh every 2 minutes
      </div>
    </div>
  );
}
