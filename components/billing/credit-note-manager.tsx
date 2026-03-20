// components/billing/credit-note-manager.tsx
// Credit/Debit notes against finalized bills
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import { auditCreate, auditCancel } from '@/lib/audit/audit-logger';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }
const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface Props { centreId: string; onFlash: (m: string) => void; }

export default function CreditNoteManager({ centreId, onFlash }: Props) {
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ billSearch: '', billId: '', billNumber: '', patientName: '', uhid: '', netAmount: 0, creditAmount: '', reason: '', items: '' });
  const [billResults, setBillResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const { data } = await sb().from('hmis_credit_notes')
      .select('*, bill:hmis_bills(bill_number, net_amount), patient:hmis_patients!inner(first_name, last_name, uhid), approver:hmis_staff!hmis_credit_notes_approved_by_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(50);
    setNotes(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (form.billSearch.length < 2 || !sb()) { setBillResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_bills')
        .select('id, bill_number, net_amount, status, patient:hmis_patients!inner(id, first_name, last_name, uhid)')
        .eq('centre_id', centreId).in('status', ['final', 'paid', 'partially_paid'])
        .or(`bill_number.ilike.%${form.billSearch}%`).limit(5);
      setBillResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [form.billSearch, centreId]);

  const selectBill = (b: any) => {
    setForm(f => ({
      ...f, billId: b.id, billNumber: b.bill_number,
      patientName: `${b.patient.first_name} ${b.patient.last_name}`, uhid: b.patient.uhid,
      netAmount: parseFloat(b.net_amount), billSearch: '',
    }));
    setBillResults([]);
  };

  const submitCreditNote = async () => {
    if (!form.billId) { setError('Select a bill'); return; }
    const amt = parseFloat(form.creditAmount);
    if (!amt || amt <= 0) { setError('Enter valid amount'); return; }
    if (amt > form.netAmount) { setError(`Amount exceeds bill net ₹${form.netAmount}`); return; }
    if (!form.reason) { setError('Reason required'); return; }
    setError('');

    const cnNumber = `CN-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const { data: patient } = await sb().from('hmis_bills').select('patient_id').eq('id', form.billId).single();

    const { error: err } = await sb().from('hmis_credit_notes').insert({
      centre_id: centreId, bill_id: form.billId, patient_id: patient?.patient_id,
      credit_note_number: cnNumber, amount: amt,
      reason: form.reason, items: form.items ? JSON.parse(`[${form.items}]`) : [],
      status: 'issued', approved_by: staffId, created_by: staffId,
    });

    if (err) { setError(err.message); return; }

    // Adjust bill: reduce net_amount and balance
    const { data: bill } = await sb().from('hmis_bills').select('net_amount, balance_amount, discount_amount').eq('id', form.billId).single();
    if (bill) {
      await sb().from('hmis_bills').update({
        discount_amount: parseFloat(bill.discount_amount) + amt,
        net_amount: parseFloat(bill.net_amount) - amt,
        balance_amount: Math.max(0, parseFloat(bill.balance_amount) - amt),
      }).eq('id', form.billId);
    }

    auditCreate(centreId, staffId, 'credit_note', '', `Credit note ${cnNumber}: ₹${amt}`);
    onFlash(`Credit note ${cnNumber} issued: ${fmt(amt)}`);
    setForm({ billSearch: '', billId: '', billNumber: '', patientName: '', uhid: '', netAmount: 0, creditAmount: '', reason: '', items: '' });
    setShowNew(false); load();
  };

  const cancelNote = async (id: string) => {
    await sb().from('hmis_credit_notes').update({ status: 'cancelled' }).eq('id', id);
    auditCancel(centreId, staffId, 'credit_note', id, 'Credit note cancelled');
    onFlash('Credit note cancelled'); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-bold text-sm">Credit Notes</h2><p className="text-xs text-gray-500">Issue credit notes against finalized bills for corrections or adjustments</p></div>
        <button onClick={() => setShowNew(!showNew)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">{showNew ? 'Cancel' : '+ Issue Credit Note'}</button>
      </div>

      {showNew && <div className="bg-white rounded-xl border p-5 space-y-3">
        <h3 className="font-bold text-sm">Issue Credit Note</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="relative"><label className="text-xs text-gray-500">Bill # *</label>
            {form.billId ? <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm flex justify-between"><div><span className="font-mono">{form.billNumber}</span> — {form.patientName} — Net: {fmt(form.netAmount)}</div><button onClick={() => setForm(f => ({ ...f, billId: '' }))} className="text-xs text-red-500">Change</button></div> :
            <><input type="text" value={form.billSearch} onChange={e => setForm(f => ({ ...f, billSearch: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search bill..." />
            {billResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10">{billResults.map(b => (
              <button key={b.id} onClick={() => selectBill(b)} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">
                {b.bill_number} — {b.patient.first_name} {b.patient.last_name} — {fmt(parseFloat(b.net_amount))}
              </button>
            ))}</div>}</>}</div>
          <div><label className="text-xs text-gray-500">Credit Amount *</label>
            <input type="number" value={form.creditAmount} onChange={e => setForm(f => ({ ...f, creditAmount: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="₹" /></div>
          <div><label className="text-xs text-gray-500">Reason *</label>
            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select</option>
              <option>Billing error — wrong tariff applied</option><option>Duplicate charge</option><option>Service not rendered</option>
              <option>Insurance disallowance adjustment</option><option>Package rate correction</option><option>Cancelled procedure</option>
              <option>Management write-off</option><option>Rounding adjustment</option>
            </select></div>
        </div>
        {error && <div className="text-sm text-red-700">{error}</div>}
        <button onClick={submitCreditNote} className="px-6 py-2 bg-orange-600 text-white text-sm rounded-lg font-medium">Issue Credit Note</button>
      </div>}

      {loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
      notes.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No credit notes issued</div> :
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">CN #</th><th className="p-2 text-left">Bill</th><th className="p-2 text-left">Patient</th><th className="p-2 text-right">Amount</th><th className="p-2">Reason</th><th className="p-2">Status</th><th className="p-2">Approved By</th><th className="p-2"></th>
        </tr></thead><tbody>{notes.map(cn => (
          <tr key={cn.id} className="border-b hover:bg-gray-50">
            <td className="p-2 font-mono text-[10px]">{cn.credit_note_number}</td>
            <td className="p-2 font-mono text-[10px]">{cn.bill?.bill_number}</td>
            <td className="p-2">{cn.patient?.first_name} {cn.patient?.last_name}</td>
            <td className="p-2 text-right font-bold text-orange-700">{fmt(parseFloat(cn.amount))}</td>
            <td className="p-2 text-gray-500 text-[10px]">{cn.reason}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${cn.status === 'issued' ? 'bg-blue-100 text-blue-700' : cn.status === 'adjusted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{cn.status}</span></td>
            <td className="p-2 text-[10px] text-gray-400">{cn.approver?.full_name}</td>
            <td className="p-2">{cn.status === 'issued' && <button onClick={() => cancelNote(cn.id)} className="text-[9px] text-red-500">Cancel</button>}</td>
          </tr>
        ))}</tbody></table>
      </div>}
    </div>
  );
}
