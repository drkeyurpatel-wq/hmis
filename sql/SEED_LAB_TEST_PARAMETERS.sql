-- ============================================================
-- Lab Test Parameters Seed Data
-- Tests: CBC, LFT, RFT, Lipid Profile, Blood Sugar, Thyroid
-- Reference ranges: Adult male/female specific where applicable
-- Generated: 2026-04-05
--
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- Safe to re-run: uses ON CONFLICT DO NOTHING throughout
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- STEP 1: Ensure test master records exist
-- ════════════════════════════════════════════════════════════

INSERT INTO hmis_lab_test_master (test_code, test_name, category, sample_type, tat_hours, is_panel) VALUES
('CBC',   'Complete Blood Count',      'Hematology',    'blood', 2,  false),
('LFT',   'Liver Function Test',       'Biochemistry',  'blood', 4,  true),
('RFT',   'Renal Function Test',       'Biochemistry',  'blood', 4,  true),
('LIPID', 'Lipid Profile',             'Biochemistry',  'blood', 4,  true),
('FBS',   'Fasting Blood Sugar',       'Biochemistry',  'blood', 1,  false),
('PPBS',  'Post Prandial Blood Sugar', 'Biochemistry',  'blood', 2,  false),
('RBS',   'Random Blood Sugar',        'Biochemistry',  'blood', 1,  false),
('HBA1C', 'HbA1c (Glycosylated Hb)',   'Biochemistry',  'blood', 6,  false),
('TFT',   'Thyroid Function Test',     'Endocrinology', 'blood', 6,  true),
('TSH',   'Thyroid Stimulating Hormone','Endocrinology', 'blood', 6,  false)
ON CONFLICT (test_code) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- STEP 2: Insert parameters and gender-specific reference ranges
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_cbc   uuid;
    v_lft   uuid;
    v_rft   uuid;
    v_lipid uuid;
    v_fbs   uuid;
    v_ppbs  uuid;
    v_rbs   uuid;
    v_hba1c uuid;
    v_tft   uuid;
    v_tsh   uuid;
    v_param uuid;
