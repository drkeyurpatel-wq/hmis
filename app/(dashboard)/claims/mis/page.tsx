// @ts-nocheck
// HEALTH1 HMIS — CLAIMS MIS (Management Information System)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  BarChart3, TrendingUp, Clock, IndianRupee, Building2,
  AlertTriangle, CheckCircle2, XCircle, RefreshCw, Shield,
  FileText, Eye, Timer, Loader2,
} from 'lucide-react';
import { STATUS_CONFIG, type ClaimStatus } from '@/lib/claims/types';

const INR = (n: number | null | undefined) => !n ? '₹0' : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: any; color: string;
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

type View = 'aging' | 'scorecard' | 'status';

export default function ClaimsMISPage() {
  const router = useRouter();
  const { activeCentreId } = useAuthStore();

  const [aging, setAging] = useState<any[]>([]);
  const [scorecard, setScorecard] = useState<any[]>([]);
  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('aging');

  const load = useCallback(async () => {
    setLoading(true);
    const s = sb();
    const [a, sc, cl] = await Promise.all([
      s.from('clm_v_aging').select('*'),
      s.from('clm_v_payer_scorecard').select('*').order('total_claims', { ascending: false }),
      s.from('clm_claims').select('status, claimed_amount, settled_amount, estimated_amount, deduction_amount, centre_id'),
    ]);
    setAging(a.data || []);
    setScorecard(sc.data || []);
    setAllClaims(cl.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Compute Stats ───
  const totalClaimed = allClaims.reduce((s, c) => s + (c.claimed_amount || c.estimated_amount || 0), 0);
  const totalSettled = allClaims.reduce((s, c) => s + (c.settled_amount || 0), 0);
  const totalOutstanding = allClaims
    .filter(c => !['settled', 'closed', 'written_off', 'draft'].includes(c.status))
    .reduce((s, c) => s + (c.claimed_amount || c.estimated_amount || 0), 0);

  // Aging buckets
  const buckets = ['0-30', '31-60', '61-90', '91-120', '120+'];
  const bucketData = buckets.map(b => {
    const items = aging.filter(a => a.aging_bucket === b);
    return { bucket: b, count: items.length, amount: items.reduce((s, i) => s + (parseFloat(i.claimed_amount) || 0), 0) };
  });
  const maxBucketAmt = Math.max(...bucketData.map(b => b.amount), 1);
  const bucketColors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-600'];

  // Status breakdown
  const statusMap: Record<string, { count: number; amount: number }> = {};
  allClaims.forEach(c => {
    if (!statusMap[c.status]) statusMap[c.status] = { count: 0, amount: 0 };
    statusMap[c.status].count++;
    statusMap[c.status].amount += c.claimed_amount || c.estimated_amount || 0;
  });
  const statusEntries = Object.entries(statusMap).sort((a, b) => b[1].count - a[1].count);

  if (loading) return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b px-6 py-4"><div className="h-6 w-48 bg-gray-200 rounded animate-pulse" /></div>
      <div className="px-6 pt-4 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="px-6 pt-4"><div className="h-96 bg-gray-100 rounded-xl animate-pulse" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" /> Claims MIS
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Aging analysis, payer scorecard, status breakdown</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => load()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button onClick={() => router.push('/claims')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <Shield className="w-3.5 h-3.5" /> Claims
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="px-6 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Claims" value={allClaims.length} icon={FileText} color="bg-gray-500" />
          <StatCard label="Total Claimed" value={INR(totalClaimed)} icon={IndianRupee} color="bg-blue-500" />
          <StatCard label="Total Settled" value={INR(totalSettled)} icon={CheckCircle2} color="bg-emerald-500" />
          <StatCard label="Outstanding" value={INR(totalOutstanding)} sub={`${aging.length} unsettled`} icon={Clock} color="bg-amber-500" />
        </div>
      </div>

      {/* View Tabs */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-2">
          {([
            { id: 'aging' as View, label: 'Aging Analysis', icon: Timer },
            { id: 'scorecard' as View, label: 'Payer Scorecard', icon: Building2 },
            { id: 'status' as View, label: 'Status Breakdown', icon: BarChart3 },
          ]).map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl transition-all ${
                view === t.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
              }`}>
              <t.icon className="w-3 h-3" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">

        {/* AGING ANALYSIS */}
        {view === 'aging' && (
          <div className="space-y-4">
            {/* Bar Chart */}
            <div className="bg-white rounded-2xl border p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Aging Buckets (Days Since Discharge)</h3>
              <div className="flex items-end gap-4 h-48">
                {bucketData.map((b, i) => (
                  <div key={b.bucket} className="flex-1 flex flex-col items-center">
                    <p className="text-xs font-bold font-mono text-gray-700 mb-1">{INR(b.amount)}</p>
                    <div className="w-full flex justify-center">
                      <div className={`w-full max-w-[60px] rounded-t-lg ${bucketColors[i]} transition-all`}
                        style={{ height: `${Math.max(8, (b.amount / maxBucketAmt) * 140)}px` }} />
                    </div>
                    <p className="text-xs font-semibold text-gray-600 mt-2">{b.bucket}d</p>
                    <p className="text-[10px] text-gray-400">{b.count} claims</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail Table */}
            {aging.length > 0 && (
              <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b">
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Claim</th>
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payer</th>
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Days</th>
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.sort((a, b) => b.days_pending - a.days_pending).map(a => {
                      const sc = STATUS_CONFIG[a.status as ClaimStatus];
                      return (
                        <tr key={a.claim_id} onClick={() => router.push(`/claims/${a.claim_id}`)}
                          className="border-b border-gray-100 last:border-0 hover:bg-blue-50/50 cursor-pointer">
                          <td className="px-4 py-2.5"><span className="font-mono text-xs text-blue-600 font-semibold">{a.claim_number}</span></td>
                          <td className="px-4 py-2.5 text-sm text-gray-900">{a.patient_name}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">{a.payer_name}</td>
                          <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${sc?.bg} ${sc?.color}`}>{sc?.label || a.status}</span></td>
                          <td className="px-4 py-2.5 text-right font-mono text-sm font-medium text-gray-900">{INR(parseFloat(a.claimed_amount))}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-mono text-sm font-bold ${a.days_pending > 90 ? 'text-red-600' : a.days_pending > 60 ? 'text-orange-600' : a.days_pending > 30 ? 'text-amber-600' : 'text-gray-500'}`}>
                              {a.days_pending}d
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              a.aging_bucket === '0-30' ? 'bg-emerald-100 text-emerald-700' :
                              a.aging_bucket === '31-60' ? 'bg-blue-100 text-blue-700' :
                              a.aging_bucket === '61-90' ? 'bg-amber-100 text-amber-700' :
                              a.aging_bucket === '91-120' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>{a.aging_bucket}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PAYER SCORECARD */}
        {view === 'scorecard' && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Claims</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Settled</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rejected</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Queries</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Avg Days</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rej. Rate</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Claimed</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Settled</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.map(p => (
                  <tr key={p.payer_id} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{p.payer_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        p.payer_type === 'tpa' ? 'bg-blue-100 text-blue-700' :
                        p.payer_type === 'insurer' ? 'bg-purple-100 text-purple-700' :
                        p.payer_type === 'government' ? 'bg-green-100 text-green-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{p.payer_type?.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-gray-900">{p.total_claims}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-emerald-700">{p.settled_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-red-600">{p.rejected_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-orange-600">{p.pending_queries}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-mono text-sm font-medium ${
                        parseFloat(p.avg_settlement_days) > 60 ? 'text-red-600' :
                        parseFloat(p.avg_settlement_days) > 30 ? 'text-orange-600' : 'text-gray-600'
                      }`}>{p.avg_settlement_days ? `${Math.round(parseFloat(p.avg_settlement_days))}d` : '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-mono text-sm font-medium ${parseFloat(p.rejection_rate_pct) > 10 ? 'text-red-600' : 'text-gray-600'}`}>
                        {parseFloat(p.rejection_rate_pct).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-gray-700">{INR(parseFloat(p.total_claimed))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-emerald-700">{INR(parseFloat(p.total_settled))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* STATUS BREAKDOWN */}
        {view === 'status' && (
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Claims by Status</h3>
            <div className="space-y-2">
              {statusEntries.map(([status, data]) => {
                const sc = STATUS_CONFIG[status as ClaimStatus];
                const pct = allClaims.length > 0 ? Math.round(100 * data.count / allClaims.length) : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-32 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc?.bg || 'bg-gray-100'} ${sc?.color || 'text-gray-600'}`}>
                        {sc?.label || status}
                      </span>
                    </div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${sc?.bg?.replace('bg-', 'bg-') || 'bg-gray-400'} transition-all`}
                        style={{ width: `${Math.max(2, pct)}%`, opacity: 0.7 }} />
                    </div>
                    <div className="w-16 text-right font-mono text-sm font-bold text-gray-700">{data.count}</div>
                    <div className="w-20 text-right font-mono text-xs text-gray-500">{INR(data.amount)}</div>
                    <div className="w-10 text-right text-xs text-gray-400">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
