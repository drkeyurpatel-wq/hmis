-- ═══════════════════════════════════════════════════════════════
-- Health1 HMIS — PHASE 2 COMPLETE MIGRATION
-- Creates all 35 missing tables for Phase 2 modules
-- Safe to run multiple times (IF NOT EXISTS on all tables)
-- Run AFTER: REBUILD_FULL.sql and RUN_ALL_MIGRATIONS.sql
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_MODULE_CONFIG.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- MODULE TOGGLE SYSTEM
-- Super-admin configurable module on/off per centre
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_module_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  module_key VARCHAR(50) NOT NULL,
  module_name VARCHAR(100) NOT NULL,
  module_group VARCHAR(30) NOT NULL CHECK (module_group IN ('clinical','diagnostics','revenue','operations','admin')),
  is_enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  updated_by UUID REFERENCES hmis_staff(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_module_config_centre ON hmis_module_config(centre_id, is_enabled);

ALTER TABLE hmis_module_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS module_config_tenant ON hmis_module_config;
CREATE POLICY module_config_tenant ON hmis_module_config
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

-- Seed default modules for all centres
INSERT INTO hmis_module_config (centre_id, module_key, module_name, module_group, is_enabled, sort_order)
SELECT c.id, m.key, m.name, m.grp, m.enabled, m.sort
FROM hmis_centres c
CROSS JOIN (VALUES
  -- Clinical
  ('opd', 'OPD', 'clinical', true, 1),
  ('appointments', 'Appointments', 'clinical', true, 2),
  ('emr', 'EMR', 'clinical', true, 3),
  ('voice_notes', 'Voice Notes', 'clinical', false, 4),
  ('ipd', 'IPD', 'clinical', true, 5),
  ('bed_management', 'Bed Management', 'clinical', true, 6),
  ('nursing', 'Nursing Station', 'clinical', true, 7),
  ('shift_handover', 'Shift Handover', 'clinical', true, 8),
  ('emergency', 'Emergency', 'clinical', true, 9),
  ('ot', 'Operation Theatre', 'clinical', true, 10),
  ('surgical_planning', 'Surgical Planning', 'clinical', true, 11),
  ('digital_consent', 'Digital Consent', 'clinical', true, 12),
  ('cathlab', 'Cath Lab', 'clinical', false, 13),
  ('endoscopy', 'Endoscopy', 'clinical', false, 14),
  ('dialysis', 'Dialysis', 'clinical', false, 15),
  ('physiotherapy', 'Physiotherapy', 'clinical', false, 16),
  ('dietary', 'Dietary', 'clinical', true, 17),
  ('cssd', 'CSSD', 'clinical', true, 18),
  ('referrals', 'Referrals', 'clinical', true, 19),
  -- Diagnostics
  ('lab', 'Laboratory', 'diagnostics', true, 20),
  ('radiology', 'Radiology', 'diagnostics', true, 21),
  ('blood_bank', 'Blood Bank', 'diagnostics', false, 22),
  ('pharmacy', 'Pharmacy', 'diagnostics', true, 23),
  -- Revenue
  ('billing', 'Billing', 'revenue', true, 24),
  ('packages', 'Packages', 'revenue', true, 25),
  ('insurance', 'Insurance', 'revenue', true, 26),
  ('revenue_leakage', 'Revenue Leakage', 'revenue', true, 27),
  ('accounting', 'Accounting', 'revenue', false, 28),
  -- Operations
  ('procurement', 'Procurement (VPMS)', 'operations', true, 29),
  ('homecare', 'Homecare', 'operations', false, 30),
  ('crm', 'CRM', 'operations', false, 31),
  ('biomedical', 'Biomedical', 'operations', true, 32),
  ('equipment_lifecycle', 'Equipment Lifecycle', 'operations', true, 33),
  ('housekeeping', 'Housekeeping', 'operations', true, 34),
  ('bed_turnover', 'Bed Turnover', 'operations', true, 35),
  ('duty_roster', 'Duty Roster', 'operations', true, 36),
  ('linen', 'Linen', 'operations', false, 37),
  ('infection_control', 'Infection Control', 'operations', false, 38),
  ('visitors', 'Visitors', 'operations', false, 39),
  ('mortuary', 'Mortuary', 'operations', false, 40),
  ('quality', 'Quality / NABH', 'operations', true, 41),
  -- Admin
  ('telemedicine', 'Telemedicine', 'admin', false, 42)
) AS m(key, name, grp, enabled, sort)
WHERE NOT EXISTS (SELECT 1 FROM hmis_module_config WHERE centre_id = c.id AND module_key = m.key);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_BED_TURNOVER.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- MODULE: Smart Bed Turnover
-- Tracks workflow: discharge → housekeeping → inspection → available → next admission
-- ============================================================

-- Main turnover workflow — one per bed discharge event
CREATE TABLE IF NOT EXISTS hmis_bed_turnover (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  bed_id UUID NOT NULL REFERENCES hmis_beds(id),
  room_id UUID REFERENCES hmis_rooms(id),
  ward_id UUID REFERENCES hmis_wards(id),
  -- Discharge info
  discharged_admission_id UUID REFERENCES hmis_admissions(id),
  discharge_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharge_confirmed_by UUID REFERENCES hmis_staff(id),
  -- Housekeeping
  hk_task_id UUID REFERENCES hmis_housekeeping_tasks(id),
  hk_assigned_to UUID REFERENCES hmis_staff(id),
  hk_started_at TIMESTAMPTZ,
  hk_completed_at TIMESTAMPTZ,
  hk_checklist JSONB DEFAULT '[
    {"item":"Bed stripped & linen removed","done":false},
    {"item":"Mattress sanitized","done":false},
    {"item":"Bed frame wiped down","done":false},
    {"item":"Fresh linen placed","done":false},
    {"item":"Bathroom cleaned","done":false},
    {"item":"Floor mopped","done":false},
    {"item":"Equipment checked & functional","done":false},
    {"item":"Bedside table sanitized","done":false},
    {"item":"Waste bin replaced","done":false},
    {"item":"Call bell tested","done":false}
  ]'::jsonb,
  -- Inspection
  inspected_by UUID REFERENCES hmis_staff(id),
  inspected_at TIMESTAMPTZ,
  inspection_passed BOOLEAN,
  inspection_remarks TEXT,
  -- Availability
  bed_available_at TIMESTAMPTZ,
  -- Next admission
  next_admission_id UUID REFERENCES hmis_admissions(id),
  next_patient_notified_at TIMESTAMPTZ,
  -- SLA
  sla_target_minutes INT DEFAULT 45,
  total_turnaround_minutes INT,
  sla_status VARCHAR(20) DEFAULT 'on_track' CHECK (sla_status IN ('on_track','warning','breached')),
  -- Status
  status VARCHAR(30) DEFAULT 'housekeeping_pending' CHECK (status IN (
    'housekeeping_pending','housekeeping_in_progress','housekeeping_done',
    'inspection_pending','inspection_failed','ready','assigned','completed'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Waitlist for beds — patients waiting for a specific ward/type
CREATE TABLE IF NOT EXISTS hmis_bed_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  ward_id UUID REFERENCES hmis_wards(id),
  bed_type VARCHAR(50) DEFAULT 'general',
  priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('emergency','urgent','routine')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  requested_by UUID REFERENCES hmis_staff(id),
  assigned_bed_id UUID REFERENCES hmis_beds(id),
  assigned_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting','notified','assigned','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bed_turnover_centre ON hmis_bed_turnover(centre_id);
CREATE INDEX IF NOT EXISTS idx_bed_turnover_bed ON hmis_bed_turnover(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_turnover_status ON hmis_bed_turnover(status);
CREATE INDEX IF NOT EXISTS idx_bed_turnover_sla ON hmis_bed_turnover(sla_status);
CREATE INDEX IF NOT EXISTS idx_bed_waitlist_centre ON hmis_bed_waitlist(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_bed_waitlist_ward ON hmis_bed_waitlist(ward_id, status);

-- RLS
ALTER TABLE hmis_bed_turnover ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_bed_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bed_turnover_tenant ON hmis_bed_turnover;
CREATE POLICY bed_turnover_tenant ON hmis_bed_turnover
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS bed_waitlist_tenant ON hmis_bed_waitlist;
CREATE POLICY bed_waitlist_tenant ON hmis_bed_waitlist
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: 003_clinical_alerts_table.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- Health1 HMIS — Clinical Alerts Table
-- Required by: Safety Ticker, Shift Handover, Alert Engine
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  alert_type VARCHAR(50) NOT NULL,
  -- Types: news2_high, vital_abnormal, critical_lab, overdue_med, deteriorating, 
  --        drug_interaction, allergy_alert, fall_risk, sepsis_risk
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  -- Severity: emergency, critical, high, medium, low
  title VARCHAR(300) NOT NULL,
  description TEXT,
  data JSONB DEFAULT '{}',
  source VARCHAR(50), -- 'vitals', 'lab', 'medication', 'cdss', 'nursing', 'manual'
  source_ref_id UUID,
  source_ref_type VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  -- Status: active, acknowledged, resolved, expired, dismissed
  acknowledged_by UUID REFERENCES hmis_staff(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES hmis_staff(id),
  resolved_at TIMESTAMPTZ,
  auto_resolve_at TIMESTAMPTZ, -- auto-expire after N hours
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_alerts_active ON hmis_clinical_alerts(centre_id, status, severity) WHERE status = 'active';
CREATE INDEX idx_clinical_alerts_patient ON hmis_clinical_alerts(patient_id, status);
CREATE INDEX idx_clinical_alerts_admission ON hmis_clinical_alerts(admission_id) WHERE admission_id IS NOT NULL;

-- RLS
ALTER TABLE hmis_clinical_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinical_alerts_staff" ON hmis_clinical_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sc ON sc.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sc.centre_id = hmis_clinical_alerts.centre_id
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_DIGITAL_CONSENT.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- MODULE: Digital Consent Management
-- Replace paper consent entirely with digital workflow
-- ============================================================

-- Consent templates with version control
CREATE TABLE IF NOT EXISTS hmis_consent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  template_name VARCHAR(300) NOT NULL,
  procedure_type VARCHAR(200),
  consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN (
    'surgical','anaesthesia','blood_transfusion','hiv_test','procedure',
    'admission','discharge_ama','research','photography','general'
  )),
  version INT DEFAULT 1,
  is_current BOOLEAN DEFAULT true,
  -- Content in 3 languages
  content_en TEXT NOT NULL,
  content_hi TEXT,
  content_gu TEXT,
  -- Patient education
  risks_en TEXT, risks_hi TEXT, risks_gu TEXT,
  benefits_en TEXT, benefits_hi TEXT, benefits_gu TEXT,
  alternatives_en TEXT, alternatives_hi TEXT, alternatives_gu TEXT,
  -- Config
  requires_witness BOOLEAN DEFAULT true,
  requires_interpreter BOOLEAN DEFAULT false,
  mandatory_checklist JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extend existing hmis_consents for digital workflow
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES hmis_consent_templates(id);
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS centre_id UUID REFERENCES hmis_centres(id);
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS ot_booking_id UUID REFERENCES hmis_ot_bookings(id);
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS content_shown TEXT;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS education_shown BOOLEAN DEFAULT false;
-- Pre-op checklist
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT false;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS procedure_explained BOOLEAN DEFAULT false;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS questions_answered BOOLEAN DEFAULT false;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS interpreter_used BOOLEAN DEFAULT false;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS interpreter_name VARCHAR(200);
-- Digital signature
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS witness_staff_id UUID REFERENCES hmis_staff(id);
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
-- Withdrawal
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS withdrawn_by UUID REFERENCES hmis_staff(id);
-- Version tracking
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS template_version INT;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Audit trail for consent actions
CREATE TABLE IF NOT EXISTS hmis_consent_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES hmis_consents(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'created','education_shown','patient_signed','witness_signed',
    'obtained','revoked','pdf_generated','viewed','edited'
  )),
  performed_by UUID REFERENCES hmis_staff(id),
  details TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consent_templates_centre ON hmis_consent_templates(centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_consent_templates_type ON hmis_consent_templates(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_audit_consent ON hmis_consent_audit(consent_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_centre ON hmis_consent_audit(centre_id);
CREATE INDEX IF NOT EXISTS idx_consents_template ON hmis_consents(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consents_ot ON hmis_consents(ot_booking_id) WHERE ot_booking_id IS NOT NULL;

-- RLS
ALTER TABLE hmis_consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_consent_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_tpl_tenant ON hmis_consent_templates;
CREATE POLICY consent_tpl_tenant ON hmis_consent_templates
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS consent_audit_tenant ON hmis_consent_audit;
CREATE POLICY consent_audit_tenant ON hmis_consent_audit
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: cost_centre_migration.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- ITEM-LEVEL COSTING + COST CENTRE P&L
-- Run after h1_hmis_migration.sql
-- ============================================================

-- 1. Add cost_price to tariff master (per-service cost)
ALTER TABLE hmis_tariff_master
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN hmis_tariff_master.cost_price IS 'Internal cost of delivering this service (staff time, consumables, equipment depreciation)';

-- 2. Add cost fields to bill_items
ALTER TABLE hmis_bill_items
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_amount DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN hmis_bill_items.unit_cost IS 'Cost per unit — from tariff cost_price, pharmacy purchase_rate, or implant cost';
COMMENT ON COLUMN hmis_bill_items.cost_amount IS 'Total cost = quantity × unit_cost';

-- 3. Add total_cost to bills
ALTER TABLE hmis_bills
  ADD COLUMN IF NOT EXISTS total_cost DECIMAL(14,2) DEFAULT 0;

COMMENT ON COLUMN hmis_bills.total_cost IS 'Sum of all bill_item cost_amounts — used for margin calculation';

-- 4. Add unit_cost to charge_log
ALTER TABLE hmis_charge_log
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2) DEFAULT 0;

-- 5. Cost Centre Master (organisational grouping)
CREATE TABLE IF NOT EXISTS hmis_cost_centres (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id   UUID NOT NULL REFERENCES hmis_centres(id),
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  type        VARCHAR(20) NOT NULL DEFAULT 'revenue'
              CHECK (type IN ('revenue','expense','overhead','shared')),
  parent_id   UUID REFERENCES hmis_cost_centres(id),
  gl_revenue_account_id UUID REFERENCES hmis_chart_of_accounts(id),
  gl_expense_account_id UUID REFERENCES hmis_chart_of_accounts(id),
  budget_monthly DECIMAL(14,2) DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cost_centres_centre ON hmis_cost_centres(centre_id, is_active);

-- 6. Mapping rules: department/tariff-category → cost centre
CREATE TABLE IF NOT EXISTS hmis_cost_centre_maps (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       UUID NOT NULL REFERENCES hmis_centres(id),
  cost_centre_id  UUID NOT NULL REFERENCES hmis_cost_centres(id) ON DELETE CASCADE,
  match_type      VARCHAR(20) NOT NULL CHECK (match_type IN ('department','tariff_category','bill_type')),
  match_value     VARCHAR(100) NOT NULL,
  priority        INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_cc_maps_lookup ON hmis_cost_centre_maps(centre_id, match_type, is_active);

-- 7. Add cost_centre_id to bill_items and charge_log
ALTER TABLE hmis_bill_items
  ADD COLUMN IF NOT EXISTS cost_centre_id UUID REFERENCES hmis_cost_centres(id);

ALTER TABLE hmis_charge_log
  ADD COLUMN IF NOT EXISTS cost_centre_id UUID REFERENCES hmis_cost_centres(id);

-- 8. Overhead/indirect expense tracking
CREATE TABLE IF NOT EXISTS hmis_cost_centre_expenses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       UUID NOT NULL REFERENCES hmis_centres(id),
  cost_centre_id  UUID NOT NULL REFERENCES hmis_cost_centres(id),
  expense_date    DATE NOT NULL,
  category        VARCHAR(50) NOT NULL
                  CHECK (category IN ('salary','consumables','maintenance','rent','utilities','equipment','outsourced','marketing','insurance','miscellaneous')),
  description     TEXT,
  amount          DECIMAL(14,2) NOT NULL,
  vendor          VARCHAR(200),
  reference_number VARCHAR(50),
  created_by      UUID REFERENCES hmis_staff(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_expenses_lookup ON hmis_cost_centre_expenses(centre_id, cost_centre_id, expense_date);

-- 9. RLS
ALTER TABLE hmis_cost_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_cost_centre_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_cost_centre_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_centres_all" ON hmis_cost_centres FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cost_centre_maps_all" ON hmis_cost_centre_maps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cost_centre_expenses_all" ON hmis_cost_centre_expenses FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_CSSD.sql
-- ═══════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_DUTY_ROSTER.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- MODULE: Staff Duty Roster
-- Operational shift scheduling — who is working where tonight
-- ============================================================

-- Shift type definitions per centre
CREATE TABLE IF NOT EXISTS hmis_shift_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  shift_name VARCHAR(100) NOT NULL,
  shift_code VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_night_shift BOOLEAN DEFAULT false,
  color VARCHAR(20) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Minimum staffing requirements per ward per shift
CREATE TABLE IF NOT EXISTS hmis_staffing_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  ward_id UUID NOT NULL REFERENCES hmis_wards(id),
  shift_id UUID NOT NULL REFERENCES hmis_shift_definitions(id),
  staff_type VARCHAR(50) NOT NULL CHECK (staff_type IN ('doctor','nurse','technician','support')),
  min_count INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ward_id, shift_id, staff_type)
);

-- Monthly roster — one row per staff per day
CREATE TABLE IF NOT EXISTS hmis_duty_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  staff_id UUID NOT NULL REFERENCES hmis_staff(id),
  ward_id UUID NOT NULL REFERENCES hmis_wards(id),
  shift_id UUID REFERENCES hmis_shift_definitions(id),
  roster_date DATE NOT NULL,
  shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('morning','afternoon','night','general','off','leave','custom')),
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  overtime_minutes INT DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, roster_date)
);

-- Swap requests
CREATE TABLE IF NOT EXISTS hmis_duty_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  requester_id UUID NOT NULL REFERENCES hmis_staff(id),
  target_id UUID NOT NULL REFERENCES hmis_staff(id),
  roster_id_requester UUID NOT NULL REFERENCES hmis_duty_roster(id),
  roster_id_target UUID NOT NULL REFERENCES hmis_duty_roster(id),
  swap_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID REFERENCES hmis_staff(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shift_def_centre ON hmis_shift_definitions(centre_id);
CREATE INDEX IF NOT EXISTS idx_staffing_req_ward ON hmis_staffing_requirements(ward_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_duty_roster_centre_date ON hmis_duty_roster(centre_id, roster_date);
CREATE INDEX IF NOT EXISTS idx_duty_roster_staff ON hmis_duty_roster(staff_id, roster_date);
CREATE INDEX IF NOT EXISTS idx_duty_roster_ward ON hmis_duty_roster(ward_id, roster_date);
CREATE INDEX IF NOT EXISTS idx_duty_swap_centre ON hmis_duty_swap_requests(centre_id, status);

-- RLS
ALTER TABLE hmis_shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_staffing_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_duty_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_duty_swap_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shift_def_tenant ON hmis_shift_definitions;
CREATE POLICY shift_def_tenant ON hmis_shift_definitions
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS staffing_req_tenant ON hmis_staffing_requirements;
CREATE POLICY staffing_req_tenant ON hmis_staffing_requirements
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS duty_roster_tenant ON hmis_duty_roster;
CREATE POLICY duty_roster_tenant ON hmis_duty_roster
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS duty_swap_tenant ON hmis_duty_swap_requests;
CREATE POLICY duty_swap_tenant ON hmis_duty_swap_requests
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

-- Seed default shifts
INSERT INTO hmis_shift_definitions (centre_id, shift_name, shift_code, start_time, end_time, is_night_shift, color)
SELECT c.id, s.shift_name, s.shift_code, s.start_time, s.end_time, s.is_night, s.color
FROM hmis_centres c
CROSS JOIN (VALUES
  ('Morning', 'M', '08:00'::TIME, '14:00'::TIME, false, '#22C55E'),
  ('Afternoon', 'A', '14:00'::TIME, '20:00'::TIME, false, '#F59E0B'),
  ('Night', 'N', '20:00'::TIME, '08:00'::TIME, true, '#6366F1'),
  ('General', 'G', '09:00'::TIME, '17:00'::TIME, false, '#3B82F6'),
  ('Off', 'O', '00:00'::TIME, '00:00'::TIME, false, '#9CA3AF')
) AS s(shift_name, shift_code, start_time, end_time, is_night, color)
WHERE NOT EXISTS (SELECT 1 FROM hmis_shift_definitions WHERE centre_id = c.id AND shift_code = s.shift_code);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_EQUIPMENT_LIFECYCLE.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- MODULE: Equipment Lifecycle & Downtime Tracker
-- Extends hmis_equipment + hmis_equipment_maintenance with:
--   - AMC ticket tracking with SLA
--   - Downtime tracking with patient impact
--   - Calibration due dates
--   - Uptime % analytics
--   - Cost of ownership tracking
-- ============================================================

-- Add columns to equipment for lifecycle tracking
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS amc_contract_number VARCHAR(100);
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS amc_start_date DATE;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS amc_sla_hours INT DEFAULT 24;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS last_calibration_date DATE;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS next_calibration_date DATE;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS calibration_frequency_days INT DEFAULT 365;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS total_repair_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS total_downtime_hours NUMERIC(10,2) DEFAULT 0;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS uptime_pct NUMERIC(5,2) DEFAULT 100;

-- Add columns to maintenance for AMC/downtime tracking
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS amc_ticket_number VARCHAR(100);
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS sla_target_hours INT;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS sla_met BOOLEAN;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS patients_impacted INT DEFAULT 0;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS patients_rescheduled INT DEFAULT 0;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low'));
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS vendor_notified_at TIMESTAMPTZ;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS vendor_response_at TIMESTAMPTZ;

-- Calibration log
CREATE TABLE IF NOT EXISTS hmis_equipment_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES hmis_equipment(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  calibration_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  performed_by VARCHAR(200),
  vendor VARCHAR(200),
  certificate_number VARCHAR(100),
  result VARCHAR(20) DEFAULT 'pass' CHECK (result IN ('pass','fail','conditional')),
  deviation_notes TEXT,
  cost NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calib_equip ON hmis_equipment_calibration(equipment_id);
CREATE INDEX IF NOT EXISTS idx_calib_centre ON hmis_equipment_calibration(centre_id);

ALTER TABLE hmis_equipment_calibration ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calib_access ON hmis_equipment_calibration;
CREATE POLICY calib_access ON hmis_equipment_calibration FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: biomedical_migration.sql
-- ═══════════════════════════════════════════════════════════════
-- biomedical_migration.sql
-- Equipment registry, maintenance tracking, PM scheduling

-- ============================================================
-- EQUIPMENT REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_equipment (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL CHECK (category IN (
    'imaging','laboratory','icu','ot','monitoring','sterilization','dental','ophthalmic','physiotherapy','general'
  )),
  brand           text,
  model           text,
  serial_number   text,
  location        text,
  department      text,
  purchase_date   date,
  purchase_cost   numeric(12,2),
  warranty_expiry date,
  amc_vendor      text,
  amc_expiry      date,
  amc_cost        numeric(10,2),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','condemned','out_of_order')),
  last_pm_date    date,
  next_pm_date    date,
  criticality     text NOT NULL DEFAULT 'medium' CHECK (criticality IN ('high','medium','low')),
  notes           text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equip_centre ON hmis_equipment (centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_equip_status ON hmis_equipment (status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_equip_pm_due ON hmis_equipment (next_pm_date) WHERE is_active = true;

-- ============================================================
-- MAINTENANCE LOG (breakdown + preventive + calibration)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_equipment_maintenance (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id      uuid NOT NULL REFERENCES hmis_equipment(id) ON DELETE CASCADE,
  centre_id         uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  type              text NOT NULL CHECK (type IN ('preventive','breakdown','calibration')),
  reported_by       uuid REFERENCES hmis_staff(id),
  reported_at       timestamptz DEFAULT now(),
  issue_description text,
  priority          text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  assigned_to       text,
  started_at        timestamptz,
  completed_at      timestamptz,
  resolution        text,
  parts_used        jsonb DEFAULT '[]'::jsonb,
  cost              numeric(10,2) DEFAULT 0,
  downtime_hours    numeric(8,2) DEFAULT 0,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','pending_parts')),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maint_equip ON hmis_equipment_maintenance (equipment_id, status);
CREATE INDEX IF NOT EXISTS idx_maint_centre ON hmis_equipment_maintenance (centre_id, status);

-- ============================================================
-- PM SCHEDULE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_equipment_pm_schedule (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id  uuid NOT NULL REFERENCES hmis_equipment(id) ON DELETE CASCADE,
  centre_id     uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  frequency     text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  checklist     jsonb DEFAULT '[]'::jsonb,
  last_done     date,
  next_due      date,
  assigned_to   text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_due ON hmis_equipment_pm_schedule (next_due) WHERE is_active = true;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_equipment_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_equipment_pm_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access equipment" ON hmis_equipment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access maintenance" ON hmis_equipment_maintenance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access pm schedule" ON hmis_equipment_pm_schedule FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: housekeeping_migration.sql
-- ═══════════════════════════════════════════════════════════════
-- housekeeping_migration.sql
-- Housekeeping tasks and schedules

-- ============================================================
-- HOUSEKEEPING TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_housekeeping_tasks (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  task_type       text NOT NULL CHECK (task_type IN ('routine','discharge','deep_clean','infection','spill','terminal')),
  area_type       text NOT NULL CHECK (area_type IN ('room','ward','ot','icu','common_area','toilet')),
  area_name       text NOT NULL,
  room_id         uuid,
  bed_id          uuid,
  priority        text NOT NULL DEFAULT 'routine' CHECK (priority IN ('emergency','high','routine')),
  assigned_to     uuid REFERENCES hmis_staff(id),
  requested_by    uuid REFERENCES hmis_staff(id),
  requested_at    timestamptz DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  verified_by     uuid REFERENCES hmis_staff(id),
  verified_at     timestamptz,
  checklist       jsonb DEFAULT '[]'::jsonb,
  chemicals_used  text[] DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','verified')),
  infection_type  varchar(100),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_centre ON hmis_housekeeping_tasks (centre_id, status);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status ON hmis_housekeeping_tasks (status, priority);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_bed ON hmis_housekeeping_tasks (bed_id) WHERE bed_id IS NOT NULL;

-- ============================================================
-- HOUSEKEEPING SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_housekeeping_schedules (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id     uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  area_name     text NOT NULL,
  area_type     text NOT NULL CHECK (area_type IN ('room','ward','ot','icu','common_area','toilet')),
  frequency     text NOT NULL CHECK (frequency IN ('every_shift','daily','twice_daily','weekly','monthly')),
  shift         text CHECK (shift IN ('morning','evening','night','all')),
  assigned_team text[] DEFAULT '{}',
  checklist     jsonb DEFAULT '[]'::jsonb,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_sched_centre ON hmis_housekeeping_schedules (centre_id, is_active);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_housekeeping_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access housekeeping tasks" ON hmis_housekeeping_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access housekeeping schedules" ON hmis_housekeeping_schedules FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: linen_migration.sql
-- ═══════════════════════════════════════════════════════════════
-- linen_migration.sql
-- Linen inventory and exchange tracking

-- ============================================================
-- LINEN INVENTORY (per ward)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_linen_inventory (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  item_type       text NOT NULL CHECK (item_type IN ('bedsheet','pillow_cover','blanket','curtain','towel','gown','drape')),
  total_qty       integer NOT NULL DEFAULT 0,
  in_circulation  integer NOT NULL DEFAULT 0,
  in_laundry      integer NOT NULL DEFAULT 0,
  damaged         integer NOT NULL DEFAULT 0,
  ward            varchar(100) NOT NULL,
  par_level       integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (centre_id, item_type, ward)
);

CREATE INDEX IF NOT EXISTS idx_linen_inv_centre ON hmis_linen_inventory (centre_id);

-- ============================================================
-- LINEN EXCHANGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_linen_exchange (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  ward            varchar(100) NOT NULL,
  item_type       text NOT NULL CHECK (item_type IN ('bedsheet','pillow_cover','blanket','curtain','towel','gown','drape')),
  exchange_date   date NOT NULL DEFAULT CURRENT_DATE,
  exchange_type   text NOT NULL DEFAULT 'routine' CHECK (exchange_type IN ('routine','discharge','emergency')),
  soiled_count    integer NOT NULL DEFAULT 0,
  clean_received  integer NOT NULL DEFAULT 0,
  damaged_count   integer NOT NULL DEFAULT 0,
  exchanged_by    uuid REFERENCES hmis_staff(id),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linen_ex_centre ON hmis_linen_exchange (centre_id, exchange_date DESC);
CREATE INDEX IF NOT EXISTS idx_linen_ex_ward ON hmis_linen_exchange (ward, exchange_date DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_linen_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_linen_exchange ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access linen inventory" ON hmis_linen_inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access linen exchange" ON hmis_linen_exchange FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: mortuary_migration.sql
-- ═══════════════════════════════════════════════════════════════
-- mortuary_migration.sql
-- Mortuary body tracking, release workflow, documentation

CREATE TABLE IF NOT EXISTS hmis_mortuary (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id               uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  patient_id              uuid REFERENCES hmis_patients(id),
  admission_id            uuid REFERENCES hmis_admissions(id),
  death_certificate_number varchar(50),
  cause_of_death          text,
  time_of_death           timestamptz,
  declared_by             uuid REFERENCES hmis_staff(id),
  body_received_at        timestamptz DEFAULT now(),
  storage_unit            varchar(50),
  embalming_done          boolean DEFAULT false,
  post_mortem_required    boolean DEFAULT false,
  post_mortem_done        boolean DEFAULT false,
  police_intimation       boolean DEFAULT false,
  released_to             varchar(200),
  released_at             timestamptz,
  release_authorized_by   uuid REFERENCES hmis_staff(id),
  id_proof_collected      boolean DEFAULT false,
  noc_from_police         boolean DEFAULT false,
  status                  text NOT NULL DEFAULT 'received' CHECK (status IN ('received','stored','post_mortem','released')),
  notes                   text,
  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mortuary_centre ON hmis_mortuary (centre_id, status);
CREATE INDEX IF NOT EXISTS idx_mortuary_patient ON hmis_mortuary (patient_id) WHERE patient_id IS NOT NULL;

ALTER TABLE hmis_mortuary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access mortuary" ON hmis_mortuary FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: consent_migration.sql
-- ═══════════════════════════════════════════════════════════════
-- consent_migration.sql
-- Digital consent management: templates, signed consents with signatures, audit

-- ============================================================
-- CONSENT TEMPLATES (admin-managed, versioned)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_consent_templates (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  category      text NOT NULL CHECK (category IN (
    'surgical', 'procedure', 'transfusion', 'general', 'anesthesia'
  )),
  content_html  text NOT NULL,
  risks_json    jsonb DEFAULT '[]'::jsonb,          -- array of risk strings
  alternatives_json jsonb DEFAULT '[]'::jsonb,      -- array of alternative strings
  is_active     boolean DEFAULT true,
  version       integer DEFAULT 1,
  centre_id     uuid REFERENCES hmis_centres(id),   -- NULL = global template
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_consent_templates IS 'Versioned consent form templates (surgical, procedure, transfusion, etc.)';

CREATE INDEX IF NOT EXISTS idx_consent_tpl_category ON hmis_consent_templates (category, is_active);

-- ============================================================
-- PATIENT CONSENTS (signed instances)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_patient_consents (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id        uuid NOT NULL REFERENCES hmis_patients(id),
  admission_id      uuid REFERENCES hmis_admissions(id),
  template_id       uuid REFERENCES hmis_consent_templates(id),
  consent_type      text NOT NULL,
  procedure_name    text,
  consent_html      text,                  -- snapshot of template at sign time
  risks_explained   text,
  alternatives_explained text,
  signature_data    text,                  -- base64 PNG from canvas
  witnessed_by      uuid REFERENCES hmis_staff(id),
  witness_name      text,
  witness_relation  text,
  witness_signature text,                  -- base64 PNG
  doctor_signature  text,                  -- base64 PNG
  obtained_by       uuid REFERENCES hmis_staff(id),
  signed_at         timestamptz DEFAULT now(),
  consent_language  text DEFAULT 'English',
  is_valid          boolean DEFAULT true,
  revoked_at        timestamptz,
  revoked_by        uuid REFERENCES hmis_staff(id),
  revoke_reason     text,
  ip_address        varchar(45),
  centre_id         uuid REFERENCES hmis_centres(id),
  created_at        timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_patient_consents IS 'Signed consent records with patient + witness signatures';

CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON hmis_patient_consents (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_consents_admission ON hmis_patient_consents (admission_id);

-- ============================================================
-- SEED 10 CONSENT TEMPLATES
-- ============================================================
INSERT INTO hmis_consent_templates (name, category, content_html, risks_json, alternatives_json) VALUES

('General Consent for Treatment', 'general',
 '<p>I, the undersigned patient / authorized representative, hereby consent to general medical treatment, nursing care, diagnostic procedures (blood tests, X-rays, ECG, etc.), and routine hospital services during my stay at <b>Health1 Super Speciality Hospital</b>.</p><p>I understand that my medical records may be maintained electronically and shared with treating physicians as necessary for my care.</p>',
 '["Allergic reactions to medications","Infection","Pain or discomfort","Unexpected complications","Bruising from blood draws"]'::jsonb,
 '["Refusal of treatment","Alternative therapies","Seeking care at another facility"]'::jsonb),

('Surgical Consent', 'surgical',
 '<p>I consent to undergo the surgical procedure as explained by my surgeon, including any additional procedures that may become necessary during the operation for medical/safety reasons.</p><p>The nature of the surgery, expected benefits, material risks, and alternatives have been explained to me. I understand no guarantee has been made regarding the outcome.</p>',
 '["Bleeding requiring transfusion","Infection (wound/deep)","Anesthesia complications","Injury to surrounding structures","Blood clots (DVT/PE)","Need for ICU admission","Conversion to open surgery","Need for re-operation","Scarring","Chronic pain","Death (rare)"]'::jsonb,
 '["Conservative management","Alternative surgical approach","Observation and monitoring","Second opinion"]'::jsonb),

('Anesthesia Consent', 'anesthesia',
 '<p>I consent to the administration of anesthesia (general / regional / local / sedation) as deemed appropriate by the anesthesiologist for my planned procedure.</p><p>The type of anesthesia, its risks, and alternatives have been explained to me by the anesthesiologist.</p>',
 '["Nausea and vomiting","Sore throat (if intubated)","Allergic reaction","Aspiration pneumonia","Nerve injury","Awareness under anesthesia","Cardiac arrest (rare)","Malignant hyperthermia (rare)","Dental damage","Post-dural puncture headache (if spinal)"]'::jsonb,
 '["Local anesthesia","Regional block","Conscious sedation","General anesthesia"]'::jsonb),

('Blood Transfusion Consent', 'transfusion',
 '<p>I consent to receive blood and/or blood products (packed red blood cells, fresh frozen plasma, platelets, cryoprecipitate) as deemed medically necessary by my treating physician.</p><p>I understand that all blood products are tested as per regulatory guidelines, but a small residual risk of transfusion-transmitted infections exists.</p>',
 '["Febrile reaction (fever, chills)","Allergic reaction (mild to severe)","Hemolytic transfusion reaction","TACO (transfusion-associated circulatory overload)","TRALI (transfusion-related acute lung injury)","Transfusion-transmitted infection (very rare)","Iron overload (with multiple transfusions)","Delayed hemolytic reaction"]'::jsonb,
 '["Iron supplementation","Erythropoietin therapy","Intraoperative cell salvage","Observation without transfusion"]'::jsonb),

('High-Risk Procedure Consent', 'procedure',
 '<p>I understand that the proposed procedure carries a higher than average risk of complications, including but not limited to significant bleeding, organ injury, and the possibility of ICU admission. The treating doctor has explained these risks in detail.</p><p>I have had adequate time to consider my options and voluntarily consent to proceed.</p>',
 '["Significant bleeding","Organ injury","ICU admission","Prolonged hospital stay","Disability","Need for additional procedures","Death"]'::jsonb,
 '["Conservative management","Second opinion","Transfer to higher centre","Alternative less-invasive procedure"]'::jsonb),

('Leave Against Medical Advice (LAMA)', 'general',
 '<p>I wish to leave <b>Health1 Super Speciality Hospital</b> against the medical advice of my treating doctors. I have been informed of the risks of leaving the hospital before completion of recommended treatment.</p><p>I understand that leaving prematurely may result in worsening of my condition, permanent disability, or death. I release the hospital and its staff from any liability arising from my decision.</p>',
 '["Worsening of current condition","Need for emergency readmission","Permanent disability","Death","Incomplete treatment leading to complications"]'::jsonb,
 '["Continue recommended treatment","Discuss concerns with treating doctor","Seek second opinion within hospital","Partial treatment plan"]'::jsonb),

('Refusal of Treatment', 'general',
 '<p>I, the undersigned, refuse the following treatment/procedure recommended by my treating physician. I have been informed of the risks of refusing treatment and the potential consequences.</p><p>I take full responsibility for this decision and release the hospital and medical staff from any liability.</p>',
 '["Progression of disease","Development of complications","Permanent damage","Need for more aggressive treatment later","Death"]'::jsonb,
 '["Accept recommended treatment","Modified treatment plan","Seek second opinion","Alternative therapies"]'::jsonb),

('Research / Clinical Trial Consent', 'procedure',
 '<p>I voluntarily agree to participate in the clinical research study as explained to me. I understand that participation is entirely voluntary and I may withdraw at any time without affecting my standard medical care.</p><p>The purpose, procedures, potential risks, and benefits of the study have been explained to me. My data will be kept confidential and used only for research purposes.</p>',
 '["Unknown side effects","Treatment may not be effective","Additional visits/tests required","Breach of confidentiality (rare)","Physical or psychological discomfort"]'::jsonb,
 '["Standard treatment without research participation","Other clinical trials","Observation only","Decline participation"]'::jsonb),

('Photography / Recording Consent', 'general',
 '<p>I consent to the taking of clinical photographs, video recordings, or other media of my medical condition / procedure for the purposes checked below:</p><ul><li>Medical records and continuity of care</li><li>Medical education and training</li><li>Research and publication (identity will be anonymized)</li><li>Quality assurance and peer review</li></ul><p>I understand that I may revoke this consent at any time.</p>',
 '["Images may be seen by medical professionals","Potential for identification despite anonymization","Images stored in hospital systems"]'::jsonb,
 '["Decline photography","Allow for medical records only","Allow with face/identity obscured"]'::jsonb),

('COVID-19 Vaccination Consent', 'procedure',
 '<p>I consent to receive the COVID-19 vaccine as recommended. I have been informed about the vaccine, its benefits in preventing COVID-19 infection, and the possible side effects.</p><p>I understand that I need to wait at the observation area for 30 minutes after vaccination and report any adverse effects immediately.</p>',
 '["Pain/swelling at injection site","Fever and body aches","Fatigue and headache","Allergic reaction (rare)","Anaphylaxis (very rare)","Myocarditis (very rare, certain vaccines)"]'::jsonb,
 '["Decline vaccination","Choose alternative vaccine","Postpone vaccination","Natural immunity (prior infection)"]'::jsonb)

ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_patient_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view consent templates"
  ON hmis_consent_templates FOR SELECT USING (true);

CREATE POLICY "Admin can manage consent templates"
  ON hmis_consent_templates FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Staff can view patient consents"
  ON hmis_patient_consents FOR SELECT USING (true);

CREATE POLICY "Staff can create patient consents"
  ON hmis_patient_consents FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update patient consents"
  ON hmis_patient_consents FOR UPDATE USING (true) WITH CHECK (true);

-- Updated_at trigger for templates
CREATE OR REPLACE FUNCTION update_consent_tpl_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consent_tpl_updated_at
  BEFORE UPDATE ON hmis_consent_templates
  FOR EACH ROW EXECUTE FUNCTION update_consent_tpl_updated_at();


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: portal_migration.sql
-- ═══════════════════════════════════════════════════════════════
-- portal_migration.sql
-- Patient portal tables: prescription refills, patient feedback, insurance documents

-- ============================================================
-- PRESCRIPTION REFILL REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_prescription_refill_requests (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id        uuid NOT NULL REFERENCES hmis_patients(id),
  encounter_id      uuid,
  prescription_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','dispensed','rejected')),
  notes             text,
  requested_at      timestamptz DEFAULT now(),
  responded_at      timestamptz,
  responded_by      uuid REFERENCES hmis_staff(id)
);

CREATE INDEX IF NOT EXISTS idx_refill_patient ON hmis_prescription_refill_requests (patient_id, status);

-- ============================================================
-- PATIENT FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_patient_feedback (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id  uuid NOT NULL REFERENCES hmis_patients(id),
  visit_id    uuid,
  rating      integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     text,
  department  text,
  doctor_name text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_patient ON hmis_patient_feedback (patient_id, created_at DESC);

-- ============================================================
-- INSURANCE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_insurance_documents (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pre_auth_id   uuid,
  claim_id      uuid,
  patient_id    uuid REFERENCES hmis_patients(id),
  document_type text NOT NULL CHECK (document_type IN (
    'id_proof','insurance_card','investigation_report','discharge_summary',
    'final_bill','prescription','consent','other'
  )),
  file_name     text NOT NULL,
  file_url      text NOT NULL,
  file_size     integer,
  uploaded_by   uuid REFERENCES hmis_staff(id),
  uploaded_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ins_docs_preauth ON hmis_insurance_documents (pre_auth_id) WHERE pre_auth_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ins_docs_claim ON hmis_insurance_documents (claim_id) WHERE claim_id IS NOT NULL;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_prescription_refill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_patient_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_insurance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access refill requests" ON hmis_prescription_refill_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access patient feedback" ON hmis_patient_feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access insurance documents" ON hmis_insurance_documents FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_PHYSIOTHERAPY.sql
-- ═══════════════════════════════════════════════════════════════
-- Health1 HMIS — Physiotherapy & Sports Medicine schema
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Plan enhancements ═══

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS plan_type varchar(20) DEFAULT 'therapeutic' CHECK (plan_type IN ('therapeutic','preventive','sports_rehab','post_surgical','cardiac_rehab','neuro_rehab','pelvic_floor','occupational'));
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS referral_source varchar(50); -- ortho, neuro, cardio, sports_med, self
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS referring_doctor_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS injury_mechanism text;
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS sport varchar(50); -- cricket, football, running, gym, tennis, swimming, etc.
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS competition_level varchar(20); -- recreational, amateur, semi_pro, professional, elite
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS position_role varchar(50); -- e.g. fast bowler, goalkeeper, marathon runner
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS pre_injury_activity_level varchar(20); -- sedentary, light, moderate, active, very_active, athlete

-- Baseline assessment
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS baseline_assessment jsonb DEFAULT '{}';
-- Format: { pain_vas: 7, rom: { flexion: 80, extension: -10 }, strength: { quads: "3/5", hamstring: "4/5" },
--   functional: { sit_to_stand: "difficulty", stairs: "unable", squat: "partial" },
--   special_tests: { lachman: "positive", mcmurray: "positive", anterior_drawer: "negative" } }

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS outcome_measures jsonb DEFAULT '{}';
-- Format: { koos: 45, dash: 62, lefs: 38, sf36_physical: 35, fms_total: 12 }

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS return_to_sport_phase varchar(30);
-- phase_1_protection, phase_2_controlled_motion, phase_3_strengthening, phase_4_sport_specific, phase_5_return_to_play

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS return_to_sport_criteria jsonb DEFAULT '[]';
-- [{ criterion: "Full ROM", met: true }, { criterion: "90% strength", met: false }, { criterion: "Y-balance ≥4cm", met: false }]

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS precautions text[];
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS contraindications text[];

-- ═══ 2. Session enhancements ═══

ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES hmis_physio_plans(id);
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS session_type varchar(20) DEFAULT 'treatment' CHECK (session_type IN ('assessment','treatment','review','fms_screen','rts_test','maintenance','prevention'));

-- Detailed modality parameters
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS modality_params jsonb DEFAULT '[]';
-- Format: [{ modality: "ift", frequency: "4000Hz", duration_min: 15, intensity: "comfortable", electrode_placement: "knee_surround" },
--          { modality: "us", frequency: "1MHz", intensity: "1.5W/cm2", mode: "continuous", duration_min: 8, area: "patellar_tendon" }]

-- Detailed exercise prescription
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS exercise_prescription jsonb DEFAULT '[]';
-- Format: [{ exercise: "Quad sets", sets: 3, reps: 15, hold_sec: 5, resistance: "body_weight", progression: "add ankle weight next session" },
--          { exercise: "SLR", sets: 3, reps: 10, hold_sec: 3, side: "left", notes: "pain-free range only" }]

-- ROM tracking (per joint, per movement)
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS rom_measurements jsonb DEFAULT '[]';
-- Format: [{ joint: "knee", side: "left", movement: "flexion", active: 110, passive: 120, normal: 135, pain_at_end: true },
--          { joint: "knee", side: "left", movement: "extension", active: -5, passive: 0, normal: 0 }]

-- Strength (MMT)
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS strength_measurements jsonb DEFAULT '[]';
-- Format: [{ muscle_group: "quadriceps", side: "left", grade: "4/5", method: "mmt" },
--          { muscle_group: "hamstrings", side: "left", grade: "3+/5", method: "mmt" }]

-- Functional tests
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS functional_tests jsonb DEFAULT '[]';
-- Format: [{ test: "timed_up_and_go", result: "12.5", unit: "seconds", normal: "<10" },
--          { test: "single_leg_hop", result: "85", unit: "percent_of_contralateral", target: ">90" },
--          { test: "y_balance_anterior", result: "62", unit: "cm", side: "left" }]

-- Special tests
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS special_tests jsonb DEFAULT '[]';
-- Format: [{ test: "Lachman", result: "positive", grade: "2+", notes: "soft endpoint" }]

-- Gait analysis
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS gait_analysis jsonb DEFAULT '{}';
-- Format: { pattern: "antalgic", aids: "crutches", weight_bearing: "partial", deviations: ["shortened stride", "trendelenburg"] }

-- Patient-reported outcome
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS patient_reported jsonb DEFAULT '{}';
-- Format: { pain_current: 4, pain_worst: 7, pain_best: 2, sleep_affected: true, function_level: "moderate_difficulty",
--   activity_tolerance: "30min_walking", confidence: 6, compliance: "good" }

ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS home_exercise_program jsonb DEFAULT '[]';
-- Format: [{ exercise: "Wall slides", sets: 3, reps: 15, frequency: "twice_daily", video_link: "..." }]

ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS next_session_plan text;

-- ═══ 3. FMS (Functional Movement Screen) table ═══

CREATE TABLE IF NOT EXISTS hmis_physio_fms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES hmis_patients(id),
  plan_id uuid REFERENCES hmis_physio_plans(id),
  screener_id uuid REFERENCES hmis_staff(id),
  screen_date date NOT NULL DEFAULT CURRENT_DATE,
  -- 7 FMS tests (0-3 each, total max 21)
  deep_squat int CHECK (deep_squat BETWEEN 0 AND 3),
  hurdle_step_l int CHECK (hurdle_step_l BETWEEN 0 AND 3),
  hurdle_step_r int CHECK (hurdle_step_r BETWEEN 0 AND 3),
  inline_lunge_l int CHECK (inline_lunge_l BETWEEN 0 AND 3),
  inline_lunge_r int CHECK (inline_lunge_r BETWEEN 0 AND 3),
  shoulder_mobility_l int CHECK (shoulder_mobility_l BETWEEN 0 AND 3),
  shoulder_mobility_r int CHECK (shoulder_mobility_r BETWEEN 0 AND 3),
  active_slr_l int CHECK (active_slr_l BETWEEN 0 AND 3),
  active_slr_r int CHECK (active_slr_r BETWEEN 0 AND 3),
  trunk_stability_pushup int CHECK (trunk_stability_pushup BETWEEN 0 AND 3),
  rotary_stability_l int CHECK (rotary_stability_l BETWEEN 0 AND 3),
  rotary_stability_r int CHECK (rotary_stability_r BETWEEN 0 AND 3),
  -- Clearing tests
  shoulder_clearing_l boolean DEFAULT false,
  shoulder_clearing_r boolean DEFAULT false,
  extension_clearing boolean DEFAULT false,
  flexion_clearing boolean DEFAULT false,
  -- Computed
  total_score int,
  asymmetries text[],
  risk_level varchar(10), -- low, moderate, high
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ═══ 4. Outcome measure tracking over time ═══

CREATE TABLE IF NOT EXISTS hmis_physio_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES hmis_patients(id),
  plan_id uuid REFERENCES hmis_physio_plans(id),
  measure_date date NOT NULL DEFAULT CURRENT_DATE,
  measure_type varchar(30) NOT NULL, -- vas, koos, dash, lefs, sf36, oswestry, nprs, groc, fms, y_balance, hop_test, berg_balance
  score decimal(6,1) NOT NULL,
  max_score decimal(6,1),
  subscales jsonb DEFAULT '{}', -- { pain: 45, symptoms: 60, adl: 55, sport: 30, qol: 25 } for KOOS
  notes text,
  recorded_by uuid REFERENCES hmis_staff(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physio_outcomes ON hmis_physio_outcomes(patient_id, plan_id, measure_type, measure_date);

-- ═══ 5. Prevention program templates ═══

CREATE TABLE IF NOT EXISTS hmis_physio_prevention_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  program_name varchar(200) NOT NULL,
  program_type varchar(30) NOT NULL, -- injury_prevention, prehab, wellness, corporate, sports_specific
  target_population varchar(100), -- cricket_fast_bowlers, runners, desk_workers, elderly, post_menopausal
  sport varchar(50),
  duration_weeks int DEFAULT 8,
  sessions_per_week int DEFAULT 3,
  exercises jsonb NOT NULL DEFAULT '[]',
  -- Format: [{ phase: 1, week_from: 1, week_to: 2, exercises: [{ name: "Nordic hamstring curl", sets: 3, reps: 5 }] }]
  screening_protocol jsonb DEFAULT '{}',
  -- Format: { fms: true, y_balance: true, single_leg_hop: true, grip_strength: true }
  evidence_reference text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed prevention programs
INSERT INTO hmis_physio_prevention_programs (centre_id, program_name, program_type, target_population, sport, duration_weeks, sessions_per_week, exercises, screening_protocol) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'FIFA 11+ Injury Prevention', 'injury_prevention', 'football_players', 'football', 12, 3,
   '[{"phase":1,"name":"Running warm-up","exercises":[{"name":"Jog forward","reps":"2x"},{"name":"Hip out","reps":"2x"},{"name":"Hip in","reps":"2x"}]},{"phase":2,"name":"Strength & plyometrics","exercises":[{"name":"Nordic hamstring curl","sets":3,"reps":5},{"name":"Single-leg balance","hold_sec":30},{"name":"Squats","sets":2,"reps":15}]},{"phase":3,"name":"Running drills","exercises":[{"name":"Bounding","reps":"2x"},{"name":"Plant and cut","reps":"2x"}]}]',
   '{"fms":true,"y_balance":true,"single_leg_hop":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'Cricket Fast Bowler Prehab', 'prehab', 'cricket_fast_bowlers', 'cricket', 8, 4,
   '[{"phase":1,"name":"Core & shoulder stability","exercises":[{"name":"Plank variations","sets":3,"hold_sec":30},{"name":"Shoulder ER/IR with band","sets":3,"reps":15},{"name":"Thoracic rotation","sets":2,"reps":10}]},{"phase":2,"name":"Power & endurance","exercises":[{"name":"Medicine ball throws","sets":3,"reps":8},{"name":"Single-leg RDL","sets":3,"reps":10},{"name":"Anti-rotation press","sets":3,"reps":12}]}]',
   '{"fms":true,"shoulder_rom":true,"trunk_rotation":true,"bowling_action_analysis":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'ACL Injury Prevention (Female Athletes)', 'injury_prevention', 'female_athletes', null, 8, 3,
   '[{"phase":1,"name":"Neuromuscular training","exercises":[{"name":"Single-leg squat","sets":3,"reps":10},{"name":"Jump-land-stabilize","sets":2,"reps":8},{"name":"Lateral band walks","sets":2,"reps":15}]},{"phase":2,"name":"Plyometric progression","exercises":[{"name":"Box jump with soft landing","sets":3,"reps":6},{"name":"Single-leg hop stick","sets":2,"reps":8},{"name":"Deceleration drills","sets":2,"reps":6}]}]',
   '{"fms":true,"y_balance":true,"drop_jump_screening":true,"knee_valgus_assessment":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'Runner''s Knee Prevention', 'injury_prevention', 'runners', 'running', 6, 3,
   '[{"phase":1,"name":"Hip & glute activation","exercises":[{"name":"Clamshells","sets":3,"reps":15},{"name":"Side-lying hip abduction","sets":3,"reps":12},{"name":"Glute bridge","sets":3,"reps":15}]},{"phase":2,"name":"Functional strengthening","exercises":[{"name":"Single-leg squat","sets":3,"reps":10},{"name":"Step-downs","sets":3,"reps":10},{"name":"Bulgarian split squat","sets":3,"reps":8}]}]',
   '{"fms":true,"single_leg_squat_assessment":true,"running_gait_analysis":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'Corporate Desk Worker Wellness', 'corporate', 'desk_workers', null, 12, 2,
   '[{"phase":1,"name":"Postural correction","exercises":[{"name":"Chin tucks","sets":3,"reps":10},{"name":"Thoracic extension over roller","sets":2,"reps":8},{"name":"Doorway pec stretch","hold_sec":30},{"name":"Seated piriformis stretch","hold_sec":30}]},{"phase":2,"name":"Core & ergonomic strength","exercises":[{"name":"Dead bug","sets":3,"reps":10},{"name":"Bird-dog","sets":3,"reps":10},{"name":"Wall angels","sets":2,"reps":12}]}]',
   '{"posture_screen":true,"grip_strength":true,"neck_rom":true,"shoulder_rom":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'Fall Prevention (Elderly)', 'injury_prevention', 'elderly', null, 12, 3,
   '[{"phase":1,"name":"Balance foundations","exercises":[{"name":"Tandem stance","hold_sec":30},{"name":"Single-leg stance","hold_sec":15},{"name":"Heel-toe walk","reps":"10m x3"}]},{"phase":2,"name":"Functional strength","exercises":[{"name":"Sit-to-stand","sets":3,"reps":10},{"name":"Step-ups","sets":2,"reps":10},{"name":"Calf raises","sets":3,"reps":15}]}]',
   '{"berg_balance":true,"timed_up_and_go":true,"30sec_chair_stand":true,"gait_speed":true}')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_physio_sessions_plan ON hmis_physio_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_physio_fms ON hmis_physio_fms(patient_id, screen_date);


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_PACKAGES.sql
-- ═══════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_SURGICAL_PLANNING.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- MODULE: Pre-Admission & Surgical Planning
-- Tracks readiness pipeline from surgery decision to OT clearance
-- ============================================================

-- Main planning case — one per OT booking
CREATE TABLE IF NOT EXISTS hmis_surgical_planning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  ot_booking_id UUID NOT NULL REFERENCES hmis_ot_bookings(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  surgeon_id UUID REFERENCES hmis_staff(id),
  planned_date DATE NOT NULL,
  procedure_name VARCHAR(500) NOT NULL,
  priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','emergency')),
  overall_status VARCHAR(20) DEFAULT 'planning' CHECK (overall_status IN ('planning','ready','blocked','cancelled','completed')),
  readiness_pct NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  cleared_by UUID REFERENCES hmis_staff(id),
  cleared_at TIMESTAMPTZ,
  created_by UUID REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual checklist items per planning case
CREATE TABLE IF NOT EXISTS hmis_surgical_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id UUID NOT NULL REFERENCES hmis_surgical_planning(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'pre_op_investigation','anaesthesia_fitness','insurance_preauth',
    'consent','blood_arrangement','cssd_booking','ot_slot','bed_reservation','custom'
  )),
  item_name VARCHAR(300) NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','waived','blocked')),
  assigned_to UUID REFERENCES hmis_staff(id),
  due_date DATE,
  actual_date DATE,
  remarks TEXT,
  -- FK links to related entities
  lab_order_id UUID,        -- links to hmis_lab_orders
  pre_auth_id UUID,         -- links to hmis_pre_auth_requests
  consent_id UUID,          -- links to hmis_consents
  cssd_issue_id UUID,       -- links to hmis_cssd_issue_return
  bed_id UUID,              -- links to hmis_beds
  completed_by UUID REFERENCES hmis_staff(id),
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_surgical_planning_centre ON hmis_surgical_planning(centre_id);
CREATE INDEX IF NOT EXISTS idx_surgical_planning_booking ON hmis_surgical_planning(ot_booking_id);
CREATE INDEX IF NOT EXISTS idx_surgical_planning_patient ON hmis_surgical_planning(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgical_planning_status ON hmis_surgical_planning(overall_status);
CREATE INDEX IF NOT EXISTS idx_surgical_planning_date ON hmis_surgical_planning(planned_date);
CREATE INDEX IF NOT EXISTS idx_surgical_checklist_planning ON hmis_surgical_checklist_items(planning_id);
CREATE INDEX IF NOT EXISTS idx_surgical_checklist_status ON hmis_surgical_checklist_items(status);

-- RLS
ALTER TABLE hmis_surgical_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_surgical_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS surgical_planning_tenant ON hmis_surgical_planning;
CREATE POLICY surgical_planning_tenant ON hmis_surgical_planning
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS surgical_checklist_tenant ON hmis_surgical_checklist_items;
CREATE POLICY surgical_checklist_tenant ON hmis_surgical_checklist_items
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: ALTER_REFERRALS.sql
-- ═══════════════════════════════════════════════════════════════
-- ════════════════════════════════════════════════════════════════
-- Health1 HMIS — Referral Management schema rebuild
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)
-- ════════════════════════════════════════════════════════════════

-- ═══ 1. External Referring Doctor Master ═══
-- Separate from hmis_staff — these are outside doctors who send patients to H1

CREATE TABLE IF NOT EXISTS hmis_referring_doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  phone varchar(20),
  email varchar(100),
  registration_number varchar(50),
  speciality varchar(100),
  hospital_name varchar(200),
  city varchar(100),
  state varchar(50) DEFAULT 'Gujarat',
  pan varchar(15),
  bank_account varchar(30),
  bank_ifsc varchar(15),
  bank_name varchar(100),
  -- Fee agreement
  default_fee_type varchar(20) DEFAULT 'percentage' CHECK (default_fee_type IN ('percentage', 'flat', 'slab', 'per_service', 'none')),
  default_fee_pct decimal(5,2) DEFAULT 0,
  default_flat_amount decimal(12,2) DEFAULT 0,
  tds_applicable boolean DEFAULT true,
  tds_pct decimal(5,2) DEFAULT 10,
  -- Tracking
  is_active boolean DEFAULT true,
  total_referrals int DEFAULT 0,
  total_revenue decimal(14,2) DEFAULT 0,
  total_fees_paid decimal(14,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_doctors_name ON hmis_referring_doctors(name);
CREATE INDEX IF NOT EXISTS idx_ref_doctors_phone ON hmis_referring_doctors(phone);

-- ═══ 2. Referral fee slabs (for slab-based fee structures) ═══

CREATE TABLE IF NOT EXISTS hmis_referral_fee_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referring_doctor_id uuid NOT NULL REFERENCES hmis_referring_doctors(id),
  min_revenue decimal(12,2) NOT NULL DEFAULT 0,
  max_revenue decimal(12,2),
  fee_pct decimal(5,2) NOT NULL DEFAULT 0,
  flat_amount decimal(12,2) DEFAULT 0,
  department varchar(100),
  procedure_type varchar(100),
  notes text
);

-- ═══ 3. Add columns to hmis_referrals ═══

ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS referring_doctor_id uuid REFERENCES hmis_referring_doctors(id);
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS internal_referring_staff_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS source_centre_id uuid REFERENCES hmis_centres(id);
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES hmis_bills(id);

-- Fee calculation details
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS fee_type varchar(20) DEFAULT 'percentage';
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS fee_base_amount decimal(12,2) DEFAULT 0;
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS tds_amount decimal(12,2) DEFAULT 0;
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS net_fee_payable decimal(12,2) DEFAULT 0;

-- Payment tracking
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS payment_mode varchar(20);
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS payment_utr varchar(50);
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS payment_date date;
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS payment_approved_by uuid REFERENCES hmis_staff(id);

-- Services breakdown (which services attract referral fee)
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS fee_services jsonb DEFAULT '[]';
-- Format: [{ "service": "PTCA", "amount": 50000, "fee_pct": 10, "fee_amount": 5000 }, ...]

-- Multi-centre: which centre admitted the patient
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS admitted_centre_id uuid REFERENCES hmis_centres(id);

CREATE INDEX IF NOT EXISTS idx_referrals_ref_doctor ON hmis_referrals(referring_doctor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_admission ON hmis_referrals(admission_id);
CREATE INDEX IF NOT EXISTS idx_referrals_bill ON hmis_referrals(bill_id);

-- ═══ 4. Referral fee calculation function ═══
-- Called when a bill is finalized for a referred patient
-- Auto-calculates fee based on referring doctor's agreement

CREATE OR REPLACE FUNCTION hmis_calculate_referral_fee(p_referral_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_ref RECORD;
  v_doc RECORD;
  v_bill RECORD;
  v_fee_amount decimal(12,2) := 0;
  v_tds decimal(12,2) := 0;
  v_base decimal(12,2) := 0;
  v_services jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_ref FROM hmis_referrals WHERE id = p_referral_id;
  IF v_ref IS NULL THEN RETURN jsonb_build_object('error', 'Referral not found'); END IF;

  -- Get referring doctor agreement
  IF v_ref.referring_doctor_id IS NOT NULL THEN
    SELECT * INTO v_doc FROM hmis_referring_doctors WHERE id = v_ref.referring_doctor_id;
  END IF;

  -- Get actual bill if linked
  IF v_ref.bill_id IS NOT NULL THEN
    SELECT * INTO v_bill FROM hmis_bills WHERE id = v_ref.bill_id;
    v_base := COALESCE(v_bill.net_amount, 0);
  ELSIF v_ref.admission_id IS NOT NULL THEN
    -- Sum all bills for this admission
    SELECT COALESCE(SUM(net_amount), 0) INTO v_base
    FROM hmis_bills WHERE admission_id = v_ref.admission_id
    AND status IN ('final', 'paid', 'partially_paid');
  ELSE
    v_base := COALESCE(v_ref.expected_revenue, 0);
  END IF;

  -- Calculate fee based on type
  IF v_doc IS NOT NULL THEN
    CASE v_doc.default_fee_type
      WHEN 'percentage' THEN
        v_fee_amount := v_base * COALESCE(v_doc.default_fee_pct, v_ref.referral_fee_pct, 0) / 100;
      WHEN 'flat' THEN
        v_fee_amount := COALESCE(v_doc.default_flat_amount, 0);
      WHEN 'slab' THEN
        SELECT COALESCE(
          CASE WHEN flat_amount > 0 THEN flat_amount
               ELSE v_base * fee_pct / 100
          END, 0)
        INTO v_fee_amount
        FROM hmis_referral_fee_slabs
        WHERE referring_doctor_id = v_doc.id
          AND v_base >= min_revenue
          AND (max_revenue IS NULL OR v_base < max_revenue)
        LIMIT 1;
      ELSE
        v_fee_amount := v_base * COALESCE(v_ref.referral_fee_pct, 0) / 100;
    END CASE;

    -- TDS
    IF v_doc.tds_applicable THEN
      v_tds := v_fee_amount * COALESCE(v_doc.tds_pct, 10) / 100;
    END IF;
  ELSE
    -- No doctor record, use referral-level percentage
    v_fee_amount := v_base * COALESCE(v_ref.referral_fee_pct, 0) / 100;
    v_tds := v_fee_amount * 0.10; -- default 10% TDS
  END IF;

  -- Update referral
  UPDATE hmis_referrals SET
    actual_revenue = v_base,
    fee_base_amount = v_base,
    referral_fee_amount = v_fee_amount,
    tds_amount = v_tds,
    net_fee_payable = v_fee_amount - v_tds,
    fee_type = COALESCE(v_doc.default_fee_type, 'percentage'),
    updated_at = now()
  WHERE id = p_referral_id;

  RETURN jsonb_build_object(
    'base_revenue', v_base,
    'fee_amount', v_fee_amount,
    'tds', v_tds,
    'net_payable', v_fee_amount - v_tds,
    'fee_type', COALESCE(v_doc.default_fee_type, 'percentage')
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: px/001_px_module.sql (Patient Experience)
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- Health1 HMIS — Patient Experience (PX) Module
-- Migration: 001_px_module.sql
-- Run on: Supabase project bmuupgrzbfmddjwcqlss
-- ============================================================

-- 1. ENUMS
-- ============================================================

CREATE TYPE px_food_order_status AS ENUM (
  'pending',
  'nurse_approved',
  'nurse_rejected',
  'preparing',
  'ready',
  'delivered',
  'cancelled'
);

CREATE TYPE px_complaint_status AS ENUM (
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed'
);

CREATE TYPE px_complaint_category AS ENUM (
  'cleanliness',
  'food_quality',
  'staff_behaviour',
  'noise',
  'equipment',
  'billing',
  'delay',
  'other'
);

CREATE TYPE px_nurse_call_priority AS ENUM (
  'routine',
  'urgent',
  'emergency'
);

CREATE TYPE px_nurse_call_status AS ENUM (
  'pending',
  'acknowledged',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE px_activity_type AS ENUM (
  'food_order',
  'food_status_change',
  'complaint',
  'complaint_status_change',
  'nurse_call',
  'nurse_call_status_change',
  'feedback',
  'token_created',
  'token_expired'
);

-- 2. TABLES
-- ============================================================

-- 2a. PX Tokens — links QR wristband to admission
CREATE TABLE IF NOT EXISTS hmis_px_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(20) NOT NULL UNIQUE,
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  bed_id UUID REFERENCES hmis_beds(id),
  ward_id UUID REFERENCES hmis_wards(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expired_at TIMESTAMPTZ,
  created_by UUID REFERENCES hmis_staff(id)
);

CREATE INDEX idx_px_tokens_token ON hmis_px_tokens(token) WHERE is_active = true;
CREATE INDEX idx_px_tokens_admission ON hmis_px_tokens(admission_id);
CREATE INDEX idx_px_tokens_centre ON hmis_px_tokens(centre_id) WHERE is_active = true;

-- 2b. Food Menu
CREATE TABLE IF NOT EXISTS hmis_px_food_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  name VARCHAR(200) NOT NULL,
  name_gujarati VARCHAR(200),
  category VARCHAR(50) NOT NULL, -- breakfast, lunch, dinner, snacks, beverages
  description TEXT,
  price NUMERIC(8,2) NOT NULL DEFAULT 0,
  dietary_tags TEXT[] DEFAULT '{}', -- veg, non-veg, jain, diabetic-friendly, low-sodium, liquid-diet
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  available_from TIME, -- e.g. 07:00 for breakfast
  available_until TIME, -- e.g. 10:00
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_food_menu_centre ON hmis_px_food_menu(centre_id) WHERE is_available = true;

-- 2c. Food Orders
CREATE TABLE IF NOT EXISTS hmis_px_food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES hmis_px_tokens(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  bed_label VARCHAR(50), -- denormalized for kitchen display: "ICU-101"
  ward_name VARCHAR(100), -- denormalized: "ICU"
  patient_name VARCHAR(200), -- denormalized for kitchen display
  items JSONB NOT NULL DEFAULT '[]',
  -- items schema: [{ menu_item_id, name, qty, price, dietary_tags, special_instructions }]
  item_count INT GENERATED ALWAYS AS (jsonb_array_length(items)) STORED,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status px_food_order_status NOT NULL DEFAULT 'pending',
  nurse_id UUID REFERENCES hmis_staff(id),
  nurse_action_at TIMESTAMPTZ,
  nurse_notes TEXT,
  kitchen_notes TEXT,
  dietary_restrictions TEXT, -- from patient's admission record
  prepared_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_food_orders_token ON hmis_px_food_orders(token_id);
CREATE INDEX idx_px_food_orders_status ON hmis_px_food_orders(centre_id, status) WHERE status NOT IN ('delivered', 'cancelled');
CREATE INDEX idx_px_food_orders_kitchen ON hmis_px_food_orders(centre_id, status) WHERE status IN ('nurse_approved', 'preparing', 'ready');

-- 2d. Complaints
CREATE TABLE IF NOT EXISTS hmis_px_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES hmis_px_tokens(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  bed_label VARCHAR(50),
  ward_name VARCHAR(100),
  patient_name VARCHAR(200),
  category px_complaint_category NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  priority VARCHAR(10) NOT NULL DEFAULT 'normal', -- normal, high
  status px_complaint_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES hmis_staff(id),
  assigned_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  sla_hours INT NOT NULL DEFAULT 24, -- target resolution time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_complaints_centre ON hmis_px_complaints(centre_id, status) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_px_complaints_token ON hmis_px_complaints(token_id);

-- 2e. Nurse Calls
CREATE TABLE IF NOT EXISTS hmis_px_nurse_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES hmis_px_tokens(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  bed_label VARCHAR(50),
  ward_name VARCHAR(100),
  patient_name VARCHAR(200),
  reason VARCHAR(200) NOT NULL,
  details TEXT,
  priority px_nurse_call_priority NOT NULL DEFAULT 'routine',
  status px_nurse_call_status NOT NULL DEFAULT 'pending',
  acknowledged_by UUID REFERENCES hmis_staff(id),
  acknowledged_at TIMESTAMPTZ,
  completed_by UUID REFERENCES hmis_staff(id),
  completed_at TIMESTAMPTZ,
  response_seconds INT, -- time from creation to acknowledged
  resolution_seconds INT, -- time from creation to completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_nurse_calls_active ON hmis_px_nurse_calls(centre_id, priority, status) WHERE status IN ('pending', 'acknowledged', 'in_progress');
CREATE INDEX idx_px_nurse_calls_token ON hmis_px_nurse_calls(token_id);

-- 2f. Feedback
CREATE TABLE IF NOT EXISTS hmis_px_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES hmis_px_tokens(id), -- nullable for post-discharge feedback
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  patient_name VARCHAR(200),
  overall_rating INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  category_ratings JSONB DEFAULT '{}',
  -- schema: { cleanliness: 4, food: 3, nursing: 5, doctors: 5, facilities: 4, billing: 3 }
  comments TEXT,
  would_recommend BOOLEAN,
  is_public BOOLEAN NOT NULL DEFAULT false, -- patient consents to share
  google_review_status VARCHAR(20) DEFAULT 'none', -- none, prompted, submitted, verified
  google_review_url TEXT,
  staff_response TEXT,
  responded_by UUID REFERENCES hmis_staff(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_feedback_centre ON hmis_px_feedback(centre_id);
CREATE INDEX idx_px_feedback_rating ON hmis_px_feedback(centre_id, overall_rating);

-- 2g. Activity Log
CREATE TABLE IF NOT EXISTS hmis_px_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES hmis_px_tokens(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID REFERENCES hmis_patients(id),
  activity_type px_activity_type NOT NULL,
  reference_id UUID, -- FK to the relevant table row
  details JSONB DEFAULT '{}',
  performed_by VARCHAR(50), -- 'patient' or staff UUID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_activity_log_token ON hmis_px_activity_log(token_id);
CREATE INDEX idx_px_activity_log_centre ON hmis_px_activity_log(centre_id, created_at DESC);

-- 3. RPC FUNCTIONS
-- ============================================================

-- 3a. Validate PX token — returns patient/admission context or null
CREATE OR REPLACE FUNCTION px_validate_token(p_token VARCHAR)
RETURNS TABLE (
  token_id UUID,
  patient_id UUID,
  admission_id UUID,
  centre_id UUID,
  bed_id UUID,
  ward_id UUID,
  patient_name TEXT,
  bed_label TEXT,
  ward_name TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS token_id,
    t.patient_id,
    t.admission_id,
    t.centre_id,
    t.bed_id,
    t.ward_id,
    (p.first_name || ' ' || COALESCE(p.last_name, ''))::TEXT AS patient_name,
    b.bed_number::TEXT AS bed_label,
    w.name::TEXT AS ward_name
  FROM hmis_px_tokens t
  JOIN hmis_patients p ON p.id = t.patient_id
  LEFT JOIN hmis_beds b ON b.id = t.bed_id
  LEFT JOIN hmis_wards w ON w.id = t.ward_id
  WHERE t.token = p_token
    AND t.is_active = true
    AND t.expired_at IS NULL;
END;
$$;

-- 3b. Generate PX token on admission
CREATE OR REPLACE FUNCTION px_generate_token(
  p_admission_id UUID,
  p_patient_id UUID,
  p_centre_id UUID,
  p_bed_id UUID DEFAULT NULL,
  p_ward_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token VARCHAR(12);
  v_exists BOOLEAN;
BEGIN
  -- Deactivate any existing active token for this admission
  UPDATE hmis_px_tokens
  SET is_active = false, expired_at = now()
  WHERE admission_id = p_admission_id AND is_active = true;

  -- Generate unique token (nanoid-style: alphanumeric, 12 chars)
  LOOP
    v_token := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    SELECT EXISTS(SELECT 1 FROM hmis_px_tokens WHERE token = v_token) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  INSERT INTO hmis_px_tokens (token, admission_id, patient_id, centre_id, bed_id, ward_id, created_by)
  VALUES (v_token, p_admission_id, p_patient_id, p_centre_id, p_bed_id, p_ward_id, p_created_by);

  -- Log activity
  INSERT INTO hmis_px_activity_log (token_id, centre_id, patient_id, activity_type, details, performed_by)
  SELECT id, p_centre_id, p_patient_id, 'token_created',
    jsonb_build_object('admission_id', p_admission_id),
    COALESCE(p_created_by::text, 'system')
  FROM hmis_px_tokens WHERE token = v_token;

  RETURN v_token;
END;
$$;

-- 3c. Expire PX token on discharge
CREATE OR REPLACE FUNCTION px_expire_token(p_admission_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE hmis_px_tokens
  SET is_active = false, expired_at = now()
  WHERE admission_id = p_admission_id AND is_active = true;

  -- Log activity
  INSERT INTO hmis_px_activity_log (token_id, centre_id, patient_id, activity_type, details, performed_by)
  SELECT id, centre_id, patient_id, 'token_expired',
    jsonb_build_object('admission_id', p_admission_id),
    'system'
  FROM hmis_px_tokens WHERE admission_id = p_admission_id;
END;
$$;

-- 3d. Nurse call rate limiter — returns true if allowed
CREATE OR REPLACE FUNCTION px_can_create_nurse_call(p_token_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_call TIMESTAMPTZ;
BEGIN
  SELECT MAX(created_at) INTO v_last_call
  FROM hmis_px_nurse_calls
  WHERE token_id = p_token_id
    AND status IN ('pending', 'acknowledged', 'in_progress')
    AND created_at > now() - interval '2 minutes';

  RETURN v_last_call IS NULL;
END;
$$;

-- 4. RLS POLICIES
-- ============================================================
-- Patient-side: uses px_validate_token RPC (SECURITY DEFINER) so no direct table access needed
-- Staff-side: standard centre-based RLS matching existing HMIS patterns

-- Enable RLS on all PX tables
ALTER TABLE hmis_px_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_food_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_food_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_nurse_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_activity_log ENABLE ROW LEVEL SECURITY;

-- Food menu: public read for active items (patients need to see this without auth)
CREATE POLICY "px_food_menu_public_read" ON hmis_px_food_menu
  FOR SELECT USING (is_available = true);

CREATE POLICY "px_food_menu_staff_all" ON hmis_px_food_menu
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_food_menu.centre_id
    )
  );

-- Staff policies for operational tables (orders, complaints, nurse calls, feedback, tokens, activity log)
-- Pattern: staff with centre assignment can view/manage records for their centre

CREATE POLICY "px_tokens_staff" ON hmis_px_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_tokens.centre_id
    )
  );

CREATE POLICY "px_food_orders_staff" ON hmis_px_food_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_food_orders.centre_id
    )
  );

CREATE POLICY "px_complaints_staff" ON hmis_px_complaints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_complaints.centre_id
    )
  );

CREATE POLICY "px_nurse_calls_staff" ON hmis_px_nurse_calls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_nurse_calls.centre_id
    )
  );

CREATE POLICY "px_feedback_staff" ON hmis_px_feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_feedback.centre_id
    )
  );

CREATE POLICY "px_activity_log_staff" ON hmis_px_activity_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_activity_log.centre_id
    )
  );

-- 5. SEED DATA — Shilaj Food Menu
-- ============================================================

INSERT INTO hmis_px_food_menu (centre_id, name, name_gujarati, category, description, price, dietary_tags, available_from, available_until, sort_order) VALUES
-- Breakfast (07:00 - 10:00)
('c0000001-0000-0000-0000-000000000001', 'Upma', 'ઉપમા', 'breakfast', 'Semolina with vegetables and mustard tempering', 60, '{veg}', '07:00', '10:00', 1),
('c0000001-0000-0000-0000-000000000001', 'Poha', 'પોહા', 'breakfast', 'Flattened rice with peanuts, turmeric and lemon', 50, '{veg,jain}', '07:00', '10:00', 2),
('c0000001-0000-0000-0000-000000000001', 'Idli Sambar (4 pcs)', 'ઈડલી સાંભાર', 'breakfast', 'Steamed rice cakes with sambar and chutney', 70, '{veg}', '07:00', '10:00', 3),
('c0000001-0000-0000-0000-000000000001', 'Toast Butter with Jam', 'ટોસ્ટ બટર', 'breakfast', '4 slices white/brown toast with butter and jam', 50, '{veg}', '07:00', '10:00', 4),
('c0000001-0000-0000-0000-000000000001', 'Moong Dal Chilla', 'મૂંગ દાળ ચીલા', 'breakfast', 'Protein-rich lentil crepe with green chutney', 60, '{veg,diabetic-friendly}', '07:00', '10:00', 5),
('c0000001-0000-0000-0000-000000000001', 'Oats Porridge', 'ઓટ્સ પોરીજ', 'breakfast', 'Warm oats with milk and dry fruits', 70, '{veg,diabetic-friendly}', '07:00', '10:00', 6),

-- Lunch (12:00 - 14:30)
('c0000001-0000-0000-0000-000000000001', 'Regular Thali (Veg)', 'રેગ્યુલર થાળી', 'lunch', 'Dal, sabzi, roti (4), rice, salad, papad, sweet', 120, '{veg}', '12:00', '14:30', 10),
('c0000001-0000-0000-0000-000000000001', 'Jain Thali', 'જૈન થાળી', 'lunch', 'Jain dal, sabzi (no onion/garlic), roti (4), rice', 130, '{veg,jain}', '12:00', '14:30', 11),
('c0000001-0000-0000-0000-000000000001', 'Diabetic Thali', 'ડાયાબિટીક થાળી', 'lunch', 'Low-GI dal, sabzi, multigrain roti (3), brown rice', 140, '{veg,diabetic-friendly,low-sodium}', '12:00', '14:30', 12),
('c0000001-0000-0000-0000-000000000001', 'Khichdi with Kadhi', 'ખીચડી કઢી', 'lunch', 'Moong dal khichdi with buttermilk kadhi — light on stomach', 90, '{veg,diabetic-friendly}', '12:00', '14:30', 13),
('c0000001-0000-0000-0000-000000000001', 'Liquid Diet Meal', 'લિક્વિડ ડાયેટ', 'lunch', 'Clear soup, dal water, fruit juice, buttermilk', 80, '{veg,liquid-diet}', '12:00', '14:30', 14),

-- Dinner (19:00 - 21:00)
('c0000001-0000-0000-0000-000000000001', 'Regular Thali (Dinner)', 'રેગ્યુલર થાળી (ડિનર)', 'dinner', 'Dal, sabzi, roti (3), rice, salad', 110, '{veg}', '19:00', '21:00', 20),
('c0000001-0000-0000-0000-000000000001', 'Soup & Sandwich', 'સૂપ અને સેન્ડવીચ', 'dinner', 'Tomato/mixed veg soup with grilled sandwich', 90, '{veg}', '19:00', '21:00', 21),
('c0000001-0000-0000-0000-000000000001', 'Dal Khichdi (Light)', 'દાળ ખીચડી', 'dinner', 'Easy to digest moong dal khichdi with ghee', 80, '{veg,diabetic-friendly}', '19:00', '21:00', 22),

-- Snacks (any time)
('c0000001-0000-0000-0000-000000000001', 'Fruit Plate', 'ફ્રૂટ પ્લેટ', 'snacks', 'Seasonal fresh fruits', 60, '{veg,jain,diabetic-friendly}', NULL, NULL, 30),
('c0000001-0000-0000-0000-000000000001', 'Biscuits & Tea', 'બિસ્કિટ અને ચા', 'snacks', 'Parle-G/Marie with masala chai', 30, '{veg}', NULL, NULL, 31),
('c0000001-0000-0000-0000-000000000001', 'Dry Fruit Mix', 'ડ્રાય ફ્રૂટ', 'snacks', 'Almonds, cashews, walnuts — 50g pack', 80, '{veg,jain}', NULL, NULL, 32),
('c0000001-0000-0000-0000-000000000001', 'Makhana (Roasted)', 'મખાના', 'snacks', 'Light roasted fox nuts with mild spicing', 50, '{veg,jain,diabetic-friendly}', NULL, NULL, 33),

-- Beverages (any time)
('c0000001-0000-0000-0000-000000000001', 'Masala Chai', 'મસાલા ચા', 'beverages', 'Indian spiced tea with milk', 20, '{veg}', NULL, NULL, 40),
('c0000001-0000-0000-0000-000000000001', 'Black Coffee', 'બ્લેક કોફી', 'beverages', 'Fresh brewed black coffee', 30, '{veg,jain,diabetic-friendly}', NULL, NULL, 41),
('c0000001-0000-0000-0000-000000000001', 'Buttermilk (Chaas)', 'છાશ', 'beverages', 'Spiced buttermilk — great for digestion', 20, '{veg}', NULL, NULL, 42),
('c0000001-0000-0000-0000-000000000001', 'Fresh Lime Water', 'લીંબુ પાણી', 'beverages', 'Nimbu paani with salt/sugar', 20, '{veg,jain,diabetic-friendly}', NULL, NULL, 43),
('c0000001-0000-0000-0000-000000000001', 'Coconut Water', 'નાળિયેર પાણી', 'beverages', 'Fresh tender coconut water', 50, '{veg,jain,diabetic-friendly}', NULL, NULL, 44),
('c0000001-0000-0000-0000-000000000001', 'Warm Water', 'ગરમ પાણી', 'beverages', 'Warm/hot drinking water', 0, '{veg,jain,diabetic-friendly,liquid-diet}', NULL, NULL, 45);

-- ═══════════════════════════════════════════════════════════════
-- SOURCE: abdm_integration.sql
-- ═══════════════════════════════════════════════════════════════
-- ============================================================
-- Health1 HMIS — ABDM (ABHA/HIE-CM) Integration Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Extend hmis_patients with full ABHA fields
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_status varchar(20);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_linked_at timestamptz;
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_kyc_verified boolean DEFAULT false;
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_profile jsonb;

CREATE INDEX IF NOT EXISTS idx_patients_abha ON hmis_patients(abha_number) WHERE abha_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_abha_addr ON hmis_patients(abha_address) WHERE abha_address IS NOT NULL;

-- 2. ABDM Configuration per centre
CREATE TABLE IF NOT EXISTS hmis_abdm_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    client_id varchar(100) NOT NULL,
    client_secret_encrypted text NOT NULL,
    environment varchar(20) NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    hip_id varchar(50) NOT NULL,
    hip_name varchar(200) NOT NULL,
    callback_url text,
    is_active boolean NOT NULL DEFAULT true,
    features jsonb DEFAULT '{"abha_creation":true,"abha_verification":true,"scan_share":true,"hie_cm":true}'::jsonb,
    last_token_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id)
);

-- 3. ABDM Link Requests (HIP linking flow)
CREATE TABLE IF NOT EXISTS hmis_abdm_link_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id varchar(100) NOT NULL,
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    care_context_ids text[],
    status varchar(20) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'otp_sent', 'linked', 'failed', 'expired')),
    otp_expiry timestamptz,
    linked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abdm_link_patient ON hmis_abdm_link_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_abdm_link_txn ON hmis_abdm_link_requests(transaction_id);

-- 4. HIE-CM Consent Requests (HIU requesting records)
CREATE TABLE IF NOT EXISTS hmis_abdm_consent_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_request_id varchar(100) NOT NULL,
    gateway_request_id varchar(100),
    patient_abha_address varchar(100) NOT NULL,
    hip_id varchar(50),
    hip_name varchar(200),
    purpose varchar(20) NOT NULL DEFAULT 'CAREMGT',
    hi_types text[] NOT NULL,
    date_range_from date NOT NULL,
    date_range_to date NOT NULL,
    expiry_date date NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'GRANTED', 'DENIED', 'EXPIRED', 'REVOKED')),
    consent_artefact_ids text[],
    requested_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_req_abha ON hmis_abdm_consent_requests(patient_abha_address);
CREATE INDEX IF NOT EXISTS idx_consent_req_status ON hmis_abdm_consent_requests(status);
CREATE INDEX IF NOT EXISTS idx_consent_req_id ON hmis_abdm_consent_requests(consent_request_id);

-- 5. Health Data Transfers (records received/sent via HIE-CM)
CREATE TABLE IF NOT EXISTS hmis_abdm_data_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_artefact_id varchar(100) NOT NULL,
    patient_id uuid REFERENCES hmis_patients(id),
    direction varchar(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    hi_type varchar(50) NOT NULL,
    care_context_reference varchar(100),
    fhir_bundle jsonb,
    status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'ACKNOWLEDGED', 'TRANSFERRED', 'FAILED')),
    transferred_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_transfer_consent ON hmis_abdm_data_transfers(consent_artefact_id);
CREATE INDEX IF NOT EXISTS idx_data_transfer_patient ON hmis_abdm_data_transfers(patient_id);

-- 6. ABDM Audit Log
CREATE TABLE IF NOT EXISTS hmis_abdm_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid REFERENCES hmis_patients(id),
    action varchar(50) NOT NULL,
    details jsonb,
    performed_by uuid REFERENCES hmis_staff(id),
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abdm_audit_patient ON hmis_abdm_audit_log(patient_id);

-- 7. Scan & Share session log
CREATE TABLE IF NOT EXISTS hmis_abdm_scan_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid REFERENCES hmis_centres(id),
    counter_id varchar(50),
    patient_id uuid REFERENCES hmis_patients(id),
    abha_number varchar(20),
    abha_address varchar(50),
    scan_type varchar(20) NOT NULL DEFAULT 'qr' CHECK (scan_type IN ('qr', 'manual', 'phr_app')),
    verified boolean NOT NULL DEFAULT false,
    linked boolean NOT NULL DEFAULT false,
    scanned_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. RLS Policies
DO $$
BEGIN
    EXECUTE 'ALTER TABLE hmis_abdm_config ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_cfg_pol ON hmis_abdm_config FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_link_requests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_link_pol ON hmis_abdm_link_requests FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_consent_requests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_consent_pol ON hmis_abdm_consent_requests FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_data_transfers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_data_pol ON hmis_abdm_data_transfers FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_audit_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_audit_pol ON hmis_abdm_audit_log FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_scan_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_scan_pol ON hmis_abdm_scan_sessions FOR ALL USING (auth.uid() IS NOT NULL)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- TABLES NOT IN ANY MIGRATION FILE — created here
-- ═══════════════════════════════════════════════════════════════

-- ABDM consent requests (referenced by lib/abdm/hie-cm.ts)
CREATE TABLE IF NOT EXISTS hmis_abdm_consent_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  purpose VARCHAR(100) NOT NULL,
  hi_types TEXT[] DEFAULT '{}',
  date_from DATE,
  date_to DATE,
  consent_id VARCHAR(200),
  status VARCHAR(30) DEFAULT 'requested' CHECK (status IN ('requested','granted','denied','revoked','expired')),
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ABDM link requests (referenced by lib/abdm/hie-cm.ts)
CREATE TABLE IF NOT EXISTS hmis_abdm_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  abha_address VARCHAR(100),
  link_ref_number VARCHAR(200),
  status VARCHAR(30) DEFAULT 'initiated' CHECK (status IN ('initiated','otp_sent','linked','failed','expired')),
  care_context_ids UUID[] DEFAULT '{}',
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prescription refill requests (referenced by lib/portal/portal-hooks.ts)
CREATE TABLE IF NOT EXISTS hmis_prescription_refill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  prescription_id UUID REFERENCES hmis_prescriptions(id),
  drug_name VARCHAR(200) NOT NULL,
  requested_quantity INT,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','dispensed')),
  reviewed_by UUID REFERENCES hmis_staff(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abdm_consent_patient ON hmis_abdm_consent_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_abdm_link_patient ON hmis_abdm_link_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_refill_patient ON hmis_prescription_refill_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_refill_status ON hmis_prescription_refill_requests(status);

CREATE TABLE IF NOT EXISTS hmis_pmjay_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    procedure_code varchar(20) NOT NULL,
    package_code varchar(20),
    specialty varchar(200),
    package_name varchar(500),
    procedure_name text,
    base_rate decimal(12,2) NOT NULL,          -- Tier3 (Z) base rate
    nabh_incentive decimal(12,2) NOT NULL,     -- 10% of base_rate
    effective_rate decimal(12,2) NOT NULL,      -- base + incentive
    implant_name text,
    implant_cost decimal(12,2) DEFAULT 0,
    total_with_implant decimal(12,2) NOT NULL,  -- effective_rate + implant_cost
    level_of_care varchar(20),
    alos int,                                   -- Average Length of Stay
    is_day_care boolean DEFAULT false,
    auto_approved boolean DEFAULT false,
    pre_auth_docs text,
    claim_docs text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, procedure_code)
);

CREATE INDEX IF NOT EXISTS idx_pmjay_centre ON hmis_pmjay_packages(centre_id);
CREATE INDEX IF NOT EXISTS idx_pmjay_specialty ON hmis_pmjay_packages(specialty);
CREATE INDEX IF NOT EXISTS idx_pmjay_name ON hmis_pmjay_packages(package_name);

ALTER TABLE hmis_pmjay_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_pmjay_packages_pol ON hmis_pmjay_packages;

CREATE INDEX IF NOT EXISTS idx_pmjay_centre ON hmis_pmjay_packages(centre_id);
CREATE INDEX IF NOT EXISTS idx_pmjay_code ON hmis_pmjay_packages(procedure_code);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 2 RLS — Enable RLS + standard centre-scoped policies
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
    t text;
    tables_with_centre text[] := ARRAY[
        'hmis_bed_turnover', 'hmis_bed_waitlist', 'hmis_clinical_alerts',
        'hmis_cost_centres', 'hmis_cost_centre_maps', 'hmis_cost_centre_expenses',
        'hmis_cssd_autoclaves', 'hmis_cssd_recall_log',
        'hmis_dialysis_monitoring', 'hmis_dialysis_patients',
        'hmis_duty_roster', 'hmis_duty_swap_requests', 'hmis_shift_definitions', 'hmis_staffing_requirements',
        'hmis_equipment', 'hmis_equipment_calibration', 'hmis_equipment_maintenance', 'hmis_equipment_pm_schedule',
        'hmis_housekeeping_schedules', 'hmis_housekeeping_tasks',
        'hmis_linen_exchange', 'hmis_linen_inventory',
        'hmis_mortuary',
        'hmis_physio_fms', 'hmis_physio_outcomes', 'hmis_physio_prevention_programs',
        'hmis_surgical_planning', 'hmis_surgical_checklist_items',
        'hmis_referring_doctors',
        'hmis_pmjay_packages',
        'hmis_px_complaints', 'hmis_px_feedback', 'hmis_px_food_menu', 'hmis_px_food_orders', 'hmis_px_nurse_calls',
        'hmis_abdm_consent_requests', 'hmis_abdm_link_requests'
    ];
BEGIN
    FOREACH t IN ARRAY tables_with_centre
    LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop existing policies to avoid conflicts
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
        
        -- Standard centre-scoped policies
        BEGIN
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (
                    centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin()
                )', t || '_select', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        
        BEGIN
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (
                    centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin()
                )', t || '_insert', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        
        BEGIN
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (
                    centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin()
                )', t || '_update', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        
        RAISE NOTICE 'RLS enabled on %', t;
    END LOOP;
END;
$$;

-- Reference tables — read-all, write-admin
DO $$
DECLARE
    t text;
    ref_tables text[] := ARRAY[
        'hmis_module_config', 'hmis_consent_templates', 'hmis_menu_master',
        'hmis_package_utilization'
    ];
BEGIN
    FOREACH t IN ARRAY ref_tables
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_modify', t);
        BEGIN
            EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t || '_select', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
            EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (hmis_is_super_admin())', t || '_modify', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        RAISE NOTICE 'RLS (ref) enabled on %', t;
    END LOOP;
END;
$$;

-- Patient-scoped tables (no centre_id — use patient_id FK)
DO $$
DECLARE
    t text;
    pat_tables text[] := ARRAY[
        'hmis_patient_consents', 'hmis_patient_feedback',
        'hmis_consent_audit', 'hmis_prescription_refill_requests'
    ];
BEGIN
    FOREACH t IN ARRAY pat_tables
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
        -- Authenticated staff can read/write (patient data access via RLS on parent tables)
        BEGIN
            EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t || '_select', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
            EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', t || '_insert', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
            EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true)', t || '_update', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        RAISE NOTICE 'RLS (patient) enabled on %', t;
    END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════
-- After running this migration, verify:
-- 1. SELECT count(*) FROM hmis_module_config;  -- should not error
-- 2. SELECT count(*) FROM hmis_px_food_menu;   -- should not error
-- 3. SELECT count(*) FROM hmis_surgical_planning; -- should not error
-- 4. SELECT count(*) FROM hmis_abdm_consent_requests; -- should not error
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- SOURCE: cdss_overrides_migration.sql
-- ═══════════════════════════════════════════════════════════════
-- cdss_overrides_migration.sql
-- Tracks when doctors override CDSS alerts (drug interactions, dose warnings, allergy conflicts)

CREATE TABLE IF NOT EXISTS hmis_cdss_overrides (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid REFERENCES hmis_centres(id),
  patient_id      uuid NOT NULL REFERENCES hmis_patients(id),
  encounter_id    uuid,                           -- EMR encounter or admission
  staff_id        uuid NOT NULL REFERENCES hmis_staff(id),
  alert_type      text NOT NULL CHECK (alert_type IN (
    'drug_interaction', 'dose_warning', 'allergy_conflict', 'contraindication'
  )),
  severity        text NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'contraindicated')),
  alert_message   text NOT NULL,
  drug_name       text,
  interacting_drug text,                          -- for interaction alerts
  override_reason text,                           -- optional doctor justification
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_cdss_overrides IS 'Audit trail of CDSS alert overrides by physicians';

CREATE INDEX IF NOT EXISTS idx_cdss_overrides_patient ON hmis_cdss_overrides (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdss_overrides_staff ON hmis_cdss_overrides (staff_id, created_at DESC);

-- RLS
ALTER TABLE hmis_cdss_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cdss overrides"
  ON hmis_cdss_overrides FOR SELECT USING (true);

CREATE POLICY "Staff can create cdss overrides"
  ON hmis_cdss_overrides FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- SOURCE: notification_preferences.sql
-- ═══════════════════════════════════════════════════════════════
-- notification_preferences.sql
-- Stores per-centre notification preferences (which events trigger WhatsApp / SMS / email)
-- Also creates a log table for audit trail

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_notification_preferences (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id     uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  event_type    text NOT NULL CHECK (event_type IN (
    'appointment_reminder', 'lab_ready', 'pharmacy_ready', 'discharge_summary',
    'opd_token', 'payment_receipt', 'follow_up_reminder'
  )),
  channel       text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  is_enabled    boolean NOT NULL DEFAULT true,
  template_text text,  -- optional custom template override
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  UNIQUE (centre_id, event_type, channel)
);

COMMENT ON TABLE hmis_notification_preferences IS 'Per-centre toggle for notification events and channels';

-- Index for fast lookup in API route
CREATE INDEX IF NOT EXISTS idx_notif_pref_lookup
  ON hmis_notification_preferences (centre_id, event_type, channel);

-- ============================================================
-- NOTIFICATION LOG (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_notification_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id     uuid REFERENCES hmis_centres(id),
  event_type    text NOT NULL,
  channel       text NOT NULL DEFAULT 'whatsapp',
  phone         text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  message_id    text,        -- WhatsApp message ID from Meta API
  error_message text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_centre_date
  ON hmis_notification_log (centre_id, created_at DESC);

-- ============================================================
-- SEED DEFAULT PREFERENCES (one row per event per centre)
-- ============================================================
INSERT INTO hmis_notification_preferences (centre_id, event_type, channel, is_enabled, template_text)
SELECT
  c.id,
  ev.event_type,
  'whatsapp',
  true,
  ev.default_template
FROM hmis_centres c
CROSS JOIN (VALUES
  ('appointment_reminder', 'Hello {{patient_name}}, reminder for your appointment with {{doctor_name}} on {{date}} at {{time}} at {{centre_name}}.'),
  ('lab_ready',            'Hello {{patient_name}}, your lab results for {{test_names}} are ready. Collect from {{collection_point}}.'),
  ('pharmacy_ready',       'Hello {{patient_name}}, your {{medicine_count}} medicines are ready at {{pharmacy_counter}}.'),
  ('discharge_summary',    'Hello {{patient_name}}, IPD# {{ipd_number}} discharge on {{discharge_date}}. Follow-up: {{follow_up_date}}.'),
  ('opd_token',            'Hello {{patient_name}}, your token is {{token_number}}. Doctor: {{doctor_name}}. Wait: {{estimated_wait}}.'),
  ('payment_receipt',      'Hello {{patient_name}}, payment received. Receipt: {{receipt_number}}, Amount: {{amount}}, Mode: {{payment_mode}}.'),
  ('follow_up_reminder',   'Hello {{patient_name}}, follow-up with {{doctor_name}} on {{date}} at {{centre_name}}. {{advice}}')
) AS ev(event_type, default_template)
ON CONFLICT (centre_id, event_type, channel) DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view notification preferences"
  ON hmis_notification_preferences FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage notification preferences"
  ON hmis_notification_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can view notification log"
  ON hmis_notification_log FOR SELECT
  USING (true);

CREATE POLICY "System can insert notification log"
  ON hmis_notification_log FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- SEED SMS PREFERENCES (disabled by default — admin enables per centre)
-- ============================================================
INSERT INTO hmis_notification_preferences (centre_id, event_type, channel, is_enabled, template_text)
SELECT
  c.id,
  ev.event_type,
  'sms',
  false,
  ev.default_template
FROM hmis_centres c
CROSS JOIN (VALUES
  ('appointment_reminder', 'Hello {{patient_name}}, reminder: appointment with {{doctor_name}} on {{date}} at {{time}}. Health1 Hospital'),
  ('lab_ready',            'Hello {{patient_name}}, your lab results for {{test_names}} are ready. Collect from Lab Reception. Health1'),
  ('pharmacy_ready',       'Hello {{patient_name}}, your {{medicine_count}} medicines are ready at Pharmacy Counter. Health1'),
  ('discharge_summary',    'Hello {{patient_name}}, IPD# {{ipd_number}} discharged on {{discharge_date}}. Follow-up: {{follow_up_date}}. Health1'),
  ('opd_token',            'Hello {{patient_name}}, token {{token_number}} for Dr {{doctor_name}}. Wait: {{estimated_wait}}. Health1'),
  ('payment_receipt',      'Hello {{patient_name}}, payment received. Receipt: {{receipt_number}}, Amount: {{amount}}. Health1'),
  ('follow_up_reminder',   'Hello {{patient_name}}, follow-up with {{doctor_name}} on {{date}}. Health1 Hospital')
) AS ev(event_type, default_template)
ON CONFLICT (centre_id, event_type, channel) DO NOTHING;

-- ============================================================
-- INTEGRATION CONFIG (MSG91, Resend, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_integration_config (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider    text NOT NULL,  -- 'msg91', 'resend', 'razorpay', etc.
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean DEFAULT true,
  centre_id   uuid REFERENCES hmis_centres(id),  -- NULL = global
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (provider, centre_id)
);

COMMENT ON TABLE hmis_integration_config IS 'Third-party integration credentials and config (MSG91, Resend, etc.)';

ALTER TABLE hmis_integration_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view integration config"
  ON hmis_integration_config FOR SELECT USING (true);

CREATE POLICY "Admin can manage integration config"
  ON hmis_integration_config FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_notif_pref_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notif_pref_updated_at
  BEFORE UPDATE ON hmis_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_notif_pref_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- SOURCE: report_subscriptions.sql
-- ═══════════════════════════════════════════════════════════════
-- report_subscriptions.sql
-- Automated report email subscriptions

CREATE TABLE IF NOT EXISTS hmis_report_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id   uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  email       text NOT NULL,
  report_type text NOT NULL DEFAULT 'daily_summary' CHECK (report_type IN (
    'daily_summary', 'revenue', 'occupancy', 'lab_tat', 'pharmacy',
    'doctor_performance', 'discharge_tat', 'insurance', 'weekly_summary', 'monthly_summary'
  )),
  frequency   text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  is_active   boolean DEFAULT true,
  last_sent_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_report_subscriptions IS 'Email recipients for automated daily/weekly/monthly reports';

CREATE INDEX IF NOT EXISTS idx_report_subs_active
  ON hmis_report_subscriptions (is_active, frequency);

-- Seed default subscription
INSERT INTO hmis_report_subscriptions (centre_id, email, report_type, frequency, is_active)
SELECT
  c.id,
  'keyaboratory@gmail.com',
  'daily_summary',
  'daily',
  true
FROM hmis_centres c
WHERE c.code = 'SHL' OR c.name ILIKE '%shilaj%'
LIMIT 1
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE hmis_report_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view report subscriptions"
  ON hmis_report_subscriptions FOR SELECT USING (true);

CREATE POLICY "Staff can manage report subscriptions"
  ON hmis_report_subscriptions FOR ALL USING (true) WITH CHECK (true);
