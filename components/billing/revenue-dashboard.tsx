'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 10000000 ? `₹${(n/10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n/100000).toFixed(2)} L` : `₹${fmt(n)}`;

interface Props { centreId: string; }

export default function RevenueDashboard({ centreId }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const load = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let dateFrom = today;
    if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); dateFrom = d.toISOString().split('T')[0]; }
    if (period === 'month') { const d = new Date(now); d.setDate(1); dateFrom = d.toISOString().split('T')[0]; }

    const [bills, payments, charges, advances] = await Promise.all([
      sb().from('hmis_bills').select('id, bill_type, payor_type, gross_amount, discount_amount, net_amount, paid_amount, balance_amount, status')
        .eq('centre_id', centreId).gte('bill_date', dateFrom).lte('bill_date', today).neq('status', 'cancelled'),
      sb().from('hmis_payments').select('id, amount, payment_mode, payment_date, bill_id')
        .gte('payment_date', dateFrom).lte('payment_date', today),
      sb().from('hmis_charge_log').select('id, amount, status, category')
        .eq('centre_id', centreId).gte('service_date', dateFrom).lte('service_date', today),
      sb().from('hmis_advances').select('id, amount, payment_mode')
        .gte('created_at', dateFrom + 'T00:00:00'),
    ]);

    const b = bills.data || [];
    const p = payments.data || [];
    const c = charges.data || [];
    const a = advances.data || [];

    const gross = b.reduce((s: number, x: any) => s + parseFloat(x.gross_amount || 0), 0);
    const discount = b.reduce((s: number, x: any) => s + parseFloat(x.discount_amount || 0), 0);
    const net = b.reduce((s: number, x: any) => s + parseFloat(x.net_amount || 0), 0);
    const collected = p.reduce((s: number, x: any) => s + parseFloat(x.amount || 0), 0);
    const outstanding = b.reduce((s: number, x: any) => s + parseFloat(x.balance_amount || 0), 0);
    const advTotal = a.reduce((s: number, x: any) => s + parseFloat(x.amount || 0), 0);
    const chargeTotal = c.reduce((s: number, x: any) => s + parseFloat(x.amount || 0), 0);

    // By type
    const byType: Record<string, { count: number; revenue: number }> = {};
    for (const bill of b) {
      const t = bill.bill_type || 'other';
      if (!byType[t]) byType[t] = { count: 0, revenue: 0 };
      byType[t].count++;
      byType[t].revenue += parseFloat(bill.net_amount || 0);
    }

    // By payor
    const byPayor: Record<string, { count: number; revenue: number }> = {};
    for (const bill of b) {
      const t = bill.payor_type || 'self';
      if (!byPayor[t]) byPayor[t] = { count: 0, revenue: 0 };
      byPayor[t].count++;
      byPayor[t].revenue += parseFloat(bill.net_amount || 0);
    }

    // By payment mode
    const byMode: Record<string, number> = {};
    for (const pay of p) {
      const m = pay.payment_mode || 'cash';
      byMode[m] = (byMode[m] || 0) + parseFloat(pay.amount || 0);
    }

    setStats({ gross, discount, net, collected, outstanding, advTotal, chargeTotal, billCount: b.length, paymentCount: p.length, chargeCount: c.length, byType, byPayor, byMode });
    setLoading(false);
  }, [centreId, period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-24 bg-gray-200 rounded-xl" /><div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div></div>;
  if (!stats) return <div className="text-center py-8 text-gray-400">No data</div>;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-1">
        {(['today', 'week', 'month'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${period === p ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
            {p === 'today' ? 'Today' : p === 'week' ? 'Last 7 Days' : 'This Month'}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-2 py-1 text-[10px] bg-gray-100 rounded">↻ Refresh</button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-7 gap-2">
        {[
          ['Gross Revenue', stats.gross, 'text-gray-700', 'bg-gray-50'],
          ['Discount', stats.discount, 'text-red-700', 'bg-red-50'],
          ['Net Revenue', stats.net, 'text-blue-700', 'bg-blue-50'],
          ['Collected', stats.collected, 'text-green-700', 'bg-green-50'],
          ['Outstanding', stats.outstanding, 'text-orange-700', 'bg-orange-50'],
          ['Advances', stats.advTotal, 'text-purple-700', 'bg-purple-50'],
          ['Charges Posted', stats.chargeTotal, 'text-teal-700', 'bg-teal-50'],
        ].map(([label, value, color, bg]) => (
          <div key={label as string} className={`${bg} rounded-xl p-3 text-center`}>
            <div className="text-[9px] text-gray-500 uppercase">{label as string}</div>
            <div className={`text-lg font-bold ${color}`}>{INR(value as number)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* By bill type */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3">Revenue by Type</h3>
          <div className="space-y-2">
            {Object.entries(stats.byType).sort((a: any, b: any) => b[1].revenue - a[1].revenue).map(([type, data]: any) => (
              <div key={type} className="flex justify-between items-center">
                <div><span className="text-xs font-medium uppercase">{type}</span><span className="text-[10px] text-gray-400 ml-1">({data.count})</span></div>
                <span className="text-xs font-bold">{INR(data.revenue)}</span>
              </div>
            ))}
            {Object.keys(stats.byType).length === 0 && <div className="text-xs text-gray-400">No bills yet</div>}
          </div>
        </div>

        {/* By payor */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3">Revenue by Payor</h3>
          <div className="space-y-2">
            {Object.entries(stats.byPayor).sort((a: any, b: any) => b[1].revenue - a[1].revenue).map(([payor, data]: any) => (
              <div key={payor} className="flex justify-between items-center">
                <div><span className="text-xs font-medium">{payor.replace('_', ' ')}</span><span className="text-[10px] text-gray-400 ml-1">({data.count})</span></div>
                <span className="text-xs font-bold">{INR(data.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By payment mode */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3">Collections by Mode</h3>
          <div className="space-y-2">
            {Object.entries(stats.byMode).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).map(([mode, amount]: any) => (
              <div key={mode} className="flex justify-between items-center">
                <span className="text-xs font-medium capitalize">{mode.replace('_', ' ')}</span>
                <span className="text-xs font-bold text-green-700">{INR(amount)}</span>
              </div>
            ))}
            {Object.keys(stats.byMode).length === 0 && <div className="text-xs text-gray-400">No payments yet</div>}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-gray-400 text-right">{stats.billCount} bills, {stats.paymentCount} payments, {stats.chargeCount} charges | Last updated: {new Date().toLocaleTimeString('en-IN')}</div>
    </div>
  );
}
