-- ============================================================
-- MODULE TOGGLE SYSTEM
-- Super-admin configurable module on/off per centre
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_module_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  module_key VARCHAR(50) NOT NULL,
  module_name VARCHAR(100) NOT NULL,
  module_group VARCHAR(30) NOT NULL CHECK (module_group IN ('clinical','diagnostics','revenue','operations','admin')),
  is_enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  updated_by UUID REFERENCES hmis_staff(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_module_config_centre ON hmis_module_config(centre_id, is_enabled);

ALTER TABLE hmis_module_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS module_config_tenant ON hmis_module_config;
CREATE POLICY module_config_tenant ON hmis_module_config
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

-- Seed default modules for all centres
INSERT INTO hmis_module_config (centre_id, module_key, module_name, module_group, is_enabled, sort_order)
SELECT c.id, m.key, m.name, m.grp, m.enabled, m.sort
FROM hmis_centres c
CROSS JOIN (VALUES
  -- Clinical
  ('opd', 'OPD', 'clinical', true, 1),
  ('appointments', 'Appointments', 'clinical', true, 2),
  ('emr', 'EMR', 'clinical', true, 3),
  ('voice_notes', 'Voice Notes', 'clinical', false, 4),
  ('ipd', 'IPD', 'clinical', true, 5),
  ('bed_management', 'Bed Management', 'clinical', true, 6),
  ('nursing', 'Nursing Station', 'clinical', true, 7),
  ('shift_handover', 'Shift Handover', 'clinical', true, 8),
  ('emergency', 'Emergency', 'clinical', true, 9),
  ('ot', 'Operation Theatre', 'clinical', true, 10),
  ('surgical_planning', 'Surgical Planning', 'clinical', true, 11),
  ('digital_consent', 'Digital Consent', 'clinical', true, 12),
  ('cathlab', 'Cath Lab', 'clinical', false, 13),
  ('endoscopy', 'Endoscopy', 'clinical', false, 14),
  ('dialysis', 'Dialysis', 'clinical', false, 15),
  ('physiotherapy', 'Physiotherapy', 'clinical', false, 16),
  ('dietary', 'Dietary', 'clinical', true, 17),
  ('cssd', 'CSSD', 'clinical', true, 18),
  ('referrals', 'Referrals', 'clinical', true, 19),
  -- Diagnostics
  ('lab', 'Laboratory', 'diagnostics', true, 20),
  ('radiology', 'Radiology', 'diagnostics', true, 21),
  ('blood_bank', 'Blood Bank', 'diagnostics', false, 22),
  ('pharmacy', 'Pharmacy', 'diagnostics', true, 23),
  -- Revenue
  ('billing', 'Billing', 'revenue', true, 24),
  ('packages', 'Packages', 'revenue', true, 25),
  ('insurance', 'Insurance', 'revenue', true, 26),
  ('revenue_leakage', 'Revenue Leakage', 'revenue', true, 27),
  ('accounting', 'Accounting', 'revenue', false, 28),
  -- Operations
  ('procurement', 'Procurement (VPMS)', 'operations', true, 29),
  ('homecare', 'Homecare', 'operations', false, 30),
  ('crm', 'CRM', 'operations', false, 31),
  ('biomedical', 'Biomedical', 'operations', true, 32),
  ('equipment_lifecycle', 'Equipment Lifecycle', 'operations', true, 33),
  ('housekeeping', 'Housekeeping', 'operations', true, 34),
  ('bed_turnover', 'Bed Turnover', 'operations', true, 35),
  ('duty_roster', 'Duty Roster', 'operations', true, 36),
  ('linen', 'Linen', 'operations', false, 37),
  ('infection_control', 'Infection Control', 'operations', false, 38),
  ('visitors', 'Visitors', 'operations', false, 39),
  ('mortuary', 'Mortuary', 'operations', false, 40),
  ('quality', 'Quality / NABH', 'operations', true, 41),
  -- Admin
  ('telemedicine', 'Telemedicine', 'admin', false, 42)
) AS m(key, name, grp, enabled, sort)
WHERE NOT EXISTS (SELECT 1 FROM hmis_module_config WHERE centre_id = c.id AND module_key = m.key);
