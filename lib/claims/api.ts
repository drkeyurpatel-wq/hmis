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
    .select('id, first_name, last_name, phone_primary, uhid, date_of_birth, gender, registration_centre_id, abha_id')
    .eq('registration_centre_id', centreId)
    .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,uhid.ilike.%${search}%,phone_primary.ilike.%${search}%`)
    .limit(10);
  if (error) throw error;
  // Map to expected format
  return (data || []).map(p => ({
    ...p,
    name: [p.first_name, p.last_name].filter(Boolean).join(' '),
    phone: p.phone_primary,
    dob: p.date_of_birth,
    centre_id: p.registration_centre_id,
  }));
}

// ─── HMIS Active Admissions (for linking claim to admission) ───
export async function fetchActiveAdmissions(patientId: string) {
  const { data, error } = await supabase()
    .from('hmis_admissions')
    .select('id, ipd_number, admission_date, department_id, primary_doctor_id, status, provisional_diagnosis, final_diagnosis, icd_codes, hmis_staff!primary_doctor_id(name, full_name), hmis_departments(name)')
    .eq('patient_id', patientId)
    .in('status', ['active', 'discharged'])
    .order('admission_date', { ascending: false })
    .limit(5);
  if (error) throw error;
  // Map to expected format
  return (data || []).map(a => ({
    ...a,
    admission_number: a.ipd_number,
    treating_doctor_id: a.primary_doctor_id,
    hmis_staff: a.hmis_staff,
  }));
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

// ─── Add Query to Claim ───
export async function addClaimQuery(params: {
  claim_id: string;
  query_text: string;
  query_category: string;
  priority: string;
  routed_to_role?: string;
  source?: string;
}) {
  // Get next query number
  const { data: existing } = await supabase()
    .from('clm_queries')
    .select('query_number')
    .eq('claim_id', params.claim_id)
    .order('query_number', { ascending: false })
    .limit(1);
  const nextNum = (existing?.[0]?.query_number || 0) + 1;

  // Default SLA: 48h from now
  const sla = new Date(Date.now() + 48 * 3600000).toISOString();

  const { data, error } = await supabase()
    .from('clm_queries')
    .insert({
      claim_id: params.claim_id,
      query_number: nextNum,
      query_text: params.query_text,
      query_category: params.query_category,
      priority: params.priority,
      routed_to_role: params.routed_to_role || null,
      source: params.source || 'manual',
      sla_deadline: sla,
    })
    .select()
    .single();
  if (error) throw error;

  // Update claim status to query
  const claim = await fetchClaim(params.claim_id);
  if (claim && ['preauth_pending', 'preauth_approved'].includes(claim.status)) {
    await updateClaim(params.claim_id, { status: 'preauth_query' as ClaimStatus });
  } else if (claim && ['claim_submitted', 'claim_under_review'].includes(claim.status)) {
    await updateClaim(params.claim_id, { status: 'claim_query' as ClaimStatus });
  }

  return data;
}

// ─── Fetch Claim Queries ───
export async function fetchClaimQueries(claimId: string) {
  const { data, error } = await supabase()
    .from('clm_queries')
    .select('*')
    .eq('claim_id', claimId)
    .order('query_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── Upload Document ───
export async function uploadClaimDocument(params: {
  claim_id: string;
  file: File;
  document_name: string;
  document_category: string;
}) {
  const s = supabase();
  const ext = params.file.name.split('.').pop();
  const path = `claims/${params.claim_id}/${Date.now()}_${params.document_name.replace(/\s+/g, '_')}.${ext}`;

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await s.storage
    .from('claim-documents')
    .upload(path, params.file);
  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = s.storage
    .from('claim-documents')
    .getPublicUrl(path);

  // Create document record
  const { data, error } = await s
    .from('clm_documents')
    .insert({
      claim_id: params.claim_id,
      document_name: params.document_name,
      document_category: params.document_category,
      file_path: path,
      file_url: urlData?.publicUrl || path,
      file_size_bytes: params.file.size,
      mime_type: params.file.type,
      source: 'manual',
      status: 'uploaded',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Record Settlement with MedPay Bridge ───
export async function recordSettlementWithMedPay(params: {
  claim_id: string;
  settlement_amount: number;
  deduction_amount?: number;
  deduction_reason?: string;
  utr_number?: string;
  payment_mode?: string;
  staff_id?: string;
}) {
  const s = supabase();
  const net = params.settlement_amount - (params.deduction_amount || 0);

  // 1. Create settlement record
  const { error: settError } = await s.from('clm_settlements').insert({
    claim_id: params.claim_id,
    settlement_amount: params.settlement_amount,
    tds_amount: 0,
    net_amount: net,
    deduction_amount: params.deduction_amount || 0,
    deduction_reason: params.deduction_reason || null,
    utr_number: params.utr_number || null,
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: params.payment_mode || 'neft',
    source: 'manual',
  });
  if (settError) throw settError;

  // 2. Update claim status to settled
  const { error: clmError } = await s.from('clm_claims').update({
    status: 'settled' as ClaimStatus,
    settled_amount: params.settlement_amount,
    deduction_amount: params.deduction_amount || 0,
    settlement_utr: params.utr_number || null,
    settlement_date: new Date().toISOString().split('T')[0],
  }).eq('id', params.claim_id);
  if (clmError) throw clmError;

  // 3. MedPay bridge — write settlement info
  // MedPay reads from HMIS Supabase (same DB), so we just flag it
  await s.from('clm_claims').update({
    medpay_synced: true,
    medpay_synced_at: new Date().toISOString(),
  }).eq('id', params.claim_id);

  return { success: true, net_amount: net };
}

