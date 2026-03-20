-- ============================================================
-- Health1 HMIS — RLS Tightening
-- Centre-scoped access: staff can only see data from their assigned centres
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Helper function: returns array of centre_ids the current user has access to
CREATE OR REPLACE FUNCTION get_my_centre_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(
    array_agg(sc.centre_id),
    ARRAY[]::uuid[]
  )
  FROM hmis_staff s
  JOIN hmis_staff_centres sc ON sc.staff_id = s.id
  WHERE s.auth_user_id = auth.uid()
    AND sc.is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Helper: returns current staff id
CREATE OR REPLACE FUNCTION get_my_staff_id()
RETURNS uuid AS $$
  SELECT id FROM hmis_staff WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Helper: check if user has a specific role at any centre
CREATE OR REPLACE FUNCTION has_role(role_name text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM hmis_staff s
    JOIN hmis_staff_centres sc ON sc.staff_id = s.id
    JOIN hmis_roles r ON r.id = sc.role_id
    WHERE s.auth_user_id = auth.uid()
      AND sc.is_active = true
      AND (r.name ILIKE role_name OR r.name = 'admin' OR r.name = 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- CENTRE-SCOPED POLICIES
-- Replace wide-open policies with centre-scoped ones
-- Pattern: SELECT/UPDATE/DELETE restricted to user's centres
--          INSERT allowed if centre_id is in user's centres
-- ============================================================

-- Macro: apply centre-scoped RLS to a table
DO $$
DECLARE
    tbl text;
    centre_tables text[] := ARRAY[
        'hmis_patients',
        'hmis_admissions',
        'hmis_bills',
        'hmis_opd_visits',
        'hmis_lab_orders',
        'hmis_radiology_orders',
        'hmis_pharmacy_dispensing',
        'hmis_beds',
        'hmis_wards',
        'hmis_rooms',
        'hmis_departments',
        'hmis_cpoe_orders',
        'hmis_incidents',
        'hmis_quality_indicators',
        'hmis_charge_log',
        'hmis_pharmacy_stock',
        'hmis_pharmacy_returns',
        'hmis_controlled_substance_log',
        'hmis_packages'
    ];
BEGIN
    FOREACH tbl IN ARRAY centre_tables LOOP
        -- Only if table exists and has centre_id column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'centre_id'
        ) THEN
            -- Drop old wide-open policy
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
            -- Enable RLS
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
            -- Centre-scoped read
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR SELECT USING (centre_id = ANY(get_my_centre_ids()))',
                tbl || '_read', tbl
            );
            -- Centre-scoped write
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (centre_id = ANY(get_my_centre_ids()))',
                tbl || '_insert', tbl
            );
            -- Centre-scoped update
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR UPDATE USING (centre_id = ANY(get_my_centre_ids()))',
                tbl || '_update', tbl
            );
            -- Centre-scoped delete
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR DELETE USING (centre_id = ANY(get_my_centre_ids()))',
                tbl || '_delete', tbl
            );
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- SPECIAL TABLES (no centre_id — different access patterns)
-- ============================================================

-- Staff: can see all staff (for doctor dropdowns etc.), but only edit own record
DROP POLICY IF EXISTS hmis_staff_pol ON hmis_staff;
ALTER TABLE hmis_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY hmis_staff_read ON hmis_staff FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY hmis_staff_update ON hmis_staff FOR UPDATE USING (auth_user_id = auth.uid());

-- Centres: all users can read centres (for centre selector)
DROP POLICY IF EXISTS hmis_centres_pol ON hmis_centres;
ALTER TABLE hmis_centres ENABLE ROW LEVEL SECURITY;
CREATE POLICY hmis_centres_read ON hmis_centres FOR SELECT USING (auth.uid() IS NOT NULL);

-- Staff-Centres: users can see their own assignments
DROP POLICY IF EXISTS hmis_staff_centres_pol ON hmis_staff_centres;
ALTER TABLE hmis_staff_centres ENABLE ROW LEVEL SECURITY;
CREATE POLICY hmis_staff_centres_read ON hmis_staff_centres FOR SELECT USING (auth.uid() IS NOT NULL);

