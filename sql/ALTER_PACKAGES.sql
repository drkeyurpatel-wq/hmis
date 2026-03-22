-- Health1 HMIS — Packages & Accounting schema
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Packages master — enhanced ═══

ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS package_code varchar(30);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS package_name varchar(200);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS department varchar(100);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS category varchar(30) DEFAULT 'surgical' CHECK (category IN ('surgical','medical','daycare','diagnostic','maternity','trauma','transplant','robotic','cardiac','neuro'));
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS procedure_name varchar(200);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS procedure_code varchar(20); -- NABH / internal code
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS icd_code varchar(20);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS los_days int DEFAULT 3;

-- Multi-rate tiers
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS package_rate decimal(12,2) DEFAULT 0; -- self-pay
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS rate_insurance decimal(12,2);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS rate_pmjay decimal(12,2);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS rate_cghs decimal(12,2);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS rate_esi decimal(12,2);
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS rate_corporate jsonb DEFAULT '{}'; -- { "Reliance": 85000, "TCS": 90000 }

-- Inclusions / exclusions (what's inside the package)
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS inclusions jsonb DEFAULT '[]';
-- Format: [{ category: "room", description: "General ward 3 days", amount: 6000 },
--   { category: "surgeon", description: "Surgeon fee", amount: 25000 },
--   { category: "anaesthesia", description: "Anaesthesia", amount: 8000 },
--   { category: "ot", description: "OT charges", amount: 10000 },
--   { category: "pharmacy", description: "Standard medicines", amount: 5000 },
--   { category: "lab", description: "Pre-op investigations", amount: 3000 },
--   { category: "nursing", description: "Nursing charges", amount: 2000 },
--   { category: "consumables", description: "Consumables", amount: 4000 }]

ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS exclusions text[] DEFAULT '{}';
-- e.g. {"Implant cost", "Blood products", "ICU stay", "Special investigations", "Extended stay beyond LOS"}

ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS room_category varchar(20) DEFAULT 'general';
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS valid_from date;
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS valid_to date;

-- Doctor fee split within package
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS surgeon_fee decimal(12,2) DEFAULT 0;
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS anaesthetist_fee decimal(12,2) DEFAULT 0;
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS assistant_fee decimal(12,2) DEFAULT 0;
ALTER TABLE hmis_packages ADD COLUMN IF NOT EXISTS referral_fee_pct decimal(5,2) DEFAULT 0;

-- ═══ 2. Package utilization tracking (per admission) ═══

CREATE TABLE IF NOT EXISTS hmis_package_utilization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
  package_id uuid NOT NULL REFERENCES hmis_packages(id),
  patient_id uuid REFERENCES hmis_patients(id),
  bill_id uuid REFERENCES hmis_bills(id),
  -- Package terms
  package_rate decimal(12,2) NOT NULL,
  rate_type varchar(20) DEFAULT 'self', -- self, insurance, pmjay, cghs, esi, corporate
  insurer_name varchar(100),
  -- Actual costs
  actual_room_charges decimal(12,2) DEFAULT 0,
  actual_surgeon_fee decimal(12,2) DEFAULT 0,
  actual_anaesthesia_fee decimal(12,2) DEFAULT 0,
  actual_pharmacy decimal(12,2) DEFAULT 0,
  actual_lab decimal(12,2) DEFAULT 0,
  actual_consumables decimal(12,2) DEFAULT 0,
  actual_nursing decimal(12,2) DEFAULT 0,
  actual_ot_charges decimal(12,2) DEFAULT 0,
  actual_other decimal(12,2) DEFAULT 0,
  actual_total decimal(12,2) DEFAULT 0,
  -- Variance
  variance decimal(12,2) DEFAULT 0, -- positive = hospital profit, negative = loss
  variance_pct decimal(5,2) DEFAULT 0,
  -- Over-package billing
  over_package_items jsonb DEFAULT '[]',
  over_package_amount decimal(12,2) DEFAULT 0,
  -- LOS
  expected_los int,
  actual_los int,
  overstay_days int DEFAULT 0,
  overstay_charges decimal(12,2) DEFAULT 0,
  -- Status
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','converted_to_itemized')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pkg_util ON hmis_package_utilization(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_pkg_util_admission ON hmis_package_utilization(admission_id);

-- ═══ 3. Revenue leakage rules ═══

CREATE TABLE IF NOT EXISTS hmis_revenue_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  rule_name varchar(200) NOT NULL,
  rule_type varchar(30) NOT NULL, -- unbilled_charge, missing_room, unbilled_procedure, unbilled_pharmacy, unbilled_lab, unpaid_bill, package_overstay, missing_consult, missing_nursing
  severity varchar(10) DEFAULT 'high' CHECK (severity IN ('critical','high','medium','low')),
  condition_sql text, -- optional: custom SQL condition
  threshold_amount decimal(12,2) DEFAULT 0,
  threshold_days int DEFAULT 0,
  is_active boolean DEFAULT true,
  auto_flag boolean DEFAULT true, -- auto-flag or manual review
  created_at timestamptz DEFAULT now()
);

