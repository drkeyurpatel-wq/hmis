// HEALTH1 HMIS — SETTLEMENT TRACKER
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  IndianRupee, CheckCircle2, Clock, Search, ArrowRight,
  Loader2, RefreshCw, Shield, CreditCard, Building2,
  TrendingUp, AlertTriangle, Plus, XCircle, FileText,
} from 'lucide-react';
import { recordSettlement } from '@/lib/claims/api';

const INR = (n: number | null | undefined) => !n ? '—' : n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

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

type Tab = 'pending' | 'settled' | 'all';

export default function SettlementTracker() {
  const router = useRouter();
  const { activeCentreId } = useAuthStore();

  const [claims, setClaims] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Recording state
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: '', utr: '', mode: 'neft', deduction: '', reason: '' });
  const [saving, setSaving] = useState(false);

  // ─── Load ───
  const load = useCallback(async () => {
    if (!activeCentreId) return;
    setLoading(true);
    try {
      const statuses = tab === 'pending'
        ? ['claim_approved', 'claim_partial', 'settlement_pending']
        : tab === 'settled' ? ['settled'] : ['claim_approved', 'claim_partial', 'settlement_pending', 'settled'];
      const { data } = await sb().from('clm_claims')
        .select('*, clm_payers!clm_claims_payer_id_fkey(id, name, type)')
        .eq('centre_id', activeCentreId)
        .in('status', statuses)
        .order('updated_at', { ascending: false })
        .limit(100);
      setClaims(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [activeCentreId, tab]);

  useEffect(() => { load(); }, [load]);
  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); flash('Refreshed'); };

  // ─── Record Settlement ───
  const handleRecord = async (claimId: string) => {
    if (!form.amount) return;
    setSaving(true);
    try {
      await recordSettlement({
        claim_id: claimId,
        settlement_amount: parseFloat(form.amount),
        deduction_amount: parseFloat(form.deduction) || 0,
        deduction_reason: form.reason || undefined,
        utr_number: form.utr || undefined,
        payment_mode: form.mode,
      });
      setRecordingId(null);
      setForm({ amount: '', utr: '', mode: 'neft', deduction: '', reason: '' });
      flash('Settlement recorded');
      await load();
    } catch (e) { console.error(e); flash('Error recording settlement'); }
    setSaving(false);
  };

  // ─── Stats ───
  const pending = claims.filter(c => c.status !== 'settled');
  const settled = claims.filter(c => c.status === 'settled');
  const pendingAmt = pending.reduce((s, c) => s + (c.approved_amount || c.claimed_amount || 0), 0);
  const settledAmt = settled.reduce((s, c) => s + (c.settled_amount || 0), 0);
  const deductions = claims.reduce((s, c) => s + (c.deduction_amount || 0), 0);
  const recoveryRate = settledAmt + pendingAmt > 0 ? Math.round(100 * settledAmt / (settledAmt + pendingAmt)) : 0;

  // Skeleton
  if (loading && claims.length === 0) return (
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
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* ─── Header ─── */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" /> Settlement Tracker
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Record payments, track UTRs, reconcile with bank statements</p>
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

      {/* ─── Stat Cards ─── */}
      <div className="px-6 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Pending Settlement" value={INR(pendingAmt)} sub={`${pending.length} claims`} icon={Clock} color="bg-amber-500" />
          <StatCard label="Settled" value={INR(settledAmt)} sub={`${settled.length} claims`} icon={CheckCircle2} color="bg-emerald-500" />
          <StatCard label="Total Deductions" value={INR(deductions)} icon={XCircle} color={deductions > 0 ? 'bg-red-500' : 'bg-gray-400'} />
          <StatCard label="Recovery Rate" value={`${recoveryRate}%`} sub="Settled / (Settled + Pending)" icon={TrendingUp} color={recoveryRate > 70 ? 'bg-blue-500' : 'bg-orange-500'} />
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-2">
          {([
            { id: 'pending' as Tab, label: 'Pending', icon: Clock, count: pending.length },
            { id: 'settled' as Tab, label: 'Settled', icon: CheckCircle2, count: settled.length },
            { id: 'all' as Tab, label: 'All', icon: FileText, count: claims.length },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-xl transition-all ${
                tab === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
              }`}>
              <t.icon className="w-3 h-3" /> {t.label}
              <span className="ml-0.5 bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="px-6 pb-6">
        {claims.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              {tab === 'pending' ? 'No claims pending settlement' : tab === 'settled' ? 'No settled claims yet' : 'No claims found'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Claim</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payer</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Approved</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Settled</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Deduction</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">UTR</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Days</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => {
                  const isRecording = recordingId === c.id;
                  const isPending = c.status !== 'settled';
                  const daysSince = c.discharge_date
                    ? Math.round((Date.now() - new Date(c.discharge_date).getTime()) / 86400000)
                    : Math.round((Date.now() - new Date(c.created_at).getTime()) / 86400000);
                  return (
                    <tr key={c.id} className={`border-b border-gray-100 last:border-0 transition-colors ${
                      isRecording ? 'bg-emerald-50/50' : 'hover:bg-blue-50/50'
                    }`}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-blue-600 cursor-pointer hover:underline"
                          onClick={() => router.push(`/claims/${c.id}`)}>{c.claim_number}</span>
                        {c.status === 'claim_partial' && (
                          <span className="block text-[9px] font-bold text-amber-600 mt-0.5">PARTIAL</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">{c.patient_name}</p>
                        <p className="text-[10px] text-gray-400">{c.primary_diagnosis || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{c.clm_payers?.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm font-medium text-gray-900">{INR(c.approved_amount || c.claimed_amount)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono text-sm font-semibold ${c.settled_amount ? 'text-emerald-700' : 'text-gray-300'}`}>
                          {INR(c.settled_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono text-sm ${c.deduction_amount ? 'text-red-600' : 'text-gray-300'}`}>
                          {c.deduction_amount ? INR(c.deduction_amount) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.settlement_utr ? (
                          <span className="font-mono text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{c.settlement_utr}</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold font-mono ${
                          isPending && daysSince > 60 ? 'text-red-600' :
                          isPending && daysSince > 30 ? 'text-orange-600' :
                          'text-gray-400'
                        }`}>{daysSince}d</span>
                      </td>
                      <td className="px-4 py-3">
                        {isPending ? (
                          isRecording ? (
                            <div className="flex flex-col gap-2 min-w-[320px]">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] text-gray-500 uppercase">Amount (₹) *</label>
                                  <input type="number" value={form.amount}
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder={String(c.approved_amount || '')}
                                    className="w-full px-2 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" autoFocus />
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-500 uppercase">UTR</label>
                                  <input type="text" value={form.utr}
                                    onChange={e => setForm(f => ({ ...f, utr: e.target.value }))}
                                    placeholder="NEFT ref"
                                    className="w-full px-2 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-500 uppercase">Mode</label>
                                  <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                                    className="w-full px-2 py-1.5 text-xs border rounded-lg mt-0.5">
                                    <option value="neft">NEFT</option><option value="rtgs">RTGS</option>
                                    <option value="cheque">Cheque</option><option value="upi">UPI</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-500 uppercase">Deduction (₹)</label>
                                  <input type="number" value={form.deduction}
                                    onChange={e => setForm(f => ({ ...f, deduction: e.target.value }))}
                                    placeholder="0"
                                    className="w-full px-2 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => { setRecordingId(null); setForm({ amount: '', utr: '', mode: 'neft', deduction: '', reason: '' }); }}
                                  className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50">Cancel</button>
                                <button onClick={() => handleRecord(c.id)} disabled={saving || !form.amount}
                                  className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Record Settlement
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setRecordingId(c.id)}
                              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1">
                              <IndianRupee className="w-3 h-3" /> Record
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> {c.settlement_date ? new Date(c.settlement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Settled'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {claims.length > 0 && (
          <div className="mt-3 text-xs text-gray-400 text-center">
            {claims.length} claim{claims.length !== 1 ? 's' : ''} shown
          </div>
        )}
      </div>
    </div>
  );
}
