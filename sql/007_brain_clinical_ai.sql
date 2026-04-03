-- ============================================================
-- HMIS Module: Brain (Clinical AI)
-- Migration: 007_brain_clinical_ai.sql
-- Run on: Supabase bmuupgrzbfmddjwcqlss
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. READMISSION RISK SCORES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_readmission_risk (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  -- Risk factors (each scored 0-1, weighted)
  age_score NUMERIC(3,2) DEFAULT 0,
  comorbidity_count INT DEFAULT 0,
  comorbidity_score NUMERIC(3,2) DEFAULT 0,
  prior_admissions_12m INT DEFAULT 0,
  prior_admission_score NUMERIC(3,2) DEFAULT 0,
  los_score NUMERIC(3,2) DEFAULT 0,
  emergency_admission_score NUMERIC(3,2) DEFAULT 0,
  procedure_complexity_score NUMERIC(3,2) DEFAULT 0,
  abnormal_labs_at_discharge INT DEFAULT 0,
  abnormal_labs_score NUMERIC(3,2) DEFAULT 0,
  polypharmacy_score NUMERIC(3,2) DEFAULT 0,
  social_risk_score NUMERIC(3,2) DEFAULT 0,

  -- Composite
  total_risk_score NUMERIC(4,2) DEFAULT 0,
  risk_category TEXT CHECK (risk_category IN ('low', 'moderate', 'high', 'very_high')),

  -- Outcome tracking
  was_readmitted BOOLEAN DEFAULT false,
  readmission_date DATE,
  readmission_days INT,
  readmission_id UUID REFERENCES hmis_admissions(id),

  -- Actions taken
  post_discharge_call BOOLEAN DEFAULT false,
  home_care_arranged BOOLEAN DEFAULT false,
  followup_appointment_set BOOLEAN DEFAULT false,

  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admission_id)
);

CREATE INDEX IF NOT EXISTS idx_readmission_risk ON brain_readmission_risk(risk_category);
CREATE INDEX IF NOT EXISTS idx_readmission_centre ON brain_readmission_risk(centre_id);

-- ────────────────────────────────────────────────────────────
-- 2. ANTIBIOTIC STEWARDSHIP
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_antibiotic_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  prescription_id UUID,

  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'duration_exceeded',
    'broad_spectrum_no_culture',
    'escalation_no_justification',
    'duplicate_class',
    'renal_dose_adjustment',
    'antibiotic_allergy_risk',
    'iv_to_oral_opportunity',
    'prophylaxis_exceeded',
    'restricted_antibiotic',
    'no_deescalation'
  )),

  drug_name TEXT NOT NULL,
  drug_class TEXT,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),

  description TEXT NOT NULL,
  recommendation TEXT NOT NULL,

  prescribing_doctor_id UUID REFERENCES hmis_staff(id),

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'overridden')),
  resolved_by UUID REFERENCES hmis_staff(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  override_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abx_alerts_centre ON brain_antibiotic_alerts(centre_id);
CREATE INDEX IF NOT EXISTS idx_abx_alerts_status ON brain_antibiotic_alerts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_abx_alerts_doctor ON brain_antibiotic_alerts(prescribing_doctor_id);

CREATE TABLE IF NOT EXISTS brain_antibiotic_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  month TEXT NOT NULL,

  total_admissions INT DEFAULT 0,
  admissions_with_antibiotics INT DEFAULT 0,
  antibiotic_usage_rate NUMERIC(5,1) DEFAULT 0,

  avg_duration_days NUMERIC(4,1) DEFAULT 0,
  culture_before_antibiotic_rate NUMERIC(5,1) DEFAULT 0,
  deescalation_rate NUMERIC(5,1) DEFAULT 0,
  iv_to_oral_conversion_rate NUMERIC(5,1) DEFAULT 0,
  restricted_antibiotic_count INT DEFAULT 0,

  ddd_per_100_bed_days NUMERIC(8,2) DEFAULT 0,

  top_antibiotics JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, month)
);

-- ────────────────────────────────────────────────────────────
-- 3. INFECTION MONITORING (HAI)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_infection_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  admission_id UUID REFERENCES hmis_admissions(id),

  infection_type TEXT NOT NULL CHECK (infection_type IN (
    'ssi', 'clabsi', 'cauti', 'vap', 'cdiff', 'mrsa', 'other_hai'
  )),

  detection_date DATE NOT NULL,
  detection_source TEXT CHECK (detection_source IN (
    'lab_culture', 'clinical_signs', 'surveillance', 'readmission'
  )),

  ward_id UUID REFERENCES hmis_wards(id),
  ot_room_id UUID REFERENCES hmis_ot_rooms(id),
  surgeon_id UUID REFERENCES hmis_staff(id),
  procedure_name TEXT,
  procedure_date DATE,
  days_post_procedure INT,

  organism TEXT,
  antibiotic_sensitivity JSONB,
  treatment TEXT,

  outcome TEXT CHECK (outcome IN ('resolved', 'ongoing', 'readmitted', 'death')),
  additional_los_days INT DEFAULT 0,
  additional_cost NUMERIC(12,2) DEFAULT 0,

  investigated BOOLEAN DEFAULT false,
  root_cause TEXT,
  preventable BOOLEAN,
  corrective_action TEXT,

  reported_by UUID REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_infections_centre ON brain_infection_events(centre_id);
