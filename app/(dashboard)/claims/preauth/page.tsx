// HEALTH1 HMIS — PRE-AUTHORIZATION TRACKER
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
  Search, Plus, ArrowRight, RefreshCw, MessageSquare,
  Loader2, Zap, Timer, IndianRupee, Stethoscope, User,
} from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG, type ClaimStatus } from '@/lib/claims/types';

const INR = (n: number | null | undefined) => !n ? '—' : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

const PREAUTH_STATUSES: ClaimStatus[] = ['preauth_pending', 'preauth_approved', 'preauth_query', 'preauth_rejected', 'preauth_enhanced'];

// ─── Stat Card ───
function StatCard({ label, value, sub, icon: Icon, color, active, onClick }: {
  label: string; value: string | number; sub?: string; icon: any; color: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 bg-white ${active ? 'ring-2 ring-teal-500 border-teal-200' : 'border-gray-200'}`}>
      <div className={`rounded-lg p-2.5 ${color}`}><Icon className="h-5 w-5 text-white" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-gray-900 font-mono tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      </div>
    </button>
  );
}

type FilterStatus = 'all' | ClaimStatus;

export default function PreauthTracker() {
  const router = useRouter();
  const { activeCentreId } = useAuthStore();

  const [claims, setClaims] = useState<any[]>([]);
  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // ─── Load ───
  const load = useCallback(async () => {
    if (!activeCentreId) return;
    setLoading(true);
    try {
      const { data } = await sb().from('clm_claims')
        .select('*, clm_payers!clm_claims_payer_id_fkey(id, name, type)')
        .eq('centre_id', activeCentreId)
        .in('status', PREAUTH_STATUSES)
        .order('created_at', { ascending: false });
      setAllClaims(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [activeCentreId]);

  useEffect(() => { load(); }, [load]);

  // ─── Filter + Search ───
  useEffect(() => {
    let f = allClaims;
    if (filter !== 'all') f = f.filter(c => c.status === filter);
    if (search) f = f.filter(c =>
      c.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.claim_number?.includes(search)
    );
    // Sort: pending first (urgency), then by created_at oldest first
    f.sort((a, b) => {
      const order: Record<string, number> = { preauth_pending: 0, preauth_query: 1, preauth_enhanced: 2, preauth_approved: 3, preauth_rejected: 4 };
      const oa = order[a.status] ?? 5, ob = order[b.status] ?? 5;
      if (oa !== ob) return oa - ob;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); // oldest first
    });
    setClaims(f);
  }, [allClaims, filter, search]);

  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); flash('Refreshed'); };

  // ─── Stats ───
  const pending = allClaims.filter(c => c.status === 'preauth_pending').length;
  const approved = allClaims.filter(c => c.status === 'preauth_approved').length;
  const query = allClaims.filter(c => c.status === 'preauth_query').length;
  const rejected = allClaims.filter(c => c.status === 'preauth_rejected').length;
  const totalEstimated = allClaims.filter(c => c.status === 'preauth_pending').reduce((s, c) => s + (c.estimated_amount || 0), 0);
  const totalApproved = allClaims.filter(c => c.status === 'preauth_approved').reduce((s, c) => s + (c.approved_amount || 0), 0);

  // ─── Skeleton ───
  if (loading) return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b px-6 py-4"><div className="h-6 w-48 bg-gray-200 rounded animate-pulse" /></div>
      <div className="px-6 pt-4 grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="px-6 pt-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* ─── Header ─── */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" /> Pre-Authorization Tracker
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Track pre-auth requests — 4h SLA for emergency, 24h for planned</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button onClick={() => router.push('/claims')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <Shield className="w-3.5 h-3.5" /> Claims
              </button>
              <button onClick={() => router.push('/claims/new')}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700 shadow-sm">
                <Plus size={15} /> New Pre-Auth
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="px-6 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Pending" value={pending} sub={INR(totalEstimated)} icon={Clock} color="bg-amber-500" active={filter === 'preauth_pending'} onClick={() => setFilter(filter === 'preauth_pending' ? 'all' : 'preauth_pending')} />
          <StatCard label="Approved" value={approved} sub={INR(totalApproved)} icon={CheckCircle2} color="bg-emerald-500" active={filter === 'preauth_approved'} onClick={() => setFilter(filter === 'preauth_approved' ? 'all' : 'preauth_approved')} />
          <StatCard label="Query" value={query} sub="Needs response" icon={AlertTriangle} color="bg-orange-500" active={filter === 'preauth_query'} onClick={() => setFilter(filter === 'preauth_query' ? 'all' : 'preauth_query')} />
          <StatCard label="Rejected" value={rejected} icon={XCircle} color={rejected > 0 ? 'bg-red-500' : 'bg-gray-400'} active={filter === 'preauth_rejected'} onClick={() => setFilter(filter === 'preauth_rejected' ? 'all' : 'preauth_rejected')} />
          <StatCard label="Total" value={allClaims.length} sub={`${pending + query} need action`} icon={Shield} color="bg-gray-500" active={filter === 'all'} onClick={() => setFilter('all')} />
        </div>
      </div>

      {/* ─── Search ─── */}
      <div className="px-6 pt-3 pb-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search patient or claim #..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
        </div>
      </div>

      {/* ─── Claims List ─── */}
      <div className="px-6 pb-6">
        {claims.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              {allClaims.length === 0 ? 'No pre-auth requests' : 'No claims match your filter'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {allClaims.length === 0 ? 'Create a new claim to start a pre-auth' : 'Try changing the filter or search'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {claims.map(claim => {
              const sc = STATUS_CONFIG[claim.status as ClaimStatus] || STATUS_CONFIG.draft;
              const pc = PRIORITY_CONFIG[claim.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
              const hrs = Math.round((Date.now() - new Date(claim.created_at).getTime()) / 3600000);
              const isPending = claim.status === 'preauth_pending';
              const isQuery = claim.status === 'preauth_query';
              const isUrgent = claim.priority === 'critical' || (isPending && hrs > 4);

              return (
                <div key={claim.id}
                  onClick={() => router.push(`/claims/${claim.id}`)}
                  className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    isUrgent ? 'border-red-200 shadow-sm shadow-red-100' :
                    isQuery ? 'border-orange-200' :
                    'border-gray-200'
                  }`}>
                  <div className="flex items-start justify-between gap-4">
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      {/* Meta row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-blue-600">{claim.claim_number}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${pc.bg} ${pc.color}`}>{pc.label}</span>
                        {isQuery && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                            <MessageSquare className="w-2.5 h-2.5" /> Query
                          </span>
                        )}
                        {isUrgent && isPending && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded animate-pulse flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> URGENT
                          </span>
                        )}
                      </div>

                      {/* Patient + details */}
                      <p className="text-sm font-semibold text-gray-900 mt-1.5">{claim.patient_name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {claim.primary_diagnosis || '—'}</span>
                        {claim.treating_doctor_name && <span>{claim.treating_doctor_name}</span>}
                        {claim.department_name && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{claim.department_name}</span>}
                      </div>

                      {/* Payer */}
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> {claim.clm_payers?.name || '—'}
                        {claim.clm_payers?.type && <span className="text-[9px] bg-gray-100 px-1 py-0.5 rounded">{claim.clm_payers.type}</span>}
                      </p>
                    </div>

                    {/* Right */}
                    <div className="shrink-0 text-right">
                      {/* Time */}
                      <div className={`text-lg font-bold font-mono tabular-nums ${
                        isPending && hrs > 24 ? 'text-red-600' :
                        isPending && hrs > 4 ? 'text-orange-600' :
                        hrs > 12 ? 'text-amber-600' : 'text-gray-500'
                      }`}>{hrs}h</div>
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">
                        {isPending ? 'waiting' : isQuery ? 'since query' : 'ago'}
                      </div>

                      {/* Amount */}
                      <div className="mt-2">
                        {claim.approved_amount ? (
                          <div>
                            <p className="text-xs text-gray-400">Approved</p>
                            <p className="text-sm font-bold font-mono tabular-nums text-emerald-700">{INR(claim.approved_amount)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-gray-400">Estimated</p>
                            <p className="text-sm font-bold font-mono tabular-nums text-gray-700">{INR(claim.estimated_amount)}</p>
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="w-4 h-4 text-gray-300 ml-auto mt-2" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {claims.length > 0 && (
          <div className="mt-3 text-xs text-gray-400 text-center">
            {claims.length} pre-auth request{claims.length !== 1 ? 's' : ''} shown
            {filter !== 'all' && <button onClick={() => setFilter('all')} className="text-teal-600 ml-2 hover:underline">Show all</button>}
          </div>
        )}
      </div>
    </div>
  );
}
