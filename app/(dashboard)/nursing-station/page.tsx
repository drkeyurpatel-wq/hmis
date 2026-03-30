'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useNursingStation, useNursingVitals, type NursingPatient } from '@/lib/nursing/nursing-station-hooks';
import { useMAR, useMedicationOrders, useIOChart } from '@/lib/ipd/clinical-hooks';
import { calculateNEWS2 } from '@/lib/cdss/news2';
import SmartMAR from '@/components/ipd/smart-mar';
import SmartIOChart from '@/components/ipd/smart-io-chart';
import NursingShiftNotes from '@/components/ipd/nursing-shift-notes';
import Link from 'next/link';

const WARD_COLORS: Record<string, string> = {
  icu: 'bg-red-100 text-red-700', transplant_icu: 'bg-red-100 text-red-700',
  general: 'bg-gray-100 text-gray-700', private: 'bg-purple-100 text-purple-700',
  semi_private: 'bg-blue-100 text-blue-700', nicu: 'bg-pink-100 text-pink-700',
};

type Tab = 'ward' | 'vitals' | 'mar' | 'io' | 'notes';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'ward', label: 'Ward View', icon: '' },
  { key: 'vitals', label: 'Vitals', icon: '' },
  { key: 'mar', label: 'MAR', icon: '' },
  { key: 'io', label: 'IO Chart', icon: '🥤' },
  { key: 'notes', label: 'Notes', icon: '' },
];

// ---------- GCS helpers ----------
const GCS_EYE = [{ v: 4, l: 'Spontaneous' }, { v: 3, l: 'To voice' }, { v: 2, l: 'To pain' }, { v: 1, l: 'None' }];
const GCS_VERBAL = [{ v: 5, l: 'Oriented' }, { v: 4, l: 'Confused' }, { v: 3, l: 'Inappropriate' }, { v: 2, l: 'Incomprehensible' }, { v: 1, l: 'None' }];
const GCS_MOTOR = [{ v: 6, l: 'Obeys' }, { v: 5, l: 'Localizes' }, { v: 4, l: 'Withdraws' }, { v: 3, l: 'Flexion' }, { v: 2, l: 'Extension' }, { v: 1, l: 'None' }];

function NursingStationInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [wardFilter, setWardFilter] = useState('');
  const [tab, setTab] = useState<Tab>('ward');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Selected patient for vitals/MAR/IO/Notes
  const [selectedPt, setSelectedPt] = useState<NursingPatient | null>(null);

  const station = useNursingStation(centreId, wardFilter || undefined);

  // Per-patient hooks (activate when patient selected)
  const vitals = useNursingVitals(selectedPt?.patientId || null, selectedPt?.admissionId || null, centreId || undefined);
  const mar = useMAR(selectedPt?.admissionId || null);
  const meds = useMedicationOrders(selectedPt?.admissionId || null);
  const ioChart = useIOChart(selectedPt?.admissionId || null);

  // Vitals form state
  const initVitals = { bpSystolic: '', bpDiastolic: '', heartRate: '', temperature: '', spo2: '', respiratoryRate: '', gcsE: 4, gcsV: 5, gcsM: 6, painScore: '', bloodSugar: '', urineOutput: '' };
  const [vf, setVf] = useState(initVitals);
  const [news2, setNews2] = useState<ReturnType<typeof calculateNEWS2>>(null);

  const selectPatient = (p: NursingPatient, openTab?: Tab) => {
    setSelectedPt(p);
    setTab(openTab || 'vitals');
    setVf(initVitals);
    setNews2(null);
  };

  const saveVitals = async () => {
    if (!selectedPt) return;
    const gcs = vf.gcsE + vf.gcsV + vf.gcsM;
    const result = await vitals.record({
      bpSystolic: vf.bpSystolic ? Number(vf.bpSystolic) : undefined,
      bpDiastolic: vf.bpDiastolic ? Number(vf.bpDiastolic) : undefined,
      heartRate: vf.heartRate ? Number(vf.heartRate) : undefined,
      temperature: vf.temperature ? Number(vf.temperature) : undefined,
      spo2: vf.spo2 ? Number(vf.spo2) : undefined,
      respiratoryRate: vf.respiratoryRate ? Number(vf.respiratoryRate) : undefined,
      gcsScore: gcs < 15 ? gcs : undefined,
      painScore: vf.painScore ? Number(vf.painScore) : undefined,
      bloodSugar: vf.bloodSugar ? Number(vf.bloodSugar) : undefined,
      urineOutput: vf.urineOutput ? Number(vf.urineOutput) : undefined,
    }, staffId);
    if (result && !result.error) {
      // Calculate NEWS2
      const n2 = calculateNEWS2({
        respiratoryRate: vf.respiratoryRate ? Number(vf.respiratoryRate) : undefined,
        spo2: vf.spo2 ? Number(vf.spo2) : undefined,
        systolic: vf.bpSystolic ? Number(vf.bpSystolic) : undefined,
        heartRate: vf.heartRate ? Number(vf.heartRate) : undefined,
        temperature: vf.temperature ? Number(vf.temperature) : undefined,
        isAlert: gcs >= 15,
      });
      setNews2(n2);
      flash('Vitals saved');
      setVf(initVitals);
    }
  };

  // Last 3 vitals
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const last3 = useMemo(() => vitals.history.slice(0, 3), [vitals.history]);

  const fmtTime = (d: string) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header + Ward Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-[family-name:var(--font-plus-jakarta)]">Nursing Station</h1>
          <p className="text-xs text-gray-500">{staff?.full_name} — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={wardFilter} onChange={e => { setWardFilter(e.target.value); setSelectedPt(null); setTab('ward'); }}
            className="px-3 py-1.5 border rounded-xl text-xs bg-white">
            <option value="">All Wards</option>
            {station.wards.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.type?.replace('_', ' ')})</option>)}
          </select>
          <button onClick={() => station.load()} className="px-3 py-1.5 bg-gray-100 text-xs rounded-xl hover:bg-gray-200">Refresh</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-6 gap-2">
        <div className="bg-white rounded-2xl border p-2 text-center"><div className="text-2xl font-bold">{station.stats.totalPatients}</div><div className="text-[9px] text-gray-500">Patients</div></div>
        <div className="bg-red-50 rounded-2xl border p-2 text-center"><div className="text-2xl font-bold text-red-700">{station.stats.icuPatients}</div><div className="text-[9px] text-gray-500">ICU</div></div>
        <div className={`rounded-2xl border p-2 text-center ${station.stats.vitalsDue > 0 ? 'bg-amber-50' : 'bg-green-50'}`}><div className={`text-2xl font-bold ${station.stats.vitalsDue > 0 ? 'text-amber-700' : 'text-green-700'}`}>{station.stats.vitalsDue}</div><div className="text-[9px] text-gray-500">Vitals Due</div></div>
        <div className={`rounded-2xl border p-2 text-center ${station.stats.medsDue > 0 ? 'bg-blue-50' : 'bg-green-50'}`}><div className={`text-2xl font-bold ${station.stats.medsDue > 0 ? 'text-blue-700' : 'text-green-700'}`}>{station.stats.medsDue}</div><div className="text-[9px] text-gray-500">Meds Due</div></div>
        <div className={`rounded-2xl border p-2 text-center ${station.stats.criticalAlerts > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50'}`}><div className={`text-2xl font-bold ${station.stats.criticalAlerts > 0 ? 'text-red-700 animate-pulse' : 'text-green-700'}`}>{station.stats.criticalAlerts}</div><div className="text-[9px] text-gray-500">Critical</div></div>
        <div className="bg-white rounded-2xl border p-2 text-center"><div className="text-2xl font-bold">{station.stats.pendingLabs}</div><div className="text-[9px] text-gray-500">Labs Pending</div></div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { if (t.key !== 'ward' && !selectedPt) { flash('Select a patient first'); return; } setTab(t.key); }}
            className={`flex-1 py-2 text-xs font-medium rounded-xl transition-colors ${tab === t.key ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Selected patient banner */}
      {selectedPt && tab !== 'ward' && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-teal-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold">{selectedPt.bedNumber}</span>
            <div>
              <span className="font-bold text-sm">{selectedPt.patientName}</span>
              <span className="text-xs text-gray-500 ml-2">{selectedPt.uhid} · {selectedPt.ipdNumber} · Dr. {selectedPt.doctorName}</span>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${WARD_COLORS[selectedPt.wardType] || 'bg-gray-100'}`}>{selectedPt.wardType.replace('_', ' ')}</span>
          </div>
          <button onClick={() => { setSelectedPt(null); setTab('ward'); }} className="text-xs text-gray-400 hover:text-gray-600">← Back to Ward</button>
        </div>
      )}

      {station.loading ? <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}</div> : <>

      {/* ===== WARD VIEW — Patient Cards ===== */}
      {tab === 'ward' && (
        station.patients.length === 0 ? <div className="text-center py-12 bg-white rounded-2xl border text-gray-400 text-sm">No active patients in selected ward</div> :
        <div className="grid grid-cols-2 gap-3">
          {station.patients.map((p: NursingPatient) => (
            <div key={p.admissionId} className={`bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow cursor-pointer ${p.criticalAlerts > 0 ? 'border-red-300 bg-red-50/30' : ''}`}
              onClick={() => selectPatient(p)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg text-[10px] font-bold">{p.bedNumber}</span>
                  <span className="font-bold text-sm">{p.patientId ? <Link href={`/patients/${p.patientId}`} className="hover:text-teal-600 hover:underline">{p.patientName}</Link> : p.patientName}</span>
                  <span className="text-[10px] font-mono text-gray-400">{p.uhid}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] ${WARD_COLORS[p.wardType] || 'bg-gray-100'}`}>{p.wardType.replace('_', ' ')}</span>
                  <span className="text-[10px] text-gray-400">Day {p.daysSince}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-2">Dr. {p.doctorName} | {p.department} | {p.ipdNumber} | {p.payorType}</div>
              {/* Alert badges */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {p.vitalsDueAt && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-medium"> Vitals due</span>}
                {p.medsDueCount > 0 && <span className={`px-2 py-1 rounded-lg text-[10px] font-medium ${p.criticalAlerts > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}> {p.medsDueCount} meds {p.criticalAlerts > 0 ? '(OVERDUE)' : 'due'}</span>}
                {p.pendingLabs > 0 && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-medium"> {p.pendingLabs} labs</span>}
                {p.news2Score !== null && p.news2Score >= 5 && <span className="px-2 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold animate-pulse">NEWS2: {p.news2Score}</span>}
              </div>
              {/* Quick action buttons */}
              <div className="flex gap-1 pt-2 border-t">
                <button onClick={e => { e.stopPropagation(); selectPatient(p, 'vitals'); }} className="px-2 py-1.5 bg-amber-50 text-amber-700 text-[10px] rounded-lg hover:bg-amber-100 font-medium"> Vitals</button>
                <button onClick={e => { e.stopPropagation(); selectPatient(p, 'mar'); }} className="px-2 py-1.5 bg-blue-50 text-blue-700 text-[10px] rounded-lg hover:bg-blue-100 font-medium"> MAR</button>
                <button onClick={e => { e.stopPropagation(); selectPatient(p, 'io'); }} className="px-2 py-1.5 bg-green-50 text-green-700 text-[10px] rounded-lg hover:bg-green-100 font-medium">🥤 I/O</button>
                <button onClick={e => { e.stopPropagation(); selectPatient(p, 'notes'); }} className="px-2 py-1.5 bg-purple-50 text-purple-700 text-[10px] rounded-lg hover:bg-purple-100 font-medium"> Notes</button>
                <Link href={`/ipd/${p.admissionId}`} onClick={e => e.stopPropagation()} className="px-2 py-1.5 bg-gray-50 text-gray-600 text-[10px] rounded-lg hover:bg-gray-100 ml-auto">Chart →</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== VITALS ENTRY ===== */}
      {tab === 'vitals' && selectedPt && (
        <div className="space-y-4">
          {/* Vitals Input Form — large touch-friendly */}
          <div className="bg-white rounded-2xl border p-5">
            <h2 className="font-bold text-sm mb-4 font-[family-name:var(--font-plus-jakarta)]">Record Vitals</h2>
            <div className="grid grid-cols-3 gap-4">
              {/* BP */}
              <div className="col-span-1">
                <label className="text-xs text-gray-500 block mb-1">Blood Pressure</label>
                <div className="flex gap-1 items-center">
                  <input type="number" placeholder="Sys" value={vf.bpSystolic} onChange={e => setVf(f => ({ ...f, bpSystolic: e.target.value }))}
                    className="w-full px-3 py-3 border rounded-xl text-lg font-bold text-center" />
                  <span className="text-gray-400 font-bold">/</span>
                  <input type="number" placeholder="Dia" value={vf.bpDiastolic} onChange={e => setVf(f => ({ ...f, bpDiastolic: e.target.value }))}
                    className="w-full px-3 py-3 border rounded-xl text-lg font-bold text-center" />
                </div>
                <div className="text-[10px] text-gray-400 text-center mt-0.5">mmHg</div>
              </div>
              {/* Heart Rate */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Heart Rate</label>
                <input type="number" placeholder="HR" value={vf.heartRate} onChange={e => setVf(f => ({ ...f, heartRate: e.target.value }))}
                  className="w-full px-3 py-3 border rounded-xl text-lg font-bold text-center" />
                <div className="text-[10px] text-gray-400 text-center mt-0.5">bpm</div>
              </div>
              {/* Temperature */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Temperature</label>
                <input type="number" step="0.1" placeholder="Temp" value={vf.temperature} onChange={e => setVf(f => ({ ...f, temperature: e.target.value }))}
                  className="w-full px-3 py-3 border rounded-xl text-lg font-bold text-center" />
                <div className="text-[10px] text-gray-400 text-center mt-0.5">°C</div>
              </div>
              {/* SpO2 */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">SpO2</label>
                <input type="number" placeholder="SpO2" value={vf.spo2} onChange={e => setVf(f => ({ ...f, spo2: e.target.value }))}
                  className="w-full px-3 py-3 border rounded-xl text-lg font-bold text-center" />
                <div className="text-[10px] text-gray-400 text-center mt-0.5">%</div>
              </div>
              {/* Respiratory Rate */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Respiratory Rate</label>
                <input type="number" placeholder="RR" value={vf.respiratoryRate} onChange={e => setVf(f => ({ ...f, respiratoryRate: e.target.value }))}
                  className="w-full px-3 py-3 border rounded-xl text-lg font-bold text-center" />
                <div className="text-[10px] text-gray-400 text-center mt-0.5">/min</div>
              </div>
              {/* Pain */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Pain (0-10)</label>
                <div className="flex gap-0.5">
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setVf(f => ({ ...f, painScore: String(n) }))}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                        String(n) === vf.painScore
                          ? n <= 3 ? 'bg-green-500 text-white' : n <= 6 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>{n}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* GCS */}
            <div className="mt-4 border-t pt-4">
              <label className="text-xs text-gray-500 mb-2 block">GCS (E{vf.gcsE} + V{vf.gcsV} + M{vf.gcsM} = <b>{vf.gcsE + vf.gcsV + vf.gcsM}</b>/15)</label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Eye Opening</div>
                  <div className="flex gap-0.5">{GCS_EYE.map(g => (
                    <button key={g.v} onClick={() => setVf(f => ({ ...f, gcsE: g.v }))}
                      className={`flex-1 py-2 rounded-lg text-[10px] ${vf.gcsE === g.v ? 'bg-teal-600 text-white font-bold' : 'bg-gray-100'}`} title={g.l}>{g.v}</button>
                  ))}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Verbal</div>
                  <div className="flex gap-0.5">{GCS_VERBAL.map(g => (
                    <button key={g.v} onClick={() => setVf(f => ({ ...f, gcsV: g.v }))}
                      className={`flex-1 py-2 rounded-lg text-[10px] ${vf.gcsV === g.v ? 'bg-teal-600 text-white font-bold' : 'bg-gray-100'}`} title={g.l}>{g.v}</button>
                  ))}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Motor</div>
                  <div className="flex gap-0.5">{GCS_MOTOR.map(g => (
                    <button key={g.v} onClick={() => setVf(f => ({ ...f, gcsM: g.v }))}
                      className={`flex-1 py-2 rounded-lg text-[10px] ${vf.gcsM === g.v ? 'bg-teal-600 text-white font-bold' : 'bg-gray-100'}`} title={g.l}>{g.v}</button>
                  ))}</div>
                </div>
              </div>
            </div>

            {/* Blood Sugar + Urine Output */}
            <div className="grid grid-cols-2 gap-4 mt-4 border-t pt-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Blood Sugar</label>
                <input type="number" placeholder="mg/dL" value={vf.bloodSugar} onChange={e => setVf(f => ({ ...f, bloodSugar: e.target.value }))}
                  className="w-full px-3 py-3 border rounded-xl text-lg font-bold text-center" />
                <div className="text-[10px] text-gray-400 text-center mt-0.5">mg/dL</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Urine Output</label>
                <input type="number" placeholder="ml" value={vf.urineOutput} onChange={e => setVf(f => ({ ...f, urineOutput: e.target.value }))}
                  className="w-full px-3 py-3 border rounded-xl text-lg font-bold text-center" />
                <div className="text-[10px] text-gray-400 text-center mt-0.5">ml</div>
              </div>
            </div>

            <button onClick={saveVitals} className="w-full mt-4 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors">
              Save Vitals
            </button>
          </div>

          {/* NEWS2 result */}
          {news2 && (
            <div className={`rounded-2xl border-2 p-4 ${
              news2.color === 'red' ? 'bg-red-50 border-red-400' :
              news2.color === 'orange' ? 'bg-orange-50 border-orange-400' :
              news2.color === 'yellow' ? 'bg-yellow-50 border-yellow-400' : 'bg-green-50 border-green-400'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm">NEWS2 Score</h3>
                <span className={`px-3 py-1 rounded-xl text-sm font-bold ${
                  news2.color === 'red' ? 'bg-red-600 text-white' :
                  news2.color === 'orange' ? 'bg-orange-500 text-white' :
                  news2.color === 'yellow' ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'
                }`}>{news2.total} — {news2.label}</span>
              </div>
              <p className="text-xs mb-2">{news2.action}</p>
              <div className="flex flex-wrap gap-2">
                {news2.breakdown.map(b => (
                  <span key={b.param} className={`px-2 py-1 rounded-lg text-[10px] ${b.score >= 3 ? 'bg-red-200 text-red-800' : b.score >= 2 ? 'bg-orange-200 text-orange-800' : b.score >= 1 ? 'bg-yellow-200 text-yellow-800' : 'bg-green-100 text-green-700'}`}>
                    {b.param}: {b.value} ({b.score})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last 3 vitals for trend */}
          {last3.length > 0 && (
            <div className="bg-white rounded-2xl border p-4">
              <h3 className="font-bold text-xs mb-3">Recent Vitals (last {last3.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b">
                    <th className="p-2 text-left">Time</th><th className="p-2">BP</th><th className="p-2">HR</th>
                    <th className="p-2">Temp</th><th className="p-2">SpO2</th><th className="p-2">RR</th>
                    <th className="p-2">GCS</th><th className="p-2">Pain</th><th className="p-2">Sugar</th>
                    <th className="p-2">Urine</th><th className="p-2 text-left">By</th>
                  </tr></thead>
                  <tbody>{last3.map(v => (
                    <tr key={v.id} className="border-b">
                      <td className="p-2 text-gray-500 whitespace-nowrap">{fmtTime(v.recorded_at)}</td>
                      <td className="p-2 text-center font-medium">{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—'}</td>
                      <td className="p-2 text-center">{v.heart_rate ?? '—'}</td>
                      <td className="p-2 text-center">{v.temperature ?? '—'}</td>
                      <td className={`p-2 text-center ${v.spo2 !== null && v.spo2 < 94 ? 'text-red-700 font-bold' : ''}`}>{v.spo2 ?? '—'}</td>
                      <td className="p-2 text-center">{v.respiratory_rate ?? '—'}</td>
                      <td className="p-2 text-center">{v.gcs_score ?? '—'}</td>
                      <td className={`p-2 text-center ${v.pain_score !== null && v.pain_score >= 7 ? 'text-red-700 font-bold' : ''}`}>{v.pain_score ?? '—'}</td>
                      <td className="p-2 text-center">{v.blood_sugar ?? '—'}</td>
                      <td className="p-2 text-center">{v.urine_output ?? '—'}</td>
                      <td className="p-2 text-gray-500">{v.recorder?.full_name || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MAR ===== */}
      {tab === 'mar' && selectedPt && (
        <div className="bg-white rounded-2xl border p-5">
          <SmartMAR
            records={mar.records} meds={meds.orders} admissionId={selectedPt.admissionId} staffId={staffId}
            onAdminister={async (id, sid) => { await mar.administer(id, sid); }}
            onHold={async (id, reason) => { await mar.holdDose(id, reason); }}
            onFlash={flash}
          />
        </div>
      )}

      {/* ===== IO CHART ===== */}
      {tab === 'io' && selectedPt && (
        <div className="bg-white rounded-2xl border p-5">
          <SmartIOChart
            entries={ioChart.entries} admissionId={selectedPt.admissionId} staffId={staffId}
            onAdd={async (entry, sid) => { await ioChart.addEntry(entry, sid); }}
            onFlash={flash}
          />
        </div>
      )}

      {/* ===== NOTES ===== */}
      {tab === 'notes' && selectedPt && (
        <div className="bg-white rounded-2xl border p-5">
          <NursingShiftNotes
            admissionId={selectedPt.admissionId} staffId={staffId}
            patientName={selectedPt.patientName} onFlash={flash}
          />
        </div>
      )}

      </>}
    </div>
  );
}

export default function NursingStationPage() { return <RoleGuard module="ipd"><NursingStationInner /></RoleGuard>; }
