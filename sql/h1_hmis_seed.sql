-- ============================================================
-- Health1 HMIS/ERP — Seed Data
-- Run AFTER h1_hmis_migration.sql
-- ============================================================

-- ════════════════════════════════════
-- 5 CENTRES
-- ════════════════════════════════════

INSERT INTO hmis_centres (id, code, name, city, state, beds_paper, beds_operational, entity_type) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'SHI', 'Health1 Shilaj', 'Ahmedabad', 'Gujarat', 330, 105, 'owned'),
    ('c0000001-0000-0000-0000-000000000002', 'VAS', 'Svayambhu Health1 Vastral', 'Ahmedabad', 'Gujarat', 111, 50, 'leased'),
    ('c0000001-0000-0000-0000-000000000003', 'MOD', 'Unity Health1 Modasa', 'Modasa', 'Gujarat', 51, 40, 'leased'),
    ('c0000001-0000-0000-0000-000000000004', 'GDN', 'Health1 SGS Gandhinagar', 'Gandhinagar', 'Gujarat', 225, 125, 'o_and_m'),
    ('c0000001-0000-0000-0000-000000000005', 'UDP', 'Health1 Neurorth Udaipur', 'Udaipur', 'Rajasthan', 51, 40, 'partnership');

-- ════════════════════════════════════
-- 8 SYSTEM ROLES
-- ════════════════════════════════════

INSERT INTO hmis_roles (id, name, description, is_system) VALUES
    ('a0000001-0000-0000-0000-000000000001', 'super_admin', 'Full system access across all centres', true),
    ('a0000001-0000-0000-0000-000000000002', 'admin', 'Centre-level admin', true),
    ('a0000001-0000-0000-0000-000000000003', 'doctor', 'Clinical access — EMR, OPD, IPD, orders', true),
    ('a0000001-0000-0000-0000-000000000004', 'nurse', 'Nursing — vitals, nursing notes, medication admin', true),
    ('a0000001-0000-0000-0000-000000000005', 'pharmacist', 'Pharmacy — dispensing, inventory', true),
    ('a0000001-0000-0000-0000-000000000006', 'lab_tech', 'Lab — sample collection, result entry', true),
    ('a0000001-0000-0000-0000-000000000007', 'receptionist', 'Front desk — registration, appointments, billing', true),
    ('a0000001-0000-0000-0000-000000000008', 'accountant', 'Finance — billing, GL, payments, insurance', true);

-- ════════════════════════════════════
-- ROLE PERMISSIONS (granular RBAC)
-- ════════════════════════════════════

-- Super Admin: all modules, all actions, all scope
INSERT INTO hmis_role_permissions (role_id, module, action, scope)
SELECT 'a0000001-0000-0000-0000-000000000001', m, a, 'all'
FROM unnest(ARRAY['core','patients','opd','ipd','emr','billing','insurance','pharmacy','lab','radiology','ot','bed_mgmt','scheduling','accounting','homecare','ambulance','notifications','ai_cdss','mis','documents','hr']) AS m,
     unnest(ARRAY['create','read','update','delete','approve']) AS a;

