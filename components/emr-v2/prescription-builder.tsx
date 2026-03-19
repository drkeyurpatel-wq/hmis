// components/emr-v2/prescription-builder.tsx
// Practo-quality Rx builder with drug search, interaction check, med-sets, dose templates
'use client';
import React, { useState, useMemo } from 'react';
import { searchMedications, checkInteractions } from '@/lib/cdss/medications';
import { MED_SETS } from '@/lib/cdss/med-sets';

interface RxEntry {
  drug: string; generic: string; dose: string; route: string;
  frequency: string; duration: string; instructions: string;
  isSOS: boolean; category: string;
}

const FREQUENCIES = ['OD (once daily)', 'BD (twice daily)', 'TDS (thrice daily)', 'QID (four times)', 'HS (at bedtime)', 'STAT (immediately)', 'SOS (as needed)', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'Weekly', 'Alternate days'];
const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Sublingual', 'Topical', 'Inhaler', 'Nebulization', 'PR', 'PV', 'Eye drops', 'Ear drops', 'Nasal spray'];
const DURATIONS = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months', '6 months', 'Until follow-up', 'Long term'];
const INSTRUCTIONS_PRESETS = ['Before food', 'After food', 'With food', 'Empty stomach', 'With milk', 'Before sleep', 'In morning', 'Avoid driving'];

interface Props {
  prescriptions: RxEntry[];
  onChange: (rx: RxEntry[]) => void;
  allergies: string[];
  onFlash: (msg: string) => void;
}

