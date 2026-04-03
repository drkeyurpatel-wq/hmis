-- integration_log_migration.sql
-- Creates the hmis_integration_log table for monitoring all cross-system syncs.
-- Also adds synced_to_vpms column on hmis_pharmacy_dispensing if missing.
--
-- Run this ONCE against HMIS Supabase (bmuupgrzbfmddjwcqlss).
-- DO NOT run in bulk with other migrations — test against a real session first.

-- ============================================================
-- 1. Integration Log Table
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_integration_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration TEXT NOT NULL CHECK (integration IN ('revenue', 'medpay', 'vpms', 'patient_app')),
  direction TEXT DEFAULT 'push' CHECK (direction IN ('push', 'pull')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_sent INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_message TEXT,
  payload_summary JSONB,
  duration_ms INT,
  triggered_by TEXT CHECK (triggered_by IN ('cron', 'manual', 'webhook')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_log_lookup
  ON hmis_integration_log(integration, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_log_status
  ON hmis_integration_log(status, created_at DESC);

COMMENT ON TABLE hmis_integration_log IS 'Audit log for all cross-system integration syncs (Revenue, MedPay, VPMS)';

-- ============================================================
-- 2. Pharmacy dispensing — add VPMS sync tracking columns
-- ============================================================
ALTER TABLE hmis_pharmacy_dispensing
  ADD COLUMN IF NOT EXISTS synced_to_vpms BOOLEAN DEFAULT false;

ALTER TABLE hmis_pharmacy_dispensing
  ADD COLUMN IF NOT EXISTS vpms_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_vpms_unsync
  ON hmis_pharmacy_dispensing(synced_to_vpms) WHERE synced_to_vpms = false;

-- ============================================================
-- 3. RLS — integration log readable by admin, writable by service role
-- ============================================================
ALTER TABLE hmis_integration_log ENABLE ROW LEVEL SECURITY;

-- Service role (API routes) can insert
CREATE POLICY IF NOT EXISTS integration_log_insert_service
  ON hmis_integration_log FOR INSERT
  WITH CHECK (true);

-- Admin users can read
CREATE POLICY IF NOT EXISTS integration_log_select_admin
  ON hmis_integration_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hmis_staff
      WHERE hmis_staff.auth_user_id = auth.uid()
      AND hmis_staff.staff_type = 'admin'
      AND hmis_staff.is_active = true
    )
  );