-- ═══ 4. Revenue leakage log ═══

CREATE TABLE IF NOT EXISTS hmis_revenue_leakage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  scan_date date NOT NULL DEFAULT CURRENT_DATE,
  rule_id uuid REFERENCES hmis_revenue_rules(id),
  leak_type varchar(30) NOT NULL,
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  bill_id uuid REFERENCES hmis_bills(id),
  description text NOT NULL,
  estimated_amount decimal(12,2) DEFAULT 0,
  severity varchar(10) DEFAULT 'high',
  status varchar(20) DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','false_positive','waived')),
  resolved_by uuid REFERENCES hmis_staff(id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leakage_log ON hmis_revenue_leakage_log(centre_id, scan_date, status);

-- ═══ 5. Voice notes ═══

CREATE TABLE IF NOT EXISTS hmis_voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  encounter_id uuid, -- opd visit or admission
  encounter_type varchar(10) DEFAULT 'opd', -- opd, ipd
  recorded_by uuid REFERENCES hmis_staff(id),
  -- Audio
  audio_url text,
  duration_seconds int,
  -- Transcript
  raw_transcript text,
  -- AI-structured
  structured_note jsonb DEFAULT '{}',
  -- { chief_complaints: [], history: "", vitals: {}, examination: "",
  --   diagnosis: { primary: "", icd10: "", secondary: [] },
  --   investigations: [], prescriptions: [], plan: "", follow_up: "", advice: "" }
  -- Status
  status varchar(20) DEFAULT 'recorded' CHECK (status IN ('recorded','transcribed','structured','reviewed','saved_to_emr')),
  saved_to_encounter boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_notes ON hmis_voice_notes(centre_id, patient_id, created_at DESC);

-- ═══ 6. Shift handover ═══

CREATE TABLE IF NOT EXISTS hmis_shift_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  handover_date date NOT NULL DEFAULT CURRENT_DATE,
  shift varchar(20) NOT NULL, -- morning, afternoon, night
  ward_id uuid REFERENCES hmis_wards(id),
  -- Who
  outgoing_staff_id uuid REFERENCES hmis_staff(id),
  incoming_staff_id uuid REFERENCES hmis_staff(id),
  -- Census
  census jsonb DEFAULT '{}', -- { total: 45, icu: 12, new_admissions: 3, discharges: 2, deaths: 0, transfers_in: 1, transfers_out: 0 }
  -- Critical patients
  critical_patients jsonb DEFAULT '[]', -- [{ patient_id, name, bed, diagnosis, news2, concern, plan }]
  -- Pending items
  pending_labs jsonb DEFAULT '[]',
  pending_meds jsonb DEFAULT '[]',
  pending_procedures jsonb DEFAULT '[]',
  pending_discharges jsonb DEFAULT '[]',
  pending_consults jsonb DEFAULT '[]',
  -- Alerts
  alerts text[] DEFAULT '{}',
  general_notes text,
  -- Acknowledgement
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES hmis_staff(id),
  -- Auto-generated snapshot
  auto_generated jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handover ON hmis_shift_handovers(centre_id, handover_date, shift);
