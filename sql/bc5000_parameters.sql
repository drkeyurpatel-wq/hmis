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
