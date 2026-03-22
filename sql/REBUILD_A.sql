DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'hmis_%' ORDER BY tablename) LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

-- ============================================================
-- Health1 HMIS/ERP — Complete Schema Migration
-- Target: NEW Supabase PostgreSQL project (separate from VPMS)
-- Project ID: [YOUR NEW PROJECT ID]
-- Generated: March 2026
-- Tables: 77 | Columns: 705 | Modules: 22
-- ============================================================
-- IMPORTANT: Run this in Supabase SQL Editor in ONE go.
-- All tables use: UUID PK, created_at/updated_at, soft-delete via is_active
-- Multi-tenancy via centre_id on every operational table
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- ============================================================
-- MODULE: CORE (8 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_centres (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(10) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    city varchar(50) NOT NULL,
    state varchar(30) DEFAULT 'Gujarat',
    beds_paper int,
    beds_operational int,
    entity_type varchar(20) NOT NULL CHECK (entity_type IN ('owned','leased','o_and_m','partnership')),
    is_active boolean NOT NULL DEFAULT true,
    config_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(50) NOT NULL UNIQUE,
    description text,
    permissions jsonb NOT NULL DEFAULT '{}',
    is_system boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(100) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('clinical','support','admin')),
    hod_staff_id uuid, -- FK added after staff table
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

CREATE TABLE IF NOT EXISTS hmis_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid REFERENCES hmis_centres(id), -- NULL = global
    key varchar(100) NOT NULL,
    value jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, key)
);

CREATE TABLE IF NOT EXISTS hmis_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    type varchar(30) NOT NULL,
    prefix varchar(10) NOT NULL,
    current_value bigint NOT NULL DEFAULT 0,
    fiscal_year varchar(10),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, type, fiscal_year)
);

-- ============================================================
-- MODULE: USER & AUTH (4 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid UNIQUE, -- Links to Supabase auth.users
    employee_code varchar(20) NOT NULL UNIQUE,
    full_name varchar(100) NOT NULL,
    designation varchar(50),
    staff_type varchar(20) NOT NULL CHECK (staff_type IN ('doctor','nurse','technician','admin','support','pharmacist','lab_tech','receptionist','accountant')),
    department_id uuid REFERENCES hmis_departments(id),
    primary_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    phone varchar(15),
    email varchar(100),
    medical_reg_no varchar(30),
    specialisation varchar(100),
    signature_url text,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Now add the deferred FK on departments
ALTER TABLE hmis_departments ADD CONSTRAINT fk_dept_hod
    FOREIGN KEY (hod_staff_id) REFERENCES hmis_staff(id);

CREATE TABLE IF NOT EXISTS hmis_staff_centres (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    role_id uuid NOT NULL REFERENCES hmis_roles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(staff_id, centre_id)
);

CREATE TABLE IF NOT EXISTS hmis_staff_departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES hmis_staff(id),
    department_id uuid NOT NULL REFERENCES hmis_departments(id),
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(staff_id, department_id)
);

CREATE TABLE IF NOT EXISTS hmis_role_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id uuid NOT NULL REFERENCES hmis_roles(id),
    module varchar(50) NOT NULL,
    action varchar(20) NOT NULL CHECK (action IN ('create','read','update','delete','approve')),
    scope varchar(20) NOT NULL DEFAULT 'own' CHECK (scope IN ('own','department','centre','all')),
    UNIQUE(role_id, module, action)
);

