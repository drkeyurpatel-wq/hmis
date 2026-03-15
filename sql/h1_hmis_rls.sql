-- ============================================================
-- Health1 HMIS/ERP — Row-Level Security (RLS) Policies
-- Project: bmuupgrzbfmddjwcqlss
-- Run AFTER migration + seed
-- ============================================================
-- Strategy:
--   1. Staff can only see data from centres they have access to
--   2. Access is determined by hmis_staff_centres table
--   3. Super admins see everything
--   4. Service role bypasses RLS (for API bridge, cron jobs)
-- ============================================================

-- ════════════════════════════════════
-- HELPER FUNCTION: Get current staff's accessible centre IDs
-- ════════════════════════════════════

CREATE OR REPLACE FUNCTION hmis_get_user_centre_ids()
RETURNS uuid[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT sc.centre_id
        FROM hmis_staff_centres sc
        JOIN hmis_staff s ON s.id = sc.staff_id
        WHERE s.auth_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Check if current user is super_admin
CREATE OR REPLACE FUNCTION hmis_is_super_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM hmis_staff_centres sc
        JOIN hmis_staff s ON s.id = sc.staff_id
        JOIN hmis_roles r ON r.id = sc.role_id
        WHERE s.auth_user_id = auth.uid()
        AND r.name = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Get current staff ID
CREATE OR REPLACE FUNCTION hmis_get_staff_id()
RETURNS uuid AS $$
BEGIN
    RETURN (
        SELECT id FROM hmis_staff
        WHERE auth_user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Check if user has specific permission
CREATE OR REPLACE FUNCTION hmis_has_permission(p_module text, p_action text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM hmis_staff_centres sc
        JOIN hmis_staff s ON s.id = sc.staff_id
        JOIN hmis_role_permissions rp ON rp.role_id = sc.role_id
        WHERE s.auth_user_id = auth.uid()
        AND rp.module = p_module
        AND rp.action = p_action
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ════════════════════════════════════
-- ENABLE RLS ON ALL TABLES
-- ════════════════════════════════════

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'hmis_%'
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END;
$$;

-- ════════════════════════════════════
-- CORE TABLES (read by all authenticated, write by admin)
-- ════════════════════════════════════

-- Centres: everyone can read
CREATE POLICY centres_select ON hmis_centres
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY centres_modify ON hmis_centres
    FOR ALL TO authenticated
    USING (hmis_is_super_admin());

-- Roles: everyone can read
CREATE POLICY roles_select ON hmis_roles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY roles_modify ON hmis_roles
    FOR ALL TO authenticated
    USING (hmis_is_super_admin());

-- Role permissions: everyone can read
CREATE POLICY role_perms_select ON hmis_role_permissions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY role_perms_modify ON hmis_role_permissions
    FOR ALL TO authenticated
    USING (hmis_is_super_admin());

-- Settings: global visible to all, centre-specific only to that centre
CREATE POLICY settings_select ON hmis_settings
    FOR SELECT TO authenticated
    USING (
        centre_id IS NULL
        OR centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

CREATE POLICY settings_modify ON hmis_settings
    FOR ALL TO authenticated
    USING (hmis_is_super_admin());

-- Sequences: only accessible centres
CREATE POLICY sequences_select ON hmis_sequences
    FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());

CREATE POLICY sequences_modify ON hmis_sequences
    FOR ALL TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());

-- Fiscal periods: everyone can read
CREATE POLICY fiscal_select ON hmis_fiscal_periods
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY fiscal_modify ON hmis_fiscal_periods
    FOR ALL TO authenticated
    USING (hmis_is_super_admin());

-- ════════════════════════════════════
-- STAFF TABLES (centre-scoped)
-- ════════════════════════════════════

-- Staff: see staff from your centres
CREATE POLICY staff_select ON hmis_staff
    FOR SELECT TO authenticated
    USING (
        primary_centre_id = ANY(hmis_get_user_centre_ids())
        OR id = hmis_get_staff_id()
        OR hmis_is_super_admin()
    );

CREATE POLICY staff_insert ON hmis_staff
    FOR INSERT TO authenticated
    WITH CHECK (hmis_has_permission('core', 'create'));

CREATE POLICY staff_update ON hmis_staff
    FOR UPDATE TO authenticated
    USING (
        id = hmis_get_staff_id()
        OR hmis_has_permission('core', 'update')
    );

-- Staff-centre mapping
CREATE POLICY staff_centres_select ON hmis_staff_centres
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR staff_id = hmis_get_staff_id()
        OR hmis_is_super_admin()
    );

CREATE POLICY staff_centres_modify ON hmis_staff_centres
    FOR ALL TO authenticated
    USING (hmis_is_super_admin());

-- Staff-department mapping
CREATE POLICY staff_depts_select ON hmis_staff_departments
    FOR SELECT TO authenticated
    USING (staff_id = hmis_get_staff_id() OR hmis_is_super_admin());

CREATE POLICY staff_depts_modify ON hmis_staff_departments
    FOR ALL TO authenticated
    USING (hmis_is_super_admin());

-- Departments: see departments in your centres
CREATE POLICY depts_select ON hmis_departments
    FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());

