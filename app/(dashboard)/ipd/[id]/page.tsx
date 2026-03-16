'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import { useDoctorRounds, useICUChart, useICUScores, useIOChart, useMedicationOrders, useMAR, useConsents, useProceduralNotes } from '@/lib/ipd/clinical-hooks';
import NursingShiftNotes from '@/components/ipd/nursing-shift-notes';
import VitalsTrendChart from '@/components/ipd/vitals-trend-chart';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type ClinicalTab = 'rounds' | 'icu' | 'trends' | 'io' | 'meds' | 'mar' | 'scores' | 'consents' | 'procedures' | 'nursing';

export default function IPDClinicalPage() {
  const { id } = useParams();
  const admissionId = id as string;
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const [admission, setAdmission] = useState<any>(null);
  const [tab, setTab] = useState<ClinicalTab>('rounds');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Load admission details
  useEffect(() => {
    if (!admissionId || !sb()) return;
    sb().from('hmis_admissions')
      .select('*, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, blood_group, phone_primary), department:hmis_departments!inner(name), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
      .eq('id', admissionId).single()
      .then(({ data }: any) => setAdmission(data));
  }, [admissionId]);

  // Hooks
  const rounds = useDoctorRounds(admissionId);
  const icu = useICUChart(admissionId);
  const scores = useICUScores(admissionId);
  const io = useIOChart(admissionId);
  const meds = useMedicationOrders(admissionId);
  const mar = useMAR(admissionId);
  const consents = useConsents(admissionId, admission?.patient?.id);
  const procedures = useProceduralNotes(admissionId);

  // ===== FORM STATES =====
  // Rounds
  const [rForm, setRForm] = useState({ roundType: 'routine', subjective: '', objective: '', assessment: '', plan: '', dietInstruction: '', activityLevel: '', codeStatus: '' });
  // ICU
  const [icuForm, setIcuForm] = useState<any>({ hr: '', bp_sys: '', bp_dia: '', rr: '', spo2: '', temp: '', ventilator_mode: '', fio2: '', peep: '', gcs_eye: '', gcs_verbal: '', gcs_motor: '', rass: '', nursing_note: '' });
  // I/O
  const [ioForm, setIoForm] = useState({ shift: 'morning', oral_intake_ml: 0, iv_fluid_ml: 0, blood_products_ml: 0, ryles_tube_ml: 0, other_intake_ml: 0, urine_ml: 0, drain_1_ml: 0, drain_2_ml: 0, ryles_aspirate_ml: 0, vomit_ml: 0, stool_count: 0, other_output_ml: 0 });
  // Meds
  const [medForm, setMedForm] = useState({ drugName: '', genericName: '', dose: '', route: 'oral', frequency: 'OD', isStat: false, isPrn: false, specialInstructions: '' });
  // Consent
  const [conForm, setConForm] = useState({ consentType: 'general', procedureName: '', risksExplained: '', witnessName: '', witnessRelation: '' });
  // Procedure
  const [procForm, setProcForm] = useState({ procedureType: 'central_line', procedureName: '', indication: '', site: '', laterality: 'na', technique: '', findings: '', complications: '' });
  // Score
  const [scoreForm, setScoreForm] = useState({ scoreType: 'gcs', scoreValue: 0, interpretation: '' });

  // Show forms
  const [showForm, setShowForm] = useState(false);

  if (!admission) return <div className="text-center py-12 text-gray-400">Loading admission...</div>;
  const pt = admission.patient;
  const patientName = pt.first_name + ' ' + (pt.last_name || '');
  const daysSince = Math.ceil((Date.now() - new Date(admission.admission_date).getTime()) / 86400000);

  const tabs: [ClinicalTab, string][] = [
    ['rounds', 'Rounds'], ['icu', 'ICU Chart'], ['trends', 'Vitals Trend'], ['io', 'I/O Chart'], ['meds', 'Med Orders'],
    ['mar', 'MAR'], ['scores', 'ICU Scores'], ['consents', 'Consents'], ['procedures', 'Procedures'], ['nursing', 'Nursing']
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Patient header */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">{pt.first_name?.charAt(0)}{pt.last_name?.charAt(0)}</div>
            <div>
              <h1 className="text-xl font-bold">{patientName}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{admission.ipd_number}</span>
                <span>{pt.uhid}</span><span>{pt.age_years}yr/{pt.gender?.charAt(0).toUpperCase()}</span>
                {pt.blood_group && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{pt.blood_group}</span>}
                <span>Day {daysSince}</span>
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{admission.department?.name}</span>
                <span>Dr. {admission.doctor?.full_name}</span>
                <span className={`px-1.5 py-0.5 rounded ${admission.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{admission.status}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/emr-v2?patient=${pt.id}`} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100">EMR</Link>
            <Link href="/ipd" className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">Back to IPD</Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto border-b pb-px">
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setShowForm(false); }}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>)}
      </div>

      {/* ===== ROUNDS ===== */}
      {tab === 'rounds' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Doctor Rounds / Progress Notes</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Round'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Round type</label>
              <select value={rForm.roundType} onChange={e => setRForm(f => ({...f, roundType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['admission','routine','consultant','shift_handover','discharge'].map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Activity level</label>
              <select value={rForm.activityLevel} onChange={e => setRForm(f => ({...f, activityLevel: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>{['bed_rest','bed_rest_bsc','chair','ambulate','oob','rehab'].map(t => <option key={t}>{t.replace('_',' ')}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Code status</label>
              <select value={rForm.codeStatus} onChange={e => setRForm(f => ({...f, codeStatus: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>{['full_code','dnr','dni','comfort_only'].map(t => <option key={t}>{t.replace('_',' ').toUpperCase()}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-gray-500">Subjective (patient says)</label>
            <textarea value={rForm.subjective} onChange={e => setRForm(f => ({...f, subjective: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Patient complaints, symptoms, sleep quality, pain level..." /></div>
          <div><label className="text-xs text-gray-500">Objective (doctor finds)</label>
            <textarea value={rForm.objective} onChange={e => setRForm(f => ({...f, objective: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Exam findings, vitals summary, labs summary..." /></div>
          <div><label className="text-xs text-gray-500">Assessment</label>
            <textarea value={rForm.assessment} onChange={e => setRForm(f => ({...f, assessment: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Working diagnosis, clinical status, response to treatment..." /></div>
          <div><label className="text-xs text-gray-500">Plan</label>
            <textarea value={rForm.plan} onChange={e => setRForm(f => ({...f, plan: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Continue meds, add investigation, change dose, plan for discharge..." /></div>
          <div><label className="text-xs text-gray-500">Diet instruction</label>
            <input type="text" value={rForm.dietInstruction} onChange={e => setRForm(f => ({...f, dietInstruction: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Soft diet, low salt, NPO, clear liquids..." /></div>
          <button onClick={async () => { await rounds.addRound({ doctorId: staffId, ...rForm }); setShowForm(false); flash('Round saved'); setRForm({ roundType: 'routine', subjective: '', objective: '', assessment: '', plan: '', dietInstruction: '', activityLevel: '', codeStatus: '' }); }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Round</button>
        </div>}
        {rounds.loading ? <div className="text-center py-6 text-gray-400 text-sm">Loading...</div> :
        rounds.rounds.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No rounds documented</div> :
        <div className="space-y-3">{rounds.rounds.map((r: any) => (
          <div key={r.id} className={`bg-white rounded-xl border p-4 ${r.is_critical ? 'border-red-300 bg-red-50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.round_type === 'admission' ? 'bg-blue-100 text-blue-700' : r.round_type === 'discharge' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{r.round_type}</span>
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-xs text-gray-500">Dr. {r.doctor?.full_name}</span>
                {r.code_status && <span className={`text-xs px-1.5 py-0.5 rounded ${r.code_status === 'full_code' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.code_status.replace('_', ' ').toUpperCase()}</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {r.subjective && <div><span className="font-medium text-blue-600">S:</span> {r.subjective}</div>}
              {r.objective && <div><span className="font-medium text-green-600">O:</span> {r.objective}</div>}
              {r.assessment && <div><span className="font-medium text-orange-600">A:</span> {r.assessment}</div>}
              {r.plan && <div><span className="font-medium text-purple-600">P:</span> {r.plan}</div>}
            </div>
            {(r.diet_instruction || r.activity_level) && <div className="text-xs text-gray-500 mt-2">{r.diet_instruction && <span>Diet: {r.diet_instruction}</span>}{r.activity_level && <span className="ml-3">Activity: {r.activity_level}</span>}</div>}
          </div>
        ))}</div>}
      </div>}

      {/* ===== ICU CHART ===== */}
      {tab === 'icu' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">ICU Monitoring Chart</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Record Vitals'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4">
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[['hr','HR (bpm)'],['bp_sys','SBP'],['bp_dia','DBP'],['rr','RR'],['spo2','SpO2 %'],['temp','Temp °F'],['fio2','FiO2 %'],['peep','PEEP']].map(([k,l]) =>
              <div key={k}><label className="text-[10px] text-gray-500">{l}</label>
                <input type="number" value={icuForm[k]||''} onChange={e => setIcuForm((f: any) => ({...f, [k]: e.target.value ? parseFloat(e.target.value) : ''}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div><label className="text-[10px] text-gray-500">Vent mode</label>
              <select value={icuForm.ventilator_mode||''} onChange={e => setIcuForm((f: any) => ({...f, ventilator_mode: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm">
                <option value="">None</option>{['CMV','SIMV','PSV','CPAP','BiPAP','PRVC','APRV','HFNC','Room Air'].map(m => <option key={m}>{m}</option>)}</select></div>
            <div><label className="text-[10px] text-gray-500">GCS Eye (1-4)</label>
              <input type="number" min="1" max="4" value={icuForm.gcs_eye||''} onChange={e => setIcuForm((f: any) => ({...f, gcs_eye: parseInt(e.target.value)||''}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">GCS Verbal (1-5)</label>
              <input type="number" min="1" max="5" value={icuForm.gcs_verbal||''} onChange={e => setIcuForm((f: any) => ({...f, gcs_verbal: parseInt(e.target.value)||''}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">GCS Motor (1-6)</label>
              <input type="number" min="1" max="6" value={icuForm.gcs_motor||''} onChange={e => setIcuForm((f: any) => ({...f, gcs_motor: parseInt(e.target.value)||''}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="text-[10px] text-gray-500">RASS (-5 to +4)</label>
              <input type="number" min="-5" max="4" value={icuForm.rass||''} onChange={e => setIcuForm((f: any) => ({...f, rass: parseInt(e.target.value)||''}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Nursing note</label>
              <input type="text" value={icuForm.nursing_note||''} onChange={e => setIcuForm((f: any) => ({...f, nursing_note: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Brief note..." /></div>
          </div>
          <button onClick={async () => { const clean: any = {}; Object.entries(icuForm).forEach(([k,v]) => { if (v !== '' && v !== null) clean[k] = v; }); await icu.addEntry(clean, staffId); setShowForm(false); flash('ICU entry saved'); }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Entry</button>
        </div>}
        {icu.entries.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No ICU chart entries</div> :
        <div className="bg-white rounded-xl border overflow-x-auto"><table className="w-full text-xs whitespace-nowrap"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left text-gray-500">Time</th><th className="p-2">HR</th><th className="p-2">BP</th><th className="p-2">RR</th><th className="p-2">SpO2</th><th className="p-2">Temp</th><th className="p-2">Vent</th><th className="p-2">FiO2</th><th className="p-2">GCS</th><th className="p-2">RASS</th><th className="p-2 text-left">Note</th>
        </tr></thead><tbody>{icu.entries.map((e: any) => (
          <tr key={e.id} className="border-b hover:bg-gray-50">
            <td className="p-2 text-gray-500">{new Date(e.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
            <td className="p-2 text-center">{e.hr || '—'}</td>
            <td className="p-2 text-center">{e.bp_sys && e.bp_dia ? `${e.bp_sys}/${e.bp_dia}` : '—'}</td>
            <td className="p-2 text-center">{e.rr || '—'}</td>
            <td className="p-2 text-center">{e.spo2 || '—'}</td>
            <td className="p-2 text-center">{e.temp || '—'}</td>
            <td className="p-2 text-center">{e.ventilator_mode || '—'}</td>
            <td className="p-2 text-center">{e.fio2 || '—'}</td>
            <td className="p-2 text-center font-bold">{e.gcs_total || '—'}</td>
            <td className="p-2 text-center">{e.rass ?? '—'}</td>
            <td className="p-2 text-gray-600 max-w-[200px] truncate">{e.nursing_note || ''}</td>
          </tr>
        ))}</tbody></table></div>}
      </div>}

      {/* ===== I/O CHART ===== */}
      {tab === 'io' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Intake / Output Chart</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Record I/O'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4">
          <div className="mb-3"><label className="text-xs text-gray-500">Shift</label>
            <select value={ioForm.shift} onChange={e => setIoForm(f => ({...f, shift: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['morning','evening','night'].map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><h3 className="text-xs font-medium text-green-600 mb-2">INTAKE (ml)</h3>
              {[['oral_intake_ml','Oral'],['iv_fluid_ml','IV Fluids'],['blood_products_ml','Blood Products'],['ryles_tube_ml','Ryles Tube'],['other_intake_ml','Other']].map(([k,l]) =>
                <div key={k} className="flex items-center gap-2 mb-1.5"><label className="text-xs text-gray-500 w-24">{l}</label>
                  <input type="number" value={(ioForm as any)[k]||0} onChange={e => setIoForm(f => ({...f, [k]: parseInt(e.target.value)||0}))} className="flex-1 px-2 py-1 border rounded text-sm text-right" min="0" /></div>
              )}
              <div className="text-xs font-bold text-green-700 mt-2">Total: {ioForm.oral_intake_ml+ioForm.iv_fluid_ml+ioForm.blood_products_ml+ioForm.ryles_tube_ml+ioForm.other_intake_ml} ml</div>
            </div>
            <div><h3 className="text-xs font-medium text-red-600 mb-2">OUTPUT (ml)</h3>
              {[['urine_ml','Urine'],['drain_1_ml','Drain 1'],['drain_2_ml','Drain 2'],['ryles_aspirate_ml','Ryles Aspirate'],['vomit_ml','Vomit'],['other_output_ml','Other']].map(([k,l]) =>
                <div key={k} className="flex items-center gap-2 mb-1.5"><label className="text-xs text-gray-500 w-24">{l}</label>
                  <input type="number" value={(ioForm as any)[k]||0} onChange={e => setIoForm(f => ({...f, [k]: parseInt(e.target.value)||0}))} className="flex-1 px-2 py-1 border rounded text-sm text-right" min="0" /></div>
              )}
              <div className="flex items-center gap-2 mb-1.5"><label className="text-xs text-gray-500 w-24">Stool (count)</label>
                <input type="number" value={ioForm.stool_count||0} onChange={e => setIoForm(f => ({...f, stool_count: parseInt(e.target.value)||0}))} className="flex-1 px-2 py-1 border rounded text-sm text-right" min="0" /></div>
              <div className="text-xs font-bold text-red-700 mt-2">Total: {ioForm.urine_ml+ioForm.drain_1_ml+ioForm.drain_2_ml+ioForm.ryles_aspirate_ml+ioForm.vomit_ml+ioForm.other_output_ml} ml</div>
            </div>
          </div>
          <div className={`text-sm font-bold mt-3 p-2 rounded ${(ioForm.oral_intake_ml+ioForm.iv_fluid_ml+ioForm.blood_products_ml+ioForm.ryles_tube_ml+ioForm.other_intake_ml)-(ioForm.urine_ml+ioForm.drain_1_ml+ioForm.drain_2_ml+ioForm.ryles_aspirate_ml+ioForm.vomit_ml+ioForm.other_output_ml) > 0 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
            Balance: {(ioForm.oral_intake_ml+ioForm.iv_fluid_ml+ioForm.blood_products_ml+ioForm.ryles_tube_ml+ioForm.other_intake_ml)-(ioForm.urine_ml+ioForm.drain_1_ml+ioForm.drain_2_ml+ioForm.ryles_aspirate_ml+ioForm.vomit_ml+ioForm.other_output_ml)} ml
          </div>
          <button onClick={async () => { await io.addEntry(ioForm, staffId); setShowForm(false); flash('I/O recorded'); }}
            className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save I/O Entry</button>
        </div>}
        {io.entries.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No I/O records</div> :
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Date</th><th className="p-2">Shift</th><th className="p-2 text-green-600">Intake (ml)</th><th className="p-2 text-red-600">Output (ml)</th><th className="p-2">Balance</th><th className="p-2">Urine</th>
        </tr></thead><tbody>{io.entries.map((e: any) => (
          <tr key={e.id} className="border-b"><td className="p-2">{e.io_date}</td><td className="p-2 text-center">{e.shift}</td>
            <td className="p-2 text-center text-green-600 font-medium">{e.total_intake_ml}</td>
            <td className="p-2 text-center text-red-600 font-medium">{e.total_output_ml}</td>
            <td className={`p-2 text-center font-bold ${e.total_intake_ml - e.total_output_ml >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{e.total_intake_ml - e.total_output_ml}</td>
            <td className="p-2 text-center">{e.urine_ml}</td>
          </tr>
        ))}</tbody></table></div>}
      </div>}

      {/* ===== MEDICATION ORDERS ===== */}
      {tab === 'meds' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Medication Orders</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Order'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Drug name *</label>
              <input type="text" value={medForm.drugName} onChange={e => setMedForm(f => ({...f, drugName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Inj. Ceftriaxone" /></div>
            <div><label className="text-xs text-gray-500">Generic name</label>
              <input type="text" value={medForm.genericName} onChange={e => setMedForm(f => ({...f, genericName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Dose *</label>
              <input type="text" value={medForm.dose} onChange={e => setMedForm(f => ({...f, dose: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., 1g" /></div>
            <div><label className="text-xs text-gray-500">Route *</label>
              <select value={medForm.route} onChange={e => setMedForm(f => ({...f, route: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['oral','iv','im','sc','sl','pr','topical','inhalation','nasal','intrathecal','epidural'].map(r => <option key={r}>{r.toUpperCase()}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Frequency *</label>
              <select value={medForm.frequency} onChange={e => setMedForm(f => ({...f, frequency: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['OD','BD','TDS','QID','Q6H','Q8H','Q12H','HS','SOS','STAT','Weekly'].map(f => <option key={f}>{f}</option>)}</select></div>
          </div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={medForm.isStat} onChange={e => setMedForm(f => ({...f, isStat: e.target.checked}))} /><span className="text-red-600 font-medium">STAT</span></label>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={medForm.isPrn} onChange={e => setMedForm(f => ({...f, isPrn: e.target.checked}))} /><span>PRN</span></label>
          </div>
          <div><label className="text-xs text-gray-500">Special instructions</label>
            <input type="text" value={medForm.specialInstructions} onChange={e => setMedForm(f => ({...f, specialInstructions: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Infuse over 30 min, monitor for rash..." /></div>
          <button onClick={async () => { if (!medForm.drugName || !medForm.dose) return; await meds.addOrder(medForm, staffId); setShowForm(false); flash('Order placed'); setMedForm({ drugName: '', genericName: '', dose: '', route: 'oral', frequency: 'OD', isStat: false, isPrn: false, specialInstructions: '' }); }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Place Order</button>
        </div>}
        {meds.orders.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No medication orders</div> :
        <div className="space-y-2">{meds.orders.map((o: any) => (
          <div key={o.id} className={`bg-white rounded-lg border p-3 ${o.status === 'discontinued' ? 'opacity-50' : ''} ${o.is_stat ? 'border-red-300' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{o.drug_name}</span>
                {o.is_stat && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold">STAT</span>}
                {o.is_prn && <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded">PRN</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.status === 'active' ? 'bg-green-100 text-green-700' : o.status === 'discontinued' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
              </div>
              {o.status === 'active' && <button onClick={() => { const r = prompt('Reason for discontinuation:'); if (r) meds.discontinue(o.id, staffId, r); }} className="text-xs text-red-500 hover:text-red-700">D/C</button>}
            </div>
            <div className="text-xs text-gray-500 mt-1">{o.dose} | {o.route.toUpperCase()} | {o.frequency} | {o.generic_name || ''}</div>
            {o.special_instructions && <div className="text-xs text-blue-600 mt-0.5">{o.special_instructions}</div>}
            <div className="text-[10px] text-gray-400 mt-0.5">Ordered by: {o.doctor?.full_name} | {new Date(o.created_at).toLocaleDateString('en-IN')}</div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== MAR ===== */}
      {tab === 'mar' && <div>
        <h2 className="font-semibold text-sm mb-3">Medication Administration Record</h2>
        {mar.records.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No scheduled medications for today. Add medication orders first, then MAR entries will appear.</div> :
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Time</th><th className="p-2 text-left">Medication</th><th className="p-2">Dose</th><th className="p-2">Route</th><th className="p-2">Status</th><th className="p-2">Actions</th>
        </tr></thead><tbody>{mar.records.map((r: any) => (
          <tr key={r.id} className="border-b"><td className="p-2">{new Date(r.scheduled_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
            <td className="p-2 font-medium">{r.medication?.drug_name}</td><td className="p-2 text-center">{r.medication?.dose}</td>
            <td className="p-2 text-center">{r.medication?.route?.toUpperCase()}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${r.status === 'given' ? 'bg-green-100 text-green-700' : r.status === 'held' ? 'bg-yellow-100 text-yellow-700' : r.status === 'missed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td>
            <td className="p-2 text-center">{r.status === 'scheduled' && <div className="flex gap-1 justify-center">
              <button onClick={() => mar.administer(r.id, staffId)} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">Give</button>
              <button onClick={() => { const reason = prompt('Hold reason:'); if (reason) mar.holdDose(r.id, reason); }} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[10px]">Hold</button>
            </div>}</td>
          </tr>
        ))}</tbody></table></div>}
      </div>}

      {/* ===== ICU SCORES ===== */}
      {tab === 'scores' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">ICU Scores & Scales</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Record Score'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Score type</label>
              <select value={scoreForm.scoreType} onChange={e => setScoreForm(f => ({...f, scoreType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {[['gcs','GCS (3-15)'],['sofa','SOFA (0-24)'],['apache2','APACHE II (0-71)'],['rass','RASS (-5 to +4)'],['news2','NEWS2 (0-20)'],['braden','Braden (6-23)'],['morse_fall','Morse Fall (0-125)'],['qsofa','qSOFA (0-3)'],['curb65','CURB-65 (0-5)']].map(([k,l]) =>
                  <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Score value *</label>
              <input type="number" value={scoreForm.scoreValue} onChange={e => setScoreForm(f => ({...f, scoreValue: parseInt(e.target.value)||0}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Interpretation</label>
              <input type="text" value={scoreForm.interpretation} onChange={e => setScoreForm(f => ({...f, interpretation: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Moderate risk" /></div>
          </div>
          <button onClick={async () => { await scores.addScore(scoreForm.scoreType, scoreForm.scoreValue, {}, scoreForm.interpretation, staffId); setShowForm(false); flash('Score recorded'); }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Score</button>
        </div>}
        {scores.scores.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No scores recorded</div> :
        <div className="grid grid-cols-2 gap-3">{scores.scores.map((s: any) => (
          <div key={s.id} className="bg-white rounded-lg border p-3">
            <div className="flex items-center justify-between mb-1"><span className="font-medium text-sm uppercase">{s.score_type}</span><span className="text-2xl font-bold">{s.score_value}</span></div>
            {s.interpretation && <div className="text-xs text-gray-500">{s.interpretation}</div>}
            <div className="text-[10px] text-gray-400 mt-1">{new Date(s.created_at).toLocaleDateString('en-IN')} | {s.scorer?.full_name}</div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== CONSENTS ===== */}
      {tab === 'consents' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Consent Forms</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Consent'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Consent type *</label>
              <select value={conForm.consentType} onChange={e => setConForm(f => ({...f, consentType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['general','surgical','anesthesia','blood_transfusion','high_risk','ama_lama','hiv_test','research','photography','dnr'].map(t =>
                  <option key={t} value={t}>{t.replace(/_/g,' ').toUpperCase()}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Procedure name</label>
              <input type="text" value={conForm.procedureName} onChange={e => setConForm(f => ({...f, procedureName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div><label className="text-xs text-gray-500">Risks explained</label>
            <textarea value={conForm.risksExplained} onChange={e => setConForm(f => ({...f, risksExplained: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Witness name</label>
              <input type="text" value={conForm.witnessName} onChange={e => setConForm(f => ({...f, witnessName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Witness relation</label>
              <input type="text" value={conForm.witnessRelation} onChange={e => setConForm(f => ({...f, witnessRelation: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <button onClick={async () => { await consents.addConsent({...conForm, patientId: pt.id}, staffId); setShowForm(false); flash('Consent recorded'); }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Consent</button>
        </div>}
        {consents.consents.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No consent forms</div> :
        <div className="space-y-2">{consents.consents.map((c: any) => (
          <div key={c.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
            <div><span className="font-medium text-sm">{c.consent_type.replace(/_/g,' ').toUpperCase()}</span>
              {c.procedure_name && <span className="text-xs text-gray-500 ml-2">— {c.procedure_name}</span>}
              <div className="text-[10px] text-gray-400">{new Date(c.consent_date).toLocaleDateString('en-IN')} | {c.staff?.full_name}</div></div>
            <span className={`px-2 py-0.5 rounded text-xs ${c.consent_given ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.consent_given ? 'Obtained' : 'Refused'}</span>
          </div>
        ))}</div>}
      </div>}

      {/* ===== PROCEDURES ===== */}
      {tab === 'procedures' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Procedural Notes</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Procedure'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Procedure type *</label>
              <select value={procForm.procedureType} onChange={e => setProcForm(f => ({...f, procedureType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['central_line','arterial_line','intubation','tracheostomy','chest_tube','lumbar_puncture','paracentesis','thoracentesis','bone_marrow','foley_catheter','ng_tube','picc_line','dialysis_catheter','pericardiocentesis','cardioversion','other'].map(t =>
                  <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Procedure name *</label>
              <input type="text" value={procForm.procedureName} onChange={e => setProcForm(f => ({...f, procedureName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div><label className="text-xs text-gray-500">Indication *</label>
            <input type="text" value={procForm.indication} onChange={e => setProcForm(f => ({...f, indication: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Site</label>
              <input type="text" value={procForm.site} onChange={e => setProcForm(f => ({...f, site: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Right IJV, Left radial..." /></div>
            <div><label className="text-xs text-gray-500">Laterality</label>
              <select value={procForm.laterality} onChange={e => setProcForm(f => ({...f, laterality: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['na','left','right','bilateral','midline'].map(l => <option key={l}>{l}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-gray-500">Technique</label>
            <textarea value={procForm.technique} onChange={e => setProcForm(f => ({...f, technique: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Describe the procedure technique..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Findings</label>
              <textarea value={procForm.findings} onChange={e => setProcForm(f => ({...f, findings: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Complications</label>
              <textarea value={procForm.complications} onChange={e => setProcForm(f => ({...f, complications: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="None / describe..." /></div>
          </div>
          <button onClick={async () => { if (!procForm.procedureName || !procForm.indication) return; await procedures.addNote(procForm, staffId); setShowForm(false); flash('Procedure note saved'); }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Procedure Note</button>
        </div>}
        {procedures.notes.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No procedural notes</div> :
        <div className="space-y-2">{procedures.notes.map((n: any) => (
          <div key={n.id} className="bg-white rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{n.procedure_name}</span>
              <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded">{n.procedure_type.replace(/_/g,' ')}</span></div>
            <div className="text-xs text-gray-600"><span className="font-medium">Indication:</span> {n.indication}</div>
            {n.technique && <div className="text-xs text-gray-500 mt-1">{n.technique}</div>}
            {n.complications && <div className="text-xs text-red-600 mt-1">Complications: {n.complications}</div>}
            <div className="text-[10px] text-gray-400 mt-1">{new Date(n.procedure_date).toLocaleString('en-IN')} | Dr. {n.doctor?.full_name}</div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== VITALS TREND ===== */}
      {tab === 'trends' && <div>
        <h2 className="font-semibold text-sm mb-3">Vitals Trend Chart</h2>
        <VitalsTrendChart entries={icu.entries} hoursBack={24} />
      </div>}

      {/* ===== NURSING NOTES ===== */}
      {tab === 'nursing' && <NursingShiftNotes admissionId={admissionId} staffId={staffId} patientName={patientName} onFlash={flash} />}
    </div>
  );
}
