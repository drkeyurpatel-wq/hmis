-- ============================================================
-- Health1 HMIS — Revenue Loop Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- Adds: pharmacy stock, dispensing, tariff seed, token sequence
-- ============================================================

-- Pharmacy stock (batch-level inventory)
CREATE TABLE IF NOT EXISTS hmis_pharmacy_stock (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    batch_number varchar(30) NOT NULL,
    expiry_date date NOT NULL,
    purchase_rate decimal(10,2) NOT NULL,
    mrp decimal(10,2) NOT NULL,
    quantity_received int NOT NULL,
    quantity_available int NOT NULL DEFAULT 0,
    quantity_dispensed int NOT NULL DEFAULT 0,
    supplier varchar(100),
    received_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharm_stock_centre ON hmis_pharmacy_stock(centre_id, drug_id);
CREATE INDEX IF NOT EXISTS idx_pharm_stock_expiry ON hmis_pharmacy_stock(expiry_date);

-- Pharmacy dispensing (Rx fulfillment)
CREATE TABLE IF NOT EXISTS hmis_pharmacy_dispensing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_id uuid REFERENCES hmis_emr_encounters(id),
    prescription_data jsonb NOT NULL DEFAULT '[]',
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','dispensed','partially_dispensed','cancelled','returned')),
    dispensed_items jsonb DEFAULT '[]',
    total_amount decimal(10,2) DEFAULT 0,
    bill_id uuid REFERENCES hmis_bills(id),
    dispensed_by uuid REFERENCES hmis_staff(id),
    dispensed_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pharm_disp_centre ON hmis_pharmacy_dispensing(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_pharm_disp_patient ON hmis_pharmacy_dispensing(patient_id);
CREATE INDEX IF NOT EXISTS idx_pharm_disp_encounter ON hmis_pharmacy_dispensing(encounter_id);

-- RLS
ALTER TABLE hmis_pharmacy_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_pharmacy_dispensing ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharm_stock_centre ON hmis_pharmacy_stock FOR ALL USING (
    centre_id IN (SELECT sc.centre_id FROM hmis_staff_centres sc JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid())
);
CREATE POLICY pharm_disp_centre ON hmis_pharmacy_dispensing FOR ALL USING (
    centre_id IN (SELECT sc.centre_id FROM hmis_staff_centres sc JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid())
);

-- Token sequence helper
CREATE OR REPLACE FUNCTION hmis_next_token(p_centre_id uuid, p_doctor_id uuid)
RETURNS int AS $$
DECLARE
    next_token int;
BEGIN
    SELECT COALESCE(MAX(token_number), 0) + 1 INTO next_token
    FROM hmis_opd_visits
    WHERE centre_id = p_centre_id
    AND doctor_id = p_doctor_id
    AND created_at::date = CURRENT_DATE;
    RETURN next_token;
END;
$$ LANGUAGE plpgsql;

-- Visit number sequence
CREATE OR REPLACE FUNCTION hmis_next_visit_number(p_centre_id uuid)
RETURNS text AS $$
DECLARE
    centre_code text;
    seq_val int;
BEGIN
    SELECT code INTO centre_code FROM hmis_centres WHERE id = p_centre_id;
    SELECT COALESCE(MAX(CAST(SUBSTRING(visit_number FROM '[0-9]+$') AS int)), 0) + 1 INTO seq_val
    FROM hmis_opd_visits WHERE centre_id = p_centre_id AND created_at::date = CURRENT_DATE;
    RETURN 'V-' || COALESCE(centre_code, 'H1') || '-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || LPAD(seq_val::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Bill number sequence
CREATE OR REPLACE FUNCTION hmis_next_bill_number(p_centre_id uuid, p_type text)
RETURNS text AS $$
DECLARE
    centre_code text;
    seq_val int;
    prefix text;
BEGIN
    SELECT code INTO centre_code FROM hmis_centres WHERE id = p_centre_id;
    prefix := CASE p_type WHEN 'opd' THEN 'OPD' WHEN 'pharmacy' THEN 'PH' WHEN 'lab' THEN 'LB' ELSE 'BL' END;
    SELECT COALESCE(MAX(CAST(SUBSTRING(bill_number FROM '[0-9]+$') AS int)), 0) + 1 INTO seq_val
    FROM hmis_bills WHERE centre_id = p_centre_id AND bill_type = p_type AND bill_date = CURRENT_DATE;
    RETURN prefix || '-' || COALESCE(centre_code, 'H1') || '-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || LPAD(seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Receipt number sequence
CREATE OR REPLACE FUNCTION hmis_next_receipt_number(p_centre_id uuid)
RETURNS text AS $$
DECLARE
    centre_code text;
    seq_val int;
BEGIN
    SELECT code INTO centre_code FROM hmis_centres WHERE id = p_centre_id;
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS int)), 0) + 1 INTO seq_val
    FROM hmis_payments WHERE created_at::date = CURRENT_DATE;
    RETURN 'RCP-' || COALESCE(centre_code, 'H1') || '-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || LPAD(seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED: Common OPD tariff items (Shilaj centre)
