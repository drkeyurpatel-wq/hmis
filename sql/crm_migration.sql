-- Health1 HMIS — CRM Module + Integration Tables
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)

-- ============================================================
-- CRM LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  -- Lead source
  source varchar(50) NOT NULL DEFAULT 'walk_in', -- walk_in, phone, website, google_ads, facebook, referral, camp, leadsquared, dialshree
  source_campaign varchar(200),
  source_medium varchar(100), -- organic, paid, referral, direct
  utm_source varchar(200), utm_medium varchar(100), utm_campaign varchar(200),
  -- Contact
  first_name varchar(100) NOT NULL,
  last_name varchar(100),
  phone varchar(20) NOT NULL,
  phone_alt varchar(20),
  email varchar(200),
  gender varchar(10),
  age_years integer,
  city varchar(100),
  pincode varchar(10),
  -- Interest
  interested_department varchar(100), -- cardiology, ortho, neuro, etc.
  interested_doctor_id uuid REFERENCES hmis_staff(id),
  interested_procedure varchar(200),
  chief_complaint text,
  insurance_status varchar(20) DEFAULT 'unknown', -- has_insurance, pmjay, no_insurance, unknown
  insurance_company varchar(200),
  estimated_value decimal(12,2) DEFAULT 0,
  -- Pipeline
  status varchar(30) NOT NULL DEFAULT 'new', -- new, contacted, qualified, appointment_booked, visited, converted, lost, dnc
  stage varchar(30) DEFAULT 'awareness', -- awareness, consideration, decision, booked, visited, admitted, discharged
  priority varchar(10) DEFAULT 'medium', -- hot, warm, medium, cold
  score integer DEFAULT 0, -- lead score 0-100
  -- Assignment
  assigned_to uuid REFERENCES hmis_staff(id),
  assigned_at timestamp with time zone,
  -- Conversion
  patient_id uuid REFERENCES hmis_patients(id), -- set when converted
  appointment_id uuid,
  converted_at timestamp with time zone,
  conversion_revenue decimal(12,2) DEFAULT 0,
  lost_reason varchar(200),
  -- External IDs
  leadsquared_id varchar(100),
  dialshree_id varchar(100),
  -- Meta
  tags text[], -- ['vip', 'corporate', 'camp_nov_2025']
  custom_fields jsonb DEFAULT '{}',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_centre ON hmis_crm_leads(centre_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON hmis_crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON hmis_crm_leads(phone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON hmis_crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_leadsquared ON hmis_crm_leads(leadsquared_id);

-- ============================================================
-- CRM ACTIVITIES / FOLLOW-UPS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES hmis_crm_leads(id) ON DELETE CASCADE,
  centre_id uuid REFERENCES hmis_centres(id),
  activity_type varchar(30) NOT NULL, -- call, whatsapp, email, sms, meeting, note, status_change, appointment
  direction varchar(10), -- inbound, outbound (for calls/messages)
  -- Call details (from DialShree)
  call_duration_seconds integer,
  call_recording_url text,
  call_disposition varchar(50), -- answered, no_answer, busy, voicemail, wrong_number
  dialshree_call_id varchar(100),
  caller_number varchar(20),
  agent_number varchar(20),
  -- Content
  subject varchar(200),
  description text,
  -- Follow-up
  follow_up_date timestamp with time zone,
  follow_up_type varchar(30), -- call, whatsapp, visit
  follow_up_done boolean DEFAULT false,
  -- Meta
  performed_by uuid REFERENCES hmis_staff(id),
  performed_at timestamp with time zone DEFAULT now(),
  leadsquared_activity_id varchar(100),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON hmis_crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_followup ON hmis_crm_activities(follow_up_date) WHERE follow_up_done = false;
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON hmis_crm_activities(activity_type);

-- ============================================================
-- CRM CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  name varchar(200) NOT NULL,
  type varchar(30) NOT NULL, -- health_camp, digital_ads, referral, corporate_tie_up, awareness, screening
  status varchar(20) DEFAULT 'planned', -- planned, active, completed, cancelled
  start_date date,
  end_date date,
  budget decimal(12,2) DEFAULT 0,
  spent decimal(12,2) DEFAULT 0,
  target_department varchar(100),
  target_audience text,
  -- Metrics (auto-calculated)
  leads_generated integer DEFAULT 0,
  appointments_booked integer DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue_generated decimal(12,2) DEFAULT 0,
  -- External
  leadsquared_campaign_id varchar(100),
  google_ads_campaign_id varchar(100),
  facebook_campaign_id varchar(100),
  -- Meta
  created_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- INTEGRATION CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_integration_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  provider varchar(50) NOT NULL, -- leadsquared, dialshree, whatsapp, google_ads
  is_enabled boolean DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  -- LeadSquared: { api_host, access_key, secret_key }
  -- DialShree: { api_url, api_key, agent_id, campaign_id }
  -- WhatsApp: { api_url, api_token, business_phone }
  last_sync_at timestamp with time zone,
  sync_status varchar(20) DEFAULT 'idle', -- idle, syncing, error
  sync_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, provider)
);

-- ============================================================
-- INTEGRATION SYNC LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  provider varchar(50) NOT NULL,
  direction varchar(10) NOT NULL, -- push, pull
  entity_type varchar(50), -- lead, activity, appointment
  entity_id uuid,
  external_id varchar(200),
  status varchar(20) NOT NULL, -- success, error
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_centre ON hmis_integration_sync_log(centre_id, provider);
CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON hmis_integration_sync_log(entity_id);