BEGIN
    -- Look up master IDs
    SELECT id INTO v_cbc   FROM hmis_lab_test_master WHERE test_code = 'CBC';
    SELECT id INTO v_lft   FROM hmis_lab_test_master WHERE test_code = 'LFT';
    SELECT id INTO v_rft   FROM hmis_lab_test_master WHERE test_code = 'RFT';
    SELECT id INTO v_lipid FROM hmis_lab_test_master WHERE test_code = 'LIPID';
    SELECT id INTO v_fbs   FROM hmis_lab_test_master WHERE test_code = 'FBS';
    SELECT id INTO v_ppbs  FROM hmis_lab_test_master WHERE test_code = 'PPBS';
    SELECT id INTO v_rbs   FROM hmis_lab_test_master WHERE test_code = 'RBS';
    SELECT id INTO v_hba1c FROM hmis_lab_test_master WHERE test_code = 'HBA1C';
    SELECT id INTO v_tft   FROM hmis_lab_test_master WHERE test_code = 'TFT';
    SELECT id INTO v_tsh   FROM hmis_lab_test_master WHERE test_code = 'TSH';

    -- ────────────────────────────────────────────────────────
    -- CBC (Complete Blood Count) - 13 parameters
    -- ────────────────────────────────────────────────────────
    IF v_cbc IS NOT NULL THEN

    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, delta_check_percent, sort_order)
    VALUES
        (v_cbc, 'HB',    'Hemoglobin (Hb)',       'g/dL',        'numeric', 1, 12.0,   16.0,   5.0,  20.0, 30, 1),
        (v_cbc, 'TLC',   'Total Leucocyte Count', '/cumm',       'numeric', 0, 4000,   11000,  2000, 30000, 50, 2),
        (v_cbc, 'PLT',   'Platelet Count',        '/cumm',       'numeric', 0, 150000, 400000, 20000, 1000000, 50, 3),
        (v_cbc, 'RBC',   'RBC Count',             'million/cumm','numeric', 2, 3.8,    5.5,    2.0,  8.0,  25, 4),
        (v_cbc, 'PCV',   'PCV / Hematocrit',      '%',           'numeric', 1, 36.0,   48.0,   15.0, 65.0, 25, 5),
        (v_cbc, 'MCV',   'MCV',                   'fL',          'numeric', 1, 80.0,   100.0,  NULL, NULL, NULL, 6),
        (v_cbc, 'MCH',   'MCH',                   'pg',          'numeric', 1, 27.0,   33.0,   NULL, NULL, NULL, 7),
        (v_cbc, 'MCHC',  'MCHC',                  'g/dL',        'numeric', 1, 31.5,   34.5,   NULL, NULL, NULL, 8),
        (v_cbc, 'NEUT',  'DLC - Neutrophils',     '%',           'numeric', 1, 40.0,   70.0,   NULL, NULL, NULL, 9),
        (v_cbc, 'LYMPH', 'DLC - Lymphocytes',     '%',           'numeric', 1, 20.0,   40.0,   NULL, NULL, NULL, 10),
        (v_cbc, 'MONO',  'DLC - Monocytes',       '%',           'numeric', 1, 2.0,    8.0,    NULL, NULL, NULL, 11),
        (v_cbc, 'EOS',   'DLC - Eosinophils',     '%',           'numeric', 1, 1.0,    6.0,    NULL, NULL, NULL, 12),
        (v_cbc, 'BASO',  'DLC - Basophils',       '%',           'numeric', 1, 0.0,    2.0,    NULL, NULL, NULL, 13)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;

    -- Gender-specific ref ranges: Hemoglobin
    SELECT id INTO v_param FROM hmis_lab_test_parameters WHERE test_id = v_cbc AND parameter_code = 'HB';
    IF v_param IS NOT NULL THEN
        INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit) VALUES
        (v_param, 'male',   18, 150, 13.0, 17.0, 'g/dL'),
        (v_param, 'female', 18, 150, 12.0, 16.0, 'g/dL')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Gender-specific ref ranges: RBC Count
    SELECT id INTO v_param FROM hmis_lab_test_parameters WHERE test_id = v_cbc AND parameter_code = 'RBC';
    IF v_param IS NOT NULL THEN
        INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit) VALUES
        (v_param, 'male',   18, 150, 4.5, 5.5, 'million/cumm'),
        (v_param, 'female', 18, 150, 3.8, 4.8, 'million/cumm')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Gender-specific ref ranges: PCV / Hematocrit
    SELECT id INTO v_param FROM hmis_lab_test_parameters WHERE test_id = v_cbc AND parameter_code = 'PCV';
    IF v_param IS NOT NULL THEN
        INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit) VALUES
        (v_param, 'male',   18, 150, 40.0, 54.0, '%'),
        (v_param, 'female', 18, 150, 36.0, 48.0, '%')
        ON CONFLICT DO NOTHING;
    END IF;

    END IF; -- end CBC

    -- ────────────────────────────────────────────────────────
    -- LFT (Liver Function Test) - 9 parameters
    -- ────────────────────────────────────────────────────────
    IF v_lft IS NOT NULL THEN

    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, sort_order)
    VALUES
        (v_lft, 'TBIL', 'Total Bilirubin',       'mg/dL', 'numeric', 1, 0.1,  1.2,  NULL, 15.0, 1),
        (v_lft, 'DBIL', 'Direct Bilirubin',      'mg/dL', 'numeric', 1, 0.0,  0.3,  NULL, NULL, 2),
        (v_lft, 'SGOT', 'SGOT / AST',            'U/L',   'numeric', 0, 5.0,  40.0, NULL, 1000, 3),
        (v_lft, 'SGPT', 'SGPT / ALT',            'U/L',   'numeric', 0, 7.0,  56.0, NULL, 1000, 4),
        (v_lft, 'ALP',  'Alkaline Phosphatase',   'U/L',   'numeric', 0, 44.0, 147.0,NULL, NULL, 5),
        (v_lft, 'TP',   'Total Protein',          'g/dL',  'numeric', 1, 6.0,  8.3,  NULL, NULL, 6),
        (v_lft, 'ALB',  'Albumin',                'g/dL',  'numeric', 1, 3.5,  5.5,  1.5,  NULL, 7),
        (v_lft, 'GLOB', 'Globulin',               'g/dL',  'numeric', 1, 2.0,  3.5,  NULL, NULL, 8),
        (v_lft, 'AG',   'A/G Ratio',              NULL,    'formula', 2, 1.0,  2.5,  NULL, NULL, 9)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;

    -- Set formula for A/G Ratio
    UPDATE hmis_lab_test_parameters
    SET formula = 'ALB / GLOB'
    WHERE test_id = v_lft AND parameter_code = 'AG' AND formula IS NULL;

    END IF; -- end LFT

    -- ────────────────────────────────────────────────────────
    -- RFT / KFT (Renal Function Test) - 8 parameters
    -- ────────────────────────────────────────────────────────
    IF v_rft IS NOT NULL THEN

    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, delta_check_percent, sort_order)
    VALUES
        (v_rft, 'UREA',  'Blood Urea',      'mg/dL',  'numeric', 1, 15.0,  40.0,  NULL,  100.0, 50, 1),
        (v_rft, 'CREAT', 'Serum Creatinine', 'mg/dL',  'numeric', 2, 0.6,   1.3,   NULL,  10.0,  50, 2),
        (v_rft, 'URIC',  'Uric Acid',        'mg/dL',  'numeric', 1, 2.4,   7.0,   NULL,  15.0,  NULL, 3),
        (v_rft, 'NA',    'Sodium',            'mEq/L',  'numeric', 0, 136.0, 145.0, 120.0, 160.0, 10, 4),
        (v_rft, 'K',     'Potassium',         'mEq/L',  'numeric', 1, 3.5,   5.1,   2.5,   6.5,   20, 5),
        (v_rft, 'CL',    'Chloride',          'mEq/L',  'numeric', 0, 98.0,  106.0, 80.0,  120.0, NULL, 6),
        (v_rft, 'CA',    'Calcium',           'mg/dL',  'numeric', 1, 8.5,   10.5,  6.0,   14.0,  15, 7),
        (v_rft, 'PHOS',  'Phosphorus',        'mg/dL',  'numeric', 1, 2.5,   4.5,   1.0,   9.0,   NULL, 8)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;

    -- Gender-specific ref ranges: Serum Creatinine
    SELECT id INTO v_param FROM hmis_lab_test_parameters WHERE test_id = v_rft AND parameter_code = 'CREAT';
    IF v_param IS NOT NULL THEN
        INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit) VALUES
        (v_param, 'male',   18, 150, 0.7, 1.3, 'mg/dL'),
        (v_param, 'female', 18, 150, 0.6, 1.1, 'mg/dL')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Gender-specific ref ranges: Uric Acid
    SELECT id INTO v_param FROM hmis_lab_test_parameters WHERE test_id = v_rft AND parameter_code = 'URIC';
    IF v_param IS NOT NULL THEN
        INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit) VALUES
        (v_param, 'male',   18, 150, 3.4, 7.0, 'mg/dL'),
        (v_param, 'female', 18, 150, 2.4, 6.0, 'mg/dL')
        ON CONFLICT DO NOTHING;
    END IF;

    END IF; -- end RFT

    -- ────────────────────────────────────────────────────────
    -- Lipid Profile - 5 parameters
    -- ────────────────────────────────────────────────────────
    IF v_lipid IS NOT NULL THEN

    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_high, sort_order, ref_range_text)
    VALUES
        (v_lipid, 'TCHOL', 'Total Cholesterol', 'mg/dL', 'numeric', 0, 0,   200, 500,  1, 'Desirable: <200, Borderline: 200-239, High: >=240'),
        (v_lipid, 'TG',    'Triglycerides',     'mg/dL', 'numeric', 0, 0,   150, 1000, 2, 'Normal: <150, Borderline: 150-199, High: 200-499, Very High: >=500'),
        (v_lipid, 'HDL',   'HDL Cholesterol',   'mg/dL', 'numeric', 0, 40,  999, NULL, 3, 'Low: <40 (M) / <50 (F), Desirable: >=60'),
        (v_lipid, 'LDL',   'LDL Cholesterol',   'mg/dL', 'numeric', 0, 0,   100, NULL, 4, 'Optimal: <100, Near optimal: 100-129, Borderline: 130-159, High: >=160'),
        (v_lipid, 'VLDL',  'VLDL Cholesterol',  'mg/dL', 'numeric', 0, 5,   40,  NULL, 5, NULL)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;

    -- Gender-specific ref ranges: HDL Cholesterol
    SELECT id INTO v_param FROM hmis_lab_test_parameters WHERE test_id = v_lipid AND parameter_code = 'HDL';
    IF v_param IS NOT NULL THEN
        INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, ref_text, unit) VALUES
        (v_param, 'male',   18, 150, 40,  999, 'Low risk: >40', 'mg/dL'),
        (v_param, 'female', 18, 150, 50,  999, 'Low risk: >50', 'mg/dL')
        ON CONFLICT DO NOTHING;
    END IF;

    END IF; -- end Lipid Profile

    -- ────────────────────────────────────────────────────────
    -- Blood Sugar - 4 tests (FBS, PPBS, RBS, HbA1c)
    -- ────────────────────────────────────────────────────────

    -- Fasting Blood Sugar
    IF v_fbs IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, sort_order, ref_range_text)
    VALUES
        (v_fbs, 'FBS', 'Fasting Blood Sugar', 'mg/dL', 'numeric', 0, 70, 100, 40, 500, 1, 'Normal: 70-100, Pre-diabetic: 100-125, Diabetic: >=126')
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Post Prandial Blood Sugar
    IF v_ppbs IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, sort_order, ref_range_text)
    VALUES
        (v_ppbs, 'PPBS', 'PP Blood Sugar', 'mg/dL', 'numeric', 0, 70, 140, 40, 500, 1, 'Normal: <140, Pre-diabetic: 140-199, Diabetic: >=200')
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Random Blood Sugar
    IF v_rbs IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, sort_order, ref_range_text)
    VALUES
        (v_rbs, 'RBS', 'Random Blood Sugar', 'mg/dL', 'numeric', 0, 70, 140, 40, 500, 1, 'Normal: 70-140, Diabetic: >=200')
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- HbA1c
    IF v_hba1c IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, sort_order, ref_range_text)
    VALUES
        (v_hba1c, 'HBA1C', 'HbA1c', '%', 'numeric', 1, 4.0, 5.6, NULL, NULL, 1, 'Normal: <5.7, Pre-diabetic: 5.7-6.4, Diabetic: >=6.5')
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- ────────────────────────────────────────────────────────
    -- Thyroid Function - T3, T4, TSH
    -- (TFT panel has T3 + T4 + TSH; standalone TSH test)
    -- ────────────────────────────────────────────────────────

    -- TFT panel parameters: T3, T4, TSH
    IF v_tft IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, sort_order)
    VALUES
        (v_tft, 'T3',  'T3 (Triiodothyronine)', 'ng/mL',  'numeric', 2, 0.8,  2.0,  NULL,  NULL, 1),
        (v_tft, 'T4',  'T4 (Thyroxine)',         'mcg/dL', 'numeric', 1, 5.1,  14.1, NULL,  NULL, 2),
        (v_tft, 'TSH', 'TSH',                    'mIU/L',  'numeric', 2, 0.27, 4.2,  0.01,  100.0, 3)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- Standalone TSH test
    IF v_tsh IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters
        (test_id, parameter_code, parameter_name, unit, data_type, decimal_places, ref_range_min, ref_range_max, critical_low, critical_high, sort_order)
    VALUES
        (v_tsh, 'TSH', 'TSH', 'mIU/L', 'numeric', 2, 0.27, 4.2, 0.01, 100.0, 1)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    END IF;

    -- ────────────────────────────────────────────────────────
    -- Universal (gender = 'all') reference ranges
    -- for parameters that do NOT vary by gender
    -- Uses INSERT...SELECT to avoid FOR loop / record issues
    -- ────────────────────────────────────────────────────────

    -- CBC universal ranges (TLC, Platelet, MCV, MCH, MCHC, DLC)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_cbc
      AND p.parameter_code IN ('TLC','PLT','MCV','MCH','MCHC','NEUT','LYMPH','MONO','EOS','BASO')
    ON CONFLICT DO NOTHING;

    -- LFT universal ranges (all LFT parameters are gender-neutral)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_lft
    ON CONFLICT DO NOTHING;

    -- RFT universal ranges (gender-neutral electrolytes and urea)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_rft
      AND p.parameter_code IN ('UREA','NA','K','CL','CA','PHOS')
    ON CONFLICT DO NOTHING;

    -- Lipid universal ranges (gender-neutral: Total Chol, TG, LDL, VLDL)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_lipid
      AND p.parameter_code IN ('TCHOL','TG','LDL','VLDL')
    ON CONFLICT DO NOTHING;

    -- Blood Sugar universal ranges (FBS)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_fbs AND p.parameter_code = 'FBS'
    ON CONFLICT DO NOTHING;

    -- Blood Sugar universal ranges (PPBS)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_ppbs AND p.parameter_code = 'PPBS'
    ON CONFLICT DO NOTHING;

    -- Blood Sugar universal ranges (RBS)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_rbs AND p.parameter_code = 'RBS'
    ON CONFLICT DO NOTHING;

    -- Blood Sugar universal ranges (HbA1c)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_hba1c AND p.parameter_code = 'HBA1C'
    ON CONFLICT DO NOTHING;

    -- Thyroid universal ranges (TFT panel: T3, T4, TSH)
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_tft
    ON CONFLICT DO NOTHING;

    -- Standalone TSH universal range
    INSERT INTO hmis_lab_ref_ranges (parameter_id, gender, age_min_years, age_max_years, ref_min, ref_max, unit)
    SELECT p.id, 'all', 18, 150, p.ref_range_min, p.ref_range_max, p.unit
    FROM hmis_lab_test_parameters p
    WHERE p.test_id = v_tsh AND p.parameter_code = 'TSH'
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'SEED_LAB_TEST_PARAMETERS complete — 6 test groups, parameters + gender-specific ref ranges inserted';
END $$;
