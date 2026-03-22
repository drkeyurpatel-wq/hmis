-- ════════════════════════════════════════════════════════════════
-- Health1 HMIS — COMPLETE SCHEMA (tables + indexes only)
-- NO seed data, NO RLS policies, NO DO $$ blocks
-- Project: bmuupgrzbfmddjwcqlss (Mumbai region)
-- Generated: 22 Mar 2026
-- ════════════════════════════════════════════════════════════════

-- STEP 0: DROP EVERYTHING
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'hmis_%' ORDER BY tablename) LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;


-- hmis_drug_master
CREATE TABLE IF NOT EXISTS hmis_drug_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    generic_name varchar(200) NOT NULL,
    brand_name varchar(200),
    manufacturer varchar(100),
    formulation varchar(30) NOT NULL,
    strength varchar(50),
    unit varchar(20) NOT NULL,
    schedule varchar(5),
    is_narcotic boolean NOT NULL DEFAULT false,
    is_antibiotic boolean NOT NULL DEFAULT false,
    hsn_code varchar(10),
    gst_rate decimal(4,2),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_drug_interactions
CREATE TABLE IF NOT EXISTS hmis_drug_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_a_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    drug_b_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    severity varchar(15) NOT NULL CHECK (severity IN ('mild','moderate','severe','contraindicated')),
    description text NOT NULL,
    recommendation text,
    UNIQUE(drug_a_id, drug_b_id)
);

-- hmis_radiology_templates
CREATE TABLE IF NOT EXISTS hmis_radiology_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modality varchar(20) NOT NULL,
    body_part varchar(50),
    template_name varchar(100) NOT NULL,
    technique_text text,
    findings_template text NOT NULL,
    impression_template text,
    is_normal boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_notification_templates
CREATE TABLE IF NOT EXISTS hmis_notification_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    channel varchar(15) NOT NULL CHECK (channel IN ('sms','whatsapp','email','push')),
    trigger_event varchar(50) NOT NULL,
    template_body text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_radiology_test_master
CREATE TABLE IF NOT EXISTS hmis_radiology_test_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_code varchar(20) NOT NULL UNIQUE,
    test_name varchar(200) NOT NULL,
    modality varchar(20) NOT NULL,
    body_part varchar(50),
    tat_hours int,
    is_contrast boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_qc_rules
CREATE TABLE IF NOT EXISTS hmis_lab_qc_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code varchar(10) NOT NULL UNIQUE,
    rule_name varchar(50) NOT NULL,
    description text,
    is_warning boolean NOT NULL DEFAULT false,
    is_rejection boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int DEFAULT 0
);

-- hmis_lab_organisms
CREATE TABLE IF NOT EXISTS hmis_lab_organisms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organism_code varchar(20) NOT NULL UNIQUE,
    organism_name varchar(200) NOT NULL,
    organism_type varchar(20) NOT NULL CHECK (organism_type IN ('bacteria_gp','bacteria_gn','fungi','mycobacteria','parasite','virus','other')),
    gram_stain varchar(20) CHECK (gram_stain IN ('gram_positive','gram_negative','na')),
    morphology varchar(50),
    is_alert_organism boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_roles
CREATE TABLE IF NOT EXISTS hmis_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(50) NOT NULL UNIQUE,
    description text,
    permissions jsonb NOT NULL DEFAULT '{}',
    is_system boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_test_master
CREATE TABLE IF NOT EXISTS hmis_lab_test_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_code varchar(20) NOT NULL UNIQUE,
    test_name varchar(200) NOT NULL,
    category varchar(50) NOT NULL,
    sample_type varchar(30) NOT NULL,
    is_panel boolean NOT NULL DEFAULT false,
    parent_test_id uuid REFERENCES hmis_lab_test_master(id),
    tat_hours int,
    is_outsourced boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_rejection_reasons
CREATE TABLE IF NOT EXISTS hmis_lab_rejection_reasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reason_code varchar(20) NOT NULL UNIQUE,
    reason_text varchar(200) NOT NULL,
    sample_type varchar(30),
    is_active boolean NOT NULL DEFAULT true
);

-- hmis_lab_test_parameters
CREATE TABLE IF NOT EXISTS hmis_lab_test_parameters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id) ON DELETE CASCADE,
    parameter_code varchar(20) NOT NULL,
    parameter_name varchar(100) NOT NULL,
    unit varchar(20),
    data_type varchar(10) NOT NULL DEFAULT 'numeric' CHECK (data_type IN ('numeric','text','option','formula')),
    decimal_places int DEFAULT 1,
    -- Reference ranges (default — overridden by age/gender rules below)
    ref_range_min decimal(10,3),
    ref_range_max decimal(10,3),
    ref_range_text varchar(100),
    -- Critical values
    critical_low decimal(10,3),
    critical_high decimal(10,3),
    -- Delta check (% change from previous result)
    delta_check_percent decimal(5,1),
    -- Display order within test
    sort_order int NOT NULL DEFAULT 0,
    -- For formula type: e.g., "A/G Ratio = albumin / globulin"
    formula text,
    -- Options for 'option' type (e.g., "Positive,Negative,Equivocal")
    option_values text,
    is_reportable boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(test_id, parameter_code)
);

