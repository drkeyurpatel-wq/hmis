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
INSERT INTO hmis_radiology_templates (modality, body_part, template_name, technique_text, findings_template, impression_template, is_normal) VALUES
('XR', 'Chest', 'CXR - Normal', 'PA view of chest obtained.', 'Heart size is normal. Mediastinum is within normal limits. Both lung fields are clear with no focal consolidation, effusion, or pneumothorax. Both costophrenic angles are clear. Bony thorax appears intact.', 'Normal chest radiograph.', true),
('XR', 'Chest', 'CXR - Pneumonia', 'PA view of chest obtained.', 'Heart size is normal. There is a focal area of consolidation noted in the {right/left} {upper/middle/lower} zone. No pleural effusion seen. Costophrenic angles are {clear/blunted}.', 'Findings suggestive of pneumonia in the {location}. Clinical correlation advised.', false),
('XR', 'Chest', 'CXR - Cardiomegaly', 'PA view of chest obtained.', 'Heart is enlarged with cardiothoracic ratio of approximately {0.xx}. Pulmonary vasculature appears {normal/prominent}. Both lung fields show {clear/congestion}. Costophrenic angles are {clear/blunted}.', 'Cardiomegaly with {features}. Echocardiography recommended.', false),
('CT', 'Brain', 'CT Brain - Normal', 'Non-contrast CT of the brain was performed with axial sections.', 'Both cerebral hemispheres are symmetrical. No focal area of abnormal attenuation seen. Ventricular system is normal in size and configuration. Basal cisterns are patent. Midline structures are in normal position. No extra-axial collection seen. Calvarium appears intact.', 'Normal non-contrast CT brain.', true),
('CT', 'Brain', 'CT Brain - Infarct', 'Non-contrast CT of the brain was performed with axial sections.', 'There is a hypodense area involving the {territory} territory, suggestive of acute/subacute infarction. The ventricular system is {normal/compressed}. Midline shift of approximately {X} mm is noted towards the {side}. No hemorrhagic transformation seen.', 'Acute infarction in the {territory} territory. MRI brain with DWI recommended for further evaluation.', false),
('CT', 'Abdomen', 'CT Abdomen - Normal', 'Contrast-enhanced CT of abdomen and pelvis was performed.', 'Liver is normal in size with homogeneous attenuation. No focal hepatic lesion seen. Gallbladder is normal. Bile ducts are not dilated. Pancreas, spleen, and both adrenal glands are normal. Both kidneys show normal size, shape and enhancement. No calculus or hydronephrosis. Urinary bladder is normal. No free fluid or lymphadenopathy.', 'Normal CECT abdomen and pelvis.', true),
('MRI', 'Brain', 'MRI Brain - Normal', 'MRI of the brain was performed with T1W, T2W, FLAIR, DWI sequences.', 'Both cerebral hemispheres show normal signal intensity. No restricted diffusion seen on DWI. No abnormal enhancement on post-contrast images. Ventricular system and sulcal spaces are normal for age. Corpus callosum, brainstem, and cerebellum are normal. Pituitary gland is normal. No extra-axial collection.', 'Normal MRI brain.', true),
('MRI', 'Knee', 'MRI Knee - Normal', 'MRI of the {right/left} knee was performed with PD, T1W, T2W STIR sequences.', 'ACL and PCL are intact with normal signal. Medial and lateral menisci show normal morphology and signal. Medial and lateral collateral ligaments are intact. Articular cartilage is preserved. No joint effusion. Patellofemoral alignment is normal. No bone marrow edema.', 'Normal MRI {right/left} knee.', true),
('MRI', 'Spine', 'MRI LS Spine - Normal', 'MRI of the lumbosacral spine was performed with T1W, T2W sagittal and axial sequences.', 'Vertebral bodies show normal height and signal. Intervertebral discs show normal signal and height at all levels. No disc herniation or bulge seen. Spinal canal is adequate. Conus medullaris terminates normally at L1-L2 level. No compression of nerve roots. Paravertebral soft tissues are normal.', 'Normal MRI lumbosacral spine.', true),
('USG', 'Abdomen', 'USG Abdomen - Normal', 'Ultrasound of abdomen and pelvis performed.', 'Liver: Normal size, homogeneous echotexture, no focal lesion. Portal vein is normal. Gallbladder: Normal wall thickness, no calculi. CBD is not dilated. Pancreas: Normal. Spleen: Normal size. Both kidneys: Normal size, shape, and corticomedullary differentiation. No calculus or hydronephrosis. Urinary bladder: Normal wall, no calculus. No free fluid in peritoneal cavity.', 'Normal ultrasound abdomen.', true),
('USG', 'Abdomen', 'USG Abdomen - Cholelithiasis', 'Ultrasound of abdomen and pelvis performed.', 'Liver: Normal size, homogeneous echotexture. Gallbladder: Contains {single/multiple} echogenic foci with posterior acoustic shadowing, largest measuring approximately {X} mm. Wall thickness is {normal/thickened}. CBD measures {X} mm. Pancreas, spleen, kidneys: Normal.', 'Cholelithiasis {with/without cholecystitis}. Surgical consultation advised.', false),
('ECHO', 'Heart', 'Echocardiography - Normal', '2D echocardiography with M-mode and color Doppler performed.', 'LV: Normal size, wall thickness and systolic function. LVEF approximately {55-65}% by modified Simpson method. No RWMA. RV: Normal size and function. TAPSE {18-25} mm. Valves: All valves are morphologically normal with no significant stenosis or regurgitation. IAS/IVS: Intact. Pericardium: No effusion. IVC: Normal caliber with adequate respiratory variation.', 'Normal echocardiographic study. LVEF {55-65}%.', true),
('ECHO', 'Heart', 'Echocardiography - LV Dysfunction', '2D echocardiography with M-mode and color Doppler performed.', 'LV: {Mildly/Moderately/Severely} dilated. Wall thickness is {normal/increased}. Global hypokinesia noted. LVEF approximately {XX}% by modified Simpson method. RWMA noted in {territory}. RV: {Normal/Dilated}. Mitral valve shows {mild/moderate/severe} regurgitation. Aortic valve is {normal/calcified}.', 'LV systolic dysfunction with LVEF {XX}%. {RWMA in territory}. {Valve findings}.', false)
ON CONFLICT DO NOTHING;

