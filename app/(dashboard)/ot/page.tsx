'use client';
import React, { useState } from 'react';
import { useOT, type OTBooking } from '@/lib/revenue/phase2-hooks';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';

function OTPageInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { bookings, rooms, loading, loadBookings, updateBookingStatus } = useOT(centreId);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBooking, setSelectedBooking] = useState<OTBooking | null>(null);

  const stColor = (s: string) => s === 'scheduled' ? 'bg-yellow-100 text-yellow-800' : s === 'in_progress' ? 'bg-blue-100 text-blue-800 animate-pulse' : s === 'completed' ? 'bg-green-100 text-green-800' : s === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700';
  const scheduled = bookings.filter(b => b.status === 'scheduled').length;
  const inProgress = bookings.filter(b => b.status === 'in_progress').length;
  const completed = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">OT Scheduling</h1><p className="text-sm text-gray-500">Operation Theatre bookings and tracking</p></div>
        <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); loadBookings(e.target.value); }} className="text-sm border rounded-lg px-3 py-2" />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total today</div><div className="text-2xl font-bold">{bookings.length}</div></div>
        <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Scheduled</div><div className="text-2xl font-bold text-yellow-700">{scheduled}</div></div>
        <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">In progress</div><div className="text-2xl font-bold text-blue-700">{inProgress}</div></div>
        <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Completed</div><div className="text-2xl font-bold text-green-700">{completed}</div></div>
      </div>

      {/* OT Room timeline */}
      {rooms.length > 0 && <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="font-semibold text-sm mb-3">OT Rooms</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">{rooms.map((r: any) => {
          const inUse = bookings.some(b => b.otRoom === r.name && b.status === 'in_progress');
          return <div key={r.id} className={`rounded-lg p-3 text-center border ${inUse ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
            <div className="font-medium text-sm">{r.name}</div>
            <div className={`text-xs mt-1 ${inUse ? 'text-red-600' : 'text-green-600'}`}>{inUse ? 'IN USE' : 'Available'}</div>
          </div>;
        })}</div>
      </div>}

      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
      bookings.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400">No OT bookings for {dateFilter}</div> :
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
        <th className="text-left p-3 font-medium text-gray-500">Time</th><th className="text-left p-3 font-medium text-gray-500">OT</th>
        <th className="text-left p-3 font-medium text-gray-500">Patient</th><th className="text-left p-3 font-medium text-gray-500">Procedure</th>
        <th className="text-left p-3 font-medium text-gray-500">Surgeon</th><th className="text-left p-3 font-medium text-gray-500">Duration</th>
        <th className="text-left p-3 font-medium text-gray-500">Status</th><th className="p-3">Actions</th>
      </tr></thead><tbody>{bookings.map(b => (
        <tr key={b.id} className="border-b hover:bg-gray-50">
          <td className="p-3 font-mono text-xs">{b.scheduledStart?.slice(0,5)}</td>
          <td className="p-3 text-xs font-medium">{b.otRoom}</td>
          <td className="p-3"><div className="text-sm">{b.patientName}</div><div className="text-xs text-gray-400">{b.ipdNumber}</div></td>
          <td className="p-3 text-sm">{b.procedureName}</td>
          <td className="p-3 text-xs">{b.surgeonName}</td>
          <td className="p-3 text-xs">{b.estimatedDuration ? b.estimatedDuration + ' min' : '--'}</td>
          <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${stColor(b.status)}`}>{b.status.replace('_',' ')}</span></td>
          <td className="p-3"><div className="flex gap-1">
            {b.status === 'scheduled' && <button onClick={() => updateBookingStatus(b.id, 'in_progress')} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">Start</button>}
            {b.status === 'in_progress' && <button onClick={() => updateBookingStatus(b.id, 'completed')} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">Complete</button>}
          </div></td>
        </tr>
      ))}</tbody></table></div>}
    </div>
  );
}

export default function OTPage() { return <RoleGuard module="ot"><OTPageInner /></RoleGuard>; }