CREATE POLICY depts_modify ON hmis_departments
    FOR ALL TO authenticated
    USING (hmis_is_super_admin());

-- ════════════════════════════════════
-- PATIENT TABLES (centre-scoped via registration_centre_id)
-- Patients visible across all centres user has access to
-- ════════════════════════════════════

CREATE POLICY patients_select ON hmis_patients
    FOR SELECT TO authenticated
    USING (
        registration_centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
    );

CREATE POLICY patients_insert ON hmis_patients
    FOR INSERT TO authenticated
    WITH CHECK (
        registration_centre_id = ANY(hmis_get_user_centre_ids())
        AND hmis_has_permission('patients', 'create')
    );

CREATE POLICY patients_update ON hmis_patients
    FOR UPDATE TO authenticated
    USING (
        registration_centre_id = ANY(hmis_get_user_centre_ids())
        AND hmis_has_permission('patients', 'update')
    );

-- Patient sub-tables: inherit access via patient_id
CREATE POLICY patient_contacts_select ON hmis_patient_contacts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
    ));

CREATE POLICY patient_contacts_modify ON hmis_patient_contacts
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND p.registration_centre_id = ANY(hmis_get_user_centre_ids())
    ));

CREATE POLICY patient_allergies_select ON hmis_patient_allergies
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
    ));

CREATE POLICY patient_allergies_modify ON hmis_patient_allergies
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND p.registration_centre_id = ANY(hmis_get_user_centre_ids())
    ));

CREATE POLICY patient_insurance_select ON hmis_patient_insurance
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
    ));

CREATE POLICY patient_insurance_modify ON hmis_patient_insurance
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND p.registration_centre_id = ANY(hmis_get_user_centre_ids())
    ));

CREATE POLICY patient_docs_select ON hmis_patient_documents
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
    ));

CREATE POLICY patient_docs_modify ON hmis_patient_documents
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND p.registration_centre_id = ANY(hmis_get_user_centre_ids())
    ));

CREATE POLICY patient_history_select ON hmis_patient_history
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())
    ));

CREATE POLICY patient_history_modify ON hmis_patient_history
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM hmis_patients p
        WHERE p.id = patient_id
        AND p.registration_centre_id = ANY(hmis_get_user_centre_ids())
    ));

-- ════════════════════════════════════
-- CENTRE-SCOPED OPERATIONAL TABLES
-- Pattern: centre_id = ANY(user's centres)
-- ════════════════════════════════════

-- Macro to create standard centre-scoped policies
-- (We'll write them out explicitly for clarity)

-- Bed Management
CREATE POLICY wards_select ON hmis_wards FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY wards_modify ON hmis_wards FOR ALL TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) AND hmis_has_permission('bed_mgmt', 'create'));

