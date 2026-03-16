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
