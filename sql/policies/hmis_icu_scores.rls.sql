-- =============================================================================
-- RLS policies for hmis_icu_scores
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_16_harden_icu_scores
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_icu_scores ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_icu_scores_pol_auth" ON hmis_icu_scores;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_icu_scores_auth" ON hmis_icu_scores;

CREATE POLICY "hmis_icu_scores_auth" ON hmis_icu_scores
  FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM hmis_admissions a WHERE ((a.id = hmis_icu_scores.admission_id) AND ((a.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM hmis_admissions a WHERE ((a.id = hmis_icu_scores.admission_id) AND ((a.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_icu_scores DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_icu_scores_auth" ON hmis_icu_scores;
