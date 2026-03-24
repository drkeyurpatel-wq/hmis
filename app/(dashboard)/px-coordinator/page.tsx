// app/(dashboard)/px-coordinator/page.tsx
// IPD Coordinator: overall PX dashboard with stats, complaints, SLA tracking

'use client';

import { useState } from 'react';
import { useCurrentStaff, useCoordinatorDashboard, useNurseCallQueue, useKitchenQueue } from '@/lib/px/staff-hooks';
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  NURSE_CALL_PRIORITY_LABELS,
  NURSE_CALL_PRIORITY_COLORS,
} from '@/lib/px/types';
import type { PxComplaint, ComplaintStatus } from '@/lib/px/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ComplaintRow({
  complaint,
  onResolve,
  onAssign,
}: {
  complaint: PxComplaint;
  onResolve: (notes: string) => void;
  onAssign: () => void;
}) {
  const [showResolve, setShowResolve] = useState(false);
  const [notes, setNotes] = useState('');

  const slaHoursElapsed = (Date.now() - new Date(complaint.created_at).getTime()) / 3600000;
  const slaBreached = slaHoursElapsed > complaint.sla_hours;

  return (
    <div className={`bg-white rounded-lg p-4 border ${slaBreached ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">{COMPLAINT_CATEGORY_LABELS[complaint.category]}</span>
            {slaBreached && (
              <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">SLA BREACHED</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{complaint.patient_name}</p>
          <p className="text-xs text-gray-500">{complaint.ward_name} — Bed {complaint.bed_label}</p>
        </div>
        <div className="text-right">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            complaint.status === 'open' ? 'bg-red-100 text-red-700' :
            complaint.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
            complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {COMPLAINT_STATUS_LABELS[complaint.status]}
          </span>
          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(complaint.created_at)}</p>
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-3">{complaint.description}</p>

      {showResolve ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Resolution notes..."
            className="w-full border border-gray-200 rounded px-3 py-2 text-xs resize-none h-16 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowResolve(false)} className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg">
              Cancel
            </button>
            <button
              onClick={() => { onResolve(notes); setShowResolve(false); }}
              disabled={!notes.trim()}
              className="flex-1 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {complaint.status === 'open' && (
            <button onClick={onAssign} className="flex-1 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg">
              Assign to Me
            </button>
          )}
          {(complaint.status === 'assigned' || complaint.status === 'in_progress') && (
            <button onClick={() => setShowResolve(true)} className="flex-1 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg">
              Resolve
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PxCoordinatorPage() {
  const { staff, loading: staffLoading } = useCurrentStaff();
  const { stats, recentComplaints, loading, updateComplaintStatus } = useCoordinatorDashboard(staff?.centre_id);
  const { calls } = useNurseCallQueue(staff?.centre_id, 10000);

  const [tab, setTab] = useState<'overview' | 'complaints' | 'calls'>('overview');

  if (staffLoading || loading) {
    return <div className="p-6 text-center text-gray-500">Loading coordinator dashboard...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Patient Experience Dashboard</h1>
          <p className="text-sm text-gray-500">IPD Coordinator view — real-time overview</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-500">Live — 15s refresh</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <StatCard label="Pending food orders" value={stats.pending_food_orders} color="text-amber-600" />
        <StatCard label="Active nurse calls" value={stats.active_nurse_calls} color="text-red-600" />
        <StatCard label="Open complaints" value={stats.open_complaints} color="text-orange-600" />
        <StatCard label="Average rating" value={stats.avg_rating > 0 ? `${stats.avg_rating}/5` : '—'} color="text-purple-600" sub={`${stats.total_feedback} reviews`} />
        <StatCard
          label="Avg response time"
          value={calls.length > 0
            ? `${Math.round(calls.filter(c => c.response_seconds).reduce((s, c) => s + (c.response_seconds || 0), 0) / Math.max(calls.filter(c => c.response_seconds).length, 1) / 60)}m`
            : '—'}
          color="text-blue-600"
          sub="Nurse calls"
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-4">
        {(['overview', 'complaints', 'calls'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
              tab === t ? 'bg-[#1B3A5C] text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {t === 'calls' ? 'Nurse calls' : t}
            {t === 'complaints' && stats.open_complaints > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.open_complaints}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent complaints</h3>
            <div className="space-y-2">
              {recentComplaints.slice(0, 5).map((c) => (
                <div key={c.id} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">{c.patient_name}</span>
                    <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{COMPLAINT_CATEGORY_LABELS[c.category]}: {c.description.slice(0, 80)}...</p>
                </div>
              ))}
              {recentComplaints.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-lg">No open complaints</div>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Active nurse calls</h3>
            <div className="space-y-2">
              {calls.slice(0, 5).map((c) => (
                <div key={c.id} className={`bg-white rounded-lg p-3 border ${c.priority === 'emergency' ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">{c.patient_name} — Bed {c.bed_label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${NURSE_CALL_PRIORITY_COLORS[c.priority]}`}>
                      {NURSE_CALL_PRIORITY_LABELS[c.priority]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{c.reason}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(c.created_at)}</p>
                </div>
              ))}
              {calls.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-lg">All clear</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complaints Tab */}
      {tab === 'complaints' && (
        <div className="space-y-3">
          {recentComplaints.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-lg">No open complaints.</div>
          ) : (
            recentComplaints.map((c) => (
              <ComplaintRow
                key={c.id}
                complaint={c}
                onAssign={() => staff && updateComplaintStatus(c.id, 'assigned', staff.id)}
                onResolve={(notes) => staff && updateComplaintStatus(c.id, 'resolved', staff.id, notes)}
              />
            ))
          )}
        </div>
      )}

      {/* Calls Tab — read-only overview for coordinator */}
      {tab === 'calls' && (
        <div className="space-y-2">
          {calls.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-lg">No active calls.</div>
          ) : (
            calls.map((c) => (
              <div key={c.id} className={`bg-white rounded-lg p-3 border ${c.priority === 'emergency' ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${NURSE_CALL_PRIORITY_COLORS[c.priority]}`}>
                      {NURSE_CALL_PRIORITY_LABELS[c.priority]}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{c.patient_name}</span>
                    <span className="text-xs text-gray-500">{c.ward_name} — Bed {c.bed_label}</span>
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700">{c.reason}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Status: {c.status} {c.response_seconds ? `| Response: ${Math.floor(c.response_seconds / 60)}m` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
