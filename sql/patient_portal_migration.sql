-- ============================================================
-- Health1 HMIS — Patient Portal
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Patient Portal Access Tokens (OTP-based login)
CREATE TABLE IF NOT EXISTS hmis_portal_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    phone varchar(15) NOT NULL,
    otp_code varchar(6) NOT NULL,
    otp_expires_at timestamptz NOT NULL,
    is_verified boolean NOT NULL DEFAULT false,
    session_token varchar(64),
    session_expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_phone ON hmis_portal_tokens(phone, otp_code);
CREATE INDEX IF NOT EXISTS idx_portal_session ON hmis_portal_tokens(session_token);

-- 2. Patient Portal Access Log (NABL + audit)
CREATE TABLE IF NOT EXISTS hmis_portal_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    action varchar(20) NOT NULL CHECK (action IN ('login','view_report','download_report','view_prescription','view_bill','book_appointment','view_discharge','view_vitals')),
    entity_type varchar(20),
    entity_id uuid,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_log_patient ON hmis_portal_access_log(patient_id, created_at DESC);

-- 3. Appointment Requests from Portal
CREATE TABLE IF NOT EXISTS hmis_portal_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    preferred_date date NOT NULL,
    preferred_time varchar(10),
    department varchar(50),
    doctor_preference varchar(100),
    reason text,
    status varchar(15) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','cancelled','completed')),
    confirmed_date date,
    confirmed_time time,
    confirmed_by uuid REFERENCES hmis_staff(id),
    notes text,
    centre_id uuid REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Patient Feedback
CREATE TABLE IF NOT EXISTS hmis_portal_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    feedback_type varchar(15) NOT NULL CHECK (feedback_type IN ('general','doctor','lab','pharmacy','billing','homecare','complaint','suggestion')),
    rating int CHECK (rating BETWEEN 1 AND 5),
    message text NOT NULL,
    department varchar(50),
    is_resolved boolean NOT NULL DEFAULT false,
    resolved_by uuid REFERENCES hmis_staff(id),
    resolution_notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS — portal tables use different access pattern (session token, not auth.uid)
-- For now, enable RLS but allow all authenticated access (portal API uses service key)
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_portal_tokens','hmis_portal_access_log',
        'hmis_portal_appointments','hmis_portal_feedback'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;
