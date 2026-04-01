// lib/referrals/types.ts
// Type definitions for the Referral Tracker module.

export interface ReferralSourceType {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
}

export interface ReferralSource {
  id: string;
  centre_id: string;
  type_id: string;
  type_code?: string;
  type_label?: string;
  name: string;
  speciality: string | null;
  clinic_name: string | null;
  hospital_name: string | null;
  company: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  total_patients: number;
  total_revenue: number;
  first_referral_date: string | null;
  last_referral_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientReferral {
  id: string;
  centre_id: string;
  patient_id: string;
  visit_id: string | null;
  source_id: string;
  visit_type: 'opd' | 'ipd' | 'emergency' | 'daycare';
  bill_amount: number;
  collection_amount: number;
  notes: string | null;
  referred_by_staff_id: string | null;
  created_at: string;
  // Joined fields
  source_name?: string;
  source_type_code?: string;
  patient_name?: string;
  patient_uhid?: string;
  department_name?: string;
  doctor_name?: string;
}

export interface ReferralDashboardData {
  source_id: string;
  source_name: string;
  type_code: string;
  type_label: string;
  speciality: string | null;
  patient_count: number;
  opd_count: number;
  ipd_count: number;
  conversion_pct: number;
  total_revenue: number;
  last_referral_date: string | null;
  is_dormant: boolean;
  is_new: boolean;
}

export interface ReferralTrendPoint {
  month: string;
  doctor: number;
  hospital: number;
  insurance_agent: number;
  campaign: number;
  walkin_source: number;
  total: number;
}

export interface DashboardSummary {
  totalReferrals: number;
  topSourceType: string;
  topSourceCount: number;
  ipdConversionRate: number;
  totalRevenue: number;
  periodChange: number;
}

export type NewReferralSourceInput = {
  type_id: string;
  name: string;
  speciality?: string;
  clinic_name?: string;
  hospital_name?: string;
  company?: string;
  city?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type NewPatientReferralInput = {
  patient_id: string;
  visit_id?: string;
  source_id: string;
  visit_type?: 'opd' | 'ipd' | 'emergency' | 'daycare';
  notes?: string;
  referred_by_staff_id?: string;
};

// ── Fee Agreement Types ──

export type FeeType = 'percentage' | 'flat' | 'slab' | 'none';

export interface FeeAgreement {
  source_id: string;
  fee_type: FeeType;
  fee_pct: number;        // For percentage-based (e.g., 10 = 10%)
  flat_amount: number;    // For flat fee (in ₹)
  tds_applicable: boolean;
  tds_pct: number;        // TDS percentage (e.g., 10 = 10%)
  slabs: FeeSlab[];       // For slab-based
}

export interface FeeSlab {
  id?: string;
  min_revenue: number;
  max_revenue: number;
  fee_pct: number;
  flat_amount: number;
}

export interface FeeCalculationResult {
  base_amount: number;
  fee_type: FeeType;
  fee_pct_applied: number;
  gross_fee: number;
  tds_applicable: boolean;
  tds_pct: number;
  tds_amount: number;
  net_payable: number;
  slab_matched?: FeeSlab;
}

export interface PayoutRow {
  source_id: string;
  source_name: string;
  type_code: string;
  type_label: string;
  patient_count: number;
  total_billed: number;
  fee_type: FeeType;
  gross_fee: number;
  tds_amount: number;
  net_payable: number;
  paid_amount: number;
  pending_amount: number;
  referrals: PatientReferralWithFee[];
}

export interface PatientReferralWithFee extends PatientReferral {
  fee_type: FeeType;
  fee_pct: number;
  gross_fee: number;
  tds_amount: number;
  net_payable: number;
  fee_paid: boolean;
  payment_date: string | null;
  payment_mode: string | null;
  payment_ref: string | null;
}
