'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, X, User, Stethoscope, CreditCard,
  Building2, ArrowLeft, ChevronDown,
} from 'lucide-react';
import { usePatientSearch, useDoctorSearch } from '@/lib/billing/service-master-hooks';
import type { EncounterType, PayorType } from '@/lib/billing/types';
import { ENCOUNTER_TYPES, PAYOR_TYPES } from '@/lib/billing/types';

interface Props {
  centreId: string;
  onSubmit: (data: {
    patientId: string;
    encounterType: EncounterType;
    payorType: PayorType;
    consultingDoctorId?: string;
  }) => void;
  onCancel: () => void;
}

export default function NewEncounterForm({ centreId, onSubmit, onCancel }: Props) {
  const [step, setStep] = useState<'patient' | 'details'>('patient');

  // Patient search
  const { results: patientResults, searching, search: searchPatients, clear } = usePatientSearch();
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string; first_name: string; last_name: string;
    uhid: string; phone_primary: string | null;
    age_years: number | null; gender: string | null;
  } | null>(null);

  // Encounter details
  const [encounterType, setEncounterType] = useState<EncounterType>('OPD');
  const [payorType, setPayorType] = useState<PayorType>('SELF_PAY');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctorQuery, setDoctorQuery] = useState('');

  // Doctor search
  const { doctors, search: searchDoctors } = useDoctorSearch(centreId);
  const filteredDoctors = doctorQuery ? searchDoctors(doctorQuery) : doctors;

  useEffect(() => {
    const t = setTimeout(() => { if (patientQuery.length >= 2) searchPatients(patientQuery); }, 300);
    return () => clearTimeout(t);
  }, [patientQuery, searchPatients]);

  const handleSelectPatient = (p: typeof selectedPatient) => {
    setSelectedPatient(p);
    setPatientQuery('');
    clear();
    setStep('details');
  };

  const handleSubmit = () => {
    if (!selectedPatient) return;
    onSubmit({
      patientId: selectedPatient.id,
      encounterType,
      payorType,
      consultingDoctorId: selectedDoctorId || undefined,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-sm font-bold text-gray-800">New Billing Encounter</h2>
        <div className="flex gap-1.5 ml-auto">
          <div className={`w-2 h-2 rounded-full ${step === 'patient' ? 'bg-[#00B4D8]' : 'bg-emerald-500'}`} />
          <div className={`w-2 h-2 rounded-full ${step === 'details' ? 'bg-[#00B4D8]' : 'bg-gray-200'}`} />
        </div>
      </div>

      <div className="p-5">
        {/* Step 1: Patient Search */}
        {step === 'patient' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Search Patient</label>
              <div className="relative mt-1.5">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={patientQuery}
                  onChange={e => setPatientQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8] bg-gray-50/50"
                  placeholder="Type patient name, UHID, or phone..."
                  autoFocus
                />
              </div>
            </div>

            {searching && <div className="text-xs text-gray-400 py-4 text-center">Searching...</div>}

            {patientResults.length > 0 && (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {patientResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#0A2540]/10 flex items-center justify-center text-[10px] font-bold text-[#0A2540]">
                      {p.first_name?.[0]}{p.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-800">{p.first_name} {p.last_name}</div>
                      <div className="text-[10px] text-gray-400">{p.uhid}{p.age_years ? ` · ${p.age_years}y` : ''}{p.gender ? ` · ${p.gender}` : ''}{p.phone_primary ? ` · ${p.phone_primary}` : ''}</div>
                    </div>
                    <ChevronDown size={14} className="text-gray-300 -rotate-90" />
                  </button>
                ))}
              </div>
            )}

            {patientQuery.length >= 2 && !searching && patientResults.length === 0 && (
              <div className="text-xs text-gray-400 py-8 text-center">
                No patients found matching &ldquo;{patientQuery}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* Step 2: Encounter Details */}
        {step === 'details' && selectedPatient && (
          <div className="space-y-5">
            {/* Selected patient card */}
            <div className="flex items-center gap-3 p-3 bg-[#0A2540]/5 rounded-xl border border-[#00B4D8]/20">
              <div className="w-10 h-10 rounded-full bg-[#0A2540] flex items-center justify-center text-xs font-bold text-white">
                {selectedPatient.first_name?.[0]}{selectedPatient.last_name?.[0]}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-[#0A2540]">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                <div className="text-[10px] text-gray-500">{selectedPatient.uhid}{selectedPatient.age_years ? ` · ${selectedPatient.age_years}y` : ''}{selectedPatient.gender ? ` · ${selectedPatient.gender}` : ''}</div>
              </div>
              <button onClick={() => { setSelectedPatient(null); setStep('patient'); }} className="text-gray-400 hover:text-red-500 cursor-pointer transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Encounter Type */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Encounter Type</label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {ENCOUNTER_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setEncounterType(t)}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      encounterType === t
                        ? 'bg-[#0A2540] text-white shadow-sm'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Payor Type */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payor Type</label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {PAYOR_TYPES.map(p => (
                  <button
                    key={p}
                    onClick={() => setPayorType(p)}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      payorType === p
                        ? 'bg-[#0A2540] text-white shadow-sm'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'
                    }`}
                  >
                    {p.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {encounterType === 'OPD' ? 'Consulting Doctor' : 'Admitting Doctor'} (Optional)
              </label>
              <div className="relative mt-1.5">
                <Stethoscope size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={doctorQuery}
                  onChange={e => setDoctorQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/20 focus:border-[#00B4D8] bg-gray-50/50"
                  placeholder="Search doctor..."
                />
                {doctorQuery && filteredDoctors.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                    {filteredDoctors.slice(0, 8).map(d => (
                      <button
                        key={d.id}
                        onClick={() => { setSelectedDoctorId(d.id); setDoctorQuery(d.full_name); }}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors cursor-pointer"
                      >
                        <span className="font-medium">{d.full_name}</span>
                        {d.specialisation && <span className="text-gray-400 ml-1">· {d.specialisation}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setStep('patient'); setSelectedPatient(null); }}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0A2540] rounded-xl hover:bg-[#0A2540]/90 cursor-pointer transition-colors shadow-sm"
              >
                Create Encounter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
