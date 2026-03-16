// components/ipd/smart-icu-chart.tsx
'use client';

import React, { useState, useMemo } from 'react';

interface Props {
  entries: any[]; admissionId: string; staffId: string;
  onAdd: (entry: any, staffId: string) => Promise<void>;
  onFlash: (m: string) => void;
}

const VENT_PRESETS: { mode: string; label: string; defaults: Record<string, number> }[] = [
  { mode: 'CMV', label: 'CMV', defaults: { fio2: 40, peep: 5 } },
  { mode: 'SIMV', label: 'SIMV', defaults: { fio2: 40, peep: 5 } },
  { mode: 'PSV', label: 'PSV', defaults: { fio2: 35, peep: 5 } },
  { mode: 'CPAP', label: 'CPAP', defaults: { fio2: 35, peep: 5 } },
  { mode: 'BiPAP', label: 'BiPAP', defaults: { fio2: 40, peep: 5 } },
  { mode: 'PRVC', label: 'PRVC', defaults: { fio2: 40, peep: 5 } },
  { mode: 'HFNC', label: 'HFNC', defaults: { fio2: 50, peep: 0 } },
  { mode: 'Room Air', label: 'RA', defaults: { fio2: 21, peep: 0 } },
];

const GCS_E = [[4,'Spont'],[3,'Voice'],[2,'Pain'],[1,'None']];
const GCS_V = [[5,'Orient'],[4,'Confus'],[3,'Inapp'],[2,'Incomp'],[1,'None']];
const GCS_M = [[6,'Obeys'],[5,'Local'],[4,'Withdr'],[3,'Flex'],[2,'Ext'],[1,'None']];
const RASS_VALS = [4,3,2,1,0,-1,-2,-3,-4,-5];

