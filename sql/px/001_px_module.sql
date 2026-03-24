-- ============================================================
-- Health1 HMIS — Patient Experience (PX) Module
-- Migration: 001_px_module.sql
-- Run on: Supabase project bmuupgrzbfmddjwcqlss
-- ============================================================

-- 1. ENUMS
-- ============================================================

CREATE TYPE px_food_order_status AS ENUM (
  'pending',
  'nurse_approved',
  'nurse_rejected',
  'preparing',
  'ready',
  'delivered',
  'cancelled'
);

CREATE TYPE px_complaint_status AS ENUM (
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed'
);

CREATE TYPE px_complaint_category AS ENUM (
  'cleanliness',
  'food_quality',
  'staff_behaviour',
  'noise',
  'equipment',
  'billing',
  'delay',
  'other'
);

CREATE TYPE px_nurse_call_priority AS ENUM (
  'routine',
  'urgent',
  'emergency'
);

CREATE TYPE px_nurse_call_status AS ENUM (
  'pending',
  'acknowledged',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE px_activity_type AS ENUM (
  'food_order',
  'food_status_change',
  'complaint',
  'complaint_status_change',
  'nurse_call',
  'nurse_call_status_change',
  'feedback',
  'token_created',
  'token_expired'
);

-- 2. TABLES
-- ============================================================

-- 2a. PX Tokens — links QR wristband to admission
CREATE TABLE hmis_px_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(20) NOT NULL UNIQUE,
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  bed_id UUID REFERENCES hmis_beds(id),
  ward_id UUID REFERENCES hmis_wards(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expired_at TIMESTAMPTZ,
  created_by UUID REFERENCES hmis_staff(id)
);

CREATE INDEX idx_px_tokens_token ON hmis_px_tokens(token) WHERE is_active = true;
CREATE INDEX idx_px_tokens_admission ON hmis_px_tokens(admission_id);
CREATE INDEX idx_px_tokens_centre ON hmis_px_tokens(centre_id) WHERE is_active = true;

-- 2b. Food Menu
CREATE TABLE hmis_px_food_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  name VARCHAR(200) NOT NULL,
  name_gujarati VARCHAR(200),
  category VARCHAR(50) NOT NULL, -- breakfast, lunch, dinner, snacks, beverages
  description TEXT,
  price NUMERIC(8,2) NOT NULL DEFAULT 0,
  dietary_tags TEXT[] DEFAULT '{}', -- veg, non-veg, jain, diabetic-friendly, low-sodium, liquid-diet
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  available_from TIME, -- e.g. 07:00 for breakfast
  available_until TIME, -- e.g. 10:00
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_food_menu_centre ON hmis_px_food_menu(centre_id) WHERE is_available = true;

-- 2c. Food Orders
CREATE TABLE hmis_px_food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES hmis_px_tokens(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  bed_label VARCHAR(50), -- denormalized for kitchen display: "ICU-101"
  ward_name VARCHAR(100), -- denormalized: "ICU"
  patient_name VARCHAR(200), -- denormalized for kitchen display
  items JSONB NOT NULL DEFAULT '[]',
  -- items schema: [{ menu_item_id, name, qty, price, dietary_tags, special_instructions }]
  item_count INT GENERATED ALWAYS AS (jsonb_array_length(items)) STORED,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status px_food_order_status NOT NULL DEFAULT 'pending',
  nurse_id UUID REFERENCES hmis_staff(id),
  nurse_action_at TIMESTAMPTZ,
  nurse_notes TEXT,
  kitchen_notes TEXT,
  dietary_restrictions TEXT, -- from patient's admission record
  prepared_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_food_orders_token ON hmis_px_food_orders(token_id);
CREATE INDEX idx_px_food_orders_status ON hmis_px_food_orders(centre_id, status) WHERE status NOT IN ('delivered', 'cancelled');
CREATE INDEX idx_px_food_orders_kitchen ON hmis_px_food_orders(centre_id, status) WHERE status IN ('nurse_approved', 'preparing', 'ready');

-- 2d. Complaints
CREATE TABLE hmis_px_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES hmis_px_tokens(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  bed_label VARCHAR(50),
  ward_name VARCHAR(100),
  patient_name VARCHAR(200),
  category px_complaint_category NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  priority VARCHAR(10) NOT NULL DEFAULT 'normal', -- normal, high
  status px_complaint_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES hmis_staff(id),
  assigned_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  sla_hours INT NOT NULL DEFAULT 24, -- target resolution time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_complaints_centre ON hmis_px_complaints(centre_id, status) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_px_complaints_token ON hmis_px_complaints(token_id);

-- 2e. Nurse Calls
CREATE TABLE hmis_px_nurse_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES hmis_px_tokens(id),
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID NOT NULL REFERENCES hmis_admissions(id),
  bed_label VARCHAR(50),
  ward_name VARCHAR(100),
  patient_name VARCHAR(200),
  reason VARCHAR(200) NOT NULL,
  details TEXT,
  priority px_nurse_call_priority NOT NULL DEFAULT 'routine',
  status px_nurse_call_status NOT NULL DEFAULT 'pending',
  acknowledged_by UUID REFERENCES hmis_staff(id),
  acknowledged_at TIMESTAMPTZ,
  completed_by UUID REFERENCES hmis_staff(id),
  completed_at TIMESTAMPTZ,
  response_seconds INT, -- time from creation to acknowledged
  resolution_seconds INT, -- time from creation to completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_nurse_calls_active ON hmis_px_nurse_calls(centre_id, priority, status) WHERE status IN ('pending', 'acknowledged', 'in_progress');
CREATE INDEX idx_px_nurse_calls_token ON hmis_px_nurse_calls(token_id);

-- 2f. Feedback
CREATE TABLE hmis_px_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES hmis_px_tokens(id), -- nullable for post-discharge feedback
  patient_id UUID NOT NULL REFERENCES hmis_patients(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  admission_id UUID REFERENCES hmis_admissions(id),
  patient_name VARCHAR(200),
  overall_rating INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  category_ratings JSONB DEFAULT '{}',
  -- schema: { cleanliness: 4, food: 3, nursing: 5, doctors: 5, facilities: 4, billing: 3 }
  comments TEXT,
  would_recommend BOOLEAN,
  is_public BOOLEAN NOT NULL DEFAULT false, -- patient consents to share
  google_review_status VARCHAR(20) DEFAULT 'none', -- none, prompted, submitted, verified
  google_review_url TEXT,
  staff_response TEXT,
  responded_by UUID REFERENCES hmis_staff(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_feedback_centre ON hmis_px_feedback(centre_id);
CREATE INDEX idx_px_feedback_rating ON hmis_px_feedback(centre_id, overall_rating);

-- 2g. Activity Log
CREATE TABLE hmis_px_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES hmis_px_tokens(id),
  centre_id UUID NOT NULL REFERENCES hmis_centres(id),
  patient_id UUID REFERENCES hmis_patients(id),
  activity_type px_activity_type NOT NULL,
  reference_id UUID, -- FK to the relevant table row
  details JSONB DEFAULT '{}',
  performed_by VARCHAR(50), -- 'patient' or staff UUID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_px_activity_log_token ON hmis_px_activity_log(token_id);
CREATE INDEX idx_px_activity_log_centre ON hmis_px_activity_log(centre_id, created_at DESC);

-- 3. RPC FUNCTIONS
-- ============================================================

-- 3a. Validate PX token — returns patient/admission context or null
CREATE OR REPLACE FUNCTION px_validate_token(p_token VARCHAR)
RETURNS TABLE (
  token_id UUID,
  patient_id UUID,
  admission_id UUID,
  centre_id UUID,
  bed_id UUID,
  ward_id UUID,
  patient_name TEXT,
  bed_label TEXT,
  ward_name TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS token_id,
    t.patient_id,
    t.admission_id,
    t.centre_id,
    t.bed_id,
    t.ward_id,
    (p.first_name || ' ' || COALESCE(p.last_name, ''))::TEXT AS patient_name,
    b.bed_number::TEXT AS bed_label,
    w.name::TEXT AS ward_name
  FROM hmis_px_tokens t
  JOIN hmis_patients p ON p.id = t.patient_id
  LEFT JOIN hmis_beds b ON b.id = t.bed_id
  LEFT JOIN hmis_wards w ON w.id = t.ward_id
  WHERE t.token = p_token
    AND t.is_active = true
    AND t.expired_at IS NULL;
END;
$$;

-- 3b. Generate PX token on admission
CREATE OR REPLACE FUNCTION px_generate_token(
  p_admission_id UUID,
  p_patient_id UUID,
  p_centre_id UUID,
  p_bed_id UUID DEFAULT NULL,
  p_ward_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token VARCHAR(12);
  v_exists BOOLEAN;
BEGIN
  -- Deactivate any existing active token for this admission
  UPDATE hmis_px_tokens
  SET is_active = false, expired_at = now()
  WHERE admission_id = p_admission_id AND is_active = true;

  -- Generate unique token (nanoid-style: alphanumeric, 12 chars)
  LOOP
    v_token := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    SELECT EXISTS(SELECT 1 FROM hmis_px_tokens WHERE token = v_token) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  INSERT INTO hmis_px_tokens (token, admission_id, patient_id, centre_id, bed_id, ward_id, created_by)
  VALUES (v_token, p_admission_id, p_patient_id, p_centre_id, p_bed_id, p_ward_id, p_created_by);

  -- Log activity
  INSERT INTO hmis_px_activity_log (token_id, centre_id, patient_id, activity_type, details, performed_by)
  SELECT id, p_centre_id, p_patient_id, 'token_created',
    jsonb_build_object('admission_id', p_admission_id),
    COALESCE(p_created_by::text, 'system')
  FROM hmis_px_tokens WHERE token = v_token;

  RETURN v_token;
END;
$$;

-- 3c. Expire PX token on discharge
CREATE OR REPLACE FUNCTION px_expire_token(p_admission_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE hmis_px_tokens
  SET is_active = false, expired_at = now()
  WHERE admission_id = p_admission_id AND is_active = true;

  -- Log activity
  INSERT INTO hmis_px_activity_log (token_id, centre_id, patient_id, activity_type, details, performed_by)
  SELECT id, centre_id, patient_id, 'token_expired',
    jsonb_build_object('admission_id', p_admission_id),
    'system'
  FROM hmis_px_tokens WHERE admission_id = p_admission_id;
END;
$$;

-- 3d. Nurse call rate limiter — returns true if allowed
CREATE OR REPLACE FUNCTION px_can_create_nurse_call(p_token_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_call TIMESTAMPTZ;
BEGIN
  SELECT MAX(created_at) INTO v_last_call
  FROM hmis_px_nurse_calls
  WHERE token_id = p_token_id
    AND status IN ('pending', 'acknowledged', 'in_progress')
    AND created_at > now() - interval '2 minutes';

  RETURN v_last_call IS NULL;
END;
$$;

-- 4. RLS POLICIES
-- ============================================================
-- Patient-side: uses px_validate_token RPC (SECURITY DEFINER) so no direct table access needed
-- Staff-side: standard centre-based RLS matching existing HMIS patterns

-- Enable RLS on all PX tables
ALTER TABLE hmis_px_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_food_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_food_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_nurse_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_px_activity_log ENABLE ROW LEVEL SECURITY;

-- Food menu: public read for active items (patients need to see this without auth)
CREATE POLICY "px_food_menu_public_read" ON hmis_px_food_menu
  FOR SELECT USING (is_available = true);

CREATE POLICY "px_food_menu_staff_all" ON hmis_px_food_menu
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_food_menu.centre_id
    )
  );

-- Staff policies for operational tables (orders, complaints, nurse calls, feedback, tokens, activity log)
-- Pattern: staff with centre assignment can view/manage records for their centre

CREATE POLICY "px_tokens_staff" ON hmis_px_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_tokens.centre_id
    )
  );

CREATE POLICY "px_food_orders_staff" ON hmis_px_food_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_food_orders.centre_id
    )
  );

CREATE POLICY "px_complaints_staff" ON hmis_px_complaints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_complaints.centre_id
    )
  );

CREATE POLICY "px_nurse_calls_staff" ON hmis_px_nurse_calls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_nurse_calls.centre_id
    )
  );

