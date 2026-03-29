'use client';
// app/(dashboard)/px-feedback/page.tsx
// Feedback Manager: ratings, responses, Google Review pipeline

'use client';

import { useState } from 'react';
import { useCurrentStaff, useFeedbackManager } from '@/lib/px/staff-hooks';
import { FEEDBACK_CATEGORIES } from '@/lib/px/types';
import type { PxFeedback } from '@/lib/px/types';

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ))}
    </div>
  );
}

function FeedbackCard({
  fb,
  onRespond,
  onPromptGoogle,
}: {
  fb: PxFeedback;
  onRespond: (response: string) => void;
  onPromptGoogle: () => void;
}) {
  const [showRespond, setShowRespond] = useState(false);
  const [response, setResponse] = useState('');

  const createdDate = new Date(fb.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <StarDisplay rating={fb.overall_rating} />
            <span className="text-xs text-gray-500">{createdDate}</span>
          </div>
          <p className="text-sm font-medium text-gray-900 mt-1">{fb.patient_name || 'Anonymous'}</p>
        </div>
        <div className="flex items-center gap-2">
          {fb.would_recommend === true && (
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Would recommend</span>
          )}
          {fb.google_review_status !== 'none' && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              Google: {fb.google_review_status}
            </span>
          )}
        </div>
      </div>

      {/* Category ratings */}
      {Object.keys(fb.category_ratings).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {Object.entries(fb.category_ratings).map(([key, val]) => {
            const cat = FEEDBACK_CATEGORIES.find((c) => c.key === key);
            return (
              <span key={key} className="text-[10px] bg-gray-50 px-2 py-0.5 rounded text-gray-600">
                {cat?.label || key}: {val}/5
              </span>
            );
          })}
        </div>
      )}

      {/* Comments */}
      {fb.comments && <p className="text-sm text-gray-700 mb-3">{fb.comments}</p>}

      {/* Staff response */}
      {fb.staff_response && (
        <div className="bg-blue-50 border border-blue-100 rounded p-2 mb-3">
          <p className="text-[10px] font-medium text-blue-700 mb-0.5">Health1 Response</p>
          <p className="text-xs text-blue-800">{fb.staff_response}</p>
        </div>
      )}

      {/* Actions */}
      {showRespond ? (
        <div className="space-y-2">
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Thank the patient or address their concern..."
            className="w-full border border-gray-200 rounded px-3 py-2 text-xs resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowRespond(false)} className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg">
              Cancel
            </button>
            <button
              onClick={() => { onRespond(response); setShowRespond(false); setResponse(''); }}
              disabled={!response.trim()}
              className="flex-1 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              Send Response
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {!fb.staff_response && (
            <button onClick={() => setShowRespond(true)} className="flex-1 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg">
              Respond
            </button>
          )}
          {fb.overall_rating >= 4 && fb.google_review_status === 'none' && fb.is_public && (
            <button onClick={onPromptGoogle} className="flex-1 py-1.5 text-xs font-medium text-green-600 border border-green-200 rounded-lg">
              Prompt for Google Review
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PxFeedbackPage() {
  const { staff, loading: staffLoading } = useCurrentStaff();
  const { feedback, loading, filter, setFilter, respondToFeedback, markForGoogleReview } = useFeedbackManager(staff?.centre_id);

  if (staffLoading || loading) {
    return <div className="p-6 text-center text-gray-500">Loading feedback...</div>;
  }

  // Compute quick stats
  const totalCount = feedback.length;
  const avgRating = totalCount > 0
    ? Math.round(feedback.reduce((s, f) => s + f.overall_rating, 0) / totalCount * 10) / 10
    : 0;
  const promoterCount = feedback.filter((f) => f.overall_rating >= 4).length;
  const detractorCount = feedback.filter((f) => f.overall_rating <= 2).length;
  const googleCount = feedback.filter((f) => f.google_review_status !== 'none').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Feedback Manager</h1>
        <p className="text-sm text-gray-500">Patient ratings, responses, and Google Review pipeline</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-purple-600">{avgRating}/5</p>
          <p className="text-[10px] text-gray-500">Average rating ({totalCount})</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-600">{promoterCount}</p>
          <p className="text-[10px] text-gray-500">Promoters (4-5 stars)</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-red-600">{detractorCount}</p>
          <p className="text-[10px] text-gray-500">Detractors (1-2 stars)</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-blue-600">{googleCount}</p>
          <p className="text-[10px] text-gray-500">Google Reviews</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {([
          { key: 'all', label: 'All' },
          { key: 'positive', label: '4-5 stars' },
          { key: 'negative', label: '1-2 stars' },
          { key: 'no_response', label: 'No response' },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f.key ? 'bg-[#1B3A5C] text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {feedback.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-lg">No feedback matching filter.</div>
        ) : (
          feedback.map((fb) => (
            <FeedbackCard
              key={fb.id}
              fb={fb}
              onRespond={(response) => staff && respondToFeedback(fb.id, response, staff.id)}
              onPromptGoogle={() => markForGoogleReview(fb.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
