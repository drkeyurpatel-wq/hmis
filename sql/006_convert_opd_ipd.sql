-- ============================================================
-- HMIS Module: Convert (OPD→IPD Conversion Funnel)
-- Migration: 006_convert_opd_ipd.sql
-- Run on: Supabase bmuupgrzbfmddjwcqlss
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CONVERSION LEADS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hmis_conversion_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  -- Source consultation
  opd_visit_id UUID,                                -- link to hmis_opd_visits
  consulting_doctor_id UUID REFERENCES hmis_staff(id),
  department_id UUID REFERENCES hmis_departments(id),
  visit_date DATE NOT NULL,

  -- What was advised
  advised_procedure TEXT NOT NULL,                  -- "Lap Cholecystectomy", "Knee Replacement", "Angioplasty"
  advised_type TEXT DEFAULT 'ipd' CHECK (advised_type IN ('ipd', 'surgery', 'procedure', 'daycare', 'investigation')),
  diagnosis TEXT,
  icd_code TEXT,
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'soon', 'urgent', 'emergency')),
  estimated_cost NUMERIC(12,2),                    -- rough estimate shared with patient
  estimated_stay_days INT,

  -- Patient context
  patient_concern TEXT,                            -- "cost", "fear", "second_opinion", "time_off_work", "travel", "other"
  insurance_applicable BOOLEAN DEFAULT false,
  insurance_coverage_pct NUMERIC(5,1),

  -- Pipeline status
  status TEXT DEFAULT 'advised' CHECK (status IN (
    'advised',              -- doctor advised, no follow-up yet
    'contacted',            -- counselor reached out
    'interested',           -- patient expressed interest
    'scheduled',            -- date set for admission/procedure
    'admitted',             -- patient admitted (converted!)
    'completed',            -- procedure done
    'lost_cost',            -- patient declined due to cost
    'lost_fear',            -- patient declined due to anxiety/fear
    'lost_second_opinion',  -- went to another hospital
    'lost_no_response',     -- couldn't reach patient
    'lost_deferred',        -- patient wants to do it later (>3 months)
    'lost_other'            -- other reason
  )),

  -- Assignment
  assigned_counselor_id UUID REFERENCES hmis_staff(id),

  -- Conversion tracking
  admission_id UUID REFERENCES hmis_admissions(id),  -- set when converted
  conversion_days INT,                                -- days from advised → admitted
  revenue_generated NUMERIC(14,2),                    -- actual bill amount after completion

  -- Follow-up
  next_followup_date DATE,
  followup_count INT DEFAULT 0,
  last_followup_date DATE,
  last_followup_note TEXT,

  created_by UUID REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_centre ON hmis_conversion_leads(centre_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON hmis_conversion_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_patient ON hmis_conversion_leads(patient_id);
CREATE INDEX IF NOT EXISTS idx_leads_doctor ON hmis_conversion_leads(consulting_doctor_id);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON hmis_conversion_leads(next_followup_date)
  WHERE status IN ('advised', 'contacted', 'interested');
CREATE INDEX IF NOT EXISTS idx_leads_counselor ON hmis_conversion_leads(assigned_counselor_id);

ALTER TABLE hmis_conversion_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_read" ON hmis_conversion_leads FOR SELECT TO authenticated USING (
  centre_id IN (
    SELECT sc.centre_id FROM hmis_staff_centres sc
    JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid()
  )
);
CREATE POLICY "leads_insert" ON hmis_conversion_leads FOR INSERT TO authenticated WITH CHECK (
  centre_id IN (
    SELECT sc.centre_id FROM hmis_staff_centres sc
    JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid()
  )
);
CREATE POLICY "leads_update" ON hmis_conversion_leads FOR UPDATE TO authenticated USING (
  centre_id IN (
    SELECT sc.centre_id FROM hmis_staff_centres sc
    JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 2. FOLLOW-UP LOG
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hmis_conversion_followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES hmis_conversion_leads(id) ON DELETE CASCADE,

  action_type TEXT NOT NULL CHECK (action_type IN (
    'phone_call', 'whatsapp', 'sms', 'in_person', 'email', 'note'
  )),
  action_description TEXT NOT NULL,
  outcome TEXT CHECK (outcome IN (
    'interested', 'needs_time', 'cost_concern', 'wants_callback',
    'not_reachable', 'wrong_number', 'declined', 'scheduled', 'other'
  )),
  next_followup_date DATE,

  performed_by UUID NOT NULL REFERENCES hmis_staff(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversion_followups_lead ON hmis_conversion_followups(lead_id);

ALTER TABLE hmis_conversion_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followups_read" ON hmis_conversion_followups FOR SELECT TO authenticated USING (
  lead_id IN (
    SELECT l.id FROM hmis_conversion_leads l
    WHERE l.centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid()
    )
  )
);
CREATE POLICY "followups_insert" ON hmis_conversion_followups FOR INSERT TO authenticated WITH CHECK (
  lead_id IN (
    SELECT l.id FROM hmis_conversion_leads l
    WHERE l.centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid()
    )
  )
);