CREATE INDEX IF NOT EXISTS idx_infections_type ON brain_infection_events(infection_type);
CREATE INDEX IF NOT EXISTS idx_infections_surgeon ON brain_infection_events(surgeon_id);

CREATE TABLE IF NOT EXISTS brain_infection_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  month TEXT NOT NULL,

  total_surgeries INT DEFAULT 0,
  ssi_count INT DEFAULT 0,
  ssi_rate NUMERIC(5,2) DEFAULT 0,

  total_central_line_days INT DEFAULT 0,
  clabsi_count INT DEFAULT 0,
  clabsi_rate NUMERIC(5,2) DEFAULT 0,

  total_catheter_days INT DEFAULT 0,
  cauti_count INT DEFAULT 0,
  cauti_rate NUMERIC(5,2) DEFAULT 0,

  total_ventilator_days INT DEFAULT 0,
  vap_count INT DEFAULT 0,
  vap_rate NUMERIC(5,2) DEFAULT 0,

  hand_hygiene_compliance_pct NUMERIC(5,1),

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, month)
);

-- ────────────────────────────────────────────────────────────
-- 4. LOS OPTIMIZATION
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_los_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),

  predicted_los_days NUMERIC(5,1) NOT NULL,
  prediction_confidence NUMERIC(3,2),
  prediction_model TEXT DEFAULT 'rule_based',

  diagnosis_code TEXT,
  procedure_type TEXT,
  age_group TEXT,
  comorbidity_count INT,
  admission_type TEXT,
  payor_type TEXT,

  actual_los_days NUMERIC(5,1),
  is_outlier BOOLEAN DEFAULT false,
  outlier_reason TEXT,

  alert_generated BOOLEAN DEFAULT false,
  alert_generated_on_day INT,

  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admission_id)
);

CREATE TABLE IF NOT EXISTS brain_los_benchmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID REFERENCES hmis_centres(id),

  category TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,

  avg_los NUMERIC(5,1) NOT NULL,
  median_los NUMERIC(5,1),
  p25_los NUMERIC(5,1),
  p75_los NUMERIC(5,1),
  stddev_los NUMERIC(5,1),
  sample_size INT DEFAULT 0,

  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, category, code)
);

-- ────────────────────────────────────────────────────────────
-- 5. CLINICAL QUALITY SCORECARD
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_quality_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  month TEXT NOT NULL,

  -- Patient Safety
  fall_rate NUMERIC(5,2) DEFAULT 0,
  medication_error_rate NUMERIC(5,2) DEFAULT 0,
  wrong_site_surgery_count INT DEFAULT 0,
  blood_transfusion_reaction_count INT DEFAULT 0,
  pressure_ulcer_rate NUMERIC(5,2) DEFAULT 0,

  -- Clinical Outcomes
  mortality_rate NUMERIC(5,2) DEFAULT 0,
  icu_mortality_rate NUMERIC(5,2) DEFAULT 0,
  unplanned_icu_transfer_rate NUMERIC(5,2) DEFAULT 0,
  readmission_30_day_rate NUMERIC(5,2) DEFAULT 0,
  return_to_ot_rate NUMERIC(5,2) DEFAULT 0,

  -- OT Quality
  ssi_rate NUMERIC(5,2) DEFAULT 0,
  antibiotic_prophylaxis_compliance NUMERIC(5,1) DEFAULT 0,
  surgical_safety_checklist_compliance NUMERIC(5,1) DEFAULT 0,
  consent_compliance NUMERIC(5,1) DEFAULT 0,

  -- ED Quality
  ed_wait_time_avg_min INT DEFAULT 0,
  ed_left_without_treatment_rate NUMERIC(5,2) DEFAULT 0,

  -- Nursing
  nurse_patient_ratio NUMERIC(4,1) DEFAULT 0,
  nursing_documentation_compliance NUMERIC(5,1) DEFAULT 0,

  -- Patient Experience
  patient_satisfaction_score NUMERIC(3,1) DEFAULT 0,
  complaint_rate NUMERIC(5,2) DEFAULT 0,
  grievance_resolution_within_48h_pct NUMERIC(5,1) DEFAULT 0,

  -- Overall
  overall_quality_score NUMERIC(5,1) DEFAULT 0,
  overall_grade TEXT CHECK (overall_grade IN ('A', 'B', 'C', 'D', 'F')),

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, month)
);

-- ────────────────────────────────────────────────────────────
-- 6. RLS
-- ────────────────────────────────────────────────────────────

ALTER TABLE brain_readmission_risk ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_antibiotic_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_antibiotic_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_infection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_infection_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_los_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_los_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_quality_indicators ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brain_readmission_risk', 'brain_antibiotic_alerts', 'brain_antibiotic_usage',
    'brain_infection_events', 'brain_infection_rates', 'brain_los_predictions',
    'brain_los_benchmarks', 'brain_quality_indicators'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (
        centre_id IN (
          SELECT sc.centre_id FROM hmis_staff_centres sc
          JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid()
        ) OR centre_id IS NULL
      )', 'brain_read_' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)',
      'brain_write_' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true)',
      'brain_update_' || t, t
    );
  END LOOP;
END $$;
