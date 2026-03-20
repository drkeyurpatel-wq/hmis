-- ============================================================
-- Health1 HMIS — Refund Management
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

CREATE TABLE IF NOT EXISTS hmis_refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    refund_amount decimal(12,2) NOT NULL,
    reason text NOT NULL,
    refund_mode varchar(20) NOT NULL CHECK (refund_mode IN ('cash','neft','cheque','upi')),
    bank_details text,
    status varchar(15) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','approved','processed','rejected','cancelled')),
    initiated_by uuid NOT NULL REFERENCES hmis_staff(id),
    approved_by uuid REFERENCES hmis_staff(id),
    approved_at timestamptz,
    processed_by uuid REFERENCES hmis_staff(id),
    processed_at timestamptz,
    utr_number varchar(50),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_centre ON hmis_refunds(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_refunds_bill ON hmis_refunds(bill_id);

ALTER TABLE hmis_refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_refunds_pol ON hmis_refunds;
CREATE POLICY hmis_refunds_pol ON hmis_refunds FOR ALL USING (auth.uid() IS NOT NULL);
