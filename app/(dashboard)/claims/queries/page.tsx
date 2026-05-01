// HEALTH1 HMIS — QUERY RESPONSE CENTRE (SLA Workstation)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import {
  AlertTriangle, Clock, MessageSquare, XCircle, Send, Shield,
  Search, ArrowUpRight, CheckCircle2, Loader2, User, RefreshCw,
  Filter, Zap, FileText, IndianRupee, Timer, Bell, ArrowRight,
} from 'lucide-react';
import { PRIORITY_CONFIG, type QueryPriority } from '@/lib/claims/types';
import { useClaimsStore } from '@/lib/claims/store';

// ─── StatCard (matches dashboard pattern) ───
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: any; color: string; sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-4 bg-white border-gray-200">
      <div className={`rounded-lg p-2.5 ${color}`}><Icon className="h-5 w-5 text-white" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-gray-900 font-mono tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

// ─── SLA Timer Component ───
function SLATimer({ raisedAt, deadline, breached }: { raisedAt: string; deadline?: string; breached?: boolean }) {
  const hrs = Math.round((Date.now() - new Date(raisedAt).getTime()) / 3600000);
  const deadlineHrs = deadline ? Math.round((new Date(deadline).getTime() - Date.now()) / 3600000) : null;

  if (breached) {
    return (
      <div className="text-center">
        <div className="text-lg font-black text-red-600 font-mono tabular-nums">{hrs}h</div>
        <div className="text-[9px] text-red-500 font-bold uppercase tracking-wider">SLA BREACHED</div>
      </div>
    );
  }
  if (deadlineHrs !== null && deadlineHrs < 0) {
    return (
      <div className="text-center">
        <div className="text-lg font-black text-red-600 font-mono tabular-nums">{hrs}h</div>
        <div className="text-[9px] text-red-500 font-bold uppercase tracking-wider">OVERDUE {Math.abs(deadlineHrs)}h</div>
      </div>
    );
  }
  return (
    <div className="text-center">
      <div className={`text-lg font-bold font-mono tabular-nums ${hrs > 36 ? 'text-orange-600' : hrs > 12 ? 'text-amber-600' : 'text-gray-600'}`}>{hrs}h</div>
      <div className="text-[9px] text-gray-400 uppercase tracking-wider">open</div>
      {deadlineHrs !== null && deadlineHrs > 0 && (
        <div className={`text-[9px] font-medium mt-0.5 ${deadlineHrs < 8 ? 'text-orange-500' : 'text-gray-400'}`}>
          {deadlineHrs}h left
        </div>
      )}
    </div>
  );
}

type Tab = 'queries' | 'rejections';
type FilterCategory = 'all' | 'clinical' | 'billing' | 'documentation' | 'policy' | 'other';
type FilterPriority = 'all' | 'critical' | 'high' | 'medium' | 'low';

