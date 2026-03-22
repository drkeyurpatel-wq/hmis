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

-- STEP 1A DONE. Now run STEP1B.