CREATE POLICY "px_feedback_staff" ON hmis_px_feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_feedback.centre_id
    )
  );

CREATE POLICY "px_activity_log_staff" ON hmis_px_activity_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hmis_staff s
      JOIN hmis_staff_centres sca ON sca.staff_id = s.id
      WHERE s.auth_user_id = auth.uid()
        AND sca.centre_id = hmis_px_activity_log.centre_id
    )
  );

-- 5. SEED DATA — Shilaj Food Menu
-- ============================================================

INSERT INTO hmis_px_food_menu (centre_id, name, name_gujarati, category, description, price, dietary_tags, available_from, available_until, sort_order) VALUES
-- Breakfast (07:00 - 10:00)
('c0000001-0000-0000-0000-000000000001', 'Upma', 'ઉપમા', 'breakfast', 'Semolina with vegetables and mustard tempering', 60, '{veg}', '07:00', '10:00', 1),
('c0000001-0000-0000-0000-000000000001', 'Poha', 'પોહા', 'breakfast', 'Flattened rice with peanuts, turmeric and lemon', 50, '{veg,jain}', '07:00', '10:00', 2),
('c0000001-0000-0000-0000-000000000001', 'Idli Sambar (4 pcs)', 'ઈડલી સાંભાર', 'breakfast', 'Steamed rice cakes with sambar and chutney', 70, '{veg}', '07:00', '10:00', 3),
('c0000001-0000-0000-0000-000000000001', 'Toast Butter with Jam', 'ટોસ્ટ બટર', 'breakfast', '4 slices white/brown toast with butter and jam', 50, '{veg}', '07:00', '10:00', 4),
('c0000001-0000-0000-0000-000000000001', 'Moong Dal Chilla', 'મૂંગ દાળ ચીલા', 'breakfast', 'Protein-rich lentil crepe with green chutney', 60, '{veg,diabetic-friendly}', '07:00', '10:00', 5),
('c0000001-0000-0000-0000-000000000001', 'Oats Porridge', 'ઓટ્સ પોરીજ', 'breakfast', 'Warm oats with milk and dry fruits', 70, '{veg,diabetic-friendly}', '07:00', '10:00', 6),