-- Update centre_id to match your actual Shilaj centre UUID
-- ============================================================
DO $$
DECLARE
    shilaj_id uuid;
BEGIN
    SELECT id INTO shilaj_id FROM hmis_centres WHERE code = 'SHJ' OR name ILIKE '%shilaj%' LIMIT 1;
    IF shilaj_id IS NULL THEN
        RAISE NOTICE 'Shilaj centre not found — skipping tariff seed. Insert centres first.';
        RETURN;
    END IF;

    INSERT INTO hmis_tariff_master (centre_id, service_code, service_name, category, rate_self, rate_insurance, rate_pmjay)
    VALUES
        (shilaj_id, 'OPD-CONSULT', 'OPD Consultation', 'consultation', 500, 500, 300),
        (shilaj_id, 'OPD-CONSULT-SR', 'Senior Consultant Consultation', 'consultation', 800, 800, 300),
        (shilaj_id, 'OPD-FOLLOWUP', 'Follow-up Consultation', 'consultation', 300, 300, 200),
        (shilaj_id, 'OPD-EMERGENCY', 'Emergency Consultation', 'consultation', 1000, 1000, 500),
        (shilaj_id, 'ECG-12LEAD', '12-Lead ECG', 'investigation', 300, 300, 150),
        (shilaj_id, 'XRAY-CHEST', 'X-Ray Chest PA', 'radiology', 500, 500, 250),
        (shilaj_id, 'CBC', 'CBC (Complete Blood Count)', 'laboratory', 350, 350, 150),
        (shilaj_id, 'RFT', 'Renal Function Test', 'laboratory', 600, 600, 300),
        (shilaj_id, 'LFT', 'Liver Function Test', 'laboratory', 600, 600, 300),
        (shilaj_id, 'LIPID', 'Lipid Profile', 'laboratory', 500, 500, 250),
        (shilaj_id, 'HBA1C', 'HbA1c', 'laboratory', 450, 450, 200),
        (shilaj_id, 'THYROID', 'Thyroid Profile (TSH/FT3/FT4)', 'laboratory', 700, 700, 350),
        (shilaj_id, 'USG-ABD', 'USG Abdomen', 'radiology', 1200, 1200, 600),
        (shilaj_id, 'ECHO', '2D Echocardiography', 'investigation', 2000, 2000, 1000),
        (shilaj_id, 'TMT', 'Treadmill Test', 'investigation', 1500, 1500, 750),
        (shilaj_id, 'SPIROMETRY', 'Spirometry / PFT', 'investigation', 800, 800, 400),
        (shilaj_id, 'EEG', 'EEG', 'investigation', 2000, 2000, 1000),
        (shilaj_id, 'MRI-BRAIN', 'MRI Brain (Plain)', 'radiology', 5000, 5000, 2500),
        (shilaj_id, 'CT-BRAIN', 'CT Brain (Plain)', 'radiology', 3000, 3000, 1500),
        (shilaj_id, 'INJ-CHARGE', 'Injection Charges', 'procedure', 200, 200, 100),
        (shilaj_id, 'DRESSING', 'Dressing Charges', 'procedure', 300, 300, 150),
        (shilaj_id, 'NEBULIZE', 'Nebulization', 'procedure', 150, 150, 75)
    ON CONFLICT (centre_id, service_code) DO NOTHING;

    RAISE NOTICE 'Tariff seed complete for Shilaj (% items)', 22;
END $$;
