'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard, printBill } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useBillsV2, useBillItems, usePaymentsV2, useAdvances, useTariffs, useEstimates, usePackages } from '@/lib/billing/billing-hooks';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type BillingTab = 'dashboard' | 'bills' | 'ipd_billing' | 'payments' | 'advances' | 'estimates' | 'tariffs' | 'packages';

function BillingInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const billing = useBillsV2(centreId);
  const tariffs = useTariffs(centreId);
  const estimates = useEstimates(centreId);
  const packages = usePackages(centreId);

  const [tab, setTab] = useState<BillingTab>('dashboard');
  const [toast, setToast] = useState('');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [showNewBill, setShowNewBill] = useState(false);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Bill detail hooks
  const billItems = useBillItems(selectedBillId);
  const payments = usePaymentsV2(selectedBillId);
  const selectedBill = billing.bills.find(b => b.id === selectedBillId);

  // Advance hooks (for selected bill's patient)
  const advances = useAdvances(selectedBill?.patient_id || null);

  // Filters
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [payorFilter, setPayorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');

  // New bill form
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [newBill, setNewBill] = useState<any>({ patientId: '', billType: 'opd', payorType: 'self', items: [] as any[] });
  const [tariffSearch, setTariffSearch] = useState('');

  // Payment form
  const [showPay, setShowPay] = useState(false);
  const [payAmt, setPayAmt] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');

  // Discount form
  const [showDiscount, setShowDiscount] = useState(false);
  const [discAmt, setDiscAmt] = useState('');
  const [discReason, setDiscReason] = useState('');

  // Patient search
  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const tariffResults = useMemo(() => tariffSearch.length >= 2 ? tariffs.search(tariffSearch) : [], [tariffSearch, tariffs]);

  const addTariffToNewBill = (t: any) => {
    const rate = tariffs.getRate(t.id, newBill.payorType);
    setNewBill((b: any) => ({ ...b, items: [...b.items, { tariffId: t.id, description: t.service_name, quantity: 1, unitRate: rate, category: t.category }] }));
    setTariffSearch('');
  };

  const addTariffToExistingBill = async (t: any) => {
    if (!selectedBillId) return;
    const rate = tariffs.getRate(t.id, selectedBill?.payor_type || 'self');
    await billItems.add({ tariffId: t.id, description: t.service_name, quantity: 1, unitRate: rate, serviceDate: new Date().toISOString().split('T')[0] });
    billing.load({ dateFrom, dateTo, status: statusFilter, payorType: payorFilter });
    flash('Item added');
  };

  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const stColor = (s: string) => s === 'paid' ? 'bg-green-100 text-green-700' : s === 'partially_paid' ? 'bg-yellow-100 text-yellow-700' : s === 'final' ? 'bg-blue-100 text-blue-700' : s === 'draft' ? 'bg-gray-100 text-gray-600' : s === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
  const payorColor = (p: string) => p === 'self' ? 'bg-gray-100 text-gray-700' : p === 'insurance' ? 'bg-blue-100 text-blue-700' : p.startsWith('govt') ? 'bg-green-100 text-green-700' : p === 'corporate' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100';
  const catColor = (c: string) => c === 'consultation' ? 'text-blue-600' : c === 'room_rent' ? 'text-green-600' : c === 'ot_charges' ? 'text-purple-600' : c === 'professional_fee' ? 'text-orange-600' : c === 'procedure' ? 'text-red-600' : c === 'consumable' ? 'text-yellow-700' : 'text-gray-600';

  const tabs: [BillingTab, string][] = [['dashboard','Dashboard'],['bills','Bills'],['ipd_billing','IPD Running'],['payments','Payments'],['advances','Advances'],['estimates','Estimates'],['tariffs','Tariff Master'],['packages','Packages']];

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Billing & Revenue</h1><p className="text-sm text-gray-500">500-bed quaternary super-speciality billing</p></div>
        <button onClick={() => { setShowNewBill(true); setTab('bills'); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">+ New Bill</button>
      </div>

      <div className="flex gap-1 mb-4 border-b pb-px overflow-x-auto">
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setShowNewBill(false); }}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>)}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && <div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">Today's Bills</div><div className="text-2xl font-bold text-gray-900">{billing.stats.todayCount}</div><div className="text-xs text-green-600">Rs.{fmt(billing.stats.todayRevenue)}</div></div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4"><div className="text-xs text-green-600">Total Collected</div><div className="text-2xl font-bold text-green-700">Rs.{fmt(billing.stats.collected)}</div></div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4"><div className="text-xs text-red-600">Outstanding</div><div className="text-2xl font-bold text-red-700">Rs.{fmt(billing.stats.outstanding)}</div></div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4"><div className="text-xs text-blue-600">Total Revenue</div><div className="text-2xl font-bold text-blue-700">Rs.{fmt(billing.stats.totalRevenue)}</div></div>
        </div>

        {/* Revenue by payor */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-3">Revenue by Payor Type</h3>
            {(['self','insurance','govt_pmjay','govt_cghs','corporate'] as const).map(p => {
              const pBills = billing.bills.filter(b => b.payor_type === p);
              const rev = pBills.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0);
              const pct = billing.stats.totalRevenue > 0 ? (rev / billing.stats.totalRevenue * 100).toFixed(1) : '0';
              return <div key={p} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${payorColor(p)}`}>{p.replace('govt_','').replace('_',' ').toUpperCase()}</span><span className="text-xs text-gray-400">{pBills.length} bills</span></div>
                <div className="text-right"><span className="text-sm font-bold">Rs.{fmt(rev)}</span><span className="text-[10px] text-gray-400 ml-1">({pct}%)</span></div>
              </div>;
            })}
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-3">Revenue by Bill Type</h3>
            {(['ipd','opd','pharmacy','lab','radiology','package'] as const).map(t => {
              const tBills = billing.bills.filter(b => b.bill_type === t);
              const rev = tBills.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0);
              return rev > 0 ? <div key={t} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-xs font-medium">{t.toUpperCase()}</span>
                <span className="text-sm font-bold">Rs.{fmt(rev)}</span>
              </div> : null;
            })}
          </div>
        </div>

        {/* Recent bills */}
        <h3 className="text-sm font-semibold mb-2">Recent Bills</h3>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Bill #</th><th className="p-2 text-left">Patient</th><th className="p-2">Type</th><th className="p-2">Payor</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Balance</th><th className="p-2">Status</th>
        </tr></thead><tbody>{billing.bills.slice(0, 15).map(b => (
          <tr key={b.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedBillId(b.id); setTab('bills'); }}>
            <td className="p-2 font-mono">{b.bill_number}</td>
            <td className="p-2 font-medium">{b.patient?.first_name} {b.patient?.last_name} <span className="text-gray-400 font-normal">{b.patient?.uhid}</span></td>
            <td className="p-2 text-center"><span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{b.bill_type}</span></td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${payorColor(b.payor_type)}`}>{b.payor_type.replace('govt_','').replace('_',' ')}</span></td>
            <td className="p-2 text-right font-medium">Rs.{fmt(b.net_amount)}</td>
            <td className="p-2 text-right text-green-600">Rs.{fmt(b.paid_amount)}</td>
            <td className="p-2 text-right text-red-600">{parseFloat(b.balance_amount) > 0 ? `Rs.${fmt(b.balance_amount)}` : '—'}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(b.status)}`}>{b.status.replace('_',' ')}</span></td>
          </tr>
        ))}</tbody></table></div>
      </div>}

      {/* ===== BILLS ===== */}
      {tab === 'bills' && <div>
        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); billing.load({ dateFrom: e.target.value, dateTo, status: statusFilter, payorType: payorFilter, billType: typeFilter }); }} className="px-2 py-1.5 border rounded-lg text-xs" />
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); billing.load({ dateFrom, dateTo: e.target.value, status: statusFilter, payorType: payorFilter, billType: typeFilter }); }} className="px-2 py-1.5 border rounded-lg text-xs" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); billing.load({ dateFrom, dateTo, status: e.target.value, payorType: payorFilter, billType: typeFilter }); }} className="px-2 py-1.5 border rounded-lg text-xs">
            <option value="all">All status</option>{['draft','final','partially_paid','paid','cancelled'].map(s => <option key={s}>{s}</option>)}</select>
          <select value={payorFilter} onChange={e => { setPayorFilter(e.target.value); billing.load({ dateFrom, dateTo, status: statusFilter, payorType: e.target.value, billType: typeFilter }); }} className="px-2 py-1.5 border rounded-lg text-xs">
            <option value="all">All payors</option>{['self','insurance','corporate','govt_pmjay','govt_cghs','govt_esi'].map(p => <option key={p}>{p}</option>)}</select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); billing.load({ dateFrom, dateTo, status: statusFilter, payorType: payorFilter, billType: e.target.value }); }} className="px-2 py-1.5 border rounded-lg text-xs">
            <option value="all">All types</option>{['opd','ipd','pharmacy','lab','radiology','package'].map(t => <option key={t}>{t.toUpperCase()}</option>)}</select>
          <button onClick={() => setShowNewBill(!showNewBill)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg ml-auto">{showNewBill ? 'Cancel' : '+ New Bill'}</button>
        </div>

        {/* New Bill Creator */}
        {showNewBill && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <h3 className="font-semibold text-sm">Create New Bill</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="relative"><label className="text-xs text-gray-500">Patient *</label>
              {newBill.patientId ? <div className="bg-blue-50 rounded-lg p-2 flex justify-between"><span className="text-sm font-medium">{patResults.find(p => p.id === newBill.patientId)?.first_name || 'Selected'}</span><button onClick={() => setNewBill((b: any) => ({...b, patientId: ''}))} className="text-xs text-red-500">Change</button></div> :
              <><input type="text" value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search UHID/name/phone..." />
              {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10">{patResults.map(p => (
                <button key={p.id} onClick={() => { setNewBill((b: any) => ({...b, patientId: p.id})); setPatResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">{p.first_name} {p.last_name} — {p.uhid}</button>
              ))}</div>}</>}</div>
            <div><label className="text-xs text-gray-500">Bill type *</label>
              <select value={newBill.billType} onChange={e => setNewBill((b: any) => ({...b, billType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['opd','ipd','pharmacy','lab','radiology','package'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Payor *</label>
              <select value={newBill.payorType} onChange={e => setNewBill((b: any) => ({...b, payorType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['self','insurance','corporate','govt_pmjay','govt_cghs','govt_esi'].map(p => <option key={p}>{p.replace('_',' ').toUpperCase()}</option>)}</select></div>
          </div>
          {/* Add items from tariff */}
          <div className="relative"><label className="text-xs text-gray-500">Add items from tariff</label>
            <input type="text" value={tariffSearch} onChange={e => setTariffSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search service name or code..." />
            {tariffResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10 max-h-48 overflow-y-auto">{tariffResults.map((t: any) => (
              <button key={t.id} onClick={() => addTariffToNewBill(t)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0 flex justify-between">
                <div><div className="text-sm font-medium">{t.service_name}</div><div className="text-[10px] text-gray-400">{t.service_code} | {t.category}</div></div>
                <span className="text-sm font-bold text-blue-600">Rs.{fmt(tariffs.getRate(t.id, newBill.payorType))}</span>
              </button>
            ))}</div>}</div>
          {/* Items list */}
          {newBill.items.length > 0 && <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b"><th className="p-2 text-left">Item</th><th className="p-2">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th><th className="p-2">Del</th></tr></thead>
            <tbody>{newBill.items.map((item: any, i: number) => (
              <tr key={i} className="border-b"><td className="p-2 font-medium">{item.description} <span className={`text-[10px] ${catColor(item.category)}`}>{item.category?.replace('_',' ')}</span></td>
                <td className="p-2 text-center"><input type="number" value={item.quantity} onChange={e => { const items = [...newBill.items]; items[i].quantity = parseInt(e.target.value)||1; setNewBill((b: any) => ({...b, items})); }} className="w-12 text-center border rounded px-1 py-0.5" min="1" /></td>
                <td className="p-2 text-right"><input type="number" value={item.unitRate} onChange={e => { const items = [...newBill.items]; items[i].unitRate = parseFloat(e.target.value)||0; setNewBill((b: any) => ({...b, items})); }} className="w-20 text-right border rounded px-1 py-0.5" /></td>
                <td className="p-2 text-right font-bold">Rs.{fmt(item.quantity * item.unitRate)}</td>
                <td className="p-2 text-center"><button onClick={() => { const items = newBill.items.filter((_: any, j: number) => j !== i); setNewBill((b: any) => ({...b, items})); }} className="text-red-500 text-xs">✕</button></td>
              </tr>
            ))}</tbody>
            <tfoot><tr className="bg-gray-50"><td colSpan={3} className="p-2 text-right font-bold">Total</td><td className="p-2 text-right font-bold text-lg">Rs.{fmt(newBill.items.reduce((s: number, i: any) => s + i.quantity * i.unitRate, 0))}</td><td></td></tr></tfoot>
            </table></div>}
          <button onClick={async () => { if (!newBill.patientId || newBill.items.length === 0) return; const b = await billing.createBill(newBill, staffId); if (b) { flash('Bill created: ' + b.bill_number); setShowNewBill(false); setNewBill({ patientId: '', billType: 'opd', payorType: 'self', items: [] }); setSelectedBillId(b.id); } }} disabled={!newBill.patientId || newBill.items.length === 0}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Create Bill</button>
        </div>}

        {/* Bill detail view */}
        {selectedBillId && selectedBill && <div className="bg-white rounded-xl border p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div><span className="font-mono text-sm">{selectedBill.bill_number}</span><span className={`ml-2 px-2 py-0.5 rounded text-xs ${stColor(selectedBill.status)}`}>{selectedBill.status}</span><span className={`ml-2 px-2 py-0.5 rounded text-xs ${payorColor(selectedBill.payor_type)}`}>{selectedBill.payor_type}</span></div>
            <div className="flex gap-2">
              {selectedBill.status === 'draft' && <button onClick={async () => { await billing.finalize(selectedBillId); flash('Bill finalized'); }} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Finalize</button>}
              <button onClick={() => setShowPay(!showPay)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">Collect Payment</button>
              <button onClick={() => setShowDiscount(!showDiscount)} className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs rounded-lg">Discount</button>
              <button onClick={() => printBill({ billNumber: selectedBill.bill_number, billDate: selectedBill.bill_date, patientName: (selectedBill.patient?.first_name||'')+' '+(selectedBill.patient?.last_name||''), patientUhid: selectedBill.patient?.uhid||'', ageGender: `${selectedBill.patient?.age_years||''}yr/${selectedBill.patient?.gender||''}`, payorType: selectedBill.payor_type, items: billItems.items.map((i: any) => ({ description: i.description, quantity: parseFloat(i.quantity), rate: parseFloat(i.unit_rate), amount: parseFloat(i.net_amount) })), grossAmount: parseFloat(selectedBill.gross_amount), discountAmount: parseFloat(selectedBill.discount_amount), netAmount: parseFloat(selectedBill.net_amount), paidAmount: parseFloat(selectedBill.paid_amount), balanceAmount: parseFloat(selectedBill.balance_amount), payments: payments.payments.map((p: any) => ({ mode: p.payment_mode, amount: parseFloat(p.amount), receipt: p.receipt_number, date: p.payment_date })) }, { name: 'Health1 Super Speciality Hospital', address: 'Shilaj, Ahmedabad', phone: '', tagline: 'Quality Healthcare for All' })} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg">Print</button>
              <button onClick={() => setSelectedBillId(null)} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Close</button>
            </div>
          </div>
          {/* Patient + amounts */}
          <div className="grid grid-cols-4 gap-3 mb-4 bg-gray-50 p-3 rounded-lg text-sm">
            <div><span className="text-xs text-gray-500">Patient:</span> <span className="font-medium">{selectedBill.patient?.first_name} {selectedBill.patient?.last_name}</span></div>
            <div><span className="text-xs text-gray-500">UHID:</span> {selectedBill.patient?.uhid}</div>
            <div><span className="text-xs text-gray-500">Bill date:</span> {selectedBill.bill_date}</div>
            <div><span className="text-xs text-gray-500">Type:</span> {selectedBill.bill_type?.toUpperCase()}</div>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-[10px] text-gray-500">Gross</div><div className="font-bold">Rs.{fmt(selectedBill.gross_amount)}</div></div>
            <div className="bg-orange-50 rounded-lg p-2 text-center"><div className="text-[10px] text-orange-600">Discount</div><div className="font-bold text-orange-700">Rs.{fmt(selectedBill.discount_amount)}</div></div>
            <div className="bg-blue-50 rounded-lg p-2 text-center"><div className="text-[10px] text-blue-600">Net</div><div className="font-bold text-blue-700">Rs.{fmt(selectedBill.net_amount)}</div></div>
            <div className={`rounded-lg p-2 text-center ${parseFloat(selectedBill.balance_amount) > 0 ? 'bg-red-50' : 'bg-green-50'}`}><div className="text-[10px] text-gray-600">Balance</div><div className={`font-bold ${parseFloat(selectedBill.balance_amount) > 0 ? 'text-red-700' : 'text-green-700'}`}>Rs.{fmt(selectedBill.balance_amount)}</div></div>
          </div>

          {/* Payment form */}
          {showPay && <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3 space-y-2">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs text-gray-500">Amount *</label>
                <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={`Max: Rs.${fmt(selectedBill.balance_amount)}`} /></div>
              <div><label className="text-xs text-gray-500">Mode *</label>
                <div className="flex gap-1 mt-1">{['cash','upi','card','neft','cheque'].map(m => (
                  <button key={m} onClick={() => setPayMode(m)} className={`flex-1 py-1.5 rounded text-xs border ${payMode === m ? 'bg-green-600 text-white border-green-600' : 'bg-white border-gray-200'}`}>{m.toUpperCase()}</button>
                ))}</div></div>
              <div><label className="text-xs text-gray-500">Reference #</label>
                <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Transaction ID..." /></div>
            </div>
            <button onClick={async () => { if (!payAmt) return; const rcpt = await payments.collect(parseFloat(payAmt), payMode, payRef, staffId); flash('Payment collected! Receipt: ' + rcpt); setShowPay(false); setPayAmt(''); billing.load({ dateFrom, dateTo }); }}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Collect Rs.{payAmt || '0'}</button>
          </div>}

          {/* Discount form */}
          {showDiscount && <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Discount amount *</label>
                <input type="number" value={discAmt} onChange={e => setDiscAmt(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs text-gray-500">Reason *</label>
                <select value={discReason} onChange={e => setDiscReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>{['Staff discount','Management discount','Senior citizen','BPL patient','Bulk discount','Loyalty','Insurance write-off','Settlement','Other'].map(r => <option key={r}>{r}</option>)}</select></div>
            </div>
            <button onClick={async () => { if (!discAmt || !discReason) return; await billing.applyDiscount(selectedBillId, parseFloat(discAmt), discReason, staffId); flash('Discount applied'); setShowDiscount(false); setDiscAmt(''); billing.load({ dateFrom, dateTo }); }}
              className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg">Apply Discount</button>
          </div>}

          {/* Add item */}
          <div className="relative mb-3"><label className="text-xs text-gray-500">Add item from tariff</label>
            <input type="text" value={tariffSearch} onChange={e => setTariffSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search service..." />
            {tariffResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10 max-h-40 overflow-y-auto">{tariffResults.slice(0,6).map((t: any) => (
              <button key={t.id} onClick={() => { addTariffToExistingBill(t); setTariffSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0 flex justify-between text-xs">
                <span>{t.service_name}</span><span className="font-bold">Rs.{fmt(tariffs.getRate(t.id, selectedBill.payor_type))}</span>
              </button>
            ))}</div>}</div>

          {/* Items table */}
          <div className="border rounded-lg overflow-hidden mb-3"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Service</th><th className="p-2">Date</th><th className="p-2">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th><th className="p-2">Del</th>
          </tr></thead><tbody>{billItems.items.map((item: any) => (
            <tr key={item.id} className="border-b">
              <td className="p-2"><span className="font-medium">{item.description}</span>{item.tariff?.category && <span className={`ml-1 text-[10px] ${catColor(item.tariff.category)}`}>({item.tariff.category.replace('_',' ')})</span>}{item.doctor?.full_name && <span className="text-[10px] text-gray-400 ml-1">Dr.{item.doctor.full_name}</span>}</td>
              <td className="p-2 text-center text-gray-500">{item.service_date}</td>
              <td className="p-2 text-center">{item.quantity}</td>
              <td className="p-2 text-right">Rs.{fmt(item.unit_rate)}</td>
              <td className="p-2 text-right font-bold">Rs.{fmt(item.net_amount)}</td>
              <td className="p-2 text-center">{selectedBill.status === 'draft' && <button onClick={() => billItems.remove(item.id)} className="text-red-500">✕</button>}</td>
            </tr>
          ))}</tbody></table></div>

          {/* Payments history */}
          {payments.payments.length > 0 && <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-500 mb-1">Payment History</h4>
            <div className="space-y-1">{payments.payments.map((p: any) => (
              <div key={p.id} className="bg-green-50 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                <div><span className="font-mono text-green-700">{p.receipt_number}</span><span className="ml-2 text-gray-500">{p.payment_date}</span><span className="ml-2 bg-gray-100 px-1.5 py-0.5 rounded">{p.payment_mode}</span>{p.reference_number && <span className="ml-2 text-gray-400">Ref: {p.reference_number}</span>}</div>
                <span className="font-bold text-green-700">Rs.{fmt(p.amount)}</span>
              </div>
            ))}</div>
          </div>}
        </div>}

        {/* Bills list */}
        {!selectedBillId && <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Bill #</th><th className="p-2 text-left">Patient</th><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Payor</th><th className="p-2 text-right">Net</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Balance</th><th className="p-2">Status</th>
        </tr></thead><tbody>{billing.bills.map(b => (
          <tr key={b.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedBillId(b.id)}>
            <td className="p-2 font-mono">{b.bill_number}</td>
            <td className="p-2"><span className="font-medium">{b.patient?.first_name} {b.patient?.last_name}</span> <span className="text-gray-400">{b.patient?.uhid}</span></td>
            <td className="p-2 text-center text-gray-500">{b.bill_date}</td>
            <td className="p-2 text-center"><span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{b.bill_type}</span></td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${payorColor(b.payor_type)}`}>{b.payor_type.replace('govt_','').replace('_',' ')}</span></td>
            <td className="p-2 text-right font-medium">Rs.{fmt(b.net_amount)}</td>
            <td className="p-2 text-right text-green-600">{parseFloat(b.paid_amount) > 0 ? `Rs.${fmt(b.paid_amount)}` : '—'}</td>
            <td className="p-2 text-right text-red-600">{parseFloat(b.balance_amount) > 0 ? `Rs.${fmt(b.balance_amount)}` : '—'}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${stColor(b.status)}`}>{b.status.replace('_',' ')}</span></td>
          </tr>
        ))}</tbody></table></div>}
      </div>}

      {/* ===== IPD RUNNING BILL ===== */}
      {tab === 'ipd_billing' && <div>
        <h2 className="font-semibold text-sm mb-3">IPD Running Bills — Active Admissions</h2>
        <p className="text-xs text-gray-500 mb-3">Auto-charges room rent, nursing, ICU charges daily. Additional charges added per service.</p>
        {billing.bills.filter(b => b.bill_type === 'ipd' && (b.status === 'draft' || b.status === 'final' || b.status === 'partially_paid')).length === 0
          ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No active IPD bills. Create bills from the IPD module when patients are admitted.</div>
          : <div className="space-y-2">{billing.bills.filter(b => b.bill_type === 'ipd' && b.status !== 'cancelled' && b.status !== 'paid').map(b => (
            <div key={b.id} className="bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300" onClick={() => { setSelectedBillId(b.id); setTab('bills'); }}>
              <div className="flex items-center justify-between">
                <div><span className="font-medium">{b.patient?.first_name} {b.patient?.last_name}</span><span className="ml-2 font-mono text-xs text-gray-400">{b.bill_number}</span><span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${payorColor(b.payor_type)}`}>{b.payor_type}</span></div>
                <div className="text-right"><div className="font-bold">Rs.{fmt(b.net_amount)}</div><div className="text-[10px] text-green-600">Paid: Rs.{fmt(b.paid_amount)}</div>{parseFloat(b.balance_amount) > 0 && <div className="text-[10px] text-red-600 font-medium">Due: Rs.{fmt(b.balance_amount)}</div>}</div>
              </div>
            </div>
          ))}</div>}
      </div>}

      {/* ===== PAYMENTS ===== */}
      {tab === 'payments' && <div>
        <h2 className="font-semibold text-sm mb-3">Payment Collections</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {['cash','upi','card'].map(mode => {
            const total = billing.bills.reduce((s: number, b: any) => s, 0); // would need payments query
            return <div key={mode} className="bg-white rounded-xl border p-4 text-center">
              <div className="text-xs text-gray-500">{mode.toUpperCase()}</div>
              <div className="text-xl font-bold text-gray-700">—</div>
            </div>;
          })}
        </div>
        <p className="text-xs text-gray-500">Select a bill from the Bills tab to collect payments.</p>
      </div>}

      {/* ===== ADVANCES ===== */}
      {tab === 'advances' && <div>
        <h2 className="font-semibold text-sm mb-3">Advances & Deposits</h2>
        <p className="text-xs text-gray-500 mb-3">Select a patient from their bill to manage advances. Advances can be collected against IPD admissions and adjusted at final billing.</p>
        {selectedBill && advances.advances.length > 0 ? (
          <div className="space-y-2">{advances.advances.map((a: any) => (
            <div key={a.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
              <div><span className="font-mono text-xs">{a.receipt_number}</span><span className="ml-2 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{a.payment_mode}</span><span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span></div>
              <span className="font-bold">Rs.{fmt(a.amount)}</span>
            </div>
          ))}</div>
        ) : <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No advances. Collect advance from the IPD admission workflow.</div>}
      </div>}

      {/* ===== ESTIMATES ===== */}
      {tab === 'estimates' && <div>
        <h2 className="font-semibold text-sm mb-3">Cost Estimates / Proforma</h2>
        {estimates.estimates.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No estimates created</div> :
        <div className="space-y-2">{estimates.estimates.map((e: any) => (
          <div key={e.id} className="bg-white rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div><span className="font-mono text-xs">{e.estimate_number}</span><span className="ml-2 font-medium">{e.patient?.first_name} {e.patient?.last_name}</span></div>
              <div className="text-right"><div className="font-bold">Rs.{fmt(e.total_estimated)}</div><span className={`text-[10px] px-1.5 py-0.5 rounded ${e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{e.status}</span></div>
            </div>
            {e.procedure_name && <div className="text-xs text-gray-500 mt-1">{e.procedure_name} | {e.estimate_type} | {e.room_category || 'General'} | {e.expected_los_days || '?'} days</div>}
          </div>
        ))}</div>}
      </div>}

      {/* ===== TARIFF MASTER ===== */}
      {tab === 'tariffs' && <div>
        <h2 className="font-semibold text-sm mb-3">Tariff Master — Service Rate Card ({tariffs.tariffs.length} services)</h2>
        <div className="flex gap-2 mb-3 flex-wrap">
          {tariffs.categories.map(c => <span key={c} className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-600">{c.replace('_',' ')} ({tariffs.tariffs.filter(t => t.category === c).length})</span>)}
        </div>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Code</th><th className="p-2 text-left">Service</th><th className="p-2">Category</th><th className="p-2 text-right">Self</th><th className="p-2 text-right">Insurance</th><th className="p-2 text-right">PMJAY</th><th className="p-2 text-right">CGHS</th>
        </tr></thead><tbody>{tariffs.tariffs.map((t: any) => (
          <tr key={t.id} className="border-b hover:bg-gray-50">
            <td className="p-2 font-mono text-[10px]">{t.service_code}</td>
            <td className="p-2 font-medium">{t.service_name}</td>
            <td className="p-2 text-center"><span className={`text-[10px] ${catColor(t.category)}`}>{t.category.replace('_',' ')}</span></td>
            <td className="p-2 text-right font-medium">Rs.{fmt(t.rate_self)}</td>
            <td className="p-2 text-right">{t.rate_insurance ? `Rs.${fmt(t.rate_insurance)}` : '—'}</td>
            <td className="p-2 text-right">{t.rate_pmjay ? `Rs.${fmt(t.rate_pmjay)}` : '—'}</td>
            <td className="p-2 text-right">{t.rate_cghs ? `Rs.${fmt(t.rate_cghs)}` : '—'}</td>
          </tr>
        ))}</tbody></table></div>
      </div>}

      {/* ===== PACKAGES ===== */}
      {tab === 'packages' && <div>
        <h2 className="font-semibold text-sm mb-3">Surgery / Treatment Packages</h2>
        {packages.packages.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No packages configured. Add packages in Settings.</div> :
        <div className="grid grid-cols-2 gap-3">{packages.packages.map((p: any) => (
          <div key={p.id} className="bg-white rounded-xl border p-4">
            <div className="flex justify-between items-start mb-2"><div><div className="font-semibold text-sm">{p.package_name}</div><div className="text-[10px] text-gray-400">{p.package_code} | {p.department?.name || '—'}</div></div>
              <div className="text-right"><div className="text-lg font-bold text-blue-700">Rs.{fmt(p.total_amount)}</div>{p.validity_days && <div className="text-[10px] text-gray-400">{p.validity_days} days</div>}</div></div>
            {p.inclusions && <div className="text-xs text-gray-600"><span className="font-medium text-green-600">Includes:</span> {(Array.isArray(p.inclusions) ? p.inclusions : []).join(', ')}</div>}
            {p.exclusions && (Array.isArray(p.exclusions) ? p.exclusions : []).length > 0 && <div className="text-xs text-red-500 mt-1"><span className="font-medium">Excludes:</span> {(Array.isArray(p.exclusions) ? p.exclusions : []).join(', ')}</div>}
          </div>
        ))}</div>}
      </div>}
    </div>
  );
}

export default function BillingPage() { return <RoleGuard module="billing"><BillingInner /></RoleGuard>; }
