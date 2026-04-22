-- =============================================================================
-- RLS policies for hmis_doctor_rounds
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_06_harden_doctor_rounds
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_doctor_rounds ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_doctor_rounds_pol_auth" ON hmis_doctor_rounds;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_doctor_rounds_auth" ON hmis_doctor_rounds;

CREATE POLICY "hmis_doctor_rounds_auth" ON hmis_doctor_rounds
  FOR ALL TO authenticated
  USING (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()))
  WITH CHECK (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_doctor_rounds DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_doctor_rounds_auth" ON hmis_doctor_rounds;
