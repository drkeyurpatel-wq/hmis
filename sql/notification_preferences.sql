-- notification_preferences.sql
-- Stores per-centre notification preferences (which events trigger WhatsApp / SMS / email)
-- Also creates a log table for audit trail

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_notification_preferences (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id     uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  event_type    text NOT NULL CHECK (event_type IN (
    'appointment_reminder', 'lab_ready', 'pharmacy_ready', 'discharge_summary',
    'opd_token', 'payment_receipt', 'follow_up_reminder'
  )),
  channel       text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  is_enabled    boolean NOT NULL DEFAULT true,
  template_text text,  -- optional custom template override
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  UNIQUE (centre_id, event_type, channel)
);

COMMENT ON TABLE hmis_notification_preferences IS 'Per-centre toggle for notification events and channels';

-- Index for fast lookup in API route
CREATE INDEX IF NOT EXISTS idx_notif_pref_lookup
  ON hmis_notification_preferences (centre_id, event_type, channel);

-- ============================================================
-- NOTIFICATION LOG (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_notification_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id     uuid REFERENCES hmis_centres(id),
  event_type    text NOT NULL,
  channel       text NOT NULL DEFAULT 'whatsapp',
  phone         text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  message_id    text,        -- WhatsApp message ID from Meta API
  error_message text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_centre_date
  ON hmis_notification_log (centre_id, created_at DESC);

-- ============================================================
-- SEED DEFAULT PREFERENCES (one row per event per centre)
-- ============================================================
INSERT INTO hmis_notification_preferences (centre_id, event_type, channel, is_enabled, template_text)
SELECT
  c.id,
  ev.event_type,
  'whatsapp',
  true,
  ev.default_template
FROM hmis_centres c
CROSS JOIN (VALUES
  ('appointment_reminder', 'Hello {{patient_name}}, reminder for your appointment with {{doctor_name}} on {{date}} at {{time}} at {{centre_name}}.'),
  ('lab_ready',            'Hello {{patient_name}}, your lab results for {{test_names}} are ready. Collect from {{collection_point}}.'),
  ('pharmacy_ready',       'Hello {{patient_name}}, your {{medicine_count}} medicines are ready at {{pharmacy_counter}}.'),
  ('discharge_summary',    'Hello {{patient_name}}, IPD# {{ipd_number}} discharge on {{discharge_date}}. Follow-up: {{follow_up_date}}.'),
  ('opd_token',            'Hello {{patient_name}}, your token is {{token_number}}. Doctor: {{doctor_name}}. Wait: {{estimated_wait}}.'),
  ('payment_receipt',      'Hello {{patient_name}}, payment received. Receipt: {{receipt_number}}, Amount: {{amount}}, Mode: {{payment_mode}}.'),
  ('follow_up_reminder',   'Hello {{patient_name}}, follow-up with {{doctor_name}} on {{date}} at {{centre_name}}. {{advice}}')
) AS ev(event_type, default_template)
ON CONFLICT (centre_id, event_type, channel) DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view notification preferences"
  ON hmis_notification_preferences FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage notification preferences"
  ON hmis_notification_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can view notification log"
  ON hmis_notification_log FOR SELECT
  USING (true);

CREATE POLICY "System can insert notification log"
  ON hmis_notification_log FOR INSERT
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_notif_pref_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notif_pref_updated_at
  BEFORE UPDATE ON hmis_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_notif_pref_updated_at();