-- SEED: Radiology test master (if empty)
INSERT INTO hmis_radiology_test_master (test_code, test_name, modality, body_part, tat_hours, is_contrast) VALUES
('XR-CHEST', 'X-Ray Chest PA', 'XR', 'Chest', 2, false),
('XR-ABDOMEN', 'X-Ray Abdomen Erect', 'XR', 'Abdomen', 2, false),
('XR-SPINE-LS', 'X-Ray LS Spine AP/Lat', 'XR', 'Spine', 2, false),
('XR-KNEE', 'X-Ray Knee AP/Lat', 'XR', 'Knee', 2, false),
('XR-HIP', 'X-Ray Pelvis with Both Hips', 'XR', 'Hip', 2, false),
('CT-BRAIN-PLAIN', 'CT Brain Plain', 'CT', 'Brain', 4, false),
('CT-BRAIN-CECT', 'CT Brain with Contrast', 'CT', 'Brain', 4, true),
('CT-CHEST-HRCT', 'HRCT Chest', 'CT', 'Chest', 6, false),
('CT-ABDOMEN', 'CECT Abdomen + Pelvis', 'CT', 'Abdomen', 6, true),
('CT-KUB', 'CT KUB (Non-contrast)', 'CT', 'Abdomen', 4, false),
('CT-ANGIO-BRAIN', 'CT Angiography Brain', 'CT', 'Brain', 4, true),
('CT-ANGIO-CHEST', 'CT Pulmonary Angiography', 'CT', 'Chest', 4, true),
('CT-ANGIO-CORONARY', 'CT Coronary Angiography', 'CT', 'Heart', 6, true),
('MRI-BRAIN', 'MRI Brain', 'MRI', 'Brain', 24, false),
('MRI-BRAIN-CE', 'MRI Brain with Contrast', 'MRI', 'Brain', 24, true),
('MRI-SPINE-C', 'MRI Cervical Spine', 'MRI', 'Spine', 24, false),
('MRI-SPINE-LS', 'MRI Lumbosacral Spine', 'MRI', 'Spine', 24, false),
('MRI-KNEE', 'MRI Knee', 'MRI', 'Knee', 24, false),
('MRI-SHOULDER', 'MRI Shoulder', 'MRI', 'Shoulder', 24, false),
('MRI-ABDOMEN', 'MRI Abdomen', 'MRI', 'Abdomen', 24, true),
('MRI-MRCP', 'MRCP', 'MRI', 'Abdomen', 24, false),
('USG-ABDOMEN', 'USG Abdomen + Pelvis', 'USG', 'Abdomen', 2, false),
('USG-KUB', 'USG KUB', 'USG', 'Abdomen', 2, false),
('USG-THYROID', 'USG Thyroid', 'USG', 'Neck', 2, false),
('USG-BREAST', 'USG Breast', 'USG', 'Breast', 2, false),
('USG-OBSTETRIC', 'USG Obstetric', 'USG', 'Pelvis', 2, false),
('USG-DOPPLER-CAROTID', 'Carotid Doppler', 'USG', 'Neck', 4, false),
('USG-DOPPLER-VENOUS', 'Venous Doppler Lower Limb', 'USG', 'Leg', 4, false),
('ECHO-2D', '2D Echocardiography', 'ECHO', 'Heart', 4, false),
('ECHO-STRESS', 'Stress Echocardiography', 'ECHO', 'Heart', 6, false),
('ECHO-TEE', 'Transesophageal Echo', 'ECHO', 'Heart', 6, false),
('DEXA', 'DEXA Scan', 'DEXA', 'Whole Body', 24, false),
('MAMMO', 'Mammography Bilateral', 'MAMMO', 'Breast', 24, false),
('FLUORO', 'Fluoroscopy', 'FLUORO', 'Variable', 2, false)
ON CONFLICT (test_code) DO NOTHING;
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

-- PART 2 COMPLETE. Now run FRESH_PART3.sql
