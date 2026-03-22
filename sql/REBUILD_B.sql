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
