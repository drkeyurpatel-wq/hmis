'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================
// TYPES
// ============================================================

interface VitalValues {
  systolic: string;
  diastolic: string;
  heartRate: string;
  spo2: string;
  temperature: string;
  weight: string;
  height: string;
  respiratoryRate: string;
}

interface ComplaintEntry {
  complaint: string;
  duration: string;
  hpiNotes: string;
  selectedChips: string[];
}

interface ExamEntry {
  system: string;
  findings: string[];
  notes: string;
}

interface DiagnosisEntry {
  code: string;
  label: string;
  type: 'primary' | 'secondary';
}

interface InvestigationEntry {
  name: string;
  urgency: 'routine' | 'urgent' | 'stat';
  notes: string;
}

interface PrescriptionEntry {
  id: string;
  generic: string;
  brand: string;
  strength: string;
  form: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
}

interface FollowUpData {
  date: string;
  notes: string;
  advice: string[];
}

// ============================================================
// CDSS DATA (inline for portability — mirrors lib/cdss files)
// ============================================================

// --- Complaint Templates ---
const COMPLAINT_TEMPLATES = [
  { label: 'Fever', keywords: ['fever', 'temperature', 'bukhar'],
    hpiChips: ['High grade', 'Low grade', 'Intermittent', 'Continuous', 'With chills', 'With rigors', 'Night sweats', 'Evening rise', 'Responds to paracetamol', 'Not responding to paracetamol'],
    durationOptions: ['1 day', '2 days', '3 days', '5 days', '1 week', '2 weeks', '>2 weeks'],
    relatedComplaints: ['Body ache', 'Headache', 'Cold', 'Cough', 'Sore throat'] },
  { label: 'Chest Pain', keywords: ['chest pain', 'chhati'],
    hpiChips: ['Central/retrosternal', 'Left-sided', 'Crushing/pressure', 'Sharp/stabbing', 'Radiating to left arm', 'Radiating to jaw', 'On exertion', 'At rest', 'Relieved by rest', 'With sweating', 'With breathlessness', 'Pleuritic'],
    durationOptions: ['Minutes', '30 min', '1 hour', 'Few hours', '1 day', 'Recurrent episodes'],
    relatedComplaints: ['Breathlessness', 'Sweating', 'Palpitations', 'Nausea', 'Giddiness'] },
  { label: 'Breathlessness', keywords: ['breathlessness', 'dyspnea', 'sob'],
    hpiChips: ['On exertion', 'At rest', 'Orthopnea', 'PND', 'Progressive', 'Sudden onset', 'Wheezing', 'NYHA Class II', 'NYHA Class III', 'NYHA Class IV', 'Nocturnal', 'Episodic'],
    durationOptions: ['Acute (hours)', '1 day', '3 days', '1 week', 'Progressive over weeks', 'Chronic'],
    relatedComplaints: ['Cough', 'Chest pain', 'Pedal edema', 'Palpitations', 'Wheeze'] },
  { label: 'Headache', keywords: ['headache', 'head pain'],
    hpiChips: ['Unilateral', 'Bilateral', 'Frontal', 'Occipital', 'Throbbing', 'Band-like', 'Thunderclap', 'With aura', 'With nausea', 'With photophobia', 'With phonophobia', 'Worse in morning'],
    durationOptions: ['Hours', '1 day', '3 days', '1 week', 'Recurrent', 'Chronic daily'],
    relatedComplaints: ['Nausea', 'Vomiting', 'Visual disturbance', 'Neck pain', 'Giddiness'] },
  { label: 'Abdominal Pain', keywords: ['abdominal pain', 'stomach pain', 'pet'],
    hpiChips: ['Epigastric', 'RUQ', 'LUQ', 'RLQ', 'LLQ', 'Periumbilical', 'Diffuse', 'Colicky', 'Constant', 'Burning', 'After food', 'Before food', 'Radiating to back', 'Relieved by antacids'],
    durationOptions: ['Hours', '1 day', '3 days', '1 week', '2 weeks', 'Recurrent', 'Chronic'],
    relatedComplaints: ['Nausea', 'Vomiting', 'Loose motions', 'Constipation', 'Bloating', 'Loss of appetite'] },
  { label: 'Cough', keywords: ['cough', 'khansi'],
    hpiChips: ['Dry', 'Productive', 'White sputum', 'Yellow/green sputum', 'Blood-tinged', 'Hemoptysis', 'Nocturnal', 'Morning predominance', 'Paroxysmal', 'Worse on lying down', 'With wheezing'],
    durationOptions: ['3 days', '1 week', '2 weeks', '3 weeks', '>3 weeks', '>8 weeks'],
    relatedComplaints: ['Fever', 'Breathlessness', 'Chest pain', 'Cold', 'Sore throat', 'Weight loss'] },
  { label: 'Vomiting', keywords: ['vomiting', 'emesis', 'ulti'],
    hpiChips: ['Non-bilious', 'Bilious', 'Projectile', 'Blood-tinged', 'Coffee-ground', 'After food', 'Early morning', 'Relieved after vomiting', 'With vertigo'],
    durationOptions: ['Few hours', '1 day', '2 days', '3 days', '1 week'],
    relatedComplaints: ['Nausea', 'Abdominal pain', 'Loose motions', 'Fever', 'Headache'] },
  { label: 'Loose Motions', keywords: ['loose motions', 'diarrhea'],
    hpiChips: ['Watery', 'Mucoid', 'Bloody', 'Frequent (>6/day)', 'With cramps', 'Nocturnal', 'Post-prandial', 'Explosive', 'With tenesmus'],
    durationOptions: ['1 day', '2 days', '3 days', '1 week', '2 weeks', '>4 weeks'],
    relatedComplaints: ['Vomiting', 'Abdominal pain', 'Fever', 'Dehydration'] },
  { label: 'Weakness / Fatigue', keywords: ['weakness', 'fatigue', 'tiredness', 'kamzori'],
    hpiChips: ['Generalized', 'Proximal', 'Progressive', 'Episodic', 'Morning stiffness', 'Chronic', 'With weight loss', 'With loss of appetite', 'Unable to do daily activities'],
    durationOptions: ['1 week', '2 weeks', '1 month', '3 months', '>6 months'],
    relatedComplaints: ['Loss of appetite', 'Weight loss', 'Fever', 'Breathlessness', 'Pallor'] },
  { label: 'Joint Pain', keywords: ['joint pain', 'arthralgia'],
    hpiChips: ['Single joint', 'Few joints', 'Multiple joints', 'Small joints', 'Large joints', 'Symmetric', 'Morning stiffness >30 min', 'Worse with activity', 'With swelling', 'Migratory'],
    durationOptions: ['Days', '1 week', '2 weeks', '1 month', '3 months', '>6 months'],
    relatedComplaints: ['Swelling', 'Stiffness', 'Fever', 'Skin rash', 'Back pain'] },
  { label: 'Back Pain', keywords: ['back pain', 'backache', 'lbp'],
    hpiChips: ['Lower back', 'Upper back', 'Radiating to leg', 'Worse on bending', 'Worse on sitting', 'Morning stiffness', 'Relieved by rest', 'Night pain', 'With numbness/tingling', 'After lifting heavy'],
    durationOptions: ['Acute (days)', '1 week', '2 weeks', '1 month', '3 months', '>3 months'],
    relatedComplaints: ['Leg pain', 'Numbness', 'Weakness in legs', 'Difficulty walking'] },
  { label: 'Giddiness / Vertigo', keywords: ['giddiness', 'vertigo', 'dizziness', 'chakkar'],
    hpiChips: ['Rotatory', 'Lightheadedness', 'Positional', 'On standing', 'Constant', 'Episodic', 'With nausea', 'With tinnitus', 'With hearing loss', 'Worse on head turning'],
    durationOptions: ['Seconds', 'Minutes', 'Hours', '1 day', 'Recurrent', 'Chronic'],
    relatedComplaints: ['Nausea', 'Vomiting', 'Hearing loss', 'Tinnitus', 'Headache'] },
];

