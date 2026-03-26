// components/emr/action-bar.tsx
// Sticky bottom action bar for EMR — Save Draft, Sign & Complete, Print Rx, Print Summary
'use client';
import React from 'react';
import { Save, CheckCircle2, Printer, FileText, MoreHorizontal } from 'lucide-react';
import EncounterTimer from '@/components/emr/encounter-timer';

interface ActionBarProps {
  saving: boolean;
  canSign: boolean;
  hasRx: boolean;
  startTime: number | null;
  onSaveDraft: () => void;
  onSign: () => void;
  onPrintRx: () => void;
  onPrintSummary: () => void;
  /** Number of unconfirmed AI-suggested sections */
  pendingAiReview: number;
}

export default function ActionBar({
  saving,
  canSign,
  hasRx,
  startTime,
  onSaveDraft,
  onSign,
  onPrintRx,
  onPrintSummary,
  pendingAiReview,
}: ActionBarProps) {
  const signDisabled = saving || !canSign || pendingAiReview > 0;

  return (
    <div className="sticky bottom-0 z-20 bg-h1-card border-t border-h1-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)]
      rounded-b-h1 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left — Primary actions */}
        <div className="flex items-center gap-2">
          {/* Save Draft */}
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-h1-sm
              bg-h1-navy/5 text-h1-text hover:bg-h1-navy/10
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-h1-fast cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          {/* Sign & Complete */}
          <button
            type="button"
            onClick={onSign}
            disabled={signDisabled}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-h1-sm
              bg-h1-success text-white hover:bg-h1-success/90
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-h1-fast cursor-pointer shadow-sm"
            title={pendingAiReview > 0 ? `Review ${pendingAiReview} AI-suggested section(s) before signing` : ''}
          >
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Signing...' : 'Sign & Complete'}
          </button>

          {/* Pending AI review warning */}
          {pendingAiReview > 0 && (
            <span className="text-[10px] text-purple-600 font-medium">
              {pendingAiReview} AI section{pendingAiReview > 1 ? 's' : ''} need review
            </span>
          )}
        </div>

        {/* Right — Print + Timer */}
        <div className="flex items-center gap-2">
          {/* Print Rx — visible on md+ */}
          {hasRx && (
            <button
              type="button"
              onClick={onPrintRx}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-h1-sm
                bg-h1-yellow/10 text-h1-yellow hover:bg-h1-yellow/20
                transition-colors duration-h1-fast cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Rx
            </button>
          )}

          {/* Print Summary — visible on md+ */}
          <button
            type="button"
            onClick={onPrintSummary}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-h1-sm
              bg-h1-teal/10 text-h1-teal hover:bg-h1-teal/20
              transition-colors duration-h1-fast cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Summary
          </button>

          {/* Mobile overflow menu for print actions */}
          <div className="sm:hidden relative group">
            <button
              type="button"
              className="p-2 rounded-h1-sm bg-h1-navy/5 text-h1-text-muted hover:bg-h1-navy/10
                transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <div className="absolute bottom-full right-0 mb-1 hidden group-focus-within:block
              bg-h1-card rounded-h1-sm shadow-h1-dropdown border border-h1-border py-1 min-w-[140px]">
              {hasRx && (
                <button
                  type="button"
                  onClick={onPrintRx}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-h1-navy/5 flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Rx
                </button>
              )}
              <button
                type="button"
                onClick={onPrintSummary}
                className="w-full text-left px-3 py-2 text-xs hover:bg-h1-navy/5 flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5" /> Print Summary
              </button>
            </div>
          </div>

          {/* Encounter timer */}
          <EncounterTimer startTime={startTime} />
        </div>
      </div>
    </div>
  );
}
