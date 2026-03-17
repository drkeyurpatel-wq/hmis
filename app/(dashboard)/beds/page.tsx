'use client';
import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useBedBoard, type BedData, type WardSummary } from '@/lib/beds/bed-hooks';

// ============================================================
// Formatters
// ============================================================
const BED_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  available:    { bg: 'bg-green-50',  border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' },
  occupied:     { bg: 'bg-blue-50',   border: 'border-blue-300',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  reserved:     { bg: 'bg-amber-50',  border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
  maintenance:  { bg: 'bg-gray-100',  border: 'border-gray-300',  text: 'text-gray-500',  dot: 'bg-gray-400' },
  housekeeping: { bg: 'bg-orange-50', border: 'border-orange-300',text: 'text-orange-700',dot: 'bg-orange-500' },
};

const WARD_TYPE_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700', semi_private: 'bg-blue-100 text-blue-700', private: 'bg-purple-100 text-purple-700',
  icu: 'bg-red-100 text-red-700', nicu: 'bg-pink-100 text-pink-700', picu: 'bg-rose-100 text-rose-700',
  isolation: 'bg-yellow-100 text-yellow-700', transplant_icu: 'bg-red-200 text-red-800',
};

function daysSince(d: string | undefined): number {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

// ============================================================
// Bed Card Component
// ============================================================
function BedCard({ bed, onSelect }: { bed: BedData; onSelect: (bed: BedData) => void }) {
  const colors = BED_COLORS[bed.status] || BED_COLORS.available;
  const isOccupied = bed.status === 'occupied';
  const daysIn = bed.daysAdmitted || 0;
  const longStay = daysIn > 7;
  const veryLongStay = daysIn > 14;

  return (
    <div onClick={() => onSelect(bed)}
      className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-2 cursor-pointer hover:shadow-md transition-shadow min-w-[140px]`}>
      {/* Bed number + status dot */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-sm">{bed.bedNumber}</span>
        <div className="flex items-center gap-1">
          {isOccupied && veryLongStay && <span className="text-[9px] bg-red-500 text-white px-1 rounded">Long stay</span>}
          <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} title={bed.status} />
        </div>
      </div>

      {isOccupied && bed.patientName ? (
        <div className="space-y-0.5">
          <div className="text-xs font-semibold truncate" title={bed.patientName}>{bed.patientName}</div>
          <div className="text-[10px] text-gray-500">{bed.patientUhid} | {bed.patientAge}y {bed.patientGender?.charAt(0).toUpperCase()}</div>
          <div className="text-[10px] text-gray-500 truncate">{bed.doctorName}</div>
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-semibold ${veryLongStay ? 'text-red-600' : longStay ? 'text-amber-600' : 'text-gray-500'}`}>Day {daysIn}</span>
            {bed.payorType && <span className={`text-[9px] px-1 py-0.5 rounded ${
              bed.payorType === 'self' ? 'bg-gray-100 text-gray-600' :
              bed.payorType === 'insurance' ? 'bg-blue-100 text-blue-600' :
              bed.payorType?.startsWith('govt') ? 'bg-green-100 text-green-600' :
              'bg-purple-100 text-purple-600'
            }`}>{bed.payorType.replace('govt_','').replace('_',' ')}</span>}
          </div>
          {bed.expectedDischarge && <div className="text-[9px] text-gray-400">EDD: {bed.expectedDischarge}</div>}
        </div>
      ) : (
        <div className={`text-xs ${colors.text} capitalize mt-1`}>{bed.status === 'available' ? 'Available' : bed.status}</div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function BedManagementPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const { beds, wards, totals, loading, error, load, updateBedStatus, transferBed, reserveBed, markAvailable } = useBedBoard(centreId);

  const [selectedBed, setSelectedBed] = useState<BedData | null>(null);
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferToBed, setTransferToBed] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const availableBeds = beds.filter(b => b.status === 'available');
  const filteredWards = wardFilter === 'all' ? wards : wards.filter(w => w.wardId === wardFilter);

  // Action handlers
  const handleAction = async (action: string) => {
    if (!selectedBed) return;
    setActionError('');
    let result: { success: boolean; error?: string } = { success: false };

    if (action === 'mark_available') {
      result = await markAvailable(selectedBed.id);
    } else if (action === 'reserve') {
      result = await reserveBed(selectedBed.id);
    } else if (action === 'maintenance') {
      result = await updateBedStatus(selectedBed.id, 'maintenance');
    } else if (action === 'housekeeping') {
      result = await updateBedStatus(selectedBed.id, 'housekeeping');
    } else if (action === 'transfer') {
      if (!transferToBed) { setActionError('Select destination bed'); return; }
      if (!selectedBed.admissionId) { setActionError('No admission linked to this bed'); return; }
      result = await transferBed(selectedBed.admissionId, selectedBed.id, transferToBed, transferReason, staffId);
    }

    if (result.success) {
      flash(action === 'transfer' ? 'Patient transferred' : `Bed marked ${action.replace('mark_', '')}`);
      setSelectedBed(null); setShowTransfer(false); setTransferToBed(''); setTransferReason('');
    } else {
      setActionError(result.error || 'Action failed');
    }
  };

  if (loading && beds.length === 0) return (
    <div className="max-w-7xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}</div>
      <div className="grid grid-cols-6 gap-2">{Array.from({ length: 18 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-lg" />)}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Bed Management Board</h1>
          <p className="text-xs text-gray-500">{totals.total} beds | Auto-refresh 2m | Click any bed for actions</p></div>
        <button onClick={load} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Refresh</button>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-6 gap-2">
        {[
          ['Total', totals.total, 'text-gray-700', 'bg-white'],
          ['Occupied', totals.occupied, 'text-blue-700', 'bg-blue-50'],
          ['Available', totals.available, 'text-green-700', 'bg-green-50'],
          ['Reserved', totals.reserved, 'text-amber-700', 'bg-amber-50'],
          ['Housekeeping', totals.housekeeping, 'text-orange-700', 'bg-orange-50'],
          ['Occupancy', `${totals.occupancyPct}%`, totals.occupancyPct > 90 ? 'text-red-700' : totals.occupancyPct > 70 ? 'text-amber-700' : 'text-green-700', 'bg-white'],
        ].map(([label, value, tc, bg], i) => (
          <div key={i} className={`rounded-xl border p-2.5 text-center ${bg}`}>
            <div className="text-[9px] text-gray-500 uppercase">{label as string}</div>
            <div className={`text-xl font-bold ${tc}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Legend + Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {Object.entries(BED_COLORS).map(([status, colors]) => (
            <button key={status} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border transition-colors ${statusFilter === status ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
              <span className="capitalize">{status}</span>
              <span className="text-gray-400">({beds.filter(b => b.status === status).length})</span>
            </button>
          ))}
        </div>
        <select value={wardFilter} onChange={e => setWardFilter(e.target.value)} className="px-2 py-1 border rounded-lg text-xs">
          <option value="all">All Wards</option>
          {wards.map(w => <option key={w.wardId} value={w.wardId}>{w.wardName} ({w.occupied}/{w.total})</option>)}
        </select>
      </div>

      {/* Ward-by-ward visual board */}
      {filteredWards.map(ward => (
        <div key={ward.wardId} className="bg-white rounded-xl border overflow-hidden">
          {/* Ward header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{ward.wardName}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${WARD_TYPE_COLORS[ward.wardType] || 'bg-gray-100'}`}>{ward.wardType.replace('_',' ')}</span>
              {ward.floor && <span className="text-[10px] text-gray-400">Floor {ward.floor}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-700 font-semibold">{ward.available} free</span>
              <span className="text-blue-700">{ward.occupied} occ</span>
              {ward.housekeeping > 0 && <span className="text-orange-600">{ward.housekeeping} HK</span>}
              <span className={`font-bold ${ward.occupancyPct > 90 ? 'text-red-700' : ward.occupancyPct > 70 ? 'text-amber-700' : 'text-green-700'}`}>{ward.occupancyPct}%</span>
            </div>
          </div>

          {/* Rooms with beds */}
          <div className="p-3 space-y-3">
            {ward.rooms.map(room => {
              const roomBeds = statusFilter === 'all' ? room.beds : room.beds.filter(b => b.status === statusFilter);
              if (roomBeds.length === 0 && statusFilter !== 'all') return null;
              return (
                <div key={room.roomId}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-600">Room {room.roomNumber}</span>
                    <span className="text-[10px] text-gray-400">{room.roomType.replace('_',' ')}</span>
                    {room.beds[0]?.dailyRate > 0 && <span className="text-[10px] text-gray-400">{'₹'}{room.beds[0].dailyRate.toLocaleString('en-IN')}/day</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {roomBeds.map(bed => <BedCard key={bed.id} bed={bed} onSelect={setSelectedBed} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {wards.length === 0 && <div className="text-center py-12 bg-white rounded-xl border text-gray-400">No wards configured. Add wards and beds in Settings.</div>}

      {/* ===== SELECTED BED ACTION PANEL ===== */}
      {selectedBed && <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-500 shadow-2xl p-4 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-bold text-sm">
                {selectedBed.wardName} / Room {selectedBed.roomNumber} / Bed {selectedBed.bedNumber}
                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${BED_COLORS[selectedBed.status]?.bg} ${BED_COLORS[selectedBed.status]?.text}`}>{selectedBed.status}</span>
              </div>
              {selectedBed.status === 'occupied' && selectedBed.patientName && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {selectedBed.patientName} ({selectedBed.patientUhid}) | {selectedBed.doctorName} | IPD: {selectedBed.ipdNumber} | Day {selectedBed.daysAdmitted}
                  {selectedBed.diagnosis && <span className="ml-2 text-gray-400">Dx: {selectedBed.diagnosis.substring(0, 40)}</span>}
                </div>
              )}
            </div>
            <button onClick={() => { setSelectedBed(null); setShowTransfer(false); setActionError(''); }} className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Close</button>
          </div>

          {actionError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 mb-3">{actionError}</div>}

          {/* Actions based on current status */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedBed.status === 'available' && <>
              <button onClick={() => handleAction('reserve')} className="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg">Reserve Bed</button>
              <button onClick={() => handleAction('maintenance')} className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg">Mark Maintenance</button>
            </>}

            {selectedBed.status === 'occupied' && <>
              <button onClick={() => setShowTransfer(!showTransfer)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">{showTransfer ? 'Cancel Transfer' : 'Transfer Patient'}</button>
              <a href={`/ipd/${selectedBed.admissionId}?tab=discharge`} className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg">Initiate Discharge</a>
            </>}

            {selectedBed.status === 'reserved' && <>
              <button onClick={() => handleAction('mark_available')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Release (Mark Available)</button>
            </>}

            {selectedBed.status === 'housekeeping' && <>
              <button onClick={() => handleAction('mark_available')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Housekeeping Done (Mark Available)</button>
            </>}

            {selectedBed.status === 'maintenance' && <>
              <button onClick={() => handleAction('mark_available')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Maintenance Done (Mark Available)</button>
            </>}
          </div>

          {/* Transfer form */}
          {showTransfer && selectedBed.status === 'occupied' && (
            <div className="mt-3 bg-blue-50 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-blue-700">Transfer {selectedBed.patientName} to:</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500">Destination bed *</label>
                  <select value={transferToBed} onChange={e => setTransferToBed(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Select available bed</option>
                    {availableBeds.map(b => (
                      <option key={b.id} value={b.id}>{b.wardName} / Rm {b.roomNumber} / {b.bedNumber} ({b.wardType.replace('_',' ')}) {'₹'}{b.dailyRate}/d</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Reason</label>
                  <select value={transferReason} onChange={e => setTransferReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Select reason</option>
                    <option value="Upgrade requested by patient">Upgrade requested</option>
                    <option value="Downgrade for cost reduction">Downgrade for cost</option>
                    <option value="ICU to ward - step down">ICU step-down</option>
                    <option value="Ward to ICU - clinical deterioration">Ward to ICU</option>
                    <option value="Isolation required">Isolation required</option>
                    <option value="Room maintenance">Room maintenance</option>
                    <option value="Patient request">Patient request</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={() => handleAction('transfer')} disabled={!transferToBed}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40">Confirm Transfer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
