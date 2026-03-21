'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useCathLab } from '@/lib/modules/module-hooks';
import { Plus } from 'lucide-react';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

function CathLabInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { procedures, stats } = useCathLab(centreId);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Cath Lab</h1><p className="text-xs text-gray-400">Cardiac Catheterization Laboratory</p></div>
        <div className="flex gap-2"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
          <button className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold"><Plus size={15} /> Schedule</button></div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {[{ label: 'Total', value: stats.total, color: 'text-gray-800' }, { label: 'CAG', value: stats.cag, color: 'text-blue-700' }, { label: 'PTCA', value: stats.ptca, color: 'text-red-600' }, { label: 'PPI/ICD', value: stats.ppi, color: 'text-purple-700' }, { label: 'Completed', value: stats.completed, color: 'text-emerald-700' }, { label: 'In Progress', value: stats.inProgress, color: 'text-amber-700' }].map(s => (
          <div key={s.label} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.label}</div><div className={`text-2xl font-black ${s.color}`}>{s.value}</div></div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table"><thead><tr><th>Patient</th><th>Procedure</th><th>Access</th><th>Findings</th><th>Stents</th><th>Fluoro</th><th>Contrast</th><th>Operator</th><th>Status</th></tr></thead>
          <tbody>{procedures.map(p => (<tr key={p.id}><td><div className="font-semibold">{p.patient?.first_name} {p.patient?.last_name}</div><div className="text-[10px] text-gray-400">{p.patient?.uhid} · {p.patient?.age_years}/{p.patient?.gender?.charAt(0)}</div></td><td><span className={`h1-badge ${p.procedure_type === 'ptca' ? 'h1-badge-red' : p.procedure_type === 'cag' ? 'h1-badge-blue' : 'h1-badge-purple'} uppercase font-bold`}>{p.procedure_type}</span></td><td className="capitalize text-[11px]">{p.access_site || '—'}</td><td className="text-[11px] max-w-[150px] truncate">{p.cag_findings || '—'}</td><td>{(p.stents_placed || []).length > 0 ? <span className="h1-badge h1-badge-red">{p.stents_placed.length}</span> : '—'}</td><td>{p.fluoroscopy_time_min || '—'}min</td><td>{p.contrast_volume_ml || '—'}ml</td><td className="text-[11px]">{p.operator?.full_name?.split(' ').pop() || '—'}</td><td><span className={`h1-badge ${p.procedure_status === 'completed' ? 'h1-badge-green' : p.procedure_status === 'in_progress' ? 'h1-badge-amber' : 'h1-badge-blue'} capitalize`}>{p.procedure_status?.replace('_', ' ')}</span></td></tr>))}
            {procedures.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No procedures scheduled</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
export default function CathLabPage() { return <RoleGuard module="ot"><CathLabInner /></RoleGuard>; }
