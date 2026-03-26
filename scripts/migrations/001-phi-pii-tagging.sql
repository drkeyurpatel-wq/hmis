-- ============================================================
-- HMIS PHI/PII Schema Tagging Migration
-- Sub-Project 1, Task 3.3
-- 
-- Adds sensitivity classification comments on columns containing
-- Protected Health Information (PHI) or Personally Identifiable
-- Information (PII).
--
-- Levels:
--   PHI:HIGH   — Never log, never export, display only in clinical context with auth
--   PHI:MEDIUM — Aggregatable for analytics, display with auth
--   PII:HIGH   — Mask in list views (last 4 digits), full only on detail with auth
--   PII:MEDIUM — Show in clinical context, exclude from non-clinical exports
--   PII:LOW    — Display with auth, exclude from public analytics
--
-- CRITICAL: Test against a real user session before and after running.
-- Run in Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- PATIENTS TABLE — Core demographic data
-- ============================================================
COMMENT ON COLUMN hmis_patients.first_name IS 'PII:LOW — Patient name, display in clinical context';
COMMENT ON COLUMN hmis_patients.last_name IS 'PII:LOW — Patient name, display in clinical context';
COMMENT ON COLUMN hmis_patients.phone_primary IS 'PII:MEDIUM — Contact, mask in lists (show last 4)';
COMMENT ON COLUMN hmis_patients.phone_secondary IS 'PII:MEDIUM — Contact, mask in lists';
COMMENT ON COLUMN hmis_patients.email IS 'PII:MEDIUM — Contact, exclude from non-clinical exports';
COMMENT ON COLUMN hmis_patients.address IS 'PII:HIGH — Full address, never in list views';
COMMENT ON COLUMN hmis_patients.city IS 'PII:LOW — City only, OK for geographic analytics';
COMMENT ON COLUMN hmis_patients.state IS 'PII:LOW — State only, OK for geographic analytics';
COMMENT ON COLUMN hmis_patients.pincode IS 'PII:MEDIUM — Can narrow location, exclude from exports';
COMMENT ON COLUMN hmis_patients.blood_group IS 'PHI:MEDIUM — Medical data, aggregatable';

-- If Aadhaar/national ID column exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hmis_patients' AND column_name='aadhaar') THEN
    EXECUTE $x$COMMENT ON COLUMN hmis_patients.aadhaar IS 'PII:HIGH — National ID, ALWAYS mask (show last 4 only), exclude from all exports'$x$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hmis_patients' AND column_name='aadhaar_number') THEN
    EXECUTE $x$COMMENT ON COLUMN hmis_patients.aadhaar_number IS 'PII:HIGH — National ID, ALWAYS mask (show last 4 only), exclude from all exports'$x$;
  END IF;
END $$;

-- ============================================================
-- CLINICAL NOTES / EMR
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hmis_clinical_notes' AND column_name='soap_subjective') THEN
    EXECUTE $x$COMMENT ON COLUMN hmis_clinical_notes.soap_subjective IS 'PHI:HIGH — Patient-reported symptoms, never log, never export without consent'$x$;
    EXECUTE $x$COMMENT ON COLUMN hmis_clinical_notes.soap_objective IS 'PHI:HIGH — Clinical examination findings'$x$;
    EXECUTE $x$COMMENT ON COLUMN hmis_clinical_notes.soap_assessment IS 'PHI:HIGH — Diagnosis/clinical assessment'$x$;
    EXECUTE $x$COMMENT ON COLUMN hmis_clinical_notes.soap_plan IS 'PHI:HIGH — Treatment plan'$x$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hmis_clinical_notes' AND column_name='note_content') THEN
    EXECUTE $x$COMMENT ON COLUMN hmis_clinical_notes.note_content IS 'PHI:HIGH — Clinical narrative, never log or export'$x$;
  END IF;
END $$;

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hmis_prescriptions') THEN
    EXECUTE $x$COMMENT ON TABLE hmis_prescriptions IS 'PHI:MEDIUM — Prescription data, medication names aggregatable for analytics'$x$;
  END IF;
END $$;

-- ============================================================
-- LAB RESULTS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hmis_lab_results') THEN
    EXECUTE $x$COMMENT ON TABLE hmis_lab_results IS 'PHI:HIGH — Lab results, display only with clinical auth'$x$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hmis_lab_orders') THEN
    EXECUTE $x$COMMENT ON TABLE hmis_lab_orders IS 'PHI:MEDIUM — Lab order metadata, aggregatable for TAT analytics'$x$;
  END IF;
