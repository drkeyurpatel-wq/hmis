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