// --- Exam Systems ---
const EXAM_SYSTEMS = [
  { key: 'general', label: 'General', icon: '🏥',
    findings: [
      { label: 'Appearance', normal: 'Well-oriented, comfortable', abnormal: ['Ill-looking', 'Drowsy', 'Restless', 'Pale', 'Icteric', 'Cyanosed', 'Dehydrated'] },
      { label: 'Pallor', normal: 'No pallor', abnormal: ['Mild pallor', 'Moderate pallor', 'Severe pallor'] },
      { label: 'Icterus', normal: 'No icterus', abnormal: ['Mild icterus', 'Moderate icterus', 'Deep icterus'] },
      { label: 'Edema', normal: 'No edema', abnormal: ['Pedal edema +', 'Pedal edema ++', 'Pedal edema +++', 'Pitting edema', 'Anasarca', 'Facial puffiness'] },
      { label: 'Lymphadenopathy', normal: 'No lymphadenopathy', abnormal: ['Cervical', 'Axillary', 'Inguinal', 'Generalized'] },
      { label: 'JVP', normal: 'JVP not raised', abnormal: ['JVP raised'] },
    ] },
  { key: 'cvs', label: 'Cardiovascular', icon: '❤️',
    findings: [
      { label: 'Pulse', normal: 'Regular, normal volume', abnormal: ['Irregularly irregular', 'Tachycardia', 'Bradycardia', 'Low volume', 'Bounding'] },
      { label: 'Heart Sounds', normal: 'S1S2 normal, no murmurs', abnormal: ['S3 gallop', 'S4 gallop', 'Loud S2'] },
      { label: 'Murmur', normal: 'No murmur', abnormal: ['Systolic murmur — apex', 'Systolic murmur — aortic area', 'Diastolic murmur', 'Pan-systolic murmur', 'Ejection systolic murmur'] },
      { label: 'Apex Beat', normal: 'Apex in 5th ICS, MCL', abnormal: ['Displaced laterally', 'Heaving', 'Tapping', 'Not palpable'] },
    ] },
  { key: 'rs', label: 'Respiratory', icon: '🫁',
    findings: [
      { label: 'Trachea', normal: 'Central', abnormal: ['Deviated to right', 'Deviated to left', 'Tracheal tug present'] },
      { label: 'Chest Expansion', normal: 'Bilateral equal', abnormal: ['Reduced on right', 'Reduced on left', 'Bilaterally reduced'] },
      { label: 'Percussion', normal: 'Resonant bilaterally', abnormal: ['Dull right base', 'Dull left base', 'Stony dull right', 'Stony dull left', 'Hyper-resonant'] },
      { label: 'Breath Sounds', normal: 'Bilateral vesicular', abnormal: ['Reduced right base', 'Reduced left base', 'Bronchial right', 'Bronchial left'] },
      { label: 'Added Sounds', normal: 'No added sounds', abnormal: ['Wheeze bilateral', 'Crepitations right base', 'Crepitations bilateral', 'Rhonchi', 'Pleural rub', 'Stridor'] },
    ] },
  { key: 'pa', label: 'Per Abdomen', icon: '🫃',
    findings: [
      { label: 'Shape', normal: 'Soft, flat, non-tender', abnormal: ['Distended', 'Tense', 'Visible peristalsis'] },
      { label: 'Tenderness', normal: 'No tenderness', abnormal: ['RUQ tenderness', 'LUQ tenderness', 'RLQ tenderness', 'LLQ tenderness', 'Epigastric tenderness', 'Suprapubic tenderness', 'Diffuse', 'Rebound tenderness', 'Guarding'] },
      { label: 'Liver', normal: 'Liver not palpable', abnormal: ['Hepatomegaly 2cm', 'Hepatomegaly 4cm', 'Tender hepatomegaly', 'Hard nodular liver'] },
      { label: 'Spleen', normal: 'Spleen not palpable', abnormal: ['Just palpable', 'Moderate', 'Massive splenomegaly'] },
      { label: 'Bowel Sounds', normal: 'Normal', abnormal: ['Hyperactive', 'Hypoactive', 'Absent'] },
    ] },
  { key: 'cns', label: 'Neurological', icon: '🧠',
    findings: [
      { label: 'Consciousness', normal: 'Conscious, alert, oriented ×3', abnormal: ['Drowsy', 'Confused', 'Stuporous', 'GCS 14/15', 'GCS <8'] },
      { label: 'Speech', normal: 'Fluent, coherent', abnormal: ['Dysarthria', 'Aphasia — expressive', 'Aphasia — receptive', 'Slurred'] },
      { label: 'Cranial Nerves', normal: 'Grossly intact', abnormal: ['Facial palsy — UMN R', 'Facial palsy — UMN L', 'Facial palsy — LMN', 'Diplopia', 'Nystagmus'] },
      { label: 'Motor — UL', normal: 'Power 5/5 bilateral', abnormal: ['R weakness 4/5', 'R weakness 3/5', 'R weakness 0/5', 'L weakness 4/5', 'L weakness 0/5'] },
      { label: 'Motor — LL', normal: 'Power 5/5 bilateral', abnormal: ['R weakness 4/5', 'R weakness 3/5', 'R weakness 0/5', 'L weakness 4/5', 'L weakness 0/5'] },
      { label: 'Reflexes', normal: 'DTR 2+ symmetric', abnormal: ['Hyperreflexia R', 'Hyperreflexia L', 'Hyporeflexia', 'Babinski + R', 'Babinski + L', 'Ankle clonus'] },
      { label: 'Sensory', normal: 'Grossly intact', abnormal: ['Reduced R side', 'Reduced L side', 'Glove-stocking loss', 'Dermatomal loss'] },
      { label: 'Cerebellar', normal: 'No cerebellar signs', abnormal: ['Finger-nose ataxia', 'Heel-shin ataxia', 'Intention tremor', 'Gait ataxia'] },
    ] },
  { key: 'msk', label: 'Musculoskeletal', icon: '🦴',
    findings: [
      { label: 'Spine', normal: 'Non-tender, full ROM', abnormal: ['Cervical tenderness', 'Lumbar tenderness', 'Restricted flexion', 'SLR + R', 'SLR + L', 'Paraspinal spasm'] },
      { label: 'Joints', normal: 'No swelling or deformity', abnormal: ['Knee effusion R', 'Knee effusion L', 'Knee crepitus', 'Hip restricted ROM', 'Shoulder restricted ROM', 'Small joint swelling'] },
    ] },
];

