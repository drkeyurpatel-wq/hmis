-- HEALTH1 HMIS — FULL REBUILD — Sun Mar 22 06:52:06 UTC 2026
-- Drops all hmis_* tables then recreates 223 tables

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'hmis_%' ORDER BY tablename) LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;


-- ═══ sql/h1_hmis_migration.sql ═══
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

-- ═══ sql/emr_v3_migration.sql ═══
-- ============================================================
-- Health1 HMIS — EMR v3 Encounter Storage
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- Full EMR encounter: stores structured clinical data as JSONB
-- alongside normalized FKs for querying/analytics
CREATE TABLE IF NOT EXISTS hmis_emr_encounters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    opd_visit_id uuid REFERENCES hmis_opd_visits(id),

    -- Encounter metadata
    encounter_date date NOT NULL DEFAULT CURRENT_DATE,
    encounter_type varchar(10) NOT NULL DEFAULT 'opd' CHECK (encounter_type IN ('opd', 'ipd', 'emergency', 'followup')),
    status varchar(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'signed', 'amended')),

    -- Structured clinical data (JSONB for flexibility + speed)
    vitals jsonb DEFAULT '{}',
    -- { systolic, diastolic, heartRate, spo2, temperature, weight, height, respiratoryRate, bmi, news2Score, news2Risk }

    complaints jsonb DEFAULT '[]',
    -- [{ complaint, duration, hpiNotes, selectedChips }]

    exam_findings jsonb DEFAULT '[]',
    -- [{ system, findings, notes }]

    diagnoses jsonb DEFAULT '[]',
    -- [{ code, label, type }]

    investigations jsonb DEFAULT '[]',
    -- [{ name, urgency, result, isAbnormal }]

    prescriptions jsonb DEFAULT '[]',
    -- [{ id, generic, brand, strength, form, dose, frequency, duration, route, instructions }]

    advice jsonb DEFAULT '[]',
    -- ["string1", "string2"]

    follow_up jsonb DEFAULT '{}',
    -- { date, notes }

    referral jsonb DEFAULT null,
    -- { department, doctor, reason, urgency }

    -- Denormalized for quick list queries
    primary_diagnosis_code varchar(10),
    primary_diagnosis_label varchar(200),
    prescription_count int DEFAULT 0,
    investigation_count int DEFAULT 0,

    -- Audit
    signed_at timestamptz,
    signed_by uuid REFERENCES hmis_staff(id),
    amended_at timestamptz,
    amended_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_emr_encounters_patient ON hmis_emr_encounters(patient_id, encounter_date DESC);
CREATE INDEX IF NOT EXISTS idx_emr_encounters_doctor ON hmis_emr_encounters(doctor_id, encounter_date DESC);
CREATE INDEX IF NOT EXISTS idx_emr_encounters_centre ON hmis_emr_encounters(centre_id, encounter_date DESC);
CREATE INDEX IF NOT EXISTS idx_emr_encounters_status ON hmis_emr_encounters(status);
CREATE INDEX IF NOT EXISTS idx_emr_encounters_dx ON hmis_emr_encounters(primary_diagnosis_code);

