// lib/claims/api.ts — FIXED PostgREST patterns
// Rules: explicit FK names, NO nested embeds, try/catch everywhere

import { sb } from '@/lib/supabase/browser';
import type { ClaimStatus, ClaimType } from './types';

const supabase = () => sb();

// ─── Dashboard Stats ───
export async function fetchClaimStats(centreId: string) {
  try {
    const { data, error } = await supabase()
      .from('clm_claims')
      .select('status, claimed_amount, settled_amount, estimated_amount, approved_amount, deduction_amount')
      .eq('centre_id', centreId);
    if (error) { console.error('fetchClaimStats:', error); return null; }
    const c = data || [];
    return {
      total: c.length,
      preauth_pending: c.filter(x => ['preauth_pending','preauth_query'].includes(x.status)).length,
      open_queries: c.filter(x => ['preauth_query','claim_query'].includes(x.status)).length,
      under_review: c.filter(x => ['claim_submitted','claim_under_review'].includes(x.status)).length,
      settlement_pending: c.filter(x => ['claim_approved','claim_partial','settlement_pending'].includes(x.status)).length,
      settled: c.filter(x => x.status === 'settled').length,
      rejected: c.filter(x => ['preauth_rejected','claim_rejected'].includes(x.status)).length,
      total_claimed: c.reduce((s,x) => s + (x.claimed_amount || x.estimated_amount || 0), 0),
      total_settled: c.reduce((s,x) => s + (x.settled_amount || 0), 0),
      total_outstanding: c.filter(x => !['settled','closed','written_off','draft'].includes(x.status))
        .reduce((s,x) => s + (x.claimed_amount || x.approved_amount || x.estimated_amount || 0), 0),
    };
  } catch (e) { console.error(e); return null; }
}

// ─── Claims List ───
export async function fetchClaims(centreId: string, filters?: {
  statuses?: ClaimStatus[]; payer_id?: string; claim_type?: ClaimType; search?: string; limit?: number;
}) {
  try {
    let q = supabase().from('clm_claims')
      .select('*, clm_payers!clm_claims_payer_id_fkey(id, code, name, type)')
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 100);
    if (filters?.statuses?.length) q = q.in('status', filters.statuses);
    if (filters?.payer_id) q = q.eq('payer_id', filters.payer_id);
    if (filters?.claim_type) q = q.eq('claim_type', filters.claim_type);
    if (filters?.search) q = q.or(`patient_name.ilike.%${filters.search}%,claim_number.ilike.%${filters.search}%,tpa_claim_number.ilike.%${filters.search}%`);
    const { data, error } = await q;
    if (error) { console.error('fetchClaims:', error); return []; }
    return data || [];
  } catch (e) { console.error(e); return []; }
}

// ─── Single Claim ───
export async function fetchClaim(claimId: string) {
  try {
    const { data, error } = await supabase().from('clm_claims')
      .select('*, clm_payers!clm_claims_payer_id_fkey(id, code, name, type)')
      .eq('id', claimId).single();
    if (error) { console.error('fetchClaim:', error); return null; }
    return data;
  } catch (e) { console.error(e); return null; }
}

// ─── Create / Update Claim ───
export async function createClaim(claim: Record<string, any>) {
  const { data, error } = await supabase().from('clm_claims').insert(claim).select('id, claim_number').single();
  if (error) throw error;
  return data;
}
export async function updateClaim(id: string, updates: Record<string, any>) {
  const { data, error } = await supabase().from('clm_claims').update(updates).eq('id', id).select('id, claim_number, status').single();
  if (error) throw error;
  return data;
}

// ─── Payers ───
export async function fetchPayers() {
  try {
    const { data } = await supabase().from('clm_payers').select('*').eq('is_active', true).order('name');
    return data || [];
  } catch (e) { return []; }
}

// ─── Open Queries (flat — NO nested embed) ───
export async function fetchOpenQueries(centreId: string) {
  try {
    const { data: queries } = await supabase().from('clm_queries').select('*')
      .in('status', ['open','in_progress','escalated']).order('raised_at', { ascending: true });
    if (!queries?.length) return [];
    const claimIds = [...new Set(queries.map(q => q.claim_id))];
    const { data: claims } = await supabase().from('clm_claims').select('id, claim_number, patient_name, centre_id, payer_id').in('id', claimIds);
    const payerIds = [...new Set((claims||[]).map(c => c.payer_id))];
    const { data: payers } = await supabase().from('clm_payers').select('id, name').in('id', payerIds);
    const cm = Object.fromEntries((claims||[]).map(c => [c.id, c]));
    const pm = Object.fromEntries((payers||[]).map(p => [p.id, p]));
    return queries.map(q => {
      const cl = cm[q.claim_id]; if (!cl || cl.centre_id !== centreId) return null;
      return { ...q, claim_number: cl.claim_number, patient_name: cl.patient_name, payer_name: pm[cl.payer_id]?.name || '' };
    }).filter(Boolean);
  } catch (e) { console.error(e); return []; }
}

