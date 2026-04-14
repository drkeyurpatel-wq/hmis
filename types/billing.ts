// Auto-generated Supabase types for billing tables
// Generated: 2026-04-14 20:33:59.631967+00

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Billingauditlog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: Json;
  new_values?: Json;
  ip_address?: string;
  user_agent?: string;
  performed_by: string;
  performed_at?: string;
}

export interface Billingbedchargerules {
  id: string;
  centre_id: string;
  room_category: string;
  ward_type: string;
  charge_per_day: number;
  nursing_charge_per_day?: number;
  service_charge_per_day?: number;
  checkout_time?: any;
  half_day_hours?: number;
  payor_type?: string;
  is_active?: boolean;
  effective_from: string;
  created_at?: string;
}

export interface Billingclaims {
  id: string;
  encounter_id: string;
  pre_auth_id?: string;
  centre_id: string;
  patient_id: string;
  claim_number: string;
  insurance_company_id: string;
  tpa_id?: string;
  claimed_amount: number;
  approved_amount?: number;
  settled_amount?: number;
  deduction_amount?: number;
  tds_amount?: number;
  net_received?: number;
  patient_liability?: number;
  deduction_details?: Json;
  claim_submission_date?: string;
  claim_approval_date?: string;
  settlement_date?: string;
  payment_received_date?: string;
  settlement_utr?: string;
  settlement_reference?: string;
  tpa_claim_number?: string;
  discharge_summary_url?: string;
  final_bill_url?: string;
  documents?: Json;
  pmjay_claim_id?: string;
  pmjay_status?: string;
  status: string;
  query_details?: Json;
  submission_to_settlement_days?: number;
  aging_bucket?: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface Billingcreditnotes {
  id: string;
  original_invoice_id: string;
  credit_note_number: string;
  centre_id: string;
  patient_id: string;
  amount: number;
  reason: string;
  line_items: Json;
  refund_mode?: string;
  refund_reference?: string;
  refund_processed?: boolean;
  refund_processed_at?: string;
  approved_by?: string;
  approved_at?: string;
  status?: string;
  created_by: string;
  created_at?: string;
}

export interface Billingdiscountlogs {
  id: string;
  encounter_id: string;
  line_item_id?: string;
  invoice_id?: string;
  scheme_id?: string;
  discount_type: string;
  original_amount: number;
  discount_amount: number;
  reason: string;
  approved_by?: string;
  approved_at?: string;
  status?: string;
  created_by: string;
  created_at?: string;
}

export interface Billingdiscountschemes {
  id: string;
  centre_id: string;
  scheme_name: string;
  scheme_code: string;
  discount_type: string;
  discount_value?: number;
  category_rules?: Json;
  max_discount_amount?: number;
  requires_approval?: boolean;
  approval_authority?: string;
  auto_apply?: boolean;
  is_active?: boolean;
  valid_from?: string;
  valid_to?: string;
  created_at?: string;
}

export interface Billingencounters {
  id: string;
  centre_id: string;
  patient_id: string;
  encounter_type: string;
  encounter_number: string;
  admission_id?: string;
  bed_id?: string;
  admitting_doctor_id?: string;
  admission_date?: string;
  expected_discharge_date?: string;
  actual_discharge_date?: string;
  appointment_id?: string;
  consulting_doctor_id?: string;
  visit_date?: string;
  primary_payor_type: string;
  primary_payor_id?: string;
  insurance_policy_number?: string;
  insurance_card_number?: string;
  tpa_id?: string;
  insurance_company_id?: string;
  pre_auth_id?: string;
  package_id?: string;
  total_charges?: number;
  total_discounts?: number;
  total_tax?: number;
  net_amount?: number;
  total_paid?: number;
  total_refunded?: number;
  balance_due?: number;
  insurance_approved_amount?: number;
  insurance_settled_amount?: number;
  patient_responsibility?: number;
  status: string;
  billing_locked?: boolean;
  notes?: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface Billinginsurancecompanies {
  id: string;
  centre_id: string;
  company_name: string;
  company_code: string;
  company_type: string;
  tpa_id?: string;
  contact_info?: Json;
  empanelment_number?: string;
  empanelment_valid_till?: string;
  rohini_code?: string;
  is_cashless?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Billinginvoicelineitems {
  id: string;
  invoice_id: string;
  line_item_id: string;
  amount: number;
  created_at?: string;
}

export interface Billinginvoices {
  id: string;
  encounter_id: string;
  centre_id: string;
  patient_id: string;
  invoice_number: string;
  invoice_type: string;
  invoice_date: string;
  subtotal: number;
  total_discount?: number;
  total_tax?: number;
  grand_total: number;
  amount_paid?: number;
  balance_due: number;
  insurance_share?: number;
  patient_share?: number;
  corporate_share?: number;
  discount_authorized_by?: string;
  discount_reason?: string;
  pdf_url?: string;
  pdf_generated_at?: string;
  status: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface Billinglineitems {
  id: string;
  encounter_id: string;
  centre_id: string;
  service_master_id?: string;
  service_code: string;
  service_name: string;
  department: string;
  service_category: string;
  quantity: number;
  unit_rate: number;
  gross_amount: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  tax_percentage?: number;
  tax_amount?: number;
  net_amount: number;
  service_doctor_id?: string;
  referring_doctor_id?: string;
  ordering_doctor_id?: string;
  source_type: string;
  source_id?: string;
  is_package_item?: boolean;
  package_id?: string;
  covered_by_package?: boolean;
  is_covered_by_insurance?: boolean;
  insurance_approved_amount?: number;
  patient_share?: number;
  co_pay_percentage?: number;
  service_date: string;
  billed_date?: string;
  status: string;
  cancel_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  payout_processed?: boolean;
  payout_cycle_id?: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface Billingnumbersequences {
  id: string;
  centre_id: string;
  sequence_type: string;
  prefix: string;
  financial_year: string;
  last_number: number;
  created_at?: string;
  updated_at?: string;
}

export interface Billingpackageinclusions {
  id: string;
  package_id: string;
  service_master_id?: string;
  service_category?: string;
  quantity_limit?: number;
  amount_limit?: number;
  notes?: string;
  created_at?: string;
}

export interface Billingpackages {
  id: string;
  centre_id: string;
  package_code: string;
  package_name: string;
  package_type: string;
  payor_type: string;
  base_price: number;
  validity_days?: number;
  inclusions: Json;
  exclusions?: Json;
  room_category?: string;
  max_room_days?: number;
  pmjay_package_code?: string;
  cghs_package_code?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Billingpayments {
  id: string;
  encounter_id: string;
  invoice_id?: string;
  centre_id: string;
  patient_id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  payment_reference?: string;
  card_last_four?: string;
  upi_id?: string;
  bank_name?: string;
  claim_id?: string;
  settlement_reference?: string;
  utr_number?: string;
  payment_type: string;
  is_advance?: boolean;
  advance_adjusted_amount?: number;
  advance_balance?: number;
  status: string;
  void_reason?: string;
  voided_by?: string;
  voided_at?: string;
  created_by: string;
  created_at?: string;
}

export interface Billingpreauths {
  id: string;
  encounter_id: string;
  centre_id: string;
  patient_id: string;
  pre_auth_number?: string;
  insurance_company_id: string;
  tpa_id?: string;
  policy_number: string;
  member_id?: string;
  diagnosis_codes: Json;
  procedure_codes?: Json;
  treating_doctor_id?: string;
  clinical_notes?: string;
  requested_amount: number;
  requested_stay_days?: number;
  request_date: string;
  approved_amount?: number;
  approved_stay_days?: number;
  approved_procedures?: Json;
  approval_date?: string;
  approval_reference?: string;
  enhancement_requested?: boolean;
  enhancement_amount?: number;
  enhancement_approved_amount?: number;
  enhancement_date?: string;
  enhancement_reference?: string;
  documents?: Json;
  status: string;
  rejection_reason?: string;
  query_details?: string;
  query_response?: string;
  submitted_at?: string;
  first_response_at?: string;
  tat_hours?: number;
  pmjay_claim_id?: string;
  pmjay_pre_auth_id?: string;
  pmjay_package_code?: string;
  pmjay_package_name?: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface Billingratecards {
  id: string;
  centre_id: string;
  payor_type: string;
  payor_id?: string;
  service_master_id: string;
  rate: number;
  discount_percentage?: number;
  effective_from: string;
  effective_to?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface Billingservicemasters {
  id: string;
  centre_id: string;
  service_code: string;
  service_name: string;
  department: string;
  service_category: string;
  base_rate: number;
  gst_applicable?: boolean;
  gst_percentage?: number;
  hsn_sac_code?: string;
  is_payable_to_doctor?: boolean;
  doctor_payout_type?: string;
  is_active?: boolean;
  effective_from: string;
  effective_to?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Billingtpamasters {
  id: string;
  centre_id: string;
  tpa_name: string;
  tpa_code: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  portal_url?: string;
  settlement_tat_days?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}