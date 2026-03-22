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
INSERT INTO hmis_hc_rates (service_code, service_name, category, rate, unit) VALUES
('HC-NV', 'Nursing Visit (Routine)', 'nursing_visit', 500, 'per_visit'),
('HC-NV-EXT', 'Nursing Visit (Extended 2hr+)', 'nursing_visit', 800, 'per_visit'),
('HC-NV-NIGHT', 'Night Nursing (8hr shift)', 'nursing_visit', 2000, 'per_shift'),
('HC-NV-24', '24-Hour Nursing Care', 'nursing_visit', 3500, 'per_day'),
('HC-DV', 'Doctor Home Visit', 'doctor_visit', 1500, 'per_visit'),
('HC-DV-SPEC', 'Specialist Home Visit', 'doctor_visit', 2500, 'per_visit'),
('HC-PT', 'Physiotherapy Session', 'physiotherapy', 800, 'per_session'),
('HC-IV', 'IV Infusion Administration', 'iv_therapy', 600, 'per_session'),
('HC-IV-CHEMO', 'Home Chemotherapy Administration', 'iv_therapy', 3000, 'per_session'),
('HC-WC', 'Wound Care / Dressing', 'wound_care', 400, 'per_visit'),
('HC-WC-VAC', 'VAC Dressing Change', 'wound_care', 1500, 'per_visit'),
('HC-INJ', 'Injection Administration', 'injection', 200, 'per_injection'),
('HC-INJ-SC', 'Subcutaneous Injection (Insulin/Enoxaparin)', 'injection', 150, 'per_injection'),
('HC-SC', 'Home Sample Collection', 'sample_collection', 300, 'per_visit'),
('HC-O2', 'Oxygen Concentrator Rental', 'equipment_rental', 500, 'per_day'),
('HC-VENT', 'Home Ventilator Rental', 'equipment_rental', 3000, 'per_day'),
('HC-BED', 'Hospital Bed Rental', 'equipment_rental', 300, 'per_day'),
('HC-SUC', 'Suction Machine Rental', 'equipment_rental', 200, 'per_day'),
('HC-NEB', 'Nebulizer Rental', 'equipment_rental', 100, 'per_day'),
('HC-PKG-POST', 'Post-Surgery Home Package (7 days)', 'package', 8000, 'per_package'),
('HC-PKG-PALL', 'Palliative Care Package (Monthly)', 'package', 15000, 'per_month'),
('HC-PKG-CHRON', 'Chronic Care Package (Monthly)', 'package', 10000, 'per_month')
ON CONFLICT (service_code) DO NOTHING;
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
INSERT INTO hmis_insurers (name, code) VALUES
  ('Star Health','STAR'),('ICICI Lombard','ICICI'),('HDFC Ergo','HDFC'),
  ('Bajaj Allianz','BAJAJ'),('Max Bupa (Niva)','NIVA'),('Care Health','CARE'),
  ('New India Assurance','NIA'),('United India','UI'),('Oriental Insurance','OIC'),
  ('National Insurance','NIC'),('Manipal Cigna','MANIPAL'),('Aditya Birla','BIRLA'),
  ('SBI General','SBI'),('Tata AIG','TATA'),('Cholamandalam','CHOLA'),
  ('Reliance General','REL'),('Universal Sompo','USOMPO'),('MagmaHDI','MAGMA'),
  ('Go Digit','DIGIT'),('Acko','ACKO'),
  ('Bajaj General (PMJAY)','BAJAJ_PMJAY')
ON CONFLICT (code) DO NOTHING;

-- TPAs
INSERT INTO hmis_tpas (name, code) VALUES
  ('Medi Assist','MEDIASSIST'),('Paramount Health','PARAMOUNT'),
  ('FHPL (Family Health Plan)','FHPL'),('Vipul Medcorp','VIPUL'),
  ('Raksha TPA','RAKSHA'),('MDIndia','MDINDIA'),
  ('Heritage Health','HERITAGE'),('Ericson','ERICSON'),
  ('Medsave','MEDSAVE'),('Safeway','SAFEWAY'),
  ('Anmol Medicare','ANMOL'),('Good Health','GOODHEALTH'),
  ('East West Assist','EASTWEST'),('United Health Care','UHC'),
  ('Dedicated Healthcare','DHC')
