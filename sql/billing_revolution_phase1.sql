-- ============================================================
-- Health1 HMIS — Billing Revolution Phase 1: Foundation Schema
-- Run EACH section individually in Supabase SQL Editor
-- Project: bmuupgrzbfmddjwcqlss
-- Date: 2026-04-13
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. SERVICE MASTER (Enhanced Tariff — extends hmis_tariff_master)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_service_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'GENERAL',
  service_category TEXT NOT NULL DEFAULT 'Other',
  base_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_applicable BOOLEAN DEFAULT false,
  gst_percentage NUMERIC(5,2) DEFAULT 0,
  hsn_sac_code TEXT,
  is_payable_to_doctor BOOLEAN DEFAULT true,
  doctor_payout_type TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, service_code, effective_from)
);

-- ═══════════════════════════════════════════════════════════
-- 2. RATE CARDS (Payor-specific pricing overrides)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  payor_type TEXT NOT NULL DEFAULT 'SELF_PAY',
  payor_id UUID,
  service_master_id UUID NOT NULL REFERENCES billing_service_masters(id),
  rate NUMERIC(12,2) NOT NULL,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, payor_type, COALESCE(payor_id, '00000000-0000-0000-0000-000000000000'::uuid), service_master_id, effective_from)
);

-- ═══════════════════════════════════════════════════════════
-- 3. BILLING PACKAGES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  package_code TEXT NOT NULL,
  package_name TEXT NOT NULL,
  package_type TEXT NOT NULL DEFAULT 'SURGICAL',
  payor_type TEXT NOT NULL DEFAULT 'SELF_PAY',
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  validity_days INT DEFAULT 0,
  inclusions JSONB NOT NULL DEFAULT '[]',
  exclusions JSONB DEFAULT '[]',
  room_category TEXT,
  max_room_days INT,
  pmjay_package_code TEXT,
  cghs_package_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_package_inclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES billing_packages(id) ON DELETE CASCADE,
  service_master_id UUID REFERENCES billing_service_masters(id),
  service_category TEXT,
  quantity_limit INT DEFAULT 1,
  amount_limit NUMERIC(12,2),
  notes TEXT
);

-- ═══════════════════════════════════════════════════════════
-- 4. BILLING ENCOUNTERS (Links clinical to billing)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  encounter_type TEXT NOT NULL DEFAULT 'OPD',
  encounter_number TEXT NOT NULL UNIQUE,

  -- IPD linkage
  admission_id UUID,
  bed_id UUID,
  admitting_doctor_id UUID,
  admission_date TIMESTAMPTZ,
  expected_discharge_date TIMESTAMPTZ,
  actual_discharge_date TIMESTAMPTZ,

  -- OPD linkage
  appointment_id UUID,
  consulting_doctor_id UUID,
  visit_date TIMESTAMPTZ,

  -- Payor
  primary_payor_type TEXT NOT NULL DEFAULT 'SELF_PAY',
  primary_payor_id UUID,
  insurance_policy_number TEXT,
  insurance_card_number TEXT,
  tpa_id UUID,
  pre_auth_id UUID,
  package_id UUID REFERENCES billing_packages(id),

  -- Financial summary (denormalized)
  total_charges NUMERIC(12,2) DEFAULT 0,
  total_discounts NUMERIC(12,2) DEFAULT 0,
  total_tax NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2) DEFAULT 0,
  total_paid NUMERIC(12,2) DEFAULT 0,
  total_refunded NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2) DEFAULT 0,

  -- Insurance
  insurance_approved_amount NUMERIC(12,2) DEFAULT 0,
  insurance_settled_amount NUMERIC(12,2) DEFAULT 0,
  patient_responsibility NUMERIC(12,2) DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'OPEN',
  billing_locked BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 5. LINE ITEMS (The heart of billing)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES billing_encounters(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),

  -- Service
  service_master_id UUID REFERENCES billing_service_masters(id),
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'GENERAL',
  service_category TEXT NOT NULL DEFAULT 'Other',

  -- Amounts
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_rate NUMERIC(12,2) NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL,
  discount_type TEXT,
  discount_value NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,

  -- Doctor linkage (MedPay)
  service_doctor_id UUID,
  referring_doctor_id UUID,
  ordering_doctor_id UUID,

  -- Source tracking
  source_type TEXT NOT NULL DEFAULT 'MANUAL',
  source_id UUID,

  -- Package handling
  is_package_item BOOLEAN DEFAULT false,
  package_id UUID REFERENCES billing_packages(id),
  covered_by_package BOOLEAN DEFAULT false,

  -- Insurance
  is_covered_by_insurance BOOLEAN DEFAULT false,
  insurance_approved_amount NUMERIC(12,2),
  patient_share NUMERIC(12,2),
  co_pay_percentage NUMERIC(5,2),

  -- Timing
  service_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  billed_date TIMESTAMPTZ DEFAULT now(),

  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  cancel_reason TEXT,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,

  -- Audit
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- MedPay
  payout_processed BOOLEAN DEFAULT false,
  payout_cycle_id UUID
);

