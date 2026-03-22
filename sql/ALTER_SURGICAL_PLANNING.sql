-- ============================================================
-- MODULE: Pre-Admission & Surgical Planning
-- Tracks readiness pipeline from surgery decision to OT clearance
-- ============================================================

-- Main planning case — one per OT booking
CREATE TABLE IF NOT EXISTS hmis_surgical_planning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  ot_booking_id UUID NOT NULL REFERENCES hmis_ot_bookings(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  surgeon_id UUID REFERENCES hmis_staff(id),
  planned_date DATE NOT NULL,
  procedure_name VARCHAR(500) NOT NULL,
  priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','emergency')),
  overall_status VARCHAR(20) DEFAULT 'planning' CHECK (overall_status IN ('planning','ready','blocked','cancelled','completed')),
  readiness_pct NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  cleared_by UUID REFERENCES hmis_staff(id),
  cleared_at TIMESTAMPTZ,
  created_by UUID REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual checklist items per planning case
CREATE TABLE IF NOT EXISTS hmis_surgical_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id UUID NOT NULL REFERENCES hmis_surgical_planning(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'pre_op_investigation','anaesthesia_fitness','insurance_preauth',
    'consent','blood_arrangement','cssd_booking','ot_slot','bed_reservation','custom'
  )),
  item_name VARCHAR(300) NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','waived','blocked')),
  assigned_to UUID REFERENCES hmis_staff(id),
  due_date DATE,
  actual_date DATE,
  remarks TEXT,
  -- FK links to related entities
  lab_order_id UUID,        -- links to hmis_lab_orders
  pre_auth_id UUID,         -- links to hmis_pre_auth_requests
  consent_id UUID,          -- links to hmis_consents
  cssd_issue_id UUID,       -- links to hmis_cssd_issue_return
  bed_id UUID,              -- links to hmis_beds
  completed_by UUID REFERENCES hmis_staff(id),
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_surgical_planning_centre ON hmis_surgical_planning(centre_id);
CREATE INDEX IF NOT EXISTS idx_surgical_planning_booking ON hmis_surgical_planning(ot_booking_id);
CREATE INDEX IF NOT EXISTS idx_surgical_planning_patient ON hmis_surgical_planning(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgical_planning_status ON hmis_surgical_planning(overall_status);
CREATE INDEX IF NOT EXISTS idx_surgical_planning_date ON hmis_surgical_planning(planned_date);
CREATE INDEX IF NOT EXISTS idx_surgical_checklist_planning ON hmis_surgical_checklist_items(planning_id);
CREATE INDEX IF NOT EXISTS idx_surgical_checklist_status ON hmis_surgical_checklist_items(status);

-- RLS
ALTER TABLE hmis_surgical_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_surgical_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS surgical_planning_tenant ON hmis_surgical_planning;
CREATE POLICY surgical_planning_tenant ON hmis_surgical_planning
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));

DROP POLICY IF EXISTS surgical_checklist_tenant ON hmis_surgical_checklist_items;
CREATE POLICY surgical_checklist_tenant ON hmis_surgical_checklist_items
  USING (centre_id IN (SELECT centre_id FROM hmis_staff_centres WHERE staff_id = auth.uid()));
