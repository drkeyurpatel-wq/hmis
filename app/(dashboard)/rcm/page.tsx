'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  IndianRupee, FileText, Users, Clock, Shield, TrendingUp,
  Search, Filter, ChevronDown, Check, X, Lock, Eye, Download,
  AlertCircle, Pause, Play, Settings, ArrowUpRight,
} from 'lucide-react';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

type Tab = 'dashboard' | 'payouts' | 'settlements' | 'contracts' | 'holds';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: TrendingUp },
  { key: 'payouts', label: 'Payout Ledger', icon: IndianRupee },
  { key: 'settlements', label: 'Settlements', icon: FileText },
  { key: 'contracts', label: 'Contracts', icon: Users },
  { key: 'holds', label: 'Hold Bucket', icon: Clock },
];

function RCMInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [tab, setTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Revenue Cycle Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Doctor Payout Engine</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('contracts')}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" /> Manage Contracts
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'dashboard' && <DashboardTab centreId={centreId} />}
        {tab === 'payouts' && <PayoutLedgerTab centreId={centreId} flash={flash} />}
        {tab === 'settlements' && <SettlementsTab centreId={centreId} flash={flash} />}
        {tab === 'contracts' && <ContractsTab centreId={centreId} flash={flash} />}
        {tab === 'holds' && <HoldBucketTab centreId={centreId} />}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ============================================================
// DASHBOARD TAB
// ============================================================
function DashboardTab({ centreId }: { centreId: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().substring(0, 7));

  useEffect(() => {
    async function load() {
      setLoading(true);
      const s = sb();

      const [payoutRes, settleRes, holdRes, contractRes] = await Promise.all([
        s.from('hmis_doctor_payout_items').select('calculated_amount, payor_type, is_held', { count: 'exact' })
          .eq('centre_id', centreId).eq('service_month', month),
        s.from('hmis_doctor_settlements').select('status, net_payout, total_pool', { count: 'exact' })
          .eq('centre_id', centreId).eq('month', month),
        s.from('hmis_doctor_hold_bucket').select('calculated_amount, payor_type', { count: 'exact' })
          .eq('centre_id', centreId).eq('status', 'PENDING'),
        s.from('hmis_doctor_contracts').select('id', { count: 'exact' })
          .eq('centre_id', centreId).eq('is_active', true),
      ]);

      const payouts = payoutRes.data || [];
      const settlements = settleRes.data || [];
      const holds = holdRes.data || [];

      setStats({
        totalDoctorShare: payouts.reduce((s: number, p: any) => s + Number(p.calculated_amount || 0), 0),
        payoutCount: payoutRes.count || 0,
        cashPool: payouts.filter((p: any) => p.payor_type === 'Cash').reduce((s: number, p: any) => s + Number(p.calculated_amount || 0), 0),
        tpaPool: payouts.filter((p: any) => p.payor_type === 'TPA').reduce((s: number, p: any) => s + Number(p.calculated_amount || 0), 0),
        pmjayPool: payouts.filter((p: any) => p.payor_type === 'PMJAY').reduce((s: number, p: any) => s + Number(p.calculated_amount || 0), 0),
        govtPool: payouts.filter((p: any) => p.payor_type === 'Govt').reduce((s: number, p: any) => s + Number(p.calculated_amount || 0), 0),
        settlementsCount: settleRes.count || 0,
        settlementsPaid: settlements.filter((s: any) => s.status === 'paid').length,
        settlementsComputed: settlements.filter((s: any) => s.status === 'computed').length,
        settlementsApproved: settlements.filter((s: any) => s.status === 'approved').length,
        heldTotal: holds.reduce((s: number, h: any) => s + Number(h.calculated_amount || 0), 0),
        heldCount: holdRes.count || 0,
        activeContracts: contractRes.count || 0,
      });
      setLoading(false);
    }
    if (centreId) load();
  }, [centreId, month]);

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}</div>;
  if (!stats) return <div className="text-gray-400 text-center py-12">No data</div>;

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Month:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm" />
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Doctor Share" value={INR(stats.totalDoctorShare)} sub={`${stats.payoutCount} items`} color="teal" icon={IndianRupee} />
        <StatCard label="Active Contracts" value={stats.activeContracts} sub="doctors" color="blue" icon={Users} />
        <StatCard label="Held Amount" value={INR(stats.heldTotal)} sub={`${stats.heldCount} items pending`} color="amber" icon={Clock} />
        <StatCard label="Settlements" value={stats.settlementsCount} sub={`${stats.settlementsPaid} paid, ${stats.settlementsComputed} pending`} color="green" icon={FileText} />
      </div>

      {/* Pool breakdown */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Pool Breakdown — {month}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PoolBar label="Cash" amount={stats.cashPool} total={stats.totalDoctorShare} color="bg-green-500" />
          <PoolBar label="TPA" amount={stats.tpaPool} total={stats.totalDoctorShare} color="bg-blue-500" />
          <PoolBar label="PMJAY" amount={stats.pmjayPool} total={stats.totalDoctorShare} color="bg-amber-500" />
          <PoolBar label="Govt" amount={stats.govtPool} total={stats.totalDoctorShare} color="bg-purple-500" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon: Icon }: any) {
  const colors: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700', blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700', green: 'bg-green-50 text-green-700',
  };
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function PoolBar({ label, amount, total, color }: any) {
  const pct = total > 0 ? (amount / total * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{INR(amount)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}%</p>
    </div>
  );
}

