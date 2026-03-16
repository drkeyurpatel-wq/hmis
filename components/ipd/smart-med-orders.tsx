// components/ipd/smart-med-orders.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

interface Props {
  meds: any[]; admissionId: string; staffId: string; admissionDx: string;
  onAdd: (med: any) => Promise<void>;
  onDiscontinue: (medId: string, reason: string) => Promise<void>;
  onFlash: (m: string) => void;
}

// Common Indian hospital drug database with dose suggestions
const DRUG_DB: { name: string; generic: string; class: string; routes: string[]; doses: string[]; frequencies: string[]; warnings?: string; maxDose?: string; renalAdjust?: boolean }[] = [
  // Cardiovascular
  { name: 'Aspirin', generic: 'Acetylsalicylic acid', class: 'Antiplatelet', routes: ['oral'], doses: ['75 mg','150 mg','325 mg'], frequencies: ['OD'], warnings: 'GI bleed risk. Avoid in active peptic ulcer.' },
  { name: 'Clopidogrel', generic: 'Clopidogrel', class: 'Antiplatelet', routes: ['oral'], doses: ['75 mg','300 mg (loading)'], frequencies: ['OD'], warnings: 'Hold 5 days before surgery.' },
  { name: 'Ticagrelor', generic: 'Ticagrelor', class: 'Antiplatelet', routes: ['oral'], doses: ['90 mg','180 mg (loading)'], frequencies: ['BD'], warnings: 'Dyspnea common. Do not use with >100mg aspirin.' },
  { name: 'Atorvastatin', generic: 'Atorvastatin', class: 'Statin', routes: ['oral'], doses: ['10 mg','20 mg','40 mg','80 mg'], frequencies: ['OD','HS'], warnings: 'Monitor LFT. Myalgia risk.' },
  { name: 'Rosuvastatin', generic: 'Rosuvastatin', class: 'Statin', routes: ['oral'], doses: ['5 mg','10 mg','20 mg','40 mg'], frequencies: ['OD','HS'] },
  { name: 'Metoprolol Succinate', generic: 'Metoprolol', class: 'Beta-blocker', routes: ['oral'], doses: ['12.5 mg','25 mg','50 mg','100 mg','200 mg'], frequencies: ['OD','BD'], warnings: 'Avoid in decompensated HF, severe bradycardia, asthma.' },
  { name: 'Metoprolol Tartrate', generic: 'Metoprolol', class: 'Beta-blocker', routes: ['oral','iv'], doses: ['25 mg','50 mg','5 mg IV'], frequencies: ['BD','TDS'], warnings: 'IV only in monitored setting.' },
  { name: 'Amlodipine', generic: 'Amlodipine', class: 'CCB', routes: ['oral'], doses: ['2.5 mg','5 mg','10 mg'], frequencies: ['OD'], warnings: 'Pedal edema common.' },
  { name: 'Ramipril', generic: 'Ramipril', class: 'ACE-I', routes: ['oral'], doses: ['1.25 mg','2.5 mg','5 mg','10 mg'], frequencies: ['OD','BD'], warnings: 'Cough. Monitor K+ and creatinine.', renalAdjust: true },
  { name: 'Telmisartan', generic: 'Telmisartan', class: 'ARB', routes: ['oral'], doses: ['20 mg','40 mg','80 mg'], frequencies: ['OD'] },
  { name: 'Furosemide', generic: 'Furosemide', class: 'Loop diuretic', routes: ['oral','iv'], doses: ['20 mg','40 mg','80 mg'], frequencies: ['OD','BD','TDS','SOS'], warnings: 'Monitor electrolytes. Ototoxicity at high IV doses.', renalAdjust: true },
  { name: 'Spironolactone', generic: 'Spironolactone', class: 'K-sparing diuretic', routes: ['oral'], doses: ['12.5 mg','25 mg','50 mg'], frequencies: ['OD','BD'], warnings: 'Hyperkalemia risk. Avoid with ACE-I + ARB combo.' },
  { name: 'Eplerenone', generic: 'Eplerenone', class: 'MRA', routes: ['oral'], doses: ['25 mg','50 mg'], frequencies: ['OD'] },
  { name: 'Digoxin', generic: 'Digoxin', class: 'Cardiac glycoside', routes: ['oral','iv'], doses: ['0.125 mg','0.25 mg'], frequencies: ['OD'], warnings: 'Narrow therapeutic index. Check levels.', renalAdjust: true },
  { name: 'Amiodarone', generic: 'Amiodarone', class: 'Anti-arrhythmic', routes: ['oral','iv'], doses: ['100 mg','200 mg','150 mg IV bolus','900 mg/24h IV'], frequencies: ['OD','BD','TDS'], warnings: 'Thyroid, liver, lung toxicity. QTc prolongation.' },
  // Heparin/Anticoagulants
  { name: 'Enoxaparin', generic: 'Enoxaparin', class: 'LMWH', routes: ['sc'], doses: ['20 mg','40 mg','60 mg','1 mg/kg'], frequencies: ['OD','BD'], warnings: 'Adjust in renal impairment. Monitor anti-Xa if obese.', renalAdjust: true },
  { name: 'Heparin (UFH)', generic: 'Unfractionated heparin', class: 'Anticoagulant', routes: ['iv','sc'], doses: ['5000 U','5000 U SC','25000 U/24h infusion'], frequencies: ['BD','TDS','infusion'], warnings: 'Monitor aPTT. HIT risk.' },
  { name: 'Warfarin', generic: 'Warfarin', class: 'VKA', routes: ['oral'], doses: ['1 mg','2 mg','3 mg','5 mg'], frequencies: ['OD'], warnings: 'Monitor INR. Multiple drug interactions.' },
  // Antibiotics
  { name: 'Piperacillin-Tazobactam', generic: 'Pip-Taz', class: 'Beta-lactam', routes: ['iv'], doses: ['4.5 gm'], frequencies: ['Q6H','Q8H','TDS'], renalAdjust: true },
  { name: 'Meropenem', generic: 'Meropenem', class: 'Carbapenem', routes: ['iv'], doses: ['500 mg','1 gm','2 gm'], frequencies: ['Q8H','TDS'], warnings: 'Reserve for resistant organisms.', renalAdjust: true },
  { name: 'Vancomycin', generic: 'Vancomycin', class: 'Glycopeptide', routes: ['iv'], doses: ['500 mg','1 gm','15 mg/kg'], frequencies: ['BD','Q12H'], warnings: 'Monitor trough levels. Nephrotoxicity.', renalAdjust: true },
  { name: 'Ceftriaxone', generic: 'Ceftriaxone', class: 'Cephalosporin 3G', routes: ['iv','im'], doses: ['1 gm','2 gm'], frequencies: ['OD','BD'] },
  { name: 'Cefuroxime', generic: 'Cefuroxime', class: 'Cephalosporin 2G', routes: ['iv','oral'], doses: ['750 mg IV','1.5 gm IV','500 mg PO'], frequencies: ['BD','TDS'] },
  { name: 'Azithromycin', generic: 'Azithromycin', class: 'Macrolide', routes: ['oral','iv'], doses: ['250 mg','500 mg'], frequencies: ['OD'], warnings: 'QTc prolongation.' },
  { name: 'Metronidazole', generic: 'Metronidazole', class: 'Nitroimidazole', routes: ['iv','oral'], doses: ['400 mg PO','500 mg IV'], frequencies: ['TDS','Q8H'], warnings: 'Disulfiram-like reaction with alcohol.' },
  { name: 'Colistin', generic: 'Colistimethate', class: 'Polymyxin', routes: ['iv'], doses: ['9 MU loading','4.5 MU'], frequencies: ['BD','Q12H'], warnings: 'Nephrotoxic. Reserve for MDR gram-negatives.', renalAdjust: true },
  { name: 'Linezolid', generic: 'Linezolid', class: 'Oxazolidinone', routes: ['iv','oral'], doses: ['600 mg'], frequencies: ['BD','Q12H'], warnings: 'Thrombocytopenia. Serotonin syndrome with SSRIs.' },
  // Pain / Analgesics
  { name: 'Paracetamol', generic: 'Acetaminophen', class: 'Analgesic', routes: ['oral','iv'], doses: ['500 mg','650 mg','1 gm'], frequencies: ['TDS','QID','SOS'], maxDose: '4 gm/day', warnings: 'Hepatotoxicity at high doses.' },
  { name: 'Tramadol', generic: 'Tramadol', class: 'Opioid (weak)', routes: ['oral','iv'], doses: ['50 mg','100 mg'], frequencies: ['BD','TDS','SOS'], warnings: 'Seizure threshold lowering. Serotonin syndrome.' },
  { name: 'Morphine', generic: 'Morphine', class: 'Opioid (strong)', routes: ['iv','sc','oral'], doses: ['2 mg IV','5 mg IV','10 mg PO'], frequencies: ['Q4H','SOS'], warnings: 'Respiratory depression. Constipation.' },
  { name: 'Fentanyl', generic: 'Fentanyl', class: 'Opioid (strong)', routes: ['iv'], doses: ['25 mcg','50 mcg','100 mcg/h infusion'], frequencies: ['SOS','infusion'], warnings: 'Respiratory depression. Chest wall rigidity.' },
  { name: 'Diclofenac', generic: 'Diclofenac', class: 'NSAID', routes: ['oral','im','iv'], doses: ['50 mg PO','75 mg IM'], frequencies: ['BD','TDS','SOS'], warnings: 'GI bleed, renal impairment, ACS risk.' },
  { name: 'Pregabalin', generic: 'Pregabalin', class: 'Gabapentinoid', routes: ['oral'], doses: ['25 mg','50 mg','75 mg','150 mg'], frequencies: ['BD','HS'] },
  // GI
  { name: 'Pantoprazole', generic: 'Pantoprazole', class: 'PPI', routes: ['oral','iv'], doses: ['40 mg','80 mg IV bolus','8 mg/h IV infusion'], frequencies: ['OD','BD','infusion'] },
  { name: 'Ondansetron', generic: 'Ondansetron', class: 'Anti-emetic', routes: ['oral','iv'], doses: ['4 mg','8 mg'], frequencies: ['TDS','SOS'], warnings: 'QTc prolongation at high doses.' },
  { name: 'Metoclopramide', generic: 'Metoclopramide', class: 'Prokinetic', routes: ['oral','iv'], doses: ['10 mg'], frequencies: ['TDS','SOS'], warnings: 'Extrapyramidal symptoms. Avoid in Parkinsonism.' },
  { name: 'Lactulose', generic: 'Lactulose', class: 'Osmotic laxative', routes: ['oral'], doses: ['15 ml','30 ml'], frequencies: ['BD','TDS'] },
  // Diabetes
  { name: 'Insulin Glargine', generic: 'Insulin glargine', class: 'Basal insulin', routes: ['sc'], doses: ['10 U','20 U','30 U','40 U'], frequencies: ['OD (bedtime)','OD'], warnings: 'Hypoglycemia. Do not mix with other insulins.' },
  { name: 'Insulin Aspart', generic: 'Insulin aspart', class: 'Rapid-acting insulin', routes: ['sc','iv'], doses: ['4 U','6 U','8 U','10 U','sliding scale'], frequencies: ['TDS (pre-meals)','QID','infusion'], warnings: 'Hypoglycemia. Monitor blood sugar QID.' },
  { name: 'Metformin', generic: 'Metformin', class: 'Biguanide', routes: ['oral'], doses: ['250 mg','500 mg','1000 mg'], frequencies: ['OD','BD','TDS'], warnings: 'Hold before contrast. Lactic acidosis in renal failure.', renalAdjust: true },
  // Respiratory
  { name: 'Salbutamol Nebulization', generic: 'Salbutamol', class: 'SABA', routes: ['inhalation'], doses: ['2.5 mg','5 mg'], frequencies: ['Q4H','Q6H','SOS'] },
  { name: 'Ipratropium Nebulization', generic: 'Ipratropium', class: 'SAMA', routes: ['inhalation'], doses: ['500 mcg'], frequencies: ['Q6H','Q8H','TDS'] },
  { name: 'Budesonide Nebulization', generic: 'Budesonide', class: 'ICS', routes: ['inhalation'], doses: ['0.5 mg','1 mg'], frequencies: ['BD'] },
  { name: 'Methylprednisolone', generic: 'Methylprednisolone', class: 'Corticosteroid', routes: ['iv'], doses: ['40 mg','125 mg','1 gm (pulse)'], frequencies: ['OD','BD','TDS','Q8H'] },
  { name: 'Dexamethasone', generic: 'Dexamethasone', class: 'Corticosteroid', routes: ['iv','oral'], doses: ['4 mg','8 mg','6 mg'], frequencies: ['OD','BD'] },
  { name: 'Hydrocortisone', generic: 'Hydrocortisone', class: 'Corticosteroid', routes: ['iv'], doses: ['50 mg','100 mg'], frequencies: ['Q6H','Q8H','TDS'] },
  // Neuro
  { name: 'Levetiracetam', generic: 'Levetiracetam', class: 'Antiepileptic', routes: ['iv','oral'], doses: ['250 mg','500 mg','1000 mg','1500 mg'], frequencies: ['BD'], renalAdjust: true },
  { name: 'Phenytoin', generic: 'Phenytoin', class: 'Antiepileptic', routes: ['iv','oral'], doses: ['100 mg','300 mg','15 mg/kg IV loading'], frequencies: ['TDS','OD (ER)'], warnings: 'Monitor levels. Purple glove syndrome IV.' },
  { name: 'Mannitol', generic: 'Mannitol 20%', class: 'Osmotic diuretic', routes: ['iv'], doses: ['100 ml','200 ml','1 gm/kg'], frequencies: ['Q6H','Q8H','SOS'], warnings: 'Rapid infusion. Monitor osmolality.' },
  // Sedation / ICU
  { name: 'Midazolam', generic: 'Midazolam', class: 'Benzodiazepine', routes: ['iv'], doses: ['1 mg','2 mg','5 mg','0.05 mg/kg/h infusion'], frequencies: ['SOS','infusion'], warnings: 'Respiratory depression. Flumazenil for reversal.' },
  { name: 'Propofol', generic: 'Propofol', class: 'Sedative', routes: ['iv'], doses: ['1-2 mg/kg bolus','25-75 mcg/kg/min infusion'], frequencies: ['infusion'], warnings: 'Hypotension. Propofol infusion syndrome.' },
  { name: 'Dexmedetomidine', generic: 'Dexmedetomidine', class: 'Alpha-2 agonist', routes: ['iv'], doses: ['0.2-0.7 mcg/kg/h'], frequencies: ['infusion'], warnings: 'Bradycardia. Hypotension.' },
  // Vasopressors
  { name: 'Noradrenaline', generic: 'Norepinephrine', class: 'Vasopressor', routes: ['iv'], doses: ['0.05-0.5 mcg/kg/min'], frequencies: ['infusion'], warnings: 'Central line only. Titrate to MAP >65.' },
  { name: 'Dopamine', generic: 'Dopamine', class: 'Vasopressor/Inotrope', routes: ['iv'], doses: ['2-5 mcg/kg/min (renal)','5-10 (inotropic)','10-20 (vasopressor)'], frequencies: ['infusion'] },
  { name: 'Dobutamine', generic: 'Dobutamine', class: 'Inotrope', routes: ['iv'], doses: ['2.5-10 mcg/kg/min'], frequencies: ['infusion'] },
  // IV Fluids
  { name: 'NS 0.9%', generic: 'Normal saline', class: 'IV Fluid', routes: ['iv'], doses: ['500 ml','1000 ml'], frequencies: ['over 4h','over 6h','over 8h','@100 ml/h','@150 ml/h'] },
  { name: 'RL', generic: 'Ringer lactate', class: 'IV Fluid', routes: ['iv'], doses: ['500 ml','1000 ml'], frequencies: ['over 4h','over 6h','over 8h'] },
  { name: 'DNS', generic: 'Dextrose normal saline', class: 'IV Fluid', routes: ['iv'], doses: ['500 ml','1000 ml'], frequencies: ['over 6h','over 8h','@75 ml/h'] },
  { name: 'D5W', generic: 'Dextrose 5%', class: 'IV Fluid', routes: ['iv'], doses: ['500 ml','1000 ml'], frequencies: ['over 6h','over 8h'] },
  { name: 'D25%', generic: 'Dextrose 25%', class: 'IV Fluid', routes: ['iv'], doses: ['25 ml','50 ml','100 ml'], frequencies: ['STAT','SOS'], warnings: 'For hypoglycemia. Central line preferred for >10%.' },
  // Electrolytes
  { name: 'KCl', generic: 'Potassium chloride', class: 'Electrolyte', routes: ['iv','oral'], doses: ['10 mEq','20 mEq','40 mEq','10 mEq/h max IV'], frequencies: ['OD','BD','TDS','in IV fluids'], warnings: 'Never IV push. Max 10 mEq/h peripheral, 20 central.' },
  { name: 'MgSO4', generic: 'Magnesium sulfate', class: 'Electrolyte', routes: ['iv'], doses: ['1 gm','2 gm','4 gm'], frequencies: ['over 1h','over 2h','SOS'], warnings: 'Monitor reflexes. Respiratory depression.' },
  { name: 'Calcium Gluconate', generic: 'Calcium gluconate 10%', class: 'Electrolyte', routes: ['iv'], doses: ['10 ml (1 gm)','20 ml'], frequencies: ['over 10 min','SOS'], warnings: 'Slow IV push. Cardiac monitoring.' },
];

