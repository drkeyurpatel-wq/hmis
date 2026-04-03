'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';
import type {
  FeeAgreement, FeeType, FeeSlab, FeeCalculationResult, PayoutRow, PatientReferralWithFee,
} from './types';

// ── Pure fee calculation (no DB calls) ──

export function calculateFee(
  baseAmount: number,
  agreement: FeeAgreement,
): FeeCalculationResult {
  let grossFee = 0;
  let pctApplied = 0;
  let slabMatched: FeeSlab | undefined;

  switch (agreement.fee_type) {
    case 'percentage':
      pctApplied = agreement.fee_pct;
      grossFee = Math.round((baseAmount * agreement.fee_pct) / 100 * 100) / 100;
      break;

    case 'flat':
      grossFee = agreement.flat_amount;
      break;

    case 'slab': {
      const sorted = [...agreement.slabs].sort((a, b) => a.min_revenue - b.min_revenue);
      const match = sorted.find(s => baseAmount >= s.min_revenue && baseAmount <= s.max_revenue);
      if (match) {
        slabMatched = match;
        if (match.fee_pct > 0) {
          pctApplied = match.fee_pct;
          grossFee = Math.round((baseAmount * match.fee_pct) / 100 * 100) / 100;
        } else {
          grossFee = match.flat_amount;
        }
      }
      break;
    }

    case 'none':
    default:
      break;
  }

  const tdsAmount = agreement.tds_applicable
    ? Math.round((grossFee * agreement.tds_pct) / 100 * 100) / 100
    : 0;
  const netPayable = Math.round((grossFee - tdsAmount) * 100) / 100;

  return {
    base_amount: baseAmount,
    fee_type: agreement.fee_type,
    fee_pct_applied: pctApplied,
    gross_fee: grossFee,
    tds_applicable: agreement.tds_applicable,
    tds_pct: agreement.tds_pct,
    tds_amount: tdsAmount,
    net_payable: netPayable,
    slab_matched: slabMatched,
  };
}

// ── Fee agreement CRUD ──

