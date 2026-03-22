-- ════════════════════════════════════════════════════════════════
-- Health1 HMIS — FULL DEMO SEED
-- 500+ patients, 100 admissions, 250 OPD, billing, lab, pharmacy, EMR
-- Run AFTER REBUILD_FULL.sql + SEED_DATA.sql
-- ════════════════════════════════════════════════════════════════

-- ═══ WARDS + ROOMS + BEDS (Shilaj — 105 operational beds) ═══
DO $$
DECLARE
  shilaj uuid := 'c0000001-0000-0000-0000-000000000001';
  vastral uuid := 'c0000001-0000-0000-0000-000000000002';
  modasa uuid := 'c0000001-0000-0000-0000-000000000003';
  gandhinagar uuid := 'c0000001-0000-0000-0000-000000000004';
  udaipur uuid := 'c0000001-0000-0000-0000-000000000005';
  w_id uuid; r_id uuid; b int;
  centres uuid[] := ARRAY[shilaj, vastral, modasa, gandhinagar, udaipur];
  cid uuid;
  ward_rec RECORD;
BEGIN
  -- Shilaj wards
  FOR ward_rec IN (
    SELECT * FROM (VALUES
      ('General Ward A', 'general', '2', 4, 6, 1500),
      ('General Ward B', 'general', '2', 4, 6, 1500),
      ('Semi-Private', 'semi_private', '3', 5, 2, 3000),
      ('Private Wing', 'private', '4', 5, 1, 6000),
      ('ICU', 'icu', '1', 3, 3, 12000),
      ('Transplant ICU', 'transplant_icu', '1', 1, 5, 15000),
      ('NICU', 'nicu', '1', 1, 4, 10000),
      ('Emergency', 'general', 'G', 1, 5, 2000),
      ('Isolation', 'isolation', '1', 1, 3, 4000)
    ) AS t(name, type, floor, rooms, beds_per_room, rate)
  ) LOOP
    INSERT INTO hmis_wards (centre_id, name, type, floor) VALUES (shilaj, ward_rec.name, ward_rec.type, ward_rec.floor) RETURNING id INTO w_id;
    FOR r IN 1..ward_rec.rooms LOOP
      INSERT INTO hmis_rooms (ward_id, room_number, room_type, daily_rate) VALUES (w_id, ward_rec.floor || format('%02s', r), ward_rec.type, ward_rec.rate) RETURNING id INTO r_id;
      FOR b IN 1..ward_rec.beds_per_room LOOP
        INSERT INTO hmis_beds (room_id, bed_number, status) VALUES (r_id, ward_rec.name || '-' || r || chr(64+b), 'available');
      END LOOP;
    END LOOP;
  END LOOP;

  -- Other centres: simpler ward setup
  FOR cid IN SELECT unnest(ARRAY[vastral, modasa, gandhinagar, udaipur]) LOOP
    FOR ward_rec IN (SELECT * FROM (VALUES ('General', 'general', '1', 3, 6, 1200), ('ICU', 'icu', '1', 1, 4, 8000), ('Private', 'private', '2', 2, 2, 4000)) AS t(name, type, floor, rooms, beds_per_room, rate)) LOOP
      INSERT INTO hmis_wards (centre_id, name, type, floor) VALUES (cid, ward_rec.name, ward_rec.type, ward_rec.floor) RETURNING id INTO w_id;
      FOR r IN 1..ward_rec.rooms LOOP
        INSERT INTO hmis_rooms (ward_id, room_number, room_type, daily_rate) VALUES (w_id, ward_rec.floor || format('%02s', r), ward_rec.type, ward_rec.rate) RETURNING id INTO r_id;
        FOR b IN 1..ward_rec.beds_per_room LOOP
          INSERT INTO hmis_beds (room_id, bed_number, status) VALUES (r_id, ward_rec.name || '-' || r || chr(64+b), 'available');
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Wards/Rooms/Beds created';
END $$;

