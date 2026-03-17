-- ============================================================
-- Health1 HMIS — NHCX Integration Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. NHCX Transaction Log — every API call in/out
CREATE TABLE IF NOT EXISTS hmis_nhcx_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id uuid REFERENCES hmis_claims(id),
    patient_id uuid REFERENCES hmis_patients(id),
    action varchar(50) NOT NULL,                    -- coverageeligibility/check, preauth/submit, etc
    direction varchar(10) NOT NULL CHECK (direction IN ('outgoing','incoming')),
    nhcx_api_call_id varchar(100),                  -- NHCX gateway's API call ID
    nhcx_correlation_id varchar(100),               -- Links request ↔ response
    nhcx_workflow_id varchar(100),                   -- Links eligibility → preauth → claim
    status varchar(20) NOT NULL DEFAULT 'pending',
    error_message text,
    request_payload jsonb,
    response_payload jsonb,
    request_timestamp timestamptz,
    response_timestamp timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nhcx_txn_claim ON hmis_nhcx_transactions(claim_id);
CREATE INDEX IF NOT EXISTS idx_nhcx_txn_correlation ON hmis_nhcx_transactions(nhcx_correlation_id);
CREATE INDEX IF NOT EXISTS idx_nhcx_txn_workflow ON hmis_nhcx_transactions(nhcx_workflow_id);

-- 2. Add NHCX columns to hmis_claims
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_correlation_id varchar(100);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_workflow_id varchar(100);
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_response jsonb;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_submitted_at timestamptz;
ALTER TABLE hmis_claims ADD COLUMN IF NOT EXISTS nhcx_responded_at timestamptz;

-- 3. Add NHCX participant codes to insurers and TPAs
ALTER TABLE hmis_insurers ADD COLUMN IF NOT EXISTS nhcx_code varchar(100);
ALTER TABLE hmis_tpas ADD COLUMN IF NOT EXISTS nhcx_code varchar(100);

-- 4. Add ABHA fields to patients (if not exists)
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_number varchar(20);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_address varchar(50);

-- 5. NHCX Configuration table
CREATE TABLE IF NOT EXISTS hmis_nhcx_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    participant_code varchar(100) NOT NULL,
    hfr_id varchar(20) NOT NULL,
    username varchar(100) NOT NULL,
    encrypted_secret text NOT NULL,           -- encrypted in application
    gateway_url varchar(200) NOT NULL DEFAULT 'https://hcxbeta.nha.gov.in',
    is_production boolean NOT NULL DEFAULT false,
    rsa_public_key text,                       -- PEM format
    rsa_private_key_encrypted text,            -- encrypted, stored securely
    webhook_url text,                          -- our callback URL for NHCX
    is_active boolean NOT NULL DEFAULT true,
    last_token_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id)
);

-- RLS
DO $$
BEGIN
    EXECUTE 'ALTER TABLE hmis_nhcx_transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY nhcx_txn_pol ON hmis_nhcx_transactions FOR ALL USING (auth.uid() IS NOT NULL)';
    EXECUTE 'ALTER TABLE hmis_nhcx_config ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY nhcx_cfg_pol ON hmis_nhcx_config FOR ALL USING (auth.uid() IS NOT NULL)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Seed major insurers with NHCX codes (placeholder — update when known)
-- These codes will be available from the NHCX participant registry
UPDATE hmis_insurers SET nhcx_code = CASE 
    WHEN name ILIKE '%star health%' THEN 'nhcx-star-health'
    WHEN name ILIKE '%niva bupa%' OR name ILIKE '%max bupa%' THEN 'nhcx-niva-bupa'
    WHEN name ILIKE '%care health%' OR name ILIKE '%religare%' THEN 'nhcx-care-health'
    WHEN name ILIKE '%hdfc ergo%' THEN 'nhcx-hdfc-ergo'
    WHEN name ILIKE '%icici lombard%' THEN 'nhcx-icici-lombard'
    WHEN name ILIKE '%bajaj allianz%' THEN 'nhcx-bajaj-allianz'
    WHEN name ILIKE '%new india%' THEN 'nhcx-new-india'
    WHEN name ILIKE '%national%' THEN 'nhcx-national-insurance'
    WHEN name ILIKE '%united india%' THEN 'nhcx-united-india'
    WHEN name ILIKE '%oriental%' THEN 'nhcx-oriental-insurance'
    ELSE nhcx_code
END WHERE nhcx_code IS NULL;

UPDATE hmis_tpas SET nhcx_code = CASE
    WHEN name ILIKE '%medi assist%' THEN 'nhcx-medi-assist'
    WHEN name ILIKE '%paramount%' THEN 'nhcx-paramount'
    WHEN name ILIKE '%vidal%' THEN 'nhcx-vidal'
    WHEN name ILIKE '%md india%' THEN 'nhcx-md-india'
    WHEN name ILIKE '%good health%' THEN 'nhcx-good-health'
    ELSE nhcx_code
END WHERE nhcx_code IS NULL;
