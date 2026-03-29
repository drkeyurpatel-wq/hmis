-- ============================================================
-- Automatic Audit Trail via Database Triggers
-- Captures every INSERT/UPDATE/DELETE on core clinical tables
-- Date: 2026-03-29
-- ============================================================
-- This is the RELIABLE way to do audit — no code changes needed.
-- Every write to these tables gets logged automatically.
-- ============================================================

-- 1. Ensure audit trail table exists
CREATE TABLE IF NOT EXISTS hmis_audit_trail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid,
    user_id uuid,
    action varchar(20) NOT NULL,           -- insert, update, delete
    entity_type varchar(50) NOT NULL,       -- table name without hmis_ prefix
    entity_id uuid,
    entity_label text,
    changes jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON hmis_audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON hmis_audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON hmis_audit_trail(created_at DESC);

-- 2. Generic audit trigger function
CREATE OR REPLACE FUNCTION hmis_audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_action text;
    v_entity_type text;
    v_entity_id uuid;
    v_centre_id uuid;
    v_user_id uuid;
    v_changes jsonb;
    v_label text;
BEGIN
    -- Determine action
    v_action := lower(TG_OP);
    
    -- Entity type = table name without 'hmis_' prefix
    v_entity_type := replace(TG_TABLE_NAME, 'hmis_', '');
    
    -- Get entity ID
    IF TG_OP = 'DELETE' THEN
        v_entity_id := OLD.id;
    ELSE
        v_entity_id := NEW.id;
    END IF;
    
    -- Get centre_id (try multiple column names)
    IF TG_OP = 'DELETE' THEN
        v_centre_id := CASE
            WHEN TG_TABLE_NAME = 'hmis_patients' THEN OLD.registration_centre_id
            ELSE (SELECT OLD.centre_id)
        END;
    ELSE
        v_centre_id := CASE
            WHEN TG_TABLE_NAME = 'hmis_patients' THEN NEW.registration_centre_id
            ELSE (SELECT NEW.centre_id)
        END;
    END IF;
    
    -- Get current authenticated user
    BEGIN
        v_user_id := (SELECT id FROM hmis_staff WHERE auth_user_id = auth.uid() LIMIT 1);
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;
    
    -- Build changes for UPDATE
    IF TG_OP = 'UPDATE' THEN
        v_changes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSIF TG_OP = 'INSERT' THEN
        v_changes := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_changes := to_jsonb(OLD);
    END IF;
    
    -- Build label
    v_label := CASE TG_TABLE_NAME
        WHEN 'hmis_patients' THEN
            CASE TG_OP
                WHEN 'INSERT' THEN 'Registered: ' || NEW.first_name || ' ' || NEW.last_name || ' (' || NEW.uhid || ')'
                WHEN 'UPDATE' THEN 'Updated: ' || NEW.first_name || ' ' || NEW.last_name || ' (' || NEW.uhid || ')'
                ELSE 'Patient record'
            END
        WHEN 'hmis_bills' THEN
            CASE TG_OP
                WHEN 'INSERT' THEN 'Bill created: ' || NEW.bill_number
                WHEN 'UPDATE' THEN 'Bill updated: ' || NEW.bill_number || ' → ' || NEW.status
                ELSE 'Bill'
            END
        WHEN 'hmis_admissions' THEN
            CASE TG_OP
                WHEN 'INSERT' THEN 'Admitted: IP ' || COALESCE(NEW.ip_number, '')
                WHEN 'UPDATE' THEN 'Admission updated: ' || NEW.status
                ELSE 'Admission'
            END
        WHEN 'hmis_opd_visits' THEN
            CASE TG_OP
                WHEN 'INSERT' THEN 'OPD visit: token ' || COALESCE(CAST(NEW.token_number AS text), '')
                ELSE 'OPD visit'
            END
        WHEN 'hmis_lab_orders' THEN
            CASE TG_OP
                WHEN 'INSERT' THEN 'Lab ordered: ' || COALESCE(NEW.test_name, '')
                WHEN 'UPDATE' THEN 'Lab ' || NEW.status || ': ' || COALESCE(NEW.test_name, '')
                ELSE 'Lab order'
            END
        WHEN 'hmis_prescriptions' THEN 'Prescription'
        WHEN 'hmis_payments' THEN
            CASE TG_OP
                WHEN 'INSERT' THEN 'Payment: ' || NEW.payment_mode || ' ₹' || COALESCE(CAST(NEW.amount AS text), '0')
                ELSE 'Payment'
            END
        ELSE v_entity_type || ' ' || v_action
    END;
    
    -- Insert audit record (fire and forget — never fail the original operation)
    BEGIN
        INSERT INTO hmis_audit_trail (centre_id, user_id, action, entity_type, entity_id, entity_label, changes)
        VALUES (v_centre_id, v_user_id, v_action, v_entity_type, v_entity_id, v_label, v_changes);
    EXCEPTION WHEN OTHERS THEN
        -- Silent fail — audit must never block clinical operations
        NULL;
    END;
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach triggers to core Day 1 tables
-- Pattern: AFTER trigger so it doesn't block the operation

DO $$
DECLARE
    tables text[] := ARRAY[
        'hmis_patients',
        'hmis_opd_visits',
        'hmis_admissions',
        'hmis_bills',
        'hmis_payments',
        'hmis_lab_orders',
        'hmis_radiology_orders',
        'hmis_prescriptions',
        'hmis_nursing_notes',
        'hmis_doctor_rounds',
        'hmis_pharmacy_dispensing',
        'hmis_ot_bookings',
        'hmis_pre_auth_requests',
        'hmis_claims',
        'hmis_emr_encounters'
    ];
    t text;
    trigger_name text;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        trigger_name := t || '_audit_trigger';
        
        -- Drop existing trigger if any
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, t);
        
        -- Create new trigger
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION hmis_audit_trigger_fn()',
            trigger_name, t
        );
        
        RAISE NOTICE 'Audit trigger created on %', t;
    END LOOP;
END;
$$;

-- 4. RLS on audit trail itself
ALTER TABLE hmis_audit_trail ENABLE ROW LEVEL SECURITY;

-- Staff can read audit trail for their centres
DROP POLICY IF EXISTS "audit_trail_select" ON hmis_audit_trail;
CREATE POLICY audit_trail_select ON hmis_audit_trail
    FOR SELECT TO authenticated
    USING (
        centre_id = ANY(hmis_get_user_centre_ids())
        OR hmis_is_super_admin()
        OR centre_id IS NULL
    );

-- Only triggers (SECURITY DEFINER) can insert
-- No direct insert policy needed — the trigger function runs as SECURITY DEFINER

-- ============================================================
-- VERIFICATION: After running, test with:
--   INSERT INTO hmis_patients (uhid, registration_centre_id, first_name, last_name, gender, phone_primary)
--   VALUES ('TEST-AUDIT', '<centre_uuid>', 'Audit', 'Test', 'male', '9999999999');
--   SELECT * FROM hmis_audit_trail ORDER BY created_at DESC LIMIT 5;
--   DELETE FROM hmis_patients WHERE uhid = 'TEST-AUDIT';
-- ============================================================
