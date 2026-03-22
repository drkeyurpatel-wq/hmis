-- ============================================================
-- MODULE: Digital Consent Management
-- Replace paper consent entirely with digital workflow
-- ============================================================

-- Consent templates with version control
CREATE TABLE IF NOT EXISTS hmis_consent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  template_name VARCHAR(300) NOT NULL,
  procedure_type VARCHAR(200),
  consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN (
    'surgical','anaesthesia','blood_transfusion','hiv_test','procedure',
    'admission','discharge_ama','research','photography','general'
  )),
  version INT DEFAULT 1,
  is_current BOOLEAN DEFAULT true,
  -- Content in 3 languages
  content_en TEXT NOT NULL,
  content_hi TEXT,
  content_gu TEXT,
  -- Patient education
  risks_en TEXT, risks_hi TEXT, risks_gu TEXT,
  benefits_en TEXT, benefits_hi TEXT, benefits_gu TEXT,
  alternatives_en TEXT, alternatives_hi TEXT, alternatives_gu TEXT,
  -- Config
  requires_witness BOOLEAN DEFAULT true,
  requires_interpreter BOOLEAN DEFAULT false,
  mandatory_checklist JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extend existing hmis_consents for digital workflow
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES hmis_consent_templates(id);
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS centre_id UUID REFERENCES hmis_centres(id);
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS ot_booking_id UUID REFERENCES hmis_ot_bookings(id);
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS content_shown TEXT;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS education_shown BOOLEAN DEFAULT false;
-- Pre-op checklist
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT false;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS procedure_explained BOOLEAN DEFAULT false;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS questions_answered BOOLEAN DEFAULT false;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS interpreter_used BOOLEAN DEFAULT false;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS interpreter_name VARCHAR(200);
-- Digital signature
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS witness_staff_id UUID REFERENCES hmis_staff(id);
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
-- Withdrawal
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS withdrawn_by UUID REFERENCES hmis_staff(id);
-- Version tracking
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS template_version INT;
ALTER TABLE hmis_consents ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Audit trail for consent actions
CREATE TABLE IF NOT EXISTS hmis_consent_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES hmis_consents(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'created','education_shown','patient_signed','witness_signed',
    'obtained','revoked','pdf_generated','viewed','edited'
  )),
  performed_by UUID REFERENCES hmis_staff(id),
  details TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consent_templates_centre ON hmis_consent_templates(centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_consent_templates_type ON hmis_consent_templates(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_audit_consent ON hmis_consent_audit(consent_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_centre ON hmis_consent_audit(centre_id);
CREATE INDEX IF NOT EXISTS idx_consents_template ON hmis_consents(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consents_ot ON hmis_consents(ot_booking_id) WHERE ot_booking_id IS NOT NULL;

-- RLS
ALTER TABLE hmis_consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_consent_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_tpl_tenant ON hmis_consent_templates;
CREATE POLICY consent_tpl_tenant ON hmis_consent_templates
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS consent_audit_tenant ON hmis_consent_audit;
CREATE POLICY consent_audit_tenant ON hmis_consent_audit
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));
