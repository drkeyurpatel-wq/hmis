-- Health1 HMIS — Billing schema additions for MedPay integration
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- bill_items: add service doctor vs consulting doctor distinction
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS service_doctor_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS consulting_doctor_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS referring_doctor_name varchar(200);
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS billing_category varchar(50);
ALTER TABLE hmis_bill_items ADD COLUMN IF NOT EXISTS category varchar(50);

-- bills: add medpay sync tracking
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS medpay_synced boolean DEFAULT false;
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS medpay_synced_at timestamptz;
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS medpay_upload_id int;
ALTER TABLE hmis_bills ADD COLUMN IF NOT EXISTS insurer_name varchar(200);

-- Doctor ID mapping: HMIS staff UUID ↔ MedPay doctor INT
CREATE TABLE IF NOT EXISTS hmis_medpay_doctor_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hmis_staff_id uuid NOT NULL REFERENCES hmis_staff(id),
  medpay_doctor_id int NOT NULL,
  medpay_doctor_name varchar(200),
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(hmis_staff_id),
  UNIQUE(medpay_doctor_id)
);

-- Integration sync log
CREATE TABLE IF NOT EXISTS hmis_medpay_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid REFERENCES hmis_bills(id),
  direction varchar(10) DEFAULT 'push',
  rows_pushed int DEFAULT 0,
  medpay_upload_id int,
  status varchar(20) DEFAULT 'success',
  error_message text,
  synced_by uuid REFERENCES hmis_staff(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_medpay_sync ON hmis_bills(medpay_synced) WHERE medpay_synced = false;
CREATE INDEX IF NOT EXISTS idx_medpay_sync_log ON hmis_medpay_sync_log(bill_id);
