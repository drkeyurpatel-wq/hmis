// components/billing/opd-billing.tsx
// OPD: patient completes consultation → bill generated → payment → receipt
'use client';
import React, { useState, useCallback } from 'react';
import { HOSPITAL } from '@/lib/config/hospital';
import { sb } from '@/lib/supabase/browser';
import { smartPostConsultationCharge, generateBillNumber, lookupTariff } from '@/lib/bridge/cross-module-bridge';
import { printBillInvoice, printPaymentReceipt } from '@/components/billing/bill-pdf';
import { auditCreate } from '@/lib/audit/audit-logger';
import { notifyPaymentReceipt as notifyPayment } from '@/lib/notifications/notification-dispatcher';

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface Props {
  centreId: string; staffId: string;
  patient: { id: string; name: string; uhid: string; phone?: string; age?: string; gender?: string };
  doctor: { id: string; name: string; isSuper: boolean; specialisation?: string };
  visitId: string; visitType: string;
  onFlash: (m: string) => void; onDone?: () => void;
}

export default function OPDBilling({ centreId, staffId, patient, doctor, visitId, visitType, onFlash, onDone }: Props) {
  const [step, setStep] = useState<'charges' | 'payment' | 'done'>('charges');
  const [charges, setCharges] = useState<{ desc: string; amount: number; tariffId?: string }[]>([]);
  const [addServiceSearch, setAddServiceSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [payMode, setPayMode] = useState('upi');
  const [payRef, setPayRef] = useState('');
  const [bill, setBill] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [discount, setDiscount] = useState(0);

  // Auto-add consultation charge on mount
  React.useEffect(() => {
    (async () => {
      const result = await smartPostConsultationCharge({
        centreId, patientId: patient.id, doctorName: doctor.name,
        isSuper: doctor.isSuper, visitType, visitId, staffId,
      });
      if (result.posted) {
        setCharges([{ desc: `Consultation: Dr. ${doctor.name} (${doctor.isSuper ? 'Super Specialist' : 'Specialist'}${visitType === 'follow_up' ? ' — Follow-up' : ''})`, amount: result.amount }]);
      }
    })();
  }, []);

  // Search tariff for additional services
  React.useEffect(() => {
    if (addServiceSearch.length < 2 || !sb()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_tariff_master')
        .select('id, service_name, category, rate_self')
        .eq('centre_id', centreId).eq('is_active', true)
        .ilike('service_name', `%${addServiceSearch}%`).limit(6);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [addServiceSearch, centreId]);

  const addService = (tariff: any) => {
    const rate = parseFloat(tariff.rate_self || 0);
    setCharges(prev => [...prev, { desc: tariff.service_name, amount: rate, tariffId: tariff.id }]);
    setAddServiceSearch('');
    setSearchResults([]);
  };

  const removeCharge = (idx: number) => setCharges(prev => prev.filter((_, i) => i !== idx));
  const gross = charges.reduce((s, c) => s + c.amount, 0);
  const net = gross - discount;

  // Generate bill + collect payment
  const generateAndPay = async () => {
    if (!sb() || charges.length === 0) return;
    setProcessing(true);

    const billNumber = await generateBillNumber(centreId, 'opd');

    // Create bill
    const { data: billData, error: billErr } = await sb()!.from('hmis_bills').insert({
      centre_id: centreId, patient_id: patient.id, bill_number: billNumber,
      bill_type: 'opd', encounter_type: 'opd', encounter_id: visitId,
      payor_type: 'self', gross_amount: gross, discount_amount: discount,
      tax_amount: 0, net_amount: net, paid_amount: net, balance_amount: 0,
      status: 'paid', bill_date: new Date().toISOString().split('T')[0],
    }).select('id, bill_number').single();

    if (billErr) { onFlash('Bill creation failed'); setProcessing(false); return; }

    // Create bill items
    for (const charge of charges) {
      await sb()!.from('hmis_bill_items').insert({
        bill_id: billData.id, tariff_id: charge.tariffId || null,
        description: charge.desc, quantity: 1, unit_rate: charge.amount,
        amount: charge.amount, discount: 0, tax: 0, net_amount: charge.amount,
        service_date: new Date().toISOString().split('T')[0],
        doctor_id: doctor.id,
      });
    }

    // Create payment
    const receiptNumber = `RCP-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    const { data: payment } = await sb()!.from('hmis_payments').insert({
      bill_id: billData.id, amount: net,
      payment_mode: payMode, reference_number: payRef || null,
      receipt_number: receiptNumber, received_by: staffId,
    }).select('id, receipt_number, amount, payment_mode, reference_number, created_at').single();

    // Notify patient
    if (patient.phone) notifyPayment(centreId, patient.phone, patient.name, String(net), billNumber);
    auditCreate(centreId, staffId, 'bill', billData.id, `OPD Bill: ${billNumber} ₹${net} — ${patient.name}`);

    setBill({ ...billData, gross_amount: gross, discount_amount: discount, net_amount: net, paid_amount: net, balance_amount: 0, bill_date: new Date().toISOString().split('T')[0], payor_type: 'self', bill_type: 'opd', payment });
    setStep('done');
    setProcessing(false);
    onFlash(`Bill ${billNumber} — ₹${net} paid`);
  };

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      {/* Patient header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-sm">{patient.name} <span className="text-gray-400 font-mono text-[10px]">{patient.uhid}</span></div>
          <div className="text-xs text-gray-500">Dr. {doctor.name} ({doctor.specialisation || (doctor.isSuper ? 'Super Specialist' : 'Specialist')}) | {visitType === 'follow_up' ? 'Follow-up' : 'New Visit'}</div>
        </div>
        <div className="text-right"><div className="text-xl font-bold text-h1-teal">{fmt(net)}</div><div className="text-[10px] text-gray-400">Total payable</div></div>
      </div>

      {/* STEP 1: Charges */}
      {step === 'charges' && <>
        {/* Charge list */}
        <div className="space-y-1.5">
          {charges.map((c, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-xs">{c.desc}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{fmt(c.amount)}</span>
                <button onClick={() => removeCharge(i)} className="text-red-400 text-[10px]">✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Add more services */}
        <div className="relative">
          <input type="text" value={addServiceSearch} onChange={e => setAddServiceSearch(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-xs" placeholder="Add service: X-ray, blood test, ECG, dressing..." />
          {searchResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
            {searchResults.map((t: any) => (
              <button key={t.id} onClick={() => addService(t)} className="w-full text-left px-3 py-2 text-xs hover:bg-h1-teal-light border-b flex justify-between">
                <span>{t.service_name} <span className="text-gray-400">({t.category?.replace('_', ' ')})</span></span>
                <span className="font-bold text-h1-teal">{fmt(parseFloat(t.rate_self))}</span>
              </button>
            ))}
          </div>}
        </div>

        {/* Discount */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">Discount:</label>
          <input type="number" value={discount} onChange={e => setDiscount(parseInt(e.target.value) || 0)}
            className="w-24 px-2 py-1 border rounded text-sm text-right" placeholder="₹0" />
          {discount > 0 && <span className="text-xs text-orange-600">Gross: {fmt(gross)} → Net: {fmt(net)}</span>}
        </div>

        {/* Total + proceed */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-lg font-bold">{fmt(net)}</div>
          <button onClick={() => setStep('payment')} disabled={charges.length === 0}
            className="px-6 py-2.5 bg-h1-navy text-white text-sm rounded-lg font-medium disabled:opacity-40">Proceed to Payment</button>
        </div>
      </>}

      {/* STEP 2: Payment */}
      {step === 'payment' && <>
        <div className="text-center py-4">
          <div className="text-3xl font-bold text-h1-teal">{fmt(net)}</div>
          <div className="text-xs text-gray-500 mt-1">{charges.length} item{charges.length > 1 ? 's' : ''} — {patient.name}</div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
          <div className="grid grid-cols-5 gap-1.5">
            {[['upi', 'UPI'], ['cash', 'Cash'], ['card', 'Card'], ['neft', 'NEFT'], ['cheque', 'Cheque']].map(([k, l]) => (
              <button key={k} onClick={() => setPayMode(k)}
                className={`py-2 text-xs rounded-lg border font-medium ${payMode === k ? 'bg-h1-navy text-white border-h1-navy' : 'bg-white'}`}>{l}</button>
            ))}
          </div>
        </div>
        {payMode !== 'cash' && <div>
          <label className="text-xs text-gray-500">Reference / UTR / Cheque #</label>
          <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={payMode === 'upi' ? 'UPI Transaction ID' : payMode === 'card' ? 'Card last 4 digits' : 'Reference number'} />
        </div>}
        <div className="flex gap-3">
          <button onClick={() => setStep('charges')} className="px-4 py-2.5 bg-gray-200 text-sm rounded-lg">Back</button>
          <button onClick={generateAndPay} disabled={processing}
            className="flex-1 py-2.5 bg-green-600 text-white text-sm rounded-lg font-bold disabled:opacity-40">
            {processing ? 'Processing...' : `Pay ${fmt(net)} & Generate Bill`}
          </button>
        </div>
      </>}

      {/* STEP 3: Done */}
      {step === 'done' && bill && <>
        <div className="text-center py-6">
          <svg className="mx-auto mb-2" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          <div className="text-lg font-bold">Payment Received</div>
          <div className="text-sm text-gray-500">Bill: {bill.bill_number}</div>
          <div className="text-2xl font-bold text-green-700 mt-2">{fmt(net)}</div>
          <div className="text-xs text-gray-400">{payMode.toUpperCase()} {payRef ? `— ${payRef}` : ''}</div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => printBillInvoice(bill, charges.map(c => ({ description: c.desc, quantity: 1, unit_rate: c.amount, net_amount: c.amount, service_date: bill.bill_date })), [bill.payment], { first_name: patient.name.split(' ')[0], last_name: patient.name.split(' ').slice(1).join(' '), uhid: patient.uhid, age_years: patient.age, gender: patient.gender, phone_primary: patient.phone }, HOSPITAL)}
            className="px-4 py-2 bg-h1-navy text-white text-xs rounded-lg">Print Bill</button>
          <button onClick={() => printPaymentReceipt(bill.payment, bill, { first_name: patient.name.split(' ')[0], last_name: patient.name.split(' ').slice(1).join(' '), uhid: patient.uhid }, HOSPITAL)}
            className="px-4 py-2 bg-green-600 text-white text-xs rounded-lg">Print Receipt</button>
          {onDone && <button onClick={onDone} className="px-4 py-2 bg-gray-200 text-xs rounded-lg">Done — Next Patient</button>}
        </div>
      </>}
    </div>
  );
}
