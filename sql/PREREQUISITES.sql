-- ═══ PREREQUISITE TABLES (FK-free, just structure) ═══
-- These create base tables needed by ALTER scripts
-- FKs stripped to avoid dependency issues

-- ═══ PREREQUISITE TABLES (from REBUILD_FULL.sql) ═══
-- These must exist before ALTER scripts can run
-- All are CREATE TABLE IF NOT EXISTS — safe to re-run


-- hmis_centres
CREATE TABLE IF NOT EXISTS hmis_centres (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(10) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    city varchar(50) NOT NULL,
    state varchar(30) DEFAULT 'Gujarat',
    beds_paper int,
    beds_operational int,
    entity_type varchar(20) NOT NULL CHECK (entity_type IN ('owned','leased','o_and_m','partnership')),
    is_active boolean NOT NULL DEFAULT true,
    config_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_departments
CREATE TABLE IF NOT EXISTS hmis_departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL,
    name varchar(100) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('clinical','support','admin')),
    hod_staff_id uuid, -- FK added after staff table
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

-- hmis_wards
CREATE TABLE IF NOT EXISTS hmis_wards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL,
    name varchar(50) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('general','semi_private','private','icu','nicu','picu','isolation','transplant_icu')),
    floor varchar(10),
    department_id uuid,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

-- hmis_rooms
CREATE TABLE IF NOT EXISTS hmis_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id uuid NOT NULL,
    room_number varchar(10) NOT NULL,
    room_type varchar(20) NOT NULL,
    daily_rate decimal(10,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(ward_id, room_number)
);

-- hmis_beds
CREATE TABLE IF NOT EXISTS hmis_beds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL,
    bed_number varchar(10) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','maintenance','housekeeping')),
    current_admission_id uuid, -- FK added after admissions table
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(room_id, bed_number)
);

-- hmis_patients
CREATE TABLE IF NOT EXISTS hmis_patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    uhid varchar(20) NOT NULL UNIQUE,
    registration_centre_id uuid NOT NULL,
    first_name varchar(50) NOT NULL,
    middle_name varchar(50),
    last_name varchar(50) NOT NULL,
    date_of_birth date,
    age_years int,
    gender varchar(10) NOT NULL CHECK (gender IN ('male','female','other')),
    blood_group varchar(5),
    phone_primary varchar(15) NOT NULL,
    phone_secondary varchar(15),
    email varchar(100),
    address_line1 text,
    address_line2 text,
    city varchar(50),
    state varchar(30),
    pincode varchar(10),
    id_type varchar(20),
    id_number varchar(30), -- Consider pgcrypto encryption for production
    marital_status varchar(15),
    occupation varchar(50),
    nationality varchar(30) DEFAULT 'Indian',
    religion varchar(30),
    photo_url text,
    is_vip boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patients_uhid ON hmis_patients(uhid);