// ============================================================
// PAYOUT LEDGER TAB
// ============================================================
function PayoutLedgerTab({ centreId, flash }: { centreId: string; flash: (m: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().substring(0, 7));
  const [search, setSearch] = useState('');
  const [payorFilter, setPayorFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb().from('hmis_doctor_payout_items')
      .select('*, doctor:hmis_staff!hmis_doctor_payout_items_doctor_id_fkey(full_name, specialisation)')
      .eq('service_month', month)
      .order('bill_date', { ascending: false })
      .limit(200);

    if (centreId) q = q.eq('centre_id', centreId);
    if (payorFilter !== 'all') q = q.eq('payor_type', payorFilter);

    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  }, [centreId, month, payorFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i =>
    !search || (i.doctor?.full_name || '').toLowerCase().includes(search.toLowerCase())
    || (i.patient_name || '').toLowerCase().includes(search.toLowerCase())
    || (i.bill_no || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAmt = filtered.reduce((s, i) => s + Number(i.calculated_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm" />
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="Search doctor, patient, bill..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={payorFilter} onChange={e => setPayorFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Payors</option>
          <option value="Cash">Cash</option>
          <option value="TPA">TPA</option>
          <option value="PMJAY">PMJAY</option>
          <option value="Govt">Govt</option>
        </select>
        <div className="ml-auto text-sm font-medium text-gray-600">
          {filtered.length} items · <span className="text-teal-700">₹{fmt(totalAmt)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Doctor</th>
              <th className="px-4 py-3 text-left">Patient / Bill</th>
              <th className="px-4 py-3 text-left">Payor</th>
              <th className="px-4 py-3 text-left">Department</th>
              <th className="px-4 py-3 text-right">Service</th>
              <th className="px-4 py-3 text-right">Dr Share</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No payout items found</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[140px]">{item.doctor?.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">{item.doctor?.specialisation || ''}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700 truncate max-w-[120px]">{item.patient_name}</p>
                  <p className="text-xs text-gray-400">{item.bill_no} · {item.bill_date}</p>
                </td>
                <td className="px-4 py-3">
                  <PayorBadge payor={item.payor_type} />
                </td>
                <td className="px-4 py-3 text-gray-600 truncate max-w-[100px]">{item.department}</td>
                <td className="px-4 py-3 text-right text-gray-600">₹{fmt(item.service_amt)}</td>
                <td className="px-4 py-3 text-right font-semibold text-teal-700">₹{fmt(item.calculated_amount)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500" title={item.formula_description}>
                    {item.base_method_used} · {Number(item.pct_applied || 0)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {item.is_held ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs">
                      <Clock className="w-3 h-3" /> Held
                    </span>
                  ) : item.settlement_id ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">
                      <Check className="w-3 h-3" /> Settled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                      Ready
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// SETTLEMENTS TAB
// ============================================================
function SettlementsTab({ centreId, flash }: { centreId: string; flash: (m: string) => void }) {
  const { staff } = useAuthStore();
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().substring(0, 7));
  const [statusFilter, setStatusFilter] = useState('all');
  const [computing, setComputing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb().from('hmis_doctor_settlements')
      .select('*, doctor:hmis_staff!hmis_doctor_settlements_doctor_id_fkey(full_name, specialisation, employee_code)')
      .eq('month', month)
      .order('net_payout', { ascending: false });

    if (centreId) q = q.eq('centre_id', centreId);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);

    const { data } = await q.limit(200);
    setSettlements(data || []);
    setLoading(false);
  }, [centreId, month, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const computeAll = async () => {
    setComputing(true);
    // Get all doctors with payout items for this month that don't have settlements yet
    const { data: doctors } = await sb().from('hmis_doctor_payout_items')
      .select('doctor_id')
      .eq('centre_id', centreId)
      .eq('service_month', month)
      .is('settlement_id', null);

    const uniqueDocs = [...new Set((doctors || []).map(d => d.doctor_id))];

    let computed = 0;
    for (const docId of uniqueDocs) {
      const res = await fetch('/api/rcm/compute-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: docId, centre_id: centreId, month, user_id: staff?.id }),
      });
      if (res.ok) computed++;
    }

    flash(`${computed} settlements computed`);
    setComputing(false);
    load();
  };

  const updateStatus = async (id: string, action: string) => {
    const res = await fetch('/api/rcm/settlements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlement_id: id, action, user_id: staff?.id }),
    });
    if (res.ok) {
      flash(`Settlement ${action}d`);
      load();
    }
  };

  const totalNet = settlements.reduce((s, st) => s + Number(st.net_payout || 0), 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="computed">Computed</option>
          <option value="approved">Approved</option>
          <option value="locked">Locked</option>
          <option value="paid">Paid</option>
        </select>
        <button onClick={computeAll} disabled={computing}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
          {computing ? <span className="animate-spin">⟳</span> : <TrendingUp className="w-4 h-4" />}
          {computing ? 'Computing...' : 'Compute All'}
        </button>
        <div className="ml-auto text-sm font-medium text-gray-600">
          {settlements.length} settlements · <span className="text-teal-700">₹{fmt(totalNet)} net</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Doctor</th>
              <th className="px-4 py-3 text-right">Cash</th>
              <th className="px-4 py-3 text-right">TPA</th>
              <th className="px-4 py-3 text-right">PMJAY</th>
              <th className="px-4 py-3 text-right">Govt</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">TDS</th>
              <th className="px-4 py-3 text-right font-semibold">Net</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : settlements.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No settlements for {month}</td></tr>
            ) : settlements.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[160px]">{s.doctor?.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">{s.doctor?.specialisation || ''}</p>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">₹{fmt(s.cash_pool)}</td>
                <td className="px-4 py-3 text-right text-gray-600">₹{fmt(s.tpa_pool)}</td>
                <td className="px-4 py-3 text-right text-gray-600">₹{fmt(s.pmjay_pool)}</td>
                <td className="px-4 py-3 text-right text-gray-600">₹{fmt(s.govt_pool)}</td>
                <td className="px-4 py-3 text-right font-medium">₹{fmt(s.gross_payout)}</td>
                <td className="px-4 py-3 text-right text-red-500">-₹{fmt(s.tds_amount)}</td>
                <td className="px-4 py-3 text-right font-bold text-teal-700">₹{fmt(s.net_payout)}</td>
                <td className="px-4 py-3 text-center">
                  <SettlementBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {s.status === 'computed' && (
                      <button onClick={() => updateStatus(s.id, 'approve')}
                        className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Approve">
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {s.status === 'approved' && (
                      <>
                        <button onClick={() => updateStatus(s.id, 'lock')}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Lock">
                          <Lock className="w-4 h-4" />
                        </button>
                        <button onClick={() => updateStatus(s.id, 'mark_paid')}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Mark Paid">
                          <IndianRupee className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {s.status === 'locked' && (
                      <button onClick={() => updateStatus(s.id, 'mark_paid')}
                        className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Mark Paid">
                        <IndianRupee className="w-4 h-4" />
                      </button>
                    )}
                    {(s.mgm_triggered || s.incentive_triggered) && (
                      <span className="ml-1 text-xs text-amber-600" title={
                        s.mgm_triggered ? `MGM top-up: ₹${fmt(s.mgm_topup)}` : `Incentive: ₹${fmt(s.incentive_amount)}`
                      }>
                        {s.mgm_triggered ? '🛡 MGM' : '⚡ Incentive'}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// CONTRACTS TAB
// ============================================================
function ContractsTab({ centreId, flash }: { centreId: string; flash: (m: string) => void }) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = sb().from('hmis_doctor_contracts')
        .select('*, doctor:hmis_staff!hmis_doctor_contracts_doctor_id_fkey(full_name, specialisation, employee_code)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (centreId) q = q.eq('centre_id', centreId);

      const { data } = await q.limit(300);
      setContracts(data || []);
      setLoading(false);
    }
    load();
  }, [centreId]);

  const filtered = contracts.filter(c =>
    !search || (c.doctor?.full_name || '').toLowerCase().includes(search.toLowerCase())
    || (c.contract_type || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="Search doctor or contract type..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <div className="ml-auto text-sm text-gray-500">{filtered.length} active contracts</div>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Doctor</th>
              <th className="px-4 py-3 text-center">Type</th>
              <th className="px-4 py-3 text-center">IPD Method</th>
              <th className="px-4 py-3 text-center">Cash</th>
              <th className="px-4 py-3 text-center">TPA</th>
              <th className="px-4 py-3 text-center">PMJAY</th>
              <th className="px-4 py-3 text-center">Govt</th>
              <th className="px-4 py-3 text-center">OPD</th>
              <th className="px-4 py-3 text-right">MGM/Retainer</th>
              <th className="px-4 py-3 text-center">Hold</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[180px]">{c.doctor?.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">{c.doctor?.specialisation || ''} · {c.doctor?.employee_code || ''}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <ContractTypeBadge type={c.contract_type} />
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">{c.ipd_method}</td>
                <td className="px-4 py-3 text-center text-xs">
                  {c.cash_base_method !== 'na' ? (
                    <span>{c.cash_base_method}: {Number(c.cash_self_pct)}%/{Number(c.cash_other_pct)}%</span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  {c.tpa_base_method !== 'na' ? (
                    <span>{c.tpa_base_method}: {Number(c.tpa_self_pct)}%/{Number(c.tpa_other_pct)}%</span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  {c.pmjay_base_method !== 'na' ? (
                    <span>{c.pmjay_base_method}: {Number(c.pmjay_pct || c.pmjay_self_pct)}%</span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  {c.govt_base_method !== 'na' ? (
                    <span>{c.govt_base_method}: {Number(c.govt_self_pct)}%</span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs">{Number(c.opd_non_govt_pct)}%</td>
                <td className="px-4 py-3 text-right text-xs">
                  {c.contract_type === 'MGM' && <span className="text-amber-600">₹{fmt(c.mgm_amount)}</span>}
                  {c.contract_type === 'Retainer' && <span className="text-blue-600">₹{fmt(c.retainer_amount)}</span>}
                  {c.contract_type === 'FFS' && <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {Object.keys(c.hold_config || {}).length > 0 ? (
                    <span className="text-xs text-amber-600">
                      {Object.entries(c.hold_config || {})
                        .filter(([_, v]: any) => v.held)
                        .map(([k, v]: any) => `${k.split(' ')[0]} ${v.months}mo`)
                        .join(', ')}
                    </span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// HOLD BUCKET TAB
// ============================================================
function HoldBucketTab({ centreId }: { centreId: string }) {
  const [holds, setHolds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/rcm/hold-bucket?centre_id=${centreId}&status=PENDING`);
      const data = await res.json();
      setHolds(data.holds || []);
      setSummary(data.summary || null);
      setLoading(false);
    }
    if (centreId) load();
  }, [centreId]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Total Held</p>
            <p className="text-xl font-bold text-amber-600">₹{fmt(summary.total_pending)}</p>
            <p className="text-xs text-gray-400">{holds.length} items</p>
          </div>
          {Object.entries(summary.by_payor || {}).map(([payor, info]: any) => (
            <div key={payor} className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">{payor}</p>
              <p className="text-lg font-bold text-gray-900">₹{fmt(info.amount)}</p>
              <p className="text-xs text-gray-400">{info.count} items · releases {info.earliest_release}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Doctor</th>
              <th className="px-4 py-3 text-left">Patient / Bill</th>
              <th className="px-4 py-3 text-left">Payor</th>
              <th className="px-4 py-3 text-left">Month</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Releases</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : holds.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No pending holds</td></tr>
            ) : holds.map(h => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[160px]">
                  {h.doctor?.full_name || '—'}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700 truncate max-w-[120px]">{h.patient_name}</p>
                  <p className="text-xs text-gray-400">{h.bill_no}</p>
                </td>
                <td className="px-4 py-3"><PayorBadge payor={h.payor_type} /></td>
                <td className="px-4 py-3 text-gray-600">{h.service_month}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-700">₹{fmt(h.calculated_amount)}</td>
                <td className="px-4 py-3 text-gray-600">{h.expected_release}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// SHARED BADGE COMPONENTS
// ============================================================
function PayorBadge({ payor }: { payor: string }) {
  const colors: Record<string, string> = {
    Cash: 'bg-green-50 text-green-700',
    TPA: 'bg-blue-50 text-blue-700',
    PMJAY: 'bg-amber-50 text-amber-700',
    Govt: 'bg-purple-50 text-purple-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[payor] || 'bg-gray-50 text-gray-600'}`}>
      {payor}
    </span>
  );
}

function SettlementBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-50', text: 'text-gray-600' },
    computed: { bg: 'bg-blue-50', text: 'text-blue-700' },
    approved: { bg: 'bg-green-50', text: 'text-green-700' },
    locked: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    paid: { bg: 'bg-teal-50', text: 'text-teal-700' },
    disputed: { bg: 'bg-red-50', text: 'text-red-700' },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
}

function ContractTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    FFS: 'bg-blue-50 text-blue-700',
    MGM: 'bg-amber-50 text-amber-700',
    Retainer: 'bg-purple-50 text-purple-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[type] || 'bg-gray-50 text-gray-600'}`}>
      {type}
    </span>
  );
}

// ============================================================
// EXPORT
// ============================================================
export default function RCMPage() {
  return (
    <RoleGuard module="rcm">
      <RCMInner />
    </RoleGuard>
  );
}
