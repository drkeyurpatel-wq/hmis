-- ════════════════════════════════════════════════════════════════
-- Health1 HMIS — COMPLETE DATABASE REBUILD
-- Drops ALL hmis_* tables and recreates from scratch
-- Project: bmuupgrzbfmddjwcqlss (Mumbai region)
-- ════════════════════════════════════════════════════════════════
-- WARNING: This DELETES all existing data. Run only if you want a fresh start.
-- ════════════════════════════════════════════════════════════════

-- STEP 0: DROP EVERYTHING
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all hmis_* tables in dependency-safe order (CASCADE)
  FOR r IN (
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND tablename LIKE 'hmis_%'
    ORDER BY tablename
  ) LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    RAISE NOTICE 'Dropped: %', r.tablename;
  END LOOP;
  
  -- Drop all hmis_* functions
  FOR r IN (
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name LIKE 'hmis_%'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.routine_name) || ' CASCADE';
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
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
        AND table_name LIKE 'hmis_%'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION hmis_update_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;

-- ============================================================
-- UTILITY: Next sequence value function
-- ============================================================

CREATE OR REPLACE FUNCTION hmis_next_sequence(
    p_centre_id uuid,
    p_type varchar,
    p_fiscal_year varchar DEFAULT NULL
)
RETURNS text AS $$
DECLARE
    v_prefix varchar;
    v_val bigint;
BEGIN
    UPDATE hmis_sequences
    SET current_value = current_value + 1
    WHERE centre_id = p_centre_id
      AND type = p_type
      AND (fiscal_year = p_fiscal_year OR (fiscal_year IS NULL AND p_fiscal_year IS NULL))
    RETURNING prefix, current_value INTO v_prefix, v_val;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sequence not found: centre=%, type=%, fy=%', p_centre_id, p_type, p_fiscal_year;
    END IF;

    RETURN v_prefix || lpad(v_val::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DONE. 77 tables created.
-- Next: Run seed_data.sql for master data
-- ============================================================
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
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_estimates','hmis_credit_notes','hmis_billing_auto_rules','hmis_discount_log'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Standard tariff items for a quaternary hospital
-- ============================================================
INSERT INTO hmis_tariff_master (centre_id, service_code, service_name, category, rate_self, rate_insurance, rate_pmjay, rate_cghs) 
SELECT c.id, t.code, t.name, t.cat, t.self_rate, t.ins_rate, t.pmjay, t.cghs
FROM hmis_centres c, (VALUES
  -- Consultation
  ('CONS-GEN', 'Consultation — General Medicine', 'consultation', 500, 500, 300, 400),
  ('CONS-SPEC', 'Consultation — Specialist', 'consultation', 800, 800, 400, 500),
  ('CONS-SUPER', 'Consultation — Super Specialist', 'consultation', 1200, 1200, 500, 700),
  ('CONS-FOLLOW', 'Follow-up Consultation', 'consultation', 300, 300, 200, 250),
  ('CONS-ER', 'Emergency Consultation', 'consultation', 1500, 1500, 500, 800),
  -- Room Rent
  ('ROOM-GEN', 'General Ward (per day)', 'room_rent', 1500, 2000, 1000, 1200),
  ('ROOM-SEMI', 'Semi-Private Room (per day)', 'room_rent', 3000, 3500, 1500, 2000),
  ('ROOM-PVT', 'Private Room (per day)', 'room_rent', 5000, 6000, 2000, 3000),
  ('ROOM-DELUX', 'Deluxe Room (per day)', 'room_rent', 8000, 9000, 2500, 4000),
  ('ROOM-ICU', 'ICU (per day)', 'room_rent', 12000, 15000, 5000, 8000),
  ('ROOM-TICU', 'Transplant ICU (per day)', 'room_rent', 18000, 20000, 8000, 12000),
  ('ROOM-NICU', 'NICU (per day)', 'room_rent', 10000, 12000, 5000, 7000),
  -- OT Charges
  ('OT-MINOR', 'OT Charges — Minor', 'ot_charges', 5000, 6000, 3000, 4000),
  ('OT-INTER', 'OT Charges — Intermediate', 'ot_charges', 10000, 12000, 6000, 8000),
  ('OT-MAJOR', 'OT Charges — Major', 'ot_charges', 20000, 25000, 10000, 15000),
  ('OT-SUPER', 'OT Charges — Super Major', 'ot_charges', 35000, 40000, 15000, 25000),
  ('OT-ROBOT', 'OT Charges — Robotic Surgery', 'ot_charges', 50000, 60000, 20000, 35000),
  -- Professional Fees
  ('PROF-SURG', 'Surgeon Professional Fee', 'professional_fee', 15000, 18000, 8000, 12000),
  ('PROF-ANAES', 'Anaesthetist Fee', 'professional_fee', 8000, 10000, 4000, 6000),
  ('PROF-ASSIST', 'Assistant Surgeon Fee', 'professional_fee', 5000, 6000, 2000, 3000),
  -- ICU Charges
  ('ICU-VENT', 'Ventilator Charges (per day)', 'icu_charges', 5000, 6000, 3000, 4000),
  ('ICU-MONITOR', 'ICU Monitoring (per day)', 'icu_charges', 3000, 3500, 2000, 2500),
  ('ICU-BIPAP', 'BiPAP/NIV (per day)', 'icu_charges', 2000, 2500, 1500, 1800),
  ('ICU-DIALYSIS', 'Dialysis (per session)', 'icu_charges', 8000, 10000, 5000, 7000),
  -- Nursing
  ('NURS-GEN', 'Nursing Charges — General (per day)', 'nursing', 500, 600, 300, 400),
  ('NURS-ICU', 'Nursing Charges — ICU (per day)', 'nursing', 1500, 1800, 800, 1200),
  ('NURS-SPECIAL', 'Special Nursing (per shift)', 'nursing', 2000, 2500, 1000, 1500),
  -- Procedures (common)
  ('PROC-CATH', 'Coronary Angiography', 'procedure', 25000, 30000, 15000, 20000),
  ('PROC-PTCA', 'PTCA with Stent (single)', 'procedure', 80000, 95000, 50000, 65000),
  ('PROC-PTCA2', 'PTCA with Stent (double)', 'procedure', 140000, 160000, 80000, 110000),
  ('PROC-CABG', 'CABG (single bypass)', 'procedure', 200000, 250000, 120000, 170000),
  ('PROC-TKR', 'Total Knee Replacement (unilateral)', 'procedure', 180000, 220000, 100000, 150000),
  ('PROC-THR', 'Total Hip Replacement', 'procedure', 200000, 250000, 120000, 170000),
  ('PROC-LAPCHOLE', 'Laparoscopic Cholecystectomy', 'procedure', 45000, 55000, 25000, 35000),
  ('PROC-APPY', 'Appendectomy (Laparoscopic)', 'procedure', 35000, 40000, 20000, 28000),
  ('PROC-HERNIA', 'Hernia Repair (Laparoscopic)', 'procedure', 40000, 50000, 22000, 30000),
  ('PROC-SPINE', 'Spine Surgery (Discectomy)', 'procedure', 150000, 180000, 80000, 120000),
  ('PROC-CRANIOTO', 'Craniotomy', 'procedure', 180000, 220000, 100000, 150000),
  -- Consumables
  ('CON-STENT-DES', 'Drug Eluting Stent', 'consumable', 35000, 40000, 25000, 30000),
  ('CON-IMPLANT-TKR', 'TKR Implant (Cuvis)', 'consumable', 65000, 75000, 40000, 55000),
  ('CON-PACEMAKER', 'Pacemaker (Single Chamber)', 'consumable', 50000, 60000, 35000, 45000),
  ('CON-MESH', 'Hernia Mesh', 'consumable', 8000, 10000, 5000, 7000),
  -- Miscellaneous
  ('MISC-AMBULANCE', 'Ambulance Service', 'miscellaneous', 2000, 2000, 1500, 1500),
  ('MISC-DIET', 'Diet Charges (per day)', 'miscellaneous', 500, 500, 300, 400),
  ('MISC-LAUNDRY', 'Extra Linen/Laundry', 'miscellaneous', 200, 200, 100, 150),
  ('MISC-ATTENDANT', 'Attendant Bed (per day)', 'miscellaneous', 300, 300, 200, 250),
  ('MISC-OXYGEN', 'Oxygen (per hour)', 'miscellaneous', 100, 100, 80, 90),
  ('MISC-NEBULIZE', 'Nebulization (per session)', 'miscellaneous', 150, 150, 100, 120),
  ('MISC-DRESSING', 'Dressing (per session)', 'miscellaneous', 300, 300, 200, 250),
  ('MISC-CATHETER', 'Catheterization (Foley)', 'miscellaneous', 500, 500, 300, 400),
  ('MISC-BLOOD', 'Blood Transfusion (per unit)', 'miscellaneous', 1500, 1500, 1000, 1200)
) AS t(code, name, cat, self_rate, ins_rate, pmjay, cghs)
WHERE c.code = 'SHJ' OR c.name ILIKE '%shilaj%'
ON CONFLICT (centre_id, service_code) DO NOTHING;
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
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_pharmacy_po','hmis_pharmacy_grn','hmis_pharmacy_transfers','hmis_pharmacy_controlled_log','hmis_pharmacy_returns'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;
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
ALTER TABLE hmis_doctor_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_icu_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_icu_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_io_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_ipd_medication_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_mar ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_procedural_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_who_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_ot_notes ENABLE ROW LEVEL SECURITY;

-- Simple authenticated access policies
DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_doctor_rounds','hmis_icu_charts','hmis_icu_scores','hmis_io_chart',
        'hmis_ipd_medication_orders','hmis_mar','hmis_consents','hmis_procedural_notes',
        'hmis_who_checklist','hmis_ot_notes'
    ] LOOP
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

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
DO $$ BEGIN
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES hmis_admissions(id);
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS encounter_id uuid;
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS priority varchar(10) DEFAULT 'routine' CHECK (priority IN ('stat','urgent','routine'));
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS clinical_info text;
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS fasting boolean DEFAULT false;
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS specimen_source varchar(50);
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES hmis_lab_profiles(id);
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES hmis_bills(id);
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS tat_deadline timestamptz;
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS tat_met boolean;
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS reported_at timestamptz;
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES hmis_staff(id);
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS verified_at timestamptz;
    ALTER TABLE hmis_lab_orders ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES hmis_staff(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Add columns to lab_results for validation workflow
DO $$ BEGIN
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS parameter_id uuid REFERENCES hmis_lab_test_parameters(id);
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS is_auto_validated boolean DEFAULT false;
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS delta_flag boolean DEFAULT false;
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS delta_previous varchar(100);
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS delta_percent decimal(5,1);
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS machine_result varchar(100);
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS remarks text;
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS entered_by uuid REFERENCES hmis_staff(id);
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS entered_at timestamptz DEFAULT now();
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS rerun_count int DEFAULT 0;
    ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS interpretation text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Sample rejection reasons
CREATE TABLE IF NOT EXISTS hmis_lab_rejection_reasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reason_code varchar(20) NOT NULL UNIQUE,
    reason_text varchar(200) NOT NULL,
    sample_type varchar(30),
    is_active boolean NOT NULL DEFAULT true
);

