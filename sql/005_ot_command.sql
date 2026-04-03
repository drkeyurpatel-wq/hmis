-- ============================================================
-- HMIS Module: OT Command
-- Migration: 005_ot_command.sql
-- Run on: Supabase bmuupgrzbfmddjwcqlss
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. EXTEND hmis_ot_bookings with utilization tracking fields
-- ────────────────────────────────────────────────────────────

-- Turnaround tracking (time between cases in same OT)
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS patient_in_time TIMESTAMPTZ;       -- patient enters OT
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS anaesthesia_start TIMESTAMPTZ;     -- induction start
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS incision_time TIMESTAMPTZ;         -- knife-to-skin
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS closure_time TIMESTAMPTZ;          -- last suture
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS patient_out_time TIMESTAMPTZ;      -- patient leaves OT
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS room_ready_time TIMESTAMPTZ;       -- OT cleaned and ready for next

-- Delay tracking
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS delay_minutes INT DEFAULT 0;
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS delay_reason TEXT CHECK (delay_reason IN (
  'surgeon_late', 'patient_not_ready', 'anaesthesia_delay', 'equipment_issue',
  'previous_case_overrun', 'consent_pending', 'lab_pending', 'blood_not_ready',
  'ot_cleaning', 'emergency_bumped', 'patient_cancelled', 'other'
));
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS postponed_to DATE;

-- Scoring
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS complexity_score INT CHECK (complexity_score BETWEEN 1 AND 5);
ALTER TABLE hmis_ot_bookings ADD COLUMN IF NOT EXISTS asa_grade TEXT CHECK (asa_grade IN ('I', 'II', 'III', 'IV', 'V', 'VI'));

-- ────────────────────────────────────────────────────────────
-- 2. OT DAILY SNAPSHOTS (aggregated metrics per OT room per day)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hmis_ot_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  ot_room_id UUID NOT NULL REFERENCES hmis_ot_rooms(id),
  stat_date DATE NOT NULL,

  -- Volume
  total_cases INT DEFAULT 0,
  completed_cases INT DEFAULT 0,
  cancelled_cases INT DEFAULT 0,
  emergency_cases INT DEFAULT 0,
  robotic_cases INT DEFAULT 0,

  -- Time utilization (in minutes)
  available_minutes INT DEFAULT 600,           -- configurable: default 10 hrs/day
  utilized_minutes INT DEFAULT 0,              -- sum of actual surgery durations
  turnaround_minutes INT DEFAULT 0,            -- sum of gaps between cases
  idle_minutes INT DEFAULT 0,                  -- available - utilized - turnaround
  utilization_pct NUMERIC(5,1) DEFAULT 0,      -- (utilized / available) x 100

  -- Performance
  first_case_on_time BOOLEAN,                  -- did first case start within 15 min of scheduled?
  avg_delay_minutes NUMERIC(5,1) DEFAULT 0,
  avg_turnaround_minutes NUMERIC(5,1) DEFAULT 0,  -- time between patient_out and next patient_in
  longest_case_minutes INT DEFAULT 0,

  -- Revenue (from billing, if available)
  total_ot_revenue NUMERIC(14,2) DEFAULT 0,
  revenue_per_ot_hour NUMERIC(10,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ot_room_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_ot_stats_centre ON hmis_ot_daily_stats(centre_id, stat_date);

ALTER TABLE hmis_ot_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ot_stats_read" ON hmis_ot_daily_stats FOR SELECT TO authenticated USING (
  centre_id IN (
    SELECT sc.centre_id FROM hmis_staff_centres sc
    JOIN hmis_staff s ON s.id = sc.staff_id WHERE s.auth_user_id = auth.uid()
  )
);
CREATE POLICY "ot_stats_write" ON hmis_ot_daily_stats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ot_stats_update" ON hmis_ot_daily_stats FOR UPDATE TO authenticated USING (true);

-- ────────────────────────────────────────────────────────────
-- 3. RPCs
-- ────────────────────────────────────────────────────────────

