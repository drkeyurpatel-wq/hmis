// components/emr/diagnosis-section.tsx
// ICD-10 search + type chips — wraps existing diagnosis-builder with AI badge support
'use client';
import React from 'react';
import DiagnosisBuilder from '@/components/emr-v2/diagnosis-builder';

interface DiagnosisEntry {
  code: string;
  name: string;
  type: 'primary' | 'secondary' | 'differential';
  notes: string;
}

interface DiagnosisSectionProps {
  diagnoses: DiagnosisEntry[];
  onChange: (dx: DiagnosisEntry[]) => void;
  aiSuggested?: boolean;
  onConfirmAi?: () => void;
}

export default function DiagnosisSection({
  diagnoses,
  onChange,
  aiSuggested = false,
  onConfirmAi,
}: DiagnosisSectionProps) {
  return (
    <div className="space-y-2">
      {aiSuggested && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200
          rounded-h1-sm text-[11px] text-purple-700">
          <span>✨ AI Suggested</span>
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
      <DiagnosisBuilder diagnoses={diagnoses} onChange={onChange} />
    </div>
  );
}
