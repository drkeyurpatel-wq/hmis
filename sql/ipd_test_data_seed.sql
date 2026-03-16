-- ============================================================
-- Health1 HMIS — IPD Test Data Seed
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- Seeds: Doctors, Departments, Wards, Rooms, Beds, 8 Admissions, Rounds, Med Orders
-- ============================================================

DO $$
DECLARE
    shilaj_id uuid;
    -- Departments
    dept_med uuid; dept_surg uuid; dept_cardio uuid; dept_neuro uuid;
    dept_ortho uuid; dept_pulm uuid; dept_icu uuid; dept_gastro uuid;
    -- Doctors
    dr_sunil uuid; dr_jignesh uuid; dr_milind uuid; dr_priya uuid;
    dr_ravi uuid; dr_sneha uuid; dr_amit uuid; dr_kavita uuid;
    -- Wards & Beds
    ward_gen uuid; ward_pvt uuid; ward_icu uuid; ward_semi uuid;
    room_101 uuid; room_102 uuid; room_201 uuid; room_202 uuid; room_icu1 uuid; room_301 uuid; room_302 uuid; room_303 uuid;
    bed_101a uuid; bed_101b uuid; bed_102a uuid; bed_201a uuid; bed_202a uuid;
    bed_icu1a uuid; bed_icu1b uuid; bed_icu1c uuid;
    bed_301a uuid; bed_302a uuid; bed_303a uuid;
    -- Patients (existing test patients)
    pat_rajesh uuid; pat_priti uuid; pat_mahesh uuid; pat_anita uuid;
    pat_dharmesh uuid; pat_kavita_p uuid; pat_suresh uuid; pat_meena uuid;
    -- Admissions
    adm1 uuid; adm2 uuid; adm3 uuid; adm4 uuid; adm5 uuid; adm6 uuid; adm7 uuid; adm8 uuid;
