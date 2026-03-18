// components/billing/charge-dashboard.tsx
// Real-time charge capture overview — all charges across centre
'use client';
import React, { useState } from 'react';
import { useChargeCapture, type ChargeEntry } from '@/lib/billing/charge-capture-hooks';

const SOURCE_LABELS: Record<string, string> = {
  auto_daily: 'Auto Daily', auto_admission: 'Admission', pharmacy: 'Pharmacy',
  lab: 'Lab', radiology: 'Radiology', procedure: 'Procedure', consumable: 'Consumable',
  manual: 'Manual', barcode_scan: 'Barcode',
};
const SOURCE_COLORS: Record<string, string> = {
  auto_daily: 'bg-gray-100 text-gray-700', pharmacy: 'bg-pink-100 text-pink-700',
  lab: 'bg-blue-100 text-blue-700', radiology: 'bg-indigo-100 text-indigo-700',
  procedure: 'bg-purple-100 text-purple-700', consumable: 'bg-amber-100 text-amber-700',
  manual: 'bg-gray-100 text-gray-600', barcode_scan: 'bg-green-100 text-green-700',
};
const fmt = (n: number) => n >= 100000 ? '₹' + (n / 100000).toFixed(2) + ' L' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface Props { centreId: string; }

export default function ChargeDashboard({ centreId }: Props) {
  const { charges, loading, stats, load } = useChargeCapture(centreId);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const today = new Date().toISOString().split('T')[0];

  const filtered = charges.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-amber-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Pending Post</div><div className="text-xl font-bold text-amber-700">{stats.capturedCount}</div><div className="text-[10px] text-amber-600">{fmt(stats.capturedAmount)}</div></div>
        <div className="bg-green-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Posted to Bills</div><div className="text-xl font-bold text-green-700">{stats.postedCount}</div><div className="text-[10px] text-green-600">{fmt(stats.postedAmount)}</div></div>
        <div className="bg-blue-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Today Total</div><div className="text-xl font-bold text-blue-700">{fmt(stats.totalToday)}</div></div>
        <div className="bg-white rounded-xl border p-3"><div className="text-[9px] text-gray-500 mb-1">By Source</div>
          {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([src, amt]) => (
            <div key={src} className="flex justify-between text-[10px]"><span className="text-gray-500">{SOURCE_LABELS[src] || src}</span><span className="font-medium">{fmt(amt)}</span></div>
          ))}</div>
        <div className="bg-white rounded-xl border p-3"><div className="text-[9px] text-gray-500 mb-1">By Category</div>
          {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, amt]) => (
            <div key={cat} className="flex justify-between text-[10px]"><span className="text-gray-500">{cat.replace('_', ' ')}</span><span className="font-medium">{fmt(amt)}</span></div>
          ))}</div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {['all', 'captured', 'posted', 'reversed'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); load({ status: s }); }}
            className={`px-2 py-1 text-[10px] rounded border ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white'}`}>{s === 'all' ? 'All Status' : s}</button>
        ))}
        <span className="border-l mx-1" />
        {['all', ...Object.keys(stats.bySource)].map(s => (
          <button key={s} onClick={() => setSourceFilter(s)}
            className={`px-2 py-1 text-[10px] rounded border ${sourceFilter === s ? 'bg-blue-600 text-white' : 'bg-white'}`}>{s === 'all' ? 'All Sources' : SOURCE_LABELS[s] || s}</button>
        ))}
        <button onClick={() => load()} className="ml-auto px-2 py-1 text-[10px] bg-gray-100 rounded">Refresh</button>
      </div>

      {/* Charge table */}
      {loading ? <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Loading...</div> :
      filtered.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No charges found</div> :
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b text-gray-500">
          <th className="p-2 text-left">Patient</th><th className="p-2 text-left">Description</th><th className="p-2">Source</th><th className="p-2">Date</th><th className="p-2 text-right">Amount</th><th className="p-2">Status</th>
        </tr></thead><tbody>{filtered.slice(0, 100).map((c: ChargeEntry) => (
          <tr key={c.id} className={`border-b hover:bg-gray-50 ${c.status === 'reversed' ? 'opacity-40 line-through' : ''}`}>
            <td className="p-2"><span className="font-medium">{c.patientName}</span><span className="text-[10px] text-gray-400 ml-1">{c.uhid}</span></td>
            <td className="p-2">{c.description}</td>
            <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[8px] ${SOURCE_COLORS[c.source] || 'bg-gray-100'}`}>{SOURCE_LABELS[c.source] || c.source}</span></td>
            <td className="p-2 text-center text-gray-400">{c.serviceDate}</td>
            <td className="p-2 text-right font-bold">₹{c.amount.toLocaleString('en-IN')}</td>
            <td className="p-2 text-center"><span className={`text-[9px] px-1 py-0.5 rounded ${c.status === 'posted' ? 'bg-green-100 text-green-700' : c.status === 'captured' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span></td>
          </tr>
        ))}</tbody></table>
        {filtered.length > 100 && <div className="text-center text-[10px] text-gray-400 py-2">Showing first 100 of {filtered.length}</div>}
      </div>}
    </div>
  );
}
