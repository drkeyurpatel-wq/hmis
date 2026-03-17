// components/billing/bill-detail.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useBillItems, usePaymentsV2, useAdvances } from '@/lib/billing/billing-hooks';
import { createClient } from '@/lib/supabase/client';
import { openPrintWindow } from '@/components/ui/shared';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

interface Props {
  bill: any; staffId: string; centreId: string;
  tariffs: { search: (q: string) => any[]; getRate: (id: string, payor: string) => number };
  onUpdate: () => void; onClose: () => void; onFlash: (m: string) => void;
}

const PAY_MODES = ['cash','upi','card','neft','cheque','insurance_settlement'];
const DISCOUNT_REASONS = ['Staff discount','Management approval','Senior citizen (60+)','Freedom Fighter','BPL patient','Loyalty program','Bulk/corporate','Insurance write-off','Settlement negotiation','Rounding off','MD approval'];
const DISC_LEVELS: Record<string, [number, string]> = { billing_staff: [5000, 'Up to ₹5,000'], supervisor: [20000, 'Up to ₹20,000'], manager: [100000, 'Up to ₹1,00,000'], md: [Infinity, 'Unlimited'] };

export default function BillDetail({ bill, staffId, centreId, tariffs, onUpdate, onClose, onFlash }: Props) {
  const items = useBillItems(bill.id);
  const pay = usePaymentsV2(bill.id);
  const advances = useAdvances(bill.patient_id);

  const [tariffQ, setTariffQ] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [showDisc, setShowDisc] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [manualItem, setManualItem] = useState({ description: '', quantity: 1, unitRate: 0, departmentId: '', doctorId: '' });

  // Payment form
  const [payForm, setPayForm] = useState({ amount: '', mode: 'cash', reference: '', splitMode2: '', splitAmt2: '' });
  // Discount form
  const [discForm, setDiscForm] = useState({ amount: '', percentage: '', reason: '', level: 'billing_staff' });
  // Advance adjust
  const [advId, setAdvId] = useState('');

  const tariffResults = tariffQ.length >= 2 ? tariffs.search(tariffQ).slice(0, 8) : [];
  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const stColor = (s: string) => s === 'paid' ? 'bg-green-100 text-green-700' : s === 'partially_paid' ? 'bg-yellow-100 text-yellow-700' : s === 'final' ? 'bg-blue-100 text-blue-700' : s === 'draft' ? 'bg-gray-100 text-gray-600' : s === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100';
  const catColor = (c: string) => ({ consultation: 'text-blue-600', room_rent: 'text-green-600', ot_charges: 'text-purple-600', professional_fee: 'text-orange-600', procedure: 'text-red-600', consumable: 'text-yellow-700', icu_charges: 'text-pink-600', nursing: 'text-teal-600', miscellaneous: 'text-gray-500' })[c] || 'text-gray-600';

  // Category-wise subtotals
  const catTotals = items.items.reduce((acc: Record<string, number>, i: any) => {
    const cat = i.tariff?.category || 'other';
    acc[cat] = (acc[cat] || 0) + parseFloat(i.net_amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const addTariffItem = async (t: any) => {
    const rate = tariffs.getRate(t.id, bill.payor_type);
    await items.add({ tariffId: t.id, description: t.service_name, quantity: 1, unitRate: rate });
    setTariffQ(''); onUpdate(); onFlash('Item added');
  };

  const addManualItem = async () => {
    if (!manualItem.description || !manualItem.unitRate) return;
    await items.add(manualItem);
    setManualItem({ description: '', quantity: 1, unitRate: 0, departmentId: '', doctorId: '' });
    setShowAddItem(false); onUpdate(); onFlash('Item added');
  };

  const collectPayment = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) return;
    await pay.collect(amt, payForm.mode, payForm.reference, staffId);
    // Split payment mode 2
    if (payForm.splitAmt2 && payForm.splitMode2) {
      await pay.collect(parseFloat(payForm.splitAmt2), payForm.splitMode2, '', staffId);
    }
    setShowPay(false); setPayForm({ amount: '', mode: 'cash', reference: '', splitMode2: '', splitAmt2: '' });
    onUpdate(); onFlash('Payment collected');
  };

  const applyDiscount = async () => {
    let amt = parseFloat(discForm.amount);
    if (discForm.percentage) amt = parseFloat(bill.gross_amount) * parseFloat(discForm.percentage) / 100;
    if (!amt || !discForm.reason) return;
    const { data: b } = await sb()?.from('hmis_bills').select('gross_amount, discount_amount, paid_amount').eq('id', bill.id).single();
    if (!b) return;
    const newDisc = parseFloat(b.discount_amount) + amt;
    const newNet = parseFloat(b.gross_amount) - newDisc;
    await sb().from('hmis_bills').update({ discount_amount: newDisc, net_amount: newNet, balance_amount: newNet - parseFloat(b.paid_amount) }).eq('id', bill.id);
    await sb().from('hmis_discount_log').insert({ bill_id: bill.id, discount_type: discForm.percentage ? 'percentage' : 'flat', discount_amount: amt, discount_percentage: discForm.percentage || null, reason: discForm.reason, authorized_by: staffId, authorization_level: discForm.level });
    setShowDisc(false); setDiscForm({ amount: '', percentage: '', reason: '', level: 'billing_staff' }); onUpdate(); onFlash(`Discount ₹${fmt(amt)} applied`);
  };

  const adjustAdvance = async () => {
    if (!advId) return;
    const adv = advances.advances.find((a: any) => a.id === advId);
    if (!adv) return;
    // Create payment from advance
    await pay.collect(parseFloat(adv.amount), 'advance_adjustment', `ADV:${adv.receipt_number}`, staffId);
    await advances.adjust(advId, bill.id);
    setShowAdv(false); setAdvId(''); onUpdate(); onFlash('Advance adjusted');
  };

  const finalize = async () => {
    await sb()?.from('hmis_bills').update({ status: 'final' }).eq('id', bill.id);
    onUpdate(); onFlash('Bill finalized');
  };

  const cancelBill = async () => {
    if (!confirm('Cancel this bill? This cannot be undone.')) return;
    await sb()?.from('hmis_bills').update({ status: 'cancelled' }).eq('id', bill.id);
    onUpdate(); onFlash('Bill cancelled');
  };

  // Print bill
  const printBillDoc = () => {
    const itemRows = items.items.map((i: any, idx: number) => `<tr><td style="padding:3px 6px;border:1px solid #ddd;text-align:center;font-size:9px">${idx+1}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9px">${i.description}${i.tariff?.category ? ` <span style="color:#888">(${i.tariff.category.replace('_',' ')})</span>` : ''}${i.doctor?.full_name ? ` <span style="color:#666">Dr.${i.doctor.full_name}</span>` : ''}</td><td style="padding:3px 6px;border:1px solid #ddd;text-align:center;font-size:9px">${i.quantity}</td><td style="padding:3px 6px;border:1px solid #ddd;text-align:right;font-size:9px">₹${fmt(i.unit_rate)}</td><td style="padding:3px 6px;border:1px solid #ddd;text-align:right;font-size:9px;font-weight:600">₹${fmt(i.net_amount)}</td></tr>`).join('');

    const payRows = pay.payments.map((p: any) => `<tr><td style="padding:2px 6px;font-size:9px">${p.payment_date}</td><td style="padding:2px 6px;font-size:9px">${p.payment_mode.toUpperCase()}</td><td style="padding:2px 6px;font-size:9px">${p.receipt_number}</td><td style="padding:2px 6px;text-align:right;font-size:9px;font-weight:600">₹${fmt(p.amount)}</td></tr>`).join('');

    const pt = bill.patient;
    openPrintWindow(`<div style="max-width:700px;margin:0 auto;font-family:'Segoe UI',Arial;color:#1a1a1a">
      <div style="display:flex;justify-content:space-between;border-bottom:3px solid #1e40af;padding-bottom:8px;margin-bottom:8px">
        <div><div style="font-size:18px;font-weight:700;color:#1e40af">Health1 Super Speciality Hospital</div><div style="font-size:8px;color:#666">Shilaj, Ahmedabad | NABH Accredited | CIN: U85110GJ2019PTC109866</div></div>
        <div style="text-align:right"><div style="font-size:13px;font-weight:700">TAX INVOICE</div><div style="font-size:9px;color:#666">GSTIN: 24AADCH1234F1Z5</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:10px;padding:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:8px">
        <div><b>Bill No:</b> ${bill.bill_number}</div><div><b>Bill Date:</b> ${bill.bill_date}</div>
        <div><b>Patient:</b> ${pt?.first_name} ${pt?.last_name}</div><div><b>UHID:</b> ${pt?.uhid}</div>
        <div><b>Age/Sex:</b> ${pt?.age_years || ''}yr / ${pt?.gender || ''}</div><div><b>Phone:</b> ${pt?.phone_primary || '—'}</div>
        <div><b>Bill Type:</b> ${bill.bill_type?.toUpperCase()}</div><div><b>Payor:</b> ${bill.payor_type?.replace('govt_','').replace('_',' ').toUpperCase()}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr style="background:#eff6ff"><th style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:9px">#</th><th style="padding:4px 6px;border:1px solid #ddd;text-align:left;font-size:9px">Service Description</th><th style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:9px">Qty</th><th style="padding:4px 6px;border:1px solid #ddd;text-align:right;font-size:9px">Rate</th><th style="padding:4px 6px;border:1px solid #ddd;text-align:right;font-size:9px">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
      <div style="display:flex;justify-content:flex-end"><div style="width:250px">
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px"><span>Gross Amount</span><span>₹${fmt(bill.gross_amount)}</span></div>
        ${parseFloat(bill.discount_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;color:#dc2626"><span>Discount</span><span>- ₹${fmt(bill.discount_amount)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;font-weight:700;border-top:2px solid #1e40af;border-bottom:2px solid #1e40af"><span>Net Amount</span><span>₹${fmt(bill.net_amount)}</span></div>
        ${parseFloat(bill.paid_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;color:#16a34a"><span>Paid</span><span>₹${fmt(bill.paid_amount)}</span></div>` : ''}
        ${parseFloat(bill.balance_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;font-weight:700;color:#dc2626"><span>Balance Due</span><span>₹${fmt(bill.balance_amount)}</span></div>` : '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;color:#16a34a;font-weight:700"><span>Status</span><span>PAID IN FULL</span></div>'}
      </div></div>
      ${payRows ? `<div style="margin-top:8px"><div style="font-size:9px;font-weight:600;margin-bottom:3px">Payment Details:</div><table style="width:100%;font-size:9px"><tbody>${payRows}</tbody></table></div>` : ''}
      <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:8px;color:#888"><div>Printed: ${new Date().toLocaleString('en-IN')}</div><div>Authorised Signatory</div></div>
      <div style="margin-top:10px;text-align:center;font-size:7px;color:#aaa">This is a computer-generated bill. Health1 Super Speciality Hospital Pvt. Ltd.</div>
    </div>`, `Bill-${bill.bill_number}`);
  };

  // Print receipt for specific payment
  const printReceipt = (payment: any) => {
    const pt = bill.patient;
    openPrintWindow(`<div style="max-width:400px;margin:0 auto;font-family:'Segoe UI',Arial;font-size:11px">
      <div style="text-align:center;border-bottom:2px solid #1e40af;padding-bottom:6px;margin-bottom:8px">
        <div style="font-size:14px;font-weight:700;color:#1e40af">Health1 Super Speciality Hospital</div>
        <div style="font-size:8px;color:#666">Shilaj, Ahmedabad</div>
        <div style="font-size:12px;font-weight:700;margin-top:4px">PAYMENT RECEIPT</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:10px;margin-bottom:8px">
        <div><b>Receipt:</b> ${payment.receipt_number}</div><div><b>Date:</b> ${payment.payment_date}</div>
        <div><b>Patient:</b> ${pt?.first_name} ${pt?.last_name}</div><div><b>UHID:</b> ${pt?.uhid}</div>
        <div><b>Bill No:</b> ${bill.bill_number}</div><div><b>Mode:</b> ${payment.payment_mode.toUpperCase()}</div>
        ${payment.reference_number ? `<div><b>Ref:</b> ${payment.reference_number}</div>` : ''}
      </div>
      <div style="text-align:center;padding:12px;background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;margin:12px 0">
        <div style="font-size:10px;color:#16a34a">Amount Received</div>
        <div style="font-size:24px;font-weight:700;color:#16a34a">₹${fmt(payment.amount)}</div>
      </div>
      <div style="text-align:right;font-size:9px;color:#888;margin-top:20px">Cashier: ${staffId.substring(0,8)}</div>
    </div>`, `Receipt-${payment.receipt_number}`);
  };

  const pt = bill.patient;

  return (
    <div className="bg-white rounded-xl border shadow-sm mb-4">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">{pt?.first_name?.charAt(0)}{pt?.last_name?.charAt(0)}</div>
          <div>
            <div className="font-semibold">{pt?.first_name} {pt?.last_name} <span className="text-gray-400 font-normal text-xs">{pt?.uhid}</span></div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-mono">{bill.bill_number}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(bill.status)}`}>{bill.status?.replace('_',' ')}</span>
              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{bill.bill_type?.toUpperCase()}</span>
              <span className="bg-blue-50 px-1.5 py-0.5 rounded text-[10px] text-blue-700">{bill.payor_type?.replace('govt_','').replace('_',' ').toUpperCase()}</span>
              <span>{bill.bill_date}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {bill.status === 'draft' && <button onClick={finalize} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Finalize</button>}
          <button onClick={() => setShowPay(!showPay)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">₹ Pay</button>
          <button onClick={() => setShowDisc(!showDisc)} className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs rounded-lg">% Disc</button>
          {advances.totalActive > 0 && <button onClick={() => setShowAdv(!showAdv)} className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded-lg">Adjust Adv ({fmt(advances.totalActive)})</button>}
          <button onClick={printBillDoc} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Print</button>
          {bill.status === 'draft' && <button onClick={cancelBill} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg">Cancel</button>}
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">✕</button>
        </div>
      </div>

      {/* Amount summary */}
      <div className="grid grid-cols-5 gap-px bg-gray-100 border-b">
        <div className="bg-white p-3 text-center"><div className="text-[10px] text-gray-500">Gross</div><div className="font-bold">₹{fmt(bill.gross_amount)}</div></div>
        <div className="bg-white p-3 text-center"><div className="text-[10px] text-orange-600">Discount</div><div className="font-bold text-orange-700">{parseFloat(bill.discount_amount) > 0 ? `₹${fmt(bill.discount_amount)}` : '—'}</div></div>
        <div className="bg-blue-50 p-3 text-center"><div className="text-[10px] text-blue-600">Net Payable</div><div className="text-lg font-bold text-blue-700">₹{fmt(bill.net_amount)}</div></div>
        <div className="bg-white p-3 text-center"><div className="text-[10px] text-green-600">Collected</div><div className="font-bold text-green-700">₹{fmt(bill.paid_amount)}</div></div>
        <div className={`p-3 text-center ${parseFloat(bill.balance_amount) > 0 ? 'bg-red-50' : 'bg-green-50'}`}><div className="text-[10px] text-gray-600">Balance</div><div className={`font-bold ${parseFloat(bill.balance_amount) > 0 ? 'text-red-700' : 'text-green-700'}`}>{parseFloat(bill.balance_amount) > 0 ? `₹${fmt(bill.balance_amount)}` : 'PAID ✓'}</div></div>
      </div>

      {/* Payment collection */}
      {showPay && <div className="border-b p-4 bg-green-50">
        <div className="grid grid-cols-4 gap-3 mb-2">
          <div><label className="text-xs text-gray-500">Amount *</label>
            <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={`Balance: ₹${fmt(bill.balance_amount)}`} />
          </div>
          <div><label className="text-xs text-gray-500">Mode *</label>
            <div className="flex flex-wrap gap-1 mt-1">{PAY_MODES.map(m => (
              <button key={m} onClick={() => setPayForm(f => ({...f, mode: m}))} className={`px-2 py-1 rounded text-[10px] border ${payForm.mode === m ? 'bg-green-600 text-white border-green-600' : 'bg-white border-gray-200'}`}>{m.replace('_',' ').toUpperCase()}</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500">Reference/Txn ID</label>
            <input type="text" value={payForm.reference} onChange={e => setPayForm(f => ({...f, reference: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Split payment?</label>
            <div className="flex gap-1 mt-1">
              <select value={payForm.splitMode2} onChange={e => setPayForm(f => ({...f, splitMode2: e.target.value}))} className="flex-1 px-2 py-1.5 border rounded text-xs"><option value="">No split</option>{PAY_MODES.map(m => <option key={m}>{m}</option>)}</select>
              {payForm.splitMode2 && <input type="number" value={payForm.splitAmt2} onChange={e => setPayForm(f => ({...f, splitAmt2: e.target.value}))} className="w-20 px-2 py-1.5 border rounded text-xs" placeholder="₹" />}
            </div></div>
        </div>
        <div className="flex gap-2">
          <button onClick={collectPayment} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium">Collect ₹{payForm.amount || '0'}{payForm.splitAmt2 ? ` + ₹${payForm.splitAmt2}` : ''}</button>
          <button onClick={() => setPayForm(f => ({...f, amount: String(bill.balance_amount)}))} className="px-3 py-1.5 bg-green-100 text-green-700 text-xs rounded-lg">Full balance</button>
          <button onClick={() => setShowPay(false)} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Cancel</button>
        </div>
      </div>}

      {/* Discount */}
      {showDisc && <div className="border-b p-4 bg-orange-50">
        <div className="grid grid-cols-4 gap-3 mb-2">
          <div><label className="text-xs text-gray-500">Flat amount (₹)</label>
            <input type="number" value={discForm.amount} onChange={e => setDiscForm(f => ({...f, amount: e.target.value, percentage: ''}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Or percentage (%)</label>
            <input type="number" value={discForm.percentage} onChange={e => setDiscForm(f => ({...f, percentage: e.target.value, amount: ''}))} className="w-full px-3 py-2 border rounded-lg text-sm" max="100" />
            {discForm.percentage && <div className="text-[10px] text-orange-600 mt-0.5">= ₹{fmt(parseFloat(bill.gross_amount) * parseFloat(discForm.percentage) / 100)}</div>}</div>
          <div><label className="text-xs text-gray-500">Reason *</label>
            <select value={discForm.reason} onChange={e => setDiscForm(f => ({...f, reason: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select...</option>{DISCOUNT_REASONS.map(r => <option key={r}>{r}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Authorization</label>
            <div className="flex gap-1 mt-1">{Object.entries(DISC_LEVELS).map(([k, [max, label]]) => (
              <button key={k} onClick={() => setDiscForm(f => ({...f, level: k}))} className={`flex-1 py-1 rounded text-[9px] border ${discForm.level === k ? 'bg-orange-600 text-white' : 'bg-white'}`} title={label}>{k.replace('_',' ')}</button>
            ))}</div></div>
        </div>
        <div className="flex gap-2">
          <button onClick={applyDiscount} className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg">Apply Discount</button>
          <button onClick={() => setShowDisc(false)} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Cancel</button>
        </div>
      </div>}

      {/* Advance adjustment */}
      {showAdv && <div className="border-b p-4 bg-purple-50">
        <div className="text-xs font-medium text-purple-700 mb-2">Active Advances (₹{fmt(advances.totalActive)})</div>
        <div className="flex gap-2 flex-wrap">{advances.advances.filter((a: any) => a.status === 'active').map((a: any) => (
          <button key={a.id} onClick={() => setAdvId(a.id)} className={`px-3 py-2 rounded-lg border text-xs ${advId === a.id ? 'bg-purple-600 text-white' : 'bg-white'}`}>
            {a.receipt_number} — ₹{fmt(a.amount)} ({a.payment_mode})
          </button>
        ))}</div>
        <div className="flex gap-2 mt-2">
          <button onClick={adjustAdvance} disabled={!advId} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg disabled:opacity-40">Adjust Against Bill</button>
          <button onClick={() => setShowAdv(false)} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Cancel</button>
        </div>
      </div>}

      <div className="p-4">
        {/* Category-wise breakdown */}
        {Object.keys(catTotals).length > 1 && <div className="flex gap-2 flex-wrap mb-3">
          {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
            <span key={cat} className="text-[10px] px-2 py-1 bg-gray-50 rounded border"><span className={`font-medium ${catColor(cat)}`}>{cat.replace('_',' ')}</span> <span className="font-bold">₹{fmt(total)}</span></span>
          ))}
        </div>}

        {/* Add items */}
        <div className="relative mb-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input type="text" value={tariffQ} onChange={e => setTariffQ(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search tariff to add item..." />
              {tariffResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">{tariffResults.map((t: any) => (
                <button key={t.id} onClick={() => addTariffItem(t)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0 flex justify-between text-xs">
                  <div><div className="font-medium">{t.service_name}</div><div className="text-[10px] text-gray-400">{t.service_code} | <span className={catColor(t.category)}>{t.category.replace('_',' ')}</span></div></div>
                  <span className="font-bold text-blue-600">₹{fmt(tariffs.getRate(t.id, bill.payor_type))}</span>
                </button>
              ))}</div>}
            </div>
            <button onClick={() => setShowAddItem(!showAddItem)} className="px-3 py-2 border rounded-lg text-xs text-gray-600">+ Manual</button>
          </div>
          {showAddItem && <div className="mt-2 grid grid-cols-4 gap-2">
            <input type="text" value={manualItem.description} onChange={e => setManualItem(f => ({...f, description: e.target.value}))} className="col-span-2 px-2 py-1.5 border rounded text-xs" placeholder="Description" />
            <input type="number" value={manualItem.quantity} onChange={e => setManualItem(f => ({...f, quantity: parseInt(e.target.value)||1}))} className="px-2 py-1.5 border rounded text-xs" placeholder="Qty" min="1" />
            <div className="flex gap-1"><input type="number" value={manualItem.unitRate} onChange={e => setManualItem(f => ({...f, unitRate: parseFloat(e.target.value)||0}))} className="flex-1 px-2 py-1.5 border rounded text-xs" placeholder="Rate" /><button onClick={addManualItem} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Add</button></div>
          </div>}
        </div>

        {/* Items table */}
        <div className="border rounded-lg overflow-hidden mb-3">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left w-8">#</th><th className="p-2 text-left">Service</th><th className="p-2">Date</th><th className="p-2 text-center">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Disc</th><th className="p-2 text-right font-bold">Net</th>{bill.status === 'draft' && <th className="p-2 w-8"></th>}
          </tr></thead><tbody>{items.items.map((i: any, idx: number) => (
            <tr key={i.id} className="border-b hover:bg-gray-50">
              <td className="p-2 text-gray-400">{idx + 1}</td>
              <td className="p-2"><span className="font-medium">{i.description}</span>{i.tariff?.category && <span className={`ml-1 text-[9px] ${catColor(i.tariff.category)}`}>({i.tariff.category.replace('_',' ')})</span>}{i.doctor?.full_name && <span className="text-[10px] text-gray-400 block">Dr. {i.doctor.full_name}</span>}</td>
              <td className="p-2 text-center text-gray-500">{i.service_date}</td>
              <td className="p-2 text-center">{i.quantity}</td>
              <td className="p-2 text-right">₹{fmt(i.unit_rate)}</td>
              <td className="p-2 text-right text-orange-600">{parseFloat(i.discount) > 0 ? `₹${fmt(i.discount)}` : '—'}</td>
              <td className="p-2 text-right font-bold">₹{fmt(i.net_amount)}</td>
              {bill.status === 'draft' && <td className="p-2 text-center"><button onClick={() => { items.remove(i.id); onUpdate(); }} className="text-red-400 hover:text-red-600">✕</button></td>}
            </tr>
          ))}</tbody></table>
        </div>

        {/* Payment history */}
        {pay.payments.length > 0 && <div className="mb-3">
          <h4 className="text-xs font-medium text-gray-500 mb-1.5">Payments ({pay.payments.length})</h4>
          <div className="space-y-1">{pay.payments.map((p: any) => (
            <div key={p.id} className="bg-green-50 rounded-lg px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono text-green-700">{p.receipt_number}</span>
                <span className="bg-white px-1.5 py-0.5 rounded border text-[10px]">{p.payment_mode?.toUpperCase()}</span>
                <span className="text-gray-500">{p.payment_date}</span>
                {p.reference_number && <span className="text-gray-400">Ref: {p.reference_number}</span>}
                <span className="text-gray-400">by {p.staff?.full_name || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-700 text-sm">₹{fmt(p.amount)}</span>
                <button onClick={() => printReceipt(p)} className="text-[10px] text-blue-600 hover:text-blue-800">Print</button>
              </div>
            </div>
          ))}</div>
        </div>}
      </div>
    </div>
  );
}
