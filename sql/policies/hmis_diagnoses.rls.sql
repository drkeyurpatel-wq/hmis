-- =============================================================================
-- RLS policies for hmis_diagnoses
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_12_harden_diagnoses
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_diagnoses ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "dx_read" ON hmis_diagnoses;
DROP POLICY IF EXISTS "dx_upd" ON hmis_diagnoses;
DROP POLICY IF EXISTS "dx_ins" ON hmis_diagnoses;
DROP POLICY IF EXISTS "diagnoses_read" ON hmis_diagnoses;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_diagnoses_auth" ON hmis_diagnoses;

CREATE POLICY "hmis_diagnoses_auth" ON hmis_diagnoses
  FOR ALL TO authenticated
  USING (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin() OR (centre_id IS NULL)))
  WITH CHECK (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin() OR (centre_id IS NULL)));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_diagnoses DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_diagnoses_auth" ON hmis_diagnoses;
