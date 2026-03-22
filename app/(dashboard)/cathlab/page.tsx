'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useCathLab } from '@/lib/modules/module-hooks';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, X, Search, Heart, Clock, AlertTriangle } from 'lucide-react';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

function CathLabInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { procedures, loading, stats, load, schedule, updateProcedure } = useCathLab(centreId);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Patient search
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);

  useEffect(() => {
    if (!centreId) return;
    sb().from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true)
      .then(({ data }: any) => setDoctors(data || []));
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

  const [form, setForm] = useState({ procedure_type: 'cag', procedure_name: '', indication: '', access_site: 'radial', primary_operator: '', estimated_duration_min: '60' });

  // Stent entry for selected procedure
  const [stentForm, setStentForm] = useState({ vessel: '', type: 'DES', brand: '', size: '', serial: '' });

  const handleSchedule = async () => {
    if (!selPat || !form.primary_operator) return;
    const res = await schedule({
      patient_id: selPat.id, procedure_date: date, ...form,
      estimated_duration_min: parseInt(form.estimated_duration_min) || 60,
    });
    if (res.success) { flash('Procedure scheduled'); setShowNew(false); setSelPat(null); }
  };

  const startProcedure = (id: string) => {
    updateProcedure(id, { procedure_status: 'in_progress', start_time: new Date().toISOString() });
    flash('Procedure started');
  };

  const completeProcedure = (id: string) => {
    updateProcedure(id, { procedure_status: 'completed', end_time: new Date().toISOString(), outcome: 'success' });
    flash('Procedure completed');
  };

  const addStent = async () => {
    if (!selected || !stentForm.vessel) return;
    const existing = selected.stents_placed || [];
    const updated = [...existing, { ...stentForm }];
    await updateProcedure(selected.id, { stents_placed: updated });
    setSelected({ ...selected, stents_placed: updated });
    setStentForm({ vessel: '', type: 'DES', brand: '', size: '', serial: '' });
    flash('Stent added');
  };

  const saveFindingsAndData = async (id: string, data: any) => {
    await updateProcedure(id, data);
    flash('Saved');
  };

  useEffect(() => { load(date); }, [date]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Cath Lab</h1><p className="text-xs text-gray-400">Cardiac Catheterization Laboratory</p></div>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Schedule Procedure</button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {[
          { l: 'Total', v: stats.total, c: 'text-gray-800' },
          { l: 'CAG', v: stats.cag, c: 'text-blue-700' },
          { l: 'PTCA', v: stats.ptca, c: 'text-red-600' },
          { l: 'PPI/ICD', v: stats.ppi, c: 'text-purple-700' },
          { l: 'Completed', v: stats.completed, c: 'text-emerald-700' },
          { l: 'In Progress', v: stats.inProgress, c: stats.inProgress > 0 ? 'text-amber-700' : 'text-gray-400' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      {/* Procedures table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table">
          <thead><tr><th>Patient</th><th>Procedure</th><th>Access</th><th>Findings</th><th>Stents</th><th>Fluoro</th><th>Contrast</th><th>Operator</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {procedures.map(p => (
              <tr key={p.id}>
                <td><div className="font-semibold">{p.patient?.first_name} {p.patient?.last_name}</div><div className="text-[10px] text-gray-400">{p.patient?.uhid} · {p.patient?.age_years}/{p.patient?.gender?.charAt(0)}</div></td>
                <td><span className={`h1-badge ${p.procedure_type === 'ptca' ? 'h1-badge-red' : p.procedure_type === 'cag' ? 'h1-badge-blue' : 'h1-badge-purple'} uppercase font-bold`}>{p.procedure_type}</span>
                  {p.procedure_name && <div className="text-[10px] text-gray-500 mt-0.5">{p.procedure_name}</div>}</td>
                <td className="capitalize text-[11px]">{p.access_site || '—'}</td>
                <td className="text-[11px] max-w-[150px] truncate">{p.cag_findings || '—'}</td>
                <td>{(p.stents_placed || []).length > 0 ? <span className="h1-badge h1-badge-red font-bold">{p.stents_placed.length} stent{p.stents_placed.length > 1 ? 's' : ''}</span> : '—'}</td>
                <td className="text-[11px]">{p.fluoroscopy_time_min ? `${p.fluoroscopy_time_min}min` : '—'}</td>
                <td className="text-[11px]">{p.contrast_volume_ml ? `${p.contrast_volume_ml}ml` : '—'}</td>
                <td className="text-[11px]">{p.operator?.full_name?.split(' ').pop() || '—'}</td>
                <td><span className={`h1-badge ${p.procedure_status === 'completed' ? 'h1-badge-green' : p.procedure_status === 'in_progress' ? 'h1-badge-amber' : 'h1-badge-blue'} capitalize`}>{p.procedure_status?.replace('_', ' ')}</span></td>
                <td>
                  <div className="flex gap-1">
                    {p.procedure_status === 'scheduled' && <button onClick={() => startProcedure(p.id)} className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-lg font-medium hover:bg-amber-100">Start</button>}
                    {p.procedure_status === 'in_progress' && <button onClick={() => completeProcedure(p.id)} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium hover:bg-emerald-100">Complete</button>}
                    <button onClick={() => setSelected(p)} className="px-2 py-1 bg-gray-50 text-gray-600 text-[10px] rounded-lg font-medium hover:bg-gray-100">Detail</button>
                  </div>
                </td>
              </tr>
            ))}
            {procedures.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-gray-400">No procedures on {date}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* SCHEDULE MODAL */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Schedule Cath Lab Procedure</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>

            {selPat ? (
              <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid} · {selPat.age_years}/{selPat.gender?.charAt(0)}</div>
                <button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />
                {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Procedure Type *</label>
                <div className="flex gap-1 mt-1">{['cag', 'ptca', 'ppi', 'icd', 'ep_study', 'tavi'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, procedure_type: t }))} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase ${form.procedure_type === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
                ))}</div></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Access Site</label>
                <div className="flex gap-1 mt-1">{['radial', 'femoral'].map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, access_site: s }))} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize ${form.access_site === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{s}</button>
                ))}</div></div>
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Procedure Name</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.procedure_name} onChange={e => setForm(f => ({ ...f, procedure_name: e.target.value }))} placeholder="e.g. CAG + PTCA to LAD" /></div>
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Indication</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.indication} onChange={e => setForm(f => ({ ...f, indication: e.target.value }))} placeholder="e.g. Unstable angina, TMT positive" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Primary Operator *</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.primary_operator} onChange={e => setForm(f => ({ ...f, primary_operator: e.target.value }))}>
                  <option value="">Select</option>{doctors.filter(d => d.specialisation?.toLowerCase().includes('cardio')).map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  <optgroup label="All Doctors">{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</optgroup>
                </select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Est. Duration (min)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.estimated_duration_min} onChange={e => setForm(f => ({ ...f, estimated_duration_min: e.target.value }))} /></div>
            </div>
            <button onClick={handleSchedule} disabled={!selPat || !form.primary_operator} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700">Schedule Procedure</button>
          </div>
        </div>
      )}

      {/* PROCEDURE DETAIL DRAWER */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-[520px] bg-white h-full overflow-y-auto shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Procedure Details</h2><button onClick={() => setSelected(null)}><X size={18} className="text-gray-400" /></button></div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="font-bold text-lg">{selected.patient?.first_name} {selected.patient?.last_name}</div>
              <div className="text-xs text-gray-500">{selected.patient?.uhid} · {selected.patient?.age_years}/{selected.patient?.gender?.charAt(0)}</div>
              <div className="flex gap-2 mt-2">
                <span className={`h1-badge ${selected.procedure_type === 'ptca' ? 'h1-badge-red' : 'h1-badge-blue'} uppercase font-bold`}>{selected.procedure_type}</span>
                <span className={`h1-badge ${selected.procedure_status === 'completed' ? 'h1-badge-green' : selected.procedure_status === 'in_progress' ? 'h1-badge-amber' : 'h1-badge-blue'}`}>{selected.procedure_status?.replace('_', ' ')}</span>
              </div>
            </div>

            {/* CAG Findings */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-semibold">CAG Findings</label>
              <textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-20 resize-none" defaultValue={selected.cag_findings || ''}
                onBlur={e => saveFindingsAndData(selected.id, { cag_findings: e.target.value })} placeholder="LM: Normal&#10;LAD: 90% mid stenosis&#10;LCx: Non-dominant, normal&#10;RCA: Dominant, 70% proximal" />
            </div>

            {/* Vessels */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Vessels Involved</label>
              <div className="flex gap-1 mt-1 flex-wrap">{['LM', 'LAD', 'D1', 'D2', 'LCx', 'OM1', 'OM2', 'RCA', 'PDA', 'PLV'].map(v => (
                <button key={v} onClick={() => {
                  const current = selected.vessels_involved || [];
                  const updated = current.includes(v) ? current.filter((x: string) => x !== v) : [...current, v];
                  saveFindingsAndData(selected.id, { vessels_involved: updated });
                  setSelected({ ...selected, vessels_involved: updated });
                }} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${(selected.vessels_involved || []).includes(v) ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{v}</button>
              ))}</div>
            </div>

            {/* Radiation */}
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Fluoro (min)</label>
                <input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" defaultValue={selected.fluoroscopy_time_min || ''}
                  onBlur={e => saveFindingsAndData(selected.id, { fluoroscopy_time_min: parseFloat(e.target.value) || null })} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Radiation (mGy)</label>
                <input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" defaultValue={selected.radiation_dose_mgy || ''}
                  onBlur={e => saveFindingsAndData(selected.id, { radiation_dose_mgy: parseFloat(e.target.value) || null })} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Contrast (ml)</label>
                <input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" defaultValue={selected.contrast_volume_ml || ''}
                  onBlur={e => saveFindingsAndData(selected.id, { contrast_volume_ml: parseInt(e.target.value) || null })} /></div>
            </div>

            {/* Stents */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Stents Placed ({(selected.stents_placed || []).length})</label>
              {(selected.stents_placed || []).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mt-1 bg-red-50 rounded-lg p-2 text-xs">
                  <Heart size={12} className="text-red-500" />
                  <span className="font-bold">{s.vessel}</span> — {s.type} {s.brand} {s.size} <span className="text-gray-400 ml-auto">S/N: {s.serial}</span>
                </div>
              ))}
              <div className="grid grid-cols-5 gap-1 mt-2">
                <select className="px-2 py-1.5 border rounded-lg text-[10px]" value={stentForm.vessel} onChange={e => setStentForm(f => ({ ...f, vessel: e.target.value }))}>
                  <option value="">Vessel</option>{['LAD', 'LCx', 'RCA', 'LM', 'D1', 'OM1', 'PDA'].map(v => <option key={v}>{v}</option>)}</select>
                <select className="px-2 py-1.5 border rounded-lg text-[10px]" value={stentForm.type} onChange={e => setStentForm(f => ({ ...f, type: e.target.value }))}>
                  {['DES', 'BMS', 'DCB'].map(t => <option key={t}>{t}</option>)}</select>
                <input className="px-2 py-1.5 border rounded-lg text-[10px]" placeholder="Brand" value={stentForm.brand} onChange={e => setStentForm(f => ({ ...f, brand: e.target.value }))} />
                <input className="px-2 py-1.5 border rounded-lg text-[10px]" placeholder="Size" value={stentForm.size} onChange={e => setStentForm(f => ({ ...f, size: e.target.value }))} />
                <button onClick={addStent} disabled={!stentForm.vessel} className="px-2 py-1.5 bg-red-600 text-white text-[10px] rounded-lg font-bold disabled:opacity-40">+Stent</button>
              </div>
            </div>

            {/* Complications */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Complications</label>
              <div className="flex gap-1 mt-1 flex-wrap">{['dissection', 'no_reflow', 'perforation', 'arrhythmia', 'hematoma', 'contrast_reaction', 'none'].map(c => (
                <button key={c} onClick={() => {
                  const current = selected.complications || [];
                  const updated = current.includes(c) ? current.filter((x: string) => x !== c) : [...current, c];
                  saveFindingsAndData(selected.id, { complications: updated });
                  setSelected({ ...selected, complications: updated });
                }} className={`px-2 py-1.5 rounded-lg text-[10px] font-medium capitalize ${(selected.complications || []).includes(c) ? (c === 'none' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{c.replace('_', ' ')}</button>
              ))}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function CathLabPage() { return <RoleGuard module="ot"><CathLabInner /></RoleGuard>; }
