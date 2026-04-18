// @ts-nocheck
// HEALTH1 HMIS — CLAIMS COMMAND CENTRE
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import {
  Shield, FileText, AlertTriangle, IndianRupee, Clock,
  Search, Plus, CheckCircle2, XCircle, Eye, TrendingUp,
  RefreshCw, ArrowRight, Filter, Loader2, Building2,
  BarChart3, MessageSquare, Zap,
} from 'lucide-react';
import { STATUS_CONFIG, CLAIM_TYPE_LABELS, PRIORITY_CONFIG, type ClaimStatus, type ClaimType } from '@/lib/claims/types';
import { useClaimsStore } from '@/lib/claims/store';

// ─── Formatters ───
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number | null | undefined) => {
  if (!n) return '₹0';
  return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;
};

// ─── Stat Card (matches HMIS billing pattern) ───
function StatCard({ label, value, subValue, icon: Icon, color, onClick }: {
  label: string; value: string | number; subValue?: string; icon: any; color: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : 'cursor-default'} bg-white border-gray-200`}>
      <div className={`rounded-lg p-2.5 ${color}`}><Icon className="h-5 w-5 text-white" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-gray-900 font-mono tabular-nums">{value}</p>
        {subValue && <p className="mt-0.5 text-xs text-gray-500">{subValue}</p>}
      </div>
    </button>
  );
}

// ─── Skeleton Loader ───
function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded flex-1" />
        </div>
      ))}
    </div>
  );
}

// ─── Tab Config ───
type Tab = 'all' | 'preauth' | 'active' | 'queries' | 'settlements' | 'closed';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: FileText },
  { id: 'preauth', label: 'Pre-Auth', icon: Shield },
  { id: 'active', label: 'Active Claims', icon: Clock },
  { id: 'queries', label: 'Queries', icon: AlertTriangle },
  { id: 'settlements', label: 'Settlements', icon: IndianRupee },
  { id: 'closed', label: 'Closed', icon: CheckCircle2 },
];

const TAB_STATUSES: Record<Tab, ClaimStatus[] | undefined> = {
  all: undefined,
  preauth: ['preauth_pending', 'preauth_approved', 'preauth_query', 'preauth_rejected', 'preauth_enhanced'],
  active: ['claim_submitted', 'claim_under_review', 'claim_approved', 'claim_partial'],
  queries: ['preauth_query', 'claim_query'],
  settlements: ['settlement_pending', 'settled'],
  closed: ['closed', 'written_off', 'claim_rejected'],
};

// ─── Main Page ───
export default function ClaimsCommandCentre() {
  const router = useRouter();
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');
  const [initializing, setInitializing] = useState(true);

  // ─── Store ───
  const { stats, payers, claims, claimsLoading, init, loadClaims, refreshStats } = useClaimsStore();
  const loading = initializing || claimsLoading;

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // ─── Init store + load first batch ───
  useEffect(() => {
    if (!centreId) return;
    const run = async () => {
      setInitializing(true);
      await init(centreId);
      await loadClaims({ statuses: TAB_STATUSES[tab] });
      setInitializing(false);
    };
    run();
  }, [centreId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reload claims on tab/filter change (after init) ───
  useEffect(() => {
    if (!centreId || initializing) return;
    loadClaims({
      statuses: TAB_STATUSES[tab],
      payer_id: payerFilter || undefined,
      claim_type: (typeFilter || undefined) as ClaimType | undefined,
      search: search || undefined,
    });
  }, [tab, payerFilter, typeFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStats();
    await loadClaims({
      statuses: TAB_STATUSES[tab],
      payer_id: payerFilter || undefined,
      claim_type: (typeFilter || undefined) as ClaimType | undefined,
      search: search || undefined,
    });
    setRefreshing(false);
    flash('Refreshed');
  };

  if (initializing) return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b px-6 py-4"><div className="h-6 w-48 bg-gray-200 rounded animate-pulse" /></div>
      <div className="px-6 pt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-white border rounded-xl animate-pulse" />)}
      </div>
      <div className="px-6 pt-4"><div className="h-10 bg-gray-100 rounded-xl animate-pulse" /></div>
      <div className="px-6 pt-2"><div className="h-96 bg-white border rounded-xl animate-pulse" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Toast */}
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* ─── Header ─── */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-600" />
                Claims Command Centre
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Insurance claims lifecycle — pre-auth to settlement</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button onClick={() => router.push('/claims/mis')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <BarChart3 className="w-3.5 h-3.5" /> MIS
              </button>
              <button onClick={() => router.push('/claims/new')}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700 transition-colors shadow-sm">
                <Plus size={15} /> New Claim
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      {stats && (
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Claims" value={stats.total} icon={FileText} color="bg-gray-500" />
            <StatCard label="Pre-Auth Pending" value={stats.preauth_pending} icon={Clock} color="bg-amber-500"
              onClick={() => setTab('preauth')} />
            <StatCard label="Open Queries" value={stats.open_queries} icon={AlertTriangle} color="bg-orange-500"
              onClick={() => setTab('queries')} />
            <StatCard label="Under Review" value={stats.under_review} icon={Eye} color="bg-blue-500"
              onClick={() => setTab('active')} />
            <StatCard label="Outstanding" value={INR(stats.total_outstanding)} subValue={`${stats.settlement_pending} pending`}
              icon={IndianRupee} color="bg-purple-500" onClick={() => setTab('settlements')} />
            <StatCard label="Settled" value={INR(stats.total_settled)} subValue={`${stats.settled} claims`}
              icon={CheckCircle2} color="bg-emerald-500" onClick={() => setTab('settlements')} />
          </div>
        </div>
      )}

      {/* ─── Tabs + Filters ─── */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab pills */}
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl transition-all ${
                tab === t.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
              }`}>
              <t.icon className="w-3 h-3" />
              {t.label}
              {tab === t.id && stats && (
                <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">
                  {claims.length}
                </span>
              )}
            </button>
          ))}

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Patient, claim #..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white" />
          </div>

          {/* Payer filter */}
          <select value={payerFilter} onChange={e => setPayerFilter(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600">
            <option value="">All Payers</option>
            {payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Type filter */}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600">
            <option value="">All Types</option>
            {Object.entries(CLAIM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* ─── Claims Table ─── */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-2xl border overflow-hidden">
          {loading ? <TableSkeleton /> : claims.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No claims found</p>
              <p className="text-xs text-gray-400 mt-1">Create a new claim or adjust your filters</p>
              <button onClick={() => router.push('/claims/new')}
                className="mt-4 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-xl hover:bg-teal-700 inline-flex items-center gap-1.5 transition-colors">
                <Plus className="w-4 h-4" /> New Claim
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Claim #</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payer</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Queries</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim: any) => {
                    const sc = STATUS_CONFIG[claim.status as ClaimStatus] || STATUS_CONFIG.draft;
                    const amount = claim.settled_amount || claim.approved_amount || claim.claimed_amount || claim.estimated_amount;
                    const isUrgent = claim.is_sla_breached || claim.priority === 'critical';
                    return (
                      <tr key={claim.id}
                        onClick={() => router.push(`/claims/${claim.id}`)}
                        className={`cursor-pointer hover:bg-blue-50/50 transition-colors border-b border-gray-100 last:border-0 ${isUrgent ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-gray-500">{claim.claim_number}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{claim.patient_name}</p>
                            <p className="text-xs text-gray-500">{claim.patient_uhid || ''}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600">{claim.clm_payers?.name || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                            claim.claim_type === 'pmjay' ? 'bg-green-100 text-green-700' :
                            claim.claim_type === 'corporate' ? 'bg-purple-100 text-purple-700' :
                            'bg-blue-50 text-blue-700'
                          }`}>
                            {CLAIM_TYPE_LABELS[claim.claim_type as ClaimType] || claim.claim_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.color}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-sm font-semibold text-gray-900">{INR(amount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {claim.is_query_pending ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" /> {claim.query_count} open
                            </span>
                          ) : claim.query_count > 0 ? (
                            <span className="text-[10px] text-gray-400">{claim.query_count} done</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/claims/${claim.id}`); }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                            View <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick actions bar */}
        {!loading && claims.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>{claims.length} claims shown</span>
            <div className="flex gap-3">
              <button onClick={() => router.push('/claims/preauth')} className="text-teal-600 hover:underline flex items-center gap-1">
                <Shield className="w-3 h-3" /> Pre-Auth Queue
              </button>
              <button onClick={() => router.push('/claims/queries')} className="text-orange-600 hover:underline flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Open Queries
              </button>
              <button onClick={() => router.push('/claims/settlements')} className="text-emerald-600 hover:underline flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> Settlement Tracker
              </button>
              <button onClick={() => router.push('/claims/payers')} className="text-purple-600 hover:underline flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Payer Master
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
