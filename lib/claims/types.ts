// lib/claims/types.ts
// H1 Claims module type definitions

export type ClaimStatus =
  | 'draft'
  | 'preauth_pending' | 'preauth_approved' | 'preauth_query' | 'preauth_rejected' | 'preauth_enhanced'
  | 'claim_submitted' | 'claim_under_review' | 'claim_query'
  | 'claim_approved' | 'claim_partial' | 'claim_rejected'
  | 'settlement_pending' | 'settled' | 'closed' | 'written_off';

export type ClaimType = 'cashless' | 'reimbursement' | 'pmjay' | 'cghs' | 'echs' | 'state_scheme' | 'corporate';

export type QueryPriority = 'low' | 'medium' | 'high' | 'critical';
export type QueryCategory = 'clinical' | 'billing' | 'documentation' | 'policy' | 'other';

export interface Claim {
  id: string;
  claim_number: string;
  centre_id: string;
  payer_id: string;
  claim_type: ClaimType;
  status: ClaimStatus;
  patient_id: string | null;
  admission_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  patient_uhid: string | null;
  abha_id: string | null;
  policy_number: string | null;
  primary_diagnosis: string | null;
  icd_code: string | null;
  procedure_name: string | null;
  treating_doctor_name: string | null;
  department_name: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  estimated_amount: number | null;
  approved_amount: number | null;
  claimed_amount: number | null;
  settled_amount: number | null;
  deduction_amount: number | null;
  patient_payable: number | null;
  tpa_claim_number: string | null;
  tpa_preauth_number: string | null;
  package_name: string | null;
  package_amount: number | null;
  settlement_utr: string | null;
  settlement_date: string | null;
  assigned_to: string | null;
  priority: QueryPriority;
  is_query_pending: boolean;
  query_count: number;
  is_sla_breached: boolean;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  payer?: Payer;
  centre?: { code: string; name: string };
}

export interface Payer {
  id: string;
  code: string;
  name: string;
  type: 'tpa' | 'insurer' | 'government' | 'psu' | 'corporate';
  portal_url: string | null;
  portal_type: string | null;
  is_nhcx_live: boolean;
  is_active: boolean;
  avg_settlement_days: number | null;
}

export interface ClaimQuery {
  id: string;
  claim_id: string;
  query_number: number;
  query_text: string;
  query_category: QueryCategory;
  priority: QueryPriority;
  raised_by: string | null;
  raised_at: string;
  source: string;
  routed_to: string | null;
  routed_to_role: string | null;
  response_text: string | null;
  responded_at: string | null;
  sla_deadline: string | null;
  is_sla_breached: boolean;
  escalation_level: number;
  status: string;
  // Joined
  claim?: Claim;
}

export interface ClaimSettlement {
  id: string;
  claim_id: string;
  settlement_amount: number;
  tds_amount: number;
  net_amount: number;
  deduction_amount: number;
  deduction_reason: string | null;
  utr_number: string | null;
  payment_date: string | null;
  payment_mode: string | null;
  is_reconciled: boolean;
  medpay_synced: boolean;
}

export interface ClaimPreauth {
  id: string;
  claim_id: string;
  request_type: 'initial' | 'enhancement' | 'extension';
  diagnosis: string;
  procedure_planned: string | null;
  estimated_cost: number;
  approved_amount: number | null;
  status: string;
  submitted_at: string | null;
  response_received_at: string | null;
}

export interface TimelineEvent {
  claim_id: string;
  event_type: string;
  event_text: string;
  source: string;
  notes: string | null;
  created_at: string;
}

export interface AgingBucket {
  centre_code: string;
  payer_name: string;
  aging_bucket: string;
  claim_count: number;
  total_amount: number;
}

export interface PayerScorecard {
  payer_id: string;
  payer_name: string;
  payer_type: string;
  total_claims: number;
  settled_count: number;
  rejected_count: number;
  pending_queries: number;
  avg_settlement_days: number | null;
  rejection_rate_pct: number | null;
  total_claimed: number | null;
  total_settled: number | null;
  total_deductions: number | null;
}

// Status display helpers
export const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  preauth_pending: { label: 'Pre-Auth Pending', color: 'text-amber-700', bg: 'bg-amber-50' },
  preauth_approved: { label: 'Pre-Auth Approved', color: 'text-green-700', bg: 'bg-green-50' },
  preauth_query: { label: 'Pre-Auth Query', color: 'text-orange-700', bg: 'bg-orange-50' },
  preauth_rejected: { label: 'Pre-Auth Rejected', color: 'text-red-700', bg: 'bg-red-50' },
  preauth_enhanced: { label: 'Pre-Auth Enhanced', color: 'text-blue-700', bg: 'bg-blue-50' },
  claim_submitted: { label: 'Claim Submitted', color: 'text-blue-700', bg: 'bg-blue-50' },
  claim_under_review: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-50' },
  claim_query: { label: 'Claim Query', color: 'text-orange-700', bg: 'bg-orange-50' },
  claim_approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50' },
  claim_partial: { label: 'Partial Approval', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  claim_rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50' },
  settlement_pending: { label: 'Settlement Pending', color: 'text-purple-700', bg: 'bg-purple-50' },
  settled: { label: 'Settled', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
  written_off: { label: 'Written Off', color: 'text-red-800', bg: 'bg-red-100' },
};

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  cashless: 'Cashless',
  reimbursement: 'Reimbursement',
  pmjay: 'PMJAY',
  cghs: 'CGHS',
  echs: 'ECHS',
  state_scheme: 'State Scheme',
  corporate: 'Corporate',
};

export const PRIORITY_CONFIG: Record<QueryPriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-gray-600', bg: 'bg-gray-100' },
  medium: { label: 'Medium', color: 'text-blue-600', bg: 'bg-blue-50' },
  high: { label: 'High', color: 'text-orange-600', bg: 'bg-orange-50' },
  critical: { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50' },
};
