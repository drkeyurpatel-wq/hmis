// app/px/[token]/nurse-call/page.tsx
// One-tap nurse call with reason selector

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePxToken, useNurseCall, useMyNurseCalls } from '@/lib/px/patient-hooks';
import { NURSE_CALL_REASONS, NURSE_CALL_PRIORITY_LABELS, NURSE_CALL_PRIORITY_COLORS } from '@/lib/px/types';
import type { NurseCallPriority } from '@/lib/px/types';

export default function NurseCallPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { context } = usePxToken(token);
  const { submit, submitting, error, cooldown } = useNurseCall(context);
  const { activeCalls } = useMyNurseCalls(context?.token_id);

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [priority, setPriority] = useState<NurseCallPriority>('routine');
  const [details, setDetails] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!selectedReason) return;
    const id = await submit(selectedReason, priority, details || undefined);
    if (id) {
      setSuccess(true);
      setSelectedReason(null);
      setDetails('');
    }
  }

  if (success) {
    return (
      <div className="px-4 pt-4">
        <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Nurse has been notified</h2>
          <p className="text-sm text-gray-500 mb-4">Someone will attend to you shortly.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setSuccess(false)}
              className="flex-1 py-2 text-sm font-medium text-[#1B3A5C] border border-[#1B3A5C] rounded-lg"
            >
              Call again
            </button>
            <button
              onClick={() => router.push(`/px/${token}`)}
              className="flex-1 py-2 text-sm font-medium text-white bg-[#1B3A5C] rounded-lg"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-8">
      <button
        onClick={() => router.push(`/px/${token}`)}
        className="flex items-center gap-1 text-sm text-gray-500 mb-3"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-lg font-semibold text-gray-900 mb-1">Call Nurse</h1>
      <p className="text-xs text-gray-500 mb-4">Select a reason and tap call. For life-threatening emergencies, use the bedside button.</p>

      {/* Active calls */}
      {activeCalls && activeCalls.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-blue-800">
              You have {activeCalls.length} active call(s). A nurse is on the way.
            </span>
          </div>
        </div>
      )}

      {/* Priority selector */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 mb-2 block">Priority</label>
        <div className="flex gap-2">
          {(['routine', 'urgent', 'emergency'] as NurseCallPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                priority === p
                  ? p === 'emergency'
                    ? 'bg-red-500 text-white border-red-500'
                    : p === 'urgent'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {NURSE_CALL_PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Reason selector */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 mb-2 block">What do you need?</label>
        <div className="grid grid-cols-2 gap-2">
          {NURSE_CALL_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`p-3 text-left text-xs rounded-lg border transition-colors ${
                selectedReason === reason
                  ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>
      </div>

      {/* Additional details */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 mb-1 block">Additional details (optional)</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Any extra information for the nurse..."
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30"
        />
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!selectedReason || submitting || cooldown}
        className={`w-full py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 ${
          priority === 'emergency'
            ? 'bg-red-500 text-white'
            : 'bg-[#1B3A5C] text-white'
        }`}
      >
        {submitting
          ? 'Sending...'
          : cooldown
          ? 'Please wait (2 min cooldown)'
          : `Call Nurse${selectedReason ? ` — ${selectedReason}` : ''}`}
      </button>
    </div>
  );
}