-- 3a. Generate daily OT stats for a centre
CREATE OR REPLACE FUNCTION generate_ot_daily_stats(
  p_centre_id UUID,
  p_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room RECORD;
  v_count INT := 0;
  v_cases INT; v_completed INT; v_cancelled INT; v_emergency INT; v_robotic INT;
  v_utilized INT; v_turnaround INT; v_available INT;
  v_avg_delay NUMERIC; v_avg_ta NUMERIC; v_longest INT;
  v_first_on_time BOOLEAN;
BEGIN
  FOR v_room IN SELECT id, name FROM hmis_ot_rooms WHERE centre_id = p_centre_id AND is_active = true
  LOOP
    -- Count cases
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*) FILTER (WHERE status = 'cancelled'),
      COUNT(*) FILTER (WHERE is_emergency = true),
      COUNT(*) FILTER (WHERE is_robotic = true)
    INTO v_cases, v_completed, v_cancelled, v_emergency, v_robotic
    FROM hmis_ot_bookings
    WHERE ot_room_id = v_room.id AND scheduled_date = p_date;

    -- Utilization (from actual times)
    SELECT
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(actual_end, patient_out_time) - COALESCE(actual_start, patient_in_time))) / 60), 0)::INT,
      COALESCE(AVG(delay_minutes), 0),
      COALESCE(MAX(EXTRACT(EPOCH FROM (COALESCE(actual_end, patient_out_time) - COALESCE(actual_start, patient_in_time))) / 60), 0)::INT
    INTO v_utilized, v_avg_delay, v_longest
    FROM hmis_ot_bookings
    WHERE ot_room_id = v_room.id AND scheduled_date = p_date AND status = 'completed';

    -- Turnaround (gap between consecutive cases)
    WITH ordered AS (
      SELECT patient_out_time, patient_in_time,
        LAG(patient_out_time) OVER (ORDER BY scheduled_start) AS prev_out
      FROM hmis_ot_bookings
      WHERE ot_room_id = v_room.id AND scheduled_date = p_date AND status = 'completed'
    )
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (patient_in_time - prev_out)) / 60), 0)::INT,
           COALESCE(AVG(EXTRACT(EPOCH FROM (patient_in_time - prev_out)) / 60), 0)
    INTO v_turnaround, v_avg_ta
    FROM ordered WHERE prev_out IS NOT NULL;

    v_available := 600;  -- default 10 hours, make configurable later

    -- First case on time?
    SELECT (EXTRACT(EPOCH FROM (COALESCE(actual_start, patient_in_time) -
      (p_date + scheduled_start)::TIMESTAMPTZ)) / 60) <= 15
    INTO v_first_on_time
    FROM hmis_ot_bookings
    WHERE ot_room_id = v_room.id AND scheduled_date = p_date AND status = 'completed'
    ORDER BY scheduled_start LIMIT 1;

    -- Upsert
    INSERT INTO hmis_ot_daily_stats (
      centre_id, ot_room_id, stat_date,
      total_cases, completed_cases, cancelled_cases, emergency_cases, robotic_cases,
      available_minutes, utilized_minutes, turnaround_minutes,
      idle_minutes, utilization_pct,
      first_case_on_time, avg_delay_minutes, avg_turnaround_minutes, longest_case_minutes
    ) VALUES (
      p_centre_id, v_room.id, p_date,
      v_cases, v_completed, v_cancelled, v_emergency, v_robotic,
      v_available, v_utilized, v_turnaround,
      GREATEST(v_available - v_utilized - v_turnaround, 0),
      CASE WHEN v_available > 0 THEN ROUND(v_utilized::NUMERIC / v_available * 100, 1) ELSE 0 END,
      v_first_on_time, v_avg_delay, v_avg_ta, v_longest
    )
    ON CONFLICT (ot_room_id, stat_date) DO UPDATE SET
      total_cases = EXCLUDED.total_cases,
      completed_cases = EXCLUDED.completed_cases,
      cancelled_cases = EXCLUDED.cancelled_cases,
      emergency_cases = EXCLUDED.emergency_cases,
      robotic_cases = EXCLUDED.robotic_cases,
      utilized_minutes = EXCLUDED.utilized_minutes,
      turnaround_minutes = EXCLUDED.turnaround_minutes,
      idle_minutes = EXCLUDED.idle_minutes,
      utilization_pct = EXCLUDED.utilization_pct,
      first_case_on_time = EXCLUDED.first_case_on_time,
      avg_delay_minutes = EXCLUDED.avg_delay_minutes,
      avg_turnaround_minutes = EXCLUDED.avg_turnaround_minutes,
      longest_case_minutes = EXCLUDED.longest_case_minutes;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 3b. OT Command dashboard summary
