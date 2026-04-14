// @ts-nocheck
// HEALTH1 HMIS — ENCOUNTER DETAIL / RUNNING BILL
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Printer, Download, CreditCard, Shield, Clock, FileText, AlertTriangle, Lock, Unlock, IndianRupee, Trash2, ChevronDown, ChevronUp, RefreshCw, Send, Edit2, X, Check, Stethoscope, FlaskConical, Pill, Bed, Activity, Scissors } from 'lucide-react';
import type { BillingEncounter, BillingLineItem, BillingPayment, ServiceCategory, PaymentMode, DiscountType } from '@/lib/billing/billing-v2-types';
import { ENCOUNTER_STATUS_COLORS, PAYOR_TYPE_LABELS, PAYMENT_MODE_LABELS, SERVICE_CATEGORY_LABELS } from '@/lib/billing/billing-v2-types';

const DEPT_ICONS: Record<string, any> = { CONSULTATION: Stethoscope, INVESTIGATION: FlaskConical, PROCEDURE: Activity, SURGERY: Scissors, ROOM: Bed, NURSING: Activity, MEDICINE: Pill, CONSUMABLE: Pill, DEFAULT: FileText };
function getDeptIcon(cat: string) { return DEPT_ICONS[cat] || DEPT_ICONS.DEFAULT; }

function FinancialSummary({ encounter }: { encounter: BillingEncounter }) {
  const cards = [{ label:'Total Charges', value:encounter.net_amount, color:'border-l-gray-400', tc:'text-gray-900' }, { label:'Paid / Collected', value:encounter.total_paid, color:'border-l-emerald-400', tc:'text-emerald-700' }, { label: encounter.primary_payor_type !== 'SELF_PAY' ? 'Insurance Approved' : 'Discounts', value: encounter.primary_payor_type !== 'SELF_PAY' ? encounter.insurance_approved_amount : encounter.total_discounts, color:'border-l-blue-400', tc:'text-blue-700' }, { label:'Balance Due', value:encounter.balance_due, color: encounter.balance_due > 0 ? 'border-l-red-400' : 'border-l-emerald-400', tc: encounter.balance_due > 0 ? 'text-red-600' : 'text-emerald-700' }];
  return (<div className="grid grid-cols-2 md:grid-cols-4 gap-3">{cards.map(c => <div key={c.label} className={`rounded-lg border border-gray-200 bg-white p-3.5 border-l-4 ${c.color}`}><p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{c.label}</p><p className={`mt-1 text-lg font-bold font-mono tabular-nums ${c.tc}`}>₹{c.value.toLocaleString('en-IN', {minimumFractionDigits:0})}</p></div>)}</div>);
}

function LineItemRow({ item, onCancel, locked }: { item: BillingLineItem; onCancel: (id: string) => void; locked: boolean }) {
  const Icon = getDeptIcon(item.service_category);
  return (<tr className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 ${item.covered_by_package ? 'opacity-60' : ''}`}>
    <td className="px-3 py-2.5"><span className="text-xs text-gray-400 font-mono">{new Date(item.service_date).toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}</span></td>
    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" /><div><p className="text-sm font-medium text-gray-900">{item.service_name}</p><p className="text-[10px] text-gray-500">{item.service_code} - {SERVICE_CATEGORY_LABELS[item.service_category] || item.service_category}{item.service_doctor_name && ` - Dr. ${item.service_doctor_name}`}</p></div></div></td>
    <td className="px-3 py-2.5 text-center"><span className="text-xs text-gray-600">{item.department}</span></td>
    <td className="px-3 py-2.5 text-right"><span className="text-xs text-gray-600 font-mono">{item.quantity}</span></td>
    <td className="px-3 py-2.5 text-right"><span className="text-xs text-gray-600 font-mono">₹{item.unit_rate.toLocaleString('en-IN')}</span></td>
    <td className="px-3 py-2.5 text-right">{item.discount_amount > 0 && <span className="text-xs text-orange-600 font-mono">-₹{item.discount_amount.toLocaleString('en-IN')}</span>}</td>
    <td className="px-3 py-2.5 text-right"><span className={`text-sm font-semibold font-mono ${item.covered_by_package ? 'line-through text-gray-400' : 'text-gray-900'}`}>₹{item.net_amount.toLocaleString('en-IN')}</span>{item.covered_by_package && <p className="text-[9px] text-blue-600 font-medium">PKG COVERED</p>}</td>
    <td className="px-3 py-2.5 text-right">{!locked && item.status === 'ACTIVE' && <button onClick={() => onCancel(item.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}</td>
  </tr>);
}

function PaymentRow({ payment }: { payment: BillingPayment }) {
  return (<tr className="border-b border-gray-50 last:border-0">
    <td className="px-3 py-2.5"><span className="text-xs text-gray-400 font-mono">{new Date(payment.payment_date).toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}</span></td>
    <td className="px-3 py-2.5"><span className="text-xs font-mono text-gray-600">{payment.receipt_number}</span></td>
    <td className="px-3 py-2.5"><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${payment.payment_mode === 'CASH' ? 'bg-green-50 text-green-700' : payment.payment_mode === 'CARD' ? 'bg-blue-50 text-blue-700' : payment.payment_mode === 'UPI' ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-700'}`}>{PAYMENT_MODE_LABELS[payment.payment_mode] || payment.payment_mode}</span></td>
    <td className="px-3 py-2.5"><span className="text-xs text-gray-500">{payment.payment_reference || '—'}</span></td>
    <td className="px-3 py-2.5 text-right"><span className={`text-sm font-bold font-mono ${payment.payment_type === 'REFUND' ? 'text-red-600' : 'text-emerald-700'}`}>{payment.payment_type === 'REFUND' ? '-' : '+'}₹{payment.amount.toLocaleString('en-IN')}</span>{payment.is_advance && <p className="text-[9px] text-amber-600 font-medium">ADVANCE</p>}</td>
  </tr>);
}