-- ═══ 50 DOCTORS ═══
DO $$
DECLARE
  shilaj uuid := 'c0000001-0000-0000-0000-000000000001';
  doc_names text[] := ARRAY[
    'Dr. Sunil Gurmukhani','Dr. Jignesh Patel','Dr. Amit Patanvadiya','Dr. Karmay Shah','Dr. Nidhi Shukla',
    'Dr. Rajesh Mehta','Dr. Priya Sharma','Dr. Anil Desai','Dr. Neha Trivedi','Dr. Vikram Singh',
    'Dr. Anjali Joshi','Dr. Sanjay Gupta','Dr. Meera Patel','Dr. Rohit Bhatt','Dr. Kavita Rao',
    'Dr. Deepak Kumar','Dr. Pooja Thakkar','Dr. Hemant Shah','Dr. Swati Pandey','Dr. Manoj Verma',
    'Dr. Ritu Agarwal','Dr. Ashok Parikh','Dr. Divya Nair','Dr. Prakash Jain','Dr. Shilpa Deshmukh',
    'Dr. Ramesh Iyer','Dr. Tanya Bhatia','Dr. Girish Kulkarni','Dr. Sneha Patel','Dr. Vivek Chauhan',
    'Dr. Aparna Reddy','Dr. Nikhil Saxena','Dr. Pallavi Mishra','Dr. Yash Raval','Dr. Komal Bhagat',
    'Dr. Siddharth Oza','Dr. Hetal Modi','Dr. Pankaj Soni','Dr. Urvi Dave','Dr. Chirag Rathod',
    'Dr. Mitali Vyas','Dr. Jayesh Contractor','Dr. Bhavna Doshi','Dr. Tushar Barot','Dr. Isha Kapoor',
    'Dr. Gaurav Thaker','Dr. Riddhi Solanki','Dr. Manish Kanani','Dr. Falguni Majmudar','Dr. Karan Amin'
  ];
  specs text[] := ARRAY[
    'Cardiology','Cardiology','Orthopaedics','Neurology','General Medicine',
    'General Surgery','Obstetrics & Gynaecology','ENT','Ophthalmology','Urology',
    'Dermatology','Gastroenterology','Paediatrics','Pulmonology','Nephrology',
    'Oncology','CVTS','Anaesthesia','Critical Care (ICU)','Emergency Medicine',
    'General Medicine','Cardiology','Neurology','Orthopaedics','General Surgery',
    'Paediatrics','Ophthalmology','ENT','Dermatology','Urology',
    'Gastroenterology','Pulmonology','Nephrology','Oncology','Radiology',
    'Pathology','Anaesthesia','General Medicine','General Surgery','Orthopaedics',
    'Cardiology','Neurology','Paediatrics','Critical Care (ICU)','Obstetrics & Gynaecology',
    'Plastic Surgery','Physiotherapy','Dialysis','Emergency Medicine','General Medicine'
  ];
  centres uuid[] := ARRAY[
    'c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000002',
    'c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003',
    'c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004',
    'c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004',
    'c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005',
    'c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005'
  ];
  doc_id uuid; dept_id uuid; i int;
BEGIN
  FOR i IN 1..50 LOOP
    INSERT INTO hmis_staff (employee_code, full_name, designation, staff_type, specialisation, primary_centre_id, is_active)
    VALUES ('H1-DOC-' || lpad(i::text, 3, '0'), doc_names[i], 'Consultant', 'doctor', specs[i], centres[i], true)
    RETURNING id INTO doc_id;
    -- Link to centre with doctor role
    INSERT INTO hmis_staff_centres (staff_id, centre_id, role_id) VALUES (doc_id, centres[i], 'a0000001-0000-0000-0000-000000000003') ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE '50 doctors created';
END $$;

