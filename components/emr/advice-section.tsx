// components/emr/advice-section.tsx
// Follow-up date + patient advice + referral — with voice dictation
'use client';
import React from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import VoiceInput from '@/components/emr/voice-input';

interface AdviceSectionProps {
  advice: string;
  setAdvice: (text: string) => void;
  followUpDate: string;
  setFollowUpDate: (date: string) => void;
  referral: { department: string; doctor: string; reason: string; urgency: string };
  setReferral: React.Dispatch<React.SetStateAction<{ department: string; doctor: string; reason: string; urgency: string }>>;
  aiSuggested?: boolean;
  onConfirmAi?: () => void;
}

const QUICK_ADVICE = [
  'Drink plenty of fluids',
  'Avoid oily/spicy food',
  'Complete full course of antibiotics',
  'Rest for 3 days',
  'Monitor temperature',
  'Visit ER if symptoms worsen',
  'Avoid driving on this medication',
  'Follow-up with reports',
  'Low salt diet',
  'Regular blood sugar monitoring',
  'Wound care as instructed',
  'Physiotherapy exercises daily',
];

const FOLLOW_UP_QUICK = [
  { label: '3d', days: 3 },
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '1m', days: 30 },
  { label: '3m', days: 90 },
];

export default function AdviceSection({
  advice,
  setAdvice,
  followUpDate,
  setFollowUpDate,
  referral,
  setReferral,
  aiSuggested = false,
  onConfirmAi,
}: AdviceSectionProps) {
  const setQuickDate = (days: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    setFollowUpDate(dt.toISOString().split('T')[0]);
  };

  const appendAdvice = (text: string) => {
    setAdvice(advice ? advice + '\n' + text : text);
  };

  return (
    <div className="space-y-3">
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

      {/* Follow-up date */}
      <div>
        <label className="text-h1-small font-semibold text-h1-text-secondary flex items-center gap-1 mb-1">
          <Calendar className="w-3.5 h-3.5" />
          Follow-up Date
        </label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={followUpDate}
            onChange={e => setFollowUpDate(e.target.value)}
            className="px-2 py-1.5 text-xs border border-h1-border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal focus:border-h1-teal"
          />
          <div className="flex gap-1">
            {FOLLOW_UP_QUICK.map(q => (
              <button
                key={q.label}
                type="button"
                onClick={() => setQuickDate(q.days)}
                className="px-2 py-1 text-[10px] font-medium rounded-h1-sm
                  bg-h1-navy/5 text-h1-text-secondary hover:bg-h1-teal/10 hover:text-h1-teal
                  transition-colors cursor-pointer"
              >
                +{q.label}
              </button>
            ))}
          </div>
          {followUpDate && (
            <span className="text-[10px] text-h1-text-muted">
              {new Date(followUpDate).toLocaleDateString('en-IN', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
              })}
            </span>
          )}
        </div>
      </div>

      {/* Advice */}
      <div>
        <label className="text-h1-small font-semibold text-h1-text-secondary mb-1 block">
          Patient Instructions / Advice
        </label>
        <div className="relative">
          <textarea
            value={advice}
            onChange={e => setAdvice(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-h1-body border border-h1-border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal focus:border-h1-teal
              placeholder:text-h1-text-muted/50 resize-y min-h-[60px] pr-20"
            placeholder="Diet advice, activity restrictions, warning signs..."
          />
          <div className="absolute bottom-2 right-2">
            <VoiceInput value={advice} onChange={setAdvice} placeholder="Dictate advice..." />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {QUICK_ADVICE.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => appendAdvice(a)}
              className="px-2 py-0.5 text-[9px] rounded-full
                bg-h1-navy/5 text-h1-text-secondary hover:bg-h1-teal/10 hover:text-h1-teal
                transition-colors cursor-pointer"
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Referral */}
      <div>
        <label className="text-h1-small font-semibold text-h1-text-secondary flex items-center gap-1 mb-1">
          <ArrowRight className="w-3.5 h-3.5" />
          Referral (if needed)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={referral.department}
            onChange={e => setReferral(r => ({ ...r, department: e.target.value }))}
            className="px-2 py-1.5 text-xs border border-h1-border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal focus:border-h1-teal
              placeholder:text-h1-text-muted/50"
            placeholder="Department"
          />
          <input
            type="text"
            value={referral.doctor}
            onChange={e => setReferral(r => ({ ...r, doctor: e.target.value }))}
            className="px-2 py-1.5 text-xs border border-h1-border rounded-h1-sm
              focus:outline-none focus:ring-1 focus:ring-h1-teal focus:border-h1-teal
              placeholder:text-h1-text-muted/50"
            placeholder="Doctor name"
          />
          <div className="relative">
            <input
              type="text"
              value={referral.reason}
              onChange={e => setReferral(r => ({ ...r, reason: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs border border-h1-border rounded-h1-sm
                focus:outline-none focus:ring-1 focus:ring-h1-teal focus:border-h1-teal
                placeholder:text-h1-text-muted/50 pr-16"
              placeholder="Reason"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2">
              <VoiceInput
                value={referral.reason}
                onChange={text => setReferral(r => ({ ...r, reason: text }))}
                placeholder="Reason..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
