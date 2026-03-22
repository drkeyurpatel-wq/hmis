'use client';
import React from 'react';

interface ScheduleTabProps {
  todayVisits: any[];
  visitStColor: (s: string) => string;
  checkin: (visitId: string) => Promise<void>;
  onDocumentVisit: (enrollmentId: string, visitId: string) => void;
  flash: (m: string) => void;
  reloadSchedule: () => void;
}

export default function ScheduleTab({ todayVisits, visitStColor, checkin, onDocumentVisit, flash, reloadSchedule }: ScheduleTabProps) {
  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">My Schedule — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      {todayVisits.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No visits assigned to you today</div> :
      <div className="space-y-3">{todayVisits.map((v: any, i: number) => (
        <div key={v.id} className={`bg-white rounded-xl border p-4 ${v.status === 'in_progress' ? 'border-blue-400 ring-2 ring-blue-100' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="font-medium">{v.enrollment?.patient?.first_name} {v.enrollment?.patient?.last_name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${visitStColor(v.status)}`}>{v.status}</span>
            </div>
            <span className="text-sm font-medium text-gray-500">{v.scheduled_time?.slice(0,5) || '—'}</span>
          </div>
          <div className="text-xs text-gray-600 mb-2">{v.enrollment?.address_line1}{v.enrollment?.landmark ? ' | Nr. ' + v.enrollment.landmark : ''}</div>
          <div className="flex gap-2 flex-wrap">
            {v.status === 'scheduled' && <button onClick={async () => { await checkin(v.id); flash('Checked in'); reloadSchedule(); }}
              className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium">Check In</button>}
            {v.status === 'in_progress' && <button onClick={() => onDocumentVisit(v.enrollment_id, v.id)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium">Document Visit</button>}
            <a href={`tel:${v.enrollment?.patient?.phone_primary}`} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Call Patient</a>
            {v.enrollment?.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${v.enrollment.latitude},${v.enrollment.longitude}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg">Navigate</a>}
            <a href={`https://wa.me/91${v.enrollment?.patient?.phone_primary?.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-green-50 text-green-700 text-xs rounded-lg">WhatsApp</a>
          </div>
        </div>
      ))}</div>}
    </div>
  );
}
