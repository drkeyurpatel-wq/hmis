-- ============================================================
-- MODULE: Smart Bed Turnover
-- Tracks workflow: discharge → housekeeping → inspection → available → next admission
-- ============================================================

-- Main turnover workflow — one per bed discharge event
CREATE TABLE IF NOT EXISTS hmis_bed_turnover (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  bed_id UUID NOT NULL REFERENCES hmis_beds(id),
  room_id UUID REFERENCES hmis_rooms(id),
  ward_id UUID REFERENCES hmis_wards(id),
  -- Discharge info
  discharged_admission_id UUID REFERENCES hmis_admissions(id),
  discharge_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharge_confirmed_by UUID REFERENCES hmis_staff(id),
  -- Housekeeping
  hk_task_id UUID REFERENCES hmis_housekeeping_tasks(id),
  hk_assigned_to UUID REFERENCES hmis_staff(id),
  hk_started_at TIMESTAMPTZ,
  hk_completed_at TIMESTAMPTZ,
  hk_checklist JSONB DEFAULT '[
    {"item":"Bed stripped & linen removed","done":false},
    {"item":"Mattress sanitized","done":false},
    {"item":"Bed frame wiped down","done":false},
    {"item":"Fresh linen placed","done":false},
    {"item":"Bathroom cleaned","done":false},
    {"item":"Floor mopped","done":false},
    {"item":"Equipment checked & functional","done":false},
    {"item":"Bedside table sanitized","done":false},
    {"item":"Waste bin replaced","done":false},
    {"item":"Call bell tested","done":false}
  ]'::jsonb,
  -- Inspection
  inspected_by UUID REFERENCES hmis_staff(id),
  inspected_at TIMESTAMPTZ,
  inspection_passed BOOLEAN,
  inspection_remarks TEXT,
  -- Availability
  bed_available_at TIMESTAMPTZ,
  -- Next admission
  next_admission_id UUID REFERENCES hmis_admissions(id),
  next_patient_notified_at TIMESTAMPTZ,
  -- SLA
  sla_target_minutes INT DEFAULT 45,
  total_turnaround_minutes INT,
  sla_status VARCHAR(20) DEFAULT 'on_track' CHECK (sla_status IN ('on_track','warning','breached')),
  -- Status
  status VARCHAR(30) DEFAULT 'housekeeping_pending' CHECK (status IN (
    'housekeeping_pending','housekeeping_in_progress','housekeeping_done',
    'inspection_pending','inspection_failed','ready','assigned','completed'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Waitlist for beds — patients waiting for a specific ward/type
CREATE TABLE IF NOT EXISTS hmis_bed_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  ward_id UUID REFERENCES hmis_wards(id),
  bed_type VARCHAR(50) DEFAULT 'general',
  priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('emergency','urgent','routine')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  requested_by UUID REFERENCES hmis_staff(id),
  assigned_bed_id UUID REFERENCES hmis_beds(id),
  assigned_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting','notified','assigned','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bed_turnover_centre ON hmis_bed_turnover(centre_id);
CREATE INDEX IF NOT EXISTS idx_bed_turnover_bed ON hmis_bed_turnover(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_turnover_status ON hmis_bed_turnover(status);
CREATE INDEX IF NOT EXISTS idx_bed_turnover_sla ON hmis_bed_turnover(sla_status);
CREATE INDEX IF NOT EXISTS idx_bed_waitlist_centre ON hmis_bed_waitlist(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_bed_waitlist_ward ON hmis_bed_waitlist(ward_id, status);

-- RLS
ALTER TABLE hmis_bed_turnover ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_bed_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bed_turnover_tenant ON hmis_bed_turnover;
CREATE POLICY bed_turnover_tenant ON hmis_bed_turnover
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS bed_waitlist_tenant ON hmis_bed_waitlist;
CREATE POLICY bed_waitlist_tenant ON hmis_bed_waitlist
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));
