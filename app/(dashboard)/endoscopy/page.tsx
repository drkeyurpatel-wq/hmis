'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useEndoscopy } from '@/lib/modules/module-hooks';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, X } from 'lucide-react';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

function EndoInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || ''; const staffId = staff?.id || '';
  const { procedures, loading, load, schedule, updateProcedure } = useEndoscopy(centreId);
  const [showNew, setShowNew] = useState(false); const [selected, setSelected] = useState<any>(null);
  const [toast, setToast] = useState(''); const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [patSearch, setPatSearch] = useState(''); const [patResults, setPatResults] = useState<any[]>([]); const [selPat, setSelPat] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [form, setForm] = useState({ procedure_type: 'ogd', indication: '', sedation_type: 'conscious', scope_id: '', endoscopist_id: '' });

  useEffect(() => { if (centreId) sb().from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true).then(({ data }: any) => setDoctors(data || [])); }, [centreId]);
  useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => { const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender').or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%`).eq('is_active', true).limit(5); setPatResults(data || []); }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const handleSchedule = async () => {
    if (!selPat || !form.endoscopist_id) return;
    const res = await schedule({ patient_id: selPat.id, procedure_date: new Date().toISOString().split('T')[0], ...form });
    if (res.success) { flash('Procedure scheduled'); setShowNew(false); setSelPat(null); }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Endoscopy Unit</h1><p className="text-xs text-gray-400">Scope tracking + decontamination</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Schedule</button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[{ l:'Total', v:procedures.length, c:'text-gray-800' }, { l:'OGD', v:procedures.filter(p=>p.procedure_type==='ogd').length, c:'text-blue-700' }, { l:'Colonoscopy', v:procedures.filter(p=>p.procedure_type==='colonoscopy').length, c:'text-purple-700' }, { l:'ERCP', v:procedures.filter(p=>p.procedure_type==='ercp').length, c:'text-amber-700' }, { l:'Completed', v:procedures.filter(p=>p.status==='completed').length, c:'text-emerald-700' }].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table"><thead><tr><th>Patient</th><th>Procedure</th><th>Indication</th><th>Sedation</th><th>Scope</th><th>Biopsy</th><th>Doctor</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{procedures.map(p => (
            <tr key={p.id}>
              <td><div className="font-semibold">{p.patient?.first_name} {p.patient?.last_name}</div><div className="text-[10px] text-gray-400">{p.patient?.uhid}</div></td>
              <td><span className="h1-badge h1-badge-blue uppercase">{p.procedure_type}</span></td>
              <td className="text-[11px] max-w-[200px] truncate">{p.indication || '—'}</td>
              <td className="capitalize text-[11px]">{p.sedation_type || '—'}</td>
              <td className="font-mono text-[10px]">{p.scope_id || '—'}</td>
              <td>{p.biopsy_taken ? <span className="h1-badge h1-badge-amber">Yes</span> : '—'}</td>
              <td className="text-[11px]">{p.endoscopist?.full_name?.split(' ').pop() || '—'}</td>
              <td><span className={`h1-badge ${p.status === 'completed' ? 'h1-badge-green' : p.status === 'in_progress' ? 'h1-badge-amber' : 'h1-badge-blue'} capitalize`}>{p.status?.replace('_', ' ')}</span></td>
              <td><div className="flex gap-1">
                {p.status === 'scheduled' && <button onClick={() => { updateProcedure(p.id, { status: 'in_progress', start_time: new Date().toISOString() }); flash('Started'); }} className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-lg font-medium">Start</button>}
                {p.status === 'in_progress' && <button onClick={() => { updateProcedure(p.id, { status: 'completed', end_time: new Date().toISOString() }); flash('Completed'); }} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium">Complete</button>}
                <button onClick={() => setSelected(p)} className="px-2 py-1 bg-gray-50 text-gray-600 text-[10px] rounded-lg">Detail</button>
              </div></td>
            </tr>
          ))}{procedures.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No procedures today</td></tr>}</tbody>
        </table>
      </div>

      {/* SCHEDULE MODAL */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Schedule Endoscopy</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
            {selPat ? <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200"><div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid}</div><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button></div>
            : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />{patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Procedure *</label><div className="flex gap-1 mt-1 flex-wrap">{['ogd', 'colonoscopy', 'ercp', 'eus', 'bronchoscopy', 'sigmoidoscopy'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, procedure_type: t }))} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase ${form.procedure_type === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
              ))}</div></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Sedation</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.sedation_type} onChange={e => setForm(f => ({ ...f, sedation_type: e.target.value }))}>{['local', 'conscious', 'deep', 'ga'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select></div>
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Indication</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.indication} onChange={e => setForm(f => ({ ...f, indication: e.target.value }))} placeholder="e.g. GERD not responding to PPI, screening colonoscopy" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Endoscopist *</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.endoscopist_id} onChange={e => setForm(f => ({ ...f, endoscopist_id: e.target.value }))}><option value="">Select</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Scope ID</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.scope_id} onChange={e => setForm(f => ({ ...f, scope_id: e.target.value }))} placeholder="e.g. GS-001" /></div>
            </div>
            <button onClick={handleSchedule} disabled={!selPat || !form.endoscopist_id} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Schedule Procedure</button>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-[480px] bg-white h-full overflow-y-auto shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Procedure Detail</h2><button onClick={() => setSelected(null)}><X size={18} className="text-gray-400" /></button></div>
            <div className="bg-gray-50 rounded-xl p-4"><div className="font-bold">{selected.patient?.first_name} {selected.patient?.last_name}</div><div className="text-xs text-gray-500">{selected.patient?.uhid} · <span className="uppercase font-bold">{selected.procedure_type}</span></div></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Findings</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-24 resize-none" defaultValue={selected.findings || ''} onBlur={e => { updateProcedure(selected.id, { findings: e.target.value }); flash('Findings saved'); }} placeholder="Describe endoscopic findings..." /></div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked={selected.biopsy_taken} onChange={e => { updateProcedure(selected.id, { biopsy_taken: e.target.checked }); flash('Updated'); }} className="rounded" /> Biopsy taken</label>
            </div>
            {selected.biopsy_taken && <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Biopsy Details</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" defaultValue={selected.biopsy_details || ''} onBlur={e => { updateProcedure(selected.id, { biopsy_details: e.target.value }); flash('Saved'); }} placeholder="Site, number of biopsies" /></div>}
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Therapeutic Intervention</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" defaultValue={selected.therapeutic_intervention || ''} onBlur={e => { updateProcedure(selected.id, { therapeutic_intervention: e.target.value }); flash('Saved'); }} placeholder="e.g. Polypectomy, banding, dilatation" /></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Report</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-20 resize-none" defaultValue={selected.report || ''} onBlur={e => { updateProcedure(selected.id, { report: e.target.value }); flash('Report saved'); }} placeholder="Final endoscopy report..." /></div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function EndoscopyPage() { return <RoleGuard module="ot"><EndoInner /></RoleGuard>; }
