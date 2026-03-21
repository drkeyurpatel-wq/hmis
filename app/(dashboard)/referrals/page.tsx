'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useReferrals } from '@/lib/modules/module-hooks';
import { Plus, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

function ReferralsInner() {
  const { activeCentreId } = useAuthStore();
  const ref = useReferrals(activeCentreId || '');
  const [search, setSearch] = useState('');
  const [sf, setSf] = useState('all');

  const filtered = useMemo(() => {
    let l = ref.referrals;
    if (sf !== 'all') l = l.filter(r => r.status === sf);
    if (search) { const q = search.toLowerCase(); l = l.filter(r => r.referring_doctor_name?.toLowerCase().includes(q) || r.patient?.first_name?.toLowerCase().includes(q)); }
    return l;
  }, [ref.referrals, sf, search]);

  const topRef = useMemo(() => ref.stats.topReferrers.slice(0, 8).map(([n, c]: any) => ({ name: (n as string).split(' ').slice(-1)[0], count: c })), [ref.stats]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Referral Management</h1><p className="text-xs text-gray-400">Revenue share tracking</p></div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold"><Plus size={15} /> Log Referral</button>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {[{ l: 'Total', v: ref.stats.total, c: 'text-gray-800' }, { l: 'This Month', v: ref.stats.thisMonth, c: 'text-blue-700' }, { l: 'Converted', v: ref.stats.converted, c: 'text-emerald-700' }, { l: 'Conv Rate', v: ref.stats.conversionRate + '%', c: 'text-teal-700' }, { l: 'Revenue', v: INR(ref.stats.revenue), c: 'text-purple-700' }, { l: 'Fees Pending', v: `${ref.stats.feesPending} (${INR(ref.stats.feesPendingAmt)})`, c: ref.stats.feesPending > 0 ? 'text-red-600' : 'text-gray-400' }].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>
      {topRef.length > 0 && <div className="bg-white rounded-2xl border p-5"><h3 className="text-sm font-bold mb-3">Top Referring Doctors</h3>
        <ResponsiveContainer width="100%" height={120}><BarChart data={topRef}><XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={20} /></BarChart></ResponsiveContainer>
      </div>}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-3"><div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg" placeholder="Search..." /></div>
          {['all', 'received', 'visited', 'admitted', 'completed', 'lost'].map(s => <button key={s} onClick={() => setSf(s)} className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg ${sf === s ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{s === 'all' ? 'All' : s}</button>)}</div>
        <table className="h1-table"><thead><tr><th>Referring Doctor</th><th>Hospital</th><th>Patient</th><th>Department</th><th>Urgency</th><th>Status</th><th className="text-right">Revenue</th><th className="text-right">Fee</th></tr></thead>
          <tbody>{filtered.map(r => (<tr key={r.id}><td><div className="font-semibold">{r.referring_doctor_name || '—'}</div><div className="text-[10px] text-gray-400">{r.referring_doctor_phone}</div></td><td className="text-[11px]">{r.referring_hospital || '—'}</td><td><div className="font-medium">{r.patient?.first_name} {r.patient?.last_name}</div></td><td className="text-teal-700 text-[11px]">{r.referred_to_department || '—'}</td><td><span className={`h1-badge ${r.urgency === 'emergency' ? 'h1-badge-red' : r.urgency === 'urgent' ? 'h1-badge-amber' : 'h1-badge-gray'}`}>{r.urgency}</span></td><td><span className={`h1-badge ${r.status === 'completed' ? 'h1-badge-green' : r.status === 'lost' ? 'h1-badge-red' : 'h1-badge-gray'}`}>{r.status}</span></td><td className="text-right font-bold">{r.actual_revenue > 0 ? `₹${fmt(r.actual_revenue)}` : '—'}</td><td className="text-right">{r.referral_fee_amount > 0 ? <span className={r.fee_paid ? 'text-emerald-600' : 'text-red-600'}>₹{fmt(r.referral_fee_amount)}</span> : '—'}</td></tr>))}
            {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No referrals</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
export default function ReferralsPage() { return <RoleGuard module="billing"><ReferralsInner /></RoleGuard>; }