export function useReferralFeeAgreements(centreId: string | null) {
  const [agreements, setAgreements] = useState<Record<string, FeeAgreement>>({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!centreId) { setLoading(false); return; }
    setLoading(true);

    try {
      // Load fee agreements from referral_sources columns
      const { data: sources } = await sb()
        .from('referral_sources')
        .select('id, fee_type, fee_pct, flat_amount, tds_applicable, tds_pct')
        .eq('centre_id', centreId)
        .eq('is_active', true);

      // Load slabs if any
      const { data: slabs } = await sb()
        .from('hmis_referral_fee_slabs')
        .select('*')
        .eq('centre_id', centreId)
        .order('min_revenue');

      if (!mountedRef.current) return;

      const slabsBySource: Record<string, FeeSlab[]> = {};
      (slabs || []).forEach((s: any) => {
        if (!slabsBySource[s.source_id]) slabsBySource[s.source_id] = [];
        slabsBySource[s.source_id].push({
          id: s.id,
          min_revenue: parseFloat(s.min_revenue || '0'),
          max_revenue: parseFloat(s.max_revenue || '0'),
          fee_pct: parseFloat(s.fee_pct || '0'),
          flat_amount: parseFloat(s.flat_amount || '0'),
        });
      });

      const map: Record<string, FeeAgreement> = {};
      (sources || []).forEach((s: any) => {
        map[s.id] = {
          source_id: s.id,
          fee_type: s.fee_type || 'none',
          fee_pct: parseFloat(s.fee_pct || '0'),
          flat_amount: parseFloat(s.flat_amount || '0'),
          tds_applicable: s.tds_applicable ?? true,
          tds_pct: parseFloat(s.tds_pct || '10'),
          slabs: slabsBySource[s.id] || [],
        };
      });

      setAgreements(map);
    } catch {
      // Tables may not have fee columns yet — use defaults
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const saveAgreement = useCallback(async (sourceId: string, agreement: Partial<FeeAgreement>) => {
    const { error } = await sb()
      .from('referral_sources')
      .update({
        fee_type: agreement.fee_type,
        fee_pct: agreement.fee_pct,
        flat_amount: agreement.flat_amount,
        tds_applicable: agreement.tds_applicable,
        tds_pct: agreement.tds_pct,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId);

    if (error) return { success: false, error: error.message };

    // Save slabs if slab type
    if (agreement.fee_type === 'slab' && agreement.slabs) {
      // Delete existing slabs
      await sb().from('hmis_referral_fee_slabs').delete().eq('referring_doctor_id', sourceId);
      // Insert new slabs
      if (agreement.slabs.length > 0) {
        await sb().from('hmis_referral_fee_slabs').insert(
          agreement.slabs.map(s => ({
            referring_doctor_id: sourceId,
            centre_id: centreId,
            min_revenue: s.min_revenue,
            max_revenue: s.max_revenue,
            fee_pct: s.fee_pct,
            flat_amount: s.flat_amount,
          }))
        );
      }
    }

    load();
    return { success: true };
  }, [centreId, load]);

  const getAgreement = useCallback((sourceId: string): FeeAgreement => {
    return agreements[sourceId] || {
      referring_doctor_id: sourceId,
      fee_type: 'none' as FeeType,
      fee_pct: 0,
      flat_amount: 0,
      tds_applicable: true,
      tds_pct: 10,
      slabs: [],
    };
  }, [agreements]);

  return { agreements, loading, load, saveAgreement, getAgreement };
}

// ── Payout summary ──

export function useReferralPayouts(centreId: string | null, startDate: string, endDate: string) {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!centreId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      // Load referrals with source and fee info
      const { data: refs, error: refErr } = await sb()
        .from('patient_referrals')
        .select(`
          id, patient_id, visit_type, bill_amount, collection_amount, created_at, notes,
          fee_type, fee_pct, gross_fee, tds_amount, net_payable, fee_paid, payment_date, payment_mode, payment_ref,
          source:referral_sources!inner(
            id, name, fee_type, fee_pct, flat_amount, tds_applicable, tds_pct,
            type:referral_source_types(code, label)
          ),
          patient:hmis_patients!patient_referrals_patient_id_fkey(first_name, last_name, uhid)
        `)
        .eq('centre_id', centreId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (refErr) { setError(refErr.message); setLoading(false); return; }
      if (!mountedRef.current) return;

      // Group by source
      const bySource: Record<string, PayoutRow> = {};

      (refs || []).forEach((r: any) => {
        const src = r.source;
        if (!src) return;
        const key = src.id;

        if (!bySource[key]) {
          bySource[key] = {
            source_id: src.id,
            source_name: src.name,
            type_code: src.type?.code || '',
            type_label: src.type?.label || '',
            patient_count: 0,
            total_billed: 0,
            fee_type: src.fee_type || 'none',
            gross_fee: 0,
            tds_amount: 0,
            net_payable: 0,
            paid_amount: 0,
            pending_amount: 0,
            referrals: [],
          };
        }

        const billAmt = parseFloat(r.bill_amount || '0');
        const grossFee = parseFloat(r.gross_fee || '0');
        const tdsAmt = parseFloat(r.tds_amount || '0');
        const netPay = parseFloat(r.net_payable || '0');

        bySource[key].patient_count++;
        bySource[key].total_billed += billAmt;
        bySource[key].gross_fee += grossFee;
        bySource[key].tds_amount += tdsAmt;
        bySource[key].net_payable += netPay;
        if (r.fee_paid) bySource[key].paid_amount += netPay;
        else bySource[key].pending_amount += netPay;

        bySource[key].referrals.push({
          ...r,
          source_name: src.name,
          source_type_code: src.type?.code || '',
          patient_name: `${r.patient?.first_name || ''} ${r.patient?.last_name || ''}`.trim(),
          patient_uhid: r.patient?.uhid || '',
          bill_amount: billAmt,
          collection_amount: parseFloat(r.collection_amount || '0'),
          fee_type: r.fee_type || src.fee_type || 'none',
          fee_pct: parseFloat(r.fee_pct || '0'),
          gross_fee: grossFee,
          tds_amount: tdsAmt,
          net_payable: netPay,
          fee_paid: r.fee_paid || false,
          payment_date: r.payment_date,
          payment_mode: r.payment_mode,
          payment_ref: r.payment_ref,
        });
      });

      setPayouts(Object.values(bySource).sort((a, b) => b.net_payable - a.net_payable));
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message || 'Failed to load payouts');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [centreId, startDate, endDate]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const totals = useMemo(() => ({
    totalBilled: payouts.reduce((s, p) => s + p.total_billed, 0),
    totalGrossFee: payouts.reduce((s, p) => s + p.gross_fee, 0),
    totalTds: payouts.reduce((s, p) => s + p.tds_amount, 0),
    totalNetPayable: payouts.reduce((s, p) => s + p.net_payable, 0),
    totalPaid: payouts.reduce((s, p) => s + p.paid_amount, 0),
    totalPending: payouts.reduce((s, p) => s + p.pending_amount, 0),
    sourceCount: payouts.length,
    patientCount: payouts.reduce((s, p) => s + p.patient_count, 0),
  }), [payouts]);

  // Calculate fees for a batch of referrals using their source agreement
  const recalculateFees = useCallback(async (referralIds: string[], agreementMap: Record<string, FeeAgreement>) => {
    let updated = 0;
    for (const refId of referralIds) {
      const ref = payouts.flatMap(p => p.referrals).find(r => r.id === refId);
      if (!ref) continue;

      const agreement = agreementMap[ref.source_id];
      if (!agreement || agreement.fee_type === 'none') continue;

      const result = calculateFee(ref.bill_amount, agreement);

      const { error } = await sb()
        .from('patient_referrals')
        .update({
          fee_type: result.fee_type,
          fee_pct: result.fee_pct_applied,
          gross_fee: result.gross_fee,
          tds_amount: result.tds_amount,
          net_payable: result.net_payable,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refId);

      if (!error) updated++;
    }
    load();
    return { updated };
  }, [payouts, load]);

  // Mark a referral fee as paid
  const markPaid = useCallback(async (referralId: string, payment: { mode: string; ref?: string; date: string }) => {
    const { error } = await sb()
      .from('patient_referrals')
      .update({
        fee_paid: true,
        payment_mode: payment.mode,
        payment_ref: payment.ref || null,
        payment_date: payment.date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', referralId);

    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [load]);

  return { payouts, totals, loading, error, refetch: load, recalculateFees, markPaid };
}
