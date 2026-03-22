-- Health1 HMIS — Physiotherapy & Sports Medicine schema
-- Run in HMIS Supabase SQL Editor (bmuupgrzbfmddjwcqlss)

-- ═══ 1. Plan enhancements ═══

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS plan_type varchar(20) DEFAULT 'therapeutic' CHECK (plan_type IN ('therapeutic','preventive','sports_rehab','post_surgical','cardiac_rehab','neuro_rehab','pelvic_floor','occupational'));
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS referral_source varchar(50); -- ortho, neuro, cardio, sports_med, self
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS referring_doctor_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS injury_mechanism text;
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS sport varchar(50); -- cricket, football, running, gym, tennis, swimming, etc.
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS competition_level varchar(20); -- recreational, amateur, semi_pro, professional, elite
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS position_role varchar(50); -- e.g. fast bowler, goalkeeper, marathon runner
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS pre_injury_activity_level varchar(20); -- sedentary, light, moderate, active, very_active, athlete

-- Baseline assessment
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS baseline_assessment jsonb DEFAULT '{}';
-- Format: { pain_vas: 7, rom: { flexion: 80, extension: -10 }, strength: { quads: "3/5", hamstring: "4/5" },
--   functional: { sit_to_stand: "difficulty", stairs: "unable", squat: "partial" },
--   special_tests: { lachman: "positive", mcmurray: "positive", anterior_drawer: "negative" } }

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS outcome_measures jsonb DEFAULT '{}';
-- Format: { koos: 45, dash: 62, lefs: 38, sf36_physical: 35, fms_total: 12 }

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS return_to_sport_phase varchar(30);
-- phase_1_protection, phase_2_controlled_motion, phase_3_strengthening, phase_4_sport_specific, phase_5_return_to_play

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS return_to_sport_criteria jsonb DEFAULT '[]';
-- [{ criterion: "Full ROM", met: true }, { criterion: "90% strength", met: false }, { criterion: "Y-balance ≥4cm", met: false }]

ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS precautions text[];
ALTER TABLE hmis_physio_plans ADD COLUMN IF NOT EXISTS contraindications text[];

-- ═══ 2. Session enhancements ═══

ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES hmis_physio_plans(id);
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS session_type varchar(20) DEFAULT 'treatment' CHECK (session_type IN ('assessment','treatment','review','fms_screen','rts_test','maintenance','prevention'));

-- Detailed modality parameters
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS modality_params jsonb DEFAULT '[]';
-- Format: [{ modality: "ift", frequency: "4000Hz", duration_min: 15, intensity: "comfortable", electrode_placement: "knee_surround" },
--          { modality: "us", frequency: "1MHz", intensity: "1.5W/cm2", mode: "continuous", duration_min: 8, area: "patellar_tendon" }]

-- Detailed exercise prescription
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS exercise_prescription jsonb DEFAULT '[]';
-- Format: [{ exercise: "Quad sets", sets: 3, reps: 15, hold_sec: 5, resistance: "body_weight", progression: "add ankle weight next session" },
--          { exercise: "SLR", sets: 3, reps: 10, hold_sec: 3, side: "left", notes: "pain-free range only" }]

-- ROM tracking (per joint, per movement)
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS rom_measurements jsonb DEFAULT '[]';
-- Format: [{ joint: "knee", side: "left", movement: "flexion", active: 110, passive: 120, normal: 135, pain_at_end: true },
--          { joint: "knee", side: "left", movement: "extension", active: -5, passive: 0, normal: 0 }]

-- Strength (MMT)
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS strength_measurements jsonb DEFAULT '[]';
-- Format: [{ muscle_group: "quadriceps", side: "left", grade: "4/5", method: "mmt" },
--          { muscle_group: "hamstrings", side: "left", grade: "3+/5", method: "mmt" }]

-- Functional tests
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS functional_tests jsonb DEFAULT '[]';
-- Format: [{ test: "timed_up_and_go", result: "12.5", unit: "seconds", normal: "<10" },
--          { test: "single_leg_hop", result: "85", unit: "percent_of_contralateral", target: ">90" },
--          { test: "y_balance_anterior", result: "62", unit: "cm", side: "left" }]

-- Special tests
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS special_tests jsonb DEFAULT '[]';
-- Format: [{ test: "Lachman", result: "positive", grade: "2+", notes: "soft endpoint" }]

-- Gait analysis
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS gait_analysis jsonb DEFAULT '{}';
-- Format: { pattern: "antalgic", aids: "crutches", weight_bearing: "partial", deviations: ["shortened stride", "trendelenburg"] }

