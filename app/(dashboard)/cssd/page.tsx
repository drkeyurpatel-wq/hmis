'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useCssd } from '@/lib/modules/module-hooks';
import { Plus, X, CheckCircle2 } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = { available: 'h1-badge-green', in_use: 'h1-badge-amber', sterilizing: 'h1-badge-blue', maintenance: 'h1-badge-red' };

function CssdInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || ''; const staffId = staff?.id || '';
  const cssd = useCssd(centreId);
  const [tab, setTab] = useState<'sets' | 'cycles' | 'issue'>('sets');
  const [showNewSet, setShowNewSet] = useState(false); const [showNewCycle, setShowNewCycle] = useState(false);
  const [toast, setToast] = useState(''); const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [setForm, setSetForm] = useState({ set_name: '', set_code: '', department: '', total_instruments: '', max_cycles: '500' });
  const [cycleForm, setCycleForm] = useState({ autoclave_number: '', cycle_type: 'prevacuum', temperature: '134', pressure: '2.1', duration_minutes: '20', selectedSets: [] as string[] });

  const handleCreateSet = async () => {
    if (!setForm.set_name) return;
    const res = await cssd.createSet({ ...setForm, total_instruments: parseInt(setForm.total_instruments) || 0, max_cycles: parseInt(setForm.max_cycles) || 500 });
    if (res.success) { flash('Set created'); setShowNewSet(false); setSetForm({ set_name: '', set_code: '', department: '', total_instruments: '', max_cycles: '500' }); }
  };

  const handleStartCycle = async () => {
    if (cycleForm.selectedSets.length === 0) return;
    const loadItems = cycleForm.selectedSets.map(id => { const s = cssd.sets.find(x => x.id === id); return { set_id: id, set_name: s?.set_name || '' }; });
    const res = await cssd.startCycle({
      autoclave_number: cycleForm.autoclave_number, cycle_type: cycleForm.cycle_type,
      temperature: parseFloat(cycleForm.temperature), pressure: parseFloat(cycleForm.pressure),
      duration_minutes: parseInt(cycleForm.duration_minutes), load_items: loadItems,
    }, staffId);
    if (res.success) { flash('Cycle started'); setShowNewCycle(false); setCycleForm({ autoclave_number: '', cycle_type: 'prevacuum', temperature: '134', pressure: '2.1', duration_minutes: '20', selectedSets: [] }); }
  };

  const toggleSet = (id: string) => setCycleForm(f => ({ ...f, selectedSets: f.selectedSets.includes(id) ? f.selectedSets.filter(x => x !== id) : [...f.selectedSets, id] }));

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">CSSD</h1><p className="text-xs text-gray-400">Central Sterile Supply Department</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewCycle(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-xl font-semibold hover:bg-blue-700"><Plus size={15} /> Start Cycle</button>
          <button onClick={() => setShowNewSet(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> New Set</button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {[{ l:'Total Sets', v:cssd.stats.totalSets, c:'text-gray-800' }, { l:'Available', v:cssd.stats.available, c:'text-emerald-700' }, { l:'In Use', v:cssd.stats.inUse, c:'text-amber-700' }, { l:'Sterilizing', v:cssd.stats.sterilizing, c:'text-blue-700' }, { l:'Cycles Today', v:cssd.stats.cyclesToday, c:'text-teal-700' }, { l:'Failed', v:cssd.stats.failedCycles, c:cssd.stats.failedCycles > 0 ? 'text-red-600' : 'text-gray-400' }].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="flex gap-1">{['sets', 'cycles'].map(t => <button key={t} onClick={() => setTab(t as any)} className={`px-3.5 py-2 text-xs font-medium rounded-xl capitalize ${tab === t ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'}`}>{t === 'sets' ? 'Instrument Sets' : 'Sterilization Cycles'}</button>)}</div>

      {tab === 'sets' && <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table"><thead><tr><th>Code</th><th>Name</th><th>Dept</th><th>Instruments</th><th>Status</th><th>Last Sterilized</th><th>Cycles Used</th><th>Actions</th></tr></thead>
          <tbody>{cssd.sets.map(s => (
            <tr key={s.id}>
              <td className="font-mono text-[10px]">{s.set_code || '—'}</td>
              <td className="font-semibold">{s.set_name}</td>
              <td className="text-[11px]">{s.department || '—'}</td>
              <td>{s.total_instruments}</td>
              <td><span className={`h1-badge ${STATUS_BADGE[s.status] || 'h1-badge-gray'} capitalize`}>{s.status?.replace('_', ' ')}</span></td>
              <td className="text-[11px] text-gray-500">{s.last_sterilized_at ? new Date(s.last_sterilized_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
              <td><span className={s.sterilization_count > (s.max_cycles || 500) * 0.9 ? 'text-red-600 font-bold' : ''}>{s.sterilization_count || 0}/{s.max_cycles || 500}</span></td>
              <td><div className="flex gap-1">
                {s.status === 'available' && <button onClick={() => cssd.issueSet(s.id, 'OT', staffId)} className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-lg font-medium">Issue to OT</button>}
              </div></td>
            </tr>
          ))}{cssd.sets.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No instrument sets — create one to start tracking</td></tr>}</tbody></table>
      </div>}

      {tab === 'cycles' && <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table"><thead><tr><th>Cycle #</th><th>Autoclave</th><th>Type</th><th>Sets</th><th>Temp/Pressure</th><th>Duration</th><th>BI Test</th><th>Operator</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{cssd.cycles.map(c => (
            <tr key={c.id}>
              <td className="font-mono text-[10px]">{c.cycle_number}</td>
              <td>{c.autoclave_number || '—'}</td>
              <td><span className="h1-badge h1-badge-gray capitalize">{c.cycle_type}</span></td>
              <td className="text-[11px]">{(c.load_items || []).map((i: any) => i.set_name).join(', ') || '—'}</td>
              <td className="text-[11px]">{c.temperature}°C / {c.pressure}bar</td>
              <td>{c.duration_minutes}min</td>
              <td><span className={`h1-badge ${c.bi_test_result === 'pass' ? 'h1-badge-green' : c.bi_test_result === 'fail' ? 'h1-badge-red' : 'h1-badge-amber'}`}>{c.bi_test_result || 'pending'}</span></td>
              <td className="text-[11px]">{c.operator?.full_name?.split(' ').pop() || '—'}</td>
              <td><span className={`h1-badge ${c.status === 'completed' ? 'h1-badge-green' : c.status === 'failed' ? 'h1-badge-red' : 'h1-badge-blue'}`}>{c.status}</span></td>
              <td>{c.status === 'in_progress' && <div className="flex gap-1">
                <button onClick={() => { cssd.completeCycle(c.id, 'pass'); flash('Cycle passed'); }} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium">Pass</button>
                <button onClick={() => { cssd.completeCycle(c.id, 'fail'); flash('Cycle FAILED — recall sets'); }} className="px-2 py-1 bg-red-50 text-red-700 text-[10px] rounded-lg font-medium">Fail</button>
              </div>}</td>
            </tr>
          ))}{cssd.cycles.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-gray-400">No cycles — start one to sterilize instrument sets</td></tr>}</tbody></table>
      </div>}

      {/* NEW SET MODAL */}
      {showNewSet && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewSet(false)}><div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h2 className="text-lg font-bold">New Instrument Set</h2><button onClick={() => setShowNewSet(false)}><X size={18} className="text-gray-400" /></button></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Set Name *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={setForm.set_name} onChange={e => setSetForm(f => ({ ...f, set_name: e.target.value }))} placeholder="e.g. Major Laparotomy Set" /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Set Code</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={setForm.set_code} onChange={e => setSetForm(f => ({ ...f, set_code: e.target.value }))} placeholder="e.g. MLS-001" /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Department</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={setForm.department} onChange={e => setSetForm(f => ({ ...f, department: e.target.value }))}><option value="">Select</option>{['General Surgery', 'Orthopaedics', 'Cardiology', 'Neurosurgery', 'Gynaecology', 'ENT', 'Ophthalmology', 'Urology'].map(d => <option key={d}>{d}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Instrument Count</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={setForm.total_instruments} onChange={e => setSetForm(f => ({ ...f, total_instruments: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Max Cycles</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={setForm.max_cycles} onChange={e => setSetForm(f => ({ ...f, max_cycles: e.target.value }))} /></div>
        </div>
        <button onClick={handleCreateSet} disabled={!setForm.set_name} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Create Set</button>
      </div></div>}

      {/* START CYCLE MODAL */}
      {showNewCycle && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewCycle(false)}><div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h2 className="text-lg font-bold">Start Sterilization Cycle</h2><button onClick={() => setShowNewCycle(false)}><X size={18} className="text-gray-400" /></button></div>
        <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Select Sets to Sterilize *</label>
          <div className="mt-1 space-y-1 max-h-40 overflow-y-auto border rounded-xl p-2">{cssd.sets.filter(s => ['available', 'in_use'].includes(s.status)).map(s => (
            <label key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer ${cycleForm.selectedSets.includes(s.id) ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
              <input type="checkbox" checked={cycleForm.selectedSets.includes(s.id)} onChange={() => toggleSet(s.id)} className="rounded" />
              <span className="text-xs font-medium">{s.set_name}</span><span className="text-[10px] text-gray-400 ml-auto">{s.set_code}</span>
            </label>
          ))}{cssd.sets.filter(s => ['available', 'in_use'].includes(s.status)).length === 0 && <div className="text-center py-4 text-gray-400 text-xs">No sets available</div>}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Autoclave #</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={cycleForm.autoclave_number} onChange={e => setCycleForm(f => ({ ...f, autoclave_number: e.target.value }))} placeholder="e.g. AC-01" /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Cycle Type</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={cycleForm.cycle_type} onChange={e => setCycleForm(f => ({ ...f, cycle_type: e.target.value }))}>{['prevacuum', 'gravity', 'flash', 'eto'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Temp (°C)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={cycleForm.temperature} onChange={e => setCycleForm(f => ({ ...f, temperature: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Pressure (bar)</label><input type="number" step="0.1" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={cycleForm.pressure} onChange={e => setCycleForm(f => ({ ...f, pressure: e.target.value }))} /></div>
          <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Duration (min)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={cycleForm.duration_minutes} onChange={e => setCycleForm(f => ({ ...f, duration_minutes: e.target.value }))} /></div>
        </div>
        <button onClick={handleStartCycle} disabled={cycleForm.selectedSets.length === 0} className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Start Cycle ({cycleForm.selectedSets.length} sets)</button>
      </div></div>}
    </div>
  );
}
export default function CssdPage() { return <RoleGuard module="ot"><CssdInner /></RoleGuard>; }