ON CONFLICT (code) DO NOTHING;

-- Sample Corporates
INSERT INTO hmis_corporates (centre_id, company_name, company_code, credit_limit, credit_period_days, discount_percentage)
SELECT c.id, corp.name, corp.code, corp.limit_val, corp.days, corp.disc
FROM hmis_centres c, (VALUES
  ('Adani Group','ADANI',1000000,30,5),
  ('Torrent Pharma','TORRENT',500000,30,5),
  ('Zydus Lifesciences','ZYDUS',500000,30,5),
  ('Cadila Healthcare','CADILA',500000,30,5),
  ('Gujarat Gas','GGAS',300000,30,3),
  ('GSPC','GSPC',300000,30,3),
  ('ONGC','ONGC',500000,45,0),
  ('IOCL','IOCL',500000,45,0),
  ('TCS Ahmedabad','TCS',1000000,30,5),
  ('Infosys Ahmedabad','INFY',500000,30,5),
  ('AMUL (GCMMF)','AMUL',300000,30,3)
) AS corp(name, code, limit_val, days, disc)
WHERE c.code = 'SHJ' OR c.name ILIKE '%shilaj%'
LIMIT 11;

-- Govt scheme configs
INSERT INTO hmis_govt_scheme_config (centre_id, scheme_code, scheme_name, submission_portal, max_claim_days)
SELECT c.id, s.code, s.name, s.portal, s.days
FROM hmis_centres c, (VALUES
  ('pmjay','Ayushman Bharat PM-JAY','rohini',15),
  ('cghs','Central Govt Health Scheme','direct',30),
  ('echs','Ex-Servicemen Contributory Health Scheme','echs_portal',21),
  ('esi','Employees State Insurance','esi_portal',15),
  ('mjpjay','Mukhyamantri Amrutum (MA) / MJPJAY','state_portal',15)
) AS s(code, name, portal, days)
WHERE c.code = 'SHJ' OR c.name ILIKE '%shilaj%'
ON CONFLICT (centre_id, scheme_code) DO NOTHING;
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
INSERT INTO hmis_billing_auto_rules (centre_id, rule_name, trigger_type, ward_type, charge_description, charge_amount, is_active)
SELECT c.id, r.rule_name, r.trigger_type, r.ward_type, r.description, r.amount, true
FROM hmis_centres c, (VALUES
    -- Bed charges per ward type
    ('Auto: Bed - General Ward',      'daily', 'general',        'Bed Charges — General Ward',        1500),
    ('Auto: Bed - Semi Private',      'daily', 'semi_private',   'Bed Charges — Semi Private Room',   3000),
    ('Auto: Bed - Private',           'daily', 'private',        'Bed Charges — Private Room',        5000),
    ('Auto: Bed - ICU',               'daily', 'icu',            'Bed Charges — ICU',                 12000),
    ('Auto: Bed - Transplant ICU',    'daily', 'transplant_icu', 'Bed Charges — Transplant ICU',      18000),
    ('Auto: Bed - NICU',              'daily', 'nicu',           'Bed Charges — NICU',                10000),
    ('Auto: Bed - PICU',              'daily', 'picu',           'Bed Charges — PICU',                10000),
    ('Auto: Bed - Isolation',         'daily', 'isolation',      'Bed Charges — Isolation Room',      5000),

    -- Nursing charges per ward type
    ('Auto: Nursing - General',       'daily', 'general',        'Nursing Charges — General',         500),
    ('Auto: Nursing - Semi Private',  'daily', 'semi_private',   'Nursing Charges — Semi Private',    500),
    ('Auto: Nursing - Private',       'daily', 'private',        'Nursing Charges — Private',         800),
    ('Auto: Nursing - ICU',           'daily', 'icu',            'Nursing Charges — ICU',             1500),
    ('Auto: Nursing - Transplant ICU','daily', 'transplant_icu', 'Nursing Charges — Transplant ICU',  2000),
    ('Auto: Nursing - NICU',          'daily', 'nicu',           'Nursing Charges — NICU',            1500),

    -- Medical Officer visit (daily for all IPD)
    ('Auto: MO Visit - General',      'daily', 'general',        'Medical Officer Visit',             300),
    ('Auto: MO Visit - ICU',          'daily', 'icu',            'Medical Officer Visit — ICU',       500),
    ('Auto: MO Visit - Transplant',   'daily', 'transplant_icu', 'Medical Officer Visit — TICU',      800),

    -- Diet charges
    ('Auto: Diet - General',          'daily', 'general',        'Diet Charges',                      500),
    ('Auto: Diet - Private',          'daily', 'private',        'Diet Charges',                      500),
    ('Auto: Diet - ICU',              'daily', 'icu',            'Diet Charges — ICU',                500),

    -- ICU-specific daily charges
    ('Auto: ICU Monitoring',          'daily', 'icu',            'ICU Monitoring Charges',            3000),
    ('Auto: TICU Monitoring',         'daily', 'transplant_icu', 'Transplant ICU Monitoring',         5000),

    -- One-time admission charges
    ('Auto: Registration Fee',        'admission', NULL,         'Registration / Admission Fee',      500),
    ('Auto: Admission Kit',           'admission', NULL,         'Admission Kit (linen, toiletries)', 300)
) AS r(rule_name, trigger_type, ward_type, description, amount)
WHERE c.is_active = true
ON CONFLICT DO NOTHING;

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
        INSERT INTO hmis_charge_log (
            centre_id, patient_id, admission_id, charge_code, description, category,
            quantity, unit_rate, amount, source, captured_by, service_date, status
        )
        SELECT
            p_centre_id, r.patient_id, r.admission_id,
            'AUTO-' || ar.id::text, ar.charge_description, 'auto_daily',
            1, ar.charge_amount, ar.charge_amount,
            'auto_daily', p_staff_id, p_date, 'captured'
        FROM hmis_billing_auto_rules ar
        WHERE ar.centre_id = p_centre_id
          AND ar.is_active = true
          AND ar.trigger_type = 'daily'
          AND (ar.ward_type = r.ward_type OR ar.ward_type IS NULL);

    END LOOP;

    -- Calculate total
    SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_count, v_total
    FROM hmis_charge_log
    WHERE centre_id = p_centre_id AND service_date = p_date AND source = 'auto_daily';

    -- Log the run
    INSERT INTO hmis_auto_charge_runs (centre_id, run_date, charges_posted, total_amount, run_by)
    VALUES (p_centre_id, p_date, v_count, v_total, p_staff_id);

    RETURN QUERY SELECT v_count, v_total;