-- ═══ 50 OTHER STAFF (nurses, lab techs, pharmacists, receptionists) ═══
DO $$
DECLARE
  staff_data text[] := ARRAY[
    'Priya Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Meena Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Sunita Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Kavita Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Rashmi Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Geeta Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Asha Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Lata Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Hema Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Jaya Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Rekha Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Swati Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Nandini Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Kiran Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Sonal Nurse,nurse,Nursing,a0000001-0000-0000-0000-000000000004',
    'Amit Lab Tech,lab_tech,Pathology,a0000001-0000-0000-0000-000000000006',
    'Vishal Lab Tech,lab_tech,Pathology,a0000001-0000-0000-0000-000000000006',
    'Paresh Lab Tech,lab_tech,Pathology,a0000001-0000-0000-0000-000000000006',
    'Dipti Lab Tech,lab_tech,Pathology,a0000001-0000-0000-0000-000000000006',
    'Rakesh Lab Tech,lab_tech,Microbiology,a0000001-0000-0000-0000-000000000006',
    'Mayank Lab Tech,lab_tech,Pathology,a0000001-0000-0000-0000-000000000006',
    'Darshan Lab Tech,lab_tech,Pathology,a0000001-0000-0000-0000-000000000006',
    'Nikita Lab Tech,lab_tech,Microbiology,a0000001-0000-0000-0000-000000000006',
    'Suresh Pharmacist,pharmacist,Pharmacy,a0000001-0000-0000-0000-000000000005',
    'Jatin Pharmacist,pharmacist,Pharmacy,a0000001-0000-0000-0000-000000000005',
    'Hiral Pharmacist,pharmacist,Pharmacy,a0000001-0000-0000-0000-000000000005',
    'Minal Pharmacist,pharmacist,Pharmacy,a0000001-0000-0000-0000-000000000005',
    'Bhavesh Pharmacist,pharmacist,Pharmacy,a0000001-0000-0000-0000-000000000005',
    'Pooja Pharmacist,pharmacist,Pharmacy,a0000001-0000-0000-0000-000000000005',
    'Rita Pharmacist,pharmacist,Pharmacy,a0000001-0000-0000-0000-000000000005',
    'Neha Receptionist,receptionist,Administration,a0000001-0000-0000-0000-000000000007',
    'Krupa Receptionist,receptionist,Administration,a0000001-0000-0000-0000-000000000007',
    'Disha Receptionist,receptionist,Administration,a0000001-0000-0000-0000-000000000007',
    'Mansi Receptionist,receptionist,Administration,a0000001-0000-0000-0000-000000000007',
    'Ravi Receptionist,receptionist,Administration,a0000001-0000-0000-0000-000000000007',
    'Yogesh Accountant,accountant,Finance,a0000001-0000-0000-0000-000000000008',
    'Sagar Accountant,accountant,Finance,a0000001-0000-0000-0000-000000000008',
    'Divya Accountant,accountant,Finance,a0000001-0000-0000-0000-000000000008',
    'Kishan Rad Tech,technician,Radiology,a0000001-0000-0000-0000-000000000006',
    'Mahesh Rad Tech,technician,Radiology,a0000001-0000-0000-0000-000000000006',
    'Binal OT Tech,technician,OT,a0000001-0000-0000-0000-000000000006',
    'Tarun OT Tech,technician,OT,a0000001-0000-0000-0000-000000000006',
    'Heena CSSD,technician,CSSD,a0000001-0000-0000-0000-000000000006',
    'Ankita Dietician,dietician,Kitchen,a0000001-0000-0000-0000-000000000004',
    'Parul Physio,physiotherapist,Physiotherapy,a0000001-0000-0000-0000-000000000004',
    'Chirag IT,admin,IT,a0000001-0000-0000-0000-000000000002',
    'Hardik Maintenance,admin,Maintenance,a0000001-0000-0000-0000-000000000002',
    'Bharat Security,admin,Administration,a0000001-0000-0000-0000-000000000002',
    'Sarita HR,admin,HR,a0000001-0000-0000-0000-000000000002',
    'Deepa Quality,admin,Administration,a0000001-0000-0000-0000-000000000002'
  ];
  parts text[]; sid uuid; i int;
BEGIN
  FOR i IN 1..50 LOOP
    parts := string_to_array(staff_data[i], ',');
    INSERT INTO hmis_staff (employee_code, full_name, designation, staff_type, primary_centre_id, is_active)
    VALUES ('H1-STF-' || lpad(i::text, 3, '0'), parts[1], parts[3], parts[2], 'c0000001-0000-0000-0000-000000000001', true)
    RETURNING id INTO sid;
    INSERT INTO hmis_staff_centres (staff_id, centre_id, role_id) VALUES (sid, 'c0000001-0000-0000-0000-000000000001', parts[4]::uuid) ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE '50 staff created';
END $$;

-- ═══ 500 PATIENTS ═══
DO $$
DECLARE
  first_m text[] := ARRAY['Ramesh','Suresh','Mahesh','Dinesh','Rakesh','Jayesh','Kamlesh','Naresh','Hitesh','Paresh','Bhavesh','Jignesh','Ketan','Pravin','Sanjay','Vijay','Ajay','Nirav','Chirag','Yash','Hardik','Dhruv','Arjun','Rohan','Vivek'];
  first_f text[] := ARRAY['Priya','Meena','Sunita','Kavita','Reshma','Hetal','Jyoti','Nisha','Komal','Dipti','Swati','Pooja','Neha','Riya','Asha','Geeta','Mala','Sonal','Disha','Krupa','Riddhi','Tanvi','Shreya','Divya','Anita'];
  last_n text[] := ARRAY['Patel','Shah','Mehta','Desai','Joshi','Trivedi','Bhatt','Raval','Parikh','Thakkar','Pandya','Soni','Amin','Modi','Vyas','Dave','Chauhan','Solanki','Rathod','Barot','Kulkarni','Reddy','Iyer','Nair','Singh'];
  cities text[] := ARRAY['Ahmedabad','Gandhinagar','Vadodara','Surat','Rajkot','Modasa','Udaipur','Mehsana','Anand','Bhavnagar'];
  bgroups text[] := ARRAY['A+','A-','B+','B-','O+','O-','AB+','AB-'];
  centres uuid[] := ARRAY['c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000005'];
  i int; g text; fn text; ln text; age int; cid uuid;
