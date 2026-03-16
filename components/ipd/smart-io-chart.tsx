// components/ipd/smart-io-chart.tsx
'use client';

import React, { useState, useMemo } from 'react';

interface Props {
  entries: any[]; admissionId: string; staffId: string;
  onSave: (entry: any, staffId: string) => Promise<void>; onFlash: (m: string) => void;
}

const INTAKE_PRESETS: Record<string, { label: string; fields: Record<string, number> }> = {
  oral_tea: { label: 'Tea/Coffee (150ml)', fields: { oral_intake_ml: 150 } },
  oral_water: { label: 'Water (200ml)', fields: { oral_intake_ml: 200 } },
  oral_meal: { label: 'Meal (~300ml)', fields: { oral_intake_ml: 300 } },
  iv_ns_500: { label: 'NS 0.9% 500ml', fields: { iv_fluid_ml: 500 } },
  iv_ns_1000: { label: 'NS 0.9% 1000ml', fields: { iv_fluid_ml: 1000 } },
  iv_rl_500: { label: 'RL 500ml', fields: { iv_fluid_ml: 500 } },
  iv_dns_500: { label: 'DNS 500ml', fields: { iv_fluid_ml: 500 } },
  iv_d5_500: { label: 'D5W 500ml', fields: { iv_fluid_ml: 500 } },
  blood_prbc: { label: 'PRBC 1 unit (~280ml)', fields: { blood_products_ml: 280 } },
  blood_ffp: { label: 'FFP 1 unit (~200ml)', fields: { blood_products_ml: 200 } },
  blood_plt: { label: 'Platelets (~50ml)', fields: { blood_products_ml: 50 } },
  rt_feed: { label: 'RT Feed (200ml)', fields: { ryles_tube_ml: 200 } },
};

const OUTPUT_PRESETS: Record<string, { label: string; fields: Record<string, number> }> = {
  urine_200: { label: 'Urine 200ml', fields: { urine_ml: 200 } },
  urine_500: { label: 'Urine 500ml', fields: { urine_ml: 500 } },
  drain_100: { label: 'Drain 100ml', fields: { drain_1_ml: 100 } },
  vomit_100: { label: 'Vomit 100ml', fields: { vomit_ml: 100 } },
  aspirate: { label: 'RT Aspirate 150ml', fields: { ryles_aspirate_ml: 150 } },
  stool_1: { label: 'Stool x1', fields: { stool_count: 1 } },
};