-- hmis_stradus_sync_log
CREATE TABLE IF NOT EXISTS hmis_stradus_sync_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    direction varchar(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
    message_type varchar(20) NOT NULL,
    accession_number varchar(30),
    study_uid varchar(128),
    patient_uhid varchar(20),
    payload jsonb,
    response_code int,
    response_body text,
    error_message text,
    processed boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_antibiotics
CREATE TABLE IF NOT EXISTS hmis_lab_antibiotics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    antibiotic_code varchar(20) NOT NULL UNIQUE,
    antibiotic_name varchar(100) NOT NULL,
    antibiotic_class varchar(50) NOT NULL,
    route varchar(20) DEFAULT 'oral' CHECK (route IN ('oral','iv','im','topical','both')),
    is_restricted boolean NOT NULL DEFAULT false,
    sort_order int DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_tpas
CREATE TABLE IF NOT EXISTS hmis_tpas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    code varchar(20) UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_profiles
CREATE TABLE IF NOT EXISTS hmis_lab_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_code varchar(20) NOT NULL UNIQUE,
    profile_name varchar(100) NOT NULL,
    category varchar(50),
    description text,
    rate decimal(10,2),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

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

-- hmis_lab_antibiogram
CREATE TABLE IF NOT EXISTS hmis_lab_antibiogram (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    period_start date NOT NULL,
    period_end date NOT NULL,
    organism_id uuid NOT NULL REFERENCES hmis_lab_organisms(id),
    antibiotic_id uuid NOT NULL REFERENCES hmis_lab_antibiotics(id),
    total_isolates int NOT NULL DEFAULT 0,
    sensitive_count int NOT NULL DEFAULT 0,
    intermediate_count int NOT NULL DEFAULT 0,
    resistant_count int NOT NULL DEFAULT 0,
    susceptibility_percent decimal(5,1) GENERATED ALWAYS AS (
        CASE WHEN total_isolates > 0 THEN (sensitive_count::decimal / total_isolates * 100) ELSE 0 END
    ) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, period_start, period_end, organism_id, antibiotic_id)
);

-- hmis_hc_rates
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

-- hmis_integration_sync_log
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

-- hmis_antibiogram
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

-- hmis_fiscal_periods
CREATE TABLE IF NOT EXISTS hmis_fiscal_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name varchar(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_closed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_pharmacy_stock
CREATE TABLE IF NOT EXISTS hmis_pharmacy_stock (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    batch_number varchar(30) NOT NULL,
    expiry_date date NOT NULL,
    purchase_rate decimal(10,2) NOT NULL,
    mrp decimal(10,2) NOT NULL,
    quantity_received int NOT NULL,
    quantity_available int NOT NULL DEFAULT 0,
    quantity_dispensed int NOT NULL DEFAULT 0,
    supplier varchar(100),
    received_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_radiology_protocols
CREATE TABLE IF NOT EXISTS hmis_radiology_protocols (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modality varchar(20) NOT NULL,
    body_part varchar(50),
    protocol_name varchar(100) NOT NULL,
    prep_instructions text,
    patient_instructions text,
    contrast_required boolean DEFAULT false,
    fasting_hours int DEFAULT 0,
    hydration_instructions text,
    estimated_duration_min int,
    radiation_dose_msv decimal(6,2),
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_insurers
CREATE TABLE IF NOT EXISTS hmis_insurers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    code varchar(20) UNIQUE,
    contact_email varchar(100),
    contact_phone varchar(15),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_ot_rooms
CREATE TABLE IF NOT EXISTS hmis_ot_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(30) NOT NULL,
    type varchar(30),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

-- hmis_chart_of_accounts
CREATE TABLE IF NOT EXISTS hmis_chart_of_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code varchar(20) NOT NULL UNIQUE,
    account_name varchar(100) NOT NULL,
    account_type varchar(20) NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
    parent_id uuid REFERENCES hmis_chart_of_accounts(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_reflex_rules
CREATE TABLE IF NOT EXISTS hmis_lab_reflex_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name varchar(100) NOT NULL,
    -- Trigger: which test/parameter and condition
    trigger_test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    trigger_parameter_id uuid REFERENCES hmis_lab_test_parameters(id),
    trigger_condition varchar(10) NOT NULL CHECK (trigger_condition IN ('gt','gte','lt','lte','eq','neq','between','abnormal','critical')),
    trigger_value_1 decimal(10,3),
    trigger_value_2 decimal(10,3),
    -- Action: which test to auto-order
    reflex_test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    reflex_priority varchar(10) DEFAULT 'routine',
    -- Config
    requires_approval boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_pacs_config
CREATE TABLE IF NOT EXISTS hmis_pacs_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id) UNIQUE,
    pacs_vendor varchar(30) NOT NULL DEFAULT 'stradus',
    pacs_url text NOT NULL,
    viewer_url text,
    dicom_ae_title varchar(30),
    dicom_ip varchar(20),
    dicom_port int DEFAULT 104,
    hl7_ip varchar(20),
    hl7_port int DEFAULT 2575,
    api_key text,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_patients
CREATE TABLE IF NOT EXISTS hmis_patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    uhid varchar(20) NOT NULL UNIQUE,
    registration_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
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

-- hmis_settings
CREATE TABLE IF NOT EXISTS hmis_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid REFERENCES hmis_centres(id), -- NULL = global
    key varchar(100) NOT NULL,
    value jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, key)
);

-- hmis_lab_qc_lots
CREATE TABLE IF NOT EXISTS hmis_lab_qc_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_number varchar(50) NOT NULL,
    material_name varchar(100) NOT NULL,
    manufacturer varchar(100),
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    parameter_id uuid REFERENCES hmis_lab_test_parameters(id),
    level varchar(10) NOT NULL CHECK (level IN ('L1','L2','L3','normal','abnormal')),
    target_mean decimal(10,3) NOT NULL,
    target_sd decimal(10,3) NOT NULL,
    unit varchar(20),
    expiry_date date NOT NULL,
    opened_date date,
    is_active boolean NOT NULL DEFAULT true,
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(lot_number, test_id, level)
);

