// HEALTH1 HMIS — OPD QUICK BILL — 3-click billing
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Printer, IndianRupee, ArrowLeft, ArrowRight, User, Stethoscope, FlaskConical, Pill, X, Check, Trash2, CreditCard, Smartphone, Banknote, ChevronRight, Zap } from 'lucide-react';
import type { PayorType, PaymentMode, ServiceMaster } from '@/lib/billing/billing-v2-types';
import { PAYOR_TYPE_LABELS, PAYMENT_MODE_LABELS } from '@/lib/billing/billing-v2-types';

function StepIndicator({ current }: { current: number }) {
  const steps = [{num:1,label:'Patient'},{num:2,label:'Charges'},{num:3,label:'Collect'}];
  return (<div className="flex items-center justify-center gap-2">{steps.map((step, idx) => (<div key={step.num} className="flex items-center gap-2"><div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${current === step.num ? 'bg-[#0A2540] text-white' : current > step.num ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{current > step.num ? <Check className="h-3 w-3" /> : <span>{step.num}</span>}<span>{step.label}</span></div>{idx < steps.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300" />}</div>))}</div>);
}

interface ChargeItem { id: string; service_master_id: string; service_code: string; service_name: string; department: string; service_category: string; quantity: number; unit_rate: number; net_amount: number; service_doctor_id?: string; service_doctor_name?: string; source: 'auto' | 'manual'; }
interface PaymentSplit { mode: PaymentMode; amount: number; reference: string; }

export default function OPDQuickBillPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [payorType, setPayorType] = useState<PayorType>('SELF_PAY');
  const [consultingDoctorId, setConsultingDoctorId] = useState('');
  const [searching, setSearching] = useState(false);
  const [charges, setCharges] = useState<ChargeItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([{ mode: 'CASH', amount: 0, reference: '' }]);
  const [processing, setProcessing] = useState(false);
  const centreId = 'CURRENT_CENTRE_ID';

  const searchPatients = useCallback(async (term: string) => { if (term.length < 2) { setPatients([]); return; } setSearching(true); try { const res = await fetch(`/api/patients/search?q=${encodeURIComponent(term)}&limit=10`); if (res.ok) setPatients(await res.json()); } catch {} setSearching(false); }, []);
  useEffect(() => { const t = setTimeout(() => searchPatients(patientSearch), 300); return () => clearTimeout(t); }, [patientSearch, searchPatients]);
  useEffect(() => { (async () => { try { const res = await fetch(`/api/doctors?centre_id=${centreId}&is_active=true`); if (res.ok) setDoctors(await res.json()); } catch {} })(); }, [centreId]);

  const handleSelectPatient = async (patient: any) => {
    setSelectedPatient(patient); setPatients([]); setPatientSearch(`${patient.first_name} ${patient.last_name || ''} (${patient.uhid})`);
    try { const res = await fetch(`/api/billing/pending-orders?patient_id=${patient.id}&centre_id=${centreId}`);
      if (res.ok) { const orders = await res.json(); setCharges(orders.map((o: any, idx: number) => ({ id: `auto-${idx}`, service_master_id: o.service_master_id, service_code: o.service_code, service_name: o.service_name, department: o.department, service_category: o.service_category, quantity: o.quantity || 1, unit_rate: o.rate, net_amount: o.rate * (o.quantity || 1), service_doctor_id: o.doctor_id, service_doctor_name: o.doctor_name, source: 'auto' as const }))); }
    } catch {}
  };

  const searchServices = useCallback(async (term: string) => { if (term.length < 2) { setServices([]); return; } try { const res = await fetch(`/api/billing/services/search?centre_id=${centreId}&q=${encodeURIComponent(term)}`); if (res.ok) setServices(await res.json()); } catch {} }, [centreId]);
  useEffect(() => { const t = setTimeout(() => searchServices(serviceSearch), 300); return () => clearTimeout(t); }, [serviceSearch, searchServices]);

  const addCharge = (svc: any) => { setCharges(prev => [...prev, { id: `manual-${Date.now()}`, service_master_id: svc.id, service_code: svc.service_code, service_name: svc.service_name, department: svc.department, service_category: svc.service_category, quantity: 1, unit_rate: svc.base_rate, net_amount: svc.base_rate, source: 'manual' }]); setServiceSearch(''); setServices([]); };
  const removeCharge = (id: string) => setCharges(prev => prev.filter(c => c.id !== id));
  const updateChargeQty = (id: string, qty: number) => setCharges(prev => prev.map(c => c.id === id ? { ...c, quantity: qty, net_amount: qty * c.unit_rate } : c));

  const totalAmount = charges.reduce((sum, c) => sum + c.net_amount, 0);
  const totalPaying = paymentSplits.reduce((sum, p) => sum + p.amount, 0);
  const changeAmount = totalPaying - totalAmount;

  const handleSubmit = async () => {
    if (processing || !selectedPatient || charges.length === 0) return;
    setProcessing(true);
    try {
      const encRes = await fetch('/api/billing/encounters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ centre_id: centreId, patient_id: selectedPatient.id, encounter_type: 'OPD', primary_payor_type: payorType, consulting_doctor_id: consultingDoctorId || null }) });
      if (!encRes.ok) throw new Error('Failed to create encounter');
      const encounter = await encRes.json();
      for (const charge of charges) { await fetch(`/api/billing/encounters/${encounter.id}/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_master_id: charge.service_master_id, quantity: charge.quantity, unit_rate: charge.unit_rate, service_doctor_id: charge.service_doctor_id || consultingDoctorId || null, source_type: charge.source === 'auto' ? 'ORDER' : 'MANUAL' }) }); }
      for (const split of paymentSplits) { if (split.amount <= 0) continue; await fetch(`/api/billing/encounters/${encounter.id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: split.amount, payment_mode: split.mode, payment_reference: split.reference || null, payment_type: 'COLLECTION' }) }); }
      await fetch(`/api/billing/encounters/${encounter.id}/invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_type: 'OPD' }) });
      router.push(`/billing/${encounter.id}?print=true`);
    } catch (err: any) { alert(`Billing failed: ${err.message}`); } finally { setProcessing(false); }
  };

  useEffect(() => { if (step === 1) searchRef.current?.focus(); }, [step]);
  useEffect(() => { if (step === 3 && paymentSplits.length === 1 && paymentSplits[0].amount === 0) setPaymentSplits([{ ...paymentSplits[0], amount: totalAmount }]); }, [step, totalAmount, paymentSplits]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={() => router.push('/billing')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-600" /></button><div><div className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /><h1 className="text-lg font-bold text-[#0A2540]">OPD Quick Bill</h1></div><p className="text-xs text-gray-500 ml-7">3-step billing: Patient - Charges - Collect</p></div></div><StepIndicator current={step} /></div></div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {step === 1 && (<div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><User className="h-4 w-4 text-[#00B4D8]" /> Select Patient</h2>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input ref={searchRef} type="text" value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }} placeholder="Search by name, UHID, phone..." className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" autoFocus />
              {patients.length > 0 && !selectedPatient && <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border bg-white shadow-lg">{patients.map((p: any) => <button key={p.id} onClick={() => handleSelectPatient(p)} className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-gray-900">{p.first_name} {p.last_name || ''}</p><p className="text-xs text-gray-500">{p.uhid} - {p.phone} - {p.gender}</p></div></div></button>)}</div>}
            </div>
            {selectedPatient && <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-blue-900">{selectedPatient.first_name} {selectedPatient.last_name || ''}</p><p className="text-xs text-blue-700">{selectedPatient.uhid} - {selectedPatient.phone}</p></div><button onClick={() => { setSelectedPatient(null); setPatientSearch(''); setCharges([]); }} className="p-1 rounded hover:bg-blue-100"><X className="h-4 w-4 text-blue-600" /></button></div>}
            {selectedPatient && <div><label className="block text-xs font-medium text-gray-600 mb-1">Consulting Doctor</label><select value={consultingDoctorId} onChange={(e) => setConsultingDoctorId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30"><option value="">— Select Doctor —</option>{doctors.map((d: any) => <option key={d.id} value={d.id}>{d.name} ({d.department})</option>)}</select></div>}
            {selectedPatient && <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Payor</label><div className="grid grid-cols-4 gap-2">{(['SELF_PAY','PMJAY','TPA','CORPORATE'] as PayorType[]).map(pt => <button key={pt} onClick={() => setPayorType(pt)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${payorType === pt ? 'border-[#00B4D8] bg-[#00B4D8]/10 text-[#00B4D8]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{PAYOR_TYPE_LABELS[pt]}</button>)}</div></div>}
          </div>
          {selectedPatient && <button onClick={() => setStep(2)} className="w-full rounded-xl bg-[#0A2540] py-3 text-sm font-semibold text-white hover:bg-[#0A2540]/90 flex items-center justify-center gap-2">Next: Add Charges <ArrowRight className="h-4 w-4" /></button>}
        </div>)}

        {step === 2 && (<div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Stethoscope className="h-4 w-4 text-[#00B4D8]" /> Charges for {selectedPatient?.first_name}</h2><span className="text-xs text-gray-500">{selectedPatient?.uhid}</span></div>
            <div className="relative"><Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder="Add service: type name or code..." className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:bg-white" />
              {services.length > 0 && <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg">{services.map((svc: any) => <button key={svc.id} onClick={() => addCharge(svc)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex items-center justify-between"><div><p className="text-sm font-medium text-gray-900">{svc.service_name}</p><p className="text-xs text-gray-500">{svc.service_code} - {svc.department}</p></div><span className="text-sm font-mono font-semibold text-gray-900">₹{svc.base_rate}</span></button>)}</div>}
            </div>
            <div className="space-y-2">{charges.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No charges added.</p> : charges.map(charge => <div key={charge.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50/50"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-900 truncate">{charge.service_name}</p>{charge.source === 'auto' && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">AUTO</span>}</div><p className="text-xs text-gray-500">{charge.service_code} - {charge.department}</p></div><div className="flex items-center gap-2"><input type="number" min={1} value={charge.quantity} onChange={(e) => updateChargeQty(charge.id, Number(e.target.value))} className="w-14 rounded border border-gray-200 px-2 py-1 text-xs text-center font-mono focus:outline-none focus:ring-1 focus:ring-[#00B4D8]" /><span className="text-xs text-gray-400">x</span><span className="text-xs font-mono text-gray-600 w-16 text-right">₹{charge.unit_rate.toLocaleString('en-IN')}</span><span className="text-sm font-bold font-mono text-gray-900 w-20 text-right">₹{charge.net_amount.toLocaleString('en-IN')}</span><button onClick={() => removeCharge(charge.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div>
            {charges.length > 0 && <div className="rounded-lg bg-gray-50 p-3 flex items-center justify-between border-t-2 border-gray-200"><span className="text-sm font-bold text-gray-700">TOTAL</span><span className="text-xl font-bold font-mono text-[#0A2540]">₹{totalAmount.toLocaleString('en-IN')}</span></div>}
          </div>
          <div className="flex gap-3"><button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"><ArrowLeft className="h-4 w-4" /> Back</button><button onClick={() => setStep(3)} disabled={charges.length === 0} className="flex-[2] rounded-xl bg-[#0A2540] py-3 text-sm font-semibold text-white hover:bg-[#0A2540]/90 disabled:opacity-40 flex items-center justify-center gap-2">Next: Collect Payment <ArrowRight className="h-4 w-4" /></button></div>
        </div>)}

        {step === 3 && (<div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><IndianRupee className="h-4 w-4 text-emerald-600" /> Collect Payment</h2>
            <div className="rounded-lg bg-[#0A2540] p-4 text-white"><div className="flex items-center justify-between"><div><p className="text-xs text-blue-200">{selectedPatient?.first_name} {selectedPatient?.last_name || ''} ({selectedPatient?.uhid})</p><p className="text-xs text-blue-300 mt-0.5">{charges.length} items</p></div><div className="text-right"><p className="text-2xl font-bold font-mono">₹{totalAmount.toLocaleString('en-IN')}</p></div></div></div>
            {paymentSplits.map((split, idx) => (<div key={idx} className="space-y-3 rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-500">Payment {idx + 1}</span>{paymentSplits.length > 1 && <button onClick={() => setPaymentSplits(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-500 hover:text-red-700">Remove</button>}</div>
              <div className="grid grid-cols-3 gap-2">{([{mode:'CASH' as PaymentMode,icon:Banknote,label:'Cash'},{mode:'CARD' as PaymentMode,icon:CreditCard,label:'Card'},{mode:'UPI' as PaymentMode,icon:Smartphone,label:'UPI'}]).map(m => <button key={m.mode} onClick={() => setPaymentSplits(prev => prev.map((s, i) => i === idx ? {...s, mode: m.mode} : s))} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${split.mode === m.mode ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}><m.icon className="h-4 w-4" /> {m.label}</button>)}</div>
              <input type="number" min={0} value={split.amount} onChange={(e) => setPaymentSplits(prev => prev.map((s, i) => i === idx ? {...s, amount: Number(e.target.value)} : s))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Amount" />
              {split.mode !== 'CASH' && <input type="text" value={split.reference} onChange={(e) => setPaymentSplits(prev => prev.map((s, i) => i === idx ? {...s, reference: e.target.value} : s))} placeholder={split.mode === 'UPI' ? 'UPI Transaction ID' : 'Reference Number'} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />}
            </div>))}
            <button onClick={() => setPaymentSplits(prev => [...prev, { mode: 'CARD', amount: 0, reference: '' }])} className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"><Plus className="h-3 w-3" /> Add Split Payment</button>
            {changeAmount !== 0 && totalPaying > 0 && <div className={`rounded-lg p-3 flex items-center justify-between ${changeAmount > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}><span className={`text-sm font-medium ${changeAmount > 0 ? 'text-amber-700' : 'text-red-700'}`}>{changeAmount > 0 ? 'Change to Return' : 'Short by'}</span><span className={`text-lg font-bold font-mono ${changeAmount > 0 ? 'text-amber-700' : 'text-red-700'}`}>₹{Math.abs(changeAmount).toLocaleString('en-IN')}</span></div>}
          </div>
          <div className="flex gap-3"><button onClick={() => setStep(2)} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"><ArrowLeft className="h-4 w-4" /> Back</button><button onClick={handleSubmit} disabled={processing || totalPaying < totalAmount} className="flex-[2] rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2">{processing ? 'Processing...' : <><Printer className="h-4 w-4" /> Bill & Print Receipt</>}</button></div>
        </div>)}
      </div>
    </div>
  );
}
