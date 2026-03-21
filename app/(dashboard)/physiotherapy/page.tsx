'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { usePhysio } from '@/lib/modules/module-hooks';
import { Plus } from 'lucide-react';

function PhysioInner() {
  const { activeCentreId } = useAuthStore();
  const { sessions, plans, stats } = usePhysio(activeCentreId || '');
  const [tab, setTab] = useState<'sessions' | 'plans'>('sessions');

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Physiotherapy & Rehab</h1><p className="text-xs text-gray-400">{stats.activePlans} plans · {stats.todaySessions} sessions today</p></div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold"><Plus size={15} /> New Session</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[{ label: 'Today', value: stats.todaySessions, c: 'text-gray-800' }, { label: 'Done', value: stats.completed, c: 'text-emerald-700' }, { label: 'Plans', value: stats.activePlans, c: 'text-blue-700' }, { label: 'No Shows', value: stats.noShows, c: stats.noShows > 0 ? 'text-red-600' : 'text-gray-400' }].map(s => (
          <div key={s.label} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.label}</div><div className={`text-2xl font-black ${s.c}`}>{s.value}</div></div>
        ))}
      </div>
      <div className="flex gap-1">{['sessions', 'plans'].map(t => <button key={t} onClick={() => setTab(t as any)} className={`px-3.5 py-2 text-xs font-medium rounded-xl capitalize ${tab === t ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border'}`}>{t}</button>)}</div>

      {tab === 'sessions' && <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table"><thead><tr><th>Patient</th><th>Therapist</th><th>Area</th><th>Modalities</th><th>Pain Before→After</th><th>Duration</th><th>Status</th></tr></thead>
          <tbody>{sessions.map(s => (<tr key={s.id}><td><div className="font-semibold">{s.patient?.first_name} {s.patient?.last_name}</div><div className="text-[10px] text-gray-400">{s.patient?.uhid}</div></td><td className="text-[11px]">{s.therapist?.full_name?.split(' ').pop() || '—'}</td><td className="capitalize">{s.treatment_area || '—'}</td><td className="text-[10px] uppercase">{(s.modalities || []).join(', ') || '—'}</td><td>{s.pain_score_before != null ? `${s.pain_score_before} → ${s.pain_score_after ?? '?'}` : '—'}</td><td>{s.duration_minutes}min</td><td><span className={`h1-badge ${s.status === 'completed' ? 'h1-badge-green' : s.status === 'no_show' ? 'h1-badge-red' : 'h1-badge-blue'} capitalize`}>{s.status?.replace('_', ' ')}</span></td></tr>))}
            {sessions.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sessions today</td></tr>}</tbody></table>
      </div>}

      {tab === 'plans' && <div className="grid grid-cols-2 gap-3">
        {plans.map(p => (<div key={p.id} className="bg-white rounded-2xl border p-4">
          <div className="flex justify-between mb-2"><div><div className="font-bold">{p.patient?.first_name} {p.patient?.last_name}</div><div className="text-[10px] text-gray-400">{p.diagnosis}</div></div><span className="h1-badge h1-badge-green">{p.status}</span></div>
          <div className="text-xs text-gray-600 mb-2">{p.treatment_plan}</div>
          <div className="flex justify-between text-[10px]"><span>Progress: <b>{p.sessions_completed}/{p.total_sessions_planned}</b></span><span className="text-gray-400">{p.frequency}</span></div>
          <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${p.total_sessions_planned > 0 ? (p.sessions_completed / p.total_sessions_planned) * 100 : 0}%` }} /></div>
        </div>))}
        {plans.length === 0 && <div className="col-span-2 text-center py-12 bg-white rounded-2xl border text-gray-400">No active plans</div>}
      </div>}
    </div>
  );
}
export default function PhysioPage() { return <RoleGuard module="ipd"><PhysioInner /></RoleGuard>; }
