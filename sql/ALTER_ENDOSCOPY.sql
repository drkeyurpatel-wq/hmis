-- Health1 HMIS — Endoscopy Unit schema enhancements
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Scope inventory (master) ═══

CREATE TABLE IF NOT EXISTS hmis_endoscopy_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  scope_code varchar(20) NOT NULL UNIQUE,
  scope_type varchar(30) NOT NULL CHECK (scope_type IN ('gastroscope','colonoscope','duodenoscope','bronchoscope','echoendoscope','enteroscope','sigmoidoscope')),
  brand varchar(100),
  model varchar(100),
  serial_number varchar(100),
  purchase_date date,
  last_service_date date,
  next_service_date date,
  total_procedures int DEFAULT 0,
  status varchar(20) DEFAULT 'available' CHECK (status IN ('available','in_use','decontamination','repair','retired')),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ═══ 2. Procedure additions ═══

ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES hmis_admissions(id);
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS scheduled_time time;
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS is_emergency boolean DEFAULT false;
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS assistant_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS anesthetist_id uuid REFERENCES hmis_staff(id);

-- Pre-procedure
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS pre_procedure_checklist jsonb DEFAULT '{}';
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS prep_quality varchar(20); -- excellent, good, fair, poor, inadequate
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS asa_class varchar(5); -- I, II, III, IV

-- Structured findings (replaces free text)
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS structured_findings jsonb DEFAULT '[]';
-- Format: [{ region: "esophagus", location: "lower third", finding: "erosion", 
--   classification: "LA Grade B", severity: "moderate", image_ref: "IMG001" }]

-- Polypectomy / biopsy detail
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS biopsies jsonb DEFAULT '[]';
-- Format: [{ site: "antrum", count: 2, technique: "forceps", for: "H.pylori CLO test" }]

ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS polyps_found jsonb DEFAULT '[]';
-- Format: [{ location: "ascending colon", size_mm: 8, morphology: "pedunculated", 
--   paris: "0-Ip", removed: true, technique: "snare polypectomy", retrieval: "yes" }]

-- Therapeutic details
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS therapeutic_details jsonb DEFAULT '{}';
-- ERCP: { sphincterotomy: true, stent_placed: true, stent_type: "plastic 10Fr", stone_extraction: true, balloon_sweep: 3 }
-- Banding: { varices_grade: "III", bands_placed: 6, active_bleed: true }
-- Dilatation: { site: "pylorus", type: "balloon", size_mm: 15, passes: 3 }

-- Completeness & quality
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS cecal_intubation boolean; -- colonoscopy
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS withdrawal_time_min decimal(4,1); -- colonoscopy
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS boston_bowel_prep_score int; -- 0-9 for colonoscopy
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS photo_documentation boolean DEFAULT false;

-- Post-procedure
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS recovery_notes text;
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS discharge_instructions text;
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS follow_up_plan text;

-- Link to scope inventory
ALTER TABLE hmis_endoscopy_procedures ADD COLUMN IF NOT EXISTS scope_inventory_id uuid REFERENCES hmis_endoscopy_scopes(id);

-- ═══ 3. Decontamination additions ═══

ALTER TABLE hmis_scope_decontamination ADD COLUMN IF NOT EXISTS scope_inventory_id uuid REFERENCES hmis_endoscopy_scopes(id);
ALTER TABLE hmis_scope_decontamination ADD COLUMN IF NOT EXISTS detergent_used varchar(100);
ALTER TABLE hmis_scope_decontamination ADD COLUMN IF NOT EXISTS disinfectant_used varchar(100);
ALTER TABLE hmis_scope_decontamination ADD COLUMN IF NOT EXISTS aer_cycle_number int;
ALTER TABLE hmis_scope_decontamination ADD COLUMN IF NOT EXISTS rinse_water_test varchar(20); -- pass, fail, pending
ALTER TABLE hmis_scope_decontamination ADD COLUMN IF NOT EXISTS storage_location varchar(50);
ALTER TABLE hmis_scope_decontamination ADD COLUMN IF NOT EXISTS next_use_deadline timestamptz; -- scope must be reprocessed if not used within X hours

CREATE INDEX IF NOT EXISTS idx_decontam_scope ON hmis_scope_decontamination(scope_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_endo_procedures_date ON hmis_endoscopy_procedures(centre_id, procedure_date);
