-- Health1 HMIS — NHCX Integration Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. NHCX Transaction Log — every API call in/out
CREATE TABLE IF NOT EXISTS hmis_nhcx_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id uuid REFERENCES hmis_claims(id),
    patient_id uuid REFERENCES hmis_patients(id),
    action varchar(50) NOT NULL,                    -- coverageeligibility/check, preauth/submit, etc
    direction varchar(10) NOT NULL CHECK (direction IN ('outgoing','incoming')),
    nhcx_api_call_id varchar(100),                  -- NHCX gateway's API call ID
    nhcx_correlation_id varchar(100),               -- Links request ↔ response
    nhcx_workflow_id varchar(100),                   -- Links eligibility → preauth → claim
    status varchar(20) NOT NULL DEFAULT 'pending',
    error_message text,
    request_payload jsonb,
    response_payload jsonb,
    request_timestamp timestamptz,
    response_timestamp timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nhcx_txn_claim ON hmis_nhcx_transactions(claim_id);
CREATE INDEX IF NOT EXISTS idx_nhcx_txn_correlation ON hmis_nhcx_transactions(nhcx_correlation_id);
CREATE INDEX IF NOT EXISTS idx_nhcx_txn_workflow ON hmis_nhcx_transactions(nhcx_workflow_id);

-- 2. Add NHCX columns to hmis_claims
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_correlation_id varchar(100);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_workflow_id varchar(100);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_response jsonb;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_submitted_at timestamptz;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_responded_at timestamptz;

-- 3. Add NHCX participant codes to insurers and TPAs
ALTER TABLE hmis_insurers ADD COLUMN IF NOT EXISTS nhcx_code varchar(100);
ALTER TABLE hmis_tpas ADD COLUMN IF NOT EXISTS nhcx_code varchar(100);

-- 4. Add ABHA fields to patients (if not exists)
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_number varchar(20);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_address varchar(50);

-- 5. NHCX Configuration table
CREATE TABLE IF NOT EXISTS hmis_nhcx_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    participant_code varchar(100) NOT NULL,
    hfr_id varchar(20) NOT NULL,
    username varchar(100) NOT NULL,
    encrypted_secret text NOT NULL,           -- encrypted in application
    gateway_url varchar(200) NOT NULL DEFAULT 'https://hcxbeta.nha.gov.in',
    is_production boolean NOT NULL DEFAULT false,
    rsa_public_key text,                       -- PEM format
    rsa_private_key_encrypted text,            -- encrypted, stored securely
    webhook_url text,                          -- our callback URL for NHCX
    is_active boolean NOT NULL DEFAULT true,
    last_token_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id)
);

-- RLS
DO $$
BEGIN
    EXECUTE 'ALTER TABLE hmis_nhcx_transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY nhcx_txn_pol ON hmis_nhcx_transactions FOR ALL USING (auth.uid() IS NOT NULL)';
    EXECUTE 'ALTER TABLE hmis_nhcx_config ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY nhcx_cfg_pol ON hmis_nhcx_config FOR ALL USING (auth.uid() IS NOT NULL)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Seed major insurers with NHCX codes (placeholder — update when known)
-- These codes will be available from the NHCX participant registry
UPDATE hmis_insurers SET nhcx_code = CASE 
    WHEN name ILIKE '%star health%' THEN 'nhcx-star-health'
    WHEN name ILIKE '%niva bupa%' OR name ILIKE '%max bupa%' THEN 'nhcx-niva-bupa'
    WHEN name ILIKE '%care health%' OR name ILIKE '%religare%' THEN 'nhcx-care-health'
    WHEN name ILIKE '%hdfc ergo%' THEN 'nhcx-hdfc-ergo'
    WHEN name ILIKE '%icici lombard%' THEN 'nhcx-icici-lombard'
    WHEN name ILIKE '%bajaj allianz%' THEN 'nhcx-bajaj-allianz'
    WHEN name ILIKE '%new india%' THEN 'nhcx-new-india'
    WHEN name ILIKE '%national%' THEN 'nhcx-national-insurance'
    WHEN name ILIKE '%united india%' THEN 'nhcx-united-india'
    WHEN name ILIKE '%oriental%' THEN 'nhcx-oriental-insurance'
    ELSE nhcx_code
END WHERE nhcx_code IS NULL;

UPDATE hmis_tpas SET nhcx_code = CASE
    WHEN name ILIKE '%medi assist%' THEN 'nhcx-medi-assist'
    WHEN name ILIKE '%paramount%' THEN 'nhcx-paramount'
    WHEN name ILIKE '%vidal%' THEN 'nhcx-vidal'
    WHEN name ILIKE '%md india%' THEN 'nhcx-md-india'
    WHEN name ILIKE '%good health%' THEN 'nhcx-good-health'
    ELSE nhcx_code
END WHERE nhcx_code IS NULL;
-- ============================================================
-- Health1 HMIS — RBAC: Role-Based Access Control
-- Proper module permissions, role templates, bulk user creation
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Clear old roles and insert proper templates
-- Upsert roles (safe — does not delete referenced roles)

-- ============================================================
-- PERMISSION STRUCTURE:
-- permissions jsonb = { "module_name": ["action1", "action2"] }
--
-- MODULES (matching sidebar + features):
--   dashboard, patients, opd, appointments, ipd, bed_management,
--   nursing_station, emr, billing, pharmacy, lab, blood_bank,
--   radiology, ot, vpms, homecare, reports, quality, settings,
--   command_centre, portal
--
-- ACTIONS per module:
--   view, create, edit, delete, print, approve, export, admin
-- ============================================================

INSERT INTO hmis_roles (name, description, permissions, is_system) VALUES

-- SUPER ADMIN — everything
('super_admin', 'Full system access — all modules, all actions', '{
  "dashboard": ["view","admin"],
  "patients": ["view","create","edit","delete","print","export","admin"],
  "opd": ["view","create","edit","delete","print","export","admin"],
  "appointments": ["view","create","edit","delete","print","export"],
  "ipd": ["view","create","edit","delete","print","approve","export","admin"],
  "bed_management": ["view","create","edit","admin"],
  "nursing_station": ["view","create","edit","print"],
  "emr": ["view","create","edit","delete","print","export","admin"],
  "billing": ["view","create","edit","delete","print","approve","export","admin"],
  "pharmacy": ["view","create","edit","delete","print","approve","export","admin"],
  "lab": ["view","create","edit","delete","print","approve","export","admin"],
  "blood_bank": ["view","create","edit","print","approve"],
  "radiology": ["view","create","edit","delete","print","approve","export","admin"],
  "ot": ["view","create","edit","print","approve","admin"],
  "vpms": ["view","create","edit","approve","admin"],
  "homecare": ["view","create","edit","print"],
  "reports": ["view","export","admin"],
  "quality": ["view","create","edit","approve","export","admin"],
  "settings": ["view","edit","admin"],
  "command_centre": ["view","admin"]
}'::jsonb, true),

-- ADMIN — everything except settings admin
('admin', 'Hospital administrator — full access except system settings', '{
  "dashboard": ["view"],
  "patients": ["view","create","edit","print","export"],
  "opd": ["view","create","edit","print","export"],
  "appointments": ["view","create","edit","delete","print"],
  "ipd": ["view","create","edit","print","approve","export"],
  "bed_management": ["view","create","edit"],
  "nursing_station": ["view","create","edit","print"],
  "emr": ["view","create","edit","print","export"],
  "billing": ["view","create","edit","print","approve","export"],
  "pharmacy": ["view","create","edit","print","approve","export"],
  "lab": ["view","create","edit","print","approve","export"],
  "blood_bank": ["view","create","edit","print","approve"],
  "radiology": ["view","create","edit","print","approve","export"],
  "ot": ["view","create","edit","print","approve"],
  "vpms": ["view","create","edit","approve"],
  "homecare": ["view","create","edit","print"],
  "reports": ["view","export"],
  "quality": ["view","create","edit","approve","export"],
  "settings": ["view","edit"],
  "command_centre": ["view"]
}'::jsonb, true),

-- DOCTOR — clinical modules
('doctor', 'Consulting / treating physician', '{
  "dashboard": ["view"],
  "patients": ["view","create","edit","print"],
  "opd": ["view","create","edit","print"],
  "appointments": ["view","create","edit"],
  "ipd": ["view","create","edit","print"],
  "bed_management": ["view"],
  "nursing_station": ["view"],
  "emr": ["view","create","edit","print","export"],
  "billing": ["view","print"],
  "pharmacy": ["view"],
  "lab": ["view","create","print"],
  "radiology": ["view","create","print"],
  "ot": ["view","create","edit","print"],
  "reports": ["view"],
  "quality": ["view","create"]
}'::jsonb, true),

-- NURSE — clinical care modules
('nurse', 'Nursing staff — ward, ICU, OT', '{
  "dashboard": ["view"],
  "patients": ["view","edit"],
  "opd": ["view"],
  "appointments": ["view"],
  "ipd": ["view","create","edit","print"],
  "bed_management": ["view","edit"],
  "nursing_station": ["view","create","edit","print"],
  "emr": ["view","create","edit"],
  "pharmacy": ["view"],
  "lab": ["view"],
  "radiology": ["view"],
  "ot": ["view","edit"],
  "quality": ["view","create"]
}'::jsonb, true),

