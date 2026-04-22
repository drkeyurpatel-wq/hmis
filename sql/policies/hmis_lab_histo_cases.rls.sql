-- =============================================================================
-- RLS policies for hmis_lab_histo_cases
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_19_harden_lab_histo_cases
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_lab_histo_cases ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_lab_histo_cases_pol_auth" ON hmis_lab_histo_cases;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_lab_histo_cases_auth" ON hmis_lab_histo_cases;

CREATE POLICY "hmis_lab_histo_cases_auth" ON hmis_lab_histo_cases
  FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM hmis_lab_orders o WHERE ((o.id = hmis_lab_histo_cases.order_id) AND ((o.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM hmis_lab_orders o WHERE ((o.id = hmis_lab_histo_cases.order_id) AND ((o.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_lab_histo_cases DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_lab_histo_cases_auth" ON hmis_lab_histo_cases;
