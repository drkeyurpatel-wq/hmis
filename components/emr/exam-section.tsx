// components/emr/exam-section.tsx
// Dual-mode: Smart Builder (system-based toggles) OR free-text with voice
'use client';
import React from 'react';
import { Keyboard, Layers, CheckCircle } from 'lucide-react';
import { SmartExamBuilder, type ExamFindings } from '@/components/emr/smart-exam-builder';
import VoiceInput from '@/components/emr/voice-input';

interface ExamSectionProps {
  findings: ExamFindings;
  setFindings: React.Dispatch<React.SetStateAction<ExamFindings>>;
  freeText: string;
  setFreeText: (text: string) => void;
  mode: 'builder' | 'freetext';
  setMode: (mode: 'builder' | 'freetext') => void;
  aiSuggested?: boolean;
  onConfirmAi?: () => void;
}

// Quick "All Normal" preset
const ALL_NORMAL_FINDINGS: ExamFindings = {
  general: { appearance: 'well', consciousness: 'alert', nutrition: 'adequate' },
  cvs: { heartSounds: 'normal S1 S2, no murmur', jvp: 'not raised' },
  rs: { breathSounds: 'bilateral equal, vesicular', percussion: 'resonant' },
  abdomen: { inspection: 'soft, non-tender', bowelSounds: 'present' },
  cns: { orientation: 'oriented to time, place, person', pupils: 'PERRL' },
};

export default function ExamSection({
  findings,
  setFindings,
  freeText,
  setFreeText,
  mode,
  setMode,
  aiSuggested = false,
  onConfirmAi,
}: ExamSectionProps) {
  const handleAllNormal = () => {
    setFindings(ALL_NORMAL_FINDINGS);
  };

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

      {/* Mode tabs + All Normal */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode('builder')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-h1-sm
            transition-colors cursor-pointer
            ${mode === 'builder' ? 'bg-h1-teal text-white' : 'bg-h1-navy/5 text-h1-text-secondary hover:bg-h1-navy/10'}`}
        >
          <Layers className="w-3.5 h-3.5" />
          Smart Builder
        </button>
        <button
          type="button"
          onClick={() => setMode('freetext')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-h1-sm
            transition-colors cursor-pointer
            ${mode === 'freetext' ? 'bg-h1-teal text-white' : 'bg-h1-navy/5 text-h1-text-secondary hover:bg-h1-navy/10'}`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          Free Text
        </button>

        <button
          type="button"
          onClick={handleAllNormal}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-h1-sm
            bg-h1-success/10 text-h1-success hover:bg-h1-success/20 transition-colors cursor-pointer"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          All Normal
        </button>
      </div>

      {mode === 'builder' ? (
        <SmartExamBuilder findings={findings} setFindings={setFindings} />
      ) : (
        <div className="relative">
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            rows={5}
            className={`w-full px-3 py-2 text-h1-body border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal focus:border-h1-teal
              placeholder:text-h1-text-muted/50 resize-y min-h-[100px]
              ${aiSuggested ? 'border-purple-300 bg-purple-50/30' : 'border-h1-border'}`}
            placeholder="General: Patient is alert, oriented...&#10;CVS: S1 S2 normal, no murmur...&#10;RS: Bilateral equal air entry..."
          />
          <div className="absolute bottom-2 right-2">
            <VoiceInput
              value={freeText}
              onChange={setFreeText}
              placeholder="Describe examination findings..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
