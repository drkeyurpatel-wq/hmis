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
import InsuranceCashless from '@/components/billing/insurance-cashless';
import ARManagement from '@/components/billing/ar-management';
import IntegrationHub from '@/components/billing/integration-hub';
import { CorporateBilling, SettlementReconciliation, LoyaltyProgram, GovtSchemes } from '@/components/billing/revenue-extras';
import BarcodeScanner from '@/components/billing/barcode-scanner';
import AutoChargeEngine from '@/components/billing/auto-charge-engine';
import ChargeDashboard from '@/components/billing/charge-dashboard';
import IPDFinalBill from '@/components/billing/ipd-final-bill';
import RefundManager from '@/components/billing/refund-manager';
import CreditNoteManager from '@/components/billing/credit-note-manager';
import PackageBuilder from '@/components/billing/package-builder';
import OPDBilling from '@/components/billing/opd-billing';
import ServiceBillingEngine from '@/components/billing/service-billing-engine';
import IPDBillingTab from '@/components/billing/ipd-billing-tab';
import BillDetailView from '@/components/billing/bill-detail-view';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'dashboard'|'new_bill'|'bills'|'opd_billing'|'charges'|'barcode'|'auto_charges'|'final_bill'|'cashless'|'corporate'|'ipd_billing'|'ar'|'estimates'|'advances'|'settlements'|'refunds'|'credit_notes'|'govt'|'loyalty'|'tariffs'|'packages'|'day_end'|'integrations';

function BillingInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  // Core hooks
  const billing = useBillsV2(centreId);
  const tariffs = useTariffs(centreId);
  const estimates = useEstimates(centreId);
  const packages = usePackages(centreId);

  // Revenue cycle hooks
  const cashless = useCashlessWorkflow(centreId);
  const corporate = useCorporateBilling(centreId);
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
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30*86400000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [payorFilter, setPayorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // New bill
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [newBill, setNewBill] = useState<any>({ patientId:'', billType:'opd', payorType:'self', items:[] as any[] });
  const [tariffQ, setTariffQ] = useState('');

  // Advance form
  const [advForm, setAdvForm] = useState({ search:'', patientId:'', amount:'', mode:'cash' });
  const [advPatResults, setAdvPatResults] = useState<any[]>([]);

  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id,uhid,first_name,last_name,age_years,gender,phone_primary')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`).eq('is_active',true).limit(5);
      setPatResults(data||[]);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  useEffect(() => {
    if (advForm.search.length < 2 || !sb()) { setAdvPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id,uhid,first_name,last_name').or(`uhid.ilike.%${advForm.search}%,first_name.ilike.%${advForm.search}%`).limit(5);
      setAdvPatResults(data||[]);
    }, 300);
    return () => clearTimeout(t);
  }, [advForm.search]);

  const tariffResults = useMemo(() => tariffQ.length >= 2 ? tariffs.search(tariffQ).slice(0,8) : [], [tariffQ, tariffs]);
  const fmt = (n: number|string) => parseFloat(String(n)||'0').toLocaleString('en-IN',{maximumFractionDigits:0});
  const stColor = (s: string) => s==='paid'?'bg-green-100 text-green-700':s==='partially_paid'?'bg-yellow-100 text-yellow-700':s==='final'?'bg-blue-100 text-blue-700':s==='draft'?'bg-gray-100 text-gray-600':s==='cancelled'?'bg-red-100 text-red-700':'bg-gray-100';
  const payorColor = (p: string) => p==='self'?'bg-gray-100 text-gray-700':p==='insurance'?'bg-blue-100 text-blue-700':p.startsWith('govt')?'bg-green-100 text-green-700':p==='corporate'?'bg-purple-100 text-purple-700':'bg-gray-100';
  const catColor = (c: string) => ({consultation:'text-blue-600',room_rent:'text-green-600',ot_charges:'text-purple-600',professional_fee:'text-orange-600',procedure:'text-red-600',consumable:'text-yellow-700'})[c]||'text-gray-600';

  const addTariffToNewBill = (t: any) => {
    const rate = tariffs.getRate(t.id, newBill.payorType);
    setNewBill((b: any) => ({...b, items:[...b.items, {tariffId:t.id, description:t.service_name, quantity:1, unitRate:rate, category:t.category}]}));
    setTariffQ('');
  };
  const reloadBills = () => billing.load({dateFrom, dateTo, status:statusFilter, payorType:payorFilter, billType:typeFilter});

  const tabs: [Tab,string,string][] = [
    ['dashboard','Dashboard','📊'],['new_bill','New Bill','💵'],['bills','Bills','📄'],['opd_billing','OPD Billing','🏥'],['charges','Charge Capture','⚡'],['barcode','Barcode Scan','📡'],['auto_charges','Auto Charges','🔄'],
    ['final_bill','IPD Final Bill','🧾'],['cashless','Insurance/Cashless','🏥'],['corporate','Corporate','🏢'],
    ['ipd_billing','IPD Running','🛏️'],['ar','Accounts Receivable','📑'],['estimates','Estimates','📋'],['advances','Advances','💰'],
    ['settlements','Settlements','🤝'],['refunds','Refunds','↩️'],['credit_notes','Credit Notes','📝'],['govt','Govt Schemes','🇮🇳'],['loyalty','Loyalty','💳'],['tariffs','Tariff Master','💲'],
    ['packages','Packages','📦'],['day_end','Day End','🔒'],['integrations','Integrations','🔗']
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between mb-3">
        <div><h1 className="text-xl font-bold text-gray-900">Revenue Cycle Management</h1><p className="text-xs text-gray-500">Health1 Super Speciality — Multi-centre, Multi-payor Billing</p></div>
        <button onClick={() => setTab('new_bill')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">+ New Bill</button>
      </div>

      <div className="flex gap-0.5 mb-4 border-b pb-px overflow-x-auto">
        {tabs.map(([k,l,icon]) => <button key={k} onClick={() => {setTab(k); if(k!=='bills'){setShowNewBill(false); setSelectedBillId(null);}}}
          className={`px-2 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 -mb-px ${tab===k?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{icon} {l}</button>)}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && <RevenueDashboard bills={billing.bills} />}

      {/* ===== NEW BILL — Full Service Billing Engine ===== */}
      {tab === 'new_bill' && <ServiceBillingEngine centreId={centreId} staffId={staffId} mode="general"
        onDone={() => { billing.load(); setTab('bills'); }} onFlash={flash} />}

      {/* ===== BILLS ===== */}
      {tab === 'bills' && <div>
        {selectedBillId && <BillDetailView billId={selectedBillId} centreId={centreId} staffId={staffId} onFlash={flash} onClose={() => { setSelectedBillId(null); billing.load(); }} />}

        {showNewBill && !selectedBillId && <div className="mb-4">
          <div className="flex justify-between mb-3"><h3 className="font-semibold text-sm">Create New Bill</h3><button onClick={() => setShowNewBill(false)} className="text-xs text-gray-500">✕ Close</button></div>
          <ServiceBillingEngine centreId={centreId} staffId={staffId} mode="general"
            onDone={(billId) => { setShowNewBill(false); setSelectedBillId(billId); billing.load(); }} onFlash={flash} />
        </div>}

        {!selectedBillId && !showNewBill && <><div className="flex gap-2 mb-3 flex-wrap items-center">
          <input type="date" value={dateFrom} onChange={e => {setDateFrom(e.target.value); billing.load({dateFrom:e.target.value,dateTo});}} className="px-2 py-1.5 border rounded-lg text-xs" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={e => {setDateTo(e.target.value); billing.load({dateFrom,dateTo:e.target.value});}} className="px-2 py-1.5 border rounded-lg text-xs" />
          {[['Status',statusFilter,setStatusFilter,['all','draft','final','partially_paid','paid','cancelled']],['Payor',payorFilter,setPayorFilter,['all','self','insurance','corporate','govt_pmjay','govt_cghs']],['Type',typeFilter,setTypeFilter,['all','opd','ipd','pharmacy','lab','radiology']]].map(([label,val,setter,opts]: any) => (
            <select key={label} value={val} onChange={e => {setter(e.target.value); billing.load({dateFrom,dateTo,status:label==='Status'?e.target.value:statusFilter,payorType:label==='Payor'?e.target.value:payorFilter,billType:label==='Type'?e.target.value:typeFilter});}} className="px-2 py-1.5 border rounded-lg text-xs">
              {opts.map((o: string) => <option key={o} value={o}>{o==='all'?`All ${label}`:o.replace('govt_','').replace('_',' ').toUpperCase()}</option>)}</select>))}
          <span className="text-xs text-gray-400 ml-auto">{billing.bills.length} bills</span>
          <button onClick={() => setShowNewBill(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">+ New Bill</button>
        </div>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Bill #</th><th className="p-2 text-left">Patient</th><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Payor</th><th className="p-2 text-right">Net</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Bal</th><th className="p-2">Status</th>
        </tr></thead><tbody>{billing.bills.map(b => (
          <tr key={b.id} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedBillId(b.id)}>
            <td className="p-2 font-mono text-[10px]">{b.bill_number}</td>
            <td className="p-2"><span className="font-medium">{b.patient?.first_name} {b.patient?.last_name}</span> <span className="text-[10px] text-gray-400">{b.patient?.uhid}</span></td>
            <td className="p-2 text-center text-gray-500">{b.bill_date}</td>
            <td className="p-2 text-center"><span className="bg-gray-100 px-1 py-0.5 rounded text-[9px]">{b.bill_type}</span></td>
            <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${payorColor(b.payor_type)}`}>{b.payor_type?.replace('govt_','').replace('_',' ')}</span></td>
            <td className="p-2 text-right font-medium">₹{fmt(b.net_amount)}</td>
            <td className="p-2 text-right text-green-600">{parseFloat(b.paid_amount)>0?`₹${fmt(b.paid_amount)}`:'—'}</td>
            <td className="p-2 text-right text-red-600 font-medium">{parseFloat(b.balance_amount)>0?`₹${fmt(b.balance_amount)}`:'—'}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${stColor(b.status)}`}>{b.status?.replace('_',' ')}</span></td>
          </tr>))}</tbody></table></div></>}
      </div>}

      {/* ===== OPD BILLING ===== */}
      {tab === 'opd_billing' && <OPDBillingSelector centreId={centreId} staffId={staffId} onFlash={flash} />}

      {/* ===== CHARGE CAPTURE ===== */}
      {tab === 'charges' && <ChargeDashboard centreId={centreId} />}

      {/* ===== BARCODE SCANNER ===== */}
      {tab === 'barcode' && <BarcodeScanner centreId={centreId} onFlash={flash} />}

      {/* ===== AUTO CHARGES ===== */}
      {tab === 'auto_charges' && <AutoChargeEngine centreId={centreId} onFlash={flash} />}

      {/* ===== IPD FINAL BILL ===== */}
      {tab === 'final_bill' && <FinalBillSelector centreId={centreId} staffId={staffId} onFlash={flash} />}

      {/* ===== INSURANCE / CASHLESS ===== */}
      {tab === 'cashless' && <InsuranceCashless claims={cashless.claims} loading={cashless.loading} stats={cashless.stats} centreId={centreId} staffId={staffId}
        onInitPreAuth={cashless.submitPreAuth} onUpdateStatus={async (claimId: string, status: string, data?: any) => { await cashless.updateClaim(claimId, { status, ...data }); }} onLoad={cashless.loadClaims} onFlash={flash} />}

      {/* ===== CORPORATE ===== */}
      {tab === 'corporate' && <CorporateBilling corporates={corporate.corporates} employees={corporate.employees}
        onAdd={async (d: any) => { await corporate.addCorporate(d); flash('Corporate added'); }}
        onLoadEmployees={corporate.loadEmployees} onCreditBills={corporate.creditBills} onFlash={flash} />}

      {/* ===== IPD RUNNING ===== */}
      {tab === 'ipd_billing' && <IPDBillingTab centreId={centreId} staffId={staffId} bills={billing.bills} onFlash={flash}
        onSelectBill={(id: string) => { setSelectedBillId(id); setTab('bills'); }} onReload={billing.load} />}

      {/* ===== AR ===== */}
      {tab === 'ar' && <ARManagement entries={ar.entries} loading={ar.loading} aging={ar.stats} totalOutstanding={ar.entries.reduce((s: number, e: any) => s+parseFloat(e.balance_amount||0), 0)}
        staffId={staffId} onAddFollowup={ar.addFollowup} onWriteOff={ar.writeOff} onLoad={ar.load} onFlash={flash} />}

      {/* ===== ESTIMATES ===== */}
      {tab === 'estimates' && <EstimateGenerator estimates={estimates.estimates} centreId={centreId} staffId={staffId} tariffs={tariffs} onCreate={estimates.create} onFlash={flash} />}

      {/* ===== ADVANCES ===== */}
      {tab === 'advances' && <div>
        <h2 className="font-semibold text-sm mb-3">Advance Deposits</h2>
        <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <h3 className="text-sm font-medium">Collect New Advance</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="relative"><label className="text-xs text-gray-500">Patient *</label>
              <input type="text" value={advForm.search} onChange={e => setAdvForm(f => ({...f, search:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search..." />
              {advPatResults.length>0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow z-10">{advPatResults.map(p => (
                <button key={p.id} onClick={() => {setAdvForm(f => ({...f, patientId:p.id, search:p.first_name+' '+p.last_name})); setAdvPatResults([]);}} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b">{p.first_name} {p.last_name} — {p.uhid}</button>))}</div>}</div>
            <div><label className="text-xs text-gray-500">Amount *</label><input type="number" value={advForm.amount} onChange={e => setAdvForm(f => ({...f, amount:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="₹" /></div>
            <div><label className="text-xs text-gray-500">Mode</label>
              <div className="flex gap-1 mt-1">{['cash','upi','card','neft'].map(m => (
                <button key={m} onClick={() => setAdvForm(f => ({...f, mode:m}))} className={`flex-1 py-1.5 rounded text-[10px] border ${advForm.mode===m?'bg-green-600 text-white':'bg-white'}`}>{m.toUpperCase()}</button>))}</div></div>
            <div className="flex items-end"><button onClick={async () => {
              if(!advForm.patientId||!advForm.amount||!sb()) return;
              await sb().from('hmis_advances').insert({patient_id:advForm.patientId, amount:parseFloat(advForm.amount), payment_mode:advForm.mode, receipt_number:`ADV-${Date.now()}`});
              flash('Advance collected: ₹'+advForm.amount); setAdvForm({search:'',patientId:'',amount:'',mode:'cash'});
            }} disabled={!advForm.patientId||!advForm.amount} className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-40">Collect</button></div>
          </div>
        </div>
      </div>}

      {/* ===== SETTLEMENTS ===== */}
      {tab === 'settlements' && <SettlementReconciliation settlements={settlements.settlements}
        stats={{total:settlements.settlements.length, totalSettled:settlements.settlements.reduce((s: number,se: any) => s+parseFloat(se.settled_amount||0),0), totalTDS:settlements.settlements.reduce((s: number,se: any) => s+parseFloat(se.tds_amount||0),0), totalDisallowance:settlements.settlements.reduce((s: number,se: any) => s+parseFloat(se.disallowance_amount||0),0), unreconciled:settlements.settlements.filter((s: any) => !s.reconciled).length}}
        onRecord={async (d: any) => { await settlements.createSettlement(d, staffId); }} onReconcile={settlements.reconcile} staffId={staffId} onFlash={flash} />}

      {/* ===== REFUNDS ===== */}
      {tab === 'refunds' && <RefundManager centreId={centreId} onFlash={flash} />}

      {/* ===== CREDIT NOTES ===== */}
      {tab === 'credit_notes' && <CreditNoteManager centreId={centreId} onFlash={flash} />}

      {/* ===== GOVT SCHEMES ===== */}
      {tab === 'govt' && <GovtSchemes schemes={govtSchemes.schemes} onFlash={flash} />}

      {/* ===== LOYALTY ===== */}
      {tab === 'loyalty' && <LoyaltyProgram cards={loyalty.cards} onIssue={async (d: any) => { await loyalty.issueCard(d.patient_id, d.card_type, d); }} onFlash={flash} />}

      {/* ===== TARIFF MASTER ===== */}
      {tab === 'tariffs' && <div>
        <h2 className="font-semibold text-sm mb-2">Tariff Master — {tariffs.tariffs.length} Services</h2>
        <div className="flex gap-1 flex-wrap mb-3">{tariffs.categories.map(c => <span key={c} className={`px-2 py-0.5 rounded text-[10px] bg-gray-100 ${catColor(c)} font-medium`}>{c.replace('_',' ')} ({tariffs.tariffs.filter(t => t.category===c).length})</span>)}</div>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Code</th><th className="p-2 text-left">Service</th><th className="p-2">Category</th><th className="p-2 text-right">Self</th><th className="p-2 text-right">Insurance</th><th className="p-2 text-right">PMJAY</th><th className="p-2 text-right">CGHS</th>
        </tr></thead><tbody>{tariffs.tariffs.map((t: any) => (
          <tr key={t.id} className="border-b hover:bg-gray-50">
            <td className="p-2 font-mono text-[10px] text-gray-400">{t.service_code}</td><td className="p-2 font-medium">{t.service_name}</td>
            <td className="p-2 text-center"><span className={`text-[10px] ${catColor(t.category)}`}>{t.category.replace('_',' ')}</span></td>
            <td className="p-2 text-right font-medium">₹{fmt(t.rate_self)}</td>
            <td className="p-2 text-right text-blue-600">{t.rate_insurance?`₹${fmt(t.rate_insurance)}`:'—'}</td>
            <td className="p-2 text-right text-green-600">{t.rate_pmjay?`₹${fmt(t.rate_pmjay)}`:'—'}</td>
            <td className="p-2 text-right text-teal-600">{t.rate_cghs?`₹${fmt(t.rate_cghs)}`:'—'}</td>
          </tr>))}</tbody></table></div>
      </div>}

      {/* ===== PACKAGES ===== */}
      {tab === 'packages' && <PackageBuilder centreId={centreId} onFlash={flash} />}

      {/* ===== DAY END ===== */}
      {tab === 'day_end' && <DayEndSettlement bills={billing.bills} />}

      {/* ===== INTEGRATIONS ===== */}
      {tab === 'integrations' && <IntegrationHub />}
    </div>
  );
}

// Inline: admission selector → IPD Final Bill
function FinalBillSelector({ centreId, staffId, onFlash }: { centreId: string; staffId: string; onFlash: (m: string) => void }) {
  const [admissionId, setAdmissionId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (search.length < 2 || !sb()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_admissions')
        .select('id, ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
        .eq('centre_id', centreId).in('status', ['active', 'discharge_initiated'])
        .or(`ipd_number.ilike.%${search}%`).limit(5);
      setResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search, centreId]);

  if (admissionId) return <IPDFinalBill admissionId={admissionId} centreId={centreId} staffId={staffId} onFlash={onFlash} />;

  return (
    <div className="bg-white rounded-xl border p-8 max-w-lg mx-auto text-center space-y-4">
      <div className="text-3xl">🧾</div>
      <h2 className="font-bold text-lg">Generate IPD Final Bill</h2>
      <p className="text-xs text-gray-500">Search for an active admission to generate consolidated discharge bill</p>
      <div className="relative text-left">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 border rounded-xl text-sm" placeholder="Search IPD number or patient name..." autoFocus />
        {results.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10">
          {results.map((a: any) => (
            <button key={a.id} onClick={() => setAdmissionId(a.id)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b text-sm">
              <span className="font-mono font-medium">{a.ipd_number}</span> — {a.patient.first_name} {a.patient.last_name}
              <span className="text-xs text-gray-400 ml-2">{a.patient.uhid} | Dr. {a.doctor?.full_name}</span>
            </button>
          ))}
        </div>}
      </div>
    </div>
  );
}

// Inline: OPD visit selector → OPD Billing
function OPDBillingSelector({ centreId, staffId, onFlash }: { centreId: string; staffId: string; onFlash: (m: string) => void }) {
  const [selectedVisit, setSelectedVisit] = React.useState<any>(null);
  const [visits, setVisits] = React.useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = React.useState(true);

  React.useEffect(() => {
    if (!sb() || !centreId) return;
    const today = new Date().toISOString().split('T')[0];
    sb().from('hmis_opd_visits')
      .select('id, status, created_at, visit_type, patient:hmis_patients!inner(id, first_name, last_name, uhid, phone_primary, age_years, gender), doctor:hmis_staff!inner(id, full_name, specialisation, staff_type)')
      .eq('centre_id', centreId).gte('created_at', today + 'T00:00:00')
      .in('status', ['completed', 'in_consultation']).order('created_at', { ascending: false }).limit(20)
      .then(({ data }: any) => { setVisits(data || []); setLoadingVisits(false); });
  }, [centreId]);

  if (selectedVisit) {
    const v = selectedVisit;
    return <OPDBilling centreId={centreId} staffId={staffId}
      patient={{ id: v.patient.id, name: `${v.patient.first_name} ${v.patient.last_name}`, uhid: v.patient.uhid, phone: v.patient.phone_primary, age: v.patient.age_years?.toString(), gender: v.patient.gender }}
      doctor={{ id: v.doctor.id, name: v.doctor.full_name, isSuper: v.doctor.specialisation?.length > 0, specialisation: v.doctor.specialisation }}
      visitId={v.id} visitType={v.visit_type || 'new'}
      onFlash={onFlash} onDone={() => setSelectedVisit(null)} />;
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-sm">OPD Billing — Select Completed Visit</h2>
      {loadingVisits ? <div className="animate-pulse h-24 bg-gray-200 rounded-xl" /> :
      visits.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No completed OPD visits today</div> :
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Patient</th><th className="p-2">Doctor</th><th className="p-2">Type</th><th className="p-2">Time</th><th className="p-2"></th>
        </tr></thead><tbody>{visits.map((v: any) => (
          <tr key={v.id} className="border-b hover:bg-blue-50">
            <td className="p-2"><span className="font-medium">{v.patient.first_name} {v.patient.last_name}</span><span className="text-gray-400 ml-1 text-[10px]">{v.patient.uhid}</span></td>
            <td className="p-2">Dr. {v.doctor.full_name}</td>
            <td className="p-2 text-center"><span className="text-[9px] bg-gray-100 px-1 py-0.5 rounded">{v.visit_type || 'new'}</span></td>
            <td className="p-2 text-center text-gray-400">{new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
            <td className="p-2"><button onClick={() => setSelectedVisit(v)} className="px-3 py-1 bg-green-600 text-white text-[10px] rounded">Bill →</button></td>
          </tr>
        ))}</tbody></table>
      </div>}
    </div>
  );
}

export default function BillingPage() { return <RoleGuard module="billing"><BillingInner /></RoleGuard>; }
