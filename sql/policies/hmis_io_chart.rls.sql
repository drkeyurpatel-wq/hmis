-- =============================================================================
-- RLS policies for hmis_io_chart
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_17_harden_io_chart
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_io_chart ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_io_chart_pol_auth" ON hmis_io_chart;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_io_chart_auth" ON hmis_io_chart;

CREATE POLICY "hmis_io_chart_auth" ON hmis_io_chart
  FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM hmis_admissions a WHERE ((a.id = hmis_io_chart.admission_id) AND ((a.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM hmis_admissions a WHERE ((a.id = hmis_io_chart.admission_id) AND ((a.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_io_chart DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_io_chart_auth" ON hmis_io_chart;
