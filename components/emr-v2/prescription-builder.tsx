// components/emr-v2/prescription-builder.tsx
// Rx builder with CDSS: drug interactions (engine.ts), dose validation, allergy cross-ref (allergies.ts), override audit
'use client';
import React, { useState, useMemo, useCallback } from 'react';
import { searchMedications, checkInteractions } from '@/lib/cdss/medications';
import { checkDrugInteractions, validateDose, type DrugInteraction, type DoseAlert } from '@/lib/cdss/engine';
import { checkAllergyConflict, type AllergyEntry } from '@/lib/cdss/allergies';
import { MED_SETS } from '@/lib/cdss/med-sets';
import { sb } from '@/lib/supabase/browser';

interface RxEntry {
  drug: string; generic: string; dose: string; route: string;
  frequency: string; duration: string; instructions: string;
  isSOS: boolean; category: string;
}

const FREQUENCIES = ['OD (once daily)', 'BD (twice daily)', 'TDS (thrice daily)', 'QID (four times)', 'HS (at bedtime)', 'STAT (immediately)', 'SOS (as needed)', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'Weekly', 'Alternate days'];
const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Sublingual', 'Topical', 'Inhaler', 'Nebulization', 'PR', 'PV', 'Eye drops', 'Ear drops', 'Nasal spray'];
const DURATIONS = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months', '6 months', 'Until follow-up', 'Long term'];
const INSTRUCTIONS_PRESETS = ['Before food', 'After food', 'With food', 'Empty stomach', 'With milk', 'Before sleep', 'In morning', 'Avoid driving'];

// Parse frequency string to daily count
function freqToDaily(freq: string): number {
  if (freq.startsWith('OD')) return 1;
  if (freq.startsWith('BD')) return 2;
  if (freq.startsWith('TDS')) return 3;
  if (freq.startsWith('QID')) return 4;
  if (freq.startsWith('Q4H')) return 6;
  if (freq.startsWith('Q6H')) return 4;
  if (freq.startsWith('Q8H')) return 3;
  if (freq.startsWith('Q12H')) return 2;
  return 1;
}

// Parse dose string to mg number
function parseDoseMg(dose: string): number {
  const match = dose.match(/([\d.]+)\s*(mg|g|mcg)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'g') return val * 1000;
  if (unit === 'mcg') return val / 1000;
  return val;
}

interface CDSSAlert {
  id: string;
  type: 'allergy' | 'interaction' | 'dose';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  drug: string;
  interactingDrug?: string;
  overridden: boolean;
}

interface Props {
  prescriptions: RxEntry[];
  onChange: (rx: RxEntry[]) => void;
  allergies: string[];
  patientId?: string;
  staffId?: string;
  centreId?: string;
  onFlash: (msg: string) => void;
}

