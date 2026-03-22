-- Health1 HMIS — Dietary & Kitchen schema (Indian hospital)
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Menu master (Indian meals) ═══

CREATE TABLE IF NOT EXISTS hmis_menu_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  item_name varchar(100) NOT NULL,
  item_name_gujarati varchar(100),
  category varchar(20) NOT NULL CHECK (category IN ('main_course','dal','rice','roti','sabzi','salad','soup','dessert','beverage','snack','fruit','curd_raita','chutney','papad')),
  food_type varchar(10) NOT NULL DEFAULT 'veg' CHECK (food_type IN ('veg','nonveg','egg','jain','vegan')),
  texture varchar(15) DEFAULT 'normal' CHECK (texture IN ('normal','soft','pureed','liquid','minced')),
  -- Nutrition per serving
  calories_kcal int,
  protein_g decimal(5,1),
  carbs_g decimal(5,1),
  fat_g decimal(5,1),
  fiber_g decimal(5,1),
  sodium_mg int,
  potassium_mg int,
  phosphorus_mg int,
  sugar_g decimal(5,1),
  -- Flags
  is_gluten_free boolean DEFAULT false,
  is_lactose_free boolean DEFAULT false,
  is_nut_free boolean DEFAULT true,
  is_low_sodium boolean DEFAULT false,
  is_low_potassium boolean DEFAULT false,
  is_high_protein boolean DEFAULT false,
  -- Diet compatibility
  suitable_for text[] DEFAULT '{}', -- regular, diabetic, renal, cardiac, etc.
  allergens text[] DEFAULT '{}', -- milk, nuts, gluten, soy, etc.
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ═══ 2. Daily menu (what's cooking today) ═══

CREATE TABLE IF NOT EXISTS hmis_daily_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  menu_date date NOT NULL,
  meal_type varchar(20) NOT NULL CHECK (meal_type IN ('early_tea','breakfast','mid_morning','lunch','evening_tea','dinner','bedtime')),
  diet_type varchar(30) NOT NULL DEFAULT 'regular',
  food_type varchar(10) NOT NULL DEFAULT 'veg',
  items jsonb NOT NULL DEFAULT '[]',
  -- Format: [{ item_id, item_name, category, portion_size, calories }]
  prepared_by uuid REFERENCES hmis_staff(id),
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(centre_id, menu_date, meal_type, diet_type, food_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_menu ON hmis_daily_menu(centre_id, menu_date, meal_type);

-- ═══ 3. Diet orders — enhanced ═══

ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS centre_id uuid REFERENCES hmis_centres(id);
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES hmis_patients(id);
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active';
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS food_preference varchar(10) DEFAULT 'veg' CHECK (food_preference IN ('veg','nonveg','egg','jain','vegan'));
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS texture varchar(15) DEFAULT 'normal' CHECK (texture IN ('normal','soft','pureed','liquid','minced'));
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS special_instructions text;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}';
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS calorie_target int;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS protein_target int;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS fluid_restriction_ml int; -- NULL = no restriction
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS sodium_restriction_mg int;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS potassium_restriction_mg int;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS meal_plan jsonb DEFAULT '{"early_tea":true,"breakfast":true,"mid_morning":true,"lunch":true,"evening_tea":true,"dinner":true,"bedtime":true}';
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS extra_items text; -- e.g. "extra curd", "no onion no garlic"
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS fasting boolean DEFAULT false;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS npo_from timestamptz;
ALTER TABLE hmis_diet_orders ADD COLUMN IF NOT EXISTS npo_reason text;

-- ═══ 4. Meal service — enhanced ═══

ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS items_served jsonb DEFAULT '[]';
-- Format: [{ item_name, portion, calories }]
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS total_calories int;
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS fluid_intake_ml int;
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS patient_feedback varchar(20); -- excellent, good, average, poor
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS oral_intake_pct int; -- 0-100%, how much was eaten
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS temperature_ok boolean DEFAULT true;
ALTER TABLE hmis_meal_service ADD COLUMN IF NOT EXISTS delivered_to varchar(50); -- bed number

-- ═══ 5. Kitchen production planning ═══

CREATE TABLE IF NOT EXISTS hmis_kitchen_production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  production_date date NOT NULL,
  meal_type varchar(20) NOT NULL,
  -- Counts by food type
  veg_count int DEFAULT 0,
  nonveg_count int DEFAULT 0,
  jain_count int DEFAULT 0,
  -- Counts by diet type
  regular_count int DEFAULT 0,
  diabetic_count int DEFAULT 0,
  renal_count int DEFAULT 0,
  cardiac_count int DEFAULT 0,
  liquid_count int DEFAULT 0,
  soft_count int DEFAULT 0,
  npo_count int DEFAULT 0,
  other_diet_count int DEFAULT 0,
  -- Counts by texture
  normal_texture int DEFAULT 0,
  pureed_texture int DEFAULT 0,
  liquid_texture int DEFAULT 0,
  -- Total
  total_meals int DEFAULT 0,
  staff_meals int DEFAULT 0,
  -- Ward breakdown
  ward_counts jsonb DEFAULT '{}', -- { "ICU": 12, "General Ward": 45, ... }
  -- Status
  prepared boolean DEFAULT false,
  prepared_by uuid REFERENCES hmis_staff(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(centre_id, production_date, meal_type)
);

-- ═══ 6. Seed Indian menu items ═══

INSERT INTO hmis_menu_master (centre_id, item_name, item_name_gujarati, category, food_type, calories_kcal, protein_g, carbs_g, fat_g, suitable_for) VALUES
  -- Dal varieties
  ('c0000001-0000-0000-0000-000000000001', 'Dal Tadka', 'દાળ તડકા', 'dal', 'veg', 150, 8, 20, 4, '{regular,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Moong Dal', 'મૂંગ દાળ', 'dal', 'veg', 120, 9, 18, 2, '{regular,diabetic,cardiac,renal,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Toor Dal', 'તુવેર દાળ', 'dal', 'veg', 140, 8, 22, 3, '{regular,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Masoor Dal', 'મસૂર દાળ', 'dal', 'jain', 130, 9, 20, 2, '{regular,diabetic}'),
  -- Rice
  ('c0000001-0000-0000-0000-000000000001', 'Steamed Rice', 'ભાત', 'rice', 'veg', 200, 4, 44, 0.5, '{regular,cardiac,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Jeera Rice', 'જીરા ભાત', 'rice', 'veg', 220, 4, 42, 3, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Khichdi', 'ખીચડી', 'rice', 'veg', 180, 6, 30, 3, '{regular,diabetic,soft,renal}'),
  ('c0000001-0000-0000-0000-000000000001', 'Dal-Khichdi', 'દાળ ખીચડી', 'rice', 'veg', 200, 8, 32, 3, '{regular,diabetic,soft,high_protein}'),
  -- Roti
  ('c0000001-0000-0000-0000-000000000001', 'Phulka (2pc)', 'ફૂલકા', 'roti', 'veg', 140, 4, 28, 1, '{regular,diabetic,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Chapati (2pc)', 'ચપાતી', 'roti', 'veg', 160, 5, 30, 2, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Bajra Roti (2pc)', 'બાજરી રોટલા', 'roti', 'veg', 180, 5, 34, 2, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'Jowar Roti (2pc)', 'જુવાર રોટલા', 'roti', 'veg', 170, 5, 32, 2, '{regular,diabetic}'),
  -- Sabzi
  ('c0000001-0000-0000-0000-000000000001', 'Aloo-Gobi', 'આલુ ગોબી', 'sabzi', 'veg', 120, 3, 18, 4, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Bhindi Masala', 'ભીંડી', 'sabzi', 'veg', 80, 2, 10, 4, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'Lauki Sabzi', 'દૂધી', 'sabzi', 'veg', 60, 1, 8, 3, '{regular,diabetic,renal,cardiac,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Palak Paneer', 'પાલક પનીર', 'sabzi', 'veg', 200, 12, 8, 14, '{regular,high_protein}'),
  ('c0000001-0000-0000-0000-000000000001', 'Mix Veg', 'મિક્સ વેજ', 'sabzi', 'veg', 100, 3, 12, 4, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'Sev Tameta', 'સેવ ટમેટા', 'sabzi', 'jain', 110, 2, 14, 5, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Tindora Nu Shaak', 'તીંડોરા', 'sabzi', 'veg', 70, 2, 8, 3, '{regular,diabetic}'),
  -- Soup
  ('c0000001-0000-0000-0000-000000000001', 'Tomato Soup', 'ટોમેટો સૂપ', 'soup', 'veg', 80, 2, 12, 2, '{regular,soft,liquid,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Dal Soup (strained)', 'દાળ સૂપ', 'soup', 'veg', 90, 6, 14, 1, '{regular,liquid,renal,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Chicken Clear Soup', 'ચિકન સૂપ', 'soup', 'nonveg', 60, 8, 2, 2, '{regular,high_protein,liquid}'),
  -- Non-veg
  ('c0000001-0000-0000-0000-000000000001', 'Chicken Curry', 'ચિકન કરી', 'main_course', 'nonveg', 250, 25, 8, 14, '{regular,high_protein}'),
  ('c0000001-0000-0000-0000-000000000001', 'Fish Curry', 'માછલી કરી', 'main_course', 'nonveg', 200, 22, 6, 10, '{regular,high_protein,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Egg Bhurji (2 eggs)', 'ઈંડા ભુર્જી', 'main_course', 'egg', 180, 14, 4, 12, '{regular,high_protein,diabetic}'),
  -- Breakfast
  ('c0000001-0000-0000-0000-000000000001', 'Poha', 'પોહા', 'snack', 'veg', 180, 4, 30, 4, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'Upma', 'ઉપમા', 'snack', 'veg', 200, 5, 28, 6, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Idli-Sambhar (3pc)', 'ઇડલી-સાંભાર', 'snack', 'veg', 220, 7, 38, 3, '{regular,diabetic,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Thepla (2pc)', 'થેપલા', 'roti', 'veg', 200, 5, 26, 8, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Moong Dal Cheela (2pc)', 'મૂંગ દાળ ચીલા', 'snack', 'veg', 160, 10, 20, 4, '{regular,diabetic,high_protein}'),
  ('c0000001-0000-0000-0000-000000000001', 'Bread-Butter-Jam', 'બ્રેડ-બટર', 'snack', 'veg', 250, 5, 36, 10, '{regular}'),
  -- Curd/Raita
  ('c0000001-0000-0000-0000-000000000001', 'Dahi (plain curd)', 'દહીં', 'curd_raita', 'veg', 60, 4, 5, 3, '{regular,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Chaas (buttermilk)', 'છાશ', 'beverage', 'veg', 40, 2, 4, 1, '{regular,diabetic,soft,renal}'),
  ('c0000001-0000-0000-0000-000000000001', 'Boondi Raita', 'બૂંદી રાયતું', 'curd_raita', 'veg', 80, 3, 8, 4, '{regular}'),
  -- Beverages
  ('c0000001-0000-0000-0000-000000000001', 'Chai (tea)', 'ચા', 'beverage', 'veg', 50, 2, 6, 2, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Chai (sugar-free)', 'ચા (સુગર ફ્રી)', 'beverage', 'veg', 20, 2, 1, 1, '{regular,diabetic,renal,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Milk (warm)', 'દૂધ', 'beverage', 'veg', 100, 6, 8, 4, '{regular,soft,high_protein}'),
  ('c0000001-0000-0000-0000-000000000001', 'Nimbu Pani', 'લીંબુ પાણી', 'beverage', 'veg', 30, 0, 8, 0, '{regular,diabetic}'),
  ('c0000001-0000-0000-0000-000000000001', 'ORS', 'ઓઆરએસ', 'beverage', 'veg', 20, 0, 5, 0, '{regular,liquid}'),
  -- Dessert/Fruit
  ('c0000001-0000-0000-0000-000000000001', 'Seasonal Fruit', 'ફળ', 'fruit', 'veg', 60, 1, 14, 0, '{regular,diabetic,cardiac}'),
  ('c0000001-0000-0000-0000-000000000001', 'Banana', 'કેળું', 'fruit', 'veg', 90, 1, 22, 0, '{regular,soft}'),
  ('c0000001-0000-0000-0000-000000000001', 'Kheer (small)', 'ખીર', 'dessert', 'veg', 150, 4, 24, 4, '{regular}'),
  ('c0000001-0000-0000-0000-000000000001', 'Sugar-free Custard', 'કસ્ટર્ડ', 'dessert', 'veg', 80, 3, 10, 3, '{regular,diabetic,soft}')
ON CONFLICT DO NOTHING;
