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
-- Add BC-5000 specific parameters to CBC test
-- Run in Supabase SQL Editor
-- ============================================================

DO $$
DECLARE cbc_id uuid;
BEGIN
    SELECT id INTO cbc_id FROM hmis_lab_test_master WHERE test_code = 'CBC';
    
    IF cbc_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, data_type, sort_order) VALUES
    -- Absolute counts (BC-5000 outputs these)
    (cbc_id, 'NEUT_ABS', 'Neutrophils (Absolute)', 'x10^3/uL', 2.0, 7.0, 'numeric', 20),
    (cbc_id, 'LYMPH_ABS', 'Lymphocytes (Absolute)', 'x10^3/uL', 1.0, 3.0, 'numeric', 21),
    (cbc_id, 'MONO_ABS', 'Monocytes (Absolute)', 'x10^3/uL', 0.2, 0.8, 'numeric', 22),
    (cbc_id, 'EOS_ABS', 'Eosinophils (Absolute)', 'x10^3/uL', 0.02, 0.5, 'numeric', 23),
    (cbc_id, 'BASO_ABS', 'Basophils (Absolute)', 'x10^3/uL', 0.0, 0.1, 'numeric', 24),
    -- RDW-SD
    (cbc_id, 'RDW_SD', 'RDW-SD', 'fL', 39, 46, 'numeric', 25),
    -- Platelet indices
    (cbc_id, 'PDW', 'Platelet Distribution Width', 'fL', 9, 17, 'numeric', 26),
    (cbc_id, 'PCT', 'Plateletcrit', '%', 0.17, 0.35, 'numeric', 27),
    (cbc_id, 'PLCR', 'Platelet Large Cell Ratio', '%', 13, 43, 'numeric', 28),
    (cbc_id, 'PLCC', 'Platelet Large Cell Count', 'x10^3/uL', NULL, NULL, 'numeric', 29)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    
    RAISE NOTICE 'BC-5000 parameters added: 10 new CBC parameters';
    END IF;
END $$;

-- STEP 1B DONE. Now run STEP1C.
