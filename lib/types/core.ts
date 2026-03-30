// lib/types/core.ts
// Core entity types — single source of truth for the most-used database shapes.
// Import these instead of using `any` for function signatures and hook returns.

export interface Patient {
  id: string;
  centre_id: string;
  uhid: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender: 'male' | 'female' | 'other';
  phone_primary: string;
  phone_secondary?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  blood_group?: string;
  id_type?: string;
  id_number?: string;
  category?: string;
  abha_number?: string;
  abha_address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Staff {
  id: string;
  centre_id?: string;
  auth_user_id?: string;
  employee_code: string;
  full_name: string;
  email?: string;
  phone?: string;
  staff_type: 'doctor' | 'nurse' | 'receptionist' | 'pharmacist' | 'lab_tech' | 'admin' | 'accountant' | 'other';
  designation?: string;
  department_id?: string;
  specialisation?: string;
  medical_reg_no?: string;
  role_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface Admission {
  id: string;
  centre_id: string;
  patient_id: string;
  admission_number?: string;
  admission_date: string;
  discharge_date?: string;
  ward_id?: string;
  bed_id?: string;
  admitting_doctor_id?: string;
  primary_diagnosis?: string;
  status: 'active' | 'discharged' | 'transferred' | 'lama' | 'absconded' | 'expired';
  admission_type?: string;
  created_at: string;
}

export interface Bill {
  id: string;
  centre_id: string;
  patient_id: string;
  admission_id?: string;
  bill_number: string;
  bill_date: string;
  bill_type: 'opd' | 'ipd' | 'emergency' | 'pharmacy' | 'lab';
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: 'draft' | 'final' | 'cancelled' | 'refunded';
  billing_category?: string;
  payor_type?: string;
  insurer_id?: string;
  created_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  service_id?: string;
  service_name: string;
  department?: string;
  quantity: number;
  rate: number;
  amount: number;
  discount: number;
  net_amount: number;
  consulting_doctor_id?: string;
  service_doctor_id?: string;
  billing_category?: string;
}

export interface LabOrder {
  id: string;
  centre_id: string;
  patient_id: string;
  admission_id?: string;
  ordered_by: string;
  order_date: string;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled';
  clinical_notes?: string;
  created_at: string;
}

export interface LabResult {
  id: string;
  lab_order_id: string;
  test_id: string;
  test_name: string;
  result_value?: string;
  unit?: string;
  reference_range?: string;
  is_abnormal: boolean;
  is_critical: boolean;
  reported_by?: string;
  verified_by?: string;
  status: 'pending' | 'reported' | 'verified';
  created_at: string;
}

export interface Prescription {
  id: string;
  centre_id?: string;
  patient_id: string;
  encounter_id?: string;
  drug_name: string;
  generic_name?: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions?: string;
  prescribed_by: string;
  status: 'active' | 'completed' | 'discontinued' | 'cancelled';
  created_at: string;
}

export interface Appointment {
  id: string;
  centre_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  time_slot?: string;
  token_number?: number;
  visit_type: 'new' | 'follow_up' | 'review' | 'procedure';
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  chief_complaint?: string;
  notes?: string;
  created_at: string;
}

export interface Department {
  id: string;
  centre_id: string;
  name: string;
  type?: string;
  hod_staff_id?: string;
  is_active: boolean;
}

export interface Ward {
  id: string;
  centre_id: string;
  name: string;
  type?: string;
  floor?: string;
  department_id?: string;
  is_active: boolean;
}

export interface Bed {
  id: string;
  centre_id?: string;
  room_id?: string;
  bed_number: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved' | 'blocked';
  current_admission_id?: string;
}

export interface Centre {
  id: string;
  code: string;
  name: string;
  city?: string;
  state?: string;
  is_active: boolean;
}

/** Utility: make all properties optional except id */
export type PartialEntity<T extends { id: string }> = Partial<T> & { id: string };

/** Utility: Supabase query result row (when type is unknown) */
export type DbRow = Record<string, unknown>;
