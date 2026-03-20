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
