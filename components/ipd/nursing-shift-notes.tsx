// components/ipd/nursing-shift-notes.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

interface Props {
  admissionId: string;
  staffId: string;
  patientName: string;
  onFlash: (msg: string) => void;
}

const SHIFT_TIMES: Record<string, string> = { morning: '07:00 – 14:00', evening: '14:00 – 21:00', night: '21:00 – 07:00' };

const ASSESSMENT_SYSTEMS = [
  { key: 'neuro', label: 'Neurological', options: ['Alert and oriented', 'Confused', 'Drowsy', 'Unresponsive', 'Agitated', 'GCS documented in ICU chart'] },
  { key: 'cardio', label: 'Cardiovascular', options: ['Regular rhythm', 'Irregular', 'Tachycardia', 'Bradycardia', 'Hypotension', 'Pedal edema', 'JVP raised', 'Chest pain reported'] },
  { key: 'resp', label: 'Respiratory', options: ['Normal effort', 'Laboured', 'On O2 therapy', 'On ventilator', 'Cough present', 'Wheezing', 'Dyspnea at rest', 'SpO2 maintained'] },
  { key: 'gi', label: 'GI / Abdomen', options: ['Soft, non-tender', 'Distended', 'Bowel sounds present', 'Absent bowel sounds', 'Nausea/vomiting', 'Tolerating diet', 'NPO', 'Ryles tube in situ'] },
  { key: 'renal', label: 'Renal / Urinary', options: ['Adequate output', 'Oliguria', 'Foley in situ', 'Self-voiding', 'Dark urine', 'Hematuria'] },
  { key: 'skin', label: 'Skin / Wound', options: ['Intact', 'Pressure areas checked', 'Wound clean', 'Wound soaked', 'Drain in situ', 'Redness around site', 'Dressing changed'] },
  { key: 'pain', label: 'Pain', options: ['No pain', 'Mild (1-3)', 'Moderate (4-6)', 'Severe (7-10)', 'Pain medication given', 'Pain well controlled'] },
  { key: 'lines', label: 'Lines & Devices', options: ['IV line patent', 'Central line in situ', 'Arterial line', 'Foley catheter', 'NG tube', 'Chest drain', 'Tracheostomy', 'Lines flushed'] },
];

