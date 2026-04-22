-- =============================================================================
-- RLS policies for hmis_icu_charts
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_15_harden_icu_charts
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_icu_charts ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_icu_charts_pol_auth" ON hmis_icu_charts;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_icu_charts_auth" ON hmis_icu_charts;

CREATE POLICY "hmis_icu_charts_auth" ON hmis_icu_charts
  FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM hmis_admissions a WHERE ((a.id = hmis_icu_charts.admission_id) AND ((a.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM hmis_admissions a WHERE ((a.id = hmis_icu_charts.admission_id) AND ((a.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_icu_charts DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_icu_charts_auth" ON hmis_icu_charts;
