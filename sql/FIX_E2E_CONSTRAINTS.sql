-- DB fixes discovered during E2E testing (2026-04-01)
-- CHECK constraints expanded + missing columns added

-- charge_log source: add 'emr','cpoe','cron','e2e','system'
ALTER TABLE hmis_charge_log DROP CONSTRAINT IF EXISTS hmis_charge_log_source_check;
ALTER TABLE hmis_charge_log ADD CONSTRAINT hmis_charge_log_source_check 
  CHECK (source IN ('auto_daily','auto_admission','auto_discharge','pharmacy','lab','radiology',
         'procedure','consumable','manual','barcode_scan','emr','cpoe','cron','e2e','system'));

-- charge_log status: add 'billed'
ALTER TABLE hmis_charge_log DROP CONSTRAINT IF EXISTS hmis_charge_log_status_check;
ALTER TABLE hmis_charge_log ADD CONSTRAINT hmis_charge_log_status_check 
  CHECK (status IN ('captured','posted','reversed','disputed','billed'));

-- bills status: add 'partial'
ALTER TABLE hmis_bills DROP CONSTRAINT IF EXISTS hmis_bills_status_check;
ALTER TABLE hmis_bills ADD CONSTRAINT hmis_bills_status_check 
  CHECK (status IN ('draft','final','partially_paid','partial','paid','cancelled','written_off'));

-- radiology_reports status: add 'reported'
ALTER TABLE hmis_radiology_reports DROP CONSTRAINT IF EXISTS hmis_radiology_reports_status_check;
ALTER TABLE hmis_radiology_reports ADD CONSTRAINT hmis_radiology_reports_status_check 
  CHECK (status IN ('draft','finalized','verified','amended','reported'));

-- Missing columns
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE hmis_lab_results ADD COLUMN IF NOT EXISTS reference_range text;
