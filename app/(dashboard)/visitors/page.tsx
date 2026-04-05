'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useVisitors } from '@/lib/visitors/visitor-hooks';
import { sb } from '@/lib/supabase/browser';
import { Plus, X, Search, Users, LogIn, LogOut, Shield, Clock } from 'lucide-react';
const PASS_BADGE: Record<string, string> = { regular: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', icu: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', nicu: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', isolation: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', emergency: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', attendant: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700' };
const STATUS_BADGE: Record<string, string> = { active: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', checked_in: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', checked_out: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600', expired: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600', revoked: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' };

type Tab = 'active' | 'issue' | 'history';

function VisitorInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const vis = useVisitors(centreId);
  const [tab, setTab] = useState<Tab>('active');
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [search, setSearch] = useState('');

  // Issue form
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);
  const [form, setForm] = useState({ visitor_name: '', visitor_phone: '', relation: 'relative', id_proof_type: 'aadhar', id_proof_number: '', pass_type: 'regular', ward: '', bed: '' });

  // Patient search
  React.useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const handleIssue = async () => {
    if (!form.visitor_name || !selPat) return;
    const res = await vis.issuePass({ ...form, patient_id: selPat.id }, staffId);
    if (res.success) { flash('Visitor pass issued'); setShowNew(false); setSelPat(null); setForm({ visitor_name: '', visitor_phone: '', relation: 'relative', id_proof_type: 'aadhar', id_proof_number: '', pass_type: 'regular', ward: '', bed: '' }); } else { flash(res.error || 'Operation failed'); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activePasses = useMemo(() => vis.passes.filter(p => ['active', 'checked_in'].includes(p.status)), [vis.passes]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const historyPasses = useMemo(() => vis.passes.filter(p => ['checked_out', 'expired', 'revoked'].includes(p.status)), [vis.passes]);

  const filtered = useMemo(() => {
    const list = tab === 'active' ? activePasses : historyPasses;
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(p => p.visitor_name?.toLowerCase().includes(q) || p.patient?.first_name?.toLowerCase().includes(q) || p.pass_number?.toLowerCase().includes(q));
  }, [tab, activePasses, historyPasses, search]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Visitor Management</h1><p className="text-xs text-gray-400">Pass issuance, check-in/out, ICU control</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Issue Pass</button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {[
          { l: 'Today', v: vis.stats.totalToday, c: 'text-gray-800' },
          { l: 'Active', v: vis.stats.active, c: 'text-emerald-700' },
          { l: 'Checked In', v: vis.stats.checkedIn, c: 'text-blue-700' },
          { l: 'Checked Out', v: vis.stats.checkedOut, c: 'text-gray-500' },
          { l: 'ICU Visitors', v: vis.stats.icuVisitors, c: vis.stats.icuVisitors > 0 ? 'text-red-600' : 'text-gray-400' },
          { l: 'Attendants', v: vis.stats.attendants, c: 'text-purple-700' },
          { l: 'Revoked', v: vis.stats.revoked, c: vis.stats.revoked > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1">{(['active', 'history'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-2 text-xs font-medium rounded-xl capitalize ${tab === t ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'}`}>{t === 'active' ? 'Active Visitors' : 'History'}</button>
        ))}</div>
        <div className="relative flex-1 max-w-xs ml-auto"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl" placeholder="Search visitor, patient, pass#..." /></div>
      </div>

      {/* ACTIVE BOARD */}
      {tab === 'active' && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border">
              <Users size={32} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-sm font-medium text-gray-900">No visitor passes issued yet</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Issue a visitor pass to begin tracking hospital visitors.</p>
              <button onClick={() => setShowNew(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700 cursor-pointer"><Plus size={14} /> Issue Pass</button>
            </div>
          ) :
          filtered.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${['icu', 'nicu', 'isolation'].includes(p.pass_type) ? 'border-red-200 bg-red-50/20' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <Users size={18} className="text-teal-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{p.visitor_name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PASS_BADGE[p.pass_type] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} uppercase text-[8px]`}>{p.pass_type}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[p.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} text-[8px]`}>{p.status === 'checked_in' ? 'IN' : p.status}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Visiting: <span className="font-medium">{p.patient?.first_name} {p.patient?.last_name}</span> ({p.patient?.uhid}) · {p.ward || ''} {p.bed || ''}
                </div>
                <div className="text-[9px] text-gray-400">{p.pass_number} · {p.relation} · {p.visitor_phone || ''}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                {p.status === 'active' && <button onClick={() => { vis.checkIn(p.id); flash('Checked in'); }} className="flex items-center gap-1 px-3 py-2 bg-teal-50 text-teal-700 text-xs rounded-xl font-medium hover:bg-teal-100"><LogIn size={12} /> Check In</button>}
                {p.status === 'checked_in' && <button onClick={() => { vis.checkOut(p.id); flash('Checked out'); }} className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs rounded-xl font-medium hover:bg-gray-200"><LogOut size={12} /> Check Out</button>}
                <button onClick={() => { vis.revoke(p.id, staffId, 'Revoked by staff'); flash('Pass revoked'); }} className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-xl text-[10px]">Revoke</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr><th>Pass#</th><th>Visitor</th><th>Patient</th><th>Type</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead>
            <tbody>{filtered.map(p => (
              <tr key={p.id}>
                <td className="font-mono text-[10px]">{p.pass_number}</td>
                <td><div className="font-semibold">{p.visitor_name}</div><div className="text-[10px] text-gray-400">{p.relation} · {p.visitor_phone}</div></td>
                <td className="text-[11px]">{p.patient?.first_name} {p.patient?.last_name}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PASS_BADGE[p.pass_type] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} uppercase text-[8px]`}>{p.pass_type}</span></td>
                <td className="text-[10px] text-gray-500">{p.check_in_time ? new Date(p.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td className="text-[10px] text-gray-500">{p.check_out_time ? new Date(p.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[p.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'}`}>{p.status?.replace('_', ' ')}</span></td>
              </tr>
            ))}{filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No history</td></tr>}</tbody>
          </table>
        </div>
      )}

      {/* ISSUE PASS MODAL */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Issue Visitor Pass</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>

            {/* Patient */}
            {selPat ? (
              <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid}</div>
                <button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />
                {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Visitor Name *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.visitor_name} onChange={e => setForm(f => ({ ...f, visitor_name: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Phone</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.visitor_phone} onChange={e => setForm(f => ({ ...f, visitor_phone: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Relation</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))}>{['spouse', 'parent', 'child', 'sibling', 'friend', 'relative', 'other'].map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Pass Type</label><div className="flex gap-1 mt-1">{['regular', 'icu', 'attendant', 'emergency'].map(p => (
                <button key={p} onClick={() => setForm(f => ({ ...f, pass_type: p }))} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize ${form.pass_type === p ? (p === 'icu' || p === 'emergency' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{p}</button>
              ))}</div></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">ID Proof</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.id_proof_type} onChange={e => setForm(f => ({ ...f, id_proof_type: e.target.value }))}>{['aadhar', 'pan', 'driving_license', 'passport', 'voter_id'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">ID Number</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.id_proof_number} onChange={e => setForm(f => ({ ...f, id_proof_number: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Ward</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Bed</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.bed} onChange={e => setForm(f => ({ ...f, bed: e.target.value }))} /></div>
            </div>
            <button onClick={handleIssue} disabled={!form.visitor_name || !selPat} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700">Issue Visitor Pass</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function VisitorPage() { return <RoleGuard module="ipd"><VisitorInner /></RoleGuard>; }
