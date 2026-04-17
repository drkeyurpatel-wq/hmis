// @ts-nocheck
// HEALTH1 HMIS — NEW CLAIM WIZARD (Zero Re-Entry from HMIS)
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import {
  Search, User, Shield, FileText, Stethoscope, IndianRupee,
  CheckCircle2, AlertCircle, Loader2, Building2, ArrowRight,
  ArrowLeft, Calendar, Phone, Hash, Zap, ChevronRight, Activity,
} from 'lucide-react';
import { CLAIM_TYPE_LABELS, type ClaimType } from '@/lib/claims/types';
import {
  fetchPayers, searchHMISPatients, fetchActiveAdmissions,
  fetchPatientInsurance, createClaim,
} from '@/lib/claims/api';

// ─── HMIS Design Tokens ───
const CI = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-h1-teal focus:ring-1 focus:ring-h1-teal bg-white';
const CL = 'block text-xs font-semibold text-gray-600 mb-1';
const CC = 'bg-white rounded-2xl border border-gray-200 shadow-sm p-6';

const STEPS = ['Find Patient', 'Admission & Payer', 'Clinical Details', 'Review & Create'];

export default function NewClaimPage() {
  const router = useRouter();
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const searchRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // ─── Step 1: Patient Search ───
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  // ─── Step 2: Admission + Payer ───
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [selectedInsurance, setSelectedInsurance] = useState<any>(null);
  const [payers, setPayers] = useState<any[]>([]);
  const [selectedPayer, setSelectedPayer] = useState('');
  const [payerSearch, setPayerSearch] = useState('');
  const [claimType, setClaimType] = useState<ClaimType>('cashless');

  // ─── Step 3: Clinical ───
  const [diagnosis, setDiagnosis] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [procedure, setProcedure] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Load payers
  useEffect(() => { fetchPayers().then(setPayers); }, []);

  // Focus search on mount
  useEffect(() => { searchRef.current?.focus(); }, []);

  // ─── Patient Search (debounced) ───
  useEffect(() => {
    if (patientSearch.length < 2) { setPatients([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const data = await searchHMISPatients(patientSearch, centreId);
      setPatients(data);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch, centreId]);

  // ─── Select Patient → Auto-load admissions + insurance ───
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
      // Auto-select if only one
      if (adm.length === 1) selectAdmission(adm[0]);
      if (ins.length === 1) setSelectedInsurance(ins[0]);
      // Auto-advance to step 2
      setStep(2);
    } catch (e) { console.error(e); }
  }, []);

  // ─── Select Admission → Auto-populate clinical ───
  const selectAdmission = (adm: any) => {
    setSelectedAdmission(adm);
    // Auto-populate from admission data
    if (adm.provisional_diagnosis) setDiagnosis(adm.provisional_diagnosis);
    if (adm.final_diagnosis) setDiagnosis(adm.final_diagnosis); // final overrides provisional
    if (adm.icd_codes) setIcdCode(adm.icd_codes);
    // Detect claim type from admission payor_type
    if (adm.payor_type === 'insurance') setClaimType('cashless');
    else if (adm.payor_type === 'pmjay') setClaimType('pmjay');
  };

  // ─── Auto-match payer from insurance ───
  useEffect(() => {
    if (!selectedInsurance || payers.length === 0) return;
    const tpaCode = selectedInsurance.hmis_tpas?.code;
    const insurerCode = selectedInsurance.hmis_insurers?.code;
    const match = payers.find(p =>
      (tpaCode && p.code === tpaCode) || (insurerCode && p.code === insurerCode)
    );
    if (match) {
      setSelectedPayer(match.id);
      flash(`Auto-matched payer: ${match.name}`);
    }
  }, [selectedInsurance, payers]);

  // ─── Filtered payers for search ───
  const filteredPayers = payerSearch
    ? payers.filter(p => p.name.toLowerCase().includes(payerSearch.toLowerCase()) || p.code.toLowerCase().includes(payerSearch.toLowerCase()))
    : payers;

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!selectedPatient || !selectedPayer) {
      setError('Patient and payer are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payerObj = payers.find(p => p.id === selectedPayer);
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
        treating_doctor_name: selectedAdmission?.hmis_staff?.full_name || selectedAdmission?.hmis_staff?.name || null,
        department_name: selectedAdmission?.hmis_departments?.name || null,
        admission_date: selectedAdmission?.admission_date || null,
        discharge_date: selectedAdmission?.actual_discharge || null,
        estimated_amount: estimatedAmount ? parseFloat(estimatedAmount) : null,
        notes: notes || null,
        created_by: staff?.id || null,
      });
      router.push(`/claims/${claim.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create claim');
    }
    setSaving(false);
  };

  const canGoStep2 = !!selectedPatient;
  const canGoStep3 = !!selectedPayer;
  const canGoStep4 = !!selectedPatient && !!selectedPayer;

  const selectedPayerObj = payers.find(p => p.id === selectedPayer);

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* Toast */}
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-h1-teal text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push('/claims')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-h1-teal" /> New Claim
          </h1>
          <p className="text-xs text-gray-500">Step {step} of {STEPS.length} — {STEPS[step - 1]}</p>
        </div>
      </div>

      {/* ─── Step Indicator ─── */}
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => {
            if (i + 1 <= step || (i === 1 && canGoStep2) || (i === 2 && canGoStep3) || (i === 3 && canGoStep4))
              setStep(i + 1);
          }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              step === i + 1 ? 'bg-h1-navy text-white' :
              i + 1 < step ? 'bg-h1-teal-light text-h1-navy' :
              'bg-gray-100 text-gray-500'
            }`}>
            {i + 1 < step && <CheckCircle2 className="w-3 h-3" />}
            {s}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* ═══════════ STEP 1: FIND PATIENT ═══════════ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className={CC}>
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-h1-teal" /> Search Patient
            </h2>
            <p className="text-xs text-gray-500 mb-3">Search by name, UHID, or phone number — patient data auto-populates from HMIS</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input ref={searchRef} type="text" placeholder="e.g. Meena Soni, H1-000004, 9593008680..."
                value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                className={`${CI} pl-10 text-base`} />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
            </div>

            {/* Search Results */}
            {patients.length > 0 && (
              <div className="mt-3 border rounded-xl divide-y max-h-72 overflow-y-auto">
                {patients.map(p => (
                  <button key={p.id} onClick={() => selectPatient(p)}
                    className="w-full text-left px-4 py-3 hover:bg-h1-teal-light flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs shrink-0">
                        {p.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{p.uhid}</span>
                          <span>{p.phone}</span>
                          {p.gender && <span>{p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'O'}</span>}
                          {p.dob && <span>{new Date().getFullYear() - new Date(p.dob).getFullYear()}yr</span>}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
            )}
            {patientSearch.length >= 2 && patients.length === 0 && !searching && (
              <p className="text-center text-sm text-gray-400 py-6">No patients found for "{patientSearch}"</p>
            )}
          </div>

          {/* Selected Patient Card */}
          {selectedPatient && (
            <div className={CC}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                    {selectedPatient.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedPatient.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{selectedPatient.uhid}</span>
                      <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {selectedPatient.phone}</span>
                      {selectedPatient.abha_id && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">ABHA: {selectedPatient.abha_id}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => { setSelectedPatient(null); setAdmissions([]); setInsurances([]); setSelectedAdmission(null); setSelectedInsurance(null); }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium">Change</button>
              </div>
            </div>
          )}

          {selectedPatient && (
            <button onClick={() => setStep(2)}
              className="w-full py-3 bg-h1-teal text-white rounded-xl font-semibold text-sm hover:bg-teal-700 flex items-center justify-center gap-2 transition-colors">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* ═══════════ STEP 2: ADMISSION & PAYER ═══════════ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Linked Admissions */}
          <div className={CC}>
            <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-h1-teal" /> Link to Admission
            </h2>
            <p className="text-xs text-gray-500 mb-3">Select an admission to auto-populate diagnosis, doctor, and dates</p>

            {admissions.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No active admissions found</p>
                <p className="text-xs text-gray-400 mt-1">You can still create a claim without linking an admission</p>
              </div>
            ) : (
              <div className="space-y-2">
                {admissions.map(a => {
                  const isSelected = selectedAdmission?.id === a.id;
                  const doctorName = a.hmis_staff?.full_name || a.hmis_staff?.name || '—';
                  const deptName = a.hmis_departments?.name || '—';
                  return (
                    <button key={a.id} onClick={() => selectAdmission(a)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected ? 'border-h1-teal bg-h1-teal-light shadow-sm' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-gray-600">{a.admission_number || a.ipd_number}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                              a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}>{a.status}</span>
                          </div>
                          <p className="text-sm text-gray-800 mt-1 font-medium">
                            {a.provisional_diagnosis || a.final_diagnosis || 'No diagnosis recorded'}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1">
                            <span>{new Date(a.admission_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                            <span>Dr. {doctorName}</span>
                            <span>{deptName}</span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-h1-teal shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Patient Insurance */}
          {insurances.length > 0 && (
            <div className={CC}>
              <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-h1-teal" /> Patient Insurance
              </h2>
              <p className="text-xs text-gray-500 mb-3">Select insurance to auto-match the payer</p>
              <div className="space-y-2">
                {insurances.map(ins => {
                  const isSelected = selectedInsurance?.id === ins.id;
                  return (
                    <button key={ins.id} onClick={() => setSelectedInsurance(ins)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        isSelected ? 'border-h1-teal bg-h1-teal-light shadow-sm' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{ins.hmis_insurers?.name || 'Insurance'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                            <span>Policy: {ins.policy_number}</span>
                            {ins.hmis_tpas?.name && <span>TPA: {ins.hmis_tpas.name}</span>}
                            {ins.scheme && <span className="bg-green-50 text-green-700 px-1 py-0.5 rounded font-medium">{ins.scheme.toUpperCase()}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ins.is_primary && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">PRIMARY</span>}
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-h1-teal" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payer Selection */}
          <div className={CC}>
            <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-h1-teal" /> Select Payer
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              {selectedPayerObj ? (
                <span className="text-h1-teal font-medium">✓ {selectedPayerObj.name} ({selectedPayerObj.type})</span>
              ) : 'Choose the TPA, insurer, or government scheme'}
            </p>

            {/* Searchable payer selector */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search payers..."
                value={payerSearch} onChange={e => setPayerSearch(e.target.value)}
                className={`${CI} pl-9`} />
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {['tpa', 'insurer', 'government', 'psu'].map(type => {
                const group = filteredPayers.filter(p => p.type === type);
                if (group.length === 0) return null;
                return group.map(p => (
                  <button key={p.id} onClick={() => { setSelectedPayer(p.id); setPayerSearch(''); }}
                    className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                      selectedPayer === p.id
                        ? 'border-h1-teal bg-h1-teal-light font-semibold text-h1-navy'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}>
                    <span className="block truncate">{p.name}</span>
                    <span className="text-[9px] text-gray-400">{p.type.toUpperCase()}</span>
                  </button>
                ));
              })}
            </div>

            {/* Claim Type */}
            <div className="mt-4">
              <label className={CL}>Claim Type</label>
              <div className="flex gap-2">
                {Object.entries(CLAIM_TYPE_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setClaimType(k as ClaimType)}
                    className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                      claimType === k
                        ? 'border-h1-teal bg-h1-teal text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>{v}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={() => setStep(3)} disabled={!selectedPayer}
              className="flex-1 py-2.5 bg-h1-teal text-white rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 3: CLINICAL DETAILS ═══════════ */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Auto-populated notice */}
          {selectedAdmission && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-h1-teal-light rounded-xl text-xs text-h1-navy">
              <Zap className="w-4 h-4 text-h1-teal" />
              <span className="font-medium">Auto-populated from admission {selectedAdmission.admission_number || selectedAdmission.ipd_number}</span>
              <span className="text-gray-500">— edit if needed</span>
            </div>
          )}

          <div className={CC}>
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-h1-teal" /> Clinical Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CL}>Primary Diagnosis *</label>
                <input type="text" value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Appendicitis" className={CI} />
              </div>
              <div>
                <label className={CL}>ICD-10 Code</label>
                <input type="text" value={icdCode} onChange={e => setIcdCode(e.target.value)}
                  placeholder="e.g. K35.80" className={`${CI} font-mono`} />
              </div>
              <div>
                <label className={CL}>Procedure / Surgery</label>
                <input type="text" value={procedure} onChange={e => setProcedure(e.target.value)}
                  placeholder="e.g. Laparoscopic Appendectomy" className={CI} />
              </div>
              <div>
                <label className={CL}>Estimated Amount (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="number" value={estimatedAmount} onChange={e => setEstimatedAmount(e.target.value)}
                    placeholder="150000" className={`${CI} pl-9 font-mono`} />
                </div>
              </div>
            </div>

            {/* Auto-populated read-only fields */}
            {selectedAdmission && (
              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">Doctor</label>
                  <p className="text-sm text-gray-700 font-medium mt-0.5">
                    {selectedAdmission.hmis_staff?.full_name || selectedAdmission.hmis_staff?.name || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">Department</label>
                  <p className="text-sm text-gray-700 font-medium mt-0.5">{selectedAdmission.hmis_departments?.name || '—'}</p>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">Admission Date</label>
                  <p className="text-sm text-gray-700 font-medium mt-0.5">
                    {new Date(selectedAdmission.admission_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">Status</label>
                  <p className="text-sm mt-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      selectedAdmission.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>{selectedAdmission.status}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={CC}>
            <label className={CL}>Internal Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any additional context for insurance desk..."
              className={`${CI} resize-none`} />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={() => setStep(4)}
              className="flex-1 py-2.5 bg-h1-teal text-white rounded-xl font-semibold text-sm hover:bg-teal-700 flex items-center justify-center gap-2 transition-colors">
              Review Claim <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 4: REVIEW & CREATE ═══════════ */}
      {step === 4 && (
        <div className="space-y-4">
          <div className={CC}>
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-h1-teal" /> Review Claim
            </h2>

            <div className="space-y-4">
              {/* Patient */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
                  {selectedPatient?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{selectedPatient?.name}</p>
                  <p className="text-xs text-gray-500">{selectedPatient?.uhid} · {selectedPatient?.phone}</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <ReviewRow label="Payer" value={selectedPayerObj?.name || '—'} highlight />
                <ReviewRow label="Claim Type" value={CLAIM_TYPE_LABELS[claimType]} />
                {selectedAdmission && <>
                  <ReviewRow label="Admission" value={`${selectedAdmission.admission_number || selectedAdmission.ipd_number} (${selectedAdmission.status})`} />
                  <ReviewRow label="Admission Date" value={new Date(selectedAdmission.admission_date).toLocaleDateString('en-IN')} />
                  <ReviewRow label="Doctor" value={selectedAdmission.hmis_staff?.full_name || selectedAdmission.hmis_staff?.name || '—'} />
                  <ReviewRow label="Department" value={selectedAdmission.hmis_departments?.name || '—'} />
                </>}
                {selectedInsurance && <>
                  <ReviewRow label="Policy #" value={selectedInsurance.policy_number} mono />
                  {selectedInsurance.scheme && <ReviewRow label="Scheme" value={selectedInsurance.scheme.toUpperCase()} />}
                </>}
                {diagnosis && <ReviewRow label="Diagnosis" value={diagnosis} />}
                {icdCode && <ReviewRow label="ICD-10" value={icdCode} mono />}
                {procedure && <ReviewRow label="Procedure" value={procedure} />}
                {estimatedAmount && <ReviewRow label="Estimated Amount" value={`₹${parseInt(estimatedAmount).toLocaleString('en-IN')}`} highlight />}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-3 bg-h1-navy text-white rounded-xl font-bold text-sm hover:bg-blue-900 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-lg">
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating Claim...</>
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> Create Claim</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Review Row Component ───
function ReviewRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <span className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</span>
      <p className={`text-sm mt-0.5 ${highlight ? 'font-bold text-h1-navy' : 'font-medium text-gray-800'} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
