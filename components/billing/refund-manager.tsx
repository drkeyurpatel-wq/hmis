// components/billing/refund-manager.tsx
// Full refund workflow: initiate → approve → process → receipt
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import { auditCreate, auditApprove } from '@/lib/audit/audit-logger';
const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface Props { centreId: string; onFlash: (m: string) => void; }

export default function RefundManager({ centreId, onFlash }: Props) {
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ billSearch: '', billId: '', patientName: '', uhid: '', billNumber: '', paidAmount: 0, refundAmount: '', reason: '', mode: 'neft', bankDetails: '' });
  const [billResults, setBillResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const { data } = await sb()!.from('hmis_refunds')
      .select('*, bill:hmis_bills(bill_number, patient:hmis_patients!inner(first_name, last_name, uhid)), approver:hmis_staff!hmis_refunds_approved_by_fkey(full_name), processor:hmis_staff!hmis_refunds_processed_by_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(50);
    setRefunds(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Search bills with positive paid_amount
  useEffect(() => {
    if (form.billSearch.length < 2 || !sb()) { setBillResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_bills')
        .select('id, bill_number, paid_amount, net_amount, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).gt('paid_amount', 0)
        .or(`bill_number.ilike.%${form.billSearch}%`)
        .limit(5);
      setBillResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [form.billSearch, centreId]);

  const selectBill = (b: any) => {
    setForm(f => ({
      ...f, billId: b.id, billNumber: b.bill_number,
      patientName: `${b.patient.first_name} ${b.patient.last_name}`, uhid: b.patient.uhid,
      paidAmount: parseFloat(b.paid_amount), billSearch: '',
    }));
    setBillResults([]);
  };

  const submitRefund = async () => {
    if (!form.billId) { setError('Select a bill'); return; }
    const amt = parseFloat(form.refundAmount);
    if (!amt || amt <= 0) { setError('Enter valid refund amount'); return; }
    if (amt > form.paidAmount) { setError(`Refund ₹${amt} exceeds paid amount ₹${form.paidAmount}`); return; }
    if (!form.reason) { setError('Reason required'); return; }
    setError('');

    const { error: err } = await sb()!.from('hmis_refunds').insert({
      centre_id: centreId, bill_id: form.billId, refund_amount: amt,
      reason: form.reason, refund_mode: form.mode, bank_details: form.bankDetails,
      status: 'initiated', initiated_by: staffId,
    });

    if (err) { setError(err.message); return; }
    onFlash(`Refund initiated: ${fmt(amt)} for ${form.billNumber}`);
    auditCreate(centreId, staffId, 'refund', '', `Refund ₹${amt} initiated for ${form.billNumber}`);
    setForm({ billSearch: '', billId: '', patientName: '', uhid: '', billNumber: '', paidAmount: 0, refundAmount: '', reason: '', mode: 'neft', bankDetails: '' });
    setShowNew(false); load();
  };

  const approveRefund = async (id: string) => {
    await sb()!.from('hmis_refunds').update({ status: 'approved', approved_by: staffId, approved_at: new Date().toISOString() }).eq('id', id);
    auditApprove(centreId, staffId, 'refund', id, 'Refund approved');
    onFlash('Refund approved'); load();
  };

  const processRefund = async (id: string) => {
    const refund = refunds.find(r => r.id === id);
    if (!refund) return;
    // Update refund status
    await sb()!.from('hmis_refunds').update({ status: 'processed', processed_by: staffId, processed_at: new Date().toISOString() }).eq('id', id);
    // Reduce paid_amount on bill
    const { data: bill } = await sb()!.from('hmis_bills').select('paid_amount, balance_amount').eq('id', refund.bill_id).single();
    if (bill) {
      await sb()!.from('hmis_bills').update({
        paid_amount: parseFloat(bill.paid_amount) - parseFloat(refund.refund_amount),
        balance_amount: parseFloat(bill.balance_amount) + parseFloat(refund.refund_amount),
      }).eq('id', refund.bill_id);
    }
    auditApprove(centreId, staffId, 'refund', id, 'Refund processed — bill adjusted');
    onFlash('Refund processed — bill updated'); load();
  };

  const rejectRefund = async (id: string) => {
    await sb()!.from('hmis_refunds').update({ status: 'rejected', approved_by: staffId, approved_at: new Date().toISOString() }).eq('id', id);
    onFlash('Refund rejected'); load();
  };

  const statusBadge = (s: string) => s === 'processed' ? 'bg-green-100 text-green-700' : s === 'approved' ? 'bg-blue-100 text-blue-700' : s === 'initiated' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-bold text-sm">Refund Management</h2><p className="text-xs text-gray-500">Initiate → Approve → Process refunds against paid bills</p></div>
        <button onClick={() => setShowNew(!showNew)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">{showNew ? 'Cancel' : '+ Initiate Refund'}</button>
      </div>

      {/* New refund form */}
      {showNew && <div className="bg-white rounded-xl border p-5 space-y-3">
        <h3 className="font-bold text-sm">Initiate Refund</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="relative"><label className="text-xs text-gray-500">Bill # *</label>
            {form.billId ? <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm flex justify-between"><div><span className="font-mono">{form.billNumber}</span> — {form.patientName} <span className="text-gray-400">{form.uhid}</span></div><button onClick={() => setForm(f => ({ ...f, billId: '', billNumber: '' }))} className="text-xs text-red-500">Change</button></div> :
            <><input type="text" value={form.billSearch} onChange={e => setForm(f => ({ ...f, billSearch: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search bill number..." />
            {billResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10">{billResults.map(b => (
              <button key={b.id} onClick={() => selectBill(b)} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">
                <span className="font-mono">{b.bill_number}</span> — {b.patient.first_name} {b.patient.last_name} — Paid: {fmt(parseFloat(b.paid_amount))}
              </button>
            ))}</div>}</>}</div>
          <div><label className="text-xs text-gray-500">Refund Amount * {form.paidAmount > 0 && <span className="text-gray-400">(max {fmt(form.paidAmount)})</span>}</label>
            <input type="number" value={form.refundAmount} onChange={e => setForm(f => ({ ...f, refundAmount: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="₹" /></div>
          <div><label className="text-xs text-gray-500">Reason *</label>
            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select reason</option>
              <option>Overpayment by patient</option><option>Duplicate payment</option><option>Service not availed</option>
              <option>Insurance approved — cash refund</option><option>Cancelled admission</option><option>Package adjustment</option>
              <option>Management discretion</option><option>Death case — partial refund</option>
            </select></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Refund Mode</label>
            <div className="flex gap-1 mt-1">{['neft', 'cash', 'cheque', 'upi'].map(m => (
              <button key={m} onClick={() => setForm(f => ({ ...f, mode: m }))} className={`flex-1 py-1.5 text-[10px] rounded border ${form.mode === m ? 'bg-blue-600 text-white' : 'bg-white'}`}>{m.toUpperCase()}</button>
            ))}</div></div>
          {form.mode !== 'cash' && <div className="col-span-2"><label className="text-xs text-gray-500">Bank / UPI / UTR details</label>
            <input type="text" value={form.bankDetails} onChange={e => setForm(f => ({ ...f, bankDetails: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Account number / UPI ID / UTR" /></div>}
        </div>
        {error && <div className="text-sm text-red-700">{error}</div>}
        <button onClick={submitRefund} className="px-6 py-2 bg-red-600 text-white text-sm rounded-lg font-medium">Initiate Refund</button>
      </div>}

      {/* Refunds list */}
      {loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
      refunds.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No refunds initiated</div> :
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Bill #</th><th className="p-2 text-left">Patient</th><th className="p-2 text-right">Amount</th><th className="p-2">Reason</th><th className="p-2">Mode</th><th className="p-2">Status</th><th className="p-2">Actions</th>
        </tr></thead><tbody>{refunds.map(r => (
          <tr key={r.id} className="border-b hover:bg-gray-50">
            <td className="p-2 font-mono text-[10px]">{r.bill?.bill_number}</td>
            <td className="p-2">{r.bill?.patient?.first_name} {r.bill?.patient?.last_name} <span className="text-gray-400">{r.bill?.patient?.uhid}</span></td>
            <td className="p-2 text-right font-bold text-red-700">{fmt(parseFloat(r.refund_amount))}</td>
            <td className="p-2 text-gray-500">{r.reason}</td>
            <td className="p-2 text-center">{r.refund_mode?.toUpperCase()}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${statusBadge(r.status)}`}>{r.status}</span></td>
            <td className="p-2 text-center space-x-1">
              {r.status === 'initiated' && <>
                <button onClick={() => approveRefund(r.id)} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Approve</button>
                <button onClick={() => rejectRefund(r.id)} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px]">Reject</button>
              </>}
              {r.status === 'approved' && <button onClick={() => processRefund(r.id)} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">Process</button>}
            </td>
          </tr>
        ))}</tbody></table>
      </div>}
    </div>
  );
}
