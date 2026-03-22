-- report_subscriptions.sql
-- Automated report email subscriptions

CREATE TABLE IF NOT EXISTS hmis_report_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id   uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  email       text NOT NULL,
  report_type text NOT NULL DEFAULT 'daily_summary' CHECK (report_type IN (
    'daily_summary', 'revenue', 'occupancy', 'lab_tat', 'pharmacy',
    'doctor_performance', 'discharge_tat', 'insurance', 'weekly_summary', 'monthly_summary'
  )),
  frequency   text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  is_active   boolean DEFAULT true,
  last_sent_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_report_subscriptions IS 'Email recipients for automated daily/weekly/monthly reports';

CREATE INDEX IF NOT EXISTS idx_report_subs_active
  ON hmis_report_subscriptions (is_active, frequency);

-- Seed default subscription
INSERT INTO hmis_report_subscriptions (centre_id, email, report_type, frequency, is_active)
SELECT
  c.id,
  'keyaboratory@gmail.com',
  'daily_summary',
  'daily',
  true
FROM hmis_centres c
WHERE c.code = 'SHL' OR c.name ILIKE '%shilaj%'
LIMIT 1
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE hmis_report_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view report subscriptions"
  ON hmis_report_subscriptions FOR SELECT USING (true);

CREATE POLICY "Staff can manage report subscriptions"
  ON hmis_report_subscriptions FOR ALL USING (true) WITH CHECK (true);
