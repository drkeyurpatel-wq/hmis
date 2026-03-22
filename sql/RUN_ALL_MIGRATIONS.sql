-- ═══════════════════════════════════════════════════════════════
-- Health1 HMIS — ALL MODULE MIGRATIONS (Combined)
-- Run this ONCE in Supabase SQL Editor: https://supabase.com/dashboard/project/bmuupgrzbfmddjwcqlss/sql/new
-- Safe to run multiple times (all statements are IF NOT EXISTS / IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- FILE: ALTER_APPOINTMENTS.sql
-- ═══════════════════════════════════════════════════════════════

-- Health1 HMIS — Appointments module column additions
-- Run in Supabase SQL Editor

-- Add missing columns to hmis_appointments
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS token_number int;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS priority varchar(10) DEFAULT 'normal' CHECK (priority IN ('normal','urgent','vip'));
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS visit_reason text;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS booking_source varchar(20) DEFAULT 'counter';
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS booked_by uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS consultation_start timestamptz;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS consultation_end timestamptz;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS rescheduled_from uuid REFERENCES hmis_appointments(id);
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS slot_end_time time;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS appointment_type varchar(20);
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS estimated_wait_min int;

-- Drop the type CHECK and replace with wider range
ALTER TABLE hmis_appointments DROP CONSTRAINT IF EXISTS hmis_appointments_type_check;
ALTER TABLE hmis_appointments ADD CONSTRAINT hmis_appointments_type_check 
  CHECK (type IN ('new','followup','referral','emergency','review','procedure','teleconsult'));

-- Drop the status CHECK and replace with wider range  
ALTER TABLE hmis_appointments DROP CONSTRAINT IF EXISTS hmis_appointments_status_check;
ALTER TABLE hmis_appointments ADD CONSTRAINT hmis_appointments_status_check 
  CHECK (status IN ('scheduled','booked','confirmed','checked_in','in_progress','in_consultation','completed','no_show','cancelled','rescheduled'));

-- Add missing columns to hmis_doctor_schedules
ALTER TABLE hmis_doctor_schedules ADD COLUMN IF NOT EXISTS consultation_fee decimal(10,2) DEFAULT 0;
ALTER TABLE hmis_doctor_schedules ADD COLUMN IF NOT EXISTS room_number varchar(20);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_appt_token ON hmis_appointments(centre_id, doctor_id, appointment_date, token_number);
CREATE INDEX IF NOT EXISTS idx_appt_status ON hmis_appointments(status);


-- ═══════════════════════════════════════════════════════════════
-- FILE: ALTER_BILLING_FOR_MEDPAY.sql
-- ═══════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- Health1 HMIS — Billing schema for MedPay integration (v2)
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)
-- DOES NOT touch MedPay. Only modifies HMIS tables.
-- ════════════════════════════════════════════════════════════════

-- ═══ 1. hmis_bill_items — doctor attribution per line item ═══

-- Service doctor: who performed the service (earns the revenue)
-- Defaults to doctor_id if not explicitly set
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS service_doctor_id uuid REFERENCES hmis_staff(id);

-- Consulting doctor: the admitting/primary doctor on the case
-- Auto-populated from admission.primary_doctor_id or OPD visit.doctor_id
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS consulting_doctor_id uuid REFERENCES hmis_staff(id);

-- Referring doctor (internal — FK when the referrer is in our system)
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS referring_doctor_id uuid REFERENCES hmis_staff(id);

-- Referring doctor (external — free text for outside referrers not in hmis_staff)
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS referring_doctor_name varchar(200);

-- Billing category: derived from ward/room type
-- Maps to MedPay values: ICU, ECONOMY-1, TWIN SHARING, SPECIAL, SUITE ROOM, etc.
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS billing_category varchar(50);

-- Service category for MedPay department mapping
-- Maps to: include, exclude, pharmacy, health_checkup, conditional
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS service_category varchar(50);

-- Package reference (for package-based billing)
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS package_id uuid;

-- OT booking reference (links OT charges to surgery details)
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS ot_booking_id uuid;

-- Admission reference on line item (for IPD charges)
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES hmis_admissions(id);

CREATE INDEX IF NOT EXISTS idx_bill_items_service_dr ON hmis_bill_items(service_doctor_id) WHERE service_doctor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bill_items_consulting_dr ON hmis_bill_items(consulting_doctor_id) WHERE consulting_doctor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bill_items_admission ON hmis_bill_items(admission_id) WHERE admission_id IS NOT NULL;

