'use client';
import Link from 'next/link';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  CreditCard, Plus, Search, FileText, Shield, ArrowDownLeft, Receipt,
  TrendingUp, IndianRupee, Clock, Filter, ChevronRight, Download,
} from 'lucide-react';
import RevenueDashboard from '@/components/billing/revenue-dashboard';
import ServiceBillingEngine from '@/components/billing/service-billing-engine';
import BillDetailView from '@/components/billing/bill-detail-view';
import IPDBillingTab from '@/components/billing/ipd-billing-tab';
import InsuranceCashless from '@/components/billing/insurance-cashless';
import RefundManager from '@/components/billing/refund-manager';
import CreditNoteManager from '@/components/billing/credit-note-manager';
import EstimateGenerator from '@/components/billing/estimate-generator';
import ARManagement from '@/components/billing/ar-management';
import { useCashlessWorkflow, useAccountsReceivable } from '@/lib/billing/revenue-cycle-hooks';
import { useTariffs, useEstimates } from '@/lib/billing/billing-hooks';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

type Tab = 'bills' | 'ipd' | 'insurance' | 'collections';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'bills', label: 'Bills', icon: FileText },
  { key: 'ipd', label: 'IPD Billing', icon: CreditCard },
  { key: 'insurance', label: 'Insurance', icon: Shield },
  { key: 'collections', label: 'Collections', icon: IndianRupee },
];

function BillingInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [tab, setTab] = useState<Tab>('bills');
  const [showNewBill, setShowNewBill] = useState(false);
  const [collectionsView, setCollectionsView] = useState<'estimates'|'ar'|'advances'|'refunds'|'credit_notes'>('ar');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [bills, setBills] = useState<any[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [billSearch, setBillSearch] = useState('');
  const [billFilter, setBillFilter] = useState<string>('all');

  const cashless = useCashlessWorkflow(centreId);
  const ar = useAccountsReceivable(centreId);
  const tariffs = useTariffs(centreId);
  const estimates = useEstimates(centreId);

  const [advances, setAdvances] = useState<any[]>([]);
  const [advForm, setAdvForm] = useState({ search: '', patientId: '', patientName: '', amount: '', mode: 'cash' });
  const [advPatResults, setAdvPatResults] = useState<any[]>([]);

  const loadBills = useCallback(async () => {
    if (!centreId) return;
    setBillsLoading(true);
    const { data } = await sb()!.from('hmis_bills')
      .select('id, bill_number, bill_type, bill_date, payor_type, gross_amount, discount_amount, net_amount, paid_amount, balance_amount, status, patient:hmis_patients!inner(first_name, last_name, uhid)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(200);
    setBills(data || []);
    setBillsLoading(false);
  }, [centreId]);

  const loadAdvances = useCallback(async () => {
    if (!centreId) return;
    const { data } = await sb()!.from('hmis_advances')
      .select('id, amount, payment_mode, receipt_number, created_at, is_adjusted, patient:hmis_patients!inner(first_name, last_name, uhid)')
      .order('created_at', { ascending: false }).limit(50);
    setAdvances(data || []);
  }, [centreId]);

  useEffect(() => { loadBills(); loadAdvances(); }, [loadBills, loadAdvances]);

  // Patient search for advances
  useEffect(() => {
    if (advForm.search.length < 2) { setAdvPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients')
        .select('id, first_name, last_name, uhid')
        .or(`uhid.ilike.%${advForm.search}%,first_name.ilike.%${advForm.search}%,last_name.ilike.%${advForm.search}%`)
        .eq('is_active', true).limit(5);
      setAdvPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [advForm.search]);

  const collectAdvance = async () => {
    if (!advForm.patientId || !advForm.amount) return;
    const { data: receiptNo } = await sb()!.rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'advance' });
    await sb()!.from('hmis_advances').insert({
      patient_id: advForm.patientId, amount: parseFloat(advForm.amount),
      payment_mode: advForm.mode, receipt_number: receiptNo || `ADV-${Date.now()}`,
      centre_id: centreId, collected_by: staffId,
    });
    flash(`Advance ₹${advForm.amount} collected`);
    setAdvForm({ search: '', patientId: '', patientName: '', amount: '', mode: 'cash' });
    loadAdvances();
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    let filtered = bills;
    if (billFilter !== 'all') filtered = filtered.filter(b => b.status === billFilter);
    if (billSearch) {
      const q = billSearch.toLowerCase();
      filtered = filtered.filter(b =>
        b.bill_number?.toLowerCase().includes(q) ||
        b.patient?.first_name?.toLowerCase().includes(q) ||
        b.patient?.last_name?.toLowerCase().includes(q) ||
        b.patient?.uhid?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [bills, billFilter, billSearch]);

  // Quick stats
  const billStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayBills = bills.filter(b => b.bill_date === today);
    return {
      totalToday: todayBills.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0),
      collectedToday: todayBills.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || 0), 0),
      pendingToday: todayBills.reduce((s: number, b: any) => s + parseFloat(b.balance_amount || 0), 0),
      countToday: todayBills.length,
      unpaid: bills.filter(b => parseFloat(b.balance_amount || 0) > 0 && b.status !== 'cancelled').length,
    };
  }, [bills]);

  const stBadge = (s: string) => {
    const m: Record<string, string> = {
      paid: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-h1-success', partially_paid: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-h1-yellow-light text-h1-yellow',
      final: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-h1-teal-light text-h1-teal', draft: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600',
      cancelled: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700',
    };
    return m[s] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600';
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-h1-navy text-white px-5 py-2.5 rounded-xl shadow-lg shadow-h1-teal/20 text-sm font-medium animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Billing & Revenue</h1>
          <p className="text-xs text-gray-400 mt-0.5">{staff?.full_name} · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
        <button onClick={() => setShowNewBill(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-h1-navy text-white text-sm rounded-xl font-semibold hover:bg-h1-navy/90 transition-colors shadow-sm shadow-h1-teal/20">
          <Plus size={16} /> New Bill
        </button>
      </div>

      {/* Quick stats strip */}
      {tab === 'bills' && !selectedBillId && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Billed Today', value: INR(billStats.totalToday), color: 'text-gray-800' },
            { label: 'Collected', value: INR(billStats.collectedToday), color: 'text-h1-success' },
            { label: 'Pending', value: INR(billStats.pendingToday), color: billStats.pendingToday > 0 ? 'text-red-600' : 'text-gray-400' },
            { label: 'Bills Today', value: String(billStats.countToday), color: 'text-h1-teal' },
            { label: 'Unpaid Bills', value: String(billStats.unpaid), color: billStats.unpaid > 0 ? 'text-h1-yellow' : 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</div>
              <div className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key}
            onClick={() => { setTab(key); if (key === 'bills') loadBills(); if (key === 'collections') loadAdvances(); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-all duration-150 ${
              tab === key
                ? 'bg-h1-navy text-white shadow-sm shadow-h1-teal/15'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50 hover:text-gray-700'
            }`}>
            <Icon size={13} />
            {label}
            {key === 'bills' && bills.length > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-white/20' : 'bg-gray-100'}`}>{bills.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB CONTENT ═══ */}

      {tab === 'bills' && !selectedBillId && false /* dashboard moved to bills header */ && <RevenueDashboard centreId={centreId} />}

      {tab === 'bills' && showNewBill && <ServiceBillingEngine centreId={centreId} staffId={staffId} mode="general"
        onDone={() => { loadBills(); setTab('bills'); setShowNewBill(false); }} onFlash={flash} />}

      {/* Bills */}
      {tab === 'bills' && (
        <div>
          {selectedBillId ? (
            <BillDetailView billId={selectedBillId} centreId={centreId} staffId={staffId}
              onFlash={flash} onClose={() => { setSelectedBillId(null); loadBills(); }} />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Search + filters */}
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={billSearch} onChange={e => setBillSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-h1-teal/20 focus:border-h1-teal bg-gray-50/50"
                    placeholder="Search bill #, patient, UHID..." />
                </div>
                <div className="flex gap-1">
                  {['all', 'paid', 'partially_paid', 'final', 'draft'].map(f => (
                    <button key={f} onClick={() => setBillFilter(f)}
                      className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${
                        billFilter === f ? 'bg-h1-navy-light text-h1-navy border border-h1-teal/30' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}>{f === 'all' ? 'All' : f.replace('_', ' ')}</button>
                  ))}
                </div>
                <span className="text-[10px] text-gray-400 ml-auto">{filteredBills.length} bills</span>
              </div>

              {/* Table */}
              {billsLoading ? (
                <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th>Bill #</th><th>Patient</th><th>Date</th><th>Type</th><th>Payor</th>
                      <th className="text-right">Net</th><th className="text-right">Paid</th>
                      <th className="text-right">Balance</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map(b => (
                      <tr key={b.id} className="cursor-pointer" onClick={() => setSelectedBillId(b.id)}>
                        <td><span className="font-mono text-[10px] text-gray-500">{b.bill_number}</span></td>
                        <td>
                          <div className="font-semibold text-gray-800">{b.patient?.first_name} {b.patient?.last_name}</div>
                          <div className="text-[10px] text-gray-400">{b.patient?.uhid}</div>
                        </td>
                        <td className="text-gray-500">{b.bill_date ? new Date(b.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                        <td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{b.bill_type}</span></td>
                        <td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-h1-teal-light text-h1-teal">{b.payor_type?.replace('_', ' ')}</span></td>
                        <td className="text-right font-semibold">₹{fmt(b.net_amount)}</td>
                        <td className="text-right text-h1-success font-medium">{parseFloat(b.paid_amount) > 0 ? `₹${fmt(b.paid_amount)}` : '—'}</td>
                        <td className="text-right">
                          {parseFloat(b.balance_amount) > 0
                            ? <span className="font-semibold text-red-600">₹{fmt(b.balance_amount)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td><span className={stBadge(b.status)}>{b.status?.replace('_', ' ')}</span></td>
                      </tr>
                    ))}
                    {filteredBills.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                        {billSearch ? `No bills matching "${billSearch}"` : 'No bills found'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'ipd' && <IPDBillingTab centreId={centreId} staffId={staffId} bills={bills}
        onSelectBill={(id) => { setSelectedBillId(id); setTab('bills'); setShowNewBill(false); }} onReload={loadBills} onFlash={flash} />}

      {tab === 'insurance' && <InsuranceCashless claims={cashless.claims} loading={cashless.loading}
        stats={cashless.stats} centreId={centreId} staffId={staffId}
        onInitPreAuth={cashless.submitPreAuth}
        onUpdateStatus={async (claimId: string, status: string, data?: any) => { await cashless.updateClaim(claimId, { status, ...data }); }}
        onLoad={cashless.loadClaims} onFlash={flash} />}

      {tab === 'collections' && collectionsView === 'estimates' && <EstimateGenerator estimates={estimates.estimates} centreId={centreId} staffId={staffId}
        tariffs={tariffs} onCreate={estimates.create} onFlash={flash} />}

      {tab === 'collections' && collectionsView === 'ar' && <ARManagement entries={ar.entries} loading={ar.loading} aging={ar.stats}
        totalOutstanding={ar.entries.reduce((s: number, e: any) => s + parseFloat(e.balance_amount || 0), 0)}
        staffId={staffId} onAddFollowup={ar.addFollowup} onWriteOff={ar.writeOff} onLoad={ar.load} onFlash={flash} />}

      {/* Advances */}
      {tab === 'collections' && collectionsView === 'advances' && (
        <div className="space-y-4">
          {/* Collect form */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Collect Advance</h3>
            <div className="grid grid-cols-5 gap-3 items-end">
              <div className="relative col-span-2">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Patient *</label>
                {advForm.patientId ? (
                  <div className="flex items-center gap-2 mt-1.5 px-3 py-2 bg-h1-navy-light rounded-xl border border-h1-teal/30">
                    <span className="text-sm font-semibold text-h1-navy flex-1">{advForm.patientName}</span>
                    <button onClick={() => setAdvForm(f => ({ ...f, patientId: '', patientName: '', search: '' }))}
                      className="text-h1-text-muted hover:text-red-500 text-xs transition-colors">✕</button>
                  </div>
                ) : (
                  <>
                    <input className="w-full mt-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-h1-teal/20 focus:border-h1-teal bg-gray-50/50"
                      value={advForm.search} onChange={e => setAdvForm(f => ({ ...f, search: e.target.value }))} placeholder="Search patient..." />
                    {advPatResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-36 overflow-y-auto">
                        {advPatResults.map(p => (
                          <button key={p.id} onClick={() => { setAdvForm(f => ({ ...f, patientId: p.id, patientName: `${p.first_name} ${p.last_name} (${p.uhid})`, search: '' })); setAdvPatResults([]); }}
                            className="w-full text-left px-3 py-2.5 text-xs hover:bg-h1-navy-light border-b border-gray-50 last:border-0 transition-colors">
                            <span className="font-medium">{p.first_name} {p.last_name}</span> <span className="text-gray-400">· {p.uhid}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount *</label>
                <input type="number" className="w-full mt-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-h1-teal/20 focus:border-h1-teal bg-gray-50/50"
                  value={advForm.amount} onChange={e => setAdvForm(f => ({ ...f, amount: e.target.value }))} placeholder="₹" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Mode</label>
                <div className="flex gap-1 mt-1.5">
                  {['cash', 'upi', 'card', 'neft'].map(m => (
                    <button key={m} onClick={() => setAdvForm(f => ({ ...f, mode: m }))}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-semibold transition-colors ${
                        advForm.mode === m ? 'bg-h1-navy text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>{m.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <button onClick={collectAdvance} disabled={!advForm.patientId || !advForm.amount}
                className="px-4 py-2.5 bg-h1-success text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-h1-success transition-colors shadow-sm">
                Collect
              </button>
            </div>
          </div>

          {/* Advances table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h3 className="text-xs font-bold text-gray-700">Advance Deposits ({advances.length})</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr><th>Receipt</th><th>Patient</th><th>Date</th><th>Mode</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {advances.map(a => (
                  <tr key={a.id}>
                    <td><span className="font-mono text-[10px] text-gray-500">{a.receipt_number}</span></td>
                    <td>
                      <div className="font-semibold text-gray-800">{a.patient?.first_name} {a.patient?.last_name}</div>
                      <div className="text-[10px] text-gray-400">{a.patient?.uhid}</div>
                    </td>
                    <td className="text-gray-500">{new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 capitalize">{a.payment_mode}</span></td>
                    <td className="text-right font-bold text-h1-success">₹{fmt(a.amount)}</td>
                    <td><span className={a.is_adjusted ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-h1-success'}>{a.is_adjusted ? 'Adjusted' : 'Available'}</span></td>
                  </tr>
                ))}
                {advances.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No advances collected</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'collections' && collectionsView === 'refunds' && <RefundManager centreId={centreId} onFlash={flash} />}
      {tab === 'collections' && collectionsView === 'credit_notes' && <CreditNoteManager centreId={centreId} onFlash={flash} />}
    </div>
  );
}

export default function BillingPage() { return <RoleGuard module="billing"><BillingInner /></RoleGuard>; }
