'use client';
import React from 'react';

interface DashboardTabProps {
  stats: { active: number };
  todayVisits: any[];
  visitStColor: (s: string) => string;
  checkin: (visitId: string) => Promise<void>;
  onDocumentVisit: (enrollmentId: string, visitId: string) => void;
  flash: (m: string) => void;
  reloadSchedule: () => void;
}

export default function DashboardTab({ stats, todayVisits, visitStColor, checkin, onDocumentVisit, flash, reloadSchedule }: DashboardTabProps) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Active Patients</div><div className="text-2xl font-bold text-green-700">{stats.active}</div></div>
        <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Today&apos;s Visits</div><div className="text-2xl font-bold text-blue-700">{todayVisits.length}</div></div>
        <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">{todayVisits.filter(v => v.status === 'scheduled').length}</div></div>
        <div className="bg-red-50 rounded-xl p-4"><div className="text-xs text-gray-500">Escalations</div><div className="text-2xl font-bold text-red-700">{todayVisits.filter(v => v.needs_escalation).length}</div></div>
      </div>

      <h2 className="font-semibold text-sm mb-3">Today&apos;s Visits</h2>
      {todayVisits.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No visits scheduled for today</div> :
      <div className="space-y-2">{todayVisits.map((v: any) => (
        <div key={v.id} className={`bg-white rounded-lg border p-3 ${v.needs_escalation ? 'border-red-300' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{v.enrollment?.patient?.first_name} {v.enrollment?.patient?.last_name}</span>
              <span className="text-xs text-gray-400">{v.enrollment?.enrollment_number}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${visitStColor(v.status)}`}>{v.status}</span>
              {v.needs_escalation && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">ESCALATE</span>}
            </div>
            <span className="text-xs text-gray-500">{v.scheduled_time?.slice(0,5) || '—'}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{v.enrollment?.address_line1}{v.enrollment?.landmark ? ' (Nr. ' + v.enrollment.landmark + ')' : ''}</div>
          <div className="flex gap-2 mt-2">
            {v.status === 'scheduled' && <button onClick={async () => { await checkin(v.id); flash('Checked in — GPS recorded'); reloadSchedule(); }}
              className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg">Check In</button>}
            {v.status === 'in_progress' && <button onClick={() => onDocumentVisit(v.enrollment_id, v.id)}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg">Document & Checkout</button>}
            {v.enrollment?.patient?.phone_primary && <a href={`tel:${v.enrollment.patient.phone_primary}`} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">Call</a>}
            {v.enrollment?.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${v.enrollment.latitude},${v.enrollment.longitude}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">Navigate</a>}
          </div>
        </div>
      ))}</div>}
    </div>
  );
}