-- RECEPTIONIST — front desk
('receptionist', 'Front desk — registration, appointments, basic billing', '{
  "dashboard": ["view"],
  "patients": ["view","create","edit","print"],
  "opd": ["view","create","edit","print"],
  "appointments": ["view","create","edit","delete","print"],
  "ipd": ["view"],
  "bed_management": ["view"],
  "billing": ["view","create","print"],
  "reports": ["view"]
}'::jsonb, true),

-- BILLING STAFF
('billing_staff', 'Billing and accounts — bills, payments, insurance', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "billing": ["view","create","edit","print","export"],
  "ipd": ["view"],
  "pharmacy": ["view"],
  "reports": ["view","export"]
}'::jsonb, true),

-- BILLING MANAGER — billing + approvals
('billing_manager', 'Billing manager — approve refunds, credit notes, discounts', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "billing": ["view","create","edit","delete","print","approve","export","admin"],
  "ipd": ["view","print"],
  "pharmacy": ["view"],
  "reports": ["view","export"],
  "quality": ["view"]
}'::jsonb, true),

-- PHARMACIST
('pharmacist', 'Pharmacy — dispensing, stock, controlled drugs', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "pharmacy": ["view","create","edit","print","approve","export"],
  "billing": ["view"],
  "reports": ["view"]
}'::jsonb, true),

-- LAB TECHNICIAN
('lab_technician', 'Laboratory — sample collection, results entry, verification', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "lab": ["view","create","edit","print","export"],
  "blood_bank": ["view","create","edit"],
  "reports": ["view"]
}'::jsonb, true),

-- RADIOLOGY TECHNICIAN
('radiology_technician', 'Radiology — imaging, reports', '{
  "dashboard": ["view"],
  "patients": ["view"],
  "radiology": ["view","create","edit","print","export"],
  "reports": ["view"]
}'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_system = EXCLUDED.is_system;


-- ============================================================
-- 2. BULK USER CREATION RPC
-- Creates staff + Supabase auth user + assigns role at centre
-- ============================================================