// ─── Rejections (flat) ───
export async function fetchRejections(centreId: string) {
  try {
    const { data: rejs } = await supabase().from('clm_rejections').select('*').order('rejected_at', { ascending: false }).limit(50);
    if (!rejs?.length) return [];
    const claimIds = [...new Set(rejs.map(r => r.claim_id))];
    const { data: claims } = await supabase().from('clm_claims').select('id, claim_number, patient_name, centre_id, claimed_amount, payer_id').in('id', claimIds);
    const payerIds = [...new Set((claims||[]).map(c => c.payer_id))];
    const { data: payers } = await supabase().from('clm_payers').select('id, name').in('id', payerIds);
    const cm = Object.fromEntries((claims||[]).map(c => [c.id, c]));
    const pm = Object.fromEntries((payers||[]).map(p => [p.id, p]));
    return rejs.map(r => {
      const cl = cm[r.claim_id]; if (!cl || cl.centre_id !== centreId) return null;
      return { ...r, claim_number: cl.claim_number, patient_name: cl.patient_name, claimed_amount: cl.claimed_amount, payer_name: pm[cl.payer_id]?.name || '' };
    }).filter(Boolean);
  } catch (e) { console.error(e); return []; }
}

// ─── Timeline (with fallback) ───
export async function fetchClaimTimeline(claimId: string) {
  try {
    const { data, error } = await supabase().from('clm_v_timeline').select('*').eq('claim_id', claimId);
    if (error) {
      const { data: t } = await supabase().from('clm_state_transitions').select('*').eq('claim_id', claimId).order('created_at', { ascending: false });
      return (t||[]).map(x => ({ claim_id: x.claim_id, event_type: 'status_change', event_text: `${x.from_status||'new'} → ${x.to_status}`, source: x.trigger_source, notes: x.notes, created_at: x.created_at }));
    }
    return (data||[]).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (e) { return []; }
}

// ─── Claim Queries / Documents ───
export async function fetchClaimQueries(claimId: string) {
  try { const { data } = await supabase().from('clm_queries').select('*').eq('claim_id', claimId).order('query_number'); return data || []; } catch { return []; }
}
export async function fetchClaimDocuments(claimId: string) {
  try { const { data } = await supabase().from('clm_documents').select('*').eq('claim_id', claimId).order('sort_order'); return data || []; } catch { return []; }
}

// ─── HMIS Patient Search (correct column names) ───
export async function searchHMISPatients(search: string, centreId: string) {
  try {
    const { data } = await supabase().from('hmis_patients')
      .select('id, first_name, last_name, phone_primary, uhid, date_of_birth, gender, registration_centre_id, abha_id')
      .eq('registration_centre_id', centreId)
      .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,uhid.ilike.%${search}%,phone_primary.ilike.%${search}%`)
      .limit(10);
    return (data||[]).map(p => ({ ...p, name: [p.first_name, p.last_name].filter(Boolean).join(' '), phone: p.phone_primary, dob: p.date_of_birth, centre_id: p.registration_centre_id }));
  } catch { return []; }
}

// ─── HMIS Admissions (NO embedded staff — separate queries) ───
export async function fetchActiveAdmissions(patientId: string) {
  try {
    const { data: adm } = await supabase().from('hmis_admissions')
      .select('id, ipd_number, admission_date, department_id, primary_doctor_id, status, provisional_diagnosis, final_diagnosis, icd_codes')
      .eq('patient_id', patientId).in('status', ['active','discharged']).order('admission_date', { ascending: false }).limit(5);
    if (!adm?.length) return [];
    const docIds = [...new Set(adm.map(a => a.primary_doctor_id).filter(Boolean))];
    const deptIds = [...new Set(adm.map(a => a.department_id).filter(Boolean))];
    const [docRes, deptRes] = await Promise.all([
      docIds.length ? supabase().from('hmis_staff').select('id, name, full_name').in('id', docIds) : { data: [] },
      deptIds.length ? supabase().from('hmis_departments').select('id, name').in('id', deptIds) : { data: [] },
    ]);
    const dm = Object.fromEntries((docRes.data||[]).map(d => [d.id, d]));
    const dpm = Object.fromEntries((deptRes.data||[]).map(d => [d.id, d]));
    return adm.map(a => ({ ...a, admission_number: a.ipd_number, treating_doctor_id: a.primary_doctor_id, hmis_staff: dm[a.primary_doctor_id]||null, hmis_departments: dpm[a.department_id]||null }));
  } catch { return []; }
}

// ─── HMIS Patient Insurance (NO nested embed) ───
export async function fetchPatientInsurance(patientId: string) {
  try {
    const { data: ins } = await supabase().from('hmis_patient_insurance').select('*').eq('patient_id', patientId).order('is_primary', { ascending: false });
    if (!ins?.length) return [];
    const iIds = [...new Set(ins.map(i => i.insurer_id).filter(Boolean))];
    const tIds = [...new Set(ins.map(i => i.tpa_id).filter(Boolean))];
    const [iRes, tRes] = await Promise.all([
      iIds.length ? supabase().from('hmis_insurers').select('id, name, code').in('id', iIds) : { data: [] },
      tIds.length ? supabase().from('hmis_tpas').select('id, name, code').in('id', tIds) : { data: [] },
    ]);
    const im = Object.fromEntries((iRes.data||[]).map(i => [i.id, i]));
    const tm = Object.fromEntries((tRes.data||[]).map(t => [t.id, t]));
    return ins.map(i => ({ ...i, hmis_insurers: im[i.insurer_id]||null, hmis_tpas: tm[i.tpa_id]||null }));
  } catch { return []; }
}

// ─── Doc Checklist / Aging / Scorecard ───
export async function fetchDocChecklist(payerId: string, claimType: ClaimType) {
  try { const { data } = await supabase().from('clm_doc_checklists').select('*').eq('payer_id', payerId).eq('claim_type', claimType).order('sort_order'); return data || []; } catch { return []; }
}
export async function fetchAgingAnalysis(centreId?: string) {
  try { let q = supabase().from('clm_v_aging').select('*'); if (centreId) q = q.eq('centre_id', centreId); const { data } = await q; return data || []; } catch { return []; }
}
export async function fetchPayerScorecard() {
  try { const { data } = await supabase().from('clm_v_payer_scorecard').select('*').order('total_claims', { ascending: false }); return data || []; } catch { return []; }
}

// ─── Add Query ───
export async function addClaimQuery(params: { claim_id: string; query_text: string; query_category: string; priority: string; routed_to_role?: string; }) {
  const { data: ex } = await supabase().from('clm_queries').select('query_number').eq('claim_id', params.claim_id).order('query_number', { ascending: false }).limit(1);
  const num = (ex?.[0]?.query_number || 0) + 1;
  const { data, error } = await supabase().from('clm_queries').insert({
    claim_id: params.claim_id, query_number: num, query_text: params.query_text,
    query_category: params.query_category, priority: params.priority,
    routed_to_role: params.routed_to_role || null, source: 'manual',
    sla_deadline: new Date(Date.now() + 48*3600000).toISOString(),
  }).select('id').single();
  if (error) throw error;
  const claim = await fetchClaim(params.claim_id);
  if (claim?.status && ['preauth_pending','preauth_approved'].includes(claim.status)) await updateClaim(params.claim_id, { status: 'preauth_query' });
  else if (claim?.status && ['claim_submitted','claim_under_review'].includes(claim.status)) await updateClaim(params.claim_id, { status: 'claim_query' });
  return data;
}

// ─── Upload Document ───
export async function uploadClaimDocument(params: { claim_id: string; file: File; document_name: string; document_category: string; }) {
  const s = supabase();
  const ext = params.file.name.split('.').pop() || 'pdf';
  const docName = params.document_name || params.file.name.replace(/\.[^/.]+$/, '');
  const path = `claims/${params.claim_id}/${Date.now()}_${docName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
  const { error: ue } = await s.storage.from('claim-documents').upload(path, params.file);
  if (ue) throw ue;
  const { data: url } = s.storage.from('claim-documents').getPublicUrl(path);
  const { data, error } = await s.from('clm_documents').insert({
    claim_id: params.claim_id, document_name: docName, document_category: params.document_category || 'clinical',
    file_path: path, file_url: url?.publicUrl || path, file_size_bytes: params.file.size, mime_type: params.file.type,
    source: 'manual', status: 'uploaded',
  }).select('id').single();
  if (error) throw error;
  return data;
}

// ─── Record Settlement ───
export async function recordSettlement(params: { claim_id: string; settlement_amount: number; deduction_amount?: number; deduction_reason?: string; utr_number?: string; payment_mode?: string; }) {
  const net = params.settlement_amount - (params.deduction_amount || 0);
  const { error: se } = await supabase().from('clm_settlements').insert({
    claim_id: params.claim_id, settlement_amount: params.settlement_amount, tds_amount: 0, net_amount: net,
    deduction_amount: params.deduction_amount || 0, deduction_reason: params.deduction_reason || null,
    utr_number: params.utr_number || null, payment_date: new Date().toISOString().split('T')[0],
    payment_mode: params.payment_mode || 'neft', source: 'manual',
  });
  if (se) throw se;
  const { error: ce } = await supabase().from('clm_claims').update({
    status: 'settled', settled_amount: params.settlement_amount, deduction_amount: params.deduction_amount || 0,
    settlement_utr: params.utr_number || null, settlement_date: new Date().toISOString().split('T')[0],
    medpay_synced: true, medpay_synced_at: new Date().toISOString(),
  }).eq('id', params.claim_id);
  if (ce) throw ce;
  return { success: true, net_amount: net };
}
