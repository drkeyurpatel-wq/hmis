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
