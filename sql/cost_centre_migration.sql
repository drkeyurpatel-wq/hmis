-- ============================================================
-- COST CENTRE MASTER & P&L SUPPORT
-- Run after h1_hmis_migration.sql
-- ============================================================

-- 1. Cost Centre Master
CREATE TABLE IF NOT EXISTS hmis_cost_centres (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id   UUID NOT NULL REFERENCES hmis_centres(id),
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  type        VARCHAR(20) NOT NULL DEFAULT 'revenue'
              CHECK (type IN ('revenue','expense','overhead','shared')),
  parent_id   UUID REFERENCES hmis_cost_centres(id),
  gl_revenue_account_id UUID REFERENCES hmis_chart_of_accounts(id),
  gl_expense_account_id UUID REFERENCES hmis_chart_of_accounts(id),
  budget_monthly DECIMAL(14,2) DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, code)
);

CREATE INDEX idx_cost_centres_centre ON hmis_cost_centres(centre_id, is_active);

-- 2. Mapping rules: department/tariff-category → cost centre
CREATE TABLE IF NOT EXISTS hmis_cost_centre_maps (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       UUID NOT NULL REFERENCES hmis_centres(id),
  cost_centre_id  UUID NOT NULL REFERENCES hmis_cost_centres(id) ON DELETE CASCADE,
  match_type      VARCHAR(20) NOT NULL CHECK (match_type IN ('department','tariff_category','bill_type')),
  match_value     VARCHAR(100) NOT NULL,
  priority        INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(centre_id, match_type, match_value)
);

CREATE INDEX idx_cc_maps_lookup ON hmis_cost_centre_maps(centre_id, match_type, is_active);

-- 3. Add cost_centre_id to bill_items
ALTER TABLE hmis_bill_items
  ADD COLUMN IF NOT EXISTS cost_centre_id UUID REFERENCES hmis_cost_centres(id);

CREATE INDEX IF NOT EXISTS idx_bill_items_cc ON hmis_bill_items(cost_centre_id);

-- 4. Add cost_centre_id to charge_log
ALTER TABLE hmis_charge_log
  ADD COLUMN IF NOT EXISTS cost_centre_id UUID REFERENCES hmis_cost_centres(id);

CREATE INDEX IF NOT EXISTS idx_charge_log_cc ON hmis_charge_log(cost_centre_id);

-- 5. Fix journal_lines.cost_centre_id to reference hmis_cost_centres (not hmis_centres)
-- NOTE: If you have existing data in cost_centre_id pointing to hmis_centres,
-- you will need to migrate that data first. This adds a NEW column.
ALTER TABLE hmis_journal_lines
  ADD COLUMN IF NOT EXISTS cost_centre_ref UUID REFERENCES hmis_cost_centres(id);

-- 6. Expense tracking table (for cost-side of P&L)
CREATE TABLE IF NOT EXISTS hmis_cost_centre_expenses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       UUID NOT NULL REFERENCES hmis_centres(id),
  cost_centre_id  UUID NOT NULL REFERENCES hmis_cost_centres(id),
  expense_date    DATE NOT NULL,
  category        VARCHAR(50) NOT NULL
                  CHECK (category IN ('salary','consumables','maintenance','rent','utilities','equipment','outsourced','marketing','insurance','miscellaneous')),
  description     TEXT,
  amount          DECIMAL(14,2) NOT NULL,
  vendor          VARCHAR(200),
  reference_number VARCHAR(50),
  created_by      UUID REFERENCES hmis_staff(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cc_expenses_lookup ON hmis_cost_centre_expenses(centre_id, cost_centre_id, expense_date);

-- 7. RLS policies
ALTER TABLE hmis_cost_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_cost_centre_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_cost_centre_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_centres_all" ON hmis_cost_centres FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cost_centre_maps_all" ON hmis_cost_centre_maps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cost_centre_expenses_all" ON hmis_cost_centre_expenses FOR ALL USING (true) WITH CHECK (true);
