'use client';
// lib/collect/useARClaimDetail.ts
// Hook for single claim detail view with full joins, followups, queries, and mutations.

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { ARClaim, ClaimFollowup, ClaimQuery } from './ar-types';

// ---- Fetch single claim with joins ----
export function useClaimDetail(claimId: string | null) {
  const [claim, setClaim] = useState<ARClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!claimId || !sb()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await sb()
      .from('hmis_claims')
      .select(`
        *,
        patient:hmis_patients!hmis_claims_patient_id_fkey(id, uhid, first_name, last_name, phone_primary),
        insurer:hmis_insurers(id, name),
        tpa:hmis_tpas(id, name),
        bill:hmis_bills(id, bill_number, net_amount, paid_amount, balance_amount),
        assigned_staff:hmis_staff!hmis_claims_assigned_to_fkey(id, full_name)
      `)
      .eq('id', claimId)
      .single();

    if (err) { setError(err.message); setClaim(null); }
    else { setClaim(data as ARClaim); }
    setLoading(false);
  }, [claimId]);

  useEffect(() => { load(); }, [load]);
  return { claim, loading, error, refetch: load };
}

// ---- Followup history ----
export function useClaimFollowups(claimId: string | null) {
  const [followups, setFollowups] = useState<ClaimFollowup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!claimId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const { data } = await sb()
      .from('ar_claim_followups')
      .select('*, staff:hmis_staff!ar_claim_followups_created_by_fkey(full_name)')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false });
    setFollowups((data as ClaimFollowup[]) || []);
    setLoading(false);
  }, [claimId]);

  useEffect(() => { load(); }, [load]);
  return { followups, loading, refetch: load };
}

// ---- Queries history ----
export function useClaimQueries(claimId: string | null) {
  const [queries, setQueries] = useState<ClaimQuery[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!claimId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const { data } = await sb()
      .from('ar_claim_queries')
      .select('*, staff:hmis_staff!ar_claim_queries_created_by_fkey(full_name), responder:hmis_staff!ar_claim_queries_responded_by_fkey(full_name)')
      .eq('claim_id', claimId)
      .order('query_date', { ascending: false });
    setQueries((data as ClaimQuery[]) || []);
    setLoading(false);
  }, [claimId]);

  useEffect(() => { load(); }, [load]);
  return { queries, loading, refetch: load };
}

// ---- Log new follow-up ----
export function useCreateFollowup(onSuccess?: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: {
    claimId: string;
    actionType: string;
    contactedPerson?: string;
    description: string;
    outcome?: string;
    nextFollowupDate?: string;
    amountPromised?: number;
    staffId: string;
  }) => {
    if (!sb()) return false;
    setSaving(true);
    setError(null);
    const { error: err } = await sb().from('ar_claim_followups').insert({
      claim_id: input.claimId,
      action_type: input.actionType,
      contacted_person: input.contactedPerson || null,
      description: input.description,
      outcome: input.outcome || null,
      next_followup_date: input.nextFollowupDate || null,
      amount_promised: input.amountPromised || null,
      created_by: input.staffId,
    });
    setSaving(false);
    if (err) { setError(err.message); return false; }
    onSuccess?.();
    return true;
  }, [onSuccess]);

  return { create, saving, error };
}

// ---- Log new query ----
export function useCreateQuery(onSuccess?: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: {
    claimId: string;
    queryType: string;
    description: string;
    raisedBy?: string;
    staffId: string;
  }) => {
    if (!sb()) return false;
    setSaving(true);
    setError(null);
    const { error: err } = await sb().from('ar_claim_queries').insert({
      claim_id: input.claimId,
      query_type: input.queryType,
      description: input.description,
      raised_by: input.raisedBy || null,
      status: 'open',
      created_by: input.staffId,
    });
    setSaving(false);
    if (err) { setError(err.message); return false; }
    onSuccess?.();
    return true;
  }, [onSuccess]);

  return { create, saving, error };
}

// ---- Respond to query ----
export function useRespondToQuery(onSuccess?: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = useCallback(async (queryId: string, input: {
    responseDescription: string;
    staffId: string;
  }) => {
    if (!sb()) return false;
    setSaving(true);
    setError(null);
    const { error: err } = await sb().from('ar_claim_queries').update({
      response_description: input.responseDescription,
      response_date: new Date().toISOString().split('T')[0],
      responded_by: input.staffId,
      status: 'responded',
      days_to_respond: null, // trigger will calculate
    }).eq('id', queryId);
    setSaving(false);
    if (err) { setError(err.message); return false; }
    onSuccess?.();
    return true;
  }, [onSuccess]);

  return { respond, saving, error };
}

// ---- Update claim fields ----
export function useUpdateClaimDetail(onSuccess?: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (claimId: string, updates: Partial<{
    assigned_to: string | null;
    priority: string;
    next_followup_date: string | null;
    status: string;
    settled_amount: number;
    tds_amount: number;
    disallowance_amount: number;
    settlement_date: string;
    settlement_utr: string;
    closure_reason: string;
    settled_at: string;
  }>) => {
    if (!sb()) return false;
    setSaving(true);
    setError(null);
    const { error: err } = await sb().from('hmis_claims').update(updates).eq('id', claimId);
    setSaving(false);
    if (err) { setError(err.message); return false; }
    onSuccess?.();
    return true;
  }, [onSuccess]);

  return { update, saving, error };
}

// ---- Mark settled ----
export function useSettleClaim(onSuccess?: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settle = useCallback(async (claimId: string, input: {
    settledAmount: number;
    tdsAmount: number;
    disallowanceAmount: number;
    settlementDate: string;
    settlementUtr: string;
    staffId: string;
  }) => {
    if (!sb()) return false;
    setSaving(true);
    setError(null);

    // Update claim
    const { error: err } = await sb().from('hmis_claims').update({
      settled_amount: input.settledAmount,
      tds_amount: input.tdsAmount,
      disallowance_amount: input.disallowanceAmount,
      settlement_date: input.settlementDate,
      settlement_utr: input.settlementUtr,
      settled_at: new Date().toISOString(),
      status: 'settled',
    }).eq('id', claimId);

    if (err) { setSaving(false); setError(err.message); return false; }

    // Auto-log follow-up
    await sb().from('ar_claim_followups').insert({
      claim_id: claimId,
      action_type: 'payment_received',
      description: `Settlement received: ${input.settledAmount.toLocaleString('en-IN')} via UTR ${input.settlementUtr}`,
      outcome: 'Claim settled',
      created_by: input.staffId,
    });

    setSaving(false);
    onSuccess?.();
    return true;
  }, [onSuccess]);

  return { settle, saving, error };
}