CREATE OR REPLACE FUNCTION create_staff_user(
  p_employee_code text,
  p_full_name text,
  p_email text,
  p_password text,
  p_phone text,
  p_staff_type text,
  p_designation text,
  p_centre_id uuid,
  p_role_name text,
  p_department_id uuid DEFAULT NULL,
  p_specialisation text DEFAULT NULL,
  p_medical_reg_no text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_auth_id uuid;
  v_staff_id uuid;
  v_role_id uuid;
BEGIN
  -- Get role ID
  SELECT id INTO v_role_id FROM hmis_roles WHERE name = p_role_name;
  IF v_role_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Role not found: ' || p_role_name);
  END IF;

  -- Check for duplicate employee code
  IF EXISTS (SELECT 1 FROM hmis_staff WHERE employee_code = p_employee_code) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee code already exists: ' || p_employee_code);
  END IF;

  -- Create Supabase auth user
  v_auth_id := extensions.uuid_generate_v4();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    role, aud, confirmation_token
  ) VALUES (
    v_auth_id, '00000000-0000-0000-0000-000000000000', p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'employee_code', p_employee_code),
    now(), now(), 'authenticated', 'authenticated', ''
  );

  -- Create identity
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (v_auth_id, v_auth_id, jsonb_build_object('sub', v_auth_id, 'email', p_email), 'email', v_auth_id, now(), now(), now());

  -- Create staff record
  INSERT INTO hmis_staff (
    auth_user_id, employee_code, full_name, designation, staff_type,
    department_id, primary_centre_id, phone, email,
    specialisation, medical_reg_no
  ) VALUES (
    v_auth_id, p_employee_code, p_full_name, p_designation, p_staff_type,
    p_department_id, p_centre_id, p_phone, p_email,
    p_specialisation, p_medical_reg_no
  ) RETURNING id INTO v_staff_id;

  -- Assign role at centre
  INSERT INTO hmis_staff_centres (staff_id, centre_id, role_id)
  VALUES (v_staff_id, p_centre_id, v_role_id)
  ON CONFLICT (staff_id, centre_id) DO UPDATE SET role_id = v_role_id;

  -- Assign to department if provided
  IF p_department_id IS NOT NULL THEN
    INSERT INTO hmis_staff_departments (staff_id, department_id, is_primary)
    VALUES (v_staff_id, p_department_id, true)
    ON CONFLICT (staff_id, department_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'staff_id', v_staff_id,
    'auth_id', v_auth_id,
    'employee_code', p_employee_code,
    'email', p_email,
    'role', p_role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 3. BATCH USER CREATION (for CSV import)
-- ============================================================
CREATE OR REPLACE FUNCTION create_staff_batch(p_users jsonb)
RETURNS jsonb AS $$
DECLARE
  v_user jsonb;
  v_result jsonb;
  v_results jsonb[] := ARRAY[]::jsonb[];
  v_success int := 0;
  v_failed int := 0;
BEGIN
  FOR v_user IN SELECT * FROM jsonb_array_elements(p_users)
  LOOP
    BEGIN
      v_result := create_staff_user(
        v_user->>'employee_code', v_user->>'full_name',
        v_user->>'email', v_user->>'password',
        v_user->>'phone', v_user->>'staff_type',
        v_user->>'designation', (v_user->>'centre_id')::uuid,
        v_user->>'role_name',
        CASE WHEN v_user->>'department_id' IS NOT NULL THEN (v_user->>'department_id')::uuid ELSE NULL END,
        v_user->>'specialisation', v_user->>'medical_reg_no'
      );
      v_results := array_append(v_results, v_result);
      IF (v_result->>'success')::boolean THEN v_success := v_success + 1;
      ELSE v_failed := v_failed + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_results := array_append(v_results, jsonb_build_object('success', false, 'error', SQLERRM, 'employee_code', v_user->>'employee_code'));
    END;
  END LOOP;

  RETURN jsonb_build_object('success', v_success, 'failed', v_failed, 'results', to_jsonb(v_results));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ============================================================
-- Health1 HMIS — CPOE (Computerized Physician Order Entry)
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_cpoe_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    order_type varchar(20) NOT NULL CHECK (order_type IN ('medication','lab','radiology','diet','nursing','activity','consult','procedure')),
    order_text text NOT NULL,
    details jsonb DEFAULT '{}',
    priority varchar(10) NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat','asap')),
    status varchar(15) NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','verified','in_progress','completed','cancelled','held')),
    ordered_by uuid NOT NULL REFERENCES hmis_staff(id),
    is_verbal boolean NOT NULL DEFAULT false,
    cosigned_by uuid REFERENCES hmis_staff(id),
    cosigned_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpoe_admission ON hmis_cpoe_orders(admission_id, status);
CREATE INDEX IF NOT EXISTS idx_cpoe_patient ON hmis_cpoe_orders(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpoe_verbal ON hmis_cpoe_orders(is_verbal) WHERE is_verbal = true AND cosigned_by IS NULL;

ALTER TABLE hmis_cpoe_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_cpoe_orders_pol ON hmis_cpoe_orders;
CREATE POLICY hmis_cpoe_orders_pol ON hmis_cpoe_orders FOR ALL USING (auth.uid() IS NOT NULL);
-- ============================================================
-- Health1 HMIS — Refund Management
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    refund_amount decimal(12,2) NOT NULL,
    reason text NOT NULL,
    refund_mode varchar(20) NOT NULL CHECK (refund_mode IN ('cash','neft','cheque','upi')),
    bank_details text,
    status varchar(15) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','approved','processed','rejected','cancelled')),
    initiated_by uuid NOT NULL REFERENCES hmis_staff(id),
    approved_by uuid REFERENCES hmis_staff(id),
    approved_at timestamptz,
    processed_by uuid REFERENCES hmis_staff(id),
    processed_at timestamptz,
    utr_number varchar(50),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_centre ON hmis_refunds(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_refunds_bill ON hmis_refunds(bill_id);

ALTER TABLE hmis_refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_refunds_pol ON hmis_refunds;
CREATE POLICY hmis_refunds_pol ON hmis_refunds FOR ALL USING (auth.uid() IS NOT NULL);
-- ============================================================
-- Health1 HMIS — Package Builder + OPD Billing Support
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Packages table (for PackageBuilder component)
CREATE TABLE IF NOT EXISTS hmis_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(200) NOT NULL,
    description text,
    room_category varchar(20) DEFAULT 'economy',
    expected_los int DEFAULT 3,
    items jsonb NOT NULL DEFAULT '[]',
    gross_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_percentage decimal(5,2) DEFAULT 0,
    net_amount decimal(12,2) NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_centre ON hmis_packages(centre_id, is_active);

ALTER TABLE hmis_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_packages_pol ON hmis_packages;
CREATE POLICY hmis_packages_pol ON hmis_packages FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. Add visit_type to OPD visits if missing (for follow-up vs new)
ALTER TABLE hmis_opd_visits ADD COLUMN IF NOT EXISTS visit_type varchar(15) DEFAULT 'new';
ALTER TABLE hmis_opd_visits ADD COLUMN IF NOT EXISTS visit_reason text;
-- ============================================================
-- Health1 HMIS — Pharmacy v2 (Returns, Transfers, Controlled)
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Pharmacy Returns & Write-offs
CREATE TABLE IF NOT EXISTS hmis_pharmacy_returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    quantity decimal(10,2) NOT NULL,
    batch_number varchar(30),
    return_type varchar(20) NOT NULL CHECK (return_type IN ('patient_return','supplier_return','expiry_write_off','damage')),
    reason text NOT NULL,
    patient_id uuid REFERENCES hmis_patients(id),
    dispensing_id uuid,
    refund_amount decimal(10,2) DEFAULT 0,
    status varchar(15) NOT NULL DEFAULT 'processed',
    processed_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rx_returns_centre ON hmis_pharmacy_returns(centre_id, return_type);

-- 2. Inter-Centre Stock Transfers
CREATE TABLE IF NOT EXISTS hmis_pharmacy_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    to_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    quantity decimal(10,2) NOT NULL,
    batch_number varchar(30),
    reason text,
    status varchar(15) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','in_transit','received','cancelled')),
    initiated_by uuid NOT NULL REFERENCES hmis_staff(id),
    received_by uuid REFERENCES hmis_staff(id),
    received_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rx_transfers ON hmis_pharmacy_transfers(from_centre_id, status);

-- 3. Controlled Substance Register (Schedule H, H1, X)
CREATE TABLE IF NOT EXISTS hmis_controlled_substance_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    quantity decimal(10,2) NOT NULL,
    batch_number varchar(30),
    transaction_type varchar(15) NOT NULL CHECK (transaction_type IN ('received','dispensed','returned','destroyed','wastage')),
    patient_id uuid REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    administered_by uuid NOT NULL REFERENCES hmis_staff(id),
    witnessed_by uuid REFERENCES hmis_staff(id),
    balance_after decimal(10,2) DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_controlled_centre ON hmis_controlled_substance_log(centre_id, drug_id);

-- Add schedule column to drug master if missing
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS schedule varchar(5);
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS is_controlled boolean DEFAULT false;
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS reorder_level int DEFAULT 10;
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS max_stock int DEFAULT 500;

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_pharmacy_returns','hmis_pharmacy_transfers','hmis_controlled_substance_log'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;
-- ============================================================
-- Health1 HMIS — Lab Instrument Integration + Patient Lab History
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Instrument result staging table
-- Results from Mindray/analyzers land here before being verified
CREATE TABLE IF NOT EXISTS hmis_lab_instrument_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid REFERENCES hmis_lab_orders(id),
    patient_id uuid REFERENCES hmis_patients(id),
    parameter_code varchar(30),
    parameter_name varchar(100) NOT NULL,
    result_value varchar(50) NOT NULL,
    unit varchar(20),
    reference_range varchar(50),
    instrument_flag varchar(10),
    is_abnormal boolean DEFAULT false,
    is_critical boolean DEFAULT false,
    source varchar(20) NOT NULL DEFAULT 'instrument',
    instrument_format varchar(10),  -- hl7, astm, json
    received_at timestamptz NOT NULL DEFAULT now(),
    reviewed boolean DEFAULT false,
    reviewed_by uuid REFERENCES hmis_staff(id),
    reviewed_at timestamptz,
    accepted boolean,  -- true = accepted into results, false = rejected
    rejection_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_instr_order ON hmis_lab_instrument_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_instr_patient ON hmis_lab_instrument_results(patient_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_instr_unreviewed ON hmis_lab_instrument_results(reviewed) WHERE reviewed = false;

-- RLS
ALTER TABLE hmis_lab_instrument_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_lab_instrument_results_pol ON hmis_lab_instrument_results;
CREATE POLICY hmis_lab_instrument_results_pol ON hmis_lab_instrument_results FOR ALL USING (auth.uid() IS NOT NULL);
-- ============================================================
-- Add BC-5000 specific parameters to CBC test
-- Run in Supabase SQL Editor
-- ============================================================

DO $$
DECLARE cbc_id uuid;
BEGIN
    SELECT id INTO cbc_id FROM hmis_lab_test_master WHERE test_code = 'CBC';
    
    IF cbc_id IS NOT NULL THEN
    INSERT INTO hmis_lab_test_parameters (test_id, parameter_code, parameter_name, unit, ref_range_min, ref_range_max, data_type, sort_order) VALUES
    -- Absolute counts (BC-5000 outputs these)
    (cbc_id, 'NEUT_ABS', 'Neutrophils (Absolute)', 'x10^3/uL', 2.0, 7.0, 'numeric', 20),
    (cbc_id, 'LYMPH_ABS', 'Lymphocytes (Absolute)', 'x10^3/uL', 1.0, 3.0, 'numeric', 21),
    (cbc_id, 'MONO_ABS', 'Monocytes (Absolute)', 'x10^3/uL', 0.2, 0.8, 'numeric', 22),
    (cbc_id, 'EOS_ABS', 'Eosinophils (Absolute)', 'x10^3/uL', 0.02, 0.5, 'numeric', 23),
    (cbc_id, 'BASO_ABS', 'Basophils (Absolute)', 'x10^3/uL', 0.0, 0.1, 'numeric', 24),
    -- RDW-SD
    (cbc_id, 'RDW_SD', 'RDW-SD', 'fL', 39, 46, 'numeric', 25),
    -- Platelet indices
    (cbc_id, 'PDW', 'Platelet Distribution Width', 'fL', 9, 17, 'numeric', 26),
    (cbc_id, 'PCT', 'Plateletcrit', '%', 0.17, 0.35, 'numeric', 27),
    (cbc_id, 'PLCR', 'Platelet Large Cell Ratio', '%', 13, 43, 'numeric', 28),
    (cbc_id, 'PLCC', 'Platelet Large Cell Count', 'x10^3/uL', NULL, NULL, 'numeric', 29)
    ON CONFLICT (test_id, parameter_code) DO NOTHING;
    
    RAISE NOTICE 'BC-5000 parameters added: 10 new CBC parameters';
    END IF;
END $$;
-- ============================================================
-- Health1 HMIS — Command Centre Server-Side Aggregation
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Bed Census — single query, grouped by centre
CREATE OR REPLACE FUNCTION get_bed_census()
RETURNS TABLE (
    centre_id uuid,
    centre_name text,
    centre_code text,
    total_beds bigint,
    occupied bigint,
    available bigint,
    maintenance bigint,
    icu_total bigint,
    icu_occupied bigint,
    ward_type text,
    ward_occupied bigint,
    ward_total bigint
) LANGUAGE sql STABLE AS $$
    WITH bed_data AS (
        SELECT
            c.id AS centre_id,
            c.name AS centre_name,
            c.code AS centre_code,
            b.status AS bed_status,
            w.type AS ward_type
        FROM hmis_beds b
        JOIN hmis_rooms r ON r.id = b.room_id
        JOIN hmis_wards w ON w.id = r.ward_id
        JOIN hmis_centres c ON c.id = w.centre_id
        WHERE c.is_active = true
    )
    SELECT
        bd.centre_id,
        bd.centre_name,
        bd.centre_code,
        COUNT(*) AS total_beds,
        COUNT(*) FILTER (WHERE bd.bed_status = 'occupied') AS occupied,
        COUNT(*) FILTER (WHERE bd.bed_status = 'available') AS available,
        COUNT(*) FILTER (WHERE bd.bed_status = 'maintenance') AS maintenance,
        COUNT(*) FILTER (WHERE bd.ward_type = 'icu') AS icu_total,
        COUNT(*) FILTER (WHERE bd.ward_type = 'icu' AND bd.bed_status = 'occupied') AS icu_occupied,
        bd.ward_type,
        COUNT(*) FILTER (WHERE bd.bed_status = 'occupied') AS ward_occupied,
        COUNT(*) AS ward_total
    FROM bed_data bd
    GROUP BY bd.centre_id, bd.centre_name, bd.centre_code, bd.ward_type
    ORDER BY bd.centre_name, bd.ward_type;
$$;

-- 2. Today's Operations Summary — single query
CREATE OR REPLACE FUNCTION get_daily_ops_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    centre_id uuid,
    opd_total bigint,
    opd_waiting bigint,
    opd_in_consult bigint,
    opd_completed bigint,
    admissions bigint,
    discharges bigint,
    discharge_pending bigint,
    ot_scheduled bigint,
    ot_in_progress bigint,
    ot_completed bigint,
    ot_cancelled bigint,
    ot_emergency bigint,
    ot_robotic bigint,
    lab_pending bigint
) LANGUAGE sql STABLE AS $$
    WITH opd AS (
        SELECT centre_id,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'waiting') AS waiting,
            COUNT(*) FILTER (WHERE status = 'with_doctor') AS in_consult,
            COUNT(*) FILTER (WHERE status IN ('completed','referred')) AS completed
        FROM hmis_opd_visits
        WHERE created_at::date = p_date
        GROUP BY centre_id
    ),
    ipd AS (
        SELECT centre_id,
            COUNT(*) FILTER (WHERE admission_date::date = p_date) AS admissions,
            COUNT(*) FILTER (WHERE status = 'discharged' AND actual_discharge::date = p_date) AS discharges,
            COUNT(*) FILTER (WHERE status = 'discharge_initiated') AS discharge_pending
        FROM hmis_admissions
        GROUP BY centre_id
    ),
    ot AS (
        SELECT b.ot_room_id, r.centre_id,
            COUNT(*) AS scheduled,
            COUNT(*) FILTER (WHERE b.status = 'in_progress') AS in_progress,
            COUNT(*) FILTER (WHERE b.status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled,
            COUNT(*) FILTER (WHERE b.is_emergency) AS emergency,
            COUNT(*) FILTER (WHERE b.is_robotic) AS robotic
        FROM hmis_ot_bookings b
        JOIN hmis_ot_rooms r ON r.id = b.ot_room_id
        WHERE b.scheduled_date = p_date
        GROUP BY b.ot_room_id, r.centre_id
    ),
    lab AS (
        SELECT centre_id,
            COUNT(*) FILTER (WHERE status IN ('ordered','collected','processing')) AS pending
        FROM hmis_lab_orders
        WHERE created_at::date = p_date
        GROUP BY centre_id
    ),
    centres AS (SELECT id AS centre_id FROM hmis_centres WHERE is_active = true)
    SELECT
        c.centre_id,
        COALESCE(o.total, 0) AS opd_total,
        COALESCE(o.waiting, 0) AS opd_waiting,
        COALESCE(o.in_consult, 0) AS opd_in_consult,
        COALESCE(o.completed, 0) AS opd_completed,
        COALESCE(i.admissions, 0) AS admissions,
        COALESCE(i.discharges, 0) AS discharges,
        COALESCE(i.discharge_pending, 0) AS discharge_pending,
        COALESCE(SUM(ot_agg.scheduled), 0) AS ot_scheduled,
        COALESCE(SUM(ot_agg.in_progress), 0) AS ot_in_progress,
        COALESCE(SUM(ot_agg.completed), 0) AS ot_completed,
        COALESCE(SUM(ot_agg.cancelled), 0) AS ot_cancelled,
        COALESCE(SUM(ot_agg.emergency), 0) AS ot_emergency,
        COALESCE(SUM(ot_agg.robotic), 0) AS ot_robotic,
        COALESCE(l.pending, 0) AS lab_pending
    FROM centres c
    LEFT JOIN opd o ON o.centre_id = c.centre_id
    LEFT JOIN ipd i ON i.centre_id = c.centre_id
    LEFT JOIN ot ot_agg ON ot_agg.centre_id = c.centre_id
    LEFT JOIN lab l ON l.centre_id = c.centre_id
    GROUP BY c.centre_id, o.total, o.waiting, o.in_consult, o.completed,
        i.admissions, i.discharges, i.discharge_pending, l.pending;
$$;

-- 3. Revenue Summary — single query
CREATE OR REPLACE FUNCTION get_revenue_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    centre_id uuid,
    bills_count bigint,
    gross_amount numeric,
    discount_amount numeric,
    net_amount numeric,
    paid_amount numeric,
    balance_amount numeric,
    cash_collected numeric,
    upi_collected numeric,
    card_collected numeric,
    neft_collected numeric,
    insurance_billed numeric,
    collection_rate numeric
) LANGUAGE sql STABLE AS $$
    SELECT
        b.centre_id,
        COUNT(*) AS bills_count,
        COALESCE(SUM(b.gross_amount), 0) AS gross_amount,
        COALESCE(SUM(b.discount_amount), 0) AS discount_amount,
        COALESCE(SUM(b.net_amount), 0) AS net_amount,
        COALESCE(SUM(b.paid_amount), 0) AS paid_amount,
        COALESCE(SUM(b.balance_amount), 0) AS balance_amount,
        0::numeric AS cash_collected,
        0::numeric AS upi_collected,
        0::numeric AS card_collected,
        0::numeric AS neft_collected,
        COALESCE(SUM(b.net_amount) FILTER (WHERE b.payor_type != 'self'), 0) AS insurance_billed,
        CASE WHEN SUM(b.net_amount) > 0
            THEN ROUND(SUM(b.paid_amount) / SUM(b.net_amount) * 100, 1)
            ELSE 0 END AS collection_rate
    FROM hmis_bills b
    WHERE b.bill_date = p_date AND b.status != 'cancelled'
    GROUP BY b.centre_id;
$$;

-- 4. Insurance Pipeline — single query
CREATE OR REPLACE FUNCTION get_insurance_pipeline()
RETURNS TABLE (
    centre_id uuid,
    preauth_pending bigint,
    preauth_approved bigint,
    claims_pending bigint,
    claims_approved bigint,
    claims_settled bigint,
    claims_rejected bigint,
    total_claimed numeric,
    total_approved numeric,
    total_settled numeric,
    total_outstanding numeric
) LANGUAGE sql STABLE AS $$
    SELECT
        b.centre_id,
        COUNT(*) FILTER (WHERE cl.status IN ('submitted','under_review')) AS preauth_pending,
        COUNT(*) FILTER (WHERE cl.status = 'approved') AS preauth_approved,
        COUNT(*) FILTER (WHERE cl.status IN ('submitted','query')) AS claims_pending,
        COUNT(*) FILTER (WHERE cl.status = 'approved') AS claims_approved,
        COUNT(*) FILTER (WHERE cl.status = 'settled') AS claims_settled,
        COUNT(*) FILTER (WHERE cl.status = 'rejected') AS claims_rejected,
        COALESCE(SUM(cl.claimed_amount), 0) AS total_claimed,
        COALESCE(SUM(cl.approved_amount), 0) AS total_approved,
        COALESCE(SUM(cl.settled_amount), 0) AS total_settled,
        COALESCE(SUM(cl.claimed_amount) - COALESCE(SUM(cl.settled_amount), 0), 0) AS total_outstanding
    FROM hmis_claims cl
    JOIN hmis_bills b ON b.id = cl.bill_id
    WHERE cl.status NOT IN ('settled','rejected')
    GROUP BY b.centre_id;
$$;
-- ============================================================
-- Health1 HMIS — Quality/NABH + Audit Trail
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Incident Reporting
CREATE TABLE IF NOT EXISTS hmis_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    incident_number varchar(20) NOT NULL UNIQUE,
    category varchar(30) NOT NULL CHECK (category IN (
        'medication_error','fall','infection','surgical','transfusion',
        'equipment','documentation','communication','delay','abuse',
        'needle_stick','fire_safety','other'
    )),
    severity varchar(15) NOT NULL CHECK (severity IN ('near_miss','minor','moderate','serious','sentinel')),
    description text NOT NULL,
    location varchar(50),
    patient_id uuid REFERENCES hmis_patients(id),
    involved_staff text,
    immediate_action text,
    root_cause text,
    corrective_action text,
    preventive_action text,
    status varchar(15) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','investigating','action_taken','closed','reopened')),
    reported_by uuid NOT NULL REFERENCES hmis_staff(id),
    assigned_to uuid REFERENCES hmis_staff(id),
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_centre ON hmis_incidents(centre_id, status);

-- 2. Quality Indicators (NABH KPIs)
CREATE TABLE IF NOT EXISTS hmis_quality_indicators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    indicator_code varchar(10) NOT NULL,
    indicator_name varchar(100) NOT NULL,
    period varchar(10) NOT NULL, -- '2026-03' format
    value decimal(10,2) NOT NULL,
    numerator int,
    denominator int,
    target decimal(10,2),
    met_target boolean,
    submitted_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, indicator_code, period)
);

