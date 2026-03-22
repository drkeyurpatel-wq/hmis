-- Health1 HMIS — Modules 18-21 Migration
-- Infection Control, Grievance, Telemedicine, Document/SOP

-- ============================================================
-- 18. INFECTION CONTROL (HICC)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_hai_surveillance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  infection_type varchar(20) NOT NULL, -- ssi, cauti, clabsi, vap, bsi, cdi, mrsa, vre, esbl, other
  site varchar(100),
  organism varchar(200),
  sensitivity_pattern jsonb DEFAULT '{}', -- {antibiotic: S/R/I}
  onset_date date,
  culture_date date,
  culture_result varchar(30), -- positive, negative, pending, contaminated
  device_related boolean DEFAULT false,
  device_type varchar(50), -- central_line, urinary_catheter, ventilator, surgical_site
  device_insertion_date date,
  device_removal_date date,
  device_days integer,
  ward varchar(100),
  is_community_acquired boolean DEFAULT false,
  outcome varchar(20), -- resolved, ongoing, death, transferred
  reported_by uuid REFERENCES hmis_staff(id),
  verified_by uuid REFERENCES hmis_staff(id),
  status varchar(20) DEFAULT 'suspected', -- suspected, confirmed, ruled_out
  action_taken text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hai_centre ON hmis_hai_surveillance(centre_id);
CREATE INDEX IF NOT EXISTS idx_hai_type ON hmis_hai_surveillance(infection_type);

CREATE TABLE IF NOT EXISTS hmis_antibiogram (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  year integer NOT NULL,
  quarter integer, -- 1-4
  organism varchar(200) NOT NULL,
  antibiotic varchar(200) NOT NULL,
  samples_tested integer DEFAULT 0,
  sensitive_count integer DEFAULT 0,
  resistant_count integer DEFAULT 0,
  intermediate_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, year, quarter, organism, antibiotic)
);

CREATE TABLE IF NOT EXISTS hmis_hand_hygiene_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  ward varchar(100) NOT NULL,
  audit_date date DEFAULT CURRENT_DATE,
  shift varchar(10), -- morning, afternoon, night
  moment varchar(30), -- before_patient, after_patient, after_body_fluid, before_aseptic, after_surroundings
  opportunities_observed integer DEFAULT 0,
  compliant integer DEFAULT 0,
  auditor_id uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_needle_stick_injuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  staff_id uuid REFERENCES hmis_staff(id),
  incident_date timestamp with time zone,
  location varchar(100),
  device_type varchar(50), -- syringe, iv_catheter, suture_needle, lancet, scalpel, other
  body_part_affected varchar(50),
  source_patient_id uuid REFERENCES hmis_patients(id),
  source_hiv_status varchar(20), -- positive, negative, unknown
  source_hbv_status varchar(20),
  source_hcv_status varchar(20),
  pep_given boolean DEFAULT false,
  pep_details text,
  baseline_labs_done boolean DEFAULT false,
  follow_up_status varchar(20) DEFAULT 'pending', -- pending, in_progress, completed, lost_to_followup
  outcome varchar(30), -- no_seroconversion, seroconversion, pending
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 19. PATIENT GRIEVANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_grievances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  grievance_number varchar(50),
  patient_id uuid REFERENCES hmis_patients(id),
  complainant_name varchar(200) NOT NULL,
  complainant_phone varchar(20),
  complainant_email varchar(200),
  complainant_relation varchar(50), -- self, spouse, parent, child, other
  complaint_type varchar(30) NOT NULL, -- clinical, billing, behavior, facility, food, delay, privacy, infection, other
  department varchar(100),
  description text NOT NULL,
  severity varchar(10) DEFAULT 'minor', -- minor, major, critical
  source varchar(20) DEFAULT 'in_person', -- in_person, phone, email, online, suggestion_box, social_media
  -- Workflow
  assigned_to uuid REFERENCES hmis_staff(id),
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid REFERENCES hmis_staff(id),
  investigated_by uuid REFERENCES hmis_staff(id),
  investigation_notes text,
  root_cause text,
  corrective_action text,
  preventive_action text,
  resolution text,
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES hmis_staff(id),
  -- Satisfaction
  patient_satisfied boolean,
  satisfaction_remarks text,
  -- Escalation
  escalated boolean DEFAULT false,
  escalated_to uuid REFERENCES hmis_staff(id),
  escalation_reason text,
  -- Meta
  status varchar(20) DEFAULT 'received', -- received, acknowledged, investigating, resolved, closed, escalated, reopened
  reopened_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grievances_centre ON hmis_grievances(centre_id, status);

-- ============================================================
-- 20. TELEMEDICINE
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_teleconsults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  patient_id uuid REFERENCES hmis_patients(id),
  doctor_id uuid REFERENCES hmis_staff(id),
  appointment_id uuid,
  scheduled_at timestamp with time zone NOT NULL,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  duration_minutes integer,
  room_url varchar(500), -- Jitsi/Daily.co room URL
  room_id varchar(100), -- unique room identifier
  -- Clinical
  chief_complaint text,
  consultation_notes text,
  diagnoses jsonb DEFAULT '[]',
  prescriptions jsonb DEFAULT '[]',
  investigations_ordered jsonb DEFAULT '[]',
  follow_up_date date,
  follow_up_notes text,
  -- Technical
  patient_joined_at timestamp with time zone,
  doctor_joined_at timestamp with time zone,
  connection_quality varchar(10), -- good, fair, poor
  recording_url text,
  -- Billing
  consultation_fee decimal(10,2),
  billing_done boolean DEFAULT false,
  bill_id uuid,
  -- Meta
  status varchar(20) DEFAULT 'scheduled', -- scheduled, waiting, in_progress, completed, no_show, cancelled, rescheduled
  cancellation_reason text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teleconsults_date ON hmis_teleconsults(centre_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_teleconsults_doctor ON hmis_teleconsults(doctor_id, status);

-- ============================================================
-- 21. DOCUMENT / SOP MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  doc_type varchar(20) NOT NULL, -- policy, sop, protocol, guideline, form, manual, circular, memo
  department varchar(100),
  title varchar(500) NOT NULL,
  doc_number varchar(50),
  version integer DEFAULT 1,
  content_html text,
  file_url text, -- Supabase storage URL
  file_size integer,
  -- Approval workflow
  created_by uuid REFERENCES hmis_staff(id),
  reviewed_by uuid REFERENCES hmis_staff(id),
  reviewed_at timestamp with time zone,
  approved_by uuid REFERENCES hmis_staff(id),
  approved_at timestamp with time zone,
  -- Dates
  effective_date date,
  review_date date, -- next review due
  superseded_date date,
  -- Classification
  tags text[],
  access_level varchar(20) DEFAULT 'all_staff', -- all_staff, department, management, confidential
  is_nabh_required boolean DEFAULT false,
  nabh_standard varchar(50), -- e.g. COP.1, MOM.2
  -- Meta
  status varchar(20) DEFAULT 'draft', -- draft, under_review, approved, superseded, archived
  previous_version_id uuid REFERENCES hmis_documents(id),
  download_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_centre ON hmis_documents(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_dept ON hmis_documents(department);
CREATE INDEX IF NOT EXISTS idx_documents_review ON hmis_documents(review_date) WHERE status = 'approved';
