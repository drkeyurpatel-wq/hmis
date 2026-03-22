-- Health1 HMIS — Modules 15-17 Migration
-- Ambulance/Transport, Visitor Management, Asset Management

-- ============================================================
-- 15. AMBULANCE & TRANSPORT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_ambulances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  vehicle_number varchar(20) NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'bls', -- als, bls, patient_transport, neonatal, mortuary
  make varchar(50),
  model varchar(50),
  year integer,
  driver_name varchar(200),
  driver_phone varchar(20),
  driver_license varchar(50),
  emt_name varchar(200),
  emt_phone varchar(20),
  status varchar(20) DEFAULT 'available', -- available, on_trip, maintenance, out_of_service
  current_location varchar(200),
  fuel_level varchar(10), -- full, 3/4, half, 1/4, empty
  last_sanitized timestamp with time zone,
  insurance_expiry date,
  fitness_expiry date,
  equipment_checklist jsonb DEFAULT '{}', -- {oxygen: true, defibrillator: true, stretcher: true}
  odometer_km integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ambulances_centre ON hmis_ambulances(centre_id, status);

CREATE TABLE IF NOT EXISTS hmis_transport_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  request_number varchar(50),
  request_type varchar(30) NOT NULL, -- emergency_pickup, inter_hospital_transfer, discharge, dialysis_shuttle, opd_pickup, dead_body
  priority varchar(10) DEFAULT 'routine', -- emergency, urgent, routine
  -- Patient
  patient_id uuid REFERENCES hmis_patients(id),
  patient_name varchar(200),
  patient_phone varchar(20),
  patient_condition varchar(50), -- stable, critical, ventilated, immobile
  -- Route
  pickup_location text NOT NULL,
  pickup_landmark varchar(200),
  drop_location text NOT NULL,
  drop_landmark varchar(200),
  distance_km decimal(6,1),
  -- Assignment
  ambulance_id uuid REFERENCES hmis_ambulances(id),
  driver_name varchar(200),
  emt_name varchar(200),
  -- Timestamps
  requested_at timestamp with time zone DEFAULT now(),
  requested_by uuid REFERENCES hmis_staff(id),
  dispatched_at timestamp with time zone,
  en_route_at timestamp with time zone,
  arrived_at timestamp with time zone,
  patient_loaded_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  -- Metrics
  response_time_min integer, -- dispatch to arrival
  total_trip_time_min integer,
  -- Billing
  trip_charge decimal(10,2) DEFAULT 0,
  billing_done boolean DEFAULT false,
  -- Meta
  status varchar(20) DEFAULT 'requested', -- requested, dispatched, en_route, arrived, patient_loaded, returning, completed, cancelled
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transport_centre ON hmis_transport_requests(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_date ON hmis_transport_requests(requested_at);

-- ============================================================
-- 16. VISITOR MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_visitor_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  pass_number varchar(50),
  -- Visitor
  visitor_name varchar(200) NOT NULL,
  visitor_phone varchar(20),
  visitor_address text,
  relation varchar(50), -- spouse, parent, child, sibling, friend, relative, other
  id_proof_type varchar(20), -- aadhar, pan, driving_license, passport, voter_id
  id_proof_number varchar(50),
  photo_url text,
  -- Patient
  patient_id uuid REFERENCES hmis_patients(id),
  admission_id uuid REFERENCES hmis_admissions(id),
  ward varchar(100),
  bed varchar(50),
  -- Pass details
  pass_type varchar(20) DEFAULT 'regular', -- regular, icu, nicu, isolation, emergency, attendant
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  max_visitors_at_time integer DEFAULT 2,
  visiting_hours varchar(50), -- e.g. "10:00-12:00, 16:00-18:00"
  -- Tracking
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  items_deposited text[], -- mobile, bag, food
  -- Meta
  issued_by uuid REFERENCES hmis_staff(id),
  revoked_by uuid REFERENCES hmis_staff(id),
  revocation_reason text,
  status varchar(20) DEFAULT 'active', -- active, checked_in, checked_out, expired, revoked
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visitor_centre ON hmis_visitor_passes(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_visitor_patient ON hmis_visitor_passes(patient_id);

-- ============================================================
-- 17. ASSET MANAGEMENT
-- ============================================================
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
CREATE INDEX IF NOT EXISTS idx_assets_centre ON hmis_assets(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_dept ON hmis_assets(department);
CREATE INDEX IF NOT EXISTS idx_assets_category ON hmis_assets(category);

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
CREATE INDEX IF NOT EXISTS idx_asset_audit ON hmis_asset_audit_log(asset_id);