-- hmis_bb_donors
CREATE TABLE IF NOT EXISTS hmis_bb_donors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_number varchar(20) NOT NULL UNIQUE,
    donor_type varchar(15) NOT NULL CHECK (donor_type IN ('voluntary','replacement','autologous','directed')),
    -- Demographics
    first_name varchar(50) NOT NULL,
    last_name varchar(50),
    gender varchar(10) NOT NULL CHECK (gender IN ('male','female','other')),
    date_of_birth date NOT NULL,
    blood_group varchar(5) NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    phone varchar(15),
    address text,
    id_type varchar(20),
    id_number varchar(30),
    -- Medical screening
    weight_kg decimal(5,1),
    hb_level decimal(4,1),
    bp_systolic int,
    bp_diastolic int,
    pulse int,
    temperature decimal(4,1),
    -- Deferral
    is_deferred boolean NOT NULL DEFAULT false,
    deferral_reason text,
    deferral_type varchar(10) CHECK (deferral_type IN ('temporary','permanent')),
    deferral_until date,
    -- Status
    total_donations int NOT NULL DEFAULT 0,
    last_donation_date date,
    is_active boolean NOT NULL DEFAULT true,
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_role_permissions
CREATE TABLE IF NOT EXISTS hmis_role_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id uuid NOT NULL REFERENCES hmis_roles(id),
    module varchar(50) NOT NULL,
    action varchar(20) NOT NULL CHECK (action IN ('create','read','update','delete','approve')),
    scope varchar(20) NOT NULL DEFAULT 'own' CHECK (scope IN ('own','department','centre','all')),
    UNIQUE(role_id, module, action)
);

-- hmis_portal_tokens
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

-- hmis_lab_ref_ranges
CREATE TABLE IF NOT EXISTS hmis_lab_ref_ranges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_id uuid NOT NULL REFERENCES hmis_lab_test_parameters(id) ON DELETE CASCADE,
    gender varchar(10) CHECK (gender IN ('male','female','all')),
    age_min_years int DEFAULT 0,
    age_max_years int DEFAULT 150,
    ref_min decimal(10,3),
    ref_max decimal(10,3),
    ref_text varchar(100),
    unit varchar(20),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_vendors
CREATE TABLE IF NOT EXISTS hmis_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  name varchar(200) NOT NULL,
  code varchar(20),
  contact_person varchar(200),
  phone varchar(20),
  email varchar(200),
  category varchar(50), -- pharma, surgical, medical_equipment, it, facility, lab, consumables, other
  sub_category varchar(100),
  gst_number varchar(20),
  pan_number varchar(20),
  address_line1 text,
  address_line2 text,
  city varchar(100),
  state varchar(100),
  pincode varchar(10),
  bank_name varchar(100),
  bank_account varchar(30),
  bank_ifsc varchar(15),
  credit_days integer DEFAULT 30,
  rating decimal(2,1) DEFAULT 3.0, -- 1.0 to 5.0
  total_orders integer DEFAULT 0,
  total_value decimal(14,2) DEFAULT 0,
  last_order_date date,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- hmis_lab_report_templates
CREATE TABLE IF NOT EXISTS hmis_lab_report_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid REFERENCES hmis_lab_test_master(id),
    template_name varchar(100) NOT NULL,
    header_text text,
    footer_text text,
    interpretation_guide text,
    methodology text,
    specimen_requirements text,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_integration_bridge
CREATE TABLE IF NOT EXISTS hmis_integration_bridge (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    source_system varchar(20) NOT NULL CHECK (source_system IN ('billing','medpay','vpms','cashflow','tally')),
    target_system varchar(20) NOT NULL CHECK (target_system IN ('billing','medpay','vpms','cashflow','tally')),
    entity_type varchar(30) NOT NULL,
    entity_id uuid NOT NULL,
    external_ref varchar(100),
    sync_status varchar(10) DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','failed','skipped')),
    sync_data jsonb,
    error_message text,
    synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_drug_inventory
CREATE TABLE IF NOT EXISTS hmis_drug_inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    batch_number varchar(50) NOT NULL,
    expiry_date date NOT NULL,
    mrp decimal(10,2) NOT NULL,
    purchase_rate decimal(10,2) NOT NULL,
    quantity_received int NOT NULL,
    quantity_available int NOT NULL,
    location varchar(30),
    grn_id uuid, -- Link to VPMS GRN if applicable
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_loyalty_cards
CREATE TABLE IF NOT EXISTS hmis_loyalty_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    card_number varchar(20) NOT NULL UNIQUE,
    card_type varchar(15) NOT NULL CHECK (card_type IN ('silver','gold','platinum','staff','freedom_fighter','senior_citizen','bpl')),
    discount_opd decimal(5,2) DEFAULT 0,
    discount_ipd decimal(5,2) DEFAULT 0,
    discount_pharmacy decimal(5,2) DEFAULT 0,
    discount_lab decimal(5,2) DEFAULT 0,
    points_balance int DEFAULT 0,
    issued_date date NOT NULL DEFAULT CURRENT_DATE,
    valid_until date,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_antibiotic_panels
CREATE TABLE IF NOT EXISTS hmis_lab_antibiotic_panels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    panel_name varchar(50) NOT NULL,
    organism_type varchar(20) NOT NULL,
    antibiotic_id uuid NOT NULL REFERENCES hmis_lab_antibiotics(id),
    is_first_line boolean NOT NULL DEFAULT true,
    sort_order int DEFAULT 0,
    UNIQUE(panel_name, antibiotic_id)
);

-- hmis_govt_scheme_config
CREATE TABLE IF NOT EXISTS hmis_govt_scheme_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    scheme_code varchar(20) NOT NULL CHECK (scheme_code IN ('pmjay','cghs','echs','esi','mjpjay','bsby','mahatma_jyoti','other')),
    scheme_name varchar(100) NOT NULL,
    empanelment_number varchar(50),
    empanelment_valid_from date,
    empanelment_valid_to date,
    nodal_officer varchar(100),
    nodal_phone varchar(15),
    portal_url text,
    portal_login varchar(50),
    package_rates jsonb,
    max_claim_days int DEFAULT 15,
    submission_portal varchar(20) CHECK (submission_portal IN ('rohini','echs_portal','esi_portal','state_portal','direct','other')),
    auto_claim boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, scheme_code)
);

-- hmis_departments
CREATE TABLE IF NOT EXISTS hmis_departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(100) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('clinical','support','admin')),
    hod_staff_id uuid, -- FK added after staff table
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

-- hmis_nhcx_config
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

-- hmis_ambulances
CREATE TABLE IF NOT EXISTS hmis_ambulances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    vehicle_number varchar(20) NOT NULL UNIQUE,
    type varchar(20) NOT NULL,
    is_available boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_barcode_config
