-- ═══ sql/lims_migration.sql ═══
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

-- Lab profiles

-- ═══ sql/lims_session2_migration.sql ═══
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

-- Common Organisms

-- Common Antibiotics

-- Default antibiotic panels




-- ============================================================
-- PART 5: EXPANDED TEST MASTER (50+ tests)
-- ============================================================

-- Add parameters for key new tests

-- ═══ sql/lims_session3_migration.sql ═══
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

-- Seed some common special stains and IHC markers as comments for reference
COMMENT ON TABLE hmis_lab_histo_cases IS 'Common Special Stains: PAS, PAS-D, Masson Trichrome, Reticulin, Congo Red, ZN, GMS, Mucicarmine, Iron (Perl), Alcian Blue
Common IHC Markers: CK (Pan), CK7, CK20, EMA, Vimentin, S100, HMB45, Desmin, SMA, CD3, CD20, CD30, CD34, CD45, CD68, Ki67, ER, PR, HER2, p53, p63, TTF1, PSA, Chromogranin, Synaptophysin, GATA3, PAX8, WT1, Calretinin, D2-40';

-- ═══ sql/ot_enhancement.sql ═══
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

-- ═══ sql/radiology_enhancement.sql ═══
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

-- SEED: Radiology test master (if empty)

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

