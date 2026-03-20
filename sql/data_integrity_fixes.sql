-- ============================================================
-- Health1 HMIS — Data Integrity Fixes
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at column
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_patients', 'hmis_admissions', 'hmis_bills', 'hmis_opd_visits',
        'hmis_lab_orders', 'hmis_radiology_orders', 'hmis_medication_orders',
        'hmis_pharmacy_dispensing', 'hmis_encounters', 'hmis_appointments',
        'hmis_incidents', 'hmis_cpoe_orders'
    ] LOOP
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
            EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', tbl);
        EXCEPTION WHEN undefined_table THEN
            -- Skip tables that don't exist yet
        END;
    END LOOP;
END $$;

-- 2. Bill number sequence (replace Math.random)
CREATE SEQUENCE IF NOT EXISTS hmis_bill_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_bill_number(
    p_bill_type varchar DEFAULT 'ipd'
) RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE
    v_prefix varchar;
    v_seq int;
    v_date varchar;
BEGIN
    v_prefix := CASE p_bill_type
        WHEN 'ipd' THEN 'IPD'
        WHEN 'opd' THEN 'OPD'
        WHEN 'pharmacy' THEN 'RX'
        WHEN 'lab' THEN 'LAB'
        ELSE 'BIL'
    END;
    v_date := to_char(CURRENT_DATE, 'YYMMDD');
    v_seq := nextval('hmis_bill_number_seq');
    RETURN v_prefix || '-' || v_date || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- 3. UHID sequence (prevent gaps)
CREATE SEQUENCE IF NOT EXISTS hmis_uhid_seq START 1000;

CREATE OR REPLACE FUNCTION generate_uhid(
    p_centre_code varchar DEFAULT 'H1'
) RETURNS varchar LANGUAGE plpgsql AS $$
BEGIN
    RETURN p_centre_code || '-' || lpad(nextval('hmis_uhid_seq')::text, 6, '0');
END;
$$;

-- 4. Create documents storage bucket if not exists
-- NOTE: Run this in Supabase Dashboard → Storage → New bucket: "documents", public: true
-- SQL cannot create storage buckets directly.
-- Alternatively run via Supabase Management API:
-- POST /storage/v1/bucket { "id": "documents", "name": "documents", "public": true }
