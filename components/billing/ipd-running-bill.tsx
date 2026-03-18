// components/billing/ipd-running-bill.tsx
// Complete IPD running bill — auto-captured charges grouped by date + category
'use client';
import React, { useState, useMemo } from 'react';
import { useIPDRunningBill, useChargeCapture, type ChargeEntry } from '@/lib/billing/charge-capture-hooks';
import { useAuthStore } from '@/lib/store/auth';

const SOURCE_ICONS: Record<string, string> = {
  auto_daily: '🔄', auto_admission: '🏥', pharmacy: '💊', lab: '🔬',
  radiology: '🩻', procedure: '🔪', consumable: '📦', manual: '✏️', barcode_scan: '📡',
};
const CAT_COLORS: Record<string, string> = {
  room_rent: 'bg-green-100 text-green-700', nursing: 'bg-teal-100 text-teal-700',
  icu_charges: 'bg-red-100 text-red-700', professional_fee: 'bg-orange-100 text-orange-700',
  procedure: 'bg-purple-100 text-purple-700', consumable: 'bg-amber-100 text-amber-700',
  pharmacy: 'bg-pink-100 text-pink-700', lab: 'bg-blue-100 text-blue-700',
  radiology: 'bg-indigo-100 text-indigo-700', auto_daily: 'bg-gray-100 text-gray-700',
  miscellaneous: 'bg-gray-100 text-gray-600',
};

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface Props {
  admissionId: string; centreId: string;
  onPostToBill?: (chargeIds: string[], billId: string) => Promise<any>;
  onFlash: (msg: string) => void;
}

