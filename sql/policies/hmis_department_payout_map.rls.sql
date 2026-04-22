-- =============================================================================
-- RLS policies for hmis_department_payout_map
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_27_harden_department_payout_map
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_department_payout_map ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "auth_access" ON hmis_department_payout_map;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_department_payout_map_select" ON hmis_department_payout_map;
DROP POLICY IF EXISTS "hmis_department_payout_map_write" ON hmis_department_payout_map;
DROP POLICY IF EXISTS "hmis_department_payout_map_update" ON hmis_department_payout_map;
DROP POLICY IF EXISTS "hmis_department_payout_map_delete" ON hmis_department_payout_map;

CREATE POLICY "hmis_department_payout_map_select" ON hmis_department_payout_map
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "hmis_department_payout_map_write" ON hmis_department_payout_map
  FOR INSERT TO authenticated
  WITH CHECK ((hmis_is_super_admin() OR has_role('accountant')));

CREATE POLICY "hmis_department_payout_map_update" ON hmis_department_payout_map
  FOR UPDATE TO authenticated
  USING ((hmis_is_super_admin() OR has_role('accountant')))
  WITH CHECK ((hmis_is_super_admin() OR has_role('accountant')));

CREATE POLICY "hmis_department_payout_map_delete" ON hmis_department_payout_map
  FOR DELETE TO authenticated
  USING (hmis_is_super_admin());

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_department_payout_map DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_department_payout_map_select" ON hmis_department_payout_map;
-- -- DROP POLICY IF EXISTS "hmis_department_payout_map_write" ON hmis_department_payout_map;
-- -- DROP POLICY IF EXISTS "hmis_department_payout_map_update" ON hmis_department_payout_map;
-- -- DROP POLICY IF EXISTS "hmis_department_payout_map_delete" ON hmis_department_payout_map;