-- Patient-reported outcome
ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS patient_reported jsonb DEFAULT '{}';
-- Format: { pain_current: 4, pain_worst: 7, pain_best: 2, sleep_affected: true, function_level: "moderate_difficulty",
--   activity_tolerance: "30min_walking", confidence: 6, compliance: "good" }

ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS home_exercise_program jsonb DEFAULT '[]';
-- Format: [{ exercise: "Wall slides", sets: 3, reps: 15, frequency: "twice_daily", video_link: "..." }]

ALTER TABLE hmis_physio_sessions ADD COLUMN IF NOT EXISTS next_session_plan text;

-- ═══ 3. FMS (Functional Movement Screen) table ═══

CREATE TABLE IF NOT EXISTS hmis_physio_fms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES hmis_patients(id),
  plan_id uuid REFERENCES hmis_physio_plans(id),
  screener_id uuid REFERENCES hmis_staff(id),
  screen_date date NOT NULL DEFAULT CURRENT_DATE,
  -- 7 FMS tests (0-3 each, total max 21)
  deep_squat int CHECK (deep_squat BETWEEN 0 AND 3),
  hurdle_step_l int CHECK (hurdle_step_l BETWEEN 0 AND 3),
  hurdle_step_r int CHECK (hurdle_step_r BETWEEN 0 AND 3),
  inline_lunge_l int CHECK (inline_lunge_l BETWEEN 0 AND 3),
  inline_lunge_r int CHECK (inline_lunge_r BETWEEN 0 AND 3),
  shoulder_mobility_l int CHECK (shoulder_mobility_l BETWEEN 0 AND 3),
  shoulder_mobility_r int CHECK (shoulder_mobility_r BETWEEN 0 AND 3),
  active_slr_l int CHECK (active_slr_l BETWEEN 0 AND 3),
  active_slr_r int CHECK (active_slr_r BETWEEN 0 AND 3),
  trunk_stability_pushup int CHECK (trunk_stability_pushup BETWEEN 0 AND 3),
  rotary_stability_l int CHECK (rotary_stability_l BETWEEN 0 AND 3),
  rotary_stability_r int CHECK (rotary_stability_r BETWEEN 0 AND 3),
  -- Clearing tests
  shoulder_clearing_l boolean DEFAULT false,
  shoulder_clearing_r boolean DEFAULT false,
  extension_clearing boolean DEFAULT false,
  flexion_clearing boolean DEFAULT false,
  -- Computed
  total_score int,
  asymmetries text[],
  risk_level varchar(10), -- low, moderate, high
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ═══ 4. Outcome measure tracking over time ═══

