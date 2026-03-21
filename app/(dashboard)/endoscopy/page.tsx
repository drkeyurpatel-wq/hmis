'use client';
import React from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useEndoscopy } from '@/lib/modules/module-hooks';
import { Plus } from 'lucide-react';

function EndoscopyInner() {
  const { activeCentreId } = useAuthStore();
  const { procedures } = useEndoscopy(activeCentreId || '');
  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Endoscopy Unit</h1><p className="text-xs text-gray-400">Scope tracking + decontamination</p></div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold"><Plus size={15} /> Schedule</button>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table"><thead><tr><th>Patient</th><th>Procedure</th><th>Indication</th><th>Sedation</th><th>Scope</th><th>Biopsy</th><th>Doctor</th><th>Status</th></tr></thead>
          <tbody>{procedures.map(p => (<tr key={p.id}><td><div className="font-semibold">{p.patient?.first_name} {p.patient?.last_name}</div><div className="text-[10px] text-gray-400">{p.patient?.uhid}</div></td><td><span className="h1-badge h1-badge-blue uppercase">{p.procedure_type}</span></td><td className="text-[11px] max-w-[200px] truncate">{p.indication || '—'}</td><td className="capitalize text-[11px]">{p.sedation_type || '—'}</td><td className="font-mono text-[10px]">{p.scope_id || '—'}</td><td>{p.biopsy_taken ? <span className="h1-badge h1-badge-amber">Yes</span> : '—'}</td><td className="text-[11px]">{p.endoscopist?.full_name?.split(' ').pop() || '—'}</td><td><span className={`h1-badge ${p.status === 'completed' ? 'h1-badge-green' : p.status === 'in_progress' ? 'h1-badge-amber' : 'h1-badge-blue'} capitalize`}>{p.status?.replace('_', ' ')}</span></td></tr>))}
            {procedures.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No procedures today</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
export default function EndoscopyPage() { return <RoleGuard module="ot"><EndoscopyInner /></RoleGuard>; }