END;
$$;
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
DO $$
DECLARE
    shilaj_id uuid;
BEGIN
    SELECT id INTO shilaj_id FROM hmis_centres WHERE code = 'SHJ' OR name ILIKE '%shilaj%' LIMIT 1;
    IF shilaj_id IS NULL THEN
        RAISE NOTICE 'Shilaj centre not found — skipping tariff seed. Insert centres first.';
        RETURN;
    END IF;

    INSERT INTO hmis_tariff_master (centre_id, service_code, service_name, category, rate_self, rate_insurance, rate_pmjay)
    VALUES
        (shilaj_id, 'OPD-CONSULT', 'OPD Consultation', 'consultation', 500, 500, 300),
        (shilaj_id, 'OPD-CONSULT-SR', 'Senior Consultant Consultation', 'consultation', 800, 800, 300),
        (shilaj_id, 'OPD-FOLLOWUP', 'Follow-up Consultation', 'consultation', 300, 300, 200),
        (shilaj_id, 'OPD-EMERGENCY', 'Emergency Consultation', 'consultation', 1000, 1000, 500),
        (shilaj_id, 'ECG-12LEAD', '12-Lead ECG', 'investigation', 300, 300, 150),
        (shilaj_id, 'XRAY-CHEST', 'X-Ray Chest PA', 'radiology', 500, 500, 250),
        (shilaj_id, 'CBC', 'CBC (Complete Blood Count)', 'laboratory', 350, 350, 150),
        (shilaj_id, 'RFT', 'Renal Function Test', 'laboratory', 600, 600, 300),
        (shilaj_id, 'LFT', 'Liver Function Test', 'laboratory', 600, 600, 300),
        (shilaj_id, 'LIPID', 'Lipid Profile', 'laboratory', 500, 500, 250),
        (shilaj_id, 'HBA1C', 'HbA1c', 'laboratory', 450, 450, 200),
        (shilaj_id, 'THYROID', 'Thyroid Profile (TSH/FT3/FT4)', 'laboratory', 700, 700, 350),
        (shilaj_id, 'USG-ABD', 'USG Abdomen', 'radiology', 1200, 1200, 600),
        (shilaj_id, 'ECHO', '2D Echocardiography', 'investigation', 2000, 2000, 1000),
        (shilaj_id, 'TMT', 'Treadmill Test', 'investigation', 1500, 1500, 750),
        (shilaj_id, 'SPIROMETRY', 'Spirometry / PFT', 'investigation', 800, 800, 400),
        (shilaj_id, 'EEG', 'EEG', 'investigation', 2000, 2000, 1000),
        (shilaj_id, 'MRI-BRAIN', 'MRI Brain (Plain)', 'radiology', 5000, 5000, 2500),
        (shilaj_id, 'CT-BRAIN', 'CT Brain (Plain)', 'radiology', 3000, 3000, 1500),
        (shilaj_id, 'INJ-CHARGE', 'Injection Charges', 'procedure', 200, 200, 100),
        (shilaj_id, 'DRESSING', 'Dressing Charges', 'procedure', 300, 300, 150),
        (shilaj_id, 'NEBULIZE', 'Nebulization', 'procedure', 150, 150, 75)
    ON CONFLICT (centre_id, service_code) DO NOTHING;

    RAISE NOTICE 'Tariff seed complete for Shilaj (% items)', 22;