export default function PrescriptionBuilder({ prescriptions, onChange, allergies, onFlash }: Props) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<RxEntry>({ drug: '', generic: '', dose: '', route: 'Oral', frequency: 'OD (once daily)', duration: '5 days', instructions: '', isSOS: false, category: '' });
  const [showMedSets, setShowMedSets] = useState(false);
  const [interactionWarnings, setInteractionWarnings] = useState<string[]>([]);

  const results = useMemo(() => search.length >= 2 ? searchMedications(search).slice(0, 8) : [], [search]);

  const selectDrug = (med: any) => {
    // Check interactions with existing prescriptions
    const existingDrugs = prescriptions.map(p => p.generic || p.drug);
    const warnings = checkInteractions([...existingDrugs, med.generic || med.name])
      .map((w: any) => `${w.drug1} + ${w.drug2}: ${w.severity} — ${w.warning}`);

    // Check allergy
    const allergyMatch = allergies.find(a => med.name.toLowerCase().includes(a.toLowerCase()) || med.generic?.toLowerCase().includes(a.toLowerCase()));
    if (allergyMatch) {
      setInteractionWarnings([`ALLERGY ALERT: ${med.name} may conflict with known allergy to "${allergyMatch}"`]);
      return; // Block selection
    }

    setForm(f => ({
      ...f, drug: med.name, generic: med.generic || '',
      dose: med.defaultDose || '', route: med.route || 'Oral',
      frequency: med.defaultFrequency || 'OD (once daily)',
      category: med.category || '',
    }));
    setSearch('');
    if (warnings.length > 0) setInteractionWarnings(warnings);
    else setInteractionWarnings([]);
  };

  const addDrug = () => {
    if (!form.drug) return;
    onChange([...prescriptions, { ...form }]);
    setForm({ drug: '', generic: '', dose: '', route: 'Oral', frequency: 'OD (once daily)', duration: '5 days', instructions: '', isSOS: false, category: '' });
    setInteractionWarnings([]);
    onFlash('Added: ' + form.drug);
  };

  const removeDrug = (idx: number) => onChange(prescriptions.filter((_, i) => i !== idx));

  const applyMedSet = (set: any) => {
    const newRx = set.drugs.map((d: any) => ({
      drug: d.drug, generic: d.generic || '', dose: d.dose, route: d.route || 'Oral',
      frequency: d.frequency, duration: d.duration || '5 days', instructions: d.instructions || '',
      isSOS: false, category: '',
    }));
    onChange([...prescriptions, ...newRx]);
    setShowMedSets(false);
    onFlash(`Med set applied: ${set.name} (${newRx.length} drugs)`);
  };

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">Prescription ({prescriptions.length})</h2>
        <button onClick={() => setShowMedSets(!showMedSets)} className="px-2 py-1 text-[10px] bg-purple-100 text-purple-700 rounded">{showMedSets ? 'Close' : 'Med Sets'}</button>
      </div>

      {/* Interaction warnings */}
      {interactionWarnings.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
          <div className="text-xs font-bold text-red-700 mb-1">Drug Interaction Warning</div>
          {interactionWarnings.map((w, i) => <div key={i} className="text-xs text-red-600">{w}</div>)}
        </div>
      )}

      {/* Med Sets panel */}
      {showMedSets && (
        <div className="bg-purple-50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
          <div className="text-xs font-bold text-purple-700">Quick Medication Sets</div>
          <div className="grid grid-cols-3 gap-1.5">
            {MED_SETS.map((set: any, i: number) => (
              <button key={i} onClick={() => applyMedSet(set)}
                className="text-left px-2.5 py-2 bg-white rounded-lg border hover:border-purple-300 text-xs">
                <div className="font-semibold text-purple-700">{set.name}</div>
                <div className="text-[9px] text-gray-400">{set.drugs.length} drugs — {set.indication}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drug search + form */}
      <div className="space-y-2">
        <div className="relative">
          {!form.drug ? (
            <>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search drug: Paracetamol, Amoxicillin, Metformin..." />
              {results.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-52 overflow-y-auto">
                {results.map((med: any, i: number) => (
                  <button key={i} onClick={() => selectDrug(med)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b text-xs">
                    <span className="font-medium">{med.name}</span>
                    {med.generic && <span className="text-gray-400 ml-1">({med.generic})</span>}
                    {med.defaultDose && <span className="text-blue-600 ml-2">{med.defaultDose}</span>}
                    {med.category && <span className="text-[9px] bg-gray-100 text-gray-500 px-1 ml-1 rounded">{med.category}</span>}
                  </button>
                ))}
              </div>}
            </>
          ) : (
            <div className="bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between">
              <div><span className="font-medium text-sm">{form.drug}</span>{form.generic && <span className="text-xs text-gray-400 ml-1">({form.generic})</span>}</div>
              <button onClick={() => setForm(f => ({ ...f, drug: '', generic: '' }))} className="text-xs text-red-500">Change</button>
            </div>
          )}
        </div>

        {form.drug && (
          <div className="grid grid-cols-6 gap-2">
            <div><label className="text-[9px] text-gray-500">Dose</label>
              <input type="text" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="500mg" /></div>
            <div><label className="text-[9px] text-gray-500">Route</label>
              <select value={form.route} onChange={e => setForm(f => ({ ...f, route: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {ROUTES.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Duration</label>
              <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {DURATIONS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Instructions</label>
              <select value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                <option value="">None</option>{INSTRUCTIONS_PRESETS.map(i => <option key={i}>{i}</option>)}</select></div>
            <div className="flex items-end"><button onClick={addDrug} className="w-full px-3 py-1.5 bg-green-600 text-white text-xs rounded font-medium">Add</button></div>
          </div>
        )}
      </div>

      {/* Prescription table */}
      {prescriptions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left w-6">#</th><th className="p-2 text-left">Drug</th><th className="p-2">Dose</th><th className="p-2">Route</th><th className="p-2">Frequency</th><th className="p-2">Duration</th><th className="p-2">Instructions</th><th className="p-2 w-6"></th>
          </tr></thead><tbody>{prescriptions.map((rx, i) => (
            <tr key={i} className="border-b">
              <td className="p-2 text-gray-400">{i + 1}</td>
              <td className="p-2"><span className="font-medium">{rx.drug}</span>{rx.generic && <div className="text-[9px] text-gray-400">{rx.generic}</div>}</td>
              <td className="p-2 text-center font-medium">{rx.dose}</td>
              <td className="p-2 text-center text-gray-500">{rx.route}</td>
              <td className="p-2 text-center">{rx.frequency}</td>
              <td className="p-2 text-center">{rx.duration}</td>
              <td className="p-2 text-center text-gray-500">{rx.instructions || '—'}</td>
              <td className="p-2"><button onClick={() => removeDrug(i)} className="text-red-500 text-[10px]">✕</button></td>
            </tr>
          ))}</tbody></table>
        </div>
      )}
    </div>
  );
}
