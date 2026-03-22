-- linen_migration.sql
-- Linen inventory and exchange tracking

-- ============================================================
-- LINEN INVENTORY (per ward)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_linen_inventory (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  item_type       text NOT NULL CHECK (item_type IN ('bedsheet','pillow_cover','blanket','curtain','towel','gown','drape')),
  total_qty       integer NOT NULL DEFAULT 0,
  in_circulation  integer NOT NULL DEFAULT 0,
  in_laundry      integer NOT NULL DEFAULT 0,
  damaged         integer NOT NULL DEFAULT 0,
  ward            varchar(100) NOT NULL,
  par_level       integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (centre_id, item_type, ward)
);

CREATE INDEX IF NOT EXISTS idx_linen_inv_centre ON hmis_linen_inventory (centre_id);

-- ============================================================
-- LINEN EXCHANGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_linen_exchange (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  ward            varchar(100) NOT NULL,
  item_type       text NOT NULL CHECK (item_type IN ('bedsheet','pillow_cover','blanket','curtain','towel','gown','drape')),
  exchange_date   date NOT NULL DEFAULT CURRENT_DATE,
  exchange_type   text NOT NULL DEFAULT 'routine' CHECK (exchange_type IN ('routine','discharge','emergency')),
  soiled_count    integer NOT NULL DEFAULT 0,
  clean_received  integer NOT NULL DEFAULT 0,
  damaged_count   integer NOT NULL DEFAULT 0,
  exchanged_by    uuid REFERENCES hmis_staff(id),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linen_ex_centre ON hmis_linen_exchange (centre_id, exchange_date DESC);
CREATE INDEX IF NOT EXISTS idx_linen_ex_ward ON hmis_linen_exchange (ward, exchange_date DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_linen_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_linen_exchange ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access linen inventory" ON hmis_linen_inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access linen exchange" ON hmis_linen_exchange FOR ALL USING (true) WITH CHECK (true);
