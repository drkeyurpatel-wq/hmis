'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { RoleGuard, CardSkeleton, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useReferralSources, useReferralSourceTypes } from '@/lib/referrals/useReferralSources';
import {
  calculateFee,
  useReferralFeeAgreements,
  useReferralPayouts,
} from '@/lib/referrals/useReferralPayCalculator';
import type { FeeAgreement, FeeType, FeeSlab, FeeCalculationResult, PayoutRow } from '@/lib/referrals/types';

const INR = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const CI = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-h1-teal focus:ring-1 focus:ring-h1-teal bg-white';
const CL = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1';
const FEE_TYPE_LABELS: Record<string, string> = { percentage: '% of Bill', flat: 'Flat Fee', slab: 'Slab-based', none: 'No Fee' };
const PAYMENT_MODES = ['NEFT', 'Cash', 'Cheque', 'UPI'];

type Tab = 'calculator' | 'agreements' | 'payouts';

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
  };
}

function PayCalcInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  const [tab, setTab] = useState<Tab>('calculator');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Date range for payouts
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  const { sources } = useReferralSources(centreId);
  const { types: sourceTypes } = useReferralSourceTypes();
  const { agreements, loading: agLoading, saveAgreement, getAgreement } = useReferralFeeAgreements(centreId);
  const { payouts, totals, loading: payLoading, error: payError, refetch, recalculateFees, markPaid } = useReferralPayouts(centreId, startDate, endDate);

  // ── Calculator state ──
  const [calcSourceId, setCalcSourceId] = useState('');
  const [calcAmount, setCalcAmount] = useState('');
  const [calcResult, setCalcResult] = useState<FeeCalculationResult | null>(null);

  const runCalc = useCallback(() => {
    const amt = parseFloat(calcAmount);
    if (!calcSourceId || isNaN(amt) || amt <= 0) { setCalcResult(null); return; }
    const ag = getAgreement(calcSourceId);
    setCalcResult(calculateFee(amt, ag));
  }, [calcSourceId, calcAmount, getAgreement]);

  // ── Agreement editor state ──
  const [editSourceId, setEditSourceId] = useState<string | null>(null);
  const [editAg, setEditAg] = useState<FeeAgreement | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const startEdit = useCallback((sourceId: string) => {
    setEditSourceId(sourceId);
    const existing = getAgreement(sourceId);
    setEditAg({ ...existing, slabs: [...existing.slabs] });
  }, [getAgreement]);

  const handleSaveAgreement = useCallback(async () => {
    if (!editSourceId || !editAg) return;
    setEditSaving(true);
    const result = await saveAgreement(editSourceId, editAg);
    if (result.success) {
      flash('Fee agreement saved');
      setEditSourceId(null);
      setEditAg(null);
    } else {
      flash(result.error || 'Failed to save');
    }
    setEditSaving(false);
  }, [editSourceId, editAg, saveAgreement]);

  const addSlab = useCallback(() => {
    if (!editAg) return;
    const last = editAg.slabs[editAg.slabs.length - 1];
    setEditAg({
      ...editAg,
      slabs: [...editAg.slabs, { min_revenue: last ? last.max_revenue + 1 : 0, max_revenue: last ? last.max_revenue + 100000 : 100000, fee_pct: 0, flat_amount: 0 }],
    });
  }, [editAg]);

  const removeSlab = useCallback((idx: number) => {
    if (!editAg) return;
    setEditAg({ ...editAg, slabs: editAg.slabs.filter((_, i) => i !== idx) });
  }, [editAg]);

  const updateSlab = useCallback((idx: number, field: keyof FeeSlab, value: number) => {
    if (!editAg) return;
    const slabs = [...editAg.slabs];
    slabs[idx] = { ...slabs[idx], [field]: value };
    setEditAg({ ...editAg, slabs });
  }, [editAg]);

  // ── Payout actions ──
  const [payingRef, setPayingRef] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ mode: 'NEFT', ref: '', date: new Date().toISOString().split('T')[0] });
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);

  const handleMarkPaid = useCallback(async () => {
    if (!payingRef) return;
    const result = await markPaid(payingRef, { mode: payForm.mode, ref: payForm.ref, date: payForm.date });
    if (result.success) {
      flash('Payment recorded');
      setPayingRef(null);
    } else {
      flash(result.error || 'Failed to record payment');
    }
  }, [payingRef, payForm, markPaid]);

  const handleRecalcAll = useCallback(async () => {
    const allRefIds = payouts.flatMap(p => p.referrals.filter(r => !r.fee_paid && r.bill_amount > 0).map(r => r.id));
    if (allRefIds.length === 0) { flash('No unpaid referrals to recalculate'); return; }
    const result = await recalculateFees(allRefIds, agreements);
    flash(`Recalculated fees for ${result.updated} referrals`);
  }, [payouts, agreements, recalculateFees]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'calculator', label: 'Quick Calculator' },
    { key: 'agreements', label: 'Fee Agreements' },
    { key: 'payouts', label: 'Payout Summary' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-h1-navy text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/referrals" className="hover:text-h1-teal cursor-pointer">Referral Tracker</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Pay Calculator</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Referral Pay Calculator</h1>
          <p className="text-sm text-gray-500">Configure fee agreements, calculate payouts, and track payments</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? 'border-h1-teal text-h1-teal'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: Quick Calculator ═══════════ */}
      {tab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Calculate Referral Fee</h2>

            <div>
              <label className={CL}>Referral Source</label>
              <select
                className={CI}
                value={calcSourceId}
                onChange={e => { setCalcSourceId(e.target.value); setCalcResult(null); }}
              >
                <option value="">Select a source...</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.type_label})</option>
                ))}
              </select>
            </div>

            {calcSourceId && (
              <>
                <div className="p-3 bg-gray-50 rounded-lg text-xs">
                  <p className="font-medium text-gray-700 mb-1">Current Agreement</p>
                  {(() => {
                    const ag = getAgreement(calcSourceId);
                    return (
                      <div className="space-y-0.5 text-gray-500">
                        <p>Fee Type: <span className="font-medium text-gray-900">{FEE_TYPE_LABELS[ag.fee_type]}</span></p>
                        {ag.fee_type === 'percentage' && <p>Rate: <span className="font-medium text-gray-900">{ag.fee_pct}%</span></p>}
                        {ag.fee_type === 'flat' && <p>Amount: <span className="font-medium text-gray-900">{INR(ag.flat_amount)}</span></p>}
                        {ag.fee_type === 'slab' && <p>Slabs: <span className="font-medium text-gray-900">{ag.slabs.length} configured</span></p>}
                        <p>TDS: <span className="font-medium text-gray-900">{ag.tds_applicable ? `${ag.tds_pct}%` : 'N/A'}</span></p>
                      </div>
                    );
                  })()}
                  <button onClick={() => startEdit(calcSourceId)} className="mt-2 text-h1-teal text-[11px] font-medium hover:underline cursor-pointer">
                    Edit agreement
                  </button>
                </div>

                <div>
                  <label className={CL}>Bill Amount (₹)</label>
                  <input
                    className={CI}
                    type="number"
                    min="0"
                    step="100"
                    value={calcAmount}
                    onChange={e => { setCalcAmount(e.target.value); setCalcResult(null); }}
                    placeholder="Enter bill amount"
                  />
                </div>

                <button
                  onClick={runCalc}
                  disabled={!calcAmount || parseFloat(calcAmount) <= 0}
                  className="w-full py-2.5 bg-h1-navy text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-h1-navy/90 transition-colors cursor-pointer"
                >
                  Calculate Fee
                </button>
              </>
            )}
          </div>

          {/* Result Panel */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Fee Breakdown</h2>

            {!calcResult ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Select a source and enter a bill amount to calculate
              </div>
            ) : (
              <div className="space-y-4">
                {/* Big number */}
                <div className="text-center py-4 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl">
                  <p className="text-[10px] uppercase tracking-wider text-teal-600 font-medium">Net Payable</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{INR(calcResult.net_payable)}</p>
                </div>

                {/* Breakdown table */}
                <div className="divide-y text-sm">
                  <Row label="Bill Amount" value={INR(calcResult.base_amount)} />
                  <Row label="Fee Type" value={FEE_TYPE_LABELS[calcResult.fee_type]} />
                  {calcResult.fee_pct_applied > 0 && <Row label="Fee Rate" value={`${calcResult.fee_pct_applied}%`} />}
                  <Row label="Gross Fee" value={INR(calcResult.gross_fee)} bold />
                  {calcResult.tds_applicable && (
                    <>
                      <Row label={`TDS @ ${calcResult.tds_pct}%`} value={`- ${INR(calcResult.tds_amount)}`} red />
                      <Row label="Net Payable" value={INR(calcResult.net_payable)} bold />
                    </>
                  )}
                  {calcResult.slab_matched && (
                    <Row label="Slab Matched" value={`${INR(calcResult.slab_matched.min_revenue)} – ${INR(calcResult.slab_matched.max_revenue)}`} />
                  )}
                </div>

                {/* Quick scenario buttons */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-medium mb-2">Quick Scenarios</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[10000, 25000, 50000, 100000, 250000, 500000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => { setCalcAmount(String(amt)); setTimeout(runCalc, 0); }}
                        className="px-2.5 py-1 text-[11px] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        {INR(amt)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: Fee Agreements ═══════════ */}
      {tab === 'agreements' && (
        <div className="space-y-4">
          {/* Agreement editor modal-like panel */}
          {editSourceId && editAg && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-blue-900">
                  Edit Fee Agreement — {sources.find(s => s.id === editSourceId)?.name}
                </h3>
                <button onClick={() => { setEditSourceId(null); setEditAg(null); }} className="text-blue-400 hover:text-blue-600 cursor-pointer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className={CL}>Fee Type</label>
                  <select className={CI} value={editAg.fee_type} onChange={e => setEditAg({ ...editAg, fee_type: e.target.value as FeeType })}>
                    <option value="none">No Fee</option>
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat Fee</option>
                    <option value="slab">Slab-based</option>
                  </select>
                </div>
                {editAg.fee_type === 'percentage' && (
                  <div>
                    <label className={CL}>Fee %</label>
                    <input className={CI} type="number" min="0" max="100" step="0.5" value={editAg.fee_pct}
                      onChange={e => setEditAg({ ...editAg, fee_pct: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
                {editAg.fee_type === 'flat' && (
                  <div>
                    <label className={CL}>Flat Amount (₹)</label>
                    <input className={CI} type="number" min="0" step="100" value={editAg.flat_amount}
                      onChange={e => setEditAg({ ...editAg, flat_amount: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
                <div>
                  <label className={CL}>TDS Applicable</label>
                  <select className={CI} value={editAg.tds_applicable ? 'yes' : 'no'}
                    onChange={e => setEditAg({ ...editAg, tds_applicable: e.target.value === 'yes' })}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                {editAg.tds_applicable && (
                  <div>
                    <label className={CL}>TDS %</label>
                    <input className={CI} type="number" min="0" max="30" step="0.5" value={editAg.tds_pct}
                      onChange={e => setEditAg({ ...editAg, tds_pct: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
              </div>

              {/* Slab editor */}
              {editAg.fee_type === 'slab' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-800">Revenue Slabs</p>
                    <button onClick={addSlab} className="text-[11px] text-blue-600 font-medium hover:underline cursor-pointer">+ Add Slab</button>
                  </div>
                  {editAg.slabs.length === 0 && <p className="text-xs text-gray-400">No slabs configured. Add at least one slab.</p>}
                  {editAg.slabs.map((slab, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 items-end">
                      <div>
                        <label className="text-[9px] text-gray-500">Min Revenue (₹)</label>
                        <input className={CI} type="number" value={slab.min_revenue}
                          onChange={e => updateSlab(i, 'min_revenue', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">Max Revenue (₹)</label>
                        <input className={CI} type="number" value={slab.max_revenue}
                          onChange={e => updateSlab(i, 'max_revenue', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">Fee %</label>
                        <input className={CI} type="number" step="0.5" value={slab.fee_pct}
                          onChange={e => updateSlab(i, 'fee_pct', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">Or Flat (₹)</label>
                        <input className={CI} type="number" value={slab.flat_amount}
                          onChange={e => updateSlab(i, 'flat_amount', parseFloat(e.target.value) || 0)} />
                      </div>
                      <button onClick={() => removeSlab(i)} className="px-2 py-2.5 text-red-400 hover:text-red-600 cursor-pointer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleSaveAgreement} disabled={editSaving}
                  className="px-4 py-2 text-sm font-medium bg-h1-navy text-white rounded-lg disabled:opacity-50 cursor-pointer">
                  {editSaving ? 'Saving...' : 'Save Agreement'}
                </button>
                <button onClick={() => { setEditSourceId(null); setEditAg(null); }}
                  className="px-4 py-2 text-sm font-medium bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
              </div>
            </div>
          )}

          {/* Agreements list */}
          {agLoading ? <TableSkeleton rows={6} cols={6} /> : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-bold text-gray-900">Fee Agreements by Source</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-500 font-medium">
                      <th className="px-4 py-2.5">Source</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Fee Structure</th>
                      <th className="px-4 py-2.5">TDS</th>
                      <th className="px-4 py-2.5 text-right">Patients</th>
                      <th className="px-4 py-2.5 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No referral sources. Add sources first.</td></tr>
                    ) : sources.map(s => {
                      const ag = getAgreement(s.id);
                      return (
                        <tr key={s.id} className="border-t hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{s.type_label}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              ag.fee_type === 'none' ? 'bg-gray-100 text-gray-500' :
                              ag.fee_type === 'percentage' ? 'bg-blue-100 text-blue-700' :
                              ag.fee_type === 'flat' ? 'bg-purple-100 text-purple-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {FEE_TYPE_LABELS[ag.fee_type]}
                              {ag.fee_type === 'percentage' && ` — ${ag.fee_pct}%`}
                              {ag.fee_type === 'flat' && ` — ${INR(ag.flat_amount)}`}
                              {ag.fee_type === 'slab' && ` — ${ag.slabs.length} slabs`}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{ag.tds_applicable ? `${ag.tds_pct}%` : '—'}</td>
                          <td className="px-4 py-2.5 text-right">{s.total_patients}</td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => startEdit(s.id)}
                              className="px-2 py-1 text-[10px] bg-gray-100 rounded hover:bg-gray-200 cursor-pointer">
                              {ag.fee_type === 'none' ? 'Set Fee' : 'Edit'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: Payout Summary ═══════════ */}
      {tab === 'payouts' && (
        <div className="space-y-4">
          {/* Filters + Actions */}
          <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className={CL}>From</label>
              <input type="date" className="px-2.5 py-1.5 text-xs border rounded-lg" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className={CL}>To</label>
              <input type="date" className="px-2.5 py-1.5 text-xs border rounded-lg" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button onClick={() => refetch()} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">Refresh</button>
            <button onClick={handleRecalcAll} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 cursor-pointer">Recalculate All Fees</button>
          </div>

          {/* Summary Cards */}
          {payLoading ? (
            <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <CardSkeleton key={i} />)}</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SumCard label="Total Billed" value={INR(totals.totalBilled)} color="blue" />
              <SumCard label="Gross Fees" value={INR(totals.totalGrossFee)} color="purple" />
              <SumCard label="TDS Deducted" value={INR(totals.totalTds)} color="amber" />
              <SumCard label="Net Payable" value={INR(totals.totalNetPayable)}
                sub={`${INR(totals.totalPaid)} paid · ${INR(totals.totalPending)} pending`} color="teal" />
            </div>
          )}

          {/* Payout error */}
          {payError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {payError}
              <button onClick={() => refetch()} className="ml-2 text-red-500 underline cursor-pointer">Retry</button>
            </div>
          )}

          {/* Payment modal */}
          {payingRef && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-green-900">Record Payment</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={CL}>Mode</label>
                  <select className={CI} value={payForm.mode} onChange={e => setPayForm(p => ({ ...p, mode: e.target.value }))}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={CL}>Reference / UTR</label>
                  <input className={CI} value={payForm.ref} onChange={e => setPayForm(p => ({ ...p, ref: e.target.value }))} placeholder="Optional" />
                </div>
                <div>
                  <label className={CL}>Date</label>
                  <input className={CI} type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleMarkPaid} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">Confirm Payment</button>
                <button onClick={() => setPayingRef(null)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
              </div>
            </div>
          )}

          {/* Payouts table */}
          {payLoading ? <TableSkeleton rows={6} cols={8} /> : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Payouts by Source ({payouts.length})</h2>
                <span className="text-xs text-gray-400">{totals.patientCount} patients</span>
              </div>
              {payouts.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-400 text-sm">No referral payouts for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500 font-medium">
                        <th className="px-4 py-2.5">Source</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5 text-right">Patients</th>
                        <th className="px-4 py-2.5 text-right">Billed</th>
                        <th className="px-4 py-2.5 text-right">Gross Fee</th>
                        <th className="px-4 py-2.5 text-right">TDS</th>
                        <th className="px-4 py-2.5 text-right">Net Payable</th>
                        <th className="px-4 py-2.5 text-right">Paid</th>
                        <th className="px-4 py-2.5 text-right">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map(p => (
                        <React.Fragment key={p.source_id}>
                          <tr
                            className={`border-t hover:bg-gray-50 transition-colors cursor-pointer ${expandedPayout === p.source_id ? 'bg-blue-50' : ''}`}
                            onClick={() => setExpandedPayout(expandedPayout === p.source_id ? null : p.source_id)}
                          >
                            <td className="px-4 py-2.5 font-medium text-gray-900">{p.source_name}</td>
                            <td className="px-4 py-2.5 text-gray-500">{p.type_label}</td>
                            <td className="px-4 py-2.5 text-right">{p.patient_count}</td>
                            <td className="px-4 py-2.5 text-right">{INR(p.total_billed)}</td>
                            <td className="px-4 py-2.5 text-right">{INR(p.gross_fee)}</td>
                            <td className="px-4 py-2.5 text-right text-amber-600">{INR(p.tds_amount)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">{INR(p.net_payable)}</td>
                            <td className="px-4 py-2.5 text-right text-green-600">{INR(p.paid_amount)}</td>
                            <td className="px-4 py-2.5 text-right text-red-600">{p.pending_amount > 0 ? INR(p.pending_amount) : '—'}</td>
                          </tr>
                          {/* Expanded detail rows */}
                          {expandedPayout === p.source_id && p.referrals.map(r => (
                            <tr key={r.id} className="bg-blue-50/50 border-t border-blue-100">
                              <td className="px-4 py-2 pl-8 text-gray-600">{r.patient_name || r.patient_uhid}</td>
                              <td className="px-4 py-2 text-gray-400">{r.visit_type?.toUpperCase()}</td>
                              <td className="px-4 py-2" />
                              <td className="px-4 py-2 text-right">{r.bill_amount > 0 ? INR(r.bill_amount) : '—'}</td>
                              <td className="px-4 py-2 text-right">{r.gross_fee > 0 ? INR(r.gross_fee) : '—'}</td>
                              <td className="px-4 py-2 text-right text-amber-500">{r.tds_amount > 0 ? INR(r.tds_amount) : '—'}</td>
                              <td className="px-4 py-2 text-right font-medium">{r.net_payable > 0 ? INR(r.net_payable) : '—'}</td>
                              <td className="px-4 py-2 text-right" colSpan={2}>
                                {r.fee_paid ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                                    Paid {r.payment_date ? new Date(r.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                                  </span>
                                ) : r.net_payable > 0 ? (
                                  <button
                                    onClick={e => { e.stopPropagation(); setPayingRef(r.id); }}
                                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer"
                                  >
                                    Mark Paid
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                      {/* Totals row */}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                        <td className="px-4 py-2.5" colSpan={2}>Total</td>
                        <td className="px-4 py-2.5 text-right">{totals.patientCount}</td>
                        <td className="px-4 py-2.5 text-right">{INR(totals.totalBilled)}</td>
                        <td className="px-4 py-2.5 text-right">{INR(totals.totalGrossFee)}</td>
                        <td className="px-4 py-2.5 text-right text-amber-600">{INR(totals.totalTds)}</td>
                        <td className="px-4 py-2.5 text-right">{INR(totals.totalNetPayable)}</td>
                        <td className="px-4 py-2.5 text-right text-green-600">{INR(totals.totalPaid)}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{INR(totals.totalPending)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, red }: { label: string; value: string; bold?: boolean; red?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : ''} ${red ? 'text-red-600' : ''}`}>{value}</span>
    </div>
  );
}

function SumCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const cls: Record<string, string> = { blue: 'border-l-blue-500', purple: 'border-l-purple-500', amber: 'border-l-amber-500', teal: 'border-l-teal-500' };
  return (
    <div className={`bg-white rounded-xl border border-l-4 ${cls[color] || cls.blue} p-4`}>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PayCalculatorPage() {
  return (
    <RoleGuard module="referrals">
      <PayCalcInner />
    </RoleGuard>
  );
}
