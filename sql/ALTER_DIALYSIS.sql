-- Health1 HMIS — Dialysis Unit schema enhancements
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Session additions ═══

-- Pre-dialysis labs
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS pre_bun decimal(6,1);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS pre_creatinine decimal(5,2);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS pre_potassium decimal(4,2);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS pre_hemoglobin decimal(4,1);

-- Post-dialysis labs
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS post_bun decimal(6,1);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS post_creatinine decimal(5,2);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS post_potassium decimal(4,2);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS post_temp decimal(4,1);

-- Adequacy (calculated)
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS kt_v decimal(4,2);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS urr decimal(5,2); -- Urea Reduction Ratio %

-- Dialysate composition
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS dialysate_sodium int DEFAULT 140;
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS dialysate_potassium decimal(3,1) DEFAULT 2.0;
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS dialysate_calcium decimal(3,1) DEFAULT 2.5;
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS dialysate_bicarb int DEFAULT 35;
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS dialysate_temp decimal(3,1) DEFAULT 36.5;

-- Anticoagulation detail
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS anticoag_type varchar(20) DEFAULT 'heparin';
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS anticoag_bolus varchar(50);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS anticoag_maintenance varchar(50);

-- Scheduling
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS shift varchar(10) DEFAULT 'morning';
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES hmis_admissions(id);
ALTER TABLE hmis_dialysis_sessions ADD COLUMN IF NOT EXISTS is_emergency boolean DEFAULT false;

-- ═══ 2. Intra-dialytic monitoring ═══

CREATE TABLE IF NOT EXISTS hmis_dialysis_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES hmis_dialysis_sessions(id),
  check_time timestamptz NOT NULL DEFAULT now(),
  minutes_elapsed int,
  -- Vitals
  bp_systolic int,
  bp_diastolic int,
  pulse int,
  temperature decimal(4,1),
  spo2 decimal(4,1),
  -- Machine readings
  blood_flow_rate int,
  dialysate_flow_rate int,
  venous_pressure int,
  arterial_pressure int,
  tmp decimal(5,1), -- transmembrane pressure
  uf_rate decimal(5,1), -- ml/hr
  uf_removed decimal(6,1), -- cumulative ml
  -- Observations
  access_site_ok boolean DEFAULT true,
  patient_comfort varchar(20) DEFAULT 'comfortable',
  symptoms text,
  interventions text,
  recorded_by uuid REFERENCES hmis_staff(id)
);

CREATE INDEX IF NOT EXISTS idx_dialysis_monitoring ON hmis_dialysis_monitoring(session_id, check_time);

-- ═══ 3. Dialysis patient profile (CKD chronic patients) ═══

CREATE TABLE IF NOT EXISTS hmis_dialysis_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES hmis_patients(id) UNIQUE,
  centre_id uuid REFERENCES hmis_centres(id),
  -- CKD details
  ckd_stage varchar(10), -- 3a, 3b, 4, 5, 5D
  etiology varchar(100), -- DM nephropathy, HTN nephropathy, GN, PKD, etc.
  dialysis_start_date date,
  dry_weight decimal(5,1),
  target_weight decimal(5,1),
  -- Access
  current_access_type varchar(20),
  access_creation_date date,
  access_limb varchar(20), -- left_arm, right_arm, left_leg, right_leg, neck
  access_details text,
  -- Schedule pattern
  schedule_pattern varchar(10) DEFAULT 'mwf', -- mwf, tts, daily, custom
  preferred_shift varchar(10) DEFAULT 'morning', -- morning, afternoon, evening
  preferred_machine_id uuid REFERENCES hmis_dialysis_machines(id),
  -- Standing orders
  standing_dialyzer varchar(100),
  standing_bfr int DEFAULT 300,
  standing_dfr int DEFAULT 500,
  standing_duration_min int DEFAULT 240,
  standing_anticoag_type varchar(20) DEFAULT 'heparin',
  standing_anticoag_dose varchar(50),
  standing_epo_dose varchar(50),
  standing_iron_dose varchar(50),
  -- Labs tracking
  last_kt_v decimal(4,2),
  last_kt_v_date date,
  last_hb decimal(4,1),
  last_ferritin int,
  last_tsat decimal(4,1),
  last_ipth int,
  last_calcium decimal(4,2),
  last_phosphorus decimal(4,2),
  -- Status
  is_active boolean DEFAULT true,
  total_sessions int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dialysis_patients ON hmis_dialysis_patients(centre_id, is_active);

-- ═══ 4. Water quality log ═══

CREATE TABLE IF NOT EXISTS hmis_dialysis_water_quality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  test_type varchar(20) NOT NULL, -- daily, weekly, monthly, quarterly
  sample_point varchar(50), -- ro_product, distribution_loop, machine_outlet
  -- Chemical
  chlorine decimal(5,3),
  chloramine decimal(5,3),
  tds int,
  ph decimal(4,2),
  conductivity decimal(6,1),
  hardness decimal(5,1),
  -- Microbiology
  bacterial_count int, -- CFU/ml
  endotoxin decimal(6,2), -- EU/ml
  -- Result
  pass boolean DEFAULT true,
  action_taken text,
  tested_by uuid REFERENCES hmis_staff(id),
  created_at timestamptz DEFAULT now()
);

-- ═══ 5. Functions ═══

-- Calculate URR (Urea Reduction Ratio)
CREATE OR REPLACE FUNCTION hmis_calc_urr(pre_bun decimal, post_bun decimal)
RETURNS decimal LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN pre_bun > 0 THEN ROUND(((pre_bun - post_bun) / pre_bun * 100)::decimal, 1) ELSE NULL END;
$$;

-- Auto-calculate adequacy on session completion
CREATE OR REPLACE FUNCTION hmis_dialysis_calc_adequacy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.pre_bun IS NOT NULL AND NEW.post_bun IS NOT NULL THEN
    NEW.urr := hmis_calc_urr(NEW.pre_bun, NEW.post_bun);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dialysis_adequacy ON hmis_dialysis_sessions;
CREATE TRIGGER trg_dialysis_adequacy
  BEFORE UPDATE ON hmis_dialysis_sessions
  FOR EACH ROW EXECUTE FUNCTION hmis_dialysis_calc_adequacy();