CREATE POLICY rooms_select ON hmis_rooms FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_wards w WHERE w.id = ward_id AND (w.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY rooms_modify ON hmis_rooms FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_wards w WHERE w.id = ward_id AND w.centre_id = ANY(hmis_get_user_centre_ids())));

CREATE POLICY beds_select ON hmis_beds FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_rooms r JOIN hmis_wards w ON w.id = r.ward_id WHERE r.id = room_id AND (w.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY beds_modify ON hmis_beds FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_rooms r JOIN hmis_wards w ON w.id = r.ward_id WHERE r.id = room_id AND w.centre_id = ANY(hmis_get_user_centre_ids())));

-- Doctor Scheduling
CREATE POLICY dr_schedules_select ON hmis_doctor_schedules FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY dr_schedules_modify ON hmis_doctor_schedules FOR ALL TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()));

CREATE POLICY appt_slots_select ON hmis_appointment_slots FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_doctor_schedules ds WHERE ds.id = schedule_id AND (ds.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY appt_slots_modify ON hmis_appointment_slots FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_doctor_schedules ds WHERE ds.id = schedule_id AND ds.centre_id = ANY(hmis_get_user_centre_ids())));

CREATE POLICY dr_leaves_select ON hmis_doctor_leaves FOR SELECT TO authenticated
    USING (true); -- Leaves visible to all (for scheduling awareness)
CREATE POLICY dr_leaves_modify ON hmis_doctor_leaves FOR ALL TO authenticated
    USING (doctor_id = hmis_get_staff_id() OR hmis_is_super_admin());

-- OPD
CREATE POLICY appointments_select ON hmis_appointments FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY appointments_insert ON hmis_appointments FOR INSERT TO authenticated
    WITH CHECK (centre_id = ANY(hmis_get_user_centre_ids()) AND hmis_has_permission('opd', 'create'));
CREATE POLICY appointments_update ON hmis_appointments FOR UPDATE TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) AND hmis_has_permission('opd', 'update'));

CREATE POLICY opd_visits_select ON hmis_opd_visits FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY opd_visits_modify ON hmis_opd_visits FOR ALL TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()));

CREATE POLICY opd_queue_select ON hmis_opd_queue FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY opd_queue_modify ON hmis_opd_queue FOR ALL TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()));

-- IPD
CREATE POLICY admissions_select ON hmis_admissions FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY admissions_insert ON hmis_admissions FOR INSERT TO authenticated
    WITH CHECK (centre_id = ANY(hmis_get_user_centre_ids()) AND hmis_has_permission('ipd', 'create'));
CREATE POLICY admissions_update ON hmis_admissions FOR UPDATE TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) AND hmis_has_permission('ipd', 'update'));

CREATE POLICY bed_transfers_select ON hmis_bed_transfers FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY bed_transfers_modify ON hmis_bed_transfers FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND a.centre_id = ANY(hmis_get_user_centre_ids())));

CREATE POLICY treatment_plans_select ON hmis_treatment_plans FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY treatment_plans_modify ON hmis_treatment_plans FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND a.centre_id = ANY(hmis_get_user_centre_ids())));

CREATE POLICY nursing_notes_select ON hmis_nursing_notes FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY nursing_notes_modify ON hmis_nursing_notes FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND a.centre_id = ANY(hmis_get_user_centre_ids())));

CREATE POLICY diet_orders_select ON hmis_diet_orders FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY diet_orders_modify ON hmis_diet_orders FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND a.centre_id = ANY(hmis_get_user_centre_ids())));

CREATE POLICY referrals_select ON hmis_referrals FOR SELECT TO authenticated
    USING (true); -- Referrals visible across centres for cross-centre referral workflow
CREATE POLICY referrals_modify ON hmis_referrals FOR ALL TO authenticated
    USING (hmis_has_permission('opd', 'create') OR hmis_has_permission('ipd', 'create'));

