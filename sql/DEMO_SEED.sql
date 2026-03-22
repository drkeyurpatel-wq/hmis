-- ════════════════════════════════════════════════════════════════
-- Health1 HMIS — FULL DEMO SEED (v2 — schema-verified)
-- Run AFTER REBUILD_FULL.sql + SEED_DATA.sql
-- ════════════════════════════════════════════════════════════════

-- ═══ LAB TEST MASTER (10 common tests) ═══
INSERT INTO hmis_lab_test_master (id, test_code, test_name, category, sample_type) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'CBC', 'Complete Blood Count', 'Haematology', 'blood'),
  ('d0000001-0000-0000-0000-000000000002', 'RFT', 'Renal Function Test', 'Biochemistry', 'blood'),
  ('d0000001-0000-0000-0000-000000000003', 'LFT', 'Liver Function Test', 'Biochemistry', 'blood'),
  ('d0000001-0000-0000-0000-000000000004', 'LIPID', 'Lipid Profile', 'Biochemistry', 'blood'),
  ('d0000001-0000-0000-0000-000000000005', 'FBS', 'Fasting Blood Sugar', 'Biochemistry', 'blood'),
  ('d0000001-0000-0000-0000-000000000006', 'TSH', 'Thyroid Stimulating Hormone', 'Immunology', 'blood'),
  ('d0000001-0000-0000-0000-000000000007', 'HBA1C', 'Glycosylated Haemoglobin', 'Biochemistry', 'blood'),
  ('d0000001-0000-0000-0000-000000000008', 'URINE_RM', 'Urine Routine Microscopy', 'Clinical Pathology', 'urine'),
  ('d0000001-0000-0000-0000-000000000009', 'CRP', 'C-Reactive Protein', 'Immunology', 'blood'),
  ('d0000001-0000-0000-0000-000000000010', 'PT_INR', 'PT/INR', 'Haematology', 'blood')
ON CONFLICT (test_code) DO NOTHING;

-- ═══ RADIOLOGY TEST MASTER (8 studies) ═══
INSERT INTO hmis_radiology_test_master (id, test_code, test_name, modality, body_part) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'XRAY_CHEST', 'X-Ray Chest PA', 'xray', 'chest'),
  ('e0000001-0000-0000-0000-000000000002', 'CT_BRAIN', 'CT Brain Plain', 'ct', 'head'),
  ('e0000001-0000-0000-0000-000000000003', 'MRI_BRAIN', 'MRI Brain', 'mri', 'head'),
  ('e0000001-0000-0000-0000-000000000004', 'USG_ABD', 'USG Abdomen', 'usg', 'abdomen'),
  ('e0000001-0000-0000-0000-000000000005', 'ECHO', 'Echo 2D', 'usg', 'chest'),
  ('e0000001-0000-0000-0000-000000000006', 'CT_CHEST', 'CT Chest HRCT', 'ct', 'chest'),
  ('e0000001-0000-0000-0000-000000000007', 'XRAY_KUB', 'X-Ray KUB', 'xray', 'abdomen'),
  ('e0000001-0000-0000-0000-000000000008', 'MRI_SPINE', 'MRI Spine', 'mri', 'spine')
ON CONFLICT (test_code) DO NOTHING;

-- ═══ WARDS + ROOMS + BEDS ═══
DO $$
DECLARE
  shilaj uuid := 'c0000001-0000-0000-0000-000000000001';
  other_centres uuid[] := ARRAY['c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000005'];
  w_id uuid; r_id uuid; cid uuid;
  wname text; wtype text; wfloor text; wrooms int; wbeds int; wrate int;
