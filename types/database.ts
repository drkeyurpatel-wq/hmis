// Health1 HMIS/ERP — TypeScript Types
// Auto-generate full types with: npx supabase gen types typescript --project-id bmuupgrzbfmddjwcqlss > types/supabase.ts

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