-- ────────────────────────────────────────────────────────────
-- 3. TRIGGERS
-- ────────────────────────────────────────────────────────────

-- Auto-update lead on followup logged
CREATE OR REPLACE FUNCTION on_conversion_followup_logged()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE hmis_conversion_leads SET
    followup_count = COALESCE(followup_count, 0) + 1,
    last_followup_date = CURRENT_DATE,
    last_followup_note = NEW.action_description,
    next_followup_date = COALESCE(NEW.next_followup_date, next_followup_date),
    status = CASE
      WHEN NEW.outcome = 'scheduled' THEN 'scheduled'
      WHEN NEW.outcome = 'interested' THEN 'interested'
      WHEN NEW.outcome = 'declined' THEN 'lost_other'
      WHEN status = 'advised' THEN 'contacted'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversion_followup
  AFTER INSERT ON hmis_conversion_followups
  FOR EACH ROW EXECUTE FUNCTION on_conversion_followup_logged();

-- Auto-mark as converted when admission is created for this patient+procedure
CREATE OR REPLACE FUNCTION check_conversion_on_admission()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE hmis_conversion_leads SET
    status = 'admitted',
    admission_id = NEW.id,
    conversion_days = CURRENT_DATE - visit_date,
    updated_at = now()
  WHERE patient_id = NEW.patient_id
    AND centre_id = NEW.centre_id
    AND status IN ('advised', 'contacted', 'interested', 'scheduled')
    AND visit_date >= CURRENT_DATE - 180;  -- within 6 months
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_conversion
  AFTER INSERT ON hmis_admissions
  FOR EACH ROW EXECUTE FUNCTION check_conversion_on_admission();

-- ────────────────────────────────────────────────────────────
-- 4. RPCs
-- ────────────────────────────────────────────────────────────

