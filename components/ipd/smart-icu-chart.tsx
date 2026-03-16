// components/ipd/smart-icu-chart.tsx
'use client';

import React, { useState, useMemo } from 'react';

interface Props {
  entries: any[]; admissionId: string; staffId: string; loading: boolean;
  onSave: (entry: any, staffId: string) => Promise<void>; onFlash: (m: string) => void;
}

// NEWS2 calculation
function calcNEWS2(v: any): { score: number; risk: string; color: string } {
  let score = 0;
  const rr = parseInt(v.rr); const spo2 = parseFloat(v.spo2); const temp = parseFloat(v.temp);
  const bp = parseInt(v.bp_sys); const hr = parseInt(v.hr);
  // RR
  if (!isNaN(rr)) { if (rr <= 8) score += 3; else if (rr <= 11) score += 1; else if (rr <= 20) score += 0; else if (rr <= 24) score += 2; else score += 3; }
  // SpO2 (Scale 1)
  if (!isNaN(spo2)) { if (spo2 <= 91) score += 3; else if (spo2 <= 93) score += 2; else if (spo2 <= 95) score += 1; }
  // Temp (°F → °C for scoring: (F-32)*5/9)
  if (!isNaN(temp)) { const c = (temp - 32) * 5 / 9; if (c <= 35) score += 3; else if (c <= 36) score += 1; else if (c <= 38) score += 0; else if (c <= 39) score += 1; else score += 2; }
  // SBP
  if (!isNaN(bp)) { if (bp <= 90) score += 3; else if (bp <= 100) score += 2; else if (bp <= 110) score += 1; else if (bp <= 219) score += 0; else score += 3; }
  // HR
  if (!isNaN(hr)) { if (hr <= 40) score += 3; else if (hr <= 50) score += 1; else if (hr <= 90) score += 0; else if (hr <= 110) score += 1; else if (hr <= 130) score += 2; else score += 3; }
  // Consciousness (AVPU) — if not alert
  if (v.consciousness && v.consciousness !== 'alert') score += 3;

  const risk = score >= 7 ? 'HIGH' : score >= 5 ? 'MEDIUM' : score >= 1 ? 'LOW' : 'NONE';
  const color = score >= 7 ? 'bg-red-600 text-white' : score >= 5 ? 'bg-orange-500 text-white' : score >= 1 ? 'bg-yellow-400 text-black' : 'bg-green-500 text-white';
  return { score, risk, color };
}

// Trend arrow
function trendArrow(current: number, previous: number | null): string {
  if (previous === null || isNaN(current) || isNaN(previous)) return '';
  const diff = current - previous;
  if (Math.abs(diff) < 1) return '→';
  return diff > 0 ? '↑' : '↓';
}

// Threshold alert
function vitalAlert(key: string, val: number): { alert: boolean; severity: string } {
  const thresholds: Record<string, { critLow?: number; low?: number; high?: number; critHigh?: number }> = {
    hr: { critLow: 40, low: 50, high: 120, critHigh: 150 },
    bp_sys: { critLow: 70, low: 90, high: 180, critHigh: 200 },
    bp_dia: { critHigh: 120 },
    rr: { critLow: 8, low: 10, high: 25, critHigh: 35 },
    spo2: { critLow: 85, low: 92 },
    temp: { low: 95, high: 100.4, critHigh: 104 },
  };
  const t = thresholds[key];
  if (!t || isNaN(val)) return { alert: false, severity: '' };
  if ((t.critLow && val <= t.critLow) || (t.critHigh && val >= t.critHigh)) return { alert: true, severity: 'critical' };
  if ((t.low && val < t.low) || (t.high && val > t.high)) return { alert: true, severity: 'warning' };
  return { alert: false, severity: '' };
}

