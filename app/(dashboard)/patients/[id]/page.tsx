'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export default function PatientDetailPage() {
  const { id } = useParams();
  const patientId = id as string;
  const { staff, activeCentreId } = useAuthStore();
  const [patient, setPatient] = useState<any>(null);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState('overview');
  const [toast, setToast] = useState('');

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // Load all patient data
  useEffect(() => {
    if (!patientId || !sb()) return;
    async function load() {
      const { data: pt } = await sb().from('hmis_patients').select('*').eq('id', patientId).single();
      if (pt) { setPatient(pt); setEditForm(pt); }

      const { data: alg } = await sb().from('hmis_patient_allergies').select('*').eq('patient_id', patientId);
      setAllergies(alg || []);

      const { data: enc } = await sb().from('hmis_emr_encounters')
        .select('id, encounter_date, encounter_type, status, primary_diagnosis_code, primary_diagnosis_label, prescription_count, investigation_count, doctor:hmis_staff(full_name)')
        .eq('patient_id', patientId).order('encounter_date', { ascending: false }).limit(50);
      setEncounters(enc || []);

      const { data: vis } = await sb().from('hmis_opd_visits')
        .select('id, visit_number, token_number, status, check_in_time, doctor:hmis_staff(full_name)')
        .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20);
      setVisits(vis || []);

      const { data: bl } = await sb().from('hmis_bills')
        .select('id, bill_number, bill_type, net_amount, paid_amount, balance_amount, status, bill_date')
        .eq('patient_id', patientId).order('bill_date', { ascending: false }).limit(20);
      setBills(bl || []);

      setLoading(false);
    }
    load();
  }, [patientId]);

  const saveEdit = async () => {
    if (!sb() || !patientId) return;
    const { error } = await sb().from('hmis_patients').update({
      first_name: editForm.first_name, last_name: editForm.last_name, middle_name: editForm.middle_name,
      date_of_birth: editForm.date_of_birth, gender: editForm.gender, blood_group: editForm.blood_group,
      phone_primary: editForm.phone_primary, phone_secondary: editForm.phone_secondary, email: editForm.email,
      address_line1: editForm.address_line1, city: editForm.city, state: editForm.state, pincode: editForm.pincode,
      marital_status: editForm.marital_status, occupation: editForm.occupation,
    }).eq('id', patientId);
    if (!error) {
      setPatient(editForm); setEditing(false); flash('Patient updated');
    } else flash('Error: ' + error.message);
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading patient...</div>;
  if (!patient) return <div className="text-center py-12 text-gray-400">Patient not found</div>;

  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : patient.age_years || '--';
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');
  const totalBilled = bills.reduce((s: number, b: any) => s + (b.net_amount || 0), 0);
  const totalPaid = bills.reduce((s: number, b: any) => s + (b.paid_amount || 0), 0);
  const totalDue = bills.reduce((s: number, b: any) => s + (b.balance_amount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">{patient.first_name?.charAt(0)}{patient.last_name?.charAt(0)}</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{patient.uhid}</span>
                <span>{age} yrs / {patient.gender?.toUpperCase()}</span>
                {patient.blood_group && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">{patient.blood_group}</span>}
                <span>{patient.phone_primary}</span>
              </div>
              {allergies.length > 0 && <div className="flex items-center gap-1.5 mt-2">{allergies.map((a: any, i: number) =>
                <span key={i} className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">{a.allergen} ({a.severity})</span>
              )}</div>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)} className="px-4 py-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">{editing ? 'Cancel' : 'Edit'}</button>
            <Link href={`/emr-v2?patient=${patientId}`} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">New Encounter</Link>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Visits</div><div className="font-bold text-lg">{visits.length}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Encounters</div><div className="font-bold text-lg">{encounters.length}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Total billed</div><div className="font-bold text-lg">Rs.{totalBilled.toLocaleString('en-IN')}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Paid</div><div className="font-bold text-lg text-green-600">Rs.{totalPaid.toLocaleString('en-IN')}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Due</div><div className="font-bold text-lg text-red-600">Rs.{totalDue.toLocaleString('en-IN')}</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">{[['overview','Overview'],['encounters','Encounters'],['billing','Billing'],['edit','Edit Details']].map(([k,l]) =>
        <button key={k} onClick={() => { setActiveTab(k); if (k === 'edit') setEditing(true); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
      )}</div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Recent encounters */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-sm mb-3">Recent encounters</h2>
            {encounters.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No encounters</p> :
            <div className="space-y-2">{encounters.slice(0, 8).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div><div className="text-sm font-medium">{e.encounter_date}</div>
                  <div className="text-xs text-gray-400">{e.primary_diagnosis_code} {e.primary_diagnosis_label} | {e.doctor?.full_name}</div></div>
                <div className="text-right"><span className={`px-2 py-0.5 rounded-full text-xs ${e.status === 'signed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.status}</span>
                  <div className="text-xs text-gray-400 mt-0.5">{e.prescription_count} meds, {e.investigation_count} labs</div></div>
              </div>
            ))}</div>}
          </div>

          {/* Demographics */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-sm mb-3">Demographics</h2>
            <div className="space-y-2 text-sm">
              {[['DOB', patient.date_of_birth || '--'], ['Gender', patient.gender], ['Blood group', patient.blood_group || '--'],
                ['Phone', patient.phone_primary], ['Alt phone', patient.phone_secondary || '--'], ['Email', patient.email || '--'],
                ['Address', [patient.address_line1, patient.city, patient.state, patient.pincode].filter(Boolean).join(', ') || '--'],
                ['Marital status', patient.marital_status || '--'], ['Occupation', patient.occupation || '--'],
                ['ID type', patient.id_type || '--'], ['ID number', patient.id_number || '--'],
                ['Registered', new Date(patient.created_at).toLocaleDateString('en-IN')],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-gray-500">{label}</span><span className="font-medium text-right max-w-[60%] truncate">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'encounters' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-500">Date</th><th className="text-left p-3 font-medium text-gray-500">Type</th>
            <th className="text-left p-3 font-medium text-gray-500">Diagnosis</th><th className="text-left p-3 font-medium text-gray-500">Doctor</th>
            <th className="text-left p-3 font-medium text-gray-500">Meds</th><th className="text-left p-3 font-medium text-gray-500">Status</th>
          </tr></thead><tbody>{encounters.map((e: any) => (
            <tr key={e.id} className="border-b hover:bg-gray-50">
              <td className="p-3">{e.encounter_date}</td><td className="p-3 text-xs">{e.encounter_type}</td>
              <td className="p-3"><span className="font-mono text-xs text-blue-600">{e.primary_diagnosis_code}</span> {e.primary_diagnosis_label || '—'}</td>
              <td className="p-3 text-xs">{e.doctor?.full_name}</td>
              <td className="p-3 text-xs">{e.prescription_count} meds, {e.investigation_count} labs</td>
              <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${e.status === 'signed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.status}</span></td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-500">Bill #</th><th className="text-left p-3 font-medium text-gray-500">Date</th>
            <th className="text-left p-3 font-medium text-gray-500">Type</th><th className="text-right p-3 font-medium text-gray-500">Amount</th>
            <th className="text-right p-3 font-medium text-gray-500">Paid</th><th className="text-right p-3 font-medium text-gray-500">Due</th>
            <th className="text-left p-3 font-medium text-gray-500">Status</th>
          </tr></thead><tbody>{bills.map((b: any) => (
            <tr key={b.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs text-blue-600">{b.bill_number}</td><td className="p-3">{b.bill_date}</td>
              <td className="p-3 text-xs">{b.bill_type.toUpperCase()}</td>
              <td className="p-3 text-right font-medium">Rs.{(b.net_amount || 0).toLocaleString('en-IN')}</td>
              <td className="p-3 text-right text-green-600">Rs.{(b.paid_amount || 0).toLocaleString('en-IN')}</td>
              <td className="p-3 text-right text-red-600">{b.balance_amount > 0 ? 'Rs.' + b.balance_amount.toLocaleString('en-IN') : '—'}</td>
              <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${b.status === 'paid' ? 'bg-green-100 text-green-700' : b.balance_amount > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{b.status}</span></td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {(activeTab === 'edit' || editing) && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Edit patient details</h2>
          <div className="grid grid-cols-2 gap-4">
            {[['first_name','First name *'],['middle_name','Middle name'],['last_name','Last name *'],['date_of_birth','Date of birth'],
              ['phone_primary','Phone *'],['phone_secondary','Alt phone'],['email','Email'],
              ['address_line1','Address'],['city','City'],['state','State'],['pincode','Pincode'],
              ['occupation','Occupation'],
            ].map(([k,l]) => (
              <div key={k}><label className="text-xs text-gray-500 mb-1 block">{l}</label>
                <input type={k === 'date_of_birth' ? 'date' : k === 'email' ? 'email' : 'text'} value={editForm[k] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [k]: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            ))}
            <div><label className="text-xs text-gray-500 mb-1 block">Gender</label>
              <select value={editForm.gender || ''} onChange={e => setEditForm((p: any) => ({ ...p, gender: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Blood group</label>
              <select value={editForm.blood_group || ''} onChange={e => setEditForm((p: any) => ({ ...p, blood_group: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Marital status</label>
              <select value={editForm.marital_status || ''} onChange={e => setEditForm((p: any) => ({ ...p, marital_status: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select</option>{['Single','Married','Divorced','Widowed'].map(ms => <option key={ms}>{ms}</option>)}</select></div>
          </div>
          <div className="flex gap-2 mt-6"><button onClick={saveEdit} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save changes</button>
            <button onClick={() => { setEditing(false); setActiveTab('overview'); setEditForm(patient); }} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button></div>
        </div>
      )}
    </div>
  );
}