export default function SmartICUChart({ entries, admissionId, staffId, onAdd, onFlash }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState<any>({
    hr: '', bp_sys: '', bp_dia: '', rr: '', spo2: '', temp: '',
    ventilator_mode: '', fio2: '', peep: '',
    gcs_eye: 4, gcs_verbal: 5, gcs_motor: 6, rass: 0,
    pupil_left: '3mm', pupil_right: '3mm', pupil_reaction: 'brisk',
    nursing_note: '', urine_output: '', pain_scale: '',
  });

  const gcsTotal = (f.gcs_eye || 0) + (f.gcs_verbal || 0) + (f.gcs_motor || 0);
  const isAbn = (k: string, v: number) => {
    if (!v) return false;
    const r: Record<string,[number,number]> = { hr:[60,100], bp_sys:[90,140], bp_dia:[60,90], rr:[12,20], spo2:[94,100], temp:[97,99.5] };
    return r[k] ? (v < r[k][0] || v > r[k][1]) : false;
  };

  const shiftSummary = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setHours(now.getHours() >= 20 ? 20 : now.getHours() >= 8 ? 8 : 0, 0, 0, 0);
    const se = entries.filter(e => new Date(e.recorded_at) >= start);
    if (!se.length) return null;
    const avg = (k: string) => { const v = se.map(e => e[k]).filter(Boolean); return v.length ? (v.reduce((a: number, b: number) => a + b, 0) / v.length).toFixed(0) : '—'; };
    return { n: se.length, hr: avg('hr'), sbp: avg('bp_sys'), spo2: avg('spo2') };
  }, [entries]);

  const save = async () => {
    const clean: any = {}; Object.entries(f).forEach(([k,v]) => { if (v !== '' && v !== null && v !== undefined) clean[k] = v; });
    clean.gcs_total = gcsTotal;
    await onAdd(clean, staffId); setShowForm(false); onFlash('ICU entry saved');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">ICU Monitoring Chart</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Record'}</button>
      </div>

      {shiftSummary && <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
        <span className="font-medium text-blue-700">Shift ({shiftSummary.n} entries)</span>
        <div className="flex gap-3"><span>HR <b>{shiftSummary.hr}</b></span><span>SBP <b>{shiftSummary.sbp}</b></span><span>SpO2 <b>{shiftSummary.spo2}%</b></span></div>
      </div>}

      {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        {/* Vitals grid */}
        <div className="grid grid-cols-6 gap-2">
          {[['hr','HR','/min'],['bp_sys','SBP','mmHg'],['bp_dia','DBP','mmHg'],['rr','RR','/min'],['spo2','SpO2','%'],['temp','Temp','°F']].map(([k,l,u]) => (
            <div key={k} className={`rounded-lg border p-2 text-center ${f[k] && isAbn(k,parseFloat(f[k])) ? 'border-red-300 bg-red-50' : ''}`}>
              <div className="text-[10px] text-gray-500">{l}</div>
              <input type="number" value={f[k]} onChange={e => setF((p: any) => ({...p, [k]: e.target.value ? parseFloat(e.target.value) : ''}))}
                className={`w-full text-lg font-bold text-center border-0 bg-transparent focus:outline-none ${f[k] && isAbn(k,parseFloat(f[k])) ? 'text-red-700' : ''}`} placeholder="—" />
              <div className="text-[8px] text-gray-400">{u}</div>
            </div>
          ))}
        </div>

        {/* Pain + UO */}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500">Pain (0-10)</label>
            <div className="flex gap-0.5 mt-1">{[0,1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setF((p: any) => ({...p, pain_scale: n}))}
                className={`w-6 h-6 rounded text-[10px] font-bold ${f.pain_scale === n ? (n<=3?'bg-green-500 text-white':n<=6?'bg-yellow-500 text-white':'bg-red-500 text-white') : 'bg-gray-100 text-gray-500'}`}>{n}</button>
            ))}</div></div>
          <div><label className="text-[10px] text-gray-500">Urine output (ml/h)</label>
            <input type="number" value={f.urine_output} onChange={e => setF((p: any) => ({...p, urine_output: e.target.value}))} className="w-full mt-1 px-2 py-1.5 border rounded text-sm" placeholder="ml/h" /></div>
        </div>

        {/* Vent presets */}
        <div><label className="text-[10px] text-gray-500 mb-1 block">Ventilator</label>
          <div className="flex flex-wrap gap-1">{VENT_PRESETS.map(p => (
            <button key={p.mode} onClick={() => setF((prev: any) => ({...prev, ventilator_mode: p.mode, fio2: p.defaults.fio2, peep: p.defaults.peep}))}
              className={`px-2.5 py-1 rounded text-[11px] border ${f.ventilator_mode === p.mode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{p.label}</button>
          ))}</div>
          {f.ventilator_mode && f.ventilator_mode !== 'Room Air' && <div className="grid grid-cols-2 gap-2 mt-2">
            <div><label className="text-[10px] text-gray-500">FiO2 %</label><input type="number" value={f.fio2} onChange={e => setF((p: any) => ({...p, fio2: parseInt(e.target.value)||''}))} className="w-full px-2 py-1 border rounded text-sm text-center" /></div>
            <div><label className="text-[10px] text-gray-500">PEEP</label><input type="number" value={f.peep} onChange={e => setF((p: any) => ({...p, peep: parseInt(e.target.value)||''}))} className="w-full px-2 py-1 border rounded text-sm text-center" /></div>
          </div>}
        </div>

        {/* GCS click */}
        <div>
          <label className="text-[10px] text-gray-500">GCS: <span className={`text-sm font-bold ${gcsTotal<=8?'text-red-700':gcsTotal<=12?'text-orange-600':'text-green-700'}`}>{gcsTotal}/15</span> (E{f.gcs_eye}V{f.gcs_verbal}M{f.gcs_motor})</label>
          <div className="grid grid-cols-3 gap-1 mt-1">
            <div className="flex gap-0.5">{GCS_E.map(([v,l]) => <button key={v} onClick={() => setF((p: any) => ({...p, gcs_eye: v}))} className={`flex-1 py-1 rounded text-[9px] border ${f.gcs_eye===v?'bg-blue-600 text-white':'bg-white'}`} title={l as string}>{v}</button>)}</div>
            <div className="flex gap-0.5">{GCS_V.map(([v,l]) => <button key={v} onClick={() => setF((p: any) => ({...p, gcs_verbal: v}))} className={`flex-1 py-1 rounded text-[9px] border ${f.gcs_verbal===v?'bg-blue-600 text-white':'bg-white'}`} title={l as string}>{v}</button>)}</div>
            <div className="flex gap-0.5">{GCS_M.map(([v,l]) => <button key={v} onClick={() => setF((p: any) => ({...p, gcs_motor: v}))} className={`flex-1 py-1 rounded text-[9px] border ${f.gcs_motor===v?'bg-blue-600 text-white':'bg-white'}`} title={l as string}>{v}</button>)}</div>
          </div>
        </div>

        {/* RASS */}
        <div><label className="text-[10px] text-gray-500">RASS: <span className="font-bold">{f.rass>=0?'+':''}{f.rass}</span></label>
          <div className="flex gap-0.5 mt-1">{RASS_VALS.map(v => (
            <button key={v} onClick={() => setF((p: any) => ({...p, rass: v}))}
              className={`flex-1 py-1 rounded text-[9px] border ${f.rass===v ? (v===0?'bg-green-600 text-white':'bg-blue-600 text-white') : 'bg-white'}`}>{v>=0?'+':''}{v}</button>
          ))}</div></div>

        {/* Pupils */}
        <div className="grid grid-cols-3 gap-2">
          {[['pupil_left','Left pupil'],['pupil_right','Right pupil']].map(([k,l]) => (
            <div key={k}><label className="text-[10px] text-gray-500">{l}</label>
              <div className="flex gap-0.5 mt-0.5">{['2mm','3mm','4mm','Fixed'].map(s => (
                <button key={s} onClick={() => setF((p: any) => ({...p, [k]: s}))} className={`flex-1 py-0.5 rounded text-[9px] border ${f[k]===s?'bg-blue-600 text-white':'bg-white'}`}>{s}</button>
              ))}</div></div>
          ))}
          <div><label className="text-[10px] text-gray-500">Reaction</label>
            <div className="flex gap-0.5 mt-0.5">{['brisk','sluggish','fixed'].map(r => (
              <button key={r} onClick={() => setF((p: any) => ({...p, pupil_reaction: r}))} className={`flex-1 py-0.5 rounded text-[9px] border ${f.pupil_reaction===r?(r==='fixed'?'bg-red-600 text-white':'bg-blue-600 text-white'):'bg-white'}`}>{r}</button>
            ))}</div></div>
        </div>

        <input type="text" value={f.nursing_note} onChange={e => setF((p: any) => ({...p, nursing_note: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Brief nursing note..." />
        <button onClick={save} className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Save ICU Entry</button>
      </div>}

      {/* Table */}
      {entries.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No entries</div> :
      <div className="bg-white rounded-xl border overflow-x-auto"><table className="w-full text-xs whitespace-nowrap"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left sticky left-0 bg-gray-50">Time</th><th className="p-2">HR</th><th className="p-2">BP</th><th className="p-2">RR</th><th className="p-2">SpO2</th><th className="p-2">Temp</th><th className="p-2">Vent</th><th className="p-2">FiO2</th><th className="p-2">GCS</th><th className="p-2">RASS</th><th className="p-2">Pain</th><th className="p-2">UO</th><th className="p-2 text-left">Note</th>
      </tr></thead><tbody>{entries.map((e: any) => (
        <tr key={e.id} className="border-b hover:bg-gray-50">
          <td className="p-2 text-gray-500 sticky left-0 bg-white">{new Date(e.recorded_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
          <td className={`p-2 text-center ${isAbn('hr',e.hr)?'text-red-600 font-bold':''}`}>{e.hr||'—'}</td>
          <td className={`p-2 text-center ${isAbn('bp_sys',e.bp_sys)?'text-red-600 font-bold':''}`}>{e.bp_sys&&e.bp_dia?`${e.bp_sys}/${e.bp_dia}`:'—'}</td>
          <td className={`p-2 text-center ${isAbn('rr',e.rr)?'text-red-600 font-bold':''}`}>{e.rr||'—'}</td>
          <td className={`p-2 text-center ${e.spo2&&e.spo2<94?'text-red-600 font-bold':''}`}>{e.spo2||'—'}</td>
          <td className="p-2 text-center">{e.temp||'—'}</td>
          <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${e.ventilator_mode==='Room Air'?'bg-green-100 text-green-700':e.ventilator_mode?'bg-blue-100 text-blue-700':''}`}>{e.ventilator_mode||'—'}</span></td>
          <td className="p-2 text-center">{e.fio2||'—'}</td>
          <td className={`p-2 text-center font-bold ${(e.gcs_total||15)<=8?'text-red-600':(e.gcs_total||15)<=12?'text-orange-600':''}`}>{e.gcs_total||'—'}</td>
          <td className="p-2 text-center">{e.rass??'—'}</td>
          <td className="p-2 text-center">{e.pain_scale!=null?e.pain_scale:'—'}</td>
          <td className="p-2 text-center">{e.urine_output||'—'}</td>
          <td className="p-2 text-gray-600 max-w-[150px] truncate">{e.nursing_note||''}</td>
        </tr>
      ))}</tbody></table></div>}
    </div>
  );
}
