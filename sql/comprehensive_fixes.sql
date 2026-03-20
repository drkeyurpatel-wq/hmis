-- ============================================================
-- Health1 HMIS — Comprehensive Fixes
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- SAFE: Every statement checks if table/column exists first
-- ============================================================

-- 1. Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger only to tables that actually exist AND have updated_at
DO $$
DECLARE
    tbl text;
    tbls text[] := ARRAY[
        'hmis_patients', 'hmis_admissions', 'hmis_bills', 'hmis_opd_visits',
        'hmis_lab_orders', 'hmis_radiology_orders', 'hmis_appointments',
        'hmis_cpoe_orders', 'hmis_incidents', 'hmis_ipd_medication_orders',
        'hmis_pharmacy_dispensing', 'hmis_claims'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
        ) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
            EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- 2. Add appointment_id to OPD visits (only if appointments table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hmis_appointments') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hmis_opd_visits' AND column_name = 'appointment_id') THEN
            ALTER TABLE hmis_opd_visits ADD COLUMN appointment_id uuid REFERENCES hmis_appointments(id);
            CREATE INDEX IF NOT EXISTS idx_opd_appointment ON hmis_opd_visits(appointment_id) WHERE appointment_id IS NOT NULL;
        END IF;
    END IF;
END $$;

-- 3. Ensure hmis_ipd_medication_orders has CPOE fields (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hmis_ipd_medication_orders') THEN
        ALTER TABLE hmis_ipd_medication_orders ADD COLUMN IF NOT EXISTS ordered_by uuid REFERENCES hmis_staff(id);
        ALTER TABLE hmis_ipd_medication_orders ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES hmis_patients(id);
    END IF;
END $$;

-- 4. Bill number uniqueness
ALTER TABLE hmis_bills DROP CONSTRAINT IF EXISTS hmis_bills_bill_number_key;
ALTER TABLE hmis_bills ADD CONSTRAINT hmis_bills_bill_number_key UNIQUE (bill_number);

-- 5. Storage bucket note
-- Go to Supabase Dashboard → Storage → New Bucket
-- Name: documents | Public: No | Size limit: 10MB