CREATE INDEX IF NOT EXISTS idx_qi_centre ON hmis_quality_indicators(centre_id, period);

-- 3. Audit Trail
CREATE TABLE IF NOT EXISTS hmis_audit_trail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    user_id uuid NOT NULL REFERENCES hmis_staff(id),
    action varchar(20) NOT NULL CHECK (action IN ('create','update','delete','view','print','sign','cancel','approve','reject')),
    entity_type varchar(30) NOT NULL,
    entity_id uuid,
    entity_label varchar(200),
    changes jsonb,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_centre ON hmis_audit_trail(centre_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON hmis_audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON hmis_audit_trail(user_id, created_at DESC);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_incidents','hmis_quality_indicators','hmis_audit_trail'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;
-- Health1 HMIS — CRM Module + Integration Tables
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)

-- ============================================================
-- CRM LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  -- Lead source
  source varchar(50) NOT NULL DEFAULT 'walk_in', -- walk_in, phone, website, google_ads, facebook, referral, camp, leadsquared, dialshree
  source_campaign varchar(200),
  source_medium varchar(100), -- organic, paid, referral, direct
  utm_source varchar(200), utm_medium varchar(100), utm_campaign varchar(200),
  -- Contact
  first_name varchar(100) NOT NULL,
  last_name varchar(100),
  phone varchar(20) NOT NULL,
  phone_alt varchar(20),
  email varchar(200),
  gender varchar(10),
  age_years integer,
  city varchar(100),
  pincode varchar(10),
  -- Interest
  interested_department varchar(100), -- cardiology, ortho, neuro, etc.
  interested_doctor_id uuid REFERENCES hmis_staff(id),
  interested_procedure varchar(200),
  chief_complaint text,
  insurance_status varchar(20) DEFAULT 'unknown', -- has_insurance, pmjay, no_insurance, unknown
  insurance_company varchar(200),
  estimated_value decimal(12,2) DEFAULT 0,
  -- Pipeline
  status varchar(30) NOT NULL DEFAULT 'new', -- new, contacted, qualified, appointment_booked, visited, converted, lost, dnc
  stage varchar(30) DEFAULT 'awareness', -- awareness, consideration, decision, booked, visited, admitted, discharged
  priority varchar(10) DEFAULT 'medium', -- hot, warm, medium, cold
  score integer DEFAULT 0, -- lead score 0-100
  -- Assignment
  assigned_to uuid REFERENCES hmis_staff(id),
  assigned_at timestamp with time zone,
  -- Conversion
  patient_id uuid REFERENCES hmis_patients(id), -- set when converted
  appointment_id uuid,
  converted_at timestamp with time zone,
  conversion_revenue decimal(12,2) DEFAULT 0,
  lost_reason varchar(200),
  -- External IDs
  leadsquared_id varchar(100),
  dialshree_id varchar(100),
  -- Meta
  tags text[], -- ['vip', 'corporate', 'camp_nov_2025']
  custom_fields jsonb DEFAULT '{}',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_centre ON hmis_crm_leads(centre_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON hmis_crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON hmis_crm_leads(phone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON hmis_crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_leadsquared ON hmis_crm_leads(leadsquared_id);

-- ============================================================
-- CRM ACTIVITIES / FOLLOW-UPS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES hmis_crm_leads(id) ON DELETE CASCADE,
  centre_id uuid REFERENCES hmis_centres(id),
  activity_type varchar(30) NOT NULL, -- call, whatsapp, email, sms, meeting, note, status_change, appointment
  direction varchar(10), -- inbound, outbound (for calls/messages)
  -- Call details (from DialShree)
  call_duration_seconds integer,
  call_recording_url text,
  call_disposition varchar(50), -- answered, no_answer, busy, voicemail, wrong_number
  dialshree_call_id varchar(100),
  caller_number varchar(20),
  agent_number varchar(20),
  -- Content
  subject varchar(200),
  description text,
  -- Follow-up
  follow_up_date timestamp with time zone,
  follow_up_type varchar(30), -- call, whatsapp, visit
  follow_up_done boolean DEFAULT false,
  -- Meta
  performed_by uuid REFERENCES hmis_staff(id),
  performed_at timestamp with time zone DEFAULT now(),
  leadsquared_activity_id varchar(100),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON hmis_crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_followup ON hmis_crm_activities(follow_up_date) WHERE follow_up_done = false;
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON hmis_crm_activities(activity_type);

-- ============================================================
-- CRM CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  name varchar(200) NOT NULL,
  type varchar(30) NOT NULL, -- health_camp, digital_ads, referral, corporate_tie_up, awareness, screening
  status varchar(20) DEFAULT 'planned', -- planned, active, completed, cancelled
  start_date date,
  end_date date,
  budget decimal(12,2) DEFAULT 0,
  spent decimal(12,2) DEFAULT 0,
  target_department varchar(100),
  target_audience text,
  -- Metrics (auto-calculated)
  leads_generated integer DEFAULT 0,
  appointments_booked integer DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue_generated decimal(12,2) DEFAULT 0,
  -- External
  leadsquared_campaign_id varchar(100),
  google_ads_campaign_id varchar(100),
  facebook_campaign_id varchar(100),
  -- Meta
  created_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- INTEGRATION CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_integration_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  provider varchar(50) NOT NULL, -- leadsquared, dialshree, whatsapp, google_ads
  is_enabled boolean DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  -- LeadSquared: { api_host, access_key, secret_key }
  -- DialShree: { api_url, api_key, agent_id, campaign_id }
  -- WhatsApp: { api_url, api_token, business_phone }
  last_sync_at timestamp with time zone,
  sync_status varchar(20) DEFAULT 'idle', -- idle, syncing, error
  sync_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, provider)
);

