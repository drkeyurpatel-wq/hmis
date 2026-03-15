-- ============================================================
-- Health1 HMIS — EMR v3 Encounter Storage
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- Full EMR encounter: stores structured clinical data as JSONB
-- alongside normalized FKs for querying/analytics
CREATE TABLE IF NOT EXISTS hmis_emr_encounters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    opd_visit_id uuid REFERENCES hmis_opd_visits(id),

    -- Encounter metadata
    encounter_date date NOT NULL DEFAULT CURRENT_DATE,
    encounter_type varchar(10) NOT NULL DEFAULT 'opd' CHECK (encounter_type IN ('opd', 'ipd', 'emergency', 'followup')),
    status varchar(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'signed', 'amended')),

    -- Structured clinical data (JSONB for flexibility + speed)
    vitals jsonb DEFAULT '{}',
    -- { systolic, diastolic, heartRate, spo2, temperature, weight, height, respiratoryRate, bmi, news2Score, news2Risk }

    complaints jsonb DEFAULT '[]',
    -- [{ complaint, duration, hpiNotes, selectedChips }]

    exam_findings jsonb DEFAULT '[]',
    -- [{ system, findings, notes }]

    diagnoses jsonb DEFAULT '[]',
    -- [{ code, label, type }]

    investigations jsonb DEFAULT '[]',
    -- [{ name, urgency, result, isAbnormal }]

    prescriptions jsonb DEFAULT '[]',
    -- [{ id, generic, brand, strength, form, dose, frequency, duration, route, instructions }]

    advice jsonb DEFAULT '[]',
    -- ["string1", "string2"]

    follow_up jsonb DEFAULT '{}',
    -- { date, notes }

    referral jsonb DEFAULT null,
    -- { department, doctor, reason, urgency }

    -- Denormalized for quick list queries
    primary_diagnosis_code varchar(10),
    primary_diagnosis_label varchar(200),
    prescription_count int DEFAULT 0,
    investigation_count int DEFAULT 0,

    -- Audit
    signed_at timestamptz,
    signed_by uuid REFERENCES hmis_staff(id),
    amended_at timestamptz,
    amended_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_emr_encounters_patient ON hmis_emr_encounters(patient_id, encounter_date DESC);
CREATE INDEX IF NOT EXISTS idx_emr_encounters_doctor ON hmis_emr_encounters(doctor_id, encounter_date DESC);
CREATE INDEX IF NOT EXISTS idx_emr_encounters_centre ON hmis_emr_encounters(centre_id, encounter_date DESC);
CREATE INDEX IF NOT EXISTS idx_emr_encounters_status ON hmis_emr_encounters(status);
CREATE INDEX IF NOT EXISTS idx_emr_encounters_dx ON hmis_emr_encounters(primary_diagnosis_code);

-- GIN index for JSONB queries (e.g., find all encounters with a specific diagnosis)
CREATE INDEX IF NOT EXISTS idx_emr_encounters_diagnoses ON hmis_emr_encounters USING gin(diagnoses);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_emr_encounter_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    -- Auto-denormalize
    IF NEW.diagnoses IS NOT NULL AND jsonb_array_length(NEW.diagnoses) > 0 THEN
        NEW.primary_diagnosis_code = NEW.diagnoses->0->>'code';
        NEW.primary_diagnosis_label = NEW.diagnoses->0->>'label';
    END IF;
    NEW.prescription_count = COALESCE(jsonb_array_length(NEW.prescriptions), 0);
    NEW.investigation_count = COALESCE(jsonb_array_length(NEW.investigations), 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_emr_encounter_update
    BEFORE UPDATE ON hmis_emr_encounters
    FOR EACH ROW
    EXECUTE FUNCTION update_emr_encounter_timestamp();

-- Also run on insert
CREATE TRIGGER trg_emr_encounter_insert
    BEFORE INSERT ON hmis_emr_encounters
    FOR EACH ROW
    EXECUTE FUNCTION update_emr_encounter_timestamp();

-- RLS Policies
ALTER TABLE hmis_emr_encounters ENABLE ROW LEVEL SECURITY;

-- Doctors can read/write encounters they created
CREATE POLICY emr_encounters_doctor_all ON hmis_emr_encounters
    FOR ALL USING (
        doctor_id IN (
            SELECT id FROM hmis_staff WHERE auth_user_id = auth.uid()
        )
    );

-- Staff at same centre can read
CREATE POLICY emr_encounters_centre_read ON hmis_emr_encounters
    FOR SELECT USING (
        centre_id IN (
            SELECT sc.centre_id FROM hmis_staff_centres sc
            JOIN hmis_staff s ON s.id = sc.staff_id
            WHERE s.auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- Saved prescription templates (per doctor)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_emr_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid REFERENCES hmis_centres(id),
    name varchar(100) NOT NULL,
    template_type varchar(20) NOT NULL DEFAULT 'prescription' CHECK (template_type IN ('prescription', 'encounter', 'investigation')),
    data jsonb NOT NULL DEFAULT '{}',
    -- For prescription: { meds: [...], labs: [...], advice: [...] }
    is_shared boolean NOT NULL DEFAULT false,
    usage_count int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emr_templates_doctor ON hmis_emr_templates(doctor_id);

ALTER TABLE hmis_emr_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY emr_templates_own ON hmis_emr_templates
    FOR ALL USING (
        doctor_id IN (
            SELECT id FROM hmis_staff WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY emr_templates_shared_read ON hmis_emr_templates
    FOR SELECT USING (is_shared = true);
