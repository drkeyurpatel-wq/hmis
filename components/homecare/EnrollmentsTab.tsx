'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

interface EnrollmentsTabProps {
  enrollments: any[];
  enroll: (data: any, staffId: string) => Promise<any>;
  updateStatus: (id: string, status: string) => Promise<void>;
  staffId: string;
  selectedEnrollId: string | null;
  setSelectedEnrollId: (id: string) => void;
  progColor: (p: string) => string;
  stColor: (s: string) => string;
  flash: (m: string) => void;
}

export default function EnrollmentsTab({ enrollments, enroll, updateStatus, staffId, selectedEnrollId, setSelectedEnrollId, progColor, stColor, flash }: EnrollmentsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [eForm, setEF] = useState({ patient_id: '', program_type: 'post_discharge', primary_diagnosis: '', address_line1: '', city: 'Ahmedabad', pincode: '', primary_contact_name: '', primary_contact_phone: '', visit_frequency: 'daily', estimated_duration_weeks: 4, special_instructions: '' });
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);

  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Homecare Patients</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ Enroll Patient'}</button>
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
        <button onClick={async () => { if (!eForm.patient_id || !eForm.address_line1) return; const r = await enroll(eForm, staffId); if (r) { flash('Enrolled: ' + r.enrollment_number); setShowForm(false); } }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Enroll</button>
      </div>}
      {enrollments.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No homecare patients</div> :
      <div className="space-y-2">{enrollments.map((e: any) => (
        <div key={e.id} className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-green-300 ${selectedEnrollId === e.id ? 'border-green-500 bg-green-50/30' : ''}`} onClick={() => setSelectedEnrollId(e.id)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{e.patient?.first_name} {e.patient?.last_name}</span>
              <span className="font-mono text-xs text-gray-400">{e.enrollment_number}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${progColor(e.program_type)}`}>{e.program_type.replace(/_/g,' ')}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(e.status)}`}>{e.status}</span>
            </div>
            <div className="flex gap-1">
              {e.status === 'active' && <button onClick={(ev) => { ev.stopPropagation(); updateStatus(e.id, 'paused'); flash('Paused'); }} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] rounded">Pause</button>}
              {e.status === 'paused' && <button onClick={(ev) => { ev.stopPropagation(); updateStatus(e.id, 'active'); flash('Resumed'); }} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded">Resume</button>}
              {e.status === 'active' && <button onClick={(ev) => { ev.stopPropagation(); updateStatus(e.id, 'discharged'); flash('Discharged'); }} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">Discharge</button>}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">{e.primary_diagnosis} | {e.visit_frequency?.replace(/_/g,' ')} | {e.address_line1?.substring(0, 50)}</div>
          <div className="text-[10px] text-gray-400">Since {e.start_date} | Dr. {e.doctor?.full_name || '—'} | Nurse: {e.nurse?.full_name || '—'}</div>
        </div>
      ))}</div>}
    </div>
  );
}
