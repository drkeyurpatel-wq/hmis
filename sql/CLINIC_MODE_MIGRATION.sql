-- =============================================================================
-- CLINIC MODE MIGRATION
-- Health1 HMIS — Wellness Clinic Support
-- =============================================================================
-- Run on HMIS Supabase: bmuupgrzbfmddjwcqlss
-- IMPORTANT: Test each change individually against a real user session first.
-- DO NOT apply in bulk. Follow the order below.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1a. Extend hmis_centres for clinic support
-- ---------------------------------------------------------------------------

ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS centre_type TEXT DEFAULT 'hospital'
  CHECK (centre_type IN ('hospital', 'clinic'));

ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'owned'
  CHECK (ownership_type IN ('owned', 'franchise'));

-- Which hub hospital does this clinic feed into?
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS hub_centre_id UUID REFERENCES hmis_centres(id);

-- Franchise-specific
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS franchise_partner_name TEXT;
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS franchise_agreement_date DATE;
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS franchise_revenue_share_pct NUMERIC(4,1);
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS franchise_contact_phone TEXT;
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS franchise_contact_email TEXT;

-- Clinic operational config
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS has_pharmacy BOOLEAN DEFAULT true;
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS has_lab_collection BOOLEAN DEFAULT true;
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS has_teleconsult BOOLEAN DEFAULT true;
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS opd_rooms INT DEFAULT 2;
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '9:00 AM - 9:00 PM';

-- Geolocation
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE hmis_centres ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- Backfill existing centres as hospitals
UPDATE hmis_centres SET centre_type = 'hospital' WHERE centre_type IS NULL;

-- ---------------------------------------------------------------------------
-- 1b. Clinic-specific roles
-- ---------------------------------------------------------------------------

INSERT INTO hmis_roles (name, description, permissions, is_system) VALUES
  ('clinic_manager', 'Manages a single wellness clinic — full clinic access',
   '{"clinic_opd": "all", "clinic_pharmacy": "all", "clinic_lab": "all", "clinic_billing": "all", "clinic_reports": "read", "referral": "all"}', true),

  ('clinic_doctor', 'Doctor at a wellness clinic — OPD + prescribe only',
   '{"clinic_opd": "all", "clinic_pharmacy": "read", "referral": "create"}', true),

  ('clinic_pharmacist', 'Pharmacist at a wellness clinic — pharmacy POS only',
   '{"clinic_pharmacy": "all", "clinic_billing": "create"}', true),

  ('clinic_receptionist', 'Front desk at a wellness clinic — registration + billing',
   '{"clinic_opd": "create,read", "clinic_billing": "all", "clinic_lab": "create,read", "referral": "create"}', true),

  ('clinic_nurse', 'Nurse/technician at a wellness clinic — vitals + lab collection',
   '{"clinic_opd": "read,update", "clinic_lab": "all", "clinic_vitals": "all"}', true)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1c. Lab collection tracking table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hmis_lab_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  hub_centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  -- Sample details
  collection_number TEXT NOT NULL UNIQUE,
  barcode TEXT,
  sample_type TEXT NOT NULL,
  tests_ordered JSONB NOT NULL,
  fasting_status TEXT CHECK (fasting_status IN ('fasting', 'non_fasting', 'unknown')),

  -- Collection
  collected_by UUID REFERENCES hmis_staff(id),
  collected_at TIMESTAMPTZ,

  -- Transport
  courier_batch_id TEXT,
  dispatched_at TIMESTAMPTZ,
  dispatched_by UUID REFERENCES hmis_staff(id),
  transport_mode TEXT DEFAULT 'courier' CHECK (transport_mode IN ('courier', 'staff', 'pickup')),

  -- Hub lab receipt
  received_at_hub TIMESTAMPTZ,
  received_by UUID REFERENCES hmis_staff(id),

  -- Status
  status TEXT DEFAULT 'collected' CHECK (status IN (
    'collected', 'batched', 'dispatched', 'in_transit',
    'received_at_hub', 'processing', 'completed', 'rejected'
  )),
  rejection_reason TEXT,

  -- Link to HMIS lab order
  hmis_lab_order_id UUID,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_collections_centre ON hmis_lab_collections(centre_id);
CREATE INDEX IF NOT EXISTS idx_lab_collections_hub ON hmis_lab_collections(hub_centre_id);
CREATE INDEX IF NOT EXISTS idx_lab_collections_status ON hmis_lab_collections(status);
CREATE INDEX IF NOT EXISTS idx_lab_collections_batch ON hmis_lab_collections(courier_batch_id);

ALTER TABLE hmis_lab_collections ENABLE ROW LEVEL SECURITY;

-- RLS: staff can read samples from their centre or hub
DO $$ BEGIN
CREATE POLICY "lab_collections_read" ON hmis_lab_collections
  FOR SELECT TO authenticated USING (
    centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
    OR hub_centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "lab_collections_insert" ON hmis_lab_collections
  FOR INSERT TO authenticated WITH CHECK (
    centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "lab_collections_update" ON hmis_lab_collections
  FOR UPDATE TO authenticated USING (
    centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
    OR hub_centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 1d. Referral tracking between clinic and hub
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hmis_clinic_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  to_centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),

  -- Referral context
  referral_number TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  department TEXT,

  -- Clinic doctor who referred
  referred_by UUID REFERENCES hmis_staff(id),
  clinical_notes TEXT,
  vitals_at_referral JSONB,

  -- Hub hospital response
  appointment_created BOOLEAN DEFAULT false,
  hub_appointment_id UUID,
  accepted_by UUID REFERENCES hmis_staff(id),

  -- Status
  status TEXT DEFAULT 'referred' CHECK (status IN (
    'referred', 'appointment_created', 'patient_visited',
    'completed', 'cancelled', 'no_show'
  )),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_referrals_from ON hmis_clinic_referrals(from_centre_id);
CREATE INDEX IF NOT EXISTS idx_clinic_referrals_to ON hmis_clinic_referrals(to_centre_id);
CREATE INDEX IF NOT EXISTS idx_clinic_referrals_patient ON hmis_clinic_referrals(patient_id);

ALTER TABLE hmis_clinic_referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "clinic_referrals_read" ON hmis_clinic_referrals
  FOR SELECT TO authenticated USING (
    from_centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
    OR to_centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "clinic_referrals_write" ON hmis_clinic_referrals
  FOR INSERT TO authenticated WITH CHECK (
    from_centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "clinic_referrals_update" ON hmis_clinic_referrals
  FOR UPDATE TO authenticated USING (
    from_centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
    OR to_centre_id IN (
      SELECT sc.centre_id FROM hmis_staff_centres sc
      JOIN hmis_staff s ON s.id = sc.staff_id
      WHERE s.auth_user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- END OF CLINIC MODE MIGRATION
-- =============================================================================
