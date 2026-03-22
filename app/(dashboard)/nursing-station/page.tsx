'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useNursingStation, type NursingPatient, type NursingTask } from '@/lib/nursing/nursing-station-hooks';
import Link from 'next/link';

const TASK_COLORS: Record<string, string> = {
  overdue: 'bg-red-50 border-red-300', due_now: 'bg-amber-50 border-amber-300',
  upcoming: 'bg-blue-50 border-blue-200', completed: 'bg-green-50 border-green-200',
};
const TASK_ICONS: Record<string, string> = {
  vitals: '🩺', medication: '💊', io: '🥤', lab_collect: '🧪',
  wound_care: '🩹', positioning: '🔄', assessment: '📋', custom: '📌',
};
const WARD_COLORS: Record<string, string> = {
  icu: 'bg-red-100 text-red-700', transplant_icu: 'bg-red-100 text-red-700',
  general: 'bg-gray-100 text-gray-700', private: 'bg-purple-100 text-purple-700',
  semi_private: 'bg-blue-100 text-teal-700', nicu: 'bg-pink-100 text-pink-700',
};

type ViewMode = 'patients' | 'tasks' | 'handoff';

function NursingStationInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [wardFilter, setWardFilter] = useState<string>('');
  const [view, setView] = useState<ViewMode>('patients');
  const station = useNursingStation(centreId, wardFilter || undefined);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Handoff note
  const [handoff, setHandoff] = useState({ outgoingShift: 'day', incomingShift: 'evening', notes: '', criticalPatients: '' });

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Nursing Station</h1>
          <p className="text-xs text-gray-500">{staff?.full_name} — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}, {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p></div>
        <div className="flex gap-2">
          <select value={wardFilter} onChange={e => setWardFilter(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="">All Wards</option>
            {station.wards.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.type?.replace('_', ' ')})</option>)}
          </select>
          <button onClick={station.load} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Refresh</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-8 gap-2">
        <div className="bg-white rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Patients</div><div className="text-xl font-bold">{station.stats.totalPatients}</div></div>
        <div className="bg-red-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">ICU</div><div className="text-xl font-bold text-red-700">{station.stats.icuPatients}</div></div>
        <div className={`rounded-xl border p-2 text-center ${station.stats.vitalsDue > 0 ? 'bg-amber-50' : 'bg-green-50'}`}><div className="text-[9px] text-gray-500">Vitals Due</div><div className={`text-xl font-bold ${station.stats.vitalsDue > 0 ? 'text-amber-700' : 'text-green-700'}`}>{station.stats.vitalsDue}</div></div>
        <div className={`rounded-xl border p-2 text-center ${station.stats.medsDue > 0 ? 'bg-blue-50' : 'bg-green-50'}`}><div className="text-[9px] text-gray-500">Meds Due</div><div className={`text-xl font-bold ${station.stats.medsDue > 0 ? 'text-teal-700' : 'text-green-700'}`}>{station.stats.medsDue}</div></div>
        <div className="bg-white rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Labs Pending</div><div className="text-xl font-bold">{station.stats.pendingLabs}</div></div>
        <div className={`rounded-xl border p-2 text-center ${station.stats.criticalAlerts > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50'}`}><div className="text-[9px] text-gray-500">Critical</div><div className={`text-xl font-bold ${station.stats.criticalAlerts > 0 ? 'text-red-700 animate-pulse' : 'text-green-700'}`}>{station.stats.criticalAlerts}</div></div>
        <div className={`rounded-xl border p-2 text-center ${station.stats.overdueTasks > 0 ? 'bg-red-50' : 'bg-white'}`}><div className="text-[9px] text-gray-500">Overdue</div><div className={`text-xl font-bold ${station.stats.overdueTasks > 0 ? 'text-red-700' : ''}`}>{station.stats.overdueTasks}</div></div>
        <div className="bg-amber-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Due Now</div><div className="text-xl font-bold text-amber-700">{station.stats.dueNowTasks}</div></div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1">
        {(['patients', 'tasks', 'handoff'] as ViewMode[]).map(v =>
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-xs font-medium rounded-lg ${view === v ? 'bg-teal-600 text-white' : 'bg-white border'}`}>
            {v === 'patients' ? 'Patient Board' : v === 'tasks' ? 'Task Board' : 'Shift Handoff'}
          </button>
        )}
      </div>

      {station.loading ? <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div> : <>

      {/* ===== PATIENT BOARD ===== */}
      {view === 'patients' && (
        station.patients.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No active patients in selected ward</div> :
        <div className="grid grid-cols-2 gap-3">
          {station.patients.map((p: NursingPatient) => (
            <div key={p.admissionId} className={`bg-white rounded-xl border p-4 hover:shadow-sm ${p.criticalAlerts > 0 ? 'border-red-300 bg-red-50/30' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">{p.bedNumber}</span>
                  <Link href={`/ipd/${p.admissionId}`} className="font-bold text-sm text-teal-700 hover:underline">{p.patientName}</Link>
                  <span className="text-[10px] font-mono text-gray-400">{p.uhid}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`px-1 py-0.5 rounded text-[8px] ${WARD_COLORS[p.wardType] || 'bg-gray-100'}`}>{p.wardType.replace('_', ' ')}</span>
                  <span className="text-[10px] text-gray-400">Day {p.daysSince}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-2">Dr. {p.doctorName} | {p.department} | {p.ipdNumber} | {p.payorType}</div>
              {/* Alert badges */}
              <div className="flex flex-wrap gap-1.5">
                {p.vitalsDueAt && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">🩺 Vitals due</span>}
                {p.medsDueCount > 0 && <span className={`px-2 py-1 rounded text-[10px] font-medium ${p.criticalAlerts > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-teal-700'}`}>💊 {p.medsDueCount} meds {p.criticalAlerts > 0 ? '(OVERDUE)' : 'due'}</span>}
                {p.pendingLabs > 0 && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">🧪 {p.pendingLabs} labs</span>}
                {p.news2Score !== null && p.news2Score >= 5 && <span className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold animate-pulse">NEWS2: {p.news2Score}</span>}
                {p.wardType === 'icu' && <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-[10px]">ICU monitoring</span>}
              </div>
              {/* Quick actions */}
              <div className="flex gap-1 mt-2 pt-2 border-t">
                <Link href={`/ipd/${p.admissionId}`} className="px-2 py-1 bg-gray-100 text-[10px] rounded hover:bg-blue-100">Open Chart</Link>
                <button className="px-2 py-1 bg-gray-100 text-[10px] rounded hover:bg-amber-100">Record Vitals</button>
                <button className="px-2 py-1 bg-gray-100 text-[10px] rounded hover:bg-blue-100">Give Meds</button>
                <button className="px-2 py-1 bg-gray-100 text-[10px] rounded hover:bg-green-100">I/O Entry</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== TASK BOARD ===== */}
      {view === 'tasks' && (
        station.tasks.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No pending tasks</div> :
        <div className="space-y-2">
          {station.tasks.map((t: NursingTask) => (
            <div key={t.id} className={`rounded-xl border p-3 flex items-center justify-between ${TASK_COLORS[t.status]}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{TASK_ICONS[t.type]}</span>
                <div>
                  <div className="text-sm font-medium">{t.description}</div>
                  <div className="text-xs text-gray-500">
                    <span className="font-bold">{t.bedNumber}</span> — {t.patientName} <span className="text-gray-400">{t.uhid}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium ${t.status === 'overdue' ? 'text-red-700' : t.status === 'due_now' ? 'text-amber-700' : 'text-teal-700'}`}>{t.dueAt}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${t.status === 'overdue' ? 'bg-red-600 text-white' : t.status === 'due_now' ? 'bg-amber-500 text-white' : 'bg-blue-100 text-teal-700'}`}>{t.status.replace('_', ' ')}</span>
                <Link href={`/ipd/${t.admissionId}`} className="px-2 py-1 bg-white border rounded text-[10px] hover:bg-blue-50">Open</Link>
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
              <select value={handoff.outgoingShift} onChange={e => setHandoff(h => ({ ...h, outgoingShift: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="morning">Morning (7 AM – 2 PM)</option><option value="evening">Evening (2 PM – 9 PM)</option><option value="night">Night (9 PM – 7 AM)</option>
              </select></div>
            <div><label className="text-xs text-gray-500">Incoming Shift</label>
              <select value={handoff.incomingShift} onChange={e => setHandoff(h => ({ ...h, incomingShift: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="morning">Morning (7 AM – 2 PM)</option><option value="evening">Evening (2 PM – 2 PM)</option><option value="night">Night (9 PM – 7 AM)</option>
              </select></div>
          </div>

          {/* Auto-generated summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-xs font-bold text-gray-700 mb-2">Ward Summary</h3>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>Total patients: <b>{station.stats.totalPatients}</b></div>
              <div>ICU: <b>{station.stats.icuPatients}</b></div>
              <div>Vitals pending: <b className={station.stats.vitalsDue > 0 ? 'text-red-700' : ''}>{station.stats.vitalsDue}</b></div>
              <div>Meds pending: <b className={station.stats.medsDue > 0 ? 'text-red-700' : ''}>{station.stats.medsDue}</b></div>
            </div>
          </div>

          <div><label className="text-xs text-gray-500">Critical Patients / Special Attention</label>
            <textarea value={handoff.criticalPatients} onChange={e => setHandoff(h => ({ ...h, criticalPatients: e.target.value }))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="List patients needing special attention — new admissions, post-op, critical values, deteriorating..." />
            {station.patients.filter(p => p.criticalAlerts > 0 || p.wardType === 'icu').length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">{station.patients.filter(p => p.criticalAlerts > 0 || p.wardType === 'icu').map(p =>
                <button key={p.admissionId} onClick={() => setHandoff(h => ({ ...h, criticalPatients: h.criticalPatients + (h.criticalPatients ? '\n' : '') + `${p.bedNumber} — ${p.patientName} (${p.wardType})` }))}
                  className="px-2 py-0.5 bg-red-50 text-red-700 text-[9px] rounded hover:bg-red-100">{p.bedNumber} {p.patientName}</button>
              )}</div>
            )}
          </div>

          <div><label className="text-xs text-gray-500">Handoff Notes</label>
            <textarea value={handoff.notes} onChange={e => setHandoff(h => ({ ...h, notes: e.target.value }))} rows={4} className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Pending tasks, expected discharges, new admissions expected, equipment issues, supply needs..." /></div>

          <button onClick={() => flash('Handoff saved')} className="px-6 py-2.5 bg-emerald-600 text-white text-sm rounded-lg font-medium">Save Handoff Report</button>
        </div>
      )}
      </>}
    </div>
  );
}

export default function NursingStationPage() { return <RoleGuard module="ipd"><NursingStationInner /></RoleGuard>; }