// Drug interaction pairs
const INTERACTIONS: [string, string, string, string][] = [
  ['Aspirin', 'Enoxaparin', 'major', 'Increased bleeding risk. Monitor closely.'],
  ['Aspirin', 'Warfarin', 'major', 'Significantly increased bleeding risk.'],
  ['Clopidogrel', 'Pantoprazole', 'moderate', 'PPI may reduce clopidogrel efficacy. Consider H2 blocker.'],
  ['Metformin', 'Furosemide', 'moderate', 'Furosemide may worsen renal function. Monitor.'],
  ['Ramipril', 'Spironolactone', 'major', 'Hyperkalemia risk. Monitor K+ closely.'],
  ['Ramipril', 'KCl', 'major', 'Hyperkalemia risk. Monitor K+ closely.'],
  ['Digoxin', 'Amiodarone', 'major', 'Amiodarone increases digoxin levels 70-100%. Halve digoxin dose.'],
  ['Warfarin', 'Metronidazole', 'major', 'Increased INR. Monitor closely.'],
  ['Warfarin', 'Amiodarone', 'major', 'Increased INR. Reduce warfarin 30-50%.'],
  ['Tramadol', 'Ondansetron', 'moderate', 'Reduced tramadol efficacy. Consider alternative anti-emetic.'],
  ['Midazolam', 'Morphine', 'major', 'Additive respiratory depression. Reduce doses.'],
  ['Midazolam', 'Fentanyl', 'major', 'Additive respiratory depression. Monitor closely.'],
  ['Metoclopramide', 'Levetiracetam', 'minor', 'Both lower seizure threshold.'],
  ['Noradrenaline', 'Insulin Aspart', 'moderate', 'Catecholamines cause hyperglycemia. Increase insulin monitoring.'],
  ['Linezolid', 'Tramadol', 'major', 'Serotonin syndrome risk. Avoid combination.'],
];

