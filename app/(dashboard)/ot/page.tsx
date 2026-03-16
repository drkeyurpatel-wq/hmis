'use client';
import React, { useState, useEffect } from 'react';
import { useOT, type OTBooking } from '@/lib/revenue/phase2-hooks';
import { useDoctors } from '@/lib/revenue/hooks';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

function OTPageInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { bookings, rooms, loading, loadBookings, createBooking, updateBookingStatus } = useOT(centreId);
  const doctors = useDoctors(centreId);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBooking, setSelectedBooking] = useState<OTBooking | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [bkForm, setBkForm] = useState({ admissionId: '', otRoomId: '', surgeonId: '', anaesthetistId: '', procedureName: '', scheduledDate: new Date().toISOString().split('T')[0], scheduledStart: '09:00', estimatedDuration: 60 });

  // Load active admissions for booking
  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_admissions')
      .select('id, ipd_number, patient:hmis_patients!inner(first_name, last_name)')
      .eq('centre_id', centreId).eq('status', 'active').order('admission_date', { ascending: false })
      .then(({ data }: any) => setAdmissions(data || []));
  }, [centreId]);

  const handleCreateBooking = async () => {
    if (!bkForm.admissionId || !bkForm.otRoomId || !bkForm.surgeonId || !bkForm.procedureName) return;
    await createBooking({ ...bkForm, estimatedDuration: bkForm.estimatedDuration || undefined });
    setShowNew(false); setBkForm({ admissionId: '', otRoomId: '', surgeonId: '', anaesthetistId: '', procedureName: '', scheduledDate: dateFilter, scheduledStart: '09:00', estimatedDuration: 60 });
  };

  const stColor = (s: string) => s === 'scheduled' ? 'bg-yellow-100 text-yellow-800' : s === 'in_progress' ? 'bg-blue-100 text-blue-800 animate-pulse' : s === 'completed' ? 'bg-green-100 text-green-800' : s === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700';
  const scheduled = bookings.filter(b => b.status === 'scheduled').length;
  const inProgress = bookings.filter(b => b.status === 'in_progress').length;
  const completed = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">OT Scheduling</h1><p className="text-sm text-gray-500">Operation Theatre bookings and tracking</p></div>
        <div className="flex gap-2">
          <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); loadBookings(e.target.value); }} className="text-sm border rounded-lg px-3 py-2" />
          <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">+ New Booking</button>
        </div>
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

      {loading ? <TableSkeleton rows={6} cols={5} /> :
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
            <a href={`/ot/${b.id}`} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded hover:bg-purple-100 font-medium">Clinical</a>
          </div></td>
        </tr>
      ))}</tbody></table></div>}

      {/* New Booking Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">New OT Booking</h2>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Patient (from active admissions) *</label>
                <select value={bkForm.admissionId} onChange={e => setBkForm(f => ({...f, admissionId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select admission...</option>
                  {admissions.map((a: any) => <option key={a.id} value={a.id}>{a.ipd_number} — {a.patient?.first_name} {a.patient?.last_name}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">OT Room *</label>
                  <select value={bkForm.otRoomId} onChange={e => setBkForm(f => ({...f, otRoomId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Select room...</option>
                    {rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name} ({r.type || 'General'})</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500">Surgeon *</label>
                  <select value={bkForm.surgeonId} onChange={e => setBkForm(f => ({...f, surgeonId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Select surgeon...</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select></div>
              </div>
              <div><label className="text-xs text-gray-500">Anaesthetist</label>
                <select value={bkForm.anaesthetistId} onChange={e => setBkForm(f => ({...f, anaesthetistId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select (optional)...</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select></div>
              <div><label className="text-xs text-gray-500">Procedure name *</label>
                <input type="text" value={bkForm.procedureName} onChange={e => setBkForm(f => ({...f, procedureName: e.target.value}))} placeholder="e.g., Laparoscopic Cholecystectomy" className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-gray-500">Date *</label>
                  <input type="date" value={bkForm.scheduledDate} onChange={e => setBkForm(f => ({...f, scheduledDate: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="text-xs text-gray-500">Start time *</label>
                  <input type="time" value={bkForm.scheduledStart} onChange={e => setBkForm(f => ({...f, scheduledStart: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="text-xs text-gray-500">Duration (min)</label>
                  <input type="number" value={bkForm.estimatedDuration} onChange={e => setBkForm(f => ({...f, estimatedDuration: parseInt(e.target.value) || 60}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleCreateBooking} disabled={!bkForm.admissionId || !bkForm.otRoomId || !bkForm.surgeonId || !bkForm.procedureName}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Book OT</button>
                <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OTPage() { return <RoleGuard module="ot"><OTPageInner /></RoleGuard>; }
