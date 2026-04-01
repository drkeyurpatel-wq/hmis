'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { PatientReferral, NewPatientReferralInput } from './types';

export function usePatientReferrals(centreId: string | null, patientId?: string) {
  const [referrals, setReferrals] = useState<PatientReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!centreId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      let q = sb()
        .from('patient_referrals')
        .select(`
          *,
          source:referral_sources(name, type_id, referral_source_types:referral_source_types(code))
        `)
        .eq('centre_id', centreId)
        .order('created_at', { ascending: false });

      if (patientId) {
        q = q.eq('patient_id', patientId);
      }

      const { data, error: sbError } = await q.limit(200);
      if (!mountedRef.current) return;

      if (sbError) {
        setError(sbError.message);
        return;
      }

      setReferrals((data || []).map((r: any) => ({
        ...r,
        source_name: r.source?.name || '',
        source_type_code: r.source?.referral_source_types?.code || '',
        bill_amount: parseFloat(r.bill_amount || '0'),
        collection_amount: parseFloat(r.collection_amount || '0'),
      })));
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message || 'Failed to load referrals');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [centreId, patientId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const logReferral = useCallback(async (input: NewPatientReferralInput) => {
    if (!centreId) return { success: false, error: 'No centre selected' };

    const { data, error: sbError } = await sb()
      .from('patient_referrals')
      .insert({
        centre_id: centreId,
        patient_id: input.patient_id,
        visit_id: input.visit_id || null,
        source_id: input.source_id,
        visit_type: input.visit_type || 'opd',
        notes: input.notes || null,
        referred_by_staff_id: input.referred_by_staff_id || null,
      })
      .select('id')
      .single();

    if (sbError) return { success: false, error: sbError.message };
    load();
    return { success: true, data };
  }, [centreId, load]);

  const updateBilling = useCallback(async (referralId: string, billAmount: number, collectionAmount: number) => {
    const { error: sbError } = await sb()
      .from('patient_referrals')
      .update({
        bill_amount: billAmount,
        collection_amount: collectionAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', referralId);

    if (sbError) return { success: false, error: sbError.message };
    load();
    return { success: true };
  }, [load]);

  return { referrals, loading, error, logReferral, updateBilling, refetch: load };
}
