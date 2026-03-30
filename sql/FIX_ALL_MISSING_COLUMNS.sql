-- ═══════════════════════════════════════════════════════════════
-- PRE-MIGRATION FIX: Add missing columns to existing tables
-- Run BEFORE RUN_ALL_MIGRATIONS.sql and PHASE2_COMPLETE.sql
-- Safe to re-run (all ADD COLUMN IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════

-- hmis_centres
ALTER TABLE IF EXISTS hmis_centres
  ADD COLUMN IF NOT EXISTS code varchar(10) UNIQUE,
  ADD COLUMN IF NOT EXISTS name varchar(100),
  ADD COLUMN IF NOT EXISTS city varchar(50),
  ADD COLUMN IF NOT EXISTS state varchar(30) DEFAULT 'Gujarat',
  ADD COLUMN IF NOT EXISTS beds_paper int,
  ADD COLUMN IF NOT EXISTS beds_operational int,
  ADD COLUMN IF NOT EXISTS entity_type varchar(20),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS config_json jsonb DEFAULT '{}';

-- hmis_departments
ALTER TABLE IF EXISTS hmis_departments
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS name varchar(100),
  ADD COLUMN IF NOT EXISTS type varchar(20),
  ADD COLUMN IF NOT EXISTS hod_staff_id uuid,,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- hmis_wards
ALTER TABLE IF EXISTS hmis_wards
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS name varchar(50),
  ADD COLUMN IF NOT EXISTS type varchar(20),
  ADD COLUMN IF NOT EXISTS floor varchar(10),
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- hmis_rooms
ALTER TABLE IF EXISTS hmis_rooms
  ADD COLUMN IF NOT EXISTS ward_id uuid,
  ADD COLUMN IF NOT EXISTS room_number varchar(10),
  ADD COLUMN IF NOT EXISTS room_type varchar(20),
  ADD COLUMN IF NOT EXISTS daily_rate decimal(10,2);

-- hmis_beds
ALTER TABLE IF EXISTS hmis_beds
  ADD COLUMN IF NOT EXISTS room_id uuid,
  ADD COLUMN IF NOT EXISTS bed_number varchar(10),
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS current_admission_id uuid,,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- hmis_patients
ALTER TABLE IF EXISTS hmis_patients
  ADD COLUMN IF NOT EXISTS uhid varchar(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS registration_centre_id uuid,
  ADD COLUMN IF NOT EXISTS first_name varchar(50),
  ADD COLUMN IF NOT EXISTS middle_name varchar(50),
  ADD COLUMN IF NOT EXISTS last_name varchar(50),
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS age_years int,
  ADD COLUMN IF NOT EXISTS gender varchar(10),
  ADD COLUMN IF NOT EXISTS blood_group varchar(5),
  ADD COLUMN IF NOT EXISTS phone_primary varchar(15),
  ADD COLUMN IF NOT EXISTS phone_secondary varchar(15),
  ADD COLUMN IF NOT EXISTS email varchar(100),
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city varchar(50),
  ADD COLUMN IF NOT EXISTS state varchar(30),
  ADD COLUMN IF NOT EXISTS pincode varchar(10),
  ADD COLUMN IF NOT EXISTS id_type varchar(20),
  ADD COLUMN IF NOT EXISTS id_number varchar(30),,
  ADD COLUMN IF NOT EXISTS marital_status varchar(15),
  ADD COLUMN IF NOT EXISTS occupation varchar(50),
  ADD COLUMN IF NOT EXISTS nationality varchar(30) DEFAULT 'Indian',
  ADD COLUMN IF NOT EXISTS religion varchar(30),
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- hmis_staff
ALTER TABLE IF EXISTS hmis_staff
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE,,
  ADD COLUMN IF NOT EXISTS employee_code varchar(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS full_name varchar(100),
  ADD COLUMN IF NOT EXISTS designation varchar(50),
  ADD COLUMN IF NOT EXISTS staff_type varchar(20),
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS primary_centre_id uuid,
  ADD COLUMN IF NOT EXISTS phone varchar(15),
  ADD COLUMN IF NOT EXISTS email varchar(100),
  ADD COLUMN IF NOT EXISTS medical_reg_no varchar(30),
  ADD COLUMN IF NOT EXISTS specialisation varchar(100),
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- hmis_admissions
ALTER TABLE IF EXISTS hmis_admissions
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS ipd_number varchar(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS admitting_doctor_id uuid,
  ADD COLUMN IF NOT EXISTS primary_doctor_id uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS bed_id uuid,
  ADD COLUMN IF NOT EXISTS admission_type varchar(20),
  ADD COLUMN IF NOT EXISTS admission_date timestamptz,
  ADD COLUMN IF NOT EXISTS expected_discharge date,
  ADD COLUMN IF NOT EXISTS actual_discharge timestamptz,
  ADD COLUMN IF NOT EXISTS discharge_type varchar(20),
  ADD COLUMN IF NOT EXISTS payor_type varchar(20),
  ADD COLUMN IF NOT EXISTS patient_insurance_id uuid,
  ADD COLUMN IF NOT EXISTS provisional_diagnosis text,
  ADD COLUMN IF NOT EXISTS final_diagnosis text,
  ADD COLUMN IF NOT EXISTS icd_codes jsonb,
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active';

-- hmis_appointments
ALTER TABLE IF EXISTS hmis_appointments
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS doctor_id uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS slot_id uuid,
  ADD COLUMN IF NOT EXISTS appointment_date date,
  ADD COLUMN IF NOT EXISTS appointment_time time,
  ADD COLUMN IF NOT EXISTS type varchar(20),
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS source varchar(20),
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_doctor_schedules
ALTER TABLE IF EXISTS hmis_doctor_schedules
  ADD COLUMN IF NOT EXISTS doctor_id uuid,
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS day_of_week int,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS slot_duration_min int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS max_patients int,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- hmis_doctor_leaves
ALTER TABLE IF EXISTS hmis_doctor_leaves
  ADD COLUMN IF NOT EXISTS doctor_id uuid,
  ADD COLUMN IF NOT EXISTS leave_date date,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- hmis_bills
ALTER TABLE IF EXISTS hmis_bills
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS bill_number varchar(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS bill_type varchar(10),
  ADD COLUMN IF NOT EXISTS encounter_type varchar(10),
  ADD COLUMN IF NOT EXISTS encounter_id uuid,
  ADD COLUMN IF NOT EXISTS payor_type varchar(20),
  ADD COLUMN IF NOT EXISTS patient_insurance_id uuid,
  ADD COLUMN IF NOT EXISTS package_id uuid,
  ADD COLUMN IF NOT EXISTS gross_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS bill_date date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- hmis_bill_items
ALTER TABLE IF EXISTS hmis_bill_items
  ADD COLUMN IF NOT EXISTS bill_id uuid,
  ADD COLUMN IF NOT EXISTS tariff_id uuid,
  ADD COLUMN IF NOT EXISTS description varchar(200),
  ADD COLUMN IF NOT EXISTS quantity decimal(8,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_rate decimal(10,2),
  ADD COLUMN IF NOT EXISTS amount decimal(12,2),
  ADD COLUMN IF NOT EXISTS discount decimal(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax decimal(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount decimal(12,2),
  ADD COLUMN IF NOT EXISTS service_date date,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS doctor_id uuid;

-- hmis_ot_bookings
ALTER TABLE IF EXISTS hmis_ot_bookings
  ADD COLUMN IF NOT EXISTS admission_id uuid,
  ADD COLUMN IF NOT EXISTS ot_room_id uuid,
  ADD COLUMN IF NOT EXISTS surgeon_id uuid,
  ADD COLUMN IF NOT EXISTS anaesthetist_id uuid,
  ADD COLUMN IF NOT EXISTS procedure_name varchar(200),
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_start time,
  ADD COLUMN IF NOT EXISTS estimated_duration_min int,
  ADD COLUMN IF NOT EXISTS actual_start timestamptz,
  ADD COLUMN IF NOT EXISTS actual_end timestamptz,
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_robotic boolean NOT NULL DEFAULT false;

-- hmis_referrals
ALTER TABLE IF EXISTS hmis_referrals
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS referral_type varchar(20),,
  ADD COLUMN IF NOT EXISTS referring_doctor_name varchar(200),
  ADD COLUMN IF NOT EXISTS referring_doctor_phone varchar(20),
  ADD COLUMN IF NOT EXISTS referring_doctor_reg varchar(50),,
  ADD COLUMN IF NOT EXISTS referring_hospital varchar(200),
  ADD COLUMN IF NOT EXISTS referring_city varchar(100),
  ADD COLUMN IF NOT EXISTS referred_to_doctor_id uuid,
  ADD COLUMN IF NOT EXISTS referred_to_department varchar(100),
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS diagnosis varchar(200),
  ADD COLUMN IF NOT EXISTS urgency varchar(10) DEFAULT 'routine',,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'received',,
  ADD COLUMN IF NOT EXISTS appointment_id uuid,
  ADD COLUMN IF NOT EXISTS admission_id uuid,
  ADD COLUMN IF NOT EXISTS expected_revenue decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_revenue decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_fee_pct decimal(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_fee_amount decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_paid_date date,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_packages
ALTER TABLE IF EXISTS hmis_packages
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS name varchar(200),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS room_category varchar(20) DEFAULT 'economy',
  ADD COLUMN IF NOT EXISTS expected_los int DEFAULT 3,
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS gross_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percentage decimal(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- hmis_dialysis_machines
ALTER TABLE IF EXISTS hmis_dialysis_machines
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS machine_number varchar(50),
  ADD COLUMN IF NOT EXISTS brand varchar(100),
  ADD COLUMN IF NOT EXISTS model varchar(100),
  ADD COLUMN IF NOT EXISTS serial_number varchar(100),
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'available',,
  ADD COLUMN IF NOT EXISTS last_maintenance_date date,
  ADD COLUMN IF NOT EXISTS next_maintenance_date date,
  ADD COLUMN IF NOT EXISTS total_sessions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- hmis_dialysis_sessions
ALTER TABLE IF EXISTS hmis_dialysis_sessions
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS machine_id uuid,
  ADD COLUMN IF NOT EXISTS session_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS session_number integer,,
  ADD COLUMN IF NOT EXISTS dialysis_type varchar(20) DEFAULT 'hd',,
  ADD COLUMN IF NOT EXISTS access_type varchar(20),,
  ADD COLUMN IF NOT EXISTS pre_weight decimal(5,1),
  ADD COLUMN IF NOT EXISTS pre_bp varchar(20),
  ADD COLUMN IF NOT EXISTS pre_pulse integer,
  ADD COLUMN IF NOT EXISTS pre_temp decimal(4,1),
  ADD COLUMN IF NOT EXISTS target_uf decimal(6,1),,
  ADD COLUMN IF NOT EXISTS dialyzer_type varchar(100),
  ADD COLUMN IF NOT EXISTS blood_flow_rate integer,,
  ADD COLUMN IF NOT EXISTS dialysate_flow_rate integer,
  ADD COLUMN IF NOT EXISTS heparin_dose varchar(50),
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 240,
  ADD COLUMN IF NOT EXISTS actual_start timestamp with time zone,
  ADD COLUMN IF NOT EXISTS actual_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS post_weight decimal(5,1),
  ADD COLUMN IF NOT EXISTS post_bp varchar(20),
  ADD COLUMN IF NOT EXISTS post_pulse integer,
  ADD COLUMN IF NOT EXISTS actual_uf decimal(6,1),
  ADD COLUMN IF NOT EXISTS complications text[],,
  ADD COLUMN IF NOT EXISTS intradialytic_events text,
  ADD COLUMN IF NOT EXISTS technician_id uuid,
  ADD COLUMN IF NOT EXISTS doctor_id uuid,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'scheduled',,
  ADD COLUMN IF NOT EXISTS billing_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_cathlab_procedures
ALTER TABLE IF EXISTS hmis_cathlab_procedures
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS admission_id uuid,
  ADD COLUMN IF NOT EXISTS procedure_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS procedure_type varchar(30),,
  ADD COLUMN IF NOT EXISTS procedure_name varchar(200),
  ADD COLUMN IF NOT EXISTS indication text,
  ADD COLUMN IF NOT EXISTS access_site varchar(20),,
  ADD COLUMN IF NOT EXISTS cag_findings text,,
  ADD COLUMN IF NOT EXISTS vessels_involved text[],
  ADD COLUMN IF NOT EXISTS stents_placed jsonb DEFAULT '[]',,
  ADD COLUMN IF NOT EXISTS balloon_used jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS implant_details jsonb DEFAULT '{}',,
  ADD COLUMN IF NOT EXISTS fluoroscopy_time_min decimal(5,1),
  ADD COLUMN IF NOT EXISTS radiation_dose_mgy decimal(8,1),
  ADD COLUMN IF NOT EXISTS contrast_volume_ml integer,
  ADD COLUMN IF NOT EXISTS contrast_type varchar(50),
  ADD COLUMN IF NOT EXISTS primary_operator uuid,
  ADD COLUMN IF NOT EXISTS secondary_operator uuid,
  ADD COLUMN IF NOT EXISTS anesthetist_id uuid,
  ADD COLUMN IF NOT EXISTS procedure_status varchar(20) DEFAULT 'scheduled',,
  ADD COLUMN IF NOT EXISTS outcome varchar(20),,
  ADD COLUMN IF NOT EXISTS complications text[],
  ADD COLUMN IF NOT EXISTS start_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS end_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS billing_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_endoscopy_procedures
ALTER TABLE IF EXISTS hmis_endoscopy_procedures
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS procedure_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS procedure_type varchar(30),,
  ADD COLUMN IF NOT EXISTS indication text,
  ADD COLUMN IF NOT EXISTS sedation_type varchar(20),,
  ADD COLUMN IF NOT EXISTS scope_id varchar(50),,
  ADD COLUMN IF NOT EXISTS findings text,
  ADD COLUMN IF NOT EXISTS biopsy_taken boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS biopsy_details text,
  ADD COLUMN IF NOT EXISTS therapeutic_intervention text,,
  ADD COLUMN IF NOT EXISTS complications text[],
  ADD COLUMN IF NOT EXISTS endoscopist_id uuid,
  ADD COLUMN IF NOT EXISTS nurse_id uuid,
  ADD COLUMN IF NOT EXISTS start_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS end_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]',,
  ADD COLUMN IF NOT EXISTS report text,
  ADD COLUMN IF NOT EXISTS billing_done boolean DEFAULT false;

-- hmis_scope_decontamination
ALTER TABLE IF EXISTS hmis_scope_decontamination
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS scope_id varchar(50),
  ADD COLUMN IF NOT EXISTS scope_type varchar(30),,
  ADD COLUMN IF NOT EXISTS procedure_id uuid,
  ADD COLUMN IF NOT EXISTS decontamination_method varchar(30),,
  ADD COLUMN IF NOT EXISTS start_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS end_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS leak_test varchar(10),,
  ADD COLUMN IF NOT EXISTS culture_result varchar(20),,
  ADD COLUMN IF NOT EXISTS performed_by uuid,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'completed';

-- hmis_cssd_instrument_sets
ALTER TABLE IF EXISTS hmis_cssd_instrument_sets
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS set_name varchar(200),
  ADD COLUMN IF NOT EXISTS set_code varchar(50),
  ADD COLUMN IF NOT EXISTS department varchar(100),
  ADD COLUMN IF NOT EXISTS instruments jsonb NOT NULL DEFAULT '[]',,
  ADD COLUMN IF NOT EXISTS total_instruments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'available',,
  ADD COLUMN IF NOT EXISTS last_sterilized_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sterilization_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_cycles integer DEFAULT 500;

-- hmis_cssd_cycles
ALTER TABLE IF EXISTS hmis_cssd_cycles
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS autoclave_number varchar(50),
  ADD COLUMN IF NOT EXISTS cycle_number varchar(50),
  ADD COLUMN IF NOT EXISTS cycle_type varchar(20),,
  ADD COLUMN IF NOT EXISTS load_items jsonb NOT NULL DEFAULT '[]',,
  ADD COLUMN IF NOT EXISTS temperature decimal(5,1),
  ADD COLUMN IF NOT EXISTS pressure decimal(5,2),
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS bi_test_result varchar(10),,
  ADD COLUMN IF NOT EXISTS ci_result varchar(10),,
  ADD COLUMN IF NOT EXISTS operator_id uuid,
  ADD COLUMN IF NOT EXISTS start_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS end_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'in_progress',,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_cssd_issue_return
ALTER TABLE IF EXISTS hmis_cssd_issue_return
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS set_id uuid,
  ADD COLUMN IF NOT EXISTS issued_to varchar(100),,
  ADD COLUMN IF NOT EXISTS ot_booking_id uuid,
  ADD COLUMN IF NOT EXISTS issued_by uuid,
  ADD COLUMN IF NOT EXISTS issued_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS returned_by uuid,
  ADD COLUMN IF NOT EXISTS condition_on_return varchar(20),,
  ADD COLUMN IF NOT EXISTS missing_items jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_diet_orders
ALTER TABLE IF EXISTS hmis_diet_orders
  ADD COLUMN IF NOT EXISTS admission_id uuid,
  ADD COLUMN IF NOT EXISTS ordered_by uuid,
  ADD COLUMN IF NOT EXISTS diet_type varchar(30),
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS effective_from timestamptz,
  ADD COLUMN IF NOT EXISTS effective_to timestamptz;

-- hmis_meal_service
ALTER TABLE IF EXISTS hmis_meal_service
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS diet_order_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS meal_type varchar(20),,
  ADD COLUMN IF NOT EXISTS service_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS menu_items text[],
  ADD COLUMN IF NOT EXISTS served_by uuid,
  ADD COLUMN IF NOT EXISTS served_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS consumed varchar(20),,
  ADD COLUMN IF NOT EXISTS wastage_pct integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_physio_plans
ALTER TABLE IF EXISTS hmis_physio_plans
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS therapist_id uuid,
  ADD COLUMN IF NOT EXISTS diagnosis varchar(200),
  ADD COLUMN IF NOT EXISTS goals text[],
  ADD COLUMN IF NOT EXISTS treatment_plan text,
  ADD COLUMN IF NOT EXISTS total_sessions_planned integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS sessions_completed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency varchar(30),,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active',,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS expected_end_date date,
  ADD COLUMN IF NOT EXISTS outcome_at_discharge text;

-- hmis_physio_sessions
ALTER TABLE IF EXISTS hmis_physio_sessions
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS admission_id uuid,
  ADD COLUMN IF NOT EXISTS therapist_id uuid,
  ADD COLUMN IF NOT EXISTS session_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS session_number integer,
  ADD COLUMN IF NOT EXISTS diagnosis varchar(200),
  ADD COLUMN IF NOT EXISTS treatment_area varchar(100),,
  ADD COLUMN IF NOT EXISTS modalities text[],,
  ADD COLUMN IF NOT EXISTS exercises text[],
  ADD COLUMN IF NOT EXISTS manual_therapy text,
  ADD COLUMN IF NOT EXISTS pain_score_before integer,,
  ADD COLUMN IF NOT EXISTS pain_score_after integer,
  ADD COLUMN IF NOT EXISTS rom_before jsonb DEFAULT '{}',,
  ADD COLUMN IF NOT EXISTS rom_after jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS functional_score integer,,
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'scheduled',,
  ADD COLUMN IF NOT EXISTS billing_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS next_session_date date;

-- hmis_referring_doctors
ALTER TABLE IF EXISTS hmis_referring_doctors
  ADD COLUMN IF NOT EXISTS name varchar(200),
  ADD COLUMN IF NOT EXISTS phone varchar(20),
  ADD COLUMN IF NOT EXISTS email varchar(100),
  ADD COLUMN IF NOT EXISTS registration_number varchar(50),
  ADD COLUMN IF NOT EXISTS speciality varchar(100),
  ADD COLUMN IF NOT EXISTS hospital_name varchar(200),
  ADD COLUMN IF NOT EXISTS city varchar(100),
  ADD COLUMN IF NOT EXISTS state varchar(50) DEFAULT 'Gujarat',
  ADD COLUMN IF NOT EXISTS pan varchar(15),
  ADD COLUMN IF NOT EXISTS bank_account varchar(30),
  ADD COLUMN IF NOT EXISTS bank_ifsc varchar(15),
  ADD COLUMN IF NOT EXISTS bank_name varchar(100),
  ADD COLUMN IF NOT EXISTS default_fee_type varchar(20) DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS default_fee_pct decimal(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_flat_amount decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds_applicable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS tds_pct decimal(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_referrals int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue decimal(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_fees_paid decimal(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_referral_fee_slabs
ALTER TABLE IF EXISTS hmis_referral_fee_slabs
  ADD COLUMN IF NOT EXISTS referring_doctor_id uuid,
  ADD COLUMN IF NOT EXISTS min_revenue decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_revenue decimal(12,2),
  ADD COLUMN IF NOT EXISTS fee_pct decimal(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flat_amount decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS department varchar(100),
  ADD COLUMN IF NOT EXISTS procedure_type varchar(100),
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_medpay_doctor_map
ALTER TABLE IF EXISTS hmis_medpay_doctor_map
  ADD COLUMN IF NOT EXISTS hmis_staff_id uuid,
  ADD COLUMN IF NOT EXISTS medpay_doctor_id int,
  ADD COLUMN IF NOT EXISTS medpay_doctor_name varchar(200),
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;

-- hmis_medpay_sync_log
ALTER TABLE IF EXISTS hmis_medpay_sync_log
  ADD COLUMN IF NOT EXISTS sync_type varchar(20) DEFAULT 'bill_push',
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS month varchar(7),
  ADD COLUMN IF NOT EXISTS bills_synced int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rows_pushed int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medpay_upload_id int,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS synced_by uuid;

-- hmis_billing_category_map
ALTER TABLE IF EXISTS hmis_billing_category_map
  ADD COLUMN IF NOT EXISTS ward_type varchar(30) UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_category varchar(50),
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_cathlab_inventory
ALTER TABLE IF EXISTS hmis_cathlab_inventory
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS item_type varchar(30),
  ADD COLUMN IF NOT EXISTS brand varchar(100),
  ADD COLUMN IF NOT EXISTS model varchar(100),
  ADD COLUMN IF NOT EXISTS size varchar(50),,
  ADD COLUMN IF NOT EXISTS serial_number varchar(100),
  ADD COLUMN IF NOT EXISTS lot_number varchar(100),
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS cost_price decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrp decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor varchar(200),
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS used_in_procedure_id uuid,
  ADD COLUMN IF NOT EXISTS used_for_patient_id uuid,
  ADD COLUMN IF NOT EXISTS used_date date;

-- hmis_cathlab_monitoring
ALTER TABLE IF EXISTS hmis_cathlab_monitoring
  ADD COLUMN IF NOT EXISTS procedure_id uuid,
  ADD COLUMN IF NOT EXISTS pulse_present boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_site_ok boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS hematoma varchar(10) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS bleeding boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bp_systolic int,
  ADD COLUMN IF NOT EXISTS bp_diastolic int,
  ADD COLUMN IF NOT EXISTS heart_rate int,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_dialysis_monitoring
ALTER TABLE IF EXISTS hmis_dialysis_monitoring
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS minutes_elapsed int,
  ADD COLUMN IF NOT EXISTS bp_systolic int,
  ADD COLUMN IF NOT EXISTS bp_diastolic int,
  ADD COLUMN IF NOT EXISTS pulse int,
  ADD COLUMN IF NOT EXISTS temperature decimal(4,1),
  ADD COLUMN IF NOT EXISTS spo2 decimal(4,1),
  ADD COLUMN IF NOT EXISTS blood_flow_rate int,
  ADD COLUMN IF NOT EXISTS dialysate_flow_rate int,
  ADD COLUMN IF NOT EXISTS venous_pressure int,
  ADD COLUMN IF NOT EXISTS arterial_pressure int,
  ADD COLUMN IF NOT EXISTS tmp decimal(5,1),,
  ADD COLUMN IF NOT EXISTS uf_rate decimal(5,1),,
  ADD COLUMN IF NOT EXISTS uf_removed decimal(6,1),,
  ADD COLUMN IF NOT EXISTS access_site_ok boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS patient_comfort varchar(20) DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS symptoms text,
  ADD COLUMN IF NOT EXISTS interventions text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

-- hmis_dialysis_patients
ALTER TABLE IF EXISTS hmis_dialysis_patients
  ADD COLUMN IF NOT EXISTS patient_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS ckd_stage varchar(10),,
  ADD COLUMN IF NOT EXISTS etiology varchar(100),,
  ADD COLUMN IF NOT EXISTS dialysis_start_date date,
  ADD COLUMN IF NOT EXISTS dry_weight decimal(5,1),
  ADD COLUMN IF NOT EXISTS target_weight decimal(5,1),
  ADD COLUMN IF NOT EXISTS current_access_type varchar(20),
  ADD COLUMN IF NOT EXISTS access_creation_date date,
  ADD COLUMN IF NOT EXISTS access_limb varchar(20),,
  ADD COLUMN IF NOT EXISTS access_details text,
  ADD COLUMN IF NOT EXISTS schedule_pattern varchar(10) DEFAULT 'mwf',,
  ADD COLUMN IF NOT EXISTS preferred_shift varchar(10) DEFAULT 'morning',,
  ADD COLUMN IF NOT EXISTS preferred_machine_id uuid,
  ADD COLUMN IF NOT EXISTS standing_dialyzer varchar(100),
  ADD COLUMN IF NOT EXISTS standing_bfr int DEFAULT 300,
  ADD COLUMN IF NOT EXISTS standing_dfr int DEFAULT 500,
  ADD COLUMN IF NOT EXISTS standing_duration_min int DEFAULT 240,
  ADD COLUMN IF NOT EXISTS standing_anticoag_type varchar(20) DEFAULT 'heparin',
  ADD COLUMN IF NOT EXISTS standing_anticoag_dose varchar(50),
  ADD COLUMN IF NOT EXISTS standing_epo_dose varchar(50),
  ADD COLUMN IF NOT EXISTS standing_iron_dose varchar(50),
  ADD COLUMN IF NOT EXISTS last_kt_v decimal(4,2),
  ADD COLUMN IF NOT EXISTS last_kt_v_date date,
  ADD COLUMN IF NOT EXISTS last_hb decimal(4,1),
  ADD COLUMN IF NOT EXISTS last_ferritin int,
  ADD COLUMN IF NOT EXISTS last_tsat decimal(4,1),
  ADD COLUMN IF NOT EXISTS last_ipth int,
  ADD COLUMN IF NOT EXISTS last_calcium decimal(4,2),
  ADD COLUMN IF NOT EXISTS last_phosphorus decimal(4,2),
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_sessions int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_dialysis_water_quality
ALTER TABLE IF EXISTS hmis_dialysis_water_quality
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS test_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS test_type varchar(20),,
  ADD COLUMN IF NOT EXISTS sample_point varchar(50),,
  ADD COLUMN IF NOT EXISTS chlorine decimal(5,3),
  ADD COLUMN IF NOT EXISTS chloramine decimal(5,3),
  ADD COLUMN IF NOT EXISTS tds int,
  ADD COLUMN IF NOT EXISTS ph decimal(4,2),
  ADD COLUMN IF NOT EXISTS conductivity decimal(6,1),
  ADD COLUMN IF NOT EXISTS hardness decimal(5,1),
  ADD COLUMN IF NOT EXISTS bacterial_count int,,
  ADD COLUMN IF NOT EXISTS endotoxin decimal(6,2),,
  ADD COLUMN IF NOT EXISTS pass boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS action_taken text,
  ADD COLUMN IF NOT EXISTS tested_by uuid;

-- hmis_endoscopy_scopes
ALTER TABLE IF EXISTS hmis_endoscopy_scopes
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS scope_code varchar(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS scope_type varchar(30),
  ADD COLUMN IF NOT EXISTS brand varchar(100),
  ADD COLUMN IF NOT EXISTS model varchar(100),
  ADD COLUMN IF NOT EXISTS serial_number varchar(100),
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS last_service_date date,
  ADD COLUMN IF NOT EXISTS next_service_date date,
  ADD COLUMN IF NOT EXISTS total_procedures int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_cssd_autoclaves
ALTER TABLE IF EXISTS hmis_cssd_autoclaves
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS autoclave_number varchar(20),
  ADD COLUMN IF NOT EXISTS brand varchar(100),
  ADD COLUMN IF NOT EXISTS model varchar(100),
  ADD COLUMN IF NOT EXISTS serial_number varchar(100),
  ADD COLUMN IF NOT EXISTS chamber_size varchar(20),,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS last_maintenance_date date,
  ADD COLUMN IF NOT EXISTS next_maintenance_date date,
  ADD COLUMN IF NOT EXISTS last_validation_date date,
  ADD COLUMN IF NOT EXISTS total_cycles int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- hmis_cssd_recall_log
ALTER TABLE IF EXISTS hmis_cssd_recall_log
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS cycle_id uuid,
  ADD COLUMN IF NOT EXISTS set_id uuid,
  ADD COLUMN IF NOT EXISTS issue_id uuid,
  ADD COLUMN IF NOT EXISTS recall_reason text,
  ADD COLUMN IF NOT EXISTS set_location varchar(100),,
  ADD COLUMN IF NOT EXISTS patient_affected_id uuid,
  ADD COLUMN IF NOT EXISTS was_used boolean DEFAULT false,,
  ADD COLUMN IF NOT EXISTS action_taken text,
  ADD COLUMN IF NOT EXISTS recalled_by uuid,
  ADD COLUMN IF NOT EXISTS recalled_at timestamptz DEFAULT now();

-- hmis_cssd_quality_checks
ALTER TABLE IF EXISTS hmis_cssd_quality_checks
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS autoclave_id uuid,
  ADD COLUMN IF NOT EXISTS result varchar(10),,
  ADD COLUMN IF NOT EXISTS reading_value varchar(50),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS performed_by uuid;

-- hmis_menu_master
ALTER TABLE IF EXISTS hmis_menu_master
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS item_name varchar(100),
  ADD COLUMN IF NOT EXISTS item_name_gujarati varchar(100),
  ADD COLUMN IF NOT EXISTS category varchar(20),
  ADD COLUMN IF NOT EXISTS food_type varchar(10) NOT NULL DEFAULT 'veg',
  ADD COLUMN IF NOT EXISTS texture varchar(15) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS calories_kcal int,
  ADD COLUMN IF NOT EXISTS protein_g decimal(5,1),
  ADD COLUMN IF NOT EXISTS carbs_g decimal(5,1),
  ADD COLUMN IF NOT EXISTS fat_g decimal(5,1),
  ADD COLUMN IF NOT EXISTS fiber_g decimal(5,1),
  ADD COLUMN IF NOT EXISTS sodium_mg int,
  ADD COLUMN IF NOT EXISTS potassium_mg int,
  ADD COLUMN IF NOT EXISTS phosphorus_mg int,
  ADD COLUMN IF NOT EXISTS sugar_g decimal(5,1),
  ADD COLUMN IF NOT EXISTS is_gluten_free boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lactose_free boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_nut_free boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_low_sodium boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_low_potassium boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_high_protein boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suitable_for text[] DEFAULT '{}',,
  ADD COLUMN IF NOT EXISTS allergens text[] DEFAULT '{}',,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- hmis_daily_menu
ALTER TABLE IF EXISTS hmis_daily_menu
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS menu_date date,
  ADD COLUMN IF NOT EXISTS meal_type varchar(20),
  ADD COLUMN IF NOT EXISTS diet_type varchar(30) NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS food_type varchar(10) NOT NULL DEFAULT 'veg',
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS prepared_by uuid,
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- hmis_kitchen_production
ALTER TABLE IF EXISTS hmis_kitchen_production
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS production_date date,
  ADD COLUMN IF NOT EXISTS meal_type varchar(20),
  ADD COLUMN IF NOT EXISTS veg_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nonveg_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jain_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regular_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diabetic_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renal_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cardiac_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquid_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS soft_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS npo_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_diet_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS normal_texture int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pureed_texture int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquid_texture int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_meals int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_meals int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ward_counts jsonb DEFAULT '{}',,
  ADD COLUMN IF NOT EXISTS prepared boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prepared_by uuid,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_physio_fms
ALTER TABLE IF EXISTS hmis_physio_fms
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS screener_id uuid,
  ADD COLUMN IF NOT EXISTS screen_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS deep_squat int,
  ADD COLUMN IF NOT EXISTS hurdle_step_l int,
  ADD COLUMN IF NOT EXISTS hurdle_step_r int,
  ADD COLUMN IF NOT EXISTS inline_lunge_l int,
  ADD COLUMN IF NOT EXISTS inline_lunge_r int,
  ADD COLUMN IF NOT EXISTS shoulder_mobility_l int,
  ADD COLUMN IF NOT EXISTS shoulder_mobility_r int,
  ADD COLUMN IF NOT EXISTS active_slr_l int,
  ADD COLUMN IF NOT EXISTS active_slr_r int,
  ADD COLUMN IF NOT EXISTS trunk_stability_pushup int,
  ADD COLUMN IF NOT EXISTS rotary_stability_l int,
  ADD COLUMN IF NOT EXISTS rotary_stability_r int,
  ADD COLUMN IF NOT EXISTS shoulder_clearing_l boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shoulder_clearing_r boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extension_clearing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flexion_clearing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_score int,
  ADD COLUMN IF NOT EXISTS asymmetries text[],
  ADD COLUMN IF NOT EXISTS risk_level varchar(10),,
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_physio_outcomes
ALTER TABLE IF EXISTS hmis_physio_outcomes
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS measure_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS measure_type varchar(30),,
  ADD COLUMN IF NOT EXISTS score decimal(6,1),
  ADD COLUMN IF NOT EXISTS max_score decimal(6,1),
  ADD COLUMN IF NOT EXISTS subscales jsonb DEFAULT '{}',,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

-- hmis_physio_prevention_programs
ALTER TABLE IF EXISTS hmis_physio_prevention_programs
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS program_name varchar(200),
  ADD COLUMN IF NOT EXISTS program_type varchar(30),,
  ADD COLUMN IF NOT EXISTS target_population varchar(100),,
  ADD COLUMN IF NOT EXISTS sport varchar(50),
  ADD COLUMN IF NOT EXISTS duration_weeks int DEFAULT 8,
  ADD COLUMN IF NOT EXISTS sessions_per_week int DEFAULT 3,
  ADD COLUMN IF NOT EXISTS exercises jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS screening_protocol jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_reference text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- hmis_package_utilization
ALTER TABLE IF EXISTS hmis_package_utilization
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS admission_id uuid,
  ADD COLUMN IF NOT EXISTS package_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS bill_id uuid,
  ADD COLUMN IF NOT EXISTS package_rate decimal(12,2),
  ADD COLUMN IF NOT EXISTS rate_type varchar(20) DEFAULT 'self',,
  ADD COLUMN IF NOT EXISTS insurer_name varchar(100),
  ADD COLUMN IF NOT EXISTS actual_room_charges decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_surgeon_fee decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_anaesthesia_fee decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_pharmacy decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_lab decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_consumables decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_nursing decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_ot_charges decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_other decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_total decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance decimal(12,2) DEFAULT 0,,
  ADD COLUMN IF NOT EXISTS variance_pct decimal(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS over_package_items jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS over_package_amount decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_los int,
  ADD COLUMN IF NOT EXISTS actual_los int,
  ADD COLUMN IF NOT EXISTS overstay_days int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overstay_charges decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes text;

-- hmis_revenue_rules
ALTER TABLE IF EXISTS hmis_revenue_rules
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS rule_name varchar(200),
  ADD COLUMN IF NOT EXISTS rule_type varchar(30),,
  ADD COLUMN IF NOT EXISTS severity varchar(10) DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS condition_sql text,,
  ADD COLUMN IF NOT EXISTS threshold_amount decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS threshold_days int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_flag boolean DEFAULT true,;

-- hmis_revenue_leakage_log
ALTER TABLE IF EXISTS hmis_revenue_leakage_log
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS scan_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS rule_id uuid,
  ADD COLUMN IF NOT EXISTS leak_type varchar(30),
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS admission_id uuid,
  ADD COLUMN IF NOT EXISTS bill_id uuid,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS estimated_amount decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS severity varchar(10) DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_notes text;

-- hmis_voice_notes
ALTER TABLE IF EXISTS hmis_voice_notes
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS encounter_id uuid,,
  ADD COLUMN IF NOT EXISTS encounter_type varchar(10) DEFAULT 'opd',,
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS duration_seconds int,
  ADD COLUMN IF NOT EXISTS raw_transcript text,
  ADD COLUMN IF NOT EXISTS structured_note jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'recorded',
  ADD COLUMN IF NOT EXISTS saved_to_encounter boolean DEFAULT false;

-- hmis_shift_handovers
ALTER TABLE IF EXISTS hmis_shift_handovers
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS handover_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS shift varchar(20),,
  ADD COLUMN IF NOT EXISTS ward_id uuid,
  ADD COLUMN IF NOT EXISTS outgoing_staff_id uuid,
  ADD COLUMN IF NOT EXISTS incoming_staff_id uuid,
  ADD COLUMN IF NOT EXISTS census jsonb DEFAULT '{}',,
  ADD COLUMN IF NOT EXISTS critical_patients jsonb DEFAULT '[]',,
  ADD COLUMN IF NOT EXISTS pending_labs jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pending_meds jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pending_procedures jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pending_discharges jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pending_consults jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS alerts text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS general_notes text,
  ADD COLUMN IF NOT EXISTS acknowledged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS auto_generated jsonb DEFAULT '{}';

-- hmis_module_config
ALTER TABLE IF EXISTS hmis_module_config
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS module_key VARCHAR(50),
  ADD COLUMN IF NOT EXISTS module_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS module_group VARCHAR(30),
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- hmis_bed_turnover
ALTER TABLE IF EXISTS hmis_bed_turnover
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS bed_id UUID,
  ADD COLUMN IF NOT EXISTS room_id UUID,
  ADD COLUMN IF NOT EXISTS ward_id UUID,
  ADD COLUMN IF NOT EXISTS discharged_admission_id UUID,
  ADD COLUMN IF NOT EXISTS discharge_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS discharge_confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS hk_task_id UUID,
  ADD COLUMN IF NOT EXISTS hk_assigned_to UUID,
  ADD COLUMN IF NOT EXISTS hk_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hk_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hk_checklist JSONB DEFAULT '[,
  ADD COLUMN IF NOT EXISTS inspected_by UUID,
  ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_passed BOOLEAN,
  ADD COLUMN IF NOT EXISTS inspection_remarks TEXT,
  ADD COLUMN IF NOT EXISTS bed_available_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_admission_id UUID,
  ADD COLUMN IF NOT EXISTS next_patient_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_target_minutes INT DEFAULT 45,
  ADD COLUMN IF NOT EXISTS total_turnaround_minutes INT,
  ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'on_track',
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'housekeeping_pending',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- hmis_bed_waitlist
ALTER TABLE IF EXISTS hmis_bed_waitlist
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS admission_id UUID,
  ADD COLUMN IF NOT EXISTS ward_id UUID,
  ADD COLUMN IF NOT EXISTS bed_type VARCHAR(50) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS requested_by UUID,
  ADD COLUMN IF NOT EXISTS assigned_bed_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- hmis_clinical_alerts
ALTER TABLE IF EXISTS hmis_clinical_alerts
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS admission_id UUID,
  ADD COLUMN IF NOT EXISTS alert_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS title VARCHAR(300),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source VARCHAR(50),,
  ADD COLUMN IF NOT EXISTS source_ref_id UUID,
  ADD COLUMN IF NOT EXISTS source_ref_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_resolve_at TIMESTAMPTZ,;

-- hmis_consent_templates
ALTER TABLE IF EXISTS hmis_consent_templates
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(300),
  ADD COLUMN IF NOT EXISTS procedure_type VARCHAR(200),
  ADD COLUMN IF NOT EXISTS consent_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS content_en TEXT,
  ADD COLUMN IF NOT EXISTS content_hi TEXT,
  ADD COLUMN IF NOT EXISTS content_gu TEXT,
  ADD COLUMN IF NOT EXISTS risks_en TEXT, risks_hi TEXT, risks_gu TEXT,
  ADD COLUMN IF NOT EXISTS benefits_en TEXT, benefits_hi TEXT, benefits_gu TEXT,
  ADD COLUMN IF NOT EXISTS requires_witness BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_interpreter BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mandatory_checklist JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- hmis_consent_audit
ALTER TABLE IF EXISTS hmis_consent_audit
  ADD COLUMN IF NOT EXISTS consent_id UUID ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS action VARCHAR(50),
  ADD COLUMN IF NOT EXISTS performed_by UUID,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS device_info TEXT;

-- hmis_cost_centres
ALTER TABLE IF EXISTS hmis_cost_centres
  ADD COLUMN IF NOT EXISTS centre_id   UUID,
  ADD COLUMN IF NOT EXISTS code        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS name        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS type        VARCHAR(20) NOT NULL DEFAULT 'revenue',
  ADD COLUMN IF NOT EXISTS parent_id   UUID,
  ADD COLUMN IF NOT EXISTS gl_revenue_account_id UUID,
  ADD COLUMN IF NOT EXISTS gl_expense_account_id UUID,
  ADD COLUMN IF NOT EXISTS budget_monthly DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true;

-- hmis_cost_centre_maps
ALTER TABLE IF EXISTS hmis_cost_centre_maps
  ADD COLUMN IF NOT EXISTS centre_id       UUID,
  ADD COLUMN IF NOT EXISTS cost_centre_id  UUID ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS match_type      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS match_value     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS priority        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT true;

-- hmis_cost_centre_expenses
ALTER TABLE IF EXISTS hmis_cost_centre_expenses
  ADD COLUMN IF NOT EXISTS centre_id       UUID,
  ADD COLUMN IF NOT EXISTS cost_centre_id  UUID,
  ADD COLUMN IF NOT EXISTS expense_date    DATE,
  ADD COLUMN IF NOT EXISTS category        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS amount          DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS vendor          VARCHAR(200),
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(50);

-- hmis_shift_definitions
ALTER TABLE IF EXISTS hmis_shift_definitions
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS shift_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shift_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS is_night_shift BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- hmis_staffing_requirements
ALTER TABLE IF EXISTS hmis_staffing_requirements
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS ward_id UUID,
  ADD COLUMN IF NOT EXISTS shift_id UUID,
  ADD COLUMN IF NOT EXISTS staff_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS min_count INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- hmis_duty_roster
ALTER TABLE IF EXISTS hmis_duty_roster
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS staff_id UUID,
  ADD COLUMN IF NOT EXISTS ward_id UUID,
  ADD COLUMN IF NOT EXISTS shift_id UUID,
  ADD COLUMN IF NOT EXISTS roster_date DATE,
  ADD COLUMN IF NOT EXISTS shift_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overtime_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- hmis_duty_swap_requests
ALTER TABLE IF EXISTS hmis_duty_swap_requests
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS requester_id UUID,
  ADD COLUMN IF NOT EXISTS target_id UUID,
  ADD COLUMN IF NOT EXISTS roster_id_requester UUID,
  ADD COLUMN IF NOT EXISTS roster_id_target UUID,
  ADD COLUMN IF NOT EXISTS swap_date DATE,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- hmis_equipment_calibration
ALTER TABLE IF EXISTS hmis_equipment_calibration
  ADD COLUMN IF NOT EXISTS equipment_id UUID ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS calibration_date DATE,
  ADD COLUMN IF NOT EXISTS next_due_date DATE,
  ADD COLUMN IF NOT EXISTS performed_by VARCHAR(200),
  ADD COLUMN IF NOT EXISTS vendor VARCHAR(200),
  ADD COLUMN IF NOT EXISTS certificate_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS result VARCHAR(20) DEFAULT 'pass',
  ADD COLUMN IF NOT EXISTS deviation_notes TEXT,
  ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2) DEFAULT 0;

-- hmis_equipment
ALTER TABLE IF EXISTS hmis_equipment
  ADD COLUMN IF NOT EXISTS centre_id       uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name            text,
  ADD COLUMN IF NOT EXISTS category        text,
  ADD COLUMN IF NOT EXISTS brand           text,
  ADD COLUMN IF NOT EXISTS model           text,
  ADD COLUMN IF NOT EXISTS serial_number   text,
  ADD COLUMN IF NOT EXISTS location        text,
  ADD COLUMN IF NOT EXISTS department      text,
  ADD COLUMN IF NOT EXISTS purchase_date   date,
  ADD COLUMN IF NOT EXISTS purchase_cost   numeric(12,2),
  ADD COLUMN IF NOT EXISTS warranty_expiry date,
  ADD COLUMN IF NOT EXISTS amc_vendor      text,
  ADD COLUMN IF NOT EXISTS amc_expiry      date,
  ADD COLUMN IF NOT EXISTS amc_cost        numeric(10,2),
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_pm_date    date,
  ADD COLUMN IF NOT EXISTS next_pm_date    date,
  ADD COLUMN IF NOT EXISTS criticality     text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS is_active       boolean DEFAULT true;

-- hmis_equipment_maintenance
ALTER TABLE IF EXISTS hmis_equipment_maintenance
  ADD COLUMN IF NOT EXISTS equipment_id      uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS centre_id         uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type              text,
  ADD COLUMN IF NOT EXISTS reported_by       uuid,
  ADD COLUMN IF NOT EXISTS reported_at       timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS issue_description text,
  ADD COLUMN IF NOT EXISTS priority          text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to       text,
  ADD COLUMN IF NOT EXISTS started_at        timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS resolution        text,
  ADD COLUMN IF NOT EXISTS parts_used        jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cost              numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downtime_hours    numeric(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'open';

-- hmis_equipment_pm_schedule
ALTER TABLE IF EXISTS hmis_equipment_pm_schedule
  ADD COLUMN IF NOT EXISTS equipment_id  uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS centre_id     uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS frequency     text,
  ADD COLUMN IF NOT EXISTS last_done     date,
  ADD COLUMN IF NOT EXISTS next_due      date,
  ADD COLUMN IF NOT EXISTS assigned_to   text,
  ADD COLUMN IF NOT EXISTS is_active     boolean DEFAULT true;

-- hmis_housekeeping_tasks
ALTER TABLE IF EXISTS hmis_housekeeping_tasks
  ADD COLUMN IF NOT EXISTS centre_id       uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_type       text,
  ADD COLUMN IF NOT EXISTS area_type       text,
  ADD COLUMN IF NOT EXISTS area_name       text,
  ADD COLUMN IF NOT EXISTS room_id         uuid,
  ADD COLUMN IF NOT EXISTS bed_id          uuid,
  ADD COLUMN IF NOT EXISTS priority        text NOT NULL DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS assigned_to     uuid,
  ADD COLUMN IF NOT EXISTS requested_by    uuid,
  ADD COLUMN IF NOT EXISTS requested_at    timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at      timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by     uuid,
  ADD COLUMN IF NOT EXISTS verified_at     timestamptz,
  ADD COLUMN IF NOT EXISTS chemicals_used  text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS infection_type  varchar(100),
  ADD COLUMN IF NOT EXISTS notes           text;

-- hmis_housekeeping_schedules
ALTER TABLE IF EXISTS hmis_housekeeping_schedules
  ADD COLUMN IF NOT EXISTS centre_id     uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS area_name     text,
  ADD COLUMN IF NOT EXISTS area_type     text,
  ADD COLUMN IF NOT EXISTS frequency     text,
  ADD COLUMN IF NOT EXISTS shift         text,
  ADD COLUMN IF NOT EXISTS assigned_team text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active     boolean DEFAULT true;

-- hmis_linen_inventory
ALTER TABLE IF EXISTS hmis_linen_inventory
  ADD COLUMN IF NOT EXISTS centre_id       uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS item_type       text,
  ADD COLUMN IF NOT EXISTS total_qty       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_circulation  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_laundry      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ward            varchar(100),
  ADD COLUMN IF NOT EXISTS par_level       integer DEFAULT 0;

-- hmis_linen_exchange
ALTER TABLE IF EXISTS hmis_linen_exchange
  ADD COLUMN IF NOT EXISTS centre_id       uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ward            varchar(100),
  ADD COLUMN IF NOT EXISTS item_type       text,
  ADD COLUMN IF NOT EXISTS exchange_date   date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS exchange_type   text NOT NULL DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS soiled_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clean_received  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchanged_by    uuid,
  ADD COLUMN IF NOT EXISTS notes           text;

-- hmis_mortuary
ALTER TABLE IF EXISTS hmis_mortuary
  ADD COLUMN IF NOT EXISTS centre_id               uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS patient_id              uuid,
  ADD COLUMN IF NOT EXISTS admission_id            uuid,
  ADD COLUMN IF NOT EXISTS death_certificate_number varchar(50),
  ADD COLUMN IF NOT EXISTS cause_of_death          text,
  ADD COLUMN IF NOT EXISTS time_of_death           timestamptz,
  ADD COLUMN IF NOT EXISTS declared_by             uuid,
  ADD COLUMN IF NOT EXISTS body_received_at        timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS storage_unit            varchar(50),
  ADD COLUMN IF NOT EXISTS embalming_done          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_mortem_required    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_mortem_done        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS police_intimation       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS released_to             varchar(200),
  ADD COLUMN IF NOT EXISTS released_at             timestamptz,
  ADD COLUMN IF NOT EXISTS release_authorized_by   uuid,
  ADD COLUMN IF NOT EXISTS id_proof_collected      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS noc_from_police         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status                  text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS notes                   text;

-- hmis_patient_consents
ALTER TABLE IF EXISTS hmis_patient_consents
  ADD COLUMN IF NOT EXISTS patient_id        uuid,
  ADD COLUMN IF NOT EXISTS admission_id      uuid,
  ADD COLUMN IF NOT EXISTS template_id       uuid,
  ADD COLUMN IF NOT EXISTS consent_type      text,
  ADD COLUMN IF NOT EXISTS procedure_name    text,
  ADD COLUMN IF NOT EXISTS consent_html      text,,
  ADD COLUMN IF NOT EXISTS risks_explained   text,
  ADD COLUMN IF NOT EXISTS signature_data    text,,
  ADD COLUMN IF NOT EXISTS witnessed_by      uuid,
  ADD COLUMN IF NOT EXISTS witness_name      text,
  ADD COLUMN IF NOT EXISTS witness_relation  text,
  ADD COLUMN IF NOT EXISTS witness_signature text,,
  ADD COLUMN IF NOT EXISTS doctor_signature  text,,
  ADD COLUMN IF NOT EXISTS obtained_by       uuid,
  ADD COLUMN IF NOT EXISTS signed_at         timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS consent_language  text DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS is_valid          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS revoked_at        timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by        uuid,
  ADD COLUMN IF NOT EXISTS revoke_reason     text,
  ADD COLUMN IF NOT EXISTS ip_address        varchar(45),
  ADD COLUMN IF NOT EXISTS centre_id         uuid;

-- hmis_prescription_refill_requests
ALTER TABLE IF EXISTS hmis_prescription_refill_requests
  ADD COLUMN IF NOT EXISTS patient_id        uuid,
  ADD COLUMN IF NOT EXISTS encounter_id      uuid,
  ADD COLUMN IF NOT EXISTS prescription_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS requested_at      timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS responded_at      timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by      uuid;

-- hmis_patient_feedback
ALTER TABLE IF EXISTS hmis_patient_feedback
  ADD COLUMN IF NOT EXISTS patient_id  uuid,
  ADD COLUMN IF NOT EXISTS visit_id    uuid,
  ADD COLUMN IF NOT EXISTS rating      integer,
  ADD COLUMN IF NOT EXISTS comment     text,
  ADD COLUMN IF NOT EXISTS department  text,
  ADD COLUMN IF NOT EXISTS doctor_name text;

-- hmis_insurance_documents
ALTER TABLE IF EXISTS hmis_insurance_documents
  ADD COLUMN IF NOT EXISTS pre_auth_id   uuid,
  ADD COLUMN IF NOT EXISTS claim_id      uuid,
  ADD COLUMN IF NOT EXISTS patient_id    uuid,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS file_name     text,
  ADD COLUMN IF NOT EXISTS file_url      text,
  ADD COLUMN IF NOT EXISTS file_size     integer,
  ADD COLUMN IF NOT EXISTS uploaded_by   uuid,
  ADD COLUMN IF NOT EXISTS uploaded_at   timestamptz DEFAULT now();

-- hmis_surgical_planning
ALTER TABLE IF EXISTS hmis_surgical_planning
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS ot_booking_id UUID,
  ADD COLUMN IF NOT EXISTS admission_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS surgeon_id UUID,
  ADD COLUMN IF NOT EXISTS planned_date DATE,
  ADD COLUMN IF NOT EXISTS procedure_name VARCHAR(500),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS overall_status VARCHAR(20) DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS readiness_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS cleared_by UUID,
  ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;

-- hmis_surgical_checklist_items
ALTER TABLE IF EXISTS hmis_surgical_checklist_items
  ADD COLUMN IF NOT EXISTS planning_id UUID ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS item_name VARCHAR(300),
  ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS actual_date DATE,
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS lab_order_id UUID,,
  ADD COLUMN IF NOT EXISTS pre_auth_id UUID,,
  ADD COLUMN IF NOT EXISTS consent_id UUID,,
  ADD COLUMN IF NOT EXISTS cssd_issue_id UUID,,
  ADD COLUMN IF NOT EXISTS bed_id UUID,,
  ADD COLUMN IF NOT EXISTS completed_by UUID,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- hmis_px_tokens
ALTER TABLE IF EXISTS hmis_px_tokens
  ADD COLUMN IF NOT EXISTS token VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS admission_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS bed_id UUID,
  ADD COLUMN IF NOT EXISTS ward_id UUID,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- hmis_px_food_menu
ALTER TABLE IF EXISTS hmis_px_food_menu
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS name_gujarati VARCHAR(200),
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}',,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_from TIME,,
  ADD COLUMN IF NOT EXISTS available_until TIME,,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- hmis_px_food_orders
ALTER TABLE IF EXISTS hmis_px_food_orders
  ADD COLUMN IF NOT EXISTS token_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS admission_id UUID,
  ADD COLUMN IF NOT EXISTS bed_label VARCHAR(50),,
  ADD COLUMN IF NOT EXISTS ward_name VARCHAR(100),,
  ADD COLUMN IF NOT EXISTS patient_name VARCHAR(200),,
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS item_count INT GENERATED ALWAYS AS (jsonb_array_length(items)) STORED,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nurse_id UUID,
  ADD COLUMN IF NOT EXISTS nurse_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nurse_notes TEXT,
  ADD COLUMN IF NOT EXISTS kitchen_notes TEXT,
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT,,
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- hmis_px_complaints
ALTER TABLE IF EXISTS hmis_px_complaints
  ADD COLUMN IF NOT EXISTS token_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS admission_id UUID,
  ADD COLUMN IF NOT EXISTS bed_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ward_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS patient_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'normal',,
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_hours INT NOT NULL DEFAULT 24,;

-- hmis_px_nurse_calls
ALTER TABLE IF EXISTS hmis_px_nurse_calls
  ADD COLUMN IF NOT EXISTS token_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS admission_id UUID,
  ADD COLUMN IF NOT EXISTS bed_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ward_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS patient_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS reason VARCHAR(200),
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_seconds INT,,
  ADD COLUMN IF NOT EXISTS resolution_seconds INT,;

-- hmis_px_feedback
ALTER TABLE IF EXISTS hmis_px_feedback
  ADD COLUMN IF NOT EXISTS token_id UUID,,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS admission_id UUID,
  ADD COLUMN IF NOT EXISTS patient_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS overall_rating INT,
  ADD COLUMN IF NOT EXISTS category_ratings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS would_recommend BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,,
  ADD COLUMN IF NOT EXISTS google_review_status VARCHAR(20) DEFAULT 'none',,
  ADD COLUMN IF NOT EXISTS google_review_url TEXT,
  ADD COLUMN IF NOT EXISTS staff_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_by UUID,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- hmis_px_activity_log
ALTER TABLE IF EXISTS hmis_px_activity_log
  ADD COLUMN IF NOT EXISTS token_id UUID,
  ADD COLUMN IF NOT EXISTS centre_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS reference_id UUID,,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS performed_by VARCHAR(50),;

-- hmis_abdm_config
ALTER TABLE IF EXISTS hmis_abdm_config
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS client_id varchar(100),
  ADD COLUMN IF NOT EXISTS client_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS environment varchar(20) NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS hip_id varchar(50),
  ADD COLUMN IF NOT EXISTS hip_name varchar(200),
  ADD COLUMN IF NOT EXISTS callback_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{"abha_creation":true,"abha_verification":true,"scan_share":true,"hie_cm":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_token_at timestamptz;

-- hmis_abdm_link_requests
ALTER TABLE IF EXISTS hmis_abdm_link_requests
  ADD COLUMN IF NOT EXISTS transaction_id varchar(100),
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS care_context_ids text[],
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'initiated',
  ADD COLUMN IF NOT EXISTS otp_expiry timestamptz,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;

-- hmis_abdm_consent_requests
ALTER TABLE IF EXISTS hmis_abdm_consent_requests
  ADD COLUMN IF NOT EXISTS consent_request_id varchar(100),
  ADD COLUMN IF NOT EXISTS gateway_request_id varchar(100),
  ADD COLUMN IF NOT EXISTS patient_abha_address varchar(100),
  ADD COLUMN IF NOT EXISTS hip_id varchar(50),
  ADD COLUMN IF NOT EXISTS hip_name varchar(200),
  ADD COLUMN IF NOT EXISTS purpose varchar(20) NOT NULL DEFAULT 'CAREMGT',
  ADD COLUMN IF NOT EXISTS hi_types text[],
  ADD COLUMN IF NOT EXISTS date_range_from date,
  ADD COLUMN IF NOT EXISTS date_range_to date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN IF NOT EXISTS consent_artefact_ids text[],
  ADD COLUMN IF NOT EXISTS requested_by uuid;

-- hmis_abdm_data_transfers
ALTER TABLE IF EXISTS hmis_abdm_data_transfers
  ADD COLUMN IF NOT EXISTS consent_artefact_id varchar(100),
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS direction varchar(10),
  ADD COLUMN IF NOT EXISTS hi_type varchar(50),
  ADD COLUMN IF NOT EXISTS care_context_reference varchar(100),
  ADD COLUMN IF NOT EXISTS fhir_bundle jsonb,
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text;

-- hmis_abdm_audit_log
ALTER TABLE IF EXISTS hmis_abdm_audit_log
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS action varchar(50),
  ADD COLUMN IF NOT EXISTS details jsonb,
  ADD COLUMN IF NOT EXISTS performed_by uuid;

-- hmis_abdm_scan_sessions
ALTER TABLE IF EXISTS hmis_abdm_scan_sessions
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS counter_id varchar(50),
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS abha_number varchar(20),
  ADD COLUMN IF NOT EXISTS abha_address varchar(50),
  ADD COLUMN IF NOT EXISTS scan_type varchar(20) NOT NULL DEFAULT 'qr',
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scanned_by uuid;

-- hmis_pmjay_packages
ALTER TABLE IF EXISTS hmis_pmjay_packages
  ADD COLUMN IF NOT EXISTS centre_id uuid,
  ADD COLUMN IF NOT EXISTS procedure_code varchar(20),
  ADD COLUMN IF NOT EXISTS package_code varchar(20),
  ADD COLUMN IF NOT EXISTS specialty varchar(200),
  ADD COLUMN IF NOT EXISTS package_name varchar(500),
  ADD COLUMN IF NOT EXISTS procedure_name text,
  ADD COLUMN IF NOT EXISTS base_rate decimal(12,2),,
  ADD COLUMN IF NOT EXISTS nabh_incentive decimal(12,2),,
  ADD COLUMN IF NOT EXISTS effective_rate decimal(12,2),,
  ADD COLUMN IF NOT EXISTS implant_name text,
  ADD COLUMN IF NOT EXISTS implant_cost decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_with_implant decimal(12,2),,
  ADD COLUMN IF NOT EXISTS level_of_care varchar(20),
  ADD COLUMN IF NOT EXISTS alos int,,
  ADD COLUMN IF NOT EXISTS is_day_care boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_auth_docs text,
  ADD COLUMN IF NOT EXISTS claim_docs text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- hmis_cdss_overrides
ALTER TABLE IF EXISTS hmis_cdss_overrides
  ADD COLUMN IF NOT EXISTS centre_id       uuid,
  ADD COLUMN IF NOT EXISTS patient_id      uuid,
  ADD COLUMN IF NOT EXISTS encounter_id    uuid,,
  ADD COLUMN IF NOT EXISTS staff_id        uuid,
  ADD COLUMN IF NOT EXISTS alert_type      text,
  ADD COLUMN IF NOT EXISTS severity        text,
  ADD COLUMN IF NOT EXISTS alert_message   text,
  ADD COLUMN IF NOT EXISTS drug_name       text,
  ADD COLUMN IF NOT EXISTS interacting_drug text,,
  ADD COLUMN IF NOT EXISTS override_reason text,;

-- hmis_notification_preferences
ALTER TABLE IF EXISTS hmis_notification_preferences
  ADD COLUMN IF NOT EXISTS centre_id     uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type    text,
  ADD COLUMN IF NOT EXISTS channel       text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS is_enabled    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS template_text text,;

-- hmis_notification_log
ALTER TABLE IF EXISTS hmis_notification_log
  ADD COLUMN IF NOT EXISTS centre_id     uuid,
  ADD COLUMN IF NOT EXISTS event_type    text,
  ADD COLUMN IF NOT EXISTS channel       text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS message_id    text,,
  ADD COLUMN IF NOT EXISTS error_message text;

-- hmis_integration_config
ALTER TABLE IF EXISTS hmis_integration_config
  ADD COLUMN IF NOT EXISTS provider    text,,
  ADD COLUMN IF NOT EXISTS config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS centre_id   uuid,;

-- hmis_report_subscriptions
ALTER TABLE IF EXISTS hmis_report_subscriptions
  ADD COLUMN IF NOT EXISTS centre_id   uuid ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email       text,
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'daily_summary',
  ADD COLUMN IF NOT EXISTS frequency   text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS is_active   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;
