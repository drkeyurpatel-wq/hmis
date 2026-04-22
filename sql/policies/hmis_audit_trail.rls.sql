-- =============================================================================
-- RLS policies for hmis_audit_trail
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_11_harden_audit_trail
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_audit_trail ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_audit_trail_pol" ON hmis_audit_trail;

-- Current (strong) policies
DROP POLICY IF EXISTS "audit_trail_select" ON hmis_audit_trail;
DROP POLICY IF EXISTS "hmis_audit_trail_insert" ON hmis_audit_trail;
DROP POLICY IF EXISTS "hmis_audit_trail_update" ON hmis_audit_trail;
DROP POLICY IF EXISTS "hmis_audit_trail_delete" ON hmis_audit_trail;

CREATE POLICY "audit_trail_select" ON hmis_audit_trail
  FOR SELECT TO authenticated
  USING (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin() OR (centre_id IS NULL)));

CREATE POLICY "hmis_audit_trail_insert" ON hmis_audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin() OR (centre_id IS NULL)));

CREATE POLICY "hmis_audit_trail_update" ON hmis_audit_trail
  FOR UPDATE TO authenticated
  USING (hmis_is_super_admin())
  WITH CHECK (hmis_is_super_admin());

CREATE POLICY "hmis_audit_trail_delete" ON hmis_audit_trail
  FOR DELETE TO authenticated
  USING (hmis_is_super_admin());

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_audit_trail DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "audit_trail_select" ON hmis_audit_trail;
-- -- DROP POLICY IF EXISTS "hmis_audit_trail_insert" ON hmis_audit_trail;
-- -- DROP POLICY IF EXISTS "hmis_audit_trail_update" ON hmis_audit_trail;
-- -- DROP POLICY IF EXISTS "hmis_audit_trail_delete" ON hmis_audit_trail;
