-- ════════════════════════════════════════════════════════════════
-- Health1 HMIS — SEED DATA
-- Run AFTER REBUILD_FULL.sql
-- Creates: 5 centres, 8 roles, 100 departments, 5 staff, permissions
-- ════════════════════════════════════════════════════════════════

-- ═══ 5 CENTRES ═══
INSERT INTO hmis_centres (id, code, name, city, state, beds_paper, beds_operational, entity_type) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'SHI', 'Health1 Shilaj', 'Ahmedabad', 'Gujarat', 330, 105, 'owned'),
    ('c0000001-0000-0000-0000-000000000002', 'VAS', 'Svayambhu Health1 Vastral', 'Ahmedabad', 'Gujarat', 111, 50, 'leased'),
    ('c0000001-0000-0000-0000-000000000003', 'MOD', 'Unity Health1 Modasa', 'Modasa', 'Gujarat', 51, 40, 'leased'),
    ('c0000001-0000-0000-0000-000000000004', 'GDN', 'Health1 SGS Gandhinagar', 'Gandhinagar', 'Gujarat', 225, 125, 'o_and_m'),
    ('c0000001-0000-0000-0000-000000000005', 'UDP', 'Health1 Neurorth Udaipur', 'Udaipur', 'Rajasthan', 51, 40, 'partnership')
ON CONFLICT DO NOTHING;

-- ═══ 8 ROLES ═══
INSERT INTO hmis_roles (id, name, description, is_system) VALUES
    ('a0000001-0000-0000-0000-000000000001', 'super_admin', 'Full system access', true),
    ('a0000001-0000-0000-0000-000000000002', 'admin', 'Centre-level admin', true),
    ('a0000001-0000-0000-0000-000000000003', 'doctor', 'Clinical access', true),
    ('a0000001-0000-0000-0000-000000000004', 'nurse', 'Nursing access', true),
    ('a0000001-0000-0000-0000-000000000005', 'pharmacist', 'Pharmacy access', true),
    ('a0000001-0000-0000-0000-000000000006', 'lab_tech', 'Lab access', true),
    ('a0000001-0000-0000-0000-000000000007', 'receptionist', 'Front desk access', true),
    ('a0000001-0000-0000-0000-000000000008', 'accountant', 'Finance access', true)
ON CONFLICT DO NOTHING;

-- ═══ SUPER ADMIN PERMISSIONS (all modules, all actions) ═══
INSERT INTO hmis_role_permissions (role_id, module, action, scope)
SELECT 'a0000001-0000-0000-0000-000000000001', m, a, 'all'
FROM unnest(ARRAY['core','patients','opd','ipd','emr','billing','insurance','pharmacy','lab','radiology','ot','bed_mgmt','scheduling','accounting','homecare','ambulance','notifications','ai_cdss','mis','documents','hr','settings']) AS m,
     unnest(ARRAY['create','read','update','delete','approve']) AS a
ON CONFLICT DO NOTHING;

-- ═══ DEPARTMENTS (Shilaj) ═══
INSERT INTO hmis_departments (centre_id, name, type) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'Cardiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Neurology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Orthopaedics', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'General Surgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'General Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Paediatrics', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Obstetrics & Gynaecology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'ENT', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Ophthalmology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Dermatology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Urology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Nephrology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Gastroenterology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Pulmonology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Oncology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'CVTS', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Plastic Surgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Anaesthesia', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Critical Care (ICU)', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Emergency Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Radiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Pathology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Microbiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Pharmacy', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Nursing', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Physiotherapy', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Dialysis', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Blood Bank', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Administration', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'Finance', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'HR', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'IT', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'Housekeeping', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'Maintenance', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'Kitchen', 'admin')
ON CONFLICT DO NOTHING;

-- ═══ STAFF (Leadership) ═══
-- Keyur's auth_user_id is his Supabase auth UID
INSERT INTO hmis_staff (id, employee_code, full_name, designation, staff_type, primary_centre_id, auth_user_id, is_active) VALUES
    ('b0000001-0000-0000-0000-000000000001', 'H1-MD-001', 'Dr. Keyur Patel', 'Managing Director', 'admin', 'c0000001-0000-0000-0000-000000000001', '4193cb77-92d8-4d85-b1eb-3a6ad8a1ef75', true),
    ('b0000001-0000-0000-0000-000000000002', 'H1-CEO-001', 'Jigar Vasani', 'CEO', 'admin', 'c0000001-0000-0000-0000-000000000001', NULL, true),
    ('b0000001-0000-0000-0000-000000000003', 'H1-COO-001', 'Nisha', 'COO', 'admin', 'c0000001-0000-0000-0000-000000000001', NULL, true),
    ('b0000001-0000-0000-0000-000000000004', 'H1-CAO-001', 'Nilesh Bhai', 'CAO', 'admin', 'c0000001-0000-0000-0000-000000000001', NULL, true),
    ('b0000001-0000-0000-0000-000000000005', 'H1-GCAO-001', 'Tina Bhai', 'Group CAO', 'admin', 'c0000001-0000-0000-0000-000000000001', NULL, true)
ON CONFLICT DO NOTHING;

-- ═══ STAFF → CENTRES (super_admin across all centres) ═══
INSERT INTO hmis_staff_centres (staff_id, centre_id, role_id)
SELECT s.id, c.id, 'a0000001-0000-0000-0000-000000000001'
FROM hmis_staff s CROSS JOIN hmis_centres c
WHERE s.employee_code IN ('H1-MD-001', 'H1-CEO-001', 'H1-COO-001', 'H1-CAO-001', 'H1-GCAO-001')
ON CONFLICT DO NOTHING;

-- ═══ FISCAL PERIODS (FY26) ═══
INSERT INTO hmis_fiscal_periods (period_name, start_date, end_date) VALUES
    ('FY26-Apr', '2025-04-01', '2025-04-30'),
    ('FY26-May', '2025-05-01', '2025-05-31'),
    ('FY26-Jun', '2025-06-01', '2025-06-30'),
    ('FY26-Jul', '2025-07-01', '2025-07-31'),
    ('FY26-Aug', '2025-08-01', '2025-08-31'),
    ('FY26-Sep', '2025-09-01', '2025-09-30'),
    ('FY26-Oct', '2025-10-01', '2025-10-31'),
    ('FY26-Nov', '2025-11-01', '2025-11-30'),
    ('FY26-Dec', '2025-12-01', '2025-12-31'),
    ('FY26-Jan', '2026-01-01', '2026-01-31'),
    ('FY26-Feb', '2026-02-01', '2026-02-28'),
    ('FY26-Mar', '2026-03-01', '2026-03-31')
ON CONFLICT DO NOTHING;

-- ═══ BASIC SETTINGS (Shilaj) ═══
INSERT INTO hmis_settings (centre_id, key, value) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'billing.gst_rate', '18'),
    ('c0000001-0000-0000-0000-000000000001', 'billing.bill_prefix', 'H1S'),
    ('c0000001-0000-0000-0000-000000000001', 'billing.consultation_rate', '500'),
    ('c0000001-0000-0000-0000-000000000001', 'hospital.hfr_id', 'IN2410013685'),
    ('c0000001-0000-0000-0000-000000000001', 'hospital.phone', '+91-79-4893-1111'),
    ('c0000001-0000-0000-0000-000000000001', 'hospital.email', 'info@health1.in')
ON CONFLICT DO NOTHING;

-- ═══ DONE ═══
-- Login: Use your existing Supabase email/password at hmis-brown.vercel.app/auth/login
