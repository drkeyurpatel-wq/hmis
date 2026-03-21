'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createBrowserClient } from '@supabase/ssr';
import { useEmergency } from '@/lib/modules/module-hooks';
import { AlertTriangle, Plus, Phone, Clock, X, Search, Activity } from 'lucide-react';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

const TRIAGE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  red: { bg: 'bg-red-600', text: 'text-white', label: 'Immediate' },
  orange: { bg: 'bg-orange-500', text: 'text-white', label: 'Very Urgent' },
  yellow: { bg: 'bg-yellow-400', text: 'text-gray-900', label: 'Urgent' },
  green: { bg: 'bg-emerald-500', text: 'text-white', label: 'Standard' },
  black: { bg: 'bg-gray-900', text: 'text-white', label: 'Deceased' },
};

function ERInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const er = useEmergency(centreId);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Patient search
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);

  const [form, setForm] = useState({ arrival_mode: 'walk_in', triage_category: 'yellow', chief_complaint: '', is_trauma: false, is_mlc: false, trauma_type: '', mlc_number: '', police_station: '', vitals: { bp: '', hr: '', rr: '', spo2: '', temp: '', gcs: '' } });

  useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const handleRegister = async () => {
    if (!selPat) return;
    const gcs = parseInt(form.vitals.gcs) || undefined;
    const res = await er.register({
      patient_id: selPat.id, arrival_mode: form.arrival_mode, triage_category: form.triage_category,
      triage_time: new Date().toISOString(), chief_complaint: form.chief_complaint,
      is_trauma: form.is_trauma, trauma_type: form.trauma_type || null,
      is_mlc: form.is_mlc, mlc_number: form.mlc_number || null, police_station: form.police_station || null,
      gcs_score: gcs, vitals: form.vitals,
    }, staffId);
    if (res.success) { flash('ER visit registered'); setShowNew(false); setSelPat(null); setForm({ arrival_mode: 'walk_in', triage_category: 'yellow', chief_complaint: '', is_trauma: false, is_mlc: false, trauma_type: '', mlc_number: '', police_station: '', vitals: { bp: '', hr: '', rr: '', spo2: '', temp: '', gcs: '' } }); }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Emergency & Triage</h1><p className="text-xs text-gray-400">5 ER Beds · MTS Triage</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm rounded-xl font-semibold hover:bg-red-700"><Plus size={15} /> ER Registration</button>
      </div>

      {/* Triage summary */}
      <div className="grid grid-cols-7 gap-2">
        <div className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Active</div><div className="text-2xl font-black text-gray-800">{er.stats.active}</div></div>
        {Object.entries(TRIAGE_COLORS).filter(([k]) => k !== 'black').map(([key, c]) => (
          <div key={key} className={`${c.bg} rounded-xl px-3 py-3 text-center`}><div className={`text-[9px] ${c.text} uppercase font-semibold opacity-80`}>{c.label}</div>
            <div className={`text-2xl font-black ${c.text}`}>{(er.stats as any)[key] || 0}</div></div>
        ))}
        <div className="bg-gray-900 rounded-xl px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">MLC</div><div className="text-2xl font-black text-amber-400">{er.stats.mlc}</div></div>
        <div className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Total Today</div><div className="text-2xl font-black text-gray-800">{er.stats.total}</div></div>
      </div>

      {/* ER Board */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table">
          <thead><tr><th>Time</th><th>Triage</th><th>Patient</th><th>Complaint</th><th>Vitals</th><th>Mode</th><th>Doctor</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {er.visits.map(v => {
              const tc = TRIAGE_COLORS[v.triage_category] || TRIAGE_COLORS.green;
              const elapsed = Math.floor((Date.now() - new Date(v.arrival_time).getTime()) / 60000);
              return (
                <tr key={v.id} className={v.triage_category === 'red' ? 'bg-red-50/50' : ''}>
                  <td><div className="font-mono text-[10px]">{new Date(v.arrival_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-[9px] text-gray-400">{elapsed}m ago</div></td>
                  <td><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${tc.bg} ${tc.text}`}>
                    <span className="w-2 h-2 rounded-full bg-white/40" />{tc.label}</span>
                    {v.is_mlc && <span className="ml-1 h1-badge h1-badge-amber text-[8px]">MLC</span>}</td>
                  <td><div className="font-semibold">{v.patient?.first_name} {v.patient?.last_name}</div><div className="text-[10px] text-gray-400">{v.patient?.uhid} · {v.patient?.age_years}/{v.patient?.gender?.charAt(0)}</div></td>
                  <td className="max-w-[200px] truncate text-gray-600">{v.chief_complaint || '—'}</td>
                  <td className="text-[10px]">{v.vitals?.bp && `BP:${v.vitals.bp}`} {v.vitals?.hr && `HR:${v.vitals.hr}`} {v.vitals?.spo2 && `SpO2:${v.vitals.spo2}%`}</td>
                  <td><span className="h1-badge h1-badge-gray capitalize">{v.arrival_mode?.replace('_', ' ')}</span></td>
                  <td className="text-[11px]">{v.doctor?.full_name?.split(' ').pop() || '—'}</td>
                  <td><span className={`h1-badge ${v.status === 'triaged' ? 'h1-badge-amber' : v.status === 'being_seen' ? 'h1-badge-blue' : v.status === 'admitted' ? 'h1-badge-green' : 'h1-badge-gray'}`}>{v.status?.replace('_', ' ')}</span></td>
                  <td>
                    <select value={v.status} onChange={e => er.updateStatus(v.id, e.target.value, e.target.value === 'discharged' ? { disposition: 'discharge', disposition_time: new Date().toISOString() } : {})}
                      className="text-[10px] border rounded-lg px-2 py-1">
                      <option value="triaged">Triaged</option><option value="being_seen">Being Seen</option><option value="under_observation">Observation</option>
                      <option value="admitted">Admitted</option><option value="discharged">Discharged</option><option value="referred">Referred</option><option value="dama">DAMA</option>
                    </select>
                  </td>
                </tr>
              );
            })}
            {er.visits.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No ER visits today</td></tr>}
          </tbody>
        </table>
      </div>

      {/* New ER Registration Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold text-red-700">ER Registration</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>

            {/* Patient */}
            {selPat ? (
              <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div className="font-bold">{selPat.first_name} {selPat.last_name}</div>
                <div className="text-xs text-gray-500">{selPat.uhid} · {selPat.age_years}/{selPat.gender?.charAt(0)}</div>
                <button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative">
                <input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />
                {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">
                  {patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} — {p.uhid}</button>)}
                </div>}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Arrival Mode</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.arrival_mode} onChange={e => setForm(f => ({ ...f, arrival_mode: e.target.value }))}>
                  <option value="walk_in">Walk-in</option><option value="ambulance">Ambulance</option><option value="referred">Referred</option><option value="police">Police</option></select></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Triage Category *</label>
                <div className="flex gap-1 mt-1">{Object.entries(TRIAGE_COLORS).filter(([k]) => k !== 'black').map(([k, c]) => (
                  <button key={k} onClick={() => setForm(f => ({ ...f, triage_category: k }))} className={`flex-1 py-2 rounded-lg text-[10px] font-bold ${form.triage_category === k ? `${c.bg} ${c.text}` : 'bg-gray-100 text-gray-500'}`}>{c.label}</button>
                ))}</div></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Chief Complaint *</label>
                <input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))} /></div>
            </div>

            {/* Vitals */}
            <div className="grid grid-cols-6 gap-2">
              {[['bp', 'BP'], ['hr', 'Pulse'], ['rr', 'RR'], ['spo2', 'SpO2'], ['temp', 'Temp'], ['gcs', 'GCS']].map(([k, l]) => (
                <div key={k}><label className="text-[9px] text-gray-500 uppercase">{l}</label>
                  <input className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-xs" value={(form.vitals as any)[k]} onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, [k]: e.target.value } }))} /></div>
              ))}
            </div>

            {/* MLC / Trauma */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_trauma} onChange={e => setForm(f => ({ ...f, is_trauma: e.target.checked }))} className="rounded" /> Trauma</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_mlc} onChange={e => setForm(f => ({ ...f, is_mlc: e.target.checked }))} className="rounded" /> MLC</label>
            </div>
            {form.is_mlc && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-gray-500 uppercase">MLC Number</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.mlc_number} onChange={e => setForm(f => ({ ...f, mlc_number: e.target.value }))} /></div>
                <div><label className="text-[10px] text-gray-500 uppercase">Police Station</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.police_station} onChange={e => setForm(f => ({ ...f, police_station: e.target.value }))} /></div>
              </div>
            )}

            <button onClick={handleRegister} disabled={!selPat || !form.chief_complaint}
              className="w-full py-3 bg-red-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-red-700">Register ER Visit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ERPage() { return <RoleGuard module="opd"><ERInner /></RoleGuard>; }
