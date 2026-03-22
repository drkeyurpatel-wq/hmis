-- ============================================================
-- Health1 HMIS — ABDM (ABHA/HIE-CM) Integration Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Extend hmis_patients with full ABHA fields
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_status varchar(20);
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_linked_at timestamptz;
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_kyc_verified boolean DEFAULT false;
ALTER TABLE hmis_patients ADD COLUMN IF NOT EXISTS abha_profile jsonb;

CREATE INDEX IF NOT EXISTS idx_patients_abha ON hmis_patients(abha_number) WHERE abha_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_abha_addr ON hmis_patients(abha_address) WHERE abha_address IS NOT NULL;

-- 2. ABDM Configuration per centre
CREATE TABLE IF NOT EXISTS hmis_abdm_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    client_id varchar(100) NOT NULL,
    client_secret_encrypted text NOT NULL,
    environment varchar(20) NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    hip_id varchar(50) NOT NULL,
    hip_name varchar(200) NOT NULL,
    callback_url text,
    is_active boolean NOT NULL DEFAULT true,
    features jsonb DEFAULT '{"abha_creation":true,"abha_verification":true,"scan_share":true,"hie_cm":true}'::jsonb,
    last_token_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id)
);

-- 3. ABDM Link Requests (HIP linking flow)
CREATE TABLE IF NOT EXISTS hmis_abdm_link_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id varchar(100) NOT NULL,
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    care_context_ids text[],
    status varchar(20) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'otp_sent', 'linked', 'failed', 'expired')),
    otp_expiry timestamptz,
    linked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abdm_link_patient ON hmis_abdm_link_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_abdm_link_txn ON hmis_abdm_link_requests(transaction_id);

-- 4. HIE-CM Consent Requests (HIU requesting records)
CREATE TABLE IF NOT EXISTS hmis_abdm_consent_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_request_id varchar(100) NOT NULL,
    gateway_request_id varchar(100),
    patient_abha_address varchar(100) NOT NULL,
    hip_id varchar(50),
    hip_name varchar(200),
    purpose varchar(20) NOT NULL DEFAULT 'CAREMGT',
    hi_types text[] NOT NULL,
    date_range_from date NOT NULL,
    date_range_to date NOT NULL,
    expiry_date date NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'GRANTED', 'DENIED', 'EXPIRED', 'REVOKED')),
    consent_artefact_ids text[],
    requested_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_req_abha ON hmis_abdm_consent_requests(patient_abha_address);
CREATE INDEX IF NOT EXISTS idx_consent_req_status ON hmis_abdm_consent_requests(status);
CREATE INDEX IF NOT EXISTS idx_consent_req_id ON hmis_abdm_consent_requests(consent_request_id);

-- 5. Health Data Transfers (records received/sent via HIE-CM)
CREATE TABLE IF NOT EXISTS hmis_abdm_data_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_artefact_id varchar(100) NOT NULL,
    patient_id uuid REFERENCES hmis_patients(id),
    direction varchar(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    hi_type varchar(50) NOT NULL,
    care_context_reference varchar(100),
    fhir_bundle jsonb,
    status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'ACKNOWLEDGED', 'TRANSFERRED', 'FAILED')),
    transferred_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_transfer_consent ON hmis_abdm_data_transfers(consent_artefact_id);
CREATE INDEX IF NOT EXISTS idx_data_transfer_patient ON hmis_abdm_data_transfers(patient_id);

-- 6. ABDM Audit Log
CREATE TABLE IF NOT EXISTS hmis_abdm_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid REFERENCES hmis_patients(id),
    action varchar(50) NOT NULL,
    details jsonb,
    performed_by uuid REFERENCES hmis_staff(id),
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abdm_audit_patient ON hmis_abdm_audit_log(patient_id);

-- 7. Scan & Share session log
CREATE TABLE IF NOT EXISTS hmis_abdm_scan_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid REFERENCES hmis_centres(id),
    counter_id varchar(50),
    patient_id uuid REFERENCES hmis_patients(id),
    abha_number varchar(20),
    abha_address varchar(50),
    scan_type varchar(20) NOT NULL DEFAULT 'qr' CHECK (scan_type IN ('qr', 'manual', 'phr_app')),
    verified boolean NOT NULL DEFAULT false,
    linked boolean NOT NULL DEFAULT false,
    scanned_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. RLS Policies
DO $$
BEGIN
    EXECUTE 'ALTER TABLE hmis_abdm_config ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_cfg_pol ON hmis_abdm_config FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_link_requests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_link_pol ON hmis_abdm_link_requests FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_consent_requests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_consent_pol ON hmis_abdm_consent_requests FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_data_transfers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_data_pol ON hmis_abdm_data_transfers FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_audit_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_audit_pol ON hmis_abdm_audit_log FOR ALL USING (auth.uid() IS NOT NULL)';

    EXECUTE 'ALTER TABLE hmis_abdm_scan_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY abdm_scan_pol ON hmis_abdm_scan_sessions FOR ALL USING (auth.uid() IS NOT NULL)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