const VENT_MODES = ['Room Air', 'Nasal Prongs', 'Face Mask', 'NRB Mask', 'Venturi Mask', 'HFNC', 'CPAP', 'BiPAP', 'PSV', 'SIMV', 'CMV', 'PRVC', 'APRV'];
const CONSCIOUSNESS = ['Alert', 'Voice responsive', 'Pain responsive', 'Unresponsive'];
const PUPIL_OPTIONS = ['BERL (Bilateral Equal Reactive to Light)', 'Right dilated', 'Left dilated', 'Bilateral dilated', 'Bilateral fixed', 'Unequal'];

// Quick presets
const PRESETS: Record<string, any> = {
  stable_ward: { hr: 78, bp_sys: 120, bp_dia: 76, rr: 16, spo2: 98, temp: 98.4, ventilator_mode: 'Room Air', consciousness: 'alert' },
  stable_o2: { hr: 82, bp_sys: 118, bp_dia: 74, rr: 18, spo2: 95, temp: 98.6, ventilator_mode: 'Nasal Prongs', fio2: 28, consciousness: 'alert' },
  icu_vent: { hr: 92, bp_sys: 110, bp_dia: 68, rr: 14, spo2: 96, temp: 99, ventilator_mode: 'SIMV', fio2: 40, peep: 5, consciousness: 'alert' },
};

