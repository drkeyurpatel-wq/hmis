'use client';
import React, { useState, useEffect } from 'react';
import { Printer, Plus, X } from 'lucide-react';
import { loadBillDetails, addPaymentToBill, type PaymentEntry } from '@/lib/billing/billing-engine';

const fmt = (n: number) => Math.round(parseFloat(String(n)) || 0).toLocaleString('en-IN');
const INR = (n: number) => `₹${fmt(n)}`;

interface Props {
  billId: string;
  centreId: string;
  staffId: string;
  onFlash?: (msg: string) => void;
  onClose?: () => void;
}

export default function BillDetailView({ billId, centreId, staffId, onFlash, onClose }: Props) {
  const [bill, setBill] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payMode, setPayMode] = useState<PaymentEntry['mode']>('cash');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await loadBillDetails(billId);
    if (data) { setBill(data.bill); setItems(data.items); setPayments(data.payments); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [billId]);

  const handlePay = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    setPaying(true);
    const result = await addPaymentToBill(billId, centreId, staffId, { mode: payMode, amount: amt, reference: payRef });
    if (result.success) {
      onFlash?.('Payment recorded');
      setShowPayForm(false); setPayAmount(''); setPayRef('');
      load();
    } else {
      onFlash?.(result.error || 'Payment failed');
    }
    setPaying(false);
  };

  const printInvoice = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const net = parseFloat(bill.net_amount || 0);
    const paid = parseFloat(bill.paid_amount || 0);
    const bal = parseFloat(bill.balance_amount || 0);
    w.document.write(`<html><head><title>Invoice ${bill.bill_number}</title>
      <style>body{font-family:sans-serif;margin:30px;font-size:12px}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}.right{text-align:right}.bold{font-weight:bold}.header{display:flex;justify-content:space-between;align-items:start;margin-bottom:20px}.logo{font-size:20px;font-weight:bold;color:#0d9488}@media print{@page{margin:15mm}}</style>
      </head><body>
      <div class="header"><div><div class="logo">Health1 Super Speciality Hospital</div><div style="margin-top:4px;color:#666">Tax Invoice</div></div>
      <div style="text-align:right"><div class="bold" style="font-size:16px">${bill.bill_number}</div><div>Date: ${bill.bill_date}</div><div>Type: ${bill.bill_type?.toUpperCase()}</div></div></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:15px;padding:10px;background:#f9f9f9;border-radius:4px">
      <div><div class="bold">Patient</div><div>${bill.patient?.first_name} ${bill.patient?.last_name}</div><div>UHID: ${bill.patient?.uhid}</div><div>Phone: ${bill.patient?.phone_primary || '-'}</div></div>
      <div style="text-align:right"><div class="bold">Payor</div><div>${(bill.payor_type || 'self').replace('_', ' ').toUpperCase()}</div></div></div>
      <table><thead><tr><th>#</th><th>Service</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th><th class="right">Disc</th><th class="right">Net</th></tr></thead><tbody>
      ${items.map((it: any, i: number) => `<tr><td>${i + 1}</td><td>${it.description}</td><td class="right">${it.quantity}</td><td class="right">${INR(it.unit_rate)}</td><td class="right">${INR(it.amount)}</td><td class="right">${INR(it.discount || 0)}</td><td class="right bold">${INR(it.net_amount)}</td></tr>`).join('')}
      </tbody></table>
      <div style="display:flex;justify-content:flex-end"><div style="width:250px">
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Gross Amount</span><span>${INR(parseFloat(bill.gross_amount))}</span></div>
      ${parseFloat(bill.discount_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:red"><span>Discount</span><span>-${INR(parseFloat(bill.discount_amount))}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid #333;font-size:14px" class="bold"><span>Net Amount</span><span>${INR(net)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;color:green"><span>Paid</span><span>${INR(paid)}</span></div>
      ${bal > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:red" class="bold"><span>Balance Due</span><span>${INR(bal)}</span></div>` : ''}
      </div></div>
      ${payments.length > 0 ? `<h3 style="margin-top:20px">Payment Details</h3><table><thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th>Receipt#</th><th class="right">Amount</th></tr></thead><tbody>
      ${payments.map((p: any) => `<tr><td>${p.payment_date}</td><td>${p.payment_mode}</td><td>${p.reference_number || '-'}</td><td>${p.receipt_number}</td><td class="right bold">${INR(p.amount)}</td></tr>`).join('')}
      </tbody></table>` : ''}
      <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:10px;color:#999">
      <div>Printed on ${new Date().toLocaleString('en-IN')}</div><div>Health1 HMIS</div></div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading bill...</div>;
  if (!bill) return <div className="p-8 text-center text-gray-400">Bill not found</div>;

  const net = parseFloat(bill.net_amount || 0);
  const paid = parseFloat(bill.paid_amount || 0);
  const balance = parseFloat(bill.balance_amount || 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">{bill.bill_number}</h2>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${bill.status === 'paid' ? 'bg-green-100 text-green-700' : bill.status === 'partially_paid' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{bill.status?.replace('_', ' ')}</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{bill.bill_type?.toUpperCase()}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{bill.patient?.first_name} {bill.patient?.last_name} — {bill.patient?.uhid} — {bill.bill_date}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={printInvoice} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg flex items-center gap-1"><Printer size={12} /> Print Invoice</button>
          {balance > 0 && <button onClick={() => setShowPayForm(true)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"><Plus size={12} /> Collect Payment</button>}
          {onClose && <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg"><X size={12} /></button>}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-[9px] text-gray-500">Gross</div><div className="text-lg font-bold">{INR(parseFloat(bill.gross_amount))}</div></div>
        <div className="bg-red-50 rounded-lg p-3 text-center"><div className="text-[9px] text-gray-500">Discount</div><div className="text-lg font-bold text-red-600">-{INR(parseFloat(bill.discount_amount || 0))}</div></div>
        <div className="bg-blue-50 rounded-lg p-3 text-center"><div className="text-[9px] text-gray-500">Net</div><div className="text-lg font-bold text-blue-700">{INR(net)}</div></div>
        <div className="bg-green-50 rounded-lg p-3 text-center"><div className="text-[9px] text-gray-500">Paid</div><div className="text-lg font-bold text-green-700">{INR(paid)}</div></div>
        <div className={`rounded-lg p-3 text-center ${balance > 0 ? 'bg-orange-50' : 'bg-green-50'}`}><div className="text-[9px] text-gray-500">Balance</div><div className={`text-lg font-bold ${balance > 0 ? 'text-orange-700' : 'text-green-700'}`}>{INR(balance)}</div></div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-2 border-b bg-gray-50"><h3 className="text-xs font-bold">Line Items ({items.length})</h3></div>
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-gray-50/50">
            <th className="p-2 text-left">#</th><th className="p-2 text-left">Service</th><th className="p-2 text-center">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Disc</th><th className="p-2 text-right font-bold">Net</th>
          </tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-b hover:bg-blue-50/30">
                <td className="p-2 text-gray-400">{i + 1}</td>
                <td className="p-2 font-medium">{it.description}<div className="text-[9px] text-gray-400">{it.service_date}</div></td>
                <td className="p-2 text-center">{it.quantity}</td>
                <td className="p-2 text-right">{INR(it.unit_rate)}</td>
                <td className="p-2 text-right">{INR(it.amount)}</td>
                <td className="p-2 text-right text-red-500">{parseFloat(it.discount) > 0 ? `-${INR(it.discount)}` : '-'}</td>
                <td className="p-2 text-right font-bold">{INR(it.net_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-2 border-b bg-gray-50"><h3 className="text-xs font-bold">Payments ({payments.length})</h3></div>
        {payments.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">No payments recorded</div>
        ) : (
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-gray-50/50">
              <th className="p-2 text-left">Date</th><th className="p-2 text-left">Mode</th><th className="p-2 text-left">Reference</th><th className="p-2 text-left">Receipt#</th><th className="p-2 text-right font-bold">Amount</th>
            </tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b">
                  <td className="p-2">{p.payment_date}</td>
                  <td className="p-2 capitalize">{p.payment_mode?.replace('_', ' ')}</td>
                  <td className="p-2 text-gray-400">{p.reference_number || '-'}</td>
                  <td className="p-2 font-mono">{p.receipt_number}</td>
                  <td className="p-2 text-right font-bold text-green-700">{INR(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment collection form */}
      {showPayForm && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 space-y-3">
          <h3 className="text-sm font-bold text-green-800">Collect Payment — Balance: {INR(balance)}</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-gray-600">Mode</label>
              <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={payMode} onChange={e => setPayMode(e.target.value as any)}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
                <option value="neft">NEFT</option><option value="cheque">Cheque</option><option value="insurance_settlement">Insurance Settlement</option>
              </select>
            </div>
            <div className="w-32">
              <label className="text-[10px] font-semibold text-gray-600">Amount</label>
              <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={payAmount}
                onChange={e => setPayAmount(e.target.value)} placeholder={`₹${fmt(balance)}`} />
            </div>
            <div className="w-40">
              <label className="text-[10px] font-semibold text-gray-600">Reference</label>
              <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="UPI Ref / Cheque#" />
            </div>
            <button onClick={() => setPayAmount(String(balance))} className="px-3 py-2 bg-blue-100 text-blue-700 text-xs rounded-lg">Pay Full</button>
            <button onClick={handlePay} disabled={paying} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">
              {paying ? '...' : 'Record Payment'}
            </button>
            <button onClick={() => setShowPayForm(false)} className="px-3 py-2 bg-gray-100 text-xs rounded-lg">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
