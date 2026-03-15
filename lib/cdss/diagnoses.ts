// lib/cdss/diagnoses.ts
// Diagnosis database with ICD-10 codes and autofill mappings

export interface DiagnosisEntry {
  code: string;
  label: string;
  category: string;
  keywords: string[];
  suggestedMeds: string[];       // medication IDs from medications.ts
  suggestedLabs: string[];       // investigation names
  suggestedAdvice: string[];     // advice strings
  examFocus: string[];           // exam system keys to highlight
}

export const DIAGNOSES: DiagnosisEntry[] = [
  // --- Cardiovascular ---
  { code: 'I10', label: 'Essential Hypertension', category: 'Cardiovascular',
    keywords: ['hypertension', 'htn', 'high bp', 'blood pressure'],
    suggestedMeds: ['amlodipine-5', 'telmisartan-40', 'hydrochlorothiazide-12.5'],
    suggestedLabs: ['CBC', 'RFT (Renal Function Test)', 'Serum Electrolytes', 'Lipid Profile', 'ECG', 'Echocardiography', 'Fundoscopy'],
    suggestedAdvice: ['Low salt diet (<5g/day)', 'Regular BP monitoring at home', 'Exercise 30 min/day, 5 days/week', 'Avoid smoking and alcohol', 'Weight reduction if overweight'],
    examFocus: ['cvs', 'general'] },
  { code: 'I20.9', label: 'Angina Pectoris, Unspecified', category: 'Cardiovascular',
    keywords: ['angina', 'chest pain', 'ischemic heart'],
    suggestedMeds: ['aspirin-75', 'atorvastatin-40', 'metoprolol-25', 'isosorbide-dinitrate-10', 'clopidogrel-75'],
    suggestedLabs: ['Troponin I', 'ECG', 'Echocardiography', 'Lipid Profile', 'CBC', 'RFT', 'Treadmill Test'],
    suggestedAdvice: ['Avoid heavy exertion', 'Keep sorbitrate 5mg sublingual handy', 'Low fat diet', 'Stop smoking immediately', 'Follow up in 1 week'],
    examFocus: ['cvs', 'general'] },
  { code: 'I21.9', label: 'Acute Myocardial Infarction, Unspecified', category: 'Cardiovascular',
    keywords: ['mi', 'heart attack', 'myocardial infarction', 'stemi', 'nstemi'],
    suggestedMeds: ['aspirin-150', 'clopidogrel-75', 'atorvastatin-80', 'metoprolol-25', 'ramipril-2.5'],
    suggestedLabs: ['Troponin I (serial)', 'CK-MB', 'ECG (serial)', 'Echocardiography', 'CBC', 'RFT', 'Lipid Profile', 'Coagulation Profile'],
    suggestedAdvice: ['Strict bed rest', 'ICU monitoring', 'Dual antiplatelet therapy', 'Follow up with cardiologist'],
    examFocus: ['cvs', 'general'] },
  { code: 'I50.9', label: 'Heart Failure, Unspecified', category: 'Cardiovascular',
    keywords: ['heart failure', 'chf', 'congestive', 'ccf'],
    suggestedMeds: ['furosemide-40', 'ramipril-2.5', 'metoprolol-25', 'spironolactone-25'],
    suggestedLabs: ['BNP / NT-proBNP', 'Echocardiography', 'Chest X-ray', 'ECG', 'RFT', 'Serum Electrolytes', 'LFT'],
    suggestedAdvice: ['Fluid restriction 1.5L/day', 'Salt restriction <2g/day', 'Daily weight monitoring', 'Elevate head end while sleeping', 'Follow up in 1 week'],
    examFocus: ['cvs', 'rs', 'general'] },
  { code: 'I48', label: 'Atrial Fibrillation', category: 'Cardiovascular',
    keywords: ['af', 'atrial fibrillation', 'afib', 'irregular pulse'],
    suggestedMeds: ['metoprolol-50', 'warfarin-5', 'apixaban-5'],
    suggestedLabs: ['ECG', 'Echocardiography', 'Thyroid Profile', 'INR', 'CBC', 'RFT'],
    suggestedAdvice: ['Regular pulse monitoring', 'INR monitoring if on warfarin', 'Avoid excess caffeine', 'Follow up in 2 weeks'],
    examFocus: ['cvs'] },

  // --- Respiratory ---
  { code: 'J06.9', label: 'Acute Upper Respiratory Infection', category: 'Respiratory',
    keywords: ['urti', 'cold', 'common cold', 'upper respiratory', 'rhinitis'],
    suggestedMeds: ['paracetamol-500', 'cetirizine-10', 'ambroxol-30'],
    suggestedLabs: ['CBC (if persistent)'],
    suggestedAdvice: ['Warm fluids', 'Steam inhalation', 'Rest', 'Gargle with warm salt water', 'Follow up if symptoms persist >5 days'],
    examFocus: ['rs', 'general'] },
  { code: 'J18.9', label: 'Pneumonia, Unspecified', category: 'Respiratory',
    keywords: ['pneumonia', 'chest infection', 'lower respiratory'],
    suggestedMeds: ['amoxicillin-500', 'azithromycin-500', 'paracetamol-500', 'ambroxol-30'],
    suggestedLabs: ['Chest X-ray PA', 'CBC', 'CRP', 'Blood Culture', 'Sputum Culture', 'ABG (if severe)'],
    suggestedAdvice: ['Complete antibiotic course', 'Adequate hydration', 'Deep breathing exercises', 'Follow up with repeat X-ray in 2 weeks'],
    examFocus: ['rs', 'general'] },
  { code: 'J45', label: 'Asthma', category: 'Respiratory',
    keywords: ['asthma', 'bronchospasm', 'wheeze', 'wheezing'],
    suggestedMeds: ['salbutamol-inhaler', 'budesonide-inhaler', 'montelukast-10'],
    suggestedLabs: ['Spirometry / PFT', 'Chest X-ray', 'CBC', 'IgE levels'],
    suggestedAdvice: ['Avoid allergens and triggers', 'Carry rescue inhaler always', 'Inhaler technique education', 'Peak flow monitoring', 'Annual flu vaccine'],
    examFocus: ['rs'] },
  { code: 'J44.1', label: 'COPD with Acute Exacerbation', category: 'Respiratory',
    keywords: ['copd', 'chronic obstructive', 'emphysema', 'chronic bronchitis'],
    suggestedMeds: ['salbutamol-inhaler', 'ipratropium-inhaler', 'prednisolone-40', 'amoxicillin-500', 'azithromycin-500'],
    suggestedLabs: ['Spirometry / PFT', 'Chest X-ray', 'ABG', 'CBC', 'Sputum Culture'],
    suggestedAdvice: ['Smoking cessation mandatory', 'Pulmonary rehabilitation', 'Annual flu and pneumococcal vaccine', 'Inhaler technique review'],
    examFocus: ['rs', 'general'] },

  // --- Neurological ---
  { code: 'G40.9', label: 'Epilepsy, Unspecified', category: 'Neurological',
    keywords: ['epilepsy', 'seizure', 'fits', 'convulsion'],
    suggestedMeds: ['levetiracetam-500', 'sodium-valproate-500', 'phenytoin-100'],
    suggestedLabs: ['EEG', 'MRI Brain', 'CBC', 'LFT', 'RFT', 'Serum Drug Levels'],
    suggestedAdvice: ['Never skip medication', 'Avoid sleep deprivation', 'No driving until seizure-free 1 year', 'Avoid swimming alone', 'Seizure diary maintenance'],
    examFocus: ['cns', 'general'] },
  { code: 'G43.9', label: 'Migraine, Unspecified', category: 'Neurological',
    keywords: ['migraine', 'headache', 'hemicrania'],
    suggestedMeds: ['sumatriptan-50', 'paracetamol-500', 'domperidone-10', 'propranolol-40', 'amitriptyline-10'],
    suggestedLabs: ['MRI Brain (if atypical features)', 'Fundoscopy'],
    suggestedAdvice: ['Maintain headache diary', 'Identify and avoid triggers', 'Regular sleep pattern', 'Adequate hydration', 'Stress management'],
    examFocus: ['cns'] },
  { code: 'I63.9', label: 'Cerebral Infarction, Unspecified', category: 'Neurological',
    keywords: ['stroke', 'cva', 'cerebral infarction', 'paralysis', 'hemiplegia'],
    suggestedMeds: ['aspirin-150', 'clopidogrel-75', 'atorvastatin-40', 'ramipril-5'],
    suggestedLabs: ['CT Brain (plain)', 'MRI Brain + MRA', 'CBC', 'Lipid Profile', 'RFT', 'Coagulation Profile', 'Carotid Doppler', 'Echocardiography', '2D Echo'],
    suggestedAdvice: ['Physiotherapy — start early', 'Speech therapy if needed', 'Fall prevention measures', 'DVT prophylaxis', 'Follow up in 2 weeks'],
    examFocus: ['cns', 'general'] },
  { code: 'G20', label: "Parkinson's Disease", category: 'Neurological',
    keywords: ['parkinson', 'tremor', 'bradykinesia', 'rigidity'],
    suggestedMeds: ['levodopa-carbidopa-110', 'pramipexole-0.25', 'trihexyphenidyl-2'],
    suggestedLabs: ['MRI Brain', 'Thyroid Profile'],
    suggestedAdvice: ['Regular exercise and physiotherapy', 'Fall prevention measures', 'Speech therapy if needed', 'Occupational therapy assessment'],
    examFocus: ['cns', 'msk'] },

  // --- Gastrointestinal ---
  { code: 'K21.0', label: 'GERD with Esophagitis', category: 'Gastrointestinal',
    keywords: ['gerd', 'acid reflux', 'heartburn', 'acidity'],
    suggestedMeds: ['pantoprazole-40', 'domperidone-10', 'antacid-gel'],
    suggestedLabs: ['Upper GI Endoscopy (if persistent)', 'H. Pylori test'],
    suggestedAdvice: ['Avoid spicy/oily food', 'No lying down within 2 hours of meals', 'Elevate head of bed', 'Small frequent meals', 'Avoid late-night eating'],
    examFocus: ['pa', 'general'] },
  { code: 'K29.7', label: 'Gastritis, Unspecified', category: 'Gastrointestinal',
    keywords: ['gastritis', 'stomach pain', 'epigastric pain', 'dyspepsia'],
    suggestedMeds: ['pantoprazole-40', 'sucralfate-1g', 'domperidone-10'],
    suggestedLabs: ['Upper GI Endoscopy', 'H. Pylori test', 'CBC'],
    suggestedAdvice: ['Avoid NSAIDs', 'Regular meal timings', 'Avoid alcohol', 'Bland diet for 1 week'],
    examFocus: ['pa'] },
  { code: 'K80.2', label: 'Cholelithiasis (Gallstones)', category: 'Gastrointestinal',
    keywords: ['gallstones', 'cholelithiasis', 'biliary colic'],
    suggestedMeds: ['ursodeoxycholic-acid-300', 'hyoscine-10', 'paracetamol-500'],
    suggestedLabs: ['USG Abdomen', 'LFT', 'CBC', 'Lipase', 'Amylase'],
    suggestedAdvice: ['Low fat diet', 'Surgical consultation for cholecystectomy', 'Avoid heavy meals'],
    examFocus: ['pa'] },

  // --- Endocrine ---
  { code: 'E11.9', label: 'Type 2 Diabetes Mellitus', category: 'Endocrine',
    keywords: ['diabetes', 'dm', 'sugar', 'hyperglycemia', 't2dm'],
    suggestedMeds: ['metformin-500', 'glimepiride-1', 'vildagliptin-50', 'insulin-glargine'],
    suggestedLabs: ['FBS / PPBS', 'HbA1c', 'Lipid Profile', 'RFT', 'Urine Microalbumin', 'Fundoscopy', 'ECG'],
    suggestedAdvice: ['Diabetic diet — low GI foods', 'Regular exercise 30 min/day', 'Foot care — daily inspection', 'Regular glucose monitoring', 'Annual eye and kidney screening'],
    examFocus: ['general'] },
  { code: 'E03.9', label: 'Hypothyroidism, Unspecified', category: 'Endocrine',
    keywords: ['hypothyroidism', 'thyroid low', 'tsh high'],
    suggestedMeds: ['levothyroxine-50'],
    suggestedLabs: ['Thyroid Profile (TSH, FT3, FT4)', 'Lipid Profile', 'CBC'],
    suggestedAdvice: ['Take medication empty stomach, 30 min before breakfast', 'Repeat TSH after 6 weeks', 'Avoid calcium/iron supplements within 4 hours of dose'],
    examFocus: ['general'] },
  { code: 'E05.9', label: 'Thyrotoxicosis / Hyperthyroidism', category: 'Endocrine',
    keywords: ['hyperthyroidism', 'thyrotoxicosis', 'tsh low', 'graves'],
    suggestedMeds: ['carbimazole-10', 'propranolol-40'],
    suggestedLabs: ['Thyroid Profile (TSH, FT3, FT4)', 'Anti-TPO Antibodies', 'TSH Receptor Antibodies', 'CBC', 'LFT'],
    suggestedAdvice: ['Regular thyroid monitoring every 4-6 weeks', 'Report sore throat/fever immediately (agranulocytosis risk)', 'Avoid iodine-rich foods'],
    examFocus: ['general', 'cvs'] },

  // --- Musculoskeletal ---
  { code: 'M54.5', label: 'Low Back Pain', category: 'Musculoskeletal',
    keywords: ['backache', 'back pain', 'lumbago', 'low back', 'lbp'],
    suggestedMeds: ['aceclofenac-100', 'thiocolchicoside-4', 'paracetamol-500'],
    suggestedLabs: ['X-ray Lumbosacral Spine', 'MRI Lumbosacral Spine (if persistent)', 'Vitamin D levels'],
    suggestedAdvice: ['Avoid prolonged sitting', 'Back strengthening exercises', 'Hot fomentation', 'Firm mattress', 'Physiotherapy referral'],
    examFocus: ['msk', 'cns'] },
  { code: 'M17.9', label: 'Osteoarthritis of Knee', category: 'Musculoskeletal',
    keywords: ['knee pain', 'osteoarthritis', 'oa knee', 'joint pain'],
    suggestedMeds: ['aceclofenac-100', 'paracetamol-500', 'glucosamine-1500'],
    suggestedLabs: ['X-ray Knee (bilateral, standing)', 'Vitamin D levels', 'CBC', 'ESR', 'CRP', 'Uric Acid'],
    suggestedAdvice: ['Quadriceps strengthening exercises', 'Weight reduction', 'Avoid squatting and cross-legged sitting', 'Knee cap during walking', 'Hot fomentation'],
    examFocus: ['msk'] },

  // --- Infectious ---
  { code: 'A09', label: 'Acute Gastroenteritis', category: 'Infectious',
    keywords: ['diarrhea', 'loose motions', 'gastroenteritis', 'vomiting', 'age'],
    suggestedMeds: ['ondansetron-4', 'racecadotril-100', 'ors-packet', 'probiotics', 'ciprofloxacin-500'],
    suggestedLabs: ['Stool Routine', 'Stool Culture', 'CBC', 'Serum Electrolytes', 'RFT'],
    suggestedAdvice: ['ORS after every loose stool', 'BRAT diet (banana, rice, apple, toast)', 'Avoid dairy for 48 hours', 'Follow up if not better in 3 days'],
    examFocus: ['pa', 'general'] },
  { code: 'B50.9', label: 'Malaria (P. Falciparum)', category: 'Infectious',
    keywords: ['malaria', 'fever chills', 'falciparum'],
    suggestedMeds: ['artemether-lumefantrine', 'paracetamol-500'],
    suggestedLabs: ['Malaria Rapid Test', 'Peripheral Smear for MP', 'CBC', 'LFT', 'RFT', 'Bilirubin'],
    suggestedAdvice: ['Complete full course of antimalarials', 'Plenty of fluids', 'Mosquito net usage', 'Follow up in 3 days with repeat smear'],
    examFocus: ['general', 'pa'] },
  { code: 'A01.0', label: 'Typhoid Fever', category: 'Infectious',
    keywords: ['typhoid', 'enteric fever', 'step ladder fever'],
    suggestedMeds: ['ceftriaxone-1g', 'azithromycin-500', 'paracetamol-500'],
    suggestedLabs: ['Widal Test', 'Blood Culture', 'CBC', 'LFT', 'Typhidot IgM'],
    suggestedAdvice: ['Complete antibiotic course', 'Soft bland diet', 'Plenty of fluids', 'Hand hygiene', 'Follow up in 1 week'],
    examFocus: ['pa', 'general'] },
  { code: 'N39.0', label: 'Urinary Tract Infection', category: 'Infectious',
    keywords: ['uti', 'urinary infection', 'burning micturition', 'dysuria'],
    suggestedMeds: ['nitrofurantoin-100', 'ciprofloxacin-500', 'paracetamol-500'],
    suggestedLabs: ['Urine Routine', 'Urine Culture & Sensitivity', 'CBC', 'RFT', 'USG KUB'],
    suggestedAdvice: ['Plenty of water (3L/day)', 'Complete antibiotic course', 'Do not hold urine', 'Personal hygiene', 'Follow up with repeat urine culture'],
    examFocus: ['pa'] },

  // --- Psychiatric ---
  { code: 'F32.9', label: 'Major Depressive Disorder', category: 'Psychiatric',
    keywords: ['depression', 'depressive', 'low mood', 'sadness'],
    suggestedMeds: ['escitalopram-10', 'sertraline-50', 'clonazepam-0.25'],
    suggestedLabs: ['Thyroid Profile', 'Vitamin B12', 'Vitamin D', 'CBC'],
    suggestedAdvice: ['Regular follow-up with psychiatrist', 'Continue medication — do not stop abruptly', 'Regular exercise', 'Adequate sleep', 'Counselling / CBT referral'],
    examFocus: ['cns', 'general'] },
  { code: 'F41.1', label: 'Generalized Anxiety Disorder', category: 'Psychiatric',
    keywords: ['anxiety', 'anxious', 'panic', 'nervousness', 'gad'],
    suggestedMeds: ['escitalopram-10', 'clonazepam-0.25', 'propranolol-20'],
    suggestedLabs: ['Thyroid Profile', 'CBC', 'Vitamin B12'],
    suggestedAdvice: ['Relaxation techniques / deep breathing', 'Limit caffeine', 'Regular exercise', 'Sleep hygiene', 'CBT referral'],
    examFocus: ['general'] },

  // --- Renal ---
  { code: 'N18.9', label: 'Chronic Kidney Disease, Unspecified', category: 'Renal',
    keywords: ['ckd', 'chronic kidney', 'renal failure', 'kidney disease'],
    suggestedMeds: ['telmisartan-40', 'furosemide-40', 'sodium-bicarbonate', 'erythropoietin'],
    suggestedLabs: ['RFT', 'Serum Electrolytes', 'CBC', 'Urine Routine', 'Urine Protein:Creatinine Ratio', 'USG KUB', 'Vitamin D', 'PTH', 'Iron Studies'],
    suggestedAdvice: ['Low protein diet', 'Low salt diet', 'Adequate hydration (as advised)', 'Avoid NSAIDs', 'Nephrology follow-up', 'Monitor BP daily'],
    examFocus: ['general', 'cvs'] },

  // --- Dermatological ---
  { code: 'L30.9', label: 'Dermatitis, Unspecified', category: 'Dermatological',
    keywords: ['dermatitis', 'eczema', 'skin rash', 'itching'],
    suggestedMeds: ['cetirizine-10', 'hydroxyzine-25', 'mometasone-cream'],
    suggestedLabs: ['CBC', 'IgE levels', 'Skin biopsy (if persistent)'],
    suggestedAdvice: ['Moisturize regularly', 'Avoid known allergens', 'Use mild soap', 'Cotton clothing', 'Avoid scratching'],
    examFocus: ['general'] },

  // --- Ophthalmological ---
  { code: 'H10.9', label: 'Conjunctivitis, Unspecified', category: 'Ophthalmological',
    keywords: ['conjunctivitis', 'pink eye', 'eye redness', 'eye discharge'],
    suggestedMeds: ['moxifloxacin-eye-drops', 'artificial-tears'],
    suggestedLabs: ['Eye swab C/S (if severe)'],
    suggestedAdvice: ['Hand hygiene — do not touch eyes', 'Avoid contact lenses', 'Cold compress', 'Do not share towels', 'Follow up in 5 days'],
    examFocus: ['general'] },

  // --- ENT ---
  { code: 'J03.9', label: 'Acute Tonsillitis', category: 'ENT',
    keywords: ['tonsillitis', 'sore throat', 'throat pain', 'pharyngitis'],
    suggestedMeds: ['amoxicillin-500', 'paracetamol-500', 'betadine-gargle'],
    suggestedLabs: ['Throat swab C/S', 'CBC', 'ASO titre (if recurrent)'],
    suggestedAdvice: ['Warm salt water gargle 3-4 times/day', 'Soft diet', 'Complete antibiotic course', 'Adequate fluids', 'ENT referral if recurrent (>3/year)'],
    examFocus: ['general'] },

  // --- Hematological ---
  { code: 'D50.9', label: 'Iron Deficiency Anemia', category: 'Hematological',
    keywords: ['anemia', 'anaemia', 'low hemoglobin', 'iron deficiency'],
    suggestedMeds: ['ferrous-sulphate-200', 'folic-acid-5', 'vitamin-c-500'],
    suggestedLabs: ['CBC with Peripheral Smear', 'Serum Ferritin', 'Serum Iron', 'TIBC', 'Reticulocyte Count', 'Stool Occult Blood'],
    suggestedAdvice: ['Iron-rich diet (green leafy vegetables, jaggery, dates)', 'Take iron with vitamin C for better absorption', 'Avoid tea/coffee with meals', 'Follow up with CBC in 4 weeks'],
    examFocus: ['general'] },
];

// Quick search function
export function searchDiagnoses(query: string): DiagnosisEntry[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return DIAGNOSES.filter(d =>
    d.code.toLowerCase().includes(q) ||
    d.label.toLowerCase().includes(q) ||
    d.keywords.some(k => k.includes(q))
  ).slice(0, 10);
}

// Get by code
export function getDiagnosisByCode(code: string): DiagnosisEntry | undefined {
  return DIAGNOSES.find(d => d.code === code);
}
