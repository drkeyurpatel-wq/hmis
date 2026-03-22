// components/ot/anaesthesia-form.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

interface Props {
  bookingId: string;
  staffId: string;
  patientName: string;
  onFlash: (msg: string) => void;
}

interface Drug { drug: string; dose: string; route: string; time: string; }
interface VitalPoint { time: string; hr: string; bp: string; spo2: string; etco2: string; note: string; }

const COMMON_DRUGS = [
  'Propofol', 'Thiopentone', 'Ketamine', 'Midazolam', 'Fentanyl', 'Morphine',
  'Succinylcholine', 'Atracurium', 'Vecuronium', 'Rocuronium', 'Neostigmine',
  'Glycopyrrolate', 'Atropine', 'Ondansetron', 'Dexamethasone', 'Paracetamol IV',
  'Bupivacaine', 'Lignocaine', 'Ropivacaine', 'Ephedrine', 'Phenylephrine',
  'Noradrenaline', 'Dopamine', 'Dobutamine', 'Adrenaline',
];

export default function AnaesthesiaForm({ bookingId, staffId, patientName, onFlash }: Props) {
  const [record, setRecord] = useState<any>(null);
  const [form, setForm] = useState({
    type: 'general',
    asa_grade: 2,
    airway: 'Mallampati I',
    mallampati: 'I',
    mouth_opening: 'adequate',
    neck_mobility: 'normal',
    dentition: 'intact',
    fasting_hours: 8,
    allergies: 'NKDA',
    pre_existing: '',
    premedication: '',
    induction_time: '',
    intubation_time: '',
    extubation_time: '',
    tube_size: '',
    tube_type: 'ETT',
    cuff_pressure: '',
    grade_of_intubation: 'I',
    attempts: 1,
    complications: '',
    blood_loss_ml: 0,
    fluids_given: '',
    blood_given: '',
    urine_output_ml: 0,
    post_op_plan: '',
  });
  const [drugs, setDrugs] = useState<Drug[]>([{ drug: '', dose: '', route: 'IV', time: '' }]);
  const [vitals, setVitals] = useState<VitalPoint[]>([{ time: '', hr: '', bp: '', spo2: '', etco2: '', note: '' }]);
  const [loading, setLoading] = useState(false);

  // Load existing record
  useEffect(() => {
    if (!bookingId || !sb()) return;
    sb()!.from('hmis_anaesthesia_records').select('*').eq('ot_booking_id', bookingId).single()
      .then(({ data }: any) => {
        if (!data) return;
        setRecord(data);
        const preOp = data.pre_op_assessment || {};
        setForm(f => ({
          ...f, type: data.anaesthesia_type || 'general',
          asa_grade: preOp.asa_grade || 2, airway: preOp.airway || '',
          mallampati: preOp.mallampati || 'I', mouth_opening: preOp.mouth_opening || 'adequate',
          neck_mobility: preOp.neck_mobility || 'normal', dentition: preOp.dentition || 'intact',
          fasting_hours: preOp.fasting_hours || 8, allergies: preOp.allergies || 'NKDA',
          pre_existing: preOp.pre_existing || '', premedication: preOp.premedication || '',
          induction_time: preOp.induction_time || '', intubation_time: preOp.intubation_time || '',
          extubation_time: preOp.extubation_time || '', tube_size: preOp.tube_size || '',
          tube_type: preOp.tube_type || 'ETT', cuff_pressure: preOp.cuff_pressure || '',
          grade_of_intubation: preOp.grade_of_intubation || 'I', attempts: preOp.attempts || 1,
          complications: data.complications || '', blood_loss_ml: preOp.blood_loss_ml || 0,
          fluids_given: preOp.fluids_given || '', blood_given: preOp.blood_given || '',
          urine_output_ml: preOp.urine_output_ml || 0, post_op_plan: preOp.post_op_plan || '',
        }));
        if (Array.isArray(data.drugs_used) && data.drugs_used.length > 0) setDrugs(data.drugs_used);
        if (Array.isArray(data.vitals_timeline) && data.vitals_timeline.length > 0) setVitals(data.vitals_timeline);
      });
  }, [bookingId]);

  const addDrug = () => setDrugs(d => [...d, { drug: '', dose: '', route: 'IV', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }]);
  const removeDrug = (i: number) => setDrugs(d => d.filter((_, j) => j !== i));
  const updateDrug = (i: number, key: string, val: string) => { const u = [...drugs]; u[i] = { ...u[i], [key]: val }; setDrugs(u); };

  const addVital = () => setVitals(v => [...v, { time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), hr: '', bp: '', spo2: '', etco2: '', note: '' }]);
  const removeVital = (i: number) => setVitals(v => v.filter((_, j) => j !== i));
  const updateVital = (i: number, key: string, val: string) => { const u = [...vitals]; u[i] = { ...u[i], [key]: val }; setVitals(u); };

  const save = async () => {
    if (!bookingId || !sb()) return;
    setLoading(true);
    const preOp = {
      asa_grade: form.asa_grade, airway: form.airway, mallampati: form.mallampati,
      mouth_opening: form.mouth_opening, neck_mobility: form.neck_mobility, dentition: form.dentition,
      fasting_hours: form.fasting_hours, allergies: form.allergies, pre_existing: form.pre_existing,
      premedication: form.premedication, induction_time: form.induction_time,
      intubation_time: form.intubation_time, extubation_time: form.extubation_time,
      tube_size: form.tube_size, tube_type: form.tube_type, cuff_pressure: form.cuff_pressure,
      grade_of_intubation: form.grade_of_intubation, attempts: form.attempts,
      blood_loss_ml: form.blood_loss_ml, fluids_given: form.fluids_given,
      blood_given: form.blood_given, urine_output_ml: form.urine_output_ml,
      post_op_plan: form.post_op_plan,
    };

    const payload = {
      ot_booking_id: bookingId, anaesthetist_id: staffId,
      anaesthesia_type: form.type, pre_op_assessment: preOp,
      drugs_used: drugs.filter(d => d.drug), vitals_timeline: vitals.filter(v => v.time),
      complications: form.complications,
    };

    if (record?.id) {
      await sb()!.from('hmis_anaesthesia_records').update(payload).eq('id', record.id);
    } else {
      const { data } = await sb()!.from('hmis_anaesthesia_records').insert(payload).select().single();
      if (data) setRecord(data);
    }
    onFlash('Anaesthesia record saved');
    setLoading(false);
  };

  const u = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Type + ASA */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-sm mb-3">Anaesthesia Type & Pre-Op Assessment</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><label className="text-xs text-gray-500">Anaesthesia type *</label>
            <select value={form.type} onChange={e => u('type', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['general','spinal','epidural','combined_spinal_epidural','regional','local','sedation','mac'].map(t =>
                <option key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">ASA Grade *</label>
            <select value={form.asa_grade} onChange={e => u('asa_grade', parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {[1,2,3,4,5,6].map(g => <option key={g} value={g}>ASA {g}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Fasting (hours)</label>
            <input type="number" value={form.fasting_hours} onChange={e => u('fasting_hours', parseInt(e.target.value)||0)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>

        {/* Airway assessment */}
        <div className="text-xs font-medium text-gray-500 mb-2">Airway Assessment</div>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div><label className="text-[10px] text-gray-400">Mallampati</label>
            <select value={form.mallampati} onChange={e => u('mallampati', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm">
              {['I','II','III','IV'].map(g => <option key={g}>{g}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-400">Mouth opening</label>
            <select value={form.mouth_opening} onChange={e => u('mouth_opening', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm">
              {['adequate','limited','restricted'].map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-400">Neck mobility</label>
            <select value={form.neck_mobility} onChange={e => u('neck_mobility', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm">
              {['normal','limited','fixed'].map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-400">Dentition</label>
            <select value={form.dentition} onChange={e => u('dentition', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm">
              {['intact','loose_teeth','dentures','edentulous'].map(o => <option key={o}>{o.replace('_',' ')}</option>)}</select></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Known allergies</label>
            <input type="text" value={form.allergies} onChange={e => u('allergies', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Pre-existing conditions</label>
            <input type="text" value={form.pre_existing} onChange={e => u('pre_existing', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="HTN, DM, IHD, Asthma..." /></div>
        </div>
        <div className="mt-3"><label className="text-xs text-gray-500">Premedication given</label>
          <input type="text" value={form.premedication} onChange={e => u('premedication', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Inj. Glycopyrrolate 0.2mg IV, Inj. Midazolam 1mg IV" /></div>
      </div>

      {/* Intubation details */}
      {(form.type === 'general') && <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-sm mb-3">Intubation Details</h3>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-[10px] text-gray-400">Tube type</label>
            <select value={form.tube_type} onChange={e => u('tube_type', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm">
              {['ETT','LMA','i-gel','Tracheostomy'].map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-400">Tube size</label>
            <input type="text" value={form.tube_size} onChange={e => u('tube_size', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="e.g., 7.5" /></div>
          <div><label className="text-[10px] text-gray-400">Cormack-Lehane grade</label>
            <select value={form.grade_of_intubation} onChange={e => u('grade_of_intubation', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm">
              {['I','II','IIa','IIb','III','IV'].map(g => <option key={g}>{g}</option>)}</select></div>
          <div><label className="text-[10px] text-gray-400">Attempts</label>
            <input type="number" min="1" max="5" value={form.attempts} onChange={e => u('attempts', parseInt(e.target.value)||1)} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div><label className="text-[10px] text-gray-400">Induction time</label>
            <input type="time" value={form.induction_time} onChange={e => u('induction_time', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div><label className="text-[10px] text-gray-400">Intubation time</label>
            <input type="time" value={form.intubation_time} onChange={e => u('intubation_time', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div><label className="text-[10px] text-gray-400">Extubation time</label>
            <input type="time" value={form.extubation_time} onChange={e => u('extubation_time', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
        </div>
      </div>}

      {/* Drugs administered */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Drugs Administered</h3>
          <button onClick={addDrug} className="text-xs text-blue-600 hover:text-blue-800">+ Add drug</button>
        </div>
        <div className="space-y-2">
          {drugs.map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1">
                <input type="text" list="drug-list" value={d.drug} onChange={e => updateDrug(i, 'drug', e.target.value)}
                  placeholder="Drug name" className="w-full px-2 py-1.5 border rounded text-sm" />
              </div>
              <input type="text" value={d.dose} onChange={e => updateDrug(i, 'dose', e.target.value)}
                placeholder="Dose" className="w-24 px-2 py-1.5 border rounded text-sm" />
              <select value={d.route} onChange={e => updateDrug(i, 'route', e.target.value)} className="w-16 px-1 py-1.5 border rounded text-xs">
                {['IV','IM','SC','INH','IT','EP','SL','PO'].map(r => <option key={r}>{r}</option>)}</select>
              <input type="time" value={d.time} onChange={e => updateDrug(i, 'time', e.target.value)}
                className="w-24 px-2 py-1.5 border rounded text-sm" />
              {drugs.length > 1 && <button onClick={() => removeDrug(i)} className="text-red-400 text-xs">x</button>}
            </div>
          ))}
        </div>
        <datalist id="drug-list">{COMMON_DRUGS.map(d => <option key={d} value={d} />)}</datalist>
      </div>

      {/* Intra-op vitals timeline */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Intra-Op Vitals (every 5–15 min)</h3>
          <button onClick={addVital} className="text-xs text-blue-600 hover:text-blue-800">+ Add reading</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50"><th className="p-1.5 text-left">Time</th><th className="p-1.5">HR</th><th className="p-1.5">BP</th><th className="p-1.5">SpO2</th><th className="p-1.5">EtCO2</th><th className="p-1.5 text-left">Note</th><th className="p-1.5"></th></tr></thead>
            <tbody>{vitals.map((v, i) => (
              <tr key={i} className="border-t">
                <td className="p-1"><input type="time" value={v.time} onChange={e => updateVital(i, 'time', e.target.value)} className="w-20 px-1 py-1 border rounded text-xs" /></td>
                <td className="p-1"><input type="text" value={v.hr} onChange={e => updateVital(i, 'hr', e.target.value)} className="w-14 px-1 py-1 border rounded text-xs text-center" /></td>
                <td className="p-1"><input type="text" value={v.bp} onChange={e => updateVital(i, 'bp', e.target.value)} className="w-20 px-1 py-1 border rounded text-xs text-center" placeholder="120/80" /></td>
                <td className="p-1"><input type="text" value={v.spo2} onChange={e => updateVital(i, 'spo2', e.target.value)} className="w-14 px-1 py-1 border rounded text-xs text-center" /></td>
                <td className="p-1"><input type="text" value={v.etco2} onChange={e => updateVital(i, 'etco2', e.target.value)} className="w-14 px-1 py-1 border rounded text-xs text-center" /></td>
                <td className="p-1"><input type="text" value={v.note} onChange={e => updateVital(i, 'note', e.target.value)} className="w-full px-1 py-1 border rounded text-xs" placeholder="Event..." /></td>
                <td className="p-1">{vitals.length > 1 && <button onClick={() => removeVital(i)} className="text-red-400">x</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {/* Fluid balance + complications */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-sm mb-3">Fluid Balance & Complications</h3>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">EBL (ml)</label>
            <input type="number" value={form.blood_loss_ml} onChange={e => u('blood_loss_ml', parseInt(e.target.value)||0)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Fluids given</label>
            <input type="text" value={form.fluids_given} onChange={e => u('fluids_given', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="RL 1000ml, NS 500ml" /></div>
          <div><label className="text-xs text-gray-500">Blood given</label>
            <input type="text" value={form.blood_given} onChange={e => u('blood_given', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="1 unit PRBC" /></div>
          <div><label className="text-xs text-gray-500">Urine output (ml)</label>
            <input type="number" value={form.urine_output_ml} onChange={e => u('urine_output_ml', parseInt(e.target.value)||0)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div className="mt-3"><label className="text-xs text-gray-500">Complications</label>
          <textarea value={form.complications} onChange={e => u('complications', e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="None / Difficult intubation / Bronchospasm / Hypotension requiring vasopressors..." /></div>
        <div className="mt-3"><label className="text-xs text-gray-500">Post-op plan</label>
          <textarea value={form.post_op_plan} onChange={e => u('post_op_plan', e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Extubated in OT, shifted to ICU for monitoring / shifted to ward..." /></div>
      </div>

      <button onClick={save} disabled={loading} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
        {loading ? 'Saving...' : record ? 'Update Anaesthesia Record' : 'Save Anaesthesia Record'}
      </button>
    </div>
  );
}