export default function IPDRunningBill({ admissionId, centreId, onPostToBill, onFlash }: Props) {
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const { charges, bill, loading, summary, load } = useIPDRunningBill(admissionId);
  const capture = useChargeCapture(centreId);

  const [viewMode, setViewMode] = useState<'date' | 'category'>('date');
  const [selectedCharges, setSelectedCharges] = useState<Set<string>>(new Set());
  const [showReverse, setShowReverse] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [error, setError] = useState('');

  const toggleSelect = (id: string) => setSelectedCharges(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectAllCaptured = () => setSelectedCharges(new Set(charges.filter(c => c.status === 'captured').map(c => c.id)));

  const postSelected = async () => {
    if (!bill?.id) { setError('No bill linked to this admission. Create IPD bill first.'); return; }
    const ids = Array.from(selectedCharges);
    if (!ids.length) return;
    setError('');
    const result = await capture.postToBill(ids, bill.id);
    if (!result.success) { setError(result.error || 'Failed'); return; }
    onFlash(`${result.count} charges posted to bill`);
    setSelectedCharges(new Set());
    load();
  };

  const reverseCharge = async (chargeId: string) => {
    if (!reverseReason.trim()) { setError('Reason required'); return; }
    const result = await capture.reverseCharge(chargeId, reverseReason, staffId);
    if (!result.success) { setError(result.error || 'Failed'); return; }
    onFlash('Charge reversed');
    setShowReverse(null); setReverseReason('');
    load();
  };

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-24 bg-gray-200 rounded-xl" /><div className="h-48 bg-gray-200 rounded-xl" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-6 gap-2">
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Total Charges</div><div className="text-xl font-bold">₹{fmt(summary.total)}</div></div>
        <div className="bg-green-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Posted to Bill</div><div className="text-xl font-bold text-green-700">₹{fmt(summary.posted)}</div></div>
        <div className="bg-amber-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Pending Post</div><div className="text-xl font-bold text-amber-700">₹{fmt(summary.captured)}</div></div>
        <div className="bg-blue-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Paid</div><div className="text-xl font-bold text-blue-700">₹{fmt(summary.paid)}</div></div>
        <div className="bg-red-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Balance Due</div><div className="text-xl font-bold text-red-700">₹{fmt(summary.balance)}</div></div>
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Charges</div><div className="text-xl font-bold">{summary.chargeCount}</div></div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-xs font-bold text-gray-500 mb-2">Breakdown by Category</h3>
        <div className="flex flex-wrap gap-2">
          {summary.byCategory.map(([cat, amt]) => (
            <div key={cat} className={`px-2.5 py-1.5 rounded-lg text-xs ${CAT_COLORS[cat] || 'bg-gray-100'}`}>
              {cat.replace('_', ' ')} <span className="font-bold ml-1">₹{fmt(amt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setViewMode('date')} className={`px-2.5 py-1 text-xs rounded border ${viewMode === 'date' ? 'bg-blue-600 text-white' : 'bg-white'}`}>By Date</button>
          <button onClick={() => setViewMode('category')} className={`px-2.5 py-1 text-xs rounded border ${viewMode === 'category' ? 'bg-blue-600 text-white' : 'bg-white'}`}>By Category</button>
        </div>
        <div className="flex gap-2">
          {charges.some(c => c.status === 'captured') && <>
            <button onClick={selectAllCaptured} className="px-2 py-1 text-[10px] bg-gray-100 rounded">Select all pending</button>
            <button onClick={postSelected} disabled={!selectedCharges.size}
              className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg disabled:opacity-40">
              Post {selectedCharges.size} to Bill
            </button>
          </>}
          <button onClick={load} className="px-2 py-1 text-[10px] bg-gray-100 rounded">Refresh</button>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Charges grouped by date */}
      {viewMode === 'date' && summary.byDate.map(([date, dateCharges]) => (
        <div key={date} className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b flex justify-between">
            <span className="text-xs font-bold">{new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
            <span className="text-xs font-bold text-blue-700">₹{fmt(dateCharges.reduce((s: number, c: ChargeEntry) => s + c.amount, 0))}</span>
          </div>
          <table className="w-full text-xs"><tbody>{dateCharges.map((c: ChargeEntry) => (
            <tr key={c.id} className={`border-b hover:bg-gray-50 ${c.status === 'reversed' ? 'line-through opacity-40' : ''}`}>
              <td className="p-2 w-8">{c.status === 'captured' && <input type="checkbox" checked={selectedCharges.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" />}</td>
              <td className="p-2 w-6 text-center" title={c.source}>{SOURCE_ICONS[c.source] || '📋'}</td>
              <td className="p-2 font-medium">{c.description}</td>
              <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[8px] ${CAT_COLORS[c.category] || 'bg-gray-100'}`}>{c.category.replace('_', ' ')}</span></td>
              <td className="p-2 text-center text-gray-500">{c.quantity > 1 ? `${c.quantity} × ₹${fmt(c.unitRate)}` : ''}</td>
              <td className="p-2 text-right font-bold">₹{fmt(c.amount)}</td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1 py-0.5 rounded ${c.status === 'posted' ? 'bg-green-100 text-green-700' : c.status === 'captured' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span></td>
              <td className="p-2 w-8">{c.status === 'captured' && <button onClick={() => setShowReverse(c.id)} className="text-[9px] text-red-500">Rev</button>}</td>
            </tr>
          ))}</tbody></table>
        </div>
      ))}

      {/* By category view */}
      {viewMode === 'category' && summary.byCategory.map(([cat, totalAmt]) => {
        const catCharges = charges.filter(c => c.category === cat && c.status !== 'reversed');
        return (
          <div key={cat} className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b flex justify-between">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${CAT_COLORS[cat] || 'bg-gray-100'}`}>{cat.replace('_', ' ')} ({catCharges.length})</span>
              <span className="text-xs font-bold text-blue-700">₹{fmt(totalAmt)}</span>
            </div>
            <table className="w-full text-xs"><tbody>{catCharges.map((c: ChargeEntry) => (
              <tr key={c.id} className="border-b">
                <td className="p-2 font-medium">{c.description}</td>
                <td className="p-2 text-center text-gray-400">{c.serviceDate}</td>
                <td className="p-2 text-center text-gray-500">{c.quantity > 1 ? `${c.quantity}×` : ''}</td>
                <td className="p-2 text-right font-bold">₹{fmt(c.amount)}</td>
              </tr>
            ))}</tbody></table>
          </div>
        );
      })}

      {charges.length === 0 && <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No charges captured for this admission yet</div>}

      {/* Reverse modal */}
      {showReverse && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReverse(null)}>
        <div className="bg-white rounded-xl p-5 w-96" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-sm mb-3">Reverse Charge</h3>
          <div className="text-xs text-gray-500 mb-2">{charges.find(c => c.id === showReverse)?.description} — ₹{fmt(charges.find(c => c.id === showReverse)?.amount || 0)}</div>
          <textarea value={reverseReason} onChange={e => setReverseReason(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" placeholder="Reason for reversal *" />
          <div className="flex gap-2">
            <button onClick={() => reverseCharge(showReverse)} disabled={!reverseReason.trim()} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg disabled:opacity-40">Reverse</button>
            <button onClick={() => setShowReverse(null)} className="px-4 py-2 bg-gray-200 text-sm rounded-lg">Cancel</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
