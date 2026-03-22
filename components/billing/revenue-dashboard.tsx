'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 10000000 ? `₹${(n/10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${fmt(n)}`;
const dayLabel = (d: string) => new Date(d+'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
const C = { teal:'#0d9488', green:'#16a34a', blue:'#2563eb', amber:'#d97706', purple:'#7c3aed', slate:'#475569' };

interface Props { centreId: string; }

export default function RevenueDashboard({ centreId }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  const load = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let dateFrom = today;
    if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - 6); dateFrom = d.toISOString().split('T')[0]; }
    if (period === 'month') { const d = new Date(now); d.setDate(1); dateFrom = d.toISOString().split('T')[0]; }

    // Build date array for trend
    const days: string[] = [];
    const start = new Date(dateFrom + 'T12:00:00');
    const end = new Date(today + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }

    const [bills, payments, charges, advances] = await Promise.all([
      sb()!.from('hmis_bills').select('id, bill_type, bill_date, payor_type, gross_amount, discount_amount, net_amount, paid_amount, balance_amount, status')
        .eq('centre_id', centreId).gte('bill_date', dateFrom).lte('bill_date', today).neq('status', 'cancelled'),
      sb()!.from('hmis_payments').select('id, amount, payment_mode, payment_date, bill_id')
        .gte('payment_date', dateFrom).lte('payment_date', today),
      sb()!.from('hmis_charge_log').select('id, amount, status, category')
        .eq('centre_id', centreId).gte('service_date', dateFrom).lte('service_date', today),
      sb()!.from('hmis_advances').select('id, amount, payment_mode')
        .gte('created_at', dateFrom + 'T00:00:00'),
    ]);

    const b = bills.data || []; const p = payments.data || []; const c = charges.data || []; const a = advances.data || [];

    const gross = b.reduce((s: number, x: any) => s + parseFloat(x.gross_amount || 0), 0);
    const discount = b.reduce((s: number, x: any) => s + parseFloat(x.discount_amount || 0), 0);
    const net = b.reduce((s: number, x: any) => s + parseFloat(x.net_amount || 0), 0);
    const collected = p.reduce((s: number, x: any) => s + parseFloat(x.amount || 0), 0);
    const outstanding = b.reduce((s: number, x: any) => s + parseFloat(x.balance_amount || 0), 0);
    const advTotal = a.reduce((s: number, x: any) => s + parseFloat(x.amount || 0), 0);
    const chargeTotal = c.reduce((s: number, x: any) => s + parseFloat(x.amount || 0), 0);

    // Trend
    const trend = days.map(d => {
      const db = b.filter((x: any) => x.bill_date === d);
      return { date: d, day: dayLabel(d), revenue: db.reduce((s: number, x: any) => s + parseFloat(x.net_amount || 0), 0), collected: p.filter((x: any) => x.payment_date === d).reduce((s: number, x: any) => s + parseFloat(x.amount || 0), 0) };
    });

    // By payor
    const byPayor: Record<string, number> = {};
    b.forEach((x: any) => { const t = x.payor_type || 'self'; byPayor[t] = (byPayor[t] || 0) + parseFloat(x.net_amount || 0); });
    const payorColors: Record<string, string> = { self: C.teal, insurance: C.blue, pmjay: C.green, cghs: C.amber, corporate: C.purple };
    const payorData = Object.entries(byPayor).map(([k, v]) => ({ name: k.replace('_', ' '), value: v, fill: payorColors[k] || C.slate }));

    // By mode
    const byMode: Record<string, number> = {};
    p.forEach((x: any) => { const m = x.payment_mode || 'cash'; byMode[m] = (byMode[m] || 0) + parseFloat(x.amount || 0); });

    // By type
    const byType: Record<string, { count: number; revenue: number }> = {};
    b.forEach((x: any) => { const t = x.bill_type || 'other'; if (!byType[t]) byType[t] = { count: 0, revenue: 0 }; byType[t].count++; byType[t].revenue += parseFloat(x.net_amount || 0); });

    setStats({ gross, discount, net, collected, outstanding, advTotal, chargeTotal, billCount: b.length, trend, payorData, byMode, byType });
    setLoading(false);
  }, [centreId, period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="space-y-4 animate-pulse"><div className="grid grid-cols-7 gap-2">{[1,2,3,4,5,6,7].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div><div className="h-52 bg-gray-100 rounded-2xl" /></div>;
  if (!stats) return <div className="text-center py-12 text-gray-300">No data</div>;

  const pctChange = stats.trend.length >= 2
    ? (() => { const last = stats.trend[stats.trend.length - 1]?.revenue || 0; const prev = stats.trend[stats.trend.length - 2]?.revenue || 0; return prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0; })()
    : 0;

  return (
    <div className="space-y-4">
      {/* Period */}
      <div className="flex gap-1">
        {(['today', 'week', 'month'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${period === p ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>
            {p === 'today' ? 'Today' : p === 'week' ? 'Last 7 Days' : 'This Month'}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-2.5 py-1.5 text-[10px] bg-white border border-gray-100 rounded-lg hover:bg-gray-50 text-gray-500">↻</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Gross', value: stats.gross, color: 'text-gray-800' },
          { label: 'Discount', value: stats.discount, color: 'text-red-600' },
          { label: 'Net Revenue', value: stats.net, color: 'text-teal-700' },
          { label: 'Collected', value: stats.collected, color: 'text-emerald-700' },
          { label: 'Outstanding', value: stats.outstanding, color: stats.outstanding > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'Advances', value: stats.advTotal, color: 'text-purple-700' },
          { label: 'Charges', value: stats.chargeTotal, color: 'text-blue-700' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 px-3 py-3 text-center">
            <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{k.label}</div>
            <div className={`text-lg font-bold mt-0.5 ${k.color}`}>{INR(k.value)}</div>
          </div>
        ))}
      </div>

      {/* Chart + breakdowns */}
      <div className="grid grid-cols-3 gap-4">
        {/* Revenue trend */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Revenue Trend</h3>
              <p className="text-[10px] text-gray-400">{stats.billCount} bills · {period === 'today' ? 'Today' : period === 'week' ? 'Last 7 days' : 'This month'}</p>
            </div>
            <span className={`flex items-center gap-1 text-xs font-bold ${pctChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {pctChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {pctChange > 0 ? '+' : ''}{pctChange}%
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gRevDash" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={0.25} /><stop offset="100%" stopColor={C.teal} stopOpacity={0} /></linearGradient>
                <linearGradient id="gColDash" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.15} /><stop offset="100%" stopColor={C.green} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(0)}L` : `${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} formatter={(v: number) => INR(v)} />
              <Area type="monotone" dataKey="revenue" stroke={C.teal} strokeWidth={2.5} fill="url(#gRevDash)" dot={{ r: 3, fill: C.teal }} />
              <Area type="monotone" dataKey="collected" stroke={C.green} strokeWidth={1.5} fill="url(#gColDash)" dot={{ r: 2, fill: C.green }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payor mix */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Payor Mix</h3>
          {stats.payorData.length === 0 ? <div className="text-center py-8 text-gray-300 text-xs">No data</div> :
          <div className="flex flex-col items-center gap-3">
            <ResponsiveContainer width={140} height={140}>
              <PieChart><Pie data={stats.payorData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} strokeWidth={0}>
                {stats.payorData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-2">
              {stats.payorData.sort((a: any, b: any) => b.value - a.value).map((d: any) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                    <span className="text-xs capitalize text-gray-600">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">{INR(d.value)}</span>
                </div>
              ))}
            </div>
          </div>}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-4">
        {/* By type */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Revenue by Type</h3>
          <div className="space-y-2.5">
            {Object.entries(stats.byType).sort((a: any, b: any) => b[1].revenue - a[1].revenue).map(([type, data]: any) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h1-badge h1-badge-gray uppercase">{type}</span>
                  <span className="text-[10px] text-gray-400">{data.count} bills</span>
                </div>
                <span className="text-xs font-bold">{INR(data.revenue)}</span>
              </div>
            ))}
            {Object.keys(stats.byType).length === 0 && <div className="text-xs text-gray-400">No bills</div>}
          </div>
        </div>

        {/* By mode */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Collections by Mode</h3>
          {Object.keys(stats.byMode).length === 0 ? <div className="text-xs text-gray-400">No payments</div> :
          <div className="space-y-2.5">
            {Object.entries(stats.byMode).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).map(([mode, amount]: any) => {
              const total = Object.values(stats.byMode).reduce((s: number, v: any) => s + v, 0);
              const pctM = total > 0 ? Math.round((amount / total) * 100) : 0;
              return (
                <div key={mode}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium capitalize text-gray-600">{mode.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2"><span className="text-[10px] text-gray-400">{pctM}%</span><span className="text-xs font-bold text-emerald-700">{INR(amount)}</span></div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${pctM}%` }} /></div>
                </div>
              );
            })}
          </div>}
        </div>
      </div>
    </div>
  );
}
