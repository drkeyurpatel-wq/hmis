-- ============================================================
-- Day 1 Go-Live: RLS Policies for Critical Tables
-- Run INCREMENTALLY — test each section against a real user session
-- Date: 2026-03-29
-- ============================================================
-- RULE: Never apply in bulk. Run one section, verify with a real login,
-- then proceed to the next.
-- ============================================================

-- ════════════════════════════════════
-- 1. PATIENTS (PHI — highest priority)
-- ════════════════════════════════════
ALTER TABLE hmis_patients ENABLE ROW LEVEL SECURITY;

-- All authenticated staff can read all patients (cross-centre referrals are common)
DROP POLICY IF EXISTS "patients_select" ON hmis_patients;
CREATE POLICY patients_select ON hmis_patients
    FOR SELECT TO authenticated
    USING (true);

-- Insert: any authenticated staff
DROP POLICY IF EXISTS "patients_insert" ON hmis_patients;
CREATE POLICY patients_insert ON hmis_patients
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Update: staff at the registration centre OR super_admin
DROP POLICY IF EXISTS "patients_update" ON hmis_patients;
CREATE POLICY patients_update ON hmis_patients
    FOR UPDATE TO authenticated
    USING (
        registration_centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- Delete: super_admin only (soft-delete preferred)
DROP POLICY IF EXISTS "patients_delete" ON hmis_patients;
CREATE POLICY patients_delete ON hmis_patients
    FOR DELETE TO authenticated
    USING (hmis_is_super_admin());

-- ════════════════════════════════════
-- 2. OPD VISITS
-- ════════════════════════════════════
ALTER TABLE hmis_opd_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opd_visits_select" ON hmis_opd_visits;
CREATE POLICY opd_visits_select ON hmis_opd_visits
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "opd_visits_insert" ON hmis_opd_visits;
CREATE POLICY opd_visits_insert ON hmis_opd_visits
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "opd_visits_update" ON hmis_opd_visits;
CREATE POLICY opd_visits_update ON hmis_opd_visits
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 3. ADMISSIONS (IPD)
-- ════════════════════════════════════
ALTER TABLE hmis_admissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admissions_select" ON hmis_admissions;
CREATE POLICY admissions_select ON hmis_admissions
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "admissions_insert" ON hmis_admissions;
CREATE POLICY admissions_insert ON hmis_admissions
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "admissions_update" ON hmis_admissions;
CREATE POLICY admissions_update ON hmis_admissions
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 4. BILLS
-- ════════════════════════════════════
ALTER TABLE hmis_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bills_select" ON hmis_bills;
CREATE POLICY bills_select ON hmis_bills
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "bills_insert" ON hmis_bills;
CREATE POLICY bills_insert ON hmis_bills
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "bills_update" ON hmis_bills;
CREATE POLICY bills_update ON hmis_bills
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 5. BILL ITEMS (no centre_id — inherits from parent bill)
-- ════════════════════════════════════
ALTER TABLE hmis_bill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bill_items_select" ON hmis_bill_items;
CREATE POLICY bill_items_select ON hmis_bill_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hmis_bills b
            WHERE b.id = hmis_bill_items.bill_id
            AND (b.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

DROP POLICY IF EXISTS "bill_items_insert" ON hmis_bill_items;
CREATE POLICY bill_items_insert ON hmis_bill_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM hmis_bills b
            WHERE b.id = hmis_bill_items.bill_id
            AND (b.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

DROP POLICY IF EXISTS "bill_items_update" ON hmis_bill_items;
CREATE POLICY bill_items_update ON hmis_bill_items
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hmis_bills b
            WHERE b.id = hmis_bill_items.bill_id
            AND (b.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

-- ════════════════════════════════════
-- 6. PAYMENTS
-- ════════════════════════════════════
ALTER TABLE hmis_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON hmis_payments;
CREATE POLICY payments_select ON hmis_payments
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "payments_insert" ON hmis_payments;
CREATE POLICY payments_insert ON hmis_payments
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "payments_update" ON hmis_payments;
CREATE POLICY payments_update ON hmis_payments
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 7. LAB ORDERS
-- ════════════════════════════════════
ALTER TABLE hmis_lab_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_orders_select" ON hmis_lab_orders;
CREATE POLICY lab_orders_select ON hmis_lab_orders
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "lab_orders_insert" ON hmis_lab_orders;
CREATE POLICY lab_orders_insert ON hmis_lab_orders
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "lab_orders_update" ON hmis_lab_orders;
CREATE POLICY lab_orders_update ON hmis_lab_orders
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 8. LAB RESULTS (no centre_id — inherits from lab_order)
-- ════════════════════════════════════
ALTER TABLE hmis_lab_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_results_select" ON hmis_lab_results;
CREATE POLICY lab_results_select ON hmis_lab_results
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hmis_lab_orders o
            WHERE o.id = hmis_lab_results.lab_order_id
            AND (o.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

DROP POLICY IF EXISTS "lab_results_insert" ON hmis_lab_results;
CREATE POLICY lab_results_insert ON hmis_lab_results
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM hmis_lab_orders o
            WHERE o.id = hmis_lab_results.lab_order_id
            AND (o.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

DROP POLICY IF EXISTS "lab_results_update" ON hmis_lab_results;
CREATE POLICY lab_results_update ON hmis_lab_results
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hmis_lab_orders o
            WHERE o.id = hmis_lab_results.lab_order_id
            AND (o.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

-- ════════════════════════════════════
-- 9. LAB SAMPLES
-- ════════════════════════════════════
ALTER TABLE hmis_lab_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_samples_select" ON hmis_lab_samples;
CREATE POLICY lab_samples_select ON hmis_lab_samples
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hmis_lab_orders o
            WHERE o.id = hmis_lab_samples.lab_order_id
            AND (o.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

DROP POLICY IF EXISTS "lab_samples_insert" ON hmis_lab_samples;
CREATE POLICY lab_samples_insert ON hmis_lab_samples
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM hmis_lab_orders o
            WHERE o.id = hmis_lab_samples.lab_order_id
            AND (o.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

-- ════════════════════════════════════
-- 10. RADIOLOGY ORDERS
-- ════════════════════════════════════
ALTER TABLE hmis_radiology_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radiology_orders_select" ON hmis_radiology_orders;
CREATE POLICY radiology_orders_select ON hmis_radiology_orders
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "radiology_orders_insert" ON hmis_radiology_orders;
CREATE POLICY radiology_orders_insert ON hmis_radiology_orders
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "radiology_orders_update" ON hmis_radiology_orders;
CREATE POLICY radiology_orders_update ON hmis_radiology_orders
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 11. PRESCRIPTIONS
-- ════════════════════════════════════
ALTER TABLE hmis_prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescriptions_select" ON hmis_prescriptions;
CREATE POLICY prescriptions_select ON hmis_prescriptions
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "prescriptions_insert" ON hmis_prescriptions;
CREATE POLICY prescriptions_insert ON hmis_prescriptions
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "prescriptions_update" ON hmis_prescriptions;
CREATE POLICY prescriptions_update ON hmis_prescriptions
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 12. NURSING NOTES
-- ════════════════════════════════════
ALTER TABLE hmis_nursing_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nursing_notes_select" ON hmis_nursing_notes;
CREATE POLICY nursing_notes_select ON hmis_nursing_notes
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "nursing_notes_insert" ON hmis_nursing_notes;
CREATE POLICY nursing_notes_insert ON hmis_nursing_notes
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "nursing_notes_update" ON hmis_nursing_notes;
CREATE POLICY nursing_notes_update ON hmis_nursing_notes
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 13. BEDS
-- ════════════════════════════════════
ALTER TABLE hmis_beds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beds_select" ON hmis_beds;
CREATE POLICY beds_select ON hmis_beds
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "beds_modify" ON hmis_beds;
CREATE POLICY beds_modify ON hmis_beds
    FOR ALL TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 14. DRUG MASTER
-- ════════════════════════════════════
ALTER TABLE hmis_drug_master ENABLE ROW LEVEL SECURITY;

-- All staff can read drug master (needed for prescriptions across centres)
DROP POLICY IF EXISTS "drug_master_select" ON hmis_drug_master;
CREATE POLICY drug_master_select ON hmis_drug_master
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "drug_master_modify" ON hmis_drug_master;
CREATE POLICY drug_master_modify ON hmis_drug_master
    FOR ALL TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 15. OT BOOKINGS (no centre_id — inherits from ot_rooms)
-- ════════════════════════════════════
ALTER TABLE hmis_ot_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ot_bookings_select" ON hmis_ot_bookings;
CREATE POLICY ot_bookings_select ON hmis_ot_bookings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hmis_ot_rooms r
            WHERE r.id = hmis_ot_bookings.ot_room_id
            AND (r.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

DROP POLICY IF EXISTS "ot_bookings_insert" ON hmis_ot_bookings;
CREATE POLICY ot_bookings_insert ON hmis_ot_bookings
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM hmis_ot_rooms r
            WHERE r.id = hmis_ot_bookings.ot_room_id
            AND (r.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

DROP POLICY IF EXISTS "ot_bookings_update" ON hmis_ot_bookings;
CREATE POLICY ot_bookings_update ON hmis_ot_bookings
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hmis_ot_rooms r
            WHERE r.id = hmis_ot_bookings.ot_room_id
            AND (r.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
        )
    );

-- ════════════════════════════════════
-- 16. OT ROOMS
-- ════════════════════════════════════
ALTER TABLE hmis_ot_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ot_rooms_select" ON hmis_ot_rooms;
CREATE POLICY ot_rooms_select ON hmis_ot_rooms
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "ot_rooms_modify" ON hmis_ot_rooms;
CREATE POLICY ot_rooms_modify ON hmis_ot_rooms
    FOR ALL TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 17. PRE-AUTH REQUESTS (Insurance)
-- ════════════════════════════════════
ALTER TABLE hmis_pre_auth_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preauth_select" ON hmis_pre_auth_requests;
CREATE POLICY preauth_select ON hmis_pre_auth_requests
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "preauth_insert" ON hmis_pre_auth_requests;
CREATE POLICY preauth_insert ON hmis_pre_auth_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "preauth_update" ON hmis_pre_auth_requests;
CREATE POLICY preauth_update ON hmis_pre_auth_requests
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- 18. CLAIMS (Insurance)
-- ════════════════════════════════════
ALTER TABLE hmis_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claims_select" ON hmis_claims;
CREATE POLICY claims_select ON hmis_claims
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "claims_insert" ON hmis_claims;
CREATE POLICY claims_insert ON hmis_claims
    FOR INSERT TO authenticated
    WITH CHECK (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

DROP POLICY IF EXISTS "claims_update" ON hmis_claims;
CREATE POLICY claims_update ON hmis_claims
    FOR UPDATE TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

-- ════════════════════════════════════
-- REFERENCE TABLES (read-all, modify by admin only)
-- ════════════════════════════════════

-- Lab test master
ALTER TABLE hmis_lab_test_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lab_test_master_select" ON hmis_lab_test_master;
CREATE POLICY lab_test_master_select ON hmis_lab_test_master FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "lab_test_master_modify" ON hmis_lab_test_master;
CREATE POLICY lab_test_master_modify ON hmis_lab_test_master FOR ALL TO authenticated USING (hmis_is_super_admin());

-- Departments
ALTER TABLE hmis_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments_select" ON hmis_departments;
CREATE POLICY departments_select ON hmis_departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "departments_modify" ON hmis_departments;
CREATE POLICY departments_modify ON hmis_departments FOR ALL TO authenticated USING (hmis_is_super_admin());

-- Insurers
ALTER TABLE hmis_insurers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insurers_select" ON hmis_insurers;
CREATE POLICY insurers_select ON hmis_insurers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insurers_modify" ON hmis_insurers;
CREATE POLICY insurers_modify ON hmis_insurers FOR ALL TO authenticated USING (hmis_is_super_admin());

-- Module config
ALTER TABLE hmis_module_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "module_config_select" ON hmis_module_config;
CREATE POLICY module_config_select ON hmis_module_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "module_config_modify" ON hmis_module_config;
CREATE POLICY module_config_modify ON hmis_module_config FOR ALL TO authenticated USING (hmis_is_super_admin());

-- ════════════════════════════════════
-- VERIFICATION QUERY (run after each section)
-- ════════════════════════════════════
-- Login as a non-admin user (e.g. doctor) and run:
--   SELECT count(*) FROM hmis_patients;         -- should return all patients
--   SELECT count(*) FROM hmis_opd_visits;        -- should return only centre's visits
--   SELECT count(*) FROM hmis_bills;             -- should return only centre's bills
--   SELECT count(*) FROM hmis_lab_orders;        -- should return only centre's orders
-- If any return 0 when data exists, the RLS policy is too restrictive.