-- EMR / Clinical
CREATE POLICY clinical_templates_select ON hmis_clinical_templates FOR SELECT TO authenticated
    USING (true); -- Templates shared across centres
CREATE POLICY clinical_templates_modify ON hmis_clinical_templates FOR ALL TO authenticated
    USING (hmis_is_super_admin() OR created_by = hmis_get_staff_id());

CREATE POLICY vitals_select ON hmis_vitals FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY vitals_modify ON hmis_vitals FOR ALL TO authenticated
    USING (hmis_has_permission('emr', 'create'));

CREATE POLICY clinical_notes_select ON hmis_clinical_notes FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY clinical_notes_modify ON hmis_clinical_notes FOR ALL TO authenticated
    USING (hmis_has_permission('emr', 'create'));

CREATE POLICY diagnoses_select ON hmis_diagnoses FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY diagnoses_modify ON hmis_diagnoses FOR ALL TO authenticated
    USING (hmis_has_permission('emr', 'create'));

CREATE POLICY orders_select ON hmis_orders FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY orders_modify ON hmis_orders FOR ALL TO authenticated
    USING (hmis_has_permission('emr', 'create'));

CREATE POLICY procedures_select ON hmis_procedures_performed FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY procedures_modify ON hmis_procedures_performed FOR ALL TO authenticated
    USING (hmis_has_permission('emr', 'create'));

CREATE POLICY prescriptions_select ON hmis_prescriptions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY prescriptions_modify ON hmis_prescriptions FOR ALL TO authenticated
    USING (hmis_has_permission('pharmacy', 'create') OR hmis_has_permission('emr', 'create'));

-- Billing
CREATE POLICY tariff_select ON hmis_tariff_master FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY tariff_modify ON hmis_tariff_master FOR ALL TO authenticated
    USING (hmis_is_super_admin());

CREATE POLICY packages_select ON hmis_package_master FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY packages_modify ON hmis_package_master FOR ALL TO authenticated
    USING (hmis_is_super_admin());

CREATE POLICY bills_select ON hmis_bills FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY bills_insert ON hmis_bills FOR INSERT TO authenticated
    WITH CHECK (centre_id = ANY(hmis_get_user_centre_ids()) AND hmis_has_permission('billing', 'create'));
CREATE POLICY bills_update ON hmis_bills FOR UPDATE TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) AND hmis_has_permission('billing', 'update'));

CREATE POLICY bill_items_select ON hmis_bill_items FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_bills b WHERE b.id = bill_id AND (b.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY bill_items_modify ON hmis_bill_items FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_bills b WHERE b.id = bill_id AND b.centre_id = ANY(hmis_get_user_centre_ids())));

CREATE POLICY payments_select ON hmis_payments FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_bills b WHERE b.id = bill_id AND (b.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY payments_modify ON hmis_payments FOR ALL TO authenticated
    USING (hmis_has_permission('billing', 'create'));

CREATE POLICY advances_select ON hmis_advances FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY advances_modify ON hmis_advances FOR ALL TO authenticated
    USING (hmis_has_permission('billing', 'create'));

CREATE POLICY refunds_select ON hmis_refunds FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY refunds_modify ON hmis_refunds FOR ALL TO authenticated
    USING (hmis_has_permission('billing', 'approve'));

-- Insurance
CREATE POLICY insurers_select ON hmis_insurers FOR SELECT TO authenticated USING (true);
CREATE POLICY insurers_modify ON hmis_insurers FOR ALL TO authenticated USING (hmis_is_super_admin());

CREATE POLICY tpas_select ON hmis_tpas FOR SELECT TO authenticated USING (true);
CREATE POLICY tpas_modify ON hmis_tpas FOR ALL TO authenticated USING (hmis_is_super_admin());

CREATE POLICY insurer_tariffs_select ON hmis_insurer_tariffs FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY insurer_tariffs_modify ON hmis_insurer_tariffs FOR ALL TO authenticated
    USING (hmis_is_super_admin());

CREATE POLICY pre_auth_select ON hmis_pre_auth_requests FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY pre_auth_modify ON hmis_pre_auth_requests FOR ALL TO authenticated
    USING (hmis_has_permission('insurance', 'create'));

CREATE POLICY claims_select ON hmis_claims FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_bills b WHERE b.id = bill_id AND (b.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY claims_modify ON hmis_claims FOR ALL TO authenticated
    USING (hmis_has_permission('insurance', 'create'));

-- Pharmacy
CREATE POLICY drug_master_select ON hmis_drug_master FOR SELECT TO authenticated USING (true);
CREATE POLICY drug_master_modify ON hmis_drug_master FOR ALL TO authenticated USING (hmis_is_super_admin());

CREATE POLICY drug_inventory_select ON hmis_drug_inventory FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY drug_inventory_modify ON hmis_drug_inventory FOR ALL TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) AND hmis_has_permission('pharmacy', 'create'));

