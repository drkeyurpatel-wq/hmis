-- ============================================================
-- MODULE: Staff Duty Roster
-- Operational shift scheduling — who is working where tonight
-- ============================================================

-- Shift type definitions per centre
CREATE TABLE IF NOT EXISTS hmis_shift_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  shift_name VARCHAR(100) NOT NULL,
  shift_code VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_night_shift BOOLEAN DEFAULT false,
  color VARCHAR(20) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Minimum staffing requirements per ward per shift
CREATE TABLE IF NOT EXISTS hmis_staffing_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  ward_id UUID NOT NULL REFERENCES hmis_wards(id),
  shift_id UUID NOT NULL REFERENCES hmis_shift_definitions(id),
  staff_type VARCHAR(50) NOT NULL CHECK (staff_type IN ('doctor','nurse','technician','support')),
  min_count INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ward_id, shift_id, staff_type)
);

-- Monthly roster — one row per staff per day
CREATE TABLE IF NOT EXISTS hmis_duty_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  staff_id UUID NOT NULL REFERENCES hmis_staff(id),
  ward_id UUID NOT NULL REFERENCES hmis_wards(id),
  shift_id UUID REFERENCES hmis_shift_definitions(id),
  roster_date DATE NOT NULL,
  shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('morning','afternoon','night','general','off','leave','custom')),
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  overtime_minutes INT DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, roster_date)
);

-- Swap requests
CREATE TABLE IF NOT EXISTS hmis_duty_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  requester_id UUID NOT NULL REFERENCES hmis_staff(id),
  target_id UUID NOT NULL REFERENCES hmis_staff(id),
  roster_id_requester UUID NOT NULL REFERENCES hmis_duty_roster(id),
  roster_id_target UUID NOT NULL REFERENCES hmis_duty_roster(id),
  swap_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID REFERENCES hmis_staff(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shift_def_centre ON hmis_shift_definitions(centre_id);
CREATE INDEX IF NOT EXISTS idx_staffing_req_ward ON hmis_staffing_requirements(ward_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_duty_roster_centre_date ON hmis_duty_roster(centre_id, roster_date);
CREATE INDEX IF NOT EXISTS idx_duty_roster_staff ON hmis_duty_roster(staff_id, roster_date);
CREATE INDEX IF NOT EXISTS idx_duty_roster_ward ON hmis_duty_roster(ward_id, roster_date);
CREATE INDEX IF NOT EXISTS idx_duty_swap_centre ON hmis_duty_swap_requests(centre_id, status);

-- RLS
ALTER TABLE hmis_shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_staffing_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_duty_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_duty_swap_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shift_def_tenant ON hmis_shift_definitions;
CREATE POLICY shift_def_tenant ON hmis_shift_definitions
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS staffing_req_tenant ON hmis_staffing_requirements;
CREATE POLICY staffing_req_tenant ON hmis_staffing_requirements
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS duty_roster_tenant ON hmis_duty_roster;
CREATE POLICY duty_roster_tenant ON hmis_duty_roster
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS duty_swap_tenant ON hmis_duty_swap_requests;
CREATE POLICY duty_swap_tenant ON hmis_duty_swap_requests
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

-- Seed default shifts
INSERT INTO hmis_shift_definitions (centre_id, shift_name, shift_code, start_time, end_time, is_night_shift, color)
SELECT c.id, s.shift_name, s.shift_code, s.start_time, s.end_time, s.is_night, s.color
FROM hmis_centres c
CROSS JOIN (VALUES
  ('Morning', 'M', '08:00'::TIME, '14:00'::TIME, false, '#22C55E'),
  ('Afternoon', 'A', '14:00'::TIME, '20:00'::TIME, false, '#F59E0B'),
  ('Night', 'N', '20:00'::TIME, '08:00'::TIME, true, '#6366F1'),
  ('General', 'G', '09:00'::TIME, '17:00'::TIME, false, '#3B82F6'),
  ('Off', 'O', '00:00'::TIME, '00:00'::TIME, false, '#9CA3AF')
) AS s(shift_name, shift_code, start_time, end_time, is_night, color)
WHERE NOT EXISTS (SELECT 1 FROM hmis_shift_definitions WHERE centre_id = c.id AND shift_code = s.shift_code);
