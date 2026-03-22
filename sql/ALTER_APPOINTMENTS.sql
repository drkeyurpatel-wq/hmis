-- Health1 HMIS — Appointments module column additions
-- Run in Supabase SQL Editor

-- Add missing columns to hmis_appointments
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS token_number int;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS priority varchar(10) DEFAULT 'normal' CHECK (priority IN ('normal','urgent','vip'));
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS visit_reason text;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS booking_source varchar(20) DEFAULT 'counter';
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS booked_by uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS consultation_start timestamptz;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS consultation_end timestamptz;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS rescheduled_from uuid REFERENCES hmis_appointments(id);
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS slot_end_time time;
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS appointment_type varchar(20);
ALTER TABLE hmis_appointments ADD COLUMN IF NOT EXISTS estimated_wait_min int;

-- Drop the type CHECK and replace with wider range
ALTER TABLE hmis_appointments DROP CONSTRAINT IF EXISTS hmis_appointments_type_check;
ALTER TABLE hmis_appointments ADD CONSTRAINT hmis_appointments_type_check 
  CHECK (type IN ('new','followup','referral','emergency','review','procedure','teleconsult'));

-- Drop the status CHECK and replace with wider range  
ALTER TABLE hmis_appointments DROP CONSTRAINT IF EXISTS hmis_appointments_status_check;
ALTER TABLE hmis_appointments ADD CONSTRAINT hmis_appointments_status_check 
  CHECK (status IN ('scheduled','booked','confirmed','checked_in','in_progress','in_consultation','completed','no_show','cancelled','rescheduled'));

-- Add missing columns to hmis_doctor_schedules
ALTER TABLE hmis_doctor_schedules ADD COLUMN IF NOT EXISTS consultation_fee decimal(10,2) DEFAULT 0;
ALTER TABLE hmis_doctor_schedules ADD COLUMN IF NOT EXISTS room_number varchar(20);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_appt_token ON hmis_appointments(centre_id, doctor_id, appointment_date, token_number);
CREATE INDEX IF NOT EXISTS idx_appt_status ON hmis_appointments(status);