-- Audit log (references staff and centres)
CREATE TABLE IF NOT EXISTS hmis_audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name varchar(50) NOT NULL,
    record_id uuid NOT NULL,
    action varchar(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    old_data jsonb,
    new_data jsonb,
    staff_id uuid REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: PATIENT MANAGEMENT (7 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    uhid varchar(20) NOT NULL UNIQUE,
    registration_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    first_name varchar(50) NOT NULL,
    middle_name varchar(50),
    last_name varchar(50) NOT NULL,
    date_of_birth date,
    age_years int,
    gender varchar(10) NOT NULL CHECK (gender IN ('male','female','other')),
    blood_group varchar(5),
    phone_primary varchar(15) NOT NULL,
    phone_secondary varchar(15),
    email varchar(100),
    address_line1 text,
    address_line2 text,
    city varchar(50),
    state varchar(30),
    pincode varchar(10),
    id_type varchar(20),
    id_number varchar(30), -- Consider pgcrypto encryption for production
    marital_status varchar(15),
    occupation varchar(50),
    nationality varchar(30) DEFAULT 'Indian',
    religion varchar(30),
    photo_url text,
    is_vip boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_uhid ON hmis_patients(uhid);
CREATE INDEX idx_patients_phone ON hmis_patients(phone_primary);
CREATE INDEX idx_patients_name ON hmis_patients USING gin (
    (first_name || ' ' || last_name) gin_trgm_ops
);

CREATE TABLE IF NOT EXISTS hmis_patient_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    relationship varchar(30) NOT NULL,
    phone varchar(15) NOT NULL,
    is_emergency boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_patient_allergies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    allergen varchar(100) NOT NULL,
    severity varchar(10) NOT NULL CHECK (severity IN ('mild','moderate','severe')),
    reaction text,
    recorded_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Insurance master tables (needed before patient_insurance)
CREATE TABLE IF NOT EXISTS hmis_insurers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    code varchar(20) UNIQUE,
    contact_email varchar(100),
    contact_phone varchar(15),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_tpas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    code varchar(20) UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_patient_insurance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    insurer_id uuid NOT NULL REFERENCES hmis_insurers(id),
    tpa_id uuid REFERENCES hmis_tpas(id),
    policy_number varchar(50) NOT NULL,
    policy_type varchar(30),
    sum_insured decimal(12,2),
    valid_from date,
    valid_to date,
    is_primary boolean NOT NULL DEFAULT true,
    scheme varchar(30), -- pmjay | cghs | esi | private | none
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_patient_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    doc_type varchar(30) NOT NULL,
    file_url text NOT NULL,
    file_name varchar(200) NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_patient_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    history_type varchar(20) NOT NULL CHECK (history_type IN ('medical','surgical','family','social')),
    description text NOT NULL,
    icd_code varchar(10),
    recorded_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: BED MANAGEMENT (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_wards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(50) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('general','semi_private','private','icu','nicu','picu','isolation','transplant_icu')),
    floor varchar(10),
    department_id uuid REFERENCES hmis_departments(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

CREATE TABLE IF NOT EXISTS hmis_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id uuid NOT NULL REFERENCES hmis_wards(id),
    room_number varchar(10) NOT NULL,
    room_type varchar(20) NOT NULL,
    daily_rate decimal(10,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(ward_id, room_number)
);

CREATE TABLE IF NOT EXISTS hmis_beds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES hmis_rooms(id),
    bed_number varchar(10) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','maintenance','housekeeping')),
    current_admission_id uuid, -- FK added after admissions table
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(room_id, bed_number)
);

-- ============================================================
-- MODULE: DOCTOR SCHEDULING (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_doctor_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    department_id uuid NOT NULL REFERENCES hmis_departments(id),
    day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    slot_duration_min int NOT NULL DEFAULT 15,
    max_patients int,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_appointment_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id uuid NOT NULL REFERENCES hmis_doctor_schedules(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    slot_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status varchar(15) NOT NULL DEFAULT 'available' CHECK (status IN ('available','booked','blocked')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_doctor_leaves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    leave_date date NOT NULL,
    reason text,
    approved_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(doctor_id, leave_date)
);

-- ============================================================
-- MODULE: OPD (5 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    department_id uuid NOT NULL REFERENCES hmis_departments(id),
    slot_id uuid REFERENCES hmis_appointment_slots(id),
    appointment_date date NOT NULL,
    appointment_time time,
    type varchar(20) NOT NULL CHECK (type IN ('new','followup','referral','emergency')),
    status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','checked_in','in_progress','completed','no_show','cancelled')),
    source varchar(20),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_date ON hmis_appointments(centre_id, appointment_date);
CREATE INDEX idx_appointments_doctor ON hmis_appointments(doctor_id, appointment_date);

CREATE TABLE IF NOT EXISTS hmis_opd_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id uuid REFERENCES hmis_appointments(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    visit_number varchar(20) NOT NULL UNIQUE,
    token_number int,
    chief_complaint text,
    vitals_id uuid, -- FK added after vitals table
    status varchar(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','with_doctor','completed','referred')),
    check_in_time timestamptz,
    consultation_start timestamptz,
    consultation_end timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_opd_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    department_id uuid NOT NULL REFERENCES hmis_departments(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    opd_visit_id uuid NOT NULL REFERENCES hmis_opd_visits(id),
    position int NOT NULL,
    priority varchar(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent','vip')),
    status varchar(20) NOT NULL DEFAULT 'waiting',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: IPD (5 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_admissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    ipd_number varchar(20) NOT NULL UNIQUE,
    admitting_doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    primary_doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    department_id uuid NOT NULL REFERENCES hmis_departments(id),
    bed_id uuid REFERENCES hmis_beds(id),
    admission_type varchar(20) NOT NULL CHECK (admission_type IN ('elective','emergency','transfer','daycare')),
    admission_date timestamptz NOT NULL,
    expected_discharge date,
    actual_discharge timestamptz,
    discharge_type varchar(20) CHECK (discharge_type IN ('normal','lama','dor','absconded','death','transfer')),
    payor_type varchar(20) NOT NULL CHECK (payor_type IN ('self','insurance','corporate','govt_pmjay','govt_cghs','govt_esi')),
    patient_insurance_id uuid REFERENCES hmis_patient_insurance(id),
    provisional_diagnosis text,
    final_diagnosis text,
    icd_codes jsonb,
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharge_initiated','discharged','cancelled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admissions_active ON hmis_admissions(centre_id, status) WHERE status = 'active';

-- Now add deferred FK on beds
ALTER TABLE hmis_beds ADD CONSTRAINT fk_bed_admission
    FOREIGN KEY (current_admission_id) REFERENCES hmis_admissions(id);

CREATE TABLE IF NOT EXISTS hmis_bed_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    from_bed_id uuid REFERENCES hmis_beds(id),
    to_bed_id uuid NOT NULL REFERENCES hmis_beds(id),
    reason text,
    transferred_by uuid NOT NULL REFERENCES hmis_staff(id),
    transferred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_treatment_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    plan_text text NOT NULL,
    plan_type varchar(20) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_nursing_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    nurse_id uuid NOT NULL REFERENCES hmis_staff(id),
    shift varchar(10) NOT NULL CHECK (shift IN ('morning','evening','night')),
    note text NOT NULL,
    vitals_id uuid, -- FK added after vitals table
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_diet_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    ordered_by uuid NOT NULL REFERENCES hmis_staff(id),
    diet_type varchar(30) NOT NULL,
    instructions text,
    effective_from timestamptz NOT NULL,
    effective_to timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Referrals (can be from OPD or IPD)
CREATE TABLE IF NOT EXISTS hmis_referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opd_visit_id uuid REFERENCES hmis_opd_visits(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    from_doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    to_doctor_id uuid REFERENCES hmis_staff(id),
    to_department_id uuid NOT NULL REFERENCES hmis_departments(id),
    reason text,
    urgency varchar(10) NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine','urgent','emergency')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: EMR / CLINICAL (7 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_clinical_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    department_id uuid REFERENCES hmis_departments(id),
    template_type varchar(20) NOT NULL,
    template_json jsonb NOT NULL,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_vitals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10),
    encounter_id uuid,
    temperature decimal(4,1),
    pulse int,
    bp_systolic int,
    bp_diastolic int,
    resp_rate int,
    spo2 decimal(4,1),
    weight_kg decimal(5,1),
    height_cm decimal(5,1),
    bmi decimal(4,1),
    pain_scale int CHECK (pain_scale BETWEEN 0 AND 10),
    gcs int CHECK (gcs BETWEEN 3 AND 15),
    blood_sugar decimal(5,1),
    recorded_by uuid NOT NULL REFERENCES hmis_staff(id),
    recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Add deferred FKs
ALTER TABLE hmis_opd_visits ADD CONSTRAINT fk_opd_vitals
    FOREIGN KEY (vitals_id) REFERENCES hmis_vitals(id);
ALTER TABLE hmis_nursing_notes ADD CONSTRAINT fk_nursing_vitals
    FOREIGN KEY (vitals_id) REFERENCES hmis_vitals(id);

CREATE TABLE IF NOT EXISTS hmis_clinical_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10) NOT NULL CHECK (encounter_type IN ('opd','ipd')),
    encounter_id uuid NOT NULL,
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    note_type varchar(20) NOT NULL CHECK (note_type IN ('soap','progress','procedure','consultation','pre_op','post_op')),
    subjective text,
    objective text,
    assessment text,
    plan text,
    full_text text,
    template_id uuid REFERENCES hmis_clinical_templates(id),
    is_ai_generated boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_notes_encounter ON hmis_clinical_notes(encounter_type, encounter_id);

CREATE TABLE IF NOT EXISTS hmis_diagnoses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10) NOT NULL,
    encounter_id uuid NOT NULL,
    icd_code varchar(10) NOT NULL,
    icd_description varchar(200) NOT NULL,
    diagnosis_type varchar(20) NOT NULL CHECK (diagnosis_type IN ('provisional','confirmed','differential','final')),
    is_primary boolean NOT NULL DEFAULT false,
    diagnosed_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10) NOT NULL,
    encounter_id uuid NOT NULL,
    order_type varchar(20) NOT NULL CHECK (order_type IN ('lab','radiology','pharmacy','procedure','diet','nursing')),
    ordered_by uuid NOT NULL REFERENCES hmis_staff(id),
    priority varchar(10) NOT NULL DEFAULT 'routine' CHECK (priority IN ('stat','urgent','routine')),
    status varchar(20) NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','in_progress','completed','cancelled')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_procedures_performed (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10) NOT NULL,
    encounter_id uuid NOT NULL,
    procedure_code varchar(20),
    procedure_name varchar(200) NOT NULL,
    performed_by uuid NOT NULL REFERENCES hmis_staff(id),
    assistant_ids jsonb,
    anaesthesia_type varchar(20),
    start_time timestamptz,
    end_time timestamptz,
    notes text,
    complications text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Prescriptions (linked to orders)
CREATE TABLE IF NOT EXISTS hmis_prescriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_orders(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    drug_id uuid, -- FK added after drug_master
    drug_name varchar(200) NOT NULL, -- Denormalized for quick access
    dosage varchar(50) NOT NULL,
    frequency varchar(30) NOT NULL,
    route varchar(20) NOT NULL,
    duration_days int,
    quantity int,
    instructions text,
    is_substitutable boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: BILLING (7 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_tariff_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    service_code varchar(20) NOT NULL,
    service_name varchar(200) NOT NULL,
    category varchar(30) NOT NULL,
    rate_self decimal(10,2) NOT NULL,
    rate_insurance decimal(10,2),
    rate_pmjay decimal(10,2),
    rate_cghs decimal(10,2),
    gst_applicable boolean NOT NULL DEFAULT false,
    gst_rate decimal(4,2) DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, service_code)
);

CREATE TABLE IF NOT EXISTS hmis_package_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    package_name varchar(200) NOT NULL,
    package_code varchar(20),
    department_id uuid REFERENCES hmis_departments(id),
    total_amount decimal(12,2) NOT NULL,
    inclusions jsonb NOT NULL,
    exclusions jsonb,
    validity_days int,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    bill_number varchar(20) NOT NULL UNIQUE,
    bill_type varchar(10) NOT NULL CHECK (bill_type IN ('opd','ipd','pharmacy','lab','radiology','package')),
    encounter_type varchar(10),
    encounter_id uuid,
    payor_type varchar(20) NOT NULL,
    patient_insurance_id uuid REFERENCES hmis_patient_insurance(id),
    package_id uuid REFERENCES hmis_package_master(id),
    gross_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_amount decimal(12,2) NOT NULL DEFAULT 0,
    tax_amount decimal(12,2) NOT NULL DEFAULT 0,
    net_amount decimal(12,2) NOT NULL DEFAULT 0,
    paid_amount decimal(12,2) NOT NULL DEFAULT 0,
    balance_amount decimal(12,2) NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final','partially_paid','paid','cancelled','written_off')),
    bill_date date NOT NULL,
    due_date date,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    approved_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bills_centre_date ON hmis_bills(centre_id, bill_date);

CREATE TABLE IF NOT EXISTS hmis_bill_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id) ON DELETE CASCADE,
    tariff_id uuid REFERENCES hmis_tariff_master(id),
    description varchar(200) NOT NULL,
    quantity decimal(8,2) NOT NULL DEFAULT 1,
    unit_rate decimal(10,2) NOT NULL,
    amount decimal(12,2) NOT NULL,
    discount decimal(10,2) NOT NULL DEFAULT 0,
    tax decimal(10,2) NOT NULL DEFAULT 0,
    net_amount decimal(12,2) NOT NULL,
    service_date date NOT NULL,
    department_id uuid REFERENCES hmis_departments(id),
    doctor_id uuid REFERENCES hmis_staff(id)
);

CREATE TABLE IF NOT EXISTS hmis_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    amount decimal(12,2) NOT NULL,
    payment_mode varchar(20) NOT NULL CHECK (payment_mode IN ('cash','card','upi','neft','cheque','insurance_settlement')),
    reference_number varchar(50),
    receipt_number varchar(20) NOT NULL UNIQUE,
    payment_date date NOT NULL,
    received_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_advances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    amount decimal(12,2) NOT NULL,
    payment_mode varchar(20) NOT NULL,
    receipt_number varchar(20) NOT NULL UNIQUE,
    status varchar(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active','adjusted','refunded')),
    adjusted_against_bill_id uuid REFERENCES hmis_bills(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid REFERENCES hmis_bills(id),
    advance_id uuid REFERENCES hmis_advances(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    amount decimal(12,2) NOT NULL,
    reason text NOT NULL,
    approved_by uuid NOT NULL REFERENCES hmis_staff(id),
    refund_mode varchar(20) NOT NULL,
    status varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processed')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: INSURANCE & TPA (3 tables — insurers/tpas already created above)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_insurer_tariffs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_id uuid NOT NULL REFERENCES hmis_insurers(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    tariff_id uuid NOT NULL REFERENCES hmis_tariff_master(id),
    agreed_rate decimal(10,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_pre_auth_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    patient_insurance_id uuid NOT NULL REFERENCES hmis_patient_insurance(id),
    requested_amount decimal(12,2) NOT NULL,
    approved_amount decimal(12,2),
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','query','enhancement_pending')),
    pre_auth_number varchar(50),
    submitted_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    submitted_by uuid NOT NULL REFERENCES hmis_staff(id),
    documents jsonb,
    remarks text
);

CREATE TABLE IF NOT EXISTS hmis_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    pre_auth_id uuid REFERENCES hmis_pre_auth_requests(id),
    claim_number varchar(50),
    claim_type varchar(15) NOT NULL CHECK (claim_type IN ('cashless','reimbursement')),
    claimed_amount decimal(12,2) NOT NULL,
    approved_amount decimal(12,2),
    settled_amount decimal(12,2),
    tds_amount decimal(10,2),
    disallowance_amount decimal(10,2),
    disallowance_reason text,
    status varchar(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','query','approved','settled','rejected','appealed')),
    submitted_at timestamptz NOT NULL DEFAULT now(),
    settled_at timestamptz,
    utr_number varchar(50)
);

CREATE INDEX idx_claims_status ON hmis_claims(status);

-- ============================================================
-- MODULE: PHARMACY (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_drug_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    generic_name varchar(200) NOT NULL,
    brand_name varchar(200),
    manufacturer varchar(100),
    formulation varchar(30) NOT NULL,
    strength varchar(50),
    unit varchar(20) NOT NULL,
    schedule varchar(5),
    is_narcotic boolean NOT NULL DEFAULT false,
    is_antibiotic boolean NOT NULL DEFAULT false,
    hsn_code varchar(10),
    gst_rate decimal(4,2),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add deferred FK on prescriptions
ALTER TABLE hmis_prescriptions ADD CONSTRAINT fk_prescription_drug
    FOREIGN KEY (drug_id) REFERENCES hmis_drug_master(id);

CREATE TABLE IF NOT EXISTS hmis_drug_inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    batch_number varchar(50) NOT NULL,
    expiry_date date NOT NULL,
    mrp decimal(10,2) NOT NULL,
    purchase_rate decimal(10,2) NOT NULL,
    quantity_received int NOT NULL,
    quantity_available int NOT NULL,
    location varchar(30),
    grn_id uuid, -- Link to VPMS GRN if applicable
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drug_inventory_expiry ON hmis_drug_inventory(expiry_date) WHERE quantity_available > 0;
CREATE INDEX idx_drug_inventory_stock ON hmis_drug_inventory(drug_id, centre_id) WHERE quantity_available > 0;

CREATE TABLE IF NOT EXISTS hmis_dispensing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id uuid REFERENCES hmis_prescriptions(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    inventory_id uuid NOT NULL REFERENCES hmis_drug_inventory(id),
    quantity int NOT NULL,
    unit_price decimal(10,2) NOT NULL,
    total_amount decimal(10,2) NOT NULL,
    dispensed_by uuid NOT NULL REFERENCES hmis_staff(id),
    dispensed_at timestamptz NOT NULL DEFAULT now(),
    bill_id uuid REFERENCES hmis_bills(id)
);

-- ============================================================
-- MODULE: LAB (4 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_lab_test_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_code varchar(20) NOT NULL UNIQUE,
    test_name varchar(200) NOT NULL,
    category varchar(50) NOT NULL,
    sample_type varchar(30) NOT NULL,
    is_panel boolean NOT NULL DEFAULT false,
    parent_test_id uuid REFERENCES hmis_lab_test_master(id),
    tat_hours int,
    is_outsourced boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_lab_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_orders(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    status varchar(20) NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','sample_collected','processing','completed','cancelled')),
    ordered_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_lab_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    barcode varchar(30) NOT NULL UNIQUE,
    sample_type varchar(30) NOT NULL,
    collected_by uuid NOT NULL REFERENCES hmis_staff(id),
    collected_at timestamptz NOT NULL DEFAULT now(),
    received_at timestamptz,
    status varchar(15) NOT NULL DEFAULT 'collected' CHECK (status IN ('collected','in_transit','received','rejected'))
);

CREATE TABLE IF NOT EXISTS hmis_lab_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    parameter_name varchar(100) NOT NULL,
    result_value varchar(100) NOT NULL,
    unit varchar(20),
    normal_range_min decimal(10,3),
    normal_range_max decimal(10,3),
    is_abnormal boolean NOT NULL DEFAULT false,
    is_critical boolean NOT NULL DEFAULT false,
    validated_by uuid REFERENCES hmis_staff(id),
    validated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: RADIOLOGY (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_radiology_test_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_code varchar(20) NOT NULL UNIQUE,
    test_name varchar(200) NOT NULL,
    modality varchar(20) NOT NULL,
    body_part varchar(50),
    tat_hours int,
    is_contrast boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_radiology_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_orders(id),
    test_id uuid NOT NULL REFERENCES hmis_radiology_test_master(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    clinical_indication text,
    status varchar(20) NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','scheduled','in_progress','reported','verified')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_radiology_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    radiology_order_id uuid NOT NULL REFERENCES hmis_radiology_orders(id),
    findings text NOT NULL,
    impression text NOT NULL,
    reported_by uuid NOT NULL REFERENCES hmis_staff(id),
    verified_by uuid REFERENCES hmis_staff(id),
    pacs_study_uid varchar(100),
    is_ai_assisted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: OT SCHEDULING (4 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_ot_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(30) NOT NULL,
    type varchar(30),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

CREATE TABLE IF NOT EXISTS hmis_ot_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    ot_room_id uuid NOT NULL REFERENCES hmis_ot_rooms(id),
    surgeon_id uuid NOT NULL REFERENCES hmis_staff(id),
    anaesthetist_id uuid REFERENCES hmis_staff(id),
    procedure_name varchar(200) NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_start time NOT NULL,
    estimated_duration_min int,
    actual_start timestamptz,
    actual_end timestamptz,
    status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled','postponed')),
    is_emergency boolean NOT NULL DEFAULT false,
    is_robotic boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_surgery_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_booking_id uuid NOT NULL REFERENCES hmis_ot_bookings(id),
    pre_op_diagnosis text,
    post_op_diagnosis text,
    procedure_details text NOT NULL,
    findings text,
    complications text,
    blood_loss_ml int,
    implants_used jsonb,
    specimen_sent boolean NOT NULL DEFAULT false,
    surgeon_id uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_anaesthesia_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_booking_id uuid NOT NULL REFERENCES hmis_ot_bookings(id),
    anaesthesia_type varchar(20) NOT NULL,
    pre_op_assessment jsonb,
    drugs_used jsonb NOT NULL,
    vitals_timeline jsonb,
    complications text,
    anaesthetist_id uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: ACCOUNTING / GL (4 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_chart_of_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code varchar(20) NOT NULL UNIQUE,
    account_name varchar(100) NOT NULL,
    account_type varchar(20) NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
    parent_id uuid REFERENCES hmis_chart_of_accounts(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_fiscal_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name varchar(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_closed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_journal_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    entry_number varchar(20) NOT NULL UNIQUE,
    entry_date date NOT NULL,
    description text NOT NULL,
    source_type varchar(20),
    source_id uuid,
    is_auto boolean NOT NULL DEFAULT false,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    approved_by uuid REFERENCES hmis_staff(id),
    status varchar(15) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_journal_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id uuid NOT NULL REFERENCES hmis_journal_entries(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES hmis_chart_of_accounts(id),
    debit decimal(14,2) NOT NULL DEFAULT 0,
    credit decimal(14,2) NOT NULL DEFAULT 0,
    cost_centre_id uuid REFERENCES hmis_centres(id),
    department_id uuid REFERENCES hmis_departments(id)
);

-- ============================================================
-- MODULE: HOMECARE (2 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_homecare_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    plan_type varchar(30) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    instructions text,
    status varchar(15) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_homecare_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES hmis_homecare_plans(id),
    assigned_staff_id uuid NOT NULL REFERENCES hmis_staff(id),
    scheduled_date date NOT NULL,
    actual_date date,
    vitals_id uuid REFERENCES hmis_vitals(id),
    notes text,
    status varchar(15) NOT NULL DEFAULT 'scheduled',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: AMBULANCE (2 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_ambulances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    vehicle_number varchar(20) NOT NULL UNIQUE,
    type varchar(20) NOT NULL,
    is_available boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_ambulance_trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ambulance_id uuid NOT NULL REFERENCES hmis_ambulances(id),
    patient_id uuid REFERENCES hmis_patients(id),
    trip_type varchar(20) NOT NULL,
    pickup_location text NOT NULL,
    drop_location text NOT NULL,
    dispatch_time timestamptz NOT NULL,
    arrival_time timestamptz,
    completion_time timestamptz,
    crew_ids jsonb NOT NULL,
    status varchar(15) NOT NULL DEFAULT 'dispatched',
    bill_id uuid REFERENCES hmis_bills(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: NOTIFICATIONS (2 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_notification_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    channel varchar(15) NOT NULL CHECK (channel IN ('sms','whatsapp','email','push')),
    trigger_event varchar(50) NOT NULL,
    template_body text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_notification_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES hmis_notification_templates(id),
    patient_id uuid REFERENCES hmis_patients(id),
    staff_id uuid REFERENCES hmis_staff(id),
    channel varchar(15) NOT NULL,
    recipient varchar(100) NOT NULL,
    message text NOT NULL,
    status varchar(15) NOT NULL DEFAULT 'pending',
    sent_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MODULE: AI / CDSS (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_drug_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_a_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    drug_b_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    severity varchar(15) NOT NULL CHECK (severity IN ('mild','moderate','severe','contraindicated')),
    description text NOT NULL,
    recommendation text,
    UNIQUE(drug_a_id, drug_b_id)
);

CREATE TABLE IF NOT EXISTS hmis_cdss_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_id uuid,
    alert_type varchar(30) NOT NULL,
    severity varchar(10) NOT NULL CHECK (severity IN ('info','warning','critical')),
    message text NOT NULL,
    source_data jsonb,
    action_taken varchar(20),
    acted_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_ai_summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_id uuid NOT NULL,
    summary_type varchar(20) NOT NULL,
    generated_text text NOT NULL,
    final_text text,
    model_used varchar(50),
    reviewed_by uuid REFERENCES hmis_staff(id),
    is_approved boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- UTILITY: Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION hmis_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
-- ============================================================
-- Health1 HMIS — Billing Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Estimates / Proforma
CREATE TABLE IF NOT EXISTS hmis_estimates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    estimate_number varchar(20) NOT NULL UNIQUE,
    estimate_type varchar(15) NOT NULL CHECK (estimate_type IN ('opd','ipd','surgery','package','daycare')),
    department_id uuid REFERENCES hmis_departments(id),
    doctor_id uuid REFERENCES hmis_staff(id),
    procedure_name text,
    payor_type varchar(20) NOT NULL DEFAULT 'self',
    items jsonb NOT NULL DEFAULT '[]',
    total_estimated decimal(12,2) NOT NULL DEFAULT 0,
    room_category varchar(20),
    expected_los_days int,
    notes text,
    valid_until date,
    status varchar(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','expired','cancelled')),
    converted_to_bill_id uuid REFERENCES hmis_bills(id),
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS hmis_estimate_seq START 1;

-- 2. Credit Notes
CREATE TABLE IF NOT EXISTS hmis_credit_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    credit_note_number varchar(20) NOT NULL UNIQUE,
    amount decimal(12,2) NOT NULL,
    reason text NOT NULL,
    items jsonb DEFAULT '[]',
    status varchar(10) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','adjusted','cancelled')),
    approved_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. IPD Running Bill Auto-Charge Rules
CREATE TABLE IF NOT EXISTS hmis_billing_auto_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    rule_name varchar(100) NOT NULL,
    trigger_type varchar(20) NOT NULL CHECK (trigger_type IN ('daily','admission','discharge','procedure','investigation','pharmacy')),
    ward_type varchar(20),
    tariff_id uuid REFERENCES hmis_tariff_master(id),
    charge_description varchar(200) NOT NULL,
    charge_amount decimal(10,2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Discount Authorization Log
CREATE TABLE IF NOT EXISTS hmis_discount_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    discount_type varchar(15) NOT NULL CHECK (discount_type IN ('percentage','flat','item_level','staff','management','insurance_write_off')),
    discount_amount decimal(12,2) NOT NULL,
    discount_percentage decimal(5,2),
    reason text NOT NULL,
    authorized_by uuid NOT NULL REFERENCES hmis_staff(id),
    authorization_level varchar(15) CHECK (authorization_level IN ('billing_staff','supervisor','manager','md')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS

-- ============================================================
-- SEED: Standard tariff items for a quaternary hospital
-- ============================================================
-- ============================================================
-- Health1 HMIS — Pharmacy Module Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Purchase Orders (pharmacy-specific, separate from VPMS POs)
CREATE TABLE IF NOT EXISTS hmis_pharmacy_po (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    po_number varchar(20) NOT NULL,
    supplier varchar(200) NOT NULL,
    supplier_gst varchar(20),
    order_date date NOT NULL DEFAULT CURRENT_DATE,
    expected_date date,
    status varchar(15) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial_received','received','cancelled')),
    items jsonb NOT NULL DEFAULT '[]',
    total_amount decimal(12,2) DEFAULT 0,
    notes text,
    created_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Goods Receipt Note
CREATE TABLE IF NOT EXISTS hmis_pharmacy_grn (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    grn_number varchar(20) NOT NULL,
    po_id uuid REFERENCES hmis_pharmacy_po(id),
    supplier varchar(200) NOT NULL,
    invoice_number varchar(50),
    invoice_date date,
    received_date date NOT NULL DEFAULT CURRENT_DATE,
    items jsonb NOT NULL DEFAULT '[]',
    total_amount decimal(12,2) DEFAULT 0,
    received_by uuid REFERENCES hmis_staff(id),
    verified_by uuid REFERENCES hmis_staff(id),
    status varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','posted','rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Stock Transfer between centres
CREATE TABLE IF NOT EXISTS hmis_pharmacy_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number varchar(20) NOT NULL,
    from_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    to_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    status varchar(15) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','in_transit','received','cancelled')),
    items jsonb NOT NULL DEFAULT '[]',
    initiated_by uuid REFERENCES hmis_staff(id),
    received_by uuid REFERENCES hmis_staff(id),
    initiated_at timestamptz NOT NULL DEFAULT now(),
    received_at timestamptz
);

-- 4. Controlled Substance Register (Schedule H, H1, X)
CREATE TABLE IF NOT EXISTS hmis_pharmacy_controlled_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    batch_id uuid REFERENCES hmis_pharmacy_stock(id),
    transaction_type varchar(15) NOT NULL CHECK (transaction_type IN ('received','dispensed','returned','destroyed','transferred','adjusted')),
    quantity int NOT NULL,
    balance_after int NOT NULL,
    patient_id uuid REFERENCES hmis_patients(id),
    prescription_id uuid REFERENCES hmis_prescriptions(id),
    doctor_name varchar(100),
    doctor_reg_no varchar(30),
    witness_name varchar(100),
    notes text,
    logged_by uuid NOT NULL REFERENCES hmis_staff(id),
    logged_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Drug Returns & Expiry Management
CREATE TABLE IF NOT EXISTS hmis_pharmacy_returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    return_type varchar(15) NOT NULL CHECK (return_type IN ('patient_return','supplier_return','expiry_write_off','damage_write_off','adjustment')),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    batch_id uuid REFERENCES hmis_pharmacy_stock(id),
    batch_number varchar(50),
    quantity int NOT NULL,
    reason text,
    credit_note_number varchar(30),
    credit_amount decimal(10,2) DEFAULT 0,
    patient_id uuid REFERENCES hmis_patients(id),
    supplier varchar(200),
    processed_by uuid NOT NULL REFERENCES hmis_staff(id),
    status varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processed','rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Reorder Level Configuration
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS reorder_level int DEFAULT 20;
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS max_stock_level int DEFAULT 500;
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS preferred_supplier varchar(200);
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS category varchar(30) DEFAULT 'general' CHECK (category IN ('general','emergency','icu','surgical','oncology','cardiac','neuro','ortho','ot','consumable'));
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS rack_location varchar(30);
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS bin_number varchar(20);

-- RLS
-- ============================================================
-- Health1 HMIS — IPD Clinical Module Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Doctor Daily Rounds / Progress Notes
CREATE TABLE IF NOT EXISTS hmis_doctor_rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    round_date date NOT NULL DEFAULT CURRENT_DATE,
    round_type varchar(20) NOT NULL DEFAULT 'routine' CHECK (round_type IN ('admission','routine','consultant','shift_handover','discharge')),
    subjective text,
    objective text,
    vitals_data jsonb,
    assessment text,
    plan text,
    orders_given jsonb DEFAULT '[]',
    diet_instruction text,
    activity_level varchar(30),
    code_status varchar(20) CHECK (code_status IN ('full_code','dnr','dni','comfort_only')),
    is_critical boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rounds_admission ON hmis_doctor_rounds(admission_id, round_date DESC);

-- 2. ICU Charting (hourly monitoring)
CREATE TABLE IF NOT EXISTS hmis_icu_charts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    recorded_by uuid NOT NULL REFERENCES hmis_staff(id),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    -- Vitals
    hr int, bp_sys int, bp_dia int, map int, rr int, spo2 decimal(4,1),
    temp decimal(4,1), cvp decimal(5,1), art_line_sys int, art_line_dia int,
    -- Ventilator
    ventilator_mode varchar(20), fio2 decimal(4,1), peep decimal(4,1),
    tidal_volume int, pip decimal(4,1), rr_set int, rr_total int,
    ie_ratio varchar(10), etco2 decimal(4,1),
    -- Vasopressors & infusions
    infusions jsonb DEFAULT '[]',
    -- Neuro
    gcs_eye int, gcs_verbal int, gcs_motor int, gcs_total int,
    pupil_left varchar(20), pupil_right varchar(20),
    rass int, cam_icu boolean,
    -- Lines
    lines_status jsonb DEFAULT '[]',
    -- Notes
    nursing_note text
);
CREATE INDEX IF NOT EXISTS idx_icu_charts_admission ON hmis_icu_charts(admission_id, recorded_at DESC);

-- 3. ICU Scores
CREATE TABLE IF NOT EXISTS hmis_icu_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    scored_by uuid NOT NULL REFERENCES hmis_staff(id),
    score_date date NOT NULL DEFAULT CURRENT_DATE,
    score_type varchar(20) NOT NULL CHECK (score_type IN ('apache2','sofa','gcs','rass','cam_icu','braden','norton','morse_fall','news2','qsofa','curb65')),
    score_value int NOT NULL,
    components jsonb NOT NULL DEFAULT '{}',
    interpretation text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_icu_scores_admission ON hmis_icu_scores(admission_id, score_date DESC);

-- 4. Intake / Output Chart
CREATE TABLE IF NOT EXISTS hmis_io_chart (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    recorded_by uuid NOT NULL REFERENCES hmis_staff(id),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    io_date date NOT NULL DEFAULT CURRENT_DATE,
    shift varchar(10) NOT NULL CHECK (shift IN ('morning','evening','night')),
    -- Intake
    oral_intake_ml int DEFAULT 0,
    iv_fluid_ml int DEFAULT 0,
    blood_products_ml int DEFAULT 0,
    ryles_tube_ml int DEFAULT 0,
    other_intake_ml int DEFAULT 0,
    intake_details jsonb DEFAULT '[]',
    -- Output
    urine_ml int DEFAULT 0,
    drain_1_ml int DEFAULT 0,
    drain_2_ml int DEFAULT 0,
    ryles_aspirate_ml int DEFAULT 0,
    vomit_ml int DEFAULT 0,
    stool_count int DEFAULT 0,
    other_output_ml int DEFAULT 0,
    output_details jsonb DEFAULT '[]',
    -- Totals (computed)
    total_intake_ml int GENERATED ALWAYS AS (oral_intake_ml + iv_fluid_ml + blood_products_ml + ryles_tube_ml + other_intake_ml) STORED,
    total_output_ml int GENERATED ALWAYS AS (urine_ml + drain_1_ml + drain_2_ml + ryles_aspirate_ml + vomit_ml + other_output_ml) STORED
);
CREATE INDEX IF NOT EXISTS idx_io_chart_admission ON hmis_io_chart(admission_id, io_date DESC);

-- 5. IPD Medication Orders (doctor writes, pharmacy verifies)
CREATE TABLE IF NOT EXISTS hmis_ipd_medication_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    ordered_by uuid NOT NULL REFERENCES hmis_staff(id),
    drug_name varchar(200) NOT NULL,
    generic_name varchar(200),
    dose varchar(50) NOT NULL,
    route varchar(20) NOT NULL CHECK (route IN ('oral','iv','im','sc','sl','pr','topical','inhalation','nasal','intrathecal','epidural')),
    frequency varchar(30) NOT NULL,
    prn_instruction text,
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','held','discontinued','completed')),
    discontinued_by uuid REFERENCES hmis_staff(id),
    discontinue_reason text,
    pharmacy_verified boolean NOT NULL DEFAULT false,
    verified_by uuid REFERENCES hmis_staff(id),
    is_stat boolean NOT NULL DEFAULT false,
    is_prn boolean NOT NULL DEFAULT false,
    special_instructions text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ipd_med_orders_admission ON hmis_ipd_medication_orders(admission_id, status);

-- 6. MAR (Medication Administration Records)
CREATE TABLE IF NOT EXISTS hmis_mar (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_order_id uuid NOT NULL REFERENCES hmis_ipd_medication_orders(id),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    scheduled_time timestamptz NOT NULL,
    administered_time timestamptz,
    status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','given','held','refused','missed','delayed')),
    administered_by uuid REFERENCES hmis_staff(id),
    dose_given varchar(50),
    site varchar(30),
    hold_reason text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mar_admission ON hmis_mar(admission_id, scheduled_time);

-- 7. Consent Forms
CREATE TABLE IF NOT EXISTS hmis_consents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid REFERENCES hmis_admissions(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    consent_type varchar(30) NOT NULL CHECK (consent_type IN ('general','surgical','anesthesia','blood_transfusion','high_risk','ama_lama','hiv_test','research','photography','organ_donation','dnr')),
    procedure_name varchar(200),
    risks_explained text,
    alternatives_explained text,
    witness_name varchar(100),
    witness_relation varchar(30),
    consent_given boolean NOT NULL DEFAULT true,
    consent_date timestamptz NOT NULL DEFAULT now(),
    obtained_by uuid NOT NULL REFERENCES hmis_staff(id),
    patient_signature_data text,
    witness_signature_data text,
    revoked boolean NOT NULL DEFAULT false,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consents_patient ON hmis_consents(patient_id);

-- 8. Procedural Notes (central line, intubation, LP, chest tube etc.)
CREATE TABLE IF NOT EXISTS hmis_procedural_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    performed_by uuid NOT NULL REFERENCES hmis_staff(id),
    assisted_by uuid REFERENCES hmis_staff(id),
    procedure_type varchar(40) NOT NULL CHECK (procedure_type IN (
        'central_line','arterial_line','intubation','tracheostomy',
        'chest_tube','lumbar_puncture','paracentesis','thoracentesis',
        'bone_marrow','foley_catheter','ng_tube','picc_line',
        'dialysis_catheter','pericardiocentesis','cardioversion',
        'other'
    )),
    procedure_name varchar(200) NOT NULL,
    indication text NOT NULL,
    procedure_date timestamptz NOT NULL DEFAULT now(),
    site varchar(50),
    laterality varchar(10) CHECK (laterality IN ('left','right','bilateral','midline','na')),
    technique text,
    findings text,
    complications text,
    specimens_sent text,
    estimated_blood_loss_ml int,
    consent_obtained boolean NOT NULL DEFAULT true,
    consent_id uuid REFERENCES hmis_consents(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. WHO Surgical Safety Checklist
CREATE TABLE IF NOT EXISTS hmis_who_checklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_booking_id uuid NOT NULL REFERENCES hmis_ot_bookings(id),
    -- SIGN IN (before induction)
    sign_in_time timestamptz,
    sign_in_by uuid REFERENCES hmis_staff(id),
    si_patient_confirmed boolean DEFAULT false,
    si_site_marked boolean DEFAULT false,
    si_consent_signed boolean DEFAULT false,
    si_anaesthesia_check boolean DEFAULT false,
    si_pulse_oximeter boolean DEFAULT false,
    si_allergy_checked boolean DEFAULT false,
    si_airway_risk boolean DEFAULT false,
    si_blood_loss_risk boolean DEFAULT false,
    si_blood_available boolean DEFAULT false,
    -- TIME OUT (before skin incision)
    time_out_time timestamptz,
    time_out_by uuid REFERENCES hmis_staff(id),
    to_team_introduction boolean DEFAULT false,
    to_patient_name_confirmed boolean DEFAULT false,
    to_procedure_confirmed boolean DEFAULT false,
    to_site_confirmed boolean DEFAULT false,
    to_antibiotic_given boolean DEFAULT false,
    to_antibiotic_time timestamptz,
    to_imaging_displayed boolean DEFAULT false,
    to_critical_steps_discussed boolean DEFAULT false,
    to_anticipated_duration varchar(20),
    to_anticipated_blood_loss varchar(20),
    to_patient_concerns text,
    to_equipment_confirmed boolean DEFAULT false,
    to_sterility_confirmed boolean DEFAULT false,
    -- SIGN OUT (before patient leaves OT)
    sign_out_time timestamptz,
    sign_out_by uuid REFERENCES hmis_staff(id),
    so_procedure_recorded boolean DEFAULT false,
    so_instrument_count_correct boolean DEFAULT false,
    so_specimen_labelled boolean DEFAULT false,
    so_equipment_problems text,
    so_recovery_concerns text,
    so_vte_prophylaxis_planned boolean DEFAULT false,
    -- Status
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sign_in_done','time_out_done','completed')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. OT Notes (pre-op, intra-op, post-op)
CREATE TABLE IF NOT EXISTS hmis_ot_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_booking_id uuid NOT NULL REFERENCES hmis_ot_bookings(id),
    note_type varchar(20) NOT NULL CHECK (note_type IN ('pre_op','intra_op','post_op')),
    author_id uuid NOT NULL REFERENCES hmis_staff(id),
    -- Pre-op
    pre_op_diagnosis text,
    pre_op_investigations text,
    pre_op_fitness varchar(20),
    pre_op_asa_grade int CHECK (pre_op_asa_grade BETWEEN 1 AND 6),
    -- Intra-op
    procedure_performed text,
    approach varchar(50),
    findings text,
    specimens_sent text,
    implants_used text,
    ebl_ml int,
    fluids_given text,
    blood_given text,
    complications text,
    duration_minutes int,
    -- Post-op
    post_op_diagnosis text,
    post_op_instructions text,
    post_op_diet text,
    post_op_activity text,
    post_op_medications jsonb,
    drain_details text,
    dvt_prophylaxis text,
    follow_up_plan text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Simple authenticated access policies

-- ============================================================
-- ICU Score Templates (for reference)
-- ============================================================
COMMENT ON TABLE hmis_icu_scores IS 'Score types:
- apache2: APACHE II (0-71, ICU mortality prediction)
- sofa: Sequential Organ Failure Assessment (0-24)
- gcs: Glasgow Coma Scale (3-15)
- rass: Richmond Agitation-Sedation Scale (-5 to +4)
- cam_icu: Confusion Assessment Method (0 or 1)
- braden: Braden Pressure Ulcer Risk (6-23, <=12 high risk)
- norton: Norton Pressure Sore Risk (5-20, <=14 at risk)
- morse_fall: Morse Fall Scale (0-125, >=45 high risk)
- news2: National Early Warning Score 2 (0-20)
- qsofa: Quick SOFA (0-3)
- curb65: CURB-65 Pneumonia Severity (0-5)';
-- ============================================================
-- Health1 LIMS — Core Laboratory Module Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- Session 1: Sample lifecycle, test parameters, auto-validation,
--            critical alerts, TAT tracking, report templates
-- ============================================================

-- 1. Test Parameters (individual parameters within a test, with reference ranges)
CREATE TABLE IF NOT EXISTS hmis_lab_test_parameters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id) ON DELETE CASCADE,
    parameter_code varchar(20) NOT NULL,
    parameter_name varchar(100) NOT NULL,
    unit varchar(20),
    data_type varchar(10) NOT NULL DEFAULT 'numeric' CHECK (data_type IN ('numeric','text','option','formula')),
    decimal_places int DEFAULT 1,
    -- Reference ranges (default — overridden by age/gender rules below)
    ref_range_min decimal(10,3),
    ref_range_max decimal(10,3),
    ref_range_text varchar(100),
    -- Critical values
    critical_low decimal(10,3),
    critical_high decimal(10,3),
    -- Delta check (% change from previous result)
    delta_check_percent decimal(5,1),
    -- Display order within test
    sort_order int NOT NULL DEFAULT 0,
    -- For formula type: e.g., "A/G Ratio = albumin / globulin"
    formula text,
    -- Options for 'option' type (e.g., "Positive,Negative,Equivocal")
    option_values text,
    is_reportable boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(test_id, parameter_code)
);
CREATE INDEX IF NOT EXISTS idx_lab_params_test ON hmis_lab_test_parameters(test_id, sort_order);

-- 2. Age/Gender-specific Reference Ranges
CREATE TABLE IF NOT EXISTS hmis_lab_ref_ranges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_id uuid NOT NULL REFERENCES hmis_lab_test_parameters(id) ON DELETE CASCADE,
    gender varchar(10) CHECK (gender IN ('male','female','all')),
    age_min_years int DEFAULT 0,
    age_max_years int DEFAULT 150,
    ref_min decimal(10,3),
    ref_max decimal(10,3),
    ref_text varchar(100),
    unit varchar(20),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_ref_param ON hmis_lab_ref_ranges(parameter_id);

-- 3. Lab Profiles (test groupings like "Liver Panel", "Renal Panel")
CREATE TABLE IF NOT EXISTS hmis_lab_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_code varchar(20) NOT NULL UNIQUE,
    profile_name varchar(100) NOT NULL,
    category varchar(50),
    description text,
    rate decimal(10,2),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_lab_profile_tests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES hmis_lab_profiles(id) ON DELETE CASCADE,
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    sort_order int DEFAULT 0,
    UNIQUE(profile_id, test_id)
);

-- 4. Expanded Lab Orders (link to admission/encounter, priority, clinical info)
-- Add columns to existing hmis_lab_orders if they don't exist

-- 5. Add columns to lab_results for validation workflow

-- 6. Sample rejection reasons
CREATE TABLE IF NOT EXISTS hmis_lab_rejection_reasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reason_code varchar(20) NOT NULL UNIQUE,
    reason_text varchar(200) NOT NULL,
    sample_type varchar(30),
    is_active boolean NOT NULL DEFAULT true
);


-- 7. Sample tracking log (chain of custody)
CREATE TABLE IF NOT EXISTS hmis_lab_sample_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id uuid NOT NULL REFERENCES hmis_lab_samples(id),
    action varchar(30) NOT NULL CHECK (action IN ('collected','labeled','dispatched','received','rejected','processing_started','processing_complete','stored','disposed')),
    performed_by uuid NOT NULL REFERENCES hmis_staff(id),
    location varchar(50),
    temperature varchar(20),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sample_log ON hmis_lab_sample_log(sample_id, created_at);

-- 8. Critical value alerts
CREATE TABLE IF NOT EXISTS hmis_lab_critical_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    result_id uuid NOT NULL REFERENCES hmis_lab_results(id),
    parameter_name varchar(100) NOT NULL,
    result_value varchar(100) NOT NULL,
    critical_type varchar(10) NOT NULL CHECK (critical_type IN ('low','high')),
    -- Communication tracking
    notified_doctor_id uuid REFERENCES hmis_staff(id),
    notified_at timestamptz,
    notified_by uuid REFERENCES hmis_staff(id),
    acknowledged_at timestamptz,
    action_taken text,
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','notified','acknowledged','resolved')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. TAT Configuration per test
CREATE TABLE IF NOT EXISTS hmis_lab_tat_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    priority varchar(10) NOT NULL DEFAULT 'routine',
    tat_minutes int NOT NULL,
    escalation_minutes int,
    escalation_to uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(test_id, priority)
);

-- 10. Report templates
CREATE TABLE IF NOT EXISTS hmis_lab_report_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid REFERENCES hmis_lab_test_master(id),
    template_name varchar(100) NOT NULL,
    header_text text,
    footer_text text,
    interpretation_guide text,
    methodology text,
    specimen_requirements text,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. Outsourced lab tracking
CREATE TABLE IF NOT EXISTS hmis_lab_outsourced (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    external_lab_name varchar(100) NOT NULL,
    dispatch_date date NOT NULL,
    dispatch_ref varchar(50),
    expected_return date,
    actual_return date,
    external_report_ref varchar(50),
    status varchar(20) NOT NULL DEFAULT 'dispatched' CHECK (status IN ('dispatched','in_transit','received_by_lab','processing','reported','received_back')),
    cost decimal(10,2),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS Policies
-- ============================================================

-- ============================================================
-- SEED: Test parameters with reference ranges for common tests
-- ============================================================

-- Lab profiles
-- ============================================================
-- Health1 LIMS Session 2 — Microbiology + QC + Expanded Tests
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- ============================================================
-- PART 1: MICROBIOLOGY MODULE
-- ============================================================

-- 1. Organism master
CREATE TABLE IF NOT EXISTS hmis_lab_organisms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organism_code varchar(20) NOT NULL UNIQUE,
    organism_name varchar(200) NOT NULL,
    organism_type varchar(20) NOT NULL CHECK (organism_type IN ('bacteria_gp','bacteria_gn','fungi','mycobacteria','parasite','virus','other')),
    gram_stain varchar(20) CHECK (gram_stain IN ('gram_positive','gram_negative','na')),
    morphology varchar(50),
    is_alert_organism boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Antibiotic master
CREATE TABLE IF NOT EXISTS hmis_lab_antibiotics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    antibiotic_code varchar(20) NOT NULL UNIQUE,
    antibiotic_name varchar(100) NOT NULL,
    antibiotic_class varchar(50) NOT NULL,
    route varchar(20) DEFAULT 'oral' CHECK (route IN ('oral','iv','im','topical','both')),
    is_restricted boolean NOT NULL DEFAULT false,
    sort_order int DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Default antibiotic panels per organism type
CREATE TABLE IF NOT EXISTS hmis_lab_antibiotic_panels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    panel_name varchar(50) NOT NULL,
    organism_type varchar(20) NOT NULL,
    antibiotic_id uuid NOT NULL REFERENCES hmis_lab_antibiotics(id),
    is_first_line boolean NOT NULL DEFAULT true,
    sort_order int DEFAULT 0,
    UNIQUE(panel_name, antibiotic_id)
);

-- 4. Culture results
CREATE TABLE IF NOT EXISTS hmis_lab_cultures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    specimen_type varchar(50) NOT NULL,
    specimen_source varchar(100),
    collection_date timestamptz NOT NULL DEFAULT now(),
    -- Gram stain
    gram_stain_done boolean NOT NULL DEFAULT false,
    gram_stain_result text,
    -- Culture
    culture_status varchar(20) NOT NULL DEFAULT 'incubating' CHECK (culture_status IN ('incubating','growth','no_growth','mixed_flora','contaminated','pending')),
    incubation_start timestamptz,
    incubation_hours int DEFAULT 24,
    growth_description text,
    colony_count varchar(50),
    -- Final
    is_sterile boolean DEFAULT false,
    preliminary_report text,
    final_report text,
    reported_by uuid REFERENCES hmis_staff(id),
    reported_at timestamptz,
    verified_by uuid REFERENCES hmis_staff(id),
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cultures_order ON hmis_lab_cultures(order_id);

-- 5. Culture isolates (organisms found in a culture)
CREATE TABLE IF NOT EXISTS hmis_lab_culture_isolates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    culture_id uuid NOT NULL REFERENCES hmis_lab_cultures(id) ON DELETE CASCADE,
    organism_id uuid NOT NULL REFERENCES hmis_lab_organisms(id),
    isolate_number int NOT NULL DEFAULT 1,
    colony_morphology text,
    quantity varchar(20) CHECK (quantity IN ('few','moderate','heavy','very_heavy','countable')),
    cfu_count varchar(50),
    identification_method varchar(50),
    is_significant boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(culture_id, organism_id, isolate_number)
);

-- 6. Antibiotic sensitivity results
CREATE TABLE IF NOT EXISTS hmis_lab_sensitivity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    isolate_id uuid NOT NULL REFERENCES hmis_lab_culture_isolates(id) ON DELETE CASCADE,
    antibiotic_id uuid NOT NULL REFERENCES hmis_lab_antibiotics(id),
    method varchar(20) DEFAULT 'disc_diffusion' CHECK (method IN ('disc_diffusion','mic','etest','vitek','manual')),
    zone_diameter_mm decimal(5,1),
    mic_value decimal(10,3),
    mic_unit varchar(10) DEFAULT 'mcg/ml',
    interpretation varchar(5) NOT NULL CHECK (interpretation IN ('S','I','R','SDD','NS')),
    is_intrinsic_resistance boolean NOT NULL DEFAULT false,
    breakpoint_source varchar(20) DEFAULT 'CLSI',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(isolate_id, antibiotic_id)
);

-- 7. Antibiogram (cumulative susceptibility data)
CREATE TABLE IF NOT EXISTS hmis_lab_antibiogram (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    period_start date NOT NULL,
    period_end date NOT NULL,
    organism_id uuid NOT NULL REFERENCES hmis_lab_organisms(id),
    antibiotic_id uuid NOT NULL REFERENCES hmis_lab_antibiotics(id),
    total_isolates int NOT NULL DEFAULT 0,
    sensitive_count int NOT NULL DEFAULT 0,
    intermediate_count int NOT NULL DEFAULT 0,
    resistant_count int NOT NULL DEFAULT 0,
    susceptibility_percent decimal(5,1) GENERATED ALWAYS AS (
        CASE WHEN total_isolates > 0 THEN (sensitive_count::decimal / total_isolates * 100) ELSE 0 END
    ) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, period_start, period_end, organism_id, antibiotic_id)
);

-- ============================================================
-- PART 2: QC MODULE
-- ============================================================

-- 8. QC Lots (reagent/control material tracking)
CREATE TABLE IF NOT EXISTS hmis_lab_qc_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_number varchar(50) NOT NULL,
    material_name varchar(100) NOT NULL,
    manufacturer varchar(100),
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    parameter_id uuid REFERENCES hmis_lab_test_parameters(id),
    level varchar(10) NOT NULL CHECK (level IN ('L1','L2','L3','normal','abnormal')),
    target_mean decimal(10,3) NOT NULL,
    target_sd decimal(10,3) NOT NULL,
    unit varchar(20),
    expiry_date date NOT NULL,
    opened_date date,
    is_active boolean NOT NULL DEFAULT true,
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(lot_number, test_id, level)
);

-- 9. QC Results (daily QC runs)
CREATE TABLE IF NOT EXISTS hmis_lab_qc_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL REFERENCES hmis_lab_qc_lots(id),
    run_date date NOT NULL DEFAULT CURRENT_DATE,
    run_number int NOT NULL DEFAULT 1,
    measured_value decimal(10,3) NOT NULL,
    -- Calculated fields
    z_score decimal(5,2),
    sd_from_mean decimal(5,2),
    -- Westgard violations
    westgard_violation varchar(20),
    is_accepted boolean NOT NULL DEFAULT true,
    rejection_reason text,
    -- Corrective action
    corrective_action text,
    -- Staff
    performed_by uuid NOT NULL REFERENCES hmis_staff(id),
    reviewed_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qc_results_lot ON hmis_lab_qc_results(lot_id, run_date DESC);

-- 10. QC Rules configuration
CREATE TABLE IF NOT EXISTS hmis_lab_qc_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code varchar(10) NOT NULL UNIQUE,
    rule_name varchar(50) NOT NULL,
    description text,
    is_warning boolean NOT NULL DEFAULT false,
    is_rejection boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int DEFAULT 0
);

-- ============================================================
-- PART 3: RLS
-- ============================================================

-- ============================================================
-- PART 4: SEED DATA
-- ============================================================

-- Westgard QC Rules

-- Common Organisms

-- Common Antibiotics

-- Default antibiotic panels




-- ============================================================
-- PART 5: EXPANDED TEST MASTER (50+ tests)
-- ============================================================

-- Add parameters for key new tests
-- ============================================================
-- Health1 LIMS Session 3 — Histopathology, NABL Audit Trail, Reflex Testing
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- ============================================================
-- PART 1: HISTOPATHOLOGY MODULE
-- ============================================================

-- 1. Histopathology Cases
CREATE TABLE IF NOT EXISTS hmis_lab_histo_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    case_number varchar(30) NOT NULL UNIQUE,
    specimen_type varchar(50) NOT NULL,
    specimen_site varchar(100),
    laterality varchar(10) CHECK (laterality IN ('left','right','bilateral','midline','na')),
    clinical_history text,
    clinical_diagnosis text,
    surgeon_name varchar(100),
    -- Processing
    received_at timestamptz NOT NULL DEFAULT now(),
    received_by uuid NOT NULL REFERENCES hmis_staff(id),
    grossing_done_at timestamptz,
    grossing_by uuid REFERENCES hmis_staff(id),
    blocks_count int DEFAULT 1,
    slides_count int DEFAULT 1,
    special_stains jsonb DEFAULT '[]',
    ihc_markers jsonb DEFAULT '[]',
    -- Gross description
    gross_description text,
    gross_measurements text,
    gross_weight varchar(30),
    gross_photo_urls jsonb DEFAULT '[]',
    -- Microscopic description
    micro_description text,
    -- Diagnosis
    histo_diagnosis text,
    icd_code varchar(20),
    tumor_grade varchar(30),
    margin_status varchar(20) CHECK (margin_status IN ('clear','involved','close','not_applicable')),
    lymph_node_status text,
    tnm_staging text,
    -- Synoptic report (CAP protocol style)
    synoptic_data jsonb DEFAULT '{}',
    -- Addendum / Amendment
    addendum text,
    addendum_date timestamptz,
    addendum_by uuid REFERENCES hmis_staff(id),
    -- Status
    status varchar(20) NOT NULL DEFAULT 'accessioned' CHECK (status IN ('accessioned','grossing','processing','cutting','staining','reporting','verified','dispatched','amended')),
    reported_by uuid REFERENCES hmis_staff(id),
    reported_at timestamptz,
    verified_by uuid REFERENCES hmis_staff(id),
    verified_at timestamptz,
    tat_hours_actual decimal(8,1),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_histo_order ON hmis_lab_histo_cases(order_id);
CREATE INDEX IF NOT EXISTS idx_histo_status ON hmis_lab_histo_cases(status);

-- 2. Histopathology case number sequence
CREATE SEQUENCE IF NOT EXISTS hmis_histo_case_seq START 1;

-- Function to generate case number: H1-HISTO-YYYYMM-NNNN
CREATE OR REPLACE FUNCTION hmis_next_histo_case() RETURNS varchar AS $$
DECLARE
    seq_val int;
    case_no varchar;
BEGIN
    seq_val := nextval('hmis_histo_case_seq');
    case_no := 'H1-HP-' || to_char(now(), 'YYMM') || '-' || lpad(seq_val::text, 4, '0');
    RETURN case_no;
END;
$$ LANGUAGE plpgsql;

-- 3. Cytology Cases (FNA, PAP, Body fluids)
CREATE TABLE IF NOT EXISTS hmis_lab_cyto_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    case_number varchar(30) NOT NULL UNIQUE,
    specimen_type varchar(30) NOT NULL CHECK (specimen_type IN ('fnac','pap_smear','body_fluid','urine_cytology','brushing','washings','other')),
    specimen_site varchar(100),
    clinical_history text,
    adequacy varchar(20) CHECK (adequacy IN ('satisfactory','unsatisfactory','limited')),
    -- FNAC specific
    fnac_passes int,
    fnac_aspirate_description text,
    -- PAP specific
    bethesda_category varchar(50),
    -- Report
    microscopic_description text,
    cyto_diagnosis text,
    recommendation text,
    -- Status
    status varchar(20) NOT NULL DEFAULT 'accessioned' CHECK (status IN ('accessioned','screening','reporting','verified','dispatched')),
    reported_by uuid REFERENCES hmis_staff(id),
    reported_at timestamptz,
    verified_by uuid REFERENCES hmis_staff(id),
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Cytology case number sequence
CREATE SEQUENCE IF NOT EXISTS hmis_cyto_case_seq START 1;

CREATE OR REPLACE FUNCTION hmis_next_cyto_case() RETURNS varchar AS $$
DECLARE seq_val int; case_no varchar;
BEGIN
    seq_val := nextval('hmis_cyto_case_seq');
    case_no := 'H1-CY-' || to_char(now(), 'YYMM') || '-' || lpad(seq_val::text, 4, '0');
    RETURN case_no;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 2: NABL AUDIT TRAIL
-- ============================================================

-- 4. Comprehensive audit log for NABL compliance
CREATE TABLE IF NOT EXISTS hmis_lab_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- What
    entity_type varchar(30) NOT NULL CHECK (entity_type IN (
        'order','result','sample','culture','sensitivity','qc_result',
        'histo_case','cyto_case','report','critical_alert','outsourced','lot'
    )),
    entity_id uuid NOT NULL,
    action varchar(20) NOT NULL CHECK (action IN (
        'create','update','delete','verify','reject','print','dispatch',
        'collect','receive','report','amend','acknowledge','cancel'
    )),
    -- Who
    performed_by uuid NOT NULL REFERENCES hmis_staff(id),
    -- When
    performed_at timestamptz NOT NULL DEFAULT now(),
    -- What changed
    field_name varchar(50),
    old_value text,
    new_value text,
    -- Context
    ip_address varchar(45),
    user_agent text,
    reason text,
    -- Metadata
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON hmis_lab_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_staff ON hmis_lab_audit_log(performed_by, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON hmis_lab_audit_log(action, performed_at DESC);

-- 5. Document control register (SOPs, manuals, forms — NABL requirement)
CREATE TABLE IF NOT EXISTS hmis_lab_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number varchar(30) NOT NULL UNIQUE,
    doc_title varchar(200) NOT NULL,
    doc_type varchar(20) NOT NULL CHECK (doc_type IN ('sop','manual','form','policy','work_instruction','register','checklist')),
    department varchar(50),
    version varchar(10) NOT NULL DEFAULT '1.0',
    effective_date date NOT NULL DEFAULT CURRENT_DATE,
    review_date date,
    status varchar(15) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','under_review','superseded','obsolete')),
    prepared_by uuid REFERENCES hmis_staff(id),
    reviewed_by uuid REFERENCES hmis_staff(id),
    approved_by uuid REFERENCES hmis_staff(id),
    file_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Non-conformance / CAPA register
CREATE TABLE IF NOT EXISTS hmis_lab_ncr (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ncr_number varchar(30) NOT NULL UNIQUE,
    ncr_type varchar(20) NOT NULL CHECK (ncr_type IN ('non_conformance','complaint','incident','capa','preventive_action')),
    title varchar(200) NOT NULL,
    description text NOT NULL,
    root_cause text,
    corrective_action text,
    preventive_action text,
    severity varchar(10) CHECK (severity IN ('minor','major','critical')),
    status varchar(15) NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','action_taken','closed','verified')),
    reported_by uuid NOT NULL REFERENCES hmis_staff(id),
    assigned_to uuid REFERENCES hmis_staff(id),
    due_date date,
    closed_date date,
    closed_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS hmis_ncr_seq START 1;

-- ============================================================
-- PART 3: REFLEX TESTING
-- ============================================================

-- 7. Reflex testing rules
CREATE TABLE IF NOT EXISTS hmis_lab_reflex_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name varchar(100) NOT NULL,
    -- Trigger: which test/parameter and condition
    trigger_test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    trigger_parameter_id uuid REFERENCES hmis_lab_test_parameters(id),
    trigger_condition varchar(10) NOT NULL CHECK (trigger_condition IN ('gt','gte','lt','lte','eq','neq','between','abnormal','critical')),
    trigger_value_1 decimal(10,3),
    trigger_value_2 decimal(10,3),
    -- Action: which test to auto-order
    reflex_test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    reflex_priority varchar(10) DEFAULT 'routine',
    -- Config
    requires_approval boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 4: ADD HISTOPATHOLOGY TESTS TO MASTER
-- ============================================================

-- ============================================================
-- PART 5: RLS
-- ============================================================

-- ============================================================
-- PART 6: SEED REFLEX RULES
-- ============================================================

-- Seed some common special stains and IHC markers as comments for reference
COMMENT ON TABLE hmis_lab_histo_cases IS 'Common Special Stains: PAS, PAS-D, Masson Trichrome, Reticulin, Congo Red, ZN, GMS, Mucicarmine, Iron (Perl), Alcian Blue
Common IHC Markers: CK (Pan), CK7, CK20, EMA, Vimentin, S100, HMB45, Desmin, SMA, CD3, CD20, CD30, CD34, CD45, CD68, Ki67, ER, PR, HER2, p53, p63, TTF1, PSA, Chromogranin, Synaptophysin, GATA3, PAX8, WT1, Calretinin, D2-40';
-- ============================================================
-- Health1 HMIS — OT Management Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. OT Room enhancements
ALTER TABLE hmis_ot_rooms ADD COLUMN IF NOT EXISTS equipment jsonb DEFAULT '[]';
ALTER TABLE hmis_ot_rooms ADD COLUMN IF NOT EXISTS has_robotic boolean DEFAULT false;
ALTER TABLE hmis_ot_rooms ADD COLUMN IF NOT EXISTS has_laminar_flow boolean DEFAULT false;
ALTER TABLE hmis_ot_rooms ADD COLUMN IF NOT EXISTS max_daily_slots int DEFAULT 6;

-- 2. OT Booking enhancements
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS assistant_surgeon_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS scrub_nurse_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS circulating_nurse_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS anaesthesia_type varchar(20) CHECK (anaesthesia_type IN ('general','spinal','epidural','regional','local','sedation','combined'));
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS priority varchar(10) DEFAULT 'elective' CHECK (priority IN ('elective','urgent','emergency'));
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS postpone_reason text;
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS robot_type varchar(20) CHECK (robot_type IN ('ssi_mantra','cuvis','none'));
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS laterality varchar(10) CHECK (laterality IN ('left','right','bilateral','na'));
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS patient_category varchar(20) DEFAULT 'adult' CHECK (patient_category IN ('adult','paediatric','neonatal','geriatric'));

-- 3. WHO Surgical Safety Checklist
CREATE TABLE IF NOT EXISTS hmis_ot_safety_checklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_booking_id uuid NOT NULL REFERENCES hmis_ot_bookings(id) ON DELETE CASCADE,
    -- SIGN IN (before anaesthesia)
    sign_in_done boolean DEFAULT false,
    sign_in_at timestamptz,
    sign_in_by uuid REFERENCES hmis_staff(id),
    patient_identity_confirmed boolean DEFAULT false,
    site_marked boolean DEFAULT false,
    consent_verified boolean DEFAULT false,
    anaesthesia_check boolean DEFAULT false,
    pulse_oximeter boolean DEFAULT false,
    known_allergy boolean DEFAULT false,
    allergy_details text,
    difficult_airway boolean DEFAULT false,
    blood_loss_risk boolean DEFAULT false,
    blood_availability boolean DEFAULT false,
    -- TIME OUT (before incision)
    time_out_done boolean DEFAULT false,
    time_out_at timestamptz,
    time_out_by uuid REFERENCES hmis_staff(id),
    team_introduced boolean DEFAULT false,
    patient_name_confirmed boolean DEFAULT false,
    procedure_confirmed boolean DEFAULT false,
    site_confirmed boolean DEFAULT false,
    antibiotic_given boolean DEFAULT false,
    antibiotic_time timestamptz,
    imaging_displayed boolean DEFAULT false,
    anticipated_events_discussed boolean DEFAULT false,
    -- SIGN OUT (before patient leaves OT)
    sign_out_done boolean DEFAULT false,
    sign_out_at timestamptz,
    sign_out_by uuid REFERENCES hmis_staff(id),
    procedure_recorded boolean DEFAULT false,
    instrument_count_correct boolean DEFAULT false,
    sponge_count_correct boolean DEFAULT false,
    needle_count_correct boolean DEFAULT false,
    specimen_labelled boolean DEFAULT false,
    equipment_issues text,
    recovery_concerns text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. OT Implant/Consumable Tracking
CREATE TABLE IF NOT EXISTS hmis_ot_implants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_booking_id uuid NOT NULL REFERENCES hmis_ot_bookings(id),
    implant_name varchar(200) NOT NULL,
    manufacturer varchar(100),
    catalogue_number varchar(50),
    lot_number varchar(50),
    serial_number varchar(50),
    size varchar(30),
    quantity int NOT NULL DEFAULT 1,
    cost decimal(12,2) DEFAULT 0,
    mrp decimal(12,2) DEFAULT 0,
    sticker_attached boolean DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. OT Anaesthesia Record
CREATE TABLE IF NOT EXISTS hmis_ot_anaesthesia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_booking_id uuid NOT NULL REFERENCES hmis_ot_bookings(id) ON DELETE CASCADE,
    anaesthetist_id uuid NOT NULL REFERENCES hmis_staff(id),
    anaesthesia_type varchar(20) NOT NULL,
    asa_grade int CHECK (asa_grade BETWEEN 1 AND 6),
    mallampati int CHECK (mallampati BETWEEN 1 AND 4),
    airway_device varchar(30),
    tube_size varchar(10),
    intubation_attempts int DEFAULT 1,
    premedication jsonb DEFAULT '[]',
    induction_agents jsonb DEFAULT '[]',
    maintenance_agents jsonb DEFAULT '[]',
    muscle_relaxants jsonb DEFAULT '[]',
    reversal_agents jsonb DEFAULT '[]',
    fluids_given jsonb DEFAULT '[]',
    blood_products jsonb DEFAULT '[]',
    vitals_log jsonb DEFAULT '[]',
    events_log jsonb DEFAULT '[]',
    total_fluid_ml int DEFAULT 0,
    estimated_blood_loss_ml int DEFAULT 0,
    urine_output_ml int DEFAULT 0,
    complications text,
    extubation_time timestamptz,
    recovery_score int,
    handover_to varchar(50),
    handover_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ot_checklist_booking ON hmis_ot_safety_checklist(ot_booking_id);
CREATE INDEX IF NOT EXISTS idx_ot_implants_booking ON hmis_ot_implants(ot_booking_id);
CREATE INDEX IF NOT EXISTS idx_ot_anaesthesia_booking ON hmis_ot_anaesthesia(ot_booking_id);
CREATE INDEX IF NOT EXISTS idx_ot_bookings_date ON hmis_ot_bookings(scheduled_date, status);
-- ============================================================
-- Health1 HMIS — Radiology Module Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Enhance radiology orders
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS accession_number varchar(30);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS urgency varchar(10) DEFAULT 'routine' CHECK (urgency IN ('routine','urgent','stat'));
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS modality varchar(20);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS body_part varchar(50);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS is_contrast boolean DEFAULT false;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS contrast_allergy_checked boolean DEFAULT false;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS creatinine_value decimal(5,2);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS lmp_date date;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS pregnancy_status varchar(10) CHECK (pregnancy_status IN ('not_pregnant','pregnant','unknown','na'));
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS scheduled_time time;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS room_id uuid;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS ordered_by uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES hmis_admissions(id);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS encounter_id uuid;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS pacs_study_uid varchar(100);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS pacs_accession varchar(50);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS stradus_viewer_url text;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS reported_at timestamptz;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS tat_minutes int;

-- 2. Enhance radiology reports
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS technique text;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS comparison text;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS clinical_history text;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS is_critical boolean DEFAULT false;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS critical_notified boolean DEFAULT false;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS critical_notified_to varchar(100);
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS critical_notified_at timestamptz;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS is_addendum boolean DEFAULT false;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS parent_report_id uuid REFERENCES hmis_radiology_reports(id);
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS template_used varchar(50);
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS status varchar(15) DEFAULT 'draft' CHECK (status IN ('draft','finalized','verified','amended'));

-- 3. Radiology rooms / modalities
CREATE TABLE IF NOT EXISTS hmis_radiology_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(50) NOT NULL,
    modality varchar(20) NOT NULL,
    manufacturer varchar(100),
    model varchar(100),
    dicom_ae_title varchar(30),
    dicom_ip varchar(20),
    dicom_port int,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

-- 4. Report templates
CREATE TABLE IF NOT EXISTS hmis_radiology_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modality varchar(20) NOT NULL,
    body_part varchar(50),
    template_name varchar(100) NOT NULL,
    technique_text text,
    findings_template text NOT NULL,
    impression_template text,
    is_normal boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. PACS integration config (Stradus)
CREATE TABLE IF NOT EXISTS hmis_pacs_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id) UNIQUE,
    pacs_vendor varchar(30) NOT NULL DEFAULT 'stradus',
    pacs_url text NOT NULL,
    viewer_url text,
    dicom_ae_title varchar(30),
    dicom_ip varchar(20),
    dicom_port int DEFAULT 104,
    hl7_ip varchar(20),
    hl7_port int DEFAULT 2575,
    api_key text,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rad_orders_centre ON hmis_radiology_orders(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_rad_orders_accession ON hmis_radiology_orders(accession_number);
CREATE INDEX IF NOT EXISTS idx_rad_orders_pacs ON hmis_radiology_orders(pacs_study_uid);

-- RLS

-- ============================================================
-- SEED: Common radiology report templates
-- ============================================================

-- SEED: Radiology test master (if empty)
-- ============================================================
-- Health1 HMIS — Radiology Module v2 (Complete RIS + Stradus PACS)
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- Run AFTER radiology_enhancement.sql
-- ============================================================

-- 1. Imaging studies — THE core table. One row per acquired study.
-- This is what links a patient's file to Stradus.
CREATE TABLE IF NOT EXISTS hmis_imaging_studies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    order_id uuid REFERENCES hmis_radiology_orders(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    encounter_id uuid,

    -- Identifiers
    accession_number varchar(30) NOT NULL,
    study_instance_uid varchar(128),

    -- Study info
    modality varchar(20) NOT NULL,
    study_description varchar(200) NOT NULL,
    body_part varchar(50),
    is_contrast boolean DEFAULT false,
    series_count int DEFAULT 0,
    image_count int DEFAULT 0,

    -- PACS / Stradus
    pacs_study_id varchar(100),
    pacs_viewer_url text,
    stradus_study_url text,

    -- Dates
    study_date date NOT NULL,
    study_time time,
    acquired_at timestamptz,
    received_at timestamptz DEFAULT now(),

    -- Performing
    technician_name varchar(100),
    referring_doctor_id uuid REFERENCES hmis_staff(id),
    referring_doctor_name varchar(100),

    -- Status
    status varchar(20) NOT NULL DEFAULT 'acquired'
      CHECK (status IN ('ordered','acquired','reported','verified','amended','cancelled')),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_imaging_accession ON hmis_imaging_studies(accession_number);
CREATE INDEX IF NOT EXISTS idx_imaging_patient ON hmis_imaging_studies(patient_id, study_date DESC);
CREATE INDEX IF NOT EXISTS idx_imaging_uid ON hmis_imaging_studies(study_instance_uid);
CREATE INDEX IF NOT EXISTS idx_imaging_centre_date ON hmis_imaging_studies(centre_id, study_date DESC);
CREATE INDEX IF NOT EXISTS idx_imaging_status ON hmis_imaging_studies(centre_id, status);

-- 2. Imaging reports — reports coming FROM Stradus or entered locally
CREATE TABLE IF NOT EXISTS hmis_imaging_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid NOT NULL REFERENCES hmis_imaging_studies(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),

    -- Report content
    report_status varchar(15) NOT NULL DEFAULT 'preliminary'
      CHECK (report_status IN ('preliminary','final','verified','amended','cancelled')),
    technique text,
    clinical_history text,
    comparison text,
    findings text NOT NULL,
    impression text NOT NULL,

    -- Critical
    is_critical boolean DEFAULT false,
    critical_value text,
    critical_notified_to varchar(100),
    critical_notified_at timestamptz,
    critical_acknowledged boolean DEFAULT false,
    critical_acknowledged_by varchar(100),
    critical_acknowledged_at timestamptz,

    -- Authorship
    reported_by_name varchar(100),
    reported_by_id uuid REFERENCES hmis_staff(id),
    reported_at timestamptz DEFAULT now(),
    verified_by_name varchar(100),
    verified_by_id uuid REFERENCES hmis_staff(id),
    verified_at timestamptz,
    amended_reason text,

    -- Source
    source varchar(15) NOT NULL DEFAULT 'stradus'
      CHECK (source IN ('stradus','manual','hl7','api')),
    stradus_report_id varchar(100),
    raw_report_text text,

    -- TAT
    tat_minutes int,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imaging_reports_study ON hmis_imaging_reports(study_id);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_critical ON hmis_imaging_reports(is_critical) WHERE is_critical = true;

-- 3. Stradus sync log — audit trail of every inbound/outbound message
CREATE TABLE IF NOT EXISTS hmis_stradus_sync_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    direction varchar(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
    message_type varchar(20) NOT NULL,
    accession_number varchar(30),
    study_uid varchar(128),
    patient_uhid varchar(20),
    payload jsonb,
    response_code int,
    response_body text,
    error_message text,
    processed boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stradus_log_accession ON hmis_stradus_sync_log(accession_number);

-- 4. Critical finding notifications
CREATE TABLE IF NOT EXISTS hmis_critical_findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL REFERENCES hmis_imaging_reports(id),
    study_id uuid NOT NULL REFERENCES hmis_imaging_studies(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    finding_text text NOT NULL,
    severity varchar(10) DEFAULT 'critical' CHECK (severity IN ('critical','urgent','unexpected')),
    notified_to_name varchar(100),
    notified_to_id uuid REFERENCES hmis_staff(id),
    notified_via varchar(20) CHECK (notified_via IN ('phone','whatsapp','in_person','system','sms')),
    notified_at timestamptz,
    acknowledged boolean DEFAULT false,
    acknowledged_at timestamptz,
    acknowledged_by varchar(100),
    action_taken text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Radiology protocol / prep instructions
CREATE TABLE IF NOT EXISTS hmis_radiology_protocols (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modality varchar(20) NOT NULL,
    body_part varchar(50),
    protocol_name varchar(100) NOT NULL,
    prep_instructions text,
    patient_instructions text,
    contrast_required boolean DEFAULT false,
    fasting_hours int DEFAULT 0,
    hydration_instructions text,
    estimated_duration_min int,
    radiation_dose_msv decimal(6,2),
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Repeat / follow-up recommendations
CREATE TABLE IF NOT EXISTS hmis_imaging_followups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid NOT NULL REFERENCES hmis_imaging_studies(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    recommended_study varchar(100) NOT NULL,
    recommended_timeframe varchar(50),
    reason text,
    is_completed boolean DEFAULT false,
    completed_study_id uuid REFERENCES hmis_imaging_studies(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS

-- ============================================================
-- SEED: Radiology protocols
-- ============================================================
-- ============================================================
-- Health1 HMIS — Appointments + Patient Registration v2
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Doctor Schedule / Slots
CREATE TABLE IF NOT EXISTS hmis_doctor_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
    start_time time NOT NULL,
    end_time time NOT NULL,
    slot_duration_min int NOT NULL DEFAULT 15,
    max_patients int NOT NULL DEFAULT 20,
    is_active boolean NOT NULL DEFAULT true,
    room_number varchar(20),
    consultation_fee decimal(10,2) DEFAULT 0,
    UNIQUE(centre_id, doctor_id, day_of_week, start_time)
);

-- 2. Appointments
CREATE TABLE IF NOT EXISTS hmis_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    schedule_id uuid REFERENCES hmis_doctor_schedules(id),
    appointment_date date NOT NULL,
    appointment_time time NOT NULL,
    slot_end_time time,
    appointment_type varchar(20) NOT NULL DEFAULT 'new' CHECK (appointment_type IN ('new','follow_up','review','procedure','teleconsult')),
    status varchar(20) NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','confirmed','checked_in','in_consultation','completed','cancelled','no_show','rescheduled')),
    visit_reason text,
    priority varchar(10) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','emergency','vip')),
    token_number int,
    -- Source
    booked_by uuid REFERENCES hmis_staff(id),
    booking_source varchar(15) DEFAULT 'counter' CHECK (booking_source IN ('counter','phone','portal','app','referral','walk_in')),
    -- Cancellation / Reschedule
    cancelled_at timestamptz,
    cancelled_by uuid REFERENCES hmis_staff(id),
    cancel_reason text,
    rescheduled_from uuid REFERENCES hmis_appointments(id),
    -- Reminders
    reminder_sent boolean DEFAULT false,
    reminder_sent_at timestamptz,
    -- Timestamps
    checked_in_at timestamptz,
    consultation_start timestamptz,
    consultation_end timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_date ON hmis_appointments(centre_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appt_doctor ON hmis_appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON hmis_appointments(patient_id, appointment_date DESC);

-- 3. Patient Emergency Contacts
CREATE TABLE IF NOT EXISTS hmis_patient_emergency_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    relationship varchar(30) NOT NULL,
    phone varchar(15) NOT NULL,
    alternate_phone varchar(15),
    is_primary boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_patient ON hmis_patient_emergency_contacts(patient_id);

-- 4. Patient Documents
CREATE TABLE IF NOT EXISTS hmis_patient_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    document_type varchar(30) NOT NULL CHECK (document_type IN (
        'aadhaar','pan','voter_id','passport','driving_license',
        'insurance_card','tpa_card','cghs_card','echs_card','esi_card',
        'referral_letter','old_records','consent_form','discharge_summary',
        'lab_report','radiology_report','prescription','photo','other'
    )),
    document_name varchar(100) NOT NULL,
    file_url text NOT NULL,
    file_size int,
    mime_type varchar(50),
    notes text,
    uploaded_by uuid REFERENCES hmis_staff(id),
    verified boolean DEFAULT false,
    verified_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_patient ON hmis_patient_documents(patient_id);

-- Add document_type if table existed without it
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS document_type varchar(30);
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS document_name varchar(100);
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS file_size int;
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS mime_type varchar(50);
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
ALTER TABLE hmis_patient_documents ADD COLUMN IF NOT EXISTS verified_by uuid;

-- 5. Patient Insurance Records
CREATE TABLE IF NOT EXISTS hmis_patient_insurance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    insurance_company varchar(100) NOT NULL,
    tpa_name varchar(100),
    policy_number varchar(50) NOT NULL,
    card_number varchar(50),
    group_name varchar(100),
    valid_from date,
    valid_to date,
    sum_insured decimal(12,2),
    relation_to_primary varchar(20) DEFAULT 'self',
    primary_holder_name varchar(100),
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_patient ON hmis_patient_insurance(patient_id);

-- Add columns to patients if missing
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS aadhaar_number varchar(12);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS pan_number varchar(10);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS father_name varchar(100);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS mother_name varchar(100);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS spouse_name varchar(100);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS preferred_language varchar(20) DEFAULT 'hindi';
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS category varchar(20) DEFAULT 'general';
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_id varchar(30);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS referred_by varchar(100);

-- RLS

-- Token number generator
CREATE OR REPLACE FUNCTION generate_appointment_token(
    p_centre_id uuid,
    p_doctor_id uuid,
    p_date date
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_token int;
BEGIN
    SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_token
    FROM hmis_appointments
    WHERE centre_id = p_centre_id AND doctor_id = p_doctor_id AND appointment_date = p_date
      AND status NOT IN ('cancelled', 'rescheduled');
    RETURN v_token;
END;
$$;
