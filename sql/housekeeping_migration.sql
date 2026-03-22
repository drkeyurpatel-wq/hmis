-- housekeeping_migration.sql
-- Housekeeping tasks and schedules

-- ============================================================
-- HOUSEKEEPING TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_housekeeping_tasks (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  task_type       text NOT NULL CHECK (task_type IN ('routine','discharge','deep_clean','infection','spill','terminal')),
  area_type       text NOT NULL CHECK (area_type IN ('room','ward','ot','icu','common_area','toilet')),
  area_name       text NOT NULL,
  room_id         uuid,
  bed_id          uuid,
  priority        text NOT NULL DEFAULT 'routine' CHECK (priority IN ('emergency','high','routine')),
  assigned_to     uuid REFERENCES hmis_staff(id),
  requested_by    uuid REFERENCES hmis_staff(id),
  requested_at    timestamptz DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  verified_by     uuid REFERENCES hmis_staff(id),
  verified_at     timestamptz,
  checklist       jsonb DEFAULT '[]'::jsonb,
  chemicals_used  text[] DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','verified')),
  infection_type  varchar(100),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_centre ON hmis_housekeeping_tasks (centre_id, status);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status ON hmis_housekeeping_tasks (status, priority);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_bed ON hmis_housekeeping_tasks (bed_id) WHERE bed_id IS NOT NULL;

-- ============================================================
-- HOUSEKEEPING SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_housekeeping_schedules (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id     uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  area_name     text NOT NULL,
  area_type     text NOT NULL CHECK (area_type IN ('room','ward','ot','icu','common_area','toilet')),
  frequency     text NOT NULL CHECK (frequency IN ('every_shift','daily','twice_daily','weekly','monthly')),
  shift         text CHECK (shift IN ('morning','evening','night','all')),
  assigned_team text[] DEFAULT '{}',
  checklist     jsonb DEFAULT '[]'::jsonb,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_sched_centre ON hmis_housekeeping_schedules (centre_id, is_active);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_housekeeping_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access housekeeping tasks" ON hmis_housekeeping_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access housekeeping schedules" ON hmis_housekeeping_schedules FOR ALL USING (true) WITH CHECK (true);