BEGIN
  FOR i IN 1..500 LOOP
    g := CASE WHEN random() < 0.5 THEN 'male' ELSE 'female' END;
    fn := CASE WHEN g = 'male' THEN first_m[1 + (random()*24)::int] ELSE first_f[1 + (random()*24)::int] END;
    ln := last_n[1 + (random()*24)::int];
    age := 5 + (random() * 80)::int;
    cid := centres[1 + (random()*4)::int];
    INSERT INTO hmis_patients (uhid, registration_centre_id, first_name, last_name, date_of_birth, age_years, gender, blood_group, phone_primary, address_line1, city, state, is_active)
    VALUES (
      'H1-' || lpad(i::text, 6, '0'),
      cid, fn, ln,
      CURRENT_DATE - (age * 365 + (random()*365)::int) * interval '1 day',
      age, g, bgroups[1 + (random()*7)::int],
      '9' || lpad((floor(random()*900000000) + 100000000)::bigint::text, 9, '0'),
      (floor(random()*999)+1)::text || ', ' || cities[1+(random()*9)::int],
      cities[1+(random()*9)::int], 'Gujarat', true
    );
  END LOOP;
  RAISE NOTICE '500 patients created';
END $$;

-- ═══ 100 ACTIVE ADMISSIONS (20 per centre) + 150 DISCHARGED ═══
DO $$
DECLARE
  centres uuid[] := ARRAY['c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000005'];
  payors text[] := ARRAY['self','self','self','insurance','insurance','govt_pmjay','corporate'];
  adm_types text[] := ARRAY['elective','elective','emergency','daycare'];
  diagnoses text[] := ARRAY['Acute MI','Chest Pain','Fracture Femur','Pneumonia','COPD Exacerbation','Acute Appendicitis','Cholecystitis','Diabetic Ketoacidosis','Stroke','Renal Calculus','Dengue Fever','Cellulitis','Heart Failure','GI Bleed','Pancreatitis','Hip Fracture','Intestinal Obstruction','Sepsis','Liver Abscess','Hernia'];
  cid uuid; pid uuid; did uuid; dept_id uuid; bed_id uuid; adm_id uuid;
  adm_date timestamptz; adm_no int := 0; i int; j int;
BEGIN
  FOR j IN 1..5 LOOP
    cid := centres[j];
    -- ACTIVE admissions (20 per centre)
    FOR i IN 1..20 LOOP
      adm_no := adm_no + 1;
      -- Pick random patient from this centre
      SELECT id INTO pid FROM hmis_patients WHERE registration_centre_id = cid ORDER BY random() LIMIT 1;
      IF pid IS NULL THEN SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1; END IF;
      -- Pick random doctor from this centre
      SELECT s.id INTO did FROM hmis_staff s JOIN hmis_staff_centres sc ON sc.staff_id = s.id WHERE sc.centre_id = cid AND s.staff_type = 'doctor' ORDER BY random() LIMIT 1;
      IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type = 'doctor' ORDER BY random() LIMIT 1; END IF;
      -- Pick department
      SELECT id INTO dept_id FROM hmis_departments WHERE centre_id = cid ORDER BY random() LIMIT 1;
      IF dept_id IS NULL THEN SELECT id INTO dept_id FROM hmis_departments ORDER BY random() LIMIT 1; END IF;
      -- Pick available bed
      SELECT b.id INTO bed_id FROM hmis_beds b JOIN hmis_rooms r ON r.id = b.room_id JOIN hmis_wards w ON w.id = r.ward_id WHERE w.centre_id = cid AND b.status = 'available' ORDER BY random() LIMIT 1;
      adm_date := now() - (random() * 7 + 1) * interval '1 day';

      INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, bed_id, admission_type, admission_date, payor_type, provisional_diagnosis, status)
      VALUES (cid, pid, 'IPD-' || lpad(adm_no::text, 6, '0'), did, did, dept_id, bed_id, adm_types[1+(random()*3)::int], adm_date, payors[1+(random()*6)::int], diagnoses[1+(random()*19)::int], 'active')
      RETURNING id INTO adm_id;

      -- Mark bed occupied
      IF bed_id IS NOT NULL THEN
        UPDATE hmis_beds SET status = 'occupied', current_admission_id = adm_id WHERE id = bed_id;
      END IF;

      -- Vitals (2-3 per admission)
      FOR b IN 1..2+(random()*2)::int LOOP
        INSERT INTO hmis_vitals (patient_id, encounter_type, encounter_id, admission_id, temperature, pulse, bp_systolic, bp_diastolic, resp_rate, spo2, recorded_by, recorded_at, centre_id)
        VALUES (pid, 'ipd', adm_id, adm_id, 97.5 + random()*3, 60 + (random()*40)::int, 100 + (random()*60)::int, 60 + (random()*30)::int, 14 + (random()*8)::int, 94 + random()*6, did, adm_date + b * interval '8 hours', cid);
      END LOOP;

      -- Charge log (room + nursing + consultation)
      INSERT INTO hmis_charge_log (centre_id, patient_id, admission_id, description, category, quantity, unit_rate, amount, source, status, service_date)
      VALUES
        (cid, pid, adm_id, 'Room Charges', 'room', EXTRACT(DAY FROM now() - adm_date) + 1, 1500, (EXTRACT(DAY FROM now() - adm_date) + 1) * 1500, 'auto_daily', 'pending', CURRENT_DATE),
        (cid, pid, adm_id, 'Nursing Charges', 'nursing', EXTRACT(DAY FROM now() - adm_date) + 1, 500, (EXTRACT(DAY FROM now() - adm_date) + 1) * 500, 'auto_daily', 'pending', CURRENT_DATE),
        (cid, pid, adm_id, 'Consultation', 'consultation', 1, 1000, 1000, 'manual', 'pending', adm_date::date);
    END LOOP;

    -- DISCHARGED admissions (30 per centre, last 3 months)
    FOR i IN 1..30 LOOP
      adm_no := adm_no + 1;
      SELECT id INTO pid FROM hmis_patients WHERE registration_centre_id = cid ORDER BY random() LIMIT 1;
      IF pid IS NULL THEN SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1; END IF;
      SELECT s.id INTO did FROM hmis_staff s JOIN hmis_staff_centres sc ON sc.staff_id = s.id WHERE sc.centre_id = cid AND s.staff_type = 'doctor' ORDER BY random() LIMIT 1;
      IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type = 'doctor' ORDER BY random() LIMIT 1; END IF;
      SELECT id INTO dept_id FROM hmis_departments WHERE centre_id = cid ORDER BY random() LIMIT 1;
      IF dept_id IS NULL THEN SELECT id INTO dept_id FROM hmis_departments ORDER BY random() LIMIT 1; END IF;
      adm_date := now() - (random() * 90 + 7) * interval '1 day';

      INSERT INTO hmis_admissions (centre_id, patient_id, ipd_number, admitting_doctor_id, primary_doctor_id, department_id, admission_type, admission_date, actual_discharge, discharge_type, payor_type, provisional_diagnosis, status)
      VALUES (cid, pid, 'IPD-' || lpad(adm_no::text, 6, '0'), did, did, dept_id, adm_types[1+(random()*3)::int], adm_date, adm_date + (2 + random()*8) * interval '1 day', 'normal', payors[1+(random()*6)::int], diagnoses[1+(random()*19)::int], 'discharged');
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Admissions created: 100 active + 150 discharged';
END $$;

