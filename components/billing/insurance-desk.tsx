'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Plus, X, Search, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, FileText, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import { sb } from '@/lib/supabase/browser';
import type { InsurancePreAuth, InsuranceClaim, AgingBucket } from '@/lib/billing/types';
import { AGING_BUCKETS, PRE_AUTH_STATUSES, CLAIM_STATUSES } from '@/lib/billing/types';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

interface Props {
  centreId: string;
  staffId: string;
  onFlash: (msg: string) => void;
}

type View = 'dashboard' | 'preauths' | 'claims';

export default function InsuranceDesk({ centreId, staffId, onFlash }: Props) {
  const [view, setView] = useState<View>('dashboard');
  const [preAuths, setPreAuths] = useState<InsurancePreAuth[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [paFilter, setPaFilter] = useState('all');
  const [clFilter, setClFilter] = useState('all');

  const loadPreAuths = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const { data } = await sb().from('insurance_pre_auths')
      .select(`*,
        encounter:billing_encounters(encounter_number, patient:hmis_patients!billing_encounters_patient_id_fkey(first_name, last_name, uhid))
      `)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(100);
    setPreAuths((data || []) as InsurancePreAuth[]);
    setLoading(false);
  }, [centreId]);

  const loadClaims = useCallback(async () => {
    if (!centreId) return;
    const { data } = await sb().from('insurance_claims')
      .select(`*,
        encounter:billing_encounters(encounter_number, patient:hmis_patients!billing_encounters_patient_id_fkey(first_name, last_name, uhid)),
        pre_auth:insurance_pre_auths(pre_auth_number, approved_amount)
      `)
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(100);
    setClaims((data || []) as InsuranceClaim[]);
  }, [centreId]);

  useEffect(() => { loadPreAuths(); loadClaims(); }, [loadPreAuths, loadClaims]);

  // Dashboard stats
  const stats = useMemo(() => {
    const pa = preAuths;
    const cl = claims;
    return {
      draftPA: pa.filter(p => p.status === 'DRAFT').length,
      submittedPA: pa.filter(p => p.status === 'SUBMITTED').length,
      queryPA: pa.filter(p => p.status === 'QUERY').length,
      approvedPA: pa.filter(p => p.status === 'APPROVED' || p.status === 'PARTIALLY_APPROVED').length,
      totalClaimed: cl.reduce((s, c) => s + Number(c.claimed_amount), 0),
      totalSettled: cl.filter(c => c.status === 'SETTLED').reduce((s, c) => s + Number(c.settled_amount || 0), 0),
      pendingClaims: cl.filter(c => ['SUBMITTED', 'UNDER_PROCESS', 'QUERY_RAISED'].includes(c.status)).length,
      settledClaims: cl.filter(c => c.status === 'SETTLED').length,
    };
  }, [preAuths, claims]);

  // Aging analysis
  const agingData = useMemo(() => {
    const openClaims = claims.filter(c => c.status !== 'SETTLED' && c.status !== 'REJECTED' && c.status !== 'WRITTEN_OFF');
    const buckets = AGING_BUCKETS.map(bucket => {
      const matching = openClaims.filter(c => c.aging_bucket === bucket);
      const amount = matching.reduce((s, c) => s + Number(c.claimed_amount), 0);
      return { bucket, count: matching.length, amount };
    });
    const total = buckets.reduce((s, b) => s + b.amount, 0);
    return buckets.map(b => ({ ...b, percentage: total > 0 ? Math.round((b.amount / total) * 100) : 0 }));
  }, [claims]);

  const filteredPA = useMemo(() => {
    if (paFilter === 'all') return preAuths;
    return preAuths.filter(p => p.status === paFilter);
  }, [preAuths, paFilter]);

  const filteredCl = useMemo(() => {
    if (clFilter === 'all') return claims;
    return claims.filter(c => c.status === clFilter);
  }, [claims, clFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">Insurance Desk</h2>
        <div className="flex gap-1">
          {(['dashboard', 'preauths', 'claims'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer ${
                view === v ? 'bg-[#0A2540] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {v === 'dashboard' ? 'Overview' : v === 'preauths' ? 'Pre-Auths' : 'Claims'}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <div className="space-y-4">
          {/* Pre-Auth Pipeline */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-xs font-bold text-gray-700 mb-3">Pre-Auth Pipeline</h3>
            <div className="flex gap-2">
              {[
                { label: 'Draft', count: stats.draftPA, color: 'bg-gray-100 text-gray-700' },
                { label: 'Submitted', count: stats.submittedPA, color: 'bg-blue-50 text-blue-700' },
                { label: 'Query', count: stats.queryPA, color: 'bg-amber-50 text-amber-700' },
                { label: 'Approved', count: stats.approvedPA, color: 'bg-emerald-50 text-emerald-700' },
              ].map((stage, i) => (
                <React.Fragment key={stage.label}>
                  <div className={`flex-1 rounded-xl ${stage.color} px-4 py-3`}>
                    <div className="text-2xl font-bold">{stage.count}</div>
                    <div className="text-[10px] font-semibold uppercase mt-0.5">{stage.label}</div>
                  </div>
                  {i < 3 && <div className="flex items-center"><ChevronRight size={16} className="text-gray-300" /></div>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Claims Outstanding Aging */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-xs font-bold text-gray-700 mb-3">Claims Outstanding — Aging Analysis</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left py-2 text-[10px] text-gray-400 font-semibold uppercase">Aging</th>
                  <th className="text-center py-2 text-[10px] text-gray-400 font-semibold uppercase">Count</th>
                  <th className="text-right py-2 text-[10px] text-gray-400 font-semibold uppercase">Amount</th>
                  <th className="text-left py-2 px-4 text-[10px] text-gray-400 font-semibold uppercase">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {agingData.map(a => (
                  <tr key={a.bucket} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 font-semibold text-gray-700">{a.bucket} days</td>
                    <td className="py-2.5 text-center font-mono">{a.count}</td>
                    <td className="py-2.5 text-right font-bold font-mono">{INR(a.amount)}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${a.bucket === '0-30' ? 'bg-emerald-400' : a.bucket === '31-60' ? 'bg-blue-400' : a.bucket === '61-90' ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${a.percentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono w-8 text-right">{a.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100">
                  <td className="py-2.5 font-bold text-gray-800">TOTAL</td>
                  <td className="py-2.5 text-center font-bold font-mono">{agingData.reduce((s, a) => s + a.count, 0)}</td>
                  <td className="py-2.5 text-right font-bold font-mono text-[#0A2540]">{INR(agingData.reduce((s, a) => s + a.amount, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Total Claimed</div>
              <div className="text-lg font-bold text-gray-800 font-mono">{INR(stats.totalClaimed)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Total Settled</div>
              <div className="text-lg font-bold text-emerald-600 font-mono">{INR(stats.totalSettled)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Pending Claims</div>
              <div className="text-lg font-bold text-amber-600">{stats.pendingClaims}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Settled Claims</div>
              <div className="text-lg font-bold text-emerald-600">{stats.settledClaims}</div>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Auths View */}
      {view === 'preauths' && (
        <div className="space-y-3">
          <div className="flex gap-1 flex-wrap">
            {['all', ...PRE_AUTH_STATUSES].map(s => (
              <button
                key={s}
                onClick={() => setPaFilter(s)}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-colors cursor-pointer ${
                  paFilter === s ? 'bg-[#0A2540]/10 text-[#0A2540] border border-[#00B4D8]/30' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-xs">Loading...</div>
            ) : filteredPA.length === 0 ? (
              <div className="p-12 text-center">
                <Shield size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No pre-authorization requests found.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">PA #</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Patient</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Policy</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Requested</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Approved</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">TAT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPA.map(pa => {
                    const enc = pa.encounter as any;
                    const pt = enc?.patient;
                    return (
                      <tr key={pa.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-500">{pa.pre_auth_number || 'DRAFT'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{pt?.first_name} {pt?.last_name}</div>
                          <div className="text-[10px] text-gray-400">{pt?.uhid}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-[10px]">{pa.policy_number}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">₹{fmt(Number(pa.requested_amount))}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {pa.approved_amount ? (
                            <span className="font-semibold text-emerald-600">₹{fmt(Number(pa.approved_amount))}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <PreAuthStatusBadge status={pa.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {pa.tat_hours ? `${Math.round(Number(pa.tat_hours))}h` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Claims View */}
      {view === 'claims' && (
        <div className="space-y-3">
          <div className="flex gap-1 flex-wrap">
            {['all', 'SUBMITTED', 'UNDER_PROCESS', 'QUERY_RAISED', 'APPROVED', 'SETTLED', 'REJECTED'].map(s => (
              <button
                key={s}
                onClick={() => setClFilter(s)}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-colors cursor-pointer ${
                  clFilter === s ? 'bg-[#0A2540]/10 text-[#0A2540] border border-[#00B4D8]/30' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {filteredCl.length === 0 ? (
              <div className="p-12 text-center">
                <FileText size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No claims found.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Claim #</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Patient</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Claimed</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Settled</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Deduction</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase">Aging</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCl.map(cl => {
                    const enc = cl.encounter as any;
                    const pt = enc?.patient;
                    return (
                      <tr key={cl.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-500">{cl.claim_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{pt?.first_name} {pt?.last_name}</div>
                          <div className="text-[10px] text-gray-400">{pt?.uhid}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">₹{fmt(Number(cl.claimed_amount))}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {cl.settled_amount ? (
                            <span className="text-emerald-600 font-semibold">₹{fmt(Number(cl.settled_amount))}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {cl.deduction_amount && Number(cl.deduction_amount) > 0 ? (
                            <span className="text-red-600">₹{fmt(Number(cl.deduction_amount))}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <ClaimStatusBadge status={cl.status} />
                        </td>
                        <td className="px-4 py-3">
                          <AgingBadge bucket={cl.aging_bucket} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PreAuthStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SUBMITTED: 'bg-blue-50 text-blue-700',
    QUERY: 'bg-purple-50 text-purple-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    PARTIALLY_APPROVED: 'bg-amber-50 text-amber-700',
    REJECTED: 'bg-red-50 text-red-700',
    ENHANCEMENT_PENDING: 'bg-orange-50 text-orange-700',
    ENHANCED: 'bg-teal-50 text-teal-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
    EXPIRED: 'bg-gray-100 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SUBMITTED: 'bg-blue-50 text-blue-700',
    UNDER_PROCESS: 'bg-indigo-50 text-indigo-700',
    QUERY_RAISED: 'bg-purple-50 text-purple-700',
    QUERY_RESPONDED: 'bg-violet-50 text-violet-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    PARTIALLY_APPROVED: 'bg-amber-50 text-amber-700',
    SETTLED: 'bg-green-50 text-green-700',
    REJECTED: 'bg-red-50 text-red-700',
    APPEAL: 'bg-orange-50 text-orange-700',
    WRITTEN_OFF: 'bg-gray-100 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function AgingBadge({ bucket }: { bucket: string }) {
  const colors: Record<string, string> = {
    '0-30': 'bg-emerald-50 text-emerald-700',
    '31-60': 'bg-blue-50 text-blue-700',
    '61-90': 'bg-amber-50 text-amber-700',
    '91-120': 'bg-orange-50 text-orange-700',
    '120+': 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[bucket] || 'bg-gray-100 text-gray-600'}`}>
      {bucket}d
    </span>
  );
}