CREATE TABLE IF NOT EXISTS hmis_barcode_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id) UNIQUE,
    barcode_format varchar(20) NOT NULL DEFAULT 'uhid',  -- 'uhid', 'ipd_number', 'custom'
    prefix varchar(10),
    suffix varchar(10),
    include_name boolean DEFAULT false,
    include_dob boolean DEFAULT false,
    wristband_printer varchar(50),
    is_active boolean DEFAULT true
);

-- hmis_integration_config
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

-- hmis_corporates
CREATE TABLE IF NOT EXISTS hmis_corporates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    company_name varchar(200) NOT NULL,
    company_code varchar(20) UNIQUE,
    gst_number varchar(20),
    pan_number varchar(15),
    contact_person varchar(100),
    contact_email varchar(100),
    contact_phone varchar(15),
    billing_address text,
    credit_limit decimal(12,2) DEFAULT 500000,
    credit_period_days int DEFAULT 30,
    current_outstanding decimal(12,2) DEFAULT 0,
    payment_terms text,
    discount_percentage decimal(5,2) DEFAULT 0,
    mou_valid_from date,
    mou_valid_to date,
    mou_document_url text,
    status varchar(10) DEFAULT 'active' CHECK (status IN ('active','suspended','terminated')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_patient_contacts
CREATE TABLE IF NOT EXISTS hmis_patient_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    relationship varchar(30) NOT NULL,
    phone varchar(15) NOT NULL,
    is_emergency boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_radiology_rooms
CREATE TABLE IF NOT EXISTS hmis_radiology_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(50) NOT NULL,
    modality varchar(20) NOT NULL,
    manufacturer varchar(100),
    model varchar(100),
    dicom_ae_title varchar(30),
    dicom_ip varchar(20),
    dicom_port int,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

-- hmis_lab_profile_tests
CREATE TABLE IF NOT EXISTS hmis_lab_profile_tests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES hmis_lab_profiles(id) ON DELETE CASCADE,
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    sort_order int DEFAULT 0,
    UNIQUE(profile_id, test_id)
);

-- hmis_dialysis_machines
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

-- hmis_tariff_master
CREATE TABLE IF NOT EXISTS hmis_tariff_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    service_code varchar(20) NOT NULL,
    service_name varchar(200) NOT NULL,
    category varchar(30) NOT NULL,
    rate_self decimal(10,2) NOT NULL,
    rate_insurance decimal(10,2),
    rate_pmjay decimal(10,2),
    rate_cghs decimal(10,2),
    gst_applicable boolean NOT NULL DEFAULT false,
    gst_rate decimal(4,2) DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, service_code)
);

-- hmis_sequences
CREATE TABLE IF NOT EXISTS hmis_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    type varchar(30) NOT NULL,
    prefix varchar(10) NOT NULL,
    current_value bigint NOT NULL DEFAULT 0,
    fiscal_year varchar(10),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, type, fiscal_year)
);