export default function SmartICUChart({ entries, admissionId, staffId, loading, onSave, onFlash }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({
    hr: '', bp_sys: '', bp_dia: '', rr: '', spo2: '', temp: '',
    ventilator_mode: '', fio2: '', peep: '', tidal_volume: '', pip: '',
    gcs_eye: '', gcs_verbal: '', gcs_motor: '',
    rass: '', consciousness: 'alert', pupils: '',
    nursing_note: '', pain_score: '',
    iv_rate: '', vasopressor: '', sedation: '',
  });

  // Latest vitals for NEWS2 and trends
  const latest = entries.length > 0 ? entries[0] : null;
  const previous = entries.length > 1 ? entries[1] : null;

  const news2 = useMemo(() => {
    if (!latest) return null;
    return calcNEWS2(latest);
  }, [latest]);

  const applyPreset = (preset: string) => {
    setForm((f: any) => ({ ...f, ...PRESETS[preset] }));
  };

  const gcsTotal = (parseInt(form.gcs_eye) || 0) + (parseInt(form.gcs_verbal) || 0) + (parseInt(form.gcs_motor) || 0);

  const saveEntry = async () => {
    const clean: any = {};
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) clean[k] = v; });
    if (gcsTotal > 0) clean.gcs_total = gcsTotal;
    await onSave(clean, staffId);
    setShowForm(false);
    setForm({ hr: '', bp_sys: '', bp_dia: '', rr: '', spo2: '', temp: '', ventilator_mode: '', fio2: '', peep: '', tidal_volume: '', pip: '', gcs_eye: '', gcs_verbal: '', gcs_motor: '', rass: '', consciousness: 'alert', pupils: '', nursing_note: '', pain_score: '', iv_rate: '', vasopressor: '', sedation: '' });
    onFlash('ICU entry saved');
  };

  const vitalCell = (key: string, val: any, unit?: string) => {
    if (!val && val !== 0) return <span className="text-gray-300">—</span>;
    const numVal = parseFloat(val);
    const { alert, severity } = vitalAlert(key, numVal);
    const trend = previous ? trendArrow(numVal, parseFloat(previous[key])) : '';
    return (
      <span className={`${alert ? (severity === 'critical' ? 'text-red-600 font-bold animate-pulse' : 'text-orange-600 font-bold') : ''}`}>
        {val}{unit ? <span className="text-[9px] text-gray-400 ml-0.5">{unit}</span> : ''}{trend && <span className="text-[10px] ml-0.5">{trend}</span>}
      </span>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-sm">ICU Monitoring Chart</h2>
          {news2 && <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${news2.color}`}>NEWS2: {news2.score} ({news2.risk})</div>}
          {latest && <span className="text-[10px] text-gray-400">Last: {new Date(latest.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Record Vitals'}</button>
      </div>

      {/* Latest vitals banner */}
      {latest && !showForm && <div className="bg-white rounded-xl border p-3 mb-3">
        <div className="grid grid-cols-7 gap-3 text-center">
          {[['HR', latest.hr, 'hr', 'bpm'], ['BP', latest.bp_sys ? `${latest.bp_sys}/${latest.bp_dia}` : null, 'bp_sys', 'mmHg'], ['RR', latest.rr, 'rr', '/min'], ['SpO2', latest.spo2, 'spo2', '%'], ['Temp', latest.temp, 'temp', '°F'], ['GCS', latest.gcs_total, '', '/15'], ['RASS', latest.rass, '', '']].map(([label, val, key, unit]) => (
            <div key={label as string}>
              <div className="text-[10px] text-gray-400">{label}</div>
              <div className="text-lg font-bold">{val != null ? vitalCell(key as string, key === 'bp_sys' ? latest.bp_sys : val, unit as string) : <span className="text-gray-300">—</span>}</div>
            </div>
          ))}
        </div>
        {latest.ventilator_mode && latest.ventilator_mode !== 'Room Air' && (
          <div className="text-xs text-center mt-2 text-blue-700 bg-blue-50 rounded px-2 py-1">
            Vent: <b>{latest.ventilator_mode}</b>{latest.fio2 ? ` | FiO2 ${latest.fio2}%` : ''}{latest.peep ? ` | PEEP ${latest.peep}` : ''}
          </div>
        )}
      </div>}

      {/* Entry form */}
      {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        {/* Quick presets */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-gray-500">Quick fill:</span>
          <button onClick={() => applyPreset('stable_ward')} className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px]">Stable (Ward)</button>
          <button onClick={() => applyPreset('stable_o2')} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px]">Stable (O2)</button>
          <button onClick={() => applyPreset('icu_vent')} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px]">ICU (Ventilated)</button>
          {latest && <button onClick={() => setForm((f: any) => ({...f, hr: latest.hr || '', bp_sys: latest.bp_sys || '', bp_dia: latest.bp_dia || '', rr: latest.rr || '', spo2: latest.spo2 || '', temp: latest.temp || '', ventilator_mode: latest.ventilator_mode || '', fio2: latest.fio2 || '', peep: latest.peep || ''}))} className="px-2 py-0.5 bg-gray-50 text-gray-700 border border-gray-200 rounded text-[10px]">Copy Last</button>}
        </div>

        {/* Core vitals — big inputs */}
        <div className="grid grid-cols-6 gap-2">
          {[['hr','HR (bpm)','❤️'],['bp_sys','SBP','🩸'],['bp_dia','DBP',''],['rr','RR (/min)','🫁'],['spo2','SpO2 (%)','💨'],['temp','Temp (°F)','🌡️']].map(([k,l,icon]) =>
            <div key={k}><label className="text-[10px] text-gray-500">{icon} {l}</label>
              <input type="number" value={form[k]||''} onChange={e => setForm((f: any) => ({...f, [k]: e.target.value ? parseFloat(e.target.value) : ''}))}
                className={`w-full px-2 py-2 border rounded-lg text-sm font-bold text-center ${form[k] && vitalAlert(k, parseFloat(form[k])).alert ? 'border-red-400 bg-red-50' : ''}`} step={k==='temp'?0.1:1} /></div>
          )}
        </div>

        {/* Live NEWS2 from form */}
        {(form.hr || form.bp_sys || form.rr || form.spo2 || form.temp) && (() => {
          const liveNEWS = calcNEWS2(form);
          return <div className={`text-center py-1.5 rounded-lg text-xs font-bold ${liveNEWS.color}`}>
            NEWS2: {liveNEWS.score} — {liveNEWS.risk} risk
            {liveNEWS.score >= 5 && <span className="ml-2">⚠️ Consider urgent review</span>}
            {liveNEWS.score >= 7 && <span className="ml-2">🚨 EMERGENCY — escalate immediately</span>}
          </div>;
        })()}

        {/* Respiratory */}
        <div>
          <label className="text-[10px] text-gray-500 font-medium">Respiratory Support</label>
          <div className="flex flex-wrap gap-1 mt-1">{VENT_MODES.map(m => (
            <button key={m} onClick={() => setForm((f: any) => ({...f, ventilator_mode: m}))}
              className={`px-2 py-0.5 rounded border text-[10px] ${form.ventilator_mode === m ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-500 border-gray-200'}`}>{m}</button>
          ))}</div>
        </div>
        {form.ventilator_mode && !['Room Air','Nasal Prongs','Face Mask'].includes(form.ventilator_mode) && (
          <div className="grid grid-cols-4 gap-2">
            <div><label className="text-[10px] text-gray-500">FiO2 (%)</label>
              <input type="number" value={form.fio2||''} onChange={e => setForm((f: any) => ({...f, fio2: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">PEEP</label>
              <input type="number" value={form.peep||''} onChange={e => setForm((f: any) => ({...f, peep: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">TV (ml)</label>
              <input type="number" value={form.tidal_volume||''} onChange={e => setForm((f: any) => ({...f, tidal_volume: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">PIP (cmH2O)</label>
              <input type="number" value={form.pip||''} onChange={e => setForm((f: any) => ({...f, pip: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          </div>
        )}

        {/* Neuro */}
        <div className="grid grid-cols-5 gap-2">
          <div><label className="text-[10px] text-gray-500">GCS Eye (1-4)</label>
            <div className="flex gap-0.5">{[1,2,3,4].map(n => (
              <button key={n} onClick={() => setForm((f: any) => ({...f, gcs_eye: n}))}
                className={`flex-1 py-1 rounded text-xs border ${form.gcs_eye === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}>{n}</button>
            ))}</div></div>
          <div><label className="text-[10px] text-gray-500">GCS Verbal (1-5)</label>
            <div className="flex gap-0.5">{[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setForm((f: any) => ({...f, gcs_verbal: n}))}
                className={`flex-1 py-1 rounded text-xs border ${form.gcs_verbal === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}>{n}</button>
            ))}</div></div>
          <div><label className="text-[10px] text-gray-500">GCS Motor (1-6)</label>
            <div className="flex gap-0.5">{[1,2,3,4,5,6].map(n => (
              <button key={n} onClick={() => setForm((f: any) => ({...f, gcs_motor: n}))}
                className={`flex-1 py-1 rounded text-xs border ${form.gcs_motor === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}>{n}</button>
            ))}</div></div>
          <div><label className="text-[10px] text-gray-500">GCS Total</label>
            <div className={`text-center py-1 rounded-lg text-sm font-bold ${gcsTotal <= 8 ? 'bg-red-100 text-red-700' : gcsTotal <= 12 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{gcsTotal || '—'}/15</div></div>
          <div><label className="text-[10px] text-gray-500">RASS (-5 to +4)</label>
            <div className="flex gap-0.5">{[-5,-4,-3,-2,-1,0,1,2,3,4].map(n => (
              <button key={n} onClick={() => setForm((f: any) => ({...f, rass: n}))}
                className={`flex-1 py-1 rounded text-[8px] border ${form.rass === n ? (n < 0 ? 'bg-blue-600 text-white' : n > 0 ? 'bg-red-600 text-white' : 'bg-green-600 text-white') : 'bg-white text-gray-500'}`}>{n}</button>
            ))}</div></div>
        </div>

        {/* Consciousness + Pupils */}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500">Consciousness (AVPU)</label>
            <div className="flex gap-1 mt-1">{CONSCIOUSNESS.map(c => (
              <button key={c} onClick={() => setForm((f: any) => ({...f, consciousness: c.toLowerCase().split(' ')[0]}))}
                className={`flex-1 px-1 py-1 rounded text-[10px] border ${form.consciousness === c.toLowerCase().split(' ')[0] ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}>{c.split(' ')[0]}</button>
            ))}</div></div>
          <div><label className="text-[10px] text-gray-500">Pupils</label>
            <select value={form.pupils||''} onChange={e => setForm((f: any) => ({...f, pupils: e.target.value}))} className="w-full mt-1 px-2 py-1.5 border rounded text-xs">
              <option value="">Select...</option>{PUPIL_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        </div>

        {/* Pain + Lines */}
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-[10px] text-gray-500">Pain Score (0-10)</label>
            <div className="flex gap-0.5">{[0,1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setForm((f: any) => ({...f, pain_score: n}))}
                className={`flex-1 py-1 rounded text-[8px] border ${form.pain_score === n ? (n <= 3 ? 'bg-green-500 text-white' : n <= 6 ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white') : 'bg-white text-gray-400'}`}>{n}</button>
            ))}</div></div>
          <div><label className="text-[10px] text-gray-500">IV Rate (ml/hr)</label>
            <input type="text" value={form.iv_rate||''} onChange={e => setForm((f: any) => ({...f, iv_rate: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="e.g., NS 100ml/hr" /></div>
          <div><label className="text-[10px] text-gray-500">Vasopressor / Sedation</label>
            <input type="text" value={form.vasopressor||''} onChange={e => setForm((f: any) => ({...f, vasopressor: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="e.g., Norad 0.1mcg/kg/min" /></div>
        </div>

        {/* Nursing note */}
        <div><label className="text-[10px] text-gray-500">Nursing note</label>
          <input type="text" value={form.nursing_note||''} onChange={e => setForm((f: any) => ({...f, nursing_note: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Brief clinical observation..." /></div>

        <button onClick={saveEntry} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium">Save ICU Entry</button>
      </div>}

      {/* Vitals table */}
      {loading ? <div className="text-center py-6 text-gray-400">Loading...</div> :
      entries.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No ICU chart entries</div> :
      <div className="bg-white rounded-xl border overflow-x-auto"><table className="w-full text-xs whitespace-nowrap"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left text-gray-500 sticky left-0 bg-gray-50">Time</th>
        <th className="p-2">HR</th><th className="p-2">BP</th><th className="p-2">RR</th><th className="p-2">SpO2</th><th className="p-2">Temp</th>
        <th className="p-2">Vent</th><th className="p-2">FiO2</th><th className="p-2">GCS</th><th className="p-2">RASS</th>
        <th className="p-2">Pain</th><th className="p-2">NEWS2</th><th className="p-2 text-left">Note</th>
      </tr></thead><tbody>{entries.map((e: any, i: number) => {
        const n = calcNEWS2(e);
        const prev = i < entries.length - 1 ? entries[i + 1] : null;
        return (
          <tr key={e.id} className={`border-b hover:bg-gray-50 ${n.score >= 7 ? 'bg-red-50' : n.score >= 5 ? 'bg-orange-50' : ''}`}>
            <td className="p-2 text-gray-500 sticky left-0 bg-white">{new Date(e.recorded_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <td className="p-2 text-center">{vitalCell('hr', e.hr)}</td>
            <td className="p-2 text-center">{e.bp_sys ? <span>{vitalCell('bp_sys', e.bp_sys)}/{e.bp_dia}</span> : '—'}</td>
            <td className="p-2 text-center">{vitalCell('rr', e.rr)}</td>
            <td className="p-2 text-center">{vitalCell('spo2', e.spo2)}</td>
            <td className="p-2 text-center">{vitalCell('temp', e.temp)}</td>
            <td className="p-2 text-center">{e.ventilator_mode || '—'}</td>
            <td className="p-2 text-center">{e.fio2 || '—'}</td>
            <td className={`p-2 text-center font-bold ${(e.gcs_total || 0) <= 8 ? 'text-red-600' : ''}`}>{e.gcs_total || '—'}</td>
            <td className="p-2 text-center">{e.rass ?? '—'}</td>
            <td className="p-2 text-center">{e.pain_score ?? '—'}</td>
            <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] font-bold ${n.color}`}>{n.score}</span></td>
            <td className="p-2 text-gray-600 max-w-[200px] truncate">{e.nursing_note || ''}</td>
          </tr>
        );
      })}</tbody></table></div>}
    </div>
  );
}
