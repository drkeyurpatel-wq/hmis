// components/emr/investigation-section.tsx
// Lab + Radiology order entry — wraps existing InvestigationPanel
'use client';
import React from 'react';
import InvestigationPanel from '@/components/emr-v2/investigation-panel';

interface InvestigationEntry {
  name: string;
  type: 'lab' | 'radiology';
  urgency: 'routine' | 'urgent' | 'stat';
  notes: string;
}

interface InvestigationSectionProps {
  investigations: InvestigationEntry[];
  onChange: (inv: InvestigationEntry[]) => void;
  aiSuggested?: boolean;
  onConfirmAi?: () => void;
}

export default function InvestigationSection({
  investigations,
  onChange,
  aiSuggested = false,
  onConfirmAi,
}: InvestigationSectionProps) {
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
      <InvestigationPanel investigations={investigations} onChange={onChange} />
    </div>
  );
}
