// app/px/[token]/feedback/page.tsx

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePxToken, useSubmitFeedback } from '@/lib/px/patient-hooks';
import { FEEDBACK_CATEGORIES } from '@/lib/px/types';

function StarRating({ value, onChange, size = 'lg' }: { value: number; onChange: (v: number) => void; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange(star)} className="transition-transform active:scale-90">
          <svg
            className={`${sizeClass} ${star <= value ? 'text-amber-400' : 'text-gray-200'}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

const RATING_LABELS = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { context } = usePxToken(token);
  const { submit, submitting, error } = useSubmitFeedback(token);

  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [success, setSuccess] = useState(false);

  function setCategoryRating(key: string, value: number) {
    setCategoryRatings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (overallRating === 0) return;
    const id = await submit({
      overall_rating: overallRating,
      category_ratings: categoryRatings,
      comments: comments.trim() || undefined,
      would_recommend: wouldRecommend ?? undefined,
      is_public: isPublic,
    });
    if (id) setSuccess(true);
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Thank you!</h2>
          <p className="text-sm text-gray-500 mb-4">Your feedback helps us improve our services for all patients.</p>

          {overallRating >= 4 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800 mb-2">Glad you had a positive experience! Would you share it on Google?</p>
              <a
                href="https://g.page/health1shilaj/review"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-medium text-blue-700"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Write a Google Review
              </a>
            </div>
          )}

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

      <h1 className="text-lg font-semibold text-gray-900 mb-1">Share Your Feedback</h1>
      <p className="text-xs text-gray-500 mb-6">Your honest feedback helps us serve you better.</p>

      {/* Overall rating */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-4 text-center">
        <p className="text-sm font-medium text-gray-700 mb-3">How was your overall experience?</p>
        <div className="flex justify-center mb-2">
          <StarRating value={overallRating} onChange={setOverallRating} size="lg" />
        </div>
        {overallRating > 0 && (
          <p className="text-sm font-medium text-amber-600">{RATING_LABELS[overallRating]}</p>
        )}
      </div>

      {/* Category ratings */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Rate specific areas (optional)</p>
        <div className="space-y-3">
          {FEEDBACK_CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-700">{cat.label}</span>
                <span className="text-[10px] text-gray-400 ml-1">{cat.label_gu}</span>
              </div>
              <StarRating
                value={categoryRatings[cat.key] || 0}
                onChange={(v) => setCategoryRating(cat.key, v)}
                size="sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Comments */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 mb-1 block">Comments (optional)</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Tell us more about your experience..."
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30"
          maxLength={2000}
        />
      </div>

      {/* Would recommend */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Would you recommend Health1 to others?</p>
        <div className="flex gap-2">
          {[
            { val: true, label: 'Yes, definitely', emoji: '👍' },
            { val: false, label: 'Not really', emoji: '👎' },
          ].map((opt) => (
            <button
              key={String(opt.val)}
              onClick={() => setWouldRecommend(opt.val)}
              className={`flex-1 py-2.5 text-xs font-medium rounded-lg border transition-colors ${
                wouldRecommend === opt.val
                  ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Public consent */}
      <label className="flex items-start gap-2.5 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
        />
        <span className="text-xs text-gray-500">
          I consent to Health1 using my feedback (anonymized) for quality improvement and public reviews.
        </span>
      </label>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={overallRating === 0 || submitting}
        className="w-full py-3 bg-[#1B3A5C] text-white rounded-xl font-medium text-sm disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}
