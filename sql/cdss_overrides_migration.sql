-- cdss_overrides_migration.sql
-- Tracks when doctors override CDSS alerts (drug interactions, dose warnings, allergy conflicts)

CREATE TABLE IF NOT EXISTS hmis_cdss_overrides (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid REFERENCES hmis_centres(id),
  patient_id      uuid NOT NULL REFERENCES hmis_patients(id),
  encounter_id    uuid,                           -- EMR encounter or admission
  staff_id        uuid NOT NULL REFERENCES hmis_staff(id),
  alert_type      text NOT NULL CHECK (alert_type IN (
    'drug_interaction', 'dose_warning', 'allergy_conflict', 'contraindication'
  )),
  severity        text NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'contraindicated')),
  alert_message   text NOT NULL,
  drug_name       text,
  interacting_drug text,                          -- for interaction alerts
  override_reason text,                           -- optional doctor justification
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_cdss_overrides IS 'Audit trail of CDSS alert overrides by physicians';

CREATE INDEX IF NOT EXISTS idx_cdss_overrides_patient ON hmis_cdss_overrides (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdss_overrides_staff ON hmis_cdss_overrides (staff_id, created_at DESC);

-- RLS
ALTER TABLE hmis_cdss_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cdss overrides"
  ON hmis_cdss_overrides FOR SELECT USING (true);

CREATE POLICY "Staff can create cdss overrides"
  ON hmis_cdss_overrides FOR INSERT WITH CHECK (true);
