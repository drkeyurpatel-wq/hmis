-- biomedical_migration.sql
-- Equipment registry, maintenance tracking, PM scheduling

-- ============================================================
-- EQUIPMENT REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_equipment (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL CHECK (category IN (
    'imaging','laboratory','icu','ot','monitoring','sterilization','dental','ophthalmic','physiotherapy','general'
  )),
  brand           text,
  model           text,
  serial_number   text,
  location        text,
  department      text,
  purchase_date   date,
  purchase_cost   numeric(12,2),
  warranty_expiry date,
  amc_vendor      text,
  amc_expiry      date,
  amc_cost        numeric(10,2),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','condemned','out_of_order')),
  last_pm_date    date,
  next_pm_date    date,
  criticality     text NOT NULL DEFAULT 'medium' CHECK (criticality IN ('high','medium','low')),
  notes           text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equip_centre ON hmis_equipment (centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_equip_status ON hmis_equipment (status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_equip_pm_due ON hmis_equipment (next_pm_date) WHERE is_active = true;

-- ============================================================
-- MAINTENANCE LOG (breakdown + preventive + calibration)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_equipment_maintenance (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id      uuid NOT NULL REFERENCES hmis_equipment(id) ON DELETE CASCADE,
  centre_id         uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  type              text NOT NULL CHECK (type IN ('preventive','breakdown','calibration')),
  reported_by       uuid REFERENCES hmis_staff(id),
  reported_at       timestamptz DEFAULT now(),
  issue_description text,
  priority          text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  assigned_to       text,
  started_at        timestamptz,
  completed_at      timestamptz,
  resolution        text,
  parts_used        jsonb DEFAULT '[]'::jsonb,
  cost              numeric(10,2) DEFAULT 0,
  downtime_hours    numeric(8,2) DEFAULT 0,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','pending_parts')),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maint_equip ON hmis_equipment_maintenance (equipment_id, status);
CREATE INDEX IF NOT EXISTS idx_maint_centre ON hmis_equipment_maintenance (centre_id, status);

-- ============================================================
-- PM SCHEDULE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_equipment_pm_schedule (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id  uuid NOT NULL REFERENCES hmis_equipment(id) ON DELETE CASCADE,
  centre_id     uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  frequency     text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  checklist     jsonb DEFAULT '[]'::jsonb,
  last_done     date,
  next_due      date,
  assigned_to   text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_due ON hmis_equipment_pm_schedule (next_due) WHERE is_active = true;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_equipment_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_equipment_pm_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access equipment" ON hmis_equipment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access maintenance" ON hmis_equipment_maintenance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access pm schedule" ON hmis_equipment_pm_schedule FOR ALL USING (true) WITH CHECK (true);
