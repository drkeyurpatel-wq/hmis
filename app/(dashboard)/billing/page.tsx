'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createBrowserClient } from '@supabase/ssr';
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

function sb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

type Tab = 'dashboard' | 'new_bill' | 'bills' | 'ipd' | 'cashless' | 'estimates' | 'ar' | 'advances' | 'refunds' | 'credit_notes';

function BillingInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [tab, setTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Bills list
  const [bills, setBills] = useState<any[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  // Cashless
  const cashless = useCashlessWorkflow(centreId);
  const ar = useAccountsReceivable(centreId);
  const tariffs = useTariffs(centreId);
  const estimates = useEstimates(centreId);

  // Advances
  const [advances, setAdvances] = useState<any[]>([]);
  const [advForm, setAdvForm] = useState({ search: '', patientId: '', patientName: '', amount: '', mode: 'cash' });
  const [advPatResults, setAdvPatResults] = useState<any[]>([]);

  // Load bills
  const loadBills = useCallback(async () => {
    if (!centreId) return;
    setBillsLoading(true);
    const { data } = await sb().from('hmis_bills')
      .select('id, bill_number, bill_type, bill_date, payor_type, gross_amount, discount_amount, net_amount, paid_amount, balance_amount, status, patient:hmis_patients!inner(first_name, last_name, uhid)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(100);
    setBills(data || []);
    setBillsLoading(false);
  }, [centreId]);

  // Load advances
  const loadAdvances = useCallback(async () => {
    if (!centreId) return;
    const { data } = await sb().from('hmis_advances')
      .select('id, amount, payment_mode, receipt_number, created_at, is_adjusted, patient:hmis_patients!inner(first_name, last_name, uhid)')
      .order('created_at', { ascending: false }).limit(50);
    setAdvances(data || []);
  }, [centreId]);

  useEffect(() => { loadBills(); loadAdvances(); }, [loadBills, loadAdvances]);

  // Patient search for advances
  useEffect(() => {
    if (advForm.search.length < 2) { setAdvPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients')
        .select('id, first_name, last_name, uhid')
        .or(`uhid.ilike.%${advForm.search}%,first_name.ilike.%${advForm.search}%,last_name.ilike.%${advForm.search}%`)
        .eq('is_active', true).limit(5);
      setAdvPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [advForm.search]);

  const collectAdvance = async () => {
    if (!advForm.patientId || !advForm.amount) return;
    const { data: receiptNo } = await sb().rpc('hmis_next_sequence', { p_centre_id: centreId, p_type: 'advance' });
    await sb().from('hmis_advances').insert({
      patient_id: advForm.patientId, amount: parseFloat(advForm.amount),
      payment_mode: advForm.mode, receipt_number: receiptNo || `ADV-${Date.now()}`,
      centre_id: centreId, collected_by: staffId,
    });
    flash(`Advance ₹${advForm.amount} collected`);
    setAdvForm({ search: '', patientId: '', patientName: '', amount: '', mode: 'cash' });
    loadAdvances();
  };

  const TABS: [Tab, string][] = [
    ['dashboard', '📊 Dashboard'],
    ['new_bill', '💵 New Bill'],
    ['bills', `📄 Bills (${bills.length})`],
    ['ipd', '🛏️ IPD Billing'],
    ['cashless', '🏥 Insurance'],
    ['estimates', '📋 Estimates'],
    ['ar', '📊 AR / Outstanding'],
    ['advances', '💰 Advances'],
    ['refunds', '↩️ Refunds'],
    ['credit_notes', '📝 Credit Notes'],
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Billing & Revenue</h1>
          <p className="text-xs text-gray-500">Health1 — {staff?.full_name}</p></div>
        <button onClick={() => setTab('new_bill')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">+ New Bill</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b pb-1">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); if (key === 'bills') loadBills(); }}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap ${tab === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === 'dashboard' && <RevenueDashboard centreId={centreId} />}

      {/* New Bill */}
      {tab === 'new_bill' && <ServiceBillingEngine centreId={centreId} staffId={staffId} mode="general"
        onDone={() => { loadBills(); setTab('bills'); }} onFlash={flash} />}

      {/* Bills List + Detail */}
      {tab === 'bills' && <div>
        {selectedBillId ? (
          <BillDetailView billId={selectedBillId} centreId={centreId} staffId={staffId}
            onFlash={flash} onClose={() => { setSelectedBillId(null); loadBills(); }} />
        ) : (
          <div>
            <div className="bg-white rounded-xl border overflow-hidden">
              {billsLoading ? <div className="p-8 text-center text-gray-400 text-sm">Loading bills...</div> :
              <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
                <th className="p-2 text-left">Bill #</th><th className="p-2 text-left">Patient</th><th className="p-2">Date</th>
                <th className="p-2">Type</th><th className="p-2">Payor</th><th className="p-2 text-right">Net</th>
                <th className="p-2 text-right">Paid</th><th className="p-2 text-right">Balance</th><th className="p-2">Status</th>
              </tr></thead><tbody>
                {bills.map(b => (
                  <tr key={b.id} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedBillId(b.id)}>
                    <td className="p-2 font-mono text-[10px]">{b.bill_number}</td>
                    <td className="p-2"><span className="font-medium">{b.patient?.first_name} {b.patient?.last_name}</span> <span className="text-[10px] text-gray-400">{b.patient?.uhid}</span></td>
                    <td className="p-2 text-center text-gray-500">{b.bill_date}</td>
                    <td className="p-2 text-center"><span className="bg-gray-100 px-1 py-0.5 rounded text-[9px]">{b.bill_type}</span></td>
                    <td className="p-2 text-center"><span className="text-[9px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded">{b.payor_type?.replace('_', ' ')}</span></td>
                    <td className="p-2 text-right font-medium">₹{fmt(b.net_amount)}</td>
                    <td className="p-2 text-right text-green-600">{parseFloat(b.paid_amount) > 0 ? `₹${fmt(b.paid_amount)}` : '—'}</td>
                    <td className="p-2 text-right text-red-600 font-medium">{parseFloat(b.balance_amount) > 0 ? `₹${fmt(b.balance_amount)}` : '—'}</td>
                    <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${b.status === 'paid' ? 'bg-green-100 text-green-700' : b.status === 'partially_paid' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100'}`}>{b.status?.replace('_', ' ')}</span></td>
                  </tr>
                ))}
                {bills.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-gray-400">No bills found</td></tr>}
              </tbody></table>}
            </div>
          </div>
        )}
      </div>}

      {/* IPD Billing */}
      {tab === 'ipd' && <IPDBillingTab centreId={centreId} staffId={staffId} bills={bills}
        onSelectBill={(id) => { setSelectedBillId(id); setTab('bills'); }} onReload={loadBills} onFlash={flash} />}

      {/* Insurance / Cashless */}
      {tab === 'cashless' && <InsuranceCashless claims={cashless.claims} loading={cashless.loading}
        stats={cashless.stats} centreId={centreId} staffId={staffId}
        onInitPreAuth={cashless.submitPreAuth}
        onUpdateStatus={async (claimId: string, status: string, data?: any) => { await cashless.updateClaim(claimId, { status, ...data }); }}
        onLoad={cashless.loadClaims} onFlash={flash} />}

      {/* Estimates */}
      {tab === 'estimates' && <EstimateGenerator estimates={estimates.estimates} centreId={centreId} staffId={staffId}
        tariffs={tariffs} onCreate={estimates.create} onFlash={flash} />}

      {/* AR / Outstanding */}
      {tab === 'ar' && <ARManagement entries={ar.entries} loading={ar.loading} aging={ar.stats}
        totalOutstanding={ar.entries.reduce((s: number, e: any) => s + parseFloat(e.balance_amount || 0), 0)}
        staffId={staffId} onAddFollowup={ar.addFollowup} onWriteOff={ar.writeOff} onLoad={ar.load} onFlash={flash} />}

      {/* Advances */}
      {tab === 'advances' && <div className="space-y-4">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-bold">Collect Advance</h3>
          <div className="grid grid-cols-5 gap-3 items-end">
            <div className="relative col-span-2">
              <label className="text-[10px] font-semibold text-gray-500">Patient *</label>
              {advForm.patientId ? (
                <div className="flex items-center gap-2 mt-1"><span className="text-sm font-medium">{advForm.patientName}</span>
                  <button onClick={() => setAdvForm(f => ({ ...f, patientId: '', patientName: '', search: '' }))} className="text-xs text-red-500">✕</button></div>
              ) : (
                <><input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={advForm.search}
                  onChange={e => setAdvForm(f => ({ ...f, search: e.target.value }))} placeholder="Search patient..." />
                  {advPatResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow max-h-32 overflow-y-auto">
                    {advPatResults.map(p => <button key={p.id} onClick={() => { setAdvForm(f => ({ ...f, patientId: p.id, patientName: `${p.first_name} ${p.last_name} (${p.uhid})`, search: '' })); setAdvPatResults([]); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{p.first_name} {p.last_name} — {p.uhid}</button>)}</div>}</>
              )}
            </div>
            <div><label className="text-[10px] font-semibold text-gray-500">Amount *</label>
              <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={advForm.amount}
                onChange={e => setAdvForm(f => ({ ...f, amount: e.target.value }))} placeholder="₹" /></div>
            <div><label className="text-[10px] font-semibold text-gray-500">Mode</label>
              <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={advForm.mode}
                onChange={e => setAdvForm(f => ({ ...f, mode: e.target.value }))}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="neft">NEFT</option>
              </select></div>
            <button onClick={collectAdvance} disabled={!advForm.patientId || !advForm.amount}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Collect</button>
          </div>
        </div>

        {/* Advances list */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Receipt</th><th className="p-2 text-left">Patient</th><th className="p-2">Date</th>
            <th className="p-2">Mode</th><th className="p-2 text-right">Amount</th><th className="p-2">Status</th>
          </tr></thead><tbody>
            {advances.map(a => (
              <tr key={a.id} className="border-b">
                <td className="p-2 font-mono text-[10px]">{a.receipt_number}</td>
                <td className="p-2 font-medium">{a.patient?.first_name} {a.patient?.last_name} <span className="text-gray-400 text-[10px]">{a.patient?.uhid}</span></td>
                <td className="p-2 text-center text-gray-500">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                <td className="p-2 text-center capitalize">{a.payment_mode}</td>
                <td className="p-2 text-right font-bold text-green-700">₹{fmt(a.amount)}</td>
                <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded ${a.is_adjusted ? 'bg-gray-100' : 'bg-green-100 text-green-700'}`}>{a.is_adjusted ? 'Adjusted' : 'Available'}</span></td>
              </tr>
            ))}
            {advances.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400">No advances collected</td></tr>}
          </tbody></table>
        </div>
      </div>}

      {/* Refunds */}
      {tab === 'refunds' && <RefundManager centreId={centreId} onFlash={flash} />}

      {/* Credit Notes */}
      {tab === 'credit_notes' && <CreditNoteManager centreId={centreId} onFlash={flash} />}
    </div>
  );
}

export default function BillingPage() { return <RoleGuard module="billing"><BillingInner /></RoleGuard>; }
