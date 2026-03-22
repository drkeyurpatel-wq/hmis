-- ============================================================
-- MODULE: Equipment Lifecycle & Downtime Tracker
-- Extends hmis_equipment + hmis_equipment_maintenance with:
--   - AMC ticket tracking with SLA
--   - Downtime tracking with patient impact
--   - Calibration due dates
--   - Uptime % analytics
--   - Cost of ownership tracking
-- ============================================================

-- Add columns to equipment for lifecycle tracking
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS amc_contract_number VARCHAR(100);
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS amc_start_date DATE;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS amc_sla_hours INT DEFAULT 24;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS last_calibration_date DATE;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS next_calibration_date DATE;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS calibration_frequency_days INT DEFAULT 365;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS total_repair_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS total_downtime_hours NUMERIC(10,2) DEFAULT 0;
ALTER TABLE hmis_equipment ADD COLUMN IF NOT EXISTS uptime_pct NUMERIC(5,2) DEFAULT 100;

-- Add columns to maintenance for AMC/downtime tracking
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS amc_ticket_number VARCHAR(100);
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS sla_target_hours INT;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS sla_met BOOLEAN;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS patients_impacted INT DEFAULT 0;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS patients_rescheduled INT DEFAULT 0;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low'));
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS vendor_notified_at TIMESTAMPTZ;
ALTER TABLE hmis_equipment_maintenance ADD COLUMN IF NOT EXISTS vendor_response_at TIMESTAMPTZ;

-- Calibration log
CREATE TABLE IF NOT EXISTS hmis_equipment_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES hmis_equipment(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  calibration_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  performed_by VARCHAR(200),
  vendor VARCHAR(200),
  certificate_number VARCHAR(100),
  result VARCHAR(20) DEFAULT 'pass' CHECK (result IN ('pass','fail','conditional')),
  deviation_notes TEXT,
  cost NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calib_equip ON hmis_equipment_calibration(equipment_id);
CREATE INDEX IF NOT EXISTS idx_calib_centre ON hmis_equipment_calibration(centre_id);

ALTER TABLE hmis_equipment_calibration ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calib_access ON hmis_equipment_calibration;
CREATE POLICY calib_access ON hmis_equipment_calibration FOR ALL USING (true) WITH CHECK (true);