-- GIN index for JSONB queries (e.g., find all encounters with a specific diagnosis)
CREATE INDEX IF NOT EXISTS idx_emr_encounters_diagnoses ON hmis_emr_encounters USING gin(diagnoses);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_emr_encounter_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    -- Auto-denormalize
    IF NEW.diagnoses IS NOT NULL AND jsonb_array_length(NEW.diagnoses) > 0 THEN
        NEW.primary_diagnosis_code = NEW.diagnoses->0->>'code';
        NEW.primary_diagnosis_label = NEW.diagnoses->0->>'label';
    END IF;
    NEW.prescription_count = COALESCE(jsonb_array_length(NEW.prescriptions), 0);
    NEW.investigation_count = COALESCE(jsonb_array_length(NEW.investigations), 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_emr_encounter_update
    BEFORE UPDATE ON hmis_emr_encounters
    FOR EACH ROW
    EXECUTE FUNCTION update_emr_encounter_timestamp();

-- Also run on insert
CREATE TRIGGER trg_emr_encounter_insert
    BEFORE INSERT ON hmis_emr_encounters
    FOR EACH ROW
    EXECUTE FUNCTION update_emr_encounter_timestamp();

-- RLS Policies
ALTER TABLE hmis_emr_encounters ENABLE ROW LEVEL SECURITY;

-- Doctors can read/write encounters they created
CREATE POLICY emr_encounters_doctor_all ON hmis_emr_encounters
    FOR ALL USING (
        doctor_id IN (
            SELECT id FROM hmis_staff WHERE auth_user_id = auth.uid()
        )
    );

-- Staff at same centre can read
CREATE POLICY emr_encounters_centre_read ON hmis_emr_encounters
    FOR SELECT USING (
        centre_id IN (
            SELECT sc.centre_id FROM hmis_staff_centres sc
            JOIN hmis_staff s ON s.id = sc.staff_id
            WHERE s.auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- Saved prescription templates (per doctor)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_emr_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid REFERENCES hmis_centres(id),
    name varchar(100) NOT NULL,
    template_type varchar(20) NOT NULL DEFAULT 'prescription' CHECK (template_type IN ('prescription', 'encounter', 'investigation')),
    data jsonb NOT NULL DEFAULT '{}',
    -- For prescription: { meds: [...], labs: [...], advice: [...] }
    is_shared boolean NOT NULL DEFAULT false,
    usage_count int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emr_templates_doctor ON hmis_emr_templates(doctor_id);

ALTER TABLE hmis_emr_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY emr_templates_own ON hmis_emr_templates
    FOR ALL USING (
        doctor_id IN (
            SELECT id FROM hmis_staff WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY emr_templates_shared_read ON hmis_emr_templates
    FOR SELECT USING (is_shared = true);

-- ═══ sql/revenue_loop_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Revenue Loop Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- Adds: pharmacy stock, dispensing, tariff seed, token sequence
-- ============================================================

-- Pharmacy stock (batch-level inventory)
CREATE TABLE IF NOT EXISTS hmis_pharmacy_stock (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    batch_number varchar(30) NOT NULL,
    expiry_date date NOT NULL,
    purchase_rate decimal(10,2) NOT NULL,
    mrp decimal(10,2) NOT NULL,
    quantity_received int NOT NULL,
    quantity_available int NOT NULL DEFAULT 0,
    quantity_dispensed int NOT NULL DEFAULT 0,
    supplier varchar(100),
    received_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharm_stock_centre ON hmis_pharmacy_stock(centre_id, drug_id);
CREATE INDEX IF NOT EXISTS idx_pharm_stock_expiry ON hmis_pharmacy_stock(expiry_date);

-- Pharmacy dispensing (Rx fulfillment)
CREATE TABLE IF NOT EXISTS hmis_pharmacy_dispensing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_id uuid REFERENCES hmis_emr_encounters(id),
    prescription_data jsonb NOT NULL DEFAULT '[]',
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','dispensed','partially_dispensed','cancelled','returned')),
    dispensed_items jsonb DEFAULT '[]',
    total_amount decimal(10,2) DEFAULT 0,
    bill_id uuid REFERENCES hmis_bills(id),
    dispensed_by uuid REFERENCES hmis_staff(id),
    dispensed_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharm_disp_centre ON hmis_pharmacy_dispensing(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_pharm_disp_patient ON hmis_pharmacy_dispensing(patient_id);
CREATE INDEX IF NOT EXISTS idx_pharm_disp_encounter ON hmis_pharmacy_dispensing(encounter_id);

-- RLS
ALTER TABLE hmis_pharmacy_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_pharmacy_dispensing ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharm_stock_centre ON hmis_pharmacy_stock FOR ALL USING (
    centre_id IN (SELECT sc.centre_id FROM hmis_staff_centres sc JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid())
);
CREATE POLICY pharm_disp_centre ON hmis_pharmacy_dispensing FOR ALL USING (
    centre_id IN (SELECT sc.centre_id FROM hmis_staff_centres sc JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid())
);

-- Token sequence helper
CREATE OR REPLACE FUNCTION hmis_next_token(p_centre_id uuid, p_doctor_id uuid)
RETURNS int AS $$
DECLARE
    next_token int;
BEGIN
    SELECT COALESCE(MAX(token_number), 0) + 1 INTO next_token
    FROM hmis_opd_visits
    WHERE centre_id = p_centre_id
    AND doctor_id = p_doctor_id
    AND created_at::date = CURRENT_DATE;
    RETURN next_token;
END;
$$ LANGUAGE plpgsql;

-- Visit number sequence
CREATE OR REPLACE FUNCTION hmis_next_visit_number(p_centre_id uuid)
RETURNS text AS $$
DECLARE
    centre_code text;
    seq_val int;
BEGIN
    SELECT code INTO centre_code FROM hmis_centres WHERE id = p_centre_id;
    SELECT COALESCE(MAX(CAST(SUBSTRING(visit_number FROM '[0-9]+$') AS int)), 0) + 1 INTO seq_val
    FROM hmis_opd_visits WHERE centre_id = p_centre_id AND created_at::date = CURRENT_DATE;
    RETURN 'V-' || COALESCE(centre_code, 'H1') || '-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || LPAD(seq_val::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Bill number sequence
CREATE OR REPLACE FUNCTION hmis_next_bill_number(p_centre_id uuid, p_type text)
RETURNS text AS $$
DECLARE
    centre_code text;
    seq_val int;
    prefix text;
BEGIN
    SELECT code INTO centre_code FROM hmis_centres WHERE id = p_centre_id;
    prefix := CASE p_type WHEN 'opd' THEN 'OPD' WHEN 'pharmacy' THEN 'PH' WHEN 'lab' THEN 'LB' ELSE 'BL' END;
    SELECT COALESCE(MAX(CAST(SUBSTRING(bill_number FROM '[0-9]+$') AS int)), 0) + 1 INTO seq_val
    FROM hmis_bills WHERE centre_id = p_centre_id AND bill_type = p_type AND bill_date = CURRENT_DATE;
    RETURN prefix || '-' || COALESCE(centre_code, 'H1') || '-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || LPAD(seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Receipt number sequence
CREATE OR REPLACE FUNCTION hmis_next_receipt_number(p_centre_id uuid)
RETURNS text AS $$
DECLARE
    centre_code text;
    seq_val int;
BEGIN
    SELECT code INTO centre_code FROM hmis_centres WHERE id = p_centre_id;
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS int)), 0) + 1 INTO seq_val
    FROM hmis_payments WHERE created_at::date = CURRENT_DATE;
    RETURN 'RCP-' || COALESCE(centre_code, 'H1') || '-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || LPAD(seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED: Common OPD tariff items (Shilaj centre)
-- Update centre_id to match your actual Shilaj centre UUID
-- ============================================================

-- ═══ sql/billing_enhancement.sql ═══
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

-- ═══ sql/pharmacy_enhancement.sql ═══
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

-- ═══ sql/ipd_clinical_migration.sql ═══
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

-- ═══ sql/lims_migration.sql ═══
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

-- Lab profiles

-- ═══ sql/lims_session2_migration.sql ═══
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

-- Common Organisms

-- Common Antibiotics

-- Default antibiotic panels




-- ============================================================
-- PART 5: EXPANDED TEST MASTER (50+ tests)
-- ============================================================

-- Add parameters for key new tests

-- ═══ sql/lims_session3_migration.sql ═══
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

-- Seed some common special stains and IHC markers as comments for reference
COMMENT ON TABLE hmis_lab_histo_cases IS 'Common Special Stains: PAS, PAS-D, Masson Trichrome, Reticulin, Congo Red, ZN, GMS, Mucicarmine, Iron (Perl), Alcian Blue
Common IHC Markers: CK (Pan), CK7, CK20, EMA, Vimentin, S100, HMB45, Desmin, SMA, CD3, CD20, CD30, CD34, CD45, CD68, Ki67, ER, PR, HER2, p53, p63, TTF1, PSA, Chromogranin, Synaptophysin, GATA3, PAX8, WT1, Calretinin, D2-40';

-- ═══ sql/ot_enhancement.sql ═══
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
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_ot_safety_checklist','hmis_ot_implants','hmis_ot_anaesthesia'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ot_checklist_booking ON hmis_ot_safety_checklist(ot_booking_id);
CREATE INDEX IF NOT EXISTS idx_ot_implants_booking ON hmis_ot_implants(ot_booking_id);
CREATE INDEX IF NOT EXISTS idx_ot_anaesthesia_booking ON hmis_ot_anaesthesia(ot_booking_id);
CREATE INDEX IF NOT EXISTS idx_ot_bookings_date ON hmis_ot_bookings(scheduled_date, status);

-- ═══ sql/radiology_enhancement.sql ═══
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
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_radiology_rooms','hmis_radiology_templates','hmis_pacs_config'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Common radiology report templates
-- ============================================================

-- SEED: Radiology test master (if empty)

-- ═══ sql/radiology_v2_migration.sql ═══
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
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
      'hmis_imaging_studies','hmis_imaging_reports','hmis_stradus_sync_log',
      'hmis_critical_findings','hmis_radiology_protocols','hmis_imaging_followups'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Radiology protocols
-- ============================================================

-- ═══ sql/appointments_patient_v2_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Appointments + Patient Registration v2
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Doctor Schedule / Slots


-- 2. Appointments


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
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_doctor_schedules','hmis_appointments','hmis_patient_emergency_contacts','hmis_patient_documents','hmis_patient_insurance'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

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

-- ═══ sql/blood_bank_migration.sql ═══
-- ============================================================
-- Health1 LIMS — Blood Bank / Blood Storage Unit Module
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Blood Donors
CREATE TABLE IF NOT EXISTS hmis_bb_donors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_number varchar(20) NOT NULL UNIQUE,
    donor_type varchar(15) NOT NULL CHECK (donor_type IN ('voluntary','replacement','autologous','directed')),
    -- Demographics
    first_name varchar(50) NOT NULL,
    last_name varchar(50),
    gender varchar(10) NOT NULL CHECK (gender IN ('male','female','other')),
    date_of_birth date NOT NULL,
    blood_group varchar(5) NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    phone varchar(15),
    address text,
    id_type varchar(20),
    id_number varchar(30),
    -- Medical screening
    weight_kg decimal(5,1),
    hb_level decimal(4,1),
    bp_systolic int,
    bp_diastolic int,
    pulse int,
    temperature decimal(4,1),
    -- Deferral
    is_deferred boolean NOT NULL DEFAULT false,
    deferral_reason text,
    deferral_type varchar(10) CHECK (deferral_type IN ('temporary','permanent')),
    deferral_until date,
    -- Status
    total_donations int NOT NULL DEFAULT 0,
    last_donation_date date,
    is_active boolean NOT NULL DEFAULT true,
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bb_donors_group ON hmis_bb_donors(blood_group);

CREATE SEQUENCE IF NOT EXISTS hmis_bb_donor_seq START 1;
CREATE OR REPLACE FUNCTION hmis_next_donor_number() RETURNS varchar AS $$
BEGIN RETURN 'H1-D-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('hmis_bb_donor_seq')::text, 4, '0'); END;
$$ LANGUAGE plpgsql;

-- 2. Blood Donations (collections)
CREATE TABLE IF NOT EXISTS hmis_bb_donations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_number varchar(20) NOT NULL UNIQUE,
    donor_id uuid NOT NULL REFERENCES hmis_bb_donors(id),
    donation_date timestamptz NOT NULL DEFAULT now(),
    donation_type varchar(15) NOT NULL DEFAULT 'whole_blood' CHECK (donation_type IN ('whole_blood','apheresis_platelet','apheresis_plasma','apheresis_rbc')),
    bag_number varchar(30) NOT NULL,
    volume_ml int NOT NULL DEFAULT 450,
    -- TTI (Transfusion Transmitted Infections) screening
    tti_status varchar(15) NOT NULL DEFAULT 'pending' CHECK (tti_status IN ('pending','reactive','non_reactive','indeterminate')),
    hbsag_result varchar(10) CHECK (hbsag_result IN ('reactive','non_reactive','pending')),
    hcv_result varchar(10) CHECK (hcv_result IN ('reactive','non_reactive','pending')),
    hiv_result varchar(10) CHECK (hiv_result IN ('reactive','non_reactive','pending')),
    vdrl_result varchar(10) CHECK (vdrl_result IN ('reactive','non_reactive','pending')),
    malaria_result varchar(10) CHECK (malaria_result IN ('reactive','non_reactive','pending')),
    -- Blood grouping
    abo_group varchar(3) NOT NULL CHECK (abo_group IN ('A','B','AB','O')),
    rh_type varchar(8) NOT NULL CHECK (rh_type IN ('positive','negative')),
    abo_confirmed boolean NOT NULL DEFAULT false,
    antibody_screen varchar(15) DEFAULT 'pending' CHECK (antibody_screen IN ('positive','negative','pending','not_done')),
    -- Status
    status varchar(15) NOT NULL DEFAULT 'collected' CHECK (status IN ('collected','testing','available','separated','issued','discarded','quarantine','expired')),
    discard_reason text,
    collected_by uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bb_donations_status ON hmis_bb_donations(status);

CREATE SEQUENCE IF NOT EXISTS hmis_bb_donation_seq START 1;
CREATE OR REPLACE FUNCTION hmis_next_donation_number() RETURNS varchar AS $$
BEGIN RETURN 'H1-BLD-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('hmis_bb_donation_seq')::text, 4, '0'); END;
$$ LANGUAGE plpgsql;

-- 3. Blood Components (separated from whole blood)
CREATE TABLE IF NOT EXISTS hmis_bb_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_number varchar(30) NOT NULL UNIQUE,
    donation_id uuid NOT NULL REFERENCES hmis_bb_donations(id),
    component_type varchar(30) NOT NULL CHECK (component_type IN (
        'whole_blood','prbc','ffp','platelet_concentrate','cryoprecipitate',
        'cryo_poor_plasma','sdp','granulocyte','washed_rbc','leukoreduced_rbc',
        'irradiated_rbc','packed_platelets'
    )),
    blood_group varchar(5) NOT NULL,
    volume_ml int,
    -- Storage
    storage_location varchar(50),
    storage_temp varchar(20),
    prepared_date date NOT NULL DEFAULT CURRENT_DATE,
    expiry_date date NOT NULL,
    -- Status
    status varchar(15) NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','crossmatched','issued','transfused','discarded','expired','quarantine')),
    reserved_for_patient uuid REFERENCES hmis_patients(id),
    -- Quality
    segment_attached boolean NOT NULL DEFAULT true,
    visual_inspection varchar(10) DEFAULT 'normal' CHECK (visual_inspection IN ('normal','abnormal','hemolyzed','clots','discolored')),
    -- Tracking
    prepared_by uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bb_components_status ON hmis_bb_components(status, component_type, blood_group);
CREATE INDEX IF NOT EXISTS idx_bb_components_expiry ON hmis_bb_components(expiry_date);

-- 4. Cross-match / Compatibility Testing
CREATE TABLE IF NOT EXISTS hmis_bb_crossmatch (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    component_id uuid NOT NULL REFERENCES hmis_bb_components(id),
    -- Patient blood group
    patient_abo varchar(3) NOT NULL,
    patient_rh varchar(8) NOT NULL,
    -- Testing
    immediate_spin varchar(10) CHECK (immediate_spin IN ('compatible','incompatible','pending')),
    incubation_37c varchar(10) CHECK (incubation_37c IN ('compatible','incompatible','pending')),
    ict_agt varchar(10) CHECK (ict_agt IN ('compatible','incompatible','pending')),
    -- Final result
    result varchar(15) NOT NULL DEFAULT 'pending' CHECK (result IN ('compatible','incompatible','pending','cancelled')),
    -- Metadata
    requested_by uuid NOT NULL REFERENCES hmis_staff(id),
    performed_by uuid REFERENCES hmis_staff(id),
    requested_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    valid_until timestamptz,
    clinical_indication text,
    urgency varchar(10) DEFAULT 'routine' CHECK (urgency IN ('routine','urgent','emergency')),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bb_xmatch_patient ON hmis_bb_crossmatch(patient_id);

-- 5. Blood Issue / Transfusion
CREATE TABLE IF NOT EXISTS hmis_bb_transfusions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    component_id uuid NOT NULL REFERENCES hmis_bb_components(id),
    crossmatch_id uuid REFERENCES hmis_bb_crossmatch(id),
    -- Issue details
    issued_at timestamptz NOT NULL DEFAULT now(),
    issued_by uuid NOT NULL REFERENCES hmis_staff(id),
    -- Transfusion details
    transfusion_start timestamptz,
    transfusion_end timestamptz,
    administered_by uuid REFERENCES hmis_staff(id),
    volume_transfused_ml int,
    -- Pre-transfusion vitals
    pre_temp decimal(4,1),
    pre_pulse int,
    pre_bp_sys int,
    pre_bp_dia int,
    -- Post-transfusion vitals
    post_temp decimal(4,1),
    post_pulse int,
    post_bp_sys int,
    post_bp_dia int,
    -- Outcome
    status varchar(15) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','in_progress','completed','stopped','returned')),
    stop_reason text,
    -- Reaction
    has_reaction boolean NOT NULL DEFAULT false,
    reaction_id uuid,
    notes text,
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Transfusion Reactions
CREATE TABLE IF NOT EXISTS hmis_bb_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transfusion_id uuid NOT NULL REFERENCES hmis_bb_transfusions(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    reaction_type varchar(30) NOT NULL CHECK (reaction_type IN (
        'febrile','allergic_mild','allergic_severe','anaphylaxis',
        'hemolytic_acute','hemolytic_delayed','taco','trali',
        'bacterial_contamination','hypotensive','other'
    )),
    severity varchar(10) NOT NULL CHECK (severity IN ('mild','moderate','severe','life_threatening','fatal')),
    onset_time timestamptz NOT NULL DEFAULT now(),
    symptoms text NOT NULL,
    vitals_at_reaction text,
    actions_taken text,
    outcome varchar(20) CHECK (outcome IN ('resolved','ongoing','transferred_icu','death')),
    reported_by uuid NOT NULL REFERENCES hmis_staff(id),
    investigated_by uuid REFERENCES hmis_staff(id),
    investigation_findings text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Blood Requests (from wards/OT)
CREATE TABLE IF NOT EXISTS hmis_bb_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    requested_by uuid NOT NULL REFERENCES hmis_staff(id),
    blood_group varchar(5) NOT NULL,
    component_type varchar(30) NOT NULL,
    units_requested int NOT NULL DEFAULT 1,
    units_issued int NOT NULL DEFAULT 0,
    urgency varchar(10) NOT NULL DEFAULT 'routine',
    clinical_indication text,
    diagnosis text,
    hb_level decimal(4,1),
    platelet_count int,
    inr decimal(4,1),
    status varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','crossmatching','ready','issued','completed','cancelled')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_bb_donors','hmis_bb_donations','hmis_bb_components',
        'hmis_bb_crossmatch','hmis_bb_transfusions','hmis_bb_reactions',
        'hmis_bb_requests'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- COMPONENT EXPIRY DEFAULTS (days from preparation)
-- ============================================================
COMMENT ON TABLE hmis_bb_components IS 'Component expiry defaults:
- Whole Blood: 35 days at 2-6°C
- PRBC: 42 days at 2-6°C (CPDA-1)
- FFP: 1 year at -30°C
- Platelet Concentrate: 5 days at 20-24°C with agitation
- Cryoprecipitate: 1 year at -30°C
- SDP (Apheresis Platelets): 5 days at 20-24°C
- Washed RBC: 24 hours at 2-6°C
- Leukoreduced RBC: 42 days at 2-6°C
- Irradiated RBC: 28 days at 2-6°C';

-- ═══ sql/homecare_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Homecare Module
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Homecare Enrollments (patients enrolled in homecare program)
CREATE TABLE IF NOT EXISTS hmis_hc_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    enrollment_number varchar(20) NOT NULL UNIQUE,
    program_type varchar(20) NOT NULL CHECK (program_type IN ('post_discharge','chronic_care','palliative','wound_care','iv_therapy','physiotherapy','dialysis','ventilator','general')),
    primary_diagnosis text,
    -- Care team
    primary_nurse_id uuid REFERENCES hmis_staff(id),
    primary_doctor_id uuid REFERENCES hmis_staff(id),
    -- Address
    address_line1 text NOT NULL,
    address_line2 text,
    city varchar(50) DEFAULT 'Ahmedabad',
    pincode varchar(10),
    latitude decimal(10,7),
    longitude decimal(10,7),
    landmark text,
    -- Contact
    primary_contact_name varchar(100),
    primary_contact_phone varchar(15) NOT NULL,
    secondary_contact_phone varchar(15),
    -- Care plan
    visit_frequency varchar(20) DEFAULT 'daily' CHECK (visit_frequency IN ('twice_daily','daily','alternate_day','twice_weekly','weekly','biweekly','monthly','as_needed')),
    estimated_duration_weeks int DEFAULT 4,
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    special_instructions text,
    -- Status
    status varchar(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','discharged','cancelled')),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hc_enroll_patient ON hmis_hc_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_hc_enroll_status ON hmis_hc_enrollments(status, centre_id);

CREATE SEQUENCE IF NOT EXISTS hmis_hc_enroll_seq START 1;
CREATE OR REPLACE FUNCTION hmis_next_hc_number() RETURNS varchar AS $$
BEGIN RETURN 'H1-HC-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('hmis_hc_enroll_seq')::text, 4, '0'); END;
$$ LANGUAGE plpgsql;

-- 2. Home Visits
CREATE TABLE IF NOT EXISTS hmis_hc_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    visit_number int NOT NULL DEFAULT 1,
    scheduled_date date NOT NULL,
    scheduled_time time,
    -- Nurse assignment
    assigned_nurse_id uuid NOT NULL REFERENCES hmis_staff(id),
    -- Check-in/out
    checkin_time timestamptz,
    checkin_lat decimal(10,7),
    checkin_lng decimal(10,7),
    checkout_time timestamptz,
    checkout_lat decimal(10,7),
    checkout_lng decimal(10,7),
    travel_distance_km decimal(5,1),
    -- Visit documentation
    visit_type varchar(20) NOT NULL DEFAULT 'routine' CHECK (visit_type IN ('routine','urgent','follow_up','assessment','discharge_visit','sample_collection')),
    chief_complaint text,
    -- Vitals
    bp_systolic int,
    bp_diastolic int,
    pulse int,
    temperature decimal(4,1),
    spo2 decimal(4,1),
    resp_rate int,
    blood_sugar decimal(5,1),
    blood_sugar_type varchar(10) CHECK (blood_sugar_type IN ('fasting','pp','random')),
    pain_scale int CHECK (pain_scale BETWEEN 0 AND 10),
    weight_kg decimal(5,1),
    -- Assessment
    general_condition varchar(20) CHECK (general_condition IN ('stable','improving','deteriorating','critical','unchanged')),
    consciousness varchar(20) CHECK (consciousness IN ('alert','drowsy','confused','unresponsive')),
    mobility varchar(20) CHECK (mobility IN ('ambulatory','assisted','wheelchair','bedbound')),
    oral_intake varchar(20) CHECK (oral_intake IN ('normal','reduced','poor','nil','ryles_tube','peg')),
    -- Clinical notes
    assessment_notes text,
    plan_notes text,
    doctor_consulted boolean DEFAULT false,
    doctor_notes text,
    -- Escalation
    needs_escalation boolean NOT NULL DEFAULT false,
    escalation_reason text,
    escalation_action text,
    -- Status
    status varchar(15) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','missed','cancelled','rescheduled')),
    duration_minutes int,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hc_visits_enroll ON hmis_hc_visits(enrollment_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_hc_visits_nurse ON hmis_hc_visits(assigned_nurse_id, scheduled_date);

-- 3. Homecare Medications (medication compliance tracking)
CREATE TABLE IF NOT EXISTS hmis_hc_medications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    drug_name varchar(200) NOT NULL,
    dose varchar(50) NOT NULL,
    route varchar(20) NOT NULL,
    frequency varchar(30) NOT NULL,
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    instructions text,
    is_active boolean NOT NULL DEFAULT true,
    prescribed_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Medication Administration at Home
CREATE TABLE IF NOT EXISTS hmis_hc_med_admin (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id uuid NOT NULL REFERENCES hmis_hc_visits(id),
    medication_id uuid NOT NULL REFERENCES hmis_hc_medications(id),
    administered boolean NOT NULL DEFAULT true,
    administered_time timestamptz DEFAULT now(),
    dose_given varchar(50),
    site varchar(30),
    skip_reason text,
    nurse_notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Wound Care Documentation
CREATE TABLE IF NOT EXISTS hmis_hc_wound_care (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id uuid NOT NULL REFERENCES hmis_hc_visits(id),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    wound_location varchar(100) NOT NULL,
    wound_type varchar(30) CHECK (wound_type IN ('surgical','pressure_ulcer','diabetic','traumatic','venous','arterial','burn','drain_site','tracheostomy','other')),
    -- Measurement
    length_cm decimal(5,1),
    width_cm decimal(5,1),
    depth_cm decimal(5,1),
    -- Assessment
    wound_bed varchar(30) CHECK (wound_bed IN ('granulation','slough','necrotic','epithelializing','mixed','clean')),
    exudate_amount varchar(15) CHECK (exudate_amount IN ('none','scant','moderate','heavy')),
    exudate_type varchar(15) CHECK (exudate_type IN ('serous','sanguinous','serosanguinous','purulent')),
    periwound_skin varchar(30) CHECK (periwound_skin IN ('intact','macerated','erythema','edema','induration','healthy')),
    odor boolean DEFAULT false,
    infection_signs boolean DEFAULT false,
    -- Treatment
    dressing_type text,
    dressing_changed boolean NOT NULL DEFAULT true,
    irrigation_solution text,
    -- Photo
    photo_urls jsonb DEFAULT '[]',
    -- Assessment
    healing_progress varchar(15) CHECK (healing_progress IN ('improving','stable','worsening')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Homecare Equipment / Supplies
CREATE TABLE IF NOT EXISTS hmis_hc_equipment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    equipment_name varchar(100) NOT NULL,
    equipment_type varchar(20) CHECK (equipment_type IN ('oxygen','ventilator','suction','nebulizer','pulse_oximeter','bp_monitor','glucometer','wheelchair','bed','mattress','iv_stand','dressing_kit','other')),
    serial_number varchar(50),
    issued_date date NOT NULL DEFAULT CURRENT_DATE,
    return_date date,
    daily_rental decimal(8,2),
    status varchar(15) DEFAULT 'issued' CHECK (status IN ('issued','in_use','returned','damaged','lost')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Homecare Billing
CREATE TABLE IF NOT EXISTS hmis_hc_bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    bill_date date NOT NULL DEFAULT CURRENT_DATE,
    bill_period_start date,
    bill_period_end date,
    -- Line items stored as JSON
    items jsonb NOT NULL DEFAULT '[]',
    subtotal decimal(10,2) NOT NULL DEFAULT 0,
    discount decimal(10,2) NOT NULL DEFAULT 0,
    tax decimal(10,2) NOT NULL DEFAULT 0,
    total decimal(10,2) NOT NULL DEFAULT 0,
    paid decimal(10,2) NOT NULL DEFAULT 0,
    balance decimal(10,2) GENERATED ALWAYS AS (total - paid) STORED,
    payment_mode varchar(15) CHECK (payment_mode IN ('cash','upi','card','neft','cheque','insurance')),
    status varchar(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue')),
    notes text,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Homecare Service Rate Card
CREATE TABLE IF NOT EXISTS hmis_hc_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_code varchar(20) NOT NULL UNIQUE,
    service_name varchar(100) NOT NULL,
    category varchar(30) NOT NULL CHECK (category IN ('nursing_visit','doctor_visit','physiotherapy','iv_therapy','wound_care','injection','sample_collection','equipment_rental','consumables','package','other')),
    rate decimal(8,2) NOT NULL,
    unit varchar(20) DEFAULT 'per_visit',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_hc_enrollments','hmis_hc_visits','hmis_hc_medications',
        'hmis_hc_med_admin','hmis_hc_wound_care','hmis_hc_equipment',
        'hmis_hc_bills','hmis_hc_rates'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Rate card
-- ============================================================

-- ═══ sql/revenue_cycle_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Revenue Cycle Management Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Corporate Master + MOU
CREATE TABLE IF NOT EXISTS hmis_corporates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    company_name varchar(200) NOT NULL,
    company_code varchar(20) UNIQUE,
    gst_number varchar(20),
    pan_number varchar(15),
    contact_person varchar(100),
    contact_email varchar(100),
    contact_phone varchar(15),
    billing_address text,
    credit_limit decimal(12,2) DEFAULT 500000,
    credit_period_days int DEFAULT 30,
    current_outstanding decimal(12,2) DEFAULT 0,
    payment_terms text,
    discount_percentage decimal(5,2) DEFAULT 0,
    mou_valid_from date,
    mou_valid_to date,
    mou_document_url text,
    status varchar(10) DEFAULT 'active' CHECK (status IN ('active','suspended','terminated')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_corporate_employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    corporate_id uuid NOT NULL REFERENCES hmis_corporates(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    employee_id varchar(50),
    relationship varchar(20) DEFAULT 'self' CHECK (relationship IN ('self','spouse','child','parent','dependent')),
    coverage_type varchar(20) DEFAULT 'full' CHECK (coverage_type IN ('full','partial','opd_only','ipd_only','emergency_only')),
    max_coverage decimal(12,2),
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Loyalty Program
CREATE TABLE IF NOT EXISTS hmis_loyalty_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    card_number varchar(20) NOT NULL UNIQUE,
    card_type varchar(15) NOT NULL CHECK (card_type IN ('silver','gold','platinum','staff','freedom_fighter','senior_citizen','bpl')),
    discount_opd decimal(5,2) DEFAULT 0,
    discount_ipd decimal(5,2) DEFAULT 0,
    discount_pharmacy decimal(5,2) DEFAULT 0,
    discount_lab decimal(5,2) DEFAULT 0,
    points_balance int DEFAULT 0,
    issued_date date NOT NULL DEFAULT CURRENT_DATE,
    valid_until date,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_loyalty_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id uuid NOT NULL REFERENCES hmis_loyalty_cards(id),
    bill_id uuid REFERENCES hmis_bills(id),
    transaction_type varchar(10) NOT NULL CHECK (transaction_type IN ('earn','redeem','expire','adjust')),
    points int NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Accounts Receivable Tracking
CREATE TABLE IF NOT EXISTS hmis_ar_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    bill_id uuid REFERENCES hmis_bills(id),
    claim_id uuid REFERENCES hmis_claims(id),
    corporate_id uuid REFERENCES hmis_corporates(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    ar_type varchar(20) NOT NULL CHECK (ar_type IN ('insurance_cashless','insurance_reimbursement','corporate_credit','govt_pmjay','govt_cghs','govt_echs','govt_esi','patient_credit','other')),
    original_amount decimal(12,2) NOT NULL,
    collected_amount decimal(12,2) DEFAULT 0,
    written_off_amount decimal(12,2) DEFAULT 0,
    balance_amount decimal(12,2) NOT NULL,
    due_date date,
    aging_bucket varchar(10) CHECK (aging_bucket IN ('current','30','60','90','120','180','365','bad_debt')),
    last_followup_date date,
    followup_notes text,
    status varchar(15) DEFAULT 'open' CHECK (status IN ('open','partial','settled','written_off','disputed','legal')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_ar_followups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ar_entry_id uuid NOT NULL REFERENCES hmis_ar_entries(id),
    followup_date date NOT NULL DEFAULT CURRENT_DATE,
    followup_type varchar(15) NOT NULL CHECK (followup_type IN ('call','email','letter','legal_notice','visit','portal_check','escalation')),
    contact_person varchar(100),
    response text,
    next_action text,
    next_followup_date date,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Settlement & Reconciliation
CREATE TABLE IF NOT EXISTS hmis_settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    settlement_type varchar(20) NOT NULL CHECK (settlement_type IN ('insurance','tpa','pmjay','cghs','echs','esi','corporate')),
    insurer_id uuid REFERENCES hmis_insurers(id),
    tpa_id uuid REFERENCES hmis_tpas(id),
    corporate_id uuid REFERENCES hmis_corporates(id),
    settlement_number varchar(50),
    utr_number varchar(50),
    settlement_date date NOT NULL,
    total_claims int NOT NULL DEFAULT 0,
    claimed_amount decimal(14,2) NOT NULL DEFAULT 0,
    approved_amount decimal(14,2) DEFAULT 0,
    settled_amount decimal(14,2) NOT NULL DEFAULT 0,
    tds_amount decimal(12,2) DEFAULT 0,
    disallowance_amount decimal(12,2) DEFAULT 0,
    net_received decimal(14,2) NOT NULL DEFAULT 0,
    bank_account varchar(30),
    payment_mode varchar(20),
    remarks text,
    reconciled boolean DEFAULT false,
    reconciled_by uuid REFERENCES hmis_staff(id),
    reconciled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_settlement_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id uuid NOT NULL REFERENCES hmis_settlements(id) ON DELETE CASCADE,
    claim_id uuid NOT NULL REFERENCES hmis_claims(id),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    patient_name varchar(100),
    bill_number varchar(20),
    claimed_amount decimal(12,2) NOT NULL,
    approved_amount decimal(12,2),
    settled_amount decimal(12,2),
    tds decimal(10,2) DEFAULT 0,
    disallowance decimal(10,2) DEFAULT 0,
    disallowance_reason text,
    status varchar(10) DEFAULT 'settled' CHECK (status IN ('settled','partial','rejected','disputed'))
);

-- 5. Government Scheme Config
CREATE TABLE IF NOT EXISTS hmis_govt_scheme_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    scheme_code varchar(20) NOT NULL CHECK (scheme_code IN ('pmjay','cghs','echs','esi','mjpjay','bsby','mahatma_jyoti','other')),
    scheme_name varchar(100) NOT NULL,
    empanelment_number varchar(50),
    empanelment_valid_from date,
    empanelment_valid_to date,
    nodal_officer varchar(100),
    nodal_phone varchar(15),
    portal_url text,
    portal_login varchar(50),
    package_rates jsonb,
    max_claim_days int DEFAULT 15,
    submission_portal varchar(20) CHECK (submission_portal IN ('rohini','echs_portal','esi_portal','state_portal','direct','other')),
    auto_claim boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, scheme_code)
);

-- 6. Integration Bridge Tables
CREATE TABLE IF NOT EXISTS hmis_integration_bridge (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    source_system varchar(20) NOT NULL CHECK (source_system IN ('billing','medpay','vpms','cashflow','tally')),
    target_system varchar(20) NOT NULL CHECK (target_system IN ('billing','medpay','vpms','cashflow','tally')),
    entity_type varchar(30) NOT NULL,
    entity_id uuid NOT NULL,
    external_ref varchar(100),
    sync_status varchar(10) DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','failed','skipped')),
    sync_data jsonb,
    error_message text,
    synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_corporates','hmis_corporate_employees','hmis_loyalty_cards','hmis_loyalty_transactions','hmis_ar_entries','hmis_ar_followups','hmis_settlements','hmis_settlement_items','hmis_govt_scheme_config','hmis_integration_bridge'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Insurers, TPAs, Corporates, Govt Schemes, Loyalty Types
-- ============================================================

-- Major Indian Insurers

-- TPAs

-- Sample Corporates

-- Govt scheme configs

-- ═══ sql/charge_capture_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Charge Capture Engine
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Real-time charge capture log
-- Every charge from ANY source lands here FIRST, then gets posted to bill_items
CREATE TABLE IF NOT EXISTS hmis_charge_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    bill_id uuid REFERENCES hmis_bills(id),

    -- What was charged
    tariff_id uuid REFERENCES hmis_tariff_master(id),
    charge_code varchar(30),
    description varchar(200) NOT NULL,
    category varchar(30) NOT NULL,
    quantity decimal(8,2) NOT NULL DEFAULT 1,
    unit_rate decimal(10,2) NOT NULL,
    amount decimal(12,2) NOT NULL,
    department_id uuid REFERENCES hmis_departments(id),
    doctor_id uuid REFERENCES hmis_staff(id),

    -- Source tracking
    source varchar(30) NOT NULL CHECK (source IN (
        'auto_daily',        -- bed rent, nursing, MO visit (auto-engine)
        'auto_admission',    -- one-time admission charges
        'auto_discharge',    -- discharge charges
        'pharmacy',          -- pharmacy dispense
        'lab',               -- lab order
        'radiology',         -- radiology order
        'procedure',         -- OT / bedside procedure
        'consumable',        -- consumable used
        'manual',            -- manually posted by staff
        'barcode_scan'       -- posted via barcode scan
    )),
    source_ref_id uuid,      -- FK to source record (drug dispense ID, lab order ID, etc.)
    source_ref_type varchar(30), -- 'pharmacy_dispense', 'lab_order', 'ot_booking', etc.

    -- Status
    status varchar(15) NOT NULL DEFAULT 'captured' CHECK (status IN ('captured','posted','reversed','disputed')),
    posted_to_bill_at timestamptz,
    reversed_at timestamptz,
    reversed_by uuid REFERENCES hmis_staff(id),
    reversal_reason text,

    -- Metadata
    captured_by uuid REFERENCES hmis_staff(id),
    service_date date NOT NULL DEFAULT CURRENT_DATE,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charge_log_admission ON hmis_charge_log(admission_id, status);
CREATE INDEX IF NOT EXISTS idx_charge_log_patient ON hmis_charge_log(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charge_log_bill ON hmis_charge_log(bill_id) WHERE bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_charge_log_source ON hmis_charge_log(source, source_ref_id);

-- 2. Auto-charge run log (tracks when daily charges were last run)
CREATE TABLE IF NOT EXISTS hmis_auto_charge_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    run_date date NOT NULL,
    charges_posted int NOT NULL DEFAULT 0,
    total_amount decimal(12,2) NOT NULL DEFAULT 0,
    run_by uuid REFERENCES hmis_staff(id),
    run_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, run_date)
);

-- 3. Barcode / wristband config
CREATE TABLE IF NOT EXISTS hmis_barcode_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id) UNIQUE,
    barcode_format varchar(20) NOT NULL DEFAULT 'uhid',  -- 'uhid', 'ipd_number', 'custom'
    prefix varchar(10),
    suffix varchar(10),
    include_name boolean DEFAULT false,
    include_dob boolean DEFAULT false,
    wristband_printer varchar(50),
    is_active boolean DEFAULT true
);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_charge_log','hmis_auto_charge_runs','hmis_barcode_config'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Auto-charge rules for Health1 (per ward type)
-- ============================================================

-- Clear old rules first (idempotent)
DELETE FROM hmis_billing_auto_rules WHERE rule_name LIKE 'Auto:%';

-- Daily charges (trigger_type = 'daily')

-- ============================================================
-- RPC: Run daily auto-charges for a centre
-- ============================================================
CREATE OR REPLACE FUNCTION run_daily_auto_charges(
    p_centre_id uuid,
    p_date date DEFAULT CURRENT_DATE,
    p_staff_id uuid DEFAULT NULL
)
RETURNS TABLE(charges_posted int, total_amount numeric) LANGUAGE plpgsql AS $$
DECLARE
    v_count int := 0;
    v_total numeric := 0;
    r RECORD;
BEGIN
    -- Skip if already run today for this centre
    IF EXISTS (SELECT 1 FROM hmis_auto_charge_runs WHERE centre_id = p_centre_id AND run_date = p_date) THEN
        RETURN QUERY SELECT 0, 0::numeric;
        RETURN;
    END IF;

    -- For each active admission with a bed
    FOR r IN
        SELECT a.id AS admission_id, a.patient_id, a.payor_type,
               b.id AS bed_id, w.type AS ward_type,
               COALESCE(a.bed_id, b.id) AS _bed
        FROM hmis_admissions a
        JOIN hmis_beds b ON b.id = a.bed_id
        JOIN hmis_rooms rm ON rm.id = b.room_id
        JOIN hmis_wards w ON w.id = rm.ward_id
        WHERE a.centre_id = p_centre_id
          AND a.status = 'active'
          AND a.bed_id IS NOT NULL
    LOOP
        -- Find matching daily rules for this ward type

    END LOOP;

    -- Calculate total
    SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_count, v_total
    FROM hmis_charge_log
    WHERE centre_id = p_centre_id AND service_date = p_date AND source = 'auto_daily';

    -- Log the run

    RETURN QUERY SELECT v_count, v_total;
END;
$$;

-- ═══ sql/nhcx_integration.sql ═══
-- ============================================================
-- Health1 HMIS — NHCX Integration Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. NHCX Transaction Log — every API call in/out
CREATE TABLE IF NOT EXISTS hmis_nhcx_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id uuid REFERENCES hmis_claims(id),
    patient_id uuid REFERENCES hmis_patients(id),
    action varchar(50) NOT NULL,                    -- coverageeligibility/check, preauth/submit, etc
    direction varchar(10) NOT NULL CHECK (direction IN ('outgoing','incoming')),
    nhcx_api_call_id varchar(100),                  -- NHCX gateway's API call ID
    nhcx_correlation_id varchar(100),               -- Links request ↔ response
    nhcx_workflow_id varchar(100),                   -- Links eligibility → preauth → claim
    status varchar(20) NOT NULL DEFAULT 'pending',
    error_message text,
    request_payload jsonb,
    response_payload jsonb,
    request_timestamp timestamptz,
    response_timestamp timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nhcx_txn_claim ON hmis_nhcx_transactions(claim_id);
CREATE INDEX IF NOT EXISTS idx_nhcx_txn_correlation ON hmis_nhcx_transactions(nhcx_correlation_id);
CREATE INDEX IF NOT EXISTS idx_nhcx_txn_workflow ON hmis_nhcx_transactions(nhcx_workflow_id);

-- 2. Add NHCX columns to hmis_claims
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_correlation_id varchar(100);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_workflow_id varchar(100);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_response jsonb;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_submitted_at timestamptz;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_responded_at timestamptz;

-- 3. Add NHCX participant codes to insurers and TPAs
ALTER TABLE hmis_insurers ADD COLUMN IF NOT EXISTS nhcx_code varchar(100);
ALTER TABLE hmis_tpas ADD COLUMN IF NOT EXISTS nhcx_code varchar(100);

-- 4. Add ABHA fields to patients (if not exists)
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_number varchar(20);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_address varchar(50);

-- 5. NHCX Configuration table
CREATE TABLE IF NOT EXISTS hmis_nhcx_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    participant_code varchar(100) NOT NULL,
    hfr_id varchar(20) NOT NULL,
    username varchar(100) NOT NULL,
    encrypted_secret text NOT NULL,           -- encrypted in application
    gateway_url varchar(200) NOT NULL DEFAULT 'https://hcxbeta.nha.gov.in',
    is_production boolean NOT NULL DEFAULT false,
    rsa_public_key text,                       -- PEM format
    rsa_private_key_encrypted text,            -- encrypted, stored securely
    webhook_url text,                          -- our callback URL for NHCX
    is_active boolean NOT NULL DEFAULT true,
    last_token_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id)
);

-- RLS
DO $$
BEGIN
    EXECUTE 'ALTER TABLE hmis_nhcx_transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY nhcx_txn_pol ON hmis_nhcx_transactions FOR ALL USING (auth.uid() IS NOT NULL)';
    EXECUTE 'ALTER TABLE hmis_nhcx_config ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY nhcx_cfg_pol ON hmis_nhcx_config FOR ALL USING (auth.uid() IS NOT NULL)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Seed major insurers with NHCX codes (placeholder — update when known)
-- These codes will be available from the NHCX participant registry
UPDATE hmis_insurers SET nhcx_code = CASE 
    WHEN name ILIKE '%star health%' THEN 'nhcx-star-health'
    WHEN name ILIKE '%niva bupa%' OR name ILIKE '%max bupa%' THEN 'nhcx-niva-bupa'
    WHEN name ILIKE '%care health%' OR name ILIKE '%religare%' THEN 'nhcx-care-health'
    WHEN name ILIKE '%hdfc ergo%' THEN 'nhcx-hdfc-ergo'
    WHEN name ILIKE '%icici lombard%' THEN 'nhcx-icici-lombard'
    WHEN name ILIKE '%bajaj allianz%' THEN 'nhcx-bajaj-allianz'
    WHEN name ILIKE '%new india%' THEN 'nhcx-new-india'
    WHEN name ILIKE '%national%' THEN 'nhcx-national-insurance'
    WHEN name ILIKE '%united india%' THEN 'nhcx-united-india'
    WHEN name ILIKE '%oriental%' THEN 'nhcx-oriental-insurance'
    ELSE nhcx_code
END WHERE nhcx_code IS NULL;

UPDATE hmis_tpas SET nhcx_code = CASE
    WHEN name ILIKE '%medi assist%' THEN 'nhcx-medi-assist'
    WHEN name ILIKE '%paramount%' THEN 'nhcx-paramount'
    WHEN name ILIKE '%vidal%' THEN 'nhcx-vidal'
    WHEN name ILIKE '%md india%' THEN 'nhcx-md-india'
    WHEN name ILIKE '%good health%' THEN 'nhcx-good-health'
    ELSE nhcx_code
END WHERE nhcx_code IS NULL;

-- ═══ sql/rbac_permissions.sql ═══
-- ============================================================
-- Health1 HMIS — RBAC: Role-Based Access Control
-- Proper module permissions, role templates, bulk user creation
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Clear old roles and insert proper templates
-- Upsert roles (safe — does not delete referenced roles)

-- ============================================================
-- PERMISSION STRUCTURE:
-- permissions jsonb = { "module_name": ["action1", "action2"] }
--
-- MODULES (matching sidebar + features):
--   dashboard, patients, opd, appointments, ipd, bed_management,
--   nursing_station, emr, billing, pharmacy, lab, blood_bank,
--   radiology, ot, vpms, homecare, reports, quality, settings,
--   command_centre, portal
--
-- ACTIONS per module:
--   view, create, edit, delete, print, approve, export, admin
-- ============================================================



-- ============================================================
-- 2. BULK USER CREATION RPC
-- Creates staff + Supabase auth user + assigns role at centre
-- ============================================================

CREATE OR REPLACE FUNCTION create_staff_user(
  p_employee_code text,
  p_full_name text,
  p_email text,
  p_password text,
  p_phone text,
  p_staff_type text,
  p_designation text,
  p_centre_id uuid,
  p_role_name text,
  p_department_id uuid DEFAULT NULL,
  p_specialisation text DEFAULT NULL,
  p_medical_reg_no text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_auth_id uuid;
  v_staff_id uuid;
  v_role_id uuid;
BEGIN
  -- Get role ID
  SELECT id INTO v_role_id FROM hmis_roles WHERE name = p_role_name;
  IF v_role_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Role not found: ' || p_role_name);
  END IF;

  -- Check for duplicate employee code
  IF EXISTS (SELECT 1 FROM hmis_staff WHERE employee_code = p_employee_code) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee code already exists: ' || p_employee_code);
  END IF;

  -- Create Supabase auth user
  v_auth_id := extensions.uuid_generate_v4();

  -- Create identity

  -- Create staff record

  -- Assign role at centre

  -- Assign to department if provided
  IF p_department_id IS NOT NULL THEN
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'staff_id', v_staff_id,
    'auth_id', v_auth_id,
    'employee_code', p_employee_code,
    'email', p_email,
    'role', p_role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 3. BATCH USER CREATION (for CSV import)
-- ============================================================
CREATE OR REPLACE FUNCTION create_staff_batch(p_users jsonb)
RETURNS jsonb AS $$
DECLARE
  v_user jsonb;
  v_result jsonb;
  v_results jsonb[] := ARRAY[]::jsonb[];
  v_success int := 0;
  v_failed int := 0;
BEGIN
  FOR v_user IN SELECT * FROM jsonb_array_elements(p_users)
  LOOP
    BEGIN
      v_result := create_staff_user(
        v_user->>'employee_code', v_user->>'full_name',
        v_user->>'email', v_user->>'password',
        v_user->>'phone', v_user->>'staff_type',
        v_user->>'designation', (v_user->>'centre_id')::uuid,
        v_user->>'role_name',
        CASE WHEN v_user->>'department_id' IS NOT NULL THEN (v_user->>'department_id')::uuid ELSE NULL END,
        v_user->>'specialisation', v_user->>'medical_reg_no'
      );
      v_results := array_append(v_results, v_result);
      IF (v_result->>'success')::boolean THEN v_success := v_success + 1;
      ELSE v_failed := v_failed + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_results := array_append(v_results, jsonb_build_object('success', false, 'error', SQLERRM, 'employee_code', v_user->>'employee_code'));
    END;
  END LOOP;

  RETURN jsonb_build_object('success', v_success, 'failed', v_failed, 'results', to_jsonb(v_results));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ sql/cpoe_migration.sql ═══
-- ============================================================
-- Health1 HMIS — CPOE (Computerized Physician Order Entry)
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_cpoe_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    order_type varchar(20) NOT NULL CHECK (order_type IN ('medication','lab','radiology','diet','nursing','activity','consult','procedure')),
    order_text text NOT NULL,
    details jsonb DEFAULT '{}',
    priority varchar(10) NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat','asap')),
    status varchar(15) NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','verified','in_progress','completed','cancelled','held')),
    ordered_by uuid NOT NULL REFERENCES hmis_staff(id),
    is_verbal boolean NOT NULL DEFAULT false,
    cosigned_by uuid REFERENCES hmis_staff(id),
    cosigned_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpoe_admission ON hmis_cpoe_orders(admission_id, status);
CREATE INDEX IF NOT EXISTS idx_cpoe_patient ON hmis_cpoe_orders(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpoe_verbal ON hmis_cpoe_orders(is_verbal) WHERE is_verbal = true AND cosigned_by IS NULL;

ALTER TABLE hmis_cpoe_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_cpoe_orders_pol ON hmis_cpoe_orders;
CREATE POLICY hmis_cpoe_orders_pol ON hmis_cpoe_orders FOR ALL USING (auth.uid() IS NOT NULL);

-- ═══ sql/refund_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Refund Management
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================



CREATE INDEX IF NOT EXISTS idx_refunds_centre ON hmis_refunds(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_refunds_bill ON hmis_refunds(bill_id);

ALTER TABLE hmis_refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_refunds_pol ON hmis_refunds;
CREATE POLICY hmis_refunds_pol ON hmis_refunds FOR ALL USING (auth.uid() IS NOT NULL);

-- ═══ sql/packages_opd_billing.sql ═══
-- ============================================================
-- Health1 HMIS — Package Builder + OPD Billing Support
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Packages table (for PackageBuilder component)
CREATE TABLE IF NOT EXISTS hmis_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(200) NOT NULL,
    description text,
    room_category varchar(20) DEFAULT 'economy',
    expected_los int DEFAULT 3,
    items jsonb NOT NULL DEFAULT '[]',
    gross_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_percentage decimal(5,2) DEFAULT 0,
    net_amount decimal(12,2) NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_centre ON hmis_packages(centre_id, is_active);

ALTER TABLE hmis_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_packages_pol ON hmis_packages;
CREATE POLICY hmis_packages_pol ON hmis_packages FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. Add visit_type to OPD visits if missing (for follow-up vs new)
ALTER TABLE hmis_opd_visits ADD COLUMN IF NOT EXISTS visit_type varchar(15) DEFAULT 'new';
ALTER TABLE hmis_opd_visits ADD COLUMN IF NOT EXISTS visit_reason text;

-- ═══ sql/pharmacy_v2_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Pharmacy v2 (Returns, Transfers, Controlled)
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Pharmacy Returns & Write-offs


CREATE INDEX IF NOT EXISTS idx_rx_returns_centre ON hmis_pharmacy_returns(centre_id, return_type);

-- 2. Inter-Centre Stock Transfers


CREATE INDEX IF NOT EXISTS idx_rx_transfers ON hmis_pharmacy_transfers(from_centre_id, status);

-- 3. Controlled Substance Register (Schedule H, H1, X)
CREATE TABLE IF NOT EXISTS hmis_controlled_substance_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    quantity decimal(10,2) NOT NULL,
    batch_number varchar(30),
    transaction_type varchar(15) NOT NULL CHECK (transaction_type IN ('received','dispensed','returned','destroyed','wastage')),
    patient_id uuid REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    administered_by uuid NOT NULL REFERENCES hmis_staff(id),
    witnessed_by uuid REFERENCES hmis_staff(id),
    balance_after decimal(10,2) DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_controlled_centre ON hmis_controlled_substance_log(centre_id, drug_id);

-- Add schedule column to drug master if missing
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS schedule varchar(5);
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS is_controlled boolean DEFAULT false;
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS reorder_level int DEFAULT 10;
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS max_stock int DEFAULT 500;

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_pharmacy_returns','hmis_pharmacy_transfers','hmis_controlled_substance_log'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ═══ sql/lab_instrument_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Lab Instrument Integration + Patient Lab History
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Instrument result staging table
-- Results from Mindray/analyzers land here before being verified
CREATE TABLE IF NOT EXISTS hmis_lab_instrument_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid REFERENCES hmis_lab_orders(id),
    patient_id uuid REFERENCES hmis_patients(id),
    parameter_code varchar(30),
    parameter_name varchar(100) NOT NULL,
    result_value varchar(50) NOT NULL,
    unit varchar(20),
    reference_range varchar(50),
    instrument_flag varchar(10),
    is_abnormal boolean DEFAULT false,
    is_critical boolean DEFAULT false,
    source varchar(20) NOT NULL DEFAULT 'instrument',
    instrument_format varchar(10),  -- hl7, astm, json
    received_at timestamptz NOT NULL DEFAULT now(),
    reviewed boolean DEFAULT false,
    reviewed_by uuid REFERENCES hmis_staff(id),
    reviewed_at timestamptz,
    accepted boolean,  -- true = accepted into results, false = rejected
    rejection_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_instr_order ON hmis_lab_instrument_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_instr_patient ON hmis_lab_instrument_results(patient_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_instr_unreviewed ON hmis_lab_instrument_results(reviewed) WHERE reviewed = false;

-- RLS
ALTER TABLE hmis_lab_instrument_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_lab_instrument_results_pol ON hmis_lab_instrument_results;
CREATE POLICY hmis_lab_instrument_results_pol ON hmis_lab_instrument_results FOR ALL USING (auth.uid() IS NOT NULL);

-- ═══ sql/bc5000_parameters.sql ═══
-- ============================================================
-- Add BC-5000 specific parameters to CBC test
-- Run in Supabase SQL Editor
-- ============================================================


-- ═══ sql/command_centre_rpcs.sql ═══
-- ============================================================
-- Health1 HMIS — Command Centre Server-Side Aggregation
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Bed Census — single query, grouped by centre
CREATE OR REPLACE FUNCTION get_bed_census()
RETURNS TABLE (
    centre_id uuid,
    centre_name text,
    centre_code text,
    total_beds bigint,
    occupied bigint,
    available bigint,
    maintenance bigint,
    icu_total bigint,
    icu_occupied bigint,
    ward_type text,
    ward_occupied bigint,
    ward_total bigint
) LANGUAGE sql STABLE AS $$
    WITH bed_data AS (
        SELECT
            c.id AS centre_id,
            c.name AS centre_name,
            c.code AS centre_code,
            b.status AS bed_status,
            w.type AS ward_type
        FROM hmis_beds b
        JOIN hmis_rooms r ON r.id = b.room_id
        JOIN hmis_wards w ON w.id = r.ward_id
        JOIN hmis_centres c ON c.id = w.centre_id
        WHERE c.is_active = true
    )
    SELECT
        bd.centre_id,
        bd.centre_name,
        bd.centre_code,
        COUNT(*) AS total_beds,
        COUNT(*) FILTER (WHERE bd.bed_status = 'occupied') AS occupied,
        COUNT(*) FILTER (WHERE bd.bed_status = 'available') AS available,
        COUNT(*) FILTER (WHERE bd.bed_status = 'maintenance') AS maintenance,
        COUNT(*) FILTER (WHERE bd.ward_type = 'icu') AS icu_total,
        COUNT(*) FILTER (WHERE bd.ward_type = 'icu' AND bd.bed_status = 'occupied') AS icu_occupied,
        bd.ward_type,
        COUNT(*) FILTER (WHERE bd.bed_status = 'occupied') AS ward_occupied,
        COUNT(*) AS ward_total
    FROM bed_data bd
    GROUP BY bd.centre_id, bd.centre_name, bd.centre_code, bd.ward_type
    ORDER BY bd.centre_name, bd.ward_type;
$$;

-- 2. Today's Operations Summary — single query
CREATE OR REPLACE FUNCTION get_daily_ops_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    centre_id uuid,
    opd_total bigint,
    opd_waiting bigint,
    opd_in_consult bigint,
    opd_completed bigint,
    admissions bigint,
    discharges bigint,
    discharge_pending bigint,
    ot_scheduled bigint,
    ot_in_progress bigint,
    ot_completed bigint,
    ot_cancelled bigint,
    ot_emergency bigint,
    ot_robotic bigint,
    lab_pending bigint
) LANGUAGE sql STABLE AS $$
    WITH opd AS (
        SELECT centre_id,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'waiting') AS waiting,
            COUNT(*) FILTER (WHERE status = 'with_doctor') AS in_consult,
            COUNT(*) FILTER (WHERE status IN ('completed','referred')) AS completed
        FROM hmis_opd_visits
        WHERE created_at::date = p_date
        GROUP BY centre_id
    ),
    ipd AS (
        SELECT centre_id,
            COUNT(*) FILTER (WHERE admission_date::date = p_date) AS admissions,
            COUNT(*) FILTER (WHERE status = 'discharged' AND actual_discharge::date = p_date) AS discharges,
            COUNT(*) FILTER (WHERE status = 'discharge_initiated') AS discharge_pending
        FROM hmis_admissions
        GROUP BY centre_id
    ),
    ot AS (
        SELECT b.ot_room_id, r.centre_id,
            COUNT(*) AS scheduled,
            COUNT(*) FILTER (WHERE b.status = 'in_progress') AS in_progress,
            COUNT(*) FILTER (WHERE b.status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled,
            COUNT(*) FILTER (WHERE b.is_emergency) AS emergency,
            COUNT(*) FILTER (WHERE b.is_robotic) AS robotic
        FROM hmis_ot_bookings b
        JOIN hmis_ot_rooms r ON r.id = b.ot_room_id
        WHERE b.scheduled_date = p_date
        GROUP BY b.ot_room_id, r.centre_id
    ),
    lab AS (
        SELECT centre_id,
            COUNT(*) FILTER (WHERE status IN ('ordered','collected','processing')) AS pending
        FROM hmis_lab_orders
        WHERE created_at::date = p_date
        GROUP BY centre_id
    ),
    centres AS (SELECT id AS centre_id FROM hmis_centres WHERE is_active = true)
    SELECT
        c.centre_id,
        COALESCE(o.total, 0) AS opd_total,
        COALESCE(o.waiting, 0) AS opd_waiting,
        COALESCE(o.in_consult, 0) AS opd_in_consult,
        COALESCE(o.completed, 0) AS opd_completed,
        COALESCE(i.admissions, 0) AS admissions,
        COALESCE(i.discharges, 0) AS discharges,
        COALESCE(i.discharge_pending, 0) AS discharge_pending,
        COALESCE(SUM(ot_agg.scheduled), 0) AS ot_scheduled,
        COALESCE(SUM(ot_agg.in_progress), 0) AS ot_in_progress,
        COALESCE(SUM(ot_agg.completed), 0) AS ot_completed,
        COALESCE(SUM(ot_agg.cancelled), 0) AS ot_cancelled,
        COALESCE(SUM(ot_agg.emergency), 0) AS ot_emergency,
        COALESCE(SUM(ot_agg.robotic), 0) AS ot_robotic,
        COALESCE(l.pending, 0) AS lab_pending
    FROM centres c
    LEFT JOIN opd o ON o.centre_id = c.centre_id
    LEFT JOIN ipd i ON i.centre_id = c.centre_id
    LEFT JOIN ot ot_agg ON ot_agg.centre_id = c.centre_id
    LEFT JOIN lab l ON l.centre_id = c.centre_id
    GROUP BY c.centre_id, o.total, o.waiting, o.in_consult, o.completed,
        i.admissions, i.discharges, i.discharge_pending, l.pending;
$$;

-- 3. Revenue Summary — single query
CREATE OR REPLACE FUNCTION get_revenue_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    centre_id uuid,
    bills_count bigint,
    gross_amount numeric,
    discount_amount numeric,
    net_amount numeric,
    paid_amount numeric,
    balance_amount numeric,
    cash_collected numeric,
    upi_collected numeric,
    card_collected numeric,
    neft_collected numeric,
    insurance_billed numeric,
    collection_rate numeric
) LANGUAGE sql STABLE AS $$
    SELECT
        b.centre_id,
        COUNT(*) AS bills_count,
        COALESCE(SUM(b.gross_amount), 0) AS gross_amount,
        COALESCE(SUM(b.discount_amount), 0) AS discount_amount,
        COALESCE(SUM(b.net_amount), 0) AS net_amount,
        COALESCE(SUM(b.paid_amount), 0) AS paid_amount,
        COALESCE(SUM(b.balance_amount), 0) AS balance_amount,
        0::numeric AS cash_collected,
        0::numeric AS upi_collected,
        0::numeric AS card_collected,
        0::numeric AS neft_collected,
        COALESCE(SUM(b.net_amount) FILTER (WHERE b.payor_type != 'self'), 0) AS insurance_billed,
        CASE WHEN SUM(b.net_amount) > 0
            THEN ROUND(SUM(b.paid_amount) / SUM(b.net_amount) * 100, 1)
            ELSE 0 END AS collection_rate
    FROM hmis_bills b
    WHERE b.bill_date = p_date AND b.status != 'cancelled'
    GROUP BY b.centre_id;
$$;

-- 4. Insurance Pipeline — single query
CREATE OR REPLACE FUNCTION get_insurance_pipeline()
RETURNS TABLE (
    centre_id uuid,
    preauth_pending bigint,
    preauth_approved bigint,
    claims_pending bigint,
    claims_approved bigint,
    claims_settled bigint,
    claims_rejected bigint,
    total_claimed numeric,
    total_approved numeric,
    total_settled numeric,
    total_outstanding numeric
) LANGUAGE sql STABLE AS $$
    SELECT
        b.centre_id,
        COUNT(*) FILTER (WHERE cl.status IN ('submitted','under_review')) AS preauth_pending,
        COUNT(*) FILTER (WHERE cl.status = 'approved') AS preauth_approved,
        COUNT(*) FILTER (WHERE cl.status IN ('submitted','query')) AS claims_pending,
        COUNT(*) FILTER (WHERE cl.status = 'approved') AS claims_approved,
        COUNT(*) FILTER (WHERE cl.status = 'settled') AS claims_settled,
        COUNT(*) FILTER (WHERE cl.status = 'rejected') AS claims_rejected,
        COALESCE(SUM(cl.claimed_amount), 0) AS total_claimed,
        COALESCE(SUM(cl.approved_amount), 0) AS total_approved,
        COALESCE(SUM(cl.settled_amount), 0) AS total_settled,
        COALESCE(SUM(cl.claimed_amount) - COALESCE(SUM(cl.settled_amount), 0), 0) AS total_outstanding
    FROM hmis_claims cl
    JOIN hmis_bills b ON b.id = cl.bill_id
    WHERE cl.status NOT IN ('settled','rejected')
    GROUP BY b.centre_id;
$$;

-- ═══ sql/quality_nabh_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Quality/NABH + Audit Trail
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Incident Reporting
CREATE TABLE IF NOT EXISTS hmis_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    incident_number varchar(20) NOT NULL UNIQUE,
    category varchar(30) NOT NULL CHECK (category IN (
        'medication_error','fall','infection','surgical','transfusion',
        'equipment','documentation','communication','delay','abuse',
        'needle_stick','fire_safety','other'
    )),
    severity varchar(15) NOT NULL CHECK (severity IN ('near_miss','minor','moderate','serious','sentinel')),
    description text NOT NULL,
    location varchar(50),
    patient_id uuid REFERENCES hmis_patients(id),
    involved_staff text,
    immediate_action text,
    root_cause text,
    corrective_action text,
    preventive_action text,
    status varchar(15) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','investigating','action_taken','closed','reopened')),
    reported_by uuid NOT NULL REFERENCES hmis_staff(id),
    assigned_to uuid REFERENCES hmis_staff(id),
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_centre ON hmis_incidents(centre_id, status);

-- 2. Quality Indicators (NABH KPIs)
CREATE TABLE IF NOT EXISTS hmis_quality_indicators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    indicator_code varchar(10) NOT NULL,
    indicator_name varchar(100) NOT NULL,
    period varchar(10) NOT NULL, -- '2026-03' format
    value decimal(10,2) NOT NULL,
    numerator int,
    denominator int,
    target decimal(10,2),
    met_target boolean,
    submitted_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, indicator_code, period)
);

CREATE INDEX IF NOT EXISTS idx_qi_centre ON hmis_quality_indicators(centre_id, period);

-- 3. Audit Trail
CREATE TABLE IF NOT EXISTS hmis_audit_trail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    user_id uuid NOT NULL REFERENCES hmis_staff(id),
    action varchar(20) NOT NULL CHECK (action IN ('create','update','delete','view','print','sign','cancel','approve','reject')),
    entity_type varchar(30) NOT NULL,
    entity_id uuid,
    entity_label varchar(200),
    changes jsonb,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_centre ON hmis_audit_trail(centre_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON hmis_audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON hmis_audit_trail(user_id, created_at DESC);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_incidents','hmis_quality_indicators','hmis_audit_trail'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ═══ sql/crm_migration.sql ═══
-- Health1 HMIS — CRM Module + Integration Tables
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)

-- ============================================================
-- CRM LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  -- Lead source
  source varchar(50) NOT NULL DEFAULT 'walk_in', -- walk_in, phone, website, google_ads, facebook, referral, camp, leadsquared, dialshree
  source_campaign varchar(200),
  source_medium varchar(100), -- organic, paid, referral, direct
  utm_source varchar(200), utm_medium varchar(100), utm_campaign varchar(200),
  -- Contact
  first_name varchar(100) NOT NULL,
  last_name varchar(100),
  phone varchar(20) NOT NULL,
  phone_alt varchar(20),
  email varchar(200),
  gender varchar(10),
  age_years integer,
  city varchar(100),
  pincode varchar(10),
  -- Interest
  interested_department varchar(100), -- cardiology, ortho, neuro, etc.
  interested_doctor_id uuid REFERENCES hmis_staff(id),
  interested_procedure varchar(200),
  chief_complaint text,
  insurance_status varchar(20) DEFAULT 'unknown', -- has_insurance, pmjay, no_insurance, unknown
  insurance_company varchar(200),
  estimated_value decimal(12,2) DEFAULT 0,
  -- Pipeline
  status varchar(30) NOT NULL DEFAULT 'new', -- new, contacted, qualified, appointment_booked, visited, converted, lost, dnc
  stage varchar(30) DEFAULT 'awareness', -- awareness, consideration, decision, booked, visited, admitted, discharged
  priority varchar(10) DEFAULT 'medium', -- hot, warm, medium, cold
  score integer DEFAULT 0, -- lead score 0-100
  -- Assignment
  assigned_to uuid REFERENCES hmis_staff(id),
  assigned_at timestamp with time zone,
  -- Conversion
  patient_id uuid REFERENCES hmis_patients(id), -- set when converted
  appointment_id uuid,
  converted_at timestamp with time zone,
  conversion_revenue decimal(12,2) DEFAULT 0,
  lost_reason varchar(200),
  -- External IDs
  leadsquared_id varchar(100),
  dialshree_id varchar(100),
  -- Meta
  tags text[], -- ['vip', 'corporate', 'camp_nov_2025']
  custom_fields jsonb DEFAULT '{}',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_centre ON hmis_crm_leads(centre_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON hmis_crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON hmis_crm_leads(phone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON hmis_crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_leadsquared ON hmis_crm_leads(leadsquared_id);

-- ============================================================
-- CRM ACTIVITIES / FOLLOW-UPS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES hmis_crm_leads(id) ON DELETE CASCADE,
  centre_id uuid REFERENCES hmis_centres(id),
  activity_type varchar(30) NOT NULL, -- call, whatsapp, email, sms, meeting, note, status_change, appointment
  direction varchar(10), -- inbound, outbound (for calls/messages)
  -- Call details (from DialShree)
  call_duration_seconds integer,
  call_recording_url text,
  call_disposition varchar(50), -- answered, no_answer, busy, voicemail, wrong_number
  dialshree_call_id varchar(100),
  caller_number varchar(20),
  agent_number varchar(20),
  -- Content
  subject varchar(200),
  description text,
  -- Follow-up
  follow_up_date timestamp with time zone,
  follow_up_type varchar(30), -- call, whatsapp, visit
  follow_up_done boolean DEFAULT false,
  -- Meta
  performed_by uuid REFERENCES hmis_staff(id),
  performed_at timestamp with time zone DEFAULT now(),
  leadsquared_activity_id varchar(100),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON hmis_crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_followup ON hmis_crm_activities(follow_up_date) WHERE follow_up_done = false;
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON hmis_crm_activities(activity_type);

-- ============================================================
-- CRM CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  name varchar(200) NOT NULL,
  type varchar(30) NOT NULL, -- health_camp, digital_ads, referral, corporate_tie_up, awareness, screening
  status varchar(20) DEFAULT 'planned', -- planned, active, completed, cancelled
  start_date date,
  end_date date,
  budget decimal(12,2) DEFAULT 0,
  spent decimal(12,2) DEFAULT 0,
  target_department varchar(100),
  target_audience text,
  -- Metrics (auto-calculated)
  leads_generated integer DEFAULT 0,
  appointments_booked integer DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue_generated decimal(12,2) DEFAULT 0,
  -- External
  leadsquared_campaign_id varchar(100),
  google_ads_campaign_id varchar(100),
  facebook_campaign_id varchar(100),
  -- Meta
  created_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- INTEGRATION CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_integration_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  provider varchar(50) NOT NULL, -- leadsquared, dialshree, whatsapp, google_ads
  is_enabled boolean DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  -- LeadSquared: { api_host, access_key, secret_key }
  -- DialShree: { api_url, api_key, agent_id, campaign_id }
  -- WhatsApp: { api_url, api_token, business_phone }
  last_sync_at timestamp with time zone,
  sync_status varchar(20) DEFAULT 'idle', -- idle, syncing, error
  sync_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, provider)
);

-- ============================================================
-- INTEGRATION SYNC LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  provider varchar(50) NOT NULL,
  direction varchar(10) NOT NULL, -- push, pull
  entity_type varchar(50), -- lead, activity, appointment
  entity_id uuid,
  external_id varchar(200),
  status varchar(20) NOT NULL, -- success, error
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_centre ON hmis_integration_sync_log(centre_id, provider);
CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON hmis_integration_sync_log(entity_id);

-- ═══ sql/modules_9_migration.sql ═══
-- Health1 HMIS — 9 New Modules Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)

-- ============================================================
-- 1. EMERGENCY / TRIAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_er_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  arrival_mode varchar(20) DEFAULT 'walk_in', -- walk_in, ambulance, referred, police
  arrival_time timestamp with time zone DEFAULT now(),
  triage_category varchar(10), -- red, orange, yellow, green, black (MTS/ESI)
  triage_score integer, -- 1-5 ESI
  triage_by uuid REFERENCES hmis_staff(id),
  triage_time timestamp with time zone,
  chief_complaint text,
  vitals jsonb DEFAULT '{}', -- bp, hr, rr, spo2, temp, gcs
  gcs_score integer, -- 3-15
  is_trauma boolean DEFAULT false,
  trauma_type varchar(50), -- rta, fall, assault, burn, poisoning, other
  is_mlc boolean DEFAULT false,
  mlc_number varchar(50),
  police_station varchar(100),
  fir_number varchar(50),
  er_bed_id uuid REFERENCES hmis_beds(id),
  attending_doctor_id uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'triaged', -- triaged, being_seen, under_observation, admitted, discharged, referred, dama, expired
  disposition varchar(20), -- admit, discharge, refer, dama, expired
  disposition_time timestamp with time zone,
  admission_id uuid REFERENCES hmis_admissions(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_er_visits_centre ON hmis_er_visits(centre_id, status);

-- ============================================================
-- 2. DIETARY / KITCHEN
-- ============================================================


CREATE TABLE IF NOT EXISTS hmis_meal_service (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  diet_order_id uuid REFERENCES hmis_diet_orders(id),
  patient_id uuid REFERENCES hmis_patients(id),
  meal_type varchar(20) NOT NULL, -- breakfast, lunch, dinner, snack
  service_date date DEFAULT CURRENT_DATE,
  menu_items text[],
  served_by uuid REFERENCES hmis_staff(id),
  served_at timestamp with time zone,
  consumed varchar(20), -- full, partial, refused, npo
  wastage_pct integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_service_date ON hmis_meal_service(centre_id, service_date, meal_type);

-- ============================================================
-- 3. CSSD (Central Sterile Supply Department)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_cssd_instrument_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  set_name varchar(200) NOT NULL,
  set_code varchar(50),
  department varchar(100),
  instruments jsonb NOT NULL DEFAULT '[]', -- [{name, qty, condition}]
  total_instruments integer DEFAULT 0,
  status varchar(20) DEFAULT 'available', -- available, in_use, sterilizing, maintenance
  last_sterilized_at timestamp with time zone,
  sterilization_count integer DEFAULT 0,
  max_cycles integer DEFAULT 500,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_cssd_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  autoclave_number varchar(50),
  cycle_number varchar(50),
  cycle_type varchar(20), -- gravity, prevacuum, flash, eto
  load_items jsonb NOT NULL DEFAULT '[]', -- [{set_id, set_name}]
  temperature decimal(5,1),
  pressure decimal(5,2),
  duration_minutes integer,
  bi_test_result varchar(10), -- pass, fail, pending
  ci_result varchar(10), -- pass, fail
  operator_id uuid REFERENCES hmis_staff(id),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status varchar(20) DEFAULT 'in_progress', -- in_progress, completed, failed, recalled
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_cssd_issue_return (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  set_id uuid REFERENCES hmis_cssd_instrument_sets(id),
  issued_to varchar(100), -- OT/Ward/Department name
  ot_booking_id uuid,
  issued_by uuid REFERENCES hmis_staff(id),
  issued_at timestamp with time zone DEFAULT now(),
  returned_at timestamp with time zone,
  returned_by uuid REFERENCES hmis_staff(id),
  condition_on_return varchar(20), -- good, damaged, missing_items
  missing_items jsonb DEFAULT '[]',
  notes text
);

-- ============================================================
-- 4. DIALYSIS UNIT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_dialysis_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  machine_number varchar(50) NOT NULL,
  brand varchar(100),
  model varchar(100),
  serial_number varchar(100),
  status varchar(20) DEFAULT 'available', -- available, in_use, maintenance, out_of_order
  last_maintenance_date date,
  next_maintenance_date date,
  total_sessions integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_dialysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  machine_id uuid REFERENCES hmis_dialysis_machines(id),
  session_date date DEFAULT CURRENT_DATE,
  session_number integer, -- this patient's Nth session
  dialysis_type varchar(20) DEFAULT 'hd', -- hd, hdf, pd, crrt, sled
  access_type varchar(20), -- av_fistula, av_graft, catheter_perm, catheter_temp
  -- Pre-dialysis
  pre_weight decimal(5,1),
  pre_bp varchar(20),
  pre_pulse integer,
  pre_temp decimal(4,1),
  target_uf decimal(6,1), -- ultrafiltration target in ml
  -- Session params
  dialyzer_type varchar(100),
  blood_flow_rate integer, -- ml/min
  dialysate_flow_rate integer,
  heparin_dose varchar(50),
  duration_minutes integer DEFAULT 240,
  actual_start timestamp with time zone,
  actual_end timestamp with time zone,
  -- Post-dialysis
  post_weight decimal(5,1),
  post_bp varchar(20),
  post_pulse integer,
  actual_uf decimal(6,1),
  -- Complications
  complications text[], -- hypotension, cramps, nausea, clotting, access_issue
  intradialytic_events text,
  -- Staff
  technician_id uuid REFERENCES hmis_staff(id),
  doctor_id uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  billing_done boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dialysis_sessions_date ON hmis_dialysis_sessions(centre_id, session_date);

-- ============================================================
-- 5. CATH LAB
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_cathlab_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  procedure_date date DEFAULT CURRENT_DATE,
  procedure_type varchar(30) NOT NULL, -- cag, ptca, ppi, icd, ep_study, bmc, tavi, structural
  procedure_name varchar(200),
  -- Clinical
  indication text,
  access_site varchar(20), -- radial, femoral
  cag_findings text, -- LM, LAD, LCx, RCA findings
  vessels_involved text[],
  stents_placed jsonb DEFAULT '[]', -- [{vessel, type, brand, size, serial}]
  balloon_used jsonb DEFAULT '[]',
  -- Implant details
  implant_details jsonb DEFAULT '{}', -- pacemaker/ICD: {brand, model, serial, leads}
  -- Radiation
  fluoroscopy_time_min decimal(5,1),
  radiation_dose_mgy decimal(8,1),
  contrast_volume_ml integer,
  contrast_type varchar(50),
  -- Team
  primary_operator uuid REFERENCES hmis_staff(id),
  secondary_operator uuid REFERENCES hmis_staff(id),
  anesthetist_id uuid REFERENCES hmis_staff(id),
  -- Outcome
  procedure_status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, abandoned, complication
  outcome varchar(20), -- success, partial, failed
  complications text[],
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  billing_done boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cathlab_date ON hmis_cathlab_procedures(centre_id, procedure_date);

-- ============================================================
-- 6. ENDOSCOPY UNIT (reuse for scopes)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_endoscopy_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  procedure_date date DEFAULT CURRENT_DATE,
  procedure_type varchar(30) NOT NULL, -- ogd, colonoscopy, ercp, eus, bronchoscopy, sigmoidoscopy
  indication text,
  sedation_type varchar(20), -- local, conscious, deep, ga
  scope_id varchar(50), -- track which scope used
  findings text,
  biopsy_taken boolean DEFAULT false,
  biopsy_details text,
  therapeutic_intervention text, -- polypectomy, banding, stenting, dilatation
  complications text[],
  endoscopist_id uuid REFERENCES hmis_staff(id),
  nurse_id uuid REFERENCES hmis_staff(id),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status varchar(20) DEFAULT 'scheduled',
  images jsonb DEFAULT '[]', -- [{url, description}]
  report text,
  billing_done boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_scope_decontamination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  scope_id varchar(50) NOT NULL,
  scope_type varchar(30), -- gastroscope, colonoscope, duodenoscope, bronchoscope
  procedure_id uuid REFERENCES hmis_endoscopy_procedures(id),
  decontamination_method varchar(30), -- aer, manual, cidex
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  leak_test varchar(10), -- pass, fail
  culture_result varchar(20), -- pending, negative, positive
  performed_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 7. PHYSIOTHERAPY / REHAB
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_physio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid,
  therapist_id uuid REFERENCES hmis_staff(id),
  session_date date DEFAULT CURRENT_DATE,
  session_number integer,
  -- Assessment
  diagnosis varchar(200),
  treatment_area varchar(100), -- knee, shoulder, spine, neuro, cardiac, chest
  modalities text[], -- ift, tens, us, swd, laser, wax, traction, cpm
  exercises text[],
  manual_therapy text,
  -- Outcome
  pain_score_before integer, -- 0-10 VAS
  pain_score_after integer,
  rom_before jsonb DEFAULT '{}', -- {flexion: 90, extension: 0}
  rom_after jsonb DEFAULT '{}',
  functional_score integer, -- standardized outcome measure
  -- Meta
  duration_minutes integer DEFAULT 30,
  status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled, no_show
  billing_done boolean DEFAULT false,
  notes text,
  next_session_date date,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_physio_date ON hmis_physio_sessions(centre_id, session_date);

CREATE TABLE IF NOT EXISTS hmis_physio_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  therapist_id uuid REFERENCES hmis_staff(id),
  diagnosis varchar(200),
  goals text[],
  treatment_plan text,
  total_sessions_planned integer DEFAULT 10,
  sessions_completed integer DEFAULT 0,
  frequency varchar(30), -- daily, alternate, twice_week, weekly
  status varchar(20) DEFAULT 'active', -- active, completed, discontinued
  start_date date,
  expected_end_date date,
  outcome_at_discharge text,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 8. REFERRAL MANAGEMENT
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_referrals_centre ON hmis_referrals(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_doctor ON hmis_referrals(referring_doctor_phone);

-- ============================================================
-- 9. PACKAGE MANAGEMENT
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_packages_centre ON hmis_packages(centre_id, is_active);

-- ============================================================
-- 10. DISCHARGE PLANNING (enhancement)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_discharge_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
  centre_id uuid REFERENCES hmis_centres(id),
  -- Clinical
  medication_reconciliation boolean DEFAULT false,
  discharge_medications_reviewed boolean DEFAULT false,
  follow_up_appointments_set boolean DEFAULT false,
  wound_care_instructions boolean DEFAULT false,
  diet_instructions boolean DEFAULT false,
  activity_restrictions boolean DEFAULT false,
  warning_signs_explained boolean DEFAULT false,
  -- Administrative
  final_bill_generated boolean DEFAULT false,
  final_bill_settled boolean DEFAULT false,
  insurance_claim_submitted boolean DEFAULT false,
  discharge_summary_completed boolean DEFAULT false,
  discharge_summary_signed boolean DEFAULT false,
  patient_education_done boolean DEFAULT false,
  -- Logistics
  belongings_returned boolean DEFAULT false,
  transport_arranged boolean DEFAULT false,
  referral_letters_given boolean DEFAULT false,
  medical_certificate_issued boolean DEFAULT false,
  -- Sign-off
  completed_by uuid REFERENCES hmis_staff(id),
  completed_at timestamp with time zone,
  status varchar(20) DEFAULT 'pending', -- pending, in_progress, completed
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discharge_checklist ON hmis_discharge_checklists(admission_id);

-- ═══ sql/modules_15_17_migration.sql ═══
-- Health1 HMIS — Modules 15-17 Migration
-- Ambulance/Transport, Visitor Management, Asset Management

-- ============================================================
-- 15. AMBULANCE & TRANSPORT
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ambulances_centre ON hmis_ambulances(centre_id, status);

CREATE TABLE IF NOT EXISTS hmis_transport_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  request_number varchar(50),
  request_type varchar(30) NOT NULL, -- emergency_pickup, inter_hospital_transfer, discharge, dialysis_shuttle, opd_pickup, dead_body
  priority varchar(10) DEFAULT 'routine', -- emergency, urgent, routine
  -- Patient
  patient_id uuid REFERENCES hmis_patients(id),
  patient_name varchar(200),
  patient_phone varchar(20),
  patient_condition varchar(50), -- stable, critical, ventilated, immobile
  -- Route
  pickup_location text NOT NULL,
  pickup_landmark varchar(200),
  drop_location text NOT NULL,
  drop_landmark varchar(200),
  distance_km decimal(6,1),
  -- Assignment
  ambulance_id uuid REFERENCES hmis_ambulances(id),
  driver_name varchar(200),
  emt_name varchar(200),
  -- Timestamps
  requested_at timestamp with time zone DEFAULT now(),
  requested_by uuid REFERENCES hmis_staff(id),
  dispatched_at timestamp with time zone,
  en_route_at timestamp with time zone,
  arrived_at timestamp with time zone,
  patient_loaded_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  -- Metrics
  response_time_min integer, -- dispatch to arrival
  total_trip_time_min integer,
  -- Billing
  trip_charge decimal(10,2) DEFAULT 0,
  billing_done boolean DEFAULT false,
  -- Meta
  status varchar(20) DEFAULT 'requested', -- requested, dispatched, en_route, arrived, patient_loaded, returning, completed, cancelled
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transport_centre ON hmis_transport_requests(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_date ON hmis_transport_requests(requested_at);

-- ============================================================
-- 16. VISITOR MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_visitor_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  pass_number varchar(50),
  -- Visitor
  visitor_name varchar(200) NOT NULL,
  visitor_phone varchar(20),
  visitor_address text,
  relation varchar(50), -- spouse, parent, child, sibling, friend, relative, other
  id_proof_type varchar(20), -- aadhar, pan, driving_license, passport, voter_id
  id_proof_number varchar(50),
  photo_url text,
  -- Patient
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  ward varchar(100),
  bed varchar(50),
  -- Pass details
  pass_type varchar(20) DEFAULT 'regular', -- regular, icu, nicu, isolation, emergency, attendant
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  max_visitors_at_time integer DEFAULT 2,
  visiting_hours varchar(50), -- e.g. "10:00-12:00, 16:00-18:00"
  -- Tracking
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  items_deposited text[], -- mobile, bag, food
  -- Meta
  issued_by uuid REFERENCES hmis_staff(id),
  revoked_by uuid REFERENCES hmis_staff(id),
  revocation_reason text,
  status varchar(20) DEFAULT 'active', -- active, checked_in, checked_out, expired, revoked
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visitor_centre ON hmis_visitor_passes(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_visitor_patient ON hmis_visitor_passes(patient_id);

-- ============================================================
-- 17. ASSET MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  asset_tag varchar(50) NOT NULL,
  -- Details
  name varchar(200) NOT NULL,
  description text,
  category varchar(30) NOT NULL, -- furniture, it_hardware, it_software, medical_equipment, surgical_instrument, vehicle, building, electrical, plumbing, hvac, other
  sub_category varchar(100),
  brand varchar(100),
  model varchar(100),
  serial_number varchar(100),
  -- Location
  department varchar(100),
  location varchar(200),
  floor varchar(20),
  room varchar(50),
  -- Purchase
  purchase_date date,
  purchase_cost decimal(12,2),
  purchase_order_number varchar(50),
  vendor varchar(200),
  invoice_number varchar(50),
  -- Warranty & AMC
  warranty_expiry date,
  amc_vendor varchar(200),
  amc_start_date date,
  amc_expiry date,
  amc_cost_annual decimal(10,2),
  amc_type varchar(20), -- comprehensive, non_comprehensive, camc
  -- Depreciation
  useful_life_years integer DEFAULT 10,
  depreciation_method varchar(20) DEFAULT 'straight_line', -- straight_line, wdv (written down value)
  depreciation_rate decimal(5,2), -- % per year for WDV
  salvage_value decimal(10,2) DEFAULT 0,
  current_book_value decimal(12,2),
  -- Status
  status varchar(20) DEFAULT 'in_use', -- in_use, in_storage, under_maintenance, condemned, disposed, lost, transferred
  condition varchar(20) DEFAULT 'good', -- new, good, fair, poor, non_functional
  -- Disposal
  disposed_date date,
  disposal_method varchar(20), -- sold, scrapped, donated, returned
  disposal_value decimal(10,2),
  disposal_approved_by uuid REFERENCES hmis_staff(id),
  -- Custodian
  custodian_id uuid REFERENCES hmis_staff(id),
  custodian_department varchar(100),
  -- Meta
  qr_code varchar(200),
  photo_url text,
  documents jsonb DEFAULT '[]', -- [{name, url, type}]
  last_audit_date date,
  next_audit_date date,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, asset_tag)
);
CREATE INDEX IF NOT EXISTS idx_assets_centre ON hmis_assets(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_dept ON hmis_assets(department);
CREATE INDEX IF NOT EXISTS idx_assets_category ON hmis_assets(category);

CREATE TABLE IF NOT EXISTS hmis_asset_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES hmis_assets(id),
  centre_id uuid REFERENCES hmis_centres(id),
  audit_type varchar(20) NOT NULL, -- physical_verification, condition_check, transfer, maintenance, disposal
  audit_date date DEFAULT CURRENT_DATE,
  previous_location varchar(200),
  current_location varchar(200),
  previous_condition varchar(20),
  current_condition varchar(20),
  findings text,
  audited_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_audit ON hmis_asset_audit_log(asset_id);

-- ═══ sql/modules_18_21_migration.sql ═══
-- Health1 HMIS — Modules 18-21 Migration
-- Infection Control, Grievance, Telemedicine, Document/SOP

-- ============================================================
-- 18. INFECTION CONTROL (HICC)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_hai_surveillance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  infection_type varchar(20) NOT NULL, -- ssi, cauti, clabsi, vap, bsi, cdi, mrsa, vre, esbl, other
  site varchar(100),
  organism varchar(200),
  sensitivity_pattern jsonb DEFAULT '{}', -- {antibiotic: S/R/I}
  onset_date date,
  culture_date date,
  culture_result varchar(30), -- positive, negative, pending, contaminated
  device_related boolean DEFAULT false,
  device_type varchar(50), -- central_line, urinary_catheter, ventilator, surgical_site
  device_insertion_date date,
  device_removal_date date,
  device_days integer,
  ward varchar(100),
  is_community_acquired boolean DEFAULT false,
  outcome varchar(20), -- resolved, ongoing, death, transferred
  reported_by uuid REFERENCES hmis_staff(id),
  verified_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'suspected', -- suspected, confirmed, ruled_out
  action_taken text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hai_centre ON hmis_hai_surveillance(centre_id);
CREATE INDEX IF NOT EXISTS idx_hai_type ON hmis_hai_surveillance(infection_type);

CREATE TABLE IF NOT EXISTS hmis_antibiogram (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  year integer NOT NULL,
  quarter integer, -- 1-4
  organism varchar(200) NOT NULL,
  antibiotic varchar(200) NOT NULL,
  samples_tested integer DEFAULT 0,
  sensitive_count integer DEFAULT 0,
  resistant_count integer DEFAULT 0,
  intermediate_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, year, quarter, organism, antibiotic)
);

CREATE TABLE IF NOT EXISTS hmis_hand_hygiene_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  ward varchar(100) NOT NULL,
  audit_date date DEFAULT CURRENT_DATE,
  shift varchar(10), -- morning, afternoon, night
  moment varchar(30), -- before_patient, after_patient, after_body_fluid, before_aseptic, after_surroundings
  opportunities_observed integer DEFAULT 0,
  compliant integer DEFAULT 0,
  auditor_id uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_needle_stick_injuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  staff_id uuid REFERENCES hmis_staff(id),
  incident_date timestamp with time zone,
  location varchar(100),
  device_type varchar(50), -- syringe, iv_catheter, suture_needle, lancet, scalpel, other
  body_part_affected varchar(50),
  source_patient_id uuid REFERENCES hmis_patients(id),
  source_hiv_status varchar(20), -- positive, negative, unknown
  source_hbv_status varchar(20),
  source_hcv_status varchar(20),
  pep_given boolean DEFAULT false,
  pep_details text,
  baseline_labs_done boolean DEFAULT false,
  follow_up_status varchar(20) DEFAULT 'pending', -- pending, in_progress, completed, lost_to_followup
  outcome varchar(30), -- no_seroconversion, seroconversion, pending
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 19. PATIENT GRIEVANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_grievances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  grievance_number varchar(50),
  patient_id uuid REFERENCES hmis_patients(id),
  complainant_name varchar(200) NOT NULL,
  complainant_phone varchar(20),
  complainant_email varchar(200),
  complainant_relation varchar(50), -- self, spouse, parent, child, other
  complaint_type varchar(30) NOT NULL, -- clinical, billing, behavior, facility, food, delay, privacy, infection, other
  department varchar(100),
  description text NOT NULL,
  severity varchar(10) DEFAULT 'minor', -- minor, major, critical
  source varchar(20) DEFAULT 'in_person', -- in_person, phone, email, online, suggestion_box, social_media
  -- Workflow
  assigned_to uuid REFERENCES hmis_staff(id),
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid REFERENCES hmis_staff(id),
  investigated_by uuid REFERENCES hmis_staff(id),
  investigation_notes text,
  root_cause text,
  corrective_action text,
  preventive_action text,
  resolution text,
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES hmis_staff(id),
  -- Satisfaction
  patient_satisfied boolean,
  satisfaction_remarks text,
  -- Escalation
  escalated boolean DEFAULT false,
  escalated_to uuid REFERENCES hmis_staff(id),
  escalation_reason text,
  -- Meta
  status varchar(20) DEFAULT 'received', -- received, acknowledged, investigating, resolved, closed, escalated, reopened
  reopened_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grievances_centre ON hmis_grievances(centre_id, status);

-- ============================================================
-- 20. TELEMEDICINE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_teleconsults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  doctor_id uuid REFERENCES hmis_staff(id),
  appointment_id uuid,
  scheduled_at timestamp with time zone NOT NULL,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  duration_minutes integer,
  room_url varchar(500), -- Jitsi/Daily.co room URL
  room_id varchar(100), -- unique room identifier
  -- Clinical
  chief_complaint text,
  consultation_notes text,
  diagnoses jsonb DEFAULT '[]',
  prescriptions jsonb DEFAULT '[]',
  investigations_ordered jsonb DEFAULT '[]',
  follow_up_date date,
  follow_up_notes text,
  -- Technical
  patient_joined_at timestamp with time zone,
  doctor_joined_at timestamp with time zone,
  connection_quality varchar(10), -- good, fair, poor
  recording_url text,
  -- Billing
  consultation_fee decimal(10,2),
  billing_done boolean DEFAULT false,
  bill_id uuid,
  -- Meta
  status varchar(20) DEFAULT 'scheduled', -- scheduled, waiting, in_progress, completed, no_show, cancelled, rescheduled
  cancellation_reason text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teleconsults_date ON hmis_teleconsults(centre_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_teleconsults_doctor ON hmis_teleconsults(doctor_id, status);

-- ============================================================
-- 21. DOCUMENT / SOP MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  doc_type varchar(20) NOT NULL, -- policy, sop, protocol, guideline, form, manual, circular, memo
  department varchar(100),
  title varchar(500) NOT NULL,
  doc_number varchar(50),
  version integer DEFAULT 1,
  content_html text,
  file_url text, -- Supabase storage URL
  file_size integer,
  -- Approval workflow
  created_by uuid REFERENCES hmis_staff(id),
  reviewed_by uuid REFERENCES hmis_staff(id),
  reviewed_at timestamp with time zone,
  approved_by uuid REFERENCES hmis_staff(id),
  approved_at timestamp with time zone,
  -- Dates
  effective_date date,
  review_date date, -- next review due
  superseded_date date,
  -- Classification
  tags text[],
  access_level varchar(20) DEFAULT 'all_staff', -- all_staff, department, management, confidential
  is_nabh_required boolean DEFAULT false,
  nabh_standard varchar(50), -- e.g. COP.1, MOM.2
  -- Meta
  status varchar(20) DEFAULT 'draft', -- draft, under_review, approved, superseded, archived
  previous_version_id uuid REFERENCES hmis_documents(id),
  download_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_centre ON hmis_documents(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_dept ON hmis_documents(department);
CREATE INDEX IF NOT EXISTS idx_documents_review ON hmis_documents(review_date) WHERE status = 'approved';

-- ═══ sql/procurement_migration.sql ═══
-- Health1 HMIS — Procurement Module Migration
-- Purchase Indents + Vendor Directory

-- ============================================================
-- PURCHASE INDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_purchase_indents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES hmis_centres(id),
  indent_number varchar(30) NOT NULL,
  department varchar(100) NOT NULL,
  -- Items
  items jsonb NOT NULL DEFAULT '[]',
  -- items: [{item_name, qty, unit, specification, urgency: routine/urgent/emergency, estimated_cost}]
  total_estimated_cost decimal(12,2) DEFAULT 0,
  -- Workflow
  requested_by uuid REFERENCES hmis_staff(id),
  approved_by uuid REFERENCES hmis_staff(id),
  approved_at timestamp with time zone,
  rejected_by uuid REFERENCES hmis_staff(id),
  rejected_at timestamp with time zone,
  rejection_reason text,
  po_id uuid REFERENCES hmis_pharmacy_po(id),
  -- Meta
  priority varchar(10) DEFAULT 'routine', -- routine, urgent, emergency
  status varchar(20) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected, ordered, partially_received, received, cancelled
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indents_centre ON hmis_purchase_indents(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_indents_requester ON hmis_purchase_indents(requested_by);

-- ============================================================
-- VENDOR DIRECTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  name varchar(200) NOT NULL,
  code varchar(20),
  contact_person varchar(200),
  phone varchar(20),
  email varchar(200),
  category varchar(50), -- pharma, surgical, medical_equipment, it, facility, lab, consumables, other
  sub_category varchar(100),
  gst_number varchar(20),
  pan_number varchar(20),
  address_line1 text,
  address_line2 text,
  city varchar(100),
  state varchar(100),
  pincode varchar(10),
  bank_name varchar(100),
  bank_account varchar(30),
  bank_ifsc varchar(15),
  credit_days integer DEFAULT 30,
  rating decimal(2,1) DEFAULT 3.0, -- 1.0 to 5.0
  total_orders integer DEFAULT 0,
  total_value decimal(14,2) DEFAULT 0,
  last_order_date date,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_centre ON hmis_vendors(centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON hmis_vendors(category);

-- ═══ sql/cdss_ml_migration.sql ═══
-- ============================================================
-- Health1 HMIS — CDSS Machine Learning Usage Tracking
-- Tracks doctor behavior to evolve complaint templates
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_cdss_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_name varchar(100) NOT NULL,
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    attributes_used text[] NOT NULL DEFAULT '{}',
    attributes_skipped text[] NOT NULL DEFAULT '{}',
    chip_selections jsonb NOT NULL DEFAULT '{}',
    free_text_entries jsonb NOT NULL DEFAULT '{}',
    time_spent_ms int DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_cdss_doctor ON hmis_cdss_usage(doctor_id, complaint_name);
CREATE INDEX IF NOT EXISTS idx_cdss_centre ON hmis_cdss_usage(centre_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdss_complaint ON hmis_cdss_usage(complaint_name, created_at DESC);

-- RLS
ALTER TABLE hmis_cdss_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_cdss_usage_pol ON hmis_cdss_usage;
CREATE POLICY hmis_cdss_usage_pol ON hmis_cdss_usage FOR ALL USING (auth.uid() IS NOT NULL);

-- ═══ sql/patient_portal_migration.sql ═══
-- ============================================================
-- Health1 HMIS — Patient Portal
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Patient Portal Access Tokens (OTP-based login)
CREATE TABLE IF NOT EXISTS hmis_portal_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    phone varchar(15) NOT NULL,
    otp_code varchar(6) NOT NULL,
    otp_expires_at timestamptz NOT NULL,
    is_verified boolean NOT NULL DEFAULT false,
    session_token varchar(64),
    session_expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_phone ON hmis_portal_tokens(phone, otp_code);
CREATE INDEX IF NOT EXISTS idx_portal_session ON hmis_portal_tokens(session_token);

-- 2. Patient Portal Access Log (NABL + audit)
CREATE TABLE IF NOT EXISTS hmis_portal_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    action varchar(20) NOT NULL CHECK (action IN ('login','view_report','download_report','view_prescription','view_bill','book_appointment','view_discharge','view_vitals')),
    entity_type varchar(20),
    entity_id uuid,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_log_patient ON hmis_portal_access_log(patient_id, created_at DESC);

-- 3. Appointment Requests from Portal
CREATE TABLE IF NOT EXISTS hmis_portal_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    preferred_date date NOT NULL,
    preferred_time varchar(10),
    department varchar(50),
    doctor_preference varchar(100),
    reason text,
    status varchar(15) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','cancelled','completed')),
    confirmed_date date,
    confirmed_time time,
    confirmed_by uuid REFERENCES hmis_staff(id),
    notes text,
    centre_id uuid REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Patient Feedback
CREATE TABLE IF NOT EXISTS hmis_portal_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    feedback_type varchar(15) NOT NULL CHECK (feedback_type IN ('general','doctor','lab','pharmacy','billing','homecare','complaint','suggestion')),
    rating int CHECK (rating BETWEEN 1 AND 5),
    message text NOT NULL,
    department varchar(50),
    is_resolved boolean NOT NULL DEFAULT false,
    resolved_by uuid REFERENCES hmis_staff(id),
    resolution_notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS — portal tables use different access pattern (session token, not auth.uid)
-- For now, enable RLS but allow all authenticated access (portal API uses service key)
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_portal_tokens','hmis_portal_access_log',
        'hmis_portal_appointments','hmis_portal_feedback'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;
