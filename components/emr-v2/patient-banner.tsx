// components/emr-v2/patient-banner.tsx
// Top banner — always visible during consultation
'use client';
import React from 'react';

interface Patient { id: string; name: string; age: string; gender: string; uhid: string; phone: string; allergies: string[]; bloodGroup: string; }

export default function PatientBanner({ patient, onSearch }: { patient: Patient; onSearch: () => void }) {
  const hasAllergies = patient.allergies.length > 0;

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-4 ${hasAllergies ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg font-bold text-blue-700">{patient.name.charAt(0)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{patient.id ? patient.name : 'No patient selected'}</span>
          {patient.uhid !== 'H1-00000' && <span className="text-[10px] font-mono text-gray-400">{patient.uhid}</span>}
          {patient.age !== '--' && <span className="text-xs text-gray-500">{patient.age}y {patient.gender}</span>}
          {patient.bloodGroup && <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded">{patient.bloodGroup}</span>}
          {patient.phone && <span className="text-[10px] text-gray-400">{patient.phone}</span>}
        </div>
        {hasAllergies && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">ALLERGY</span>
            {patient.allergies.map((a, i) => <span key={i} className="text-[10px] text-red-700 font-medium">{a}{i < patient.allergies.length - 1 ? ',' : ''}</span>)}
          </div>
        )}
      </div>
      <button onClick={onSearch} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{patient.id ? 'Change' : 'Search Patient'}</button>
    </div>
  );
}