BEGIN
  -- Shilaj wards
  FOR wname, wtype, wfloor, wrooms, wbeds, wrate IN (VALUES
    ('General Ward A','general','2',4,6,1500),('General Ward B','general','2',4,6,1500),
    ('Semi-Private','semi_private','3',5,2,3000),('Private Wing','private','4',5,1,6000),
    ('ICU','icu','1',3,3,12000),('Transplant ICU','transplant_icu','1',1,5,15000),
    ('NICU','nicu','1',1,4,10000),('Isolation','isolation','1',1,3,4000)
  ) LOOP
    INSERT INTO hmis_wards (centre_id,name,type,floor) VALUES (shilaj,wname,wtype,wfloor) RETURNING id INTO w_id;
    FOR r IN 1..wrooms LOOP
      INSERT INTO hmis_rooms (ward_id,room_number,room_type,daily_rate) VALUES (w_id,wfloor||lpad(r::text,2,'0'),wtype,wrate) RETURNING id INTO r_id;
      FOR b IN 1..wbeds LOOP
        INSERT INTO hmis_beds (room_id,bed_number,status) VALUES (r_id,wfloor||lpad(r::text,2,'0')||chr(64+b),'available');
      END LOOP;
    END LOOP;
  END LOOP;

  -- Other centres: simple setup
  FOREACH cid IN ARRAY other_centres LOOP
    FOR wname, wtype, wfloor, wrooms, wbeds, wrate IN (VALUES ('General','general','1',3,6,1200),('ICU','icu','1',1,4,8000),('Private','private','2',2,2,4000)) LOOP
      INSERT INTO hmis_wards (centre_id,name,type,floor) VALUES (cid,wname,wtype,wfloor) RETURNING id INTO w_id;
      FOR r IN 1..wrooms LOOP
        INSERT INTO hmis_rooms (ward_id,room_number,room_type,daily_rate) VALUES (w_id,wfloor||lpad(r::text,2,'0'),wtype,wrate) RETURNING id INTO r_id;
        FOR b IN 1..wbeds LOOP
          INSERT INTO hmis_beds (room_id,bed_number,status) VALUES (r_id,wfloor||lpad(r::text,2,'0')||chr(64+b),'available');
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ═══ 50 DOCTORS ═══
DO $$
DECLARE
  doc_names text[] := ARRAY['Dr. Sunil Gurmukhani','Dr. Jignesh Patel','Dr. Amit Patanvadiya','Dr. Karmay Shah','Dr. Nidhi Shukla','Dr. Rajesh Mehta','Dr. Priya Sharma','Dr. Anil Desai','Dr. Neha Trivedi','Dr. Vikram Singh','Dr. Anjali Joshi','Dr. Sanjay Gupta','Dr. Meera Patel','Dr. Rohit Bhatt','Dr. Kavita Rao','Dr. Deepak Kumar','Dr. Pooja Thakkar','Dr. Hemant Shah','Dr. Swati Pandey','Dr. Manoj Verma','Dr. Ritu Agarwal','Dr. Ashok Parikh','Dr. Divya Nair','Dr. Prakash Jain','Dr. Shilpa Deshmukh','Dr. Ramesh Iyer','Dr. Tanya Bhatia','Dr. Girish Kulkarni','Dr. Sneha Patel','Dr. Vivek Chauhan','Dr. Aparna Reddy','Dr. Nikhil Saxena','Dr. Pallavi Mishra','Dr. Yash Raval','Dr. Komal Bhagat','Dr. Siddharth Oza','Dr. Hetal Modi','Dr. Pankaj Soni','Dr. Urvi Dave','Dr. Chirag Rathod','Dr. Mitali Vyas','Dr. Jayesh Contractor','Dr. Bhavna Doshi','Dr. Tushar Barot','Dr. Isha Kapoor','Dr. Gaurav Thaker','Dr. Riddhi Solanki','Dr. Manish Kanani','Dr. Falguni Majmudar','Dr. Karan Amin'];
  specs text[] := ARRAY['Cardiology','Cardiology','Orthopaedics','Neurology','General Medicine','General Surgery','Obstetrics & Gynaecology','ENT','Ophthalmology','Urology','Dermatology','Gastroenterology','Paediatrics','Pulmonology','Nephrology','Oncology','CVTS','Anaesthesia','Critical Care (ICU)','Emergency Medicine','General Medicine','Cardiology','Neurology','Orthopaedics','General Surgery','Paediatrics','Ophthalmology','ENT','Dermatology','Urology','Gastroenterology','Pulmonology','Nephrology','Oncology','Radiology','Pathology','Anaesthesia','General Medicine','General Surgery','Orthopaedics','Cardiology','Neurology','Paediatrics','Critical Care (ICU)','Obstetrics & Gynaecology','Plastic Surgery','Physiotherapy','General Medicine','Emergency Medicine','General Medicine'];
  c_ids uuid[] := ARRAY['c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005'];
  did uuid; i int;
