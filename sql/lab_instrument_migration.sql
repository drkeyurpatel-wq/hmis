-- ============================================================
-- Health1 HMIS — Lab Instrument Integration + Patient Lab History
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Instrument result staging table
-- Results from Mindray/analyzers land here before being verified
CREATE TABLE IF NOT EXISTS hmis_lab_instrument_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid REFERENCES hmis_lab_orders(id),
    patient_id uuid REFERENCES hmis_patients(id),
    parameter_code varchar(30),
    parameter_name varchar(100) NOT NULL,
    result_value varchar(50) NOT NULL,
    unit varchar(20),
    reference_range varchar(50),
    instrument_flag varchar(10),
    is_abnormal boolean DEFAULT false,
    is_critical boolean DEFAULT false,
    source varchar(20) NOT NULL DEFAULT 'instrument',
    instrument_format varchar(10),  -- hl7, astm, json
    received_at timestamptz NOT NULL DEFAULT now(),
    reviewed boolean DEFAULT false,
    reviewed_by uuid REFERENCES hmis_staff(id),
    reviewed_at timestamptz,
    accepted boolean,  -- true = accepted into results, false = rejected
    rejection_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_instr_order ON hmis_lab_instrument_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_instr_patient ON hmis_lab_instrument_results(patient_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_instr_unreviewed ON hmis_lab_instrument_results(reviewed) WHERE reviewed = false;

-- RLS
ALTER TABLE hmis_lab_instrument_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_lab_instrument_results_pol ON hmis_lab_instrument_results;
CREATE POLICY hmis_lab_instrument_results_pol ON hmis_lab_instrument_results FOR ALL USING (auth.uid() IS NOT NULL);