// --- Diagnosis DB (compact) ---
const DIAGNOSES_DB = [
  { code: 'I10', label: 'Essential Hypertension', cat: 'Cardiovascular', kw: ['hypertension', 'htn', 'high bp'],
    meds: ['amlodipine-5', 'telmisartan-40'], labs: ['CBC', 'RFT', 'Serum Electrolytes', 'Lipid Profile', 'ECG', 'Echocardiography'], advice: ['Low salt diet (<5g/day)', 'Regular BP monitoring', 'Exercise 30 min/day', 'Avoid smoking/alcohol', 'Weight reduction'], examFocus: ['cvs', 'general'] },
  { code: 'I20.9', label: 'Angina Pectoris', cat: 'Cardiovascular', kw: ['angina', 'chest pain', 'ischemic'],
    meds: ['aspirin-75', 'atorvastatin-40', 'metoprolol-25', 'isosorbide-dinitrate-10'], labs: ['Troponin I', 'ECG', 'Echo', 'Lipid Profile', 'Treadmill Test'], advice: ['Avoid heavy exertion', 'Keep sorbitrate SL handy', 'Low fat diet', 'Stop smoking', 'Follow up in 1 week'], examFocus: ['cvs'] },
  { code: 'I21.9', label: 'Acute Myocardial Infarction', cat: 'Cardiovascular', kw: ['mi', 'heart attack', 'stemi', 'nstemi'],
    meds: ['aspirin-150', 'clopidogrel-75', 'atorvastatin-80', 'metoprolol-25', 'ramipril-2.5'], labs: ['Troponin I serial', 'CK-MB', 'ECG serial', 'Echo', 'CBC', 'RFT', 'Lipid Profile'], advice: ['Strict bed rest', 'ICU monitoring', 'Dual antiplatelet therapy'], examFocus: ['cvs'] },
  { code: 'I50.9', label: 'Heart Failure', cat: 'Cardiovascular', kw: ['heart failure', 'chf', 'ccf'],
    meds: ['furosemide-40', 'ramipril-2.5', 'metoprolol-25', 'spironolactone-25'], labs: ['BNP', 'Echo', 'Chest X-ray', 'ECG', 'RFT', 'Electrolytes'], advice: ['Fluid restriction 1.5L/day', 'Salt restriction <2g/day', 'Daily weight monitoring', 'Follow up 1 week'], examFocus: ['cvs', 'rs'] },
  { code: 'J06.9', label: 'Acute Upper Respiratory Infection', cat: 'Respiratory', kw: ['urti', 'cold', 'common cold'],
    meds: ['paracetamol-500', 'cetirizine-10', 'ambroxol-30'], labs: ['CBC (if persistent)'], advice: ['Warm fluids', 'Steam inhalation', 'Rest', 'Gargle with warm salt water', 'Follow up if >5 days'], examFocus: ['rs'] },
  { code: 'J18.9', label: 'Pneumonia', cat: 'Respiratory', kw: ['pneumonia', 'chest infection'],
    meds: ['amoxicillin-500', 'azithromycin-500', 'paracetamol-500'], labs: ['Chest X-ray', 'CBC', 'CRP', 'Blood Culture', 'Sputum C/S'], advice: ['Complete antibiotic course', 'Adequate hydration', 'Deep breathing exercises', 'Repeat X-ray in 2 weeks'], examFocus: ['rs'] },
  { code: 'J45', label: 'Asthma', cat: 'Respiratory', kw: ['asthma', 'wheeze'],
    meds: ['salbutamol-inhaler', 'budesonide-inhaler', 'montelukast-10'], labs: ['Spirometry / PFT', 'Chest X-ray', 'IgE'], advice: ['Avoid allergens', 'Carry rescue inhaler always', 'Inhaler technique education', 'Annual flu vaccine'], examFocus: ['rs'] },
  { code: 'G40.9', label: 'Epilepsy', cat: 'Neurological', kw: ['epilepsy', 'seizure', 'fits'],
    meds: ['levetiracetam-500', 'sodium-valproate-500'], labs: ['EEG', 'MRI Brain', 'CBC', 'LFT', 'Drug Levels'], advice: ['Never skip medication', 'Avoid sleep deprivation', 'No driving until seizure-free 1 year', 'Seizure diary'], examFocus: ['cns'] },
  { code: 'G43.9', label: 'Migraine', cat: 'Neurological', kw: ['migraine', 'headache'],
    meds: ['sumatriptan-50', 'paracetamol-500', 'domperidone-10', 'amitriptyline-10'], labs: ['MRI Brain (if atypical)'], advice: ['Headache diary', 'Identify triggers', 'Regular sleep', 'Adequate hydration', 'Stress management'], examFocus: ['cns'] },
  { code: 'I63.9', label: 'Cerebral Infarction (Stroke)', cat: 'Neurological', kw: ['stroke', 'cva', 'paralysis', 'hemiplegia'],
    meds: ['aspirin-150', 'clopidogrel-75', 'atorvastatin-40', 'ramipril-5'], labs: ['CT Brain', 'MRI Brain + MRA', 'CBC', 'Lipid Profile', 'Coagulation', 'Carotid Doppler', 'Echo'], advice: ['Physiotherapy early', 'Speech therapy if needed', 'Fall prevention', 'DVT prophylaxis', 'Follow up 2 weeks'], examFocus: ['cns'] },
  { code: 'E11.9', label: 'Type 2 Diabetes Mellitus', cat: 'Endocrine', kw: ['diabetes', 'dm', 'sugar', 't2dm'],
    meds: ['metformin-500', 'glimepiride-1'], labs: ['FBS / PPBS', 'HbA1c', 'Lipid Profile', 'RFT', 'Urine Microalbumin', 'Fundoscopy', 'ECG'], advice: ['Diabetic diet — low GI', 'Exercise 30 min/day', 'Foot care — daily inspection', 'Regular glucose monitoring', 'Annual eye & kidney screening'], examFocus: ['general'] },
  { code: 'E03.9', label: 'Hypothyroidism', cat: 'Endocrine', kw: ['hypothyroidism', 'tsh high', 'thyroid low'],
    meds: ['levothyroxine-50'], labs: ['TSH, FT3, FT4', 'Lipid Profile', 'CBC'], advice: ['Empty stomach 30 min before breakfast', 'Repeat TSH after 6 weeks', 'Avoid calcium/iron within 4h'], examFocus: ['general'] },
  { code: 'K21.0', label: 'GERD', cat: 'GI', kw: ['gerd', 'acid reflux', 'heartburn', 'acidity'],
    meds: ['pantoprazole-40', 'domperidone-10'], labs: ['UGI Endoscopy (if persistent)', 'H. Pylori test'], advice: ['Avoid spicy/oily food', 'No lying down 2h after meals', 'Elevate head of bed', 'Small frequent meals'], examFocus: ['pa'] },
  { code: 'K29.7', label: 'Gastritis', cat: 'GI', kw: ['gastritis', 'stomach pain', 'dyspepsia'],
    meds: ['pantoprazole-40', 'sucralfate-1g', 'domperidone-10'], labs: ['UGI Endoscopy', 'H. Pylori test', 'CBC'], advice: ['Avoid NSAIDs', 'Regular meal timings', 'Avoid alcohol', 'Bland diet 1 week'], examFocus: ['pa'] },
  { code: 'A09', label: 'Acute Gastroenteritis', cat: 'Infectious', kw: ['diarrhea', 'loose motions', 'gastroenteritis', 'age'],
    meds: ['ondansetron-4', 'racecadotril-100', 'ors-packet', 'probiotics'], labs: ['Stool Routine', 'Stool C/S', 'CBC', 'Electrolytes', 'RFT'], advice: ['ORS after every loose stool', 'BRAT diet', 'Avoid dairy 48h', 'Follow up if not better in 3 days'], examFocus: ['pa'] },
  { code: 'N39.0', label: 'Urinary Tract Infection', cat: 'Infectious', kw: ['uti', 'burning micturition', 'dysuria'],
    meds: ['nitrofurantoin-100', 'paracetamol-500'], labs: ['Urine Routine', 'Urine C/S', 'CBC', 'RFT', 'USG KUB'], advice: ['Plenty of water (3L/day)', 'Complete antibiotic course', 'Do not hold urine', 'Personal hygiene', 'Repeat urine culture'], examFocus: ['pa'] },
  { code: 'M54.5', label: 'Low Back Pain', cat: 'MSK', kw: ['backache', 'back pain', 'lbp', 'lumbago'],
    meds: ['aceclofenac-100', 'thiocolchicoside-4', 'paracetamol-500'], labs: ['X-ray LS Spine', 'MRI LS (if persistent)', 'Vitamin D'], advice: ['Avoid prolonged sitting', 'Back strengthening exercises', 'Hot fomentation', 'Firm mattress', 'Physiotherapy'], examFocus: ['msk', 'cns'] },
  { code: 'M17.9', label: 'Osteoarthritis of Knee', cat: 'MSK', kw: ['knee pain', 'osteoarthritis', 'oa knee'],
    meds: ['aceclofenac-100', 'paracetamol-500', 'glucosamine-1500'], labs: ['X-ray Knee standing', 'Vitamin D', 'Uric Acid'], advice: ['Quad exercises', 'Weight reduction', 'Avoid squatting/cross-legged', 'Knee cap while walking', 'Hot fomentation'], examFocus: ['msk'] },
  { code: 'D50.9', label: 'Iron Deficiency Anemia', cat: 'Hematological', kw: ['anemia', 'anaemia', 'low hb', 'iron'],
    meds: ['ferrous-sulphate-200', 'folic-acid-5', 'vitamin-c-500'], labs: ['CBC + PS', 'Serum Ferritin', 'Serum Iron', 'TIBC', 'Stool Occult Blood'], advice: ['Iron-rich diet', 'Take iron with vitamin C', 'Avoid tea/coffee with meals', 'Follow up CBC in 4 weeks'], examFocus: ['general'] },
  { code: 'I48', label: 'Atrial Fibrillation', cat: 'Cardiovascular', kw: ['af', 'atrial fibrillation', 'afib'],
    meds: ['metoprolol-50', 'apixaban-5'], labs: ['ECG', 'Echo', 'Thyroid Profile', 'CBC', 'RFT'], advice: ['Regular pulse monitoring', 'Avoid excess caffeine', 'Follow up 2 weeks'], examFocus: ['cvs'] },
];