BEGIN
  FOR i IN 1..50 LOOP
    INSERT INTO hmis_staff (employee_code,full_name,designation,staff_type,specialisation,primary_centre_id,is_active)
    VALUES ('H1-DOC-'||lpad(i::text,3,'0'), doc_names[i], 'Consultant', 'doctor', specs[i], c_ids[i], true)
    RETURNING id INTO did;
    INSERT INTO hmis_staff_centres (staff_id,centre_id,role_id) VALUES (did, c_ids[i], 'a0000001-0000-0000-0000-000000000003') ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ═══ 50 OTHER STAFF ═══
DO $$
DECLARE
  names text[] := ARRAY['Priya Nurse','Meena Nurse','Sunita Nurse','Kavita Nurse','Rashmi Nurse','Geeta Nurse','Asha Nurse','Lata Nurse','Hema Nurse','Jaya Nurse','Rekha Nurse','Swati Nurse','Nandini Nurse','Kiran Nurse','Sonal Nurse','Amit LabTech','Vishal LabTech','Paresh LabTech','Dipti LabTech','Rakesh LabTech','Mayank LabTech','Darshan LabTech','Nikita LabTech','Suresh Pharma','Jatin Pharma','Hiral Pharma','Minal Pharma','Bhavesh Pharma','Pooja Pharma','Rita Pharma','Neha Reception','Krupa Reception','Disha Reception','Mansi Reception','Ravi Reception','Yogesh Accounts','Sagar Accounts','Divya Accounts','Kishan RadTech','Mahesh RadTech','Binal OTTech','Tarun OTTech','Heena CSSD','Ankita Diet','Parul Physio','Chirag IT','Hardik Maint','Bharat Security','Sarita HR','Deepa Quality'];
  types text[] := ARRAY['nurse','nurse','nurse','nurse','nurse','nurse','nurse','nurse','nurse','nurse','nurse','nurse','nurse','nurse','nurse','lab_tech','lab_tech','lab_tech','lab_tech','lab_tech','lab_tech','lab_tech','lab_tech','pharmacist','pharmacist','pharmacist','pharmacist','pharmacist','pharmacist','pharmacist','receptionist','receptionist','receptionist','receptionist','receptionist','accountant','accountant','accountant','technician','technician','technician','technician','technician','technician','technician','admin','admin','admin','admin','admin'];
  roles uuid[] := ARRAY['a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000008','a0000001-0000-0000-0000-000000000008','a0000001-0000-0000-0000-000000000008','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000002','a0000001-0000-0000-0000-000000000002','a0000001-0000-0000-0000-000000000002','a0000001-0000-0000-0000-000000000002','a0000001-0000-0000-0000-000000000002'];
  sid uuid; i int;
BEGIN
  FOR i IN 1..50 LOOP
    INSERT INTO hmis_staff (employee_code,full_name,designation,staff_type,primary_centre_id,is_active)
    VALUES ('H1-STF-'||lpad(i::text,3,'0'), names[i], types[i], types[i], 'c0000001-0000-0000-0000-000000000001', true)
    RETURNING id INTO sid;
    INSERT INTO hmis_staff_centres (staff_id,centre_id,role_id) VALUES (sid,'c0000001-0000-0000-0000-000000000001',roles[i]) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ═══ 500 PATIENTS ═══
DO $$
DECLARE
  fm text[] := ARRAY['Ramesh','Suresh','Mahesh','Dinesh','Rakesh','Jayesh','Kamlesh','Naresh','Hitesh','Paresh','Bhavesh','Jignesh','Ketan','Pravin','Sanjay','Vijay','Ajay','Nirav','Chirag','Yash','Hardik','Dhruv','Arjun','Rohan','Vivek'];
  ff text[] := ARRAY['Priya','Meena','Sunita','Kavita','Reshma','Hetal','Jyoti','Nisha','Komal','Dipti','Swati','Pooja','Neha','Riya','Asha','Geeta','Mala','Sonal','Disha','Krupa','Riddhi','Tanvi','Shreya','Divya','Anita'];
  ln text[] := ARRAY['Patel','Shah','Mehta','Desai','Joshi','Trivedi','Bhatt','Raval','Parikh','Thakkar','Pandya','Soni','Amin','Modi','Vyas','Dave','Chauhan','Solanki','Rathod','Barot','Kulkarni','Reddy','Iyer','Nair','Singh'];
  bg text[] := ARRAY['A+','A-','B+','B-','O+','O-','AB+','AB-'];
  cids uuid[] := ARRAY['c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000005'];
  g text; fn text; i int; age int;
