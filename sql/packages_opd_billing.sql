-- ============================================================
-- Health1 HMIS — Package Builder + OPD Billing Support
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Packages table (for PackageBuilder component)
CREATE TABLE IF NOT EXISTS hmis_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(200) NOT NULL,
    description text,
    room_category varchar(20) DEFAULT 'economy',
    expected_los int DEFAULT 3,
    items jsonb NOT NULL DEFAULT '[]',
    gross_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_percentage decimal(5,2) DEFAULT 0,
    net_amount decimal(12,2) NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_centre ON hmis_packages(centre_id, is_active);

ALTER TABLE hmis_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_packages_pol ON hmis_packages;
CREATE POLICY hmis_packages_pol ON hmis_packages FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. Add visit_type to OPD visits if missing (for follow-up vs new)
ALTER TABLE hmis_opd_visits ADD COLUMN IF NOT EXISTS visit_type varchar(15) DEFAULT 'new';
ALTER TABLE hmis_opd_visits ADD COLUMN IF NOT EXISTS visit_reason text;