BEGIN
    SELECT id INTO shilaj_id FROM hmis_centres WHERE code = 'SHJ' OR name ILIKE '%shilaj%' LIMIT 1;
    IF shilaj_id IS NULL THEN RAISE NOTICE 'Shilaj centre not found'; RETURN; END IF;

    -- ============================================================
    -- DEPARTMENTS
    -- ============================================================
    INSERT INTO hmis_departments (centre_id, name, type) VALUES
    (shilaj_id, 'General Medicine', 'clinical'),
    (shilaj_id, 'General Surgery', 'clinical'),
    (shilaj_id, 'Cardiology', 'clinical'),
    (shilaj_id, 'Neurology', 'clinical'),
    (shilaj_id, 'Orthopedics', 'clinical'),
    (shilaj_id, 'Pulmonology', 'clinical'),
    (shilaj_id, 'Critical Care (ICU)', 'clinical'),
    (shilaj_id, 'Gastroenterology', 'clinical')
    ON CONFLICT (centre_id, name) DO NOTHING;

    SELECT id INTO dept_med FROM hmis_departments WHERE centre_id = shilaj_id AND name = 'General Medicine';
    SELECT id INTO dept_surg FROM hmis_departments WHERE centre_id = shilaj_id AND name = 'General Surgery';
    SELECT id INTO dept_cardio FROM hmis_departments WHERE centre_id = shilaj_id AND name = 'Cardiology';
    SELECT id INTO dept_neuro FROM hmis_departments WHERE centre_id = shilaj_id AND name = 'Neurology';
    SELECT id INTO dept_ortho FROM hmis_departments WHERE centre_id = shilaj_id AND name = 'Orthopedics';
    SELECT id INTO dept_pulm FROM hmis_departments WHERE centre_id = shilaj_id AND name = 'Pulmonology';
    SELECT id INTO dept_icu FROM hmis_departments WHERE centre_id = shilaj_id AND name = 'Critical Care (ICU)';
    SELECT id INTO dept_gastro FROM hmis_departments WHERE centre_id = shilaj_id AND name = 'Gastroenterology';

    -- ============================================================
    -- DOCTORS (8 consultants)
    -- ============================================================
    INSERT INTO hmis_staff (primary_centre_id, employee_code, full_name, staff_type, department_id, designation, specialisation, phone, email, is_active) VALUES
    (shilaj_id, 'DOC-SG-001', 'Dr. Sunil Gurmukhani', 'doctor', dept_cardio, 'MD, DM (Cardiology)', 'Interventional Cardiology', '9876500101', 'sunil.g@health1.co.in', true),
    (shilaj_id, 'DOC-JP-002', 'Dr. Jignesh Patel', 'doctor', dept_cardio, 'MD, DM (Cardiology)', 'Clinical Cardiology', '9876500102', 'jignesh.p@health1.co.in', true),
    (shilaj_id, 'DOC-MA-003', 'Dr. Milind Akhani', 'doctor', dept_surg, 'MS (Surgery), FMAS', 'Robotic & Laparoscopic Surgery', '9876500103', 'milind.a@health1.co.in', true),
    (shilaj_id, 'DOC-PM-004', 'Dr. Priya Mehta', 'doctor', dept_med, 'MD (Medicine)', 'Internal Medicine', '9876500104', 'priya.m@health1.co.in', true),
    (shilaj_id, 'DOC-RS-005', 'Dr. Ravi Sharma', 'doctor', dept_neuro, 'MD, DM (Neurology)', 'Neurology & Stroke', '9876500105', 'ravi.s@health1.co.in', true),
    (shilaj_id, 'DOC-SD-006', 'Dr. Sneha Desai', 'doctor', dept_ortho, 'MS (Ortho), MCh', 'Joint Replacement & Spine', '9876500106', 'sneha.d@health1.co.in', true),
    (shilaj_id, 'DOC-AT-007', 'Dr. Amit Trivedi', 'doctor', dept_pulm, 'MD (Pulmonology)', 'Pulmonology & Critical Care', '9876500107', 'amit.t@health1.co.in', true),
    (shilaj_id, 'DOC-KS-008', 'Dr. Kavita Shah', 'doctor', dept_gastro, 'MD, DM (Gastro)', 'Gastroenterology & Hepatology', '9876500108', 'kavita.s@health1.co.in', true)
    ON CONFLICT (employee_code) DO NOTHING;

    SELECT id INTO dr_sunil FROM hmis_staff WHERE phone = '9876500101';
    SELECT id INTO dr_jignesh FROM hmis_staff WHERE phone = '9876500102';
    SELECT id INTO dr_milind FROM hmis_staff WHERE phone = '9876500103';
    SELECT id INTO dr_priya FROM hmis_staff WHERE phone = '9876500104';
    SELECT id INTO dr_ravi FROM hmis_staff WHERE phone = '9876500105';
    SELECT id INTO dr_sneha FROM hmis_staff WHERE phone = '9876500106';
    SELECT id INTO dr_amit FROM hmis_staff WHERE phone = '9876500107';
    SELECT id INTO dr_kavita FROM hmis_staff WHERE phone = '9876500108';

    -- ============================================================
    -- WARDS, ROOMS, BEDS
    -- ============================================================
    INSERT INTO hmis_wards (centre_id, name, type, floor, department_id) VALUES
    (shilaj_id, 'General Ward - 1F', 'general', '1', dept_med),
    (shilaj_id, 'Private Ward - 2F', 'private', '2', dept_med),
    (shilaj_id, 'ICU', 'icu', '1', dept_icu),
    (shilaj_id, 'Semi-Private - 3F', 'semi_private', '3', dept_surg)
    ON CONFLICT (centre_id, name) DO NOTHING;

    SELECT id INTO ward_gen FROM hmis_wards WHERE centre_id = shilaj_id AND name = 'General Ward - 1F';
    SELECT id INTO ward_pvt FROM hmis_wards WHERE centre_id = shilaj_id AND name = 'Private Ward - 2F';
    SELECT id INTO ward_icu FROM hmis_wards WHERE centre_id = shilaj_id AND name = 'ICU';
    SELECT id INTO ward_semi FROM hmis_wards WHERE centre_id = shilaj_id AND name = 'Semi-Private - 3F';

    INSERT INTO hmis_rooms (ward_id, room_number, room_type, daily_rate) VALUES
    (ward_gen, '101', 'general', 1500),
    (ward_gen, '102', 'general', 1500),
    (ward_pvt, '201', 'private', 5000),
    (ward_pvt, '202', 'private', 5000),
    (ward_icu, 'ICU-1', 'icu', 12000),
    (ward_semi, '301', 'semi_private', 3000),
    (ward_semi, '302', 'semi_private', 3000),
    (ward_semi, '303', 'semi_private', 3000)
    ON CONFLICT (ward_id, room_number) DO NOTHING;

    SELECT id INTO room_101 FROM hmis_rooms WHERE ward_id = ward_gen AND room_number = '101';
    SELECT id INTO room_102 FROM hmis_rooms WHERE ward_id = ward_gen AND room_number = '102';
    SELECT id INTO room_201 FROM hmis_rooms WHERE ward_id = ward_pvt AND room_number = '201';
    SELECT id INTO room_202 FROM hmis_rooms WHERE ward_id = ward_pvt AND room_number = '202';
    SELECT id INTO room_icu1 FROM hmis_rooms WHERE ward_id = ward_icu AND room_number = 'ICU-1';
    SELECT id INTO room_301 FROM hmis_rooms WHERE ward_id = ward_semi AND room_number = '301';
    SELECT id INTO room_302 FROM hmis_rooms WHERE ward_id = ward_semi AND room_number = '302';
    SELECT id INTO room_303 FROM hmis_rooms WHERE ward_id = ward_semi AND room_number = '303';

    INSERT INTO hmis_beds (room_id, bed_number, status) VALUES
    (room_101, 'A', 'available'), (room_101, 'B', 'available'),
    (room_102, 'A', 'available'),
    (room_201, 'A', 'available'), (room_202, 'A', 'available'),
    (room_icu1, 'A', 'available'), (room_icu1, 'B', 'available'), (room_icu1, 'C', 'available'),
    (room_301, 'A', 'available'), (room_302, 'A', 'available'), (room_303, 'A', 'available')
    ON CONFLICT (room_id, bed_number) DO NOTHING;

    SELECT id INTO bed_101a FROM hmis_beds WHERE room_id = room_101 AND bed_number = 'A';
    SELECT id INTO bed_101b FROM hmis_beds WHERE room_id = room_101 AND bed_number = 'B';
    SELECT id INTO bed_102a FROM hmis_beds WHERE room_id = room_102 AND bed_number = 'A';
    SELECT id INTO bed_201a FROM hmis_beds WHERE room_id = room_201 AND bed_number = 'A';
    SELECT id INTO bed_202a FROM hmis_beds WHERE room_id = room_202 AND bed_number = 'A';
    SELECT id INTO bed_icu1a FROM hmis_beds WHERE room_id = room_icu1 AND bed_number = 'A';
    SELECT id INTO bed_icu1b FROM hmis_beds WHERE room_id = room_icu1 AND bed_number = 'B';
    SELECT id INTO bed_icu1c FROM hmis_beds WHERE room_id = room_icu1 AND bed_number = 'C';
    SELECT id INTO bed_301a FROM hmis_beds WHERE room_id = room_301 AND bed_number = 'A';
    SELECT id INTO bed_302a FROM hmis_beds WHERE room_id = room_302 AND bed_number = 'A';
    SELECT id INTO bed_303a FROM hmis_beds WHERE room_id = room_303 AND bed_number = 'A';

    -- ============================================================
    -- GET TEST PATIENTS
    -- ============================================================
    SELECT id INTO pat_rajesh FROM hmis_patients WHERE uhid = 'H1S-TEST-001';
    SELECT id INTO pat_priti FROM hmis_patients WHERE uhid = 'H1S-TEST-002';
    SELECT id INTO pat_mahesh FROM hmis_patients WHERE uhid = 'H1S-TEST-003';
    SELECT id INTO pat_anita FROM hmis_patients WHERE uhid = 'H1S-TEST-004';
    SELECT id INTO pat_dharmesh FROM hmis_patients WHERE uhid = 'H1S-TEST-005';
    SELECT id INTO pat_kavita_p FROM hmis_patients WHERE uhid = 'H1S-TEST-006';
    SELECT id INTO pat_suresh FROM hmis_patients WHERE uhid = 'H1S-TEST-007';
    SELECT id INTO pat_meena FROM hmis_patients WHERE uhid = 'H1S-TEST-008';

    IF pat_rajesh IS NULL THEN RAISE NOTICE 'Test patients not found — run master_data_seed.sql first'; RETURN; END IF;

    -- ============================================================
    -- 8 ADMISSIONS (6 active, 1 discharge_initiated, 1 discharged)
    -- ============================================================
    INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, expected_discharge, payor_type, provisional_diagnosis, status) VALUES

    -- 1. Rajesh Patel — Cardiology, Acute MI, ICU, Emergency
    (shilaj_id, pat_rajesh, 'IPD-2603-001', dr_sunil, dr_sunil, dept_cardio, bed_icu1a, 'emergency',
     now() - interval '3 days', (CURRENT_DATE + 7)::date, 'insurance',
     'Acute Anterior Wall STEMI with Killip Class II', 'active')

    RETURNING id INTO adm1;
    UPDATE hmis_beds SET status = 'occupied', current_admission_id = adm1 WHERE id = bed_icu1a;

    INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, expected_discharge, payor_type, provisional_diagnosis, status) VALUES

    -- 2. Priti Shah — General Surgery, Laparoscopic Cholecystectomy, Elective
    (shilaj_id, pat_priti, 'IPD-2603-002', dr_milind, dr_milind, dept_surg, bed_301a, 'elective',
     now() - interval '1 day', (CURRENT_DATE + 2)::date, 'self',
     'Cholelithiasis for Laparoscopic Cholecystectomy', 'active')

    RETURNING id INTO adm2;
    UPDATE hmis_beds SET status = 'occupied', current_admission_id = adm2 WHERE id = bed_301a;

    INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, expected_discharge, payor_type, provisional_diagnosis, status) VALUES

    -- 3. Mahesh Joshi — Neurology, Acute Stroke, ICU, Emergency
    (shilaj_id, pat_mahesh, 'IPD-2603-003', dr_ravi, dr_ravi, dept_neuro, bed_icu1b, 'emergency',
     now() - interval '5 days', (CURRENT_DATE + 5)::date, 'govt_pmjay',
     'Acute Left MCA territory infarct with right hemiparesis, GCS 12/15', 'active')

    RETURNING id INTO adm3;
    UPDATE hmis_beds SET status = 'occupied', current_admission_id = adm3 WHERE id = bed_icu1b;

    INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, expected_discharge, payor_type, provisional_diagnosis, status) VALUES

    -- 4. Anita Desai — Orthopedics, TKR, Elective, Private room
    (shilaj_id, pat_anita, 'IPD-2603-004', dr_sneha, dr_sneha, dept_ortho, bed_201a, 'elective',
     now() - interval '2 days', (CURRENT_DATE + 5)::date, 'insurance',
     'Bilateral Osteoarthritis Knee (Grade IV KL) — Right TKR with Cuvis Robot', 'active')

    RETURNING id INTO adm4;
    UPDATE hmis_beds SET status = 'occupied', current_admission_id = adm4 WHERE id = bed_201a;

    INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, expected_discharge, payor_type, provisional_diagnosis, status) VALUES

    -- 5. Dharmesh Thakkar — Pulmonology, COPD Exacerbation, Emergency
    (shilaj_id, pat_dharmesh, 'IPD-2603-005', dr_amit, dr_amit, dept_pulm, bed_102a, 'emergency',
     now() - interval '4 days', (CURRENT_DATE + 3)::date, 'self',
     'Acute exacerbation of COPD with Type 2 Respiratory Failure', 'active')

    RETURNING id INTO adm5;
    UPDATE hmis_beds SET status = 'occupied', current_admission_id = adm5 WHERE id = bed_102a;

    INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, expected_discharge, payor_type, provisional_diagnosis, status) VALUES

    -- 6. Kavita Pandya — Medicine, Diabetic Ketoacidosis, Emergency
    (shilaj_id, pat_kavita_p, 'IPD-2603-006', dr_priya, dr_priya, dept_med, bed_icu1c, 'emergency',
     now() - interval '2 days', (CURRENT_DATE + 4)::date, 'insurance',
     'Diabetic Ketoacidosis (DKA) with Uncontrolled Type 1 DM, pH 7.18', 'active')

    RETURNING id INTO adm6;
    UPDATE hmis_beds SET status = 'occupied', current_admission_id = adm6 WHERE id = bed_icu1c;

    INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, expected_discharge, payor_type, provisional_diagnosis, status) VALUES

    -- 7. Suresh Agarwal — Gastroenterology, Upper GI Bleed, Discharge Initiated
    (shilaj_id, pat_suresh, 'IPD-2603-007', dr_kavita, dr_kavita, dept_gastro, bed_101a, 'emergency',
     now() - interval '6 days', CURRENT_DATE::date, 'self',
     'Acute Upper GI Bleed — Duodenal Ulcer (Forrest IIa), s/p Endoscopic Hemostasis', 'discharge_initiated')

    RETURNING id INTO adm7;
    UPDATE hmis_beds SET status = 'occupied', current_admission_id = adm7 WHERE id = bed_101a;

    INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, actual_discharge, expected_discharge, discharge_type, payor_type, provisional_diagnosis, final_diagnosis, status) VALUES

    -- 8. Meena Rawat — Cardiology, ACS, Discharged 2 days ago
    (shilaj_id, pat_meena, 'IPD-2603-008', dr_jignesh, dr_jignesh, dept_cardio, null, 'emergency',
     now() - interval '8 days', now() - interval '2 days', (CURRENT_DATE - 2)::date, 'normal', 'insurance',
     'Unstable Angina with Triple Vessel Disease', 'Unstable Angina (I20.0); Triple Vessel Disease; s/p PTCA with DES to LAD and RCA', 'discharged')

    RETURNING id INTO adm8;

    RAISE NOTICE 'Admissions seeded: 6 active, 1 discharge_initiated, 1 discharged';

    -- ============================================================
    -- DOCTOR ROUNDS (2-3 per active admission)
    -- ============================================================

    -- Rajesh (MI, ICU) — 3 rounds
    INSERT INTO hmis_doctor_rounds (admission_id, doctor_id, round_type, round_date, subjective, objective, assessment, plan, code_status, diet_instruction, activity_level) VALUES
    (adm1, dr_sunil, 'admission', now() - interval '3 days',
     'Severe retrosternal chest pain radiating to left arm since 4 hours, associated with sweating and nausea. Known hypertensive on Amlodipine.',
     'HR 105, BP 90/60, SpO2 94% on room air. ECG: ST elevation V1-V5. Troponin I: 15.2 ng/mL.',
     'Acute Anterior Wall STEMI, Killip Class II. High-risk features.',
     'Emergency PCI done — DES to LAD. Dual antiplatelet (Aspirin + Ticagrelor). IV Heparin infusion. Statin loading dose. CCU monitoring. Repeat Echo in 48h.',
     'full_code', 'NPO → clear liquids if stable', 'strict bed rest'),
    (adm1, dr_sunil, 'routine', now() - interval '2 days',
     'Chest pain resolved. No dyspnea at rest. Slept well.',
     'HR 82, BP 118/76, SpO2 98% on 2L O2. No crepitations. JVP normal.',
     'Post-PCI Day 1. Hemodynamically stable. No recurrent ischemia.',
     'Continue DAPT. Wean O2. Start Ramipril 2.5mg. Echo today. Mobilize bedside.',
     'full_code', 'cardiac diet 1500 kcal', 'bedside mobilization'),
    (adm1, dr_sunil, 'routine', now() - interval '1 day',
     'Feels better. Walking to bathroom independently. Appetite improved.',
     'HR 76, BP 122/78, SpO2 99% RA. Echo: EF 40%, anterior wall hypokinesis, no MR.',
     'Post-PCI Day 2. Improving. EF 40% — will need optimization.',
     'Continue meds. Add Eplerenone 25mg. Refer cardiac rehab. Plan discharge in 48h if stable.',
     'full_code', 'cardiac diet', 'ambulate in room');

    -- Priti (Cholecystectomy) — 2 rounds
    INSERT INTO hmis_doctor_rounds (admission_id, doctor_id, round_type, round_date, subjective, objective, assessment, plan, diet_instruction, activity_level) VALUES
    (adm2, dr_milind, 'admission', now() - interval '1 day',
     'Right upper abdominal pain after fatty meal, 3 episodes in last month. USG shows multiple gallstones.',
     'Vitals stable. Murphy sign positive. No jaundice. Labs: LFT normal, TLC 8500.',
     'Symptomatic cholelithiasis. Fit for surgery.',
     'Pre-op workup done. Lap cholecystectomy tomorrow AM (OT-1, SSI Mantra). NPO from midnight. DVT prophylaxis.',
     'light diet → NPO midnight', 'ambulatory'),
    (adm2, dr_milind, 'routine', now(),
     'Post-op Day 0. Mild port-site pain. No nausea. Passed flatus.',
     'HR 78, BP 124/76. Abdomen soft, port sites clean. Drain minimal serous.',
     'Post Lap Cholecystectomy (SSI Mantra 3.0) — uneventful. 4 ports, GB sent for HPE.',
     'Orals started. IV antibiotics → oral switch. Remove drain tomorrow. Discharge Day 1 if tolerating diet.',
     'liquids → soft diet', 'ambulate corridor');

    -- Mahesh (Stroke, ICU) — 3 rounds
    INSERT INTO hmis_doctor_rounds (admission_id, doctor_id, round_type, round_date, subjective, objective, assessment, plan, code_status, diet_instruction, activity_level) VALUES
    (adm3, dr_ravi, 'admission', now() - interval '5 days',
     'Found with right-sided weakness and slurred speech by family. Onset ~6 hours ago. Known diabetic and hypertensive.',
     'GCS 12 (E3V4M5). Right hemiplegia (0/5 UL, 2/5 LL). Right UMN facial palsy. Aphasia. NIHSS 16. CT Brain: Left MCA infarct.',
     'Acute left MCA territory ischemic stroke. NIHSS 16 — moderate-severe. Beyond thrombolysis window.',
     'Admit ICU. NPO, NGT feeding. IV NS. Aspirin 325mg. Atorvastatin 80mg. Monitor GCS q2h. MRI Brain + MRA tomorrow. Swallow assessment.',
     'full_code', 'NPO — NGT feeding 60ml/h', 'strict bed rest'),
    (adm3, dr_ravi, 'routine', now() - interval '3 days',
     'More alert. Attempting to speak — mostly garbled. Right arm still plegic, leg trace movement.',
     'GCS 14 (E4V4M6). NIHSS 12. MRI: Large left MCA infarct with no hemorrhagic transformation. MRA: left ICA 70% stenosis.',
     'Stroke Day 2. Improving consciousness. No HT. Left ICA stenosis significant.',
     'Continue antiplatelets. Start Physiotherapy. Speech therapy consult. Vascular surgery opinion for ICA stenosis. Repeat NIHSS Day 5.',
     'full_code', 'pureed diet — passed swallow assessment', 'bed exercises, passive ROM'),
    (adm3, dr_ravi, 'routine', now() - interval '1 day',
     'Speaking 2-3 word phrases. Right leg 3/5. Right arm 1/5. Family anxious about prognosis.',
     'GCS 15. NIHSS 9. Vitals stable. No fever.',
     'Stroke Day 4. Good neurological recovery trajectory. Right arm lag expected to be slow.',
     'Shift to ward if stable 24h. Intensify PT/OT. Family counseling. Plan: CEA evaluation by vascular surgery.',
     'full_code', 'soft diet', 'sit up, chair transfer');

    -- Anita (TKR) — 2 rounds
    INSERT INTO hmis_doctor_rounds (admission_id, doctor_id, round_type, round_date, subjective, objective, assessment, plan, diet_instruction, activity_level) VALUES
    (adm4, dr_sneha, 'admission', now() - interval '2 days',
     'Severe bilateral knee pain for 5 years, worse in last 6 months. Unable to climb stairs. BMI 32.',
     'Bilateral varus deformity. Right knee: FFD 15°, ROM 0-90°. X-ray: Grade IV OA bilateral. Pre-op fitness: ASA Grade 2.',
     'Bilateral OA Knee Grade IV. Right TKR first (Cuvis Robot). Left TKR planned 3 months later.',
     'Pre-op: Blood grouping + crossmatch 2 units PRBC. Enoxaparin 40mg OD. Quadriceps exercises. Surgery tomorrow.',
     'normal diet → NPO midnight', 'ambulatory with walker'),
    (adm4, dr_sneha, 'routine', now() - interval '1 day',
     'Post-op Day 1. Pain 6/10 at rest, 8/10 on movement. Drain output 250ml. Knee swollen.',
     'HR 88, BP 130/80. Wound clean, drain in situ. Knee ROM 0-40° passive. Ankle pumps active.',
     'Post Right TKR (Cuvis Robot) Day 1. Expected progress. Pain control needs optimization.',
     'Epidural top-ups. Add Pregabalin 75mg HS. CPM machine 0-30° → increase daily. Ice packs. Drain removal Day 2. PT BID.',
     'full diet, high protein', 'CPM, chair transfer w PT');

    -- Dharmesh (COPD Exacerbation) — 2 rounds
    INSERT INTO hmis_doctor_rounds (admission_id, doctor_id, round_type, round_date, subjective, objective, assessment, plan, diet_instruction, activity_level) VALUES
    (adm5, dr_amit, 'admission', now() - interval '4 days',
     'Severe breathlessness for 2 days, worsening cough with purulent sputum. Known COPD on inhalers. 30 pack-year smoker.',
     'RR 28, SpO2 82% on RA → 92% on 4L O2. Bilateral wheeze + creps. ABG: pH 7.32, pCO2 55, pO2 58.',
     'Acute exacerbation of COPD with Type 2 Respiratory Failure. Infection triggered.',
     'NIV BiPAP 15/5. IV Methylprednisolone 40mg q8h. Nebulization q4h. IV Piperacillin-Tazobactam. ABG repeat 4h. ICU if no improvement.',
     'soft diet', 'propped up, strict bed rest'),
    (adm5, dr_amit, 'routine', now() - interval '2 days',
     'Breathing improved. Sputum less purulent. Tolerating 2L O2 nasal prongs.',
     'RR 20, SpO2 95% on 2L. Wheeze reduced. ABG: pH 7.38, pCO2 45, pO2 72.',
     'COPD exacerbation Day 2 — improving. ABG normalized.',
     'Wean to nasal prongs. Switch IV to oral steroids. Continue antibiotics Day 5. Sputum culture pending. Plan step-down from NIV.',
     'normal diet', 'sit up, bedside commode');

    -- Kavita (DKA) — 2 rounds
    INSERT INTO hmis_doctor_rounds (admission_id, doctor_id, round_type, round_date, subjective, objective, assessment, plan, code_status, diet_instruction, activity_level) VALUES
    (adm6, dr_priya, 'admission', now() - interval '2 days',
     'Found drowsy at home. Missed insulin for 3 days due to gastroenteritis. Known Type 1 DM for 8 years. Vomiting and abdominal pain.',
     'GCS 13. Kussmaul breathing. Dehydrated. RBS 480, pH 7.18, HCO3 8, Ketones 5.2, K+ 5.8.',
     'Diabetic Ketoacidosis (DKA) — severe. Precipitant: missed insulin + GE.',
     'DKA Protocol: IV NS 1L/h x 2h then 500ml/h. Insulin infusion 0.1 U/kg/h. KCl 20mEq/L once K+ <5.5. Hourly RBS + q4h ABG. Catheterize. I/O chart strict.',
     'full_code', 'NPO until pH > 7.3', 'strict bed rest'),
    (adm6, dr_priya, 'routine', now() - interval '1 day',
     'More alert. No vomiting since 12h. Mild abdominal tenderness.',
     'GCS 15. HR 92, BP 110/70. RBS 220, pH 7.34, HCO3 18, K+ 4.2. Urine output 80ml/h.',
     'DKA resolving — anion gap closing. Transitioning to subcutaneous insulin.',
     'Switch to SC insulin: Glargine 20U + Aspart pre-meals. Overlap IV insulin 2h. Start orals. Endocrine consult for insulin titration. Diabetes education.',
     'full_code', 'diabetic diet 1500 kcal', 'sit up, walk to bathroom');

    -- Suresh (GI Bleed, discharge initiated) — 2 rounds
    INSERT INTO hmis_doctor_rounds (admission_id, doctor_id, round_type, round_date, subjective, objective, assessment, plan, diet_instruction, activity_level) VALUES
    (adm7, dr_kavita, 'admission', now() - interval '6 days',
     'Multiple episodes of hematemesis and melena since morning. 2 episodes of syncope. Known H. pylori positive 1 year ago — did not complete treatment.',
     'Pale, tachycardic HR 120, BP 88/60. Hb 5.8 g/dL. Melena on DRE.',
     'Acute Upper GI Bleed — hemodynamically unstable. Likely duodenal ulcer bleed given H. pylori history.',
     '2 large bore IV. Crossmatch 4 units PRBC. Transfuse 2 units now. IV PPI (Pantoprazole 80mg bolus + 8mg/h infusion). Urgent EGD within 6h. NPO.',
     'NPO', 'strict bed rest'),
    (adm7, dr_kavita, 'routine', now() - interval '1 day',
     'No re-bleeding x 4 days. Hb stable at 9.8. Stools turning brown. Appetite returning.',
     'HR 78, BP 122/74. Abdomen soft. No melena. EGD Day 1: Duodenal ulcer Forrest IIa — clipped + injected.',
     'Post-endoscopic hemostasis Day 5. Hemodynamically stable. No re-bleed.',
     'Plan discharge tomorrow. Oral PPI BID x 8 weeks. H. pylori triple therapy x 14 days. Repeat EGD in 8 weeks. Avoid NSAIDs.',
     'soft diet → normal', 'ambulatory');

    -- ============================================================
    -- MED ORDERS for active patients
    -- ============================================================

    -- Rajesh (MI) meds
    INSERT INTO hmis_ipd_medication_orders (admission_id, drug_name, dose, route, frequency, ordered_by) VALUES
    (adm1, 'Aspirin', '75 mg', 'oral', 'OD', dr_sunil),
    (adm1, 'Ticagrelor', '90 mg', 'oral', 'BD', dr_sunil),
    (adm1, 'Atorvastatin', '80 mg', 'oral', 'HS', dr_sunil),
    (adm1, 'Ramipril', '2.5 mg', 'oral', 'OD', dr_sunil),
    (adm1, 'Metoprolol Succinate', '25 mg', 'oral', 'OD', dr_sunil),
    (adm1, 'Eplerenone', '25 mg', 'oral', 'OD', dr_sunil),
    (adm1, 'Pantoprazole', '40 mg', 'iv', 'OD', dr_sunil),
    (adm1, 'Enoxaparin', '60 mg', 'sc', 'BD', dr_sunil);

    -- Mahesh (Stroke) meds
    INSERT INTO hmis_ipd_medication_orders (admission_id, drug_name, dose, route, frequency, ordered_by) VALUES
    (adm3, 'Aspirin', '325 mg', 'oral', 'OD', dr_ravi),
    (adm3, 'Atorvastatin', '80 mg', 'oral', 'HS', dr_ravi),
    (adm3, 'Amlodipine', '5 mg', 'oral', 'OD', dr_ravi),
    (adm3, 'Metformin', '500 mg', 'oral', 'BD', dr_ravi),
    (adm3, 'Pantoprazole', '40 mg', 'oral', 'OD', dr_ravi),
    (adm3, 'Enoxaparin', '40 mg', 'sc', 'OD', dr_ravi);

    -- Anita (TKR) meds
    INSERT INTO hmis_ipd_medication_orders (admission_id, drug_name, dose, route, frequency, ordered_by) VALUES
    (adm4, 'Paracetamol', '1 gm', 'iv', 'TDS', dr_sneha),
    (adm4, 'Tramadol', '50 mg', 'iv', 'BD', dr_sneha),
    (adm4, 'Pregabalin', '75 mg', 'oral', 'HS', dr_sneha),
    (adm4, 'Enoxaparin', '40 mg', 'sc', 'OD', dr_sneha),
    (adm4, 'Cefuroxime', '1.5 gm', 'iv', 'BD', dr_sneha),
    (adm4, 'Pantoprazole', '40 mg', 'iv', 'OD', dr_sneha);

    -- Kavita (DKA) meds
    INSERT INTO hmis_ipd_medication_orders (admission_id, drug_name, dose, route, frequency, ordered_by) VALUES
    (adm6, 'Insulin Glargine', '20 units', 'sc', 'HS', dr_priya),
    (adm6, 'Insulin Aspart', '8 units', 'sc', 'TDS (pre-meals)', dr_priya),
    (adm6, 'Ondansetron', '4 mg', 'iv', 'SOS', dr_priya),
    (adm6, 'NS 0.9%', '500 ml', 'iv', 'q6h', dr_priya),
    (adm6, 'KCl', '20 mEq/L', 'iv', 'in each NS', dr_priya);

    RAISE NOTICE 'IPD test data seeded: 8 departments, 8 doctors, 4 wards, 8 rooms, 11 beds, 8 admissions, 17 rounds, 24 med orders';
END $$;