// --- Medications DB (compact) ---
const MEDS_DB: Record<string, { generic: string; brand: string; strength: string; form: string; dose: string; freq: string; dur: string; route: string; instr: string }> = {
  'amlodipine-5':     { generic: 'Amlodipine', brand: 'Amlopress', strength: '5mg', form: 'Tab', dose: '5mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Morning' },
  'telmisartan-40':   { generic: 'Telmisartan', brand: 'Telma', strength: '40mg', form: 'Tab', dose: '40mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Morning' },
  'hydrochlorothiazide-12.5': { generic: 'HCTZ', brand: 'Aquazide', strength: '12.5mg', form: 'Tab', dose: '12.5mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Morning' },
  'metoprolol-25':    { generic: 'Metoprolol', brand: 'Met XL', strength: '25mg', form: 'Tab', dose: '25mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Morning, with food' },
  'metoprolol-50':    { generic: 'Metoprolol', brand: 'Met XL', strength: '50mg', form: 'Tab', dose: '50mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Morning, with food' },
  'ramipril-2.5':     { generic: 'Ramipril', brand: 'Cardace', strength: '2.5mg', form: 'Tab', dose: '2.5mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Evening' },
  'ramipril-5':       { generic: 'Ramipril', brand: 'Cardace', strength: '5mg', form: 'Tab', dose: '5mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Evening' },
  'atorvastatin-40':  { generic: 'Atorvastatin', brand: 'Atorva', strength: '40mg', form: 'Tab', dose: '40mg', freq: 'HS', dur: '30 days', route: 'Oral', instr: 'Bedtime' },
  'atorvastatin-80':  { generic: 'Atorvastatin', brand: 'Atorva', strength: '80mg', form: 'Tab', dose: '80mg', freq: 'HS', dur: '30 days', route: 'Oral', instr: 'Bedtime' },
  'aspirin-75':       { generic: 'Aspirin', brand: 'Ecosprin', strength: '75mg', form: 'Tab', dose: '75mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'After lunch' },
  'aspirin-150':      { generic: 'Aspirin', brand: 'Ecosprin', strength: '150mg', form: 'Tab', dose: '150mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'After lunch' },
  'clopidogrel-75':   { generic: 'Clopidogrel', brand: 'Clopilet', strength: '75mg', form: 'Tab', dose: '75mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'After food' },
  'isosorbide-dinitrate-10': { generic: 'Isosorbide Dinitrate', brand: 'Sorbitrate', strength: '10mg', form: 'Tab', dose: '10mg', freq: 'TDS', dur: '14 days', route: 'Oral', instr: 'Before meals' },
  'furosemide-40':    { generic: 'Furosemide', brand: 'Lasix', strength: '40mg', form: 'Tab', dose: '40mg', freq: 'OD', dur: '14 days', route: 'Oral', instr: 'Morning, empty stomach' },
  'spironolactone-25': { generic: 'Spironolactone', brand: 'Aldactone', strength: '25mg', form: 'Tab', dose: '25mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'With food' },
  'apixaban-5':       { generic: 'Apixaban', brand: 'Eliquis', strength: '5mg', form: 'Tab', dose: '5mg', freq: 'BD', dur: '30 days', route: 'Oral', instr: 'With or without food' },
  'paracetamol-500':  { generic: 'Paracetamol', brand: 'Dolo', strength: '500mg', form: 'Tab', dose: '500mg', freq: 'TDS', dur: '5 days', route: 'Oral', instr: 'After food, SOS for fever' },
  'aceclofenac-100':  { generic: 'Aceclofenac', brand: 'Zerodol', strength: '100mg', form: 'Tab', dose: '100mg', freq: 'BD', dur: '5 days', route: 'Oral', instr: 'After food' },
  'pantoprazole-40':  { generic: 'Pantoprazole', brand: 'Pan', strength: '40mg', form: 'Tab', dose: '40mg', freq: 'OD', dur: '14 days', route: 'Oral', instr: 'Before breakfast' },
  'domperidone-10':   { generic: 'Domperidone', brand: 'Domstal', strength: '10mg', form: 'Tab', dose: '10mg', freq: 'TDS', dur: '7 days', route: 'Oral', instr: 'Before meals' },
  'ondansetron-4':    { generic: 'Ondansetron', brand: 'Emeset', strength: '4mg', form: 'Tab', dose: '4mg', freq: 'BD', dur: '3 days', route: 'Oral', instr: 'Before meals' },
  'racecadotril-100': { generic: 'Racecadotril', brand: 'Redotil', strength: '100mg', form: 'Cap', dose: '100mg', freq: 'TDS', dur: '3 days', route: 'Oral', instr: 'Before meals' },
  'sucralfate-1g':    { generic: 'Sucralfate', brand: 'Sucral-O', strength: '1g', form: 'Tab', dose: '1g', freq: 'BD', dur: '14 days', route: 'Oral', instr: '1 hour before meals' },
  'amoxicillin-500':  { generic: 'Amoxicillin', brand: 'Mox', strength: '500mg', form: 'Cap', dose: '500mg', freq: 'TDS', dur: '5 days', route: 'Oral', instr: 'After food' },
  'azithromycin-500': { generic: 'Azithromycin', brand: 'Azee', strength: '500mg', form: 'Tab', dose: '500mg', freq: 'OD', dur: '3 days', route: 'Oral', instr: 'Before food' },
  'ciprofloxacin-500': { generic: 'Ciprofloxacin', brand: 'Ciplox', strength: '500mg', form: 'Tab', dose: '500mg', freq: 'BD', dur: '5 days', route: 'Oral', instr: 'After food' },
  'nitrofurantoin-100': { generic: 'Nitrofurantoin', brand: 'Furadantin', strength: '100mg', form: 'Cap', dose: '100mg', freq: 'BD', dur: '5 days', route: 'Oral', instr: 'With food' },
  'cetirizine-10':    { generic: 'Cetirizine', brand: 'Cetzine', strength: '10mg', form: 'Tab', dose: '10mg', freq: 'HS', dur: '5 days', route: 'Oral', instr: 'Bedtime' },
  'ambroxol-30':      { generic: 'Ambroxol', brand: 'Ambrodil', strength: '30mg', form: 'Tab', dose: '30mg', freq: 'BD', dur: '5 days', route: 'Oral', instr: 'After food' },
  'montelukast-10':   { generic: 'Montelukast', brand: 'Montair', strength: '10mg', form: 'Tab', dose: '10mg', freq: 'HS', dur: '30 days', route: 'Oral', instr: 'Bedtime' },
  'salbutamol-inhaler': { generic: 'Salbutamol', brand: 'Asthalin', strength: '100mcg', form: 'Inhaler', dose: '2 puffs', freq: 'SOS', dur: '30 days', route: 'Inhalation', instr: 'Shake, use spacer' },
  'budesonide-inhaler': { generic: 'Budesonide', brand: 'Budecort', strength: '200mcg', form: 'Inhaler', dose: '2 puffs', freq: 'BD', dur: '30 days', route: 'Inhalation', instr: 'Rinse mouth after' },
  'levetiracetam-500': { generic: 'Levetiracetam', brand: 'Levipil', strength: '500mg', form: 'Tab', dose: '500mg', freq: 'BD', dur: '30 days', route: 'Oral', instr: 'Do not skip' },
  'sodium-valproate-500': { generic: 'Sod. Valproate', brand: 'Valparin', strength: '500mg', form: 'Tab', dose: '500mg', freq: 'BD', dur: '30 days', route: 'Oral', instr: 'After food' },
  'sumatriptan-50':   { generic: 'Sumatriptan', brand: 'Suminat', strength: '50mg', form: 'Tab', dose: '50mg', freq: 'SOS', dur: 'As needed', route: 'Oral', instr: 'At onset, max 2/day' },
  'amitriptyline-10': { generic: 'Amitriptyline', brand: 'Tryptomer', strength: '10mg', form: 'Tab', dose: '10mg', freq: 'HS', dur: '30 days', route: 'Oral', instr: 'Bedtime' },
  'metformin-500':    { generic: 'Metformin', brand: 'Glycomet', strength: '500mg', form: 'Tab', dose: '500mg', freq: 'BD', dur: '30 days', route: 'Oral', instr: 'After food' },
  'glimepiride-1':    { generic: 'Glimepiride', brand: 'Amaryl', strength: '1mg', form: 'Tab', dose: '1mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Before breakfast' },
  'levothyroxine-50': { generic: 'Levothyroxine', brand: 'Thyronorm', strength: '50mcg', form: 'Tab', dose: '50mcg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Empty stomach, 30 min before food' },
  'thiocolchicoside-4': { generic: 'Thiocolchicoside', brand: 'Myoril', strength: '4mg', form: 'Cap', dose: '4mg', freq: 'BD', dur: '5 days', route: 'Oral', instr: 'After food' },
  'glucosamine-1500': { generic: 'Glucosamine', brand: 'Jointace', strength: '1500mg', form: 'Tab', dose: '1500mg', freq: 'OD', dur: '90 days', route: 'Oral', instr: 'With food' },
  'ferrous-sulphate-200': { generic: 'Ferrous Sulphate', brand: 'Autrin', strength: '200mg', form: 'Tab', dose: '200mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'After food, with vitamin C' },
  'folic-acid-5':     { generic: 'Folic Acid', brand: 'Folvite', strength: '5mg', form: 'Tab', dose: '5mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'After food' },
  'vitamin-c-500':    { generic: 'Vitamin C', brand: 'Limcee', strength: '500mg', form: 'Tab', dose: '500mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'After food' },
  'ors-packet':       { generic: 'ORS', brand: 'Electral', strength: 'Sachet', form: 'Sachet', dose: '1 in 1L water', freq: 'After each stool', dur: '3 days', route: 'Oral', instr: 'Sip frequently' },
  'probiotics':       { generic: 'S. Boulardii', brand: 'Econorm', strength: '250mg', form: 'Cap', dose: '250mg', freq: 'BD', dur: '5 days', route: 'Oral', instr: 'Before food' },
  'escitalopram-10':  { generic: 'Escitalopram', brand: 'Nexito', strength: '10mg', form: 'Tab', dose: '10mg', freq: 'OD', dur: '30 days', route: 'Oral', instr: 'Morning' },
};

// ============================================================
// VOICE HOOK
// ============================================================

function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported. Use Chrome.'); return; }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onResult(text);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening };
}

// ============================================================
// SMALL COMPONENTS
// ============================================================

const MicButton = ({ onResult, className = '' }: { onResult: (t: string) => void; className?: string }) => {
  const { isListening, startListening, stopListening } = useVoice();
  return (
    <button
      type="button"
      onClick={() => isListening ? stopListening() : startListening(onResult)}
      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all
        ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}
        ${className}`}
      title={isListening ? 'Stop listening' : 'Voice input'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    </button>
  );
};

const Chip = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap
      ${selected
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
      }`}
  >
    {label}
  </button>
);

const SectionHeader = ({ number, title, icon }: { number: number; title: string; icon: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
      {number}
    </div>
    <span className="text-lg">{icon}</span>
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
  </div>
);

// ============================================================
// MAIN EMR PAGE
// ============================================================

export default function EMRv2Page() {
  // --- Patient context (would come from HMIS patient list) ---
  const [patient] = useState({
    name: 'Patient Name',
    age: '--',
    gender: '--',
    uhid: 'H1-00000',
    phone: '',
  });

  // --- Section states ---
  const [vitals, setVitals] = useState<VitalValues>({
    systolic: '', diastolic: '', heartRate: '', spo2: '', temperature: '', weight: '', height: '', respiratoryRate: '',
  });
  const [complaints, setComplaints] = useState<ComplaintEntry[]>([]);
  const [complaintSearch, setComplaintSearch] = useState('');
  const [examEntries, setExamEntries] = useState<ExamEntry[]>([]);
  const [expandedExamSystem, setExpandedExamSystem] = useState<string | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([]);
  const [diagSearch, setDiagSearch] = useState('');
  const [investigations, setInvestigations] = useState<InvestigationEntry[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionEntry[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [followUp, setFollowUp] = useState<FollowUpData>({ date: '', notes: '', advice: [] });
  const [adviceInput, setAdviceInput] = useState('');

  // --- Autofill tracking ---
  const [autofillApplied, setAutofillApplied] = useState(false);

  // --- BMI calc ---
  const bmi = vitals.weight && vitals.height
    ? (parseFloat(vitals.weight) / ((parseFloat(vitals.height) / 100) ** 2)).toFixed(1)
    : null;

  // --- Complaint search results ---
  const complaintResults = complaintSearch.length >= 2
    ? COMPLAINT_TEMPLATES.filter(c =>
        c.label.toLowerCase().includes(complaintSearch.toLowerCase()) ||
        c.keywords.some(k => k.includes(complaintSearch.toLowerCase()))
      )
    : [];

  // --- Diagnosis search results ---
  const diagResults = diagSearch.length >= 2
    ? DIAGNOSES_DB.filter(d =>
        d.code.toLowerCase().includes(diagSearch.toLowerCase()) ||
        d.label.toLowerCase().includes(diagSearch.toLowerCase()) ||
        d.kw.some(k => k.includes(diagSearch.toLowerCase()))
      ).slice(0, 8)
    : [];

  // --- Med search results ---
  const medResults = medSearch.length >= 2
    ? Object.entries(MEDS_DB).filter(([id, m]) =>
        m.generic.toLowerCase().includes(medSearch.toLowerCase()) ||
        m.brand.toLowerCase().includes(medSearch.toLowerCase()) ||
        id.includes(medSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  // --- Add complaint ---
  const addComplaint = (template: typeof COMPLAINT_TEMPLATES[0]) => {
    setComplaints(prev => [...prev, {
      complaint: template.label,
      duration: '',
      hpiNotes: '',
      selectedChips: [],
    }]);
    setComplaintSearch('');
  };

  // --- Add diagnosis with autofill ---
  const addDiagnosis = (diag: typeof DIAGNOSES_DB[0]) => {
    if (diagnoses.some(d => d.code === diag.code)) return;
    setDiagnoses(prev => [...prev, {
      code: diag.code,
      label: diag.label,
      type: prev.length === 0 ? 'primary' : 'secondary',
    }]);

    // Autofill: labs
    const newLabs = diag.labs.filter(l => !investigations.some(i => i.name === l));
    if (newLabs.length) {
      setInvestigations(prev => [...prev, ...newLabs.map(l => ({ name: l, urgency: 'routine' as const, notes: '' }))]);
    }

    // Autofill: meds
    const newMeds = diag.meds
      .filter(mid => MEDS_DB[mid] && !prescriptions.some(p => p.id === mid))
      .map(mid => {
        const m = MEDS_DB[mid];
        return { id: mid, generic: m.generic, brand: m.brand, strength: m.strength, form: m.form, dose: m.dose, frequency: m.freq, duration: m.dur, route: m.route, instructions: m.instr };
      });
    if (newMeds.length) {
      setPrescriptions(prev => [...prev, ...newMeds]);
    }

    // Autofill: advice
    const newAdvice = diag.advice.filter(a => !followUp.advice.includes(a));
    if (newAdvice.length) {
      setFollowUp(prev => ({ ...prev, advice: [...prev.advice, ...newAdvice] }));
    }

    // Autofill: expand exam focus
    diag.examFocus.forEach(sys => {
      if (!examEntries.some(e => e.system === sys)) {
        setExamEntries(prev => [...prev, { system: sys, findings: [], notes: '' }]);
      }
    });

    setAutofillApplied(true);
    setTimeout(() => setAutofillApplied(false), 2000);
    setDiagSearch('');
  };

  // --- Add med manually ---
  const addMed = (id: string, m: typeof MEDS_DB[string]) => {
    if (prescriptions.some(p => p.id === id)) return;
    setPrescriptions(prev => [...prev, {
      id, generic: m.generic, brand: m.brand, strength: m.strength, form: m.form,
      dose: m.dose, frequency: m.freq, duration: m.dur, route: m.route, instructions: m.instr,
    }]);
    setMedSearch('');
  };

  // --- Generate Rx PDF ---
  const generateRxPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rxHtml = `<!DOCTYPE html>
<html><head><title>Prescription — ${patient.name}</title>
<style>
  @page { size: A5; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; }
  body { padding: 8mm; color: #1a1a1a; font-size: 10px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 10px; }
  .logo-area { width: 60px; height: 60px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #999; }
  .hospital-name { font-size: 16px; font-weight: 700; color: #1e40af; }
  .hospital-sub { font-size: 8px; color: #666; }
  .patient-row { display: flex; gap: 16px; margin-bottom: 6px; font-size: 10px; }
  .patient-row b { color: #1e40af; }
  .section-title { font-size: 11px; font-weight: 700; color: #1e40af; margin: 10px 0 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
  .rx-symbol { font-size: 18px; font-weight: 700; color: #1e40af; margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { background: #eff6ff; color: #1e40af; text-align: left; padding: 3px 4px; border-bottom: 1px solid #1e40af; }
  td { padding: 3px 4px; border-bottom: 1px solid #e5e7eb; }
  .advice-list { list-style: none; padding: 0; }
  .advice-list li { padding: 2px 0; font-size: 9px; }
  .advice-list li::before { content: '• '; color: #1e40af; font-weight: 700; }
  .footer { margin-top: 20px; text-align: right; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  .sig-line { width: 120px; border-bottom: 1px solid #333; margin-left: auto; margin-bottom: 4px; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  <div style="display:flex;gap:10px;align-items:center">
    <div class="logo-area">LOGO</div>
    <div>
      <div class="hospital-name">Health1 Super Speciality Hospitals</div>
      <div class="hospital-sub">Shilaj, Ahmedabad • health1hospitals.com</div>
    </div>
  </div>
  <div style="text-align:right;font-size:9px;color:#666">
    Date: ${new Date().toLocaleDateString('en-IN')}<br/>
    Time: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
  </div>
</div>

<div class="patient-row"><b>Name:</b> ${patient.name} &nbsp;&nbsp; <b>Age/Sex:</b> ${patient.age}/${patient.gender} &nbsp;&nbsp; <b>UHID:</b> ${patient.uhid}</div>

${vitals.systolic ? `<div class="patient-row"><b>Vitals:</b> BP ${vitals.systolic}/${vitals.diastolic} mmHg &nbsp; HR ${vitals.heartRate}/min &nbsp; SpO2 ${vitals.spo2}% &nbsp; Temp ${vitals.temperature}°F &nbsp; Wt ${vitals.weight} kg</div>` : ''}

${diagnoses.length ? `<div class="section-title">Diagnosis</div><div style="font-size:10px">${diagnoses.map(d => `${d.code} — ${d.label} (${d.type})`).join('<br/>')}</div>` : ''}

${prescriptions.length ? `
<div class="section-title"><span class="rx-symbol">℞</span> Prescription</div>
<table>
<tr><th>#</th><th>Medication</th><th>Dose</th><th>Freq</th><th>Duration</th><th>Instructions</th></tr>
${prescriptions.map((p, i) => `<tr><td>${i + 1}</td><td><b>${p.brand}</b> (${p.generic}) ${p.strength}</td><td>${p.dose}</td><td>${p.frequency}</td><td>${p.duration}</td><td>${p.instructions}</td></tr>`).join('')}
</table>` : ''}

${investigations.length ? `<div class="section-title">Investigations</div><div style="font-size:9px">${investigations.map(i => `${i.name}${i.urgency !== 'routine' ? ` [${i.urgency.toUpperCase()}]` : ''}`).join(', ')}</div>` : ''}

${followUp.advice.length ? `<div class="section-title">Advice</div><ul class="advice-list">${followUp.advice.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}

${followUp.date ? `<div style="margin-top:6px;font-size:9px"><b>Follow-up:</b> ${followUp.date} ${followUp.notes ? `— ${followUp.notes}` : ''}</div>` : ''}

<div class="footer">
  <div class="sig-line"></div>
  <div style="font-size:9px;color:#666">Doctor's Signature & Stamp</div>
</div>
</body></html>`;
    w.document.write(rxHtml);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{patient.name}</div>
              <div className="text-xs text-gray-500">{patient.age}/{patient.gender} • {patient.uhid}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateRxPDF}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print Rx
            </button>
            <button className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Autofill toast */}
      {autofillApplied && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-bounce">
          ✨ Autofill applied — meds, labs, advice, exam focus added
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* ========== 1. VITALS ========== */}
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <SectionHeader number={1} title="Vitals" icon="🩺" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'systolic', label: 'Systolic', unit: 'mmHg', ph: '120' },
              { key: 'diastolic', label: 'Diastolic', unit: 'mmHg', ph: '80' },
              { key: 'heartRate', label: 'Heart Rate', unit: '/min', ph: '72' },
              { key: 'spo2', label: 'SpO₂', unit: '%', ph: '98' },
              { key: 'temperature', label: 'Temp', unit: '°F', ph: '98.6' },
              { key: 'weight', label: 'Weight', unit: 'kg', ph: '70' },
              { key: 'height', label: 'Height', unit: 'cm', ph: '170' },
              { key: 'respiratoryRate', label: 'RR', unit: '/min', ph: '16' },
            ].map(v => (
              <div key={v.key} className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1">{v.label}</label>
                <div className="flex items-center">
                  <input
                    type="number"
                    placeholder={v.ph}
                    value={(vitals as any)[v.key]}
                    onChange={e => setVitals(prev => ({ ...prev, [v.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="ml-1 text-xs text-gray-400 shrink-0">{v.unit}</span>
                </div>
              </div>
            ))}
          </div>
          {bmi && (
            <div className="mt-3 text-sm text-gray-600">
              BMI: <span className={`font-semibold ${parseFloat(bmi) > 25 ? 'text-orange-600' : parseFloat(bmi) < 18.5 ? 'text-yellow-600' : 'text-green-600'}`}>{bmi}</span>
              <span className="text-xs ml-1">
                ({parseFloat(bmi) < 18.5 ? 'Underweight' : parseFloat(bmi) < 25 ? 'Normal' : parseFloat(bmi) < 30 ? 'Overweight' : 'Obese'})
              </span>
            </div>
          )}
        </section>

        {/* ========== 2. CHIEF COMPLAINTS ========== */}
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <SectionHeader number={2} title="Chief Complaints & HPI" icon="📋" />
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Type complaint (e.g., fever, chest pain)..."
                value={complaintSearch}
                onChange={e => setComplaintSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {complaintResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {complaintResults.map(c => (
                    <button key={c.label} onClick={() => addComplaint(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <MicButton onResult={t => setComplaintSearch(t)} />
          </div>

          {/* Quick complaint chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {['Fever', 'Cough', 'Breathlessness', 'Chest Pain', 'Headache', 'Abdominal Pain', 'Vomiting', 'Back Pain'].map(label => {
              const tpl = COMPLAINT_TEMPLATES.find(c => c.label === label);
              return tpl && (
                <button key={label} onClick={() => addComplaint(tpl)}
                  className="px-2.5 py-1 rounded-full text-xs border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  + {label}
                </button>
              );
            })}
          </div>

          {/* Added complaints */}
          {complaints.map((c, idx) => {
            const tpl = COMPLAINT_TEMPLATES.find(t => t.label === c.complaint);
            return (
              <div key={idx} className="border rounded-lg p-3 mb-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-900">{c.complaint}</span>
                  <button onClick={() => setComplaints(prev => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-600 text-xs">✕ Remove</button>
                </div>
                {tpl && (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-xs text-gray-400 self-center mr-1">Duration:</span>
                      {tpl.durationOptions.map(d => (
                        <Chip key={d} label={d} selected={c.duration === d}
                          onClick={() => {
                            const updated = [...complaints];
                            updated[idx] = { ...updated[idx], duration: d };
                            setComplaints(updated);
                          }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-xs text-gray-400 self-center mr-1">HPI:</span>
                      {tpl.hpiChips.map(h => (
                        <Chip key={h} label={h} selected={c.selectedChips.includes(h)}
                          onClick={() => {
                            const updated = [...complaints];
                            const chips = updated[idx].selectedChips.includes(h)
                              ? updated[idx].selectedChips.filter(x => x !== h)
                              : [...updated[idx].selectedChips, h];
                            updated[idx] = { ...updated[idx], selectedChips: chips };
                            setComplaints(updated);
                          }} />
                      ))}
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Additional HPI notes..."
                    value={c.hpiNotes}
                    onChange={e => {
                      const updated = [...complaints];
                      updated[idx] = { ...updated[idx], hpiNotes: e.target.value };
                      setComplaints(updated);
                    }}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <MicButton onResult={t => {
                    const updated = [...complaints];
                    updated[idx] = { ...updated[idx], hpiNotes: updated[idx].hpiNotes + ' ' + t };
                    setComplaints(updated);
                  }} />
                </div>
              </div>
            );
          })}
        </section>

        {/* ========== 3. EXAMINATION ========== */}
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <SectionHeader number={3} title="Examination Findings" icon="🔍" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {EXAM_SYSTEMS.map(sys => (
              <button key={sys.key}
                onClick={() => {
                  if (!examEntries.some(e => e.system === sys.key)) {
                    setExamEntries(prev => [...prev, { system: sys.key, findings: [], notes: '' }]);
                  }
                  setExpandedExamSystem(expandedExamSystem === sys.key ? null : sys.key);
                }}
                className={`px-3 py-2 rounded-lg text-sm border transition-all flex items-center gap-2
                  ${examEntries.some(e => e.system === sys.key)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-blue-400 text-gray-600'
                  } ${expandedExamSystem === sys.key ? 'ring-2 ring-blue-500' : ''}`}
              >
                <span>{sys.icon}</span> {sys.label}
                {examEntries.find(e => e.system === sys.key)?.findings.length ? (
                  <span className="ml-auto bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {examEntries.find(e => e.system === sys.key)!.findings.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {expandedExamSystem && (() => {
            const sys = EXAM_SYSTEMS.find(s => s.key === expandedExamSystem);
            const entry = examEntries.find(e => e.system === expandedExamSystem);
            if (!sys || !entry) return null;
            return (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-medium text-sm mb-3">{sys.icon} {sys.label} Examination</h3>
                {sys.findings.map(f => (
                  <div key={f.label} className="mb-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">{f.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip label={`✓ ${f.normal}`} selected={entry.findings.includes(f.normal)}
                        onClick={() => {
                          setExamEntries(prev => prev.map(e =>
                            e.system === expandedExamSystem
                              ? { ...e, findings: e.findings.includes(f.normal) ? e.findings.filter(x => x !== f.normal) : [...e.findings.filter(x => !f.abnormal.includes(x)), f.normal] }
                              : e
                          ));
                        }} />
                      {f.abnormal.map(ab => (
                        <Chip key={ab} label={ab} selected={entry.findings.includes(ab)}
                          onClick={() => {
                            setExamEntries(prev => prev.map(e =>
                              e.system === expandedExamSystem
                                ? { ...e, findings: e.findings.includes(ab) ? e.findings.filter(x => x !== ab) : [...e.findings.filter(x => x !== f.normal), ab] }
                                : e
                            ));
                          }} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text" placeholder="Additional notes..."
                    value={entry.notes}
                    onChange={e => setExamEntries(prev => prev.map(ex => ex.system === expandedExamSystem ? { ...ex, notes: e.target.value } : ex))}
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <MicButton onResult={t => setExamEntries(prev => prev.map(ex => ex.system === expandedExamSystem ? { ...ex, notes: ex.notes + ' ' + t } : ex))} />
                </div>
              </div>
            );
          })()}
        </section>

        {/* ========== 4. DIAGNOSIS ========== */}
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <SectionHeader number={4} title="Diagnosis (ICD-10)" icon="🎯" />
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search diagnosis (e.g., hypertension, I10, diabetes)..."
                value={diagSearch}
                onChange={e => setDiagSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {diagResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {diagResults.map(d => (
                    <button key={d.code} onClick={() => addDiagnosis(d)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0 flex justify-between">
                      <span>{d.label}</span>
                      <span className="text-xs text-gray-400 font-mono">{d.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <MicButton onResult={t => setDiagSearch(t)} />
          </div>
          <p className="text-xs text-gray-400 mb-3">Selecting a diagnosis auto-fills medications, investigations, advice, and exam focus.</p>

          {diagnoses.map((d, idx) => (
            <div key={d.code} className="flex items-center gap-3 p-2 border rounded-lg mb-2 bg-gray-50">
              <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{d.code}</span>
              <span className="text-sm flex-1">{d.label}</span>
              <select
                value={d.type}
                onChange={e => {
                  const updated = [...diagnoses];
                  updated[idx] = { ...updated[idx], type: e.target.value as 'primary' | 'secondary' };
                  setDiagnoses(updated);
                }}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
              <button onClick={() => setDiagnoses(prev => prev.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </section>

        {/* ========== 5. INVESTIGATIONS ========== */}
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <SectionHeader number={5} title="Investigations / Lab Orders" icon="🔬" />
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Add investigation..."
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  setInvestigations(prev => [...prev, { name: (e.target as HTMLInputElement).value.trim(), urgency: 'routine', notes: '' }]);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <MicButton onResult={t => setInvestigations(prev => [...prev, { name: t, urgency: 'routine', notes: '' }])} />
          </div>

          {investigations.map((inv, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg mb-2 bg-gray-50">
              <span className="text-sm flex-1">{inv.name}</span>
              <select
                value={inv.urgency}
                onChange={e => {
                  const updated = [...investigations];
                  updated[idx] = { ...updated[idx], urgency: e.target.value as any };
                  setInvestigations(updated);
                }}
                className={`text-xs border rounded px-2 py-1 ${inv.urgency === 'stat' ? 'text-red-600 border-red-300' : inv.urgency === 'urgent' ? 'text-orange-600 border-orange-300' : ''}`}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
              <button onClick={() => setInvestigations(prev => prev.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </section>

        {/* ========== 6. PRESCRIPTION ========== */}
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <SectionHeader number={6} title="Prescription (℞)" icon="💊" />
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search medication (generic or brand)..."
                value={medSearch}
                onChange={e => setMedSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {medResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {medResults.map(([id, m]) => (
                    <button key={id} onClick={() => addMed(id, m)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0 flex justify-between">
                      <span><strong>{m.brand}</strong> ({m.generic}) {m.strength}</span>
                      <span className="text-xs text-gray-400">{m.form}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <MicButton onResult={t => setMedSearch(t)} />
          </div>

          {prescriptions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 font-medium text-gray-500">#</th>
                    <th className="text-left p-2 font-medium text-gray-500">Medication</th>
                    <th className="text-left p-2 font-medium text-gray-500">Dose</th>
                    <th className="text-left p-2 font-medium text-gray-500">Freq</th>
                    <th className="text-left p-2 font-medium text-gray-500">Duration</th>
                    <th className="text-left p-2 font-medium text-gray-500">Instructions</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((p, idx) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 text-gray-400">{idx + 1}</td>
                      <td className="p-2">
                        <div className="font-medium">{p.brand} ({p.generic})</div>
                        <div className="text-gray-400">{p.strength} • {p.form}</div>
                      </td>
                      <td className="p-2">
                        <input value={p.dose} onChange={e => { const u = [...prescriptions]; u[idx] = { ...u[idx], dose: e.target.value }; setPrescriptions(u); }}
                          className="w-16 px-1 py-0.5 border rounded text-xs" />
                      </td>
                      <td className="p-2">
                        <select value={p.frequency} onChange={e => { const u = [...prescriptions]; u[idx] = { ...u[idx], frequency: e.target.value }; setPrescriptions(u); }}
                          className="px-1 py-0.5 border rounded text-xs">
                          {['OD', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'Stat', 'Once a week'].map(f => <option key={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input value={p.duration} onChange={e => { const u = [...prescriptions]; u[idx] = { ...u[idx], duration: e.target.value }; setPrescriptions(u); }}
                          className="w-16 px-1 py-0.5 border rounded text-xs" />
                      </td>
                      <td className="p-2">
                        <input value={p.instructions} onChange={e => { const u = [...prescriptions]; u[idx] = { ...u[idx], instructions: e.target.value }; setPrescriptions(u); }}
                          className="w-32 px-1 py-0.5 border rounded text-xs" />
                      </td>
                      <td className="p-2">
                        <button onClick={() => setPrescriptions(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ========== 7. FOLLOW-UP & ADVICE ========== */}
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <SectionHeader number={7} title="Follow-up & Advice" icon="📅" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Date</label>
              <input type="date" value={followUp.date}
                onChange={e => setFollowUp(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Notes</label>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g., With reports" value={followUp.notes}
                  onChange={e => setFollowUp(prev => ({ ...prev, notes: e.target.value }))}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <MicButton onResult={t => setFollowUp(prev => ({ ...prev, notes: prev.notes + ' ' + t }))} />
              </div>
            </div>
          </div>

          <label className="block text-xs font-medium text-gray-500 mb-1">Advice / Instructions</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Add advice (or type and press Enter)..."
              value={adviceInput}
              onChange={e => setAdviceInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && adviceInput.trim()) {
                  setFollowUp(prev => ({ ...prev, advice: [...prev.advice, adviceInput.trim()] }));
                  setAdviceInput('');
                }
              }}
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <MicButton onResult={t => setFollowUp(prev => ({ ...prev, advice: [...prev.advice, t] }))} />
            <button onClick={() => { if (adviceInput.trim()) { setFollowUp(prev => ({ ...prev, advice: [...prev.advice, adviceInput.trim()] })); setAdviceInput(''); } }}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">Add</button>
          </div>

          {followUp.advice.map((a, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg mb-1.5 bg-gray-50">
              <span className="text-sm flex-1">• {a}</span>
              <button onClick={() => setFollowUp(prev => ({ ...prev, advice: prev.advice.filter((_, i) => i !== idx) }))}
                className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </section>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
