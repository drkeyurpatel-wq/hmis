'use client';
import React, { useState, useEffect } from 'react';
import { BLOOD_GROUPS, COMPONENT_TYPES } from '@/lib/lab/blood-bank-hooks';
import { sb } from '@/lib/supabase/browser';

interface RequestsTabProps {
  requests: any[];
  create: (req: any, staffId: string) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
  staffId: string;
  groupColor: (g: string) => string;
  flash: (m: string) => void;
}

export default function RequestsTab({ requests, create, updateStatus, staffId, groupColor, flash }: RequestsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [reqForm, setReqF] = useState({ patientSearch: '', patientId: '', bloodGroup: 'O+', componentType: 'prbc', unitsRequested: 1, urgency: 'routine', indication: '' });
  const [patResults, setPatResults] = useState<any[]>([]);

  useEffect(() => {
    if (reqForm.patientSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, blood_group')
        .or(`uhid.ilike.%${reqForm.patientSearch}%,first_name.ilike.%${reqForm.patientSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [reqForm.patientSearch]);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Blood Requests</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Request'}</button>
      </div>
      {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        <div className="relative">
          <label className="text-xs text-gray-500">Patient *</label>
          {reqForm.patientId ? <div className="bg-blue-50 rounded-lg p-2 flex justify-between items-center"><span className="text-sm font-medium">{patResults.find(p => p.id === reqForm.patientId)?.first_name} — {patResults.find(p => p.id === reqForm.patientId)?.uhid}</span><button onClick={() => setReqF(f => ({...f, patientId: '', patientSearch: ''}))} className="text-xs text-red-500">Change</button></div> :
          <><input type="text" value={reqForm.patientSearch} onChange={e => setReqF(f => ({...f, patientSearch: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search patient..." />
          {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10">
            {patResults.map(p => <button key={p.id} onClick={() => { setReqF(f => ({...f, patientId: p.id, bloodGroup: p.blood_group || f.bloodGroup})); setPatResults([]); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">{p.first_name} {p.last_name} — {p.uhid} ({p.blood_group || '?'})</button>)}
          </div>}</>}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Blood group *</label>
            <select value={reqForm.bloodGroup} onChange={e => setReqF(f => ({...f, bloodGroup: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Component *</label>
            <select value={reqForm.componentType} onChange={e => setReqF(f => ({...f, componentType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {COMPONENT_TYPES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Units *</label>
            <input type="number" min="1" max="10" value={reqForm.unitsRequested} onChange={e => setReqF(f => ({...f, unitsRequested: parseInt(e.target.value)||1}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Urgency</label>
            <select value={reqForm.urgency} onChange={e => setReqF(f => ({...f, urgency: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['routine','urgent','emergency'].map(u => <option key={u}>{u}</option>)}</select></div>
        </div>
        <div><label className="text-xs text-gray-500">Clinical indication</label>
          <input type="text" value={reqForm.indication} onChange={e => setReqF(f => ({...f, indication: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Pre-operative, severe anemia, DIC, massive transfusion..." /></div>
        <button onClick={async () => { if (!reqForm.patientId) return; await create(reqForm, staffId); flash('Blood request submitted'); setShowForm(false); }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Submit Request</button>
      </div>}
      {requests.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No blood requests</div> :
      <div className="space-y-2">{requests.map((r: any) => (
        <div key={r.id} className={`bg-white rounded-lg border p-3 ${r.urgency === 'emergency' ? 'border-red-300 bg-red-50/30' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{r.patient?.first_name} {r.patient?.last_name}</span>
              <span className="text-xs text-gray-400">{r.patient?.uhid}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(r.blood_group)}`}>{r.blood_group}</span>
              <span className="text-xs">{r.units_requested} unit(s) {r.component_type.replace(/_/g, ' ')}</span>
              {r.urgency === 'emergency' && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse">EMERGENCY</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : r.status === 'ready' ? 'bg-green-100 text-green-700' : r.status === 'issued' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>{r.status}</span>
              {r.status === 'pending' && <button onClick={() => updateStatus(r.id, 'crossmatching')} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded">Start XM</button>}
              {r.status === 'crossmatching' && <button onClick={() => updateStatus(r.id, 'ready')} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded">Ready</button>}
            </div>
          </div>
          {r.clinical_indication && <div className="text-xs text-gray-500 mt-1">Indication: {r.clinical_indication}</div>}
          <div className="text-[10px] text-gray-400 mt-1">Requested by: {r.doctor?.full_name} | {new Date(r.requested_at).toLocaleString('en-IN')}</div>
        </div>
      ))}</div>}
    </div>
  );
}