export default function NursingShiftNotes({ admissionId, staffId, patientName, onFlash }: Props) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shift: getCurrentShift(),
    assessment: {} as Record<string, string[]>,
    vitals_summary: '',
    interventions: '',
    medications_given: '',
    io_summary: '',
    patient_response: '',
    safety_checks: { fall_risk_assessed: false, pressure_area_checked: false, restraints_checked: false, id_band_verified: false, allergy_band_checked: false },
    education_given: '',
    handover_notes: '',
    escalation_needed: false,
    escalation_details: '',
  });

  function getCurrentShift(): string {
    const h = new Date().getHours();
    if (h >= 7 && h < 14) return 'morning';
    if (h >= 14 && h < 21) return 'evening';
    return 'night';
  }

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_nursing_notes')
      .select('*, nurse:hmis_staff!hmis_nursing_notes_nurse_id_fkey(full_name)')
      .eq('admission_id', admissionId).order('created_at', { ascending: false }).limit(30);
    setNotes(data || []);
    setLoading(false);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const toggleAssessment = (system: string, option: string) => {
    setForm(f => {
      const current = f.assessment[system] || [];
      const updated = current.includes(option) ? current.filter(o => o !== option) : [...current, option];
      return { ...f, assessment: { ...f.assessment, [system]: updated } };
    });
  };

  const saveNote = async () => {
    if (!admissionId || !sb()) return;
    const noteText = [
      '--- NURSING ASSESSMENT ---',
      ...Object.entries(form.assessment).map(([sys, items]) => items.length > 0 ? `${sys.toUpperCase()}: ${items.join(', ')}` : '').filter(Boolean),
      form.vitals_summary ? `\nVITALS: ${form.vitals_summary}` : '',
      form.interventions ? `\nINTERVENTIONS: ${form.interventions}` : '',
      form.medications_given ? `\nMEDICATIONS: ${form.medications_given}` : '',
      form.io_summary ? `\nI/O: ${form.io_summary}` : '',
      form.patient_response ? `\nPATIENT RESPONSE: ${form.patient_response}` : '',
      `\nSAFETY: ${Object.entries(form.safety_checks).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' ')).join(', ') || 'Not documented'}`,
      form.education_given ? `\nEDUCATION: ${form.education_given}` : '',
      form.escalation_needed ? `\n⚠️ ESCALATION: ${form.escalation_details}` : '',
      `\n--- HANDOVER ---\n${form.handover_notes || 'No specific handover notes'}`,
    ].filter(Boolean).join('\n');

    await sb().from('hmis_nursing_notes').insert({
      admission_id: admissionId, nurse_id: staffId,
      shift: form.shift, note: noteText,
    });

    onFlash('Nursing shift note saved');
    setShowForm(false);
    setForm({ ...form, assessment: {}, vitals_summary: '', interventions: '', medications_given: '', io_summary: '', patient_response: '', safety_checks: { fall_risk_assessed: false, pressure_area_checked: false, restraints_checked: false, id_band_verified: false, allergy_band_checked: false }, education_given: '', handover_notes: '', escalation_needed: false, escalation_details: '' });
    load();
  };

  const shiftColor = (s: string) => s === 'morning' ? 'bg-yellow-100 text-yellow-800' : s === 'evening' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Nursing Shift Documentation</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Shift Note'}</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-5 mb-4 space-y-4">
          {/* Shift selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">Shift:</label>
            {['morning', 'evening', 'night'].map(s => (
              <button key={s} onClick={() => setForm(f => ({ ...f, shift: s }))}
                className={`px-3 py-1.5 text-xs rounded-lg border ${form.shift === s ? shiftColor(s) + ' border-current font-medium' : 'bg-white border-gray-200'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)} ({SHIFT_TIMES[s]})
              </button>
            ))}
          </div>

          {/* System-wise assessment */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">System Assessment (click to select findings)</label>
            <div className="space-y-3">
              {ASSESSMENT_SYSTEMS.map(sys => (
                <div key={sys.key} className="border rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-700 mb-1.5">{sys.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {sys.options.map(opt => {
                      const selected = (form.assessment[sys.key] || []).includes(opt);
                      return (
                        <button key={opt} onClick={() => toggleAssessment(sys.key, opt)}
                          className={`px-2 py-1 text-[10px] rounded-lg border transition-colors ${selected ? 'bg-blue-100 text-blue-700 border-blue-300 font-medium' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vitals summary */}
          <div><label className="text-xs text-gray-500">Vitals summary (or note 'see ICU chart')</label>
            <input type="text" value={form.vitals_summary} onChange={e => setForm(f => ({ ...f, vitals_summary: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="BP stable 110-130/70-80, HR 72-88, SpO2 97-99% on RA" /></div>

          {/* Interventions */}
          <div><label className="text-xs text-gray-500">Interventions performed</label>
            <textarea value={form.interventions} onChange={e => setForm(f => ({ ...f, interventions: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Wound dressing changed, RT aspiration done, Position changed Q2H..." /></div>

          {/* Medications given */}
          <div><label className="text-xs text-gray-500">Key medications given this shift</label>
            <input type="text" value={form.medications_given} onChange={e => setForm(f => ({ ...f, medications_given: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="All medications given as per MAR / Note exceptions..." /></div>

          {/* I/O */}
          <div><label className="text-xs text-gray-500">I/O summary</label>
            <input type="text" value={form.io_summary} onChange={e => setForm(f => ({ ...f, io_summary: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Intake 1200ml, Output 900ml, Balance +300ml" /></div>

          {/* Patient response */}
          <div><label className="text-xs text-gray-500">Patient response / condition</label>
            <textarea value={form.patient_response} onChange={e => setForm(f => ({ ...f, patient_response: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Patient comfortable, tolerating oral feeds, ambulating with support..." /></div>

          {/* Safety checks */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Safety checks</label>
            <div className="flex flex-wrap gap-3">
              {[['fall_risk_assessed', 'Fall risk assessed'], ['pressure_area_checked', 'Pressure areas checked'], ['restraints_checked', 'Restraints checked (if applicable)'], ['id_band_verified', 'ID band verified'], ['allergy_band_checked', 'Allergy band checked']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={(form.safety_checks as any)[k]}
                    onChange={e => setForm(f => ({ ...f, safety_checks: { ...f.safety_checks, [k]: e.target.checked } }))} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Education */}
          <div><label className="text-xs text-gray-500">Patient/family education given</label>
            <input type="text" value={form.education_given} onChange={e => setForm(f => ({ ...f, education_given: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Deep breathing exercises, diet instructions, medication timing..." /></div>

          {/* Escalation */}
          <div className="border-l-4 border-red-400 pl-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.escalation_needed} onChange={e => setForm(f => ({ ...f, escalation_needed: e.target.checked }))} />
              <span className="text-red-600 font-medium">Escalation / concern to report</span>
            </label>
            {form.escalation_needed && (
              <textarea value={form.escalation_details} onChange={e => setForm(f => ({ ...f, escalation_details: e.target.value }))}
                rows={2} className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm mt-1.5" placeholder="Describe concern and who was notified..." />
            )}
          </div>

          {/* Handover */}
          <div className="bg-orange-50 rounded-lg p-3">
            <label className="text-xs font-medium text-orange-700 mb-1.5 block">Shift Handover Notes</label>
            <textarea value={form.handover_notes} onChange={e => setForm(f => ({ ...f, handover_notes: e.target.value }))}
              rows={3} className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm bg-white" placeholder="Key items for incoming shift: pending labs, medication changes, family concerns, planned procedures..." />
          </div>

          <button onClick={saveNote} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Save Shift Note</button>
        </div>
      )}

      {/* Notes history */}
      {loading ? <div className="text-center py-6 text-gray-400 text-sm">Loading...</div> :
      notes.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No nursing notes documented</div> :
      <div className="space-y-3">{notes.map((n: any) => (
        <div key={n.id} className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${shiftColor(n.shift)}`}>{n.shift}</span>
            <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-xs text-gray-500">Nurse {n.nurse?.full_name}</span>
          </div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{n.note}</pre>
        </div>
      ))}</div>}
    </div>
  );
}
