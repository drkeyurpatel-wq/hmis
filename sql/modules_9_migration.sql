-- Health1 HMIS — 9 New Modules Migration
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)

-- ============================================================
-- 1. EMERGENCY / TRIAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_er_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  arrival_mode varchar(20) DEFAULT 'walk_in', -- walk_in, ambulance, referred, police
  arrival_time timestamp with time zone DEFAULT now(),
  triage_category varchar(10), -- red, orange, yellow, green, black (MTS/ESI)
  triage_score integer, -- 1-5 ESI
  triage_by uuid REFERENCES hmis_staff(id),
  triage_time timestamp with time zone,
  chief_complaint text,
  vitals jsonb DEFAULT '{}', -- bp, hr, rr, spo2, temp, gcs
  gcs_score integer, -- 3-15
  is_trauma boolean DEFAULT false,
  trauma_type varchar(50), -- rta, fall, assault, burn, poisoning, other
  is_mlc boolean DEFAULT false,
  mlc_number varchar(50),
  police_station varchar(100),
  fir_number varchar(50),
  er_bed_id uuid REFERENCES hmis_beds(id),
  attending_doctor_id uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'triaged', -- triaged, being_seen, under_observation, admitted, discharged, referred, dama, expired
  disposition varchar(20), -- admit, discharge, refer, dama, expired
  disposition_time timestamp with time zone,
  admission_id uuid REFERENCES hmis_admissions(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_er_visits_centre ON hmis_er_visits(centre_id, status);

-- ============================================================
-- 2. DIETARY / KITCHEN
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_diet_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  diet_type varchar(30) NOT NULL, -- regular, diabetic, renal, liquid, soft, npo, high_protein, low_salt, cardiac
  special_instructions text,
  allergies text[], -- food allergies
  meal_plan jsonb DEFAULT '{}', -- { breakfast: true, lunch: true, dinner: true, snacks: true }
  calorie_target integer,
  protein_target integer,
  ordered_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'active', -- active, modified, discontinued
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_meal_service (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  diet_order_id uuid REFERENCES hmis_diet_orders(id),
  patient_id uuid REFERENCES hmis_patients(id),
  meal_type varchar(20) NOT NULL, -- breakfast, lunch, dinner, snack
  service_date date DEFAULT CURRENT_DATE,
  menu_items text[],
  served_by uuid REFERENCES hmis_staff(id),
  served_at timestamp with time zone,
  consumed varchar(20), -- full, partial, refused, npo
  wastage_pct integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_service_date ON hmis_meal_service(centre_id, service_date, meal_type);

-- ============================================================
-- 3. CSSD (Central Sterile Supply Department)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_cssd_instrument_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
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

CREATE TABLE IF NOT EXISTS hmis_cssd_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  autoclave_number varchar(50),
  cycle_number varchar(50),
  cycle_type varchar(20), -- gravity, prevacuum, flash, eto
  load_items jsonb NOT NULL DEFAULT '[]', -- [{set_id, set_name}]
  temperature decimal(5,1),
  pressure decimal(5,2),
  duration_minutes integer,
  bi_test_result varchar(10), -- pass, fail, pending
  ci_result varchar(10), -- pass, fail
  operator_id uuid REFERENCES hmis_staff(id),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status varchar(20) DEFAULT 'in_progress', -- in_progress, completed, failed, recalled
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_cssd_issue_return (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  set_id uuid REFERENCES hmis_cssd_instrument_sets(id),
  issued_to varchar(100), -- OT/Ward/Department name
  ot_booking_id uuid,
  issued_by uuid REFERENCES hmis_staff(id),
  issued_at timestamp with time zone DEFAULT now(),
  returned_at timestamp with time zone,
  returned_by uuid REFERENCES hmis_staff(id),
  condition_on_return varchar(20), -- good, damaged, missing_items
  missing_items jsonb DEFAULT '[]',
  notes text
);

-- ============================================================
-- 4. DIALYSIS UNIT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_dialysis_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
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

CREATE TABLE IF NOT EXISTS hmis_dialysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  machine_id uuid REFERENCES hmis_dialysis_machines(id),
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
  technician_id uuid REFERENCES hmis_staff(id),
  doctor_id uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  billing_done boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dialysis_sessions_date ON hmis_dialysis_sessions(centre_id, session_date);

-- ============================================================
-- 5. CATH LAB
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_cathlab_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
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
  primary_operator uuid REFERENCES hmis_staff(id),
  secondary_operator uuid REFERENCES hmis_staff(id),
  anesthetist_id uuid REFERENCES hmis_staff(id),
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

-- ============================================================
-- 6. ENDOSCOPY UNIT (reuse for scopes)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_endoscopy_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
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
  endoscopist_id uuid REFERENCES hmis_staff(id),
  nurse_id uuid REFERENCES hmis_staff(id),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status varchar(20) DEFAULT 'scheduled',
  images jsonb DEFAULT '[]', -- [{url, description}]
  report text,
  billing_done boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_scope_decontamination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  scope_id varchar(50) NOT NULL,
  scope_type varchar(30), -- gastroscope, colonoscope, duodenoscope, bronchoscope
  procedure_id uuid REFERENCES hmis_endoscopy_procedures(id),
  decontamination_method varchar(30), -- aer, manual, cidex
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  leak_test varchar(10), -- pass, fail
  culture_result varchar(20), -- pending, negative, positive
  performed_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 7. PHYSIOTHERAPY / REHAB
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_physio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid,
  therapist_id uuid REFERENCES hmis_staff(id),
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

CREATE TABLE IF NOT EXISTS hmis_physio_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  therapist_id uuid REFERENCES hmis_staff(id),
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

-- ============================================================
-- 8. REFERRAL MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  referral_type varchar(20) NOT NULL, -- internal, external_in, external_out
  -- Referring
  referring_doctor_name varchar(200),
  referring_doctor_phone varchar(20),
  referring_doctor_reg varchar(50), -- MCI/state reg number
  referring_hospital varchar(200),
  referring_city varchar(100),
  -- Referred to
  referred_to_doctor_id uuid REFERENCES hmis_staff(id),
  referred_to_department varchar(100),
  -- Clinical
  reason text,
  diagnosis varchar(200),
  urgency varchar(10) DEFAULT 'routine', -- emergency, urgent, routine
  -- Tracking
  status varchar(20) DEFAULT 'received', -- received, appointment_made, visited, admitted, completed, lost
  appointment_id uuid,
  admission_id uuid REFERENCES hmis_admissions(id),
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

-- ============================================================
-- 9. PACKAGE MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  package_code varchar(50),
  package_name varchar(200) NOT NULL,
  department varchar(100),
  category varchar(30), -- surgical, medical, daycare, diagnostic, maternity
  procedure_type varchar(200),
  -- Pricing
  package_rate decimal(12,2) NOT NULL,
  rate_insurance decimal(12,2),
  rate_pmjay decimal(12,2),
  rate_cghs decimal(12,2),
  -- Inclusions
  inclusions jsonb NOT NULL DEFAULT '[]', -- [{category, item, included_qty, included_days}]
  exclusions text[], -- items NOT included
  los_days integer DEFAULT 3, -- expected length of stay
  room_category varchar(20) DEFAULT 'general', -- general, semi_private, private
  -- Validity
  is_active boolean DEFAULT true,
  valid_from date,
  valid_until date,
  -- Meta
  created_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_packages_centre ON hmis_packages(centre_id, is_active);

-- ============================================================
-- 10. DISCHARGE PLANNING (enhancement)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_discharge_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES hmis_admissions(id),
  centre_id uuid REFERENCES hmis_centres(id),
  -- Clinical
  medication_reconciliation boolean DEFAULT false,
  discharge_medications_reviewed boolean DEFAULT false,
  follow_up_appointments_set boolean DEFAULT false,
  wound_care_instructions boolean DEFAULT false,
  diet_instructions boolean DEFAULT false,
  activity_restrictions boolean DEFAULT false,
  warning_signs_explained boolean DEFAULT false,
  -- Administrative
  final_bill_generated boolean DEFAULT false,
  final_bill_settled boolean DEFAULT false,
  insurance_claim_submitted boolean DEFAULT false,
  discharge_summary_completed boolean DEFAULT false,
  discharge_summary_signed boolean DEFAULT false,
  patient_education_done boolean DEFAULT false,
  -- Logistics
  belongings_returned boolean DEFAULT false,
  transport_arranged boolean DEFAULT false,
  referral_letters_given boolean DEFAULT false,
  medical_certificate_issued boolean DEFAULT false,
  -- Sign-off
  completed_by uuid REFERENCES hmis_staff(id),
  completed_at timestamp with time zone,
  status varchar(20) DEFAULT 'pending', -- pending, in_progress, completed
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discharge_checklist ON hmis_discharge_checklists(admission_id);