-- Lunch (12:00 - 14:30)
('c0000001-0000-0000-0000-000000000001', 'Regular Thali (Veg)', 'રેગ્યુલર થાળી', 'lunch', 'Dal, sabzi, roti (4), rice, salad, papad, sweet', 120, '{veg}', '12:00', '14:30', 10),
('c0000001-0000-0000-0000-000000000001', 'Jain Thali', 'જૈન થાળી', 'lunch', 'Jain dal, sabzi (no onion/garlic), roti (4), rice', 130, '{veg,jain}', '12:00', '14:30', 11),
('c0000001-0000-0000-0000-000000000001', 'Diabetic Thali', 'ડાયાબિટીક થાળી', 'lunch', 'Low-GI dal, sabzi, multigrain roti (3), brown rice', 140, '{veg,diabetic-friendly,low-sodium}', '12:00', '14:30', 12),
('c0000001-0000-0000-0000-000000000001', 'Khichdi with Kadhi', 'ખીચડી કઢી', 'lunch', 'Moong dal khichdi with buttermilk kadhi — light on stomach', 90, '{veg,diabetic-friendly}', '12:00', '14:30', 13),
('c0000001-0000-0000-0000-000000000001', 'Liquid Diet Meal', 'લિક્વિડ ડાયેટ', 'lunch', 'Clear soup, dal water, fruit juice, buttermilk', 80, '{veg,liquid-diet}', '12:00', '14:30', 14),