CREATE POLICY dispensing_select ON hmis_dispensing FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY dispensing_modify ON hmis_dispensing FOR ALL TO authenticated
    USING (hmis_has_permission('pharmacy', 'create'));

-- Lab
CREATE POLICY lab_master_select ON hmis_lab_test_master FOR SELECT TO authenticated USING (true);
CREATE POLICY lab_master_modify ON hmis_lab_test_master FOR ALL TO authenticated USING (hmis_is_super_admin());

CREATE POLICY lab_orders_select ON hmis_lab_orders FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY lab_orders_modify ON hmis_lab_orders FOR ALL TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()));

CREATE POLICY lab_samples_select ON hmis_lab_samples FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_lab_orders lo WHERE lo.id = lab_order_id AND (lo.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY lab_samples_modify ON hmis_lab_samples FOR ALL TO authenticated
    USING (hmis_has_permission('lab', 'create'));

CREATE POLICY lab_results_select ON hmis_lab_results FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_lab_orders lo WHERE lo.id = lab_order_id AND (lo.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY lab_results_modify ON hmis_lab_results FOR ALL TO authenticated
    USING (hmis_has_permission('lab', 'create'));

-- Radiology
CREATE POLICY rad_master_select ON hmis_radiology_test_master FOR SELECT TO authenticated USING (true);
CREATE POLICY rad_master_modify ON hmis_radiology_test_master FOR ALL TO authenticated USING (hmis_is_super_admin());

CREATE POLICY rad_orders_select ON hmis_radiology_orders FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY rad_orders_modify ON hmis_radiology_orders FOR ALL TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()));

