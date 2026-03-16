// components/ipd/discharge-engine.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { openPrintWindow } from '@/components/ui/shared';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

interface Props {
  admissionId: string; patientId: string; staffId: string;
  admission: any; onFlash: (m: string) => void;
}

interface JourneyData {
  rounds: any[]; meds: any[]; activeMeds: any[]; procedures: any[];
  labResults: any[]; radiology: any[]; vitals: any[];
  ioSummary: any; consents: any[];
}

const CONDITION_OPTIONS = ['Improved','Stable','Unchanged','Deteriorated','Guarded','Referred'];
const DIET_OPTIONS = ['Normal diet','Soft diet','Liquid diet','Diabetic diet','Cardiac diet (low salt)','High protein diet','Renal diet','Bland diet','NPO instructions given'];
const ACTIVITY_OPTIONS = ['Ambulatory','Walking with support','Wheelchair','Bed rest','Gradual mobilization','Physiotherapy to continue','Restricted activity'];
const WOUND_OPTIONS = ['No surgical wound','Clean and dry','Sutures/staples in situ — removal on follow-up','Dressing changed','Wound care instructions given'];
const FOLLOWUP_OPTIONS = ['1 week','2 weeks','1 month','6 weeks','3 months','6 months','As needed','Emergency if symptoms worsen'];

