'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDialysis } from '@/lib/modules/module-hooks';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, X, Play, Square, Clock } from 'lucide-react';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

function DialysisInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { sessions, machines, stats, load, scheduleSession, updateSession } = useDialysis(centreId);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);

  useEffect(() => {
    if (!centreId) return;
    sb().from('hmis_staff').select('id, full_name, staff_type, specialisation').eq('is_active', true)
      .then(({ data }: any) => { setDoctors((data || []).filter((s: any) => s.staff_type === 'doctor')); setTechs((data || []).filter((s: any) => ['technician', 'nurse'].includes(s.staff_type))); });
  }, [centreId]);

  useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const [form, setForm] = useState({ machine_id: '', dialysis_type: 'hd', access_type: 'av_fistula', pre_weight: '', pre_bp: '', pre_pulse: '', target_uf: '', dialyzer_type: '', blood_flow_rate: '300', dialysate_flow_rate: '500', heparin_dose: '', duration_minutes: '240', doctor_id: '', technician_id: '' });

  const handleSchedule = async () => {
    if (!selPat || !form.machine_id) return;
    const res = await scheduleSession({
      patient_id: selPat.id, session_date: date, ...form,
      pre_weight: form.pre_weight ? parseFloat(form.pre_weight) : null,
      pre_pulse: form.pre_pulse ? parseInt(form.pre_pulse) : null,
      target_uf: form.target_uf ? parseFloat(form.target_uf) : null,
      blood_flow_rate: parseInt(form.blood_flow_rate) || 300,
      dialysate_flow_rate: parseInt(form.dialysate_flow_rate) || 500,
      duration_minutes: parseInt(form.duration_minutes) || 240,
    });
    if (res.success) { flash('Session scheduled'); setShowNew(false); setSelPat(null); }
    else flash(res.error || 'Failed');
  };

  const startSession = (id: string) => { updateSession(id, { status: 'in_progress', actual_start: new Date().toISOString() }); flash('Session started'); };

  const endSession = (id: string) => {
    const s = sessions.find(x => x.id === id);
    const started = s?.actual_start ? new Date(s.actual_start) : new Date();
    const dur = Math.round((Date.now() - started.getTime()) / 60000);
    updateSession(id, { status: 'completed', actual_end: new Date().toISOString(), duration_minutes: dur });
    flash('Session completed');
  };

  useEffect(() => { load(date); }, [date]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Dialysis Unit</h1><p className="text-xs text-gray-400">{stats.machinesTotal} machines · {stats.totalToday} sessions</p></div>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Schedule Session</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {[
          { l: 'Scheduled', v: stats.scheduled, c: 'text-blue-700' }, { l: 'In Progress', v: stats.inProgress, c: 'text-amber-700' },
          { l: 'Completed', v: stats.completed, c: 'text-emerald-700' }, { l: 'Today', v: stats.totalToday, c: 'text-gray-800' },
          { l: 'Machines Free', v: stats.machinesAvailable, c: 'text-emerald-700' }, { l: 'Machines Busy', v: stats.machinesInUse, c: 'text-amber-700' },
          { l: 'Total Machines', v: stats.machinesTotal, c: 'text-gray-800' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      {/* Machine grid */}
      <div className="grid grid-cols-6 gap-2">
        {machines.map(m => {
          const activeSession = sessions.find(s => s.machine_id === m.id && s.status === 'in_progress');
          return (
            <div key={m.id} className={`rounded-xl border-2 p-3 ${m.status === 'in_use' ? 'bg-amber-50 border-amber-200' : m.status === 'available' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-black">{m.machine_number}</span>
                <span className={`h1-badge ${m.status === 'available' ? 'h1-badge-green' : m.status === 'in_use' ? 'h1-badge-amber' : 'h1-badge-red'} uppercase text-[8px]`}>{m.status?.replace('_', ' ')}</span>
              </div>
              <div className="text-[10px] text-gray-500">{m.brand} {m.model}</div>
              {activeSession && (
                <div className="mt-2 text-[10px]">
                  <div className="font-semibold text-gray-800">{activeSession.patient?.first_name} {activeSession.patient?.last_name}</div>
                  <div className="text-gray-400">UF: {activeSession.target_uf || '—'}ml · {activeSession.duration_minutes}min</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sessions table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table">
          <thead><tr><th>Patient</th><th>Machine</th><th>Type</th><th>Access</th><th>Pre Wt/BP</th><th>Target UF</th><th>BFR/DFR</th><th>Duration</th><th>Tech</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id}>
                <td><div className="font-semibold">{s.patient?.first_name} {s.patient?.last_name}</div><div className="text-[10px] text-gray-400">{s.patient?.uhid}</div></td>
                <td className="font-bold">{s.machine?.machine_number || '—'}</td>
                <td><span className="h1-badge h1-badge-blue uppercase">{s.dialysis_type}</span></td>
                <td className="capitalize text-[11px]">{s.access_type?.replace('_', ' ') || '—'}</td>
                <td className="text-[11px]">{s.pre_weight ? `${s.pre_weight}kg` : '—'} / {s.pre_bp || '—'}</td>
                <td className="font-medium">{s.target_uf ? `${s.target_uf}ml` : '—'}</td>
                <td className="text-[11px]">{s.blood_flow_rate || '—'}/{s.dialysate_flow_rate || '—'}</td>
                <td>{s.duration_minutes}min</td>
                <td className="text-[11px]">{s.tech?.full_name?.split(' ').pop() || '—'}</td>
                <td><span className={`h1-badge ${s.status === 'completed' ? 'h1-badge-green' : s.status === 'in_progress' ? 'h1-badge-amber' : 'h1-badge-blue'} capitalize`}>{s.status?.replace('_', ' ')}</span></td>
                <td>
                  <div className="flex gap-1">
                    {s.status === 'scheduled' && <button onClick={() => startSession(s.id)} className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-lg font-medium"><Play size={10} className="inline mr-0.5" />Start</button>}
                    {s.status === 'in_progress' && <button onClick={() => endSession(s.id)} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium"><Square size={10} className="inline mr-0.5" />End</button>}
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-gray-400">No sessions on {date}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* SCHEDULE MODAL */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Schedule Dialysis Session</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>

            {selPat ? (
              <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid}</div>
                <button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button></div>
            ) : (
              <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />
                {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Machine *</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.machine_id} onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))}>
                  <option value="">Select</option>{machines.filter(m => m.status === 'available').map(m => <option key={m.id} value={m.id}>{m.machine_number} ({m.brand})</option>)}
                </select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Type</label>
                <div className="flex gap-1 mt-1">{['hd', 'hdf', 'pd', 'crrt', 'sled'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, dialysis_type: t }))} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase ${form.dialysis_type === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
                ))}</div></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Access</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.access_type} onChange={e => setForm(f => ({ ...f, access_type: e.target.value }))}>
                  {['av_fistula', 'av_graft', 'catheter_perm', 'catheter_temp'].map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Pre Weight (kg)</label><input type="number" step="0.1" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.pre_weight} onChange={e => setForm(f => ({ ...f, pre_weight: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Pre BP</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.pre_bp} onChange={e => setForm(f => ({ ...f, pre_bp: e.target.value }))} placeholder="120/80" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Target UF (ml)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.target_uf} onChange={e => setForm(f => ({ ...f, target_uf: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">BFR (ml/min)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.blood_flow_rate} onChange={e => setForm(f => ({ ...f, blood_flow_rate: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">DFR (ml/min)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.dialysate_flow_rate} onChange={e => setForm(f => ({ ...f, dialysate_flow_rate: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Duration (min)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Doctor</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}><option value="">Select</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Technician</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.technician_id} onChange={e => setForm(f => ({ ...f, technician_id: e.target.value }))}><option value="">Select</option>{techs.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Heparin</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.heparin_dose} onChange={e => setForm(f => ({ ...f, heparin_dose: e.target.value }))} placeholder="e.g. 5000 IU bolus" /></div>
            </div>
            <button onClick={handleSchedule} disabled={!selPat || !form.machine_id} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700">Schedule Session</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function DialysisPage() { return <RoleGuard module="ipd"><DialysisInner /></RoleGuard>; }
