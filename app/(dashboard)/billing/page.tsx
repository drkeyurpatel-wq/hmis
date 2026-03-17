'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useBillsV2, useTariffs, useEstimates, usePackages } from '@/lib/billing/billing-hooks';
import { useCashlessWorkflow, useCorporateBilling, useAccountsReceivable, useSettlements, useGovtSchemes, useLoyalty, useIntegrationBridge } from '@/lib/billing/revenue-cycle-hooks';
import { createClient } from '@/lib/supabase/client';
import BillDetail from '@/components/billing/bill-detail';
import RevenueDashboard from '@/components/billing/revenue-dashboard';
import EstimateGenerator from '@/components/billing/estimate-generator';
import DayEndSettlement from '@/components/billing/day-end-settlement';
import CashlessWorkflow from '@/components/billing/cashless-workflow';
import ARDashboard from '@/components/billing/ar-dashboard';
import { CorporatePanel, LoyaltyPanel, IntegrationPanel } from '@/components/billing/corporate-loyalty-integrations';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'dashboard' | 'bills' | 'cashless' | 'corporate' | 'ipd_billing' | 'ar' | 'estimates' | 'advances' | 'settlements' | 'govt' | 'loyalty' | 'tariffs' | 'day_end' | 'integrations';

function BillingInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const billing = useBillsV2(centreId);
  const tariffs = useTariffs(centreId);
  const estimates = useEstimates(centreId);
  const packages = usePackages(centreId);
  const cashless = useCashlessWorkflow(centreId);
  const corporates = useCorporateBilling(centreId);
  const ar = useAccountsReceivable(centreId);
  const settlements = useSettlements(centreId);
  const govtSchemes = useGovtSchemes(centreId);
  const loyalty = useLoyalty(centreId);
  const integrations = useIntegrationBridge(centreId);

  const [tab, setTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState('');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [showNewBill, setShowNewBill] = useState(false);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const selectedBill = billing.bills.find(b => b.id === selectedBillId);

  // Filters
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [payorFilter, setPayorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // New bill
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [newBill, setNewBill] = useState<any>({ patientId: '', billType: 'opd', payorType: 'self', items: [] as any[] });
  const [tariffQ, setTariffQ] = useState('');

  // Advance form
  const [advForm, setAdvForm] = useState({ patientSearch: '', patientId: '', amount: '', mode: 'cash', admissionId: '' });
  const [advPatResults, setAdvPatResults] = useState<any[]>([]);

  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  useEffect(() => {
    if (advForm.patientSearch.length < 2 || !sb()) { setAdvPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name')
        .or(`uhid.ilike.%${advForm.patientSearch}%,first_name.ilike.%${advForm.patientSearch}%`).limit(5);
      setAdvPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [advForm.patientSearch]);

  const tariffResults = useMemo(() => tariffQ.length >= 2 ? tariffs.search(tariffQ).slice(0, 8) : [], [tariffQ, tariffs]);
  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const stColor = (s: string) => s === 'paid' ? 'bg-green-100 text-green-700' : s === 'partially_paid' ? 'bg-yellow-100 text-yellow-700' : s === 'final' ? 'bg-blue-100 text-blue-700' : s === 'draft' ? 'bg-gray-100 text-gray-600' : s === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100';
  const payorColor = (p: string) => p === 'self' ? 'bg-gray-100 text-gray-700' : p === 'insurance' ? 'bg-blue-100 text-blue-700' : p.startsWith('govt') ? 'bg-green-100 text-green-700' : p === 'corporate' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100';
  const catColor = (c: string) => ({ consultation:'text-blue-600', room_rent:'text-green-600', ot_charges:'text-purple-600', professional_fee:'text-orange-600', procedure:'text-red-600', consumable:'text-yellow-700', icu_charges:'text-pink-600', nursing:'text-teal-600' })[c] || 'text-gray-600';

  const addTariffToNewBill = (t: any) => {
    const rate = tariffs.getRate(t.id, newBill.payorType);
    setNewBill((b: any) => ({ ...b, items: [...b.items, { tariffId: t.id, description: t.service_name, quantity: 1, unitRate: rate, category: t.category }] }));
    setTariffQ('');
  };

  const reloadBills = () => billing.load({ dateFrom, dateTo, status: statusFilter, payorType: payorFilter, billType: typeFilter });

  const tabs: [Tab, string, string][] = [
    ['dashboard','Dashboard','📊'],['bills','Bills','📄'],['cashless','Cashless/TPA','🏥'],['corporate','Corporate','🏢'],
    ['ipd_billing','IPD Running','🛏️'],['ar','Receivables','📉'],['estimates','Estimates','📋'],
    ['advances','Advances','💰'],['settlements','Settlements','🤝'],['govt','Govt Schemes','🇮🇳'],
    ['loyalty','Loyalty','💳'],['tariffs','Tariff Master','📑'],['day_end','Day End','🔒'],['integrations','Integrations','🔗']
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Billing & Revenue</h1><p className="text-sm text-gray-500">Health1 Super Speciality — Multi-centre Billing</p></div>
        <button onClick={() => { setShowNewBill(true); setTab('bills'); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">+ New Bill</button>
      </div>

      <div className="flex gap-1 mb-4 border-b pb-px overflow-x-auto">
        {tabs.map(([k, l, icon]) => <button key={k} onClick={() => { setTab(k); if (k !== 'bills') { setShowNewBill(false); setSelectedBillId(null); } }}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{icon} {l}</button>)}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && <RevenueDashboard bills={billing.bills} />}

      {/* ===== BILLS ===== */}
      {tab === 'bills' && <div>
        {/* Selected bill detail */}
        {selectedBillId && selectedBill && <BillDetail bill={selectedBill} staffId={staffId} centreId={centreId} tariffs={tariffs} onUpdate={reloadBills} onClose={() => setSelectedBillId(null)} onFlash={flash} />}

        {/* New bill creator */}
        {showNewBill && !selectedBillId && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <div className="flex justify-between items-center"><h3 className="font-semibold text-sm">Create New Bill</h3><button onClick={() => setShowNewBill(false)} className="text-xs text-gray-500">✕ Cancel</button></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="relative"><label className="text-xs text-gray-500">Patient *</label>
              {newBill.patientId ? <div className="bg-blue-50 rounded-lg p-2 flex justify-between"><span className="text-sm font-medium">{patResults.find(p => p.id === newBill.patientId)?.first_name || 'Selected'}</span><button onClick={() => setNewBill((b: any) => ({...b, patientId: ''}))} className="text-xs text-red-500">Change</button></div> :
              <><input type="text" value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="UHID / name / phone" />
              {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10">{patResults.map(p => (
                <button key={p.id} onClick={() => { setNewBill((b: any) => ({...b, patientId: p.id})); }} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b">{p.first_name} {p.last_name} — {p.uhid}</button>
              ))}</div>}</>}</div>
            <div><label className="text-xs text-gray-500">Bill type *</label>
              <div className="flex gap-1 mt-1">{['opd','ipd','pharmacy','lab','radiology','package'].map(t => (
                <button key={t} onClick={() => setNewBill((b: any) => ({...b, billType: t}))} className={`flex-1 py-1.5 rounded text-[10px] border ${newBill.billType === t ? 'bg-blue-600 text-white' : 'bg-white'}`}>{t.toUpperCase()}</button>
              ))}</div></div>
            <div><label className="text-xs text-gray-500">Payor *</label>
              <div className="flex flex-wrap gap-1 mt-1">{['self','insurance','corporate','govt_pmjay','govt_cghs'].map(p => (
                <button key={p} onClick={() => setNewBill((b: any) => ({...b, payorType: p}))} className={`px-2 py-1 rounded text-[10px] border ${newBill.payorType === p ? 'bg-blue-600 text-white' : 'bg-white'}`}>{p.replace('govt_','').replace('_',' ').toUpperCase()}</button>
              ))}</div></div>
          </div>
          <div className="relative"><label className="text-xs text-gray-500">Add items from tariff</label>
            <input type="text" value={tariffQ} onChange={e => setTariffQ(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search service name or code..." />
            {tariffResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10 max-h-48 overflow-y-auto">{tariffResults.map((t: any) => (
              <button key={t.id} onClick={() => addTariffToNewBill(t)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b flex justify-between text-xs">
                <div><span className="font-medium">{t.service_name}</span><span className={`ml-1 text-[10px] ${catColor(t.category)}`}>({t.category.replace('_',' ')})</span></div>
                <span className="font-bold text-blue-600">₹{fmt(tariffs.getRate(t.id, newBill.payorType))}</span>
              </button>
            ))}</div>}</div>
          {newBill.items.length > 0 && <div className="border rounded-lg overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b"><th className="p-2 text-left">Item</th><th className="p-2 text-center">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th><th className="p-2"></th></tr></thead><tbody>{newBill.items.map((item: any, i: number) => (
            <tr key={i} className="border-b">
              <td className="p-2 font-medium">{item.description} <span className={`text-[10px] ${catColor(item.category)}`}>({item.category?.replace('_',' ')})</span></td>
              <td className="p-2 text-center"><input type="number" value={item.quantity} onChange={e => { const items = [...newBill.items]; items[i].quantity = parseInt(e.target.value)||1; setNewBill((b: any) => ({...b, items})); }} className="w-12 text-center border rounded" min="1" /></td>
              <td className="p-2 text-right"><input type="number" value={item.unitRate} onChange={e => { const items = [...newBill.items]; items[i].unitRate = parseFloat(e.target.value)||0; setNewBill((b: any) => ({...b, items})); }} className="w-20 text-right border rounded" /></td>
              <td className="p-2 text-right font-bold">₹{fmt(item.quantity * item.unitRate)}</td>
              <td className="p-2"><button onClick={() => setNewBill((b: any) => ({...b, items: b.items.filter((_: any, j: number) => j !== i)}))} className="text-red-500">✕</button></td>
            </tr>
          ))}</tbody><tfoot><tr className="bg-blue-50"><td colSpan={3} className="p-2 text-right font-bold">Total</td><td className="p-2 text-right font-bold text-lg text-blue-700">₹{fmt(newBill.items.reduce((s: number, i: any) => s + i.quantity * i.unitRate, 0))}</td><td></td></tr></tfoot></table></div>}
          <button onClick={async () => { if (!newBill.patientId || !newBill.items.length) return; const b = await billing.createBill(newBill, staffId); if (b) { flash('Bill created: ' + b.bill_number); setShowNewBill(false); setNewBill({ patientId:'', billType:'opd', payorType:'self', items:[] }); setSelectedBillId(b.id); } }} disabled={!newBill.patientId || !newBill.items.length}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Create Bill</button>
        </div>}

        {/* Filters */}
        {!selectedBillId && !showNewBill && <div className="flex gap-2 mb-3 flex-wrap items-center">
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); billing.load({ dateFrom: e.target.value, dateTo }); }} className="px-2 py-1.5 border rounded-lg text-xs" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); billing.load({ dateFrom, dateTo: e.target.value }); }} className="px-2 py-1.5 border rounded-lg text-xs" />
          {[['Status', statusFilter, setStatusFilter, ['all','draft','final','partially_paid','paid','cancelled']], ['Payor', payorFilter, setPayorFilter, ['all','self','insurance','corporate','govt_pmjay','govt_cghs']], ['Type', typeFilter, setTypeFilter, ['all','opd','ipd','pharmacy','lab','radiology','package']]].map(([label, val, setter, opts]: any) => (
            <select key={label} value={val} onChange={e => { setter(e.target.value); billing.load({ dateFrom, dateTo, status: label === 'Status' ? e.target.value : statusFilter, payorType: label === 'Payor' ? e.target.value : payorFilter, billType: label === 'Type' ? e.target.value : typeFilter }); }} className="px-2 py-1.5 border rounded-lg text-xs">
              {opts.map((o: string) => <option key={o} value={o}>{o === 'all' ? `All ${label}` : o.replace('govt_','').replace('_',' ').toUpperCase()}</option>)}
            </select>
          ))}
          <span className="text-xs text-gray-400 ml-auto">{billing.bills.length} bills</span>
          <button onClick={() => setShowNewBill(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">+ New Bill</button>
        </div>}

        {/* Bills table */}
        {!selectedBillId && !showNewBill && <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Bill #</th><th className="p-2 text-left">Patient</th><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Payor</th><th className="p-2 text-right">Gross</th><th className="p-2 text-right">Disc</th><th className="p-2 text-right">Net</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Bal</th><th className="p-2">Status</th>
        </tr></thead><tbody>{billing.bills.map(b => (
          <tr key={b.id} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedBillId(b.id)}>
            <td className="p-2 font-mono text-[10px]">{b.bill_number}</td>
            <td className="p-2"><span className="font-medium">{b.patient?.first_name} {b.patient?.last_name}</span> <span className="text-[10px] text-gray-400">{b.patient?.uhid}</span></td>
            <td className="p-2 text-center text-gray-500">{b.bill_date}</td>
            <td className="p-2 text-center"><span className="bg-gray-100 px-1 py-0.5 rounded text-[9px]">{b.bill_type}</span></td>
            <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${payorColor(b.payor_type)}`}>{b.payor_type?.replace('govt_','').replace('_',' ')}</span></td>
            <td className="p-2 text-right">₹{fmt(b.gross_amount)}</td>
            <td className="p-2 text-right text-orange-600">{parseFloat(b.discount_amount) > 0 ? `₹${fmt(b.discount_amount)}` : '—'}</td>
            <td className="p-2 text-right font-medium">₹{fmt(b.net_amount)}</td>
            <td className="p-2 text-right text-green-600">{parseFloat(b.paid_amount) > 0 ? `₹${fmt(b.paid_amount)}` : '—'}</td>
            <td className="p-2 text-right text-red-600 font-medium">{parseFloat(b.balance_amount) > 0 ? `₹${fmt(b.balance_amount)}` : '—'}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${stColor(b.status)}`}>{b.status?.replace('_',' ')}</span></td>
          </tr>
        ))}</tbody></table></div>}
      </div>}

      {/* ===== IPD RUNNING ===== */}
      {tab === 'ipd_billing' && <div>
        <h2 className="font-semibold text-sm mb-3">IPD Running Bills — Active Admissions</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[['Active IPD Bills', billing.bills.filter(b => b.bill_type === 'ipd' && b.status !== 'cancelled' && b.status !== 'paid').length, 'text-blue-700'],
            ['Total IPD Revenue', billing.bills.filter(b => b.bill_type === 'ipd').reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0), 'text-green-700'],
            ['IPD Outstanding', billing.bills.filter(b => b.bill_type === 'ipd' && parseFloat(b.balance_amount) > 0).reduce((s: number, b: any) => s + parseFloat(b.balance_amount || 0), 0), 'text-red-700'],
          ].map(([label, val, cls], i) => (
            <div key={i} className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">{label as string}</div><div className={`text-xl font-bold ${cls}`}>{typeof val === 'number' && val > 999 ? `₹${fmt(val)}` : val}</div></div>
          ))}
        </div>
        {billing.bills.filter(b => b.bill_type === 'ipd' && b.status !== 'cancelled' && b.status !== 'paid').length === 0
          ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No active IPD bills</div>
          : <div className="space-y-2">{billing.bills.filter(b => b.bill_type === 'ipd' && b.status !== 'cancelled' && b.status !== 'paid').map(b => (
            <div key={b.id} onClick={() => { setSelectedBillId(b.id); setTab('bills'); }} className="bg-white rounded-xl border p-4 hover:border-blue-300 cursor-pointer flex items-center justify-between">
              <div><span className="font-medium">{b.patient?.first_name} {b.patient?.last_name}</span><span className="ml-2 text-xs text-gray-400 font-mono">{b.bill_number}</span>
                <div className="flex gap-2 mt-1"><span className={`px-1.5 py-0.5 rounded text-[10px] ${payorColor(b.payor_type)}`}>{b.payor_type?.replace('_',' ')}</span><span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(b.status)}`}>{b.status?.replace('_',' ')}</span></div></div>
              <div className="text-right"><div className="font-bold text-lg">₹{fmt(b.net_amount)}</div><div className="text-xs text-green-600">Paid: ₹{fmt(b.paid_amount)}</div>{parseFloat(b.balance_amount) > 0 && <div className="text-xs text-red-600 font-bold">Due: ₹{fmt(b.balance_amount)}</div>}</div>
            </div>
          ))}</div>}
      </div>}

      {/* ===== ESTIMATES ===== */}
      {tab === 'estimates' && <EstimateGenerator estimates={estimates.estimates} centreId={centreId} staffId={staffId} tariffs={tariffs} onCreate={estimates.create} onFlash={flash} />}

      {/* ===== ADVANCES ===== */}
      {tab === 'advances' && <div>
        <h2 className="font-semibold text-sm mb-3">Advance Deposits</h2>
        <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <h3 className="text-sm font-medium">Collect New Advance</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="relative"><label className="text-xs text-gray-500">Patient *</label>
              <input type="text" value={advForm.patientSearch} onChange={e => setAdvForm(f => ({...f, patientSearch: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search..." />
              {advPatResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10">{advPatResults.map(p => (
                <button key={p.id} onClick={() => { setAdvForm(f => ({...f, patientId: p.id, patientSearch: p.first_name+' '+p.last_name})); setAdvPatResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b">{p.first_name} {p.last_name} — {p.uhid}</button>
              ))}</div>}</div>
            <div><label className="text-xs text-gray-500">Amount *</label>
              <input type="number" value={advForm.amount} onChange={e => setAdvForm(f => ({...f, amount: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="₹" /></div>
            <div><label className="text-xs text-gray-500">Mode</label>
              <div className="flex gap-1 mt-1">{['cash','upi','card','neft'].map(m => (
                <button key={m} onClick={() => setAdvForm(f => ({...f, mode: m}))} className={`flex-1 py-1.5 rounded text-[10px] border ${advForm.mode === m ? 'bg-green-600 text-white' : 'bg-white'}`}>{m.toUpperCase()}</button>
              ))}</div></div>
            <div className="flex items-end"><button onClick={async () => {
              if (!advForm.patientId || !advForm.amount || !sb()) return;
              await sb().from('hmis_advances').insert({ patient_id: advForm.patientId, amount: parseFloat(advForm.amount), payment_mode: advForm.mode, receipt_number: `ADV-${Date.now()}` });
              flash('Advance collected: ₹' + advForm.amount);
              setAdvForm({ patientSearch:'', patientId:'', amount:'', mode:'cash', admissionId:'' });
            }} disabled={!advForm.patientId || !advForm.amount} className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-40">Collect Advance</button></div>
          </div>
        </div>
      </div>}

      {/* ===== TARIFF MASTER ===== */}
      {tab === 'tariffs' && <div>
        <h2 className="font-semibold text-sm mb-2">Tariff Master — {tariffs.tariffs.length} Services</h2>
        <div className="flex gap-1.5 flex-wrap mb-3">{tariffs.categories.map(c => <span key={c} className={`px-2 py-0.5 rounded text-[10px] bg-gray-100 ${catColor(c)} font-medium`}>{c.replace('_',' ')} ({tariffs.tariffs.filter(t => t.category === c).length})</span>)}</div>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Code</th><th className="p-2 text-left">Service</th><th className="p-2">Category</th><th className="p-2 text-right">Self Pay</th><th className="p-2 text-right">Insurance</th><th className="p-2 text-right">PMJAY</th><th className="p-2 text-right">CGHS</th>
        </tr></thead><tbody>{tariffs.tariffs.map((t: any) => (
          <tr key={t.id} className="border-b hover:bg-gray-50">
            <td className="p-2 font-mono text-[10px] text-gray-400">{t.service_code}</td>
            <td className="p-2 font-medium">{t.service_name}</td>
            <td className="p-2 text-center"><span className={`text-[10px] ${catColor(t.category)}`}>{t.category.replace('_',' ')}</span></td>
            <td className="p-2 text-right font-medium">₹{fmt(t.rate_self)}</td>
            <td className="p-2 text-right text-blue-600">{t.rate_insurance ? `₹${fmt(t.rate_insurance)}` : '—'}</td>
            <td className="p-2 text-right text-green-600">{t.rate_pmjay ? `₹${fmt(t.rate_pmjay)}` : '—'}</td>
            <td className="p-2 text-right text-teal-600">{t.rate_cghs ? `₹${fmt(t.rate_cghs)}` : '—'}</td>
          </tr>
        ))}</tbody></table></div>
      </div>}

      {/* ===== DAY END ===== */}
      {tab === 'day_end' && <DayEndSettlement bills={billing.bills} />}

      {/* ===== CASHLESS / TPA ===== */}
      {tab === 'cashless' && <CashlessWorkflow preAuths={cashless.preAuths} claims={cashless.claims} stats={cashless.stats} loading={cashless.loading} onUpdatePreAuth={cashless.updatePreAuth} onUpdateClaim={cashless.updateClaim} onFlash={flash} />}

      {/* ===== CORPORATE ===== */}
      {tab === 'corporate' && <CorporatePanel corporates={corporates.corporates} onFlash={flash} />}

      {/* ===== ACCOUNTS RECEIVABLE ===== */}
      {tab === 'ar' && <ARDashboard entries={ar.entries} stats={ar.stats} loading={ar.loading} onFollowup={ar.addFollowup} onWriteOff={ar.writeOff} staffId={staffId} onFlash={flash} />}

      {/* ===== SETTLEMENTS ===== */}
      {tab === 'settlements' && <div>
        <h2 className="font-semibold text-sm mb-3">Settlement & Reconciliation</h2>
        {settlements.settlements.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No settlements recorded. Settlements are created when insurance/TPA/corporate payments are received.</div> :
        <div className="space-y-2">{settlements.settlements.map(s => (
          <div key={s.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">{s.settlement_type}</span>
                <span className="font-medium">{s.insurer?.name || s.tpa?.name || s.corporate?.company_name || '—'}</span>
                <span className="font-mono text-xs text-gray-400">{s.settlement_number}</span>
                {s.reconciled && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px]">Reconciled ✓</span>}
              </div>
              <div className="text-right text-xs">
                <div>Claimed: ₹{fmt(s.claimed_amount)} | Settled: <b className="text-green-700">₹{fmt(s.settled_amount)}</b></div>
                {parseFloat(s.tds_amount || 0) > 0 && <div className="text-gray-500">TDS: ₹{fmt(s.tds_amount)} | Disallowed: ₹{fmt(s.disallowance_amount)}</div>}
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span>Date: {s.settlement_date}</span>
              {s.utr_number && <span className="font-mono">UTR: {s.utr_number}</span>}
              <span>{s.total_claims} claims</span>
              <span>Net received: <b className="text-green-700">₹{fmt(s.net_received)}</b></span>
            </div>
            {!s.reconciled && <button onClick={() => settlements.reconcile(s.id, staffId)} className="mt-2 px-3 py-1 bg-green-50 text-green-700 text-[10px] rounded">Mark Reconciled</button>}
          </div>
        ))}</div>}
      </div>}

      {/* ===== GOVT SCHEMES ===== */}
      {tab === 'govt' && <div>
        <h2 className="font-semibold text-sm mb-3">Government Scheme Empanelments</h2>
        {govtSchemes.schemes.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No government schemes configured. Run sql/revenue_cycle_migration.sql to seed scheme data.</div> :
        <div className="grid grid-cols-2 gap-3">{govtSchemes.schemes.map(s => (
          <div key={s.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div><div className="font-semibold">{s.scheme_name}</div><div className="text-[10px] text-gray-400">{s.scheme_code.toUpperCase()}</div></div>
              <span className={`px-2 py-0.5 rounded text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              {s.empanelment_number && <div><b>Empanelment #:</b> {s.empanelment_number}</div>}
              {s.empanelment_valid_to && <div><b>Valid until:</b> {s.empanelment_valid_to}</div>}
              {s.nodal_officer && <div><b>Nodal officer:</b> {s.nodal_officer}</div>}
              {s.submission_portal && <div><b>Portal:</b> {s.submission_portal.replace('_',' ')}</div>}
              <div><b>Claim window:</b> {s.max_claim_days} days</div>
              {s.portal_url && <div><a href={s.portal_url} target="_blank" className="text-blue-600 underline text-[10px]">Open portal →</a></div>}
            </div>
          </div>
        ))}</div>}
      </div>}

      {/* ===== LOYALTY ===== */}
      {tab === 'loyalty' && <LoyaltyPanel cards={loyalty.cards} onIssue={loyalty.issueCard} onFlash={flash} />}

      {/* ===== INTEGRATIONS ===== */}
      {tab === 'integrations' && <IntegrationPanel pendingSync={integrations.pendingSync} onMarkSynced={integrations.markSynced} onFlash={flash} />}
    </div>
  );
}

export default function BillingPage() { return <RoleGuard module="billing"><BillingInner /></RoleGuard>; }
