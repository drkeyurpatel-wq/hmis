// lib/claims/api.ts
// H1 Claims data fetching layer

import { sb } from '@/lib/supabase/browser';
import type { Claim, ClaimStatus, ClaimType, Payer, ClaimQuery } from './types';

const supabase = () => sb();

// ─── Dashboard Stats ───
export async function fetchClaimStats(centreId: string) {
  const s = supabase();
  const { data, error } = await s
    .from('clm_claims')
    .select('status, claimed_amount, settled_amount, estimated_amount, approved_amount')
    .eq('centre_id', centreId);
  if (error) throw error;

  const claims = data || [];
  const total = claims.length;
  const preauth_pending = claims.filter(c => ['preauth_pending', 'preauth_query'].includes(c.status)).length;
  const open_queries = claims.filter(c => ['preauth_query', 'claim_query'].includes(c.status)).length;
  const under_review = claims.filter(c => ['claim_submitted', 'claim_under_review'].includes(c.status)).length;
  const settlement_pending = claims.filter(c => c.status === 'settlement_pending').length;
  const settled = claims.filter(c => c.status === 'settled').length;
  const rejected = claims.filter(c => ['preauth_rejected', 'claim_rejected'].includes(c.status)).length;
  const total_claimed = claims.reduce((s, c) => s + (c.claimed_amount || 0), 0);
  const total_settled = claims.reduce((s, c) => s + (c.settled_amount || 0), 0);
  const total_outstanding = claims
    .filter(c => !['settled', 'closed', 'written_off', 'draft'].includes(c.status))
    .reduce((s, c) => s + (c.claimed_amount || c.estimated_amount || 0), 0);

  return {
    total, preauth_pending, open_queries, under_review,
    settlement_pending, settled, rejected,
    total_claimed, total_settled, total_outstanding,
  };
}

// ─── Claims List ───
export async function fetchClaims(centreId: string, filters?: {
  status?: ClaimStatus;
  claim_type?: ClaimType;
  payer_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const s = supabase();
  let q = s
    .from('clm_claims')
    .select('*, clm_payers!inner(id, code, name, type)')
    .eq('centre_id', centreId)
    .order('created_at', { ascending: false });

  if (filters?.status) q = q.eq('status', filters.status);
  if (filters?.claim_type) q = q.eq('claim_type', filters.claim_type);
  if (filters?.payer_id) q = q.eq('payer_id', filters.payer_id);
  if (filters?.search) {
    q = q.or(`patient_name.ilike.%${filters.search}%,claim_number.ilike.%${filters.search}%,tpa_claim_number.ilike.%${filters.search}%`);
  }
  if (filters?.limit) q = q.limit(filters.limit);
  if (filters?.offset) q = q.range(filters.offset, filters.offset + (filters?.limit || 50) - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { claims: data || [], count };
}

// ─── Single Claim ───
export async function fetchClaim(claimId: string) {
  const { data, error } = await supabase()
    .from('clm_claims')
    .select('*, clm_payers(id, code, name, type)')
    .eq('id', claimId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Create Claim ───
export async function createClaim(claim: Partial<Claim>) {
  const { data, error } = await supabase()
    .from('clm_claims')
    .insert(claim)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Update Claim ───
export async function updateClaim(id: string, updates: Partial<Claim>) {
  const { data, error } = await supabase()
    .from('clm_claims')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Payers ───
export async function fetchPayers() {
  const { data, error } = await supabase()
    .from('clm_payers')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

// ─── Queries ───
export async function fetchOpenQueries(centreId: string) {
  const { data, error } = await supabase()
    .from('clm_v_open_queries')
    .select('*')
    .eq('centre_code', centreId);
  if (error) {
    // View might filter by centre_code; fallback to join
    const { data: d2, error: e2 } = await supabase()
      .from('clm_queries')
      .select('*, clm_claims!inner(claim_number, patient_name, centre_id, clm_payers(name))')
      .in('status', ['open', 'in_progress', 'escalated'])
      .order('raised_at', { ascending: true });
    if (e2) throw e2;
    return (d2 || []).filter((q: any) => q.clm_claims?.centre_id === centreId);
  }
  return data || [];
}

// ─── Timeline ───
export async function fetchClaimTimeline(claimId: string) {
  const { data, error } = await supabase()
    .from('clm_v_timeline')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── HMIS Patient Lookup (for new claim auto-populate) ───
export async function searchHMISPatients(search: string, centreId: string) {
  const { data, error } = await supabase()
    .from('hmis_patients')
    .select('id, name, phone, uhid, dob, gender, centre_id, abha_id')
    .eq('centre_id', centreId)
    .or(`name.ilike.%${search}%,uhid.ilike.%${search}%,phone.ilike.%${search}%`)
    .limit(10);
  if (error) throw error;
  return data || [];
}

// ─── HMIS Active Admissions (for linking claim to admission) ───
export async function fetchActiveAdmissions(patientId: string) {
  const { data, error } = await supabase()
    .from('hmis_admissions')
    .select('id, admission_number, admission_date, department_id, treating_doctor_id, status, hmis_staff!treating_doctor_id(name), hmis_departments(name)')
    .eq('patient_id', patientId)
    .in('status', ['active', 'discharged'])
    .order('admission_date', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data || [];
}

// ─── HMIS Patient Insurance (for auto-populate policy) ───
export async function fetchPatientInsurance(patientId: string) {
  const { data, error } = await supabase()
    .from('hmis_patient_insurance')
    .select('*, hmis_insurers(name, code), hmis_tpas(name, code)')
    .eq('patient_id', patientId)
    .order('is_primary', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Document Checklist ───
export async function fetchDocChecklist(payerId: string, claimType: ClaimType) {
  const { data, error } = await supabase()
    .from('clm_doc_checklists')
    .select('*')
    .eq('payer_id', payerId)
    .eq('claim_type', claimType)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// ─── Claim Documents ───
export async function fetchClaimDocuments(claimId: string) {
  const { data, error } = await supabase()
    .from('clm_documents')
    .select('*')
    .eq('claim_id', claimId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// ─── Aging Analysis ───
export async function fetchAgingAnalysis(centreId?: string) {
  let q = supabase().from('clm_v_aging').select('*');
  if (centreId) q = q.eq('centre_id', centreId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── Payer Scorecard ───
export async function fetchPayerScorecard() {
  const { data, error } = await supabase()
    .from('clm_v_payer_scorecard')
    .select('*')
    .order('total_claims', { ascending: false });
  if (error) throw error;
  return data || [];
}