-- ═══ 2. hmis_bills — header-level additions ═══

-- MedPay sync tracking
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS medpay_synced boolean DEFAULT false;
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS medpay_synced_at timestamptz;
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS medpay_upload_id int;

-- Insurer FK (replaces free-text insurer_name)
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS insurer_id uuid REFERENCES hmis_insurers(id);
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS insurer_name varchar(200);

-- Case type: auto-derived from referral data
-- "Hospital Case" = no external referral, "Ref Doctor Case" = has referring doctor
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS case_type varchar(30) DEFAULT 'Hospital Case';

-- Admission link on bill header (for IPD bills)
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES hmis_admissions(id);

-- Room/billing category at bill level (from admission bed assignment)
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS billing_category varchar(50);

CREATE INDEX IF NOT EXISTS idx_bills_medpay_sync ON hmis_bills(medpay_synced) WHERE medpay_synced = false;
CREATE INDEX IF NOT EXISTS idx_bills_admission ON hmis_bills(admission_id) WHERE admission_id IS NOT NULL;

-- ═══ 3. OT bookings — ensure surgeon attribution columns exist ═══

ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS assistant_surgeon_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS surgeon_charges decimal(12,2) DEFAULT 0;
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS asst_surgeon_charges decimal(12,2) DEFAULT 0;
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS anaesthetist_charges decimal(12,2) DEFAULT 0;
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS total_ot_charges decimal(12,2) DEFAULT 0;

-- ═══ 4. Doctor mapping table (HMIS UUID ↔ MedPay INT) ═══

CREATE TABLE IF NOT EXISTS hmis_medpay_doctor_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hmis_staff_id uuid NOT NULL REFERENCES hmis_staff(id),
  medpay_doctor_id int NOT NULL,
  medpay_doctor_name varchar(200),
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(hmis_staff_id),
  UNIQUE(medpay_doctor_id)
);

-- ═══ 5. Sync log ═══

CREATE TABLE IF NOT EXISTS hmis_medpay_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type varchar(20) DEFAULT 'bill_push',
  centre_id uuid REFERENCES hmis_centres(id),
  month varchar(7),
  bills_synced int DEFAULT 0,
  rows_pushed int DEFAULT 0,
  medpay_upload_id int,
  status varchar(20) DEFAULT 'success',
  error_message text,
  synced_by uuid REFERENCES hmis_staff(id),
  created_at timestamptz DEFAULT now()
);

-- ═══ 6. Ward type → MedPay billing_category mapping ═══

CREATE TABLE IF NOT EXISTS hmis_billing_category_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_type varchar(30) NOT NULL UNIQUE,
  billing_category varchar(50) NOT NULL,
  notes text
);

INSERT INTO hmis_billing_category_map (ward_type, billing_category) VALUES
  ('general', 'ECONOMY-1'),
  ('semi_private', 'TWIN SHARING'),
  ('private', 'SPECIAL'),
  ('icu', 'ICU'),
  ('nicu', 'ICU'),
  ('picu', 'ICU'),
  ('transplant_icu', 'Transplant Unit'),
  ('isolation', 'ICU')
ON CONFLICT (ward_type) DO NOTHING;

-- ═══ 7. Function: derive billing_category from admission bed ═══

CREATE OR REPLACE FUNCTION hmis_get_billing_category(p_admission_id uuid)
RETURNS varchar(50) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ward_type varchar(20);
  v_category varchar(50);
  v_adm_type varchar(20);
BEGIN
  -- Check admission type first (daycare)
  SELECT admission_type INTO v_adm_type FROM hmis_admissions WHERE id = p_admission_id;
  IF v_adm_type = 'daycare' THEN RETURN 'DAY CARE'; END IF;

  -- Get ward type from bed assignment
  SELECT w.type INTO v_ward_type
  FROM hmis_beds b
  JOIN hmis_rooms r ON r.id = b.room_id
  JOIN hmis_wards w ON w.id = r.ward_id
  WHERE b.current_admission_id = p_admission_id
  LIMIT 1;

  IF v_ward_type IS NULL THEN RETURN 'ECONOMY-1'; END IF;

  SELECT billing_category INTO v_category
  FROM hmis_billing_category_map WHERE ward_type = v_ward_type;

  RETURN COALESCE(v_category, 'ECONOMY-1');