-- ============================================================
-- INTEGRATION SYNC LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  provider varchar(50) NOT NULL,
  direction varchar(10) NOT NULL, -- push, pull
  entity_type varchar(50), -- lead, activity, appointment
  entity_id uuid,
  external_id varchar(200),
  status varchar(20) NOT NULL, -- success, error
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_centre ON hmis_integration_sync_log(centre_id, provider);
CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON hmis_integration_sync_log(entity_id);
-- Health1 HMIS — 9 New Modules Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)

-- ============================================================
-- 1. EMERGENCY / TRIAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_er_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  arrival_mode varchar(20) DEFAULT 'walk_in', -- walk_in, ambulance, referred, police
  arrival_time timestamp with time zone DEFAULT now(),
  triage_category varchar(10), -- red, orange, yellow, green, black (MTS/ESI)
  triage_score integer, -- 1-5 ESI
  triage_by uuid REFERENCES hmis_staff(id),
  triage_time timestamp with time zone,
  chief_complaint text,
  vitals jsonb DEFAULT '{}', -- bp, hr, rr, spo2, temp, gcs
  gcs_score integer, -- 3-15
  is_trauma boolean DEFAULT false,
  trauma_type varchar(50), -- rta, fall, assault, burn, poisoning, other
  is_mlc boolean DEFAULT false,
  mlc_number varchar(50),
  police_station varchar(100),
  fir_number varchar(50),
  er_bed_id uuid REFERENCES hmis_beds(id),
  attending_doctor_id uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'triaged', -- triaged, being_seen, under_observation, admitted, discharged, referred, dama, expired
  disposition varchar(20), -- admit, discharge, refer, dama, expired
  disposition_time timestamp with time zone,
  admission_id uuid REFERENCES hmis_admissions(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_er_visits_centre ON hmis_er_visits(centre_id, status);

-- ============================================================
-- 2. DIETARY / KITCHEN
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_diet_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  diet_type varchar(30) NOT NULL, -- regular, diabetic, renal, liquid, soft, npo, high_protein, low_salt, cardiac
  special_instructions text,
  allergies text[], -- food allergies
  meal_plan jsonb DEFAULT '{}', -- { breakfast: true, lunch: true, dinner: true, snacks: true }
  calorie_target integer,
  protein_target integer,
  ordered_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'active', -- active, modified, discontinued
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_meal_service (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  diet_order_id uuid REFERENCES hmis_diet_orders(id),
  patient_id uuid REFERENCES hmis_patients(id),
  meal_type varchar(20) NOT NULL, -- breakfast, lunch, dinner, snack
  service_date date DEFAULT CURRENT_DATE,
  menu_items text[],
  served_by uuid REFERENCES hmis_staff(id),
  served_at timestamp with time zone,
  consumed varchar(20), -- full, partial, refused, npo
  wastage_pct integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_service_date ON hmis_meal_service(centre_id, service_date, meal_type);

-- ============================================================
-- 3. CSSD (Central Sterile Supply Department)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_cssd_instrument_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  set_name varchar(200) NOT NULL,
  set_code varchar(50),
  department varchar(100),
  instruments jsonb NOT NULL DEFAULT '[]', -- [{name, qty, condition}]
  total_instruments integer DEFAULT 0,
  status varchar(20) DEFAULT 'available', -- available, in_use, sterilizing, maintenance
  last_sterilized_at timestamp with time zone,
  sterilization_count integer DEFAULT 0,
  max_cycles integer DEFAULT 500,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_cssd_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  autoclave_number varchar(50),
  cycle_number varchar(50),
  cycle_type varchar(20), -- gravity, prevacuum, flash, eto
  load_items jsonb NOT NULL DEFAULT '[]', -- [{set_id, set_name}]
  temperature decimal(5,1),
  pressure decimal(5,2),
  duration_minutes integer,
  bi_test_result varchar(10), -- pass, fail, pending
  ci_result varchar(10), -- pass, fail
  operator_id uuid REFERENCES hmis_staff(id),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status varchar(20) DEFAULT 'in_progress', -- in_progress, completed, failed, recalled
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_cssd_issue_return (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  set_id uuid REFERENCES hmis_cssd_instrument_sets(id),
  issued_to varchar(100), -- OT/Ward/Department name
  ot_booking_id uuid,
  issued_by uuid REFERENCES hmis_staff(id),
  issued_at timestamp with time zone DEFAULT now(),
  returned_at timestamp with time zone,
  returned_by uuid REFERENCES hmis_staff(id),
  condition_on_return varchar(20), -- good, damaged, missing_items
  missing_items jsonb DEFAULT '[]',
  notes text
);

-- ============================================================
-- 4. DIALYSIS UNIT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_dialysis_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  machine_number varchar(50) NOT NULL,
  brand varchar(100),
  model varchar(100),
  serial_number varchar(100),
  status varchar(20) DEFAULT 'available', -- available, in_use, maintenance, out_of_order
  last_maintenance_date date,
  next_maintenance_date date,
  total_sessions integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_dialysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  machine_id uuid REFERENCES hmis_dialysis_machines(id),
  session_date date DEFAULT CURRENT_DATE,
  session_number integer, -- this patient's Nth session
  dialysis_type varchar(20) DEFAULT 'hd', -- hd, hdf, pd, crrt, sled
  access_type varchar(20), -- av_fistula, av_graft, catheter_perm, catheter_temp
  -- Pre-dialysis
  pre_weight decimal(5,1),
  pre_bp varchar(20),
  pre_pulse integer,
  pre_temp decimal(4,1),
  target_uf decimal(6,1), -- ultrafiltration target in ml
  -- Session params
  dialyzer_type varchar(100),
  blood_flow_rate integer, -- ml/min
  dialysate_flow_rate integer,
  heparin_dose varchar(50),
  duration_minutes integer DEFAULT 240,
  actual_start timestamp with time zone,
  actual_end timestamp with time zone,
  -- Post-dialysis
  post_weight decimal(5,1),
  post_bp varchar(20),
  post_pulse integer,
  actual_uf decimal(6,1),
  -- Complications
  complications text[], -- hypotension, cramps, nausea, clotting, access_issue
  intradialytic_events text,
  -- Staff
  technician_id uuid REFERENCES hmis_staff(id),
  doctor_id uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  billing_done boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dialysis_sessions_date ON hmis_dialysis_sessions(centre_id, session_date);

-- ============================================================
-- 5. CATH LAB
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_cathlab_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  procedure_date date DEFAULT CURRENT_DATE,
  procedure_type varchar(30) NOT NULL, -- cag, ptca, ppi, icd, ep_study, bmc, tavi, structural
  procedure_name varchar(200),
  -- Clinical
  indication text,
  access_site varchar(20), -- radial, femoral
  cag_findings text, -- LM, LAD, LCx, RCA findings
  vessels_involved text[],
  stents_placed jsonb DEFAULT '[]', -- [{vessel, type, brand, size, serial}]
  balloon_used jsonb DEFAULT '[]',
  -- Implant details
  implant_details jsonb DEFAULT '{}', -- pacemaker/ICD: {brand, model, serial, leads}
  -- Radiation
  fluoroscopy_time_min decimal(5,1),
  radiation_dose_mgy decimal(8,1),
  contrast_volume_ml integer,
  contrast_type varchar(50),
  -- Team
  primary_operator uuid REFERENCES hmis_staff(id),
  secondary_operator uuid REFERENCES hmis_staff(id),
  anesthetist_id uuid REFERENCES hmis_staff(id),
  -- Outcome
  procedure_status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, abandoned, complication
  outcome varchar(20), -- success, partial, failed
  complications text[],
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  billing_done boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cathlab_date ON hmis_cathlab_procedures(centre_id, procedure_date);

-- ============================================================
-- 6. ENDOSCOPY UNIT (reuse for scopes)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_endoscopy_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  procedure_date date DEFAULT CURRENT_DATE,
  procedure_type varchar(30) NOT NULL, -- ogd, colonoscopy, ercp, eus, bronchoscopy, sigmoidoscopy
  indication text,
  sedation_type varchar(20), -- local, conscious, deep, ga
  scope_id varchar(50), -- track which scope used
  findings text,
  biopsy_taken boolean DEFAULT false,
  biopsy_details text,
  therapeutic_intervention text, -- polypectomy, banding, stenting, dilatation
  complications text[],
  endoscopist_id uuid REFERENCES hmis_staff(id),
  nurse_id uuid REFERENCES hmis_staff(id),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status varchar(20) DEFAULT 'scheduled',
  images jsonb DEFAULT '[]', -- [{url, description}]
  report text,
  billing_done boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_scope_decontamination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  scope_id varchar(50) NOT NULL,
  scope_type varchar(30), -- gastroscope, colonoscope, duodenoscope, bronchoscope
  procedure_id uuid REFERENCES hmis_endoscopy_procedures(id),
  decontamination_method varchar(30), -- aer, manual, cidex
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  leak_test varchar(10), -- pass, fail
  culture_result varchar(20), -- pending, negative, positive
  performed_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 7. PHYSIOTHERAPY / REHAB
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_physio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid,
  therapist_id uuid REFERENCES hmis_staff(id),
  session_date date DEFAULT CURRENT_DATE,
  session_number integer,
  -- Assessment
  diagnosis varchar(200),
  treatment_area varchar(100), -- knee, shoulder, spine, neuro, cardiac, chest
  modalities text[], -- ift, tens, us, swd, laser, wax, traction, cpm
  exercises text[],
  manual_therapy text,
  -- Outcome
  pain_score_before integer, -- 0-10 VAS
  pain_score_after integer,
  rom_before jsonb DEFAULT '{}', -- {flexion: 90, extension: 0}
  rom_after jsonb DEFAULT '{}',
  functional_score integer, -- standardized outcome measure
  -- Meta
  duration_minutes integer DEFAULT 30,
  status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled, no_show
  billing_done boolean DEFAULT false,
  notes text,
  next_session_date date,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_physio_date ON hmis_physio_sessions(centre_id, session_date);

CREATE TABLE IF NOT EXISTS hmis_physio_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  therapist_id uuid REFERENCES hmis_staff(id),
  diagnosis varchar(200),
  goals text[],
  treatment_plan text,
  total_sessions_planned integer DEFAULT 10,
  sessions_completed integer DEFAULT 0,
  frequency varchar(30), -- daily, alternate, twice_week, weekly
  status varchar(20) DEFAULT 'active', -- active, completed, discontinued
  start_date date,
  expected_end_date date,
  outcome_at_discharge text,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 8. REFERRAL MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  referral_type varchar(20) NOT NULL, -- internal, external_in, external_out
  -- Referring
  referring_doctor_name varchar(200),
  referring_doctor_phone varchar(20),
  referring_doctor_reg varchar(50), -- MCI/state reg number
  referring_hospital varchar(200),
  referring_city varchar(100),
  -- Referred to
  referred_to_doctor_id uuid REFERENCES hmis_staff(id),
  referred_to_department varchar(100),
  -- Clinical
  reason text,
  diagnosis varchar(200),
  urgency varchar(10) DEFAULT 'routine', -- emergency, urgent, routine
  -- Tracking
  status varchar(20) DEFAULT 'received', -- received, appointment_made, visited, admitted, completed, lost
  appointment_id uuid,
  admission_id uuid REFERENCES hmis_admissions(id),
  -- Revenue
  expected_revenue decimal(12,2) DEFAULT 0,
  actual_revenue decimal(12,2) DEFAULT 0,
  referral_fee_pct decimal(5,2) DEFAULT 0,
  referral_fee_amount decimal(12,2) DEFAULT 0,
  fee_paid boolean DEFAULT false,
  fee_paid_date date,
  -- Meta
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_centre ON hmis_referrals(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_doctor ON hmis_referrals(referring_doctor_phone);

-- ============================================================
-- 9. PACKAGE MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  package_code varchar(50),
  package_name varchar(200) NOT NULL,
  department varchar(100),
  category varchar(30), -- surgical, medical, daycare, diagnostic, maternity
  procedure_type varchar(200),
  -- Pricing
  package_rate decimal(12,2) NOT NULL,
  rate_insurance decimal(12,2),
  rate_pmjay decimal(12,2),
  rate_cghs decimal(12,2),
  -- Inclusions
  inclusions jsonb NOT NULL DEFAULT '[]', -- [{category, item, included_qty, included_days}]
  exclusions text[], -- items NOT included
  los_days integer DEFAULT 3, -- expected length of stay
  room_category varchar(20) DEFAULT 'general', -- general, semi_private, private
  -- Validity
  is_active boolean DEFAULT true,
  valid_from date,
  valid_until date,
  -- Meta
  created_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_packages_centre ON hmis_packages(centre_id, is_active);

-- ============================================================
-- 10. DISCHARGE PLANNING (enhancement)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_discharge_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
  centre_id uuid REFERENCES hmis_centres(id),
  -- Clinical
  medication_reconciliation boolean DEFAULT false,
  discharge_medications_reviewed boolean DEFAULT false,
  follow_up_appointments_set boolean DEFAULT false,
  wound_care_instructions boolean DEFAULT false,
  diet_instructions boolean DEFAULT false,
  activity_restrictions boolean DEFAULT false,
  warning_signs_explained boolean DEFAULT false,
  -- Administrative
  final_bill_generated boolean DEFAULT false,
  final_bill_settled boolean DEFAULT false,
  insurance_claim_submitted boolean DEFAULT false,
  discharge_summary_completed boolean DEFAULT false,
  discharge_summary_signed boolean DEFAULT false,
  patient_education_done boolean DEFAULT false,
  -- Logistics
  belongings_returned boolean DEFAULT false,
  transport_arranged boolean DEFAULT false,
  referral_letters_given boolean DEFAULT false,
  medical_certificate_issued boolean DEFAULT false,
  -- Sign-off
  completed_by uuid REFERENCES hmis_staff(id),
  completed_at timestamp with time zone,
  status varchar(20) DEFAULT 'pending', -- pending, in_progress, completed
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discharge_checklist ON hmis_discharge_checklists(admission_id);
-- Health1 HMIS — Modules 15-17 Migration
-- Ambulance/Transport, Visitor Management, Asset Management

-- ============================================================
-- 15. AMBULANCE & TRANSPORT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_ambulances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  vehicle_number varchar(20) NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'bls', -- als, bls, patient_transport, neonatal, mortuary
  make varchar(50),
  model varchar(50),
  year integer,
  driver_name varchar(200),
  driver_phone varchar(20),
  driver_license varchar(50),
  emt_name varchar(200),
  emt_phone varchar(20),
  status varchar(20) DEFAULT 'available', -- available, on_trip, maintenance, out_of_service
  current_location varchar(200),
  fuel_level varchar(10), -- full, 3/4, half, 1/4, empty
  last_sanitized timestamp with time zone,
  insurance_expiry date,
  fitness_expiry date,
  equipment_checklist jsonb DEFAULT '{}', -- {oxygen: true, defibrillator: true, stretcher: true}
  odometer_km integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ambulances_centre ON hmis_ambulances(centre_id, status);

CREATE TABLE IF NOT EXISTS hmis_transport_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  request_number varchar(50),
  request_type varchar(30) NOT NULL, -- emergency_pickup, inter_hospital_transfer, discharge, dialysis_shuttle, opd_pickup, dead_body
  priority varchar(10) DEFAULT 'routine', -- emergency, urgent, routine
  -- Patient
  patient_id uuid REFERENCES hmis_patients(id),
  patient_name varchar(200),
  patient_phone varchar(20),
  patient_condition varchar(50), -- stable, critical, ventilated, immobile
  -- Route
  pickup_location text NOT NULL,
  pickup_landmark varchar(200),
  drop_location text NOT NULL,
  drop_landmark varchar(200),
  distance_km decimal(6,1),
  -- Assignment
  ambulance_id uuid REFERENCES hmis_ambulances(id),
  driver_name varchar(200),
  emt_name varchar(200),
  -- Timestamps
  requested_at timestamp with time zone DEFAULT now(),
  requested_by uuid REFERENCES hmis_staff(id),
  dispatched_at timestamp with time zone,
  en_route_at timestamp with time zone,
  arrived_at timestamp with time zone,
  patient_loaded_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  -- Metrics
  response_time_min integer, -- dispatch to arrival
  total_trip_time_min integer,
  -- Billing
  trip_charge decimal(10,2) DEFAULT 0,
  billing_done boolean DEFAULT false,
  -- Meta
  status varchar(20) DEFAULT 'requested', -- requested, dispatched, en_route, arrived, patient_loaded, returning, completed, cancelled
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transport_centre ON hmis_transport_requests(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_date ON hmis_transport_requests(requested_at);

-- ============================================================
-- 16. VISITOR MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_visitor_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  pass_number varchar(50),
  -- Visitor
  visitor_name varchar(200) NOT NULL,
  visitor_phone varchar(20),
  visitor_address text,
  relation varchar(50), -- spouse, parent, child, sibling, friend, relative, other
  id_proof_type varchar(20), -- aadhar, pan, driving_license, passport, voter_id
  id_proof_number varchar(50),
  photo_url text,
  -- Patient
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  ward varchar(100),
  bed varchar(50),
  -- Pass details
  pass_type varchar(20) DEFAULT 'regular', -- regular, icu, nicu, isolation, emergency, attendant
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  max_visitors_at_time integer DEFAULT 2,
  visiting_hours varchar(50), -- e.g. "10:00-12:00, 16:00-18:00"
  -- Tracking
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  items_deposited text[], -- mobile, bag, food
  -- Meta
  issued_by uuid REFERENCES hmis_staff(id),
  revoked_by uuid REFERENCES hmis_staff(id),
  revocation_reason text,
  status varchar(20) DEFAULT 'active', -- active, checked_in, checked_out, expired, revoked
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visitor_centre ON hmis_visitor_passes(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_visitor_patient ON hmis_visitor_passes(patient_id);

-- ============================================================
-- 17. ASSET MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  asset_tag varchar(50) NOT NULL,
  -- Details
  name varchar(200) NOT NULL,
  description text,
  category varchar(30) NOT NULL, -- furniture, it_hardware, it_software, medical_equipment, surgical_instrument, vehicle, building, electrical, plumbing, hvac, other
  sub_category varchar(100),
  brand varchar(100),
  model varchar(100),
  serial_number varchar(100),
  -- Location
  department varchar(100),
  location varchar(200),
  floor varchar(20),
  room varchar(50),
  -- Purchase
  purchase_date date,
  purchase_cost decimal(12,2),
  purchase_order_number varchar(50),
  vendor varchar(200),
  invoice_number varchar(50),
  -- Warranty & AMC
  warranty_expiry date,
  amc_vendor varchar(200),
  amc_start_date date,
  amc_expiry date,
  amc_cost_annual decimal(10,2),
  amc_type varchar(20), -- comprehensive, non_comprehensive, camc
  -- Depreciation
  useful_life_years integer DEFAULT 10,
  depreciation_method varchar(20) DEFAULT 'straight_line', -- straight_line, wdv (written down value)
  depreciation_rate decimal(5,2), -- % per year for WDV
  salvage_value decimal(10,2) DEFAULT 0,
  current_book_value decimal(12,2),
  -- Status
  status varchar(20) DEFAULT 'in_use', -- in_use, in_storage, under_maintenance, condemned, disposed, lost, transferred
  condition varchar(20) DEFAULT 'good', -- new, good, fair, poor, non_functional
  -- Disposal
  disposed_date date,
  disposal_method varchar(20), -- sold, scrapped, donated, returned
  disposal_value decimal(10,2),
  disposal_approved_by uuid REFERENCES hmis_staff(id),
  -- Custodian
  custodian_id uuid REFERENCES hmis_staff(id),
  custodian_department varchar(100),
  -- Meta
  qr_code varchar(200),
  photo_url text,
  documents jsonb DEFAULT '[]', -- [{name, url, type}]
  last_audit_date date,
  next_audit_date date,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, asset_tag)
);
CREATE INDEX IF NOT EXISTS idx_assets_centre ON hmis_assets(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_dept ON hmis_assets(department);
CREATE INDEX IF NOT EXISTS idx_assets_category ON hmis_assets(category);

CREATE TABLE IF NOT EXISTS hmis_asset_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES hmis_assets(id),
  centre_id uuid REFERENCES hmis_centres(id),
  audit_type varchar(20) NOT NULL, -- physical_verification, condition_check, transfer, maintenance, disposal
  audit_date date DEFAULT CURRENT_DATE,
  previous_location varchar(200),
  current_location varchar(200),
  previous_condition varchar(20),
  current_condition varchar(20),
  findings text,
  audited_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_audit ON hmis_asset_audit_log(asset_id);
-- Health1 HMIS — Modules 18-21 Migration
-- Infection Control, Grievance, Telemedicine, Document/SOP

-- ============================================================
-- 18. INFECTION CONTROL (HICC)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_hai_surveillance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  infection_type varchar(20) NOT NULL, -- ssi, cauti, clabsi, vap, bsi, cdi, mrsa, vre, esbl, other
  site varchar(100),
  organism varchar(200),
  sensitivity_pattern jsonb DEFAULT '{}', -- {antibiotic: S/R/I}
  onset_date date,
  culture_date date,
  culture_result varchar(30), -- positive, negative, pending, contaminated
  device_related boolean DEFAULT false,
  device_type varchar(50), -- central_line, urinary_catheter, ventilator, surgical_site
  device_insertion_date date,
  device_removal_date date,
  device_days integer,
  ward varchar(100),
  is_community_acquired boolean DEFAULT false,
  outcome varchar(20), -- resolved, ongoing, death, transferred
  reported_by uuid REFERENCES hmis_staff(id),
  verified_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'suspected', -- suspected, confirmed, ruled_out
  action_taken text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hai_centre ON hmis_hai_surveillance(centre_id);
CREATE INDEX IF NOT EXISTS idx_hai_type ON hmis_hai_surveillance(infection_type);

CREATE TABLE IF NOT EXISTS hmis_antibiogram (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  year integer NOT NULL,
  quarter integer, -- 1-4
  organism varchar(200) NOT NULL,
  antibiotic varchar(200) NOT NULL,
  samples_tested integer DEFAULT 0,
  sensitive_count integer DEFAULT 0,
  resistant_count integer DEFAULT 0,
  intermediate_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, year, quarter, organism, antibiotic)
);

CREATE TABLE IF NOT EXISTS hmis_hand_hygiene_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  ward varchar(100) NOT NULL,
  audit_date date DEFAULT CURRENT_DATE,
  shift varchar(10), -- morning, afternoon, night
  moment varchar(30), -- before_patient, after_patient, after_body_fluid, before_aseptic, after_surroundings
  opportunities_observed integer DEFAULT 0,
  compliant integer DEFAULT 0,
  auditor_id uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_needle_stick_injuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  staff_id uuid REFERENCES hmis_staff(id),
  incident_date timestamp with time zone,
  location varchar(100),
  device_type varchar(50), -- syringe, iv_catheter, suture_needle, lancet, scalpel, other
  body_part_affected varchar(50),
  source_patient_id uuid REFERENCES hmis_patients(id),
  source_hiv_status varchar(20), -- positive, negative, unknown
  source_hbv_status varchar(20),
  source_hcv_status varchar(20),
  pep_given boolean DEFAULT false,
  pep_details text,
  baseline_labs_done boolean DEFAULT false,
  follow_up_status varchar(20) DEFAULT 'pending', -- pending, in_progress, completed, lost_to_followup
  outcome varchar(30), -- no_seroconversion, seroconversion, pending
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 19. PATIENT GRIEVANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_grievances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  grievance_number varchar(50),
  patient_id uuid REFERENCES hmis_patients(id),
  complainant_name varchar(200) NOT NULL,
  complainant_phone varchar(20),
  complainant_email varchar(200),
  complainant_relation varchar(50), -- self, spouse, parent, child, other
  complaint_type varchar(30) NOT NULL, -- clinical, billing, behavior, facility, food, delay, privacy, infection, other
  department varchar(100),
  description text NOT NULL,
  severity varchar(10) DEFAULT 'minor', -- minor, major, critical
  source varchar(20) DEFAULT 'in_person', -- in_person, phone, email, online, suggestion_box, social_media
  -- Workflow
  assigned_to uuid REFERENCES hmis_staff(id),
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid REFERENCES hmis_staff(id),
  investigated_by uuid REFERENCES hmis_staff(id),
  investigation_notes text,
  root_cause text,
  corrective_action text,
  preventive_action text,
  resolution text,
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES hmis_staff(id),
  -- Satisfaction
  patient_satisfied boolean,
  satisfaction_remarks text,
  -- Escalation
  escalated boolean DEFAULT false,
  escalated_to uuid REFERENCES hmis_staff(id),
  escalation_reason text,
  -- Meta
  status varchar(20) DEFAULT 'received', -- received, acknowledged, investigating, resolved, closed, escalated, reopened
  reopened_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grievances_centre ON hmis_grievances(centre_id, status);

-- ============================================================
-- 20. TELEMEDICINE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_teleconsults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  doctor_id uuid REFERENCES hmis_staff(id),
  appointment_id uuid,
  scheduled_at timestamp with time zone NOT NULL,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  duration_minutes integer,
  room_url varchar(500), -- Jitsi/Daily.co room URL
  room_id varchar(100), -- unique room identifier
  -- Clinical
  chief_complaint text,
  consultation_notes text,
  diagnoses jsonb DEFAULT '[]',
  prescriptions jsonb DEFAULT '[]',
  investigations_ordered jsonb DEFAULT '[]',
  follow_up_date date,
  follow_up_notes text,
  -- Technical
  patient_joined_at timestamp with time zone,
  doctor_joined_at timestamp with time zone,
  connection_quality varchar(10), -- good, fair, poor
  recording_url text,
  -- Billing
  consultation_fee decimal(10,2),
  billing_done boolean DEFAULT false,
  bill_id uuid,
  -- Meta
  status varchar(20) DEFAULT 'scheduled', -- scheduled, waiting, in_progress, completed, no_show, cancelled, rescheduled
  cancellation_reason text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teleconsults_date ON hmis_teleconsults(centre_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_teleconsults_doctor ON hmis_teleconsults(doctor_id, status);

-- ============================================================
-- 21. DOCUMENT / SOP MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  doc_type varchar(20) NOT NULL, -- policy, sop, protocol, guideline, form, manual, circular, memo
  department varchar(100),
  title varchar(500) NOT NULL,
  doc_number varchar(50),
  version integer DEFAULT 1,
  content_html text,
  file_url text, -- Supabase storage URL
  file_size integer,
  -- Approval workflow
  created_by uuid REFERENCES hmis_staff(id),
  reviewed_by uuid REFERENCES hmis_staff(id),
  reviewed_at timestamp with time zone,
  approved_by uuid REFERENCES hmis_staff(id),
  approved_at timestamp with time zone,
  -- Dates
  effective_date date,
  review_date date, -- next review due
  superseded_date date,
  -- Classification
  tags text[],
  access_level varchar(20) DEFAULT 'all_staff', -- all_staff, department, management, confidential
  is_nabh_required boolean DEFAULT false,
  nabh_standard varchar(50), -- e.g. COP.1, MOM.2
  -- Meta
  status varchar(20) DEFAULT 'draft', -- draft, under_review, approved, superseded, archived
  previous_version_id uuid REFERENCES hmis_documents(id),
  download_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_centre ON hmis_documents(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_dept ON hmis_documents(department);
CREATE INDEX IF NOT EXISTS idx_documents_review ON hmis_documents(review_date) WHERE status = 'approved';
-- Health1 HMIS — Procurement Module Migration
-- Purchase Indents + Vendor Directory

-- ============================================================
-- PURCHASE INDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_purchase_indents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES hmis_centres(id),
  indent_number varchar(30) NOT NULL,
  department varchar(100) NOT NULL,
  -- Items
  items jsonb NOT NULL DEFAULT '[]',
  -- items: [{item_name, qty, unit, specification, urgency: routine/urgent/emergency, estimated_cost}]
  total_estimated_cost decimal(12,2) DEFAULT 0,
  -- Workflow
  requested_by uuid REFERENCES hmis_staff(id),
  approved_by uuid REFERENCES hmis_staff(id),
  approved_at timestamp with time zone,
  rejected_by uuid REFERENCES hmis_staff(id),
  rejected_at timestamp with time zone,
  rejection_reason text,
  po_id uuid REFERENCES hmis_pharmacy_po(id),
  -- Meta
  priority varchar(10) DEFAULT 'routine', -- routine, urgent, emergency
  status varchar(20) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected, ordered, partially_received, received, cancelled
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indents_centre ON hmis_purchase_indents(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_indents_requester ON hmis_purchase_indents(requested_by);

-- ============================================================
-- VENDOR DIRECTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  name varchar(200) NOT NULL,
  code varchar(20),
  contact_person varchar(200),
  phone varchar(20),
  email varchar(200),
  category varchar(50), -- pharma, surgical, medical_equipment, it, facility, lab, consumables, other
  sub_category varchar(100),
  gst_number varchar(20),
  pan_number varchar(20),
  address_line1 text,
  address_line2 text,
  city varchar(100),
  state varchar(100),
  pincode varchar(10),
  bank_name varchar(100),
  bank_account varchar(30),
  bank_ifsc varchar(15),
  credit_days integer DEFAULT 30,
  rating decimal(2,1) DEFAULT 3.0, -- 1.0 to 5.0
  total_orders integer DEFAULT 0,
  total_value decimal(14,2) DEFAULT 0,
  last_order_date date,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_centre ON hmis_vendors(centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON hmis_vendors(category);
-- ============================================================
-- Health1 HMIS — CDSS Machine Learning Usage Tracking
-- Tracks doctor behavior to evolve complaint templates
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_cdss_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_name varchar(100) NOT NULL,
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    attributes_used text[] NOT NULL DEFAULT '{}',
    attributes_skipped text[] NOT NULL DEFAULT '{}',
    chip_selections jsonb NOT NULL DEFAULT '{}',
    free_text_entries jsonb NOT NULL DEFAULT '{}',
    time_spent_ms int DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_cdss_doctor ON hmis_cdss_usage(doctor_id, complaint_name);
CREATE INDEX IF NOT EXISTS idx_cdss_centre ON hmis_cdss_usage(centre_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdss_complaint ON hmis_cdss_usage(complaint_name, created_at DESC);

-- RLS
ALTER TABLE hmis_cdss_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_cdss_usage_pol ON hmis_cdss_usage;
CREATE POLICY hmis_cdss_usage_pol ON hmis_cdss_usage FOR ALL USING (auth.uid() IS NOT NULL);
-- ============================================================
-- Health1 HMIS — Patient Portal
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Patient Portal Access Tokens (OTP-based login)
CREATE TABLE IF NOT EXISTS hmis_portal_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    phone varchar(15) NOT NULL,
    otp_code varchar(6) NOT NULL,
    otp_expires_at timestamptz NOT NULL,
    is_verified boolean NOT NULL DEFAULT false,
    session_token varchar(64),
    session_expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_phone ON hmis_portal_tokens(phone, otp_code);
CREATE INDEX IF NOT EXISTS idx_portal_session ON hmis_portal_tokens(session_token);

-- 2. Patient Portal Access Log (NABL + audit)
CREATE TABLE IF NOT EXISTS hmis_portal_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    action varchar(20) NOT NULL CHECK (action IN ('login','view_report','download_report','view_prescription','view_bill','book_appointment','view_discharge','view_vitals')),
    entity_type varchar(20),
    entity_id uuid,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_log_patient ON hmis_portal_access_log(patient_id, created_at DESC);

-- 3. Appointment Requests from Portal
CREATE TABLE IF NOT EXISTS hmis_portal_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    preferred_date date NOT NULL,
    preferred_time varchar(10),
    department varchar(50),
    doctor_preference varchar(100),
    reason text,
    status varchar(15) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','cancelled','completed')),
    confirmed_date date,
    confirmed_time time,
    confirmed_by uuid REFERENCES hmis_staff(id),
    notes text,
    centre_id uuid REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Patient Feedback
CREATE TABLE IF NOT EXISTS hmis_portal_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    feedback_type varchar(15) NOT NULL CHECK (feedback_type IN ('general','doctor','lab','pharmacy','billing','homecare','complaint','suggestion')),
    rating int CHECK (rating BETWEEN 1 AND 5),
    message text NOT NULL,
    department varchar(50),
    is_resolved boolean NOT NULL DEFAULT false,
    resolved_by uuid REFERENCES hmis_staff(id),
    resolution_notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS — portal tables use different access pattern (session token, not auth.uid)
-- For now, enable RLS but allow all authenticated access (portal API uses service key)
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_portal_tokens','hmis_portal_access_log',
        'hmis_portal_appointments','hmis_portal_feedback'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ════════════════════════════════════════════════════════
-- REBUILD COMPLETE
-- Next: Run sql/SEED_AND_TARIFF.sql for seed data + tariffs
-- ════════════════════════════════════════════════════════