CREATE POLICY rad_reports_select ON hmis_radiology_reports FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_radiology_orders ro WHERE ro.id = radiology_order_id AND (ro.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY rad_reports_modify ON hmis_radiology_reports FOR ALL TO authenticated
    USING (hmis_has_permission('radiology', 'create'));

-- OT
CREATE POLICY ot_rooms_select ON hmis_ot_rooms FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY ot_rooms_modify ON hmis_ot_rooms FOR ALL TO authenticated
    USING (hmis_is_super_admin());

CREATE POLICY ot_bookings_select ON hmis_ot_bookings FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_admissions a WHERE a.id = admission_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY ot_bookings_modify ON hmis_ot_bookings FOR ALL TO authenticated
    USING (hmis_has_permission('ot', 'create'));

CREATE POLICY surgery_notes_select ON hmis_surgery_notes FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_ot_bookings ob JOIN hmis_admissions a ON a.id = ob.admission_id WHERE ob.id = ot_booking_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY surgery_notes_modify ON hmis_surgery_notes FOR ALL TO authenticated
    USING (hmis_has_permission('ot', 'create'));

CREATE POLICY anaesthesia_select ON hmis_anaesthesia_records FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_ot_bookings ob JOIN hmis_admissions a ON a.id = ob.admission_id WHERE ob.id = ot_booking_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY anaesthesia_modify ON hmis_anaesthesia_records FOR ALL TO authenticated
    USING (hmis_has_permission('ot', 'create'));

-- Accounting
CREATE POLICY coa_select ON hmis_chart_of_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY coa_modify ON hmis_chart_of_accounts FOR ALL TO authenticated USING (hmis_is_super_admin());

CREATE POLICY je_select ON hmis_journal_entries FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY je_modify ON hmis_journal_entries FOR ALL TO authenticated
    USING (hmis_has_permission('accounting', 'create'));

CREATE POLICY jl_select ON hmis_journal_lines FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_journal_entries je WHERE je.id = journal_entry_id AND (je.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY jl_modify ON hmis_journal_lines FOR ALL TO authenticated
    USING (hmis_has_permission('accounting', 'create'));

-- Homecare
CREATE POLICY homecare_plans_select ON hmis_homecare_plans FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY homecare_plans_modify ON hmis_homecare_plans FOR ALL TO authenticated
    USING (hmis_has_permission('homecare', 'create'));

CREATE POLICY homecare_visits_select ON hmis_homecare_visits FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_homecare_plans hp JOIN hmis_patients p ON p.id = hp.patient_id WHERE hp.id = plan_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY homecare_visits_modify ON hmis_homecare_visits FOR ALL TO authenticated
    USING (hmis_has_permission('homecare', 'create'));

-- Ambulance
CREATE POLICY ambulances_select ON hmis_ambulances FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY ambulances_modify ON hmis_ambulances FOR ALL TO authenticated
    USING (hmis_is_super_admin());

CREATE POLICY ambulance_trips_select ON hmis_ambulance_trips FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_ambulances a WHERE a.id = ambulance_id AND (a.centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY ambulance_trips_modify ON hmis_ambulance_trips FOR ALL TO authenticated
    USING (hmis_has_permission('ambulance', 'create'));

-- Notifications
CREATE POLICY notif_templates_select ON hmis_notification_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY notif_templates_modify ON hmis_notification_templates FOR ALL TO authenticated USING (hmis_is_super_admin());

CREATE POLICY notif_log_select ON hmis_notification_log FOR SELECT TO authenticated
    USING (staff_id = hmis_get_staff_id() OR hmis_is_super_admin());
CREATE POLICY notif_log_modify ON hmis_notification_log FOR ALL TO authenticated
    USING (true); -- System inserts notifications

-- AI / CDSS
CREATE POLICY drug_interactions_select ON hmis_drug_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY drug_interactions_modify ON hmis_drug_interactions FOR ALL TO authenticated USING (hmis_is_super_admin());

CREATE POLICY cdss_alerts_select ON hmis_cdss_alerts FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY cdss_alerts_modify ON hmis_cdss_alerts FOR ALL TO authenticated
    USING (true); -- System generates alerts

CREATE POLICY ai_summaries_select ON hmis_ai_summaries FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM hmis_patients p WHERE p.id = patient_id AND (p.registration_centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin())));
CREATE POLICY ai_summaries_modify ON hmis_ai_summaries FOR ALL TO authenticated
    USING (hmis_has_permission('ai_cdss', 'read')); -- Doctors can trigger AI summaries

-- Audit Log (read-only for non-super-admins, system writes)
CREATE POLICY audit_select ON hmis_audit_log FOR SELECT TO authenticated
    USING (centre_id = ANY(hmis_get_user_centre_ids()) OR hmis_is_super_admin());
CREATE POLICY audit_insert ON hmis_audit_log FOR INSERT TO authenticated
    WITH CHECK (true); -- System inserts

-- ════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════

DO $$
DECLARE
    policy_count int;
BEGIN
    SELECT count(*) INTO policy_count
    FROM pg_policies
    WHERE tablename LIKE 'hmis_%';
    RAISE NOTICE 'RLS policies created: %', policy_count;
END;
$$;
