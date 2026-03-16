-- ============================================================
-- Health1 HMIS — Billing Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Estimates / Proforma
CREATE TABLE IF NOT EXISTS hmis_estimates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    estimate_number varchar(20) NOT NULL UNIQUE,
    estimate_type varchar(15) NOT NULL CHECK (estimate_type IN ('opd','ipd','surgery','package','daycare')),
    department_id uuid REFERENCES hmis_departments(id),
    doctor_id uuid REFERENCES hmis_staff(id),
    procedure_name text,
    payor_type varchar(20) NOT NULL DEFAULT 'self',
    items jsonb NOT NULL DEFAULT '[]',
    total_estimated decimal(12,2) NOT NULL DEFAULT 0,
    room_category varchar(20),
    expected_los_days int,
    notes text,
    valid_until date,
    status varchar(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','expired','cancelled')),
    converted_to_bill_id uuid REFERENCES hmis_bills(id),
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS hmis_estimate_seq START 1;

-- 2. Credit Notes
CREATE TABLE IF NOT EXISTS hmis_credit_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    credit_note_number varchar(20) NOT NULL UNIQUE,
    amount decimal(12,2) NOT NULL,
    reason text NOT NULL,
    items jsonb DEFAULT '[]',
    status varchar(10) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','adjusted','cancelled')),
    approved_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. IPD Running Bill Auto-Charge Rules
CREATE TABLE IF NOT EXISTS hmis_billing_auto_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    rule_name varchar(100) NOT NULL,
    trigger_type varchar(20) NOT NULL CHECK (trigger_type IN ('daily','admission','discharge','procedure','investigation','pharmacy')),
    ward_type varchar(20),
    tariff_id uuid REFERENCES hmis_tariff_master(id),
    charge_description varchar(200) NOT NULL,
    charge_amount decimal(10,2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Discount Authorization Log
CREATE TABLE IF NOT EXISTS hmis_discount_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    discount_type varchar(15) NOT NULL CHECK (discount_type IN ('percentage','flat','item_level','staff','management','insurance_write_off')),
    discount_amount decimal(12,2) NOT NULL,
    discount_percentage decimal(5,2),
    reason text NOT NULL,
    authorized_by uuid NOT NULL REFERENCES hmis_staff(id),
    authorization_level varchar(15) CHECK (authorization_level IN ('billing_staff','supervisor','manager','md')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_estimates','hmis_credit_notes','hmis_billing_auto_rules','hmis_discount_log'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Standard tariff items for a quaternary hospital
-- ============================================================
INSERT INTO hmis_tariff_master (centre_id, service_code, service_name, category, rate_self, rate_insurance, rate_pmjay, rate_cghs) 
SELECT c.id, t.code, t.name, t.cat, t.self_rate, t.ins_rate, t.pmjay, t.cghs
FROM hmis_centres c, (VALUES
  -- Consultation
  ('CONS-GEN', 'Consultation — General Medicine', 'consultation', 500, 500, 300, 400),
  ('CONS-SPEC', 'Consultation — Specialist', 'consultation', 800, 800, 400, 500),
  ('CONS-SUPER', 'Consultation — Super Specialist', 'consultation', 1200, 1200, 500, 700),
  ('CONS-FOLLOW', 'Follow-up Consultation', 'consultation', 300, 300, 200, 250),
  ('CONS-ER', 'Emergency Consultation', 'consultation', 1500, 1500, 500, 800),
  -- Room Rent
  ('ROOM-GEN', 'General Ward (per day)', 'room_rent', 1500, 2000, 1000, 1200),
  ('ROOM-SEMI', 'Semi-Private Room (per day)', 'room_rent', 3000, 3500, 1500, 2000),
  ('ROOM-PVT', 'Private Room (per day)', 'room_rent', 5000, 6000, 2000, 3000),
  ('ROOM-DELUX', 'Deluxe Room (per day)', 'room_rent', 8000, 9000, 2500, 4000),
  ('ROOM-ICU', 'ICU (per day)', 'room_rent', 12000, 15000, 5000, 8000),
  ('ROOM-TICU', 'Transplant ICU (per day)', 'room_rent', 18000, 20000, 8000, 12000),
  ('ROOM-NICU', 'NICU (per day)', 'room_rent', 10000, 12000, 5000, 7000),
  -- OT Charges
  ('OT-MINOR', 'OT Charges — Minor', 'ot_charges', 5000, 6000, 3000, 4000),
  ('OT-INTER', 'OT Charges — Intermediate', 'ot_charges', 10000, 12000, 6000, 8000),
  ('OT-MAJOR', 'OT Charges — Major', 'ot_charges', 20000, 25000, 10000, 15000),
  ('OT-SUPER', 'OT Charges — Super Major', 'ot_charges', 35000, 40000, 15000, 25000),
  ('OT-ROBOT', 'OT Charges — Robotic Surgery', 'ot_charges', 50000, 60000, 20000, 35000),
  -- Professional Fees
  ('PROF-SURG', 'Surgeon Professional Fee', 'professional_fee', 15000, 18000, 8000, 12000),
  ('PROF-ANAES', 'Anaesthetist Fee', 'professional_fee', 8000, 10000, 4000, 6000),
  ('PROF-ASSIST', 'Assistant Surgeon Fee', 'professional_fee', 5000, 6000, 2000, 3000),
  -- ICU Charges
  ('ICU-VENT', 'Ventilator Charges (per day)', 'icu_charges', 5000, 6000, 3000, 4000),
  ('ICU-MONITOR', 'ICU Monitoring (per day)', 'icu_charges', 3000, 3500, 2000, 2500),
  ('ICU-BIPAP', 'BiPAP/NIV (per day)', 'icu_charges', 2000, 2500, 1500, 1800),
  ('ICU-DIALYSIS', 'Dialysis (per session)', 'icu_charges', 8000, 10000, 5000, 7000),
  -- Nursing
  ('NURS-GEN', 'Nursing Charges — General (per day)', 'nursing', 500, 600, 300, 400),
  ('NURS-ICU', 'Nursing Charges — ICU (per day)', 'nursing', 1500, 1800, 800, 1200),
  ('NURS-SPECIAL', 'Special Nursing (per shift)', 'nursing', 2000, 2500, 1000, 1500),
  -- Procedures (common)
  ('PROC-CATH', 'Coronary Angiography', 'procedure', 25000, 30000, 15000, 20000),
  ('PROC-PTCA', 'PTCA with Stent (single)', 'procedure', 80000, 95000, 50000, 65000),
  ('PROC-PTCA2', 'PTCA with Stent (double)', 'procedure', 140000, 160000, 80000, 110000),
  ('PROC-CABG', 'CABG (single bypass)', 'procedure', 200000, 250000, 120000, 170000),
  ('PROC-TKR', 'Total Knee Replacement (unilateral)', 'procedure', 180000, 220000, 100000, 150000),
  ('PROC-THR', 'Total Hip Replacement', 'procedure', 200000, 250000, 120000, 170000),
  ('PROC-LAPCHOLE', 'Laparoscopic Cholecystectomy', 'procedure', 45000, 55000, 25000, 35000),
  ('PROC-APPY', 'Appendectomy (Laparoscopic)', 'procedure', 35000, 40000, 20000, 28000),
  ('PROC-HERNIA', 'Hernia Repair (Laparoscopic)', 'procedure', 40000, 50000, 22000, 30000),
  ('PROC-SPINE', 'Spine Surgery (Discectomy)', 'procedure', 150000, 180000, 80000, 120000),
  ('PROC-CRANIOTO', 'Craniotomy', 'procedure', 180000, 220000, 100000, 150000),
  -- Consumables
  ('CON-STENT-DES', 'Drug Eluting Stent', 'consumable', 35000, 40000, 25000, 30000),
  ('CON-IMPLANT-TKR', 'TKR Implant (Cuvis)', 'consumable', 65000, 75000, 40000, 55000),
  ('CON-PACEMAKER', 'Pacemaker (Single Chamber)', 'consumable', 50000, 60000, 35000, 45000),
  ('CON-MESH', 'Hernia Mesh', 'consumable', 8000, 10000, 5000, 7000),
  -- Miscellaneous
  ('MISC-AMBULANCE', 'Ambulance Service', 'miscellaneous', 2000, 2000, 1500, 1500),
  ('MISC-DIET', 'Diet Charges (per day)', 'miscellaneous', 500, 500, 300, 400),
  ('MISC-LAUNDRY', 'Extra Linen/Laundry', 'miscellaneous', 200, 200, 100, 150),
  ('MISC-ATTENDANT', 'Attendant Bed (per day)', 'miscellaneous', 300, 300, 200, 250),
  ('MISC-OXYGEN', 'Oxygen (per hour)', 'miscellaneous', 100, 100, 80, 90),
  ('MISC-NEBULIZE', 'Nebulization (per session)', 'miscellaneous', 150, 150, 100, 120),
  ('MISC-DRESSING', 'Dressing (per session)', 'miscellaneous', 300, 300, 200, 250),
  ('MISC-CATHETER', 'Catheterization (Foley)', 'miscellaneous', 500, 500, 300, 400),
  ('MISC-BLOOD', 'Blood Transfusion (per unit)', 'miscellaneous', 1500, 1500, 1000, 1200)
) AS t(code, name, cat, self_rate, ins_rate, pmjay, cghs)
WHERE c.code = 'SHJ' OR c.name ILIKE '%shilaj%'
ON CONFLICT (centre_id, service_code) DO NOTHING;
