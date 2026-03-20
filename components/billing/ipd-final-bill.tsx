// components/billing/ipd-final-bill.tsx
// Generate consolidated final bill from all captured charges at discharge
'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useIPDRunningBill, useChargeCapture } from '@/lib/billing/charge-capture-hooks';
import { useAdvances } from '@/lib/billing/billing-hooks';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface Props { admissionId: string; centreId: string; staffId: string; onFlash: (m: string) => void; onBillCreated?: (billId: string) => void; }

export default function IPDFinalBill({ admissionId, centreId, staffId, onFlash, onBillCreated }: Props) {
  const running = useIPDRunningBill(admissionId);
  const capture = useChargeCapture(centreId);
  const [admission, setAdmission] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [discount, setDiscount] = useState({ amount: 0, reason: '', type: 'flat' as 'flat' | 'percent', percent: 0 });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Load admission + patient
  useEffect(() => {
    if (!admissionId || !sb()) return;
    sb().from('hmis_admissions')
      .select('*, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, phone_primary), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name), department:hmis_departments(name)')
      .eq('id', admissionId).single()
      .then(({ data }: any) => { setAdmission(data); setPatient(data?.patient); });

    // Load advances
    sb().from('hmis_advances').select('*').eq('admission_id', admissionId).order('created_at')
      .then(({ data }: any) => setAdvances(data || []));
  }, [admissionId]);

  const charges = running.charges;
  const capturedCharges = charges.filter(c => c.status === 'captured');
  const allCharges = charges.filter(c => c.status !== 'reversed');

  // Bill calculations
  const calc = useMemo(() => {
    const gross = allCharges.reduce((s, c) => s + c.amount, 0);
    const discountAmt = discount.type === 'percent' ? Math.round(gross * discount.percent / 100) : discount.amount;
    const net = gross - discountAmt;
    const advanceTotal = advances.reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    const balance = net - advanceTotal;

    // By category
    const byCategory = allCharges.reduce((acc: Record<string, { count: number; amount: number }>, c) => {
      if (!acc[c.category]) acc[c.category] = { count: 0, amount: 0 };
      acc[c.category].count++; acc[c.category].amount += c.amount;
      return acc;
    }, {});

    // By date
    const byDate = allCharges.reduce((acc: Record<string, number>, c) => {
      acc[c.serviceDate] = (acc[c.serviceDate] || 0) + c.amount;
      return acc;
    }, {});

    const losDays = admission ? Math.max(1, Math.ceil((Date.now() - new Date(admission.admission_date).getTime()) / 86400000)) : 1;
    const avgPerDay = gross / losDays;

    return { gross, discountAmt, net, advanceTotal, balance, byCategory, byDate, losDays, avgPerDay };
  }, [allCharges, discount, advances, admission]);

  // Generate final bill
  const generateBill = async () => {
    if (!admission || !patient || !sb()) return;
    setGenerating(true); setError('');

    try {
      // 1. Create the bill
      const billNumber = `IPD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;

      const { data: bill, error: billErr } = await sb().from('hmis_bills').insert({
        centre_id: centreId, patient_id: patient.id, bill_number: billNumber,
        bill_type: 'ipd', encounter_type: 'ipd', encounter_id: admissionId,
        payor_type: admission.payor_type || 'self',
        patient_insurance_id: admission.patient_insurance_id || null,
        gross_amount: calc.gross, discount_amount: calc.discountAmt,
        tax_amount: 0, net_amount: calc.net,
        paid_amount: calc.advanceTotal, balance_amount: Math.max(0, calc.balance),
        status: calc.balance <= 0 ? 'paid' : 'final',
        bill_date: new Date().toISOString().split('T')[0],
      }).select('id, bill_number').single();

      if (billErr) throw billErr;

      // 2. Post all captured charges to bill
      const capturedIds = capturedCharges.map(c => c.id);
      if (capturedIds.length > 0) {
        await capture.postToBill(capturedIds, bill.id);
      }

      // 3. Also create bill_items for already-posted charges
      const postedCharges = allCharges.filter(c => c.status === 'posted' && !c.billId);
      if (postedCharges.length > 0) {
        await sb().from('hmis_charge_log').update({ bill_id: bill.id }).in('id', postedCharges.map(c => c.id));
      }

      // 4. Log discount if any
      if (calc.discountAmt > 0) {
        await sb().from('hmis_discount_log').insert({
          bill_id: bill.id, discount_type: discount.type === 'percent' ? 'percentage' : 'flat',
          discount_amount: calc.discountAmt, discount_percentage: discount.type === 'percent' ? discount.percent : null,
          reason: discount.reason || 'Discharge discount', authorized_by: staffId,
          authorization_level: calc.discountAmt > 100000 ? 'md' : calc.discountAmt > 20000 ? 'manager' : 'supervisor',
        });
      }

      // 5. Adjust advances against bill
      for (const adv of advances) {
        await sb().from('hmis_payments').insert({
          bill_id: bill.id, amount: parseFloat(adv.amount),
          payment_mode: 'advance_adjustment', reference_number: adv.receipt_number,
          received_by: staffId,
        });
      }

      onFlash(`Final bill generated: ${bill.bill_number} — ${fmt(calc.net)}`);
      if (onBillCreated) onBillCreated(bill.id);
      running.load();

    } catch (err: any) {
      setError(err.message || 'Bill generation failed');
    }
    setGenerating(false);
  };

  if (running.loading) return <div className="animate-pulse space-y-3"><div className="h-24 bg-gray-200 rounded-xl" /><div className="h-48 bg-gray-200 rounded-xl" /></div>;

  return (
    <div className="space-y-4">
      {/* Patient + Admission header */}
      {patient && admission && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-lg">{patient.first_name} {patient.last_name} <span className="text-sm text-gray-400 font-mono">{patient.uhid}</span></div>
              <div className="text-xs text-gray-500">IPD: {admission.ipd_number} | Dr. {admission.doctor?.full_name} | {admission.department?.name} | {admission.payor_type?.replace('_', ' ')}</div>
              <div className="text-xs text-gray-400">Admitted: {admission.admission_date?.split('T')[0]} | LOS: {calc.losDays} days | Avg: {fmt(calc.avgPerDay)}/day</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-700">{fmt(calc.net)}</div>
              <div className="text-xs text-gray-500">Net payable</div>
            </div>
          </div>
        </div>
      )}

      {/* Bill summary */}
      <div className="grid grid-cols-6 gap-2">
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Gross</div><div className="text-lg font-bold">{fmt(calc.gross)}</div></div>
        <div className="bg-orange-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Discount</div><div className="text-lg font-bold text-orange-700">{fmt(calc.discountAmt)}</div></div>
        <div className="bg-blue-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Net</div><div className="text-lg font-bold text-blue-700">{fmt(calc.net)}</div></div>
        <div className="bg-green-50 rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Advance Paid</div><div className="text-lg font-bold text-green-700">{fmt(calc.advanceTotal)}</div></div>
        <div className={`rounded-xl border p-3 text-center ${calc.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}><div className="text-[9px] text-gray-500">Balance Due</div><div className={`text-lg font-bold ${calc.balance > 0 ? 'text-red-700' : 'text-green-700'}`}>{calc.balance > 0 ? fmt(calc.balance) : '₹0 — PAID'}</div></div>
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Charges</div><div className="text-lg font-bold">{allCharges.length}</div><div className="text-[10px] text-amber-600">{capturedCharges.length} pending</div></div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-xs font-bold text-gray-500 mb-2">Charge Breakdown</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {Object.entries(calc.byCategory).sort((a, b) => b[1].amount - a[1].amount).map(([cat, data]) => (
            <div key={cat} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
              <span className="text-gray-600 capitalize">{cat.replace('_', ' ')} <span className="text-gray-400">({data.count})</span></span>
              <span className="font-bold">{fmt(data.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Discount */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-xs font-bold text-gray-500 mb-2">Discount</h3>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-[9px] text-gray-500">Type</label>
            <div className="flex gap-1 mt-1">
              <button onClick={() => setDiscount(d => ({ ...d, type: 'flat' }))} className={`flex-1 py-1.5 text-[10px] rounded border ${discount.type === 'flat' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Flat ₹</button>
              <button onClick={() => setDiscount(d => ({ ...d, type: 'percent' }))} className={`flex-1 py-1.5 text-[10px] rounded border ${discount.type === 'percent' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Percent %</button>
            </div></div>
          <div><label className="text-[9px] text-gray-500">{discount.type === 'percent' ? 'Percentage' : 'Amount'}</label>
            {discount.type === 'percent' ?
              <input type="number" value={discount.percent} onChange={e => setDiscount(d => ({ ...d, percent: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="%" max="100" /> :
              <input type="number" value={discount.amount} onChange={e => setDiscount(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="₹" />
            }</div>
          <div className="col-span-2"><label className="text-[9px] text-gray-500">Reason</label>
            <select value={discount.reason} onChange={e => setDiscount(d => ({ ...d, reason: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">None</option>
              <option>Staff discount</option><option>Management approval</option><option>Senior citizen</option>
              <option>BPL / EWS</option><option>Freedom fighter</option><option>Long-stay adjustment</option>
              <option>Insurance write-off</option><option>Package adjustment</option><option>MD discretion</option>
            </select></div>
        </div>
        {calc.discountAmt > 0 && <div className="mt-2 text-xs text-orange-700 font-medium">Discount: {fmt(calc.discountAmt)} {discount.type === 'percent' ? `(${discount.percent}%)` : ''} → Net: {fmt(calc.net)}</div>}
      </div>

      {/* Advances */}
      {advances.length > 0 && <div className="bg-white rounded-xl border p-4">
        <h3 className="text-xs font-bold text-gray-500 mb-2">Advance Deposits ({advances.length})</h3>
        <div className="space-y-1">{advances.map((a: any, i: number) => (
          <div key={i} className="flex justify-between text-xs bg-green-50 rounded-lg px-3 py-2">
            <div><span className="font-mono text-[10px] text-gray-400">{a.receipt_number}</span> <span className="text-gray-500">{a.payment_mode}</span></div>
            <span className="font-bold text-green-700">{fmt(parseFloat(a.amount))}</span>
          </div>
        ))}</div>
        <div className="text-right text-sm font-bold mt-2">Total advances: {fmt(calc.advanceTotal)}</div>
      </div>}

      {/* Generate button */}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex gap-3">
        <button onClick={generateBill} disabled={generating || allCharges.length === 0}
          className="flex-1 px-6 py-3 bg-green-600 text-white text-sm rounded-xl font-bold disabled:opacity-40">
          {generating ? 'Generating...' : `Generate Final Bill — ${fmt(calc.net)}`}
        </button>
      </div>
    </div>
  );
}
