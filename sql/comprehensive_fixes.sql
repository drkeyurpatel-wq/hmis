-- ============================================================
-- Health1 HMIS — Comprehensive Fixes
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Auto-update updated_at trigger (apply to all tables that have the column)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
        -- Only create trigger if table and column exist
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = tbl AND column_name = 'updated_at'
        ) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
            EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- 2. Add appointment_id to OPD visits (for linking)
ALTER TABLE hmis_opd_visits ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES hmis_appointments(id);
CREATE INDEX IF NOT EXISTS idx_opd_appointment ON hmis_opd_visits(appointment_id) WHERE appointment_id IS NOT NULL;

-- 3. Storage bucket for patient documents
-- NOTE: Run this in Supabase Dashboard → Storage → New Bucket
-- Bucket name: documents
-- Public: No (private — accessed via signed URLs)
-- File size limit: 10MB
-- Allowed MIME types: image/*, application/pdf, application/msword,
--   application/vnd.openxmlformats-officedocument.wordprocessingml.document

-- If using SQL (requires service role):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('documents', 'documents', false, 10485760)
-- ON CONFLICT (id) DO NOTHING;

-- 4. Fix: Ensure hmis_ipd_medication_orders has the fields CPOE writes to
ALTER TABLE hmis_ipd_medication_orders ADD COLUMN IF NOT EXISTS ordered_by uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_ipd_medication_orders ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES hmis_patients(id);

-- 5. Bill number uniqueness enforcement
ALTER TABLE hmis_bills DROP CONSTRAINT IF EXISTS hmis_bills_bill_number_key;
ALTER TABLE hmis_bills ADD CONSTRAINT hmis_bills_bill_number_key UNIQUE (bill_number);
