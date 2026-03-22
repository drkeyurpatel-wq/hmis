'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { usePhysio } from '@/lib/modules/module-hooks';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, X, Activity } from 'lucide-react';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

const MODALITIES = ['ift', 'tens', 'us', 'swd', 'laser', 'wax', 'traction', 'cpm', 'hot_pack', 'cold_pack', 'exercise'];
const AREAS = ['knee', 'shoulder', 'spine', 'hip', 'ankle', 'wrist', 'elbow', 'neck', 'back', 'neuro', 'cardiac', 'chest'];

function PhysioInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || ''; const staffId = staff?.id || '';
  const { sessions, plans, stats, load, createSession, updateSession, createPlan } = usePhysio(centreId);
  const [tab, setTab] = useState<'sessions' | 'plans'>('sessions');
  const [showNew, setShowNew] = useState(false); const [showPlan, setShowPlan] = useState(false);
  const [toast, setToast] = useState(''); const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [patSearch, setPatSearch] = useState(''); const [patResults, setPatResults] = useState<any[]>([]); const [selPat, setSelPat] = useState<any>(null);
  const [therapists, setTherapists] = useState<any[]>([]);

  useEffect(() => { if (centreId) sb().from('hmis_staff').select('id, full_name').or('staff_type.eq.doctor,staff_type.eq.nurse,staff_type.eq.technician').eq('is_active', true).then(({ data }: any) => setTherapists(data || [])); }, [centreId]);
  useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => { const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender').or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%`).eq('is_active', true).limit(5); setPatResults(data || []); }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const [form, setForm] = useState({ therapist_id: '', diagnosis: '', treatment_area: 'knee', modalities: [] as string[], exercises: '', manual_therapy: '', pain_score_before: '', duration_minutes: '30' });
  const [planForm, setPlanForm] = useState({ therapist_id: '', diagnosis: '', goals: '', treatment_plan: '', total_sessions_planned: '10', frequency: 'alternate' });

  const toggleModality = (m: string) => setForm(f => ({ ...f, modalities: f.modalities.includes(m) ? f.modalities.filter(x => x !== m) : [...f.modalities, m] }));

  const handleCreateSession = async () => {
    if (!selPat || !form.therapist_id) return;
    const res = await createSession({ patient_id: selPat.id, session_date: new Date().toISOString().split('T')[0], ...form, pain_score_before: form.pain_score_before ? parseInt(form.pain_score_before) : null, duration_minutes: parseInt(form.duration_minutes) || 30, exercises: form.exercises ? form.exercises.split(',').map(s => s.trim()) : [] });
    if (res.success) { flash('Session created'); setShowNew(false); setSelPat(null); }
  };

  const handleCreatePlan = async () => {
    if (!selPat || !planForm.therapist_id) return;
    const res = await createPlan({ patient_id: selPat.id, start_date: new Date().toISOString().split('T')[0], ...planForm, total_sessions_planned: parseInt(planForm.total_sessions_planned) || 10, goals: planForm.goals ? planForm.goals.split(',').map(s => s.trim()) : [] });
    if (res.success) { flash('Plan created'); setShowPlan(false); setSelPat(null); }
  };

  const completeSession = (id: string, painAfter: number) => { updateSession(id, { status: 'completed', pain_score_after: painAfter }); flash('Session completed'); };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Physiotherapy & Rehab</h1><p className="text-xs text-gray-400">{stats.activePlans} plans · {stats.todaySessions} sessions today</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowPlan(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white text-teal-700 text-sm rounded-xl font-semibold border border-teal-200 hover:bg-teal-50"><Plus size={15} /> New Plan</button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> New Session</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[{ l:'Today', v:stats.todaySessions, c:'text-gray-800' }, { l:'Completed', v:stats.completed, c:'text-emerald-700' }, { l:'Active Plans', v:stats.activePlans, c:'text-blue-700' }, { l:'No Shows', v:stats.noShows, c:stats.noShows > 0 ? 'text-red-600' : 'text-gray-400' }].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="flex gap-1">{['sessions', 'plans'].map(t => <button key={t} onClick={() => setTab(t as any)} className={`px-3.5 py-2 text-xs font-medium rounded-xl capitalize ${tab === t ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'}`}>{t === 'sessions' ? 'Today Sessions' : 'Treatment Plans'}</button>)}</div>

      {tab === 'sessions' && <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table"><thead><tr><th>Patient</th><th>Therapist</th><th>Area</th><th>Modalities</th><th>Pain Before</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{sessions.map(s => (
            <tr key={s.id}>
              <td><div className="font-semibold">{s.patient?.first_name} {s.patient?.last_name}</div><div className="text-[10px] text-gray-400">{s.patient?.uhid}</div></td>
              <td className="text-[11px]">{s.therapist?.full_name?.split(' ').pop() || '—'}</td>
              <td className="capitalize">{s.treatment_area || '—'}</td>
              <td className="text-[10px] uppercase">{(s.modalities || []).join(', ') || '—'}</td>
              <td>{s.pain_score_before != null ? <span className="font-bold">{s.pain_score_before}/10</span> : '—'}</td>
              <td>{s.duration_minutes}min</td>
              <td><span className={`h1-badge ${s.status === 'completed' ? 'h1-badge-green' : s.status === 'no_show' ? 'h1-badge-red' : s.status === 'in_progress' ? 'h1-badge-amber' : 'h1-badge-blue'} capitalize`}>{s.status?.replace('_', ' ')}</span></td>
              <td><div className="flex gap-1">
                {s.status === 'scheduled' && <button onClick={() => updateSession(s.id, { status: 'in_progress' })} className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-lg font-medium">Start</button>}
                {s.status === 'in_progress' && <><input type="number" placeholder="Pain after" className="w-16 px-2 py-1 border rounded-lg text-[10px]" onKeyDown={e => { if (e.key === 'Enter') completeSession(s.id, parseInt((e.target as any).value) || 0); }} /><button onClick={() => completeSession(s.id, 0)} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium">Done</button></>}
                {s.status === 'scheduled' && <button onClick={() => updateSession(s.id, { status: 'no_show' })} className="px-2 py-1 text-red-500 text-[10px]">No Show</button>}
              </div></td>
            </tr>
          ))}{sessions.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No sessions today</td></tr>}</tbody></table>
      </div>}

      {tab === 'plans' && <div className="grid grid-cols-2 gap-3">
        {plans.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border p-4">
            <div className="flex justify-between mb-2"><div><div className="font-bold">{p.patient?.first_name} {p.patient?.last_name}</div><div className="text-[10px] text-gray-400">{p.patient?.uhid} · {p.diagnosis}</div></div><span className="h1-badge h1-badge-green">{p.status}</span></div>
            <div className="text-xs text-gray-600 mb-2">{p.treatment_plan}</div>
            {p.goals?.length > 0 && <div className="flex gap-1 flex-wrap mb-2">{p.goals.map((g: string, i: number) => <span key={i} className="h1-badge h1-badge-blue text-[8px]">{g}</span>)}</div>}
            <div className="flex justify-between text-[10px]"><span>Progress: <b>{p.sessions_completed}/{p.total_sessions_planned}</b></span><span className="text-gray-400">{p.frequency} · {p.therapist?.full_name?.split(' ').pop()}</span></div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${p.total_sessions_planned > 0 ? (p.sessions_completed / p.total_sessions_planned) * 100 : 0}%` }} /></div>
          </div>
        ))}
        {plans.length === 0 && <div className="col-span-2 text-center py-12 bg-white rounded-2xl border text-gray-400">No active plans</div>}
      </div>}

      {/* SESSION MODAL */}
      {showNew && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}><div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h2 className="text-lg font-bold">New Session</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
        {selPat ? <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200"><div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid}</div><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button></div>
        : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />{patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Therapist *</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.therapist_id} onChange={e => setForm(f => ({ ...f, therapist_id: e.target.value }))}><option value="">Select</option>{therapists.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Area</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.treatment_area} onChange={e => setForm(f => ({ ...f, treatment_area: e.target.value }))}>{AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Modalities</label><div className="flex gap-1 mt-1 flex-wrap">{MODALITIES.map(m => (
            <button key={m} onClick={() => toggleModality(m)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase ${form.modalities.includes(m) ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{m}</button>
          ))}</div></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Pain Score (0-10)</label><input type="number" min="0" max="10" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.pain_score_before} onChange={e => setForm(f => ({ ...f, pain_score_before: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Duration (min)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} /></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Diagnosis</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="e.g. Post TKR rehab, Frozen shoulder" /></div>
        </div>
        <button onClick={handleCreateSession} disabled={!selPat || !form.therapist_id} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Create Session</button>
      </div></div>}

      {/* PLAN MODAL */}
      {showPlan && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPlan(false)}><div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h2 className="text-lg font-bold">New Treatment Plan</h2><button onClick={() => setShowPlan(false)}><X size={18} className="text-gray-400" /></button></div>
        {selPat ? <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200"><div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid}</div><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button></div>
        : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />{patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Therapist *</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={planForm.therapist_id} onChange={e => setPlanForm(f => ({ ...f, therapist_id: e.target.value }))}><option value="">Select</option>{therapists.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Frequency</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={planForm.frequency} onChange={e => setPlanForm(f => ({ ...f, frequency: e.target.value }))}>{['daily', 'alternate', 'twice_week', 'weekly'].map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}</select></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Diagnosis</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={planForm.diagnosis} onChange={e => setPlanForm(f => ({ ...f, diagnosis: e.target.value }))} /></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Goals (comma separated)</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={planForm.goals} onChange={e => setPlanForm(f => ({ ...f, goals: e.target.value }))} placeholder="e.g. Pain reduction, ROM improvement, Return to activity" /></div>
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Treatment Plan</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-16 resize-none" value={planForm.treatment_plan} onChange={e => setPlanForm(f => ({ ...f, treatment_plan: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Total Sessions</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={planForm.total_sessions_planned} onChange={e => setPlanForm(f => ({ ...f, total_sessions_planned: e.target.value }))} /></div>
        </div>
        <button onClick={handleCreatePlan} disabled={!selPat || !planForm.therapist_id} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Create Plan</button>
      </div></div>}
    </div>
  );
}
export default function PhysioPage() { return <RoleGuard module="ipd"><PhysioInner /></RoleGuard>; }
