// components/ipd/smart-io-chart.tsx
'use client';
import React, { useState, useMemo } from 'react';

interface Props { entries: any[]; admissionId: string; staffId: string; onAdd: (entry: any, staffId: string) => Promise<void>; onFlash: (m: string) => void; }
const QI = [50,100,200,300,500]; const QO = [50,100,200,300,500];

export default function SmartIOChart({ entries, admissionId, staffId, onAdd, onFlash }: Props) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ shift: 'morning', oral_intake_ml: 0, iv_fluid_ml: 0, blood_products_ml: 0, ryles_tube_ml: 0, other_intake_ml: 0, urine_ml: 0, drain_1_ml: 0, drain_2_ml: 0, ryles_aspirate_ml: 0, vomit_ml: 0, stool_count: 0, other_output_ml: 0 });
  const tIn = f.oral_intake_ml+f.iv_fluid_ml+f.blood_products_ml+f.ryles_tube_ml+f.other_intake_ml;
  const tOut = f.urine_ml+f.drain_1_ml+f.drain_2_ml+f.ryles_aspirate_ml+f.vomit_ml+f.other_output_ml;
  const bal = tIn - tOut;
  const today = useMemo(() => {
    const d = new Date().toISOString().split('T')[0];
    const te = entries.filter(e => (e.recorded_date||'').startsWith(d) || (e.created_at||'').startsWith(d));
    const s = (k: string) => te.reduce((a, e) => a + (parseFloat(e[k])||0), 0);
    return { intake: s('total_intake'), output: s('total_output'), n: te.length };
  }, [entries]);
  const qa = (k: string, v: number) => setF(p => ({...p, [k]: (p as any)[k]+v}));
  const sc = (s: string) => s==='morning'?'bg-yellow-100 text-yellow-700':s==='evening'?'bg-orange-100 text-orange-700':'bg-indigo-100 text-indigo-700';

  return (<div>
    <div className="flex justify-between items-center mb-3">
      <h2 className="font-semibold text-sm">Intake / Output Chart</h2>
      <button onClick={() => setShow(!show)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{show?'Cancel':'+ Record I/O'}</button>
    </div>
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center"><div className="text-xs text-green-600">Today Intake</div><div className="text-xl font-bold text-green-700">{today.intake} ml</div></div>
      <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center"><div className="text-xs text-red-600">Today Output</div><div className="text-xl font-bold text-red-700">{today.output} ml</div></div>
      <div className={`rounded-xl border p-3 text-center ${today.intake-today.output>=0?'bg-blue-50 border-blue-200':'bg-orange-50 border-orange-200'}`}><div className="text-xs text-gray-600">Balance</div><div className={`text-xl font-bold ${today.intake-today.output>=0?'text-blue-700':'text-orange-700'}`}>{today.intake-today.output>=0?'+':''}{today.intake-today.output} ml</div></div>
    </div>
    {show && <div className="bg-white rounded-xl border p-5 mb-4">
      <div className="flex gap-2 mb-4">{(['morning','evening','night'] as const).map(s => (
        <button key={s} onClick={() => setF(p => ({...p, shift: s}))} className={`flex-1 py-2 rounded-lg text-xs font-medium border ${f.shift===s?sc(s)+' border-current':'bg-white border-gray-200 text-gray-500'}`}>{s==='morning'?'☀️ Morning':s==='evening'?'🌤 Evening':'🌙 Night'}</button>
      ))}</div>
      <div className="grid grid-cols-2 gap-6">
        <div><h3 className="text-xs font-semibold text-green-700 mb-2">INTAKE <span className="float-right text-sm">{tIn} ml</span></h3>
          {[['oral_intake_ml','Oral'],['iv_fluid_ml','IV Fluids'],['blood_products_ml','Blood'],['ryles_tube_ml','RT Feed'],['other_intake_ml','Other']].map(([k,l]) => (
            <div key={k} className="mb-2"><div className="flex justify-between mb-0.5"><label className="text-[10px] text-gray-500">{l}</label><span className="text-xs font-bold text-green-700">{(f as any)[k]}</span></div>
              <div className="flex gap-0.5">{QI.map(v => <button key={v} onClick={() => qa(k,v)} className="flex-1 py-1 rounded border text-[10px] bg-green-50 text-green-700 hover:bg-green-100">+{v}</button>)}<button onClick={() => setF(p => ({...p,[k]:0}))} className="px-1.5 py-1 rounded text-[10px] text-red-400 border">C</button></div></div>
          ))}</div>
        <div><h3 className="text-xs font-semibold text-red-700 mb-2">OUTPUT <span className="float-right text-sm">{tOut} ml</span></h3>
          {[['urine_ml','Urine'],['drain_1_ml','Drain 1'],['drain_2_ml','Drain 2'],['ryles_aspirate_ml','RT Aspirate'],['vomit_ml','Vomit'],['other_output_ml','Other']].map(([k,l]) => (
            <div key={k} className="mb-2"><div className="flex justify-between mb-0.5"><label className="text-[10px] text-gray-500">{l}</label><span className="text-xs font-bold text-red-700">{(f as any)[k]}</span></div>
              <div className="flex gap-0.5">{QO.map(v => <button key={v} onClick={() => qa(k,v)} className="flex-1 py-1 rounded border text-[10px] bg-red-50 text-red-700 hover:bg-red-100">+{v}</button>)}<button onClick={() => setF(p => ({...p,[k]:0}))} className="px-1.5 py-1 rounded text-[10px] text-gray-400 border">C</button></div></div>
          ))}
          <div className="flex items-center gap-2 mt-1"><label className="text-[10px] text-gray-500">Stool</label>
            <div className="flex gap-0.5">{[0,1,2,3,4,5].map(n => <button key={n} onClick={() => setF(p => ({...p,stool_count:n}))} className={`w-7 h-7 rounded text-[10px] font-bold ${f.stool_count===n?'bg-orange-500 text-white':'bg-gray-100'}`}>{n}</button>)}</div></div>
        </div>
      </div>
      <div className={`mt-4 p-3 rounded-xl text-center font-bold text-lg ${bal>=0?'bg-blue-50 text-blue-700':'bg-orange-50 text-orange-700'}`}>Balance: {bal>=0?'+':''}{bal} ml</div>
      <button onClick={async () => { await onAdd(f, staffId); setShow(false); setF({ shift:'morning',oral_intake_ml:0,iv_fluid_ml:0,blood_products_ml:0,ryles_tube_ml:0,other_intake_ml:0,urine_ml:0,drain_1_ml:0,drain_2_ml:0,ryles_aspirate_ml:0,vomit_ml:0,stool_count:0,other_output_ml:0 }); onFlash('I/O recorded'); }} className="w-full mt-3 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Save I/O Entry</button>
    </div>}
    {entries.length===0?<div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No I/O records</div>:
    <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
      <th className="p-2 text-left">Date</th><th className="p-2">Shift</th><th className="p-2 text-green-700">Oral</th><th className="p-2 text-green-700">IV</th><th className="p-2 text-green-700 font-bold">In</th><th className="p-2 text-red-700">Urine</th><th className="p-2 text-red-700">Drain</th><th className="p-2 text-red-700 font-bold">Out</th><th className="p-2 font-bold">Bal</th>
    </tr></thead><tbody>{entries.map((e: any) => {
      const b = (parseFloat(e.total_intake)||0)-(parseFloat(e.total_output)||0);
      return (<tr key={e.id} className="border-b hover:bg-gray-50">
        <td className="p-2 text-gray-500">{e.recorded_date||new Date(e.created_at).toLocaleDateString('en-IN')}</td>
        <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${sc(e.shift)}`}>{e.shift}</span></td>
        <td className="p-2 text-center">{e.oral_intake_ml||0}</td><td className="p-2 text-center">{e.iv_fluid_ml||0}</td>
        <td className="p-2 text-center font-bold text-green-700">{e.total_intake||0}</td>
        <td className="p-2 text-center">{e.urine_ml||0}</td><td className="p-2 text-center">{(e.drain_1_ml||0)+(e.drain_2_ml||0)}</td>
        <td className="p-2 text-center font-bold text-red-700">{e.total_output||0}</td>
        <td className={`p-2 text-center font-bold ${b>=0?'text-blue-700':'text-orange-700'}`}>{b>=0?'+':''}{b}</td>
      </tr>);
    })}</tbody></table></div>}
  </div>);
}