INSERT INTO hmis_lab_rejection_reasons (reason_code, reason_text, sample_type) VALUES
('HEMOLYZED', 'Hemolyzed sample', 'blood'),
('CLOTTED', 'Clotted sample (EDTA/citrate tube)', 'blood'),
('INSUFFICIENT', 'Insufficient sample volume', NULL),
('WRONG_TUBE', 'Wrong collection tube used', 'blood'),
('LIPEMIC', 'Lipemic sample', 'blood'),
('UNLABELED', 'Unlabeled or mislabeled sample', NULL),
('CONTAMINATED', 'Contaminated sample', NULL),
('EXPIRED', 'Sample too old / exceeded stability', NULL),
('LEAKED', 'Leaked during transport', NULL),
('WRONG_TEMP', 'Temperature not maintained during transport', NULL),
('DISCREPANCY', 'Discrepancy between label and requisition', NULL)
ON CONFLICT (reason_code) DO NOTHING;

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
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_lab_test_parameters','hmis_lab_ref_ranges','hmis_lab_profiles','hmis_lab_profile_tests',
        'hmis_lab_rejection_reasons','hmis_lab_sample_log','hmis_lab_critical_alerts',
        'hmis_lab_tat_config','hmis_lab_report_templates','hmis_lab_outsourced'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Test parameters with reference ranges for common tests
-- ============================================================
DO $$
DECLARE
    cbc_id uuid; rft_id uuid; lft_id uuid; lipid_id uuid; tsh_id uuid;
    fbs_id uuid; hba1c_id uuid; electro_id uuid;
