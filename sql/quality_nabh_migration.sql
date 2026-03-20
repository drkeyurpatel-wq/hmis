-- ============================================================
-- Health1 HMIS — Quality/NABH + Audit Trail
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Incident Reporting
CREATE TABLE IF NOT EXISTS hmis_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    incident_number varchar(20) NOT NULL UNIQUE,
    category varchar(30) NOT NULL CHECK (category IN (
        'medication_error','fall','infection','surgical','transfusion',
        'equipment','documentation','communication','delay','abuse',
        'needle_stick','fire_safety','other'
    )),
    severity varchar(15) NOT NULL CHECK (severity IN ('near_miss','minor','moderate','serious','sentinel')),
    description text NOT NULL,
    location varchar(50),
    patient_id uuid REFERENCES hmis_patients(id),
    involved_staff text,
    immediate_action text,
    root_cause text,
    corrective_action text,
    preventive_action text,
    status varchar(15) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','investigating','action_taken','closed','reopened')),
    reported_by uuid NOT NULL REFERENCES hmis_staff(id),
    assigned_to uuid REFERENCES hmis_staff(id),
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_centre ON hmis_incidents(centre_id, status);

-- 2. Quality Indicators (NABH KPIs)
CREATE TABLE IF NOT EXISTS hmis_quality_indicators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    indicator_code varchar(10) NOT NULL,
    indicator_name varchar(100) NOT NULL,
    period varchar(10) NOT NULL, -- '2026-03' format
    value decimal(10,2) NOT NULL,
    numerator int,
    denominator int,
    target decimal(10,2),
    met_target boolean,
    submitted_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, indicator_code, period)
);

CREATE INDEX IF NOT EXISTS idx_qi_centre ON hmis_quality_indicators(centre_id, period);

-- 3. Audit Trail
CREATE TABLE IF NOT EXISTS hmis_audit_trail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    user_id uuid NOT NULL REFERENCES hmis_staff(id),
    action varchar(20) NOT NULL CHECK (action IN ('create','update','delete','view','print','sign','cancel','approve','reject')),
    entity_type varchar(30) NOT NULL,
    entity_id uuid,
    entity_label varchar(200),
    changes jsonb,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_centre ON hmis_audit_trail(centre_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON hmis_audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON hmis_audit_trail(user_id, created_at DESC);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_incidents','hmis_quality_indicators','hmis_audit_trail'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;
