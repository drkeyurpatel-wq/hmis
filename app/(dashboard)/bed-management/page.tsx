'use client';
import React, { useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useBedManagement, type BedData, type BedStatus } from '@/lib/bed-management/bed-hooks';

const STATUS_CONFIG: Record<BedStatus, { bg: string; border: string; text: string; label: string }> = {
  available:    { bg: 'bg-green-50',  border: 'border-green-300', text: 'text-green-700', label: 'Available' },
  occupied:     { bg: 'bg-blue-50',   border: 'border-blue-300',  text: 'text-teal-700',  label: 'Occupied' },
  reserved:     { bg: 'bg-amber-50',  border: 'border-amber-300', text: 'text-amber-700', label: 'Reserved' },
  maintenance:  { bg: 'bg-gray-100',  border: 'border-gray-300',  text: 'text-gray-500',  label: 'Maintenance' },
  housekeeping: { bg: 'bg-orange-50', border: 'border-orange-300',text: 'text-orange-700', label: 'Housekeeping' },
};

function BedCard({ bed, onSelect }: { bed: BedData; onSelect: (b: BedData) => void }) {
  const cfg = STATUS_CONFIG[bed.status];
  const isLongStay = (bed.daysAdmitted || 0) > 7;
  const isOverdue = bed.expectedDischarge && new Date(bed.expectedDischarge) < new Date();

  return (
    <div onClick={() => onSelect(bed)}
      className={`rounded-lg border-2 ${cfg.border} ${cfg.bg} p-2 cursor-pointer hover:shadow-md transition-all min-w-[110px] relative`}>
      {/* Bed number badge */}
      <div className="flex items-center justify-between mb-1">
        <span className={`font-bold text-sm ${cfg.text}`}>{bed.bedNumber}</span>
        {bed.status === 'occupied' && bed.daysAdmitted !== undefined && (
          <span className={`text-[9px] px-1 py-0.5 rounded ${isLongStay ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-teal-700'}`}>
            D{bed.daysAdmitted}
          </span>
        )}
        {isOverdue && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse absolute top-1 right-1" title="Past expected discharge" />}
      </div>

      {bed.status === 'occupied' && bed.patientName ? (
        <div className="space-y-0.5">
          <div className="text-xs font-medium truncate" title={bed.patientName}>{bed.patientName}</div>
          <div className="text-[9px] text-gray-500 truncate">{bed.uhid}</div>
          <div className="text-[9px] text-gray-500 truncate">{bed.doctorName}</div>
          {bed.payorType && (
            <span className={`text-[8px] px-1 py-0.5 rounded ${
              bed.payorType === 'self' ? 'bg-gray-100 text-gray-600' :
              bed.payorType === 'insurance' ? 'bg-blue-100 text-teal-600' :
              bed.payorType?.startsWith('govt') ? 'bg-green-100 text-green-600' :
              'bg-purple-100 text-purple-600'
            }`}>{bed.payorType.replace('govt_', '').replace('_', ' ')}</span>
          )}
        </div>
      ) : (
        <div className={`text-[10px] ${cfg.text}`}>{cfg.label}</div>
      )}
    </div>
  );
}

export default function BedManagementPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { beds, wards, totals, loading, error, load, updateBedStatus, transferBed, markClean } = useBedManagement(centreId);

  const [selectedBed, setSelectedBed] = useState<BedData | null>(null);
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferToBedId, setTransferToBedId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const TRANSFER_REASONS = [
    'Patient request', 'Clinical upgrade (to ICU)', 'Clinical downgrade (from ICU)',
    'Infection isolation', 'Room change for privacy', 'Bed malfunction',
    'Same ward — closer to nursing station', 'Insurance/payor change',
  ];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableBeds = useMemo(() => beds.filter(b => b.status === 'available'), [beds]);

  const filteredWards = useMemo(() => {
    let w = wards;
    if (wardFilter !== 'all') w = w.filter(ward => ward.wardId === wardFilter);
    return w;
  }, [wards, wardFilter]);

  const doTransfer = async () => {
    if (!selectedBed?.admissionId || !transferToBedId || !transferReason) return;
    setActionError('');
    const result = await transferBed(selectedBed.admissionId, selectedBed.id, transferToBedId, transferReason, staffId);
    if (!result.success) { setActionError(result.error || 'Transfer failed'); return; }
    flash(`Transferred to ${beds.find(b => b.id === transferToBedId)?.wardName} / ${beds.find(b => b.id === transferToBedId)?.bedNumber}`);
    setSelectedBed(null); setShowTransfer(false); setTransferToBedId(''); setTransferReason('');
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
      <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bed Management</h1>
          <p className="text-xs text-gray-500">{wards.length} wards | {totals.total} beds | Real-time occupancy</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">Refresh</button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-7 gap-2">
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-2xl font-bold">{totals.occupancyPct}%</div><div className="text-[10px] text-gray-500">Occupancy</div></div>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = (totals as any)[status] || 0;
          return (
            <div key={status} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`rounded-xl border p-3 text-center cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-teal-500' : ''} ${cfg.bg}`}>
              <div className={`text-2xl font-bold ${cfg.text}`}>{count}</div>
              <div className="text-[10px] text-gray-500">{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Ward filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setWardFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-xs border ${wardFilter === 'all' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-gray-200'}`}>All Wards</button>
        {wards.map(w => (
          <button key={w.wardId} onClick={() => setWardFilter(w.wardId)}
            className={`px-2.5 py-1 rounded-lg text-xs border ${wardFilter === w.wardId ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-gray-200'}`}>
            {w.wardName} <span className="text-[10px] opacity-70">({w.occupied}/{w.totalBeds})</span>
          </button>
        ))}
      </div>

      {/* Visual Board */}
      {filteredWards.map(ward => (
        <div key={ward.wardId} className="bg-white rounded-xl border overflow-hidden">
          {/* Ward header */}
          <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm">{ward.wardName}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                ward.wardType === 'icu' ? 'bg-red-100 text-red-700' :
                ward.wardType === 'transplant_icu' ? 'bg-red-100 text-red-700' :
                ward.wardType === 'private' ? 'bg-purple-100 text-purple-700' :
                ward.wardType === 'semi_private' ? 'bg-blue-100 text-teal-700' :
                ward.wardType === 'isolation' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-700'
              }`}>{ward.wardType.replace('_', ' ')}</span>
              {ward.floor && <span className="text-[10px] text-gray-400">Floor {ward.floor}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-700 font-semibold">{ward.available} free</span>
              <span className="text-teal-700">{ward.occupied} occ</span>
              {ward.housekeeping > 0 && <span className="text-orange-700">{ward.housekeeping} cleaning</span>}
              <span className={`font-bold ${ward.occupancyPct >= 90 ? 'text-red-700' : ward.occupancyPct >= 70 ? 'text-amber-700' : 'text-green-700'}`}>{ward.occupancyPct}%</span>
            </div>
          </div>

          {/* Rooms → Beds */}
          <div className="p-3 space-y-3">
            {ward.rooms.map(room => {
              const roomBeds = statusFilter === 'all' ? room.beds : room.beds.filter(b => b.status === statusFilter);
              if (roomBeds.length === 0 && statusFilter !== 'all') return null;
              return (
                <div key={room.roomId} className="flex items-start gap-3">
                  <div className="w-16 pt-1 text-right">
                    <div className="text-xs font-semibold text-gray-700">{room.roomNumber}</div>
                    <div className="text-[9px] text-gray-400">{room.roomType}</div>
                    {room.dailyRate > 0 && <div className="text-[9px] text-gray-400">{'₹'}{room.dailyRate.toLocaleString('en-IN')}/d</div>}
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {roomBeds.map(bed => <BedCard key={bed.id} bed={bed} onSelect={setSelectedBed} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {wards.length === 0 && <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No wards configured. Add wards, rooms, and beds in Settings.</div>}

      {/* ---- BED ACTION PANEL ---- */}
      {selectedBed && <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl p-4 z-40">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{selectedBed.wardName} / {selectedBed.roomNumber} / {selectedBed.bedNumber}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${STATUS_CONFIG[selectedBed.status].bg} ${STATUS_CONFIG[selectedBed.status].text} ${STATUS_CONFIG[selectedBed.status].border} border`}>
                  {STATUS_CONFIG[selectedBed.status].label}
                </span>
              </div>
              {selectedBed.status === 'occupied' && selectedBed.patientName && (
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">{selectedBed.patientName}</span>
                  <span className="text-gray-400 mx-2">|</span>{selectedBed.uhid}
                  <span className="text-gray-400 mx-2">|</span>Dr. {selectedBed.doctorName}
                  <span className="text-gray-400 mx-2">|</span>Day {selectedBed.daysAdmitted}
                  {selectedBed.diagnosis && <><span className="text-gray-400 mx-2">|</span><span className="text-gray-500">{selectedBed.diagnosis}</span></>}
                </div>
              )}
            </div>
            <button onClick={() => { setSelectedBed(null); setShowTransfer(false); setActionError(''); }} className="text-gray-400 hover:text-gray-600 text-xl px-2">x</button>
          </div>

          {actionError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 mb-3">{actionError}</div>}

          {/* Actions based on status */}
          <div className="flex gap-2 flex-wrap">
            {selectedBed.status === 'available' && <>
              <button onClick={async () => { const r = await updateBedStatus(selectedBed.id, 'reserved'); if (!r.success) setActionError(r.error || ''); else { flash('Reserved'); setSelectedBed(null); }}} className="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg">Reserve</button>
              <button onClick={async () => { const r = await updateBedStatus(selectedBed.id, 'maintenance'); if (!r.success) setActionError(r.error || ''); else { flash('Maintenance'); setSelectedBed(null); }}} className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg">Mark Maintenance</button>
            </>}

            {selectedBed.status === 'occupied' && <>
              <button onClick={() => { setShowTransfer(!showTransfer); setActionError(''); }} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg">{showTransfer ? 'Cancel Transfer' : 'Transfer Bed'}</button>
              <button onClick={async () => { const r = await updateBedStatus(selectedBed.id, 'housekeeping'); if (!r.success) setActionError(r.error || ''); else { flash('Marked for housekeeping'); setSelectedBed(null); }}} className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg">Mark Housekeeping (Post-discharge)</button>
            </>}

            {selectedBed.status === 'housekeeping' && <>
              <button onClick={async () => { const r = await markClean(selectedBed.id); if (!r.success) setActionError(r.error || ''); else { flash('Bed is now available'); setSelectedBed(null); }}} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Mark Clean &amp; Available</button>
            </>}

            {selectedBed.status === 'reserved' && <>
              <button onClick={async () => { const r = await updateBedStatus(selectedBed.id, 'available'); if (!r.success) setActionError(r.error || ''); else { flash('Unreserved'); setSelectedBed(null); }}} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Unreserve (Make Available)</button>
            </>}

            {selectedBed.status === 'maintenance' && <>
              <button onClick={async () => { const r = await updateBedStatus(selectedBed.id, 'available'); if (!r.success) setActionError(r.error || ''); else { flash('Available'); setSelectedBed(null); }}} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Mark Available</button>
            </>}
          </div>

          {/* Transfer form */}
          {showTransfer && selectedBed.status === 'occupied' && selectedBed.admissionId && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-purple-700">Transfer {selectedBed.patientName}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Transfer to bed *</label>
                  <select value={transferToBedId} onChange={e => setTransferToBedId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Select available bed</option>
                    {availableBeds.map(b => (
                      <option key={b.id} value={b.id}>{b.wardName} / {b.roomNumber} / {b.bedNumber} ({b.wardType}) {'₹'}{b.dailyRate}/d</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Reason *</label>
                  <select value={transferReason} onChange={e => setTransferReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Select reason</option>
                    {TRANSFER_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={doTransfer} disabled={!transferToBedId || !transferReason}
                className="px-5 py-2 bg-purple-600 text-white text-sm rounded-lg disabled:opacity-40">Confirm Transfer</button>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