-- Doctor: clinical modules
INSERT INTO hmis_role_permissions (role_id, module, action, scope) VALUES
    ('a0000001-0000-0000-0000-000000000003', 'patients', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'patients', 'update', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'opd', 'create', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'opd', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'opd', 'update', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'ipd', 'create', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'ipd', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'ipd', 'update', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'emr', 'create', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'emr', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'emr', 'update', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'billing', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'lab', 'create', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'lab', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'radiology', 'create', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'radiology', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'pharmacy', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'ot', 'create', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'ot', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'ot', 'update', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'scheduling', 'read', 'own'),
    ('a0000001-0000-0000-0000-000000000003', 'ai_cdss', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000003', 'mis', 'read', 'own');

-- Nurse
INSERT INTO hmis_role_permissions (role_id, module, action, scope) VALUES
    ('a0000001-0000-0000-0000-000000000004', 'patients', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000004', 'ipd', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000004', 'ipd', 'update', 'department'),
    ('a0000001-0000-0000-0000-000000000004', 'emr', 'read', 'department'),
    ('a0000001-0000-0000-0000-000000000004', 'emr', 'create', 'department'),
    ('a0000001-0000-0000-0000-000000000004', 'bed_mgmt', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000004', 'bed_mgmt', 'update', 'department');

-- Pharmacist
INSERT INTO hmis_role_permissions (role_id, module, action, scope) VALUES
    ('a0000001-0000-0000-0000-000000000005', 'pharmacy', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000005', 'pharmacy', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000005', 'pharmacy', 'update', 'centre'),
    ('a0000001-0000-0000-0000-000000000005', 'patients', 'read', 'centre');

-- Lab Tech
INSERT INTO hmis_role_permissions (role_id, module, action, scope) VALUES
    ('a0000001-0000-0000-0000-000000000006', 'lab', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000006', 'lab', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000006', 'lab', 'update', 'centre'),
    ('a0000001-0000-0000-0000-000000000006', 'patients', 'read', 'centre');

-- Receptionist
INSERT INTO hmis_role_permissions (role_id, module, action, scope) VALUES
    ('a0000001-0000-0000-0000-000000000007', 'patients', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'patients', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'patients', 'update', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'opd', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'opd', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'opd', 'update', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'ipd', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'ipd', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'billing', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'billing', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'billing', 'update', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'scheduling', 'read', 'centre'),
    ('a0000001-0000-0000-0000-000000000007', 'scheduling', 'create', 'centre');

-- Accountant
INSERT INTO hmis_role_permissions (role_id, module, action, scope) VALUES
    ('a0000001-0000-0000-0000-000000000008', 'billing', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000008', 'billing', 'read', 'all'),
    ('a0000001-0000-0000-0000-000000000008', 'billing', 'update', 'centre'),
    ('a0000001-0000-0000-0000-000000000008', 'billing', 'approve', 'centre'),
    ('a0000001-0000-0000-0000-000000000008', 'insurance', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000008', 'insurance', 'read', 'all'),
    ('a0000001-0000-0000-0000-000000000008', 'insurance', 'update', 'centre'),
    ('a0000001-0000-0000-0000-000000000008', 'accounting', 'create', 'centre'),
    ('a0000001-0000-0000-0000-000000000008', 'accounting', 'read', 'all'),
    ('a0000001-0000-0000-0000-000000000008', 'accounting', 'update', 'centre'),
    ('a0000001-0000-0000-0000-000000000008', 'accounting', 'approve', 'centre'),
    ('a0000001-0000-0000-0000-000000000008', 'mis', 'read', 'all'),
    ('a0000001-0000-0000-0000-000000000008', 'patients', 'read', 'centre');

-- ════════════════════════════════════
-- DEPARTMENTS (per centre — Shilaj gets all, others get subset)
-- ════════════════════════════════════

-- Shilaj departments (flagship — full set)
INSERT INTO hmis_departments (centre_id, name, type) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'Cardiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Neurology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Neurosurgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Orthopaedics', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'General Surgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Internal Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Pulmonology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Nephrology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Urology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Gastroenterology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Oncology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Transplant Surgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Critical Care (ICU)', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Emergency Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Anaesthesiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Radiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Pathology & Lab', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Pharmacy', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Nursing', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Physiotherapy', 'clinical'),
    ('c0000001-0000-0000-0000-000000000001', 'Dietetics', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Administration', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'Finance & Billing', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'IT', 'admin'),
    ('c0000001-0000-0000-0000-000000000001', 'Housekeeping', 'support'),
    ('c0000001-0000-0000-0000-000000000001', 'Insurance & TPA Desk', 'admin');

-- Vastral (subset)
INSERT INTO hmis_departments (centre_id, name, type) VALUES
    ('c0000001-0000-0000-0000-000000000002', 'Cardiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000002', 'Internal Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000002', 'General Surgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000002', 'Orthopaedics', 'clinical'),
    ('c0000001-0000-0000-0000-000000000002', 'Critical Care (ICU)', 'clinical'),
    ('c0000001-0000-0000-0000-000000000002', 'Emergency Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000002', 'Radiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000002', 'Pathology & Lab', 'clinical'),
    ('c0000001-0000-0000-0000-000000000002', 'Pharmacy', 'support'),
    ('c0000001-0000-0000-0000-000000000002', 'Nursing', 'support'),
    ('c0000001-0000-0000-0000-000000000002', 'Administration', 'admin'),
    ('c0000001-0000-0000-0000-000000000002', 'Finance & Billing', 'admin');

-- Modasa
INSERT INTO hmis_departments (centre_id, name, type) VALUES
    ('c0000001-0000-0000-0000-000000000003', 'Internal Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000003', 'General Surgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000003', 'Orthopaedics', 'clinical'),
    ('c0000001-0000-0000-0000-000000000003', 'Critical Care (ICU)', 'clinical'),
    ('c0000001-0000-0000-0000-000000000003', 'Radiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000003', 'Pathology & Lab', 'clinical'),
    ('c0000001-0000-0000-0000-000000000003', 'Pharmacy', 'support'),
    ('c0000001-0000-0000-0000-000000000003', 'Nursing', 'support'),
    ('c0000001-0000-0000-0000-000000000003', 'Administration', 'admin');

-- Gandhinagar
INSERT INTO hmis_departments (centre_id, name, type) VALUES
    ('c0000001-0000-0000-0000-000000000004', 'Cardiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'Neurology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'Internal Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'General Surgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'Orthopaedics', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'Critical Care (ICU)', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'Emergency Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'Radiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'Pathology & Lab', 'clinical'),
    ('c0000001-0000-0000-0000-000000000004', 'Pharmacy', 'support'),
    ('c0000001-0000-0000-0000-000000000004', 'Nursing', 'support'),
    ('c0000001-0000-0000-0000-000000000004', 'Administration', 'admin');

-- Udaipur
INSERT INTO hmis_departments (centre_id, name, type) VALUES
    ('c0000001-0000-0000-0000-000000000005', 'Neurology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000005', 'Orthopaedics', 'clinical'),
    ('c0000001-0000-0000-0000-000000000005', 'Internal Medicine', 'clinical'),
    ('c0000001-0000-0000-0000-000000000005', 'General Surgery', 'clinical'),
    ('c0000001-0000-0000-0000-000000000005', 'Critical Care (ICU)', 'clinical'),
    ('c0000001-0000-0000-0000-000000000005', 'Radiology', 'clinical'),
    ('c0000001-0000-0000-0000-000000000005', 'Pathology & Lab', 'clinical'),
    ('c0000001-0000-0000-0000-000000000005', 'Pharmacy', 'support'),
    ('c0000001-0000-0000-0000-000000000005', 'Nursing', 'support'),
    ('c0000001-0000-0000-0000-000000000005', 'Administration', 'admin');

-- ════════════════════════════════════
-- SEQUENCES (auto-numbering per centre)
-- ════════════════════════════════════

INSERT INTO hmis_sequences (centre_id, type, prefix, current_value, fiscal_year) VALUES
    -- Shilaj
    ('c0000001-0000-0000-0000-000000000001', 'uhid', 'H1S-', 0, NULL),
    ('c0000001-0000-0000-0000-000000000001', 'bill_no', 'SHI-B-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000001', 'opd_no', 'SHI-O-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000001', 'ipd_no', 'SHI-I-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000001', 'receipt_no', 'SHI-R-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000001', 'lab_order', 'SHI-L-', 0, 'FY26'),
    -- Vastral
    ('c0000001-0000-0000-0000-000000000002', 'uhid', 'H1V-', 0, NULL),
    ('c0000001-0000-0000-0000-000000000002', 'bill_no', 'VAS-B-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000002', 'opd_no', 'VAS-O-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000002', 'ipd_no', 'VAS-I-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000002', 'receipt_no', 'VAS-R-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000002', 'lab_order', 'VAS-L-', 0, 'FY26'),
    -- Modasa
    ('c0000001-0000-0000-0000-000000000003', 'uhid', 'H1M-', 0, NULL),
    ('c0000001-0000-0000-0000-000000000003', 'bill_no', 'MOD-B-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000003', 'opd_no', 'MOD-O-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000003', 'ipd_no', 'MOD-I-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000003', 'receipt_no', 'MOD-R-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000003', 'lab_order', 'MOD-L-', 0, 'FY26'),
    -- Gandhinagar
    ('c0000001-0000-0000-0000-000000000004', 'uhid', 'H1G-', 0, NULL),
    ('c0000001-0000-0000-0000-000000000004', 'bill_no', 'GDN-B-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000004', 'opd_no', 'GDN-O-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000004', 'ipd_no', 'GDN-I-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000004', 'receipt_no', 'GDN-R-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000004', 'lab_order', 'GDN-L-', 0, 'FY26'),
    -- Udaipur
    ('c0000001-0000-0000-0000-000000000005', 'uhid', 'H1U-', 0, NULL),
    ('c0000001-0000-0000-0000-000000000005', 'bill_no', 'UDP-B-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000005', 'opd_no', 'UDP-O-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000005', 'ipd_no', 'UDP-I-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000005', 'receipt_no', 'UDP-R-', 0, 'FY26'),
    ('c0000001-0000-0000-0000-000000000005', 'lab_order', 'UDP-L-', 0, 'FY26');

-- ════════════════════════════════════
-- GLOBAL SETTINGS
-- ════════════════════════════════════

INSERT INTO hmis_settings (centre_id, key, value) VALUES
    (NULL, 'billing.gst_rate_default', '"18"'),
    (NULL, 'billing.payment_modes', '["cash","card","upi","neft","cheque"]'),
    (NULL, 'pharmacy.low_stock_threshold', '20'),
    (NULL, 'pharmacy.near_expiry_days', '90'),
    (NULL, 'lab.auto_validate_normal', 'false'),
    (NULL, 'notifications.sms_enabled', 'true'),
    (NULL, 'notifications.whatsapp_enabled', 'true'),
    (NULL, 'ai.discharge_summary_model', '"claude-sonnet-4-20250514"'),
    (NULL, 'ai.cdss_enabled', 'true');

-- Centre-specific settings
INSERT INTO hmis_settings (centre_id, key, value) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'billing.consultation_rate_new', '500'),
    ('c0000001-0000-0000-0000-000000000001', 'billing.consultation_rate_followup', '300'),
    ('c0000001-0000-0000-0000-000000000004', 'billing.revenue_share_pct', '8'),
    ('c0000001-0000-0000-0000-000000000005', 'billing.equity_share_pct', '70');

-- ════════════════════════════════════
-- INITIAL STAFF: Leadership team
-- ════════════════════════════════════

INSERT INTO hmis_staff (id, employee_code, full_name, designation, staff_type, primary_centre_id) VALUES
    ('b0000001-0000-0000-0000-000000000001', 'H1-MD-001', 'Dr. Keyur Patel', 'Managing Director', 'admin', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000002', 'H1-CEO-001', 'Jigar Vasani', 'CEO', 'admin', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000003', 'H1-COO-001', 'Nisha', 'COO', 'admin', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000004', 'H1-CAO-001', 'Nilesh Bhai', 'CAO', 'admin', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000005', 'H1-GCAO-001', 'Tina Bhai', 'Group CAO', 'admin', 'c0000001-0000-0000-0000-000000000001');

-- Leadership gets super_admin across all centres
INSERT INTO hmis_staff_centres (staff_id, centre_id, role_id)
SELECT s.id, c.id, 'a0000001-0000-0000-0000-000000000001'
FROM hmis_staff s CROSS JOIN hmis_centres c
WHERE s.employee_code IN ('H1-MD-001', 'H1-CEO-001', 'H1-COO-001', 'H1-CAO-001', 'H1-GCAO-001');

-- ════════════════════════════════════
-- FISCAL PERIODS (FY26)
-- ════════════════════════════════════

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
    ('FY26-Mar', '2026-03-01', '2026-03-31');

-- ════════════════════════════════════
-- VERIFICATION QUERY
-- ════════════════════════════════════

DO $$
DECLARE
    table_count int;
    centre_count int;
    dept_count int;
    role_count int;
    seq_count int;
BEGIN
    SELECT count(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'hmis_%';
    SELECT count(*) INTO centre_count FROM hmis_centres;
    SELECT count(*) INTO dept_count FROM hmis_departments;
    SELECT count(*) INTO role_count FROM hmis_roles;
    SELECT count(*) INTO seq_count FROM hmis_sequences;

    RAISE NOTICE '══════════════════════════════════════';
    RAISE NOTICE 'Health1 HMIS/ERP Seed Complete';
    RAISE NOTICE 'Tables: %', table_count;
    RAISE NOTICE 'Centres: %', centre_count;
    RAISE NOTICE 'Departments: %', dept_count;
    RAISE NOTICE 'Roles: %', role_count;
    RAISE NOTICE 'Sequences: %', seq_count;
    RAISE NOTICE '══════════════════════════════════════';
END;
$$;
