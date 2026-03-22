-- consent_migration.sql
-- Digital consent management: templates, signed consents with signatures, audit

-- ============================================================
-- CONSENT TEMPLATES (admin-managed, versioned)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_consent_templates (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  category      text NOT NULL CHECK (category IN (
    'surgical', 'procedure', 'transfusion', 'general', 'anesthesia'
  )),
  content_html  text NOT NULL,
  risks_json    jsonb DEFAULT '[]'::jsonb,          -- array of risk strings
  alternatives_json jsonb DEFAULT '[]'::jsonb,      -- array of alternative strings
  is_active     boolean DEFAULT true,
  version       integer DEFAULT 1,
  centre_id     uuid REFERENCES hmis_centres(id),   -- NULL = global template
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_consent_templates IS 'Versioned consent form templates (surgical, procedure, transfusion, etc.)';

CREATE INDEX IF NOT EXISTS idx_consent_tpl_category ON hmis_consent_templates (category, is_active);

-- ============================================================
-- PATIENT CONSENTS (signed instances)
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_patient_consents (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id        uuid NOT NULL REFERENCES hmis_patients(id),
  admission_id      uuid REFERENCES hmis_admissions(id),
  template_id       uuid REFERENCES hmis_consent_templates(id),
  consent_type      text NOT NULL,
  procedure_name    text,
  consent_html      text,                  -- snapshot of template at sign time
  risks_explained   text,
  alternatives_explained text,
  signature_data    text,                  -- base64 PNG from canvas
  witnessed_by      uuid REFERENCES hmis_staff(id),
  witness_name      text,
  witness_relation  text,
  witness_signature text,                  -- base64 PNG
  doctor_signature  text,                  -- base64 PNG
  obtained_by       uuid REFERENCES hmis_staff(id),
  signed_at         timestamptz DEFAULT now(),
  consent_language  text DEFAULT 'English',
  is_valid          boolean DEFAULT true,
  revoked_at        timestamptz,
  revoked_by        uuid REFERENCES hmis_staff(id),
  revoke_reason     text,
  ip_address        varchar(45),
  centre_id         uuid REFERENCES hmis_centres(id),
  created_at        timestamptz DEFAULT now()
);

COMMENT ON TABLE hmis_patient_consents IS 'Signed consent records with patient + witness signatures';

CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON hmis_patient_consents (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_consents_admission ON hmis_patient_consents (admission_id);

-- ============================================================
-- SEED 10 CONSENT TEMPLATES
-- ============================================================
INSERT INTO hmis_consent_templates (name, category, content_html, risks_json, alternatives_json) VALUES

('General Consent for Treatment', 'general',
 '<p>I, the undersigned patient / authorized representative, hereby consent to general medical treatment, nursing care, diagnostic procedures (blood tests, X-rays, ECG, etc.), and routine hospital services during my stay at <b>Health1 Super Speciality Hospital</b>.</p><p>I understand that my medical records may be maintained electronically and shared with treating physicians as necessary for my care.</p>',
 '["Allergic reactions to medications","Infection","Pain or discomfort","Unexpected complications","Bruising from blood draws"]'::jsonb,
 '["Refusal of treatment","Alternative therapies","Seeking care at another facility"]'::jsonb),

('Surgical Consent', 'surgical',
 '<p>I consent to undergo the surgical procedure as explained by my surgeon, including any additional procedures that may become necessary during the operation for medical/safety reasons.</p><p>The nature of the surgery, expected benefits, material risks, and alternatives have been explained to me. I understand no guarantee has been made regarding the outcome.</p>',
 '["Bleeding requiring transfusion","Infection (wound/deep)","Anesthesia complications","Injury to surrounding structures","Blood clots (DVT/PE)","Need for ICU admission","Conversion to open surgery","Need for re-operation","Scarring","Chronic pain","Death (rare)"]'::jsonb,
 '["Conservative management","Alternative surgical approach","Observation and monitoring","Second opinion"]'::jsonb),

('Anesthesia Consent', 'anesthesia',
 '<p>I consent to the administration of anesthesia (general / regional / local / sedation) as deemed appropriate by the anesthesiologist for my planned procedure.</p><p>The type of anesthesia, its risks, and alternatives have been explained to me by the anesthesiologist.</p>',
 '["Nausea and vomiting","Sore throat (if intubated)","Allergic reaction","Aspiration pneumonia","Nerve injury","Awareness under anesthesia","Cardiac arrest (rare)","Malignant hyperthermia (rare)","Dental damage","Post-dural puncture headache (if spinal)"]'::jsonb,
 '["Local anesthesia","Regional block","Conscious sedation","General anesthesia"]'::jsonb),

('Blood Transfusion Consent', 'transfusion',
 '<p>I consent to receive blood and/or blood products (packed red blood cells, fresh frozen plasma, platelets, cryoprecipitate) as deemed medically necessary by my treating physician.</p><p>I understand that all blood products are tested as per regulatory guidelines, but a small residual risk of transfusion-transmitted infections exists.</p>',
 '["Febrile reaction (fever, chills)","Allergic reaction (mild to severe)","Hemolytic transfusion reaction","TACO (transfusion-associated circulatory overload)","TRALI (transfusion-related acute lung injury)","Transfusion-transmitted infection (very rare)","Iron overload (with multiple transfusions)","Delayed hemolytic reaction"]'::jsonb,
 '["Iron supplementation","Erythropoietin therapy","Intraoperative cell salvage","Observation without transfusion"]'::jsonb),

('High-Risk Procedure Consent', 'procedure',
 '<p>I understand that the proposed procedure carries a higher than average risk of complications, including but not limited to significant bleeding, organ injury, and the possibility of ICU admission. The treating doctor has explained these risks in detail.</p><p>I have had adequate time to consider my options and voluntarily consent to proceed.</p>',
 '["Significant bleeding","Organ injury","ICU admission","Prolonged hospital stay","Disability","Need for additional procedures","Death"]'::jsonb,
 '["Conservative management","Second opinion","Transfer to higher centre","Alternative less-invasive procedure"]'::jsonb),

('Leave Against Medical Advice (LAMA)', 'general',
 '<p>I wish to leave <b>Health1 Super Speciality Hospital</b> against the medical advice of my treating doctors. I have been informed of the risks of leaving the hospital before completion of recommended treatment.</p><p>I understand that leaving prematurely may result in worsening of my condition, permanent disability, or death. I release the hospital and its staff from any liability arising from my decision.</p>',
 '["Worsening of current condition","Need for emergency readmission","Permanent disability","Death","Incomplete treatment leading to complications"]'::jsonb,
 '["Continue recommended treatment","Discuss concerns with treating doctor","Seek second opinion within hospital","Partial treatment plan"]'::jsonb),

('Refusal of Treatment', 'general',
 '<p>I, the undersigned, refuse the following treatment/procedure recommended by my treating physician. I have been informed of the risks of refusing treatment and the potential consequences.</p><p>I take full responsibility for this decision and release the hospital and medical staff from any liability.</p>',
 '["Progression of disease","Development of complications","Permanent damage","Need for more aggressive treatment later","Death"]'::jsonb,
 '["Accept recommended treatment","Modified treatment plan","Seek second opinion","Alternative therapies"]'::jsonb),

('Research / Clinical Trial Consent', 'procedure',
 '<p>I voluntarily agree to participate in the clinical research study as explained to me. I understand that participation is entirely voluntary and I may withdraw at any time without affecting my standard medical care.</p><p>The purpose, procedures, potential risks, and benefits of the study have been explained to me. My data will be kept confidential and used only for research purposes.</p>',
 '["Unknown side effects","Treatment may not be effective","Additional visits/tests required","Breach of confidentiality (rare)","Physical or psychological discomfort"]'::jsonb,
 '["Standard treatment without research participation","Other clinical trials","Observation only","Decline participation"]'::jsonb),

('Photography / Recording Consent', 'general',
 '<p>I consent to the taking of clinical photographs, video recordings, or other media of my medical condition / procedure for the purposes checked below:</p><ul><li>Medical records and continuity of care</li><li>Medical education and training</li><li>Research and publication (identity will be anonymized)</li><li>Quality assurance and peer review</li></ul><p>I understand that I may revoke this consent at any time.</p>',
 '["Images may be seen by medical professionals","Potential for identification despite anonymization","Images stored in hospital systems"]'::jsonb,
 '["Decline photography","Allow for medical records only","Allow with face/identity obscured"]'::jsonb),

('COVID-19 Vaccination Consent', 'procedure',
 '<p>I consent to receive the COVID-19 vaccine as recommended. I have been informed about the vaccine, its benefits in preventing COVID-19 infection, and the possible side effects.</p><p>I understand that I need to wait at the observation area for 30 minutes after vaccination and report any adverse effects immediately.</p>',
 '["Pain/swelling at injection site","Fever and body aches","Fatigue and headache","Allergic reaction (rare)","Anaphylaxis (very rare)","Myocarditis (very rare, certain vaccines)"]'::jsonb,
 '["Decline vaccination","Choose alternative vaccine","Postpone vaccination","Natural immunity (prior infection)"]'::jsonb)

ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE hmis_consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmis_patient_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view consent templates"
  ON hmis_consent_templates FOR SELECT USING (true);

CREATE POLICY "Admin can manage consent templates"
  ON hmis_consent_templates FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Staff can view patient consents"
  ON hmis_patient_consents FOR SELECT USING (true);

CREATE POLICY "Staff can create patient consents"
  ON hmis_patient_consents FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update patient consents"
  ON hmis_patient_consents FOR UPDATE USING (true) WITH CHECK (true);

-- Updated_at trigger for templates
CREATE OR REPLACE FUNCTION update_consent_tpl_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consent_tpl_updated_at
  BEFORE UPDATE ON hmis_consent_templates
  FOR EACH ROW EXECUTE FUNCTION update_consent_tpl_updated_at();
