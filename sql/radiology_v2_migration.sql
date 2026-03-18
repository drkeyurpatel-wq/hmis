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
INSERT INTO hmis_radiology_protocols (modality, body_part, protocol_name, prep_instructions, patient_instructions, contrast_required, fasting_hours, estimated_duration_min, radiation_dose_msv) VALUES
('CT', 'Brain', 'CT Brain Plain', 'Remove metallic objects from head/neck', 'Lie still during scan. Takes 5-10 minutes.', false, 0, 10, 2.0),
('CT', 'Brain', 'CT Brain with Contrast', 'Check creatinine (must be <1.5). Check contrast allergy. IV access required.', 'Fasting 4 hours before scan. Remove metallic objects. Inform staff of any allergies.', true, 4, 15, 4.0),
('CT', 'Abdomen', 'CECT Abdomen + Pelvis', 'Check creatinine. IV access. Oral contrast 1 hour before scan.', 'Fasting 6 hours. Drink oral contrast as given by technician. Remove belt/jewelry.', true, 6, 20, 10.0),
('CT', 'Chest', 'HRCT Chest', 'No special preparation needed', 'Breathe in and hold when instructed. Takes 10 minutes.', false, 0, 10, 7.0),
('CT', 'Chest', 'CT Pulmonary Angiography', 'Check creatinine. IV access (18G antecubital). Breath-hold training.', 'Fasting 4 hours. IV line will be placed. Hold breath when asked.', true, 4, 15, 5.0),
('MRI', 'Brain', 'MRI Brain', 'MRI safety screening form mandatory. Remove all metal. Check for implants/pacemaker.', 'No metal objects allowed in MRI room. Scan takes 30-40 minutes. You will hear loud noises.', false, 0, 40, 0),
('MRI', 'Brain', 'MRI Brain with Contrast', 'MRI safety screening. Check GFR (must be >30 for gadolinium). IV access.', 'Fasting 4 hours. No metal in MRI room. Inform about kidney problems.', true, 4, 45, 0),
('MRI', 'Spine', 'MRI Lumbosacral Spine', 'MRI safety screening. Remove all metal.', 'Lie still for 25-30 minutes. No metal objects.', false, 0, 30, 0),
('MRI', 'Knee', 'MRI Knee', 'MRI safety screening. Remove all metal from legs.', 'Lie still for 20-25 minutes. Inform about any knee implants.', false, 0, 25, 0),
('USG', 'Abdomen', 'USG Abdomen', 'Fasting 6 hours for upper abdomen. Full bladder for pelvis.', 'Do not eat or drink for 6 hours before scan. Drink 4-5 glasses of water 1 hour before and hold urine.', false, 6, 20, 0),
('USG', 'Pelvis', 'USG Obstetric', 'Full bladder for first trimester', 'Drink water and hold urine for early pregnancy scans.', false, 0, 20, 0),
('ECHO', 'Heart', '2D Echocardiography', 'No special preparation', 'Wear loose clothing. Scan takes 20-30 minutes.', false, 0, 25, 0),
('ECHO', 'Heart', 'Stress Echocardiography', 'Hold beta-blockers 48h, caffeine 24h. Wear comfortable shoes.', 'You will walk on treadmill. Fasting 4 hours. Wear exercise clothes.', false, 4, 45, 0),
('XR', 'Chest', 'X-Ray Chest PA', 'Remove jewelry, bra hooks, metallic items from chest', 'Stand facing the detector. Take a deep breath when asked.', false, 0, 5, 0.02),
('MAMMO', 'Breast', 'Mammography Bilateral', 'Schedule 1 week after menstruation. No deodorant/powder on day.', 'Do not apply deodorant or powder. Wear two-piece clothing. Some compression discomfort is normal.', false, 0, 15, 0.4),
('DEXA', 'Whole Body', 'DEXA Scan', 'No calcium supplements 24 hours before', 'Lie flat and still for 10-15 minutes.', false, 0, 15, 0.001)
ON CONFLICT DO NOTHING;
