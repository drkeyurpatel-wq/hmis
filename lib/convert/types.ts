// lib/convert/types.ts
// Types for OPD→IPD Conversion Funnel module

export interface ConversionLead {
  id: string;
  centre_id: string;
  patient_id: string;
  opd_visit_id: string | null;
  consulting_doctor_id: string | null;
  department_id: string | null;
  visit_date: string;
  advised_procedure: string;
  advised_type: AdvisedType;
  diagnosis: string | null;
  icd_code: string | null;
  urgency: Urgency;
  estimated_cost: number | null;
  estimated_stay_days: number | null;
  patient_concern: string | null;
  insurance_applicable: boolean;
  insurance_coverage_pct: number | null;
  status: LeadStatus;
  assigned_counselor_id: string | null;
  admission_id: string | null;
  conversion_days: number | null;
  revenue_generated: number | null;
  next_followup_date: string | null;
  followup_count: number;
  last_followup_date: string | null;
  last_followup_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AdvisedType = 'ipd' | 'surgery' | 'procedure' | 'daycare' | 'investigation';
export type Urgency = 'routine' | 'soon' | 'urgent' | 'emergency';

export type LeadStatus =
  | 'advised' | 'contacted' | 'interested' | 'scheduled'
  | 'admitted' | 'completed'
  | 'lost_cost' | 'lost_fear' | 'lost_second_opinion'
  | 'lost_no_response' | 'lost_deferred' | 'lost_other';

export type ActionType = 'phone_call' | 'whatsapp' | 'sms' | 'in_person' | 'email' | 'note';

export type FollowupOutcome =
  | 'interested' | 'needs_time' | 'cost_concern' | 'wants_callback'
  | 'not_reachable' | 'wrong_number' | 'declined' | 'scheduled' | 'other';

export interface ConversionFollowup {
  id: string;
  lead_id: string;
  action_type: ActionType;
  action_description: string;
  outcome: FollowupOutcome | null;
  next_followup_date: string | null;
  performed_by: string;
  created_at: string;
}

export interface FunnelStage {
  status: string;
  lead_count: number;
  total_estimated_revenue: number;
  avg_days_in_stage: number;
}

export interface ConversionTask {
  lead_id: string;
  patient_name: string;
  patient_phone: string;
  patient_uhid: string;
  doctor_name: string;
  department: string;
  advised_procedure: string;
  urgency: Urgency;
  estimated_cost: number | null;
  status: LeadStatus;
  days_since_advised: number;
  followup_count: number;
  last_followup_date: string | null;
  next_followup_date: string | null;
  task_reason: string;
}

export interface DoctorConversionRate {
  doctor_id: string;
  doctor_name: string;
  department: string;
  total_advised: number;
  total_converted: number;
  conversion_rate: number;
  total_lost: number;
  top_loss_reason: string | null;
  estimated_lost_revenue: number;
  actual_converted_revenue: number;
  avg_conversion_days: number | null;
}

// Pipeline stage labels and colors
export const PIPELINE_STAGES: LeadStatus[] = [
  'advised', 'contacted', 'interested', 'scheduled', 'admitted', 'completed',
];

export const LOST_STATUSES: LeadStatus[] = [
  'lost_cost', 'lost_fear', 'lost_second_opinion',
  'lost_no_response', 'lost_deferred', 'lost_other',
];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  advised: 'Advised',
  contacted: 'Contacted',
  interested: 'Interested',
  scheduled: 'Scheduled',
  admitted: 'Admitted',
  completed: 'Completed',
  lost_cost: 'Lost — Cost',
  lost_fear: 'Lost — Fear',
  lost_second_opinion: 'Lost — Second Opinion',
  lost_no_response: 'Lost — No Response',
  lost_deferred: 'Lost — Deferred',
  lost_other: 'Lost — Other',
};

export const STATUS_COLORS: Record<string, string> = {
  advised: '#6366f1',       // indigo
  contacted: '#8b5cf6',     // violet
  interested: '#3b82f6',    // blue
  scheduled: '#0ea5e9',     // sky
  admitted: '#10b981',      // emerald
  completed: '#059669',     // green
  lost_cost: '#ef4444',
  lost_fear: '#f97316',
  lost_second_opinion: '#eab308',
  lost_no_response: '#94a3b8',
  lost_deferred: '#78716c',
  lost_other: '#dc2626',
};

export const URGENCY_COLORS: Record<Urgency, string> = {
  routine: 'bg-gray-100 text-gray-700',
  soon: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-orange-100 text-orange-800',
  emergency: 'bg-red-100 text-red-800',
};

export const ADVISED_TYPE_LABELS: Record<AdvisedType, string> = {
  ipd: 'IPD Admission',
  surgery: 'Surgery',
  procedure: 'Procedure',
  daycare: 'Daycare',
  investigation: 'Investigation',
};

export const CONCERN_LABELS: Record<string, string> = {
  cost: 'Cost concern',
  fear: 'Fear / Anxiety',
  second_opinion: 'Wants second opinion',
  time_off_work: 'Time off work',
  travel: 'Travel difficulty',
  other: 'Other',
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  phone_call: 'Phone Call',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  in_person: 'In Person',
  email: 'Email',
  note: 'Note',
};

export const OUTCOME_LABELS: Record<FollowupOutcome, string> = {
  interested: 'Interested',
  needs_time: 'Needs Time',
  cost_concern: 'Cost Concern',
  wants_callback: 'Wants Callback',
  not_reachable: 'Not Reachable',
  wrong_number: 'Wrong Number',
  declined: 'Declined',
  scheduled: 'Scheduled',
  other: 'Other',
};