function AddChargeModal({ isOpen, onClose, onAdd, centreId }: { isOpen: boolean; onClose: () => void; onAdd: (data: any) => void; centreId: string }) {
  const [searchTerm, setSearchTerm] = useState(''); const [services, setServices] = useState<any[]>([]); const [selectedService, setSelectedService] = useState<any>(null); const [quantity, setQuantity] = useState(1); const [unitRate, setUnitRate] = useState(0); const [searching, setSearching] = useState(false);
  const handleSearch = useCallback(async (term: string) => { if (term.length < 2) { setServices([]); return; } setSearching(true); try { const res = await fetch(`/api/billing/services/search?centre_id=${centreId}&q=${term}`); if (res.ok) setServices(await res.json()); } catch {} setSearching(false); }, [centreId]);
  useEffect(() => { const d = setTimeout(() => handleSearch(searchTerm), 300); return () => clearTimeout(d); }, [searchTerm, handleSearch]);
  const handleSelect = (svc: any) => { setSelectedService(svc); setUnitRate(svc.effective_rate || svc.base_rate); setServices([]); setSearchTerm(svc.service_name); };
  const handleSubmit = () => { if (!selectedService) return; onAdd({ service_master_id: selectedService.id, quantity, unit_rate: unitRate }); onClose(); setSelectedService(null); setSearchTerm(''); setQuantity(1); setUnitRate(0); };
  if (!isOpen) return null;
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"><div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-semibold text-gray-900">Add Charge</h3><button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
    <div className="p-5 space-y-4">
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Service</label><div className="relative"><input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setSelectedService(null); }} placeholder="Search by service name or code..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" autoFocus />{services.length > 0 && <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg">{services.map((svc: any) => <button key={svc.id} onClick={() => handleSelect(svc)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0"><p className="text-sm font-medium text-gray-900">{svc.service_name}</p><p className="text-xs text-gray-500">{svc.service_code} - {svc.department} - ₹{svc.effective_rate || svc.base_rate}</p></button>)}</div>}</div></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label><input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Unit Rate</label><input type="number" min={0} step={0.01} value={unitRate} onChange={(e) => setUnitRate(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" /></div></div>
      {selectedService && <div className="rounded-lg bg-gray-50 p-3 flex items-center justify-between"><span className="text-sm text-gray-600">Total</span><span className="text-lg font-bold font-mono text-gray-900">₹{(quantity * unitRate).toLocaleString('en-IN')}</span></div>}
    </div>
    <div className="border-t px-5 py-3 flex items-center justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={handleSubmit} disabled={!selectedService} className="rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2540]/90 disabled:opacity-40">Add Charge</button></div>
  </div></div>);
}

