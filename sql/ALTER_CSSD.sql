-- Health1 HMIS — CSSD schema enhancements
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Autoclave master ═══

CREATE TABLE IF NOT EXISTS hmis_cssd_autoclaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  autoclave_number varchar(20) NOT NULL,
  brand varchar(100),
  model varchar(100),
  serial_number varchar(100),
  chamber_size varchar(20), -- small, medium, large
  status varchar(20) DEFAULT 'available' CHECK (status IN ('available','running','maintenance','out_of_order')),
  last_maintenance_date date,
  next_maintenance_date date,
  last_validation_date date,
  total_cycles int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ═══ 2. Instrument sets additions ═══

ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS category varchar(30); -- surgical, minor_procedure, delivery, dressing, special
ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS weight_grams int;
ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS pack_type varchar(20) DEFAULT 'wrapped'; -- wrapped, container, pouch, peel_pack
ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS sterility_expiry_hours int DEFAULT 72; -- hours after sterilization before needing re-sterilization
ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS sterility_expires_at timestamptz; -- calculated: last_sterilized_at + expiry_hours
ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS barcode varchar(50);
ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE hmis_cssd_instrument_sets ADD COLUMN IF NOT EXISTS location varchar(50) DEFAULT 'cssd_store'; -- cssd_store, issued, ot_1, ot_2, ward, etc.

-- ═══ 3. Cycle additions ═══

ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS autoclave_id uuid REFERENCES hmis_cssd_autoclaves(id);
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS bowie_dick_result varchar(10); -- pass, fail, na
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS leak_rate_result varchar(10); -- pass, fail
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS printout_attached boolean DEFAULT false;
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS exposure_time_min int;
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS dry_time_min int;
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS total_weight_kg decimal(5,2);
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS bi_reading_24h varchar(20); -- positive, negative, pending
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS bi_reading_48h varchar(20);
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS recalled boolean DEFAULT false;
ALTER TABLE hmis_cssd_cycles ADD COLUMN IF NOT EXISTS recall_reason text;

-- ═══ 4. Issue/return additions ═══

ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS issued_to_department_id uuid REFERENCES hmis_departments(id);
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS issued_to_location varchar(50); -- OT-1, OT-2, ward, ER, procedure_room
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES hmis_patients(id);
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS surgery_name varchar(200);
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS pack_integrity varchar(20) DEFAULT 'intact'; -- intact, compromised, wet, torn
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS ci_indicator varchar(10) DEFAULT 'changed'; -- changed, not_changed
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS instrument_count_verified boolean DEFAULT false;
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS return_wash_done boolean DEFAULT false;
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS sharps_count_match boolean;
ALTER TABLE hmis_cssd_issue_return ADD COLUMN IF NOT EXISTS contamination_level varchar(20); -- minimal, moderate, heavy, biohazard

-- ═══ 5. Recall log (when BI fails) ═══

CREATE TABLE IF NOT EXISTS hmis_cssd_recall_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  cycle_id uuid NOT NULL REFERENCES hmis_cssd_cycles(id),
  set_id uuid REFERENCES hmis_cssd_instrument_sets(id),
  issue_id uuid REFERENCES hmis_cssd_issue_return(id),
  recall_reason text NOT NULL,
  set_location varchar(100), -- where the set was when recalled
  patient_affected_id uuid REFERENCES hmis_patients(id),
  was_used boolean DEFAULT false, -- was the set used on a patient before recall?
  action_taken text,
  recalled_by uuid REFERENCES hmis_staff(id),
  recalled_at timestamptz DEFAULT now()
);

-- ═══ 6. Daily quality checks ═══

CREATE TABLE IF NOT EXISTS hmis_cssd_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  check_type varchar(30) NOT NULL, -- bowie_dick, leak_rate, water_quality, room_temp_humidity, bio_indicator
  autoclave_id uuid REFERENCES hmis_cssd_autoclaves(id),
  result varchar(10) NOT NULL, -- pass, fail
  reading_value varchar(50),
  notes text,
  performed_by uuid REFERENCES hmis_staff(id),
  created_at timestamptz DEFAULT now()
);

-- ═══ 7. Sterility expiry function ═══

CREATE OR REPLACE FUNCTION hmis_cssd_update_sterility_expiry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.last_sterilized_at IS NOT NULL AND NEW.sterility_expiry_hours IS NOT NULL THEN
    NEW.sterility_expires_at := NEW.last_sterilized_at + (NEW.sterility_expiry_hours || ' hours')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cssd_sterility_expiry ON hmis_cssd_instrument_sets;
CREATE TRIGGER trg_cssd_sterility_expiry
  BEFORE INSERT OR UPDATE ON hmis_cssd_instrument_sets
  FOR EACH ROW EXECUTE FUNCTION hmis_cssd_update_sterility_expiry();

CREATE INDEX IF NOT EXISTS idx_cssd_sets_status ON hmis_cssd_instrument_sets(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_cssd_sets_expiry ON hmis_cssd_instrument_sets(sterility_expires_at) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_cssd_cycles_date ON hmis_cssd_cycles(centre_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cssd_issue_set ON hmis_cssd_issue_return(set_id, issued_at DESC);