END;
$$;

-- ═══ 8. Function: derive case_type from referral data ═══

CREATE OR REPLACE FUNCTION hmis_get_case_type(p_admission_id uuid)
RETURNS varchar(30) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ref_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM hmis_referrals
    WHERE admission_id = p_admission_id
    AND (referring_doctor_id IS NOT NULL OR referring_doctor_name IS NOT NULL)
  ) INTO v_ref_exists;

  IF v_ref_exists THEN RETURN 'Ref Doctor Case';
  ELSE RETURN 'Hospital Case';
  END IF;
END;
$$;

-- ═══ 9. Function: auto-populate bill_items doctor attribution ═══
-- Call this when finalizing a bill to fill in service/consulting/referring doctors

CREATE OR REPLACE FUNCTION hmis_populate_bill_doctors(p_bill_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_bill RECORD;
  v_adm RECORD;
  v_ref RECORD;
  v_billing_cat varchar(50);
  v_case_type varchar(30);
BEGIN
  -- Get bill header
  SELECT * INTO v_bill FROM hmis_bills WHERE id = p_bill_id;
  IF v_bill IS NULL THEN RETURN; END IF;

  -- For IPD bills, get admission context
  IF v_bill.bill_type = 'ipd' AND v_bill.admission_id IS NOT NULL THEN
    SELECT a.*, s.full_name as primary_doctor_name
    INTO v_adm
    FROM hmis_admissions a
    LEFT JOIN hmis_staff s ON s.id = a.primary_doctor_id
    WHERE a.id = v_bill.admission_id;

    -- Derive billing category and case type
    v_billing_cat := hmis_get_billing_category(v_bill.admission_id);
    v_case_type := hmis_get_case_type(v_bill.admission_id);

    -- Update bill header
    UPDATE hmis_bills SET
      billing_category = v_billing_cat,
      case_type = v_case_type
    WHERE id = p_bill_id;

    -- Get referring doctor if exists
    SELECT r.referring_doctor_id, r.referring_doctor_name,
           s.full_name as ref_doctor_full_name
    INTO v_ref
    FROM hmis_referrals r
    LEFT JOIN hmis_staff s ON s.id = r.referring_doctor_id
    WHERE r.admission_id = v_bill.admission_id
    LIMIT 1;

    -- Populate bill_items
    UPDATE hmis_bill_items SET
      consulting_doctor_id = COALESCE(consulting_doctor_id, v_adm.primary_doctor_id),
      service_doctor_id = COALESCE(service_doctor_id, doctor_id, v_adm.primary_doctor_id),
      referring_doctor_id = COALESCE(referring_doctor_id, v_ref.referring_doctor_id),
      referring_doctor_name = COALESCE(referring_doctor_name, v_ref.ref_doctor_full_name, v_ref.referring_doctor_name),
      billing_category = COALESCE(billing_category, v_billing_cat),
      admission_id = v_bill.admission_id
    WHERE bill_id = p_bill_id;

  ELSIF v_bill.bill_type = 'opd' THEN
    -- OPD: consulting doctor = the OPD doctor, billing_category = StandardOpCategory
    UPDATE hmis_bills SET
      billing_category = 'StandardOpCategory',
      case_type = 'Hospital Case'
    WHERE id = p_bill_id;

    -- For OPD items, service_doctor = consulting_doctor = item doctor
    UPDATE hmis_bill_items SET
      consulting_doctor_id = COALESCE(consulting_doctor_id, doctor_id),
      service_doctor_id = COALESCE(service_doctor_id, doctor_id),
      billing_category = 'StandardOpCategory'
    WHERE bill_id = p_bill_id;
  END IF;
END;
$$;

-- ═══ DONE ═══
-- Usage:
-- 1. When a bill is finalized: SELECT hmis_populate_bill_doctors('bill-uuid');
-- 2. This auto-fills consulting_doctor, service_doctor, referring_doctor, 
--    billing_category, case_type from admission/referral/bed data
-- 3. POST /api/medpay/sync then reads these clean fields and pushes to MedPay
-- 4. MedPay's existing eCW CSV flow is completely unaffected

-- ═══ 10. hmis_referrals — add FK for internal referring doctors ═══
ALTER TABLE hmis_referrals ADD COLUMN IF NOT EXISTS referring_doctor_id uuid REFERENCES hmis_staff(id);


-- ═══════════════════════════════════════════════════════════════
-- FILE: ALTER_REFERRALS.sql
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
-- FILE: ALTER_CATHLAB.sql
-- ═══════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════
-- FILE: ALTER_DIALYSIS.sql
-- ═══════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════
-- FILE: ALTER_ENDOSCOPY.sql
-- ═══════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════
-- FILE: ALTER_CSSD.sql
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
-- FILE: ALTER_DIETARY.sql
-- ═══════════════════════════════════════════════════════════════

-- Health1 HMIS — Dietary & Kitchen schema (Indian hospital)
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Menu master (Indian meals) ═══

CREATE TABLE IF NOT EXISTS hmis_menu_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  item_name varchar(100) NOT NULL,
  item_name_gujarati varchar(100),
  category varchar(20) NOT NULL CHECK (category IN ('main_course','dal','rice','roti','sabzi','salad','soup','dessert','beverage','snack','fruit','curd_raita','chutney','papad')),
  food_type varchar(10) NOT NULL DEFAULT 'veg' CHECK (food_type IN ('veg','nonveg','egg','jain','vegan')),
  texture varchar(15) DEFAULT 'normal' CHECK (texture IN ('normal','soft','pureed','liquid','minced')),
  -- Nutrition per serving
  calories_kcal int,
  protein_g decimal(5,1),
  carbs_g decimal(5,1),
  fat_g decimal(5,1),
  fiber_g decimal(5,1),
  sodium_mg int,
  potassium_mg int,
  phosphorus_mg int,
  sugar_g decimal(5,1),
  -- Flags
  is_gluten_free boolean DEFAULT false,
  is_lactose_free boolean DEFAULT false,
  is_nut_free boolean DEFAULT true,
  is_low_sodium boolean DEFAULT false,
  is_low_potassium boolean DEFAULT false,
  is_high_protein boolean DEFAULT false,
  -- Diet compatibility
  suitable_for text[] DEFAULT '{}', -- regular, diabetic, renal, cardiac, etc.
  allergens text[] DEFAULT '{}', -- milk, nuts, gluten, soy, etc.
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ═══ 2. Daily menu (what's cooking today) ═══

CREATE TABLE IF NOT EXISTS hmis_daily_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  menu_date date NOT NULL,
  meal_type varchar(20) NOT NULL CHECK (meal_type IN ('early_tea','breakfast','mid_morning','lunch','evening_tea','dinner','bedtime')),
  diet_type varchar(30) NOT NULL DEFAULT 'regular',
  food_type varchar(10) NOT NULL DEFAULT 'veg',
  items jsonb NOT NULL DEFAULT '[]',
  -- Format: [{ item_id, item_name, category, portion_size, calories }]
  prepared_by uuid REFERENCES hmis_staff(id),
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(centre_id, menu_date, meal_type, diet_type, food_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_menu ON hmis_daily_menu(centre_id, menu_date, meal_type);

-- ═══ 3. Diet orders — enhanced ═══

ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS centre_id uuid REFERENCES hmis_centres(id);
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES hmis_patients(id);
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active';
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS food_preference varchar(10) DEFAULT 'veg' CHECK (food_preference IN ('veg','nonveg','egg','jain','vegan'));
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS texture varchar(15) DEFAULT 'normal' CHECK (texture IN ('normal','soft','pureed','liquid','minced'));
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS special_instructions text;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}';
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS calorie_target int;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS protein_target int;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS fluid_restriction_ml int; -- NULL = no restriction
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS sodium_restriction_mg int;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS potassium_restriction_mg int;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS meal_plan jsonb DEFAULT '{"early_tea":true,"breakfast":true,"mid_morning":true,"lunch":true,"evening_tea":true,"dinner":true,"bedtime":true}';
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS extra_items text; -- e.g. "extra curd", "no onion no garlic"
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS fasting boolean DEFAULT false;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS npo_from timestamptz;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS npo_reason text;

-- ═══ 4. Meal service — enhanced ═══

ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS items_served jsonb DEFAULT '[]';
-- Format: [{ item_name, portion, calories }]
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS total_calories int;
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS fluid_intake_ml int;
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS patient_feedback varchar(20); -- excellent, good, average, poor
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS oral_intake_pct int; -- 0-100%, how much was eaten
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS temperature_ok boolean DEFAULT true;
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS delivered_to varchar(50); -- bed number

-- ═══ 5. Kitchen production planning ═══

CREATE TABLE IF NOT EXISTS hmis_kitchen_production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  production_date date NOT NULL,
  meal_type varchar(20) NOT NULL,
  -- Counts by food type
  veg_count int DEFAULT 0,
  nonveg_count int DEFAULT 0,
  jain_count int DEFAULT 0,
  -- Counts by diet type
  regular_count int DEFAULT 0,
  diabetic_count int DEFAULT 0,
  renal_count int DEFAULT 0,
  cardiac_count int DEFAULT 0,
  liquid_count int DEFAULT 0,
  soft_count int DEFAULT 0,
  npo_count int DEFAULT 0,
  other_diet_count int DEFAULT 0,
  -- Counts by texture
  normal_texture int DEFAULT 0,
  pureed_texture int DEFAULT 0,
  liquid_texture int DEFAULT 0,
  -- Total
  total_meals int DEFAULT 0,
  staff_meals int DEFAULT 0,
  -- Ward breakdown
  ward_counts jsonb DEFAULT '{}', -- { "ICU": 12, "General Ward": 45, ... }
  -- Status
  prepared boolean DEFAULT false,
  prepared_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(centre_id, production_date, meal_type)
);

-- ═══ 6. Seed Indian menu items ═══

INSERT INTO hmis_menu_master (centre_id, item_name, item_name_gujarati, category, food_type, calories_kcal, protein_g, carbs_g, fat_g, suitable_for) VALUES
  -- Dal varieties
  ('c0000001-0000-0000-0000-000000000001', 'Dal Tadka', 'દાળ તડકા', 'dal', 'veg', 150, 8, 20, 4, '{regular,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Moong Dal', 'મૂંગ દાળ', 'dal', 'veg', 120, 9, 18, 2, '{regular,diabetic,cardiac,renal,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Toor Dal', 'તુવેર દાળ', 'dal', 'veg', 140, 8, 22, 3, '{regular,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Masoor Dal', 'મસૂર દાળ', 'dal', 'jain', 130, 9, 20, 2, '{regular,diabetic}'),
  -- Rice
  ('c0000001-0000-0000-0000-000000000001', 'Steamed Rice', 'ભાત', 'rice', 'veg', 200, 4, 44, 0.5, '{regular,cardiac,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Jeera Rice', 'જીરા ભાત', 'rice', 'veg', 220, 4, 42, 3, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Khichdi', 'ખીચડી', 'rice', 'veg', 180, 6, 30, 3, '{regular,diabetic,soft,renal}'),
  ('c0000001-0000-0000-0000-000000000001', 'Dal-Khichdi', 'દાળ ખીચડી', 'rice', 'veg', 200, 8, 32, 3, '{regular,diabetic,soft,high_protein}'),
  -- Roti
  ('c0000001-0000-0000-0000-000000000001', 'Phulka (2pc)', 'ફૂલકા', 'roti', 'veg', 140, 4, 28, 1, '{regular,diabetic,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Chapati (2pc)', 'ચપાતી', 'roti', 'veg', 160, 5, 30, 2, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Bajra Roti (2pc)', 'બાજરી રોટલા', 'roti', 'veg', 180, 5, 34, 2, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'Jowar Roti (2pc)', 'જુવાર રોટલા', 'roti', 'veg', 170, 5, 32, 2, '{regular,diabetic}'),
  -- Sabzi
  ('c0000001-0000-0000-0000-000000000001', 'Aloo-Gobi', 'આલુ ગોબી', 'sabzi', 'veg', 120, 3, 18, 4, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Bhindi Masala', 'ભીંડી', 'sabzi', 'veg', 80, 2, 10, 4, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'Lauki Sabzi', 'દૂધી', 'sabzi', 'veg', 60, 1, 8, 3, '{regular,diabetic,renal,cardiac,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Palak Paneer', 'પાલક પનીર', 'sabzi', 'veg', 200, 12, 8, 14, '{regular,high_protein}'),
  ('c0000001-0000-0000-0000-000000000001', 'Mix Veg', 'મિક્સ વેજ', 'sabzi', 'veg', 100, 3, 12, 4, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'Sev Tameta', 'સેવ ટમેટા', 'sabzi', 'jain', 110, 2, 14, 5, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Tindora Nu Shaak', 'તીંડોરા', 'sabzi', 'veg', 70, 2, 8, 3, '{regular,diabetic}'),
  -- Soup
  ('c0000001-0000-0000-0000-000000000001', 'Tomato Soup', 'ટોમેટો સૂપ', 'soup', 'veg', 80, 2, 12, 2, '{regular,soft,liquid,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Dal Soup (strained)', 'દાળ સૂપ', 'soup', 'veg', 90, 6, 14, 1, '{regular,liquid,renal,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Chicken Clear Soup', 'ચિકન સૂપ', 'soup', 'nonveg', 60, 8, 2, 2, '{regular,high_protein,liquid}'),
  -- Non-veg
  ('c0000001-0000-0000-0000-000000000001', 'Chicken Curry', 'ચિકન કરી', 'main_course', 'nonveg', 250, 25, 8, 14, '{regular,high_protein}'),
  ('c0000001-0000-0000-0000-000000000001', 'Fish Curry', 'માછલી કરી', 'main_course', 'nonveg', 200, 22, 6, 10, '{regular,high_protein,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Egg Bhurji (2 eggs)', 'ઈંડા ભુર્જી', 'main_course', 'egg', 180, 14, 4, 12, '{regular,high_protein,diabetic}'),
  -- Breakfast
  ('c0000001-0000-0000-0000-000000000001', 'Poha', 'પોહા', 'snack', 'veg', 180, 4, 30, 4, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'Upma', 'ઉપમા', 'snack', 'veg', 200, 5, 28, 6, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Idli-Sambhar (3pc)', 'ઇડલી-સાંભાર', 'snack', 'veg', 220, 7, 38, 3, '{regular,diabetic,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Thepla (2pc)', 'થેપલા', 'roti', 'veg', 200, 5, 26, 8, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Moong Dal Cheela (2pc)', 'મૂંગ દાળ ચીલા', 'snack', 'veg', 160, 10, 20, 4, '{regular,diabetic,high_protein}'),
  ('c0000001-0000-0000-0000-000000000001', 'Bread-Butter-Jam', 'બ્રેડ-બટર', 'snack', 'veg', 250, 5, 36, 10, '{regular}'),
  -- Curd/Raita
  ('c0000001-0000-0000-0000-000000000001', 'Dahi (plain curd)', 'દહીં', 'curd_raita', 'veg', 60, 4, 5, 3, '{regular,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Chaas (buttermilk)', 'છાશ', 'beverage', 'veg', 40, 2, 4, 1, '{regular,diabetic,soft,renal}'),
  ('c0000001-0000-0000-0000-000000000001', 'Boondi Raita', 'બૂંદી રાયતું', 'curd_raita', 'veg', 80, 3, 8, 4, '{regular}'),
  -- Beverages
  ('c0000001-0000-0000-0000-000000000001', 'Chai (tea)', 'ચા', 'beverage', 'veg', 50, 2, 6, 2, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Chai (sugar-free)', 'ચા (સુગર ફ્રી)', 'beverage', 'veg', 20, 2, 1, 1, '{regular,diabetic,renal,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Milk (warm)', 'દૂધ', 'beverage', 'veg', 100, 6, 8, 4, '{regular,soft,high_protein}'),
  ('c0000001-0000-0000-0000-000000000001', 'Nimbu Pani', 'લીંબુ પાણી', 'beverage', 'veg', 30, 0, 8, 0, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'ORS', 'ઓઆરએસ', 'beverage', 'veg', 20, 0, 5, 0, '{regular,liquid}'),
  -- Dessert/Fruit
  ('c0000001-0000-0000-0000-000000000001', 'Seasonal Fruit', 'ફળ', 'fruit', 'veg', 60, 1, 14, 0, '{regular,diabetic,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Banana', 'કેળું', 'fruit', 'veg', 90, 1, 22, 0, '{regular,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Kheer (small)', 'ખીર', 'dessert', 'veg', 150, 4, 24, 4, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Sugar-free Custard', 'કસ્ટર્ડ', 'dessert', 'veg', 80, 3, 10, 3, '{regular,diabetic,soft}')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- FILE: ALTER_PHYSIOTHERAPY.sql
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
-- FILE: ALTER_PACKAGES.sql
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