export default function PrescriptionBuilder({ prescriptions, onChange, allergies, patientId, staffId, centreId, onFlash }: Props) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<RxEntry>({ drug: '', generic: '', dose: '', route: 'Oral', frequency: 'OD (once daily)', duration: '5 days', instructions: '', isSOS: false, category: '' });
  const [showMedSets, setShowMedSets] = useState(false);
  const [alerts, setAlerts] = useState<CDSSAlert[]>([]);

  const results = useMemo(() => search.length >= 2 ? searchMedications(search).slice(0, 8) : [], [search]);

  // Run full CDSS checks on a drug against current prescriptions + patient allergies
  const runCDSSChecks = useCallback((drugName: string, generic: string, dose: string, route: string, frequency: string) => {
    const newAlerts: CDSSAlert[] = [];
    const medName = generic || drugName;

    // 1. ALLERGY CHECK (from allergies.ts cross-reference)
    const allergyConflicts = checkAllergyConflict(allergies, medName);
    for (const conflict of allergyConflicts) {
      newAlerts.push({
        id: `allergy-${conflict.allergen}-${medName}`,
        type: 'allergy',
        severity: conflict.severity === 'contraindicated' ? 'critical' : 'warning',
        message: conflict.warning,
        drug: drugName,
        overridden: false,
      });
    }

    // Also check simple string match for allergens not in cross-ref
    const simpleMatch = allergies.find(a =>
      medName.toLowerCase().includes(a.toLowerCase()) ||
      drugName.toLowerCase().includes(a.toLowerCase())
    );
    if (simpleMatch && allergyConflicts.length === 0) {
      newAlerts.push({
        id: `allergy-simple-${simpleMatch}`,
        type: 'allergy',
        severity: 'critical',
        message: `ALLERGY: ${drugName} may conflict with known allergy to "${simpleMatch}"`,
        drug: drugName,
        overridden: false,
      });
    }

    // 2. DRUG INTERACTIONS (from engine.ts — 50 critical pairs)
    const existingDrugs = prescriptions.map(p => p.generic || p.drug);
    const allDrugs = [...existingDrugs, medName];
    const engineInteractions = checkDrugInteractions(allDrugs);
    for (const ix of engineInteractions) {
      newAlerts.push({
        id: `interaction-${ix.drug_a}-${ix.drug_b}`,
        type: 'interaction',
        severity: ix.severity === 'contraindicated' ? 'critical' : ix.severity === 'severe' ? 'critical' : 'warning',
        message: `${ix.drug_a} + ${ix.drug_b}: ${ix.description}. ${ix.recommendation}`,
        drug: drugName,
        interactingDrug: ix.drug_a,
        overridden: false,
      });
    }

    // Also check from medications.ts interaction data
    const medInteractions = checkInteractions(allDrugs);
    for (const mi of medInteractions) {
      const alreadyFound = engineInteractions.some(ei =>
        mi.drug1?.toLowerCase().includes(ei.drug_a) || mi.drug2?.toLowerCase().includes(ei.drug_b)
      );
      if (!alreadyFound) {
        newAlerts.push({
          id: `med-ix-${mi.drug1}-${mi.drug2}`,
          type: 'interaction',
          severity: mi.severity === 'high' ? 'critical' : 'warning',
          message: `${mi.drug1} + ${mi.drug2}: ${mi.severity} — ${mi.warning}`,
          drug: drugName,
          interactingDrug: mi.drug1,
          overridden: false,
        });
      }
    }

    // 3. DOSE VALIDATION (from engine.ts)
    const doseMg = parseDoseMg(dose);
    const dailyFreq = freqToDaily(frequency);
    if (doseMg > 0) {
      const doseAlerts = validateDose(medName, doseMg, route, dailyFreq);
      for (const da of doseAlerts) {
        newAlerts.push({
          id: `dose-${da.drug}-${da.severity}`,
          type: 'dose',
          severity: da.severity === 'critical' ? 'critical' : da.severity === 'warning' ? 'warning' : 'info',
          message: da.message,
          drug: drugName,
          overridden: false,
        });
      }
    }

    return newAlerts;
  }, [prescriptions, allergies]);

  const selectDrug = (med: any) => {
    const medGeneric = med.generic || med.name;
    const newAlerts = runCDSSChecks(med.name, medGeneric, med.defaultDose || '', med.route || 'Oral', med.defaultFrequency || 'OD (once daily)');

    // Block selection ONLY if there's a critical allergy that hasn't been overridden
    const criticalAllergy = newAlerts.find(a => a.type === 'allergy' && a.severity === 'critical');
    if (criticalAllergy) {
      setAlerts(newAlerts);
      // Don't auto-fill form — show alerts first, let doctor override
      onFlash('Allergy conflict detected — review alert below');
      // Still set the form so doctor can override and add
      setForm(f => ({
        ...f, drug: med.name, generic: medGeneric,
        dose: med.defaultDose || '', route: med.route || 'Oral',
        frequency: med.defaultFrequency || 'OD (once daily)',
        category: med.category || '',
      }));
      setSearch('');
      return;
    }

    setForm(f => ({
      ...f, drug: med.name, generic: medGeneric,
      dose: med.defaultDose || '', route: med.route || 'Oral',
      frequency: med.defaultFrequency || 'OD (once daily)',
      category: med.category || '',
    }));
    setSearch('');
    setAlerts(newAlerts);
  };

  // Re-check dose when dose/frequency/route changes
  const updateFormAndCheck = (field: string, value: string) => {
    const updated = { ...form, [field]: value };
    setForm(updated as any);
    if (updated.drug && (field === 'dose' || field === 'frequency' || field === 'route')) {
      const newAlerts = runCDSSChecks(updated.drug, updated.generic, updated.dose, updated.route, updated.frequency);
      setAlerts(newAlerts);
    }
  };

  const overrideAlert = async (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, overridden: true } : a));
    // Log override to DB
    const alert = alerts.find(a => a.id === alertId);
    if (alert && sb() && patientId && staffId) {
      await sb().from('hmis_cdss_overrides').insert({
        centre_id: centreId || null,
        patient_id: patientId,
        staff_id: staffId,
        alert_type: alert.type === 'allergy' ? 'allergy_conflict' : alert.type === 'interaction' ? 'drug_interaction' : 'dose_warning',
        severity: alert.severity,
        alert_message: alert.message,
        drug_name: alert.drug,
        interacting_drug: alert.interactingDrug || null,
      }).then(() => {});
    }
    onFlash('Alert overridden — documented in audit log');
  };

  const addDrug = () => {
    if (!form.drug) return;
    // Check if there are un-overridden critical alerts
    const blocking = alerts.filter(a => a.severity === 'critical' && !a.overridden);
    if (blocking.length > 0) {
      onFlash('Override critical alerts before adding this drug');
      return;
    }
    onChange([...prescriptions, { ...form }]);
    setForm({ drug: '', generic: '', dose: '', route: 'Oral', frequency: 'OD (once daily)', duration: '5 days', instructions: '', isSOS: false, category: '' });
    setAlerts([]);
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

  const criticalAlerts = alerts.filter(a => (a.severity === 'critical') && !a.overridden);
  const warningAlerts = alerts.filter(a => a.severity === 'warning' && !a.overridden);
  const infoAlerts = alerts.filter(a => a.severity === 'info' && !a.overridden);
  const overriddenAlerts = alerts.filter(a => a.overridden);

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">Prescription ({prescriptions.length})</h2>
        <button onClick={() => setShowMedSets(!showMedSets)} className="px-2 py-1 text-[10px] bg-purple-100 text-purple-700 rounded">{showMedSets ? 'Close' : 'Med Sets'}</button>
      </div>

      {/* CDSS ALERTS — Critical (red) */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            Critical Alert — Action Required
          </div>
          {criticalAlerts.map(a => (
            <div key={a.id} className="flex items-start justify-between gap-2">
              <div className="text-xs text-red-700 flex-1">{a.message}</div>
              <button onClick={() => overrideAlert(a.id)} className="px-2 py-0.5 text-[10px] bg-red-200 text-red-800 rounded hover:bg-red-300 whitespace-nowrap font-medium">Override</button>
            </div>
          ))}
        </div>
      )}

      {/* CDSS ALERTS — Warning (amber) */}
      {warningAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            Warning
          </div>
          {warningAlerts.map(a => (
            <div key={a.id} className="flex items-start justify-between gap-2">
              <div className="text-xs text-amber-700 flex-1">{a.message}</div>
              <button onClick={() => overrideAlert(a.id)} className="px-2 py-0.5 text-[10px] bg-amber-200 text-amber-800 rounded hover:bg-amber-300 whitespace-nowrap">Acknowledge</button>
            </div>
          ))}
        </div>
      )}

      {/* CDSS ALERTS — Info (blue) */}
      {infoAlerts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 space-y-1">
          {infoAlerts.map(a => (
            <div key={a.id} className="text-xs text-blue-700 flex items-center gap-1.5">
              <span className="text-blue-400">i</span> {a.message}
              <button onClick={() => overrideAlert(a.id)} className="text-[9px] text-blue-500 hover:text-blue-700 ml-auto">Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* Overridden alerts (collapsed) */}
      {overriddenAlerts.length > 0 && (
        <div className="text-[10px] text-gray-400 px-1">
          {overriddenAlerts.length} alert{overriddenAlerts.length > 1 ? 's' : ''} overridden by physician
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
              <button onClick={() => { setForm(f => ({ ...f, drug: '', generic: '' })); setAlerts([]); }} className="text-xs text-red-500">Change</button>
            </div>
          )}
        </div>

        {form.drug && (
          <div className="grid grid-cols-6 gap-2">
            <div><label className="text-[9px] text-gray-500">Dose</label>
              <input type="text" value={form.dose} onChange={e => updateFormAndCheck('dose', e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="500mg" /></div>
            <div><label className="text-[9px] text-gray-500">Route</label>
              <select value={form.route} onChange={e => updateFormAndCheck('route', e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs">
                {ROUTES.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Frequency</label>
              <select value={form.frequency} onChange={e => updateFormAndCheck('frequency', e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs">
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Duration</label>
              <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {DURATIONS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Instructions</label>
              <select value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                <option value="">None</option>{INSTRUCTIONS_PRESETS.map(i => <option key={i}>{i}</option>)}</select></div>
            <div className="flex items-end">
              <button onClick={addDrug} disabled={criticalAlerts.length > 0}
                className="w-full px-3 py-1.5 bg-green-600 text-white text-xs rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                {criticalAlerts.length > 0 ? 'Override first' : 'Add'}
              </button>
            </div>
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
