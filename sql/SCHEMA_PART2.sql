-- ── SOURCE: sql/blood_bank_migration.sql ──
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
    temperature decimal(4,1),
    -- Deferral
    is_deferred boolean NOT NULL DEFAULT false,
    deferral_reason text,
    deferral_type varchar(10) CHECK (deferral_type IN ('temporary','permanent')),
    -- Status
    total_donations int NOT NULL DEFAULT 0,
    last_donation_date date,
    is_active boolean NOT NULL DEFAULT true,
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bb_donors_group ON hmis_bb_donors(blood_group);


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


-- 3. Blood Components (separated from whole blood)
CREATE TABLE IF NOT EXISTS hmis_bb_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_number varchar(30) NOT NULL UNIQUE,
    donation_id uuid NOT NULL REFERENCES hmis_bb_donations(id),
    component_type varchar(30) NOT NULL CHECK (component_type IN (
    )),
    blood_group varchar(5) NOT NULL,
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
    -- Pre-transfusion vitals
    pre_temp decimal(4,1),
    -- Post-transfusion vitals
    post_temp decimal(4,1),
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


-- ── SOURCE: sql/homecare_migration.sql ──
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


-- 2. Home Visits
CREATE TABLE IF NOT EXISTS hmis_hc_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    visit_number int NOT NULL DEFAULT 1,
    scheduled_date date NOT NULL,
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
    temperature decimal(4,1),
    spo2 decimal(4,1),
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


-- ── SOURCE: sql/emr_v3_migration.sql ──
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

    BEFORE UPDATE ON hmis_emr_encounters
    EXECUTE FUNCTION update_emr_encounter_timestamp();

-- Also run on insert
    EXECUTE FUNCTION update_emr_encounter_timestamp();

-- RLS Policies
ALTER TABLE hmis_emr_encounters ENABLE ROW LEVEL SECURITY;

-- Doctors can read/write encounters they created
CREATE POLICY emr_encounters_doctor_all ON hmis_emr_encounters
        )
    );

-- Staff at same centre can read
CREATE POLICY emr_encounters_centre_read ON hmis_emr_encounters
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
        )
    );

CREATE POLICY emr_templates_shared_read ON hmis_emr_templates


-- ── SOURCE: sql/revenue_cycle_migration.sql ──
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


-- ── SOURCE: sql/charge_capture_migration.sql ──
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

-- Daily charges (trigger_type = 'daily')

-- ============================================================
-- RPC: Run daily auto-charges for a centre
-- ============================================================

-- ── SOURCE: sql/revenue_loop_migration.sql ──
-- ============================================================
-- Health1 HMIS — Revenue Loop Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- Adds: pharmacy stock, dispensing, tariff seed, token sequence
-- ============================================================
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
);
CREATE POLICY pharm_disp_centre ON hmis_pharmacy_dispensing FOR ALL USING (
);

-- Token sequence helper

-- Visit number sequence

-- Bill number sequence

-- Receipt number sequence

-- ============================================================
-- SEED: Common OPD tariff items (Shilaj centre)
-- Update centre_id to match your actual Shilaj centre UUID
-- ============================================================


-- ── SOURCE: sql/nhcx_integration.sql ──
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

UPDATE hmis_tpas SET nhcx_code = CASE


-- ── SOURCE: sql/rbac_permissions.sql ──
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



-- ============================================================
-- 3. BATCH USER CREATION (for CSV import)
-- ============================================================


-- ── SOURCE: sql/cpoe_migration.sql ──
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


-- ── SOURCE: sql/refund_migration.sql ──
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


-- ── SOURCE: sql/packages_opd_billing.sql ──
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


-- ── SOURCE: sql/pharmacy_v2_migration.sql ──
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



-- ── SOURCE: sql/lab_instrument_migration.sql ──
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


-- ── SOURCE: sql/bc5000_parameters.sql ──
-- ============================================================
-- Add BC-5000 specific parameters to CBC test
-- Run in Supabase SQL Editor
-- ============================================================



-- ── SOURCE: sql/command_centre_rpcs.sql ──
-- ============================================================
-- Health1 HMIS — Command Centre Server-Side Aggregation
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Bed Census — single query, grouped by centre

-- ── SOURCE: sql/quality_nabh_migration.sql ──
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



-- ── SOURCE: sql/crm_migration.sql ──
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