-- ═══ 250 OPD VISITS (10 today per centre + 200 historical) ═══
DO $$
DECLARE
  centres uuid[] := ARRAY['c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000005'];
  complaints text[] := ARRAY['Fever','Cough','Chest Pain','Headache','Back Pain','Joint Pain','Abdominal Pain','Breathlessness','Dizziness','Skin Rash','Eye Pain','Ear Pain','Sore Throat','Vomiting','Diarrhoea','Diabetes Follow-up','Hypertension Follow-up','Post-op Follow-up','Weakness','Weight Loss'];
  statuses text[] := ARRAY['waiting','with_doctor','completed','completed','completed'];
  cid uuid; pid uuid; did uuid; visit_id uuid;
  vdate timestamptz; vno int := 0; i int; j int;
BEGIN
  FOR j IN 1..5 LOOP
    cid := centres[j];
    -- 10 TODAY per centre
    FOR i IN 1..10 LOOP
      vno := vno + 1;
      SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1;
      SELECT s.id INTO did FROM hmis_staff s JOIN hmis_staff_centres sc ON sc.staff_id = s.id WHERE sc.centre_id = cid AND s.staff_type = 'doctor' ORDER BY random() LIMIT 1;
      IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type = 'doctor' ORDER BY random() LIMIT 1; END IF;
      vdate := CURRENT_DATE + (8 + i * 0.5) * interval '1 hour';

      INSERT INTO hmis_opd_visits (centre_id, patient_id, doctor_id, visit_number, token_number, chief_complaint, status, check_in_time, created_at)
      VALUES (cid, pid, did, 'OPD-' || lpad(vno::text, 8, '0'), i, complaints[1+(random()*19)::int], statuses[1+(random()*4)::int], vdate, vdate)
      RETURNING id INTO visit_id;

      -- EMR encounter for completed visits
      IF random() > 0.3 THEN
        INSERT INTO hmis_emr_encounters (centre_id, patient_id, doctor_id, opd_visit_id, encounter_date, encounter_type, status,
          complaints, diagnoses, prescriptions, vitals)
        VALUES (cid, pid, did, visit_id, CURRENT_DATE, 'opd', 'completed',
          '[{"text":"' || complaints[1+(random()*19)::int] || '"}]',
          '[{"code":"J06.9","label":"Upper respiratory infection"},{"code":"R50.9","label":"Fever unspecified"}]',
          '[{"drug":"Paracetamol 500mg","dose":"1 tab","route":"oral","frequency":"TDS","duration":"5 days"},{"drug":"Azithromycin 500mg","dose":"1 tab","route":"oral","frequency":"OD","duration":"3 days"}]',
          '{"temperature":98.6,"pulse":78,"bp_systolic":124,"bp_diastolic":80,"spo2":98,"weight_kg":' || (50+random()*40)::int || '}');
      END IF;
    END LOOP;

    -- 40 HISTORICAL per centre (last 60 days)
    FOR i IN 1..40 LOOP
      vno := vno + 1;
      SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1;
      SELECT s.id INTO did FROM hmis_staff s JOIN hmis_staff_centres sc ON sc.staff_id = s.id WHERE sc.centre_id = cid AND s.staff_type = 'doctor' ORDER BY random() LIMIT 1;
      IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type = 'doctor' ORDER BY random() LIMIT 1; END IF;
      vdate := now() - (1 + random() * 60) * interval '1 day';

      INSERT INTO hmis_opd_visits (centre_id, patient_id, doctor_id, visit_number, token_number, chief_complaint, status, check_in_time, consultation_start, consultation_end, created_at)
      VALUES (cid, pid, did, 'OPD-' || lpad(vno::text, 8, '0'), (random()*30)::int + 1, complaints[1+(random()*19)::int], 'completed', vdate, vdate + interval '15 minutes', vdate + interval '30 minutes', vdate)
      RETURNING id INTO visit_id;

      -- EMR for all historical
      INSERT INTO hmis_emr_encounters (centre_id, patient_id, doctor_id, opd_visit_id, encounter_date, encounter_type, status,
        complaints, diagnoses, prescriptions, vitals)
      VALUES (cid, pid, did, visit_id, vdate::date, 'opd', 'completed',
        '[{"text":"' || complaints[1+(random()*19)::int] || '"}]',
        '[{"code":"' || CASE WHEN random()>0.5 THEN 'J06.9' ELSE 'I10' END || '","label":"' || CASE WHEN random()>0.5 THEN 'URI' ELSE 'Hypertension' END || '"}]',
        '[{"drug":"' || (ARRAY['Paracetamol 500mg','Amoxicillin 500mg','Omeprazole 20mg','Metformin 500mg','Amlodipine 5mg','Atorvastatin 10mg','Pantoprazole 40mg','Cefixime 200mg'])[1+(random()*7)::int] || '","dose":"1 tab","route":"oral","frequency":"' || (ARRAY['OD','BD','TDS'])[1+(random()*2)::int] || '","duration":"' || (2+random()*12)::int || ' days"}]',
        '{"temperature":' || (97 + random()*3)::numeric(4,1) || ',"pulse":' || (65+random()*30)::int || ',"bp_systolic":' || (110+random()*40)::int || ',"bp_diastolic":' || (65+random()*25)::int || ',"spo2":' || (95+random()*5)::numeric(4,1) || '}');
    END LOOP;
  END LOOP;
  RAISE NOTICE 'OPD visits created: 50 today + 200 historical';
