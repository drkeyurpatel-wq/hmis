-- Health1 HMIS — Cath Lab schema enhancements
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Additional procedure columns ═══

-- Pre-procedure
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS pre_procedure_checklist jsonb DEFAULT '{}';
-- Format: { consent: true, allergy_checked: true, creatinine: 1.2, inr: 1.1, anti_coag: "heparin 5000U", iv_access: true, ecg_done: true }

ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS pre_creatinine decimal(5,2);
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS pre_hb decimal(4,1);
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS pre_platelet int;
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS pre_inr decimal(4,2);
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS pre_ecg_findings text;
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS pre_echo_ef int; -- LV EF %

-- Hemodynamics
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS hemodynamics jsonb DEFAULT '{}';
-- Format: { ao_systolic: 130, ao_diastolic: 80, lv_systolic: 130, lvedp: 18, 
--   ra_mean: 6, rv_systolic: 30, pa_systolic: 30, pa_diastolic: 15, pcwp: 12,
--   cardiac_output: 5.2, cardiac_index: 2.8, pvr: 1.5, qp_qs: 1.0 }

-- Structured vessel findings (replaces free-text cag_findings)
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS vessel_findings jsonb DEFAULT '[]';
-- Format: [{ vessel: "LAD", segment: "mid", stenosis_pct: 90, type: "discrete", 
--   calcification: "moderate", thrombus: false, flow: "TIMI-3", intervention: "ptca_des",
--   stent_result: "0% residual", ffr: 0.75 }, ...]

-- IVUS/OCT
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS imaging_used text[]; -- ivus, oct, angioscopy
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS ffr_ifr_data jsonb DEFAULT '[]';
-- Format: [{ vessel: "LAD", type: "FFR", value: 0.75, wire_brand: "Pressurewire X" }]

-- Post-procedure
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS sheath_removal_time timestamptz;
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS hemostasis_method varchar(30); -- manual, tr_band, angioseal, perclose
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS post_procedure_notes text;
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS post_echo_ef int;

-- Estimated duration and scheduling slot
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS estimated_duration_min int DEFAULT 60;
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS scheduled_time time;
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS is_emergency boolean DEFAULT false;
ALTER TABLE hmis_cathlab_procedures ADD COLUMN IF NOT EXISTS priority varchar(10) DEFAULT 'elective';

-- ═══ 2. Cathlab implant/consumable inventory ═══

CREATE TABLE IF NOT EXISTS hmis_cathlab_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  item_type varchar(30) NOT NULL CHECK (item_type IN ('des','bms','dcb','balloon','guidewire','catheter','guiding_catheter','sheath','closure_device','pacemaker','icd','crt','rotablator','ivus_catheter','ffr_wire','other')),
  brand varchar(100) NOT NULL,
  model varchar(100),
  size varchar(50), -- e.g. "3.0 x 38mm"
  serial_number varchar(100),
  lot_number varchar(100),
  expiry_date date,
  cost_price decimal(12,2) DEFAULT 0,
  mrp decimal(12,2) DEFAULT 0,
  vendor varchar(200),
  status varchar(20) DEFAULT 'in_stock' CHECK (status IN ('in_stock','used','expired','returned','damaged')),
  used_in_procedure_id uuid REFERENCES hmis_cathlab_procedures(id),
  used_for_patient_id uuid REFERENCES hmis_patients(id),
  used_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cathlab_inv_status ON hmis_cathlab_inventory(centre_id, status, item_type);
CREATE INDEX IF NOT EXISTS idx_cathlab_inv_expiry ON hmis_cathlab_inventory(expiry_date) WHERE status = 'in_stock';

-- ═══ 3. Post-procedure monitoring (groin checks) ═══

CREATE TABLE IF NOT EXISTS hmis_cathlab_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES hmis_cathlab_procedures(id),
  check_time timestamptz NOT NULL DEFAULT now(),
  checked_by uuid REFERENCES hmis_staff(id),
  pulse_present boolean DEFAULT true,
  access_site_ok boolean DEFAULT true,
  hematoma varchar(10) DEFAULT 'none' CHECK (hematoma IN ('none','small','moderate','large')),
  bleeding boolean DEFAULT false,
  bp_systolic int,
  bp_diastolic int,
  heart_rate int,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_cathlab_monitoring ON hmis_cathlab_monitoring(procedure_id);
