// components/emr/complaint-section.tsx
// Dual-mode: Smart Builder (structured) OR free-text with voice dictation
'use client';
import React, { useState } from 'react';
import { MessageSquare, Keyboard, Layers } from 'lucide-react';
import { SmartComplaintBuilder, type ActiveComplaint } from '@/components/emr/smart-complaint-builder';
import VoiceInput from '@/components/emr/voice-input';

interface ComplaintSectionProps {
  complaints: ActiveComplaint[];
  setComplaints: React.Dispatch<React.SetStateAction<ActiveComplaint[]>>;
  freeText: string;
  setFreeText: (text: string) => void;
  mode: 'builder' | 'freetext';
  setMode: (mode: 'builder' | 'freetext') => void;
  /** Set by AI Scribe — show amber badge */
  aiSuggested?: boolean;
  onConfirmAi?: () => void;
}

export default function ComplaintSection({
  complaints,
  setComplaints,
  freeText,
  setFreeText,
  mode,
  setMode,
  aiSuggested = false,
  onConfirmAi,
}: ComplaintSectionProps) {
  return (
    <div className="space-y-2">
      {/* AI Suggested indicator */}
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

      {/* Mode tabs */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode('builder')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-h1-sm
            transition-colors duration-h1-fast cursor-pointer
            ${mode === 'builder'
              ? 'bg-h1-teal text-white'
              : 'bg-h1-navy/5 text-h1-text-secondary hover:bg-h1-navy/10'
            }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Smart Builder
        </button>
        <button
          type="button"
          onClick={() => setMode('freetext')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-h1-sm
            transition-colors duration-h1-fast cursor-pointer
            ${mode === 'freetext'
              ? 'bg-h1-teal text-white'
              : 'bg-h1-navy/5 text-h1-text-secondary hover:bg-h1-navy/10'
            }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          Free Text
        </button>
      </div>

      {/* Content */}
      {mode === 'builder' ? (
        <SmartComplaintBuilder complaints={complaints} setComplaints={setComplaints} />
      ) : (
        <div className="relative">
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 text-h1-body border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal focus:border-h1-teal
              placeholder:text-h1-text-muted/50 resize-y min-h-[80px]
              ${aiSuggested ? 'border-purple-300 bg-purple-50/30' : 'border-h1-border'}`}
            placeholder="Describe chief complaints... (e.g., Patient presents with fever for 3 days, associated with body ache and headache)"
          />
          <div className="absolute bottom-2 right-2">
            <VoiceInput
              value={freeText}
              onChange={setFreeText}
              placeholder="Describe complaints..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