export default function QueryResponseCentre() {
  const router = useRouter();
  const { activeCentreId, staff } = useAuthStore();

  // Store
  const { openQueries: queries, rejections, loadQueryCentre, respondToQuery, init } = useClaimsStore();
  const [initializing, setInitializing] = useState(true);

  const [tab, setTab] = useState<Tab>('queries');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Filters
  const [filterCat, setFilterCat] = useState<FilterCategory>('all');
  const [filterPri, setFilterPri] = useState<FilterPriority>('all');
  const [filterRole, setFilterRole] = useState('all');
  const [searchQ, setSearchQ] = useState('');

  // Response state
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Load via Store ───
  useEffect(() => {
    if (!activeCentreId) return;
    const run = async () => {
      setInitializing(true);
      await init(activeCentreId);
      await loadQueryCentre();
      setInitializing(false);
    };
    run();
  }, [activeCentreId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => { setRefreshing(true); await loadQueryCentre(); setRefreshing(false); flash('Refreshed'); };

  // ─── Submit Response (via store — auto-invalidates dashboard + detail) ───
  const submitResponse = async (queryId: string) => {
    if (!responseText.trim()) return;
    setSaving(true);
    const ok = await respondToQuery(queryId, responseText, staff?.id);
    if (ok) { setRespondingTo(null); setResponseText(''); flash('Response submitted'); }
    else flash('Error submitting');
    setSaving(false);
  };

  // ─── Filtered + Sorted Queries ───
  const filtered = queries
    .filter(q => filterCat === 'all' || q.query_category === filterCat)
    .filter(q => filterPri === 'all' || q.priority === filterPri)
    .filter(q => filterRole === 'all' || q.routed_to_role === filterRole)
    .filter(q => !searchQ || q.patient_name?.toLowerCase().includes(searchQ.toLowerCase()) || q.claim_number?.includes(searchQ))
    // Sort: SLA breached first, then by hours open descending
    .sort((a, b) => {
      if (a.is_sla_breached && !b.is_sla_breached) return -1;
      if (!a.is_sla_breached && b.is_sla_breached) return 1;
      return new Date(a.raised_at).getTime() - new Date(b.raised_at).getTime(); // oldest first = most urgent
    });

  // ─── Stats ───
  const slaBreach = queries.filter(q => q.is_sla_breached).length;
  const routedDoctor = queries.filter(q => q.routed_to_role === 'doctor').length;
  const routedDesk = queries.filter(q => q.routed_to_role === 'insurance_desk').length;
  const avgHrs = queries.length > 0 ? Math.round(queries.reduce((s, q) => s + (Date.now() - new Date(q.raised_at).getTime()) / 3600000, 0) / queries.length) : 0;

  // ─── Skeleton ───
  if (initializing) return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b px-6 py-4"><div className="h-6 w-64 bg-gray-200 rounded animate-pulse" /></div>
      <div className="px-6 pt-4 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="px-6 pt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
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
                <MessageSquare className="w-5 h-5 text-orange-600" />
                Query Response Centre
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">TPA queries & rejections — respond within SLA to prevent escalation</p>
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
            </div>
          </div>
        </div>
      </div>

      {/* ─── SLA Stat Cards ─── */}
      <div className="px-6 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Open Queries" value={queries.length} icon={MessageSquare} color="bg-orange-500" sub="Awaiting response" />
          <StatCard label="SLA Breached" value={slaBreach} icon={AlertTriangle} color={slaBreach > 0 ? 'bg-red-600' : 'bg-gray-400'} sub={slaBreach > 0 ? 'Needs immediate action' : 'All within SLA'} />
          <StatCard label="Avg Open Time" value={`${avgHrs}h`} icon={Timer} color={avgHrs > 24 ? 'bg-amber-500' : 'bg-blue-500'} sub="Hours per query" />
          <StatCard label="Rejections" value={rejections.length} icon={XCircle} color={rejections.length > 0 ? 'bg-red-500' : 'bg-gray-400'} sub="Total claim rejections" />
        </div>
      </div>

      {/* ─── Tab Switcher + Filters ─── */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab pills */}
          <button onClick={() => setTab('queries')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl transition-all ${
              tab === 'queries' ? 'bg-orange-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
            }`}>
            <AlertTriangle className="w-3 h-3" /> Open Queries
            <span className="ml-0.5 bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">{queries.length}</span>
          </button>
          <button onClick={() => setTab('rejections')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl transition-all ${
              tab === 'rejections' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
            }`}>
            <XCircle className="w-3 h-3" /> Rejections
            <span className="ml-0.5 bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">{rejections.length}</span>
          </button>

          {tab === 'queries' && <>
            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Patient, claim #..." value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-40 focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white" />
            </div>

            {/* Category filter */}
            <select value={filterCat} onChange={e => setFilterCat(e.target.value as FilterCategory)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600">
              <option value="all">All Categories</option>
              <option value="clinical">Clinical</option>
              <option value="billing">Billing</option>
              <option value="documentation">Documentation</option>
              <option value="policy">Policy</option>
              <option value="other">Other</option>
            </select>

            {/* Priority filter */}
            <select value={filterPri} onChange={e => setFilterPri(e.target.value as FilterPriority)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600">
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Routed To filter */}
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600">
              <option value="all">All Roles</option>
              <option value="doctor">Doctor ({routedDoctor})</option>
              <option value="insurance_desk">Insurance Desk ({routedDesk})</option>
              <option value="billing">Billing</option>
              <option value="accounts">Accounts</option>
            </select>
          </>}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="px-6 pb-6">

        {/* ── QUERIES TAB ── */}
        {tab === 'queries' && (
          filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                {queries.length === 0 ? 'No open queries' : 'No queries match filters'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {queries.length === 0 ? 'All TPA queries have been responded to' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(q => {
                const pc = PRIORITY_CONFIG[q.priority as QueryPriority] || PRIORITY_CONFIG.medium;
                const isResponding = respondingTo === q.id;
                const catColors: Record<string, string> = {
                  clinical: 'bg-purple-100 text-purple-700',
                  billing: 'bg-blue-100 text-blue-700',
                  documentation: 'bg-amber-100 text-amber-700',
                  policy: 'bg-gray-100 text-gray-700',
                  other: 'bg-gray-100 text-gray-600',
                };

                return (
                  <div key={q.id} className={`bg-white rounded-2xl border transition-all ${
                    q.is_sla_breached ? 'border-red-300 shadow-sm shadow-red-100' :
                    isResponding ? 'border-blue-300 shadow-sm' : 'border-gray-200'
                  }`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Query Info */}
                        <div className="flex-1 min-w-0">
                          {/* Meta row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-blue-600 cursor-pointer hover:underline"
                              onClick={() => router.push(`/claims/${q.claim_id}`)}>
                              {q.claim_number}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">Q{q.query_number}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${pc.bg} ${pc.color}`}>{pc.label}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColors[q.query_category] || catColors.other}`}>{q.query_category}</span>
                            {q.routed_to_role && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <ArrowRight className="w-2.5 h-2.5" /> {q.routed_to_role.replace('_', ' ')}
                              </span>
                            )}
                            {q.escalation_level > 0 && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5" /> L{q.escalation_level}
                              </span>
                            )}
                          </div>

                          {/* Patient + Payer */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <p className="text-sm font-semibold text-gray-900">{q.patient_name}</p>
                            <p className="text-xs text-gray-500">{q.payer_name}</p>
                          </div>

                          {/* Query Text */}
                          <div className="mt-2.5 p-3 bg-orange-50/80 rounded-xl border border-orange-100">
                            <p className="text-sm text-gray-800 leading-relaxed">{q.query_text}</p>
                          </div>
                        </div>

                        {/* Right: SLA Timer */}
                        <div className="shrink-0">
                          <SLATimer raisedAt={q.raised_at} deadline={q.sla_deadline} breached={q.is_sla_breached} />
                        </div>
                      </div>

                      {/* Response Area */}
                      {isResponding ? (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                            <Send className="w-3 h-3" /> Responding to Q{q.query_number}
                          </div>
                          <textarea value={responseText} onChange={e => setResponseText(e.target.value)}
                            placeholder="Type your response to the TPA query..." rows={3} autoFocus
                            className="w-full px-3 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setRespondingTo(null); setResponseText(''); }}
                              className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={() => submitResponse(q.id)}
                              disabled={saving || !responseText.trim()}
                              className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Submit Response
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <div className="flex gap-2">
                            <button onClick={() => { setRespondingTo(q.id); setResponseText(''); }}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                                q.is_sla_breached
                                  ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}>
                              <MessageSquare className="w-3 h-3" />
                              {q.is_sla_breached ? 'Urgent — Respond Now' : 'Respond'}
                            </button>
                            <button onClick={() => router.push(`/claims/${q.claim_id}`)}
                              className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-gray-600">
                              <ArrowUpRight className="w-3 h-3" /> View Claim
                            </button>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {new Date(q.raised_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} at {new Date(q.raised_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── REJECTIONS TAB ── */}
        {tab === 'rejections' && (
          rejections.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">No rejections</p>
              <p className="text-xs text-gray-400 mt-1">No claims have been rejected yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rejections.map(rej => (
                <div key={rej.id}
                  onClick={() => router.push(`/claims/${rej.claim_id}`)}
                  className="bg-white rounded-2xl border border-gray-200 p-4 hover:border-red-300 cursor-pointer transition-all hover:shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Meta */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-blue-600">{rej.claim_number}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">{rej.rejection_stage || 'Rejected'}</span>
                        {rej.is_appealed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> Appealed
                          </span>
                        )}
                        {rej.appeal_status && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            rej.appeal_status === 'approved' ? 'bg-green-100 text-green-700' :
                            rej.appeal_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{rej.appeal_status}</span>
                        )}
                      </div>

                      {/* Patient */}
                      <p className="text-sm font-semibold text-gray-900 mt-1.5">{rej.patient_name}</p>
                      <p className="text-xs text-gray-500">{rej.payer_name}</p>

                      {/* Rejection Reason */}
                      <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100">
                        <p className="text-sm text-red-800 font-medium">{rej.rejection_reason || 'No reason provided'}</p>
                        {rej.rejection_details && <p className="text-xs text-red-600 mt-1">{rej.rejection_details}</p>}
                        {rej.suggested_action && (
                          <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span className="font-medium">Suggested:</span> {rej.suggested_action}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right */}
                    <div className="text-right ml-4 shrink-0">
                      {rej.claimed_amount && (
                        <p className="text-sm font-bold font-mono tabular-nums text-gray-700">
                          ₹{Math.round(rej.claimed_amount).toLocaleString('en-IN')}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(rej.rejected_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </p>
                      <div className="mt-2">
                        <span className="text-[10px] text-blue-600 font-medium flex items-center justify-end gap-0.5">
                          View Claim <ArrowUpRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