END $$;
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

INSERT INTO hmis_roles (name, description, permissions, is_system) VALUES

-- SUPER ADMIN — everything
('super_admin', 'Full system access — all modules, all actions', '{
  "dashboard": ["view","admin"],
  "patients": ["view","create","edit","delete","print","export","admin"],
  "opd": ["view","create","edit","delete","print","export","admin"],
  "appointments": ["view","create","edit","delete","print","export"],
  "ipd": ["view","create","edit","delete","print","approve","export","admin"],
  "bed_management": ["view","create","edit","admin"],
  "nursing_station": ["view","create","edit","print"],
  "emr": ["view","create","edit","delete","print","export","admin"],
  "billing": ["view","create","edit","delete","print","approve","export","admin"],
  "pharmacy": ["view","create","edit","delete","print","approve","export","admin"],
  "lab": ["view","create","edit","delete","print","approve","export","admin"],
  "blood_bank": ["view","create","edit","print","approve"],
  "radiology": ["view","create","edit","delete","print","approve","export","admin"],
  "ot": ["view","create","edit","print","approve","admin"],
  "vpms": ["view","create","edit","approve","admin"],
  "homecare": ["view","create","edit","print"],
  "reports": ["view","export","admin"],
  "quality": ["view","create","edit","approve","export","admin"],
  "settings": ["view","edit","admin"],
  "command_centre": ["view","admin"]
}'::jsonb, true),

