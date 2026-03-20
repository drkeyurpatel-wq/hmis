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
