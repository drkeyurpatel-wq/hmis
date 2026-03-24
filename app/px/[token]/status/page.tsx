// app/px/[token]/status/page.tsx

'use client';

import { useParams, useRouter } from 'next/navigation';
import { usePxToken, useMyOrders, useMyNurseCalls, useMyComplaints } from '@/lib/px/patient-hooks';
import {
  FOOD_ORDER_STATUS_LABELS,
  FOOD_ORDER_STATUS_COLORS,
  NURSE_CALL_PRIORITY_LABELS,
  NURSE_CALL_PRIORITY_COLORS,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
} from '@/lib/px/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatusBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{label}</span>
  );
}

export default function StatusPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { context } = usePxToken(token);
  const { orders, loading: ordersLoading } = useMyOrders(context?.token_id);
  const { calls, loading: callsLoading } = useMyNurseCalls(context?.token_id);
  const { complaints, loading: complaintsLoading } = useMyComplaints(context?.token_id);

  const loading = ordersLoading || callsLoading || complaintsLoading;
  const isEmpty = orders.length === 0 && calls.length === 0 && complaints.length === 0;

  return (
    <div className="px-4 pt-4 pb-8">
      <button onClick={() => router.push(`/px/${token}`)} className="flex items-center gap-1 text-sm text-gray-500 mb-3">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-lg font-semibold text-gray-900 mb-1">My Requests</h1>
      <p className="text-xs text-gray-500 mb-4">Track all your active and past requests. Auto-refreshes every 15 seconds.</p>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-gray-100 rounded-lg h-16 animate-pulse" />)}
        </div>
      )}

      {!loading && isEmpty && (
        <div className="text-center py-12 text-sm text-gray-400">No requests yet. Use the home screen to get started.</div>
      )}

      {/* Food Orders */}
      {orders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Food Orders</h2>
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">{timeAgo(order.created_at)}</span>
                  <StatusBadge
                    label={FOOD_ORDER_STATUS_LABELS[order.status]}
                    colorClass={FOOD_ORDER_STATUS_COLORS[order.status]}
                  />
                </div>
                <div className="text-sm text-gray-800">
                  {order.items.map((item, i) => (
                    <span key={i}>
                      {item.qty}× {item.name}
                      {i < order.items.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-1">Total: ₹{order.total_amount}</div>
                {order.nurse_notes && (
                  <div className="text-xs text-orange-600 mt-1">Nurse note: {order.nurse_notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nurse Calls */}
      {calls.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nurse Calls</h2>
          <div className="space-y-2">
            {calls.map((call) => (
              <div key={call.id} className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={NURSE_CALL_PRIORITY_LABELS[call.priority]}
                      colorClass={NURSE_CALL_PRIORITY_COLORS[call.priority]}
                    />
                    <span className="text-xs text-gray-500">{timeAgo(call.created_at)}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    call.status === 'completed' ? 'bg-green-100 text-green-700' :
                    call.status === 'acknowledged' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {call.status === 'pending' ? 'Waiting' :
                     call.status === 'acknowledged' ? 'Nurse coming' :
                     call.status === 'in_progress' ? 'With you' : 'Done'}
                  </span>
                </div>
                <div className="text-sm text-gray-800">{call.reason}</div>
                {call.response_seconds && (
                  <div className="text-xs text-gray-400 mt-1">
                    Response time: {Math.floor(call.response_seconds / 60)}m {call.response_seconds % 60}s
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complaints */}
      {complaints.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Complaints</h2>
          <div className="space-y-2">
            {complaints.map((c) => (
              <div key={c.id} className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">{timeAgo(c.created_at)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    c.status === 'resolved' || c.status === 'closed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {COMPLAINT_STATUS_LABELS[c.status]}
                  </span>
                </div>
                <div className="text-xs font-medium text-gray-600">{COMPLAINT_CATEGORY_LABELS[c.category]}</div>
                <div className="text-sm text-gray-800 mt-0.5 line-clamp-2">{c.description}</div>
                {c.resolution_notes && (
                  <div className="text-xs text-green-600 mt-1 bg-green-50 rounded p-2">
                    Resolution: {c.resolution_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