BEGIN
    SELECT id INTO cbc_id FROM hmis_lab_test_master WHERE test_code = 'CBC';
    SELECT id INTO rft_id FROM hmis_lab_test_master WHERE test_code = 'RFT';
    SELECT id INTO lft_id FROM hmis_lab_test_master WHERE test_code = 'LFT';
    SELECT id INTO lipid_id FROM hmis_lab_test_master WHERE test_code = 'LIPID';
    SELECT id INTO tsh_id FROM hmis_lab_test_master WHERE test_code = 'TSH';
    SELECT id INTO fbs_id FROM hmis_lab_test_master WHERE test_code = 'FBS';
    SELECT id INTO hba1c_id FROM hmis_lab_test_master WHERE test_code = 'HBA1C';
    SELECT id INTO electro_id FROM hmis_lab_test_master WHERE test_code = 'ELECTRO';

    -- CBC Parameters
    IF cbc_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, delta_check_percent, sort_order) VALUES
    (cbc_id, 'HB', 'Hemoglobin', 'g/dL', 12.0, 16.0, 5.0, 20.0, 30, 1),
    (cbc_id, 'RBC', 'RBC Count', 'million/cumm', 4.0, 5.5, 2.0, 8.0, 25, 2),
    (cbc_id, 'PCV', 'PCV / Hematocrit', '%', 36, 48, 15, 65, 25, 3),
    (cbc_id, 'MCV', 'MCV', 'fL', 80, 100, NULL, NULL, NULL, 4),
    (cbc_id, 'MCH', 'MCH', 'pg', 27, 32, NULL, NULL, NULL, 5),
    (cbc_id, 'MCHC', 'MCHC', 'g/dL', 32, 36, NULL, NULL, NULL, 6),
    (cbc_id, 'RDW', 'RDW-CV', '%', 11.5, 14.5, NULL, NULL, NULL, 7),
    (cbc_id, 'WBC', 'Total WBC Count', 'x10^3/uL', 4.0, 11.0, 2.0, 30.0, 50, 8),
    (cbc_id, 'NEUT', 'Neutrophils', '%', 40, 70, NULL, NULL, NULL, 9),
    (cbc_id, 'LYMPH', 'Lymphocytes', '%', 20, 40, NULL, NULL, NULL, 10),
    (cbc_id, 'MONO', 'Monocytes', '%', 2, 8, NULL, NULL, NULL, 11),
    (cbc_id, 'EOS', 'Eosinophils', '%', 1, 6, NULL, NULL, NULL, 12),
    (cbc_id, 'BASO', 'Basophils', '%', 0, 1, NULL, NULL, NULL, 13),
    (cbc_id, 'PLT', 'Platelet Count', 'x10^3/uL', 150, 400, 20, 1000, 50, 14),
    (cbc_id, 'MPV', 'Mean Platelet Volume', 'fL', 7.4, 10.4, NULL, NULL, NULL, 15),
    (cbc_id, 'ESR', 'ESR', 'mm/hr', 0, 20, NULL, NULL, NULL, 16)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- RFT Parameters
    IF rft_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, delta_check_percent, sort_order) VALUES
    (rft_id, 'UREA', 'Blood Urea', 'mg/dL', 15, 45, NULL, 100, 50, 1),
    (rft_id, 'CREAT', 'Serum Creatinine', 'mg/dL', 0.6, 1.2, NULL, 10, 50, 2),
    (rft_id, 'BUN', 'BUN', 'mg/dL', 7, 21, NULL, NULL, NULL, 3),
    (rft_id, 'URIC', 'Uric Acid', 'mg/dL', 3.5, 7.0, NULL, 15, NULL, 4),
    (rft_id, 'NA', 'Sodium', 'mEq/L', 135, 145, 120, 160, 10, 5),
    (rft_id, 'K', 'Potassium', 'mEq/L', 3.5, 5.0, 2.5, 6.5, 20, 6),
    (rft_id, 'CL', 'Chloride', 'mEq/L', 98, 106, 80, 120, NULL, 7),
    (rft_id, 'CA', 'Calcium', 'mg/dL', 8.5, 10.5, 6.0, 14.0, 15, 8),
    (rft_id, 'PHOS', 'Phosphorus', 'mg/dL', 2.5, 4.5, 1.0, 9.0, NULL, 9)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- LFT Parameters
    IF lft_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, sort_order) VALUES
    (lft_id, 'TBIL', 'Total Bilirubin', 'mg/dL', 0.2, 1.2, NULL, 15, 1),
    (lft_id, 'DBIL', 'Direct Bilirubin', 'mg/dL', 0.0, 0.3, NULL, NULL, 2),
    (lft_id, 'IBIL', 'Indirect Bilirubin', 'mg/dL', 0.1, 0.9, NULL, NULL, 3),
    (lft_id, 'SGOT', 'SGOT / AST', 'U/L', 5, 40, NULL, 1000, 4),
    (lft_id, 'SGPT', 'SGPT / ALT', 'U/L', 5, 40, NULL, 1000, 5),
    (lft_id, 'ALP', 'Alkaline Phosphatase', 'U/L', 44, 147, NULL, NULL, 6),
    (lft_id, 'GGT', 'Gamma GT', 'U/L', 7, 64, NULL, NULL, 7),
    (lft_id, 'TP', 'Total Protein', 'g/dL', 6.0, 8.0, NULL, NULL, 8),
    (lft_id, 'ALB', 'Albumin', 'g/dL', 3.5, 5.0, 1.5, NULL, 9),
    (lft_id, 'GLOB', 'Globulin', 'g/dL', 2.0, 3.5, NULL, NULL, 10),
    (lft_id, 'AG', 'A/G Ratio', NULL, 1.0, 2.0, NULL, NULL, 11)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Lipid Profile Parameters
    IF lipid_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_high, sort_order) VALUES
    (lipid_id, 'TCHOL', 'Total Cholesterol', 'mg/dL', 0, 200, 500, 1),
    (lipid_id, 'TG', 'Triglycerides', 'mg/dL', 0, 150, 1000, 2),
    (lipid_id, 'HDL', 'HDL Cholesterol', 'mg/dL', 40, 999, NULL, 3),
    (lipid_id, 'LDL', 'LDL Cholesterol', 'mg/dL', 0, 130, NULL, 4),
    (lipid_id, 'VLDL', 'VLDL Cholesterol', 'mg/dL', 5, 40, NULL, 5),
    (lipid_id, 'TC_HDL', 'TC/HDL Ratio', NULL, 0, 4.5, NULL, 6),
    (lipid_id, 'LDL_HDL', 'LDL/HDL Ratio', NULL, 0, 3.5, NULL, 7)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- TSH
    IF tsh_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, sort_order) VALUES
    (tsh_id, 'TSH', 'TSH', 'mIU/L', 0.4, 4.0, 0.01, 100, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- FBS
    IF fbs_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, sort_order) VALUES
    (fbs_id, 'FBS', 'Fasting Blood Sugar', 'mg/dL', 70, 100, 40, 500, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- HbA1c
    IF hba1c_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, sort_order) VALUES
    (hba1c_id, 'HBA1C', 'HbA1c', '%', 4.0, 5.6, 1),
    (hba1c_id, 'EAG', 'Estimated Average Glucose', 'mg/dL', 68, 114, 2)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Gender-specific ranges for Hemoglobin
    IF cbc_id IS NOT NULL THEN
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, v.gender, v.age_min, v.age_max, v.rmin, v.rmax, 'g/dL'
    FROM hmis_lab_test_parameters p,
    (VALUES ('male', 18, 150, 13.0, 17.0), ('female', 18, 150, 12.0, 15.0), ('all', 0, 1, 14.0, 22.0), ('all', 1, 6, 11.0, 14.0), ('all', 6, 18, 11.5, 15.5)) AS v(gender, age_min, age_max, rmin, rmax)
    WHERE p.test_id = cbc_id AND p.parameter_code = 'HB'
    ON CONFLICT DO NOTHING;
    END IF;

    -- TAT config for common tests
    INSERT INTO hmis_lab_tat_config (test_id, priority, tat_minutes) VALUES
    (cbc_id, 'routine', 120), (cbc_id, 'stat', 30),
    (rft_id, 'routine', 240), (rft_id, 'stat', 60),
    (lft_id, 'routine', 240), (lft_id, 'stat', 60),
    (lipid_id, 'routine', 240),
    (tsh_id, 'routine', 360),
    (fbs_id, 'routine', 60), (fbs_id, 'stat', 15),
    (hba1c_id, 'routine', 360)
    ON CONFLICT (test_id, priority) DO NOTHING;

    RAISE NOTICE 'LIMS seed complete — parameters, reference ranges, TAT config';
