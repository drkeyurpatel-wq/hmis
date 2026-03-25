-- ============================================================
-- Health1 HMIS — Clinical Alerts Table
-- Required by: Safety Ticker, Shift Handover, Alert Engine
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  alert_type VARCHAR(50) NOT NULL,
  -- Types: news2_high, vital_abnormal, critical_lab, overdue_med, deteriorating, 
  --        drug_interaction, allergy_alert, fall_risk, sepsis_risk
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  -- Severity: emergency, critical, high, medium, low
  title VARCHAR(300) NOT NULL,
  description TEXT,
  data JSONB DEFAULT '{}',
  source VARCHAR(50), -- 'vitals', 'lab', 'medication', 'cdss', 'nursing', 'manual'
  source_ref_id UUID,
  source_ref_type VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  -- Status: active, acknowledged, resolved, expired, dismissed
  acknowledged_by UUID REFERENCES hmis_staff(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES hmis_staff(id),
  resolved_at TIMESTAMPTZ,
  auto_resolve_at TIMESTAMPTZ, -- auto-expire after N hours
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_alerts_active ON hmis_clinical_alerts(centre_id, status, severity) WHERE status = 'active';
CREATE INDEX idx_clinical_alerts_patient ON hmis_clinical_alerts(patient_id, status);
CREATE INDEX idx_clinical_alerts_admission ON hmis_clinical_alerts(admission_id) WHERE admission_id IS NOT NULL;

-- RLS
ALTER TABLE hmis_clinical_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinical_alerts_staff" ON hmis_clinical_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sc ON sc.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sc.centre_id = hmis_clinical_alerts.centre_id
    )
  );
