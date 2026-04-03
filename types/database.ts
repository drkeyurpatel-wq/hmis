// Health1 HMIS/ERP — TypeScript Types
// Auto-generate full types with: npx supabase gen types typescript --project-id bmuupgrzbfmddjwcqlss > types/supabase.ts

export type CentreType = 'hospital' | 'clinic';
export type OwnershipType = 'owned' | 'franchise';

export interface Centre {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  beds_paper: number | null;
  beds_operational: number | null;
  entity_type: 'owned' | 'leased' | 'o_and_m' | 'partnership';
  is_active: boolean;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Clinic mode fields
  centre_type: CentreType;
  ownership_type: OwnershipType;
  hub_centre_id: string | null;
  // Franchise fields
  franchise_partner_name: string | null;
  franchise_agreement_date: string | null;
  franchise_revenue_share_pct: number | null;
  franchise_contact_phone: string | null;
  franchise_contact_email: string | null;
  // Clinic operational config
  has_pharmacy: boolean;
  has_lab_collection: boolean;
  has_teleconsult: boolean;
  opd_rooms: number;
  operating_hours: string;
  // Geolocation
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  google_maps_url: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, unknown>;
  is_system: boolean;
}

export interface RolePermission {
  module: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'approve';
  scope: 'own' | 'department' | 'centre' | 'all';
}