END $$;

-- ═══ BILLING (for all admissions + OPD) ═══
DO $$
DECLARE
  rec RECORD; bill_id uuid; bill_no int := 0; total numeric;
BEGIN
  -- IPD bills for discharged admissions
  FOR rec IN SELECT a.id as adm_id, a.centre_id, a.patient_id, a.payor_type, a.admission_date, a.actual_discharge
    FROM hmis_admissions a WHERE a.status = 'discharged' LOOP
    bill_no := bill_no + 1;
    total := 5000 + (random() * 95000)::numeric(10,2);
    INSERT INTO hmis_bills (centre_id, patient_id, bill_number, bill_type, encounter_id, payor_type, gross_amount, discount_amount, tax_amount, net_amount, paid_amount, balance_amount, status, bill_date)
    VALUES (rec.centre_id, rec.patient_id, 'BILL-' || lpad(bill_no::text, 6, '0'), 'ipd', rec.adm_id, rec.payor_type, total, total*0.05, 0, total*0.95, total*0.95*(0.7+random()*0.3), total*0.95*(random()*0.3), CASE WHEN random()>0.3 THEN 'paid' ELSE 'partial' END, COALESCE(rec.actual_discharge::date, CURRENT_DATE))
    RETURNING id INTO bill_id;
    -- Payment
    INSERT INTO hmis_payments (bill_id, amount, payment_mode, reference_number, received_by, received_at)
    VALUES (bill_id, total*0.95*(0.7+random()*0.3), (ARRAY['cash','card','upi','neft'])[1+(random()*3)::int], 'TXN' || lpad(bill_no::text, 8, '0'), (SELECT id FROM hmis_staff WHERE staff_type = 'receptionist' ORDER BY random() LIMIT 1), rec.actual_discharge);
  END LOOP;

  -- OPD bills
  FOR rec IN SELECT v.id as visit_id, v.centre_id, v.patient_id, v.created_at FROM hmis_opd_visits v WHERE v.status = 'completed' LOOP
    bill_no := bill_no + 1;
    total := 300 + (random() * 2700)::numeric(10,2);
    INSERT INTO hmis_bills (centre_id, patient_id, bill_number, bill_type, encounter_id, payor_type, gross_amount, discount_amount, tax_amount, net_amount, paid_amount, balance_amount, status, bill_date)
    VALUES (rec.centre_id, rec.patient_id, 'BILL-' || lpad(bill_no::text, 6, '0'), 'opd', rec.visit_id, 'self', total, 0, 0, total, total, 0, 'paid', rec.created_at::date)
    RETURNING id INTO bill_id;
    INSERT INTO hmis_payments (bill_id, amount, payment_mode, received_at)
    VALUES (bill_id, total, (ARRAY['cash','card','upi'])[1+(random()*2)::int], rec.created_at);
  END LOOP;
  RAISE NOTICE 'Bills created: %', bill_no;