-- ═══════════════════════════════════════════════════════════
-- 6. INVOICES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES billing_encounters(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL DEFAULT 'OPD',
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),

  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_discount NUMERIC(12,2) DEFAULT 0,
  total_tax NUMERIC(12,2) DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0,

  insurance_share NUMERIC(12,2) DEFAULT 0,
  patient_share NUMERIC(12,2) DEFAULT 0,
  corporate_share NUMERIC(12,2) DEFAULT 0,

  discount_authorized_by UUID,
  discount_reason TEXT,

  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  line_item_id UUID NOT NULL REFERENCES billing_line_items(id),
  amount NUMERIC(12,2) NOT NULL
);

-- ═══════════════════════════════════════════════════════════
-- 7. PAYMENTS & RECEIPTS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES billing_encounters(id),
  invoice_id UUID REFERENCES billing_invoices(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  receipt_number TEXT NOT NULL UNIQUE,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(12,2) NOT NULL,

  payment_mode TEXT NOT NULL DEFAULT 'CASH',
  payment_reference TEXT,
  card_last_four TEXT,
  upi_id TEXT,
  bank_name TEXT,

  claim_id UUID,
  settlement_reference TEXT,
  utr_number TEXT,

  payment_type TEXT NOT NULL DEFAULT 'COLLECTION',

  is_advance BOOLEAN DEFAULT false,
  advance_adjusted_amount NUMERIC(12,2) DEFAULT 0,
  advance_balance NUMERIC(12,2) DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'COMPLETED',
  void_reason TEXT,
  voided_by UUID,
  voided_at TIMESTAMPTZ,

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 8. TPA & INSURANCE MASTERS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tpa_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tpa_name TEXT NOT NULL,
  tpa_code TEXT NOT NULL UNIQUE,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  portal_url TEXT,
  settlement_tat_days INT DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_code TEXT NOT NULL UNIQUE,
  company_type TEXT NOT NULL DEFAULT 'PRIVATE',
  tpa_id UUID REFERENCES tpa_masters(id),
  contact_info JSONB DEFAULT '{}',
  empanelment_number TEXT,
  empanelment_valid_till DATE,
  rohini_code TEXT,
  is_cashless BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 9. INSURANCE PRE-AUTH (Enhanced)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS insurance_pre_auths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES billing_encounters(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  pre_auth_number TEXT UNIQUE,
  insurance_company_id UUID REFERENCES insurance_companies(id),
  tpa_id UUID REFERENCES tpa_masters(id),
  policy_number TEXT NOT NULL,
  member_id TEXT,

  diagnosis_codes JSONB NOT NULL DEFAULT '[]',
  procedure_codes JSONB DEFAULT '[]',
  treating_doctor_id UUID,

  requested_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  requested_stay_days INT,
  request_date TIMESTAMPTZ NOT NULL DEFAULT now(),

  approved_amount NUMERIC(12,2),
  approved_stay_days INT,
  approved_procedures JSONB,
  approval_date TIMESTAMPTZ,
  approval_reference TEXT,

  enhancement_requested BOOLEAN DEFAULT false,
  enhancement_amount NUMERIC(12,2),
  enhancement_approved_amount NUMERIC(12,2),
  enhancement_date TIMESTAMPTZ,

  documents JSONB DEFAULT '[]',

  status TEXT NOT NULL DEFAULT 'DRAFT',
  rejection_reason TEXT,
  query_details TEXT,
  query_response TEXT,

  submitted_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  tat_hours NUMERIC(10,2),

  pmjay_claim_id TEXT,
  pmjay_pre_auth_id TEXT,
  pmjay_package_code TEXT,
  pmjay_package_name TEXT,

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 10. INSURANCE CLAIMS (Enhanced)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES billing_encounters(id),
  pre_auth_id UUID REFERENCES insurance_pre_auths(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  claim_number TEXT NOT NULL UNIQUE,
  insurance_company_id UUID REFERENCES insurance_companies(id),
  tpa_id UUID REFERENCES tpa_masters(id),

  claimed_amount NUMERIC(12,2) NOT NULL,
  approved_amount NUMERIC(12,2),
  settled_amount NUMERIC(12,2),
  deduction_amount NUMERIC(12,2),
  tds_amount NUMERIC(12,2),
  net_received NUMERIC(12,2),
  patient_liability NUMERIC(12,2),

  deduction_details JSONB DEFAULT '[]',

  claim_submission_date TIMESTAMPTZ,
  claim_approval_date TIMESTAMPTZ,
  settlement_date TIMESTAMPTZ,
  payment_received_date TIMESTAMPTZ,

  settlement_utr TEXT,
  settlement_reference TEXT,
  tpa_claim_number TEXT,

  discharge_summary_url TEXT,
  final_bill_url TEXT,
  documents JSONB DEFAULT '[]',

  pmjay_claim_id TEXT,
  pmjay_status TEXT,

  status TEXT NOT NULL DEFAULT 'DRAFT',
  query_details JSONB DEFAULT '[]',

  submission_to_settlement_days INT,
  aging_bucket TEXT DEFAULT '0-30',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 11. BED CHARGE RULES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_bed_charge_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  room_category TEXT NOT NULL,
  ward_type TEXT NOT NULL DEFAULT 'WARD',
  charge_per_day NUMERIC(12,2) NOT NULL DEFAULT 0,
  nursing_charge_per_day NUMERIC(12,2) DEFAULT 0,
  service_charge_per_day NUMERIC(12,2) DEFAULT 0,
  checkout_time TIME DEFAULT '11:00',
  half_day_hours INT DEFAULT 12,
  payor_type TEXT DEFAULT 'SELF_PAY',
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 12. DISCOUNT SCHEMES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_discount_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  scheme_name TEXT NOT NULL,
  scheme_code TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE',
  discount_value NUMERIC(12,2),
  category_rules JSONB,
  max_discount_amount NUMERIC(12,2),
  requires_approval BOOLEAN DEFAULT false,
  approval_authority TEXT,
  auto_apply BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_discount_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES billing_encounters(id),
  line_item_id UUID REFERENCES billing_line_items(id),
  invoice_id UUID REFERENCES billing_invoices(id),
  scheme_id UUID REFERENCES billing_discount_schemes(id),
  discount_type TEXT NOT NULL,
  original_amount NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'APPLIED',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 13. CREDIT NOTES (Enhanced)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_invoice_id UUID NOT NULL REFERENCES billing_invoices(id),
  credit_note_number TEXT NOT NULL UNIQUE,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',

  refund_mode TEXT,
  refund_reference TEXT,
  refund_processed BOOLEAN DEFAULT false,
  refund_processed_at TIMESTAMPTZ,

  approved_by UUID,
  approved_at TIMESTAMPTZ,

  status TEXT DEFAULT 'DRAFT',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 14. BILLING AUDIT LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  performed_by UUID NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 15. SEQUENCES FOR NUMBERING
-- ═══════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS billing_encounter_seq START 1;
CREATE SEQUENCE IF NOT EXISTS billing_invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS billing_receipt_seq START 1;
CREATE SEQUENCE IF NOT EXISTS billing_claim_seq START 1;
CREATE SEQUENCE IF NOT EXISTS billing_credit_note_seq START 1;

-- ═══════════════════════════════════════════════════════════
-- 16. INDEXES
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_b_encounters_patient ON billing_encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_b_encounters_centre_status ON billing_encounters(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_b_encounters_admission_date ON billing_encounters(admission_date);
CREATE INDEX IF NOT EXISTS idx_b_line_items_encounter ON billing_line_items(encounter_id);
CREATE INDEX IF NOT EXISTS idx_b_line_items_service_date ON billing_line_items(service_date);
CREATE INDEX IF NOT EXISTS idx_b_line_items_doctor ON billing_line_items(service_doctor_id);
CREATE INDEX IF NOT EXISTS idx_b_invoices_encounter ON billing_invoices(encounter_id);
CREATE INDEX IF NOT EXISTS idx_b_invoices_patient ON billing_invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_b_invoices_date ON billing_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_b_payments_encounter ON billing_payments(encounter_id);
CREATE INDEX IF NOT EXISTS idx_b_payments_date ON billing_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_b_pre_auths_encounter ON insurance_pre_auths(encounter_id);
CREATE INDEX IF NOT EXISTS idx_b_pre_auths_status ON insurance_pre_auths(status);
CREATE INDEX IF NOT EXISTS idx_b_claims_status ON insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_b_claims_aging ON insurance_claims(aging_bucket);
CREATE INDEX IF NOT EXISTS idx_b_audit_entity ON billing_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_b_rate_cards_lookup ON billing_rate_cards(centre_id, payor_type, service_master_id);
CREATE INDEX IF NOT EXISTS idx_b_service_masters_centre ON billing_service_masters(centre_id, is_active);

-- ═══════════════════════════════════════════════════════════
-- 17. ENCOUNTER NUMBER GENERATOR FUNCTION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_encounter_number(
  p_centre_code TEXT,
  p_encounter_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_seq INT;
  v_date TEXT;
BEGIN
  v_seq := nextval('billing_encounter_seq');
  v_date := to_char(now(), 'YYYYMMDD');
  RETURN 'H1-' || UPPER(p_centre_code) || '-' || UPPER(p_encounter_type) || '-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_centre_code TEXT
) RETURNS TEXT AS $$
DECLARE
  v_seq INT;
  v_year TEXT;
BEGIN
  v_seq := nextval('billing_invoice_seq');
  v_year := to_char(now(), 'YYYY');
  RETURN 'H1-' || UPPER(p_centre_code) || '-INV-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_receipt_number(
  p_centre_code TEXT
) RETURNS TEXT AS $$
DECLARE
  v_seq INT;
  v_year TEXT;
BEGIN
  v_seq := nextval('billing_receipt_seq');
  v_year := to_char(now(), 'YYYY');
  RETURN 'H1-' || UPPER(p_centre_code) || '-RCP-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 18. ENCOUNTER TOTALS RECALC FUNCTION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION recalc_encounter_totals(p_encounter_id UUID)
RETURNS VOID AS $$
DECLARE
  v_charges NUMERIC;
  v_discounts NUMERIC;
  v_tax NUMERIC;
  v_net NUMERIC;
  v_paid NUMERIC;
  v_refunded NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(gross_amount), 0),
    COALESCE(SUM(discount_amount), 0),
    COALESCE(SUM(tax_amount), 0),
    COALESCE(SUM(net_amount), 0)
  INTO v_charges, v_discounts, v_tax, v_net
  FROM billing_line_items
  WHERE encounter_id = p_encounter_id AND status = 'ACTIVE';

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM billing_payments
  WHERE encounter_id = p_encounter_id AND status = 'COMPLETED' AND payment_type IN ('COLLECTION', 'ADVANCE');

  SELECT COALESCE(SUM(amount), 0)
  INTO v_refunded
  FROM billing_payments
  WHERE encounter_id = p_encounter_id AND status = 'COMPLETED' AND payment_type = 'REFUND';

  UPDATE billing_encounters SET
    total_charges = v_charges,
    total_discounts = v_discounts,
    total_tax = v_tax,
    net_amount = v_net,
    total_paid = v_paid,
    total_refunded = v_refunded,
    balance_due = v_net - v_paid + v_refunded,
    updated_at = now()
  WHERE id = p_encounter_id;
END;
$$ LANGUAGE plpgsql;