END $$;

-- ============================================================
-- VITALS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hmis_vitals') THEN
    EXECUTE $x$COMMENT ON TABLE hmis_vitals IS 'PHI:MEDIUM — Vital signs, aggregatable for clinical analytics'$x$;
  END IF;
END $$;

-- ============================================================
-- NURSING NOTES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hmis_nursing_notes' AND column_name='note_text') THEN
    EXECUTE $x$COMMENT ON COLUMN hmis_nursing_notes.note_text IS 'PHI:HIGH — Nursing narrative, never log'$x$;
  END IF;
END $$;

-- ============================================================
-- CONSENT FORMS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hmis_consent_forms') THEN
    EXECUTE $x$COMMENT ON TABLE hmis_consent_forms IS 'PHI:HIGH — Consent records with patient signatures'$x$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hmis_digital_consents') THEN
    EXECUTE $x$COMMENT ON TABLE hmis_digital_consents IS 'PHI:HIGH — Digital consent with signatures'$x$;
  END IF;
END $$;

-- ============================================================
-- INSURANCE / CLAIMS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hmis_insurance_claims') THEN
    EXECUTE $x$COMMENT ON TABLE hmis_insurance_claims IS 'PHI:MEDIUM + PII:HIGH — Contains policy numbers and diagnosis codes'$x$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hmis_patient_insurance' AND column_name='policy_number') THEN
    EXECUTE $x$COMMENT ON COLUMN hmis_patient_insurance.policy_number IS 'PII:HIGH — Insurance policy number, mask in list views'$x$;
  END IF;
END $$;

-- ============================================================
-- ADMISSIONS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hmis_admissions') THEN
    EXECUTE $x$COMMENT ON TABLE hmis_admissions IS 'PHI:MEDIUM — Admission metadata, aggregatable for occupancy analytics'$x$;
  END IF;
END $$;

-- ============================================================
-- STAFF TABLE — Employee PII
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hmis_staff' AND column_name='phone') THEN
    EXECUTE $x$COMMENT ON COLUMN hmis_staff.phone IS 'PII:MEDIUM — Staff contact, internal use only'$x$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hmis_staff' AND column_name='email') THEN
    EXECUTE $x$COMMENT ON COLUMN hmis_staff.email IS 'PII:MEDIUM — Staff contact, internal use only'$x$;
  END IF;
END $$;

-- ============================================================
-- AUDIT VIEW — Lists all tagged PHI/PII columns
-- ============================================================
CREATE OR REPLACE VIEW v_phi_pii_inventory AS
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  pgd.description AS sensitivity_tag
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables st
  ON c.table_schema = st.schemaname AND c.table_name = st.relname
LEFT JOIN pg_catalog.pg_description pgd
  ON pgd.objoid = st.relid
  AND pgd.objsubid = c.ordinal_position
WHERE c.table_schema = 'public'
  AND c.table_name LIKE 'hmis_%'
  AND pgd.description IS NOT NULL
  AND (pgd.description LIKE 'PHI:%' OR pgd.description LIKE 'PII:%')
ORDER BY c.table_name, c.ordinal_position;

-- Also create a table-level view for tables with table-level comments
CREATE OR REPLACE VIEW v_phi_pii_tables AS
SELECT
  t.table_name,
  obj_description((t.table_schema || '.' || t.table_name)::regclass) AS sensitivity_tag
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name LIKE 'hmis_%'
  AND obj_description((t.table_schema || '.' || t.table_name)::regclass) IS NOT NULL
  AND (obj_description((t.table_schema || '.' || t.table_name)::regclass) LIKE 'PHI:%'
    OR obj_description((t.table_schema || '.' || t.table_name)::regclass) LIKE '%PHI:%'
    OR obj_description((t.table_schema || '.' || t.table_name)::regclass) LIKE '%PII:%')
ORDER BY t.table_name;

-- ============================================================
-- VERIFY: Run after migration
-- SELECT * FROM v_phi_pii_inventory;
-- SELECT * FROM v_phi_pii_tables;
-- Expected: 15+ tagged columns, 6+ tagged tables
-- ============================================================