END $$;

-- ═══ LAB ORDERS ═══
DO $$
DECLARE
  rec RECORD; order_id uuid; lab_id uuid; test_names text[];
  test_name text; i int;
BEGIN
  test_names := ARRAY['CBC','RFT','LFT','Lipid Profile','Blood Sugar Fasting','HbA1c','TSH','Urine Routine','Electrolytes','CRP','PT/INR','Serum Creatinine','Blood Culture','Dengue NS1','Malaria Antigen'];
  -- Lab orders for active admissions
  FOR rec IN SELECT a.id as adm_id, a.centre_id, a.patient_id, a.primary_doctor_id FROM hmis_admissions a WHERE a.status = 'active' LOOP
    FOR i IN 1..2+(random()*3)::int LOOP
      test_name := test_names[1+(random()*14)::int];
      -- Create order
      INSERT INTO hmis_orders (patient_id, encounter_type, encounter_id, order_type, ordered_by, status)
      VALUES (rec.patient_id, 'ipd', rec.adm_id, 'lab', rec.primary_doctor_id, CASE WHEN random()>0.4 THEN 'completed' ELSE 'ordered' END)
      RETURNING id INTO order_id;
      -- Create lab order
      INSERT INTO hmis_lab_orders (order_id, patient_id, test_name, centre_id, status, ordered_by, admission_id, billing_done, created_at)
      VALUES (order_id, rec.patient_id, test_name, rec.centre_id, CASE WHEN random()>0.4 THEN 'completed' ELSE 'ordered' END, rec.primary_doctor_id, rec.adm_id, random()>0.5, now() - random() * interval '5 days');
    END LOOP;
  END LOOP;
  -- Lab for recent OPD
  FOR rec IN SELECT v.id as visit_id, v.centre_id, v.patient_id, v.doctor_id FROM hmis_opd_visits v WHERE v.created_at > now() - interval '30 days' AND random() < 0.3 LIMIT 80 LOOP
    test_name := test_names[1+(random()*14)::int];
    INSERT INTO hmis_orders (patient_id, encounter_type, encounter_id, order_type, ordered_by, status)
    VALUES (rec.patient_id, 'opd', rec.visit_id, 'lab', rec.doctor_id, 'completed')
    RETURNING id INTO order_id;
    INSERT INTO hmis_lab_orders (order_id, patient_id, test_name, centre_id, status, ordered_by, billing_done, created_at)
    VALUES (order_id, rec.patient_id, test_name, rec.centre_id, 'completed', rec.doctor_id, true, now() - random() * interval '30 days');
  END LOOP;
  RAISE NOTICE 'Lab orders created';
END $$;

-- ═══ RADIOLOGY ORDERS ═══
DO $$
DECLARE
  rec RECORD; order_id uuid;
  studies text[] := ARRAY['X-Ray Chest PA','X-Ray KUB','CT Brain Plain','CT Chest HRCT','MRI Brain','MRI Spine','USG Abdomen','Echo 2D','X-Ray Spine','CT Abdomen'];
  study text;
BEGIN
  FOR rec IN SELECT a.id as adm_id, a.centre_id, a.patient_id, a.primary_doctor_id FROM hmis_admissions a WHERE random() < 0.6 LIMIT 80 LOOP
    study := studies[1+(random()*9)::int];
    INSERT INTO hmis_orders (patient_id, encounter_type, encounter_id, order_type, ordered_by, status)
    VALUES (rec.patient_id, 'ipd', rec.adm_id, 'radiology', rec.primary_doctor_id, CASE WHEN random()>0.3 THEN 'completed' ELSE 'ordered' END)
    RETURNING id INTO order_id;
    INSERT INTO hmis_radiology_orders (order_id, patient_id, study_description, centre_id, status, ordered_by, created_at)
    VALUES (order_id, rec.patient_id, study, rec.centre_id, CASE WHEN random()>0.3 THEN 'completed' ELSE 'ordered' END, rec.primary_doctor_id, now() - random() * interval '7 days');
  END LOOP;
  RAISE NOTICE 'Radiology orders created';