-- ADMIN — everything except settings admin
('admin', 'Hospital administrator — full access except system settings', '{
  "dashboard": ["view"],
  "patients": ["view","create","edit","print","export"],
  "opd": ["view","create","edit","print","export"],
  "appointments": ["view","create","edit","delete","print"],
  "ipd": ["view","create","edit","print","approve","export"],
  "bed_management": ["view","create","edit"],
  "nursing_station": ["view","create","edit","print"],
  "emr": ["view","create","edit","print","export"],
  "billing": ["view","create","edit","print","approve","export"],
  "pharmacy": ["view","create","edit","print","approve","export"],
  "lab": ["view","create","edit","print","approve","export"],
  "blood_bank": ["view","create","edit","print","approve"],
  "radiology": ["view","create","edit","print","approve","export"],
  "ot": ["view","create","edit","print","approve"],
  "vpms": ["view","create","edit","approve"],
  "homecare": ["view","create","edit","print"],
  "reports": ["view","export"],
  "quality": ["view","create","edit","approve","export"],
  "settings": ["view","edit"],
  "command_centre": ["view"]
}'::jsonb, true),

-- DOCTOR — clinical modules
('doctor', 'Consulting / treating physician', '{
  "dashboard": ["view"],
  "patients": ["view","create","edit","print"],
  "opd": ["view","create","edit","print"],
  "appointments": ["view","create","edit"],
  "ipd": ["view","create","edit","print"],
  "bed_management": ["view"],
  "nursing_station": ["view"],
  "emr": ["view","create","edit","print","export"],
  "billing": ["view","print"],
  "pharmacy": ["view"],
  "lab": ["view","create","print"],
  "radiology": ["view","create","print"],
  "ot": ["view","create","edit","print"],
  "reports": ["view"],
  "quality": ["view","create"]
}'::jsonb, true),

-- NURSE — clinical care modules
('nurse', 'Nursing staff — ward, ICU, OT', '{
  "dashboard": ["view"],
  "patients": ["view","edit"],
  "opd": ["view"],
  "appointments": ["view"],
  "ipd": ["view","create","edit","print"],
  "bed_management": ["view","edit"],
  "nursing_station": ["view","create","edit","print"],
  "emr": ["view","create","edit"],
  "pharmacy": ["view"],
  "lab": ["view"],
  "radiology": ["view"],
  "ot": ["view","edit"],
  "quality": ["view","create"]
}'::jsonb, true),

-- RECEPTIONIST — front desk
('receptionist', 'Front desk — registration, appointments, basic billing', '{
  "dashboard": ["view"],
  "patients": ["view","create","edit","print"],
  "opd": ["view","create","edit","print"],
  "appointments": ["view","create","edit","delete","print"],
  "ipd": ["view"],
  "bed_management": ["view"],
  "billing": ["view","create","print"],
  "reports": ["view"]
}'::jsonb, true),

-- BILLING STAFF
('billing_staff', 'Billing and accounts — bills, payments, insurance', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "billing": ["view","create","edit","print","export"],
  "ipd": ["view"],
  "pharmacy": ["view"],
  "reports": ["view","export"]
}'::jsonb, true),

-- BILLING MANAGER — billing + approvals
('billing_manager', 'Billing manager — approve refunds, credit notes, discounts', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "billing": ["view","create","edit","delete","print","approve","export","admin"],
  "ipd": ["view","print"],
  "pharmacy": ["view"],
  "reports": ["view","export"],
  "quality": ["view"]
}'::jsonb, true),

-- PHARMACIST
('pharmacist', 'Pharmacy — dispensing, stock, controlled drugs', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "pharmacy": ["view","create","edit","print","approve","export"],
  "billing": ["view"],
  "reports": ["view"]
}'::jsonb, true),

-- LAB TECHNICIAN
('lab_technician', 'Laboratory — sample collection, results entry, verification', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "lab": ["view","create","edit","print","export"],
  "blood_bank": ["view","create","edit"],
  "reports": ["view"]
}'::jsonb, true),

