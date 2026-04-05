'use client';
import React, { useState } from 'react';
import { CalendarCheck } from 'lucide-react';

interface VisitsTabProps {
  selectedEnrollId: string | null;
  enrollmentNumber: string;
  visits: any[];
  schedule: (visit: any) => Promise<void>;
  checkin: (visitId: string) => Promise<void>;
  checkout: (visitId: string, notes: any) => Promise<void>;
  saveVitals: (visitId: string, vitals: any) => Promise<void>;
  staffId: string;
  visitStColor: (s: string) => string;
  condColor: (c: string) => string;
  flash: (m: string) => void;
  initialVisitForm?: { visitId?: string };
  initialShowForm?: boolean;
}

export default function VisitsTab({ selectedEnrollId, enrollmentNumber, visits, schedule, checkout, saveVitals, staffId, visitStColor, condColor, flash, initialVisitForm, initialShowForm }: VisitsTabProps) {
  const [showVisitForm, setShowVisitForm] = useState(initialShowForm || false);
  const [vForm, setVF] = useState<any>(initialVisitForm || {});

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Visit Log {selectedEnrollId ? `— ${enrollmentNumber}` : ''}</h2>
        {selectedEnrollId && <button onClick={() => setShowVisitForm(!showVisitForm)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">{showVisitForm ? 'Cancel' : '+ Schedule Visit'}</button>}
      </div>
      {!selectedEnrollId ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">Select a patient from Patients tab first</div> : <>
        {showVisitForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <h3 className="text-sm font-medium">{vForm.visitId ? 'Document Visit' : 'Schedule New Visit'}</h3>
          {!vForm.visitId && <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Date *</label>
              <input type="date" value={vForm.scheduled_date || new Date().toISOString().split('T')[0]} onChange={e => setVF((f: any) => ({...f, scheduled_date: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Time</label>
              <input type="time" value={vForm.scheduled_time || '09:00'} onChange={e => setVF((f: any) => ({...f, scheduled_time: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Visit type</label>
              <select value={vForm.visit_type || 'routine'} onChange={e => setVF((f: any) => ({...f, visit_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['routine','urgent','follow_up','assessment','discharge_visit','sample_collection'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          </div>}
          {/* Vitals */}
          <div className="grid grid-cols-4 gap-2">
            {[['bp_systolic','SBP'],['bp_diastolic','DBP'],['pulse','Pulse'],['temperature','Temp °F'],['spo2','SpO2 %'],['resp_rate','RR'],['blood_sugar','Sugar'],['pain_scale','Pain(0-10)']].map(([k,l]) =>
              <div key={k}><label className="text-[10px] text-gray-500">{l}</label>
                <input type="number" value={vForm[k]||''} onChange={e => setVF((f: any) => ({...f, [k]: e.target.value ? parseFloat(e.target.value) : ''}))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">General condition</label>
              <select value={vForm.general_condition||''} onChange={e => setVF((f: any) => ({...f, general_condition: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>{['stable','improving','deteriorating','critical','unchanged'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Consciousness</label>
              <select value={vForm.consciousness||''} onChange={e => setVF((f: any) => ({...f, consciousness: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>{['alert','drowsy','confused','unresponsive'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Oral intake</label>
              <select value={vForm.oral_intake||''} onChange={e => setVF((f: any) => ({...f, oral_intake: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>{['normal','reduced','poor','nil','ryles_tube','peg'].map(c => <option key={c}>{c.replace(/_/g,' ')}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-gray-500">Assessment notes</label>
            <textarea value={vForm.assessment_notes||''} onChange={e => setVF((f: any) => ({...f, assessment_notes: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Clinical assessment, exam findings..." /></div>
          <div><label className="text-xs text-gray-500">Plan</label>
            <textarea value={vForm.plan_notes||''} onChange={e => setVF((f: any) => ({...f, plan_notes: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Continue treatment, modify meds, next visit plan..." /></div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={vForm.needs_escalation||false} onChange={e => setVF((f: any) => ({...f, needs_escalation: e.target.checked}))} className="w-4 h-4 rounded" /><span className="text-red-600 font-medium">Needs doctor escalation</span></label>
          {vForm.needs_escalation && <div><label className="text-xs text-gray-500">Escalation reason</label>
            <input type="text" value={vForm.escalation_reason||''} onChange={e => setVF((f: any) => ({...f, escalation_reason: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>}
          <div className="flex gap-2">
            {vForm.visitId ? <button onClick={async () => {
              const vitals: any = {}; ['bp_systolic','bp_diastolic','pulse','temperature','spo2','resp_rate','blood_sugar','pain_scale','general_condition','consciousness','oral_intake'].forEach(k => { if (vForm[k]) vitals[k] = vForm[k]; });
              await saveVitals(vForm.visitId, vitals);
              await checkout(vForm.visitId, { assessmentNotes: vForm.assessment_notes, planNotes: vForm.plan_notes, generalCondition: vForm.general_condition, needsEscalation: vForm.needs_escalation, escalationReason: vForm.escalation_reason });
              flash('Visit documented & checked out'); setShowVisitForm(false); setVF({});
            }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save & Checkout</button>
            : <button onClick={async () => {
              await schedule({ enrollment_id: selectedEnrollId, assigned_nurse_id: staffId, scheduled_date: vForm.scheduled_date || new Date().toISOString().split('T')[0], scheduled_time: vForm.scheduled_time || '09:00', visit_type: vForm.visit_type || 'routine' });
              flash('Visit scheduled'); setShowVisitForm(false); setVF({});
            }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Schedule Visit</button>}
            <button onClick={() => { setShowVisitForm(false); setVF({}); }} className="px-4 py-2 bg-gray-100 text-sm rounded-lg">Cancel</button>
          </div>
        </div>}
        {visits.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border"><CalendarCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm font-medium text-gray-500">No visits scheduled</p><p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Enroll a patient first, then schedule home visits.</p></div> :
        <div className="space-y-2">{visits.map((v: any) => (
          <div key={v.id} className={`bg-white rounded-lg border p-3 ${v.needs_escalation ? 'border-red-300 bg-red-50/30' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{v.scheduled_date}</span>
                <span className="text-xs text-gray-400">{v.scheduled_time?.slice(0,5)}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${visitStColor(v.status)}`}>{v.status}</span>
                {v.visit_type !== 'routine' && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{v.visit_type.replace(/_/g,' ')}</span>}
                {v.general_condition && <span className={`text-[10px] font-medium ${condColor(v.general_condition)}`}>{v.general_condition}</span>}
                {v.needs_escalation && <span className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-[10px]">ESCALATED</span>}
              </div>
              <span className="text-[10px] text-gray-400">{v.nurse?.full_name}</span>
            </div>
            {(v.bp_systolic || v.pulse || v.spo2 || v.temperature) && <div className="text-xs text-gray-600 mt-1">Vitals: {v.bp_systolic ? `BP ${v.bp_systolic}/${v.bp_diastolic}` : ''} {v.pulse ? `HR ${v.pulse}` : ''} {v.spo2 ? `SpO2 ${v.spo2}%` : ''} {v.temperature ? `Temp ${v.temperature}°F` : ''} {v.blood_sugar ? `Sugar ${v.blood_sugar}` : ''} {v.pain_scale != null ? `Pain ${v.pain_scale}/10` : ''}</div>}
            {v.assessment_notes && <div className="text-xs text-gray-500 mt-1">{v.assessment_notes}</div>}
          </div>
        ))}</div>}
      </>}
    </div>
  );
}
