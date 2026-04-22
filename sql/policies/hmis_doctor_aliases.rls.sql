-- =============================================================================
-- RLS policies for hmis_doctor_aliases
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_26_harden_doctor_aliases
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_doctor_aliases ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "auth_access" ON hmis_doctor_aliases;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_doctor_aliases_select" ON hmis_doctor_aliases;
DROP POLICY IF EXISTS "hmis_doctor_aliases_write" ON hmis_doctor_aliases;
DROP POLICY IF EXISTS "hmis_doctor_aliases_update" ON hmis_doctor_aliases;
DROP POLICY IF EXISTS "hmis_doctor_aliases_delete" ON hmis_doctor_aliases;

CREATE POLICY "hmis_doctor_aliases_select" ON hmis_doctor_aliases
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "hmis_doctor_aliases_write" ON hmis_doctor_aliases
  FOR INSERT TO authenticated
  WITH CHECK ((hmis_is_super_admin() OR has_role('admin')));

CREATE POLICY "hmis_doctor_aliases_update" ON hmis_doctor_aliases
  FOR UPDATE TO authenticated
  USING ((hmis_is_super_admin() OR has_role('admin')))
  WITH CHECK ((hmis_is_super_admin() OR has_role('admin')));

CREATE POLICY "hmis_doctor_aliases_delete" ON hmis_doctor_aliases
  FOR DELETE TO authenticated
  USING (hmis_is_super_admin());

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_doctor_aliases DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_doctor_aliases_select" ON hmis_doctor_aliases;
-- -- DROP POLICY IF EXISTS "hmis_doctor_aliases_write" ON hmis_doctor_aliases;
-- -- DROP POLICY IF EXISTS "hmis_doctor_aliases_update" ON hmis_doctor_aliases;
-- -- DROP POLICY IF EXISTS "hmis_doctor_aliases_delete" ON hmis_doctor_aliases;
