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
