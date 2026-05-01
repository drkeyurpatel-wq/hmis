'use client';
import { useEffect, useState } from 'react';
const statusColors: Record<string, string> = { DRAFT: 'bg-gray-100', UNDER_REVIEW: 'bg-yellow-100 text-yellow-800', APPROVED: 'bg-blue-100 text-blue-800', ACTIVE: 'bg-green-100 text-green-800', SUPERSEDED: 'bg-red-100 text-red-800' };
export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/quality/documents?centre_id=${centreId}`).then(r => r.json()).then(setDocs); }, []);
  const overdue = docs.filter(d => d.next_review_date && new Date(d.next_review_date) < new Date());
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Document Control</h1>
      <p className="text-sm text-gray-500">IMS.1-4 — SOPs, Policies, Clinical Guidelines</p>
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 text-sm">🔴 Overdue for Review ({overdue.length})</h3>
          <div className="mt-2 space-y-1">{overdue.map(d => (
            <div key={d.id} className="text-sm">{d.document_code} — {d.title} (due {new Date(d.next_review_date).toLocaleDateString()})</div>
          ))}</div>
        </div>
      )}
      <div className="border rounded-lg divide-y">
        {docs.length === 0 && <div className="p-8 text-center text-gray-500">No documents registered</div>}
        {docs.map(d => (
          <div key={d.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2"><code className="text-xs font-mono bg-gray-100 px-1 rounded">{d.document_code}</code><span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[d.status]}`}>{d.status}</span></div>
              <div className="text-sm font-medium mt-0.5">{d.title}</div>
              <div className="text-xs text-gray-500">{d.category} • v{d.current_version} • {d.department || 'All'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