function RecordPaymentModal({ isOpen, onClose, onSubmit, balanceDue }: { isOpen: boolean; onClose: () => void; onSubmit: (data: any) => void; balanceDue: number }) {
  const [amount, setAmount] = useState(balanceDue); const [mode, setMode] = useState<string>('CASH'); const [reference, setReference] = useState(''); const [isAdvance, setIsAdvance] = useState(false);
  useEffect(() => setAmount(balanceDue), [balanceDue]);
  if (!isOpen) return null;
  const modes = [{value:'CASH',label:'Cash'},{value:'CARD',label:'Card'},{value:'UPI',label:'UPI'},{value:'NEFT',label:'NEFT'},{value:'CHEQUE',label:'Cheque'},{value:'ONLINE',label:'Online'}];
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"><div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-semibold text-gray-900">Record Payment</h3><button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
    <div className="p-5 space-y-4">
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Amount</label><input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" autoFocus /><p className="text-xs text-gray-500 mt-1">Balance due: ₹{balanceDue.toLocaleString('en-IN')}</p></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Payment Mode</label><div className="grid grid-cols-3 gap-2">{modes.map(m => <button key={m.value} onClick={() => setMode(m.value)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === m.value ? 'border-[#00B4D8] bg-[#00B4D8]/10 text-[#00B4D8]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{m.label}</button>)}</div></div>
      {mode !== 'CASH' && <div><label className="block text-xs font-medium text-gray-600 mb-1">{mode === 'CARD' ? 'Card Last 4 / Ref' : mode === 'UPI' ? 'UPI Transaction ID' : 'Reference'}</label><input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30" /></div>}
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isAdvance} onChange={(e) => setIsAdvance(e.target.checked)} className="rounded border-gray-300 text-[#00B4D8]" /><span className="text-sm text-gray-600">This is an advance/deposit payment</span></label>
    </div>
    <div className="border-t px-5 py-3 flex items-center justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={() => { onSubmit({ amount, payment_mode: mode, payment_reference: reference, is_advance: isAdvance }); onClose(); }} disabled={amount <= 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"><IndianRupee className="h-3.5 w-3.5 inline mr-1" />Collect ₹{amount.toLocaleString('en-IN')}</button></div>
  </div></div>);
}

