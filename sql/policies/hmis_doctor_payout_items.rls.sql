-- =============================================================================
-- RLS policies for hmis_doctor_payout_items
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_24_harden_doctor_payout_items
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_doctor_payout_items ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "auth_access" ON hmis_doctor_payout_items;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_doctor_payout_items_auth" ON hmis_doctor_payout_items;

CREATE POLICY "hmis_doctor_payout_items_auth" ON hmis_doctor_payout_items
  FOR ALL TO authenticated
  USING ((hmis_is_super_admin() OR ((centre_id = ANY (hmis_get_user_centre_ids())) AND has_role('accountant')) OR (doctor_id = get_my_staff_id())))
  WITH CHECK ((hmis_is_super_admin() OR ((centre_id = ANY (hmis_get_user_centre_ids())) AND has_role('accountant'))));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_doctor_payout_items DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_doctor_payout_items_auth" ON hmis_doctor_payout_items;