export default function SmartMedOrders({ meds, admissionId, staffId, admissionDx, onAdd, onDiscontinue, onFlash }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<typeof DRUG_DB[0] | null>(null);
  const [form, setForm] = useState({ drugName: '', genericName: '', dose: '', route: 'oral', frequency: 'OD', isPrn: false, specialInstructions: '' });
  const [interactions, setInteractions] = useState<{ drug1: string; drug2: string; severity: string; detail: string }[]>([]);
  const [dcReason, setDcReason] = useState('');
  const [dcId, setDcId] = useState('');

  // Search drugs
  const searchResults = useMemo(() => {
    if (search.length < 2) return [];
    const q = search.toLowerCase();
    return DRUG_DB.filter(d => d.name.toLowerCase().includes(q) || d.generic.toLowerCase().includes(q) || d.class.toLowerCase().includes(q)).slice(0, 8);
  }, [search]);

  // Check interactions whenever form drug changes
  const checkInteractions = useCallback((drugName: string) => {
    const currentDrugs = meds.filter(m => m.status === 'active').map(m => m.drug_name);
    const found: typeof interactions = [];
    for (const [d1, d2, sev, detail] of INTERACTIONS) {
      if ((drugName === d1 && currentDrugs.some(c => c.includes(d2))) || (drugName === d2 && currentDrugs.some(c => c.includes(d1)))) {
        found.push({ drug1: d1, drug2: d2, severity: sev, detail });
      }
    }
    setInteractions(found);
  }, [meds]);

  const selectDrug = (drug: typeof DRUG_DB[0]) => {
    setSelectedDrug(drug);
    setForm(f => ({ ...f, drugName: drug.name, genericName: drug.generic, route: drug.routes[0], dose: drug.doses[0], frequency: drug.frequencies[0] }));
    setSearch('');
    checkInteractions(drug.name);
  };

  const saveMed = async () => {
    if (!form.drugName || !form.dose) return;
    await onAdd({ drugName: form.drugName, genericName: form.genericName, dose: form.dose, route: form.route, frequency: form.frequency, isPrn: form.isPrn, specialInstructions: form.specialInstructions });
    setShowForm(false); setSelectedDrug(null); setInteractions([]);
    setForm({ drugName: '', genericName: '', dose: '', route: 'oral', frequency: 'OD', isPrn: false, specialInstructions: '' });
    onFlash('Medication ordered');
  };

  const activeMeds = meds.filter(m => m.status === 'active');
  const dcMeds = meds.filter(m => m.status === 'discontinued' || m.status === 'completed');
  const sevColor = (s: string) => s === 'major' ? 'bg-red-100 text-red-700 border-red-300' : s === 'moderate' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-blue-100 text-blue-700 border-blue-300';
  const routeColor = (r: string) => r === 'iv' ? 'bg-red-50 text-red-700' : r === 'sc' ? 'bg-blue-50 text-blue-700' : r === 'im' ? 'bg-purple-50 text-purple-700' : r === 'inhalation' ? 'bg-teal-50 text-teal-700' : 'bg-gray-50 text-gray-700';

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Medication Orders ({activeMeds.length} active)</h2>
        <button onClick={() => { setShowForm(!showForm); setSelectedDrug(null); setSearch(''); setInteractions([]); }}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Order Medication'}</button>
      </div>

      {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        {/* Drug search */}
        {!selectedDrug ? (
          <div className="relative">
            <label className="text-xs text-gray-500 font-medium">Search medication</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} autoFocus
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Type drug name, generic name, or class..." />
            {searchResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
              {searchResults.map(d => (
                <button key={d.name} onClick={() => selectDrug(d)} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b last:border-0">
                  <div className="font-medium text-sm">{d.name}</div>
                  <div className="text-[10px] text-gray-400">{d.generic} | {d.class} | {d.routes.join(', ')} | {d.doses[0]}</div>
                </button>
              ))}
            </div>}
          </div>
        ) : (
          <>
            {/* Selected drug header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-blue-800">{selectedDrug.name}</div>
                <div className="text-[10px] text-blue-600">{selectedDrug.generic} | {selectedDrug.class}</div>
              </div>
              <button onClick={() => { setSelectedDrug(null); setSearch(''); setInteractions([]); }} className="text-xs text-blue-600 hover:text-blue-800">Change drug</button>
            </div>

            {/* Interactions alert */}
            {interactions.length > 0 && <div className="space-y-1.5">
              {interactions.map((ix, i) => (
                <div key={i} className={`rounded-lg border p-2.5 ${sevColor(ix.severity)}`}>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span>{ix.severity === 'major' ? '⚠️' : '⚡'} INTERACTION: {ix.drug1} ↔ {ix.drug2}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${sevColor(ix.severity)}`}>{ix.severity}</span>
                  </div>
                  <div className="text-[11px] mt-0.5">{ix.detail}</div>
                </div>
              ))}
            </div>}

            {/* Warning */}
            {selectedDrug.warnings && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
              <span className="font-medium">⚠️ Warning:</span> {selectedDrug.warnings}
            </div>}

            {/* Dose — click chips */}
            <div><label className="text-xs text-gray-500 font-medium">Dose *</label>
              <div className="flex flex-wrap gap-1.5 mt-1">{selectedDrug.doses.map(d => (
                <button key={d} onClick={() => setForm(f => ({...f, dose: d}))}
                  className={`px-3 py-1 rounded-lg text-xs border font-medium ${form.dose === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{d}</button>
              ))}</div>
              <input type="text" value={form.dose} onChange={e => setForm(f => ({...f, dose: e.target.value}))} className="w-full mt-1.5 px-3 py-1.5 border rounded-lg text-sm" placeholder="Or type custom dose..." />
              {selectedDrug.maxDose && <div className="text-[10px] text-orange-600 mt-0.5">Max: {selectedDrug.maxDose}</div>}
            </div>

            {/* Route — click chips */}
            <div><label className="text-xs text-gray-500 font-medium">Route</label>
              <div className="flex gap-1.5 mt-1">{selectedDrug.routes.map(r => (
                <button key={r} onClick={() => setForm(f => ({...f, route: r}))}
                  className={`px-3 py-1 rounded-lg text-xs border font-medium ${form.route === r ? 'bg-blue-600 text-white border-blue-600' : routeColor(r) + ' border-gray-200'}`}>{r.toUpperCase()}</button>
              ))}</div></div>

            {/* Frequency — click chips */}
            <div><label className="text-xs text-gray-500 font-medium">Frequency</label>
              <div className="flex flex-wrap gap-1.5 mt-1">{selectedDrug.frequencies.map(f => (
                <button key={f} onClick={() => setForm(prev => ({...prev, frequency: f}))}
                  className={`px-3 py-1 rounded-lg text-xs border ${form.frequency === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{f}</button>
              ))}</div>
              {!selectedDrug.frequencies.includes(form.frequency) && <input type="text" value={form.frequency} onChange={e => setForm(f => ({...f, frequency: e.target.value}))} className="w-full mt-1.5 px-3 py-1.5 border rounded-lg text-sm" placeholder="Custom frequency..." />}
            </div>

            {/* PRN + Instructions */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.isPrn} onChange={e => setForm(f => ({...f, isPrn: e.target.checked}))} className="w-4 h-4 rounded" />
                <span className="font-medium">PRN (as needed)</span>
              </label>
              {selectedDrug.renalAdjust && <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded">Requires renal dose adjustment</span>}
            </div>

            <div><label className="text-xs text-gray-500">Special instructions</label>
              <input type="text" value={form.specialInstructions} onChange={e => setForm(f => ({...f, specialInstructions: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Before food, dilute in 100ml NS, titrate to BP..." /></div>

            <button onClick={saveMed} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium">
              {interactions.some(i => i.severity === 'major') ? '⚠️ Order with Interaction Warning' : 'Order Medication'}
            </button>
          </>
        )}
      </div>}

      {/* Active medications */}
      {activeMeds.length === 0 ? <div className="text-center py-6 bg-white rounded-xl border text-gray-400 text-sm">No active medications</div> :
      <div className="bg-white rounded-xl border overflow-hidden mb-4">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-2.5 font-medium text-gray-500">Medication</th>
            <th className="p-2.5 font-medium text-gray-500">Dose</th>
            <th className="p-2.5 font-medium text-gray-500">Route</th>
            <th className="p-2.5 font-medium text-gray-500">Frequency</th>
            <th className="p-2.5 font-medium text-gray-500">Since</th>
            <th className="p-2.5 font-medium text-gray-500">Actions</th>
          </tr></thead>
          <tbody>{activeMeds.map(m => (
            <tr key={m.id} className="border-b hover:bg-gray-50">
              <td className="p-2.5"><span className="font-medium">{m.drug_name}</span>{m.generic_name && <span className="text-[10px] text-gray-400 ml-1">({m.generic_name})</span>}</td>
              <td className="p-2.5 text-center font-medium">{m.dose}</td>
              <td className="p-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${routeColor(m.route)}`}>{m.route.toUpperCase()}</span></td>
              <td className="p-2.5 text-center">{m.frequency}{m.is_prn && <span className="ml-1 text-orange-600 font-medium">PRN</span>}</td>
              <td className="p-2.5 text-center text-gray-400">{new Date(m.start_date || m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
              <td className="p-2.5 text-center">
                {dcId === m.id ? (
                  <div className="flex items-center gap-1">
                    <select value={dcReason} onChange={e => setDcReason(e.target.value)} className="text-[10px] border rounded px-1 py-0.5">
                      <option value="">Reason...</option>
                      {['Course completed','Switched to oral','Adverse effect','Not tolerated','Duplicate','Changed to alternative','Patient request','Discharge'].map(r => <option key={r}>{r}</option>)}
                    </select>
                    <button onClick={async () => { if (dcReason) { await onDiscontinue(m.id, dcReason); setDcId(''); setDcReason(''); onFlash('Discontinued'); } }} className="text-red-600 text-[10px] font-bold">D/C</button>
                    <button onClick={() => setDcId('')} className="text-gray-400 text-[10px]">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setDcId(m.id)} className="text-red-500 text-[10px] hover:text-red-700">Discontinue</button>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>}

      {/* Discontinued medications (collapsed) */}
      {dcMeds.length > 0 && <details className="mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Discontinued / Completed ({dcMeds.length})</summary>
        <div className="mt-2 space-y-1">{dcMeds.map(m => (
          <div key={m.id} className="bg-gray-50 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-gray-500 line-through">
            <span>{m.drug_name} {m.dose} {m.route} {m.frequency}</span>
            <span className="text-[10px]">{m.discontinue_reason || m.status}</span>
          </div>
        ))}</div>
      </details>}
    </div>
  );
}
