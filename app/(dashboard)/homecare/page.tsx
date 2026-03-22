'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useEnrollments, useVisits, useMedications, useWoundCare, useEquipment, useRates, useHCBilling, useNurseSchedule } from '@/lib/homecare/homecare-hooks';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type HCTab = 'dashboard' | 'enrollments' | 'schedule' | 'visits' | 'wound' | 'billing' | 'rates';

function HomecarePage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const enrollments = useEnrollments(centreId);
  const nurseSchedule = useNurseSchedule(staffId, centreId);
  const rates = useRates();

  const [tab, setTab] = useState<HCTab>('dashboard');
  const [selectedEnrollId, setSelectedEnrollId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Enrollment form
  const [eForm, setEF] = useState({ patient_id: '', program_type: 'post_discharge', primary_diagnosis: '', address_line1: '', city: 'Ahmedabad', pincode: '', primary_contact_name: '', primary_contact_phone: '', visit_frequency: 'daily', estimated_duration_weeks: 4, special_instructions: '' });
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);

  // Visit detail
  const visits = useVisits(selectedEnrollId);
  const meds = useMedications(selectedEnrollId);
  const wounds = useWoundCare(selectedEnrollId);
  const equipment = useEquipment(selectedEnrollId);
  const billing = useHCBilling(selectedEnrollId);

  // Visit form
  const [vForm, setVF] = useState<any>({});
  const [showVisitForm, setShowVisitForm] = useState(false);

  // Patient search
  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const progColor = (p: string) => p === 'post_discharge' ? 'bg-blue-100 text-teal-700' : p === 'palliative' ? 'bg-purple-100 text-purple-700' : p === 'wound_care' ? 'bg-orange-100 text-orange-700' : p === 'iv_therapy' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
  const stColor = (s: string) => s === 'active' ? 'bg-green-100 text-green-700' : s === 'paused' ? 'bg-yellow-100 text-yellow-700' : s === 'completed' || s === 'discharged' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700';
  const visitStColor = (s: string) => s === 'scheduled' ? 'bg-yellow-100 text-yellow-700' : s === 'in_progress' ? 'bg-blue-100 text-teal-700 animate-pulse' : s === 'completed' ? 'bg-green-100 text-green-700' : s === 'missed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
  const condColor = (c: string) => c === 'improving' ? 'text-green-600' : c === 'stable' ? 'text-teal-600' : c === 'deteriorating' ? 'text-red-600' : c === 'critical' ? 'text-red-700 font-bold' : 'text-gray-500';

  const tabs: [HCTab, string][] = [['dashboard','Dashboard'],['enrollments','Patients'],['schedule','My Schedule'],['visits','Visit Log'],['wound','Wound Care'],['billing','Billing'],['rates','Rate Card']];

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Homecare</h1><p className="text-sm text-gray-500">Home visit management, remote monitoring, patient care</p></div>
      </div>

      <div className="flex gap-1 mb-4 pb-0.5 overflow-x-auto scrollbar-thin">
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setShowForm(false); }}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap rounded-xl ${tab === k ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>{l}</button>)}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && <div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Active Patients</div><div className="text-2xl font-bold text-green-700">{enrollments.stats.active}</div></div>
          <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Today's Visits</div><div className="text-2xl font-bold text-teal-700">{nurseSchedule.todayVisits.length}</div></div>
          <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">{nurseSchedule.todayVisits.filter(v => v.status === 'scheduled').length}</div></div>
          <div className="bg-red-50 rounded-xl p-4"><div className="text-xs text-gray-500">Escalations</div><div className="text-2xl font-bold text-red-700">{nurseSchedule.todayVisits.filter(v => v.needs_escalation).length}</div></div>
        </div>

        {/* Today's schedule */}
        <h2 className="font-semibold text-sm mb-3">Today's Visits</h2>
        {nurseSchedule.todayVisits.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No visits scheduled for today</div> :
        <div className="space-y-2">{nurseSchedule.todayVisits.map((v: any) => (
          <div key={v.id} className={`bg-white rounded-lg border p-3 ${v.needs_escalation ? 'border-red-300' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{v.enrollment?.patient?.first_name} {v.enrollment?.patient?.last_name}</span>
                <span className="text-xs text-gray-400">{v.enrollment?.enrollment_number}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${visitStColor(v.status)}`}>{v.status}</span>
                {v.needs_escalation && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">ESCALATE</span>}
              </div>
              <span className="text-xs text-gray-500">{v.scheduled_time?.slice(0,5) || '—'}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{v.enrollment?.address_line1}{v.enrollment?.landmark ? ' (Nr. ' + v.enrollment.landmark + ')' : ''}</div>
            <div className="flex gap-2 mt-2">
              {v.status === 'scheduled' && <button onClick={async () => { await visits.checkin(v.id); flash('Checked in — GPS recorded'); nurseSchedule.load(); }}
                className="px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg">Check In</button>}
              {v.status === 'in_progress' && <button onClick={() => { setSelectedEnrollId(v.enrollment_id); setVF({ visitId: v.id }); setTab('visits'); setShowVisitForm(true); }}
                className="px-3 py-1 bg-teal-600 text-white text-xs rounded-lg">Document & Checkout</button>}
              {v.enrollment?.patient?.phone_primary && <a href={`tel:${v.enrollment.patient.phone_primary}`} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">Call</a>}
              {v.enrollment?.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${v.enrollment.latitude},${v.enrollment.longitude}`} target="_blank" className="px-3 py-1 bg-blue-50 text-teal-700 text-xs rounded-lg">Navigate</a>}
            </div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== ENROLLMENTS ===== */}
      {tab === 'enrollments' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Homecare Patients</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Enroll Patient'}</button>
        </div>
        {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="relative">
            <label className="text-xs text-gray-500">Patient *</label>
            {eForm.patient_id ? <div className="bg-green-50 rounded-lg p-2 flex justify-between"><span className="text-sm font-medium">{patResults.find(p => p.id === eForm.patient_id)?.first_name || 'Selected'}</span><button onClick={() => setEF(f => ({...f, patient_id: ''}))} className="text-xs text-red-500">Change</button></div> :
            <><input type="text" value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search by name/UHID/phone..." />
            {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10 max-h-40 overflow-y-auto">
              {patResults.map(p => <button key={p.id} onClick={() => { setEF(f => ({...f, patient_id: p.id, primary_contact_phone: p.phone_primary || f.primary_contact_phone})); setPatResults([]); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b last:border-0">{p.first_name} {p.last_name} — {p.uhid}</button>)}
            </div>}</>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Program *</label>
              <select value={eForm.program_type} onChange={e => setEF(f => ({...f, program_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['post_discharge','chronic_care','palliative','wound_care','iv_therapy','physiotherapy','dialysis','ventilator','general'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Visit frequency</label>
              <select value={eForm.visit_frequency} onChange={e => setEF(f => ({...f, visit_frequency: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['twice_daily','daily','alternate_day','twice_weekly','weekly','biweekly','monthly','as_needed'].map(f => <option key={f} value={f}>{f.replace(/_/g,' ')}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Duration (weeks)</label>
              <input type="number" value={eForm.estimated_duration_weeks} onChange={e => setEF(f => ({...f, estimated_duration_weeks: parseInt(e.target.value)||4}))} className="w-full px-3 py-2 border rounded-lg text-sm" min="1" /></div>
          </div>
          <div><label className="text-xs text-gray-500">Primary diagnosis</label>
            <input type="text" value={eForm.primary_diagnosis} onChange={e => setEF(f => ({...f, primary_diagnosis: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Post CABG, Diabetic foot ulcer, COPD exacerbation..." /></div>
          <div><label className="text-xs text-gray-500">Home address *</label>
            <input type="text" value={eForm.address_line1} onChange={e => setEF(f => ({...f, address_line1: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Flat/house number, street, area..." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">City</label>
              <input type="text" value={eForm.city} onChange={e => setEF(f => ({...f, city: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Pincode</label>
              <input type="text" value={eForm.pincode} onChange={e => setEF(f => ({...f, pincode: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Contact phone *</label>
              <input type="text" value={eForm.primary_contact_phone} onChange={e => setEF(f => ({...f, primary_contact_phone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div><label className="text-xs text-gray-500">Special instructions</label>
            <textarea value={eForm.special_instructions} onChange={e => setEF(f => ({...f, special_instructions: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Dietary restrictions, mobility issues, caretaker info..." /></div>
          <button onClick={async () => { if (!eForm.patient_id || !eForm.address_line1) return; const r = await enrollments.enroll(eForm, staffId); if (r) { flash('Enrolled: ' + r.enrollment_number); setShowForm(false); } }} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Enroll</button>
        </div>}
        {enrollments.enrollments.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No homecare patients</div> :
        <div className="space-y-2">{enrollments.enrollments.map((e: any) => (
          <div key={e.id} className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-green-300 ${selectedEnrollId === e.id ? 'border-green-500 bg-green-50/30' : ''}`} onClick={() => setSelectedEnrollId(e.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{e.patient?.first_name} {e.patient?.last_name}</span>
                <span className="font-mono text-xs text-gray-400">{e.enrollment_number}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${progColor(e.program_type)}`}>{e.program_type.replace(/_/g,' ')}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(e.status)}`}>{e.status}</span>
              </div>
              <div className="flex gap-1">
                {e.status === 'active' && <button onClick={(ev) => { ev.stopPropagation(); enrollments.updateStatus(e.id, 'paused'); flash('Paused'); }} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] rounded">Pause</button>}
                {e.status === 'paused' && <button onClick={(ev) => { ev.stopPropagation(); enrollments.updateStatus(e.id, 'active'); flash('Resumed'); }} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded">Resume</button>}
                {e.status === 'active' && <button onClick={(ev) => { ev.stopPropagation(); enrollments.updateStatus(e.id, 'discharged'); flash('Discharged'); }} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">Discharge</button>}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">{e.primary_diagnosis} | {e.visit_frequency?.replace(/_/g,' ')} | {e.address_line1?.substring(0, 50)}</div>
            <div className="text-[10px] text-gray-400">Since {e.start_date} | Dr. {e.doctor?.full_name || '—'} | Nurse: {e.nurse?.full_name || '—'}</div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== MY SCHEDULE ===== */}
      {tab === 'schedule' && <div>
        <h2 className="font-semibold text-sm mb-3">My Schedule — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {nurseSchedule.todayVisits.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No visits assigned to you today</div> :
        <div className="space-y-3">{nurseSchedule.todayVisits.map((v: any, i: number) => (
          <div key={v.id} className={`bg-white rounded-xl border p-4 ${v.status === 'in_progress' ? 'border-blue-400 ring-2 ring-blue-100' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="font-medium">{v.enrollment?.patient?.first_name} {v.enrollment?.patient?.last_name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${visitStColor(v.status)}`}>{v.status}</span>
              </div>
              <span className="text-sm font-medium text-gray-500">{v.scheduled_time?.slice(0,5) || '—'}</span>
            </div>
            <div className="text-xs text-gray-600 mb-2">{v.enrollment?.address_line1}{v.enrollment?.landmark ? ' | Nr. ' + v.enrollment.landmark : ''}</div>
            <div className="flex gap-2 flex-wrap">
              {v.status === 'scheduled' && <button onClick={async () => { await visits.checkin(v.id); flash('Checked in'); nurseSchedule.load(); }}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg font-medium">Check In</button>}
              {v.status === 'in_progress' && <button onClick={() => { setSelectedEnrollId(v.enrollment_id); setVF({ visitId: v.id }); setTab('visits'); setShowVisitForm(true); }}
                className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg font-medium">Document Visit</button>}
              <a href={`tel:${v.enrollment?.patient?.phone_primary}`} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Call Patient</a>
              {v.enrollment?.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${v.enrollment.latitude},${v.enrollment.longitude}`} target="_blank" className="px-3 py-1.5 bg-blue-50 text-teal-700 text-xs rounded-lg">Navigate</a>}
              <a href={`https://wa.me/91${v.enrollment?.patient?.phone_primary?.replace(/\D/g,'')}`} target="_blank" className="px-3 py-1.5 bg-green-50 text-green-700 text-xs rounded-lg">WhatsApp</a>
            </div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== VISIT LOG ===== */}
      {tab === 'visits' && <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Visit Log {selectedEnrollId ? `— ${enrollments.enrollments.find(e => e.id === selectedEnrollId)?.enrollment_number || ''}` : ''}</h2>
          {selectedEnrollId && <button onClick={() => setShowVisitForm(!showVisitForm)} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">{showVisitForm ? 'Cancel' : '+ Schedule Visit'}</button>}
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
                await visits.saveVitals(vForm.visitId, vitals);
                await visits.checkout(vForm.visitId, { assessmentNotes: vForm.assessment_notes, planNotes: vForm.plan_notes, generalCondition: vForm.general_condition, needsEscalation: vForm.needs_escalation, escalationReason: vForm.escalation_reason });
                flash('Visit documented & checked out'); setShowVisitForm(false); setVF({});
              }} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Save & Checkout</button>
              : <button onClick={async () => {
                await visits.schedule({ enrollment_id: selectedEnrollId, assigned_nurse_id: staffId, scheduled_date: vForm.scheduled_date || new Date().toISOString().split('T')[0], scheduled_time: vForm.scheduled_time || '09:00', visit_type: vForm.visit_type || 'routine' });
                flash('Visit scheduled'); setShowVisitForm(false); setVF({});
              }} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">Schedule Visit</button>}
              <button onClick={() => { setShowVisitForm(false); setVF({}); }} className="px-4 py-2 bg-gray-100 text-sm rounded-lg">Cancel</button>
            </div>
          </div>}
          {visits.visits.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No visits recorded</div> :
          <div className="space-y-2">{visits.visits.map((v: any) => (
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
      </div>}

      {/* ===== WOUND CARE ===== */}
      {tab === 'wound' && <div>
        <h2 className="font-semibold text-sm mb-3">Wound Care Log</h2>
        {!selectedEnrollId ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">Select a patient from Patients tab first</div> :
        wounds.records.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No wound care records. Document during visit checkout.</div> :
        <div className="space-y-3">{wounds.records.map((w: any) => (
          <div key={w.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{w.wound_location}</span>
                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{w.wound_type?.replace(/_/g,' ')}</span>
                {w.healing_progress && <span className={`text-[10px] font-medium ${w.healing_progress === 'improving' ? 'text-green-600' : w.healing_progress === 'worsening' ? 'text-red-600' : 'text-yellow-600'}`}>{w.healing_progress}</span>}
              </div>
              <span className="text-xs text-gray-400">{new Date(w.created_at).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {w.length_cm && <div><span className="text-gray-500">Size:</span> {w.length_cm}x{w.width_cm}x{w.depth_cm} cm</div>}
              {w.wound_bed && <div><span className="text-gray-500">Bed:</span> {w.wound_bed}</div>}
              {w.exudate_amount && <div><span className="text-gray-500">Exudate:</span> {w.exudate_amount} ({w.exudate_type})</div>}
              {w.dressing_type && <div><span className="text-gray-500">Dressing:</span> {w.dressing_type}</div>}
            </div>
            {w.infection_signs && <div className="text-xs text-red-600 mt-1 font-medium">Signs of infection present</div>}
            {w.notes && <div className="text-xs text-gray-500 mt-1">{w.notes}</div>}
          </div>
        ))}</div>}
      </div>}

      {/* ===== BILLING ===== */}
      {tab === 'billing' && <div>
        <h2 className="font-semibold text-sm mb-3">Homecare Billing</h2>
        {!selectedEnrollId ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">Select a patient from Patients tab first</div> :
        billing.bills.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No bills generated</div> :
        <div className="space-y-2">{billing.bills.map((b: any) => (
          <div key={b.id} className="bg-white rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{b.bill_date} — Rs.{parseFloat(b.total).toLocaleString('en-IN')}</span>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${b.status === 'paid' ? 'bg-green-100 text-green-700' : b.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{b.status}</span>
                {b.status !== 'paid' && <span className="text-xs text-red-600">Balance: Rs.{parseFloat(b.balance).toLocaleString('en-IN')}</span>}
              </div>
            </div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== RATE CARD ===== */}
      {tab === 'rates' && <div>
        <h2 className="font-semibold text-sm mb-3">Homecare Service Rate Card</h2>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="text-left p-2.5">Code</th><th className="text-left p-2.5">Service</th><th className="p-2.5">Category</th><th className="p-2.5 text-right">Rate (Rs.)</th><th className="p-2.5">Unit</th>
        </tr></thead><tbody>{rates.rates.map((r: any) => (
          <tr key={r.id} className="border-b hover:bg-gray-50">
            <td className="p-2.5 font-mono text-[10px]">{r.service_code}</td>
            <td className="p-2.5 font-medium">{r.service_name}</td>
            <td className="p-2.5 text-center"><span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{r.category.replace(/_/g,' ')}</span></td>
            <td className="p-2.5 text-right font-medium">{parseFloat(r.rate).toLocaleString('en-IN')}</td>
            <td className="p-2.5 text-center text-gray-500">{r.unit.replace(/_/g,' ')}</td>
          </tr>
        ))}</tbody></table></div>
      </div>}
    </div>
  );
}

export default function HomecareRoute() { return <RoleGuard module="homecare"><HomecarePage /></RoleGuard>; }
