// components/emr/rx-section.tsx
// Wraps existing PrescriptionBuilder with AI Scribe badge support
'use client';
import React from 'react';
import PrescriptionBuilder from '@/components/emr-v2/prescription-builder';

interface RxEntry {
  drug: string; generic: string; dose: string; route: string;
  frequency: string; duration: string; instructions: string;
  isSOS: boolean; category: string;
}

interface RxSectionProps {
  prescriptions: RxEntry[];
  onChange: (rx: RxEntry[]) => void;
  allergies: string[];
  patientId?: string;
  staffId?: string;
  centreId?: string;
  onFlash: (msg: string) => void;
  aiSuggested?: boolean;
  onConfirmAi?: () => void;
}

export default function RxSection({
  prescriptions,
  onChange,
  allergies,
  patientId,
  staffId,
  centreId,
  onFlash,
  aiSuggested = false,
  onConfirmAi,
}: RxSectionProps) {
  return (
    <div className="space-y-2">
      {aiSuggested && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200
          rounded-h1-sm text-[11px] text-purple-700">
          <span>✨ AI Suggested — Review prescriptions carefully</span>
          <button
            type="button"
            onClick={onConfirmAi}
            className="ml-auto px-2 py-0.5 bg-purple-600 text-white rounded text-[10px]
              font-medium hover:bg-purple-700 transition-colors cursor-pointer"
          >
            Confirm
          </button>
        </div>
      )}
      <PrescriptionBuilder
        prescriptions={prescriptions}
        onChange={onChange}
        allergies={allergies}
        patientId={patientId}
        staffId={staffId}
        centreId={centreId}
        onFlash={onFlash}
      />
    </div>
  );
}