export default function SmartIOChart({ entries, admissionId, staffId, onSave, onFlash }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shift: 'morning', oral_intake_ml: 0, iv_fluid_ml: 0, blood_products_ml: 0, ryles_tube_ml: 0, other_intake_ml: 0,
    urine_ml: 0, drain_1_ml: 0, drain_2_ml: 0, ryles_aspirate_ml: 0, vomit_ml: 0, stool_count: 0, other_output_ml: 0,
  });

  const totalIntake = form.oral_intake_ml + form.iv_fluid_ml + form.blood_products_ml + form.ryles_tube_ml + form.other_intake_ml;
  const totalOutput = form.urine_ml + form.drain_1_ml + form.drain_2_ml + form.ryles_aspirate_ml + form.vomit_ml + form.other_output_ml;
  const balance = totalIntake - totalOutput;

  // Cumulative stats
  const cumulativeStats = useMemo(() => {
    let totalIn = 0, totalOut = 0, urineTotal = 0;
    entries.forEach((e: any) => {
      totalIn += (e.total_intake_ml || 0);
      totalOut += (e.total_output_ml || 0);
      urineTotal += (e.urine_ml || 0);
    });
    return { totalIn, totalOut, balance: totalIn - totalOut, urineTotal, entries: entries.length };
  }, [entries]);

  // 24-hour stats
  const last24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = entries.filter(e => new Date(e.created_at || e.io_date).getTime() > cutoff);
    let totalIn = 0, totalOut = 0, urineTotal = 0;
    recent.forEach((e: any) => {
      totalIn += (e.total_intake_ml || 0);
      totalOut += (e.total_output_ml || 0);
      urineTotal += (e.urine_ml || 0);
    });
    return { totalIn, totalOut, balance: totalIn - totalOut, urineTotal };
  }, [entries]);

  const addPresetIntake = (key: string) => {
    const preset = INTAKE_PRESETS[key];
    if (!preset) return;
    setForm(f => {
      const updated = { ...f };
      Object.entries(preset.fields).forEach(([k, v]) => { (updated as any)[k] = ((updated as any)[k] || 0) + v; });
      return updated;
    });
  };

  const addPresetOutput = (key: string) => {
    const preset = OUTPUT_PRESETS[key];
    if (!preset) return;
    setForm(f => {
      const updated = { ...f };
      Object.entries(preset.fields).forEach(([k, v]) => { (updated as any)[k] = ((updated as any)[k] || 0) + v; });
      return updated;
    });
  };

  const balanceColor = (b: number) => b > 500 ? 'text-blue-700 bg-blue-50' : b < -500 ? 'text-orange-700 bg-orange-50' : 'text-gray-700 bg-gray-50';

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Intake / Output Chart</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Record I/O'}</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-3 text-center">
          <div className="text-[10px] text-gray-400">24h Intake</div>
          <div className="text-xl font-bold text-green-700">{last24h.totalIn} ml</div>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <div className="text-[10px] text-gray-400">24h Output</div>
          <div className="text-xl font-bold text-red-700">{last24h.totalOut} ml</div>
        </div>
        <div className={`bg-white rounded-xl border p-3 text-center`}>
          <div className="text-[10px] text-gray-400">24h Balance</div>
          <div className={`text-xl font-bold ${last24h.balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{last24h.balance > 0 ? '+' : ''}{last24h.balance} ml</div>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <div className="text-[10px] text-gray-400">24h Urine</div>
          <div className="text-xl font-bold text-purple-700">{last24h.urineTotal} ml</div>
        </div>
      </div>

      {/* Cumulative summary */}
      {entries.length > 0 && <div className="bg-gray-50 rounded-lg p-2 mb-3 flex items-center justify-between text-xs text-gray-600">
        <span>Cumulative ({cumulativeStats.entries} entries): Intake {cumulativeStats.totalIn}ml | Output {cumulativeStats.totalOut}ml | Balance {cumulativeStats.balance > 0 ? '+' : ''}{cumulativeStats.balance}ml | Total urine {cumulativeStats.urineTotal}ml</span>
      </div>}

      {/* Entry form */}
      {showForm && <div className="bg-white rounded-xl border p-5 mb-4">
        <div className="mb-3">
          <label className="text-xs text-gray-500 font-medium">Shift</label>
          <div className="flex gap-1 mt-1">{['morning','evening','night'].map(s => (
            <button key={s} onClick={() => setForm(f => ({...f, shift: s}))}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs border ${form.shift === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>{s.charAt(0).toUpperCase() + s.slice(1)} ({s === 'morning' ? '7am-1pm' : s === 'evening' ? '1pm-9pm' : '9pm-7am'})</button>
          ))}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* INTAKE */}
          <div>
            <h3 className="text-xs font-medium text-green-600 mb-2">INTAKE</h3>
            <div className="flex flex-wrap gap-1 mb-2">{Object.entries(INTAKE_PRESETS).map(([k, p]) => (
              <button key={k} onClick={() => addPresetIntake(k)} className="px-1.5 py-0.5 rounded border text-[10px] bg-green-50 text-green-700 border-green-200 hover:bg-green-100">{p.label}</button>
            ))}</div>
            {[['oral_intake_ml','Oral'],['iv_fluid_ml','IV Fluids'],['blood_products_ml','Blood Products'],['ryles_tube_ml','Ryles Tube'],['other_intake_ml','Other']].map(([k,l]) =>
              <div key={k} className="flex items-center gap-2 mb-1.5"><label className="text-xs text-gray-500 w-28">{l}</label>
                <input type="number" value={(form as any)[k]||0} onChange={e => setForm(f => ({...f, [k]: parseInt(e.target.value)||0}))} className="flex-1 px-2 py-1 border rounded text-sm text-right" min="0" />
                <span className="text-[10px] text-gray-400 w-6">ml</span></div>
            )}
            <div className="text-xs font-bold text-green-700 mt-2 p-1.5 bg-green-50 rounded">Total Intake: {totalIntake} ml</div>
          </div>

          {/* OUTPUT */}
          <div>
            <h3 className="text-xs font-medium text-red-600 mb-2">OUTPUT</h3>
            <div className="flex flex-wrap gap-1 mb-2">{Object.entries(OUTPUT_PRESETS).map(([k, p]) => (
              <button key={k} onClick={() => addPresetOutput(k)} className="px-1.5 py-0.5 rounded border text-[10px] bg-red-50 text-red-700 border-red-200 hover:bg-red-100">{p.label}</button>
            ))}</div>
            {[['urine_ml','Urine'],['drain_1_ml','Drain 1'],['drain_2_ml','Drain 2'],['ryles_aspirate_ml','RT Aspirate'],['vomit_ml','Vomit'],['other_output_ml','Other']].map(([k,l]) =>
              <div key={k} className="flex items-center gap-2 mb-1.5"><label className="text-xs text-gray-500 w-28">{l}</label>
                <input type="number" value={(form as any)[k]||0} onChange={e => setForm(f => ({...f, [k]: parseInt(e.target.value)||0}))} className="flex-1 px-2 py-1 border rounded text-sm text-right" min="0" />
                <span className="text-[10px] text-gray-400 w-6">ml</span></div>
            )}
            <div className="flex items-center gap-2 mb-1.5"><label className="text-xs text-gray-500 w-28">Stool (count)</label>
              <input type="number" value={form.stool_count||0} onChange={e => setForm(f => ({...f, stool_count: parseInt(e.target.value)||0}))} className="flex-1 px-2 py-1 border rounded text-sm text-right" min="0" /></div>
            <div className="text-xs font-bold text-red-700 mt-2 p-1.5 bg-red-50 rounded">Total Output: {totalOutput} ml</div>
          </div>
        </div>

        {/* Balance */}
        <div className={`text-sm font-bold mt-3 p-2.5 rounded-lg text-center ${balanceColor(balance)}`}>
          Shift Balance: {balance > 0 ? '+' : ''}{balance} ml
          {Math.abs(balance) > 1000 && <span className="ml-2 text-orange-600">⚠️ Large imbalance</span>}
        </div>

        <button onClick={async () => { await onSave(form, staffId); setShowForm(false); onFlash('I/O recorded');
          setForm({ shift: 'morning', oral_intake_ml: 0, iv_fluid_ml: 0, blood_products_ml: 0, ryles_tube_ml: 0, other_intake_ml: 0, urine_ml: 0, drain_1_ml: 0, drain_2_ml: 0, ryles_aspirate_ml: 0, vomit_ml: 0, stool_count: 0, other_output_ml: 0 }); }}
          className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium">Save I/O Entry</button>
      </div>}

      {/* History table */}
      {entries.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No I/O records</div> :
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Date</th><th className="p-2">Shift</th>
        <th className="p-2 text-green-600">Oral</th><th className="p-2 text-green-600">IV</th><th className="p-2 text-green-600">Blood</th><th className="p-2 text-green-600 font-bold">Total In</th>
        <th className="p-2 text-red-600">Urine</th><th className="p-2 text-red-600">Drain</th><th className="p-2 text-red-600">Vomit</th><th className="p-2 text-red-600 font-bold">Total Out</th>
        <th className="p-2 font-bold">Balance</th>
      </tr></thead><tbody>{entries.map((e: any) => {
        const bal = (e.total_intake_ml || 0) - (e.total_output_ml || 0);
        return (
          <tr key={e.id} className="border-b hover:bg-gray-50">
            <td className="p-2">{e.io_date || new Date(e.created_at).toLocaleDateString('en-IN')}</td>
            <td className="p-2 text-center">{e.shift}</td>
            <td className="p-2 text-center text-green-600">{e.oral_intake_ml || 0}</td>
            <td className="p-2 text-center text-green-600">{e.iv_fluid_ml || 0}</td>
            <td className="p-2 text-center text-green-600">{e.blood_products_ml || 0}</td>
            <td className="p-2 text-center text-green-700 font-bold">{e.total_intake_ml || 0}</td>
            <td className="p-2 text-center text-red-600">{e.urine_ml || 0}</td>
            <td className="p-2 text-center text-red-600">{(e.drain_1_ml || 0) + (e.drain_2_ml || 0)}</td>
            <td className="p-2 text-center text-red-600">{e.vomit_ml || 0}</td>
            <td className="p-2 text-center text-red-700 font-bold">{e.total_output_ml || 0}</td>
            <td className={`p-2 text-center font-bold ${bal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{bal > 0 ? '+' : ''}{bal}</td>
          </tr>
        );
      })}</tbody></table></div>}
    </div>
  );
}
