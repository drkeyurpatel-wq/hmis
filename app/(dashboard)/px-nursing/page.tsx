// app/(dashboard)/px-nursing/page.tsx
// Nursing station: nurse call queue + food order approval

'use client';

import { useState } from 'react';
import { useCurrentStaff, useNurseCallQueue, useFoodApprovalQueue } from '@/lib/px/staff-hooks';
import {
  NURSE_CALL_PRIORITY_LABELS,
  NURSE_CALL_PRIORITY_COLORS,
  FOOD_ORDER_STATUS_LABELS,
} from '@/lib/px/types';
import type { NurseCall, FoodOrder } from '@/lib/px/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function NurseCallCard({
  call,
  onAcknowledge,
  onComplete,
}: {
  call: NurseCall;
  onAcknowledge: () => void;
  onComplete: () => void;
}) {
  const isEmergency = call.priority === 'emergency';
  const borderColor = isEmergency
    ? 'border-red-300 bg-red-50'
    : call.priority === 'urgent'
    ? 'border-orange-200 bg-orange-50'
    : 'border-gray-200 bg-white';

  return (
    <div className={`rounded-lg p-4 border ${borderColor} ${isEmergency ? 'animate-pulse' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${NURSE_CALL_PRIORITY_COLORS[call.priority]}`}>
              {NURSE_CALL_PRIORITY_LABELS[call.priority]}
            </span>
            <span className="text-xs text-gray-500">{timeAgo(call.created_at)}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-1">{call.patient_name}</p>
          <p className="text-xs text-gray-500">
            {call.ward_name} — Bed {call.bed_label}
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-800 mb-1">{call.reason}</p>
      {call.details && <p className="text-xs text-gray-500 mb-2">{call.details}</p>}

      <div className="flex gap-2 mt-3">
        {call.status === 'pending' && (
          <button
            onClick={onAcknowledge}
            className="flex-1 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Acknowledge
          </button>
        )}
        {(call.status === 'acknowledged' || call.status === 'in_progress') && (
          <button
            onClick={onComplete}
            className="flex-1 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}

function FoodApprovalCard({
  order,
  onApprove,
  onReject,
}: {
  order: FoodOrder;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{order.patient_name}</p>
          <p className="text-xs text-gray-500">
            {order.ward_name} — Bed {order.bed_label} — {timeAgo(order.created_at)}
          </p>
        </div>
        <span className="text-sm font-semibold text-gray-900">₹{order.total_amount}</span>
      </div>

      {order.dietary_restrictions && (
        <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded mb-2">
          Diet restriction: {order.dietary_restrictions}
        </div>
      )}

      <div className="bg-gray-50 rounded p-2 mb-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs py-0.5">
            <span className="text-gray-700">
              {item.qty}× {item.name}
            </span>
            <span className="text-gray-500">₹{item.price * item.qty}</span>
          </div>
        ))}
      </div>

      {showReject ? (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Reason for rejection (e.g., dietary conflict)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowReject(false)}
              className="flex-1 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={onReject}
              disabled={!rejectReason.trim()}
              className="flex-1 py-2 text-xs font-medium bg-red-600 text-white rounded-lg disabled:opacity-50"
            >
              Reject Order
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setShowReject(true)}
            className="flex-1 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="flex-1 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Approve
          </button>
        </div>
      )}
    </div>
  );
}

export default function PxNursingPage() {
  const { staff, loading: staffLoading } = useCurrentStaff();
  const { calls, updateCallStatus } = useNurseCallQueue(staff?.centre_id);
  const { orders, approveOrder, rejectOrder } = useFoodApprovalQueue(staff?.centre_id);

  const [activeTab, setActiveTab] = useState<'calls' | 'food'>('calls');

  if (staffLoading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  const pendingCalls = calls.filter((c) => c.status === 'pending').length;
  const pendingFood = orders.length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nursing Station — PX</h1>
          <p className="text-sm text-gray-500">Patient requests & food order approvals</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-500">Live — 5s refresh</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('calls')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'calls' ? 'bg-[#1B3A5C] text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Nurse Calls {pendingCalls > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCalls}</span>}
        </button>
        <button
          onClick={() => setActiveTab('food')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'food' ? 'bg-[#1B3A5C] text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Food Approvals {pendingFood > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingFood}</span>}
        </button>
      </div>

      {/* Nurse Calls Tab */}
      {activeTab === 'calls' && (
        <div className="space-y-3">
          {calls.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-lg">
              No active nurse calls. All clear.
            </div>
          ) : (
            calls.map((call) => (
              <NurseCallCard
                key={call.id}
                call={call}
                onAcknowledge={() => staff && updateCallStatus(call.id, 'acknowledged', staff.id)}
                onComplete={() => staff && updateCallStatus(call.id, 'completed', staff.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Food Approvals Tab */}
      {activeTab === 'food' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-lg">
              No pending food orders to approve.
            </div>
          ) : (
            orders.map((order) => (
              <FoodApprovalCard
                key={order.id}
                order={order}
                onApprove={() => staff && approveOrder(order.id, staff.id)}
                onReject={() => staff && rejectOrder(order.id, staff.id, 'Dietary conflict')}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
