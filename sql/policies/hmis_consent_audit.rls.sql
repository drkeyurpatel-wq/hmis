-- =============================================================================
-- RLS policies for hmis_consent_audit
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_13_harden_consent_audit
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_consent_audit ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "consent_audit_tenant" ON hmis_consent_audit;
DROP POLICY IF EXISTS "consent_aud_ins" ON hmis_consent_audit;
DROP POLICY IF EXISTS "consent_aud_read" ON hmis_consent_audit;
DROP POLICY IF EXISTS "hmis_consent_audit_select" ON hmis_consent_audit;
DROP POLICY IF EXISTS "consent_aud_upd" ON hmis_consent_audit;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_consent_audit_auth" ON hmis_consent_audit;

CREATE POLICY "hmis_consent_audit_auth" ON hmis_consent_audit
  FOR ALL TO authenticated
  USING (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()))
  WITH CHECK (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_consent_audit DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_consent_audit_auth" ON hmis_consent_audit;
