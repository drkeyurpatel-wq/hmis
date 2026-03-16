-- ============================================================
-- Health1 HMIS — Homecare Module
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Homecare Enrollments (patients enrolled in homecare program)
CREATE TABLE IF NOT EXISTS hmis_hc_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    admission_id uuid REFERENCES hmis_admissions(id),
    enrollment_number varchar(20) NOT NULL UNIQUE,
    program_type varchar(20) NOT NULL CHECK (program_type IN ('post_discharge','chronic_care','palliative','wound_care','iv_therapy','physiotherapy','dialysis','ventilator','general')),
    primary_diagnosis text,
    -- Care team
    primary_nurse_id uuid REFERENCES hmis_staff(id),
    primary_doctor_id uuid REFERENCES hmis_staff(id),
    -- Address
    address_line1 text NOT NULL,
    address_line2 text,
    city varchar(50) DEFAULT 'Ahmedabad',
    pincode varchar(10),
    latitude decimal(10,7),
    longitude decimal(10,7),
    landmark text,
    -- Contact
    primary_contact_name varchar(100),
    primary_contact_phone varchar(15) NOT NULL,
    secondary_contact_phone varchar(15),
    -- Care plan
    visit_frequency varchar(20) DEFAULT 'daily' CHECK (visit_frequency IN ('twice_daily','daily','alternate_day','twice_weekly','weekly','biweekly','monthly','as_needed')),
    estimated_duration_weeks int DEFAULT 4,
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    special_instructions text,
    -- Status
    status varchar(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','discharged','cancelled')),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hc_enroll_patient ON hmis_hc_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_hc_enroll_status ON hmis_hc_enrollments(status, centre_id);

CREATE SEQUENCE IF NOT EXISTS hmis_hc_enroll_seq START 1;
CREATE OR REPLACE FUNCTION hmis_next_hc_number() RETURNS varchar AS $$
BEGIN RETURN 'H1-HC-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('hmis_hc_enroll_seq')::text, 4, '0'); END;
$$ LANGUAGE plpgsql;

-- 2. Home Visits
CREATE TABLE IF NOT EXISTS hmis_hc_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    visit_number int NOT NULL DEFAULT 1,
    scheduled_date date NOT NULL,
    scheduled_time time,
    -- Nurse assignment
    assigned_nurse_id uuid NOT NULL REFERENCES hmis_staff(id),
    -- Check-in/out
    checkin_time timestamptz,
    checkin_lat decimal(10,7),
    checkin_lng decimal(10,7),
    checkout_time timestamptz,
    checkout_lat decimal(10,7),
    checkout_lng decimal(10,7),
    travel_distance_km decimal(5,1),
    -- Visit documentation
    visit_type varchar(20) NOT NULL DEFAULT 'routine' CHECK (visit_type IN ('routine','urgent','follow_up','assessment','discharge_visit','sample_collection')),
    chief_complaint text,
    -- Vitals
    bp_systolic int,
    bp_diastolic int,
    pulse int,
    temperature decimal(4,1),
    spo2 decimal(4,1),
    resp_rate int,
    blood_sugar decimal(5,1),
    blood_sugar_type varchar(10) CHECK (blood_sugar_type IN ('fasting','pp','random')),
    pain_scale int CHECK (pain_scale BETWEEN 0 AND 10),
    weight_kg decimal(5,1),
    -- Assessment
    general_condition varchar(20) CHECK (general_condition IN ('stable','improving','deteriorating','critical','unchanged')),
    consciousness varchar(20) CHECK (consciousness IN ('alert','drowsy','confused','unresponsive')),
    mobility varchar(20) CHECK (mobility IN ('ambulatory','assisted','wheelchair','bedbound')),
    oral_intake varchar(20) CHECK (oral_intake IN ('normal','reduced','poor','nil','ryles_tube','peg')),
    -- Clinical notes
    assessment_notes text,
    plan_notes text,
    doctor_consulted boolean DEFAULT false,
    doctor_notes text,
    -- Escalation
    needs_escalation boolean NOT NULL DEFAULT false,
    escalation_reason text,
    escalation_action text,
    -- Status
    status varchar(15) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','missed','cancelled','rescheduled')),
    duration_minutes int,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hc_visits_enroll ON hmis_hc_visits(enrollment_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_hc_visits_nurse ON hmis_hc_visits(assigned_nurse_id, scheduled_date);

-- 3. Homecare Medications (medication compliance tracking)
CREATE TABLE IF NOT EXISTS hmis_hc_medications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    drug_name varchar(200) NOT NULL,
    dose varchar(50) NOT NULL,
    route varchar(20) NOT NULL,
    frequency varchar(30) NOT NULL,
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    instructions text,
    is_active boolean NOT NULL DEFAULT true,
    prescribed_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Medication Administration at Home
CREATE TABLE IF NOT EXISTS hmis_hc_med_admin (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id uuid NOT NULL REFERENCES hmis_hc_visits(id),
    medication_id uuid NOT NULL REFERENCES hmis_hc_medications(id),
    administered boolean NOT NULL DEFAULT true,
    administered_time timestamptz DEFAULT now(),
    dose_given varchar(50),
    site varchar(30),
    skip_reason text,
    nurse_notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Wound Care Documentation
CREATE TABLE IF NOT EXISTS hmis_hc_wound_care (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id uuid NOT NULL REFERENCES hmis_hc_visits(id),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    wound_location varchar(100) NOT NULL,
    wound_type varchar(30) CHECK (wound_type IN ('surgical','pressure_ulcer','diabetic','traumatic','venous','arterial','burn','drain_site','tracheostomy','other')),
    -- Measurement
    length_cm decimal(5,1),
    width_cm decimal(5,1),
    depth_cm decimal(5,1),
    -- Assessment
    wound_bed varchar(30) CHECK (wound_bed IN ('granulation','slough','necrotic','epithelializing','mixed','clean')),
    exudate_amount varchar(15) CHECK (exudate_amount IN ('none','scant','moderate','heavy')),
    exudate_type varchar(15) CHECK (exudate_type IN ('serous','sanguinous','serosanguinous','purulent')),
    periwound_skin varchar(30) CHECK (periwound_skin IN ('intact','macerated','erythema','edema','induration','healthy')),
    odor boolean DEFAULT false,
    infection_signs boolean DEFAULT false,
    -- Treatment
    dressing_type text,
    dressing_changed boolean NOT NULL DEFAULT true,
    irrigation_solution text,
    -- Photo
    photo_urls jsonb DEFAULT '[]',
    -- Assessment
    healing_progress varchar(15) CHECK (healing_progress IN ('improving','stable','worsening')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Homecare Equipment / Supplies
CREATE TABLE IF NOT EXISTS hmis_hc_equipment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    equipment_name varchar(100) NOT NULL,
    equipment_type varchar(20) CHECK (equipment_type IN ('oxygen','ventilator','suction','nebulizer','pulse_oximeter','bp_monitor','glucometer','wheelchair','bed','mattress','iv_stand','dressing_kit','other')),
    serial_number varchar(50),
    issued_date date NOT NULL DEFAULT CURRENT_DATE,
    return_date date,
    daily_rental decimal(8,2),
    status varchar(15) DEFAULT 'issued' CHECK (status IN ('issued','in_use','returned','damaged','lost')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Homecare Billing
CREATE TABLE IF NOT EXISTS hmis_hc_bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES hmis_hc_enrollments(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    bill_date date NOT NULL DEFAULT CURRENT_DATE,
    bill_period_start date,
    bill_period_end date,
    -- Line items stored as JSON
    items jsonb NOT NULL DEFAULT '[]',
    subtotal decimal(10,2) NOT NULL DEFAULT 0,
    discount decimal(10,2) NOT NULL DEFAULT 0,
    tax decimal(10,2) NOT NULL DEFAULT 0,
    total decimal(10,2) NOT NULL DEFAULT 0,
    paid decimal(10,2) NOT NULL DEFAULT 0,
    balance decimal(10,2) GENERATED ALWAYS AS (total - paid) STORED,
    payment_mode varchar(15) CHECK (payment_mode IN ('cash','upi','card','neft','cheque','insurance')),
    status varchar(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue')),
    notes text,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Homecare Service Rate Card
CREATE TABLE IF NOT EXISTS hmis_hc_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_code varchar(20) NOT NULL UNIQUE,
    service_name varchar(100) NOT NULL,
    category varchar(30) NOT NULL CHECK (category IN ('nursing_visit','doctor_visit','physiotherapy','iv_therapy','wound_care','injection','sample_collection','equipment_rental','consumables','package','other')),
    rate decimal(8,2) NOT NULL,
    unit varchar(20) DEFAULT 'per_visit',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'hmis_hc_enrollments','hmis_hc_visits','hmis_hc_medications',
        'hmis_hc_med_admin','hmis_hc_wound_care','hmis_hc_equipment',
        'hmis_hc_bills','hmis_hc_rates'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY %I_auth ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Rate card
-- ============================================================
INSERT INTO hmis_hc_rates (service_code, service_name, category, rate, unit) VALUES
('HC-NV', 'Nursing Visit (Routine)', 'nursing_visit', 500, 'per_visit'),
('HC-NV-EXT', 'Nursing Visit (Extended 2hr+)', 'nursing_visit', 800, 'per_visit'),
('HC-NV-NIGHT', 'Night Nursing (8hr shift)', 'nursing_visit', 2000, 'per_shift'),
('HC-NV-24', '24-Hour Nursing Care', 'nursing_visit', 3500, 'per_day'),
('HC-DV', 'Doctor Home Visit', 'doctor_visit', 1500, 'per_visit'),
('HC-DV-SPEC', 'Specialist Home Visit', 'doctor_visit', 2500, 'per_visit'),
('HC-PT', 'Physiotherapy Session', 'physiotherapy', 800, 'per_session'),
('HC-IV', 'IV Infusion Administration', 'iv_therapy', 600, 'per_session'),
('HC-IV-CHEMO', 'Home Chemotherapy Administration', 'iv_therapy', 3000, 'per_session'),
('HC-WC', 'Wound Care / Dressing', 'wound_care', 400, 'per_visit'),
('HC-WC-VAC', 'VAC Dressing Change', 'wound_care', 1500, 'per_visit'),
('HC-INJ', 'Injection Administration', 'injection', 200, 'per_injection'),
('HC-INJ-SC', 'Subcutaneous Injection (Insulin/Enoxaparin)', 'injection', 150, 'per_injection'),
('HC-SC', 'Home Sample Collection', 'sample_collection', 300, 'per_visit'),
('HC-O2', 'Oxygen Concentrator Rental', 'equipment_rental', 500, 'per_day'),
('HC-VENT', 'Home Ventilator Rental', 'equipment_rental', 3000, 'per_day'),
('HC-BED', 'Hospital Bed Rental', 'equipment_rental', 300, 'per_day'),
('HC-SUC', 'Suction Machine Rental', 'equipment_rental', 200, 'per_day'),
('HC-NEB', 'Nebulizer Rental', 'equipment_rental', 100, 'per_day'),
('HC-PKG-POST', 'Post-Surgery Home Package (7 days)', 'package', 8000, 'per_package'),
('HC-PKG-PALL', 'Palliative Care Package (Monthly)', 'package', 15000, 'per_month'),
('HC-PKG-CHRON', 'Chronic Care Package (Monthly)', 'package', 10000, 'per_month')
ON CONFLICT (service_code) DO NOTHING;
