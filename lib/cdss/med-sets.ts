// lib/cdss/med-sets.ts
// Pre-built medication sets for common clinical scenarios

export interface MedSet {
  id: string;
  name: string;
  category: string;
  description: string;
  meds: string[];   // medication IDs
  labs: string[];    // investigation names
}

export const MED_SETS: MedSet[] = [
  {
    id: 'htn-basic', name: 'HTN Basic', category: 'Cardiovascular',
    description: 'First-line hypertension management',
    meds: ['amlodipine-5', 'telmisartan-40'],
    labs: ['CBC', 'RFT', 'Serum Electrolytes', 'Lipid Profile', 'ECG', 'Echocardiography'],
  },
  {
    id: 'htn-triple', name: 'HTN Triple Therapy', category: 'Cardiovascular',
    description: 'Resistant hypertension — ARB + CCB + Diuretic',
    meds: ['telmisartan-40', 'amlodipine-5', 'hydrochlorothiazide-12.5'],
    labs: ['CBC', 'RFT', 'Serum Electrolytes', 'Lipid Profile', 'ECG', 'Echocardiography', 'Urine Microalbumin'],
  },
  {
    id: 'post-ptca', name: 'Post-PTCA / Post-ACS', category: 'Cardiovascular',
    description: 'Dual antiplatelet + statin + beta-blocker + ACEi',
    meds: ['aspirin-75', 'clopidogrel-75', 'atorvastatin-80', 'metoprolol-25', 'ramipril-2.5', 'pantoprazole-40'],
    labs: ['CBC', 'RFT', 'Lipid Profile', 'ECG', 'Echocardiography', 'HbA1c'],
  },
  {
    id: 'chf', name: 'Heart Failure', category: 'Cardiovascular',
    description: 'Guideline-directed medical therapy for HFrEF',
    meds: ['ramipril-2.5', 'metoprolol-25', 'furosemide-40', 'spironolactone-25'],
    labs: ['BNP / NT-proBNP', 'Echocardiography', 'Chest X-ray', 'ECG', 'RFT', 'Serum Electrolytes', 'LFT'],
  },
  {
    id: 'af', name: 'Atrial Fibrillation', category: 'Cardiovascular',
    description: 'Rate control + anticoagulation',
    meds: ['metoprolol-50', 'apixaban-5'],
    labs: ['ECG', 'Echocardiography', 'Thyroid Profile', 'INR', 'CBC', 'RFT'],
  },
  {
    id: 'dm-basic', name: 'DM Basic', category: 'Endocrine',
    description: 'First-line T2DM — Metformin + SU',
    meds: ['metformin-500', 'glimepiride-1'],
    labs: ['FBS / PPBS', 'HbA1c', 'Lipid Profile', 'RFT', 'Urine Microalbumin', 'Fundoscopy', 'ECG'],
  },
  {
    id: 'dm-triple', name: 'DM Triple Oral', category: 'Endocrine',
    description: 'Metformin + SU + DPP4i',
    meds: ['metformin-500', 'glimepiride-1', 'vildagliptin-50'],
    labs: ['FBS / PPBS', 'HbA1c', 'Lipid Profile', 'RFT', 'LFT', 'Urine Microalbumin', 'Fundoscopy'],
  },
  {
    id: 'dm-insulin', name: 'DM + Basal Insulin', category: 'Endocrine',
    description: 'Oral agents + bedtime Glargine',
    meds: ['metformin-500', 'glimepiride-1', 'insulin-glargine'],
    labs: ['FBS / PPBS', 'HbA1c', 'RFT', 'Lipid Profile', 'C-Peptide', 'Urine Microalbumin'],
  },
  {
    id: 'hypothyroid', name: 'Hypothyroidism', category: 'Endocrine',
    description: 'Levothyroxine replacement',
    meds: ['levothyroxine-50'],
    labs: ['TSH, FT3, FT4', 'Lipid Profile', 'CBC'],
  },
  {
    id: 'fever-workup', name: 'Fever Workup', category: 'Infectious',
    description: 'Empiric fever management + investigations',
    meds: ['paracetamol-500', 'pantoprazole-40'],
    labs: ['CBC', 'CRP', 'ESR', 'Blood Culture', 'Widal Test', 'Malaria Rapid Test', 'Dengue NS1 + IgM', 'Urine Routine', 'Chest X-ray'],
  },
  {
    id: 'age-mild', name: 'AGE (Mild)', category: 'Infectious',
    description: 'Acute gastroenteritis — mild to moderate',
    meds: ['ondansetron-4', 'racecadotril-100', 'ors-packet', 'probiotics'],
    labs: ['Stool Routine', 'CBC', 'Serum Electrolytes'],
  },
  {
    id: 'uti', name: 'UTI', category: 'Infectious',
    description: 'Uncomplicated urinary tract infection',
    meds: ['nitrofurantoin-100', 'paracetamol-500'],
    labs: ['Urine Routine', 'Urine C/S', 'CBC', 'RFT', 'USG KUB'],
  },
  {
    id: 'pneumonia', name: 'CAP (Community)', category: 'Respiratory',
    description: 'Community-acquired pneumonia — outpatient',
    meds: ['amoxicillin-500', 'azithromycin-500', 'paracetamol-500', 'pantoprazole-40'],
    labs: ['Chest X-ray PA', 'CBC', 'CRP', 'Blood Culture', 'Sputum C/S', 'RFT'],
  },
  {
    id: 'asthma-acute', name: 'Asthma Acute', category: 'Respiratory',
    description: 'Acute asthma exacerbation',
    meds: ['salbutamol-inhaler', 'budesonide-inhaler', 'prednisolone-40', 'montelukast-10'],
    labs: ['Spirometry / PFT', 'Chest X-ray', 'CBC', 'ABG (if severe)'],
  },
  {
    id: 'lbp', name: 'Low Back Pain', category: 'MSK',
    description: 'Acute mechanical low back pain',
    meds: ['aceclofenac-100', 'thiocolchicoside-4', 'paracetamol-500', 'pantoprazole-40'],
    labs: ['X-ray LS Spine', 'Vitamin D', 'CBC'],
  },
  {
    id: 'oa-knee', name: 'OA Knee', category: 'MSK',
    description: 'Osteoarthritis knee — conservative',
    meds: ['aceclofenac-100', 'paracetamol-500', 'glucosamine-1500', 'pantoprazole-40'],
    labs: ['X-ray Knee (standing)', 'Vitamin D', 'Uric Acid', 'CBC', 'ESR'],
  },
  {
    id: 'migraine-acute', name: 'Migraine Acute', category: 'Neurological',
    description: 'Acute migraine + prophylaxis',
    meds: ['sumatriptan-50', 'paracetamol-500', 'domperidone-10', 'amitriptyline-10'],
    labs: ['MRI Brain (if new onset / atypical)'],
  },
  {
    id: 'epilepsy-new', name: 'Epilepsy (New)', category: 'Neurological',
    description: 'New-onset seizures — first-line',
    meds: ['levetiracetam-500'],
    labs: ['EEG', 'MRI Brain', 'CBC', 'LFT', 'RFT', 'Serum Electrolytes'],
  },
  {
    id: 'stroke-secondary', name: 'Stroke Secondary Prevention', category: 'Neurological',
    description: 'Post-stroke — antiplatelet + statin + ACEi',
    meds: ['aspirin-75', 'clopidogrel-75', 'atorvastatin-40', 'ramipril-5'],
    labs: ['MRI Brain (follow-up)', 'Carotid Doppler', 'Lipid Profile', 'HbA1c', 'ECG', 'Echo'],
  },
  {
    id: 'anemia-iron', name: 'Iron Deficiency Anemia', category: 'Hematological',
    description: 'Oral iron replacement + workup',
    meds: ['ferrous-sulphate-200', 'folic-acid-5', 'vitamin-c-500'],
    labs: ['CBC + PS', 'Serum Ferritin', 'Serum Iron', 'TIBC', 'Reticulocyte Count', 'Stool Occult Blood'],
  },
  {
    id: 'gerd', name: 'GERD', category: 'GI',
    description: 'Acid reflux management',
    meds: ['pantoprazole-40', 'domperidone-10'],
    labs: ['UGI Endoscopy (if >4 weeks)', 'H. Pylori test'],
  },
];

export function searchMedSets(query: string): MedSet[] {
  const q = query.toLowerCase();
  return MED_SETS.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.category.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.id.includes(q)
  );
}
