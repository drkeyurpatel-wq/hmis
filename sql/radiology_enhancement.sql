-- ============================================================
-- Health1 HMIS — Radiology Module Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Enhance radiology orders
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS accession_number varchar(30);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS urgency varchar(10) DEFAULT 'routine' CHECK (urgency IN ('routine','urgent','stat'));
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS modality varchar(20);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS body_part varchar(50);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS is_contrast boolean DEFAULT false;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS contrast_allergy_checked boolean DEFAULT false;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS creatinine_value decimal(5,2);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS lmp_date date;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS pregnancy_status varchar(10) CHECK (pregnancy_status IN ('not_pregnant','pregnant','unknown','na'));
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS scheduled_time time;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS room_id uuid;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS ordered_by uuid REFERENCES hmis_staff(id);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES hmis_admissions(id);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS encounter_id uuid;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS pacs_study_uid varchar(100);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS pacs_accession varchar(50);
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS reported_at timestamptz;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE hmis_radiology_orders ADD COLUMN IF NOT EXISTS tat_minutes int;

-- 2. Enhance radiology reports
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS technique text;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS comparison text;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS clinical_history text;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS is_critical boolean DEFAULT false;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS critical_notified boolean DEFAULT false;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS critical_notified_to varchar(100);
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS critical_notified_at timestamptz;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS is_addendum boolean DEFAULT false;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS parent_report_id uuid REFERENCES hmis_radiology_reports(id);
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS template_used varchar(50);
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE hmis_radiology_reports ADD COLUMN IF NOT EXISTS status varchar(15) DEFAULT 'draft' CHECK (status IN ('draft','finalized','verified','amended'));

-- 3. Radiology rooms / modalities
CREATE TABLE IF NOT EXISTS hmis_radiology_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    name varchar(50) NOT NULL,
    modality varchar(20) NOT NULL,
    manufacturer varchar(100),
    model varchar(100),
    dicom_ae_title varchar(30),
    dicom_ip varchar(20),
    dicom_port int,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, name)
);

-- 4. Report templates
CREATE TABLE IF NOT EXISTS hmis_radiology_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modality varchar(20) NOT NULL,
    body_part varchar(50),
    template_name varchar(100) NOT NULL,
    technique_text text,
    findings_template text NOT NULL,
    impression_template text,
    is_normal boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. PACS integration config (Stradus)