-- Drug master: shared across centres (read-only for non-admin)
DROP POLICY IF EXISTS hmis_drug_master_pol ON hmis_drug_master;
ALTER TABLE hmis_drug_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY hmis_drug_master_read ON hmis_drug_master FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY hmis_drug_master_write ON hmis_drug_master FOR ALL USING (has_role('admin'));

-- Tariff master: centre-scoped read, admin-only write
DROP POLICY IF EXISTS hmis_tariff_master_pol ON hmis_tariff_master;
ALTER TABLE hmis_tariff_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY hmis_tariff_master_read ON hmis_tariff_master FOR SELECT USING (centre_id = ANY(get_my_centre_ids()));
CREATE POLICY hmis_tariff_master_write ON hmis_tariff_master FOR INSERT WITH CHECK (has_role('admin'));
CREATE POLICY hmis_tariff_master_update ON hmis_tariff_master FOR UPDATE USING (has_role('admin'));

-- Audit trail: centre-scoped read, insert only (no updates/deletes — immutable)
DROP POLICY IF EXISTS hmis_audit_trail_pol ON hmis_audit_trail;
ALTER TABLE hmis_audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY hmis_audit_trail_read ON hmis_audit_trail FOR SELECT USING (centre_id = ANY(get_my_centre_ids()));
CREATE POLICY hmis_audit_trail_insert ON hmis_audit_trail FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- No UPDATE or DELETE policy — audit trail is immutable

-- Lab/Radiology test masters: shared read, admin write
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_lab_test_master', 'hmis_radiology_test_master'] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (auth.uid() IS NOT NULL)', tbl || '_read', tbl);
            EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (has_role(''admin''))', tbl || '_admin', tbl);
        END IF;
    END LOOP;
END $$;

-- Roles: read-only for everyone
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hmis_roles') THEN
        DROP POLICY IF EXISTS hmis_roles_pol ON hmis_roles;
        ALTER TABLE hmis_roles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY hmis_roles_read ON hmis_roles FOR SELECT USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- ============================================================
-- SENSITIVE: Refunds require admin role
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hmis_refunds') THEN
        DROP POLICY IF EXISTS hmis_refunds_pol ON hmis_refunds;
        ALTER TABLE hmis_refunds ENABLE ROW LEVEL SECURITY;
        CREATE POLICY hmis_refunds_read ON hmis_refunds FOR SELECT USING (centre_id = ANY(get_my_centre_ids()));
        CREATE POLICY hmis_refunds_write ON hmis_refunds FOR INSERT WITH CHECK (centre_id = ANY(get_my_centre_ids()));
        CREATE POLICY hmis_refunds_approve ON hmis_refunds FOR UPDATE USING (has_role('admin') OR has_role('billing_manager'));
    END IF;
END $$;

-- Transfers: both centres' staff can see
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hmis_pharmacy_transfers') THEN
        DROP POLICY IF EXISTS hmis_pharmacy_transfers_pol ON hmis_pharmacy_transfers;
        ALTER TABLE hmis_pharmacy_transfers ENABLE ROW LEVEL SECURITY;
        CREATE POLICY hmis_pharmacy_transfers_read ON hmis_pharmacy_transfers FOR SELECT
            USING (from_centre_id = ANY(get_my_centre_ids()) OR to_centre_id = ANY(get_my_centre_ids()));
        CREATE POLICY hmis_pharmacy_transfers_insert ON hmis_pharmacy_transfers FOR INSERT
            WITH CHECK (from_centre_id = ANY(get_my_centre_ids()));
        CREATE POLICY hmis_pharmacy_transfers_update ON hmis_pharmacy_transfers FOR UPDATE
            USING (to_centre_id = ANY(get_my_centre_ids()));
    END IF;
END $$;
