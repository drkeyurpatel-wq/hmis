'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useReferrals } from '@/lib/modules/module-hooks';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, X, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

function RefInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const ref = useReferrals(centreId);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState(''); const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [search, setSearch] = useState(''); const [sf, setSf] = useState('all');
  const [patSearch, setPatSearch] = useState(''); const [patResults, setPatResults] = useState<any[]>([]); const [selPat, setSelPat] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);

  React.useEffect(() => { if (centreId) sb().from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true).then(({ data }: any) => setDoctors(data || [])); }, [centreId]);
  React.useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => { const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name').or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%`).eq('is_active', true).limit(5); setPatResults(data || []); }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const [form, setForm] = useState({ referral_type: 'external_in', referring_doctor_name: '', referring_doctor_phone: '', referring_hospital: '', referring_city: '', referred_to_doctor_id: '', referred_to_department: '', reason: '', diagnosis: '', urgency: 'routine', expected_revenue: '', referral_fee_pct: '' });

  const handleCreate = async () => {
    if (!form.referring_doctor_name || !selPat) return;
    const feeAmt = form.expected_revenue && form.referral_fee_pct ? parseFloat(form.expected_revenue) * parseFloat(form.referral_fee_pct) / 100 : 0;
    const res = await ref.create({ ...form, patient_id: selPat.id, expected_revenue: form.expected_revenue ? parseFloat(form.expected_revenue) : 0, referral_fee_pct: form.referral_fee_pct ? parseFloat(form.referral_fee_pct) : 0, referral_fee_amount: feeAmt });
    if (res.success) { flash('Referral logged'); setShowNew(false); setSelPat(null); }
  };

  const filtered = useMemo(() => {
    let l = ref.referrals;
    if (sf !== 'all') l = l.filter(r => r.status === sf);
    if (search) { const q = search.toLowerCase(); l = l.filter(r => r.referring_doctor_name?.toLowerCase().includes(q) || r.patient?.first_name?.toLowerCase().includes(q)); }
    return l;
  }, [ref.referrals, sf, search]);

  const topRef = useMemo(() => ref.stats.topReferrers.slice(0, 8).map(([n, c]: any) => ({ name: (n as string).split(' ').pop(), count: c })), [ref.stats]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Referral Management</h1><p className="text-xs text-gray-400">Revenue share tracking</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Log Referral</button>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {[{ l:'Total', v:ref.stats.total, c:'text-gray-800' }, { l:'This Month', v:ref.stats.thisMonth, c:'text-blue-700' }, { l:'Converted', v:ref.stats.converted, c:'text-emerald-700' }, { l:'Conv Rate', v:ref.stats.conversionRate+'%', c:'text-teal-700' }, { l:'Revenue', v:INR(ref.stats.revenue), c:'text-purple-700' }, { l:'Fees Pending', v:`${ref.stats.feesPending} (${INR(ref.stats.feesPendingAmt)})`, c:ref.stats.feesPending > 0 ? 'text-red-600' : 'text-gray-400' }].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      {topRef.length > 0 && <div className="bg-white rounded-2xl border p-5"><h3 className="text-sm font-bold mb-3">Top Referring Doctors</h3>
        <ResponsiveContainer width="100%" height={120}><BarChart data={topRef}><XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={20} /></BarChart></ResponsiveContainer></div>}

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg" placeholder="Search..." /></div>
          {['all', 'received', 'visited', 'admitted', 'completed', 'lost'].map(s => <button key={s} onClick={() => { setSf(s); ref.load({ status: s }); }} className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg ${sf === s ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{s === 'all' ? 'All' : s}</button>)}
        </div>
        <table className="h1-table"><thead><tr><th>Referring Doctor</th><th>Hospital</th><th>Patient</th><th>Department</th><th>Urgency</th><th>Status</th><th className="text-right">Revenue</th><th className="text-right">Fee</th><th>Actions</th></tr></thead>
          <tbody>{filtered.map(r => (
            <tr key={r.id}>
              <td><div className="font-semibold">{r.referring_doctor_name || '—'}</div><div className="text-[10px] text-gray-400">{r.referring_doctor_phone}</div></td>
              <td className="text-[11px]">{r.referring_hospital || '—'}</td>
              <td><div className="font-medium">{r.patient?.first_name} {r.patient?.last_name}</div><div className="text-[10px] text-gray-400">{r.patient?.uhid}</div></td>
              <td className="text-teal-700 text-[11px]">{r.referred_to_department || '—'}</td>
              <td><span className={`h1-badge ${r.urgency === 'emergency' ? 'h1-badge-red' : r.urgency === 'urgent' ? 'h1-badge-amber' : 'h1-badge-gray'}`}>{r.urgency}</span></td>
              <td><span className={`h1-badge ${r.status === 'completed' ? 'h1-badge-green' : r.status === 'admitted' ? 'h1-badge-blue' : r.status === 'lost' ? 'h1-badge-red' : 'h1-badge-gray'}`}>{r.status}</span></td>
              <td className="text-right font-bold">{r.actual_revenue > 0 ? `₹${fmt(r.actual_revenue)}` : '—'}</td>
              <td className="text-right">{r.referral_fee_amount > 0 ? <span className={r.fee_paid ? 'text-emerald-600' : 'text-red-600'}>₹{fmt(r.referral_fee_amount)} {r.fee_paid ? '✓' : '⏳'}</span> : '—'}</td>
              <td><select value={r.status} onChange={e => ref.update(r.id, { status: e.target.value })} className="text-[10px] border rounded-lg px-2 py-1">
                {['received', 'appointment_made', 'visited', 'admitted', 'completed', 'lost'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select></td>
            </tr>
          ))}{filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No referrals</td></tr>}</tbody>
        </table>
      </div>

      {/* LOG REFERRAL MODAL */}
      {showNew && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}><div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h2 className="text-lg font-bold">Log Referral</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
        {selPat ? <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200"><div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid}</div><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button></div>
        : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />{patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Referring Doctor *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.referring_doctor_name} onChange={e => setForm(f => ({ ...f, referring_doctor_name: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Doctor Phone</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.referring_doctor_phone} onChange={e => setForm(f => ({ ...f, referring_doctor_phone: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Hospital</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.referring_hospital} onChange={e => setForm(f => ({ ...f, referring_hospital: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">City</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.referring_city} onChange={e => setForm(f => ({ ...f, referring_city: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Referred to Doctor</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.referred_to_doctor_id} onChange={e => setForm(f => ({ ...f, referred_to_doctor_id: e.target.value }))}><option value="">Select</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} — {d.specialisation || ''}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Department</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.referred_to_department} onChange={e => setForm(f => ({ ...f, referred_to_department: e.target.value }))}><option value="">Select</option>{['Cardiology', 'Orthopaedics', 'Neurology', 'Neurosurgery', 'General Surgery', 'Urology', 'Gastroenterology', 'Nephrology', 'CTVS', 'Gynaecology'].map(d => <option key={d}>{d}</option>)}</select></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Reason</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. For PTCA, Knee replacement" /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Urgency</label><div className="flex gap-1 mt-1">{['emergency', 'urgent', 'routine'].map(u => <button key={u} onClick={() => setForm(f => ({ ...f, urgency: u }))} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize ${form.urgency === u ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{u}</button>)}</div></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Expected Revenue ₹</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.expected_revenue} onChange={e => setForm(f => ({ ...f, expected_revenue: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Referral Fee %</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.referral_fee_pct} onChange={e => setForm(f => ({ ...f, referral_fee_pct: e.target.value }))} placeholder="e.g. 10" /></div>
          {form.expected_revenue && form.referral_fee_pct && <div className="text-xs text-gray-500">Fee: ₹{fmt(parseFloat(form.expected_revenue) * parseFloat(form.referral_fee_pct) / 100)}</div>}
        </div>
        <button onClick={handleCreate} disabled={!selPat || !form.referring_doctor_name} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Log Referral</button>
      </div></div>}
    </div>
  );
}
export default function ReferralsPage() { return <RoleGuard module="billing"><RefInner /></RoleGuard>; }
