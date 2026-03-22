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
