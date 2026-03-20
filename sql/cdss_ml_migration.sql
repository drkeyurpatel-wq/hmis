-- ============================================================
-- Health1 HMIS — CDSS Machine Learning Usage Tracking
-- Tracks doctor behavior to evolve complaint templates
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_cdss_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_name varchar(100) NOT NULL,
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    attributes_used text[] NOT NULL DEFAULT '{}',
    attributes_skipped text[] NOT NULL DEFAULT '{}',
    chip_selections jsonb NOT NULL DEFAULT '{}',
    free_text_entries jsonb NOT NULL DEFAULT '{}',
    time_spent_ms int DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_cdss_doctor ON hmis_cdss_usage(doctor_id, complaint_name);
CREATE INDEX IF NOT EXISTS idx_cdss_centre ON hmis_cdss_usage(centre_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdss_complaint ON hmis_cdss_usage(complaint_name, created_at DESC);

-- RLS
ALTER TABLE hmis_cdss_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_cdss_usage_pol ON hmis_cdss_usage;
CREATE POLICY hmis_cdss_usage_pol ON hmis_cdss_usage FOR ALL USING (auth.uid() IS NOT NULL);
