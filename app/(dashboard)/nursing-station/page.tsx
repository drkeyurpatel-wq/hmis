'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useNursingStation, recordVitals, recordIO, saveNursingNote, type NursingPatient, type NursingTask } from '@/lib/nursing/nursing-station-hooks';
import Link from 'next/link';

const NEWS2_COLORS: Record<string, string> = { low: 'bg-green-100 text-green-800', low_med: 'bg-yellow-100 text-yellow-800', medium: 'bg-orange-100 text-orange-800', high: 'bg-red-600 text-white animate-pulse' };
const WARD_COLORS: Record<string, string> = { icu: 'bg-red-100 text-red-700', transplant_icu: 'bg-red-100 text-red-700', nicu: 'bg-pink-100 text-pink-700', general: 'bg-gray-100 text-gray-700', private: 'bg-purple-100 text-purple-700', semi_private: 'bg-blue-100 text-blue-700', isolation: 'bg-amber-100 text-amber-700' };
const TASK_COLORS: Record<string, string> = { overdue: 'bg-red-50 border-red-300', due_now: 'bg-amber-50 border-amber-300', upcoming: 'bg-blue-50 border-blue-200', completed: 'bg-green-50 border-green-200' };
const TASK_ICONS: Record<string, string> = { vitals: '🩺', medication: '💊', io: '🥤', lab_collect: '🧪', wound_care: '🩹', positioning: '🔄', assessment: '📋', custom: '📌' };

type ViewMode = 'patients' | 'tasks' | 'handoff';

function NursingStationInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [wardFilter, setWardFilter] = useState('');
  const [view, setView] = useState<ViewMode>('patients');
  const station = useNursingStation(centreId, wardFilter || undefined);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Modals
  const [vitalsModal, setVitalsModal] = useState<NursingPatient | null>(null);
  const [ioModal, setIOModal] = useState<NursingPatient | null>(null);
  const [noteModal, setNoteModal] = useState<NursingPatient | null>(null);

  // Vitals form
  const [vf, setVf] = useState({ temperature: '', pulse: '', bp_systolic: '', bp_diastolic: '', resp_rate: '', spo2: '', gcs: '15', pain_scale: '', blood_sugar: '' });
  const resetVf = () => setVf({ temperature: '', pulse: '', bp_systolic: '', bp_diastolic: '', resp_rate: '', spo2: '', gcs: '15', pain_scale: '', blood_sugar: '' });

  // IO form
  const [iof, setIof] = useState({ shift: 'morning' as 'morning'|'evening'|'night', oral_intake_ml: '', iv_fluid_ml: '', blood_products_ml: '', urine_ml: '', drain_1_ml: '', ryles_aspirate_ml: '', vomit_ml: '', stool_count: '' });

  // Note form
  const [noteText, setNoteText] = useState('');
  const [noteShift, setNoteShift] = useState<'morning'|'evening'|'night'>('morning');

  // Handoff
  const [handoff, setHandoff] = useState({ outgoing: 'morning', incoming: 'evening', critical: '', notes: '' });

  const staffId = staff?.id || '';

  // ── Save vitals ──
  const handleSaveVitals = async () => {
    if (!vitalsModal || !staffId) return;
    const vitals: any = {};
    if (vf.temperature) vitals.temperature = parseFloat(vf.temperature);
    if (vf.pulse) vitals.pulse = parseInt(vf.pulse);
    if (vf.bp_systolic) vitals.bp_systolic = parseInt(vf.bp_systolic);
    if (vf.bp_diastolic) vitals.bp_diastolic = parseInt(vf.bp_diastolic);
    if (vf.resp_rate) vitals.resp_rate = parseInt(vf.resp_rate);
    if (vf.spo2) vitals.spo2 = parseFloat(vf.spo2);
    if (vf.gcs) vitals.gcs = parseInt(vf.gcs);
    if (vf.pain_scale) vitals.pain_scale = parseInt(vf.pain_scale);
    if (vf.blood_sugar) vitals.blood_sugar = parseFloat(vf.blood_sugar);
    if (Object.keys(vitals).length === 0) { flash('Enter at least one vital'); return; }
    const { error } = await recordVitals(vitalsModal.patientId, vitalsModal.admissionId, staffId, vitals);
    if (error) { flash('Error: ' + error); return; }
    flash(`Vitals saved for ${vitalsModal.patientName}`);
    setVitalsModal(null); resetVf(); station.load();
  };

  // ── Save IO ──
  const handleSaveIO = async () => {
    if (!ioModal || !staffId) return;
    const data: any = {};
    if (iof.oral_intake_ml) data.oral_intake_ml = parseInt(iof.oral_intake_ml);
    if (iof.iv_fluid_ml) data.iv_fluid_ml = parseInt(iof.iv_fluid_ml);
    if (iof.blood_products_ml) data.blood_products_ml = parseInt(iof.blood_products_ml);
    if (iof.urine_ml) data.urine_ml = parseInt(iof.urine_ml);
    if (iof.drain_1_ml) data.drain_1_ml = parseInt(iof.drain_1_ml);
    if (iof.ryles_aspirate_ml) data.ryles_aspirate_ml = parseInt(iof.ryles_aspirate_ml);
    if (iof.vomit_ml) data.vomit_ml = parseInt(iof.vomit_ml);
    if (iof.stool_count) data.stool_count = parseInt(iof.stool_count);
    const { error } = await recordIO(ioModal.admissionId, staffId, iof.shift, data);
    if (error) { flash('Error: ' + error); return; }
    flash(`I/O saved for ${ioModal.patientName}`);
    setIOModal(null); station.load();
  };

  // ── Save note ──
  const handleSaveNote = async () => {
    if (!noteModal || !staffId || !noteText.trim()) return;
    const { error } = await saveNursingNote(noteModal.admissionId, staffId, noteShift, noteText);
    if (error) { flash('Error: ' + error); return; }
    flash('Note saved');
    setNoteModal(null); setNoteText('');
  };

  // ── Format vitals inline ──
  const VitalsLine = ({ p }: { p: NursingPatient }) => {
    const v = p.lastVitals;
    if (!v) return <span className="text-[10px] text-gray-400 italic">No vitals recorded</span>;
    const items: string[] = [];
    if (v.bp_systolic) items.push(`BP ${v.bp_systolic}/${v.bp_diastolic || '?'}`);
    if (v.pulse) items.push(`HR ${v.pulse}`);
    if (v.spo2) items.push(`SpO2 ${v.spo2}%`);
    if (v.temperature) items.push(`T ${v.temperature}°`);
    if (v.resp_rate) items.push(`RR ${v.resp_rate}`);
    const ago = p.hoursSinceVitals < 1 ? `${Math.round(p.hoursSinceVitals * 60)}m ago` : `${Math.round(p.hoursSinceVitals)}h ago`;
    return <span className="text-[10px] text-gray-600">{items.join(' · ')} <span className={p.vitalsDue ? 'text-red-600 font-bold' : 'text-gray-400'}>({ago})</span></span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Nursing Station</h1>
          <p className="text-xs text-gray-500">{staff?.full_name} — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}, {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex gap-2">
          <select value={wardFilter} onChange={e => setWardFilter(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="">All Wards</option>
            {station.wards.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.type?.replace('_', ' ')})</option>)}
          </select>
          <button onClick={station.load} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg hover:bg-gray-200">↻ Refresh</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 lg:grid-cols-10 gap-2">
        {[
          { label: 'Total', val: station.stats.totalPatients, bg: 'bg-white' },
          { label: 'ICU', val: station.stats.icuPatients, bg: 'bg-red-50' },
          { label: 'Vitals Due', val: station.stats.vitalsDue, bg: station.stats.vitalsDue > 0 ? 'bg-amber-50' : 'bg-green-50' },
          { label: 'Meds Due', val: station.stats.medsDue, bg: station.stats.medsDue > 0 ? 'bg-blue-50' : 'bg-green-50' },
          { label: 'Meds Late', val: station.stats.medsOverdue, bg: station.stats.medsOverdue > 0 ? 'bg-red-50' : 'bg-green-50' },
          { label: 'Labs Pending', val: station.stats.pendingLabs, bg: 'bg-white' },
          { label: 'I/O Pending', val: station.stats.ioPending, bg: station.stats.ioPending > 0 ? 'bg-amber-50' : 'bg-white' },
          { label: 'Critical', val: station.stats.criticalAlerts, bg: station.stats.criticalAlerts > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50' },
          { label: 'NEWS≥5', val: station.stats.highNEWS, bg: station.stats.highNEWS > 0 ? 'bg-red-50' : 'bg-white' },
          { label: 'Overdue', val: station.stats.overdueTasks, bg: station.stats.overdueTasks > 0 ? 'bg-red-50' : 'bg-white' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl border p-2 text-center`}>
            <div className="text-[9px] text-gray-500 leading-tight">{k.label}</div>
            <div className="text-lg font-bold">{k.val}</div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-1">
        {(['patients', 'tasks', 'handoff'] as ViewMode[]).map(v =>
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${view === v ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {v === 'patients' ? `Patient Board (${station.patients.length})` : v === 'tasks' ? `Tasks (${station.tasks.length})` : 'Shift Handoff'}
          </button>
        )}
      </div>

      {station.loading ? <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div> : <>

      {/* ===== PATIENT BOARD ===== */}
      {view === 'patients' && (
        station.patients.length === 0
          ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No active patients{wardFilter ? ' in selected ward' : ''}</div>
          : <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {station.patients.map((p: NursingPatient) => (
              <div key={p.admissionId} className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${p.criticalAlerts.length > 0 ? 'border-red-300 ring-1 ring-red-100' : ''}`}>
                {/* Row 1: Bed + Name + Ward + Day */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-teal-700 text-white px-2 py-0.5 rounded text-[10px] font-bold min-w-[48px] text-center">{p.bedNumber}</span>
                    <Link href={`/ipd/${p.admissionId}`} className="font-bold text-sm text-gray-900 hover:text-teal-700">{p.patientName}</Link>
                    <span className="text-[10px] text-gray-400">{p.uhid} · {p.age}y {p.gender?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${WARD_COLORS[p.wardType] || 'bg-gray-100'}`}>{p.wardName}</span>
                    <span className="text-[10px] text-gray-400">D{p.daysSince}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${NEWS2_COLORS[p.news2Risk]}`}>N{p.news2}</span>
                  </div>
                </div>

                {/* Row 2: Doctor + Dept + Diagnosis */}
                <div className="text-[10px] text-gray-500 mb-1.5">
                  {p.doctorName} · {p.department} · <span className="italic">{p.diagnosis || p.ipdNumber}</span> · <span className="uppercase text-[9px]">{p.payorType}</span>
                </div>

                {/* Row 3: Last vitals inline */}
                <div className="mb-2"><VitalsLine p={p} /></div>

                {/* Row 4: Alert badges */}
                {p.criticalAlerts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {p.criticalAlerts.map((a, i) => <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-medium">{a}</span>)}
                  </div>
                )}

                {/* Row 5: Status badges */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {p.vitalsDue && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">🩺 Vitals due</span>}
                  {p.medsOverdueCount > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">💊 {p.medsOverdueCount} overdue</span>}
                  {p.medsDueCount > 0 && p.medsOverdueCount === 0 && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">💊 {p.medsDueCount} due</span>}
                  {p.pendingLabs > 0 && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">🧪 {p.pendingLabs} labs</span>}
                  {p.ioPending && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">🥤 No I/O</span>}
                  {!p.ioPending && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">I: {p.todayIntake}ml O: {p.todayOutput}ml</span>}
                  {p.activeMeds.length > 0 && <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-[10px]">{p.activeMeds.length} active Rx</span>}
                </div>

                {/* Row 6: Actions */}
                <div className="flex gap-1 pt-2 border-t border-gray-100">
                  <button onClick={() => { setVitalsModal(p); resetVf(); }} className="px-2.5 py-1.5 bg-amber-50 text-amber-700 text-[10px] rounded-lg font-medium hover:bg-amber-100 transition-colors">🩺 Vitals</button>
                  <Link href={`/ipd/${p.admissionId}`} className="px-2.5 py-1.5 bg-blue-50 text-blue-700 text-[10px] rounded-lg font-medium hover:bg-blue-100 transition-colors">💊 Meds</Link>
                  <button onClick={() => setIOModal(p)} className="px-2.5 py-1.5 bg-green-50 text-green-700 text-[10px] rounded-lg font-medium hover:bg-green-100 transition-colors">🥤 I/O</button>
                  <button onClick={() => { setNoteModal(p); setNoteText(''); }} className="px-2.5 py-1.5 bg-gray-50 text-gray-700 text-[10px] rounded-lg font-medium hover:bg-gray-100 transition-colors">📝 Note</button>
                  <Link href={`/ipd/${p.admissionId}`} className="px-2.5 py-1.5 bg-gray-50 text-gray-700 text-[10px] rounded-lg font-medium hover:bg-gray-100 transition-colors ml-auto">Open Chart →</Link>
                </div>
              </div>
            ))}
          </div>
      )}

      {/* ===== TASK BOARD ===== */}
      {view === 'tasks' && (
        station.tasks.length === 0
          ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No pending tasks</div>
          : <div className="space-y-2">
            {station.tasks.map((t: NursingTask) => (
              <div key={t.id} className={`rounded-xl border p-3 flex items-center justify-between ${TASK_COLORS[t.status]}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{TASK_ICONS[t.type]}</span>
                  <div>
                    <div className="text-sm font-medium">{t.description}</div>
                    <div className="text-xs text-gray-500"><span className="font-bold">{t.bedNumber}</span> — {t.patientName} <span className="text-gray-400">{t.uhid}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${t.status === 'overdue' ? 'bg-red-600 text-white' : t.status === 'due_now' ? 'bg-amber-500 text-white' : 'bg-blue-100 text-blue-700'}`}>{t.status.replace('_', ' ')}</span>
                  {t.type === 'vitals' && <button onClick={() => { const p = station.patients.find(x => x.admissionId === t.admissionId); if (p) { setVitalsModal(p); resetVf(); } }} className="px-2 py-1 bg-white border rounded text-[10px] hover:bg-amber-50 font-medium">Record</button>}
                  {t.type === 'io' && <button onClick={() => { const p = station.patients.find(x => x.admissionId === t.admissionId); if (p) setIOModal(p); }} className="px-2 py-1 bg-white border rounded text-[10px] hover:bg-green-50 font-medium">Record</button>}
                  <Link href={`/ipd/${t.admissionId}`} className="px-2 py-1 bg-white border rounded text-[10px] hover:bg-blue-50">Chart →</Link>
                </div>
              </div>
            ))}
          </div>
      )}

      {/* ===== SHIFT HANDOFF ===== */}
      {view === 'handoff' && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-bold text-sm">Shift Handoff Report</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-gray-500">Outgoing Shift</label>
              <select value={handoff.outgoing} onChange={e => setHandoff(h => ({...h, outgoing: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="morning">Morning (7 AM – 2 PM)</option><option value="evening">Evening (2 PM – 9 PM)</option><option value="night">Night (9 PM – 7 AM)</option></select></div>
            <div><label className="text-xs text-gray-500">Incoming Shift</label>
              <select value={handoff.incoming} onChange={e => setHandoff(h => ({...h, incoming: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="morning">Morning (7 AM – 2 PM)</option><option value="evening">Evening (2 PM – 9 PM)</option><option value="night">Night (9 PM – 7 AM)</option></select></div>
          </div>

          {/* Auto summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-bold text-gray-700">Ward Summary (auto-generated)</h3>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div>Patients: <b>{station.stats.totalPatients}</b></div>
              <div>ICU: <b>{station.stats.icuPatients}</b></div>
              <div>Vitals due: <b className={station.stats.vitalsDue > 0 ? 'text-red-700' : ''}>{station.stats.vitalsDue}</b></div>
              <div>Meds due: <b className={station.stats.medsDue > 0 ? 'text-red-700' : ''}>{station.stats.medsDue}</b></div>
              <div>Labs pending: <b>{station.stats.pendingLabs}</b></div>
            </div>
            {station.patients.filter(p => p.criticalAlerts.length > 0).length > 0 && (
              <div className="mt-2"><div className="text-[10px] font-bold text-red-700 mb-1">Critical patients:</div>
                {station.patients.filter(p => p.criticalAlerts.length > 0).map(p => (
                  <div key={p.admissionId} className="text-xs text-red-600">• {p.bedNumber} — {p.patientName}: {p.criticalAlerts.join('; ')}</div>
                ))}
              </div>
            )}
          </div>

          <div><label className="text-xs text-gray-500">Additional Notes</label>
            <textarea value={handoff.notes} onChange={e => setHandoff(h => ({...h, notes: e.target.value}))} rows={4} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Pending tasks, expected discharges, new admissions, equipment issues..." /></div>

          <button onClick={async () => {
            if (!staffId) return;
            const report = `SHIFT HANDOFF: ${handoff.outgoing} → ${handoff.incoming}\n\nTotal: ${station.stats.totalPatients} | ICU: ${station.stats.icuPatients} | Vitals due: ${station.stats.vitalsDue} | Meds due: ${station.stats.medsDue}\n\nCritical:\n${station.patients.filter(p => p.criticalAlerts.length > 0).map(p => `${p.bedNumber} ${p.patientName}: ${p.criticalAlerts.join('; ')}`).join('\n')}\n\n${handoff.notes}`;
            // Save as nursing note for each active admission (group note)
            const firstAdm = station.patients[0]?.admissionId;
            if (firstAdm) {
              await saveNursingNote(firstAdm, staffId, handoff.outgoing as any, report);
            }
            flash('Handoff report saved');
          }} className="px-6 py-2.5 bg-emerald-600 text-white text-sm rounded-lg font-medium hover:bg-emerald-700 transition-colors">Save Handoff Report</button>
        </div>
      )}
      </>}

      {/* ===== VITALS MODAL ===== */}
      {vitalsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setVitalsModal(null)}>
          <div className="bg-white rounded-xl w-[520px] max-h-[90vh] overflow-y-auto p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-sm">Record Vitals</h3>
                <p className="text-xs text-gray-500">{vitalsModal.bedNumber} — {vitalsModal.patientName} ({vitalsModal.uhid})</p>
              </div>
              <button onClick={() => setVitalsModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>

            {vitalsModal.lastVitals && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600">
                <span className="font-medium">Previous:</span> BP {vitalsModal.lastVitals.bp_systolic}/{vitalsModal.lastVitals.bp_diastolic} · HR {vitalsModal.lastVitals.pulse} · SpO2 {vitalsModal.lastVitals.spo2}% · T {vitalsModal.lastVitals.temperature}° · RR {vitalsModal.lastVitals.resp_rate}
                <span className="text-gray-400 ml-2">({Math.round(vitalsModal.hoursSinceVitals)}h ago)</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'BP Systolic', key: 'bp_systolic', ph: '120', unit: 'mmHg' },
                { label: 'BP Diastolic', key: 'bp_diastolic', ph: '80', unit: 'mmHg' },
                { label: 'Heart Rate', key: 'pulse', ph: '72', unit: 'bpm' },
                { label: 'SpO2', key: 'spo2', ph: '98', unit: '%' },
                { label: 'Temperature', key: 'temperature', ph: '98.6', unit: '°F' },
                { label: 'Resp Rate', key: 'resp_rate', ph: '16', unit: '/min' },
                { label: 'GCS', key: 'gcs', ph: '15', unit: '/15' },
                { label: 'Pain Scale', key: 'pain_scale', ph: '0', unit: '/10' },
                { label: 'Blood Sugar', key: 'blood_sugar', ph: '110', unit: 'mg/dL' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] text-gray-500">{f.label}</label>
                  <div className="relative">
                    <input type="number" step="any" value={(vf as any)[f.key]} onChange={e => setVf(v => ({...v, [f.key]: e.target.value}))}
                      className="w-full px-3 py-2 border rounded-lg text-sm pr-12" placeholder={f.ph} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveVitals} className="flex-1 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium hover:bg-teal-700">Save Vitals</button>
              <button onClick={() => setVitalsModal(null)} className="px-4 py-2.5 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== I/O MODAL ===== */}
      {ioModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setIOModal(null)}>
          <div className="bg-white rounded-xl w-[500px] max-h-[90vh] overflow-y-auto p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-sm">I/O Chart Entry</h3>
                <p className="text-xs text-gray-500">{ioModal.bedNumber} — {ioModal.patientName}</p>
              </div>
              <button onClick={() => setIOModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500">Shift</label>
              <select value={iof.shift} onChange={e => setIof(f => ({...f, shift: e.target.value as any}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-green-700">INTAKE (ml)</h4>
                {[['oral_intake_ml','Oral'],['iv_fluid_ml','IV Fluids'],['blood_products_ml','Blood Products']].map(([k,l]) => (
                  <div key={k}><label className="text-[10px] text-gray-500">{l}</label>
                    <input type="number" value={(iof as any)[k]} onChange={e => setIof(f => ({...f, [k]: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" /></div>
                ))}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-red-700">OUTPUT (ml)</h4>
                {[['urine_ml','Urine'],['drain_1_ml','Drain'],['ryles_aspirate_ml','Ryles Aspirate'],['vomit_ml','Vomitus'],['stool_count','Stool Count']].map(([k,l]) => (
                  <div key={k}><label className="text-[10px] text-gray-500">{l}</label>
                    <input type="number" value={(iof as any)[k]} onChange={e => setIof(f => ({...f, [k]: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" /></div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveIO} className="flex-1 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium hover:bg-teal-700">Save I/O</button>
              <button onClick={() => setIOModal(null)} className="px-4 py-2.5 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== NOTE MODAL ===== */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setNoteModal(null)}>
          <div className="bg-white rounded-xl w-[450px] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div><h3 className="font-bold text-sm">Nursing Note</h3><p className="text-xs text-gray-500">{noteModal.bedNumber} — {noteModal.patientName}</p></div>
              <button onClick={() => setNoteModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500">Shift</label>
              <select value={noteShift} onChange={e => setNoteShift(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option>
              </select>
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={5} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Patient condition, observations, interventions..." />
            <div className="flex gap-2 mt-3">
              <button onClick={handleSaveNote} className="flex-1 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium hover:bg-teal-700">Save Note</button>
              <button onClick={() => setNoteModal(null)} className="px-4 py-2.5 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NursingStationPage() { return <RoleGuard module="ipd"><NursingStationInner /></RoleGuard>; }