CREATE INDEX idx_patients_phone ON hmis_patients(phone_primary);
CREATE INDEX idx_patients_name ON hmis_patients USING gin (

-- hmis_staff
CREATE TABLE IF NOT EXISTS hmis_staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid UNIQUE, -- Links to Supabase auth.users
    employee_code varchar(20) NOT NULL UNIQUE,
    full_name varchar(100) NOT NULL,
    designation varchar(50),
    staff_type varchar(20) NOT NULL CHECK (staff_type IN ('doctor','nurse','technician','admin','support','pharmacist','lab_tech','receptionist','accountant')),
    department_id uuid,
    primary_centre_id uuid NOT NULL,
    phone varchar(15),
    email varchar(100),
    medical_reg_no varchar(30),
    specialisation varchar(100),
    signature_url text,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_admissions
CREATE TABLE IF NOT EXISTS hmis_admissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    ipd_number varchar(20) NOT NULL UNIQUE,
    admitting_doctor_id uuid NOT NULL,
    primary_doctor_id uuid NOT NULL,
    department_id uuid NOT NULL,
    bed_id uuid,
    admission_type varchar(20) NOT NULL CHECK (admission_type IN ('elective','emergency','transfer','daycare')),
    admission_date timestamptz NOT NULL,
    expected_discharge date,
    actual_discharge timestamptz,
    discharge_type varchar(20) CHECK (discharge_type IN ('normal','lama','dor','absconded','death','transfer')),
    payor_type varchar(20) NOT NULL CHECK (payor_type IN ('self','insurance','corporate','govt_pmjay','govt_cghs','govt_esi')),
    patient_insurance_id uuid,
    provisional_diagnosis text,
    final_diagnosis text,
    icd_codes jsonb,
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharge_initiated','discharged','cancelled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admissions_active ON hmis_admissions(centre_id, status) WHERE status = 'active';

-- hmis_appointments
CREATE TABLE IF NOT EXISTS hmis_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    department_id uuid NOT NULL,
    slot_id uuid,
    appointment_date date NOT NULL,
    appointment_time time,
    type varchar(20) NOT NULL CHECK (type IN ('new','followup','referral','emergency')),
    status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','checked_in','in_progress','completed','no_show','cancelled')),
    source varchar(20),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_date ON hmis_appointments(centre_id, appointment_date);
CREATE INDEX idx_appointments_doctor ON hmis_appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appt_date ON hmis_appointments(centre_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appt_doctor ON hmis_appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON hmis_appointments(patient_id, appointment_date DESC);

-- hmis_doctor_schedules
CREATE TABLE IF NOT EXISTS hmis_doctor_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL,
    centre_id uuid NOT NULL,
    department_id uuid NOT NULL,
    day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    slot_duration_min int NOT NULL DEFAULT 15,
    max_patients int,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_doctor_leaves
CREATE TABLE IF NOT EXISTS hmis_doctor_leaves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL,
    leave_date date NOT NULL,
    reason text,
    approved_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(doctor_id, leave_date)
);

-- hmis_bills
CREATE TABLE IF NOT EXISTS hmis_bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    bill_number varchar(20) NOT NULL UNIQUE,
    bill_type varchar(10) NOT NULL CHECK (bill_type IN ('opd','ipd','pharmacy','lab','radiology','package')),
    encounter_type varchar(10),
    encounter_id uuid,
    payor_type varchar(20) NOT NULL,
    patient_insurance_id uuid,
    package_id uuid,
    gross_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_amount decimal(12,2) NOT NULL DEFAULT 0,
    tax_amount decimal(12,2) NOT NULL DEFAULT 0,
    net_amount decimal(12,2) NOT NULL DEFAULT 0,
    paid_amount decimal(12,2) NOT NULL DEFAULT 0,
    balance_amount decimal(12,2) NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final','partially_paid','paid','cancelled','written_off')),
    bill_date date NOT NULL,
    due_date date,
    created_by uuid NOT NULL,
    approved_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bills_centre_date ON hmis_bills(centre_id, bill_date);

-- hmis_bill_items
CREATE TABLE IF NOT EXISTS hmis_bill_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL,
    tariff_id uuid,
    description varchar(200) NOT NULL,
    quantity decimal(8,2) NOT NULL DEFAULT 1,
    unit_rate decimal(10,2) NOT NULL,
    amount decimal(12,2) NOT NULL,
    discount decimal(10,2) NOT NULL DEFAULT 0,
    tax decimal(10,2) NOT NULL DEFAULT 0,
    net_amount decimal(12,2) NOT NULL,
    service_date date NOT NULL,
    department_id uuid,
    doctor_id uuid
);

-- hmis_ot_bookings
CREATE TABLE IF NOT EXISTS hmis_ot_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL,
    ot_room_id uuid NOT NULL,
    surgeon_id uuid NOT NULL,
    anaesthetist_id uuid,
    procedure_name varchar(200) NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_start time NOT NULL,
    estimated_duration_min int,
    actual_start timestamptz,
    actual_end timestamptz,
    status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled','postponed')),
    is_emergency boolean NOT NULL DEFAULT false,
    is_robotic boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ot_bookings_date ON hmis_ot_bookings(scheduled_date, status);

