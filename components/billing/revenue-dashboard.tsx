// components/billing/revenue-dashboard.tsx
'use client';
import React, { useMemo } from 'react';

interface Props { bills: any[]; }

export default function RevenueDashboard({ bills }: Props) {
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const today = new Date().toISOString().split('T')[0];

  const stats = useMemo(() => {
    const todayB = bills.filter(b => b.bill_date === today);
    const active = bills.filter(b => b.status !== 'cancelled');
    const total = active.reduce((s, b) => s + parseFloat(b.net_amount || 0), 0);
    const collected = active.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0);
    const outstanding = active.reduce((s, b) => s + parseFloat(b.balance_amount || 0), 0);
    const efficiency = total > 0 ? (collected / total * 100).toFixed(1) : '0';

    // By payor
    const byPayor: Record<string, { count: number; revenue: number; collected: number; outstanding: number }> = {};
    active.forEach(b => {
      const p = b.payor_type || 'self';
      if (!byPayor[p]) byPayor[p] = { count: 0, revenue: 0, collected: 0, outstanding: 0 };
      byPayor[p].count++; byPayor[p].revenue += parseFloat(b.net_amount || 0);
      byPayor[p].collected += parseFloat(b.paid_amount || 0); byPayor[p].outstanding += parseFloat(b.balance_amount || 0);
    });

    // By type
    const byType: Record<string, { count: number; revenue: number }> = {};
    active.forEach(b => {
      const t = b.bill_type || 'other';
      if (!byType[t]) byType[t] = { count: 0, revenue: 0 };
      byType[t].count++; byType[t].revenue += parseFloat(b.net_amount || 0);
    });

    // By status
    const byStatus: Record<string, number> = {};
    bills.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });

    // Aging
    const aging = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
    const nowMs = Date.now();
    active.filter(b => parseFloat(b.balance_amount) > 0).forEach(b => {
      const days = Math.floor((nowMs - new Date(b.bill_date).getTime()) / 86400000);
      const bal = parseFloat(b.balance_amount);
      if (days <= 7) aging.current += bal;
      else if (days <= 30) aging.d30 += bal;
      else if (days <= 60) aging.d60 += bal;
      else if (days <= 90) aging.d90 += bal;
      else aging.over90 += bal;
    });

    // Last 7 days revenue
    const daily: { date: string; revenue: number; collected: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const dayB = active.filter(b => b.bill_date === ds);
      daily.push({ date: ds, revenue: dayB.reduce((s, b) => s + parseFloat(b.net_amount || 0), 0), collected: dayB.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0) });
    }

    return { todayCount: todayB.length, todayRev: todayB.reduce((s, b) => s + parseFloat(b.net_amount || 0), 0),
      total, collected, outstanding, efficiency, byPayor, byType, byStatus, aging, daily,
      avgBill: active.length > 0 ? total / active.length : 0,
      todayCollected: todayB.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0),
    };
  }, [bills, today]);

  const payorColor = (p: string) => p === 'self' ? '#6b7280' : p === 'insurance' ? '#2563eb' : p.includes('pmjay') ? '#16a34a' : p.includes('cghs') ? '#0d9488' : p === 'corporate' ? '#7c3aed' : '#9ca3af';
  const maxDaily = Math.max(...stats.daily.map(d => d.revenue), 1);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Today Bills</div><div className="text-xl font-bold">{stats.todayCount}</div><div className="text-xs text-green-600">₹{fmt(stats.todayRev)}</div></div>
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Today Collected</div><div className="text-xl font-bold text-green-700">₹{fmt(stats.todayCollected)}</div></div>
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Total Revenue</div><div className="text-xl font-bold text-blue-700">₹{fmt(stats.total)}</div></div>
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Collected</div><div className="text-xl font-bold text-green-700">₹{fmt(stats.collected)}</div></div>
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Outstanding</div><div className="text-xl font-bold text-red-700">₹{fmt(stats.outstanding)}</div></div>
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Collection %</div><div className={`text-xl font-bold ${parseFloat(stats.efficiency) >= 80 ? 'text-green-700' : parseFloat(stats.efficiency) >= 60 ? 'text-yellow-600' : 'text-red-700'}`}>{stats.efficiency}%</div></div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 7-day trend */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">7-Day Revenue Trend</h3>
          <div className="flex items-end gap-1 h-32">{stats.daily.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center">
              <div className="w-full rounded-t" style={{ height: `${(d.revenue / maxDaily) * 100}%`, minHeight: '2px', background: 'linear-gradient(#3b82f6, #60a5fa)' }} />
              <div className="text-[8px] text-gray-400 mt-1">{new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
              <div className="text-[8px] font-bold">₹{d.revenue >= 100000 ? (d.revenue/100000).toFixed(1)+'L' : d.revenue >= 1000 ? (d.revenue/1000).toFixed(0)+'K' : d.revenue}</div>
            </div>
          ))}</div>
        </div>

        {/* Revenue by payor */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Revenue by Payor</h3>
          {Object.entries(stats.byPayor).sort((a, b) => b[1].revenue - a[1].revenue).map(([p, v]) => {
            const pct = stats.total > 0 ? (v.revenue / stats.total * 100).toFixed(1) : '0';
            return <div key={p} className="mb-2">
              <div className="flex justify-between text-xs mb-0.5"><span style={{ color: payorColor(p) }} className="font-medium">{p.replace('govt_','').replace('_',' ').toUpperCase()} <span className="text-gray-400">({v.count})</span></span><span className="font-bold">₹{fmt(v.revenue)}</span></div>
              <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: payorColor(p) }} /></div>
            </div>;
          })}
        </div>

        {/* Aging */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Outstanding Aging</h3>
          {[['0-7 days', stats.aging.current, 'bg-green-100 text-green-700'], ['8-30 days', stats.aging.d30, 'bg-yellow-100 text-yellow-700'], ['31-60 days', stats.aging.d60, 'bg-orange-100 text-orange-700'], ['61-90 days', stats.aging.d90, 'bg-red-100 text-red-700'], ['90+ days', stats.aging.over90, 'bg-red-200 text-red-800']].map(([label, val, cls]) => (
            <div key={label as string} className="flex justify-between items-center py-1.5 border-b last:border-0">
              <span className="text-xs">{label}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{val as number > 0 ? `₹${fmt(val as number)}` : '—'}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 mt-1 border-t-2">
            <span className="text-xs font-bold">Total Outstanding</span>
            <span className="text-sm font-bold text-red-700">₹{fmt(stats.outstanding)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* By bill type */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Revenue by Service Type</h3>
          <div className="space-y-2">{Object.entries(stats.byType).sort((a, b) => b[1].revenue - a[1].revenue).map(([t, v]) => (
            <div key={t} className="flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">{t.toUpperCase()}</span><span className="text-xs text-gray-400">{v.count} bills</span></div>
              <span className="text-sm font-bold">₹{fmt(v.revenue)}</span>
            </div>
          ))}</div>
        </div>

        {/* By status */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Bill Status Distribution</h3>
          <div className="grid grid-cols-3 gap-2">{Object.entries(stats.byStatus).map(([s, count]) => {
            const cls = s === 'paid' ? 'bg-green-50 border-green-200 text-green-700' : s === 'partially_paid' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : s === 'cancelled' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-700';
            return <div key={s} className={`rounded-lg border p-2 text-center ${cls}`}><div className="text-lg font-bold">{count}</div><div className="text-[10px]">{s.replace('_',' ')}</div></div>;
          })}</div>
          <div className="mt-3 text-xs text-center">Avg bill value: <span className="font-bold">₹{fmt(stats.avgBill)}</span></div>
        </div>
      </div>
    </div>
  );
}