END $$;

-- Lab profiles
INSERT INTO hmis_lab_profiles (profile_code, profile_name, category, rate) VALUES
('BASIC_METABOLIC', 'Basic Metabolic Panel', 'Biochemistry', 800),
('COMP_METABOLIC', 'Comprehensive Metabolic Panel', 'Biochemistry', 1500),
('LIVER_PANEL', 'Liver Function Panel', 'Biochemistry', 600),
('RENAL_PANEL', 'Renal Function Panel', 'Biochemistry', 600),
('THYROID_PANEL', 'Thyroid Panel (TSH/FT3/FT4)', 'Endocrinology', 700),
('CARDIAC_PANEL', 'Cardiac Markers Panel', 'Cardiac', 2000),
('COAG_PANEL', 'Coagulation Panel', 'Hematology', 800),
('DIABETES_PANEL', 'Diabetes Panel (FBS/PPBS/HbA1c)', 'Biochemistry', 600),
('FEVER_PANEL', 'Fever Workup Panel', 'Microbiology', 1200),
('PRE_OP_PANEL', 'Pre-Operative Panel', 'Multi', 2000),
('ANEMIA_PANEL', 'Anemia Workup Panel', 'Hematology', 1500)
ON CONFLICT (profile_code) DO NOTHING;
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
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_lab_organisms','hmis_lab_antibiotics','hmis_lab_antibiotic_panels',
        'hmis_lab_cultures','hmis_lab_culture_isolates','hmis_lab_sensitivity',
        'hmis_lab_antibiogram','hmis_lab_qc_lots','hmis_lab_qc_results','hmis_lab_qc_rules'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- PART 4: SEED DATA
-- ============================================================

-- Westgard QC Rules
INSERT INTO hmis_lab_qc_rules (rule_code, rule_name, description, is_warning, is_rejection, sort_order) VALUES
('1_2s', '1-2s Warning', 'Single control exceeds mean ± 2SD', true, false, 1),
('1_3s', '1-3s Rejection', 'Single control exceeds mean ± 3SD', false, true, 2),
('2_2s', '2-2s Rejection', 'Two consecutive controls exceed mean + 2SD or mean - 2SD', false, true, 3),
('R_4s', 'R-4s Rejection', 'One control exceeds +2SD and another -2SD (range >4SD)', false, true, 4),
('4_1s', '4-1s Rejection', 'Four consecutive controls exceed mean + 1SD or mean - 1SD', false, true, 5),
('10x', '10x Rejection', 'Ten consecutive controls on same side of mean', false, true, 6),
('7T', '7T Warning', 'Seven consecutive controls trending in same direction', true, false, 7),
('2of3_2s', '2 of 3 - 2s', 'Two of three consecutive controls exceed ±2SD', false, true, 8)
ON CONFLICT (rule_code) DO NOTHING;

-- Common Organisms
INSERT INTO hmis_lab_organisms (organism_code, organism_name, organism_type, gram_stain, morphology, is_alert_organism) VALUES
-- Gram Positive
('SA', 'Staphylococcus aureus', 'bacteria_gp', 'gram_positive', 'cocci_clusters', false),
('MRSA', 'MRSA (Methicillin-resistant S. aureus)', 'bacteria_gp', 'gram_positive', 'cocci_clusters', true),
('CONS', 'Coagulase-negative Staphylococcus', 'bacteria_gp', 'gram_positive', 'cocci_clusters', false),
('SP', 'Streptococcus pneumoniae', 'bacteria_gp', 'gram_positive', 'diplococci', false),
('GAS', 'Streptococcus pyogenes (Group A)', 'bacteria_gp', 'gram_positive', 'cocci_chains', false),
('GBS', 'Streptococcus agalactiae (Group B)', 'bacteria_gp', 'gram_positive', 'cocci_chains', false),
('EF', 'Enterococcus faecalis', 'bacteria_gp', 'gram_positive', 'cocci_chains', false),
('VRE', 'VRE (Vancomycin-resistant Enterococcus)', 'bacteria_gp', 'gram_positive', 'cocci_chains', true),
-- Gram Negative
('EC', 'Escherichia coli', 'bacteria_gn', 'gram_negative', 'bacilli', false),
('ESBL_EC', 'ESBL-producing E. coli', 'bacteria_gn', 'gram_negative', 'bacilli', true),
('KP', 'Klebsiella pneumoniae', 'bacteria_gn', 'gram_negative', 'bacilli', false),
('CRE_KP', 'CRE Klebsiella pneumoniae', 'bacteria_gn', 'gram_negative', 'bacilli', true),
('PA', 'Pseudomonas aeruginosa', 'bacteria_gn', 'gram_negative', 'bacilli', false),
('AB', 'Acinetobacter baumannii', 'bacteria_gn', 'gram_negative', 'coccobacilli', true),
('PM', 'Proteus mirabilis', 'bacteria_gn', 'gram_negative', 'bacilli', false),
('EB', 'Enterobacter cloacae', 'bacteria_gn', 'gram_negative', 'bacilli', false),
('CF', 'Citrobacter freundii', 'bacteria_gn', 'gram_negative', 'bacilli', false),
('SE', 'Salmonella enterica', 'bacteria_gn', 'gram_negative', 'bacilli', false),
('ST', 'Salmonella typhi', 'bacteria_gn', 'gram_negative', 'bacilli', true),
('SF', 'Shigella flexneri', 'bacteria_gn', 'gram_negative', 'bacilli', false),
('NM', 'Neisseria meningitidis', 'bacteria_gn', 'gram_negative', 'diplococci', true),
('HI', 'Haemophilus influenzae', 'bacteria_gn', 'gram_negative', 'coccobacilli', false),
-- Fungi
('CA', 'Candida albicans', 'fungi', 'na', 'yeast', false),
('CNAB', 'Candida non-albicans', 'fungi', 'na', 'yeast', false),
('AF', 'Aspergillus fumigatus', 'fungi', 'na', 'mold', false),
('CR', 'Cryptococcus neoformans', 'fungi', 'na', 'yeast', true),
-- Mycobacteria
('MTB', 'Mycobacterium tuberculosis', 'mycobacteria', 'na', 'acid_fast_bacilli', true),
('NTM', 'Non-tuberculous Mycobacteria (NTM)', 'mycobacteria', 'na', 'acid_fast_bacilli', false)
ON CONFLICT (organism_code) DO NOTHING;