-- hmis_corporate_employees
CREATE TABLE IF NOT EXISTS hmis_corporate_employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    corporate_id uuid NOT NULL REFERENCES hmis_corporates(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    employee_id varchar(50),
    relationship varchar(20) DEFAULT 'self' CHECK (relationship IN ('self','spouse','child','parent','dependent')),
    coverage_type varchar(20) DEFAULT 'full' CHECK (coverage_type IN ('full','partial','opd_only','ipd_only','emergency_only')),
    max_coverage decimal(12,2),
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_cssd_instrument_sets
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

-- hmis_patient_emergency_contacts
CREATE TABLE IF NOT EXISTS hmis_patient_emergency_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    relationship varchar(30) NOT NULL,
    phone varchar(15) NOT NULL,
    alternate_phone varchar(15),
    is_primary boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_portal_access_log
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

-- hmis_patient_insurance
CREATE TABLE IF NOT EXISTS hmis_patient_insurance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    insurer_id uuid NOT NULL REFERENCES hmis_insurers(id),
    tpa_id uuid REFERENCES hmis_tpas(id),
    policy_number varchar(50) NOT NULL,
    policy_type varchar(30),
    sum_insured decimal(12,2),
    valid_from date,
    valid_to date,
    is_primary boolean NOT NULL DEFAULT true,
    scheme varchar(30), -- pmjay | cghs | esi | private | none
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_insurer_tariffs
CREATE TABLE IF NOT EXISTS hmis_insurer_tariffs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_id uuid NOT NULL REFERENCES hmis_insurers(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    tariff_id uuid NOT NULL REFERENCES hmis_tariff_master(id),
    agreed_rate decimal(10,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_package_master
CREATE TABLE IF NOT EXISTS hmis_package_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    package_name varchar(200) NOT NULL,
    package_code varchar(20),
    department_id uuid REFERENCES hmis_departments(id),
    total_amount decimal(12,2) NOT NULL,
    inclusions jsonb NOT NULL,
    exclusions jsonb,
    validity_days int,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_staff
CREATE TABLE IF NOT EXISTS hmis_staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid UNIQUE, -- Links to Supabase auth.users
    employee_code varchar(20) NOT NULL UNIQUE,
    full_name varchar(100) NOT NULL,
    designation varchar(50),
    staff_type varchar(20) NOT NULL CHECK (staff_type IN ('doctor','nurse','technician','admin','support','pharmacist','lab_tech','receptionist','accountant')),
    department_id uuid REFERENCES hmis_departments(id),
    primary_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
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

-- hmis_grievances
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

-- hmis_settlements
CREATE TABLE IF NOT EXISTS hmis_settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    settlement_type varchar(20) NOT NULL CHECK (settlement_type IN ('insurance','tpa','pmjay','cghs','echs','esi','corporate')),
    insurer_id uuid REFERENCES hmis_insurers(id),
    tpa_id uuid REFERENCES hmis_tpas(id),
    corporate_id uuid REFERENCES hmis_corporates(id),
    settlement_number varchar(50),
    utr_number varchar(50),
    settlement_date date NOT NULL,
    total_claims int NOT NULL DEFAULT 0,
    claimed_amount decimal(14,2) NOT NULL DEFAULT 0,
    approved_amount decimal(14,2) DEFAULT 0,
    settled_amount decimal(14,2) NOT NULL DEFAULT 0,
    tds_amount decimal(12,2) DEFAULT 0,
    disallowance_amount decimal(12,2) DEFAULT 0,
    net_received decimal(14,2) NOT NULL DEFAULT 0,
    bank_account varchar(30),
    payment_mode varchar(20),
    remarks text,
    reconciled boolean DEFAULT false,
    reconciled_by uuid REFERENCES hmis_staff(id),
    reconciled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_crm_leads
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

-- hmis_audit_trail
CREATE TABLE IF NOT EXISTS hmis_audit_trail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    user_id uuid NOT NULL REFERENCES hmis_staff(id),
    action varchar(20) NOT NULL CHECK (action IN ('create','update','delete','view','print','sign','cancel','approve','reject')),
    entity_type varchar(30) NOT NULL,
    entity_id uuid,
    entity_label varchar(200),
    changes jsonb,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_qc_results
CREATE TABLE IF NOT EXISTS hmis_lab_qc_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL REFERENCES hmis_lab_qc_lots(id),
    run_date date NOT NULL DEFAULT CURRENT_DATE,
    run_number int NOT NULL DEFAULT 1,
    measured_value decimal(10,3) NOT NULL,
    -- Calculated fields
    z_score decimal(5,2),
    sd_from_mean decimal(5,2),
    -- Westgard violations
    westgard_violation varchar(20),
    is_accepted boolean NOT NULL DEFAULT true,
    rejection_reason text,
    -- Corrective action
    corrective_action text,
    -- Staff
    performed_by uuid NOT NULL REFERENCES hmis_staff(id),
    reviewed_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_billing_auto_rules
CREATE TABLE IF NOT EXISTS hmis_billing_auto_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    rule_name varchar(100) NOT NULL,
    trigger_type varchar(20) NOT NULL CHECK (trigger_type IN ('daily','admission','discharge','procedure','investigation','pharmacy')),
    ward_type varchar(20),
    tariff_id uuid REFERENCES hmis_tariff_master(id),
    charge_description varchar(200) NOT NULL,
    charge_amount decimal(10,2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_teleconsults
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

-- hmis_patient_allergies
CREATE TABLE IF NOT EXISTS hmis_patient_allergies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    allergen varchar(100) NOT NULL,
    severity varchar(10) NOT NULL CHECK (severity IN ('mild','moderate','severe')),
    reaction text,
    recorded_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_assets
CREATE TABLE IF NOT EXISTS hmis_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  asset_tag varchar(50) NOT NULL,
  -- Details
  name varchar(200) NOT NULL,
  description text,
  category varchar(30) NOT NULL, -- furniture, it_hardware, it_software, medical_equipment, surgical_instrument, vehicle, building, electrical, plumbing, hvac, other
  sub_category varchar(100),
  brand varchar(100),
  model varchar(100),
  serial_number varchar(100),
  -- Location
  department varchar(100),
  location varchar(200),
  floor varchar(20),
  room varchar(50),
  -- Purchase
  purchase_date date,
  purchase_cost decimal(12,2),
  purchase_order_number varchar(50),
  vendor varchar(200),
  invoice_number varchar(50),
  -- Warranty & AMC
  warranty_expiry date,
  amc_vendor varchar(200),
  amc_start_date date,
  amc_expiry date,
  amc_cost_annual decimal(10,2),
  amc_type varchar(20), -- comprehensive, non_comprehensive, camc
  -- Depreciation
  useful_life_years integer DEFAULT 10,
  depreciation_method varchar(20) DEFAULT 'straight_line', -- straight_line, wdv (written down value)
  depreciation_rate decimal(5,2), -- % per year for WDV
  salvage_value decimal(10,2) DEFAULT 0,
  current_book_value decimal(12,2),
  -- Status
  status varchar(20) DEFAULT 'in_use', -- in_use, in_storage, under_maintenance, condemned, disposed, lost, transferred
  condition varchar(20) DEFAULT 'good', -- new, good, fair, poor, non_functional
  -- Disposal
  disposed_date date,
  disposal_method varchar(20), -- sold, scrapped, donated, returned
  disposal_value decimal(10,2),
  disposal_approved_by uuid REFERENCES hmis_staff(id),
  -- Custodian
  custodian_id uuid REFERENCES hmis_staff(id),
  custodian_department varchar(100),
  -- Meta
  qr_code varchar(200),
  photo_url text,
  documents jsonb DEFAULT '[]', -- [{name, url, type}]
  last_audit_date date,
  next_audit_date date,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(centre_id, asset_tag)
);

-- hmis_pharmacy_transfers
CREATE TABLE IF NOT EXISTS hmis_pharmacy_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number varchar(20) NOT NULL,
    from_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    to_centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    status varchar(15) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','in_transit','received','cancelled')),
    items jsonb NOT NULL DEFAULT '[]',
    initiated_by uuid REFERENCES hmis_staff(id),
    received_by uuid REFERENCES hmis_staff(id),
    initiated_at timestamptz NOT NULL DEFAULT now(),
    received_at timestamptz
);

-- hmis_crm_campaigns
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

-- hmis_wards
CREATE TABLE IF NOT EXISTS hmis_wards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(50) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('general','semi_private','private','icu','nicu','picu','isolation','transplant_icu')),
    floor varchar(10),
    department_id uuid REFERENCES hmis_departments(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

-- hmis_procedures_performed
CREATE TABLE IF NOT EXISTS hmis_procedures_performed (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10) NOT NULL,
    encounter_id uuid NOT NULL,
    procedure_code varchar(20),
    procedure_name varchar(200) NOT NULL,
    performed_by uuid NOT NULL REFERENCES hmis_staff(id),
    assistant_ids jsonb,
    anaesthesia_type varchar(20),
    start_time timestamptz,
    end_time timestamptz,
    notes text,
    complications text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_bills
CREATE TABLE IF NOT EXISTS hmis_bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    bill_number varchar(20) NOT NULL UNIQUE,
    bill_type varchar(10) NOT NULL CHECK (bill_type IN ('opd','ipd','pharmacy','lab','radiology','package')),
    encounter_type varchar(10),
    encounter_id uuid,
    payor_type varchar(20) NOT NULL,
    patient_insurance_id uuid REFERENCES hmis_patient_insurance(id),
    package_id uuid REFERENCES hmis_package_master(id),
    gross_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_amount decimal(12,2) NOT NULL DEFAULT 0,
    tax_amount decimal(12,2) NOT NULL DEFAULT 0,
    net_amount decimal(12,2) NOT NULL DEFAULT 0,
    paid_amount decimal(12,2) NOT NULL DEFAULT 0,
    balance_amount decimal(12,2) NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final','partially_paid','paid','cancelled','written_off')),
    bill_date date NOT NULL,
    due_date date,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    approved_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_emr_templates
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

-- hmis_orders
CREATE TABLE IF NOT EXISTS hmis_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10) NOT NULL,
    encounter_id uuid NOT NULL,
    order_type varchar(20) NOT NULL CHECK (order_type IN ('lab','radiology','pharmacy','procedure','diet','nursing')),
    ordered_by uuid NOT NULL REFERENCES hmis_staff(id),
    priority varchar(10) NOT NULL DEFAULT 'routine' CHECK (priority IN ('stat','urgent','routine')),
    status varchar(20) NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','in_progress','completed','cancelled')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_audit_log
CREATE TABLE IF NOT EXISTS hmis_audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name varchar(50) NOT NULL,
    record_id uuid NOT NULL,
    action varchar(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    old_data jsonb,
    new_data jsonb,
    staff_id uuid REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_endoscopy_procedures
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

-- hmis_asset_audit_log
CREATE TABLE IF NOT EXISTS hmis_asset_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES hmis_assets(id),
  centre_id uuid REFERENCES hmis_centres(id),
  audit_type varchar(20) NOT NULL, -- physical_verification, condition_check, transfer, maintenance, disposal
  audit_date date DEFAULT CURRENT_DATE,
  previous_location varchar(200),
  current_location varchar(200),
  previous_condition varchar(20),
  current_condition varchar(20),
  findings text,
  audited_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- hmis_lab_tat_config
CREATE TABLE IF NOT EXISTS hmis_lab_tat_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    priority varchar(10) NOT NULL DEFAULT 'routine',
    tat_minutes int NOT NULL,
    escalation_minutes int,
    escalation_to uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(test_id, priority)
);

-- hmis_patient_documents
CREATE TABLE IF NOT EXISTS hmis_patient_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    doc_type varchar(30) NOT NULL,
    file_url text NOT NULL,
    file_name varchar(200) NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_cssd_cycles
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

-- hmis_discount_log
CREATE TABLE IF NOT EXISTS hmis_discount_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    discount_type varchar(15) NOT NULL CHECK (discount_type IN ('percentage','flat','item_level','staff','management','insurance_write_off')),
    discount_amount decimal(12,2) NOT NULL,
    discount_percentage decimal(5,2),
    reason text NOT NULL,
    authorized_by uuid NOT NULL REFERENCES hmis_staff(id),
    authorization_level varchar(15) CHECK (authorization_level IN ('billing_staff','supervisor','manager','md')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_incidents
CREATE TABLE IF NOT EXISTS hmis_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    incident_number varchar(20) NOT NULL UNIQUE,
    category varchar(30) NOT NULL CHECK (category IN (
        'medication_error','fall','infection','surgical','transfusion',
        'equipment','documentation','communication','delay','abuse',
        'needle_stick','fire_safety','other'
    )),
    severity varchar(15) NOT NULL CHECK (severity IN ('near_miss','minor','moderate','serious','sentinel')),
    description text NOT NULL,
    location varchar(50),
    patient_id uuid REFERENCES hmis_patients(id),
    involved_staff text,
    immediate_action text,
    root_cause text,
    corrective_action text,
    preventive_action text,
    status varchar(15) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','investigating','action_taken','closed','reopened')),
    reported_by uuid NOT NULL REFERENCES hmis_staff(id),
    assigned_to uuid REFERENCES hmis_staff(id),
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_physio_sessions
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

-- hmis_lab_documents
CREATE TABLE IF NOT EXISTS hmis_lab_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number varchar(30) NOT NULL UNIQUE,
    doc_title varchar(200) NOT NULL,
    doc_type varchar(20) NOT NULL CHECK (doc_type IN ('sop','manual','form','policy','work_instruction','register','checklist')),
    department varchar(50),
    version varchar(10) NOT NULL DEFAULT '1.0',
    effective_date date NOT NULL DEFAULT CURRENT_DATE,
    review_date date,
    status varchar(15) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','under_review','superseded','obsolete')),
    prepared_by uuid REFERENCES hmis_staff(id),
    reviewed_by uuid REFERENCES hmis_staff(id),
    approved_by uuid REFERENCES hmis_staff(id),
    file_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_doctor_leaves
CREATE TABLE IF NOT EXISTS hmis_doctor_leaves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    leave_date date NOT NULL,
    reason text,
    approved_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(doctor_id, leave_date)
);

-- hmis_cdss_usage
CREATE TABLE IF NOT EXISTS hmis_cdss_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_name varchar(100) NOT NULL,
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    attributes_used text[] NOT NULL DEFAULT '{}',
    attributes_skipped text[] NOT NULL DEFAULT '{}',
    chip_selections jsonb NOT NULL DEFAULT '{}',
    free_text_entries jsonb NOT NULL DEFAULT '{}',
    time_spent_ms int DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_vitals
CREATE TABLE IF NOT EXISTS hmis_vitals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10),
    encounter_id uuid,
    temperature decimal(4,1),
    pulse int,
    bp_systolic int,
    bp_diastolic int,
    resp_rate int,
    spo2 decimal(4,1),
    weight_kg decimal(5,1),
    height_cm decimal(5,1),
    bmi decimal(4,1),
    pain_scale int CHECK (pain_scale BETWEEN 0 AND 10),
    gcs int CHECK (gcs BETWEEN 3 AND 15),
    blood_sugar decimal(5,1),
    recorded_by uuid NOT NULL REFERENCES hmis_staff(id),
    recorded_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_orders
