-- ============================================================
-- Health1 HMIS — Master Data Seed
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- Seeds: Lab tests, Radiology tests, Chart of Accounts, OT rooms, 10 test patients
-- ============================================================

DO $$
DECLARE
    shilaj_id uuid;
    admin_id uuid;
BEGIN
    SELECT id INTO shilaj_id FROM hmis_centres WHERE code = 'SHJ' OR name ILIKE '%shilaj%' LIMIT 1;
    SELECT id INTO admin_id FROM hmis_staff WHERE staff_type = 'admin' LIMIT 1;

    IF shilaj_id IS NULL THEN
        RAISE NOTICE 'Shilaj centre not found — run seed_data.sql first';
        RETURN;
    END IF;

    -- ============================================================
    -- LAB TEST MASTER (30 common tests)
    -- ============================================================
    INSERT INTO hmis_lab_test_master (test_code, test_name, category, sample_type, tat_hours, is_panel) VALUES
    ('CBC', 'Complete Blood Count', 'Hematology', 'blood', 2, false),
    ('RFT', 'Renal Function Test', 'Biochemistry', 'blood', 4, true),
    ('LFT', 'Liver Function Test', 'Biochemistry', 'blood', 4, true),
    ('LIPID', 'Lipid Profile', 'Biochemistry', 'blood', 4, true),
    ('HBA1C', 'HbA1c (Glycosylated Hb)', 'Biochemistry', 'blood', 6, false),
    ('FBS', 'Fasting Blood Sugar', 'Biochemistry', 'blood', 1, false),
    ('PPBS', 'Post-Prandial Blood Sugar', 'Biochemistry', 'blood', 1, false),
    ('RBS', 'Random Blood Sugar', 'Biochemistry', 'blood', 1, false),
    ('TSH', 'Thyroid Stimulating Hormone', 'Endocrinology', 'blood', 6, false),
    ('TFT', 'Thyroid Function Test (TSH/FT3/FT4)', 'Endocrinology', 'blood', 6, true),
    ('TROPONIN', 'Troponin I', 'Cardiac', 'blood', 1, false),
    ('CKMB', 'CK-MB', 'Cardiac', 'blood', 2, false),
    ('BNP', 'BNP / NT-proBNP', 'Cardiac', 'blood', 4, false),
    ('CRP', 'C-Reactive Protein', 'Immunology', 'blood', 2, false),
    ('ESR', 'Erythrocyte Sedimentation Rate', 'Hematology', 'blood', 2, false),
    ('COAG', 'Coagulation Profile (PT/INR/aPTT)', 'Hematology', 'blood', 3, true),
    ('ELECTRO', 'Serum Electrolytes (Na/K/Cl)', 'Biochemistry', 'blood', 2, true),
    ('URIC', 'Uric Acid', 'Biochemistry', 'blood', 2, false),
    ('IRON', 'Serum Iron + TIBC + Ferritin', 'Hematology', 'blood', 6, true),
    ('VITD', 'Vitamin D (25-OH)', 'Biochemistry', 'blood', 24, false),
    ('VITB12', 'Vitamin B12', 'Biochemistry', 'blood', 24, false),
    ('PSA', 'Prostate Specific Antigen', 'Oncology', 'blood', 24, false),
    ('WIDAL', 'Widal Test', 'Microbiology', 'blood', 4, false),
    ('MALARIA', 'Malaria Rapid Test + Smear', 'Microbiology', 'blood', 1, false),
    ('DENGUE', 'Dengue NS1 + IgM', 'Microbiology', 'blood', 2, true),
    ('URINE', 'Urine Routine & Microscopy', 'Pathology', 'urine', 2, false),
    ('URINECS', 'Urine Culture & Sensitivity', 'Microbiology', 'urine', 48, false),
    ('STOOL', 'Stool Routine & Microscopy', 'Pathology', 'stool', 2, false),
    ('BLOODCS', 'Blood Culture & Sensitivity', 'Microbiology', 'blood', 72, false),
    ('ABG', 'Arterial Blood Gas', 'Critical Care', 'blood', 0, false)
    ON CONFLICT (test_code) DO NOTHING;

    RAISE NOTICE 'Lab test master: 30 tests seeded';

    -- ============================================================
    -- RADIOLOGY TEST MASTER (15 common modalities)
    -- ============================================================
    INSERT INTO hmis_radiology_test_master (test_code, test_name, modality, body_part, tat_hours, is_contrast) VALUES
    ('XRAY-CHEST', 'X-Ray Chest PA', 'xray', 'chest', 1, false),
    ('XRAY-ABDOMEN', 'X-Ray Abdomen Erect', 'xray', 'abdomen', 1, false),
    ('XRAY-SPINE-LS', 'X-Ray Lumbosacral Spine', 'xray', 'spine', 1, false),
    ('XRAY-KNEE', 'X-Ray Knee (Bilateral Standing)', 'xray', 'knee', 1, false),
    ('USG-ABD', 'USG Abdomen & Pelvis', 'usg', 'abdomen', 2, false),
    ('USG-KUB', 'USG KUB (Kidney/Ureter/Bladder)', 'usg', 'urinary', 2, false),
    ('USG-THYROID', 'USG Thyroid', 'usg', 'neck', 2, false),
    ('ECHO', '2D Echocardiography', 'echo', 'heart', 2, false),
    ('CAROTID-DOPPLER', 'Carotid Doppler', 'doppler', 'neck', 2, false),
    ('CT-BRAIN', 'CT Brain (Plain)', 'ct', 'brain', 2, false),
    ('CT-BRAIN-C', 'CT Brain (Contrast)', 'ct', 'brain', 3, true),
    ('MRI-BRAIN', 'MRI Brain (Plain)', 'mri', 'brain', 4, false),
    ('MRI-BRAIN-C', 'MRI Brain with Contrast + MRA', 'mri', 'brain', 6, true),
    ('MRI-SPINE-LS', 'MRI Lumbosacral Spine', 'mri', 'spine', 4, false),
    ('MAMMOGRAPHY', 'Mammography (Bilateral)', 'mammography', 'breast', 2, false)
    ON CONFLICT (test_code) DO NOTHING;

    RAISE NOTICE 'Radiology test master: 15 tests seeded';

    -- ============================================================
    -- OT ROOMS (6 rooms for Shilaj)
    -- ============================================================
    INSERT INTO hmis_ot_rooms (centre_id, name, type) VALUES
    (shilaj_id, 'OT-1', 'General Surgery'),
    (shilaj_id, 'OT-2', 'General Surgery'),
    (shilaj_id, 'OT-3', 'Orthopedic'),
    (shilaj_id, 'OT-4', 'Cardiac / Cathlab'),
    (shilaj_id, 'OT-5', 'Neuro / Robotic'),
    (shilaj_id, 'OT-6', 'Minor / Day Surgery')
    ON CONFLICT (centre_id, name) DO NOTHING;

    RAISE NOTICE 'OT rooms: 6 rooms seeded for Shilaj';

    -- ============================================================
    -- CHART OF ACCOUNTS (Standard Indian hospital COA)
    -- ============================================================
    INSERT INTO hmis_chart_of_accounts (account_code, account_name, account_type) VALUES
    -- Assets
    ('1000', 'Assets', 'asset'),
    ('1010', 'Cash in Hand', 'asset'),
    ('1020', 'Bank — Current Account', 'asset'),
    ('1030', 'Bank — Savings Account', 'asset'),
    ('1040', 'Fixed Deposits', 'asset'),
    ('1100', 'Accounts Receivable — Patients', 'asset'),
    ('1110', 'Accounts Receivable — Insurance', 'asset'),
    ('1120', 'Accounts Receivable — Corporate', 'asset'),
    ('1130', 'Accounts Receivable — PMJAY', 'asset'),
    ('1140', 'Accounts Receivable — CGHS', 'asset'),
    ('1200', 'Inventory — Pharmacy', 'asset'),
    ('1210', 'Inventory — Consumables', 'asset'),
    ('1220', 'Inventory — Surgical', 'asset'),
    ('1300', 'Fixed Assets — Equipment', 'asset'),
    ('1310', 'Fixed Assets — Building', 'asset'),
    ('1320', 'Fixed Assets — Vehicles', 'asset'),
    ('1330', 'Fixed Assets — Furniture', 'asset'),
    ('1400', 'Advance to Staff', 'asset'),
    ('1410', 'Advance to Vendors', 'asset'),
    ('1420', 'TDS Receivable', 'asset'),
    ('1500', 'Accumulated Depreciation', 'asset'),

    -- Liabilities
    ('2000', 'Liabilities', 'liability'),
    ('2010', 'Accounts Payable — Vendors', 'liability'),
    ('2020', 'Accounts Payable — Doctors', 'liability'),
    ('2030', 'Patient Advances', 'liability'),
    ('2040', 'Security Deposits', 'liability'),
    ('2100', 'Salary Payable', 'liability'),
    ('2110', 'PF Payable', 'liability'),
    ('2120', 'ESI Payable', 'liability'),
    ('2130', 'TDS Payable', 'liability'),
    ('2140', 'GST Payable', 'liability'),
    ('2200', 'Bank Loan — Term', 'liability'),
    ('2210', 'Bank Loan — Working Capital', 'liability'),
    ('2220', 'Equipment Loan', 'liability'),
    ('2300', 'Convertible Debentures', 'liability'),

    -- Equity
    ('3000', 'Equity', 'equity'),
    ('3010', 'Share Capital', 'equity'),
    ('3020', 'Retained Earnings', 'equity'),
    ('3030', 'Current Year P&L', 'equity'),

    -- Revenue
    ('4000', 'Revenue', 'revenue'),
    ('4010', 'OPD Revenue — Consultation', 'revenue'),
    ('4020', 'OPD Revenue — Procedures', 'revenue'),
    ('4030', 'IPD Revenue — Room Charges', 'revenue'),
    ('4040', 'IPD Revenue — Professional Fees', 'revenue'),
    ('4050', 'IPD Revenue — Procedures / Surgery', 'revenue'),
    ('4060', 'Pharmacy Revenue', 'revenue'),
    ('4070', 'Laboratory Revenue', 'revenue'),
    ('4080', 'Radiology Revenue', 'revenue'),
    ('4090', 'Emergency Revenue', 'revenue'),
    ('4100', 'Package Revenue', 'revenue'),
    ('4110', 'Rental Income', 'revenue'),
    ('4120', 'Interest Income', 'revenue'),
    ('4130', 'Miscellaneous Income', 'revenue'),

    -- Expenses
    ('5000', 'Expenses', 'expense'),
    ('5010', 'Staff Salary — Doctors', 'expense'),
    ('5020', 'Staff Salary — Nursing', 'expense'),
    ('5030', 'Staff Salary — Admin', 'expense'),
    ('5040', 'Staff Salary — Support', 'expense'),
    ('5050', 'Professional Fees — Visiting Doctors', 'expense'),
    ('5100', 'Pharmacy — Cost of Medicines', 'expense'),
    ('5110', 'Consumables — Medical', 'expense'),
    ('5120', 'Consumables — Surgical', 'expense'),
    ('5130', 'Lab Reagents & Consumables', 'expense'),
    ('5200', 'Equipment Maintenance', 'expense'),
    ('5210', 'Building Maintenance', 'expense'),
    ('5220', 'Housekeeping', 'expense'),
    ('5230', 'Laundry', 'expense'),
    ('5240', 'Kitchen / Dietary', 'expense'),
    ('5300', 'Electricity', 'expense'),
    ('5310', 'Water', 'expense'),
    ('5320', 'Diesel / Generator', 'expense'),
    ('5330', 'IT / Software / Internet', 'expense'),
    ('5340', 'Telephone', 'expense'),
    ('5400', 'Insurance Premium', 'expense'),
    ('5410', 'Rent', 'expense'),
    ('5420', 'Bank Interest — Term Loan', 'expense'),
    ('5430', 'Bank Interest — Working Capital', 'expense'),
    ('5440', 'Depreciation', 'expense'),
    ('5500', 'Marketing & Advertising', 'expense'),
    ('5510', 'Printing & Stationery', 'expense'),
    ('5520', 'Travel & Conveyance', 'expense'),
    ('5530', 'Legal & Professional Fees', 'expense'),
    ('5540', 'Audit Fees', 'expense'),
    ('5600', 'Biomedical Waste Management', 'expense'),
    ('5610', 'Security Services', 'expense'),
    ('5620', 'Ambulance Operating Cost', 'expense'),
    ('5700', 'Bad Debts / Write-offs', 'expense'),
    ('5800', 'Miscellaneous Expenses', 'expense')
    ON CONFLICT (account_code) DO NOTHING;

    RAISE NOTICE 'Chart of Accounts: 80 accounts seeded';

    -- ============================================================
    -- 10 TEST PATIENTS (realistic Gujarat names)
    -- ============================================================
    INSERT INTO hmis_patients (
        uhid, registration_centre_id, first_name, middle_name, last_name,
        date_of_birth, age_years, gender, blood_group, phone_primary,
        address_line1, city, state, pincode, nationality, is_active
    ) VALUES
    ('H1S-TEST-001', shilaj_id, 'Rajesh', 'Kantilal', 'Patel', '1968-05-15', 57, 'male', 'B+', '9876500001',
     '12 Vastrapur Society', 'Ahmedabad', 'Gujarat', '380015', 'Indian', true),

    ('H1S-TEST-002', shilaj_id, 'Meena', 'Haresh', 'Shah', '1960-11-22', 65, 'female', 'A+', '9876500002',
     '45 Satellite Road', 'Ahmedabad', 'Gujarat', '380015', 'Indian', true),

    ('H1S-TEST-003', shilaj_id, 'Amit', 'Ramesh', 'Thakur', '1978-03-08', 47, 'male', 'O+', '9876500003',
     '78 SG Highway', 'Ahmedabad', 'Gujarat', '380054', 'Indian', true),

    ('H1S-TEST-004', shilaj_id, 'Bhavna', 'Suresh', 'Modi', '1955-07-30', 70, 'female', 'AB+', '9876500004',
     '23 Naranpura', 'Ahmedabad', 'Gujarat', '380013', 'Indian', true),

    ('H1S-TEST-005', shilaj_id, 'Kiran', 'Dinesh', 'Joshi', '1992-01-14', 34, 'male', 'B-', '9876500005',
     '56 Bodakdev', 'Ahmedabad', 'Gujarat', '380054', 'Indian', true),

    ('H1S-TEST-006', shilaj_id, 'Sonal', 'Jayesh', 'Desai', '1985-09-03', 40, 'female', 'A-', '9876500006',
     '89 Paldi', 'Ahmedabad', 'Gujarat', '380007', 'Indian', true),

    ('H1S-TEST-007', shilaj_id, 'Vijay', 'Mahesh', 'Rathod', '1970-12-25', 55, 'male', 'O-', '9876500007',
     '34 Maninagar', 'Ahmedabad', 'Gujarat', '380008', 'Indian', true),

    ('H1S-TEST-008', shilaj_id, 'Geeta', 'Prakash', 'Chauhan', '1958-04-18', 67, 'female', 'B+', '9876500008',
     '67 Chandkheda', 'Ahmedabad', 'Gujarat', '382424', 'Indian', true),

    ('H1S-TEST-009', shilaj_id, 'Nilesh', 'Arvind', 'Parmar', '1982-06-11', 43, 'male', 'A+', '9876500009',
     '12 Shilaj Road', 'Ahmedabad', 'Gujarat', '380058', 'Indian', true),

    ('H1S-TEST-010', shilaj_id, 'Kavita', 'Rajan', 'Trivedi', '1975-02-28', 51, 'female', 'O+', '9876500010',
     '90 Thaltej', 'Ahmedabad', 'Gujarat', '380059', 'Indian', true)

    ON CONFLICT (uhid) DO NOTHING;

    RAISE NOTICE '10 test patients seeded';

    -- Add allergies for some test patients
    INSERT INTO hmis_patient_allergies (patient_id, allergen, severity, recorded_by)
    SELECT p.id, a.allergen, a.severity, admin_id
    FROM (VALUES
        ('H1S-TEST-002', 'Penicillin', 'severe'),
        ('H1S-TEST-004', 'NSAID', 'moderate'),
        ('H1S-TEST-004', 'Sulfonamide', 'mild'),
        ('H1S-TEST-007', 'Aspirin', 'severe'),
        ('H1S-TEST-008', 'ACE Inhibitor', 'moderate')
    ) AS a(uhid, allergen, severity)
    JOIN hmis_patients p ON p.uhid = a.uhid
    WHERE admin_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Patient allergies seeded (5 entries)';

END $$;
