-- ============================================================
-- Health1 HMIS — Charge Capture Engine
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Real-time charge capture log
-- Every charge from ANY source lands here FIRST, then gets posted to bill_items
CREATE TABLE IF NOT EXISTS hmis_charge_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    bill_id uuid REFERENCES hmis_bills(id),

    -- What was charged
    tariff_id uuid REFERENCES hmis_tariff_master(id),
    charge_code varchar(30),
    description varchar(200) NOT NULL,
    category varchar(30) NOT NULL,
    quantity decimal(8,2) NOT NULL DEFAULT 1,
    unit_rate decimal(10,2) NOT NULL,
    amount decimal(12,2) NOT NULL,
    department_id uuid REFERENCES hmis_departments(id),
    doctor_id uuid REFERENCES hmis_staff(id),

    -- Source tracking
    source varchar(30) NOT NULL CHECK (source IN (
        'auto_daily',        -- bed rent, nursing, MO visit (auto-engine)
        'auto_admission',    -- one-time admission charges
        'auto_discharge',    -- discharge charges
        'pharmacy',          -- pharmacy dispense
        'lab',               -- lab order
        'radiology',         -- radiology order
        'procedure',         -- OT / bedside procedure
        'consumable',        -- consumable used
        'manual',            -- manually posted by staff
        'barcode_scan'       -- posted via barcode scan
    )),
    source_ref_id uuid,      -- FK to source record (drug dispense ID, lab order ID, etc.)
    source_ref_type varchar(30), -- 'pharmacy_dispense', 'lab_order', 'ot_booking', etc.

    -- Status
    status varchar(15) NOT NULL DEFAULT 'captured' CHECK (status IN ('captured','posted','reversed','disputed')),
    posted_to_bill_at timestamptz,
    reversed_at timestamptz,
    reversed_by uuid REFERENCES hmis_staff(id),
    reversal_reason text,

    -- Metadata
    captured_by uuid REFERENCES hmis_staff(id),
    service_date date NOT NULL DEFAULT CURRENT_DATE,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charge_log_admission ON hmis_charge_log(admission_id, status);
CREATE INDEX IF NOT EXISTS idx_charge_log_patient ON hmis_charge_log(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charge_log_bill ON hmis_charge_log(bill_id) WHERE bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_charge_log_source ON hmis_charge_log(source, source_ref_id);

-- 2. Auto-charge run log (tracks when daily charges were last run)
CREATE TABLE IF NOT EXISTS hmis_auto_charge_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    run_date date NOT NULL,
    charges_posted int NOT NULL DEFAULT 0,
    total_amount decimal(12,2) NOT NULL DEFAULT 0,
    run_by uuid REFERENCES hmis_staff(id),
    run_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, run_date)
);

-- 3. Barcode / wristband config
CREATE TABLE IF NOT EXISTS hmis_barcode_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id) UNIQUE,
    barcode_format varchar(20) NOT NULL DEFAULT 'uhid',  -- 'uhid', 'ipd_number', 'custom'
    prefix varchar(10),
    suffix varchar(10),
    include_name boolean DEFAULT false,
    include_dob boolean DEFAULT false,
    wristband_printer varchar(50),
    is_active boolean DEFAULT true
);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_charge_log','hmis_auto_charge_runs','hmis_barcode_config'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Auto-charge rules for Health1 (per ward type)
-- ============================================================

-- Clear old rules first (idempotent)
DELETE FROM hmis_billing_auto_rules WHERE rule_name LIKE 'Auto:%';

