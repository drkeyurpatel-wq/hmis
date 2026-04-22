-- =============================================================================
-- RLS policies for hmis_imaging_studies
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_09_harden_imaging_studies
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_imaging_studies ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_imaging_studies_pol" ON hmis_imaging_studies;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_imaging_studies_auth" ON hmis_imaging_studies;

CREATE POLICY "hmis_imaging_studies_auth" ON hmis_imaging_studies
  FOR ALL TO authenticated
  USING (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()))
  WITH CHECK (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_imaging_studies DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_imaging_studies_auth" ON hmis_imaging_studies;
