'use client';

// ══════════════════════════════════════
// DRUG DATABASE (common Indian hospital drugs)
// ══════════════════════════════════════

export interface DrugSuggestion {
  name: string;
  generic: string;
  strength: string;
  formulation: string;
  default_dose: string;
  default_route: string;
  default_frequency: string;
  default_duration: string;
  instructions: string;
  category: string;
}

export const DRUG_DATABASE: DrugSuggestion[] = [
  // Cardiac
  { name: 'Tab. Ecosprin 75mg', generic: 'Aspirin', strength: '75', formulation: 'tablet', default_dose: '75', default_route: 'oral', default_frequency: 'OD', default_duration: '30', instructions: 'After food', category: 'Cardiac' },
  { name: 'Tab. Ecosprin 150mg', generic: 'Aspirin', strength: '150', formulation: 'tablet', default_dose: '150', default_route: 'oral', default_frequency: 'OD', default_duration: '30', instructions: 'After food', category: 'Cardiac' },
  { name: 'Tab. Clopidogrel 75mg', generic: 'Clopidogrel', strength: '75', formulation: 'tablet', default_dose: '75', default_route: 'oral', default_frequency: 'OD', default_duration: '30', instructions: 'After food', category: 'Cardiac' },
  { name: 'Tab. Atorvastatin 10mg', generic: 'Atorvastatin', strength: '10', formulation: 'tablet', default_dose: '10', default_route: 'oral', default_frequency: 'HS', default_duration: '30', instructions: 'At bedtime', category: 'Cardiac' },
  { name: 'Tab. Atorvastatin 20mg', generic: 'Atorvastatin', strength: '20', formulation: 'tablet', default_dose: '20', default_route: 'oral', default_frequency: 'HS', default_duration: '30', instructions: 'At bedtime', category: 'Cardiac' },
  { name: 'Tab. Atorvastatin 40mg', generic: 'Atorvastatin', strength: '40', formulation: 'tablet', default_dose: '40', default_route: 'oral', default_frequency: 'HS', default_duration: '30', instructions: 'At bedtime', category: 'Cardiac' },
  { name: 'Tab. Metoprolol 25mg', generic: 'Metoprolol', strength: '25', formulation: 'tablet', default_dose: '25', default_route: 'oral', default_frequency: 'BD', default_duration: '30', instructions: '', category: 'Cardiac' },
  { name: 'Tab. Metoprolol 50mg', generic: 'Metoprolol', strength: '50', formulation: 'tablet', default_dose: '50', default_route: 'oral', default_frequency: 'BD', default_duration: '30', instructions: '', category: 'Cardiac' },
  { name: 'Tab. Amlodipine 5mg', generic: 'Amlodipine', strength: '5', formulation: 'tablet', default_dose: '5', default_route: 'oral', default_frequency: 'OD', default_duration: '30', instructions: '', category: 'Cardiac' },
  { name: 'Tab. Amlodipine 10mg', generic: 'Amlodipine', strength: '10', formulation: 'tablet', default_dose: '10', default_route: 'oral', default_frequency: 'OD', default_duration: '30', instructions: '', category: 'Cardiac' },
  { name: 'Tab. Telmisartan 40mg', generic: 'Telmisartan', strength: '40', formulation: 'tablet', default_dose: '40', default_route: 'oral', default_frequency: 'OD', default_duration: '30', instructions: '', category: 'Cardiac' },
  { name: 'Tab. Telmisartan 80mg', generic: 'Telmisartan', strength: '80', formulation: 'tablet', default_dose: '80', default_route: 'oral', default_frequency: 'OD', default_duration: '30', instructions: '', category: 'Cardiac' },
  { name: 'Inj. Enoxaparin 0.4ml', generic: 'Enoxaparin', strength: '40', formulation: 'injection', default_dose: '40', default_route: 'sc', default_frequency: 'OD', default_duration: '5', instructions: 'SC abdominal wall', category: 'Cardiac' },
  { name: 'Inj. Enoxaparin 0.6ml', generic: 'Enoxaparin', strength: '60', formulation: 'injection', default_dose: '60', default_route: 'sc', default_frequency: 'BD', default_duration: '5', instructions: 'SC abdominal wall', category: 'Cardiac' },
  { name: 'Tab. Sorbitrate 5mg', generic: 'Isosorbide dinitrate', strength: '5', formulation: 'tablet', default_dose: '5', default_route: 'oral', default_frequency: 'SOS', default_duration: '30', instructions: 'Sublingual when chest pain', category: 'Cardiac' },
  // GI / Antacid
  { name: 'Tab. Pantoprazole 40mg', generic: 'Pantoprazole', strength: '40', formulation: 'tablet', default_dose: '40', default_route: 'oral', default_frequency: 'OD', default_duration: '14', instructions: 'Before food (30 min)', category: 'GI' },
  { name: 'Inj. Pantoprazole 40mg', generic: 'Pantoprazole', strength: '40', formulation: 'injection', default_dose: '40', default_route: 'iv', default_frequency: 'BD', default_duration: '3', instructions: 'IV slow push', category: 'GI' },
  { name: 'Tab. Domperidone 10mg', generic: 'Domperidone', strength: '10', formulation: 'tablet', default_dose: '10', default_route: 'oral', default_frequency: 'TDS', default_duration: '5', instructions: 'Before food', category: 'GI' },
  { name: 'Syr. Sucralfate', generic: 'Sucralfate', strength: '1000', formulation: 'syrup', default_dose: '1000', default_route: 'oral', default_frequency: 'QID', default_duration: '14', instructions: 'Before food, do not mix with antacids', category: 'GI' },
  { name: 'Tab. Ondansetron 4mg', generic: 'Ondansetron', strength: '4', formulation: 'tablet', default_dose: '4', default_route: 'oral', default_frequency: 'TDS', default_duration: '3', instructions: '', category: 'GI' },
  // Analgesic / Anti-inflammatory
  { name: 'Tab. Paracetamol 500mg', generic: 'Paracetamol', strength: '500', formulation: 'tablet', default_dose: '500', default_route: 'oral', default_frequency: 'TDS', default_duration: '5', instructions: 'After food, SOS for fever >100°F', category: 'Analgesic' },
  { name: 'Tab. Paracetamol 650mg', generic: 'Paracetamol', strength: '650', formulation: 'tablet', default_dose: '650', default_route: 'oral', default_frequency: 'TDS', default_duration: '5', instructions: 'After food', category: 'Analgesic' },
  { name: 'Inj. Paracetamol 1g', generic: 'Paracetamol', strength: '1000', formulation: 'injection', default_dose: '1000', default_route: 'iv', default_frequency: 'TDS', default_duration: '3', instructions: 'IV infusion over 15 min', category: 'Analgesic' },
  { name: 'Tab. Ibuprofen 400mg', generic: 'Ibuprofen', strength: '400', formulation: 'tablet', default_dose: '400', default_route: 'oral', default_frequency: 'TDS', default_duration: '5', instructions: 'After food', category: 'Analgesic' },
  { name: 'Tab. Tramadol 50mg', generic: 'Tramadol', strength: '50', formulation: 'tablet', default_dose: '50', default_route: 'oral', default_frequency: 'BD', default_duration: '3', instructions: 'May cause drowsiness', category: 'Analgesic' },
  { name: 'Inj. Diclofenac 75mg', generic: 'Diclofenac', strength: '75', formulation: 'injection', default_dose: '75', default_route: 'im', default_frequency: 'SOS', default_duration: '3', instructions: 'Deep IM, max 2 days', category: 'Analgesic' },
  // Antibiotic
  { name: 'Tab. Amoxicillin 500mg', generic: 'Amoxicillin', strength: '500', formulation: 'tablet', default_dose: '500', default_route: 'oral', default_frequency: 'TDS', default_duration: '5', instructions: 'After food', category: 'Antibiotic' },
  { name: 'Tab. Azithromycin 500mg', generic: 'Azithromycin', strength: '500', formulation: 'tablet', default_dose: '500', default_route: 'oral', default_frequency: 'OD', default_duration: '3', instructions: 'Empty stomach (1h before or 2h after food)', category: 'Antibiotic' },
  { name: 'Tab. Ciprofloxacin 500mg', generic: 'Ciprofloxacin', strength: '500', formulation: 'tablet', default_dose: '500', default_route: 'oral', default_frequency: 'BD', default_duration: '5', instructions: 'Avoid antacids, dairy', category: 'Antibiotic' },
  { name: 'Tab. Metronidazole 400mg', generic: 'Metronidazole', strength: '400', formulation: 'tablet', default_dose: '400', default_route: 'oral', default_frequency: 'TDS', default_duration: '5', instructions: 'After food, avoid alcohol', category: 'Antibiotic' },
  { name: 'Inj. Ceftriaxone 1g', generic: 'Ceftriaxone', strength: '1000', formulation: 'injection', default_dose: '1000', default_route: 'iv', default_frequency: 'BD', default_duration: '5', instructions: 'IV infusion over 30 min', category: 'Antibiotic' },
  { name: 'Inj. Piperacillin-Tazobactam 4.5g', generic: 'Piperacillin-Tazobactam', strength: '4500', formulation: 'injection', default_dose: '4500', default_route: 'iv', default_frequency: 'TDS', default_duration: '7', instructions: 'IV infusion over 30 min', category: 'Antibiotic' },
  // Diabetes
  { name: 'Tab. Metformin 500mg', generic: 'Metformin', strength: '500', formulation: 'tablet', default_dose: '500', default_route: 'oral', default_frequency: 'BD', default_duration: '30', instructions: 'After food', category: 'Diabetes' },
  { name: 'Tab. Metformin 1000mg', generic: 'Metformin', strength: '1000', formulation: 'tablet', default_dose: '1000', default_route: 'oral', default_frequency: 'BD', default_duration: '30', instructions: 'After food', category: 'Diabetes' },
  { name: 'Tab. Glimepiride 1mg', generic: 'Glimepiride', strength: '1', formulation: 'tablet', default_dose: '1', default_route: 'oral', default_frequency: 'OD', default_duration: '30', instructions: 'Before breakfast', category: 'Diabetes' },
  { name: 'Inj. Human Insulin (R)', generic: 'Insulin Regular', strength: '100', formulation: 'injection', default_dose: '100', default_route: 'sc', default_frequency: 'TDS', default_duration: '7', instructions: 'As per sliding scale, 30 min before meals', category: 'Diabetes' },
  // Steroid
  { name: 'Tab. Prednisolone 10mg', generic: 'Prednisolone', strength: '10', formulation: 'tablet', default_dose: '10', default_route: 'oral', default_frequency: 'OD', default_duration: '7', instructions: 'After food, morning dose. Do not stop abruptly — taper.', category: 'Steroid' },
  { name: 'Inj. Hydrocortisone 100mg', generic: 'Hydrocortisone', strength: '100', formulation: 'injection', default_dose: '100', default_route: 'iv', default_frequency: 'TDS', default_duration: '3', instructions: 'IV bolus', category: 'Steroid' },
  { name: 'Inj. Dexamethasone 8mg', generic: 'Dexamethasone', strength: '8', formulation: 'injection', default_dose: '8', default_route: 'iv', default_frequency: 'OD', default_duration: '3', instructions: '', category: 'Steroid' },
  // Respiratory
  { name: 'Neb. Salbutamol 2.5mg', generic: 'Salbutamol', strength: '2.5', formulation: 'nebulisation', default_dose: '2.5', default_route: 'inhalation', default_frequency: 'QID', default_duration: '5', instructions: 'Via nebuliser', category: 'Respiratory' },
  { name: 'Neb. Ipratropium 500mcg', generic: 'Ipratropium', strength: '0.5', formulation: 'nebulisation', default_dose: '0.5', default_route: 'inhalation', default_frequency: 'TDS', default_duration: '5', instructions: 'Via nebuliser', category: 'Respiratory' },
  { name: 'Neb. Budesonide 1mg', generic: 'Budesonide', strength: '1', formulation: 'nebulisation', default_dose: '1', default_route: 'inhalation', default_frequency: 'BD', default_duration: '5', instructions: 'Via nebuliser, rinse mouth after', category: 'Respiratory' },
  // Diuretic
  { name: 'Tab. Furosemide 40mg', generic: 'Furosemide', strength: '40', formulation: 'tablet', default_dose: '40', default_route: 'oral', default_frequency: 'OD', default_duration: '7', instructions: 'Morning dose', category: 'Diuretic' },
  { name: 'Inj. Furosemide 20mg', generic: 'Furosemide', strength: '20', formulation: 'injection', default_dose: '20', default_route: 'iv', default_frequency: 'BD', default_duration: '3', instructions: 'IV slow push (max 4mg/min)', category: 'Diuretic' },
  // Neuro
  { name: 'Tab. Levetiracetam 500mg', generic: 'Levetiracetam', strength: '500', formulation: 'tablet', default_dose: '500', default_route: 'oral', default_frequency: 'BD', default_duration: '30', instructions: '', category: 'Neuro' },
  { name: 'Tab. Phenytoin 100mg', generic: 'Phenytoin', strength: '100', formulation: 'tablet', default_dose: '100', default_route: 'oral', default_frequency: 'TDS', default_duration: '30', instructions: 'Monitor levels', category: 'Neuro' },
  // Misc
  { name: 'Inj. NS 500ml', generic: 'Normal Saline', strength: '500', formulation: 'infusion', default_dose: '500', default_route: 'iv', default_frequency: 'OD', default_duration: '1', instructions: 'Over 4-6 hours', category: 'IV Fluid' },
  { name: 'Inj. RL 500ml', generic: 'Ringer Lactate', strength: '500', formulation: 'infusion', default_dose: '500', default_route: 'iv', default_frequency: 'OD', default_duration: '1', instructions: 'Over 4-6 hours', category: 'IV Fluid' },
  { name: 'Inj. DNS 500ml', generic: 'Dextrose Normal Saline', strength: '500', formulation: 'infusion', default_dose: '500', default_route: 'iv', default_frequency: 'OD', default_duration: '1', instructions: 'Over 6-8 hours', category: 'IV Fluid' },
];

