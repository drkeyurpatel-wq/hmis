-- =============================================================================
-- RLS policies for hmis_ipd_medication_orders
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_14_harden_ipd_medication_orders
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_ipd_medication_orders ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_ipd_medication_orders_pol_auth" ON hmis_ipd_medication_orders;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_ipd_medication_orders_auth" ON hmis_ipd_medication_orders;

CREATE POLICY "hmis_ipd_medication_orders_auth" ON hmis_ipd_medication_orders
  FOR ALL TO authenticated
  USING (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()))
  WITH CHECK (((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin()));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_ipd_medication_orders DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_ipd_medication_orders_auth" ON hmis_ipd_medication_orders;