CREATE TABLE IF NOT EXISTS hmis_lab_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_orders(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    test_id uuid NOT NULL REFERENCES hmis_lab_test_master(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    status varchar(20) NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','sample_collected','processing','completed','cancelled')),
    ordered_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_ncr
CREATE TABLE IF NOT EXISTS hmis_lab_ncr (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ncr_number varchar(30) NOT NULL UNIQUE,
    ncr_type varchar(20) NOT NULL CHECK (ncr_type IN ('non_conformance','complaint','incident','capa','preventive_action')),
    title varchar(200) NOT NULL,
    description text NOT NULL,
    root_cause text,
    corrective_action text,
    preventive_action text,
    severity varchar(10) CHECK (severity IN ('minor','major','critical')),
    status varchar(15) NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','action_taken','closed','verified')),
    reported_by uuid NOT NULL REFERENCES hmis_staff(id),
    assigned_to uuid REFERENCES hmis_staff(id),
    due_date date,
    closed_date date,
    closed_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_quality_indicators
CREATE TABLE IF NOT EXISTS hmis_quality_indicators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    indicator_code varchar(10) NOT NULL,
    indicator_name varchar(100) NOT NULL,
    period varchar(10) NOT NULL, -- '2026-03' format
    value decimal(10,2) NOT NULL,
    numerator int,
    denominator int,
    target decimal(10,2),
    met_target boolean,
    submitted_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, indicator_code, period)
);

-- hmis_pharmacy_po
CREATE TABLE IF NOT EXISTS hmis_pharmacy_po (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    po_number varchar(20) NOT NULL,
    supplier varchar(200) NOT NULL,
    supplier_gst varchar(20),
    order_date date NOT NULL DEFAULT CURRENT_DATE,
    expected_date date,
    status varchar(15) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial_received','received','cancelled')),
    items jsonb NOT NULL DEFAULT '[]',
    total_amount decimal(12,2) DEFAULT 0,
    notes text,
    created_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_hand_hygiene_audit
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

-- hmis_homecare_plans
CREATE TABLE IF NOT EXISTS hmis_homecare_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    plan_type varchar(30) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    instructions text,
    status varchar(15) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_diagnoses
CREATE TABLE IF NOT EXISTS hmis_diagnoses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_type varchar(10) NOT NULL,
    encounter_id uuid NOT NULL,
    icd_code varchar(10) NOT NULL,
    icd_description varchar(200) NOT NULL,
    diagnosis_type varchar(20) NOT NULL CHECK (diagnosis_type IN ('provisional','confirmed','differential','final')),
    is_primary boolean NOT NULL DEFAULT false,
    diagnosed_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_patient_history
CREATE TABLE IF NOT EXISTS hmis_patient_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id) ON DELETE CASCADE,
    history_type varchar(20) NOT NULL CHECK (history_type IN ('medical','surgical','family','social')),
    description text NOT NULL,
    icd_code varchar(10),
    recorded_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_results
CREATE TABLE IF NOT EXISTS hmis_lab_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    parameter_name varchar(100) NOT NULL,
    result_value varchar(100) NOT NULL,
    unit varchar(20),
    normal_range_min decimal(10,3),
    normal_range_max decimal(10,3),
    is_abnormal boolean NOT NULL DEFAULT false,
    is_critical boolean NOT NULL DEFAULT false,
    validated_by uuid REFERENCES hmis_staff(id),
    validated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_purchase_indents
CREATE TABLE IF NOT EXISTS hmis_purchase_indents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES hmis_centres(id),
  indent_number varchar(30) NOT NULL,
  department varchar(100) NOT NULL,
  -- Items
  items jsonb NOT NULL DEFAULT '[]',
  -- items: [{item_name, qty, unit, specification, urgency: routine/urgent/emergency, estimated_cost}]
  total_estimated_cost decimal(12,2) DEFAULT 0,
  -- Workflow
  requested_by uuid REFERENCES hmis_staff(id),
  approved_by uuid REFERENCES hmis_staff(id),
  approved_at timestamp with time zone,
  rejected_by uuid REFERENCES hmis_staff(id),
  rejected_at timestamp with time zone,
  rejection_reason text,
  po_id uuid REFERENCES hmis_pharmacy_po(id),
  -- Meta
  priority varchar(10) DEFAULT 'routine', -- routine, urgent, emergency
  status varchar(20) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected, ordered, partially_received, received, cancelled
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- hmis_pharmacy_returns
CREATE TABLE IF NOT EXISTS hmis_pharmacy_returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    return_type varchar(15) NOT NULL CHECK (return_type IN ('patient_return','supplier_return','expiry_write_off','damage_write_off','adjustment')),
    drug_id uuid NOT NULL REFERENCES hmis_drug_master(id),
    batch_id uuid REFERENCES hmis_pharmacy_stock(id),
    batch_number varchar(50),
    quantity int NOT NULL,
    reason text,
    credit_note_number varchar(30),
    credit_amount decimal(10,2) DEFAULT 0,
    patient_id uuid REFERENCES hmis_patients(id),
    supplier varchar(200),
    processed_by uuid NOT NULL REFERENCES hmis_staff(id),
    status varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processed','rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_radiology_orders
CREATE TABLE IF NOT EXISTS hmis_radiology_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_orders(id),
    test_id uuid NOT NULL REFERENCES hmis_radiology_test_master(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    clinical_indication text,
    status varchar(20) NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','scheduled','in_progress','reported','verified')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_cssd_issue_return
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

-- hmis_portal_feedback
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

-- hmis_lab_audit_log
CREATE TABLE IF NOT EXISTS hmis_lab_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- What
    entity_type varchar(30) NOT NULL CHECK (entity_type IN (
        'order','result','sample','culture','sensitivity','qc_result',
        'histo_case','cyto_case','report','critical_alert','outsourced','lot'
    )),
    entity_id uuid NOT NULL,
    action varchar(20) NOT NULL CHECK (action IN (
        'create','update','delete','verify','reject','print','dispatch',
        'collect','receive','report','amend','acknowledge','cancel'
    )),
    -- Who
    performed_by uuid NOT NULL REFERENCES hmis_staff(id),
    -- When
    performed_at timestamptz NOT NULL DEFAULT now(),
    -- What changed
    field_name varchar(50),
    old_value text,
    new_value text,
    -- Context
    ip_address varchar(45),
    user_agent text,
    reason text,
    -- Metadata
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_payments
CREATE TABLE IF NOT EXISTS hmis_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    amount decimal(12,2) NOT NULL,
    payment_mode varchar(20) NOT NULL CHECK (payment_mode IN ('cash','card','upi','neft','cheque','insurance_settlement')),
    reference_number varchar(50),
    receipt_number varchar(20) NOT NULL UNIQUE,
    payment_date date NOT NULL,
    received_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_bill_items
CREATE TABLE IF NOT EXISTS hmis_bill_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id) ON DELETE CASCADE,
    tariff_id uuid REFERENCES hmis_tariff_master(id),
    description varchar(200) NOT NULL,
    quantity decimal(8,2) NOT NULL DEFAULT 1,
    unit_rate decimal(10,2) NOT NULL,
    amount decimal(12,2) NOT NULL,
    discount decimal(10,2) NOT NULL DEFAULT 0,
    tax decimal(10,2) NOT NULL DEFAULT 0,
    net_amount decimal(12,2) NOT NULL,
    service_date date NOT NULL,
    department_id uuid REFERENCES hmis_departments(id),
    doctor_id uuid REFERENCES hmis_staff(id)
);

