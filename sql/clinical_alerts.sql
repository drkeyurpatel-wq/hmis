-- clinical_alerts.sql
-- Real-time clinical alert system: NEWS2, critical labs, vital abnormalities, overdue meds, deterioration

CREATE TABLE IF NOT EXISTS hmis_clinical_alerts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id),
  patient_id      uuid NOT NULL REFERENCES hmis_patients(id),
  admission_id    uuid REFERENCES hmis_admissions(id),
  alert_type      text NOT NULL CHECK (alert_type IN (
    'news2_high', 'critical_lab', 'vital_abnormal', 'overdue_med', 'deteriorating'
  )),
  severity        text NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  title           varchar(200) NOT NULL,
  description     text,
  data            jsonb DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  acknowledged_by uuid REFERENCES hmis_staff(id),
  acknowledged_at timestamptz,
  resolved_by     uuid REFERENCES hmis_staff(id),
  resolved_at     timestamptz,
  resolve_note    text,
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_clinical_alerts IS 'Real-time clinical alerts: NEWS2, critical labs, vitals, overdue meds, deterioration';

CREATE INDEX IF NOT EXISTS idx_clinical_alerts_active
  ON hmis_clinical_alerts (centre_id, status, severity)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_clinical_alerts_patient
  ON hmis_clinical_alerts (patient_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_alerts_admission
  ON hmis_clinical_alerts (admission_id, status)
  WHERE admission_id IS NOT NULL;

-- RLS
ALTER TABLE hmis_clinical_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view clinical alerts"
  ON hmis_clinical_alerts FOR SELECT USING (true);

CREATE POLICY "System can create clinical alerts"
  ON hmis_clinical_alerts FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update clinical alerts"
  ON hmis_clinical_alerts FOR UPDATE USING (true) WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE hmis_clinical_alerts;