END $$;

-- ═══ PHARMACY DISPENSING ═══
DO $$
DECLARE
  rec RECORD;
  drugs text[] := ARRAY['Paracetamol 500mg','Amoxicillin 500mg','Omeprazole 20mg','Metformin 500mg','Amlodipine 5mg','Atorvastatin 10mg','Pantoprazole 40mg','Cefixime 200mg','Azithromycin 500mg','Ciprofloxacin 500mg','Metoprolol 25mg','Losartan 50mg','Insulin Glargine','Enoxaparin 40mg','Clopidogrel 75mg'];
BEGIN
  -- Dispensing for OPD visits
  FOR rec IN SELECT v.id, v.centre_id, v.patient_id, v.created_at FROM hmis_opd_visits v WHERE v.status = 'completed' AND random() < 0.5 LIMIT 100 LOOP
    INSERT INTO hmis_pharmacy_dispensing (centre_id, patient_id, encounter_id, prescription_data, status, total_amount, dispensed_at, created_at, billing_done)
    VALUES (rec.centre_id, rec.patient_id, rec.id,
      '[{"drug":"' || drugs[1+(random()*14)::int] || '","qty":' || (10+random()*20)::int || ',"rate":' || (5+random()*50)::int || '}]',
      'dispensed', 100 + (random()*900)::numeric(10,2), rec.created_at, rec.created_at, true);
  END LOOP;
  -- Dispensing for IPD
  FOR rec IN SELECT a.id, a.centre_id, a.patient_id, a.admission_date FROM hmis_admissions a WHERE random() < 0.7 LIMIT 120 LOOP
    INSERT INTO hmis_pharmacy_dispensing (centre_id, patient_id, admission_id, prescription_data, status, total_amount, dispensed_at, created_at, billing_done)
    VALUES (rec.centre_id, rec.patient_id, rec.id,
      '[{"drug":"' || drugs[1+(random()*14)::int] || '","qty":' || (5+random()*30)::int || ',"rate":' || (10+random()*100)::int || '},{"drug":"' || drugs[1+(random()*14)::int] || '","qty":' || (5+random()*15)::int || ',"rate":' || (5+random()*50)::int || '}]',
      'dispensed', 200 + (random()*2000)::numeric(10,2), rec.admission_date + random() * interval '3 days', rec.admission_date, true);
  END LOOP;
  RAISE NOTICE 'Pharmacy dispensing created';
END $$;

-- ═══ ER VISITS (today) ═══
DO $$
DECLARE
  cid uuid; pid uuid; did uuid;
  triages text[] := ARRAY['red','orange','yellow','yellow','green','green','green'];
  complaints text[] := ARRAY['Chest Pain','RTA','Fall from height','Breathing difficulty','Seizure','Snake bite','Burns','Poisoning','Assault','High fever'];
BEGIN
  cid := 'c0000001-0000-0000-0000-000000000001';
  FOR i IN 1..5 LOOP
    SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1;
    SELECT s.id INTO did FROM hmis_staff s WHERE s.staff_type = 'doctor' AND s.specialisation = 'Emergency Medicine' ORDER BY random() LIMIT 1;
    IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type = 'doctor' ORDER BY random() LIMIT 1; END IF;
    INSERT INTO hmis_er_visits (centre_id, patient_id, arrival_mode, arrival_time, triage_category, chief_complaint, attending_doctor_id, status)
    VALUES (cid, pid, (ARRAY['walk_in','ambulance','referred'])[1+(random()*2)::int], now() - (random()*8) * interval '1 hour', triages[1+(random()*6)::int], complaints[1+(random()*9)::int], did, (ARRAY['triaged','being_seen','under_observation'])[1+(random()*2)::int]);
  END LOOP;
  RAISE NOTICE 'ER visits created';
END $$;

-- ═══ DONE ═══
SELECT 'SEED COMPLETE' AS status,
  (SELECT count(*) FROM hmis_centres) AS centres,
  (SELECT count(*) FROM hmis_departments) AS departments,
  (SELECT count(*) FROM hmis_staff WHERE staff_type='doctor') AS doctors,
  (SELECT count(*) FROM hmis_staff WHERE staff_type!='doctor' AND staff_type!='admin') AS other_staff,
  (SELECT count(*) FROM hmis_patients) AS patients,
  (SELECT count(*) FROM hmis_admissions WHERE status='active') AS active_admissions,
  (SELECT count(*) FROM hmis_admissions WHERE status='discharged') AS discharged,
  (SELECT count(*) FROM hmis_opd_visits) AS opd_visits,
  (SELECT count(*) FROM hmis_bills) AS bills,
  (SELECT count(*) FROM hmis_lab_orders) AS lab_orders,
  (SELECT count(*) FROM hmis_emr_encounters) AS emr_encounters,
  (SELECT count(*) FROM hmis_beds) AS beds;