CREATE TABLE IF NOT EXISTS hmis_pacs_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id) UNIQUE,
    pacs_vendor varchar(30) NOT NULL DEFAULT 'stradus',
    pacs_url text NOT NULL,
    viewer_url text,
    dicom_ae_title varchar(30),
    dicom_ip varchar(20),
    dicom_port int DEFAULT 104,
    hl7_ip varchar(20),
    hl7_port int DEFAULT 2575,
    api_key text,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rad_orders_centre ON hmis_radiology_orders(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_rad_orders_accession ON hmis_radiology_orders(accession_number);
CREATE INDEX IF NOT EXISTS idx_rad_orders_pacs ON hmis_radiology_orders(pacs_study_uid);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_radiology_rooms','hmis_radiology_templates','hmis_pacs_config'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Common radiology report templates
-- ============================================================
INSERT INTO hmis_radiology_templates (modality, body_part, template_name, technique_text, findings_template, impression_template, is_normal) VALUES
('XR', 'Chest', 'CXR - Normal', 'PA view of chest obtained.', 'Heart size is normal. Mediastinum is within normal limits. Both lung fields are clear with no focal consolidation, effusion, or pneumothorax. Both costophrenic angles are clear. Bony thorax appears intact.', 'Normal chest radiograph.', true),
('XR', 'Chest', 'CXR - Pneumonia', 'PA view of chest obtained.', 'Heart size is normal. There is a focal area of consolidation noted in the {right/left} {upper/middle/lower} zone. No pleural effusion seen. Costophrenic angles are {clear/blunted}.', 'Findings suggestive of pneumonia in the {location}. Clinical correlation advised.', false),
('XR', 'Chest', 'CXR - Cardiomegaly', 'PA view of chest obtained.', 'Heart is enlarged with cardiothoracic ratio of approximately {0.xx}. Pulmonary vasculature appears {normal/prominent}. Both lung fields show {clear/congestion}. Costophrenic angles are {clear/blunted}.', 'Cardiomegaly with {features}. Echocardiography recommended.', false),
('CT', 'Brain', 'CT Brain - Normal', 'Non-contrast CT of the brain was performed with axial sections.', 'Both cerebral hemispheres are symmetrical. No focal area of abnormal attenuation seen. Ventricular system is normal in size and configuration. Basal cisterns are patent. Midline structures are in normal position. No extra-axial collection seen. Calvarium appears intact.', 'Normal non-contrast CT brain.', true),
('CT', 'Brain', 'CT Brain - Infarct', 'Non-contrast CT of the brain was performed with axial sections.', 'There is a hypodense area involving the {territory} territory, suggestive of acute/subacute infarction. The ventricular system is {normal/compressed}. Midline shift of approximately {X} mm is noted towards the {side}. No hemorrhagic transformation seen.', 'Acute infarction in the {territory} territory. MRI brain with DWI recommended for further evaluation.', false),
('CT', 'Abdomen', 'CT Abdomen - Normal', 'Contrast-enhanced CT of abdomen and pelvis was performed.', 'Liver is normal in size with homogeneous attenuation. No focal hepatic lesion seen. Gallbladder is normal. Bile ducts are not dilated. Pancreas, spleen, and both adrenal glands are normal. Both kidneys show normal size, shape and enhancement. No calculus or hydronephrosis. Urinary bladder is normal. No free fluid or lymphadenopathy.', 'Normal CECT abdomen and pelvis.', true),
('MRI', 'Brain', 'MRI Brain - Normal', 'MRI of the brain was performed with T1W, T2W, FLAIR, DWI sequences.', 'Both cerebral hemispheres show normal signal intensity. No restricted diffusion seen on DWI. No abnormal enhancement on post-contrast images. Ventricular system and sulcal spaces are normal for age. Corpus callosum, brainstem, and cerebellum are normal. Pituitary gland is normal. No extra-axial collection.', 'Normal MRI brain.', true),
('MRI', 'Knee', 'MRI Knee - Normal', 'MRI of the {right/left} knee was performed with PD, T1W, T2W STIR sequences.', 'ACL and PCL are intact with normal signal. Medial and lateral menisci show normal morphology and signal. Medial and lateral collateral ligaments are intact. Articular cartilage is preserved. No joint effusion. Patellofemoral alignment is normal. No bone marrow edema.', 'Normal MRI {right/left} knee.', true),
('MRI', 'Spine', 'MRI LS Spine - Normal', 'MRI of the lumbosacral spine was performed with T1W, T2W sagittal and axial sequences.', 'Vertebral bodies show normal height and signal. Intervertebral discs show normal signal and height at all levels. No disc herniation or bulge seen. Spinal canal is adequate. Conus medullaris terminates normally at L1-L2 level. No compression of nerve roots. Paravertebral soft tissues are normal.', 'Normal MRI lumbosacral spine.', true),
('USG', 'Abdomen', 'USG Abdomen - Normal', 'Ultrasound of abdomen and pelvis performed.', 'Liver: Normal size, homogeneous echotexture, no focal lesion. Portal vein is normal. Gallbladder: Normal wall thickness, no calculi. CBD is not dilated. Pancreas: Normal. Spleen: Normal size. Both kidneys: Normal size, shape, and corticomedullary differentiation. No calculus or hydronephrosis. Urinary bladder: Normal wall, no calculus. No free fluid in peritoneal cavity.', 'Normal ultrasound abdomen.', true),
('USG', 'Abdomen', 'USG Abdomen - Cholelithiasis', 'Ultrasound of abdomen and pelvis performed.', 'Liver: Normal size, homogeneous echotexture. Gallbladder: Contains {single/multiple} echogenic foci with posterior acoustic shadowing, largest measuring approximately {X} mm. Wall thickness is {normal/thickened}. CBD measures {X} mm. Pancreas, spleen, kidneys: Normal.', 'Cholelithiasis {with/without cholecystitis}. Surgical consultation advised.', false),
('ECHO', 'Heart', 'Echocardiography - Normal', '2D echocardiography with M-mode and color Doppler performed.', 'LV: Normal size, wall thickness and systolic function. LVEF approximately {55-65}% by modified Simpson method. No RWMA. RV: Normal size and function. TAPSE {18-25} mm. Valves: All valves are morphologically normal with no significant stenosis or regurgitation. IAS/IVS: Intact. Pericardium: No effusion. IVC: Normal caliber with adequate respiratory variation.', 'Normal echocardiographic study. LVEF {55-65}%.', true),
('ECHO', 'Heart', 'Echocardiography - LV Dysfunction', '2D echocardiography with M-mode and color Doppler performed.', 'LV: {Mildly/Moderately/Severely} dilated. Wall thickness is {normal/increased}. Global hypokinesia noted. LVEF approximately {XX}% by modified Simpson method. RWMA noted in {territory}. RV: {Normal/Dilated}. Mitral valve shows {mild/moderate/severe} regurgitation. Aortic valve is {normal/calcified}.', 'LV systolic dysfunction with LVEF {XX}%. {RWMA in territory}. {Valve findings}.', false)
ON CONFLICT DO NOTHING;

-- SEED: Radiology test master (if empty)
INSERT INTO hmis_radiology_test_master (test_code, test_name, modality, body_part, tat_hours, is_contrast) VALUES
('XR-CHEST', 'X-Ray Chest PA', 'XR', 'Chest', 2, false),
('XR-ABDOMEN', 'X-Ray Abdomen Erect', 'XR', 'Abdomen', 2, false),
('XR-SPINE-LS', 'X-Ray LS Spine AP/Lat', 'XR', 'Spine', 2, false),
('XR-KNEE', 'X-Ray Knee AP/Lat', 'XR', 'Knee', 2, false),
('XR-HIP', 'X-Ray Pelvis with Both Hips', 'XR', 'Hip', 2, false),
('CT-BRAIN-PLAIN', 'CT Brain Plain', 'CT', 'Brain', 4, false),
('CT-BRAIN-CECT', 'CT Brain with Contrast', 'CT', 'Brain', 4, true),
('CT-CHEST-HRCT', 'HRCT Chest', 'CT', 'Chest', 6, false),
('CT-ABDOMEN', 'CECT Abdomen + Pelvis', 'CT', 'Abdomen', 6, true),
('CT-KUB', 'CT KUB (Non-contrast)', 'CT', 'Abdomen', 4, false),
('CT-ANGIO-BRAIN', 'CT Angiography Brain', 'CT', 'Brain', 4, true),
('CT-ANGIO-CHEST', 'CT Pulmonary Angiography', 'CT', 'Chest', 4, true),
('CT-ANGIO-CORONARY', 'CT Coronary Angiography', 'CT', 'Heart', 6, true),
('MRI-BRAIN', 'MRI Brain', 'MRI', 'Brain', 24, false),
('MRI-BRAIN-CE', 'MRI Brain with Contrast', 'MRI', 'Brain', 24, true),
('MRI-SPINE-C', 'MRI Cervical Spine', 'MRI', 'Spine', 24, false),
('MRI-SPINE-LS', 'MRI Lumbosacral Spine', 'MRI', 'Spine', 24, false),
('MRI-KNEE', 'MRI Knee', 'MRI', 'Knee', 24, false),
('MRI-SHOULDER', 'MRI Shoulder', 'MRI', 'Shoulder', 24, false),
('MRI-ABDOMEN', 'MRI Abdomen', 'MRI', 'Abdomen', 24, true),
('MRI-MRCP', 'MRCP', 'MRI', 'Abdomen', 24, false),
('USG-ABDOMEN', 'USG Abdomen + Pelvis', 'USG', 'Abdomen', 2, false),
('USG-KUB', 'USG KUB', 'USG', 'Abdomen', 2, false),
('USG-THYROID', 'USG Thyroid', 'USG', 'Neck', 2, false),
('USG-BREAST', 'USG Breast', 'USG', 'Breast', 2, false),
('USG-OBSTETRIC', 'USG Obstetric', 'USG', 'Pelvis', 2, false),
('USG-DOPPLER-CAROTID', 'Carotid Doppler', 'USG', 'Neck', 4, false),
('USG-DOPPLER-VENOUS', 'Venous Doppler Lower Limb', 'USG', 'Leg', 4, false),
('ECHO-2D', '2D Echocardiography', 'ECHO', 'Heart', 4, false),
('ECHO-STRESS', 'Stress Echocardiography', 'ECHO', 'Heart', 6, false),
('ECHO-TEE', 'Transesophageal Echo', 'ECHO', 'Heart', 6, false),
('DEXA', 'DEXA Scan', 'DEXA', 'Whole Body', 24, false),
('MAMMO', 'Mammography Bilateral', 'MAMMO', 'Breast', 24, false),
('FLUORO', 'Fluoroscopy', 'FLUORO', 'Variable', 2, false)
ON CONFLICT (test_code) DO NOTHING;
