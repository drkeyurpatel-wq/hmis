'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  IndianRupee, CheckCircle, Clock, Search, ArrowUpRight,
  Download, AlertCircle, Loader2, RefreshCw, FileText,
  CreditCard, Building2,
} from 'lucide-react';

const INR = (n: number | null) => !n ? '—' : n >= 100000 ? `₹${(n/100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

export default function SettlementsPage() {
  const router = useRouter();
  const { activeCentreId, staff } = useAuthStore();
  const [tab, setTab] = useState<'pending' | 'settled' | 'all'>('pending');
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [settlementForm, setSettlementForm] = useState({ amount: '', utr: '', mode: 'neft', deduction: '', deduction_reason: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCentreId) return;
    const load = async () => {
      setLoading(true);
      let q = sb().from('clm_claims')
        .select('*, clm_payers(name, type), clm_settlements(id, settlement_amount, net_amount, utr_number, payment_date, payment_mode, is_reconciled, medpay_synced)')
        .eq('centre_id', activeCentreId)
        .order('updated_at', { ascending: false });

      if (tab === 'pending') q = q.in('status', ['claim_approved', 'claim_partial', 'settlement_pending']);
      else if (tab === 'settled') q = q.eq('status', 'settled');
      else q = q.in('status', ['claim_approved', 'claim_partial', 'settlement_pending', 'settled']);

      const { data } = await q.limit(100);
      setClaims(data || []);
      setLoading(false);
    };
    load();
  }, [activeCentreId, tab]);

  const totals = {
    pending_count: claims.filter(c => c.status !== 'settled').length,
    pending_amount: claims.filter(c => c.status !== 'settled').reduce((s, c) => s + (c.approved_amount || c.claimed_amount || 0), 0),
    settled_count: claims.filter(c => c.status === 'settled').length,
    settled_amount: claims.filter(c => c.status === 'settled').reduce((s, c) => s + (c.settled_amount || 0), 0),
    total_deductions: claims.reduce((s, c) => s + (c.deduction_amount || 0), 0),
  };

  const recordSettlement = async (claimId: string) => {
    if (!settlementForm.amount) return;
    setSaving(true);
    try {
      const amount = parseFloat(settlementForm.amount);
      const deduction = parseFloat(settlementForm.deduction) || 0;
      const net = amount - deduction;

      // Create settlement record
      await sb().from('clm_settlements').insert({
        claim_id: claimId,
        settlement_amount: amount,
        tds_amount: 0,
        net_amount: net,
        deduction_amount: deduction,
        deduction_reason: settlementForm.deduction_reason || null,
        utr_number: settlementForm.utr || null,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: settlementForm.mode,
        source: 'manual',
      });

      // Update claim status
      await sb().from('clm_claims').update({
        status: 'settled',
        settled_amount: amount,
        deduction_amount: deduction,
        settlement_utr: settlementForm.utr || null,
        settlement_date: new Date().toISOString().split('T')[0],
      }).eq('id', claimId);

      setRecordingId(null);
      setSettlementForm({ amount: '', utr: '', mode: 'neft', deduction: '', deduction_reason: '' });
      // Reload
      const { data } = await sb().from('clm_claims')
        .select('*, clm_payers(name, type), clm_settlements(*)')
        .eq('centre_id', activeCentreId)
        .in('status', tab === 'pending' ? ['claim_approved', 'claim_partial', 'settlement_pending'] : tab === 'settled' ? ['settled'] : ['claim_approved', 'claim_partial', 'settlement_pending', 'settled'])
        .order('updated_at', { ascending: false }).limit(100);
      setClaims(data || []);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Settlements</h1>
        <p className="text-sm text-gray-500">Track payments, record UTRs, reconcile with bank statements</p>

        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Pending Settlement</p>
            <p className="text-lg font-bold text-amber-700">{totals.pending_count} claims</p>
            <p className="text-sm font-medium text-amber-600">{INR(totals.pending_amount)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Settled</p>
            <p className="text-lg font-bold text-emerald-700">{totals.settled_count} claims</p>
            <p className="text-sm font-medium text-emerald-600">{INR(totals.settled_amount)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Total Deductions</p>
            <p className="text-lg font-bold text-red-700">{INR(totals.total_deductions)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Recovery Rate</p>
            <p className="text-lg font-bold text-blue-700">
              {totals.settled_amount && totals.pending_amount ? `${Math.round(100 * totals.settled_amount / (totals.settled_amount + totals.pending_amount))}%` : '—'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {(['pending', 'settled', 'all'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'pending' ? 'Pending' : t === 'settled' ? 'Settled' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading settlements...</div>
        ) : claims.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No claims in this category</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Claim</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Patient</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Payer</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500">Approved</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500">Settled</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500">Deduction</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">UTR</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map(c => (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs font-medium text-blue-600 cursor-pointer hover:underline"
                          onClick={() => router.push(`/claims/${c.id}`)}>{c.claim_number}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-900">{c.patient_name}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">{c.clm_payers?.name}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{INR(c.approved_amount || c.claimed_amount)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-700">{INR(c.settled_amount)}</td>
                      <td className="py-2.5 px-3 text-right text-red-600">{c.deduction_amount ? INR(c.deduction_amount) : '—'}</td>
                      <td className="py-2.5 px-3">
                        {c.settlement_utr ? <span className="font-mono text-xs">{c.settlement_utr}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {c.status !== 'settled' && (
                          <button onClick={() => setRecordingId(recordingId === c.id ? null : c.id)}
                            className="px-2 py-1 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700">
                            Record
                          </button>
                        )}
                      </td>
                    </tr>
                    {recordingId === c.id && (
                      <tr>
                        <td colSpan={8} className="px-3 py-3 bg-emerald-50">
                          <div className="grid grid-cols-5 gap-3">
                            <div>
                              <label className="text-xs text-gray-500">Settlement Amount *</label>
                              <input type="number" value={settlementForm.amount}
                                onChange={e => setSettlementForm(f => ({ ...f, amount: e.target.value }))}
                                placeholder={String(c.approved_amount || '')}
                                className="w-full px-2 py-1.5 text-sm border rounded mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">UTR Number</label>
                              <input type="text" value={settlementForm.utr}
                                onChange={e => setSettlementForm(f => ({ ...f, utr: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border rounded mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Mode</label>
                              <select value={settlementForm.mode}
                                onChange={e => setSettlementForm(f => ({ ...f, mode: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border rounded mt-1">
                                <option value="neft">NEFT</option>
                                <option value="rtgs">RTGS</option>
                                <option value="cheque">Cheque</option>
                                <option value="upi">UPI</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Deduction</label>
                              <input type="number" value={settlementForm.deduction}
                                onChange={e => setSettlementForm(f => ({ ...f, deduction: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border rounded mt-1" />
                            </div>
                            <div className="flex items-end gap-2">
                              <button onClick={() => recordSettlement(c.id)} disabled={saving || !settlementForm.amount}
                                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Save
                              </button>
                              <button onClick={() => setRecordingId(null)}
                                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50">Cancel</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