CREATE OR REPLACE FUNCTION get_ot_command_dashboard(
  p_centre_id UUID,
  p_from DATE DEFAULT CURRENT_DATE - 30,
  p_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  ot_room_name TEXT,
  ot_room_id UUID,
  total_cases BIGINT,
  completed_cases BIGINT,
  cancelled_cases BIGINT,
  emergency_pct NUMERIC,
  avg_utilization NUMERIC,
  avg_turnaround NUMERIC,
  avg_delay NUMERIC,
  first_case_on_time_pct NUMERIC,
  total_ot_hours NUMERIC,
  cancellation_rate NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.name::TEXT AS ot_room_name,
    r.id AS ot_room_id,
    COALESCE(SUM(s.total_cases), 0) AS total_cases,
    COALESCE(SUM(s.completed_cases), 0) AS completed_cases,
    COALESCE(SUM(s.cancelled_cases), 0) AS cancelled_cases,
    CASE WHEN SUM(s.total_cases) > 0
      THEN ROUND(SUM(s.emergency_cases)::NUMERIC / SUM(s.total_cases) * 100, 1)
      ELSE 0 END AS emergency_pct,
    ROUND(AVG(s.utilization_pct), 1) AS avg_utilization,
    ROUND(AVG(s.avg_turnaround_minutes), 0) AS avg_turnaround,
    ROUND(AVG(s.avg_delay_minutes), 0) AS avg_delay,
    CASE WHEN COUNT(s.first_case_on_time) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE s.first_case_on_time = true)::NUMERIC / COUNT(s.first_case_on_time) * 100, 1)
      ELSE 0 END AS first_case_on_time_pct,
    ROUND(COALESCE(SUM(s.utilized_minutes), 0) / 60.0, 1) AS total_ot_hours,
    CASE WHEN SUM(s.total_cases) > 0
      THEN ROUND(SUM(s.cancelled_cases)::NUMERIC / SUM(s.total_cases) * 100, 1)
      ELSE 0 END AS cancellation_rate
  FROM hmis_ot_rooms r
  LEFT JOIN hmis_ot_daily_stats s ON s.ot_room_id = r.id AND s.stat_date BETWEEN p_from AND p_to
  WHERE r.centre_id = p_centre_id AND r.is_active = true
  GROUP BY r.id, r.name
  ORDER BY r.name;
END;
$$;