-- Common Antibiotics
INSERT INTO hmis_lab_antibiotics (antibiotic_code, antibiotic_name, antibiotic_class, route, is_restricted, sort_order) VALUES
-- Penicillins
('AMP', 'Ampicillin', 'Penicillins', 'both', false, 1),
('AMC', 'Amoxicillin-Clavulanate', 'Penicillins', 'oral', false, 2),
('PIP_TZ', 'Piperacillin-Tazobactam', 'Penicillins', 'iv', false, 3),
-- Cephalosporins
('CXM', 'Cefuroxime', 'Cephalosporins-2G', 'both', false, 10),
('CTX', 'Cefotaxime', 'Cephalosporins-3G', 'iv', false, 11),
('CRO', 'Ceftriaxone', 'Cephalosporins-3G', 'iv', false, 12),
('CAZ', 'Ceftazidime', 'Cephalosporins-3G', 'iv', false, 13),
('FEP', 'Cefepime', 'Cephalosporins-4G', 'iv', false, 14),
('CPT', 'Ceftaroline', 'Cephalosporins-5G', 'iv', true, 15),
-- Carbapenems
('MEM', 'Meropenem', 'Carbapenems', 'iv', true, 20),
('IMP', 'Imipenem-Cilastatin', 'Carbapenems', 'iv', true, 21),
('ETP', 'Ertapenem', 'Carbapenems', 'iv', true, 22),
-- Aminoglycosides
('GEN', 'Gentamicin', 'Aminoglycosides', 'iv', false, 30),
('AMK', 'Amikacin', 'Aminoglycosides', 'iv', false, 31),
('TOB', 'Tobramycin', 'Aminoglycosides', 'iv', false, 32),
-- Fluoroquinolones
('CIP', 'Ciprofloxacin', 'Fluoroquinolones', 'both', false, 40),
('LVX', 'Levofloxacin', 'Fluoroquinolones', 'both', false, 41),
('MXF', 'Moxifloxacin', 'Fluoroquinolones', 'both', false, 42),
-- Macrolides
('AZM', 'Azithromycin', 'Macrolides', 'oral', false, 50),
('ERY', 'Erythromycin', 'Macrolides', 'both', false, 51),
('CLR', 'Clarithromycin', 'Macrolides', 'oral', false, 52),
-- Glycopeptides
('VAN', 'Vancomycin', 'Glycopeptides', 'iv', true, 60),
('TEC', 'Teicoplanin', 'Glycopeptides', 'iv', true, 61),
-- Oxazolidinones
('LZD', 'Linezolid', 'Oxazolidinones', 'both', true, 70),
-- Polymyxins
('COL', 'Colistin', 'Polymyxins', 'iv', true, 80),
('PMB', 'Polymyxin B', 'Polymyxins', 'iv', true, 81),
-- Tetracyclines
('DOX', 'Doxycycline', 'Tetracyclines', 'oral', false, 90),
('TGC', 'Tigecycline', 'Tetracyclines', 'iv', true, 91),
-- Sulfonamides
('SXT', 'Trimethoprim-Sulfamethoxazole', 'Sulfonamides', 'both', false, 100),
-- Others
('MTZ', 'Metronidazole', 'Nitroimidazoles', 'both', false, 110),
('CLI', 'Clindamycin', 'Lincosamides', 'both', false, 111),
('NIT', 'Nitrofurantoin', 'Nitrofurans', 'oral', false, 112),
('FOS', 'Fosfomycin', 'Phosphonics', 'oral', false, 113),
('RIF', 'Rifampicin', 'Rifamycins', 'oral', false, 114),
-- Antifungals
('FLC', 'Fluconazole', 'Azoles', 'both', false, 120),
('VRC', 'Voriconazole', 'Azoles', 'both', true, 121),
('AMB', 'Amphotericin B', 'Polyenes', 'iv', true, 122),
('CAS', 'Caspofungin', 'Echinocandins', 'iv', true, 123)
ON CONFLICT (antibiotic_code) DO NOTHING;

-- Default antibiotic panels
INSERT INTO hmis_lab_antibiotic_panels (panel_name, organism_type, antibiotic_id, is_first_line, sort_order)
SELECT 'GN_Urinary', 'bacteria_gn', id, true, sort_order FROM hmis_lab_antibiotics WHERE antibiotic_code IN ('AMP','AMC','CXM','CTX','CRO','GEN','CIP','LVX','NIT','FOS','SXT','CAZ','MEM','AMK','COL')
ON CONFLICT DO NOTHING;

INSERT INTO hmis_lab_antibiotic_panels (panel_name, organism_type, antibiotic_id, is_first_line, sort_order)
SELECT 'GN_Systemic', 'bacteria_gn', id, true, sort_order FROM hmis_lab_antibiotics WHERE antibiotic_code IN ('AMP','AMC','PIP_TZ','CTX','CRO','CAZ','FEP','MEM','IMP','GEN','AMK','CIP','LVX','SXT','COL','TGC')
ON CONFLICT DO NOTHING;

INSERT INTO hmis_lab_antibiotic_panels (panel_name, organism_type, antibiotic_id, is_first_line, sort_order)
SELECT 'GP_General', 'bacteria_gp', id, true, sort_order FROM hmis_lab_antibiotics WHERE antibiotic_code IN ('AMP','AMC','CXM','ERY','AZM','CLI','VAN','LZD','DOX','SXT','CIP','LVX','GEN','RIF','TEC')
ON CONFLICT DO NOTHING;