-- ── SOURCE: sql/modules_9_migration.sql ──
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
CREATE TABLE IF NOT EXISTS hmis_diet_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  diet_type varchar(30) NOT NULL, -- regular, diabetic, renal, liquid, soft, npo, high_protein, low_salt, cardiac
  special_instructions text,
  allergies text[], -- food allergies
  meal_plan jsonb DEFAULT '{}', -- { breakfast: true, lunch: true, dinner: true, snacks: true }
  calorie_target integer,
  protein_target integer,
  ordered_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'active', -- active, modified, discontinued
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamp with time zone DEFAULT now()
);

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
CREATE TABLE IF NOT EXISTS hmis_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  referral_type varchar(20) NOT NULL, -- internal, external_in, external_out
  -- Referring
  referring_doctor_name varchar(200),
  referring_doctor_phone varchar(20),
  referring_doctor_reg varchar(50), -- MCI/state reg number
  referring_hospital varchar(200),
  referring_city varchar(100),
  -- Referred to
  referred_to_doctor_id uuid REFERENCES hmis_staff(id),
  referred_to_department varchar(100),
  -- Clinical
  reason text,
  diagnosis varchar(200),
  urgency varchar(10) DEFAULT 'routine', -- emergency, urgent, routine
  -- Tracking
  status varchar(20) DEFAULT 'received', -- received, appointment_made, visited, admitted, completed, lost
  appointment_id uuid,
  admission_id uuid REFERENCES hmis_admissions(id),
  -- Revenue
  expected_revenue decimal(12,2) DEFAULT 0,
  actual_revenue decimal(12,2) DEFAULT 0,
  referral_fee_pct decimal(5,2) DEFAULT 0,
  referral_fee_amount decimal(12,2) DEFAULT 0,
  fee_paid boolean DEFAULT false,
  fee_paid_date date,
  -- Meta
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_centre ON hmis_referrals(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_doctor ON hmis_referrals(referring_doctor_phone);

-- ============================================================
-- 9. PACKAGE MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  package_code varchar(50),
  package_name varchar(200) NOT NULL,
  department varchar(100),
  category varchar(30), -- surgical, medical, daycare, diagnostic, maternity
  procedure_type varchar(200),
  -- Pricing
  package_rate decimal(12,2) NOT NULL,
  rate_insurance decimal(12,2),
  rate_pmjay decimal(12,2),
  rate_cghs decimal(12,2),
  -- Inclusions
  inclusions jsonb NOT NULL DEFAULT '[]', -- [{category, item, included_qty, included_days}]
  exclusions text[], -- items NOT included
  los_days integer DEFAULT 3, -- expected length of stay
  room_category varchar(20) DEFAULT 'general', -- general, semi_private, private
  -- Validity
  is_active boolean DEFAULT true,
  -- Meta
  created_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
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


-- ── SOURCE: sql/modules_15_17_migration.sql ──
-- Health1 HMIS — Modules 15-17 Migration
-- Ambulance/Transport, Visitor Management, Asset Management

-- ============================================================
-- 15. AMBULANCE & TRANSPORT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_ambulances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  vehicle_number varchar(20) NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'bls', -- als, bls, patient_transport, neonatal, mortuary
  make varchar(50),
  model varchar(50),
  year integer,
  driver_name varchar(200),
  driver_phone varchar(20),
  driver_license varchar(50),
  emt_name varchar(200),
  emt_phone varchar(20),
  status varchar(20) DEFAULT 'available', -- available, on_trip, maintenance, out_of_service
  current_location varchar(200),
  fuel_level varchar(10), -- full, 3/4, half, 1/4, empty
  last_sanitized timestamp with time zone,
  equipment_checklist jsonb DEFAULT '{}', -- {oxygen: true, defibrillator: true, stretcher: true}
  odometer_km integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
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
  amc_vendor varchar(200),
  amc_start_date date,
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


-- ── SOURCE: sql/modules_18_21_migration.sql ──
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


-- ── SOURCE: sql/procurement_migration.sql ──
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


-- ── SOURCE: sql/cdss_ml_migration.sql ──
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


-- ── SOURCE: sql/patient_portal_migration.sql ──
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




-- ════════════════════════════════════════════════════════════════
-- SCHEMA COMPLETE: 212 tables created
-- ════════════════════════════════════════════════════════════════