export default function DischargeEngine({ admissionId, patientId, staffId, admission, onFlash }: Props) {
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1=Review Journey, 2=Edit Summary, 3=Preview & Print

  // Discharge summary form (auto-populated)
  const [ds, setDS] = useState({
    // Auto-pulled
    admissionDate: '', dischargeDate: new Date().toISOString().split('T')[0],
    admittingDiagnosis: '', finalDiagnosis: '', icdCodes: '',
    hospitalCourse: '', // Auto-generated from rounds
    proceduresDone: '', // Auto-generated from procedures
    investigationSummary: '', // Auto-generated from labs + radiology
    // Editable
    conditionAtDischarge: 'Improved',
    dischargeMeds: [] as { drug: string; dose: string; route: string; frequency: string; duration: string; instructions: string }[],
    dietAdvice: [] as string[],
    activityAdvice: [] as string[],
    woundCare: [] as string[],
    followUp: [] as { department: string; doctor: string; date: string; instructions: string }[],
    warningSignsToWatch: [] as string[],
    specialInstructions: '',
    dischargeType: 'normal',
  });

  // Load ENTIRE patient journey
  const loadJourney = useCallback(async () => {
    if (!admissionId || !sb()) return;
    setLoading(true);

    const [roundsRes, medsRes, procsRes, labsRes, radRes, vitalsRes, ioRes, consentsRes] = await Promise.all([
      sb().from('hmis_doctor_rounds').select('*, doctor:hmis_staff!hmis_doctor_rounds_doctor_id_fkey(full_name)').eq('admission_id', admissionId).order('round_date', { ascending: true }),
      sb().from('hmis_ipd_medication_orders').select('*').eq('admission_id', admissionId).order('start_date'),
      sb().from('hmis_procedural_notes').select('*, doctor:hmis_staff!hmis_procedural_notes_performed_by_fkey(full_name)').eq('admission_id', admissionId).order('procedure_date'),
      sb().from('hmis_lab_orders').select('*, test:hmis_lab_test_master(test_code, test_name), results:hmis_lab_results(parameter_name, result_value, unit, is_abnormal, is_critical)').eq('patient_id', patientId).gte('created_at', admission?.admission_date || '2020-01-01').order('created_at'),
      sb().from('hmis_radiology_orders').select('*, test:hmis_radiology_test_master(test_code, test_name)').eq('patient_id', patientId).gte('created_at', admission?.admission_date || '2020-01-01').order('created_at'),
      sb().from('hmis_icu_charts').select('hr, bp_sys, bp_dia, spo2, temp, rr, recorded_at').eq('admission_id', admissionId).order('recorded_at', { ascending: false }).limit(10),
      sb().from('hmis_io_chart').select('shift, total_intake, total_output, balance, recorded_date').eq('admission_id', admissionId).order('recorded_date', { ascending: false }).limit(7),
      sb().from('hmis_consents').select('consent_type, procedure_name, consent_given').eq('admission_id', admissionId),
    ]);

    const rounds = roundsRes.data || [];
    const meds = medsRes.data || [];
    const activeMeds = meds.filter((m: any) => m.status === 'active');

    const j: JourneyData = {
      rounds, meds, activeMeds,
      procedures: procsRes.data || [],
      labResults: labsRes.data || [],
      radiology: radRes.data || [],
      vitals: vitalsRes.data || [],
      ioSummary: ioRes.data || [],
      consents: consentsRes.data || [],
    };
    setJourney(j);

    // Auto-populate discharge summary
    const admDx = admission?.provisional_diagnosis || '';
    const finalDx = admission?.final_diagnosis || rounds[rounds.length - 1]?.assessment || admDx;

    // Build hospital course from rounds
    const courseLines = rounds.map((r: any) => {
      const date = new Date(r.round_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      return `${date} (${r.round_type}): ${r.assessment || ''} ${r.plan ? '→ ' + r.plan : ''}`;
    });

    // Build investigation summary
    const labSummary = (labsRes.data || []).filter((l: any) => l.results?.length > 0).map((l: any) => {
      const abnormal = l.results.filter((r: any) => r.is_abnormal || r.is_critical);
      const date = new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      if (abnormal.length === 0) return `${l.test?.test_name} (${date}): WNL`;
      return `${l.test?.test_name} (${date}): ${abnormal.map((r: any) => `${r.parameter_name} ${r.result_value}${r.is_critical ? ' !!!' : '*'}`).join(', ')}`;
    });

    const radSummary = (radRes.data || []).map((r: any) => {
      const date = new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      return `${r.test?.test_name} (${date}): ${r.findings || r.impression || 'Done'}`;
    });

    const procSummary = (procsRes.data || []).map((p: any) => {
      const date = new Date(p.procedure_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      return `${p.procedure_name} (${date}) — ${p.findings || 'Uneventful'}${p.complications ? ' | Complications: ' + p.complications : ''}`;
    });

    // Build discharge meds from active meds
    const dMeds = activeMeds.map((m: any) => ({
      drug: m.drug_name, dose: m.dose, route: m.route, frequency: m.frequency,
      duration: '7 days', instructions: m.prn_instruction || '',
    }));

    setDS(prev => ({
      ...prev,
      admissionDate: admission?.admission_date ? new Date(admission.admission_date).toLocaleDateString('en-IN') : '',
      admittingDiagnosis: admDx,
      finalDiagnosis: finalDx,
      hospitalCourse: courseLines.join('\n'),
      proceduresDone: procSummary.join('\n') || 'None',
      investigationSummary: [...labSummary, ...radSummary].join('\n') || 'Routine investigations done',
      dischargeMeds: dMeds,
      warningSignsToWatch: getWarningSignsForDiagnosis(admDx),
    }));

    setLoading(false);
  }, [admissionId, patientId, admission]);

  useEffect(() => { loadJourney(); }, [loadJourney]);

  // Toggle helpers
  const toggleArr = (arr: string[], item: string) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  const updateMed = (idx: number, field: string, val: string) => {
    const m = [...ds.dischargeMeds]; (m[idx] as any)[field] = val; setDS(prev => ({ ...prev, dischargeMeds: m }));
  };
  const removeMed = (idx: number) => setDS(prev => ({ ...prev, dischargeMeds: prev.dischargeMeds.filter((_, i) => i !== idx) }));
  const addMed = () => setDS(prev => ({ ...prev, dischargeMeds: [...prev.dischargeMeds, { drug: '', dose: '', route: 'oral', frequency: 'OD', duration: '7 days', instructions: '' }] }));
  const addFollowUp = () => setDS(prev => ({ ...prev, followUp: [...prev.followUp, { department: admission?.department?.name || '', doctor: admission?.doctor?.full_name || '', date: '', instructions: '' }] }));

  const pt = admission?.patient;

  // ===== PRINT DISCHARGE SUMMARY =====
  const printDischargeSummary = () => {
    const medsTable = ds.dischargeMeds.map((m, i) => `<tr><td style="padding:4px 8px;border:1px solid #ddd">${i+1}</td><td style="padding:4px 8px;border:1px solid #ddd;font-weight:600">${m.drug}</td><td style="padding:4px 8px;border:1px solid #ddd">${m.dose}</td><td style="padding:4px 8px;border:1px solid #ddd">${m.route}</td><td style="padding:4px 8px;border:1px solid #ddd">${m.frequency}</td><td style="padding:4px 8px;border:1px solid #ddd">${m.duration}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:9px">${m.instructions}</td></tr>`).join('');

    const followUpRows = ds.followUp.map(f => `<tr><td style="padding:4px 8px;border:1px solid #ddd">${f.department}</td><td style="padding:4px 8px;border:1px solid #ddd">${f.doctor}</td><td style="padding:4px 8px;border:1px solid #ddd">${f.date}</td><td style="padding:4px 8px;border:1px solid #ddd">${f.instructions}</td></tr>`).join('');

    const section = (title: string, content: string) => content ? `<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#1e40af;border-bottom:1px solid #1e40af;padding-bottom:2px;margin-bottom:4px">${title}</div><div style="font-size:10px;white-space:pre-line">${content}</div></div>` : '';

    openPrintWindow(`<div style="max-width:700px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e40af;padding-bottom:10px;margin-bottom:10px">
        <div><div style="font-size:18px;font-weight:700;color:#1e40af">Health1 Super Speciality Hospital</div><div style="font-size:8px;color:#666">Shilaj, Ahmedabad | NABH Accredited</div></div>
        <div style="text-align:right"><div style="font-size:14px;font-weight:700;color:#1e40af">DISCHARGE SUMMARY</div><div style="font-size:8px;color:#666">${new Date().toLocaleDateString('en-IN')}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px">
        <div><b>Patient:</b> ${pt?.first_name} ${pt?.last_name}</div><div><b>UHID:</b> ${pt?.uhid}</div>
        <div><b>Age/Sex:</b> ${pt?.age_years}yr / ${pt?.gender}</div><div><b>IPD No:</b> ${admission?.ipd_number}</div>
        <div><b>Admitted:</b> ${ds.admissionDate}</div><div><b>Discharged:</b> ${ds.dischargeDate}</div>
        <div><b>Department:</b> ${admission?.department?.name}</div><div><b>Consultant:</b> Dr. ${admission?.doctor?.full_name}</div>
        <div><b>Blood Group:</b> ${pt?.blood_group || '—'}</div><div><b>Discharge Type:</b> ${ds.dischargeType}</div>
      </div>
      ${section('ADMITTING DIAGNOSIS', ds.admittingDiagnosis)}
      ${section('FINAL DIAGNOSIS', ds.finalDiagnosis)}
      ${section('HOSPITAL COURSE', ds.hospitalCourse)}
      ${section('PROCEDURES PERFORMED', ds.proceduresDone)}
      ${section('INVESTIGATION SUMMARY', ds.investigationSummary)}
      <div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#1e40af;border-bottom:1px solid #1e40af;padding-bottom:2px;margin-bottom:4px">CONDITION AT DISCHARGE</div><div style="font-size:11px;font-weight:600">${ds.conditionAtDischarge}</div></div>
      ${ds.dischargeMeds.length > 0 ? `<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#1e40af;border-bottom:1px solid #1e40af;padding-bottom:2px;margin-bottom:4px">DISCHARGE MEDICATIONS</div>
        <table style="width:100%;border-collapse:collapse;font-size:9px"><thead><tr style="background:#eff6ff"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">#</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Medication</th><th style="padding:4px 8px;border:1px solid #ddd">Dose</th><th style="padding:4px 8px;border:1px solid #ddd">Route</th><th style="padding:4px 8px;border:1px solid #ddd">Frequency</th><th style="padding:4px 8px;border:1px solid #ddd">Duration</th><th style="padding:4px 8px;border:1px solid #ddd">Instructions</th></tr></thead><tbody>${medsTable}</tbody></table></div>` : ''}
      ${ds.dietAdvice.length > 0 ? section('DIET ADVICE', ds.dietAdvice.join(', ')) : ''}
      ${ds.activityAdvice.length > 0 ? section('ACTIVITY ADVICE', ds.activityAdvice.join(', ')) : ''}
      ${ds.woundCare.length > 0 ? section('WOUND CARE', ds.woundCare.join(', ')) : ''}
      ${ds.warningSignsToWatch.length > 0 ? `<div style="margin-bottom:12px;padding:8px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px"><div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:4px">WARNING SIGNS — RETURN TO HOSPITAL IF:</div><div style="font-size:10px">${ds.warningSignsToWatch.map(w => '• ' + w).join('<br/>')}</div></div>` : ''}
      ${ds.specialInstructions ? section('SPECIAL INSTRUCTIONS', ds.specialInstructions) : ''}
      ${ds.followUp.length > 0 ? `<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#1e40af;border-bottom:1px solid #1e40af;padding-bottom:2px;margin-bottom:4px">FOLLOW-UP</div>
        <table style="width:100%;border-collapse:collapse;font-size:9px"><thead><tr style="background:#eff6ff"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Department</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Doctor</th><th style="padding:4px 8px;border:1px solid #ddd">Date</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Instructions</th></tr></thead><tbody>${followUpRows}</tbody></table></div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb">
        <div style="text-align:center;font-size:9px;color:#666"><div style="width:150px;border-bottom:1px solid #333;margin-bottom:4px"></div>Resident Doctor</div>
        <div style="text-align:center;font-size:9px;color:#666"><div style="width:150px;border-bottom:1px solid #333;margin-bottom:4px"></div>Dr. ${admission?.doctor?.full_name}<br/>${admission?.department?.name}</div>
      </div>
      <div style="margin-top:15px;font-size:7px;color:#aaa;text-align:center">This is a computer-generated Discharge Summary. Health1 Super Speciality Hospital — Quality Healthcare for All</div>
    </div>`, `Discharge Summary — ${pt?.uhid} — ${admission?.ipd_number}`);
  };

  // Save discharge summary to admission
  const saveAndDischarge = async () => {
    if (!sb()) return;
    await sb().from('hmis_admissions').update({
      actual_discharge: new Date().toISOString(),
      discharge_type: ds.dischargeType,
      final_diagnosis: ds.finalDiagnosis,
      status: 'discharged',
    }).eq('id', admissionId);
    // Free the bed
    if (admission?.bed_id) {
      await sb().from('hmis_beds').update({ status: 'housekeeping', current_admission_id: null }).eq('id', admission.bed_id);
    }
    onFlash('Patient discharged successfully');
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading patient journey...</div>;

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-4">
        {[['1','Review Journey'],['2','Edit Summary'],['3','Preview & Print']].map(([n, l]) => (
          <button key={n} onClick={() => setStep(parseInt(n))} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${step === parseInt(n) ? 'bg-blue-600 text-white' : step > parseInt(n) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold">{step > parseInt(n) ? '✓' : n}</span>{l}
          </button>
        ))}
      </div>

      {/* ===== STEP 1: REVIEW JOURNEY ===== */}
      {step === 1 && journey && <div className="space-y-3">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-2 text-blue-700">Rounds ({journey.rounds.length})</h3>
          {journey.rounds.map((r: any, i: number) => (
            <div key={r.id} className="border-l-2 border-blue-200 pl-3 mb-2 text-xs">
              <span className="font-medium">{new Date(r.round_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })} ({r.round_type})</span>
              <span className="text-gray-400 ml-2">Dr. {r.doctor?.full_name}</span>
              {r.assessment && <div className="text-gray-600 mt-0.5"><b>A:</b> {r.assessment}</div>}
              {r.plan && <div className="text-gray-500"><b>P:</b> {r.plan}</div>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-2 text-green-700">Active Medications ({journey.activeMeds.length})</h3>
            {journey.activeMeds.map((m: any) => <div key={m.id} className="text-xs py-1 border-b last:border-0">{m.drug_name} {m.dose} {m.route} {m.frequency}</div>)}
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-2 text-purple-700">Procedures ({journey.procedures.length})</h3>
            {journey.procedures.length === 0 ? <div className="text-xs text-gray-400">None</div> :
            journey.procedures.map((p: any) => <div key={p.id} className="text-xs py-1 border-b last:border-0">{p.procedure_name} — {new Date(p.procedure_date).toLocaleDateString('en-IN')}</div>)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-2 text-orange-700">Lab Results ({journey.labResults.length})</h3>
            {journey.labResults.slice(0, 10).map((l: any) => {
              const abn = (l.results || []).filter((r: any) => r.is_abnormal || r.is_critical);
              return <div key={l.id} className="text-xs py-1 border-b last:border-0">
                {l.test?.test_name} {abn.length > 0 && <span className="text-red-600 font-medium">({abn.length} abnormal)</span>}
              </div>;
            })}
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-2 text-teal-700">Radiology ({journey.radiology.length})</h3>
            {journey.radiology.length === 0 ? <div className="text-xs text-gray-400">None</div> :
            journey.radiology.map((r: any) => <div key={r.id} className="text-xs py-1 border-b last:border-0">{r.test?.test_name}</div>)}
          </div>
        </div>

        <button onClick={() => setStep(2)} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">Proceed to Edit Summary →</button>
      </div>}

      {/* ===== STEP 2: EDIT SUMMARY ===== */}
      {step === 2 && <div className="space-y-3">
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 font-medium">Discharge date</label>
              <input type="date" value={ds.dischargeDate} onChange={e => setDS(p => ({...p, dischargeDate: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 font-medium">Discharge type</label>
              <select value={ds.dischargeType} onChange={e => setDS(p => ({...p, dischargeType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['normal','lama','dor','absconded','death','transfer'].map(t => <option key={t}>{t.toUpperCase()}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-gray-500 font-medium">Final Diagnosis</label>
            <textarea value={ds.finalDiagnosis} onChange={e => setDS(p => ({...p, finalDiagnosis: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500 font-medium">Hospital Course (auto-generated from rounds — edit as needed)</label>
            <textarea value={ds.hospitalCourse} onChange={e => setDS(p => ({...p, hospitalCourse: e.target.value}))} rows={6} className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-xs" /></div>
          <div><label className="text-xs text-gray-500 font-medium">Procedures Performed</label>
            <textarea value={ds.proceduresDone} onChange={e => setDS(p => ({...p, proceduresDone: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500 font-medium">Investigation Summary</label>
            <textarea value={ds.investigationSummary} onChange={e => setDS(p => ({...p, investigationSummary: e.target.value}))} rows={4} className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-xs" /></div>
        </div>

        {/* Condition */}
        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs text-gray-500 font-medium mb-2 block">Condition at Discharge</label>
          <div className="flex flex-wrap gap-2">{CONDITION_OPTIONS.map(c => (
            <button key={c} onClick={() => setDS(p => ({...p, conditionAtDischarge: c}))}
              className={`px-3 py-1.5 rounded-lg text-xs border ${ds.conditionAtDischarge === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>{c}</button>
          ))}</div>
        </div>

        {/* Discharge Meds */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-gray-500 font-medium">Discharge Medications ({ds.dischargeMeds.length})</label>
            <button onClick={addMed} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">+ Add Med</button>
          </div>
          {ds.dischargeMeds.map((m, i) => (
            <div key={i} className="grid grid-cols-7 gap-1.5 mb-1.5 items-center">
              <input value={m.drug} onChange={e => updateMed(i, 'drug', e.target.value)} className="col-span-2 px-2 py-1 border rounded text-xs" placeholder="Drug" />
              <input value={m.dose} onChange={e => updateMed(i, 'dose', e.target.value)} className="px-2 py-1 border rounded text-xs" placeholder="Dose" />
              <select value={m.route} onChange={e => updateMed(i, 'route', e.target.value)} className="px-1 py-1 border rounded text-xs">
                {['oral','iv','sc','sl','topical','inhalation'].map(r => <option key={r}>{r}</option>)}</select>
              <input value={m.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} className="px-2 py-1 border rounded text-xs" placeholder="Freq" />
              <input value={m.duration} onChange={e => updateMed(i, 'duration', e.target.value)} className="px-2 py-1 border rounded text-xs" placeholder="Duration" />
              <button onClick={() => removeMed(i)} className="text-red-500 text-xs hover:text-red-700 text-center">✕</button>
            </div>
          ))}
        </div>

        {/* Click-based advice sections */}
        {[['Diet Advice', DIET_OPTIONS, 'dietAdvice'], ['Activity Advice', ACTIVITY_OPTIONS, 'activityAdvice'], ['Wound Care', WOUND_OPTIONS, 'woundCare']].map(([title, options, key]) => (
          <div key={key as string} className="bg-white rounded-xl border p-4">
            <label className="text-xs text-gray-500 font-medium mb-2 block">{title as string}</label>
            <div className="flex flex-wrap gap-1.5">{(options as string[]).map(o => (
              <button key={o} onClick={() => setDS(p => ({...p, [key as string]: toggleArr((p as any)[key as string], o)}))}
                className={`px-2.5 py-1 rounded-lg text-[11px] border ${(ds as any)[key as string].includes(o) ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-500 border-gray-200'}`}>{o}</button>
            ))}</div>
          </div>
        ))}

        {/* Warning signs */}
        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs text-gray-500 font-medium mb-2 block">Warning Signs to Watch</label>
          <div className="flex flex-wrap gap-1.5">{getCommonWarnings().map(w => (
            <button key={w} onClick={() => setDS(p => ({...p, warningSignsToWatch: toggleArr(p.warningSignsToWatch, w)}))}
              className={`px-2.5 py-1 rounded-lg text-[11px] border ${ds.warningSignsToWatch.includes(w) ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-gray-500 border-gray-200'}`}>{w}</button>
          ))}</div>
        </div>

        {/* Follow-up */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-gray-500 font-medium">Follow-Up Appointments</label>
            <button onClick={addFollowUp} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">+ Add</button>
          </div>
          {ds.followUp.map((f, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 mb-2">
              <input value={f.department} onChange={e => { const fu = [...ds.followUp]; fu[i].department = e.target.value; setDS(p => ({...p, followUp: fu})); }} className="px-2 py-1 border rounded text-xs" placeholder="Dept" />
              <input value={f.doctor} onChange={e => { const fu = [...ds.followUp]; fu[i].doctor = e.target.value; setDS(p => ({...p, followUp: fu})); }} className="px-2 py-1 border rounded text-xs" placeholder="Doctor" />
              <input type="date" value={f.date} onChange={e => { const fu = [...ds.followUp]; fu[i].date = e.target.value; setDS(p => ({...p, followUp: fu})); }} className="px-2 py-1 border rounded text-xs" />
              <input value={f.instructions} onChange={e => { const fu = [...ds.followUp]; fu[i].instructions = e.target.value; setDS(p => ({...p, followUp: fu})); }} className="px-2 py-1 border rounded text-xs" placeholder="Instructions" />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs text-gray-500 font-medium">Special Instructions</label>
          <textarea value={ds.specialInstructions} onChange={e => setDS(p => ({...p, specialInstructions: e.target.value}))} rows={2} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Any additional instructions for the patient..." />
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep(1)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm">← Back</button>
          <button onClick={() => setStep(3)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">Preview & Print →</button>
        </div>
      </div>}

      {/* ===== STEP 3: PREVIEW & PRINT ===== */}
      {step === 3 && <div className="space-y-3">
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-center text-lg font-bold text-blue-800 mb-1">DISCHARGE SUMMARY</h2>
          <p className="text-center text-xs text-gray-400 mb-4">Health1 Super Speciality Hospital, Shilaj, Ahmedabad</p>

          <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-lg mb-4">
            <div><b>Patient:</b> {pt?.first_name} {pt?.last_name}</div><div><b>UHID:</b> {pt?.uhid}</div>
            <div><b>IPD:</b> {admission?.ipd_number}</div><div><b>Age/Sex:</b> {pt?.age_years}yr / {pt?.gender}</div>
            <div><b>Admitted:</b> {ds.admissionDate}</div><div><b>Discharged:</b> {ds.dischargeDate}</div>
            <div><b>Department:</b> {admission?.department?.name}</div><div><b>Consultant:</b> Dr. {admission?.doctor?.full_name}</div>
          </div>

          {[['Final Diagnosis', ds.finalDiagnosis], ['Hospital Course', ds.hospitalCourse], ['Procedures', ds.proceduresDone], ['Investigations', ds.investigationSummary]].map(([t, v]) => v && (
            <div key={t} className="mb-3"><h4 className="text-xs font-bold text-blue-700 border-b border-blue-200 pb-0.5 mb-1">{t}</h4><p className="text-xs whitespace-pre-line">{v}</p></div>
          ))}

          <div className="mb-3"><h4 className="text-xs font-bold text-blue-700 border-b border-blue-200 pb-0.5 mb-1">Condition at Discharge</h4><p className="text-xs font-semibold">{ds.conditionAtDischarge}</p></div>

          {ds.dischargeMeds.length > 0 && <div className="mb-3"><h4 className="text-xs font-bold text-blue-700 border-b border-blue-200 pb-0.5 mb-1">Discharge Medications</h4>
            <table className="w-full text-[10px] border"><tbody>{ds.dischargeMeds.map((m, i) => (
              <tr key={i} className="border-b"><td className="p-1 font-medium">{i+1}. {m.drug} {m.dose}</td><td className="p-1">{m.route}</td><td className="p-1">{m.frequency}</td><td className="p-1">{m.duration}</td></tr>
            ))}</tbody></table></div>}

          {ds.dietAdvice.length > 0 && <div className="mb-2"><b className="text-xs text-blue-700">Diet:</b> <span className="text-xs">{ds.dietAdvice.join(', ')}</span></div>}
          {ds.activityAdvice.length > 0 && <div className="mb-2"><b className="text-xs text-blue-700">Activity:</b> <span className="text-xs">{ds.activityAdvice.join(', ')}</span></div>}
          {ds.woundCare.length > 0 && <div className="mb-2"><b className="text-xs text-blue-700">Wound Care:</b> <span className="text-xs">{ds.woundCare.join(', ')}</span></div>}

          {ds.warningSignsToWatch.length > 0 && <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
            <b className="text-xs text-red-700">Warning Signs — Return if:</b>
            <ul className="text-[10px] text-red-700 mt-1">{ds.warningSignsToWatch.map(w => <li key={w}>• {w}</li>)}</ul>
          </div>}

          {ds.followUp.length > 0 && <div className="mb-3"><b className="text-xs text-blue-700">Follow-Up:</b>
            {ds.followUp.map((f, i) => <div key={i} className="text-xs ml-2">• {f.department} — Dr. {f.doctor} — {f.date} {f.instructions && `(${f.instructions})`}</div>)}</div>}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep(2)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm">← Edit</button>
          <button onClick={printDischargeSummary} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">Print Discharge Summary</button>
          <button onClick={saveAndDischarge} className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Discharge Patient ✓</button>
        </div>
      </div>}
    </div>
  );
}

// Diagnosis-driven warning signs
function getWarningSignsForDiagnosis(dx: string): string[] {
  const d = dx.toLowerCase();
  const signs: string[] = [];
  if (d.includes('stemi') || d.includes('mi') || d.includes('cardiac') || d.includes('angina') || d.includes('ptca')) signs.push('Chest pain or tightness', 'Severe breathlessness', 'Excessive sweating', 'Dizziness or fainting');
  if (d.includes('stroke') || d.includes('mca') || d.includes('infarct') || d.includes('hemipar')) signs.push('New weakness in arms or legs', 'Slurred speech or confusion', 'Sudden severe headache', 'Visual disturbance');
  if (d.includes('surgery') || d.includes('cholecystectomy') || d.includes('tkr') || d.includes('lap')) signs.push('Fever >101°F', 'Wound redness/discharge/swelling', 'Increasing pain not relieved by medication', 'Persistent nausea or vomiting');
  if (d.includes('copd') || d.includes('respiratory') || d.includes('pneumonia')) signs.push('Worsening breathlessness', 'Fever >101°F', 'Change in sputum color/amount', 'Chest tightness');
  if (d.includes('dka') || d.includes('diabet')) signs.push('Blood sugar >300 or <70 mg/dL', 'Excessive thirst and urination', 'Nausea/vomiting/abdominal pain', 'Drowsiness or confusion');
  if (d.includes('gi bleed') || d.includes('ulcer') || d.includes('hematemesis')) signs.push('Blood in vomit or black stools', 'Dizziness or fainting', 'Severe abdominal pain', 'Persistent nausea');
  if (signs.length === 0) signs.push('High fever (>101°F)', 'Severe pain not relieved by medication', 'Breathlessness at rest', 'Any sudden change in condition');
  return signs;
}

function getCommonWarnings(): string[] {
  return [
    'High fever (>101°F)', 'Severe pain not relieved by medication', 'Breathlessness at rest',
    'Chest pain or tightness', 'Severe breathlessness', 'Excessive sweating',
    'Blood in vomit or black stools', 'New weakness in arms or legs', 'Slurred speech or confusion',
    'Wound redness/discharge/swelling', 'Persistent nausea or vomiting', 'Blood sugar >300 or <70',
    'Excessive thirst and urination', 'Dizziness or fainting', 'Sudden severe headache',
    'Swelling in legs or feet', 'Change in consciousness', 'Any sudden change in condition',
  ];
}
