-- =============================================================================
-- RLS policies for hmis_estimates
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_07_harden_estimates
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_estimates ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_estimates_pol_auth" ON hmis_estimates;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_estimates_auth" ON hmis_estimates;

CREATE POLICY "hmis_estimates_auth" ON hmis_estimates
  FOR ALL TO authenticated
  USING (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()))
  WITH CHECK (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_estimates DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_estimates_auth" ON hmis_estimates;
