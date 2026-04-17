'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  Search, User, Shield, FileText, ArrowLeft, CheckCircle,
  Building2, Stethoscope, IndianRupee, AlertCircle, Loader2,
} from 'lucide-react';
import { CLAIM_TYPE_LABELS, type ClaimType, type Payer } from '@/lib/claims/types';
import { fetchPayers, searchHMISPatients, fetchActiveAdmissions, fetchPatientInsurance, createClaim } from '@/lib/claims/api';

export default function NewClaimPage() {
  const router = useRouter();
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  // Step tracking
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=patient, 2=payer+clinical, 3=review
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  // Admission & Insurance
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [selectedInsurance, setSelectedInsurance] = useState<any>(null);

  // Payer & claim details
  const [payers, setPayers] = useState<Payer[]>([]);
  const [selectedPayer, setSelectedPayer] = useState('');
  const [claimType, setClaimType] = useState<ClaimType>('cashless');

  // Clinical
  const [diagnosis, setDiagnosis] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [procedure, setProcedure] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Load payers on mount
  useEffect(() => { fetchPayers().then(setPayers).catch(console.error); }, []);

  // Patient search with debounce
  useEffect(() => {
    if (patientSearch.length < 2) { setPatients([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchHMISPatients(patientSearch, centreId);
        setPatients(data);
      } catch (e) { console.error(e); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch, centreId]);

  // When patient selected, load admissions & insurance
  const selectPatient = useCallback(async (patient: any) => {
    setSelectedPatient(patient);
    setPatientSearch('');
    setPatients([]);
    try {
      const [adm, ins] = await Promise.all([
        fetchActiveAdmissions(patient.id),
        fetchPatientInsurance(patient.id),
      ]);
      setAdmissions(adm);
      setInsurances(ins);
      if (adm.length === 1) setSelectedAdmission(adm[0]);
      if (ins.length === 1) setSelectedInsurance(ins[0]);
    } catch (e) { console.error(e); }
  }, []);

  // Auto-populate payer from insurance
  useEffect(() => {
    if (!selectedInsurance || payers.length === 0) return;
    // Try to match TPA first, then insurer
    const tpaCode = selectedInsurance.hmis_tpas?.code;
    const insurerCode = selectedInsurance.hmis_insurers?.code;
    const match = payers.find(p =>
      (tpaCode && p.code === tpaCode) ||
      (insurerCode && p.code === insurerCode)
    );
    if (match) setSelectedPayer(match.id);
  }, [selectedInsurance, payers]);

  // Submit claim
  const handleSubmit = async () => {
    if (!selectedPatient || !selectedPayer || !centreId) {
      setError('Patient and payer are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payer = payers.find(p => p.id === selectedPayer);
      const claim = await createClaim({
        centre_id: centreId,
        payer_id: selectedPayer,
        claim_type: claimType,
        patient_id: selectedPatient.id,
        admission_id: selectedAdmission?.id || null,
        insurance_id: selectedInsurance?.id || null,
        treating_doctor_id: selectedAdmission?.treating_doctor_id || null,
        patient_name: selectedPatient.name,
        patient_phone: selectedPatient.phone,
        patient_uhid: selectedPatient.uhid,
        abha_id: selectedPatient.abha_id,
        policy_number: selectedInsurance?.policy_number || null,
        policy_holder_name: selectedInsurance?.policy_holder_name || selectedPatient.name,
        primary_diagnosis: diagnosis || null,
        icd_code: icdCode || null,
        procedure_name: procedure || null,
        treating_doctor_name: selectedAdmission?.hmis_staff?.name || null,
        department_name: selectedAdmission?.hmis_departments?.name || null,
        admission_date: selectedAdmission?.admission_date || null,
        estimated_amount: estimatedAmount ? parseFloat(estimatedAmount) : null,
        notes: notes || null,
        created_by: staff?.id || null,
      } as any);
      router.push(`/claims/${claim.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create claim');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/claims')} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Claim</h1>
            <p className="text-sm text-gray-500">Auto-populated from HMIS patient data</p>
          </div>
        </div>
        {/* Step indicator */}
        <div className="flex gap-2 mt-4">
          {[
            { n: 1, label: 'Select Patient' },
            { n: 2, label: 'Claim Details' },
            { n: 3, label: 'Review & Create' },
          ].map(s => (
            <div key={s.n} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              step === s.n ? 'bg-blue-600 text-white' :
              step > s.n ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {step > s.n ? <CheckCircle className="w-3 h-3" /> : null}
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* STEP 1: Patient Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Search Patient
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, UHID, or phone..."
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
              </div>
              {patients.length > 0 && (
                <div className="mt-2 border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {patients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{p.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{p.uhid}</span>
                        {p.phone && <span className="text-xs text-gray-400 ml-2">{p.phone}</span>}
                      </div>
                      <span className="text-xs text-gray-400">{p.gender} {p.dob ? `• ${new Date().getFullYear() - new Date(p.dob).getFullYear()}y` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Patient Card */}
            {selectedPatient && (
              <>
                <div className="bg-white rounded-xl border p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Selected Patient</h2>
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                    <div>
                      <p className="font-semibold text-gray-900">{selectedPatient.name}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.uhid} • {selectedPatient.phone}</p>
                      {selectedPatient.abha_id && <p className="text-xs text-blue-600">ABHA: {selectedPatient.abha_id}</p>}
                    </div>
                    <button onClick={() => { setSelectedPatient(null); setAdmissions([]); setInsurances([]); }}
                      className="text-xs text-red-500 hover:underline">Change</button>
                  </div>
                </div>

                {/* Admissions */}
                {admissions.length > 0 && (
                  <div className="bg-white rounded-xl border p-5">
                    <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" /> Link to Admission
                    </h2>
                    <div className="space-y-2">
                      {admissions.map(a => (
                        <label key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                          selectedAdmission?.id === a.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}>
                          <input type="radio" name="admission" checked={selectedAdmission?.id === a.id}
                            onChange={() => setSelectedAdmission(a)} className="text-blue-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{a.admission_number || 'Admission'}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(a.admission_date).toLocaleDateString('en-IN')}
                              {a.hmis_staff?.name && ` • Dr. ${a.hmis_staff.name}`}
                              {a.hmis_departments?.name && ` • ${a.hmis_departments.name}`}
                            </p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>{a.status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Insurance */}
                {insurances.length > 0 && (
                  <div className="bg-white rounded-xl border p-5">
                    <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Patient Insurance
                    </h2>
                    <div className="space-y-2">
                      {insurances.map(ins => (
                        <label key={ins.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                          selectedInsurance?.id === ins.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}>
                          <input type="radio" name="insurance" checked={selectedInsurance?.id === ins.id}
                            onChange={() => setSelectedInsurance(ins)} className="text-blue-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{ins.hmis_insurers?.name || 'Insurance'}</p>
                            <p className="text-xs text-gray-500">
                              Policy: {ins.policy_number}
                              {ins.hmis_tpas?.name && ` • TPA: ${ins.hmis_tpas.name}`}
                              {ins.scheme && ` • ${ins.scheme.toUpperCase()}`}
                            </p>
                          </div>
                          {ins.is_primary && <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">Primary</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep(2)}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Continue to Claim Details →
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 2: Claim Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Payer & Claim Type
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Payer / TPA / Insurer *</label>
                  <select value={selectedPayer} onChange={e => setSelectedPayer(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg">
                    <option value="">Select payer...</option>
                    <optgroup label="TPAs">
                      {payers.filter(p => p.type === 'tpa').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                    <optgroup label="Insurers">
                      {payers.filter(p => p.type === 'insurer').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                    <optgroup label="Government">
                      {payers.filter(p => p.type === 'government').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                    <optgroup label="PSU">
                      {payers.filter(p => p.type === 'psu').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Claim Type *</label>
                  <select value={claimType} onChange={e => setClaimType(e.target.value as ClaimType)}
                    className="w-full px-3 py-2 text-sm border rounded-lg">
                    {Object.entries(CLAIM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> Clinical Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Primary Diagnosis</label>
                  <input type="text" value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Appendicitis" className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">ICD-10 Code</label>
                  <input type="text" value={icdCode} onChange={e => setIcdCode(e.target.value)}
                    placeholder="e.g. K35.80" className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Procedure</label>
                  <input type="text" value={procedure} onChange={e => setProcedure(e.target.value)}
                    placeholder="e.g. Laparoscopic Appendectomy" className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                    <IndianRupee className="w-3 h-3" /> Estimated Amount
                  </label>
                  <input type="number" value={estimatedAmount} onChange={e => setEstimatedAmount(e.target.value)}
                    placeholder="e.g. 150000" className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Any additional notes..." className="w-full px-3 py-2 text-sm border rounded-lg" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                ← Back
              </button>
              <button onClick={() => setStep(3)} disabled={!selectedPayer}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                Review & Create →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Review & Create */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Review Claim</h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div><span className="text-gray-500">Patient:</span> <span className="font-medium">{selectedPatient?.name}</span></div>
                <div><span className="text-gray-500">UHID:</span> <span className="font-medium">{selectedPatient?.uhid || '—'}</span></div>
                <div><span className="text-gray-500">Payer:</span> <span className="font-medium">{payers.find(p => p.id === selectedPayer)?.name || '—'}</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="font-medium">{CLAIM_TYPE_LABELS[claimType]}</span></div>
                {selectedAdmission && <div><span className="text-gray-500">Admission:</span> <span className="font-medium">{new Date(selectedAdmission.admission_date).toLocaleDateString('en-IN')}</span></div>}
                {selectedAdmission?.hmis_staff?.name && <div><span className="text-gray-500">Doctor:</span> <span className="font-medium">Dr. {selectedAdmission.hmis_staff.name}</span></div>}
                {diagnosis && <div><span className="text-gray-500">Diagnosis:</span> <span className="font-medium">{diagnosis}</span></div>}
                {icdCode && <div><span className="text-gray-500">ICD:</span> <span className="font-mono font-medium">{icdCode}</span></div>}
                {procedure && <div><span className="text-gray-500">Procedure:</span> <span className="font-medium">{procedure}</span></div>}
                {estimatedAmount && <div><span className="text-gray-500">Estimated:</span> <span className="font-semibold text-blue-700">₹{parseInt(estimatedAmount).toLocaleString('en-IN')}</span></div>}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><CheckCircle className="w-4 h-4" /> Create Claim</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