BEGIN
  FOR i IN 1..500 LOOP
    g := CASE WHEN random()<0.5 THEN 'male' ELSE 'female' END;
    fn := CASE WHEN g='male' THEN fm[1+(random()*24)::int] ELSE ff[1+(random()*24)::int] END;
    age := 5+(random()*80)::int;
    INSERT INTO hmis_patients (uhid,registration_centre_id,first_name,last_name,date_of_birth,age_years,gender,blood_group,phone_primary,city,state,is_active)
    VALUES ('H1-'||lpad(i::text,6,'0'), cids[1+(random()*4)::int], fn, ln[1+(random()*24)::int],
      CURRENT_DATE - (age*365+(random()*365)::int)*interval '1 day', age, g, bg[1+(random()*7)::int],
      '9'||lpad((floor(random()*900000000)+100000000)::bigint::text,9,'0'), 'Ahmedabad', 'Gujarat', true);
  END LOOP;
END $$;

-- ═══ ADMISSIONS: 100 active + 150 discharged ═══
DO $$
DECLARE
  cids uuid[] := ARRAY['c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000005'];
  payors text[] := ARRAY['self','self','self','insurance','insurance','govt_pmjay','corporate'];
  atypes text[] := ARRAY['elective','elective','emergency','daycare'];
  dx text[] := ARRAY['Acute MI','Chest Pain','Fracture Femur','Pneumonia','COPD','Appendicitis','Cholecystitis','DKA','Stroke','Renal Calculus','Dengue','Cellulitis','Heart Failure','GI Bleed','Pancreatitis','Hip Fracture','Obstruction','Sepsis','Liver Abscess','Hernia'];
  cid uuid; pid uuid; did uuid; dep uuid; bed uuid; aid uuid;
  adt timestamptz; ano int:=0; i int; j int;
