'use client';
// components/ipd/admission-wizard.tsx
// Guided admission: Patient → Bed → Doctor → Insurance → Initial Orders → Confirm

import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import { User, BedDouble, Stethoscope, Shield, CheckCircle, ArrowRight, X, Search } from 'lucide-react';

interface Props { onDone: (admissionId?: string) => void; onFlash: (msg: string) => void; preselectedPatientId?: string; }

const STEPS = ['patient', 'bed', 'doctor', 'insurance', 'confirm'] as const;
type Step = typeof STEPS[number];

export default function AdmissionWizard({ onDone, onFlash, preselectedPatientId }: Props) {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [step, setStep] = useState<Step>(preselectedPatientId ? 'bed' : 'patient');
  const [saving, setSaving] = useState(false);

  // Patient search
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);

  // Bed selection
  const [wards, setWards] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedBed, setSelectedBed] = useState('');

  // Doctor
  const [doctors, setDoctors] = useState<any[]>([]);
  const [primaryDoctor, setPrimaryDoctor] = useState('');
  const [admittingDoctor, setAdmittingDoctor] = useState('');

  // Admission details
  const [admissionType, setAdmissionType] = useState('elective');
  const [payorType, setPayorType] = useState('self');
  const [provisionalDx, setProvisionalDx] = useState('');
  const [expectedDays, setExpectedDays] = useState('3');

  // Patient search
  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary, blood_group')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`)
        .eq('is_active', true).limit(8);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  // Preselected patient
  useEffect(() => {
    if (!preselectedPatientId || !sb()) return;
    sb()!.from('hmis_patients').select('*').eq('id', preselectedPatientId).single().then(({ data }) => { if (data) setPatient(data); });
  }, [preselectedPatientId]);

  // Load wards + doctors
  useEffect(() => {
    if (!centreId || !sb()) return;
    sb()!.from('hmis_wards').select('id, name, type, floor').eq('centre_id', centreId).eq('is_active', true).order('name').then(({ data }) => setWards(data || []));
    sb()!.from('hmis_staff').select('id, full_name, staff_type').eq('is_active', true).in('staff_type', ['doctor', 'consultant']).order('full_name').then(({ data }) => setDoctors(data || []));
  }, [centreId]);

  // Load beds for selected ward
  useEffect(() => {
    if (!selectedWard || !sb()) { setBeds([]); return; }
    sb()!.from('hmis_beds').select('id, bed_number, status, room:hmis_rooms!inner(room_number, ward_id)')
      .eq('room.ward_id', selectedWard).eq('is_active', true).order('bed_number')
      .then(({ data }) => setBeds(data || []));
  }, [selectedWard]);

  const handleAdmit = useCallback(async () => {
    if (!sb() || !staff || !patient) return;
    setSaving(true);
    const { data: ipdNum } = await sb()!.rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'ipd' });
    const { data: admission, error } = await sb()!.from('hmis_admissions').insert({
      centre_id: centreId, patient_id: patient.id, ipd_number: ipdNum || `IPD-${Date.now()}`,
      admitting_doctor_id: admittingDoctor || primaryDoctor, primary_doctor_id: primaryDoctor,
      bed_id: selectedBed || null, admission_type: admissionType, payor_type: payorType,
      provisional_diagnosis: provisionalDx, admission_date: new Date().toISOString(),
      expected_discharge: expectedDays ? new Date(Date.now() + parseInt(expectedDays) * 86400000).toISOString().split('T')[0] : null,
      status: 'active',
    }).select('id, ipd_number').single();

    if (error) { onFlash('Error: ' + error.message); setSaving(false); return; }

    // Mark bed occupied
    if (selectedBed) {
      await sb()!.from('hmis_beds').update({ status: 'occupied', current_admission_id: admission?.id }).eq('id', selectedBed);
    }

    // Auto-create diet order
    try {
      const { onAdmissionCreated } = await import('@/lib/bridge/module-events');
      await onAdmissionCreated({ centreId, admissionId: admission!.id, patientId: patient.id, staffId: staff.id });
    } catch (e) { console.error(e); }

    setSaving(false);
    onFlash(`Admitted: ${patient.first_name} — ${admission?.ipd_number}`);
    onDone(admission?.id);
  }, [patient, selectedBed, primaryDoctor, admittingDoctor, admissionType, payorType, provisionalDx, expectedDays, centreId, staff, onFlash, onDone]);

  const stepIndex = STEPS.indexOf(step);
  const availableBeds = beds.filter(b => b.status === 'available');

  return (
    <div className="bg-white rounded-xl border shadow-lg max-w-2xl mx-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl">
        <h2 className="font-bold text-sm">New Admission</h2>
        <button onClick={() => onDone()} className="p-1 hover:bg-gray-200 rounded-lg"><X size={16} /></button>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1 px-4 py-2 border-b">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button onClick={() => { if (i < stepIndex) setStep(s); }} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${i < stepIndex ? 'text-green-600 cursor-pointer' : i === stepIndex ? 'bg-teal-600 text-white' : 'text-gray-400'}`}>
              {i < stepIndex ? <CheckCircle size={12} /> : <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[9px]">{i + 1}</span>}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
            {i < STEPS.length - 1 && <ArrowRight size={10} className="text-gray-300" />}
          </React.Fragment>
        ))}
      </div>

      <div className="p-4">
        {/* Patient */}
        {step === 'patient' && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><User size={14} /> Select Patient</h3>
            <input value={patSearch} onChange={(e: any) => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" placeholder="Search by UHID, name, or phone..." autoFocus />
            {patResults.length > 0 && <div className="border rounded-lg max-h-48 overflow-y-auto">{patResults.map(p => (
              <button key={p.id} onClick={() => { setPatient(p); setPatSearch(''); setPatResults([]); setStep('bed'); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0 text-sm">
                <span className="font-semibold">{p.first_name} {p.last_name}</span>
                <span className="text-gray-400 ml-2">{p.uhid} · {p.age_years}y/{p.gender?.charAt(0)} · {p.phone_primary}</span>
              </button>
            ))}</div>}
            {patient && <div className="mt-3 bg-teal-50 rounded-lg p-3 text-sm">
              <span className="font-bold">{patient.first_name} {patient.last_name}</span> · {patient.uhid} · {patient.age_years}y/{patient.gender?.charAt(0)} {patient.blood_group && <span className="text-red-600 font-bold ml-1">{patient.blood_group}</span>}
              <button onClick={() => setStep('bed')} className="ml-4 px-3 py-1 bg-teal-600 text-white rounded text-xs">Continue →</button>
            </div>}
          </div>
        )}

        {/* Bed */}
        {step === 'bed' && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><BedDouble size={14} /> Assign Bed</h3>
            <select value={selectedWard} onChange={(e: any) => { setSelectedWard(e.target.value); setSelectedBed(''); }} className="w-full px-3 py-2 border rounded-lg text-sm mb-3">
              <option value="">Select ward...</option>
              {wards.map(w => <option key={w.id} value={w.id}>{w.name} ({w.type}) — Floor {w.floor}</option>)}
            </select>
            {selectedWard && (
              <div className="grid grid-cols-8 gap-1.5 mb-3">{beds.map(b => (
                <button key={b.id} onClick={() => b.status === 'available' ? setSelectedBed(b.id) : null}
                  className={`p-2 rounded-lg text-[10px] font-bold text-center border ${selectedBed === b.id ? 'bg-teal-600 text-white border-teal-600' : b.status === 'available' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer' : 'bg-red-50 text-red-400 border-red-100 cursor-not-allowed'}`}>
                  {b.bed_number}
                </button>
              ))}</div>
            )}
            <div className="text-xs text-gray-400 mb-3">{availableBeds.length} beds available {selectedBed && '· 1 selected'}</div>
            <div className="flex justify-between">
              <button onClick={() => setStep('doctor')} className="text-xs text-gray-500 hover:underline">Skip bed →</button>
              <button onClick={() => setStep('doctor')} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">Continue →</button>
            </div>
          </div>
        )}

        {/* Doctor */}
        {step === 'doctor' && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><Stethoscope size={14} /> Assign Doctor</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-[10px] text-gray-500">Primary Doctor *</label>
              <select value={primaryDoctor} onChange={(e: any) => { setPrimaryDoctor(e.target.value); if (!admittingDoctor) setAdmittingDoctor(e.target.value); }} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select...</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select></div>
              <div><label className="text-[10px] text-gray-500">Admitting Doctor</label>
              <select value={admittingDoctor} onChange={(e: any) => setAdmittingDoctor(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Same as primary</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><label className="text-[10px] text-gray-500">Admission Type</label>
              <select value={admissionType} onChange={(e: any) => setAdmissionType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="elective">Elective</option><option value="emergency">Emergency</option><option value="transfer">Transfer</option>
              </select></div>
              <div><label className="text-[10px] text-gray-500">Expected Stay (days)</label>
              <input type="number" value={expectedDays} onChange={(e: any) => setExpectedDays(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-[10px] text-gray-500">Provisional Diagnosis</label>
              <input value={provisionalDx} onChange={(e: any) => setProvisionalDx(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. ACS, Appendicitis" /></div>
            </div>
            <div className="flex justify-end"><button onClick={() => setStep('insurance')} disabled={!primaryDoctor} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">Continue →</button></div>
          </div>
        )}

        {/* Insurance */}
        {step === 'insurance' && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><Shield size={14} /> Payor</h3>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {['self', 'cashless', 'reimbursement', 'pmjay'].map(t => (
                <button key={t} onClick={() => setPayorType(t)} className={`py-3 rounded-lg border text-sm font-medium ${payorType === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {t === 'self' ? ' Self Pay' : t === 'cashless' ? ' Cashless' : t === 'reimbursement' ? ' Reimbursement' : '🇮🇳 PMJAY'}
                </button>
              ))}
            </div>
            <div className="flex justify-end"><button onClick={() => setStep('confirm')} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">Continue →</button></div>
          </div>
        )}

        {/* Confirm */}
        {step === 'confirm' && patient && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><CheckCircle size={14} /> Confirm Admission</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Patient</span><span className="font-semibold">{patient.first_name} {patient.last_name} ({patient.uhid})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Bed</span><span className="font-semibold">{selectedBed ? beds.find(b => b.id === selectedBed)?.bed_number || '—' : 'Not assigned'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Doctor</span><span className="font-semibold">{doctors.find(d => d.id === primaryDoctor)?.full_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-semibold capitalize">{admissionType}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Payor</span><span className="font-semibold uppercase">{payorType}</span></div>
              {provisionalDx && <div className="flex justify-between"><span className="text-gray-500">Diagnosis</span><span className="font-semibold">{provisionalDx}</span></div>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => onDone()} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">Cancel</button>
              <button onClick={handleAdmit} disabled={saving} className="px-6 py-2 bg-teal-600 text-white text-sm rounded-lg font-semibold disabled:opacity-50">{saving ? 'Admitting...' : 'Confirm Admission'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