-- Dinner (19:00 - 21:00)
('c0000001-0000-0000-0000-000000000001', 'Regular Thali (Dinner)', 'રેગ્યુલર થાળી (ડિનર)', 'dinner', 'Dal, sabzi, roti (3), rice, salad', 110, '{veg}', '19:00', '21:00', 20),
('c0000001-0000-0000-0000-000000000001', 'Soup & Sandwich', 'સૂપ અને સેન્ડવીચ', 'dinner', 'Tomato/mixed veg soup with grilled sandwich', 90, '{veg}', '19:00', '21:00', 21),
('c0000001-0000-0000-0000-000000000001', 'Dal Khichdi (Light)', 'દાળ ખીચડી', 'dinner', 'Easy to digest moong dal khichdi with ghee', 80, '{veg,diabetic-friendly}', '19:00', '21:00', 22),

-- Snacks (any time)
('c0000001-0000-0000-0000-000000000001', 'Fruit Plate', 'ફ્રૂટ પ્લેટ', 'snacks', 'Seasonal fresh fruits', 60, '{veg,jain,diabetic-friendly}', NULL, NULL, 30),
('c0000001-0000-0000-0000-000000000001', 'Biscuits & Tea', 'બિસ્કિટ અને ચા', 'snacks', 'Parle-G/Marie with masala chai', 30, '{veg}', NULL, NULL, 31),
('c0000001-0000-0000-0000-000000000001', 'Dry Fruit Mix', 'ડ્રાય ફ્રૂટ', 'snacks', 'Almonds, cashews, walnuts — 50g pack', 80, '{veg,jain}', NULL, NULL, 32),
('c0000001-0000-0000-0000-000000000001', 'Makhana (Roasted)', 'મખાના', 'snacks', 'Light roasted fox nuts with mild spicing', 50, '{veg,jain,diabetic-friendly}', NULL, NULL, 33),

