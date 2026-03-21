-- portal_migration.sql
-- Patient portal tables: prescription refills, patient feedback, insurance documents

-- ============================================================
-- PRESCRIPTION REFILL REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_prescription_refill_requests (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id        uuid NOT NULL REFERENCES hmis_patients(id),
  encounter_id      uuid,
  prescription_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','dispensed','rejected')),
  notes             text,
  requested_at      timestamptz DEFAULT now(),
  responded_at      timestamptz,
  responded_by      uuid REFERENCES hmis_staff(id)
);

CREATE INDEX IF NOT EXISTS idx_refill_patient ON hmis_prescription_refill_requests (patient_id, status);

-- ============================================================
-- PATIENT FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_patient_feedback (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id  uuid NOT NULL REFERENCES hmis_patients(id),
  visit_id    uuid,
  rating      integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     text,
  department  text,
  doctor_name text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_patient ON hmis_patient_feedback (patient_id, created_at DESC);

-- ============================================================
-- INSURANCE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_insurance_documents (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pre_auth_id   uuid,
  claim_id      uuid,
  patient_id    uuid REFERENCES hmis_patients(id),
  document_type text NOT NULL CHECK (document_type IN (
    'id_proof','insurance_card','investigation_report','discharge_summary',
    'final_bill','prescription','consent','other'
  )),
  file_name     text NOT NULL,
  file_url      text NOT NULL,
  file_size     integer,
  uploaded_by   uuid REFERENCES hmis_staff(id),
  uploaded_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ins_docs_preauth ON hmis_insurance_documents (pre_auth_id) WHERE pre_auth_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ins_docs_claim ON hmis_insurance_documents (claim_id) WHERE claim_id IS NOT NULL;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_prescription_refill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_patient_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_insurance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access refill requests" ON hmis_prescription_refill_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access patient feedback" ON hmis_patient_feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access insurance documents" ON hmis_insurance_documents FOR ALL USING (true) WITH CHECK (true);
