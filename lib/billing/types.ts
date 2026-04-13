// lib/billing/types.ts
// TypeScript types for the Billing Revolution module

// ═══════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════

export const ENCOUNTER_TYPES = ['OPD', 'IPD', 'ER', 'DAYCARE'] as const;
export type EncounterType = (typeof ENCOUNTER_TYPES)[number];

export const PAYOR_TYPES = ['SELF_PAY', 'PMJAY', 'CGHS', 'TPA', 'CORPORATE', 'STAFF'] as const;
export type PayorType = (typeof PAYOR_TYPES)[number];

export const ENCOUNTER_STATUSES = ['OPEN', 'INTERIM_BILLED', 'FINAL_BILLED', 'DISCHARGED', 'SETTLED', 'CANCELLED'] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const LINE_ITEM_STATUSES = ['ACTIVE', 'CANCELLED', 'REVERSED', 'ADJUSTED'] as const;
export type LineItemStatus = (typeof LINE_ITEM_STATUSES)[number];

export const INVOICE_STATUSES = ['DRAFT', 'GENERATED', 'SENT', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'CREDIT_NOTE_ISSUED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_MODES = ['CASH', 'CARD', 'UPI', 'NEFT', 'CHEQUE', 'INSURANCE_SETTLEMENT', 'WRITE_OFF'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_TYPES = ['COLLECTION', 'ADVANCE', 'DEPOSIT', 'REFUND', 'ADJUSTMENT', 'WRITE_OFF'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const SERVICE_CATEGORIES = [
  'Consultation', 'Investigation', 'Procedure', 'Room', 'Nursing',
  'Consumable', 'Package', 'Pharmacy', 'Radiology', 'Other',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const DEPARTMENTS = [
  'OPD', 'IPD', 'LAB', 'RAD', 'PHARMACY', 'OT', 'ICU', 'ER', 'GENERAL',
] as const;

export const SOURCE_TYPES = [
  'MANUAL', 'ORDER', 'PHARMACY', 'LAB', 'RADIOLOGY',
  'BED_CHARGE', 'NURSING', 'OT', 'CONSUMABLE', 'PACKAGE',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const PRE_AUTH_STATUSES = [
  'DRAFT', 'SUBMITTED', 'QUERY', 'APPROVED', 'PARTIALLY_APPROVED',
  'REJECTED', 'ENHANCEMENT_PENDING', 'ENHANCED', 'CANCELLED', 'EXPIRED',
] as const;
export type PreAuthStatus = (typeof PRE_AUTH_STATUSES)[number];

export const CLAIM_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_PROCESS', 'QUERY_RAISED', 'QUERY_RESPONDED',
  'APPROVED', 'PARTIALLY_APPROVED', 'SETTLED', 'REJECTED', 'APPEAL', 'WRITTEN_OFF',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const AGING_BUCKETS = ['0-30', '31-60', '61-90', '91-120', '120+'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

// ═══════════════════════════════════════════════════════════
// SERVICE MASTER & RATE CARDS
// ═══════════════════════════════════════════════════════════

export interface ServiceMaster {
  id: string;
  centre_id: string;
  service_code: string;
  service_name: string;
  department: string;
  service_category: string;
  base_rate: number;
  gst_applicable: boolean;
  gst_percentage: number;
  hsn_sac_code: string | null;
  is_payable_to_doctor: boolean;
  doctor_payout_type: string | null;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface RateCard {
  id: string;
  centre_id: string;
  payor_type: PayorType;
  payor_id: string | null;
  service_master_id: string;
  rate: number;
  discount_percentage: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  service_master?: ServiceMaster;
}

// ═══════════════════════════════════════════════════════════
// PACKAGES
// ═══════════════════════════════════════════════════════════

export interface BillingPackage {
  id: string;
  centre_id: string;
  package_code: string;
  package_name: string;
  package_type: string;
  payor_type: PayorType;
  base_price: number;
  validity_days: number;
  inclusions: string[];
  exclusions: string[];
  room_category: string | null;
  max_room_days: number | null;
  pmjay_package_code: string | null;
  cghs_package_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════
// ENCOUNTERS
// ═══════════════════════════════════════════════════════════

export interface BillingEncounter {
  id: string;
  centre_id: string;
  patient_id: string;
  encounter_type: EncounterType;
  encounter_number: string;

  // IPD
  admission_id: string | null;
  bed_id: string | null;
  admitting_doctor_id: string | null;
  admission_date: string | null;
  expected_discharge_date: string | null;
  actual_discharge_date: string | null;

  // OPD
  appointment_id: string | null;
  consulting_doctor_id: string | null;
  visit_date: string | null;

  // Payor
  primary_payor_type: PayorType;
  primary_payor_id: string | null;
  insurance_policy_number: string | null;
  insurance_card_number: string | null;
  tpa_id: string | null;
  pre_auth_id: string | null;
  package_id: string | null;

  // Financial summary
  total_charges: number;
  total_discounts: number;
  total_tax: number;
  net_amount: number;
  total_paid: number;
  total_refunded: number;
  balance_due: number;

  // Insurance
  insurance_approved_amount: number;
  insurance_settled_amount: number;
  patient_responsibility: number;

  // Status
  status: EncounterStatus;
  billing_locked: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined
  patient?: { id: string; first_name: string; last_name: string; uhid: string; phone_primary?: string; age_years?: number; gender?: string };
  consulting_doctor?: { full_name: string };
  admitting_doctor?: { full_name: string };
}

// ═══════════════════════════════════════════════════════════
// LINE ITEMS
// ═══════════════════════════════════════════════════════════

export interface BillingLineItem {
  id: string;
  encounter_id: string;
  centre_id: string;

  service_master_id: string | null;
  service_code: string;
  service_name: string;
  department: string;
  service_category: string;

  quantity: number;
  unit_rate: number;
  gross_amount: number;
  discount_type: string | null;
  discount_value: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;

  service_doctor_id: string | null;
  referring_doctor_id: string | null;
  ordering_doctor_id: string | null;

  source_type: SourceType;
  source_id: string | null;

  is_package_item: boolean;
  package_id: string | null;
  covered_by_package: boolean;

  is_covered_by_insurance: boolean;
  insurance_approved_amount: number | null;
  patient_share: number | null;
  co_pay_percentage: number | null;

  service_date: string;
  billed_date: string;

  status: LineItemStatus;
  cancel_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;

  created_by: string;
  created_at: string;
  updated_at: string;

  payout_processed: boolean;
  payout_cycle_id: string | null;

  // Joined
  service_doctor?: { full_name: string };
}

// ═══════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════

export interface BillingInvoice {
  id: string;
  encounter_id: string;
  centre_id: string;
  patient_id: string;

  invoice_number: string;
  invoice_type: string;
  invoice_date: string;

  subtotal: number;
  total_discount: number;
  total_tax: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;

  insurance_share: number;
  patient_share: number;
  corporate_share: number;

  discount_authorized_by: string | null;
  discount_reason: string | null;

  pdf_url: string | null;
  pdf_generated_at: string | null;

  status: InvoiceStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════

export interface BillingPayment {
  id: string;
  encounter_id: string;
  invoice_id: string | null;
  centre_id: string;
  patient_id: string;

  receipt_number: string;
  payment_date: string;
  amount: number;

  payment_mode: PaymentMode;
  payment_reference: string | null;
  card_last_four: string | null;
  upi_id: string | null;
  bank_name: string | null;

  claim_id: string | null;
  settlement_reference: string | null;
  utr_number: string | null;

  payment_type: PaymentType;

  is_advance: boolean;
  advance_adjusted_amount: number;
  advance_balance: number;

  status: string;
  void_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;

  created_by: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════
// INSURANCE
// ═══════════════════════════════════════════════════════════

export interface TpaMaster {
  id: string;
  tpa_name: string;
  tpa_code: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  settlement_tat_days: number;
  is_active: boolean;
  created_at: string;
}

export interface InsuranceCompany {
  id: string;
  company_name: string;
  company_code: string;
  company_type: string;
  tpa_id: string | null;
  contact_info: Record<string, unknown>;
  empanelment_number: string | null;
  empanelment_valid_till: string | null;
  rohini_code: string | null;
  is_cashless: boolean;
  is_active: boolean;
  created_at: string;
  tpa?: TpaMaster;
}

export interface InsurancePreAuth {
  id: string;
  encounter_id: string;
  centre_id: string;
  patient_id: string;

  pre_auth_number: string | null;
  insurance_company_id: string | null;
  tpa_id: string | null;
  policy_number: string;
  member_id: string | null;

  diagnosis_codes: string[];
  procedure_codes: string[] | null;
  treating_doctor_id: string | null;

  requested_amount: number;
  requested_stay_days: number | null;
  request_date: string;

  approved_amount: number | null;
  approved_stay_days: number | null;
  approval_date: string | null;
  approval_reference: string | null;

  enhancement_requested: boolean;
  enhancement_amount: number | null;
  enhancement_approved_amount: number | null;

  documents: Array<{ type: string; url: string; uploaded_at: string }>;

  status: PreAuthStatus;
  rejection_reason: string | null;
  query_details: string | null;
  query_response: string | null;

  submitted_at: string | null;
  first_response_at: string | null;
  tat_hours: number | null;

  pmjay_claim_id: string | null;
  pmjay_package_code: string | null;
  pmjay_package_name: string | null;

  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined
  encounter?: BillingEncounter;
  insurance_company?: InsuranceCompany;
  tpa?: TpaMaster;
}

export interface InsuranceClaim {
  id: string;
  encounter_id: string;
  pre_auth_id: string | null;
  centre_id: string;
  patient_id: string;

  claim_number: string;
  insurance_company_id: string | null;
  tpa_id: string | null;

  claimed_amount: number;
  approved_amount: number | null;
  settled_amount: number | null;
  deduction_amount: number | null;
  tds_amount: number | null;
  net_received: number | null;
  patient_liability: number | null;

  deduction_details: Array<{ reason: string; amount: number }>;

  claim_submission_date: string | null;
  settlement_date: string | null;

  settlement_utr: string | null;
  tpa_claim_number: string | null;

  documents: Array<{ type: string; url: string }>;

  status: ClaimStatus;
  query_details: Array<{ date: string; query: string; response?: string; response_date?: string }>;

  aging_bucket: AgingBucket;

  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined
  encounter?: BillingEncounter;
  pre_auth?: InsurancePreAuth;
}

// ═══════════════════════════════════════════════════════════
// BED CHARGE RULES
// ═══════════════════════════════════════════════════════════

export interface BedChargeRule {
  id: string;
  centre_id: string;
  room_category: string;
  ward_type: string;
  charge_per_day: number;
  nursing_charge_per_day: number;
  service_charge_per_day: number;
  checkout_time: string;
  half_day_hours: number;
  payor_type: string;
  is_active: boolean;
  effective_from: string;
}

// ═══════════════════════════════════════════════════════════
// DISCOUNT SCHEMES
// ═══════════════════════════════════════════════════════════

export interface DiscountScheme {
  id: string;
  centre_id: string;
  scheme_name: string;
  scheme_code: string;
  discount_type: string;
  discount_value: number | null;
  category_rules: Record<string, number> | null;
  max_discount_amount: number | null;
  requires_approval: boolean;
  approval_authority: string | null;
  auto_apply: boolean;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
}

// ═══════════════════════════════════════════════════════════
// BILLING AUDIT LOG
// ═══════════════════════════════════════════════════════════

export interface BillingAuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  performed_by: string;
  performed_at: string;
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD / STATS
// ═══════════════════════════════════════════════════════════

export interface BillingDashboardStats {
  todayCollection: number;
  pendingBills: number;
  insurancePending: number;
  advanceBalance: number;
  todayBillCount: number;
  opdCollection: number;
  ipdCollection: number;
  pharmacyCollection: number;
}

export interface AgingReport {
  bucket: AgingBucket;
  count: number;
  amount: number;
  percentage: number;
}

export interface PayorMixReport {
  payor_type: PayorType;
  count: number;
  amount: number;
  percentage: number;
}