CREATE TABLE IF NOT EXISTS hmis_physio_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES hmis_patients(id),
  plan_id uuid REFERENCES hmis_physio_plans(id),
  measure_date date NOT NULL DEFAULT CURRENT_DATE,
  measure_type varchar(30) NOT NULL, -- vas, koos, dash, lefs, sf36, oswestry, nprs, groc, fms, y_balance, hop_test, berg_balance
  score decimal(6,1) NOT NULL,
  max_score decimal(6,1),
  subscales jsonb DEFAULT '{}', -- { pain: 45, symptoms: 60, adl: 55, sport: 30, qol: 25 } for KOOS
  notes text,
  recorded_by uuid REFERENCES hmis_staff(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physio_outcomes ON hmis_physio_outcomes(patient_id, plan_id, measure_type, measure_date);

-- ═══ 5. Prevention program templates ═══

CREATE TABLE IF NOT EXISTS hmis_physio_prevention_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  program_name varchar(200) NOT NULL,
  program_type varchar(30) NOT NULL, -- injury_prevention, prehab, wellness, corporate, sports_specific
  target_population varchar(100), -- cricket_fast_bowlers, runners, desk_workers, elderly, post_menopausal
  sport varchar(50),
  duration_weeks int DEFAULT 8,
  sessions_per_week int DEFAULT 3,
  exercises jsonb NOT NULL DEFAULT '[]',
  -- Format: [{ phase: 1, week_from: 1, week_to: 2, exercises: [{ name: "Nordic hamstring curl", sets: 3, reps: 5 }] }]
  screening_protocol jsonb DEFAULT '{}',
  -- Format: { fms: true, y_balance: true, single_leg_hop: true, grip_strength: true }
  evidence_reference text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed prevention programs
INSERT INTO hmis_physio_prevention_programs (centre_id, program_name, program_type, target_population, sport, duration_weeks, sessions_per_week, exercises, screening_protocol) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'FIFA 11+ Injury Prevention', 'injury_prevention', 'football_players', 'football', 12, 3,
   '[{"phase":1,"name":"Running warm-up","exercises":[{"name":"Jog forward","reps":"2x"},{"name":"Hip out","reps":"2x"},{"name":"Hip in","reps":"2x"}]},{"phase":2,"name":"Strength & plyometrics","exercises":[{"name":"Nordic hamstring curl","sets":3,"reps":5},{"name":"Single-leg balance","hold_sec":30},{"name":"Squats","sets":2,"reps":15}]},{"phase":3,"name":"Running drills","exercises":[{"name":"Bounding","reps":"2x"},{"name":"Plant and cut","reps":"2x"}]}]',
   '{"fms":true,"y_balance":true,"single_leg_hop":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'Cricket Fast Bowler Prehab', 'prehab', 'cricket_fast_bowlers', 'cricket', 8, 4,
   '[{"phase":1,"name":"Core & shoulder stability","exercises":[{"name":"Plank variations","sets":3,"hold_sec":30},{"name":"Shoulder ER/IR with band","sets":3,"reps":15},{"name":"Thoracic rotation","sets":2,"reps":10}]},{"phase":2,"name":"Power & endurance","exercises":[{"name":"Medicine ball throws","sets":3,"reps":8},{"name":"Single-leg RDL","sets":3,"reps":10},{"name":"Anti-rotation press","sets":3,"reps":12}]}]',
   '{"fms":true,"shoulder_rom":true,"trunk_rotation":true,"bowling_action_analysis":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'ACL Injury Prevention (Female Athletes)', 'injury_prevention', 'female_athletes', null, 8, 3,
   '[{"phase":1,"name":"Neuromuscular training","exercises":[{"name":"Single-leg squat","sets":3,"reps":10},{"name":"Jump-land-stabilize","sets":2,"reps":8},{"name":"Lateral band walks","sets":2,"reps":15}]},{"phase":2,"name":"Plyometric progression","exercises":[{"name":"Box jump with soft landing","sets":3,"reps":6},{"name":"Single-leg hop stick","sets":2,"reps":8},{"name":"Deceleration drills","sets":2,"reps":6}]}]',
   '{"fms":true,"y_balance":true,"drop_jump_screening":true,"knee_valgus_assessment":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'Runner''s Knee Prevention', 'injury_prevention', 'runners', 'running', 6, 3,
   '[{"phase":1,"name":"Hip & glute activation","exercises":[{"name":"Clamshells","sets":3,"reps":15},{"name":"Side-lying hip abduction","sets":3,"reps":12},{"name":"Glute bridge","sets":3,"reps":15}]},{"phase":2,"name":"Functional strengthening","exercises":[{"name":"Single-leg squat","sets":3,"reps":10},{"name":"Step-downs","sets":3,"reps":10},{"name":"Bulgarian split squat","sets":3,"reps":8}]}]',
   '{"fms":true,"single_leg_squat_assessment":true,"running_gait_analysis":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'Corporate Desk Worker Wellness', 'corporate', 'desk_workers', null, 12, 2,
   '[{"phase":1,"name":"Postural correction","exercises":[{"name":"Chin tucks","sets":3,"reps":10},{"name":"Thoracic extension over roller","sets":2,"reps":8},{"name":"Doorway pec stretch","hold_sec":30},{"name":"Seated piriformis stretch","hold_sec":30}]},{"phase":2,"name":"Core & ergonomic strength","exercises":[{"name":"Dead bug","sets":3,"reps":10},{"name":"Bird-dog","sets":3,"reps":10},{"name":"Wall angels","sets":2,"reps":12}]}]',
   '{"posture_screen":true,"grip_strength":true,"neck_rom":true,"shoulder_rom":true}'),
  ('c0000001-0000-0000-0000-000000000001', 'Fall Prevention (Elderly)', 'injury_prevention', 'elderly', null, 12, 3,
   '[{"phase":1,"name":"Balance foundations","exercises":[{"name":"Tandem stance","hold_sec":30},{"name":"Single-leg stance","hold_sec":15},{"name":"Heel-toe walk","reps":"10m x3"}]},{"phase":2,"name":"Functional strength","exercises":[{"name":"Sit-to-stand","sets":3,"reps":10},{"name":"Step-ups","sets":2,"reps":10},{"name":"Calf raises","sets":3,"reps":15}]}]',
   '{"berg_balance":true,"timed_up_and_go":true,"30sec_chair_stand":true,"gait_speed":true}')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_physio_sessions_plan ON hmis_physio_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_physio_fms ON hmis_physio_fms(patient_id, screen_date);
