'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDialysis } from '@/lib/modules/module-hooks';
import { Plus } from 'lucide-react';

function DialysisInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { sessions, machines, stats } = useDialysis(centreId);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Dialysis Unit</h1><p className="text-xs text-gray-400">{stats.machinesTotal} machines · {stats.totalToday} sessions today</p></div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold"><Plus size={15} /> Schedule Session</button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {[{ label: 'Scheduled', value: stats.scheduled, color: 'text-blue-700' }, { label: 'In Progress', value: stats.inProgress, color: 'text-amber-700' }, { label: 'Completed', value: stats.completed, color: 'text-emerald-700' }, { label: 'Total Today', value: stats.totalToday, color: 'text-gray-800' }, { label: 'Machines Free', value: stats.machinesAvailable, color: 'text-emerald-700' }, { label: 'Machines Busy', value: stats.machinesInUse, color: 'text-amber-700' }, { label: 'Total Machines', value: stats.machinesTotal, color: 'text-gray-800' }].map(s => (
          <div key={s.label} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.label}</div><div className={`text-2xl font-black ${s.color}`}>{s.value}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {machines.map(m => (
          <div key={m.id} className={`rounded-xl border p-3 ${m.status === 'in_use' ? 'bg-amber-50 border-amber-200' : m.status === 'available' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="text-sm font-bold">{m.machine_number}</div><div className="text-[10px] text-gray-500">{m.brand} {m.model}</div>
            <span className={`h1-badge mt-1 ${m.status === 'available' ? 'h1-badge-green' : m.status === 'in_use' ? 'h1-badge-amber' : 'h1-badge-red'} capitalize`}>{m.status?.replace('_', ' ')}</span></div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table"><thead><tr><th>Patient</th><th>Machine</th><th>Type</th><th>Access</th><th>Pre Wt/BP</th><th>Target UF</th><th>Duration</th><th>Tech</th><th>Status</th></tr></thead>
          <tbody>{sessions.map(s => (<tr key={s.id}><td><div className="font-semibold">{s.patient?.first_name} {s.patient?.last_name}</div><div className="text-[10px] text-gray-400">{s.patient?.uhid}</div></td><td className="font-bold">{s.machine?.machine_number || '—'}</td><td><span className="h1-badge h1-badge-blue uppercase">{s.dialysis_type}</span></td><td className="capitalize text-[11px]">{s.access_type?.replace('_', ' ') || '—'}</td><td className="text-[11px]">{s.pre_weight}kg / {s.pre_bp || '—'}</td><td>{s.target_uf ? `${s.target_uf}ml` : '—'}</td><td>{s.duration_minutes}min</td><td className="text-[11px]">{s.tech?.full_name?.split(' ').pop() || '—'}</td><td><span className={`h1-badge ${s.status === 'completed' ? 'h1-badge-green' : s.status === 'in_progress' ? 'h1-badge-amber' : 'h1-badge-blue'} capitalize`}>{s.status?.replace('_', ' ')}</span></td></tr>))}
            {sessions.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No sessions today</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
export default function DialysisPage() { return <RoleGuard module="ipd"><DialysisInner /></RoleGuard>; }