-- 4a. Conversion funnel summary
CREATE OR REPLACE FUNCTION get_conversion_funnel(
  p_centre_id UUID DEFAULT NULL,
  p_from DATE DEFAULT CURRENT_DATE - 90,
  p_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  status TEXT,
  lead_count BIGINT,
  total_estimated_revenue NUMERIC,
  avg_days_in_stage NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.status,
    COUNT(*) AS lead_count,
    COALESCE(SUM(l.estimated_cost), 0) AS total_estimated_revenue,
    ROUND(AVG(CURRENT_DATE - l.visit_date), 0) AS avg_days_in_stage
  FROM hmis_conversion_leads l
  WHERE l.visit_date BETWEEN p_from AND p_to
    AND (p_centre_id IS NULL OR l.centre_id = p_centre_id)
  GROUP BY l.status
  ORDER BY
    CASE l.status
      WHEN 'advised' THEN 1 WHEN 'contacted' THEN 2 WHEN 'interested' THEN 3
      WHEN 'scheduled' THEN 4 WHEN 'admitted' THEN 5 WHEN 'completed' THEN 6
      ELSE 7
    END;
END;
$$;

-- 4b. Daily counselor task list
CREATE OR REPLACE FUNCTION get_conversion_tasks(
  p_centre_id UUID DEFAULT NULL,
  p_counselor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  lead_id UUID,
  patient_name TEXT,
  patient_phone TEXT,
  patient_uhid TEXT,
  doctor_name TEXT,
  department TEXT,
  advised_procedure TEXT,
  urgency TEXT,
  estimated_cost NUMERIC,
  status TEXT,
  days_since_advised INT,
  followup_count INT,
  last_followup_date DATE,
  next_followup_date DATE,
  task_reason TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS lead_id,
    CONCAT(p.first_name, ' ', p.last_name)::TEXT AS patient_name,
    p.phone_primary::TEXT AS patient_phone,
    p.uhid::TEXT AS patient_uhid,
    s.full_name::TEXT AS doctor_name,
    d.name::TEXT AS department,
    l.advised_procedure,
    l.urgency,
    l.estimated_cost,
    l.status,
    (CURRENT_DATE - l.visit_date)::INT AS days_since_advised,
    COALESCE(l.followup_count, 0) AS followup_count,
    l.last_followup_date,
    l.next_followup_date,
    CASE
      WHEN l.next_followup_date <= CURRENT_DATE THEN 'Scheduled follow-up due'
      WHEN l.status = 'advised' AND l.followup_count = 0 THEN 'Never contacted — call today'
      WHEN l.status = 'advised' AND (CURRENT_DATE - l.visit_date) > 7 THEN 'Advised 7+ days ago — urgent'
      WHEN l.status = 'interested' AND (CURRENT_DATE - COALESCE(l.last_followup_date, l.visit_date)) > 3 THEN 'Interested but no contact in 3 days'
      WHEN l.urgency IN ('urgent', 'emergency') THEN 'Urgency: ' || l.urgency
      ELSE 'Routine follow-up'
    END::TEXT AS task_reason
  FROM hmis_conversion_leads l
  JOIN hmis_patients p ON p.id = l.patient_id
  LEFT JOIN hmis_staff s ON s.id = l.consulting_doctor_id
  LEFT JOIN hmis_departments d ON d.id = l.department_id
  WHERE l.status IN ('advised', 'contacted', 'interested', 'scheduled')
    AND (p_centre_id IS NULL OR l.centre_id = p_centre_id)
    AND (p_counselor_id IS NULL OR l.assigned_counselor_id = p_counselor_id)
  ORDER BY
    CASE l.urgency WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 WHEN 'soon' THEN 3 ELSE 4 END,
    l.followup_count ASC,
    l.visit_date ASC;
END;
$$;

-- 4c. Doctor-wise conversion rate
CREATE OR REPLACE FUNCTION get_doctor_conversion_rates(
  p_centre_id UUID DEFAULT NULL,
  p_from DATE DEFAULT CURRENT_DATE - 90,
  p_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  doctor_id UUID,
  doctor_name TEXT,
  department TEXT,
  total_advised BIGINT,
  total_converted BIGINT,
  conversion_rate NUMERIC,
  total_lost BIGINT,
  top_loss_reason TEXT,
  estimated_lost_revenue NUMERIC,
  actual_converted_revenue NUMERIC,
  avg_conversion_days NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.consulting_doctor_id AS doctor_id,
    s.full_name::TEXT AS doctor_name,
    d.name::TEXT AS department,
    COUNT(*) AS total_advised,
    COUNT(*) FILTER (WHERE l.status IN ('admitted', 'completed')) AS total_converted,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE l.status IN ('admitted', 'completed'))::NUMERIC / COUNT(*) * 100, 1)
      ELSE 0 END AS conversion_rate,
    COUNT(*) FILTER (WHERE l.status LIKE 'lost_%') AS total_lost,
    MODE() WITHIN GROUP (ORDER BY l.status) FILTER (WHERE l.status LIKE 'lost_%') AS top_loss_reason,
    COALESCE(SUM(l.estimated_cost) FILTER (WHERE l.status LIKE 'lost_%'), 0) AS estimated_lost_revenue,
    COALESCE(SUM(l.revenue_generated) FILTER (WHERE l.status IN ('admitted', 'completed')), 0) AS actual_converted_revenue,
    ROUND(AVG(l.conversion_days) FILTER (WHERE l.conversion_days IS NOT NULL), 0) AS avg_conversion_days
  FROM hmis_conversion_leads l
  JOIN hmis_staff s ON s.id = l.consulting_doctor_id
  LEFT JOIN hmis_departments d ON d.id = l.department_id
  WHERE l.visit_date BETWEEN p_from AND p_to
    AND (p_centre_id IS NULL OR l.centre_id = p_centre_id)
  GROUP BY l.consulting_doctor_id, s.full_name, d.name
  ORDER BY COUNT(*) DESC;
END;
$$;