-- hmis_cdss_alerts
CREATE TABLE IF NOT EXISTS hmis_cdss_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_id uuid,
    alert_type varchar(30) NOT NULL,
    severity varchar(10) NOT NULL CHECK (severity IN ('info','warning','critical')),
    message text NOT NULL,
    source_data jsonb,
    action_taken varchar(20),
    acted_by uuid REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_physio_plans
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

-- hmis_ai_summaries
CREATE TABLE IF NOT EXISTS hmis_ai_summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    encounter_id uuid NOT NULL,
    summary_type varchar(20) NOT NULL,
    generated_text text NOT NULL,
    final_text text,
    model_used varchar(50),
    reviewed_by uuid REFERENCES hmis_staff(id),
    is_approved boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_samples
CREATE TABLE IF NOT EXISTS hmis_lab_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    barcode varchar(30) NOT NULL UNIQUE,
    sample_type varchar(30) NOT NULL,
    collected_by uuid NOT NULL REFERENCES hmis_staff(id),
    collected_at timestamptz NOT NULL DEFAULT now(),
    received_at timestamptz,
    status varchar(15) NOT NULL DEFAULT 'collected' CHECK (status IN ('collected','in_transit','received','rejected'))
);

-- hmis_prescriptions
CREATE TABLE IF NOT EXISTS hmis_prescriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES hmis_orders(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    drug_id uuid, -- FK added after drug_master
    drug_name varchar(200) NOT NULL, -- Denormalized for quick access
    dosage varchar(50) NOT NULL,
    frequency varchar(30) NOT NULL,
    route varchar(20) NOT NULL,
    duration_days int,
    quantity int,
    instructions text,
    is_substitutable boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_staff_centres
CREATE TABLE IF NOT EXISTS hmis_staff_centres (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    role_id uuid NOT NULL REFERENCES hmis_roles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(staff_id, centre_id)
);

-- hmis_clinical_templates
CREATE TABLE IF NOT EXISTS hmis_clinical_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    department_id uuid REFERENCES hmis_departments(id),
    template_type varchar(20) NOT NULL,
    template_json jsonb NOT NULL,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_lab_critical_alerts
CREATE TABLE IF NOT EXISTS hmis_lab_critical_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id uuid NOT NULL REFERENCES hmis_lab_orders(id),
    result_id uuid NOT NULL REFERENCES hmis_lab_results(id),
    parameter_name varchar(100) NOT NULL,
    result_value varchar(100) NOT NULL,
    critical_type varchar(10) NOT NULL CHECK (critical_type IN ('low','high')),
    -- Communication tracking
    notified_doctor_id uuid REFERENCES hmis_staff(id),
    notified_at timestamptz,
    notified_by uuid REFERENCES hmis_staff(id),
    acknowledged_at timestamptz,
    action_taken text,
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','notified','acknowledged','resolved')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_doctor_schedules
CREATE TABLE IF NOT EXISTS hmis_doctor_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL REFERENCES hmis_staff(id),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    department_id uuid NOT NULL REFERENCES hmis_departments(id),
    day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    slot_duration_min int NOT NULL DEFAULT 15,
    max_patients int,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_crm_activities
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

-- hmis_rooms
CREATE TABLE IF NOT EXISTS hmis_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id uuid NOT NULL REFERENCES hmis_wards(id),
    room_number varchar(10) NOT NULL,
    room_type varchar(20) NOT NULL,
    daily_rate decimal(10,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(ward_id, room_number)
);

-- hmis_notification_log
CREATE TABLE IF NOT EXISTS hmis_notification_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES hmis_notification_templates(id),
    patient_id uuid REFERENCES hmis_patients(id),
    staff_id uuid REFERENCES hmis_staff(id),
    channel varchar(15) NOT NULL,
    recipient varchar(100) NOT NULL,
    message text NOT NULL,
    status varchar(15) NOT NULL DEFAULT 'pending',
    sent_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- hmis_auto_charge_runs
CREATE TABLE IF NOT EXISTS hmis_auto_charge_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    run_date date NOT NULL,
    charges_posted int NOT NULL DEFAULT 0,
    total_amount decimal(12,2) NOT NULL DEFAULT 0,
    run_by uuid REFERENCES hmis_staff(id),
    run_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, run_date)
);

-- PART A DONE. Now run REBUILD_B.sql
