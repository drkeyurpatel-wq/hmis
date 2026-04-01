// lib/collect/ar-types.ts
// Shared TypeScript interfaces for the Collect (AR Tracker) module.

export interface AgingSummary {
  aging_bucket: string;
  claim_count: number;
  total_amount: number;
  total_outstanding: number;
}

export interface InsurerPerformance {
  insurer_id: string;
  insurer_name: string;
  claim_count: number;
  claimed_amount: number;
  settled_amount: number;
  settlement_pct: number;
  avg_days: number;
  open_claims: number;
  open_amount: number;
  query_rate_pct: number;
  disallowance_pct: number;
}

export interface MonthlyTrend {
  month_label: string;
  month_start: string;
  claimed_amount: number;
  settled_amount: number;
  claim_count: number;
  settled_count: number;
  avg_settlement_days: number;
}

export interface ARTask {
  claim_id: string;
  claim_number: string;
  patient_name: string;
  patient_uhid: string;
  insurer_name: string;
  tpa_name: string;
  claimed_amount: number;
  outstanding_amount: number;
  days_outstanding: number;
  aging_bucket: string;
  priority: string;
  has_open_query: boolean;
  task_reason: string;
  last_followup_date: string | null;
  last_followup_note: string | null;
  next_followup_date: string | null;
}

export interface ARClaim {
  id: string;
  bill_id: string;
  pre_auth_id: string | null;
  claim_number: string;
  claim_type: string;
  claimed_amount: number;
  approved_amount: number | null;
  settled_amount: number | null;
  tds_amount: number | null;
  disallowance_amount: number | null;
  disallowance_reason: string | null;
  status: string;
  submitted_at: string;
  settled_at: string | null;
  utr_number: string | null;
  centre_id: string;
  patient_id: string | null;
  insurer_id: string | null;
  tpa_id: string | null;
  days_outstanding: number;
  aging_bucket: string;
  next_followup_date: string | null;
  assigned_to: string | null;
  priority: string;
  has_open_query: boolean;
  query_count: number;
  last_followup_date: string | null;
  last_followup_note: string | null;
  settlement_date: string | null;
  settlement_utr: string | null;
  closure_reason: string | null;
  // Joined relations
  patient?: { id: string; uhid: string; first_name: string; last_name: string; phone_primary?: string };
  insurer?: { id: string; name: string } | null;
  tpa?: { id: string; name: string } | null;
  bill?: { id: string; bill_number: string; net_amount: number; paid_amount: number; balance_amount: number } | null;
  assigned_staff?: { id: string; full_name: string } | null;
}

export interface ClaimFollowup {
  id: string;
  claim_id: string;
  action_type: string;
  contacted_person: string | null;
  description: string;
  outcome: string | null;
  next_followup_date: string | null;
  amount_promised: number | null;
  created_by: string;
  created_at: string;
  staff?: { full_name: string };
}

export interface ClaimQuery {
  id: string;
  claim_id: string;
  query_type: string;
  description: string;
  query_date: string;
  raised_by: string | null;
  status: string;
  response_description: string | null;
  response_date: string | null;
  responded_by: string | null;
  days_to_respond: number | null;
  created_by: string;
  created_at: string;
  staff?: { full_name: string };
  responder?: { full_name: string } | null;
}

export type ClaimStatus = 'submitted' | 'under_review' | 'query' | 'query_raised' | 'approved' | 'partially_settled' | 'settled' | 'rejected' | 'appealed' | 'written_off' | 'closed';

export type ClaimPriority = 'low' | 'normal' | 'high' | 'critical';

export type FollowupAction = 'phone_call' | 'email_sent' | 'email_received' | 'portal_check' | 'document_submitted' | 'document_received' | 'escalation' | 'payment_received' | 'write_off' | 'status_change' | 'note';

export type QueryType = 'document_request' | 'clarification' | 'additional_info' | 'medical_records' | 'investigation' | 'other';

export const AGING_COLORS: Record<string, string> = {
  '0-15': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  '16-30': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  '31-60': 'bg-orange-100 text-orange-700 border-orange-300',
  '61-90': 'bg-red-100 text-red-700 border-red-300',
  '90+': 'bg-red-200 text-red-900 border-red-500',
};

export const AGING_BAR_COLORS: Record<string, string> = {
  '0-15': '#10b981',
  '16-30': '#f59e0b',
  '31-60': '#f97316',
  '61-90': '#dc2626',
  '90+': '#b91c1c',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700 animate-pulse',
};

export const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-indigo-100 text-indigo-700',
  query: 'bg-purple-100 text-purple-700',
  query_raised: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  partially_settled: 'bg-teal-100 text-teal-700',
  settled: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  appealed: 'bg-amber-100 text-amber-700',
  written_off: 'bg-gray-100 text-gray-500',
  closed: 'bg-gray-100 text-gray-500',
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  phone_call: 'Phone Call',
  email_sent: 'Email Sent',
  email_received: 'Email Received',
  portal_check: 'Portal Check',
  document_submitted: 'Document Submitted',
  document_received: 'Document Received',
  escalation: 'Escalation',
  payment_received: 'Payment Received',
  write_off: 'Write Off',
  status_change: 'Status Change',
  note: 'Note',
};

export const QUERY_TYPE_LABELS: Record<string, string> = {
  document_request: 'Document Request',
  clarification: 'Clarification',
  additional_info: 'Additional Info',
  medical_records: 'Medical Records',
  investigation: 'Investigation',
  other: 'Other',
};
