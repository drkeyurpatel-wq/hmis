// HEALTH1 HMIS — DISCOUNT APPROVALS
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Tag, Check, X, AlertCircle, Clock, IndianRupee,
  User, RefreshCw,
} from 'lucide-react';

interface PendingDiscount {
  id: string;
  encounter_id: string;
  patient_name: string;
  patient_uhid: string;
  encounter_number: string;
  original_amount: number;
  discount_amount: number;
  discount_percentage: number;
  reason: string;
  scheme_name: string | null;
  requested_by: string;
  requested_at: string;
}

export default function DiscountApprovalsPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingDiscount[]>([]);
  const [loading, setLoading] = useState(true);

  const centreId = 'CURRENT_CENTRE_ID';

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/approvals/pending?centre_id=${centreId}`);
      if (res.ok) setPending(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleAction = async (discountId: string, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? prompt('Reason for rejection:') : null;
    if (action === 'reject' && !reason) return;
    try {
      await fetch(`/api/billing/approvals/${discountId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      await loadPending();
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/billing')} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#0A2540] flex items-center gap-2">
                <Tag className="h-5 w-5 text-red-500" />
                Discount Approvals
              </h1>
              <p className="text-xs text-gray-500">Pending discount authorization requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
              {pending.length} pending
            </span>
            <button onClick={loadPending} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Check className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">No pending approvals</p>
            <p className="text-xs text-gray-400 mt-1">All discount requests have been processed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{item.patient_name}</span>
                      <span className="text-xs text-gray-500">{item.patient_uhid}</span>
                      <span className="text-xs font-mono text-gray-400">{item.encounter_number}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">Original</p>
                        <p className="text-sm font-mono font-semibold text-gray-900">
                          ₹{item.original_amount.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="text-xl text-gray-300">→</div>
                      <div>
                        <p className="text-[10px] text-red-500 uppercase">Discount</p>
                        <p className="text-sm font-mono font-bold text-red-600">
                          -₹{item.discount_amount.toLocaleString('en-IN')}
                          <span className="text-xs font-normal text-red-400 ml-1">
                            ({item.discount_percentage.toFixed(1)}%)
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      {item.scheme_name && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{item.scheme_name}</span>
                      )}
                      <span>Reason: {item.reason}</span>
                      <span>By: {item.requested_by}</span>
                      <span>
                        <Clock className="h-3 w-3 inline mr-0.5" />
                        {new Date(item.requested_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleAction(item.id, 'reject')}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'approve')}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