-- Beverages (any time)
('c0000001-0000-0000-0000-000000000001', 'Masala Chai', 'મસાલા ચા', 'beverages', 'Indian spiced tea with milk', 20, '{veg}', NULL, NULL, 40),
('c0000001-0000-0000-0000-000000000001', 'Black Coffee', 'બ્લેક કોફી', 'beverages', 'Fresh brewed black coffee', 30, '{veg,jain,diabetic-friendly}', NULL, NULL, 41),
('c0000001-0000-0000-0000-000000000001', 'Buttermilk (Chaas)', 'છાશ', 'beverages', 'Spiced buttermilk — great for digestion', 20, '{veg}', NULL, NULL, 42),
('c0000001-0000-0000-0000-000000000001', 'Fresh Lime Water', 'લીંબુ પાણી', 'beverages', 'Nimbu paani with salt/sugar', 20, '{veg,jain,diabetic-friendly}', NULL, NULL, 43),
('c0000001-0000-0000-0000-000000000001', 'Coconut Water', 'નાળિયેર પાણી', 'beverages', 'Fresh tender coconut water', 50, '{veg,jain,diabetic-friendly}', NULL, NULL, 44),
('c0000001-0000-0000-0000-000000000001', 'Warm Water', 'ગરમ પાણી', 'beverages', 'Warm/hot drinking water', 0, '{veg,jain,diabetic-friendly,liquid-diet}', NULL, NULL, 45);