-- Daily charges (trigger_type = 'daily')
INSERT INTO hmis_billing_auto_rules (centre_id, rule_name, trigger_type, ward_type, charge_description, charge_amount, is_active)
SELECT c.id, r.rule_name, r.trigger_type, r.ward_type, r.description, r.amount, true
FROM hmis_centres c, (VALUES
    -- Bed charges per ward type
    ('Auto: Bed - General Ward',      'daily', 'general',        'Bed Charges — General Ward',        1500),
    ('Auto: Bed - Semi Private',      'daily', 'semi_private',   'Bed Charges — Semi Private Room',   3000),
    ('Auto: Bed - Private',           'daily', 'private',        'Bed Charges — Private Room',        5000),
    ('Auto: Bed - ICU',               'daily', 'icu',            'Bed Charges — ICU',                 12000),
    ('Auto: Bed - Transplant ICU',    'daily', 'transplant_icu', 'Bed Charges — Transplant ICU',      18000),
    ('Auto: Bed - NICU',              'daily', 'nicu',           'Bed Charges — NICU',                10000),
    ('Auto: Bed - PICU',              'daily', 'picu',           'Bed Charges — PICU',                10000),
    ('Auto: Bed - Isolation',         'daily', 'isolation',      'Bed Charges — Isolation Room',      5000),

    -- Nursing charges per ward type
    ('Auto: Nursing - General',       'daily', 'general',        'Nursing Charges — General',         500),
    ('Auto: Nursing - Semi Private',  'daily', 'semi_private',   'Nursing Charges — Semi Private',    500),
    ('Auto: Nursing - Private',       'daily', 'private',        'Nursing Charges — Private',         800),
    ('Auto: Nursing - ICU',           'daily', 'icu',            'Nursing Charges — ICU',             1500),
    ('Auto: Nursing - Transplant ICU','daily', 'transplant_icu', 'Nursing Charges — Transplant ICU',  2000),
    ('Auto: Nursing - NICU',          'daily', 'nicu',           'Nursing Charges — NICU',            1500),

    -- Medical Officer visit (daily for all IPD)
    ('Auto: MO Visit - General',      'daily', 'general',        'Medical Officer Visit',             300),
    ('Auto: MO Visit - ICU',          'daily', 'icu',            'Medical Officer Visit — ICU',       500),
    ('Auto: MO Visit - Transplant',   'daily', 'transplant_icu', 'Medical Officer Visit — TICU',      800),

    -- Diet charges
    ('Auto: Diet - General',          'daily', 'general',        'Diet Charges',                      500),
    ('Auto: Diet - Private',          'daily', 'private',        'Diet Charges',                      500),
    ('Auto: Diet - ICU',              'daily', 'icu',            'Diet Charges — ICU',                500),

    -- ICU-specific daily charges
    ('Auto: ICU Monitoring',          'daily', 'icu',            'ICU Monitoring Charges',            3000),
    ('Auto: TICU Monitoring',         'daily', 'transplant_icu', 'Transplant ICU Monitoring',         5000),

    -- One-time admission charges
    ('Auto: Registration Fee',        'admission', NULL,         'Registration / Admission Fee',      500),
    ('Auto: Admission Kit',           'admission', NULL,         'Admission Kit (linen, toiletries)', 300)
) AS r(rule_name, trigger_type, ward_type, description, amount)
WHERE c.is_active = true
ON CONFLICT DO NOTHING;

-- ============================================================
-- RPC: Run daily auto-charges for a centre
-- ============================================================
CREATE OR REPLACE FUNCTION run_daily_auto_charges(
    p_centre_id uuid,
    p_date date DEFAULT CURRENT_DATE,
    p_staff_id uuid DEFAULT NULL
)
RETURNS TABLE(charges_posted int, total_amount numeric) LANGUAGE plpgsql AS $$
DECLARE
    v_count int := 0;
    v_total numeric := 0;
    r RECORD;
BEGIN
    -- Skip if already run today for this centre
    IF EXISTS (SELECT 1 FROM hmis_auto_charge_runs WHERE centre_id = p_centre_id AND run_date = p_date) THEN
        RETURN QUERY SELECT 0, 0::numeric;
        RETURN;
    END IF;

    -- For each active admission with a bed
    FOR r IN
        SELECT a.id AS admission_id, a.patient_id, a.payor_type,
               b.id AS bed_id, w.type AS ward_type,
               COALESCE(a.bed_id, b.id) AS _bed
        FROM hmis_admissions a
        JOIN hmis_beds b ON b.id = a.bed_id
        JOIN hmis_rooms rm ON rm.id = b.room_id
        JOIN hmis_wards w ON w.id = rm.ward_id
        WHERE a.centre_id = p_centre_id
          AND a.status = 'active'
          AND a.bed_id IS NOT NULL
    LOOP
        -- Find matching daily rules for this ward type
        INSERT INTO hmis_charge_log (
            centre_id, patient_id, admission_id, charge_code, description, category,
            quantity, unit_rate, amount, source, captured_by, service_date, status
        )
        SELECT
            p_centre_id, r.patient_id, r.admission_id,
            'AUTO-' || ar.id::text, ar.charge_description, 'auto_daily',
            1, ar.charge_amount, ar.charge_amount,
            'auto_daily', p_staff_id, p_date, 'captured'
        FROM hmis_billing_auto_rules ar
        WHERE ar.centre_id = p_centre_id
          AND ar.is_active = true
          AND ar.trigger_type = 'daily'
          AND (ar.ward_type = r.ward_type OR ar.ward_type IS NULL);

    END LOOP;

    -- Calculate total
    SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_count, v_total
    FROM hmis_charge_log
    WHERE centre_id = p_centre_id AND service_date = p_date AND source = 'auto_daily';

    -- Log the run
    INSERT INTO hmis_auto_charge_runs (centre_id, run_date, charges_posted, total_amount, run_by)
    VALUES (p_centre_id, p_date, v_count, v_total, p_staff_id);

    RETURN QUERY SELECT v_count, v_total;
END;
$$;