export function searchDrugs(query: string): DrugSuggestion[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return DRUG_DATABASE.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.generic.toLowerCase().includes(q) ||
    d.category.toLowerCase().includes(q)
  ).slice(0, 10);
}

// ══════════════════════════════════════
// MEDICATION SET TEMPLATES
// ══════════════════════════════════════

export interface MedSet {
  id: string;
  name: string;
  category: string;
  description: string;
  drugs: string[]; // drug names from DRUG_DATABASE
}

export const MEDICATION_SETS: MedSet[] = [
  {
    id: 'post_stemi', name: 'Post-STEMI Protocol', category: 'Cardiac',
    description: 'Dual antiplatelet + statin + beta-blocker + anticoagulant + PPI cover',
    drugs: ['Tab. Ecosprin 75mg', 'Tab. Clopidogrel 75mg', 'Tab. Atorvastatin 40mg', 'Tab. Metoprolol 25mg', 'Inj. Enoxaparin 0.6ml', 'Tab. Pantoprazole 40mg', 'Tab. Sorbitrate 5mg'],
  },
  {
    id: 'post_ptca', name: 'Post-PTCA / Stenting', category: 'Cardiac',
    description: 'DAPT + high-dose statin + beta-blocker + PPI',
    drugs: ['Tab. Ecosprin 150mg', 'Tab. Clopidogrel 75mg', 'Tab. Atorvastatin 40mg', 'Tab. Metoprolol 50mg', 'Tab. Pantoprazole 40mg'],
  },
  {
    id: 'htn_standard', name: 'HTN — Standard', category: 'Cardiac',
    description: 'ARB + CCB combination',
    drugs: ['Tab. Telmisartan 40mg', 'Tab. Amlodipine 5mg'],
  },
  {
    id: 'dm_oral', name: 'DM Type 2 — Oral', category: 'Diabetes',
    description: 'Metformin + SU',
    drugs: ['Tab. Metformin 500mg', 'Tab. Glimepiride 1mg'],
  },
  {
    id: 'icu_sepsis', name: 'ICU — Sepsis Bundle', category: 'ICU',
    description: 'Broad-spectrum AB + fluid + PPI + DVT prophylaxis',
    drugs: ['Inj. Piperacillin-Tazobactam 4.5g', 'Inj. NS 500ml', 'Inj. Pantoprazole 40mg', 'Inj. Enoxaparin 0.4ml'],
  },
  {
    id: 'pneumonia', name: 'CAP — Community Pneumonia', category: 'Respiratory',
    description: 'Cephalosporin + macrolide + nebulisation + supportive',
    drugs: ['Inj. Ceftriaxone 1g', 'Tab. Azithromycin 500mg', 'Neb. Salbutamol 2.5mg', 'Tab. Paracetamol 650mg', 'Tab. Pantoprazole 40mg'],
  },
  {
    id: 'asthma_acute', name: 'Acute Asthma', category: 'Respiratory',
    description: 'Nebulisation + steroids + supportive',
    drugs: ['Neb. Salbutamol 2.5mg', 'Neb. Ipratropium 500mcg', 'Neb. Budesonide 1mg', 'Inj. Hydrocortisone 100mg', 'Tab. Pantoprazole 40mg'],
  },
  {
    id: 'agu_pain', name: 'Acute Pain Management', category: 'Pain',
    description: 'Multi-modal analgesia + gastroprotection',
    drugs: ['Tab. Paracetamol 650mg', 'Tab. Tramadol 50mg', 'Tab. Pantoprazole 40mg'],
  },
  {
    id: 'pre_op', name: 'Pre-Op Standard', category: 'Surgery',
    description: 'NBM + PPI + DVT prophylaxis + anxiolytic',
    drugs: ['Tab. Pantoprazole 40mg', 'Inj. Enoxaparin 0.4ml'],
  },
  {
    id: 'post_tkr', name: 'Post-TKR Protocol', category: 'Ortho',
    description: 'Analgesia + DVT prophylaxis + PPI + antibiotic',
    drugs: ['Tab. Paracetamol 650mg', 'Tab. Tramadol 50mg', 'Inj. Enoxaparin 0.6ml', 'Inj. Ceftriaxone 1g', 'Tab. Pantoprazole 40mg'],
  },
];
