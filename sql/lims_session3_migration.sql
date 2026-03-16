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
