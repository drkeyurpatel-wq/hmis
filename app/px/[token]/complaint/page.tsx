// app/px/[token]/complaint/page.tsx

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePxToken, useSubmitComplaint, useMyComplaints } from '@/lib/px/patient-hooks';
import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS } from '@/lib/px/types';
import type { ComplaintCategory } from '@/lib/px/types';

const CATEGORY_ICONS: Record<ComplaintCategory, string> = {
  cleanliness: '🧹',
  food_quality: '🍽️',
  staff_behaviour: '👤',
  noise: '🔊',
  equipment: '🔧',
  billing: '💰',
  delay: '⏱️',
  other: '📝',
};

export default function ComplaintPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { context } = usePxToken(token);
  const { submit, submitting, error } = useSubmitComplaint(token);
  const { complaints } = useMyComplaints(token);

  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [description, setDescription] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!category || !description.trim()) return;
    const id = await submit(category, description.trim());
    if (id) {
      setSuccess(true);
      setCategory(null);
      setDescription('');
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Complaint registered</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your concern has been logged and the IPD coordinator will look into it. Target resolution: 24 hours.
          </p>
          <button
            onClick={() => router.push(`/px/${token}`)}
            className="w-full py-2 text-sm font-medium text-white bg-[#1B3A5C] rounded-lg"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-8">
      <button onClick={() => router.push(`/px/${token}`)} className="flex items-center gap-1 text-sm text-gray-500 mb-3">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-lg font-semibold text-gray-900 mb-1">Report a Concern</h1>
      <p className="text-xs text-gray-500 mb-4">We take your feedback seriously. All complaints are tracked with an SLA.</p>

      {/* Previous complaints */}
      {complaints.length > 0 && (
        <div className="mb-4 bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Your recent complaints</p>
          {complaints.slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-700">{COMPLAINT_CATEGORY_LABELS[c.category]}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                c.status === 'resolved' || c.status === 'closed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {COMPLAINT_STATUS_LABELS[c.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Category selector */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 mb-2 block">What is this about?</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(COMPLAINT_CATEGORY_LABELS) as ComplaintCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`p-3 text-left rounded-lg border transition-colors ${
                category === cat
                  ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              <span className="text-base">{CATEGORY_ICONS[cat]}</span>
              <span className="block text-xs mt-1">{COMPLAINT_CATEGORY_LABELS[cat]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 mb-1 block">Please describe the issue</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell us what happened so we can fix it..."
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30"
          maxLength={1000}
        />
        <p className="text-[10px] text-gray-400 text-right mt-0.5">{description.length}/1000</p>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!category || !description.trim() || submitting}
        className="w-full py-3 bg-[#1B3A5C] text-white rounded-xl font-medium text-sm disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Complaint'}
      </button>
    </div>
  );
}
