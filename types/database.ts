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