INSERT INTO hmis_lab_antibiotic_panels (panel_name, organism_type, antibiotic_id, is_first_line, sort_order)
SELECT 'Fungal', 'fungi', id, true, sort_order FROM hmis_lab_antibiotics WHERE antibiotic_code IN ('FLC','VRC','AMB','CAS')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PART 5: EXPANDED TEST MASTER (50+ tests)
-- ============================================================
INSERT INTO hmis_lab_test_master (test_code, test_name, category, sample_type, tat_hours) VALUES
-- Biochemistry
('PPBS', 'Post Prandial Blood Sugar', 'Biochemistry', 'serum', 2),
('RBS', 'Random Blood Sugar', 'Biochemistry', 'serum', 1),
('GTT', 'Glucose Tolerance Test', 'Biochemistry', 'serum', 6),
('AMYLASE', 'Serum Amylase', 'Biochemistry', 'serum', 4),
('LIPASE', 'Serum Lipase', 'Biochemistry', 'serum', 4),
('CK_MB', 'CK-MB', 'Biochemistry', 'serum', 2),
('TROP_I', 'Troponin I', 'Biochemistry', 'serum', 1),
('TROP_T', 'Troponin T', 'Biochemistry', 'serum', 1),
('BNP', 'NT-proBNP', 'Biochemistry', 'serum', 4),
('CRP', 'C-Reactive Protein (Quantitative)', 'Biochemistry', 'serum', 4),
('PROCALC', 'Procalcitonin', 'Biochemistry', 'serum', 4),
('FERRITIN', 'Serum Ferritin', 'Biochemistry', 'serum', 6),
('IRON', 'Serum Iron', 'Biochemistry', 'serum', 4),
('TIBC', 'TIBC', 'Biochemistry', 'serum', 4),
('VIT_D', 'Vitamin D (25-OH)', 'Biochemistry', 'serum', 24),
('VIT_B12', 'Vitamin B12', 'Biochemistry', 'serum', 24),
('FOLATE', 'Folic Acid', 'Biochemistry', 'serum', 24),
('LDH', 'Lactate Dehydrogenase', 'Biochemistry', 'serum', 4),
('MAGNESIUM', 'Serum Magnesium', 'Biochemistry', 'serum', 4),
('LACTATE', 'Blood Lactate', 'Biochemistry', 'plasma', 1),
('AMMONIA', 'Blood Ammonia', 'Biochemistry', 'plasma', 2),
-- Hematology
('PT_INR', 'PT / INR', 'Hematology', 'plasma', 2),
('APTT', 'aPTT', 'Hematology', 'plasma', 2),
('DDIMER', 'D-Dimer', 'Hematology', 'plasma', 2),
('FIBRINOGEN', 'Fibrinogen', 'Hematology', 'plasma', 4),
('RETIC', 'Reticulocyte Count', 'Hematology', 'blood', 4),
('PBS', 'Peripheral Blood Smear', 'Hematology', 'blood', 4),
-- Endocrinology
('FT3', 'Free T3', 'Endocrinology', 'serum', 6),
('FT4', 'Free T4', 'Endocrinology', 'serum', 6),
('CORTISOL', 'Serum Cortisol', 'Endocrinology', 'serum', 24),
('INSULIN', 'Fasting Insulin', 'Endocrinology', 'serum', 24),
('PSA', 'PSA (Total)', 'Endocrinology', 'serum', 24),
('CEA', 'CEA', 'Endocrinology', 'serum', 24),
('AFP', 'Alpha Fetoprotein', 'Endocrinology', 'serum', 24),
('CA125', 'CA-125', 'Endocrinology', 'serum', 24),
('CA199', 'CA 19-9', 'Endocrinology', 'serum', 24),
-- Urine
('URINE_RM', 'Urine Routine & Microscopy', 'Biochemistry', 'urine', 2),
('URINE_CS', 'Urine Culture & Sensitivity', 'Microbiology', 'urine', 48),
('MICRO_ALBUMIN', 'Urine Microalbumin', 'Biochemistry', 'urine', 4),
('ACR', 'Albumin-Creatinine Ratio', 'Biochemistry', 'urine', 4),
('UPE', 'Urine Protein (24hr)', 'Biochemistry', 'urine', 24),
-- Microbiology
('BLOOD_CS', 'Blood Culture & Sensitivity', 'Microbiology', 'blood', 72),
('SPUTUM_CS', 'Sputum Culture & Sensitivity', 'Microbiology', 'sputum', 72),
('WOUND_CS', 'Wound Swab Culture & Sensitivity', 'Microbiology', 'swab', 72),
('CSF_CS', 'CSF Culture & Sensitivity', 'Microbiology', 'csf', 72),
('STOOL_CS', 'Stool Culture & Sensitivity', 'Microbiology', 'stool', 72),
('FLUID_CS', 'Body Fluid Culture & Sensitivity', 'Microbiology', 'fluid', 72),
('AFB_SMEAR', 'AFB Smear (ZN Stain)', 'Microbiology', 'sputum', 4),
('AFB_CULTURE', 'AFB Culture (MGIT)', 'Microbiology', 'sputum', 1008),
('MALARIA', 'Malaria Parasite (Smear)', 'Microbiology', 'blood', 2),
('DENGUE_NS1', 'Dengue NS1 Antigen', 'Microbiology', 'serum', 4),
('DENGUE_IGM', 'Dengue IgM', 'Microbiology', 'serum', 4),
('WIDAL', 'Widal Test', 'Microbiology', 'serum', 4),
('HBsAg', 'HBsAg', 'Microbiology', 'serum', 4),
('HCV', 'Anti-HCV', 'Microbiology', 'serum', 4),
('HIV', 'HIV 1&2 Antibody', 'Microbiology', 'serum', 4),
-- Immunology
('ANA', 'ANA (IF)', 'Immunology', 'serum', 24),
('RF', 'Rheumatoid Factor', 'Immunology', 'serum', 4),
('ASLO', 'ASO Titre', 'Immunology', 'serum', 4),
('ANCA', 'ANCA (pANCA/cANCA)', 'Immunology', 'serum', 48),
-- ABG
('ABG', 'Arterial Blood Gas', 'Biochemistry', 'blood', 1)
ON CONFLICT (test_code) DO NOTHING;

-- Add parameters for key new tests
DO $$
DECLARE
    pt_inr_id uuid; aptt_id uuid; ddimer_id uuid; crp_id uuid;
    trop_i_id uuid; ppbs_id uuid; rbs_id uuid; ft3_id uuid; ft4_id uuid;
    vit_d_id uuid; vit_b12_id uuid; ferritin_id uuid; iron_id uuid;
    ldh_id uuid; lactate_id uuid; ammonia_id uuid; urine_rm_id uuid;
    abg_id uuid; psa_id uuid;
