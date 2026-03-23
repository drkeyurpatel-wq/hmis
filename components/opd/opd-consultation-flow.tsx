'use client';
// components/opd/opd-consultation-flow.tsx
// Guided OPD workflow: Check-in → Vitals → Consult → Rx → Charges → Done
// Opens when doctor clicks a patient from the queue

import React, { useState, useCallback, useEffect } from 'react';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import { Heart, Pill, FileText, IndianRupee, CheckCircle, ArrowRight, X, AlertTriangle } from 'lucide-react';

interface Props {
  visit: any; // OPD visit record
  onDone: () => void;
  onFlash: (msg: string) => void;
}

const STEPS = ['vitals', 'consult', 'rx', 'charges', 'done'] as const;
type Step = typeof STEPS[number];

export default function OPDConsultationFlow({ visit, onDone, onFlash }: Props) {
  const { staff, activeCentreId } = useAuthStore();
  const [step, setStep] = useState<Step>('vitals');
  const [saving, setSaving] = useState(false);

  // Vitals
  const [vf, setVf] = useState({ heart_rate: '', systolic_bp: '', diastolic_bp: '', temperature: '', spo2: '', respiratory_rate: '', weight: '', height: '' });

  // Consult
  const [cf, setCf] = useState({ chief_complaint: (visit.chiefComplaint || visit.chief_complaint) || '', examination: '', assessment: '', plan: '', diagnosis_icd: '', follow_up_days: '' });

  // Rx
  const [rxLines, setRxLines] = useState<{ drug: string; dose: string; route: string; frequency: string; duration: string; instructions: string }[]>([]);
  const [rxDraft, setRxDraft] = useState({ drug: '', dose: '', route: 'oral', frequency: 'BD', duration: '5 days', instructions: '' });

  // Charges
  const [charges, setCharges] = useState<{ description: string; amount: number }[]>([{ description: 'Consultation Fee', amount: 0 }]);

  // Auto-mark with_doctor on open
  useEffect(() => {
    if (visit.status === 'checked_in' || visit.status === 'waiting') {
      sb()?.from('hmis_opd_visits').update({ status: 'with_doctor' }).eq('id', visit.id);
    }
  }, [visit.id, visit.status]);

  const saveVitals = useCallback(async () => {
    if (!sb() || !staff) return;
    setSaving(true);
    const record: any = { patient_id: (visit.patient?.id || visit.patient_id), recorded_by: staff.id, recorded_at: new Date().toISOString() };
    Object.entries(vf).forEach(([k, v]) => { if (v) record[k] = parseFloat(v); });
    await sb()!.from('hmis_vitals').insert(record);
    setSaving(false);
    setStep('consult');
  }, [vf, (visit.patient?.id || visit.patient_id), staff]);

  const saveConsult = useCallback(async () => {
    if (!sb() || !staff) return;
    setSaving(true);
    // Save EMR encounter
    await sb()!.from('hmis_emr_encounters').insert({
      patient_id: (visit.patient?.id || visit.patient_id), doctor_id: staff.id, centre_id: activeCentreId,
      encounter_type: 'opd', chief_complaint: cf.chief_complaint, examination: cf.examination,
      assessment: cf.assessment, plan: cf.plan, encounter_date: new Date().toISOString().split('T')[0],
      opd_visit_id: visit.id,
    });
    // Update visit
    await sb()!.from('hmis_opd_visits').update({ chief_complaint: cf.chief_complaint }).eq('id', visit.id);
    setSaving(false);
    setStep('rx');
  }, [cf, visit, staff, activeCentreId]);

  const addRxLine = () => {
    if (!rxDraft.drug) return;
    setRxLines(prev => [...prev, { ...rxDraft }]);
    setRxDraft({ drug: '', dose: '', route: 'oral', frequency: 'BD', duration: '5 days', instructions: '' });
  };

  const saveRx = useCallback(async () => {
    if (!sb() || !staff) return;
    setSaving(true);
    if (rxLines.length > 0) {
      await sb()!.from('hmis_prescriptions').insert(rxLines.map(rx => ({
        patient_id: (visit.patient?.id || visit.patient_id), prescribed_by: staff.id, centre_id: activeCentreId,
        drug_name: rx.drug, dose: rx.dose, route: rx.route, frequency: rx.frequency,
        duration: rx.duration, instructions: rx.instructions, status: 'active',
        prescribed_date: new Date().toISOString().split('T')[0],
      })));
    }
    setSaving(false);
    setStep('charges');
  }, [rxLines, (visit.patient?.id || visit.patient_id), staff, activeCentreId]);

  const completeVisit = useCallback(async () => {
    if (!sb() || !staff) return;
    setSaving(true);
    // Post charges to billing
    const validCharges = charges.filter(c => c.amount > 0);
    if (validCharges.length > 0) {
      const total = validCharges.reduce((s, c) => s + c.amount, 0);
      const { data: billNum } = await sb()!.rpc('hmis_next_sequence', { p_centre_id: activeCentreId, p_type: 'bill' });
      const { data: bill } = await sb()!.from('hmis_bills').insert({
        centre_id: activeCentreId, patient_id: (visit.patient?.id || visit.patient_id), bill_number: billNum || `B-${Date.now()}`,
        bill_type: 'opd', payor_type: 'self', gross_amount: total, net_amount: total, balance_amount: total,
        status: 'final', bill_date: new Date().toISOString().split('T')[0], created_by: staff.id,
      }).select('id').single();
      if (bill) {
        await sb()!.from('hmis_bill_items').insert(validCharges.map(c => ({
          bill_id: bill.id, description: c.description, quantity: 1, unit_rate: c.amount, amount: c.amount, net_amount: c.amount,
        })));
      }
    }
    // Mark visit completed
    await sb()!.from('hmis_opd_visits').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', visit.id);
    setSaving(false);
    setStep('done');
    onFlash('Consultation completed');
  }, [charges, visit, staff, activeCentreId, onFlash]);

  const stepIndex = STEPS.indexOf(step);
  const patientName = `${visit.patient?.name || visit.patient?.first_name || 'Patient'}`;

  return (
    <div className="bg-white rounded-xl border shadow-lg max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl">
        <div>
          <h2 className="font-bold text-sm">{patientName}</h2>
          <div className="text-xs text-gray-500">Token T{visit.tokenNumber || visit.token_number} · {visit.doctor?.name || ''}</div>
        </div>
        <button onClick={onDone} className="p-1 hover:bg-gray-200 rounded-lg"><X size={16} /></button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 px-4 py-2 border-b">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${i < stepIndex ? 'text-green-600' : i === stepIndex ? 'bg-teal-600 text-white' : 'text-gray-400'}`}>
              {i < stepIndex ? <CheckCircle size={12} /> : <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[9px]">{i + 1}</span>}
              {s === 'vitals' ? 'Vitals' : s === 'consult' ? 'Consult' : s === 'rx' ? 'Rx' : s === 'charges' ? 'Charges' : 'Done'}
            </div>
            {i < STEPS.length - 1 && <ArrowRight size={10} className="text-gray-300" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="p-4">

        {/* STEP 1: Vitals */}
        {step === 'vitals' && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><Heart size={14} /> Record Vitals</h3>
            <div className="grid grid-cols-4 gap-3">
              {([['heart_rate','HR (bpm)','72'],['systolic_bp','SBP','120'],['diastolic_bp','DBP','80'],['temperature','Temp °C','37.0'],['spo2','SpO₂ %','98'],['respiratory_rate','RR /min','16'],['weight','Weight kg','70'],['height','Height cm','170']] as const).map(([k,l,ph]) => (
                <div key={k}><label className="text-[10px] text-gray-500">{l}</label>
                <input type="number" step="0.1" placeholder={ph} value={(vf as any)[k]} onChange={(e: any) => setVf(p => ({...p,[k]:e.target.value}))} className="w-full px-2 py-1.5 border rounded-lg text-sm text-center" /></div>
              ))}
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep('consult')} className="text-xs text-gray-500 hover:underline">Skip vitals →</button>
              <button onClick={saveVitals} disabled={saving} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save & Continue'}</button>
            </div>
          </div>
        )}

        {/* STEP 2: Consultation */}
        {step === 'consult' && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><FileText size={14} /> Consultation</h3>
            <div className="space-y-3">
              <div><label className="text-[10px] text-gray-500">Chief Complaint *</label>
              <input value={cf.chief_complaint} onChange={(e: any) => setCf(p => ({...p, chief_complaint: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Fever, cough, abdominal pain..." /></div>
              <div><label className="text-[10px] text-gray-500">Examination</label>
              <textarea value={cf.examination} onChange={(e: any) => setCf(p => ({...p, examination: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm h-16 resize-none" placeholder="O/E findings..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-gray-500">Assessment / Diagnosis</label>
                <textarea value={cf.assessment} onChange={(e: any) => setCf(p => ({...p, assessment: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm h-16 resize-none" placeholder="Diagnosis..." /></div>
                <div><label className="text-[10px] text-gray-500">Plan</label>
                <textarea value={cf.plan} onChange={(e: any) => setCf(p => ({...p, plan: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm h-16 resize-none" placeholder="Treatment plan, advice..." /></div>
              </div>
              <div><label className="text-[10px] text-gray-500">Follow-up (days)</label>
              <input type="number" value={cf.follow_up_days} onChange={(e: any) => setCf(p => ({...p, follow_up_days: e.target.value}))} className="w-32 px-3 py-2 border rounded-lg text-sm" placeholder="7" /></div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={saveConsult} disabled={saving || !cf.chief_complaint} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save & Continue'}</button>
            </div>
          </div>
        )}

        {/* STEP 3: Prescription */}
        {step === 'rx' && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><Pill size={14} /> Prescription</h3>
            {rxLines.length > 0 && (
              <div className="mb-3 space-y-1">{rxLines.map((rx, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 text-xs">
                  <span><span className="font-semibold">{rx.drug}</span> {rx.dose} · {rx.route} · {rx.frequency} · {rx.duration}</span>
                  <button onClick={() => setRxLines(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                </div>
              ))}</div>
            )}
            <div className="grid grid-cols-6 gap-2 bg-gray-50 rounded-lg p-3">
              <div className="col-span-2"><input value={rxDraft.drug} onChange={(e: any) => setRxDraft(p => ({...p, drug: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Drug name *" /></div>
              <div><input value={rxDraft.dose} onChange={(e: any) => setRxDraft(p => ({...p, dose: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Dose" /></div>
              <div><select value={rxDraft.frequency} onChange={(e: any) => setRxDraft(p => ({...p, frequency: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
                {['OD','BD','TDS','QID','SOS','HS','STAT'].map(f => <option key={f} value={f}>{f}</option>)}
              </select></div>
              <div><input value={rxDraft.duration} onChange={(e: any) => setRxDraft(p => ({...p, duration: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="5 days" /></div>
              <div><button onClick={addRxLine} className="w-full px-2 py-1.5 bg-teal-600 text-white rounded text-xs">+ Add</button></div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep('charges')} className="text-xs text-gray-500 hover:underline">Skip Rx →</button>
              <button onClick={saveRx} disabled={saving} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">{saving ? 'Saving...' : rxLines.length > 0 ? 'Save & Continue' : 'Continue →'}</button>
            </div>
          </div>
        )}

        {/* STEP 4: Charges */}
        {step === 'charges' && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><IndianRupee size={14} /> Charges</h3>
            <div className="space-y-2">{charges.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={c.description} onChange={(e: any) => setCharges(p => p.map((ch, j) => j === i ? {...ch, description: e.target.value} : ch))} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                <input type="number" value={c.amount} onChange={(e: any) => setCharges(p => p.map((ch, j) => j === i ? {...ch, amount: parseFloat(e.target.value) || 0} : ch))} className="w-28 px-3 py-2 border rounded-lg text-sm text-right" placeholder="₹" />
                {i > 0 && <button onClick={() => setCharges(p => p.filter((_, j) => j !== i))} className="text-red-400"><X size={14} /></button>}
              </div>
            ))}</div>
            <button onClick={() => setCharges(p => [...p, { description: '', amount: 0 }])} className="text-xs text-teal-600 mt-2 hover:underline">+ Add charge</button>
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="text-sm font-bold">Total: ₹{charges.reduce((s, c) => s + c.amount, 0).toLocaleString('en-IN')}</div>
              <div className="flex gap-2">
                <button onClick={() => { setCharges([{ description: 'Consultation Fee', amount: 0 }]); completeVisit(); }} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">Skip Billing</button>
                <button onClick={completeVisit} disabled={saving} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Bill & Complete'}</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
            <h3 className="font-bold text-lg">Consultation Complete</h3>
            <p className="text-sm text-gray-500 mt-1">{patientName} — {cf.assessment || cf.chief_complaint || 'Visit completed'}</p>
            {cf.follow_up_days && <p className="text-sm text-teal-600 mt-2">Follow-up in {cf.follow_up_days} days</p>}
            <button onClick={onDone} className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm">Back to Queue</button>
          </div>
        )}
      </div>
    </div>
  );
}
