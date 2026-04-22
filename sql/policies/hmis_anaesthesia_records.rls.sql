-- =============================================================================
-- RLS policies for hmis_anaesthesia_records
-- =============================================================================
-- Applied on production (bmuupgrzbfmddjwcqlss) as migration: phase1_21_harden_anaesthesia_records
-- Mirror of live pg_policies state as of 2026-04-22.
-- This file is the repo source of truth. If policy diverges from production,
-- production wins and this file must be updated.
--
-- Canonical pattern: see sql/policies/README.md
-- =============================================================================

-- RLS must already be enabled (all hmis_* tables had RLS enabled before Phase 1).
ALTER TABLE hmis_anaesthesia_records ENABLE ROW LEVEL SECURITY;

-- Drop legacy weak policies replaced by this file
DROP POLICY IF EXISTS "hmis_anaesthesia_records_authenticated" ON hmis_anaesthesia_records;

-- Current (strong) policies
DROP POLICY IF EXISTS "hmis_anaesthesia_records_auth" ON hmis_anaesthesia_records;

CREATE POLICY "hmis_anaesthesia_records_auth" ON hmis_anaesthesia_records
  FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM hmis_ot_bookings b JOIN hmis_ot_rooms r ON r.id = b.ot_room_id WHERE ((b.id = hmis_anaesthesia_records.ot_booking_id) AND ((r.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM hmis_ot_bookings b JOIN hmis_ot_rooms r ON r.id = b.ot_room_id WHERE ((b.id = hmis_anaesthesia_records.ot_booking_id) AND ((r.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())))));

-- -- Rollback (do not uncomment in migrations; for emergency only):
-- -- ALTER TABLE hmis_anaesthesia_records DISABLE ROW LEVEL SECURITY;
-- -- DROP POLICY IF EXISTS "hmis_anaesthesia_records_auth" ON hmis_anaesthesia_records;