export interface Staff {
  id: string;
  auth_user_id: string | null;
  employee_code: string;
  full_name: string;
  designation: string | null;
  staff_type: 'doctor' | 'nurse' | 'technician' | 'admin' | 'support' | 'pharmacist' | 'lab_tech' | 'receptionist' | 'accountant';
  department_id: string | null;
  primary_centre_id: string;
  phone: string | null;
  email: string | null;
  medical_reg_no: string | null;
  specialisation: string | null;
  signature_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface StaffCentre {
  id: string;
  staff_id: string;
  centre_id: string;
  role_id: string;
  centre?: Centre;
  role?: Role & { permissions?: RolePermission[] };
}

export interface Patient {
  id: string;
  uhid: string;
  registration_centre_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  age_years: number | null;
  gender: 'male' | 'female' | 'other';
  blood_group: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  id_type: string | null;
  id_number: string | null;
  marital_status: string | null;
  occupation: string | null;
  nationality: string;
  religion: string | null;
  photo_url: string | null;
  is_vip: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  centre_id: string;
  name: string;
  type: 'clinical' | 'support' | 'admin';
  hod_staff_id: string | null;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  centre_id: string;
  patient_id: string;
  doctor_id: string;
  department_id: string;
  appointment_date: string;
  appointment_time: string | null;
  type: 'new' | 'followup' | 'referral' | 'emergency';
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  source: string | null;
  notes: string | null;
  patient?: Patient;
  doctor?: Staff;
  department?: Department;
}

export interface Admission {
  id: string;
  centre_id: string;
  patient_id: string;
  ipd_number: string;
  admitting_doctor_id: string;
  primary_doctor_id: string;
  department_id: string;
  bed_id: string | null;
  admission_type: 'elective' | 'emergency' | 'transfer' | 'daycare';
  admission_date: string;
  expected_discharge: string | null;
  actual_discharge: string | null;
  discharge_type: string | null;
  payor_type: 'self' | 'insurance' | 'corporate' | 'govt_pmjay' | 'govt_cghs' | 'govt_esi';
  status: 'active' | 'discharge_initiated' | 'discharged' | 'cancelled';
  patient?: Patient;
  primary_doctor?: Staff;
}

export interface Bill {
  id: string;
  centre_id: string;
  patient_id: string;
  bill_number: string;
  bill_type: 'opd' | 'ipd' | 'pharmacy' | 'lab' | 'radiology' | 'package';
  payor_type: string;
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: 'draft' | 'final' | 'partially_paid' | 'paid' | 'cancelled' | 'written_off';
  bill_date: string;
  patient?: Patient;
}

export interface Vitals {
  id: string;
  patient_id: string;
  temperature: number | null;
  pulse: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  resp_rate: number | null;
  spo2: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  pain_scale: number | null;
  gcs: number | null;
  blood_sugar: number | null;
  recorded_at: string;
}

// ---------------------------------------------------------------------------
// Clinic Mode Types
// ---------------------------------------------------------------------------

export type LabCollectionStatus =
  | 'collected' | 'batched' | 'dispatched' | 'in_transit'
  | 'received_at_hub' | 'processing' | 'completed' | 'rejected';

export type TransportMode = 'courier' | 'staff' | 'pickup';

export interface LabCollection {
  id: string;
  centre_id: string;
  hub_centre_id: string;
  patient_id: string;
  collection_number: string;
  barcode: string | null;
  sample_type: string;
  tests_ordered: string[];
  fasting_status: 'fasting' | 'non_fasting' | 'unknown' | null;
  collected_by: string | null;
  collected_at: string | null;
  courier_batch_id: string | null;
  dispatched_at: string | null;
  dispatched_by: string | null;
  transport_mode: TransportMode;
  received_at_hub: string | null;
  received_by: string | null;
  status: LabCollectionStatus;
  rejection_reason: string | null;
  hmis_lab_order_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  patient?: Patient;
  centre?: Centre;
  hub_centre?: Centre;
}

export type ReferralUrgency = 'routine' | 'urgent' | 'emergency';

export type ClinicReferralStatus =
  | 'referred' | 'appointment_created' | 'patient_visited'
  | 'completed' | 'cancelled' | 'no_show';

export interface ClinicReferral {
  id: string;
  from_centre_id: string;
  to_centre_id: string;
  patient_id: string;
  referral_number: string;
  reason: string;
  urgency: ReferralUrgency;
  department: string | null;
  referred_by: string | null;
  clinical_notes: string | null;
  vitals_at_referral: Record<string, unknown> | null;
  appointment_created: boolean;
  hub_appointment_id: string | null;
  accepted_by: string | null;
  status: ClinicReferralStatus;
  created_at: string;
  updated_at: string;
  // Joined
  patient?: Patient;
  from_centre?: Centre;
  to_centre?: Centre;
  referred_by_staff?: Staff;
}

export interface ClinicCapabilities {
  hasPharmacy: boolean;
  hasLabCollection: boolean;
  hasTeleconsult: boolean;
  opdRooms: number;
}

// ---------------------------------------------------------------------------
// Brain (Clinical AI) Types
// ---------------------------------------------------------------------------

export type RiskCategory = 'low' | 'moderate' | 'high' | 'very_high';

export type AntibioticAlertType =
  | 'duration_exceeded' | 'broad_spectrum_no_culture' | 'escalation_no_justification'
  | 'duplicate_class' | 'renal_dose_adjustment' | 'antibiotic_allergy_risk'
  | 'iv_to_oral_opportunity' | 'prophylaxis_exceeded' | 'restricted_antibiotic'
  | 'no_deescalation';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'overridden';

export type InfectionType = 'ssi' | 'clabsi' | 'cauti' | 'vap' | 'cdiff' | 'mrsa' | 'other_hai';
export type DetectionSource = 'lab_culture' | 'clinical_signs' | 'surveillance' | 'readmission';
export type InfectionOutcome = 'resolved' | 'ongoing' | 'readmitted' | 'death';

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface BrainReadmissionRisk {
  id: string;
  centre_id: string;
  admission_id: string;
  patient_id: string;
  age_score: number;
  comorbidity_count: number;
  comorbidity_score: number;
  prior_admissions_12m: number;
  prior_admission_score: number;
  los_score: number;
  emergency_admission_score: number;
  procedure_complexity_score: number;
  abnormal_labs_at_discharge: number;
  abnormal_labs_score: number;
  polypharmacy_score: number;
  social_risk_score: number;
  total_risk_score: number;
  risk_category: RiskCategory;
  was_readmitted: boolean;
  readmission_date: string | null;
  readmission_days: number | null;
  readmission_id: string | null;
  post_discharge_call: boolean;
  home_care_arranged: boolean;
  followup_appointment_set: boolean;
  calculated_at: string;
  patient?: Patient;
  admission?: Admission;
}

export interface BrainAntibioticAlert {
  id: string;
  centre_id: string;
  patient_id: string;
  admission_id: string | null;
  prescription_id: string | null;
  alert_type: AntibioticAlertType;
  drug_name: string;
  drug_class: string | null;
  severity: AlertSeverity;
  description: string;
  recommendation: string;
  prescribing_doctor_id: string | null;
  status: AlertStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  override_reason: string | null;
  created_at: string;
  patient?: Patient;
  prescribing_doctor?: Staff;
}

export interface BrainAntibioticUsage {
  id: string;
  centre_id: string;
  month: string;
  total_admissions: number;
  admissions_with_antibiotics: number;
  antibiotic_usage_rate: number;
  avg_duration_days: number;
  culture_before_antibiotic_rate: number;
  deescalation_rate: number;
  iv_to_oral_conversion_rate: number;
  restricted_antibiotic_count: number;
  ddd_per_100_bed_days: number;
  top_antibiotics: Array<{ name: string; count: number }>;
  created_at: string;
}

export interface BrainInfectionEvent {
  id: string;
  centre_id: string;
  patient_id: string;
  admission_id: string | null;
  infection_type: InfectionType;
  detection_date: string;
  detection_source: DetectionSource | null;
  ward_id: string | null;
  ot_room_id: string | null;
  surgeon_id: string | null;
  procedure_name: string | null;
  procedure_date: string | null;
  days_post_procedure: number | null;
  organism: string | null;
  antibiotic_sensitivity: Record<string, string> | null;
  treatment: string | null;
  outcome: InfectionOutcome | null;
  additional_los_days: number;
  additional_cost: number;
  investigated: boolean;
  root_cause: string | null;
  preventable: boolean | null;
  corrective_action: string | null;
  reported_by: string | null;
  created_at: string;
  patient?: Patient;
}

export interface BrainInfectionRates {
  id: string;
  centre_id: string;
  month: string;
  total_surgeries: number;
  ssi_count: number;
  ssi_rate: number;
  total_central_line_days: number;
  clabsi_count: number;
  clabsi_rate: number;
  total_catheter_days: number;
  cauti_count: number;
  cauti_rate: number;
  total_ventilator_days: number;
  vap_count: number;
  vap_rate: number;
  hand_hygiene_compliance_pct: number | null;
  created_at: string;
}

export interface BrainLosPrediction {
  id: string;
  centre_id: string;
  admission_id: string;
  predicted_los_days: number;
  prediction_confidence: number | null;
  prediction_model: string;
  diagnosis_code: string | null;
  procedure_type: string | null;
  age_group: string | null;
  comorbidity_count: number | null;
  admission_type: string | null;
  payor_type: string | null;
  actual_los_days: number | null;
  is_outlier: boolean;
  outlier_reason: string | null;
  alert_generated: boolean;
  alert_generated_on_day: number | null;
  calculated_at: string;
  admission?: Admission;
  patient?: Patient;
}

export interface BrainLosBenchmark {
  id: string;
  centre_id: string | null;
  category: string;
  code: string;
  description: string | null;
  avg_los: number;
  median_los: number | null;
  p25_los: number | null;
  p75_los: number | null;
  stddev_los: number | null;
  sample_size: number;
  last_updated: string;
}

export interface BrainQualityIndicators {
  id: string;
  centre_id: string;
  month: string;
  fall_rate: number;
  medication_error_rate: number;
  wrong_site_surgery_count: number;
  blood_transfusion_reaction_count: number;
  pressure_ulcer_rate: number;
  mortality_rate: number;
  icu_mortality_rate: number;
  unplanned_icu_transfer_rate: number;
  readmission_30_day_rate: number;
  return_to_ot_rate: number;
  ssi_rate: number;
  antibiotic_prophylaxis_compliance: number;
  surgical_safety_checklist_compliance: number;
  consent_compliance: number;
  ed_wait_time_avg_min: number;
  ed_left_without_treatment_rate: number;
  nurse_patient_ratio: number;
  nursing_documentation_compliance: number;
  patient_satisfaction_score: number;
  complaint_rate: number;
  grievance_resolution_within_48h_pct: number;
  overall_quality_score: number;
  overall_grade: QualityGrade | null;
  created_at: string;
}
