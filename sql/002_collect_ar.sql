-- ============================================================
-- 002_collect_ar.sql — AR Tracker (Collect Module)
-- Extends hmis_claims with AR tracking fields,
-- adds ar_claim_followups, ar_claim_queries tables,
-- and RPCs for dashboard aggregation.
-- ============================================================

-- 1. Extend hmis_claims with AR tracking columns
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS centre_id uuid REFERENCES hmis_centres(id);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES hmis_patients(id);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS insurer_id uuid REFERENCES hmis_insurers(id);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS tpa_id uuid REFERENCES hmis_tpas(id);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS days_outstanding integer DEFAULT 0;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS aging_bucket varchar(10) DEFAULT '0-15';
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS next_followup_date date;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS priority varchar(10) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical'));
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS has_open_query boolean DEFAULT false;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS query_count integer DEFAULT 0;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS last_followup_date date;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS last_followup_note text;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS settlement_date date;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS settlement_utr varchar(100);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS closure_reason text;

-- Update status check constraint to include AR statuses
ALTER TABLE hmis_claims DROP CONSTRAINT IF EXISTS hmis_claims_status_check;
ALTER TABLE hmis_claims ADD CONSTRAINT hmis_claims_status_check
  CHECK (status IN ('submitted','under_review','query','query_raised','approved','partially_settled','settled','rejected','appealed','written_off','closed'));