-- 3c. Surgeon performance
CREATE OR REPLACE FUNCTION get_surgeon_performance(
  p_centre_id UUID,
  p_from DATE DEFAULT CURRENT_DATE - 30,
  p_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  surgeon_id UUID,
  surgeon_name TEXT,
  total_cases BIGINT,
  completed_cases BIGINT,
  avg_duration_min NUMERIC,
  total_ot_hours NUMERIC,
  emergency_cases BIGINT,
  robotic_cases BIGINT,
  cancellation_rate NUMERIC,
  avg_delay_min NUMERIC,
  on_time_pct NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.surgeon_id,
    s.full_name::TEXT AS surgeon_name,
    COUNT(*) AS total_cases,
    COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_cases,
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(b.actual_end, b.patient_out_time) - COALESCE(b.actual_start, b.patient_in_time))) / 60)
      FILTER (WHERE b.status = 'completed'), 0) AS avg_duration_min,
    ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(b.actual_end, b.patient_out_time) - COALESCE(b.actual_start, b.patient_in_time))) / 3600)
      FILTER (WHERE b.status = 'completed'), 1) AS total_ot_hours,
    COUNT(*) FILTER (WHERE b.is_emergency = true) AS emergency_cases,
    COUNT(*) FILTER (WHERE b.is_robotic = true) AS robotic_cases,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE b.status = 'cancelled')::NUMERIC / COUNT(*) * 100, 1)
      ELSE 0 END AS cancellation_rate,
    ROUND(AVG(b.delay_minutes) FILTER (WHERE b.status = 'completed'), 0) AS avg_delay_min,
    CASE WHEN COUNT(*) FILTER (WHERE b.status = 'completed') > 0
      THEN ROUND(COUNT(*) FILTER (WHERE b.status = 'completed' AND COALESCE(b.delay_minutes, 0) <= 15)::NUMERIC /
        COUNT(*) FILTER (WHERE b.status = 'completed') * 100, 1)
      ELSE 0 END AS on_time_pct
  FROM hmis_ot_bookings b
  JOIN hmis_staff s ON s.id = b.surgeon_id
  JOIN hmis_ot_rooms r ON r.id = b.ot_room_id
  WHERE r.centre_id = p_centre_id AND b.scheduled_date BETWEEN p_from AND p_to
  GROUP BY b.surgeon_id, s.full_name
  ORDER BY COUNT(*) DESC;
END;
$$;

-- 3d. Tomorrow's gap prediction
CREATE OR REPLACE FUNCTION get_ot_gaps_tomorrow(
  p_centre_id UUID,
  p_date DATE DEFAULT CURRENT_DATE + 1
)
RETURNS TABLE (
  ot_room_name TEXT,
  ot_room_id UUID,
  scheduled_cases INT,
  total_scheduled_minutes INT,
  available_minutes INT,
  gap_minutes INT,
  gap_pct NUMERIC,
  first_case_time TIME,
  last_case_end_time TIME,
  has_gap_over_60 BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.name::TEXT,
    r.id,
    COUNT(*)::INT AS scheduled_cases,
    COALESCE(SUM(b.estimated_duration_min), 0)::INT AS total_scheduled_minutes,
    600 AS available_minutes,
    GREATEST(600 - COALESCE(SUM(b.estimated_duration_min), 0)::INT, 0) AS gap_minutes,
    ROUND(GREATEST(600 - COALESCE(SUM(b.estimated_duration_min), 0), 0)::NUMERIC / 600 * 100, 1) AS gap_pct,
    MIN(b.scheduled_start) AS first_case_time,
    MAX(b.scheduled_start + (b.estimated_duration_min || ' minutes')::INTERVAL)::TIME AS last_case_end_time,
    EXISTS(
      SELECT 1 FROM (
        SELECT b2.scheduled_start,
          LAG(b2.scheduled_start + (b2.estimated_duration_min || ' minutes')::INTERVAL) OVER (ORDER BY b2.scheduled_start) AS prev_end
        FROM hmis_ot_bookings b2
        WHERE b2.ot_room_id = r.id AND b2.scheduled_date = p_date AND b2.status NOT IN ('cancelled')
      ) gaps
      WHERE EXTRACT(EPOCH FROM (gaps.scheduled_start - gaps.prev_end)) / 60 > 60
    ) AS has_gap_over_60
  FROM hmis_ot_rooms r
  LEFT JOIN hmis_ot_bookings b ON b.ot_room_id = r.id
    AND b.scheduled_date = p_date AND b.status NOT IN ('cancelled')
  WHERE r.centre_id = p_centre_id AND r.is_active = true
  GROUP BY r.id, r.name
  ORDER BY r.name;
END;
$$;
