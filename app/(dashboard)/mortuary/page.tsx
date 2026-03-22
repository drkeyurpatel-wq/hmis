'use client';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { createClient } from '@/lib/supabase/client';
import { useMortuary, type MortuaryRecord } from '@/lib/mortuary/mortuary-hooks';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-amber-100 text-amber-700', stored: 'bg-blue-100 text-blue-700',
  post_mortem: 'bg-purple-100 text-purple-700', released: 'bg-green-100 text-green-700',
};

type View = 'current' | 'add' | 'detail' | 'release' | 'all';

function MortuaryInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [view, setView] = useState<View>('current');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const mort = useMortuary(centreId);

  // Add form
  const [form, setForm] = useState({
    patientSearch: '', patientId: '', admissionId: '',
    causeOfDeath: '', timeOfDeath: '', storageUnit: '',
    postMortemRequired: false, policeIntimation: false, notes: '',
  });
  const [patientResults, setPatientResults] = useState<any[]>([]);

  // Detail / Release
  const [selected, setSelected] = useState<MortuaryRecord | null>(null);
  const [releaseForm, setReleaseForm] = useState({
    releasedTo: '', deathCertNumber: '',
    idProofCollected: false, nocFromPolice: false,
  });

  // Patient search
  useEffect(() => {
    if (!form.patientSearch || form.patientSearch.length < 2 || !sb()) { setPatientResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender')
        .or(`uhid.ilike.%${form.patientSearch}%,first_name.ilike.%${form.patientSearch}%,last_name.ilike.%${form.patientSearch}%`)
        .limit(5);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.patientSearch]);

  const selectPatient = (p: any) => {
    setForm(f => ({ ...f, patientId: p.id, patientSearch: `${p.first_name} ${p.last_name} (${p.uhid})` }));
    setPatientResults([]);
  };

  const addRecord = async () => {
    if (!form.causeOfDeath && !form.patientId) { flash('Patient or cause of death required'); return; }
    await mort.addRecord({
      patientId: form.patientId || undefined,
      causeOfDeath: form.causeOfDeath, timeOfDeath: form.timeOfDeath || undefined,
      declaredBy: staffId, storageUnit: form.storageUnit || undefined,
      postMortemRequired: form.postMortemRequired, policeIntimation: form.policeIntimation,
      notes: form.notes || undefined,
    });
    setForm({ patientSearch: '', patientId: '', admissionId: '', causeOfDeath: '', timeOfDeath: '', storageUnit: '', postMortemRequired: false, policeIntimation: false, notes: '' });
    setView('current'); flash('Body received and logged');
  };

  const handleRelease = async () => {
    if (!selected || !releaseForm.releasedTo) { flash('Enter name of person collecting the body'); return; }
    const result = await mort.releaseBody(selected.id, {
      releasedTo: releaseForm.releasedTo, authorizedBy: staffId,
      deathCertNumber: releaseForm.deathCertNumber || undefined,
      idProofCollected: releaseForm.idProofCollected,
      nocFromPolice: releaseForm.nocFromPolice,
    });
    if (result?.error) { flash(result.error); return; }
    setSelected(null); setView('current');
    setReleaseForm({ releasedTo: '', deathCertNumber: '', idProofCollected: false, nocFromPolice: false });
    flash('Body released');
  };

  const openDetail = (r: MortuaryRecord) => { setSelected(r); setView('detail'); };
  const openRelease = (r: MortuaryRecord) => { setSelected(r); setView('release'); };

  const ptName = (r: MortuaryRecord) => r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : 'Unknown';
  const fmtDt = (d: string | null) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const hoursSince = (d: string) => Math.round((Date.now() - new Date(d).getTime()) / 3600000);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Mortuary</h1><p className="text-xs text-gray-500">Body tracking, documentation & release</p></div>
        <div className="flex gap-1">
          <button onClick={() => setView('current')} className={`px-3 py-1.5 text-xs rounded-lg ${view === 'current' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>Current</button>
          <button onClick={() => { setView('all'); mort.load(true); }} className={`px-3 py-1.5 text-xs rounded-lg ${view === 'all' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>All Records</button>
          <button onClick={() => setView('add')} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">+ Receive Body</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-teal-700">{mort.stats.currentOccupancy}</div><div className="text-[10px] text-gray-500">Current Occupancy</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-purple-600">{mort.stats.pendingPM}</div><div className="text-[10px] text-gray-500">Pending Post-Mortem</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-amber-600">{mort.stats.pendingRelease}</div><div className="text-[10px] text-gray-500">Awaiting Release</div></div>
        <div className="bg-white rounded-2xl border p-3 text-center"><div className="text-2xl font-bold text-green-600">{mort.stats.released}</div><div className="text-[10px] text-gray-500">Released</div></div>
      </div>

      {/* ===== ADD RECORD ===== */}
      {view === 'add' && <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h2 className="font-bold text-sm">Receive Body</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label className="text-xs text-gray-500">Patient (search)</label>
            <input value={form.patientSearch} onChange={e => setForm(f => ({ ...f, patientSearch: e.target.value, patientId: '' }))}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="UHID, name..." />
            {patientResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
              {patientResults.map(p => (
                <button key={p.id} onClick={() => selectPatient(p)} className="w-full text-left px-3 py-2 hover:bg-teal-50 text-xs border-b">
                  {p.first_name} {p.last_name} <span className="text-gray-400">{p.uhid} · {p.age_years}yr/{p.gender?.charAt(0)}</span>
                </button>
              ))}
            </div>}
          </div>
          <div><label className="text-xs text-gray-500">Time of Death</label>
            <input type="datetime-local" value={form.timeOfDeath} onChange={e => setForm(f => ({ ...f, timeOfDeath: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Cause of Death</label>
            <input value={form.causeOfDeath} onChange={e => setForm(f => ({ ...f, causeOfDeath: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Primary cause of death" /></div>
          <div><label className="text-xs text-gray-500">Storage Unit</label>
            <input value={form.storageUnit} onChange={e => setForm(f => ({ ...f, storageUnit: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Unit A-3" /></div>
          <div className="space-y-2 pt-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.postMortemRequired} onChange={e => setForm(f => ({ ...f, postMortemRequired: e.target.checked }))} className="rounded" /> Post-mortem required</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.policeIntimation} onChange={e => setForm(f => ({ ...f, policeIntimation: e.target.checked }))} className="rounded" /> Police case / MLC</label>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Additional notes..." /></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('current')} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button>
          <button onClick={addRecord} className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">Log Receipt</button>
        </div>
      </div>}

      {/* ===== CURRENT / ALL RECORDS ===== */}
      {(view === 'current' || view === 'all') && <div className="space-y-3">
        {/* Cards for current occupancy */}
        {view === 'current' && mort.records.filter(r => r.status !== 'released').length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {mort.records.filter(r => r.status !== 'released').map(r => {
              const hrs = hoursSince(r.body_received_at);
              return (
                <div key={r.id} className={`bg-white rounded-2xl border p-4 space-y-2 ${r.post_mortem_required && !r.post_mortem_done ? 'border-l-4 border-l-purple-500' : hrs > 48 ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-400'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{ptName(r)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[r.status]}`}>{r.status.replace('_', ' ')}</span>
                  </div>
                  {r.patient && <div className="text-[10px] text-gray-500">{r.patient.uhid} · {r.patient.age_years}yr/{r.patient.gender?.charAt(0)}</div>}
                  <div className="text-xs text-gray-600"><b>Cause:</b> {r.cause_of_death || '—'}</div>
                  <div className="text-[10px] text-gray-400">
                    {r.storage_unit && <span className="mr-2">📍 {r.storage_unit}</span>}
                    Received {hrs}h ago
                  </div>
                  {/* Flags */}
                  <div className="flex flex-wrap gap-1">
                    {r.post_mortem_required && <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${r.post_mortem_done ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{r.post_mortem_done ? 'PM Done' : 'PM Required'}</span>}
                    {r.police_intimation && <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-red-100 text-red-700">Police Case</span>}
                    {r.embalming_done && <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-blue-100 text-blue-700">Embalmed</span>}
                    {hrs > 48 && <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-red-600 text-white">&gt;48h</span>}
                  </div>
                  <div className="flex gap-1 pt-1">
                    <button onClick={() => openDetail(r)} className="px-2 py-1 bg-gray-100 text-gray-600 text-[9px] rounded flex-1">Details</button>
                    {r.status === 'received' && <button onClick={() => mort.updateRecord(r.id, { status: 'stored' })} className="px-2 py-1 bg-blue-100 text-blue-700 text-[9px] rounded">Store</button>}
                    {r.post_mortem_required && !r.post_mortem_done && <button onClick={() => mort.updateRecord(r.id, { post_mortem_done: true, status: 'stored' })} className="px-2 py-1 bg-purple-100 text-purple-700 text-[9px] rounded">PM Done</button>}
                    {(r.status === 'stored' || (r.post_mortem_required && r.post_mortem_done)) && <button onClick={() => openRelease(r)} className="px-2 py-1 bg-green-600 text-white text-[9px] rounded">Release</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {view === 'current' && mort.records.filter(r => r.status !== 'released').length === 0 && (
          <div className="bg-white rounded-2xl border p-8 text-center text-gray-400 text-sm">{mort.loading ? 'Loading...' : 'No bodies currently in mortuary'}</div>
        )}

        {/* Table for all records */}
        {view === 'all' && <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b">
              <th className="p-2 text-left">Patient</th><th className="p-2">Cause of Death</th>
              <th className="p-2">Time of Death</th><th className="p-2">Received</th>
              <th className="p-2">Storage</th><th className="p-2">Status</th><th className="p-2">Released To</th>
            </tr></thead>
            <tbody>{mort.records.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(r)}>
                <td className="p-2"><div className="font-medium">{ptName(r)}</div>{r.patient && <div className="text-[10px] text-gray-400">{r.patient.uhid}</div>}</td>
                <td className="p-2 text-gray-600 max-w-[200px] truncate">{r.cause_of_death || '—'}</td>
                <td className="p-2 text-center text-gray-500">{fmtDt(r.time_of_death)}</td>
                <td className="p-2 text-center text-gray-500">{fmtDt(r.body_received_at)}</td>
                <td className="p-2 text-center">{r.storage_unit || '—'}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[r.status]}`}>{r.status.replace('_', ' ')}</span></td>
                <td className="p-2 text-center text-gray-500">{r.released_to || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
          {mort.records.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No records</div>}
        </div>}
      </div>}

      {/* ===== DETAIL VIEW ===== */}
      {view === 'detail' && selected && <div className="bg-white rounded-2xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">{ptName(selected)}</h2>
            {selected.patient && <div className="text-xs text-gray-500">{selected.patient.uhid} · {selected.patient.age_years}yr/{selected.patient.gender}</div>}
          </div>
          <div className="flex gap-2 items-center">
            <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[selected.status]}`}>{selected.status.replace('_', ' ').toUpperCase()}</span>
            <button onClick={() => setView('current')} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-50 rounded-lg p-3"><b>Cause of Death:</b> {selected.cause_of_death || '—'}</div>
          <div className="bg-gray-50 rounded-lg p-3"><b>Time of Death:</b> {fmtDt(selected.time_of_death)}</div>
          <div className="bg-gray-50 rounded-lg p-3"><b>Declared By:</b> {selected.declarer?.full_name || '—'}</div>
          <div className="bg-gray-50 rounded-lg p-3"><b>Body Received:</b> {fmtDt(selected.body_received_at)}</div>
          <div className="bg-gray-50 rounded-lg p-3"><b>Storage Unit:</b> {selected.storage_unit || '—'}</div>
          <div className="bg-gray-50 rounded-lg p-3"><b>Death Certificate #:</b> {selected.death_certificate_number || '—'}</div>
        </div>

        {/* Checklist */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-bold text-xs mb-2">Documentation Checklist</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['Post-mortem required', selected.post_mortem_required],
              ['Post-mortem done', selected.post_mortem_done],
              ['Police intimation', selected.police_intimation],
              ['Embalming done', selected.embalming_done],
              ['ID proof collected', selected.id_proof_collected],
              ['NOC from police', selected.noc_from_police],
              ['Death certificate issued', !!selected.death_certificate_number],
              ['Body released', selected.status === 'released'],
            ].map(([label, done]) => (
              <div key={label as string} className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${done ? 'bg-green-100 border-green-400 text-green-600' : 'border-gray-300'}`}>{done ? '✓' : ''}</span>
                <span className={done ? 'text-green-700' : 'text-gray-500'}>{label as string}</span>
              </div>
            ))}
          </div>
        </div>

        {selected.released_to && <div className="bg-green-50 rounded-lg p-3 text-xs">
          <b>Released to:</b> {selected.released_to} on {fmtDt(selected.released_at)} · Authorized by: {selected.authorizer?.full_name || '—'}
        </div>}

        {selected.notes && <div className="text-xs text-gray-500"><b>Notes:</b> {selected.notes}</div>}

        <div className="flex gap-2">
          {selected.status !== 'released' && <>
            {!selected.embalming_done && <button onClick={() => { mort.updateRecord(selected.id, { embalming_done: true }); flash('Embalming marked'); setView('current'); }} className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg">Mark Embalmed</button>}
            {!selected.death_certificate_number && <button onClick={() => {
              const num = prompt('Enter death certificate number:');
              if (num) { mort.updateRecord(selected.id, { death_certificate_number: num }); flash('Certificate recorded'); setView('current'); }
            }} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg">Add Certificate #</button>}
            <button onClick={() => openRelease(selected)} className="px-4 py-1.5 bg-green-600 text-white text-xs rounded-lg">Release Body</button>
          </>}
        </div>
      </div>}

      {/* ===== RELEASE FORM ===== */}
      {view === 'release' && selected && <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h2 className="font-bold text-sm">Release Body — {ptName(selected)}</h2>
        {selected.patient && <div className="text-xs text-gray-500">{selected.patient.uhid} · Cause: {selected.cause_of_death}</div>}

        {/* Pre-release checks */}
        {selected.post_mortem_required && !selected.post_mortem_done && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 font-medium">Post-mortem is required but not yet completed. Cannot release.</div>}
        {selected.police_intimation && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">This is a police/MLC case. NOC from police is required before release.</div>}

        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Released To (Full Name) *</label>
            <input value={releaseForm.releasedTo} onChange={e => setReleaseForm(f => ({ ...f, releasedTo: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Name of person collecting the body" /></div>
          <div><label className="text-xs text-gray-500">Death Certificate Number</label>
            <input value={releaseForm.deathCertNumber} onChange={e => setReleaseForm(f => ({ ...f, deathCertNumber: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Certificate #" /></div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={releaseForm.idProofCollected} onChange={e => setReleaseForm(f => ({ ...f, idProofCollected: e.target.checked }))} className="rounded" /> ID proof of recipient collected</label>
          {selected.police_intimation && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={releaseForm.nocFromPolice} onChange={e => setReleaseForm(f => ({ ...f, nocFromPolice: e.target.checked }))} className="rounded" /> NOC from police obtained</label>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('current')} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button>
          <button onClick={handleRelease} disabled={selected.post_mortem_required && !selected.post_mortem_done}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Authorize Release</button>
        </div>
      </div>}
    </div>
  );
}

export default function MortuaryPage() {
  return <RoleGuard module="settings"><MortuaryInner /></RoleGuard>;
}