-- Indexes for AR queries
CREATE INDEX IF NOT EXISTS idx_claims_centre ON hmis_claims(centre_id);
CREATE INDEX IF NOT EXISTS idx_claims_insurer ON hmis_claims(insurer_id);
CREATE INDEX IF NOT EXISTS idx_claims_tpa ON hmis_claims(tpa_id);
CREATE INDEX IF NOT EXISTS idx_claims_aging ON hmis_claims(aging_bucket);
CREATE INDEX IF NOT EXISTS idx_claims_priority ON hmis_claims(priority);
CREATE INDEX IF NOT EXISTS idx_claims_assigned ON hmis_claims(assigned_to);
CREATE INDEX IF NOT EXISTS idx_claims_followup ON hmis_claims(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_claims_open_query ON hmis_claims(has_open_query) WHERE has_open_query = true;

-- 2. ar_claim_followups — every follow-up action logged
CREATE TABLE IF NOT EXISTS ar_claim_followups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id uuid NOT NULL REFERENCES hmis_claims(id) ON DELETE CASCADE,
    action_type varchar(30) NOT NULL CHECK (action_type IN (
      'phone_call','email_sent','email_received','portal_check',
      'document_submitted','document_received','escalation',
      'payment_received','write_off','status_change','note'
    )),
    contacted_person varchar(200),
    description text NOT NULL,
    outcome text,
    next_followup_date date,
    amount_promised decimal(12,2),
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followups_claim ON ar_claim_followups(claim_id);
CREATE INDEX IF NOT EXISTS idx_followups_created ON ar_claim_followups(created_at DESC);

-- 3. ar_claim_queries — insurer/TPA queries on claims
CREATE TABLE IF NOT EXISTS ar_claim_queries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id uuid NOT NULL REFERENCES hmis_claims(id) ON DELETE CASCADE,
    query_type varchar(30) NOT NULL CHECK (query_type IN (
      'document_request','clarification','additional_info',
      'medical_records','investigation','other'
    )),
    description text NOT NULL,
    query_date date NOT NULL DEFAULT CURRENT_DATE,
    raised_by varchar(200),
    status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','responded','closed','escalated')),
    response_description text,
    response_date date,
    responded_by uuid REFERENCES hmis_staff(id),
    days_to_respond integer,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queries_claim ON ar_claim_queries(claim_id);
CREATE INDEX IF NOT EXISTS idx_queries_status ON ar_claim_queries(status) WHERE status = 'open';

-- 4. Trigger: auto-update aging bucket on claims
CREATE OR REPLACE FUNCTION update_claim_aging()
RETURNS TRIGGER AS $$
BEGIN
  NEW.days_outstanding := EXTRACT(DAY FROM now() - NEW.submitted_at)::integer;
  NEW.aging_bucket := CASE
    WHEN NEW.days_outstanding <= 15 THEN '0-15'
    WHEN NEW.days_outstanding <= 30 THEN '16-30'
    WHEN NEW.days_outstanding <= 60 THEN '31-60'
    WHEN NEW.days_outstanding <= 90 THEN '61-90'
    ELSE '90+'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_claim_aging ON hmis_claims;
CREATE TRIGGER trg_claim_aging
  BEFORE INSERT OR UPDATE ON hmis_claims
  FOR EACH ROW EXECUTE FUNCTION update_claim_aging();

-- 5. Trigger: auto-update claim when followup logged
CREATE OR REPLACE FUNCTION update_claim_on_followup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE hmis_claims SET
    last_followup_date = NEW.created_at::date,
    last_followup_note = LEFT(NEW.description, 200),
    next_followup_date = COALESCE(NEW.next_followup_date, next_followup_date)
  WHERE id = NEW.claim_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_claim_followup_update ON ar_claim_followups;
CREATE TRIGGER trg_claim_followup_update
  AFTER INSERT ON ar_claim_followups
  FOR EACH ROW EXECUTE FUNCTION update_claim_on_followup();

-- 6. Trigger: auto-update claim query count
CREATE OR REPLACE FUNCTION update_claim_on_query()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE hmis_claims SET
    query_count = (SELECT COUNT(*) FROM ar_claim_queries WHERE claim_id = NEW.claim_id),
    has_open_query = EXISTS(SELECT 1 FROM ar_claim_queries WHERE claim_id = NEW.claim_id AND status = 'open')
  WHERE id = NEW.claim_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_claim_query_update ON ar_claim_queries;
CREATE TRIGGER trg_claim_query_update
  AFTER INSERT OR UPDATE ON ar_claim_queries
  FOR EACH ROW EXECUTE FUNCTION update_claim_on_query();

-- 7. RPC: get_ar_aging_summary
CREATE OR REPLACE FUNCTION get_ar_aging_summary(p_centre_id uuid)
RETURNS TABLE(
  aging_bucket text,
  claim_count bigint,
  total_amount numeric,
  total_outstanding numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.aging_bucket::text,
    COUNT(*)::bigint,
    COALESCE(SUM(c.claimed_amount::numeric), 0),
    COALESCE(SUM(c.claimed_amount::numeric - COALESCE(c.settled_amount::numeric, 0) - COALESCE(c.tds_amount::numeric, 0) - COALESCE(c.disallowance_amount::numeric, 0)), 0)
  FROM hmis_claims c
  WHERE c.centre_id = p_centre_id
    AND c.status NOT IN ('settled', 'written_off', 'closed', 'rejected')
  GROUP BY c.aging_bucket
  ORDER BY CASE c.aging_bucket
    WHEN '0-15' THEN 1
    WHEN '16-30' THEN 2
    WHEN '31-60' THEN 3
    WHEN '61-90' THEN 4
    WHEN '90+' THEN 5
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: get_ar_insurer_performance
CREATE OR REPLACE FUNCTION get_ar_insurer_performance(p_centre_id uuid, p_from date, p_to date)
RETURNS TABLE(
  insurer_id uuid,
  insurer_name text,
  claim_count bigint,
  claimed_amount numeric,
  settled_amount numeric,
  settlement_pct numeric,
  avg_days numeric,
  open_claims bigint,
  open_amount numeric,
  query_rate_pct numeric,
  disallowance_pct numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.name::text,
    COUNT(c.id)::bigint,
    COALESCE(SUM(c.claimed_amount::numeric), 0),
    COALESCE(SUM(c.settled_amount::numeric), 0),
    CASE WHEN SUM(c.claimed_amount::numeric) > 0
      THEN ROUND(SUM(COALESCE(c.settled_amount::numeric, 0)) * 100.0 / SUM(c.claimed_amount::numeric), 1)
      ELSE 0 END,
    ROUND(AVG(c.days_outstanding)::numeric, 0),
    COUNT(c.id) FILTER (WHERE c.status NOT IN ('settled','written_off','closed','rejected'))::bigint,
    COALESCE(SUM(c.claimed_amount::numeric - COALESCE(c.settled_amount::numeric, 0)) FILTER (WHERE c.status NOT IN ('settled','written_off','closed','rejected')), 0),
    CASE WHEN COUNT(c.id) > 0
      THEN ROUND(COUNT(c.id) FILTER (WHERE c.query_count > 0) * 100.0 / COUNT(c.id), 1)
      ELSE 0 END,
    CASE WHEN SUM(c.claimed_amount::numeric) > 0
      THEN ROUND(SUM(COALESCE(c.disallowance_amount::numeric, 0)) * 100.0 / SUM(c.claimed_amount::numeric), 1)
      ELSE 0 END
  FROM hmis_insurers i
  LEFT JOIN hmis_claims c ON c.insurer_id = i.id
    AND c.centre_id = p_centre_id
    AND c.submitted_at::date BETWEEN p_from AND p_to
  WHERE i.is_active = true
  GROUP BY i.id, i.name
  ORDER BY COALESCE(SUM(c.claimed_amount::numeric), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: get_ar_daily_tasks
CREATE OR REPLACE FUNCTION get_ar_daily_tasks(p_centre_id uuid, p_staff_id uuid)
RETURNS TABLE(
  claim_id uuid,
  claim_number text,
  patient_name text,
  patient_uhid text,
  insurer_name text,
  tpa_name text,
  claimed_amount numeric,
  outstanding_amount numeric,
  days_outstanding integer,
  aging_bucket text,
  priority text,
  has_open_query boolean,
  task_reason text,
  last_followup_date date,
  last_followup_note text,
  next_followup_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.claim_number::text,
    CONCAT(p.first_name, ' ', p.last_name)::text,
    p.uhid::text,
    COALESCE(ins.name, 'N/A')::text,
    COALESCE(t.name, 'N/A')::text,
    c.claimed_amount::numeric,
    (c.claimed_amount::numeric - COALESCE(c.settled_amount::numeric, 0) - COALESCE(c.tds_amount::numeric, 0) - COALESCE(c.disallowance_amount::numeric, 0)),
    c.days_outstanding,
    c.aging_bucket::text,
    c.priority::text,
    COALESCE(c.has_open_query, false),
    CASE
      WHEN c.has_open_query THEN 'Open query — needs response'
      WHEN c.aging_bucket = '90+' THEN '90+ days — critical follow-up'
      WHEN c.aging_bucket = '61-90' THEN '61-90 days — urgent follow-up'
      WHEN c.next_followup_date <= CURRENT_DATE THEN 'Follow-up due today'
      WHEN c.priority = 'critical' THEN 'Critical priority claim'
      ELSE 'Scheduled follow-up'
    END::text,
    c.last_followup_date,
    c.last_followup_note::text,
    c.next_followup_date
  FROM hmis_claims c
  JOIN hmis_bills b ON b.id = c.bill_id
  LEFT JOIN hmis_patients p ON p.id = c.patient_id
  LEFT JOIN hmis_insurers ins ON ins.id = c.insurer_id
  LEFT JOIN hmis_tpas t ON t.id = c.tpa_id
  WHERE c.centre_id = p_centre_id
    AND c.status NOT IN ('settled', 'written_off', 'closed', 'rejected')
    AND (
      c.has_open_query = true
      OR c.next_followup_date <= CURRENT_DATE
      OR c.aging_bucket IN ('61-90', '90+')
      OR c.priority IN ('high', 'critical')
      OR (p_staff_id IS NOT NULL AND c.assigned_to = p_staff_id)
    )
  ORDER BY
    CASE c.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
    c.days_outstanding DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: get_ar_monthly_trend
CREATE OR REPLACE FUNCTION get_ar_monthly_trend(p_centre_id uuid, p_months integer DEFAULT 12)
RETURNS TABLE(
  month_label text,
  month_start date,
  claimed_amount numeric,
  settled_amount numeric,
  claim_count bigint,
  settled_count bigint,
  avg_settlement_days numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', CURRENT_DATE - (p_months || ' months')::interval)::date,
      date_trunc('month', CURRENT_DATE)::date,
      '1 month'::interval
    )::date AS m
  )
  SELECT
    TO_CHAR(mo.m, 'Mon YYYY')::text,
    mo.m,
    COALESCE(SUM(c.claimed_amount::numeric), 0),
    COALESCE(SUM(c.settled_amount::numeric) FILTER (WHERE c.status = 'settled'), 0),
    COUNT(c.id)::bigint,
    COUNT(c.id) FILTER (WHERE c.status = 'settled')::bigint,
    ROUND(AVG(c.days_outstanding) FILTER (WHERE c.status = 'settled')::numeric, 0)
  FROM months mo
  LEFT JOIN hmis_claims c ON c.centre_id = p_centre_id
    AND date_trunc('month', c.submitted_at)::date = mo.m
  GROUP BY mo.m
  ORDER BY mo.m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
