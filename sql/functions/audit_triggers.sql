-- =============================================================================
-- Audit triggers — generic logging for clinical/financial PHI tables
-- =============================================================================
-- Source of truth for what is currently deployed on production
-- (bmuupgrzbfmddjwcqlss). Captured 2026-04-22 via pg_get_functiondef.
--
-- DEPLOYED, not the version in sql/DAY1_AUDIT_TRIGGERS.sql which is older
-- and uses different label-building logic. Production wins per CLAUDE.md.
--
-- Wired tables (15):
--   hmis_patients, hmis_opd_visits, hmis_admissions, hmis_bills, hmis_payments,
--   hmis_lab_orders, hmis_radiology_orders, hmis_prescriptions, hmis_nursing_notes,
--   hmis_doctor_rounds, hmis_pharmacy_dispensing, hmis_ot_bookings,
--   hmis_pre_auth_requests, hmis_claims, hmis_emr_encounters
--
-- Each table has a trigger named `<table>_audit_trigger` firing
-- AFTER INSERT OR UPDATE OR DELETE.
--
-- Behaviour notes:
--   * Function runs SECURITY DEFINER so it can write to hmis_audit_trail
--     even when caller's RLS would deny direct writes.
--   * If `auth.uid()` returns NULL (e.g., MCP/postgres role, server-side
--     migrations, scheduled jobs), the function early-returns WITHOUT
--     writing an audit row. This is intentional — no auth context = no
--     attributable user, so no audit value.
--   * For UPDATE operations the function writes the diff (`to_jsonb(NEW) - to_jsonb(OLD)`),
--     not the full row, to keep audit table small.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.hmis_audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_centre_id uuid;
    v_changes jsonb;
    v_action text;
    v_user_id uuid;
BEGIN
    v_action := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' WHEN 'DELETE' THEN 'delete' END;
    v_user_id := auth.uid();

    -- Skip audit if no auth context (server-side/migration)
    IF v_user_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- Get centre_id: try centre_id first, then registration_centre_id
    v_centre_id := NULL;
    IF TG_OP != 'DELETE' THEN
        BEGIN v_centre_id := NEW.centre_id;
        EXCEPTION WHEN undefined_column THEN
            BEGIN v_centre_id := NEW.registration_centre_id;
            EXCEPTION WHEN undefined_column THEN v_centre_id := NULL;
            END;
        END;
    ELSE
        BEGIN v_centre_id := OLD.centre_id;
        EXCEPTION WHEN undefined_column THEN
            BEGIN v_centre_id := OLD.registration_centre_id;
            EXCEPTION WHEN undefined_column THEN v_centre_id := NULL;
            END;
        END;
    END IF;

    IF TG_OP = 'UPDATE' THEN v_changes := to_jsonb(NEW) - to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN v_changes := to_jsonb(NEW);
    ELSE v_changes := to_jsonb(OLD); END IF;

    INSERT INTO hmis_audit_trail (centre_id, user_id, action, entity_type, entity_id, changes)
    VALUES (v_centre_id, v_user_id, v_action, replace(TG_TABLE_NAME, 'hmis_', ''),
            CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END, v_changes);

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;


-- ----------------------------------------------------------------------------
-- Wire triggers to the 15 audited tables (idempotent — safe to re-run)
-- ----------------------------------------------------------------------------
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
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, t);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION hmis_audit_trigger_fn()',
            trigger_name, t
        );
        RAISE NOTICE 'Audit trigger ensured on %', t;
    END LOOP;
END;
$$;
