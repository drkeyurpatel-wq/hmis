// lib/cdss/medications.ts
// Indian medication database with brands, dosages, and interaction data

export interface Medication {
  id: string;
  generic: string;
  brand: string;
  strength: string;
  form: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Inhaler' | 'Drops' | 'Cream' | 'Ointment' | 'Sachet' | 'Gel';
  defaultDose: string;
  defaultFrequency: string;
  defaultDuration: string;
  defaultRoute: string;
  defaultInstructions: string;
  category: string;
}

export const MEDICATIONS: Medication[] = [
  // --- Cardiovascular ---
  { id: 'amlodipine-5', generic: 'Amlodipine', brand: 'Amlopress', strength: '5mg', form: 'Tablet',
    defaultDose: '5mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Morning, with or without food', category: 'Antihypertensive' },
  { id: 'telmisartan-40', generic: 'Telmisartan', brand: 'Telma', strength: '40mg', form: 'Tablet',
    defaultDose: '40mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Morning', category: 'Antihypertensive' },
  { id: 'hydrochlorothiazide-12.5', generic: 'Hydrochlorothiazide', brand: 'Aquazide', strength: '12.5mg', form: 'Tablet',
    defaultDose: '12.5mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Morning', category: 'Diuretic' },
  { id: 'metoprolol-25', generic: 'Metoprolol Succinate', brand: 'Met XL', strength: '25mg', form: 'Tablet',
    defaultDose: '25mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Morning, with food', category: 'Beta Blocker' },
  { id: 'metoprolol-50', generic: 'Metoprolol Succinate', brand: 'Met XL', strength: '50mg', form: 'Tablet',
    defaultDose: '50mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Morning, with food', category: 'Beta Blocker' },
  { id: 'ramipril-2.5', generic: 'Ramipril', brand: 'Cardace', strength: '2.5mg', form: 'Tablet',
    defaultDose: '2.5mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Evening', category: 'ACE Inhibitor' },
  { id: 'ramipril-5', generic: 'Ramipril', brand: 'Cardace', strength: '5mg', form: 'Tablet',
    defaultDose: '5mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Evening', category: 'ACE Inhibitor' },
  { id: 'atorvastatin-40', generic: 'Atorvastatin', brand: 'Atorva', strength: '40mg', form: 'Tablet',
    defaultDose: '40mg', defaultFrequency: 'HS', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Bedtime', category: 'Statin' },
  { id: 'atorvastatin-80', generic: 'Atorvastatin', brand: 'Atorva', strength: '80mg', form: 'Tablet',
    defaultDose: '80mg', defaultFrequency: 'HS', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Bedtime', category: 'Statin' },
  { id: 'aspirin-75', generic: 'Aspirin', brand: 'Ecosprin', strength: '75mg', form: 'Tablet',
    defaultDose: '75mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After lunch', category: 'Antiplatelet' },
  { id: 'aspirin-150', generic: 'Aspirin', brand: 'Ecosprin', strength: '150mg', form: 'Tablet',
    defaultDose: '150mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After lunch', category: 'Antiplatelet' },
  { id: 'clopidogrel-75', generic: 'Clopidogrel', brand: 'Clopilet', strength: '75mg', form: 'Tablet',
    defaultDose: '75mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Antiplatelet' },
  { id: 'warfarin-5', generic: 'Warfarin', brand: 'Warf', strength: '5mg', form: 'Tablet',
    defaultDose: '5mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Evening, same time daily', category: 'Anticoagulant' },
  { id: 'apixaban-5', generic: 'Apixaban', brand: 'Eliquis', strength: '5mg', form: 'Tablet',
    defaultDose: '5mg', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'With or without food', category: 'Anticoagulant' },
  { id: 'isosorbide-dinitrate-10', generic: 'Isosorbide Dinitrate', brand: 'Sorbitrate', strength: '10mg', form: 'Tablet',
    defaultDose: '10mg', defaultFrequency: 'TDS', defaultDuration: '14 days', defaultRoute: 'Oral', defaultInstructions: 'Before meals', category: 'Nitrate' },
  { id: 'furosemide-40', generic: 'Furosemide', brand: 'Lasix', strength: '40mg', form: 'Tablet',
    defaultDose: '40mg', defaultFrequency: 'OD', defaultDuration: '14 days', defaultRoute: 'Oral', defaultInstructions: 'Morning, empty stomach', category: 'Diuretic' },
  { id: 'spironolactone-25', generic: 'Spironolactone', brand: 'Aldactone', strength: '25mg', form: 'Tablet',
    defaultDose: '25mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'With food', category: 'Diuretic' },

  // --- Analgesic / Anti-inflammatory ---
  { id: 'paracetamol-500', generic: 'Paracetamol', brand: 'Dolo', strength: '500mg', form: 'Tablet',
    defaultDose: '500mg', defaultFrequency: 'TDS', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'After food, SOS for fever >100°F', category: 'Analgesic' },
  { id: 'aceclofenac-100', generic: 'Aceclofenac', brand: 'Zerodol', strength: '100mg', form: 'Tablet',
    defaultDose: '100mg', defaultFrequency: 'BD', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'NSAID' },

  // --- GI ---
  { id: 'pantoprazole-40', generic: 'Pantoprazole', brand: 'Pan', strength: '40mg', form: 'Tablet',
    defaultDose: '40mg', defaultFrequency: 'OD', defaultDuration: '14 days', defaultRoute: 'Oral', defaultInstructions: 'Before breakfast, empty stomach', category: 'PPI' },
  { id: 'domperidone-10', generic: 'Domperidone', brand: 'Domstal', strength: '10mg', form: 'Tablet',
    defaultDose: '10mg', defaultFrequency: 'TDS', defaultDuration: '7 days', defaultRoute: 'Oral', defaultInstructions: 'Before meals', category: 'Prokinetic' },
  { id: 'ondansetron-4', generic: 'Ondansetron', brand: 'Emeset', strength: '4mg', form: 'Tablet',
    defaultDose: '4mg', defaultFrequency: 'BD', defaultDuration: '3 days', defaultRoute: 'Oral', defaultInstructions: 'Before meals', category: 'Antiemetic' },
  { id: 'racecadotril-100', generic: 'Racecadotril', brand: 'Redotil', strength: '100mg', form: 'Capsule',
    defaultDose: '100mg', defaultFrequency: 'TDS', defaultDuration: '3 days', defaultRoute: 'Oral', defaultInstructions: 'Before meals', category: 'Antidiarrheal' },
  { id: 'sucralfate-1g', generic: 'Sucralfate', brand: 'Sucral-O', strength: '1g', form: 'Tablet',
    defaultDose: '1g', defaultFrequency: 'BD', defaultDuration: '14 days', defaultRoute: 'Oral', defaultInstructions: '1 hour before meals', category: 'Mucosal Protectant' },
  { id: 'ursodeoxycholic-acid-300', generic: 'Ursodeoxycholic Acid', brand: 'Udiliv', strength: '300mg', form: 'Tablet',
    defaultDose: '300mg', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Bile Acid' },

  // --- Antibiotics ---
  { id: 'amoxicillin-500', generic: 'Amoxicillin', brand: 'Mox', strength: '500mg', form: 'Capsule',
    defaultDose: '500mg', defaultFrequency: 'TDS', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Antibiotic' },
  { id: 'azithromycin-500', generic: 'Azithromycin', brand: 'Azee', strength: '500mg', form: 'Tablet',
    defaultDose: '500mg', defaultFrequency: 'OD', defaultDuration: '3 days', defaultRoute: 'Oral', defaultInstructions: '1 hour before or 2 hours after food', category: 'Antibiotic' },
  { id: 'ciprofloxacin-500', generic: 'Ciprofloxacin', brand: 'Ciplox', strength: '500mg', form: 'Tablet',
    defaultDose: '500mg', defaultFrequency: 'BD', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Antibiotic' },
  { id: 'ceftriaxone-1g', generic: 'Ceftriaxone', brand: 'Monocef', strength: '1g', form: 'Injection',
    defaultDose: '1g', defaultFrequency: 'BD', defaultDuration: '7 days', defaultRoute: 'IV', defaultInstructions: 'Slow IV over 30 min', category: 'Antibiotic' },
  { id: 'nitrofurantoin-100', generic: 'Nitrofurantoin', brand: 'Furadantin', strength: '100mg', form: 'Capsule',
    defaultDose: '100mg', defaultFrequency: 'BD', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'With food', category: 'Antibiotic' },

  // --- Respiratory ---
  { id: 'cetirizine-10', generic: 'Cetirizine', brand: 'Cetzine', strength: '10mg', form: 'Tablet',
    defaultDose: '10mg', defaultFrequency: 'HS', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'Bedtime', category: 'Antihistamine' },
  { id: 'ambroxol-30', generic: 'Ambroxol', brand: 'Ambrodil', strength: '30mg', form: 'Tablet',
    defaultDose: '30mg', defaultFrequency: 'BD', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Mucolytic' },
  { id: 'montelukast-10', generic: 'Montelukast', brand: 'Montair', strength: '10mg', form: 'Tablet',
    defaultDose: '10mg', defaultFrequency: 'HS', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Bedtime', category: 'LTRA' },
  { id: 'salbutamol-inhaler', generic: 'Salbutamol', brand: 'Asthalin Inhaler', strength: '100mcg', form: 'Inhaler',
    defaultDose: '2 puffs', defaultFrequency: 'SOS', defaultDuration: '30 days', defaultRoute: 'Inhalation', defaultInstructions: 'Shake well, use spacer', category: 'Bronchodilator' },
  { id: 'budesonide-inhaler', generic: 'Budesonide', brand: 'Budecort Inhaler', strength: '200mcg', form: 'Inhaler',
    defaultDose: '2 puffs', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Inhalation', defaultInstructions: 'Rinse mouth after use', category: 'Inhaled Steroid' },
  { id: 'ipratropium-inhaler', generic: 'Ipratropium', brand: 'Ipravent', strength: '20mcg', form: 'Inhaler',
    defaultDose: '2 puffs', defaultFrequency: 'TDS', defaultDuration: '14 days', defaultRoute: 'Inhalation', defaultInstructions: 'Use spacer', category: 'Anticholinergic' },
  { id: 'prednisolone-40', generic: 'Prednisolone', brand: 'Omnacortil', strength: '40mg', form: 'Tablet',
    defaultDose: '40mg', defaultFrequency: 'OD', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'Morning, after breakfast', category: 'Steroid' },

  // --- Neuro ---
  { id: 'levetiracetam-500', generic: 'Levetiracetam', brand: 'Levipil', strength: '500mg', form: 'Tablet',
    defaultDose: '500mg', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'With or without food, do not skip', category: 'Antiepileptic' },
  { id: 'sodium-valproate-500', generic: 'Sodium Valproate', brand: 'Valparin Chrono', strength: '500mg', form: 'Tablet',
    defaultDose: '500mg', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Antiepileptic' },
  { id: 'phenytoin-100', generic: 'Phenytoin', brand: 'Eptoin', strength: '100mg', form: 'Tablet',
    defaultDose: '100mg', defaultFrequency: 'TDS', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Antiepileptic' },
  { id: 'sumatriptan-50', generic: 'Sumatriptan', brand: 'Suminat', strength: '50mg', form: 'Tablet',
    defaultDose: '50mg', defaultFrequency: 'SOS', defaultDuration: 'As needed', defaultRoute: 'Oral', defaultInstructions: 'At onset of migraine, max 2/day', category: 'Triptan' },
  { id: 'amitriptyline-10', generic: 'Amitriptyline', brand: 'Tryptomer', strength: '10mg', form: 'Tablet',
    defaultDose: '10mg', defaultFrequency: 'HS', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Bedtime', category: 'TCA' },
  { id: 'levodopa-carbidopa-110', generic: 'Levodopa + Carbidopa', brand: 'Syndopa', strength: '100/10mg', form: 'Tablet',
    defaultDose: '100/10mg', defaultFrequency: 'TDS', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: '30 min before meals', category: 'Antiparkinson' },
  { id: 'pramipexole-0.25', generic: 'Pramipexole', brand: 'Pramipex', strength: '0.25mg', form: 'Tablet',
    defaultDose: '0.25mg', defaultFrequency: 'TDS', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'With food', category: 'Dopamine Agonist' },
  { id: 'trihexyphenidyl-2', generic: 'Trihexyphenidyl', brand: 'Pacitane', strength: '2mg', form: 'Tablet',
    defaultDose: '2mg', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Anticholinergic' },

  // --- Endocrine ---
  { id: 'metformin-500', generic: 'Metformin', brand: 'Glycomet', strength: '500mg', form: 'Tablet',
    defaultDose: '500mg', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Antidiabetic' },
  { id: 'glimepiride-1', generic: 'Glimepiride', brand: 'Amaryl', strength: '1mg', form: 'Tablet',
    defaultDose: '1mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Before breakfast', category: 'Antidiabetic' },
  { id: 'vildagliptin-50', generic: 'Vildagliptin', brand: 'Galvus', strength: '50mg', form: 'Tablet',
    defaultDose: '50mg', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'With or without food', category: 'DPP-4 Inhibitor' },
  { id: 'insulin-glargine', generic: 'Insulin Glargine', brand: 'Lantus', strength: '100IU/mL', form: 'Injection',
    defaultDose: '10 units', defaultFrequency: 'HS', defaultDuration: '30 days', defaultRoute: 'SC', defaultInstructions: 'Bedtime, rotate injection site', category: 'Insulin' },
  { id: 'levothyroxine-50', generic: 'Levothyroxine', brand: 'Thyronorm', strength: '50mcg', form: 'Tablet',
    defaultDose: '50mcg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Empty stomach, 30 min before breakfast', category: 'Thyroid' },
  { id: 'carbimazole-10', generic: 'Carbimazole', brand: 'Neo-Mercazole', strength: '10mg', form: 'Tablet',
    defaultDose: '10mg', defaultFrequency: 'TDS', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Antithyroid' },

  // --- Musculoskeletal ---
  { id: 'thiocolchicoside-4', generic: 'Thiocolchicoside', brand: 'Myoril', strength: '4mg', form: 'Capsule',
    defaultDose: '4mg', defaultFrequency: 'BD', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Muscle Relaxant' },
  { id: 'glucosamine-1500', generic: 'Glucosamine Sulphate', brand: 'Jointace', strength: '1500mg', form: 'Tablet',
    defaultDose: '1500mg', defaultFrequency: 'OD', defaultDuration: '90 days', defaultRoute: 'Oral', defaultInstructions: 'With food', category: 'Supplement' },

  // --- Psychiatric ---
  { id: 'escitalopram-10', generic: 'Escitalopram', brand: 'Nexito', strength: '10mg', form: 'Tablet',
    defaultDose: '10mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Morning', category: 'SSRI' },
  { id: 'sertraline-50', generic: 'Sertraline', brand: 'Daxid', strength: '50mg', form: 'Tablet',
    defaultDose: '50mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Morning, after food', category: 'SSRI' },
  { id: 'clonazepam-0.25', generic: 'Clonazepam', brand: 'Rivotril', strength: '0.25mg', form: 'Tablet',
    defaultDose: '0.25mg', defaultFrequency: 'HS', defaultDuration: '14 days', defaultRoute: 'Oral', defaultInstructions: 'Bedtime, short term only', category: 'Benzodiazepine' },
  { id: 'hydroxyzine-25', generic: 'Hydroxyzine', brand: 'Atarax', strength: '25mg', form: 'Tablet',
    defaultDose: '25mg', defaultFrequency: 'HS', defaultDuration: '7 days', defaultRoute: 'Oral', defaultInstructions: 'Bedtime', category: 'Antihistamine' },

  // --- Supplements ---
  { id: 'ferrous-sulphate-200', generic: 'Ferrous Sulphate', brand: 'Autrin', strength: '200mg', form: 'Tablet',
    defaultDose: '200mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food, with vitamin C', category: 'Iron' },
  { id: 'folic-acid-5', generic: 'Folic Acid', brand: 'Folvite', strength: '5mg', form: 'Tablet',
    defaultDose: '5mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Supplement' },
  { id: 'vitamin-c-500', generic: 'Vitamin C', brand: 'Limcee', strength: '500mg', form: 'Tablet',
    defaultDose: '500mg', defaultFrequency: 'OD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'After food', category: 'Supplement' },

  // --- Others ---
  { id: 'ors-packet', generic: 'ORS', brand: 'Electral', strength: '21.8g', form: 'Sachet',
    defaultDose: '1 sachet in 1L water', defaultFrequency: 'After each loose stool', defaultDuration: '3 days', defaultRoute: 'Oral', defaultInstructions: 'Sip frequently', category: 'Rehydration' },
  { id: 'probiotics', generic: 'Saccharomyces Boulardii', brand: 'Econorm', strength: '250mg', form: 'Capsule',
    defaultDose: '250mg', defaultFrequency: 'BD', defaultDuration: '5 days', defaultRoute: 'Oral', defaultInstructions: 'Before food', category: 'Probiotic' },
  { id: 'hyoscine-10', generic: 'Hyoscine Butylbromide', brand: 'Buscopan', strength: '10mg', form: 'Tablet',
    defaultDose: '10mg', defaultFrequency: 'TDS', defaultDuration: '3 days', defaultRoute: 'Oral', defaultInstructions: 'Before meals', category: 'Antispasmodic' },
  { id: 'propranolol-20', generic: 'Propranolol', brand: 'Ciplar', strength: '20mg', form: 'Tablet',
    defaultDose: '20mg', defaultFrequency: 'BD', defaultDuration: '14 days', defaultRoute: 'Oral', defaultInstructions: 'Before food', category: 'Beta Blocker' },
  { id: 'propranolol-40', generic: 'Propranolol', brand: 'Ciplar', strength: '40mg', form: 'Tablet',
    defaultDose: '40mg', defaultFrequency: 'BD', defaultDuration: '30 days', defaultRoute: 'Oral', defaultInstructions: 'Before food', category: 'Beta Blocker' },

  // --- Topical ---
  { id: 'mometasone-cream', generic: 'Mometasone Furoate', brand: 'Elocon', strength: '0.1%', form: 'Cream',
    defaultDose: 'Apply thin layer', defaultFrequency: 'BD', defaultDuration: '7 days', defaultRoute: 'Topical', defaultInstructions: 'Apply to affected area', category: 'Topical Steroid' },
  { id: 'moxifloxacin-eye-drops', generic: 'Moxifloxacin', brand: 'Milflox', strength: '0.5%', form: 'Drops',
    defaultDose: '1 drop', defaultFrequency: 'QID', defaultDuration: '5 days', defaultRoute: 'Ophthalmic', defaultInstructions: 'In affected eye(s)', category: 'Antibiotic Eye Drops' },
  { id: 'artificial-tears', generic: 'Carboxymethylcellulose', brand: 'Refresh Tears', strength: '0.5%', form: 'Drops',
    defaultDose: '1-2 drops', defaultFrequency: 'QID', defaultDuration: '14 days', defaultRoute: 'Ophthalmic', defaultInstructions: 'As needed', category: 'Lubricant' },
  { id: 'betadine-gargle', generic: 'Povidone Iodine', brand: 'Betadine Gargle', strength: '2%', form: 'Gel',
    defaultDose: '15mL diluted', defaultFrequency: 'TDS', defaultDuration: '5 days', defaultRoute: 'Oral gargle', defaultInstructions: 'Gargle for 30 seconds, do not swallow', category: 'Antiseptic' },
  { id: 'antacid-gel', generic: 'Aluminium Hydroxide + Magnesium Hydroxide', brand: 'Digene', strength: 'Gel', form: 'Gel',
    defaultDose: '10mL', defaultFrequency: 'TDS', defaultDuration: '7 days', defaultRoute: 'Oral', defaultInstructions: 'After meals', category: 'Antacid' },

  // --- Antimalarials ---
  { id: 'artemether-lumefantrine', generic: 'Artemether + Lumefantrine', brand: 'Lumerax', strength: '80/480mg', form: 'Tablet',
    defaultDose: '4 tablets', defaultFrequency: 'BD', defaultDuration: '3 days', defaultRoute: 'Oral', defaultInstructions: 'With food, complete full course', category: 'Antimalarial' },
];

// Drug interaction pairs (critical)
export const DRUG_INTERACTIONS: Array<{ drug1: string; drug2: string; severity: 'high' | 'moderate'; warning: string }> = [
  { drug1: 'warfarin', drug2: 'aspirin', severity: 'high', warning: 'Increased bleeding risk — use only under specialist supervision' },
  { drug1: 'metformin', drug2: 'contrast dye', severity: 'high', warning: 'Hold metformin 48h before and after IV contrast' },
  { drug1: 'ramipril', drug2: 'spironolactone', severity: 'high', warning: 'Risk of hyperkalemia — monitor potassium closely' },
  { drug1: 'metoprolol', drug2: 'amlodipine', severity: 'moderate', warning: 'Additive hypotension/bradycardia — monitor vitals' },
  { drug1: 'ciprofloxacin', drug2: 'antacid', severity: 'moderate', warning: 'Antacids reduce ciprofloxacin absorption — give 2h apart' },
  { drug1: 'warfarin', drug2: 'azithromycin', severity: 'moderate', warning: 'Azithromycin may increase INR — monitor closely' },
  { drug1: 'clopidogrel', drug2: 'pantoprazole', severity: 'moderate', warning: 'PPIs may reduce clopidogrel efficacy — consider rabeprazole' },
  { drug1: 'levetiracetam', drug2: 'carbimazole', severity: 'moderate', warning: 'Both may cause blood dyscrasias — monitor CBC' },
  { drug1: 'phenytoin', drug2: 'sodium-valproate', severity: 'high', warning: 'Complex interaction — valproate increases free phenytoin levels' },
  { drug1: 'escitalopram', drug2: 'sumatriptan', severity: 'high', warning: 'Risk of serotonin syndrome — monitor closely' },
  { drug1: 'clonazepam', drug2: 'amitriptyline', severity: 'moderate', warning: 'Additive CNS depression — use lowest effective doses' },
  { drug1: 'furosemide', drug2: 'aceclofenac', severity: 'moderate', warning: 'NSAIDs reduce diuretic efficacy and increase nephrotoxicity risk' },
  { drug1: 'glimepiride', drug2: 'ciprofloxacin', severity: 'moderate', warning: 'Fluoroquinolones may cause hypoglycemia — monitor glucose' },
  { drug1: 'levothyroxine', drug2: 'ferrous-sulphate', severity: 'moderate', warning: 'Iron reduces levothyroxine absorption — give 4h apart' },
  { drug1: 'prednisolone', drug2: 'aceclofenac', severity: 'high', warning: 'Increased GI bleeding risk — add PPI cover' },
];

// Search medications
export function searchMedications(query: string): Medication[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return MEDICATIONS.filter(m =>
    m.generic.toLowerCase().includes(q) ||
    m.brand.toLowerCase().includes(q) ||
    m.id.includes(q) ||
    m.category.toLowerCase().includes(q)
  ).slice(0, 10);
}

// Get medication by ID
export function getMedicationById(id: string): Medication | undefined {
  return MEDICATIONS.find(m => m.id === id);
}

// Check interactions for a list of medication generics
export function checkInteractions(medGenerics: string[]): typeof DRUG_INTERACTIONS {
  const lowerMeds = medGenerics.map(m => m.toLowerCase());
  return DRUG_INTERACTIONS.filter(i =>
    lowerMeds.some(m => i.drug1.includes(m) || m.includes(i.drug1)) &&
    lowerMeds.some(m => i.drug2.includes(m) || m.includes(i.drug2))
  );
}

// Backwards-compatible exports for /emr (old page)
export const DRUG_DATABASE = MEDICATIONS.map(m => ({
  name: m.generic,
  brand: m.brand,
  dosageForm: m.form,
  strength: m.strength,
  category: m.category,
  default_dose: m.defaultDose,
  default_frequency: m.defaultFrequency,
  default_route: m.defaultRoute,
  default_duration: m.defaultDuration,
  instructions: m.defaultInstructions,
}));
export const searchDrugs = (q: string) => DRUG_DATABASE.filter(d => d.name.toLowerCase().includes(q.toLowerCase()) || d.brand.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
export interface LegacyMedSet { id: string; name: string; drugs: string[]; category: string; description?: string; }
export const MEDICATION_SETS: LegacyMedSet[] = [];
export type DrugSuggestion = typeof DRUG_DATABASE[0];
