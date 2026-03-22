'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, Printer, Trash2 } from 'lucide-react';
import {
  searchTariff, getTariffCategories, getRateForPayor,
  calcLineItem, calcBillSummary, createBill, addPaymentToBill,
  buildIPDBillFromCharges, postDailyIPDCharges, loadBillDetails,
  searchPmjayPackages,
  type TariffItem, type BillLineItem, type PaymentEntry, type BillSummary, type PmjayPackage,
} from '@/lib/billing/billing-engine';
import { createBrowserClient } from '@supabase/ssr';

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => `₹${fmt(n)}`;

interface Props {
  centreId: string;
  staffId: string;
  mode: 'opd' | 'ipd' | 'general';
  patientId?: string;
  patientName?: string;
  admissionId?: string;
  payorType?: string;
  onDone?: (billId: string) => void;
  onFlash?: (msg: string) => void;
}

export default function ServiceBillingEngine({
  centreId, staffId, mode, patientId: initPatientId, patientName: initPatientName,
  admissionId, payorType: initPayor, onDone, onFlash,
}: Props) {
  // Patient
  const [patientId, setPatientId] = useState(initPatientId || '');
  const [patientName, setPatientName] = useState(initPatientName || '');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);

  // Tariff search
  const [tariffQ, setTariffQ] = useState('');
  const [tariffResults, setTariffResults] = useState<TariffItem[]>([]);
  const [pmjayResults, setPmjayResults] = useState<PmjayPackage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catFilter, setCatFilter] = useState('');

  // Bill items
  const [items, setItems] = useState<BillLineItem[]>([]);
  const [payorType, setPayorType] = useState(initPayor || 'self');

  // Payments
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [payMode, setPayMode] = useState<PaymentEntry['mode']>('cash');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');

  // Global discount
  const [globalDiscPct, setGlobalDiscPct] = useState(0);

  // State
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [billCreated, setBillCreated] = useState<{ id: string; number: string } | null>(null);
  const [step, setStep] = useState<'items' | 'payment' | 'done'>('items');

  // Load categories
  useEffect(() => { getTariffCategories(centreId).then(setCategories); }, [centreId]);

  // IPD: auto-load charges
  useEffect(() => {
    if (mode === 'ipd' && admissionId) {
      buildIPDBillFromCharges(admissionId, centreId, staffId, payorType).then(chargeItems => {
        if (chargeItems.length > 0) setItems(chargeItems);
      });
    }
  }, [mode, admissionId, centreId, staffId, payorType]);

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients')
        .select('id, uhid, first_name, last_name, phone_primary, gender, age_years')
        .or(`uhid.ilike.%${patientSearch}%,first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%,phone_primary.ilike.%${patientSearch}%`)
        .eq('is_active', true).limit(8);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Tariff search
  useEffect(() => {
    if (tariffQ.length < 2) { setTariffResults([]); setPmjayResults([]); return; }
    const t = setTimeout(async () => {
      const results = await searchTariff(centreId, tariffQ, catFilter || undefined);
      setTariffResults(results);
      // Also search PMJAY packages when payor is PMJAY
      if (payorType === 'pmjay') {
        const pmjay = await searchPmjayPackages(centreId, tariffQ);
        setPmjayResults(pmjay);
      } else {
        setPmjayResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [tariffQ, centreId, catFilter, payorType]);

  // Add tariff item to bill
  const addItem = (tariff: TariffItem) => {
    const rate = getRateForPayor(tariff, payorType);
    const item = calcLineItem({
      tariff_id: tariff.id,
      description: tariff.service_name,
      category: tariff.category,
      quantity: 1, days: 1,
      unit_rate: rate,
      unit_cost: tariff.cost_price || 0,
      discount_pct: globalDiscPct,
    });
    setItems(prev => [...prev, item]);
    setTariffQ('');
    setTariffResults([]);
    setPmjayResults([]);
  };

  // Add PMJAY package to bill
  const addPmjayItem = (pkg: PmjayPackage) => {
    const item = calcLineItem({
      tariff_id: null,
      description: `[PMJAY ${pkg.procedure_code}] ${pkg.package_name}`,
      category: 'pmjay',
      quantity: 1, days: 1,
      unit_rate: pkg.effective_rate,  // Already includes 10% NABH incentive
    });
    // Add implant as separate line if present
    const newItems = [item];
    if (pkg.implant_cost > 0 && pkg.implant_name) {
      newItems.push(calcLineItem({
        tariff_id: null,
        description: `[PMJAY Implant] ${pkg.implant_name}`,
        category: 'pmjay_implant',
        quantity: 1, days: 1,
        unit_rate: pkg.implant_cost,
      }));
    }
    setItems(prev => [...prev, ...newItems]);
    setTariffQ('');
    setTariffResults([]);
    setPmjayResults([]);
  };

  // Add custom item
  const addCustomItem = () => {
    const item = calcLineItem({
      description: 'Custom Service',
      category: 'custom',
      quantity: 1, days: 1, unit_rate: 0,
    });
    setItems(prev => [...prev, item]);
  };

  // Update line item
  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      return calcLineItem(updated);
    }));
  };

  // Remove line item
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  // Add payment
  const addPayment = () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    setPayments(prev => [...prev, { mode: payMode, amount: amt, reference: payRef }]);
    setPayAmount('');
    setPayRef('');
  };

  // Auto-fill remaining
  const payFull = () => {
    const summary = calcBillSummary(items, payments);
    if (summary.balance > 0) {
      setPayAmount(String(summary.balance));
    }
  };

  // Summary
  const summary = calcBillSummary(items, payments);

  // Submit bill
  const handleSubmit = async () => {
    if (!patientId) { setError('Select a patient'); return; }
    if (items.length === 0) { setError('Add at least one service'); return; }
    setSaving(true); setError('');
    const result = await createBill({
      centreId, patientId,
      billType: mode === 'general' ? 'opd' : mode,
      payorType, encounterId: undefined, admissionId,
      items, payments, staffId,
      globalDiscountPct: globalDiscPct > 0 ? globalDiscPct : undefined,
    });
    if (result.success) {
      setBillCreated({ id: result.billId!, number: result.billNumber! });
      setStep('done');
      onDone?.(result.billId!);
      onFlash?.(`Bill ${result.billNumber} created — ${INR(summary.net)}`);
    } else {
      setError(result.error || 'Failed');
    }
    setSaving(false);
  };

  // IPD: Post daily charges
  const handlePostDaily = async () => {
    if (!admissionId) return;
    const result = await postDailyIPDCharges(admissionId, centreId, staffId);
    onFlash?.(`Posted ${result.posted} daily charges (${INR(result.total)})`);
    // Reload charges
    const chargeItems = await buildIPDBillFromCharges(admissionId, centreId, staffId, payorType);
    setItems(chargeItems);
  };

  const cls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  // ---- DONE ----
  if (step === 'done' && billCreated) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-lg font-bold">Bill Created</h2>
        <div className="text-2xl font-mono bg-blue-50 text-blue-700 px-4 py-3 rounded-xl mt-3 font-bold">{billCreated.number}</div>
        <div className="mt-2 text-sm text-gray-500">{patientName} — {INR(summary.net)}</div>
        <div className="flex gap-3 mt-6 justify-center">
          <button onClick={() => window.print()} className="px-4 py-2 bg-gray-100 text-sm rounded-lg flex items-center gap-1"><Printer size={14} /> Print</button>
          <button onClick={() => { setItems([]); setPayments([]); setBillCreated(null); setStep('items'); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">New Bill</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}<button onClick={() => setError('')} className="float-right">✕</button></div>}

      {/* ===== PATIENT + PAYOR ===== */}
      <div className="bg-white rounded-xl border p-4">
        <div className="grid grid-cols-3 gap-3">
          {!initPatientId ? (
            <div className="col-span-2 relative">
              <label className="text-[10px] font-semibold text-gray-500">Patient</label>
              {patientId ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium">{patientName}</span>
                  <button onClick={() => { setPatientId(''); setPatientName(''); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <input className={cls + ' w-full mt-1'} value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search patient UHID, name, phone..." />
                  {patientResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {patientResults.map(p => (
                        <button key={p.id} onClick={() => { setPatientId(p.id); setPatientName(`${p.first_name} ${p.last_name} (${p.uhid})`); setPatientSearch(''); setPatientResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs border-b last:border-0">
                          <span className="font-medium">{p.first_name} {p.last_name}</span>
                          <span className="ml-2 text-gray-400">{p.uhid}</span>
                          <span className="ml-2 text-gray-400">{p.phone_primary}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="col-span-2"><label className="text-[10px] font-semibold text-gray-500">Patient</label><div className="text-sm font-medium mt-1">{patientName}</div></div>
          )}
          <div>
            <label className="text-[10px] font-semibold text-gray-500">Payor</label>
            <select className={cls + ' w-full mt-1'} value={payorType} onChange={e => setPayorType(e.target.value)}>
              <option value="self">Self Pay (Cash)</option>
              <option value="insurance">Cashless Insurance</option>
              <option value="pmjay">PMJAY</option>
              <option value="cghs">CGHS</option>
              <option value="echs">ECHS</option>
              <option value="corporate">Corporate</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===== STEP TOGGLE ===== */}
      <div className="flex gap-1">
        <button onClick={() => setStep('items')} className={`flex-1 py-2 text-xs font-medium rounded-lg ${step === 'items' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
          1. Services ({items.length})
        </button>
        <button onClick={() => setStep('payment')} className={`flex-1 py-2 text-xs font-medium rounded-lg ${step === 'payment' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
          2. Payment ({INR(summary.paid)} / {INR(summary.net)})
        </button>
      </div>

      {/* ===== SERVICES STEP ===== */}
      {step === 'items' && <>
        {/* Tariff search */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                value={tariffQ} onChange={e => setTariffQ(e.target.value)} placeholder={payorType === 'pmjay' ? "Search PMJAY packages — knee replacement, CABG, cataract..." : "Search services — CBC, ECG, X-Ray, Bed Charges..."} />
            </div>
            <select className="px-2 py-2 border rounded-lg text-xs" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
            <button onClick={addCustomItem} className="px-3 py-2 bg-gray-100 text-xs rounded-lg">+ Custom</button>
            {mode === 'ipd' && admissionId && (
              <button onClick={handlePostDaily} className="px-3 py-2 bg-orange-100 text-orange-700 text-xs rounded-lg font-medium">Post Daily Charges</button>
            )}
          </div>

          {/* Tariff results */}
          {tariffResults.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto mb-3">
              {tariffResults.map(t => {
                const rate = getRateForPayor(t, payorType);
                const costP = t.cost_price || 0;
                const mgn = rate > 0 && costP > 0 ? Math.round(((rate - costP) / rate) * 100) : null;
                return (
                <button key={t.id} onClick={() => addItem(t)} className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between border-b last:border-0 text-xs">
                  <div>
                    <span className="font-medium">{t.service_name}</span>
                    <span className="ml-2 text-gray-400">{t.category.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {costP > 0 && <span className="text-[9px] text-gray-400">Cost {INR(costP)}</span>}
                    <span className="font-bold text-green-700">{INR(rate)}</span>
                    {mgn !== null && <span className={`text-[9px] font-bold ${mgn >= 30 ? 'text-green-600' : mgn >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{mgn}%</span>}
                    <Plus size={14} className="text-blue-500" />
                  </div>
                </button>
                );
              })}
            </div>
          )}

          {/* PMJAY Package results */}
          {pmjayResults.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-bold text-orange-700 mb-1 px-1">PMJAY HBP 2022 Packages (NABH +10% included)</div>
              <div className="border border-orange-200 rounded-lg max-h-56 overflow-y-auto bg-orange-50/30">
                {pmjayResults.map(p => (
                  <button key={p.id} onClick={() => addPmjayItem(p)} className="w-full text-left px-3 py-2.5 hover:bg-orange-100 flex items-center justify-between border-b border-orange-100 last:border-0 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{p.package_name}</div>
                      <div className="text-[9px] text-gray-500 truncate">{p.procedure_name?.substring(0, 80)}</div>
                      <div className="flex gap-1 mt-0.5">
                        <span className="text-[8px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded">{p.procedure_code}</span>
                        <span className="text-[8px] bg-gray-100 px-1 py-0.5 rounded">{p.specialty?.split(',')[0]}</span>
                        {p.is_day_care && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">Day Care</span>}
                        {p.auto_approved && <span className="text-[8px] bg-green-100 text-green-700 px-1 py-0.5 rounded">Auto-Approved</span>}
                        {p.alos > 0 && <span className="text-[8px] bg-gray-100 px-1 py-0.5 rounded">ALOS {p.alos}d</span>}
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <div className="font-bold text-orange-700">{INR(p.effective_rate)}</div>
                      <div className="text-[8px] text-gray-400">Base {INR(p.base_rate)} + 10%</div>
                      {p.implant_cost > 0 && <div className="text-[8px] text-purple-600">+Implant {INR(p.implant_cost)}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Line items table */}
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-2 text-left w-1/4">Service</th>
                    <th className="p-2 text-center w-12">Qty</th>
                    <th className="p-2 text-center w-12">Days</th>
                    <th className="p-2 text-right w-16">Rate</th>
                    <th className="p-2 text-right w-16">Cost</th>
                    <th className="p-2 text-right w-16">Amount</th>
                    <th className="p-2 text-center w-12">Disc%</th>
                    <th className="p-2 text-right w-16">Net</th>
                    <th className="p-2 text-right w-16">Margin</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b hover:bg-blue-50/30">
                      <td className="p-2">
                        <input className="w-full text-xs border-0 outline-none bg-transparent font-medium" value={item.description}
                          onChange={e => updateItem(item.id, 'description', e.target.value)} />
                        <div className="text-[9px] text-gray-400">{item.category.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="p-2"><input type="number" className="w-10 text-center border rounded px-1 py-0.5 text-xs" value={item.quantity} min={1}
                        onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} /></td>
                      <td className="p-2"><input type="number" className="w-10 text-center border rounded px-1 py-0.5 text-xs" value={item.days} min={1}
                        onChange={e => updateItem(item.id, 'days', parseInt(e.target.value) || 1)} /></td>
                      <td className="p-2"><input type="number" className="w-14 text-right border rounded px-1 py-0.5 text-xs" value={item.unit_rate}
                        onChange={e => updateItem(item.id, 'unit_rate', parseFloat(e.target.value) || 0)} /></td>
                      <td className="p-2"><input type="number" className="w-14 text-right border rounded px-1 py-0.5 text-xs text-gray-500" value={item.unit_cost}
                        onChange={e => updateItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)} /></td>
                      <td className="p-2 text-right">{INR(item.amount)}</td>
                      <td className="p-2"><input type="number" className="w-10 text-center border rounded px-1 py-0.5 text-xs" value={item.discount_pct} min={0} max={100}
                        onChange={e => updateItem(item.id, 'discount_pct', parseFloat(e.target.value) || 0)} /></td>
                      <td className="p-2 text-right font-bold">{INR(item.net_amount)}</td>
                      <td className="p-2 text-right">
                        {item.unit_cost > 0 ? (
                          <div>
                            <span className={`font-bold text-[10px] ${item.margin_pct >= 30 ? 'text-green-700' : item.margin_pct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                              {item.margin_pct}%
                            </span>
                            <div className="text-[8px] text-gray-400">{INR(item.margin)}</div>
                          </div>
                        ) : <span className="text-[9px] text-gray-300">—</span>}
                      </td>
                      <td className="p-2"><button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Global discount + summary */}
          {items.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-500">Global Discount:</label>
                <input type="number" className="w-14 text-center border rounded px-1 py-0.5 text-xs" value={globalDiscPct} min={0} max={100}
                  onChange={e => { const v = parseFloat(e.target.value) || 0; setGlobalDiscPct(v); setItems(prev => prev.map(i => calcLineItem({ ...i, discount_pct: v }))); }} />
                <span className="text-xs text-gray-400">%</span>
              </div>
              <div className="text-right space-y-0.5">
                <div className="text-[10px] text-gray-500">Gross: {INR(summary.gross)}</div>
                {summary.totalDiscount > 0 && <div className="text-[10px] text-red-600">Discount: -{INR(summary.totalDiscount)}</div>}
                <div className="text-sm font-bold text-gray-900">Net: {INR(summary.net)}</div>
                {summary.totalCost > 0 && (
                  <div className="border-t border-gray-200 pt-1 mt-1">
                    <div className="text-[10px] text-gray-400">Cost: {INR(summary.totalCost)}</div>
                    <div className={`text-xs font-bold ${summary.marginPct >= 30 ? 'text-green-700' : summary.marginPct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      Margin: {INR(summary.margin)} ({summary.marginPct}%)
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button onClick={() => setStep('payment')} disabled={items.length === 0}
          className="w-full py-3 bg-blue-600 text-white text-sm rounded-xl font-bold disabled:opacity-40">
          Proceed to Payment ({INR(summary.net)}) →
        </button>
      </>}

      {/* ===== PAYMENT STEP ===== */}
      {step === 'payment' && <>
        <div className="bg-white rounded-xl border p-4 space-y-4">
          {/* Bill summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-[9px] text-gray-500">Gross</div><div className="text-lg font-bold">{INR(summary.gross)}</div></div>
            <div className="bg-red-50 rounded-lg p-3 text-center"><div className="text-[9px] text-gray-500">Discount</div><div className="text-lg font-bold text-red-700">-{INR(summary.totalDiscount)}</div></div>
            <div className="bg-blue-50 rounded-lg p-3 text-center"><div className="text-[9px] text-gray-500">Net Payable</div><div className="text-lg font-bold text-blue-700">{INR(summary.net)}</div></div>
            <div className={`rounded-lg p-3 text-center ${summary.balance > 0 ? 'bg-orange-50' : 'bg-green-50'}`}><div className="text-[9px] text-gray-500">Balance</div><div className={`text-lg font-bold ${summary.balance > 0 ? 'text-orange-700' : 'text-green-700'}`}>{INR(summary.balance)}</div></div>
          </div>

          {/* Add payment */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-gray-500">Payment Mode</label>
              <select className={cls + ' w-full mt-1'} value={payMode} onChange={e => setPayMode(e.target.value as any)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="neft">NEFT/RTGS</option>
                <option value="cheque">Cheque</option>
                <option value="insurance_settlement">Insurance Settlement</option>
              </select>
            </div>
            <div className="w-32">
              <label className="text-[10px] font-semibold text-gray-500">Amount</label>
              <input type="number" className={cls + ' w-full mt-1'} value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="₹" />
            </div>
            <div className="w-40">
              <label className="text-[10px] font-semibold text-gray-500">Reference</label>
              <input className={cls + ' w-full mt-1'} value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="UPI Ref / Cheque #" />
            </div>
            <button onClick={addPayment} className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg font-medium">Add</button>
            <button onClick={payFull} className="px-3 py-2 bg-blue-100 text-blue-700 text-xs rounded-lg">Pay Full</button>
          </div>

          {/* Payment list */}
          {payments.length > 0 && (
            <div className="space-y-1">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 text-xs">
                  <span className="capitalize font-medium">{p.mode.replace('_', ' ')}</span>
                  <span className="text-gray-500">{p.reference || '-'}</span>
                  <span className="font-bold text-green-700">{INR(p.amount)}</span>
                  <button onClick={() => setPayments(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                </div>
              ))}
              <div className="text-right text-xs font-bold">Total Paid: {INR(summary.paid)}</div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep('items')} className="px-4 py-3 bg-gray-100 text-sm rounded-xl">← Back to Services</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-3 bg-green-600 text-white text-sm rounded-xl font-bold disabled:opacity-40">
            {saving ? 'Creating Bill...' : `Create Bill — ${INR(summary.net)}${summary.balance > 0 ? ` (Due: ${INR(summary.balance)})` : ' (Paid)'}`}
          </button>
        </div>
      </>}
    </div>
  );
}