-- RADIOLOGY TECHNICIAN
('radiology_technician', 'Radiology — imaging, reports', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "radiology": ["view","create","edit","print","export"],
  "reports": ["view"]
}'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_system = EXCLUDED.is_system;


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
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    role, aud, confirmation_token
  ) VALUES (
    v_auth_id, '00000000-0000-0000-0000-000000000000', p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'employee_code', p_employee_code),
    now(), now(), 'authenticated', 'authenticated', ''
  );

  -- Create identity
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (v_auth_id, v_auth_id, jsonb_build_object('sub', v_auth_id, 'email', p_email), 'email', v_auth_id, now(), now(), now());

  -- Create staff record
  INSERT INTO hmis_staff (
    auth_user_id, employee_code, full_name, designation, staff_type,
    department_id, primary_centre_id, phone, email,
    specialisation, medical_reg_no
  ) VALUES (
    v_auth_id, p_employee_code, p_full_name, p_designation, p_staff_type,
    p_department_id, p_centre_id, p_phone, p_email,
    p_specialisation, p_medical_reg_no
  ) RETURNING id INTO v_staff_id;

  -- Assign role at centre
  INSERT INTO hmis_staff_centres (staff_id, centre_id, role_id)
  VALUES (v_staff_id, p_centre_id, v_role_id)
  ON CONFLICT (staff_id, centre_id) DO UPDATE SET role_id = v_role_id;

  -- Assign to department if provided
  IF p_department_id IS NOT NULL THEN
    INSERT INTO hmis_staff_departments (staff_id, department_id, is_primary)
    VALUES (v_staff_id, p_department_id, true)
    ON CONFLICT (staff_id, department_id) DO NOTHING;
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
-- ============================================================
-- Health1 HMIS — Refund Management
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    refund_amount decimal(12,2) NOT NULL,
    reason text NOT NULL,
    refund_mode varchar(20) NOT NULL CHECK (refund_mode IN ('cash','neft','cheque','upi')),
    bank_details text,
    status varchar(15) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','approved','processed','rejected','cancelled')),
    initiated_by uuid NOT NULL REFERENCES hmis_staff(id),
    approved_by uuid REFERENCES hmis_staff(id),
    approved_at timestamptz,
    processed_by uuid REFERENCES hmis_staff(id),
    processed_at timestamptz,
    utr_number varchar(50),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_centre ON hmis_refunds(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_refunds_bill ON hmis_refunds(bill_id);

ALTER TABLE hmis_refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_refunds_pol ON hmis_refunds;
CREATE POLICY hmis_refunds_pol ON hmis_refunds FOR ALL USING (auth.uid() IS NOT NULL);
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
-- ============================================================
-- Health1 HMIS — Pharmacy v2 (Returns, Transfers, Controlled)
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Pharmacy Returns & Write-offs
CREATE TABLE IF NOT EXISTS hmis_pharmacy_returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    quantity decimal(10,2) NOT NULL,
    batch_number varchar(30),
    return_type varchar(20) NOT NULL CHECK (return_type IN ('patient_return','supplier_return','expiry_write_off','damage')),
    reason text NOT NULL,
    patient_id uuid REFERENCES hmis_patients(id),
    dispensing_id uuid,
    refund_amount decimal(10,2) DEFAULT 0,
    status varchar(15) NOT NULL DEFAULT 'processed',
    processed_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rx_returns_centre ON hmis_pharmacy_returns(centre_id, return_type);

-- 2. Inter-Centre Stock Transfers
CREATE TABLE IF NOT EXISTS hmis_pharmacy_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    to_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    quantity decimal(10,2) NOT NULL,
    batch_number varchar(30),
    reason text,
    status varchar(15) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','in_transit','received','cancelled')),
    initiated_by uuid NOT NULL REFERENCES hmis_staff(id),
    received_by uuid REFERENCES hmis_staff(id),
    received_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

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

-- STEP 1C DONE. Now run STEP2.
