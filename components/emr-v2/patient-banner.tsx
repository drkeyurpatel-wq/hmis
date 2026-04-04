// components/emr-v2/patient-banner.tsx
// Top banner — always visible during consultation (sticky)
'use client';
import React from 'react';
import { User, Search, AlertTriangle } from 'lucide-react';

interface Patient { id: string; name: string; age: string; gender: string; uhid: string; phone: string; allergies: string[]; bloodGroup: string; }

interface PatientBannerProps {
  patient: Patient;
  onSearch: () => void;
  filledSections?: Record<string, boolean>;
}

export default function PatientBanner({ patient, onSearch, filledSections }: PatientBannerProps) {
  const hasAllergies = patient.allergies.length > 0;
  const totalSections = filledSections ? Object.keys(filledSections).length : 0;
  const filledCount = filledSections ? Object.values(filledSections).filter(Boolean).length : 0;

  return (
    <div className={`sticky top-0 z-20 rounded-xl border p-3 flex items-center gap-4 shadow-sm backdrop-blur-sm ${hasAllergies ? 'bg-red-50/95 border-red-200' : 'bg-white/95'}`}>
      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
        <User className="w-5 h-5 text-blue-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{patient.id ? patient.name : 'No patient selected'}</span>
          {patient.uhid !== 'H1-00000' && <span className="text-[10px] font-mono text-gray-400">{patient.uhid}</span>}
          {patient.age !== '--' && <span className="text-xs text-gray-500">{patient.age}y {patient.gender}</span>}
          {patient.bloodGroup && <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded">{patient.bloodGroup}</span>}
          {patient.phone && <span className="text-[10px] text-gray-400">{patient.phone}</span>}
        </div>
        {hasAllergies && (
          <div className="flex items-center gap-1 mt-0.5">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">ALLERGY</span>
            {patient.allergies.map((a, i) => <span key={i} className="text-[10px] text-red-700 font-medium">{a}{i < patient.allergies.length - 1 ? ',' : ''}</span>)}
          </div>
        )}
      </div>
      {/* Progress indicator */}
      {filledSections && patient.id && totalSections > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-0.5">
            {Object.entries(filledSections).map(([key, filled]) => (
              <div key={key} className={`w-2 h-2 rounded-full transition-colors duration-200 ${filled ? 'bg-emerald-500' : 'bg-gray-200'}`} title={key} />
            ))}
          </div>
          <span className="text-[10px] text-gray-400">{filledCount}/{totalSections}</span>
        </div>
      )}
      <button onClick={onSearch} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer flex items-center gap-1.5 shrink-0">
        <Search className="w-3 h-3" />
        {patient.id ? 'Change' : 'Search Patient'}
      </button>
    </div>
  );
}
