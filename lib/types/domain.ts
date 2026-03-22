// lib/types/domain.ts
// Shared domain types used across modules.
// Replace `any` with these types in hooks, components, and API routes.

// ============================================================
// PATIENT
// ============================================================
export interface Patient {
  id: string;
  uhid: string;
  first_name: string;
  last_name: string;
  age_years?: number;
  gender: 'male' | 'female' | 'other';
  phone_primary?: string;
  phone_secondary?: string;
  email?: string;
  blood_group?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// STAFF
// ============================================================
export interface Staff {
  id: string;
  full_name: string;
  role: string;
  department_id?: string;
  specialization?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
}

// ============================================================
// ADMISSION (IPD)
// ============================================================
export interface Admission {
  id: string;
  patient_id: string;
  ipd_number: string;
  centre_id: string;
  bed_id?: string;
  admitting_doctor_id?: string;
  admission_date: string;
  actual_discharge?: string;
  status: 'active' | 'discharged' | 'cancelled' | 'transferred';
  diagnosis?: string;
}

// ============================================================
// BILLING
// ============================================================
export interface Bill {
  id: string;
  bill_number: string;
  bill_type: 'opd' | 'ipd' | 'pharmacy' | 'lab' | 'radiology';
  bill_date: string;
  centre_id: string;
  patient_id: string;
  admission_id?: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: 'draft' | 'final' | 'paid' | 'partially_paid' | 'cancelled';
  payor_type?: string;
  insurer_name?: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  description: string;
  quantity: number;
  unit_rate: number;
  amount: number;
  net_amount: number;
  service_category?: string;
  billing_category?: string;
  department_id?: string;
  package_id?: string;
  consulting_doctor_id?: string;
  service_doctor_id?: string;
}

// ============================================================
// LAB
// ============================================================
export interface LabOrder {
  id: string;
  patient_id: string;
  visit_id?: string;
  admission_id?: string;
  centre_id: string;
  test_name: string;
  test_code?: string;
  status: 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled';
  priority: 'routine' | 'urgent' | 'stat';
  ordered_by: string;
  ordered_at: string;
  results?: Record<string, unknown>;
}

// ============================================================
// NOTIFICATION
// ============================================================
export interface NotificationPreference {
  id: string;
  centre_id: string;
  event_type: string;
  channel: 'whatsapp' | 'sms' | 'email';
  is_enabled: boolean;
}

// ============================================================
// CENTRE
// ============================================================
export interface Centre {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  is_active: boolean;
}

// ============================================================
// BED
// ============================================================
export interface Bed {
  id: string;
  bed_number: string;
  ward_id?: string;
  centre_id: string;
  status: 'available' | 'occupied' | 'blocked' | 'maintenance';
  patient_id?: string;
  admission_id?: string;
}

// ============================================================
// DEPARTMENT
// ============================================================
export interface Department {
  id: string;
  name: string;
  code?: string;
  is_active: boolean;
}
