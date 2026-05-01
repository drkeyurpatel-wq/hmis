'use client';
import { useEffect, useState } from 'react';
export default function MortalityPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/quality/mortality?centre_id=${centreId}`).then(r => r.json()).then(setReviews); }, []);
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Mortality Review</h1>
      <p className="text-sm text-gray-500">Structured mortality audit per PSQ standards</p>
      <div className="border rounded-lg divide-y">
        {reviews.length === 0 && <div className="p-8 text-center text-gray-500">No mortality reviews recorded</div>}
        {reviews.map((r: any) => (
          <div key={r.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded ${r.expected ? 'bg-gray-100' : 'bg-red-100 text-red-800'}`}>{r.expected ? 'Expected' : 'Unexpected'}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 ml-1">{r.department}</span>
              </div>
              <span className="text-sm text-gray-500">{new Date(r.death_date).toLocaleDateString()}</span>
            </div>
            <p className="text-sm mt-1">{r.primary_diagnosis} — {r.cause_of_death}</p>
            {r.preventability && <div className="text-xs text-gray-500 mt-1">Preventability: {r.preventability}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
