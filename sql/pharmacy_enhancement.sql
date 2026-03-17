-- ============================================================
-- Health1 HMIS — Pharmacy Module Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Purchase Orders (pharmacy-specific, separate from VPMS POs)
CREATE TABLE IF NOT EXISTS hmis_pharmacy_po (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    po_number varchar(20) NOT NULL,
    supplier varchar(200) NOT NULL,
    supplier_gst varchar(20),
    order_date date NOT NULL DEFAULT CURRENT_DATE,
    expected_date date,
    status varchar(15) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial_received','received','cancelled')),
    items jsonb NOT NULL DEFAULT '[]',
    total_amount decimal(12,2) DEFAULT 0,
    notes text,
    created_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Goods Receipt Note
CREATE TABLE IF NOT EXISTS hmis_pharmacy_grn (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    grn_number varchar(20) NOT NULL,
    po_id uuid REFERENCES hmis_pharmacy_po(id),
    supplier varchar(200) NOT NULL,
    invoice_number varchar(50),
    invoice_date date,
    received_date date NOT NULL DEFAULT CURRENT_DATE,
    items jsonb NOT NULL DEFAULT '[]',
    total_amount decimal(12,2) DEFAULT 0,
    received_by uuid REFERENCES hmis_staff(id),
    verified_by uuid REFERENCES hmis_staff(id),
    status varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','posted','rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Stock Transfer between centres
CREATE TABLE IF NOT EXISTS hmis_pharmacy_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number varchar(20) NOT NULL,
    from_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    to_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    status varchar(15) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','in_transit','received','cancelled')),
    items jsonb NOT NULL DEFAULT '[]',
    initiated_by uuid REFERENCES hmis_staff(id),
    received_by uuid REFERENCES hmis_staff(id),
    initiated_at timestamptz NOT NULL DEFAULT now(),
    received_at timestamptz
);

-- 4. Controlled Substance Register (Schedule H, H1, X)
CREATE TABLE IF NOT EXISTS hmis_pharmacy_controlled_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    batch_id uuid REFERENCES hmis_pharmacy_stock(id),
    transaction_type varchar(15) NOT NULL CHECK (transaction_type IN ('received','dispensed','returned','destroyed','transferred','adjusted')),
    quantity int NOT NULL,
    balance_after int NOT NULL,
    patient_id uuid REFERENCES hmis_patients(id),
    prescription_id uuid REFERENCES hmis_prescriptions(id),
    doctor_name varchar(100),
    doctor_reg_no varchar(30),
    witness_name varchar(100),
    notes text,
    logged_by uuid NOT NULL REFERENCES hmis_staff(id),
    logged_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Drug Returns & Expiry Management
CREATE TABLE IF NOT EXISTS hmis_pharmacy_returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    return_type varchar(15) NOT NULL CHECK (return_type IN ('patient_return','supplier_return','expiry_write_off','damage_write_off','adjustment')),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    batch_id uuid REFERENCES hmis_pharmacy_stock(id),
    batch_number varchar(50),
    quantity int NOT NULL,
    reason text,
    credit_note_number varchar(30),
    credit_amount decimal(10,2) DEFAULT 0,
    patient_id uuid REFERENCES hmis_patients(id),
    supplier varchar(200),
    processed_by uuid NOT NULL REFERENCES hmis_staff(id),
    status varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processed','rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Reorder Level Configuration
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS reorder_level int DEFAULT 20;
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS max_stock_level int DEFAULT 500;
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS preferred_supplier varchar(200);
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS category varchar(30) DEFAULT 'general' CHECK (category IN ('general','emergency','icu','surgical','oncology','cardiac','neuro','ortho','ot','consumable'));
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS rack_location varchar(30);
ALTER TABLE hmis_drug_master ADD COLUMN IF NOT EXISTS bin_number varchar(20);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_pharmacy_po','hmis_pharmacy_grn','hmis_pharmacy_transfers','hmis_pharmacy_controlled_log','hmis_pharmacy_returns'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;