export default function EncounterDetailPage() {
  const params = useParams(); const router = useRouter(); const encounterId = params.encounterId as string;
  const [encounter, setEncounter] = useState<BillingEncounter | null>(null); const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'all' | 'by_dept' | 'by_date' | 'payments'>('all');
  const [showAddCharge, setShowAddCharge] = useState(false); const [showPayment, setShowPayment] = useState(false);

  const loadEncounter = useCallback(async () => { try { setLoading(true); const res = await fetch(`/api/billing/encounters/${encounterId}`); if (res.ok) setEncounter(await res.json()); } catch (err) { console.error('Failed:', err); } finally { setLoading(false); } }, [encounterId]);
  useEffect(() => { loadEncounter(); }, [loadEncounter]);

  const handleAddCharge = async (data: any) => { try { await fetch(`/api/billing/encounters/${encounterId}/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); await loadEncounter(); } catch {} };
  const handleCancelItem = async (lineItemId: string) => { const reason = prompt('Reason for cancellation:'); if (!reason) return; try { await fetch(`/api/billing/line-items/${lineItemId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }); await loadEncounter(); } catch {} };
  const handlePayment = async (data: any) => { try { await fetch(`/api/billing/encounters/${encounterId}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); await loadEncounter(); } catch {} };
  const handleGenerateInvoice = async (type: string) => { try { await fetch(`/api/billing/encounters/${encounterId}/invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_type: type }) }); await loadEncounter(); } catch {} };

  const lineItemsByDept = useMemo(() => { if (!encounter?.line_items) return {}; return encounter.line_items.reduce((acc: Record<string, BillingLineItem[]>, item) => { const dept = item.department; if (!acc[dept]) acc[dept] = []; acc[dept].push(item); return acc; }, {}); }, [encounter?.line_items]);

  if (loading) return (<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><div className="flex items-center gap-3 text-gray-500"><RefreshCw className="h-5 w-5 animate-spin" /><span>Loading encounter...</span></div></div>);
  if (!encounter) return (<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><p className="text-gray-500">Encounter not found</p></div>);

  const isIPD = ['IPD','ER','DAYCARE'].includes(encounter.encounter_type);
  const isInsured = encounter.primary_payor_type !== 'SELF_PAY';
  const statusColor = ENCOUNTER_STATUS_COLORS[encounter.status];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={() => router.push('/billing')} className="rounded-lg p-1.5 hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-600" /></button><div><div className="flex items-center gap-2"><h1 className="text-lg font-bold text-[#0A2540]">{encounter.patient_name || 'Patient'}</h1><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{encounter.status.replace(/_/g, ' ')}</span>{encounter.billing_locked && <Lock className="h-3.5 w-3.5 text-red-500" />}</div><p className="text-xs text-gray-500 mt-0.5">{encounter.encounter_number} - {encounter.patient_uhid} - {encounter.encounter_type} - {PAYOR_TYPE_LABELS[encounter.primary_payor_type]}{isIPD && encounter.admission_date && <> - Day {Math.ceil((Date.now() - new Date(encounter.admission_date).getTime()) / 86400000)}</>}</p></div></div>
        <div className="flex items-center gap-2">
          {!encounter.billing_locked && <><button onClick={() => setShowAddCharge(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Plus className="h-4 w-4" /> Add Charge</button><button onClick={() => setShowPayment(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"><IndianRupee className="h-4 w-4" /> Record Payment</button></>}
          <button onClick={() => handleGenerateInvoice(isIPD ? 'IPD_INTERIM' : 'OPD')} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2540] px-3 py-2 text-sm font-medium text-white hover:bg-[#0A2540]/90"><Printer className="h-4 w-4" /> {isIPD ? 'Interim Bill' : 'Generate Bill'}</button>
        </div>
      </div></div>

      <div className="px-6 py-5 space-y-5">
        {isInsured && encounter.pre_auth && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between"><div className="flex items-center gap-3"><Shield className="h-5 w-5 text-blue-600" /><div><p className="text-sm font-semibold text-blue-900">{PAYOR_TYPE_LABELS[encounter.primary_payor_type]} - {encounter.insurance_company?.company_name || 'Insurance'}</p><p className="text-xs text-blue-700">Pre-Auth: {encounter.pre_auth.status} - Approved: ₹{(encounter.insurance_approved_amount || 0).toLocaleString('en-IN')}</p></div></div><button onClick={() => router.push(`/billing/insurance/${encounter.pre_auth?.id}`)} className="text-xs font-medium text-blue-700 hover:text-blue-900">View Details →</button></div>}

        <FinancialSummary encounter={encounter} />

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 border-b border-gray-100"><nav className="flex gap-1 -mb-px">{[{id:'all',label:`All Charges (${encounter.line_items?.length || 0})`},{id:'by_dept',label:'By Department'},{id:'by_date',label:'By Date'},{id:'payments',label:`Payments (${encounter.payments?.length || 0})`}].map(tab => <button key={tab.id} onClick={() => setActiveView(tab.id as any)} className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeView === tab.id ? 'border-[#00B4D8] text-[#00B4D8]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>)}</nav></div>

          <div className="overflow-x-auto">
            {activeView === 'payments' ? (
              <table className="w-full"><thead><tr className="bg-gray-50/80"><th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Date</th><th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Receipt #</th><th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Mode</th><th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Reference</th><th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Amount</th></tr></thead><tbody>{(encounter.payments || []).map(p => <PaymentRow key={p.id} payment={p} />)}{(!encounter.payments || encounter.payments.length === 0) && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No payments recorded yet</td></tr>}</tbody></table>
            ) : activeView === 'by_dept' ? (
              <div>{Object.entries(lineItemsByDept).map(([dept, items]) => { const deptTotal = (items as any[]).reduce((sum: number, i: any) => sum + i.net_amount, 0); return (<div key={dept} className="border-b border-gray-100 last:border-0"><div className="px-4 py-2.5 bg-gray-50/80 flex items-center justify-between"><span className="text-xs font-bold text-gray-600 uppercase">{dept}</span><span className="text-xs font-bold font-mono text-gray-900">₹{deptTotal.toLocaleString('en-IN')}</span></div><table className="w-full"><tbody>{(items as any[]).map((item: any) => <LineItemRow key={item.id} item={item} onCancel={handleCancelItem} locked={encounter.billing_locked} />)}</tbody></table></div>); })}</div>
            ) : (
              <table className="w-full"><thead><tr className="bg-gray-50/80"><th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase w-16">Date</th><th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Service</th><th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-20">Dept</th><th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase w-12">Qty</th><th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase w-20">Rate</th><th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase w-20">Disc</th><th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase w-24">Net</th><th className="px-3 py-2 w-10"></th></tr></thead>
              <tbody>{(encounter.line_items || []).map(item => <LineItemRow key={item.id} item={item} onCancel={handleCancelItem} locked={encounter.billing_locked} />)}{(!encounter.line_items || encounter.line_items.length === 0) && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No charges yet. Click Add Charge to begin.</td></tr>}</tbody>
              {(encounter.line_items?.length || 0) > 0 && <tfoot><tr className="bg-gray-50 border-t-2 border-gray-200"><td colSpan={6} className="px-3 py-3 text-right text-sm font-bold text-gray-700">Total</td><td className="px-3 py-3 text-right text-base font-bold font-mono text-gray-900">₹{encounter.net_amount.toLocaleString('en-IN')}</td><td></td></tr></tfoot>}
              </table>
            )}
          </div>
        </div>

        {isIPD && !encounter.billing_locked && <div className="flex items-center gap-3 justify-end"><button onClick={() => handleGenerateInvoice('IPD_FINAL')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"><Lock className="h-4 w-4" /> Final Bill & Discharge</button></div>}
      </div>

      <AddChargeModal isOpen={showAddCharge} onClose={() => setShowAddCharge(false)} onAdd={handleAddCharge} centreId={encounter.centre_id} />
      <RecordPaymentModal isOpen={showPayment} onClose={() => setShowPayment(false)} onSubmit={handlePayment} balanceDue={encounter.balance_due} />
    </div>
  );
}