BEGIN
  FOR j IN 1..5 LOOP
    cid := cids[j];
    -- 20 ACTIVE per centre
    FOR i IN 1..20 LOOP
      ano:=ano+1;
      SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1;
      SELECT s.id INTO did FROM hmis_staff s JOIN hmis_staff_centres sc ON sc.staff_id=s.id WHERE sc.centre_id=cid AND s.staff_type='doctor' ORDER BY random() LIMIT 1;
      IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type='doctor' ORDER BY random() LIMIT 1; END IF;
      SELECT id INTO dep FROM hmis_departments WHERE centre_id=cid ORDER BY random() LIMIT 1;
      IF dep IS NULL THEN SELECT id INTO dep FROM hmis_departments ORDER BY random() LIMIT 1; END IF;
      SELECT b.id INTO bed FROM hmis_beds b JOIN hmis_rooms r ON r.id=b.room_id JOIN hmis_wards w ON w.id=r.ward_id WHERE w.centre_id=cid AND b.status='available' ORDER BY random() LIMIT 1;
      adt := now()-(random()*7+1)*interval '1 day';

      INSERT INTO hmis_admissions (centre_id,patient_id,ipd_number,admitting_doctor_id,primary_doctor_id,department_id,bed_id,admission_type,admission_date,payor_type,provisional_diagnosis,status)
      VALUES (cid,pid,'IPD-'||lpad(ano::text,6,'0'),did,did,dep,bed,atypes[1+(random()*3)::int],adt,payors[1+(random()*6)::int],dx[1+(random()*19)::int],'active')
      RETURNING id INTO aid;
      IF bed IS NOT NULL THEN UPDATE hmis_beds SET status='occupied',current_admission_id=aid WHERE id=bed; END IF;

      -- Vitals (no admission_id/centre_id — schema doesn't have them)
      INSERT INTO hmis_vitals (patient_id,encounter_type,encounter_id,temperature,pulse,bp_systolic,bp_diastolic,resp_rate,spo2,recorded_by,recorded_at)
      VALUES (pid,'ipd',aid,97.5+random()*3,60+(random()*40)::int,100+(random()*60)::int,60+(random()*30)::int,14+(random()*8)::int,94+random()*6,did,adt+interval '1 hour'),
             (pid,'ipd',aid,97.5+random()*3,60+(random()*40)::int,100+(random()*60)::int,60+(random()*30)::int,14+(random()*8)::int,94+random()*6,did,adt+interval '12 hours');

      -- Charges (status=captured)
      INSERT INTO hmis_charge_log (centre_id,patient_id,admission_id,description,category,quantity,unit_rate,amount,source,status,service_date)
      VALUES (cid,pid,aid,'Room Charges','room',EXTRACT(DAY FROM now()-adt)+1,1500,(EXTRACT(DAY FROM now()-adt)+1)*1500,'auto_daily','captured',CURRENT_DATE),
             (cid,pid,aid,'Nursing','nursing',EXTRACT(DAY FROM now()-adt)+1,500,(EXTRACT(DAY FROM now()-adt)+1)*500,'auto_daily','captured',CURRENT_DATE),
             (cid,pid,aid,'Consultation','consultation',1,1000,1000,'manual','captured',adt::date);
    END LOOP;

    -- 30 DISCHARGED per centre
    FOR i IN 1..30 LOOP
      ano:=ano+1;
      SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1;
      SELECT s.id INTO did FROM hmis_staff s JOIN hmis_staff_centres sc ON sc.staff_id=s.id WHERE sc.centre_id=cid AND s.staff_type='doctor' ORDER BY random() LIMIT 1;
      IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type='doctor' ORDER BY random() LIMIT 1; END IF;
      SELECT id INTO dep FROM hmis_departments WHERE centre_id=cid ORDER BY random() LIMIT 1;
      IF dep IS NULL THEN SELECT id INTO dep FROM hmis_departments ORDER BY random() LIMIT 1; END IF;
      adt := now()-(random()*90+7)*interval '1 day';

      INSERT INTO hmis_admissions (centre_id,patient_id,ipd_number,admitting_doctor_id,primary_doctor_id,department_id,admission_type,admission_date,actual_discharge,discharge_type,payor_type,provisional_diagnosis,status)
      VALUES (cid,pid,'IPD-'||lpad(ano::text,6,'0'),did,did,dep,atypes[1+(random()*3)::int],adt,adt+(2+random()*8)*interval '1 day','normal',payors[1+(random()*6)::int],dx[1+(random()*19)::int],'discharged');
    END LOOP;
  END LOOP;
END $$;

-- ═══ 250 OPD VISITS + EMR ═══
DO $$
DECLARE
  cids uuid[] := ARRAY['c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000005'];
  cc text[] := ARRAY['Fever','Cough','Chest Pain','Headache','Back Pain','Joint Pain','Abdominal Pain','Breathlessness','Dizziness','Skin Rash','Eye Pain','Ear Pain','Sore Throat','Vomiting','Diarrhoea','Diabetes F/U','Hypertension F/U','Post-op F/U','Weakness','Weight Loss'];
  sts text[] := ARRAY['waiting','with_doctor','completed','completed','completed'];
  drugs text[] := ARRAY['Paracetamol 500mg','Amoxicillin 500mg','Omeprazole 20mg','Metformin 500mg','Amlodipine 5mg','Atorvastatin 10mg','Pantoprazole 40mg','Cefixime 200mg'];
  cid uuid; pid uuid; did uuid; vid uuid;
  vdt timestamptz; vno int:=0; i int; j int;
BEGIN
  FOR j IN 1..5 LOOP
    cid := cids[j];
    -- 10 TODAY
    FOR i IN 1..10 LOOP
      vno:=vno+1;
      SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1;
      SELECT s.id INTO did FROM hmis_staff s JOIN hmis_staff_centres sc ON sc.staff_id=s.id WHERE sc.centre_id=cid AND s.staff_type='doctor' ORDER BY random() LIMIT 1;
      IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type='doctor' ORDER BY random() LIMIT 1; END IF;
      vdt := CURRENT_DATE+(8+i*0.5)*interval '1 hour';

      INSERT INTO hmis_opd_visits (centre_id,patient_id,doctor_id,visit_number,token_number,chief_complaint,status,check_in_time,created_at)
      VALUES (cid,pid,did,'OPD-'||lpad(vno::text,8,'0'),i,cc[1+(random()*19)::int],sts[1+(random()*4)::int],vdt,vdt)
      RETURNING id INTO vid;

      IF random()>0.3 THEN
        INSERT INTO hmis_emr_encounters (centre_id,patient_id,doctor_id,opd_visit_id,encounter_date,encounter_type,status,complaints,diagnoses,prescriptions,vitals)
        VALUES (cid,pid,did,vid,CURRENT_DATE,'opd','completed',
          ('[{"text":"'||cc[1+(random()*19)::int]||'"}]')::jsonb,
          ('[{"code":"J06.9","label":"URI"},{"code":"R50.9","label":"Fever"}]')::jsonb,
          ('[{"drug":"'||drugs[1+(random()*7)::int]||'","dose":"1 tab","route":"oral","frequency":"TDS","duration":"5 days"}]')::jsonb,
          '{"temperature":98.6,"pulse":78,"bp_systolic":124,"bp_diastolic":80,"spo2":98}'::jsonb);
      END IF;
    END LOOP;

    -- 40 HISTORICAL
    FOR i IN 1..40 LOOP
      vno:=vno+1;
      SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1;
      SELECT s.id INTO did FROM hmis_staff s JOIN hmis_staff_centres sc ON sc.staff_id=s.id WHERE sc.centre_id=cid AND s.staff_type='doctor' ORDER BY random() LIMIT 1;
      IF did IS NULL THEN SELECT id INTO did FROM hmis_staff WHERE staff_type='doctor' ORDER BY random() LIMIT 1; END IF;
      vdt := now()-(1+random()*60)*interval '1 day';

      INSERT INTO hmis_opd_visits (centre_id,patient_id,doctor_id,visit_number,token_number,chief_complaint,status,check_in_time,consultation_start,consultation_end,created_at)
      VALUES (cid,pid,did,'OPD-'||lpad(vno::text,8,'0'),(random()*30)::int+1,cc[1+(random()*19)::int],'completed',vdt,vdt+interval '15 min',vdt+interval '30 min',vdt)
      RETURNING id INTO vid;

      INSERT INTO hmis_emr_encounters (centre_id,patient_id,doctor_id,opd_visit_id,encounter_date,encounter_type,status,complaints,diagnoses,prescriptions,vitals)
      VALUES (cid,pid,did,vid,vdt::date,'opd','completed',
        ('[{"text":"'||cc[1+(random()*19)::int]||'"}]')::jsonb,
        ('[{"code":"'||CASE WHEN random()>0.5 THEN 'J06.9' ELSE 'I10' END||'","label":"'||CASE WHEN random()>0.5 THEN 'URI' ELSE 'HTN' END||'"}]')::jsonb,
        ('[{"drug":"'||drugs[1+(random()*7)::int]||'","dose":"1 tab","route":"oral","frequency":"'||(ARRAY['OD','BD','TDS'])[1+(random()*2)::int]||'","duration":"'||(2+random()*12)::int||' days"}]')::jsonb,
        ('{"temperature":'||(97+random()*3)::numeric(4,1)||',"pulse":'||(65+random()*30)::int||',"bp_systolic":'||(110+random()*40)::int||',"bp_diastolic":'||(65+random()*25)::int||',"spo2":'||(95+random()*5)::numeric(4,1)||'}')::jsonb);
    END LOOP;
  END LOOP;
END $$;

-- ═══ BILLING (status: paid/partially_paid/final) ═══
DO $$
DECLARE
  rec RECORD; bid uuid; bno int:=0; total numeric; paid numeric;
  rcpt uuid;
BEGIN
  SELECT id INTO rcpt FROM hmis_staff WHERE staff_type='receptionist' LIMIT 1;
  IF rcpt IS NULL THEN SELECT id INTO rcpt FROM hmis_staff LIMIT 1; END IF;

  -- IPD bills for discharged
  FOR rec IN SELECT a.id aid,a.centre_id,a.patient_id,a.payor_type,a.actual_discharge FROM hmis_admissions a WHERE a.status='discharged' LOOP
    bno:=bno+1;
    total := 5000+(random()*95000)::numeric(10,2);
    paid := total*(0.7+random()*0.3);
    INSERT INTO hmis_bills (centre_id,patient_id,bill_number,bill_type,encounter_id,payor_type,gross_amount,discount_amount,tax_amount,net_amount,paid_amount,balance_amount,status,bill_date)
    VALUES (rec.centre_id,rec.patient_id,'BILL-'||lpad(bno::text,6,'0'),'ipd',rec.aid,rec.payor_type,total,total*0.05,0,total*0.95,paid,total*0.95-paid,CASE WHEN paid>=total*0.95 THEN 'paid' ELSE 'partially_paid' END,COALESCE(rec.actual_discharge::date,CURRENT_DATE))
    RETURNING id INTO bid;
    INSERT INTO hmis_payments (bill_id,amount,payment_mode,reference_number,receipt_number,payment_date,received_by)
    VALUES (bid,paid,(ARRAY['cash','card','upi','neft'])[1+(random()*3)::int],'TXN'||lpad(bno::text,8,'0'),'RCP-'||lpad(bno::text,8,'0'),COALESCE(rec.actual_discharge::date,CURRENT_DATE),rcpt);
  END LOOP;

  -- OPD bills
  FOR rec IN SELECT v.id vid,v.centre_id,v.patient_id,v.created_at FROM hmis_opd_visits v WHERE v.status='completed' LOOP
    bno:=bno+1;
    total := 300+(random()*2700)::numeric(10,2);
    INSERT INTO hmis_bills (centre_id,patient_id,bill_number,bill_type,encounter_id,payor_type,gross_amount,discount_amount,tax_amount,net_amount,paid_amount,balance_amount,status,bill_date)
    VALUES (rec.centre_id,rec.patient_id,'BILL-'||lpad(bno::text,6,'0'),'opd',rec.vid,'self',total,0,0,total,total,0,'paid',rec.created_at::date)
    RETURNING id INTO bid;
    INSERT INTO hmis_payments (bill_id,amount,payment_mode,receipt_number,payment_date,received_by)
    VALUES (bid,total,(ARRAY['cash','card','upi'])[1+(random()*2)::int],'RCP-O'||lpad(bno::text,8,'0'),rec.created_at::date,rcpt);
  END LOOP;
END $$;

-- ═══ LAB ORDERS (use test_id FK) ═══
DO $$
DECLARE
  rec RECORD; oid uuid; test_ids uuid[];
  tid uuid;
BEGIN
  test_ids := ARRAY['d0000001-0000-0000-0000-000000000001','d0000001-0000-0000-0000-000000000002','d0000001-0000-0000-0000-000000000003','d0000001-0000-0000-0000-000000000004','d0000001-0000-0000-0000-000000000005','d0000001-0000-0000-0000-000000000006','d0000001-0000-0000-0000-000000000007','d0000001-0000-0000-0000-000000000008','d0000001-0000-0000-0000-000000000009','d0000001-0000-0000-0000-000000000010'];

  FOR rec IN SELECT a.id aid,a.centre_id,a.patient_id,a.primary_doctor_id FROM hmis_admissions a WHERE a.status='active' LOOP
    FOR i IN 1..2+(random()*2)::int LOOP
      tid := test_ids[1+(random()*9)::int];
      INSERT INTO hmis_orders (patient_id,encounter_type,encounter_id,order_type,ordered_by,status)
      VALUES (rec.patient_id,'ipd',rec.aid,'lab',rec.primary_doctor_id,CASE WHEN random()>0.4 THEN 'completed' ELSE 'ordered' END)
      RETURNING id INTO oid;
      INSERT INTO hmis_lab_orders (order_id,patient_id,test_id,centre_id,status,ordered_by,created_at)
      VALUES (oid,rec.patient_id,tid,rec.centre_id,CASE WHEN random()>0.4 THEN 'completed' ELSE 'ordered' END,rec.primary_doctor_id,now()-random()*interval '5 days');
    END LOOP;
  END LOOP;
END $$;

-- ═══ RADIOLOGY ORDERS (use test_id FK) ═══
DO $$
DECLARE
  rec RECORD; oid uuid; test_ids uuid[];
  tid uuid; st text;
BEGIN
  test_ids := ARRAY['e0000001-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000002','e0000001-0000-0000-0000-000000000003','e0000001-0000-0000-0000-000000000004','e0000001-0000-0000-0000-000000000005','e0000001-0000-0000-0000-000000000006','e0000001-0000-0000-0000-000000000007','e0000001-0000-0000-0000-000000000008'];

  FOR rec IN SELECT a.id aid,a.centre_id,a.patient_id,a.primary_doctor_id FROM hmis_admissions a WHERE random()<0.5 LIMIT 60 LOOP
    tid := test_ids[1+(random()*7)::int];
    st := CASE WHEN random()>0.3 THEN 'reported' ELSE 'ordered' END;
    INSERT INTO hmis_orders (patient_id,encounter_type,encounter_id,order_type,ordered_by,status)
    VALUES (rec.patient_id,'ipd',rec.aid,'radiology',rec.primary_doctor_id,CASE WHEN st='reported' THEN 'completed' ELSE 'ordered' END)
    RETURNING id INTO oid;
    INSERT INTO hmis_radiology_orders (order_id,patient_id,test_id,centre_id,clinical_indication,status,created_at)
    VALUES (oid,rec.patient_id,tid,rec.centre_id,'Clinical evaluation',st,now()-random()*interval '7 days');
  END LOOP;
END $$;

-- ═══ PHARMACY DISPENSING (no admission_id/billing_done — not in schema) ═══
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT v.id,v.centre_id,v.patient_id,v.created_at FROM hmis_opd_visits v WHERE v.status='completed' AND random()<0.4 LIMIT 80 LOOP
    INSERT INTO hmis_pharmacy_dispensing (centre_id,patient_id,encounter_id,prescription_data,status,total_amount,dispensed_at,created_at)
    VALUES (rec.centre_id,rec.patient_id,rec.id,('[{"drug":"Paracetamol 500mg","qty":20,"rate":2}]')::jsonb,'dispensed',100+(random()*900)::numeric(10,2),rec.created_at,rec.created_at);
  END LOOP;
END $$;

-- ═══ ER VISITS (5 today at Shilaj) ═══
DO $$
DECLARE
  pid uuid; did uuid;
  triages text[] := ARRAY['red','orange','yellow','yellow','green','green','green'];
  cc text[] := ARRAY['Chest Pain','RTA','Fall','Breathing difficulty','Seizure','Snake bite','Burns','Poisoning','Assault','High fever'];
BEGIN
  FOR i IN 1..5 LOOP
    SELECT id INTO pid FROM hmis_patients ORDER BY random() LIMIT 1;
    SELECT id INTO did FROM hmis_staff WHERE staff_type='doctor' ORDER BY random() LIMIT 1;
    INSERT INTO hmis_er_visits (centre_id,patient_id,arrival_mode,arrival_time,triage_category,chief_complaint,attending_doctor_id,status)
    VALUES ('c0000001-0000-0000-0000-000000000001',pid,(ARRAY['walk_in','ambulance','referred'])[1+(random()*2)::int],now()-(random()*8)*interval '1 hour',triages[1+(random()*6)::int],cc[1+(random()*9)::int],did,(ARRAY['triaged','being_seen','under_observation'])[1+(random()*2)::int]);
  END LOOP;
END $$;

-- ═══ FINAL COUNT ═══
SELECT 'DEMO SEED COMPLETE' AS status,
  (SELECT count(*) FROM hmis_centres) AS centres,
  (SELECT count(*) FROM hmis_departments) AS departments,
  (SELECT count(*) FROM hmis_staff WHERE staff_type='doctor') AS doctors,
  (SELECT count(*) FROM hmis_staff WHERE staff_type NOT IN ('doctor','admin')) AS other_staff,
  (SELECT count(*) FROM hmis_patients) AS patients,
  (SELECT count(*) FROM hmis_admissions WHERE status='active') AS active_ipd,
  (SELECT count(*) FROM hmis_admissions WHERE status='discharged') AS discharged,
  (SELECT count(*) FROM hmis_opd_visits) AS opd_visits,
  (SELECT count(*) FROM hmis_bills) AS bills,
  (SELECT count(*) FROM hmis_lab_orders) AS lab_orders,
  (SELECT count(*) FROM hmis_radiology_orders) AS rad_orders,
  (SELECT count(*) FROM hmis_emr_encounters) AS encounters,
  (SELECT count(*) FROM hmis_beds) AS beds,
  (SELECT count(*) FROM hmis_er_visits) AS er_visits;
