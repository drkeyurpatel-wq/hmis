-- =============================================================================
-- RLS policies for hmis_discount_log
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_22_harden_discount_log
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_discount_log ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_discount_log_pol_auth" ON hmis_discount_log;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_discount_log_auth" ON hmis_discount_log;

CREATE POLICY "hmis_discount_log_auth" ON hmis_discount_log
  FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM hmis_bills b WHERE ((b.id = hmis_discount_log.bill_id) AND ((b.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM hmis_bills b WHERE ((b.id = hmis_discount_log.bill_id) AND ((b.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_discount_log DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_discount_log_auth" ON hmis_discount_log;