-- hmis_referrals
CREATE TABLE IF NOT EXISTS hmis_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  patient_id uuid,
  referral_type varchar(20) NOT NULL, -- internal, external_in, external_out
  -- Referring
  referring_doctor_name varchar(200),
  referring_doctor_phone varchar(20),
  referring_doctor_reg varchar(50), -- MCI/state reg number
  referring_hospital varchar(200),
  referring_city varchar(100),
  -- Referred to
  referred_to_doctor_id uuid,
  referred_to_department varchar(100),
  -- Clinical
  reason text,
  diagnosis varchar(200),
  urgency varchar(10) DEFAULT 'routine', -- emergency, urgent, routine
  -- Tracking
  status varchar(20) DEFAULT 'received', -- received, appointment_made, visited, admitted, completed, lost
  appointment_id uuid,
  admission_id uuid,
  -- Revenue
  expected_revenue decimal(12,2) DEFAULT 0,
  actual_revenue decimal(12,2) DEFAULT 0,
  referral_fee_pct decimal(5,2) DEFAULT 0,
  referral_fee_amount decimal(12,2) DEFAULT 0,
  fee_paid boolean DEFAULT false,
  fee_paid_date date,
  -- Meta
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_centre ON hmis_referrals(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_doctor ON hmis_referrals(referring_doctor_phone);

-- hmis_packages
CREATE TABLE IF NOT EXISTS hmis_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL,
    name varchar(200) NOT NULL,
    description text,
    room_category varchar(20) DEFAULT 'economy',
    expected_los int DEFAULT 3,
    items jsonb NOT NULL DEFAULT '[]',
    gross_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_percentage decimal(5,2) DEFAULT 0,
    net_amount decimal(12,2) NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_packages_centre ON hmis_packages(centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_packages_centre ON hmis_packages(centre_id, is_active);

-- hmis_dialysis_machines
CREATE TABLE IF NOT EXISTS hmis_dialysis_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  machine_number varchar(50) NOT NULL,
  brand varchar(100),
  model varchar(100),
  serial_number varchar(100),
  status varchar(20) DEFAULT 'available', -- available, in_use, maintenance, out_of_order
  last_maintenance_date date,
  next_maintenance_date date,
  total_sessions integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- hmis_dialysis_sessions
CREATE TABLE IF NOT EXISTS hmis_dialysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  patient_id uuid,
  machine_id uuid,
  session_date date DEFAULT CURRENT_DATE,
  session_number integer, -- this patient's Nth session
  dialysis_type varchar(20) DEFAULT 'hd', -- hd, hdf, pd, crrt, sled
  access_type varchar(20), -- av_fistula, av_graft, catheter_perm, catheter_temp
  -- Pre-dialysis
  pre_weight decimal(5,1),
  pre_bp varchar(20),
  pre_pulse integer,
  pre_temp decimal(4,1),
  target_uf decimal(6,1), -- ultrafiltration target in ml
  -- Session params
  dialyzer_type varchar(100),
  blood_flow_rate integer, -- ml/min
  dialysate_flow_rate integer,
  heparin_dose varchar(50),
  duration_minutes integer DEFAULT 240,
  actual_start timestamp with time zone,
  actual_end timestamp with time zone,
  -- Post-dialysis
  post_weight decimal(5,1),
  post_bp varchar(20),
  post_pulse integer,
  actual_uf decimal(6,1),
  -- Complications
  complications text[], -- hypotension, cramps, nausea, clotting, access_issue
  intradialytic_events text,
  -- Staff
  technician_id uuid,
  doctor_id uuid,
  status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  billing_done boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dialysis_sessions_date ON hmis_dialysis_sessions(centre_id, session_date);

-- hmis_cathlab_procedures
CREATE TABLE IF NOT EXISTS hmis_cathlab_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  patient_id uuid,
  admission_id uuid,
  procedure_date date DEFAULT CURRENT_DATE,
  procedure_type varchar(30) NOT NULL, -- cag, ptca, ppi, icd, ep_study, bmc, tavi, structural
  procedure_name varchar(200),
  -- Clinical
  indication text,
  access_site varchar(20), -- radial, femoral
  cag_findings text, -- LM, LAD, LCx, RCA findings
  vessels_involved text[],
  stents_placed jsonb DEFAULT '[]', -- [{vessel, type, brand, size, serial}]
  balloon_used jsonb DEFAULT '[]',
  -- Implant details
  implant_details jsonb DEFAULT '{}', -- pacemaker/ICD: {brand, model, serial, leads}
  -- Radiation
  fluoroscopy_time_min decimal(5,1),
  radiation_dose_mgy decimal(8,1),
  contrast_volume_ml integer,
  contrast_type varchar(50),
  -- Team
  primary_operator uuid,
  secondary_operator uuid,
  anesthetist_id uuid,
  -- Outcome
  procedure_status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, abandoned, complication
  outcome varchar(20), -- success, partial, failed
  complications text[],
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  billing_done boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cathlab_date ON hmis_cathlab_procedures(centre_id, procedure_date);

-- hmis_endoscopy_procedures
CREATE TABLE IF NOT EXISTS hmis_endoscopy_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  patient_id uuid,
  procedure_date date DEFAULT CURRENT_DATE,
  procedure_type varchar(30) NOT NULL, -- ogd, colonoscopy, ercp, eus, bronchoscopy, sigmoidoscopy
  indication text,
  sedation_type varchar(20), -- local, conscious, deep, ga
  scope_id varchar(50), -- track which scope used
  findings text,
  biopsy_taken boolean DEFAULT false,
  biopsy_details text,
  therapeutic_intervention text, -- polypectomy, banding, stenting, dilatation
  complications text[],
  endoscopist_id uuid,
  nurse_id uuid,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status varchar(20) DEFAULT 'scheduled',
  images jsonb DEFAULT '[]', -- [{url, description}]
  report text,
  billing_done boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- hmis_scope_decontamination
CREATE TABLE IF NOT EXISTS hmis_scope_decontamination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  scope_id varchar(50) NOT NULL,
  scope_type varchar(30), -- gastroscope, colonoscope, duodenoscope, bronchoscope
  procedure_id uuid,
  decontamination_method varchar(30), -- aer, manual, cidex
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  leak_test varchar(10), -- pass, fail
  culture_result varchar(20), -- pending, negative, positive
  performed_by uuid,
  status varchar(20) DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);

-- hmis_cssd_instrument_sets
CREATE TABLE IF NOT EXISTS hmis_cssd_instrument_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  set_name varchar(200) NOT NULL,
  set_code varchar(50),
  department varchar(100),
  instruments jsonb NOT NULL DEFAULT '[]', -- [{name, qty, condition}]
  total_instruments integer DEFAULT 0,
  status varchar(20) DEFAULT 'available', -- available, in_use, sterilizing, maintenance
  last_sterilized_at timestamp with time zone,
  sterilization_count integer DEFAULT 0,
  max_cycles integer DEFAULT 500,
  created_at timestamp with time zone DEFAULT now()
);