BEGIN
    SELECT id INTO pt_inr_id FROM hmis_lab_test_master WHERE test_code = 'PT_INR';
    SELECT id INTO aptt_id FROM hmis_lab_test_master WHERE test_code = 'APTT';
    SELECT id INTO ddimer_id FROM hmis_lab_test_master WHERE test_code = 'DDIMER';
    SELECT id INTO crp_id FROM hmis_lab_test_master WHERE test_code = 'CRP';
    SELECT id INTO trop_i_id FROM hmis_lab_test_master WHERE test_code = 'TROP_I';
    SELECT id INTO ppbs_id FROM hmis_lab_test_master WHERE test_code = 'PPBS';
    SELECT id INTO rbs_id FROM hmis_lab_test_master WHERE test_code = 'RBS';
    SELECT id INTO ft3_id FROM hmis_lab_test_master WHERE test_code = 'FT3';
    SELECT id INTO ft4_id FROM hmis_lab_test_master WHERE test_code = 'FT4';
    SELECT id INTO vit_d_id FROM hmis_lab_test_master WHERE test_code = 'VIT_D';
    SELECT id INTO vit_b12_id FROM hmis_lab_test_master WHERE test_code = 'VIT_B12';
    SELECT id INTO ferritin_id FROM hmis_lab_test_master WHERE test_code = 'FERRITIN';
    SELECT id INTO iron_id FROM hmis_lab_test_master WHERE test_code = 'IRON';
    SELECT id INTO ldh_id FROM hmis_lab_test_master WHERE test_code = 'LDH';
    SELECT id INTO lactate_id FROM hmis_lab_test_master WHERE test_code = 'LACTATE';
    SELECT id INTO ammonia_id FROM hmis_lab_test_master WHERE test_code = 'AMMONIA';
    SELECT id INTO urine_rm_id FROM hmis_lab_test_master WHERE test_code = 'URINE_RM';
    SELECT id INTO abg_id FROM hmis_lab_test_master WHERE test_code = 'ABG';
    SELECT id INTO psa_id FROM hmis_lab_test_master WHERE test_code = 'PSA';

    -- PT/INR
    IF pt_inr_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, sort_order) VALUES
    (pt_inr_id, 'PT', 'Prothrombin Time', 'sec', 11, 14, NULL, 30, 1),
    (pt_inr_id, 'INR', 'INR', NULL, 0.8, 1.2, NULL, 5, 2),
    (pt_inr_id, 'PT_CTRL', 'Control PT', 'sec', 11, 14, NULL, NULL, 3)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- aPTT
    IF aptt_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_high, sort_order) VALUES
    (aptt_id, 'APTT', 'aPTT', 'sec', 25, 35, 120, 1),
    (aptt_id, 'APTT_CTRL', 'Control aPTT', 'sec', 25, 35, NULL, 2)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- D-Dimer
    IF ddimer_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_high, sort_order) VALUES
    (ddimer_id, 'DDIMER', 'D-Dimer', 'ng/mL FEU', 0, 500, 5000, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- CRP
    IF crp_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_high, sort_order) VALUES
    (crp_id, 'CRP', 'C-Reactive Protein', 'mg/L', 0, 5, 200, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Troponin I
    IF trop_i_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_high, sort_order) VALUES
    (trop_i_id, 'TROP_I', 'Troponin I (hs)', 'ng/L', 0, 14, 100, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- PPBS / RBS
    IF ppbs_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, sort_order) VALUES
    (ppbs_id, 'PPBS', 'Post Prandial Blood Sugar', 'mg/dL', 70, 140, 40, 500, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;
    IF rbs_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, sort_order) VALUES
    (rbs_id, 'RBS', 'Random Blood Sugar', 'mg/dL', 70, 140, 40, 500, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- FT3 / FT4
    IF ft3_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, sort_order) VALUES
    (ft3_id, 'FT3', 'Free T3', 'pg/mL', 2.0, 4.4, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;
    IF ft4_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, sort_order) VALUES
    (ft4_id, 'FT4', 'Free T4', 'ng/dL', 0.8, 1.8, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Vitamin D
    IF vit_d_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, sort_order) VALUES
    (vit_d_id, 'VIT_D', '25-Hydroxy Vitamin D', 'ng/mL', 30, 100, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Vitamin B12
    IF vit_b12_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, sort_order) VALUES
    (vit_b12_id, 'VIT_B12', 'Vitamin B12', 'pg/mL', 200, 900, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Ferritin / Iron
    IF ferritin_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, sort_order) VALUES
    (ferritin_id, 'FERRITIN', 'Serum Ferritin', 'ng/mL', 20, 200, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;
    IF iron_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, sort_order) VALUES
    (iron_id, 'IRON', 'Serum Iron', 'mcg/dL', 60, 170, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- LDH / Lactate / Ammonia
    IF ldh_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, sort_order) VALUES
    (ldh_id, 'LDH', 'LDH', 'U/L', 120, 246, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;
    IF lactate_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_high, sort_order) VALUES
    (lactate_id, 'LACTATE', 'Blood Lactate', 'mmol/L', 0.5, 2.0, 4.0, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;
    IF ammonia_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_high, sort_order) VALUES
    (ammonia_id, 'AMMONIA', 'Blood Ammonia', 'mcg/dL', 15, 45, 200, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Urine R/M
    IF urine_rm_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, data_type, ref_range_text, sort_order) VALUES
    (urine_rm_id, 'COLOR', 'Color', NULL, 'text', 'Pale Yellow', 1),
    (urine_rm_id, 'APPEAR', 'Appearance', NULL, 'text', 'Clear', 2),
    (urine_rm_id, 'SPG', 'Specific Gravity', NULL, 'numeric', '1.005–1.030', 3),
    (urine_rm_id, 'PH_U', 'pH', NULL, 'numeric', '5.0–8.0', 4),
    (urine_rm_id, 'PROTEIN_U', 'Protein', NULL, 'option', 'Nil', 5),
    (urine_rm_id, 'GLUCOSE_U', 'Glucose', NULL, 'option', 'Nil', 6),
    (urine_rm_id, 'KETONE', 'Ketone', NULL, 'option', 'Nil', 7),
    (urine_rm_id, 'BLOOD_U', 'Blood', NULL, 'option', 'Nil', 8),
    (urine_rm_id, 'BILIRUBIN_U', 'Bilirubin', NULL, 'option', 'Nil', 9),
    (urine_rm_id, 'NITRITE', 'Nitrite', NULL, 'option', 'Negative', 10),
    (urine_rm_id, 'WBC_U', 'WBC (pus cells)', '/HPF', 'text', '0–5', 11),
    (urine_rm_id, 'RBC_U', 'RBC', '/HPF', 'text', '0–2', 12),
    (urine_rm_id, 'EPI_U', 'Epithelial cells', '/HPF', 'text', 'Few', 13),
    (urine_rm_id, 'CAST_U', 'Casts', '/LPF', 'text', 'Nil', 14),
    (urine_rm_id, 'CRYSTAL_U', 'Crystals', NULL, 'text', 'Nil', 15),
    (urine_rm_id, 'BACTERIA_U', 'Bacteria', NULL, 'text', 'Nil', 16)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- ABG
    IF abg_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_low, critical_high, sort_order) VALUES
    (abg_id, 'PH_ABG', 'pH', NULL, 7.35, 7.45, 7.10, 7.60, 1),
    (abg_id, 'PCO2', 'pCO2', 'mmHg', 35, 45, 15, 70, 2),
    (abg_id, 'PO2', 'pO2', 'mmHg', 80, 100, 40, NULL, 3),
    (abg_id, 'HCO3', 'HCO3', 'mEq/L', 22, 26, 10, 40, 4),
    (abg_id, 'BE', 'Base Excess', 'mEq/L', -2, 2, -10, 10, 5),
    (abg_id, 'SAO2', 'SaO2', '%', 95, 100, 80, NULL, 6),
    (abg_id, 'FIO2_ABG', 'FiO2', '%', NULL, NULL, NULL, NULL, 7),
    (abg_id, 'PF_RATIO', 'P/F Ratio', NULL, 400, 500, 100, NULL, 8)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- PSA
    IF psa_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, critical_high, sort_order) VALUES
    (psa_id, 'PSA_T', 'PSA (Total)', 'ng/mL', 0, 4.0, 20, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    RAISE NOTICE 'Session 2 seed complete — 60+ new tests, parameters, organisms, antibiotics, QC rules';
END $$;
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
INSERT INTO hmis_lab_test_master (test_code, test_name, category, sample_type, tat_hours) VALUES
('HISTO_BX', 'Histopathology - Biopsy', 'Histopathology', 'tissue', 72),
('HISTO_RESEC', 'Histopathology - Resection Specimen', 'Histopathology', 'tissue', 120),
('HISTO_FROZEN', 'Frozen Section', 'Histopathology', 'tissue', 1),
('FNAC', 'Fine Needle Aspiration Cytology', 'Cytology', 'aspirate', 24),
('PAP_SMEAR', 'PAP Smear', 'Cytology', 'smear', 48),
('FLUID_CYTO', 'Body Fluid Cytology', 'Cytology', 'fluid', 24),
('IHC', 'Immunohistochemistry', 'Histopathology', 'tissue', 120),
('SPECIAL_STAIN', 'Special Stains', 'Histopathology', 'tissue', 48)
ON CONFLICT (test_code) DO NOTHING;

-- ============================================================
-- PART 5: RLS
-- ============================================================
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_lab_histo_cases','hmis_lab_cyto_cases','hmis_lab_audit_log',
        'hmis_lab_documents','hmis_lab_ncr','hmis_lab_reflex_rules'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- PART 6: SEED REFLEX RULES
-- ============================================================
DO $$
DECLARE
    tsh_test_id uuid; tsh_param_id uuid;
    ft3_test_id uuid; ft4_test_id uuid;
    fbs_test_id uuid; fbs_param_id uuid;
    hba1c_test_id uuid;
    creat_test_id uuid; creat_param_id uuid;
    cbc_test_id uuid; hb_param_id uuid;
    retic_test_id uuid;
    pt_test_id uuid; inr_param_id uuid;
    ddimer_test_id uuid;
BEGIN
    SELECT id INTO tsh_test_id FROM hmis_lab_test_master WHERE test_code = 'TSH';
    SELECT id INTO tsh_param_id FROM hmis_lab_test_parameters WHERE test_id = tsh_test_id AND parameter_code = 'TSH' LIMIT 1;
    SELECT id INTO ft3_test_id FROM hmis_lab_test_master WHERE test_code = 'FT3';
    SELECT id INTO ft4_test_id FROM hmis_lab_test_master WHERE test_code = 'FT4';
    SELECT id INTO fbs_test_id FROM hmis_lab_test_master WHERE test_code = 'FBS';
    SELECT id INTO fbs_param_id FROM hmis_lab_test_parameters WHERE test_id = fbs_test_id AND parameter_code = 'FBS' LIMIT 1;
    SELECT id INTO hba1c_test_id FROM hmis_lab_test_master WHERE test_code = 'HBA1C';
    SELECT id INTO creat_test_id FROM hmis_lab_test_master WHERE test_code = 'RFT';
    SELECT id INTO creat_param_id FROM hmis_lab_test_parameters WHERE test_id = creat_test_id AND parameter_code = 'CREAT' LIMIT 1;
    SELECT id INTO cbc_test_id FROM hmis_lab_test_master WHERE test_code = 'CBC';
    SELECT id INTO hb_param_id FROM hmis_lab_test_parameters WHERE test_id = cbc_test_id AND parameter_code = 'HB' LIMIT 1;
    SELECT id INTO retic_test_id FROM hmis_lab_test_master WHERE test_code = 'RETIC';
    SELECT id INTO pt_test_id FROM hmis_lab_test_master WHERE test_code = 'PT_INR';
    SELECT id INTO inr_param_id FROM hmis_lab_test_parameters WHERE test_id = pt_test_id AND parameter_code = 'INR' LIMIT 1;
    SELECT id INTO ddimer_test_id FROM hmis_lab_test_master WHERE test_code = 'DDIMER';

    -- TSH abnormal → auto-order FT3 + FT4
    IF tsh_test_id IS NOT NULL AND ft4_test_id IS NOT NULL THEN
    INSERT INTO hmis_lab_reflex_rules (rule_name, trigger_test_id, trigger_parameter_id, trigger_condition, trigger_value_1, reflex_test_id, reflex_priority, description) VALUES
    ('TSH High → FT4', tsh_test_id, tsh_param_id, 'gt', 4.0, ft4_test_id, 'routine', 'Auto-order FT4 when TSH > 4.0 mIU/L'),
    ('TSH Low → FT3 + FT4', tsh_test_id, tsh_param_id, 'lt', 0.4, ft3_test_id, 'routine', 'Auto-order FT3 when TSH < 0.4 mIU/L'),
    ('TSH Low → FT4', tsh_test_id, tsh_param_id, 'lt', 0.4, ft4_test_id, 'routine', 'Auto-order FT4 when TSH < 0.4 mIU/L')
    ON CONFLICT DO NOTHING;
    END IF;

    -- FBS > 126 → auto-order HbA1c
    IF fbs_test_id IS NOT NULL AND hba1c_test_id IS NOT NULL THEN
    INSERT INTO hmis_lab_reflex_rules (rule_name, trigger_test_id, trigger_parameter_id, trigger_condition, trigger_value_1, reflex_test_id, reflex_priority, description) VALUES
    ('FBS High → HbA1c', fbs_test_id, fbs_param_id, 'gt', 126, hba1c_test_id, 'routine', 'Auto-order HbA1c when FBS > 126 mg/dL')
    ON CONFLICT DO NOTHING;
    END IF;

    -- Low Hb → Reticulocyte count
    IF cbc_test_id IS NOT NULL AND retic_test_id IS NOT NULL THEN
    INSERT INTO hmis_lab_reflex_rules (rule_name, trigger_test_id, trigger_parameter_id, trigger_condition, trigger_value_1, reflex_test_id, reflex_priority, description) VALUES
    ('Low Hb → Retic', cbc_test_id, hb_param_id, 'lt', 8.0, retic_test_id, 'routine', 'Auto-order Reticulocyte count when Hb < 8.0 g/dL')
    ON CONFLICT DO NOTHING;
    END IF;

    -- INR > 3 → D-Dimer
    IF pt_test_id IS NOT NULL AND ddimer_test_id IS NOT NULL THEN
    INSERT INTO hmis_lab_reflex_rules (rule_name, trigger_test_id, trigger_parameter_id, trigger_condition, trigger_value_1, reflex_test_id, reflex_priority, requires_approval, description) VALUES
    ('INR High → D-Dimer', pt_test_id, inr_param_id, 'gt', 3.0, ddimer_test_id, 'urgent', true, 'Suggest D-Dimer when INR > 3.0 (requires approval)')
    ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'Session 3 seed complete — histo tests, reflex rules';
END $$;

-- Seed some common special stains and IHC markers as comments for reference
COMMENT ON TABLE hmis_lab_histo_cases IS 'Common Special Stains: PAS, PAS-D, Masson Trichrome, Reticulin, Congo Red, ZN, GMS, Mucicarmine, Iron (Perl), Alcian Blue
Common IHC Markers: CK (Pan), CK7, CK20, EMA, Vimentin, S100, HMB45, Desmin, SMA, CD3, CD20, CD30, CD34, CD45, CD68, Ki67, ER, PR, HER2, p53, p63, TTF1, PSA, Chromogranin, Synaptophysin, GATA3, PAX8, WT1, Calretinin, D2-40';

-- ══════════════════════════════════════════════
-- PART 1 COMPLETE. Now run FRESH_PART2.sql
-- ══════════════════════════════════════════════
