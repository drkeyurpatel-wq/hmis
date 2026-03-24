-- sql/synthea_test_data.sql
-- Creates isolated test_* tables for Synthea synthetic patient data
-- ZERO impact on production tables — completely separate namespace
-- Run ONLY in dev/preview Supabase, never production
--
-- Usage:
--   1. Generate data: bash scripts/generate-synthea.sh
--   2. Run this SQL in Supabase SQL editor
--   3. Import: node scripts/import-synthea.mjs

-- ─── Test Patients ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  synthea_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  phone TEXT,
  address TEXT,
  marital_status TEXT,
  centre_id TEXT NOT NULL DEFAULT 'shilaj',
  source TEXT NOT NULL DEFAULT 'synthea',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Test Conditions (Diagnoses) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS test_conditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  synthea_patient_id TEXT NOT NULL,
  encounter_id TEXT,
  code TEXT NOT NULL,           -- SNOMED code from Synthea
  description TEXT NOT NULL,
  onset_date DATE,
  resolved_date DATE,
  source TEXT NOT NULL DEFAULT 'synthea',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Test Observations (Vitals + Labs) ───────────────────────────
CREATE TABLE IF NOT EXISTS test_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  synthea_patient_id TEXT NOT NULL,
  encounter_id TEXT,
  date DATE,
  code TEXT NOT NULL,           -- LOINC code from Synthea
  description TEXT NOT NULL,
  value DECIMAL(12,4),
  unit TEXT,
  source TEXT NOT NULL DEFAULT 'synthea',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Test Medications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  synthea_patient_id TEXT NOT NULL,
  encounter_id TEXT,
  code TEXT NOT NULL,           -- RxNorm code from Synthea
  description TEXT NOT NULL,
  start_date DATE,
  stop_date DATE,
  reason_code TEXT,
  reason_description TEXT,
  source TEXT NOT NULL DEFAULT 'synthea',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Test Encounters ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_encounters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  synthea_id TEXT UNIQUE NOT NULL,
  synthea_patient_id TEXT NOT NULL,
  encounter_class TEXT,        -- ambulatory, emergency, inpatient, etc.
  code TEXT,                   -- SNOMED code
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  centre_id TEXT NOT NULL DEFAULT 'shilaj',
  source TEXT NOT NULL DEFAULT 'synthea',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_test_patients_centre ON test_patients(centre_id);
CREATE INDEX IF NOT EXISTS idx_test_conditions_patient ON test_conditions(synthea_patient_id);
CREATE INDEX IF NOT EXISTS idx_test_observations_patient ON test_observations(synthea_patient_id);
CREATE INDEX IF NOT EXISTS idx_test_medications_patient ON test_medications(synthea_patient_id);
CREATE INDEX IF NOT EXISTS idx_test_encounters_patient ON test_encounters(synthea_patient_id);

-- ─── Cleanup function ────────────────────────────────────────────
-- Run this to wipe all test data when done
CREATE OR REPLACE FUNCTION clear_synthea_test_data()
RETURNS void AS $$
BEGIN
  TRUNCATE test_patients, test_conditions, test_observations, 
           test_medications, test_encounters CASCADE;
  RAISE NOTICE 'All Synthea test data cleared.';
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT clear_synthea_test_data();