-- hmis_cssd_cycles
CREATE TABLE IF NOT EXISTS hmis_cssd_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  autoclave_number varchar(50),
  cycle_number varchar(50),
  cycle_type varchar(20), -- gravity, prevacuum, flash, eto
  load_items jsonb NOT NULL DEFAULT '[]', -- [{set_id, set_name}]
  temperature decimal(5,1),
  pressure decimal(5,2),
  duration_minutes integer,
  bi_test_result varchar(10), -- pass, fail, pending
  ci_result varchar(10), -- pass, fail
  operator_id uuid,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status varchar(20) DEFAULT 'in_progress', -- in_progress, completed, failed, recalled
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- hmis_cssd_issue_return
CREATE TABLE IF NOT EXISTS hmis_cssd_issue_return (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  set_id uuid,
  issued_to varchar(100), -- OT/Ward/Department name
  ot_booking_id uuid,
  issued_by uuid,
  issued_at timestamp with time zone DEFAULT now(),
  returned_at timestamp with time zone,
  returned_by uuid,
  condition_on_return varchar(20), -- good, damaged, missing_items
  missing_items jsonb DEFAULT '[]',
  notes text
);

-- hmis_diet_orders
CREATE TABLE IF NOT EXISTS hmis_diet_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id uuid NOT NULL,
    ordered_by uuid NOT NULL,
    diet_type varchar(30) NOT NULL,
    instructions text,
    effective_from timestamptz NOT NULL,
    effective_to timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_meal_service
CREATE TABLE IF NOT EXISTS hmis_meal_service (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  diet_order_id uuid,
  patient_id uuid,
  meal_type varchar(20) NOT NULL, -- breakfast, lunch, dinner, snack
  service_date date DEFAULT CURRENT_DATE,
  menu_items text[],
  served_by uuid,
  served_at timestamp with time zone,
  consumed varchar(20), -- full, partial, refused, npo
  wastage_pct integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_service_date ON hmis_meal_service(centre_id, service_date, meal_type);

-- hmis_physio_plans
CREATE TABLE IF NOT EXISTS hmis_physio_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  patient_id uuid,
  therapist_id uuid,
  diagnosis varchar(200),
  goals text[],
  treatment_plan text,
  total_sessions_planned integer DEFAULT 10,
  sessions_completed integer DEFAULT 0,
  frequency varchar(30), -- daily, alternate, twice_week, weekly
  status varchar(20) DEFAULT 'active', -- active, completed, discontinued
  start_date date,
  expected_end_date date,
  outcome_at_discharge text,
  created_at timestamp with time zone DEFAULT now()
);

-- hmis_physio_sessions
CREATE TABLE IF NOT EXISTS hmis_physio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid,
  patient_id uuid,
  admission_id uuid,
  therapist_id uuid,
  session_date date DEFAULT CURRENT_DATE,
  session_number integer,
  -- Assessment
  diagnosis varchar(200),
  treatment_area varchar(100), -- knee, shoulder, spine, neuro, cardiac, chest
  modalities text[], -- ift, tens, us, swd, laser, wax, traction, cpm
  exercises text[],
  manual_therapy text,
  -- Outcome
  pain_score_before integer, -- 0-10 VAS
  pain_score_after integer,
  rom_before jsonb DEFAULT '{}', -- {flexion: 90, extension: 0}
  rom_after jsonb DEFAULT '{}',
  functional_score integer, -- standardized outcome measure
  -- Meta
  duration_minutes integer DEFAULT 30,
  status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled, no_show
  billing_done boolean DEFAULT false,
  notes text,
  next_session_date date,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_physio_date ON hmis_physio_sessions(centre_id, session_date);
