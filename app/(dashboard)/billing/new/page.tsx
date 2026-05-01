// HEALTH1 HMIS — NEW BILLING ENCOUNTER
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, User, Bed, Activity, Clock, Shield, ChevronRight, Zap, Stethoscope, X } from 'lucide-react';
import type { PayorType, EncounterType } from '@/lib/billing/billing-v2-types';
import { PAYOR_TYPE_LABELS } from '@/lib/billing/billing-v2-types';

export default function NewEncounterPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [encounterType, setEncounterType] = useState<EncounterType>('OPD');
  const [payorType, setPayorType] = useState<PayorType>('SELF_PAY');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [tpaId, setTpaId] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [insuranceCompanies, setInsuranceCompanies] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const centreId = 'CURRENT_CENTRE_ID';

  const searchPatients = useCallback(async (term: string) => {
    if (term.length < 2) { setPatients([]); return; }
    try { const res = await fetch(`/api/patients/search?q=${encodeURIComponent(term)}&limit=10`); if (res.ok) setPatients(await res.json()); } catch { /* */ }
  }, []);

  useEffect(() => { const t = setTimeout(() => searchPatients(patientSearch), 300); return () => clearTimeout(t); }, [patientSearch, searchPatients]);
  useEffect(() => { (async () => { try { const res = await fetch(`/api/doctors?centre_id=${centreId}&is_active=true`); if (res.ok) setDoctors(await res.json()); } catch {} })(); }, [centreId]);
  useEffect(() => { if (payorType === 'SELF_PAY' || payorType === 'STAFF') return; (async () => { try { const res = await fetch(`/api/billing/settings/insurance-companies?centre_id=${centreId}`); if (res.ok) setInsuranceCompanies(await res.json()); } catch {} })(); }, [centreId, payorType]);

  const handleSubmit = async () => {
    if (!selectedPatient || submitting) return;
    setSubmitting(true);
    try {
      const body: any = { centre_id: centreId, patient_id: selectedPatient.id, encounter_type: encounterType, primary_payor_type: payorType };
      if (encounterType === 'OPD') body.consulting_doctor_id = doctorId || null; else body.admitting_doctor_id = doctorId || null;
      if (!['SELF_PAY', 'STAFF'].includes(payorType)) { body.insurance_company_id = insuranceCompanyId || null; body.tpa_id = tpaId || null; body.insurance_policy_number = policyNumber || null; }
      const res = await fetch('/api/billing/encounters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
      const encounter = await res.json();
      router.push(`/billing/${encounter.id}`);
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setSubmitting(false); }
  };

  useEffect(() => { searchRef.current?.focus(); }, []);
  const encounterTypes: Array<{ type: EncounterType; label: string; icon: any; desc: string; color: string }> = [
    { type: 'OPD', label: 'OPD', icon: Stethoscope, desc: 'Outpatient visit', color: 'border-blue-200 bg-blue-50 text-blue-700' },
    { type: 'IPD', label: 'IPD', icon: Bed, desc: 'Inpatient admission', color: 'border-purple-200 bg-purple-50 text-purple-700' },
    { type: 'ER', label: 'ER', icon: Activity, desc: 'Emergency', color: 'border-red-200 bg-red-50 text-red-700' },
    { type: 'DAYCARE', label: 'Day Care', icon: Clock, desc: 'Day procedure', color: 'border-amber-200 bg-amber-50 text-amber-700' },
  ];
  const isInsured = !['SELF_PAY', 'STAFF'].includes(payorType);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/billing')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-600" /></button>
          <div><h1 className="text-lg font-bold text-[#0A2540]">New Billing Encounter</h1><p className="text-xs text-gray-500">Create OPD / IPD / ER / Day Care billing</p></div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><User className="h-4 w-4 text-[#00B4D8]" /> Patient</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input ref={searchRef} type="text" value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }} placeholder="Search: name, UHID, phone..." className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" />
            {patients.length > 0 && !selectedPatient && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg">
                {patients.map((p: any) => (
                  <button key={p.id} onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch(`${p.first_name} ${p.last_name || ''} (${p.uhid})`); }} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-50">
                    <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name || ''}</p>
                    <p className="text-xs text-gray-500">{p.uhid} - {p.phone}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedPatient && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-center justify-between">
              <div><p className="text-sm font-semibold text-blue-900">{selectedPatient.first_name} {selectedPatient.last_name || ''}</p><p className="text-xs text-blue-700">{selectedPatient.uhid} - {selectedPatient.phone} - {selectedPatient.gender}</p></div>
              <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="p-1 rounded hover:bg-blue-100"><X className="h-4 w-4 text-blue-600" /></button>
            </div>
          )}
        </div>

        {selectedPatient && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Encounter Type</h2>
            <div className="grid grid-cols-4 gap-2">
              {encounterTypes.map(et => (
                <button key={et.type} onClick={() => setEncounterType(et.type)} className={`rounded-lg border p-3 text-center transition-all ${encounterType === et.type ? et.color + ' ring-2 ring-offset-1' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <et.icon className="h-5 w-5 mx-auto mb-1" /><p className="text-xs font-bold">{et.label}</p><p className="text-[10px] mt-0.5 opacity-70">{et.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPatient && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{encounterType === 'OPD' ? 'Consulting Doctor' : 'Admitting Doctor'}</label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30">
                <option value="">— Select Doctor —</option>
                {doctors.map((d: any) => (<option key={d.id} value={d.id}>{d.name} ({d.department})</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Payor Type</label>
              <div className="grid grid-cols-4 gap-2">
                {(['SELF_PAY', 'PMJAY', 'TPA', 'CORPORATE'] as PayorType[]).map(pt => (
                  <button key={pt} onClick={() => setPayorType(pt)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${payorType === pt ? 'border-[#00B4D8] bg-[#00B4D8]/10 text-[#00B4D8]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {PAYOR_TYPE_LABELS[pt]}
                  </button>
                ))}
              </div>
            </div>
            {isInsured && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-blue-600" /><span className="text-xs font-bold text-blue-800">Insurance Details</span></div>
                <select value={insuranceCompanyId} onChange={(e) => setInsuranceCompanyId(e.target.value)} className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">— Select Insurance Company —</option>
                  {insuranceCompanies.map((ic: any) => (<option key={ic.id} value={ic.id}>{ic.company_name} ({ic.company_code})</option>))}
                </select>
                <input type="text" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="Policy / Card Number" className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            )}
          </div>
        )}

        {selectedPatient && (
          <button onClick={handleSubmit} disabled={submitting} className="w-full rounded-xl bg-[#0A2540] py-3.5 text-sm font-bold text-white hover:bg-[#0A2540]/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? 'Creating...' : (<><Zap className="h-4 w-4" /> Create {encounterType} Encounter & Start Billing</>)}
          </button>
        )}
      </div>
    </div>
  );
}
