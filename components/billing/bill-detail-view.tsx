'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Printer, IndianRupee, FileText, Clock, User } from 'lucide-react';
import { loadBillDetails, addPaymentToBill, type PaymentEntry } from '@/lib/billing/billing-engine';
import { printBillInvoice, printPaymentReceipt } from '@/components/billing/bill-pdf';

const fmt = (n: number) => Math.round(parseFloat(String(n)) || 0).toLocaleString('en-IN');

interface Props { billId: string; centreId: string; staffId: string; onFlash?: (msg: string) => void; onClose?: () => void; }

export default function BillDetailView({ billId, centreId, staffId, onFlash, onClose }: Props) {
  const [bill, setBill] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [payMode, setPayMode] = useState<PaymentEntry['mode']>('cash');
  const [payAmt, setPayAmt] = useState('');
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await loadBillDetails(billId);
    if (data) { setBill(data.bill); setItems(data.items || []); setPayments(data.payments || []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [billId]);

  const handlePay = async () => {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;
    setPaying(true);
    const result = await addPaymentToBill(billId, centreId, staffId, { mode: payMode, amount: amt, reference: payRef });
    if (result?.success) { onFlash?.(`₹${fmt(amt)} payment recorded`); setShowPay(false); setPayAmt(''); setPayRef(''); load(); }
    else onFlash?.('Payment failed');
    setPaying(false);
  };

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-32 bg-gray-100 rounded-2xl" /><div className="h-48 bg-gray-100 rounded-2xl" /></div>;
  if (!bill) return <div className="text-center py-12 text-gray-400">Bill not found</div>;

  const net = parseFloat(bill.net_amount || 0);
  const paid = parseFloat(bill.paid_amount || 0);
  const bal = net - paid;
  const stColor = bill.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : bill.status === 'partially_paid' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><ArrowLeft size={18} className="text-gray-500" /></button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{bill.bill_number}</h2>
              <span className={`h1-badge ${stColor}`}>{bill.status?.replace('_', ' ')}</span>
            </div>
            <p className="text-xs text-gray-400">{bill.bill_date} · {bill.bill_type?.toUpperCase()} · {bill.payor_type?.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bal > 0 && <button onClick={() => setShowPay(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl font-semibold hover:bg-emerald-700 transition-colors"><Plus size={14} /> Collect Payment</button>}
          <button onClick={() => printBillInvoice(bill, items, payments, bill.patient || {}, { name: 'Hospital', address: 'Shilaj, Ahmedabad', gstin: '24AADCH1234F1Z5' })}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-600 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"><Printer size={14} /> Print</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        {bill.patient && (
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
              <User size={18} className="text-teal-700" />
            </div>
            <div>
              <div className="font-bold text-gray-900">{bill.patient.first_name} {bill.patient.last_name}</div>
              <div className="text-xs text-gray-400">{bill.patient.uhid} · {bill.patient.age_years}/{bill.patient.gender?.charAt(0)}</div>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Net Amount</div>
          <div className="text-xl font-bold text-gray-900 mt-1">₹{fmt(net)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Paid</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">₹{fmt(paid)}</div>
        </div>
        <div className={`rounded-2xl border p-4 text-center ${bal > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Balance</div>
          <div className={`text-xl font-bold mt-1 ${bal > 0 ? 'text-red-600' : 'text-emerald-700'}`}>₹{fmt(bal)}</div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50"><h3 className="text-xs font-bold text-gray-700">Line Items ({items.length})</h3></div>
        <table className="h1-table">
          <thead><tr><th>#</th><th>Service</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Disc</th><th className="text-right">Net</th></tr></thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={it.id || i}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-medium">{it.description || it.service_name}</td>
                <td className="text-right">{it.quantity || 1} × {it.days || 1}</td>
                <td className="text-right">₹{fmt(it.unit_rate)}</td>
                <td className="text-right text-red-500">{parseFloat(it.discount_amount || 0) > 0 ? `-₹${fmt(it.discount_amount)}` : '—'}</td>
                <td className="text-right font-semibold">₹{fmt(it.net_amount)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50/80 font-bold">
              <td colSpan={5} className="text-right">Total</td>
              <td className="text-right text-teal-700">₹{fmt(net)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-xs font-bold text-gray-700">Payments ({payments.length})</h3>
          <span className="text-xs text-emerald-600 font-bold">₹{fmt(paid)} collected</span>
        </div>
        <table className="h1-table">
          <thead><tr><th>Date</th><th>Mode</th><th>Receipt</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {payments.map((p: any, i: number) => (
              <tr key={p.id || i}>
                <td className="text-gray-500">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                <td><span className="h1-badge h1-badge-gray capitalize">{p.payment_mode?.replace('_', ' ')}</span></td>
                <td className="font-mono text-[10px] text-gray-500">{p.receipt_number || '—'}</td>
                <td className="text-gray-500">{p.reference_number || '—'}</td>
                <td className="text-right font-bold text-emerald-700">₹{fmt(p.amount)}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-gray-400">No payments recorded</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Payment form */}
      {showPay && (
        <div className="bg-white rounded-2xl border border-teal-200 p-5 shadow-lg shadow-teal-100/50">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Collect Payment — Balance ₹{fmt(bal)}</h3>
          <div className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount *</label>
              <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder={String(Math.round(bal))}
                className="w-full mt-1.5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Mode</label>
              <div className="flex gap-1 mt-1.5">
                {(['cash', 'upi', 'card', 'neft', 'cheque'] as const).map(m => (
                  <button key={m} onClick={() => setPayMode(m)}
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-semibold transition-colors ${payMode === m ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{m.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Reference</label>
              <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Txn ID / Cheque #"
                className="w-full mt-1.5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPayAmt(String(Math.round(bal))); }} className="px-3 py-2.5 bg-gray-100 text-gray-600 text-xs rounded-xl font-medium hover:bg-gray-200 transition-colors">Full</button>
              <button onClick={handlePay} disabled={paying || !payAmt || parseFloat(payAmt) <= 0}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-emerald-700 transition-colors">
                {paying ? '...' : `Pay ₹${payAmt || '0'}`}
              </button>
              <button onClick={() => setShowPay(false)} className="px-3 py-2.5 text-gray-400 hover:text-gray-600 text-xs transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
