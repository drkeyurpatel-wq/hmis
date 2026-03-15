// lib/cdss/allergies.ts
// Allergy cross-reference: common allergens → medications to flag

export interface AllergyEntry {
  allergen: string;
  category: string;
  crossReacts: string[];    // generic drug names that should trigger alert
  severity: 'contraindicated' | 'caution';
  warning: string;
}

export const ALLERGY_CROSS_REF: AllergyEntry[] = [
  // Penicillin family
  { allergen: 'Penicillin', category: 'Antibiotic', severity: 'contraindicated',
    crossReacts: ['Amoxicillin', 'Ampicillin', 'Piperacillin', 'Amoxicillin + Clavulanate'],
    warning: 'Patient allergic to Penicillin — do NOT prescribe penicillin-class antibiotics' },
  { allergen: 'Penicillin', category: 'Antibiotic', severity: 'caution',
    crossReacts: ['Ceftriaxone', 'Cefuroxime', 'Cephalexin', 'Cefixime'],
    warning: '~2% cross-reactivity between penicillin and cephalosporins — use with caution, monitor for reaction' },

  // Sulfa
  { allergen: 'Sulfonamide', category: 'Antibiotic', severity: 'contraindicated',
    crossReacts: ['Sulfamethoxazole', 'Trimethoprim-Sulfamethoxazole', 'Sulfasalazine'],
    warning: 'Sulfa allergy — avoid all sulfonamide antibiotics' },
  { allergen: 'Sulfonamide', category: 'Antibiotic', severity: 'caution',
    crossReacts: ['Furosemide', 'Hydrochlorothiazide', 'HCTZ'],
    warning: 'Sulfa allergy — thiazide and loop diuretics have sulfonamide moiety, use with caution' },

  // NSAIDs
  { allergen: 'NSAID', category: 'Analgesic', severity: 'contraindicated',
    crossReacts: ['Aceclofenac', 'Diclofenac', 'Ibuprofen', 'Naproxen', 'Piroxicam', 'Ketorolac'],
    warning: 'NSAID allergy — avoid all non-selective NSAIDs. Consider Paracetamol or COX-2 selective (Etoricoxib) if needed' },

  // Aspirin
  { allergen: 'Aspirin', category: 'Antiplatelet', severity: 'contraindicated',
    crossReacts: ['Aspirin'],
    warning: 'Aspirin allergy — do NOT prescribe. Risk of bronchospasm, angioedema, anaphylaxis' },
  { allergen: 'Aspirin', category: 'Antiplatelet', severity: 'caution',
    crossReacts: ['Aceclofenac', 'Diclofenac', 'Ibuprofen'],
    warning: 'Aspirin allergy — cross-reactivity with NSAIDs is common (~20-40%). Avoid if possible' },

  // Iodine / Contrast
  { allergen: 'Iodine / Contrast', category: 'Diagnostic', severity: 'caution',
    crossReacts: ['Povidone Iodine', 'Amiodarone'],
    warning: 'Iodine allergy — premedicate before contrast studies. Avoid iodine-based antiseptics' },

  // Latex
  { allergen: 'Latex', category: 'Environmental', severity: 'caution',
    crossReacts: [],
    warning: 'Latex allergy — use latex-free gloves, catheters, IV tubing. Cross-reacts with banana, kiwi, avocado' },

  // Morphine / Opioids
  { allergen: 'Morphine', category: 'Opioid', severity: 'caution',
    crossReacts: ['Codeine', 'Tramadol', 'Fentanyl'],
    warning: 'Morphine allergy — cross-reactivity variable. Use non-opioid alternatives first. If opioid needed, Fentanyl has lower cross-reactivity' },

  // ACE Inhibitors (angioedema)
  { allergen: 'ACE Inhibitor', category: 'Cardiovascular', severity: 'contraindicated',
    crossReacts: ['Ramipril', 'Enalapril', 'Lisinopril', 'Perindopril'],
    warning: 'ACE inhibitor allergy (likely angioedema) — NEVER rechallenge. Use ARB (Telmisartan) instead' },

  // Statins
  { allergen: 'Statin', category: 'Lipid', severity: 'caution',
    crossReacts: ['Atorvastatin', 'Rosuvastatin', 'Simvastatin', 'Pravastatin'],
    warning: 'Statin intolerance — try alternate statin at lower dose, or consider Ezetimibe' },

  // Metformin
  { allergen: 'Metformin', category: 'Antidiabetic', severity: 'contraindicated',
    crossReacts: ['Metformin'],
    warning: 'Metformin intolerance — use DPP-4i (Vildagliptin) or SGLT2i as first-line alternative' },

  // Fluoroquinolones
  { allergen: 'Fluoroquinolone', category: 'Antibiotic', severity: 'contraindicated',
    crossReacts: ['Ciprofloxacin', 'Levofloxacin', 'Moxifloxacin', 'Ofloxacin', 'Norfloxacin'],
    warning: 'Fluoroquinolone allergy — avoid entire class. Risk of tendon rupture, neuropathy, QT prolongation' },
];

// Common allergen suggestions for quick-add
export const COMMON_ALLERGENS = [
  'Penicillin', 'Sulfonamide', 'NSAID', 'Aspirin', 'Iodine / Contrast',
  'Latex', 'Morphine', 'ACE Inhibitor', 'Statin', 'Metformin',
  'Fluoroquinolone', 'Cephalosporin', 'Egg', 'Peanut', 'Shellfish', 'Dust', 'Pollen',
];

// Check if a medication generic name triggers any allergy
export function checkAllergyConflict(
  patientAllergies: string[],
  medGeneric: string
): AllergyEntry[] {
  if (!patientAllergies.length) return [];
  return ALLERGY_CROSS_REF.filter(a =>
    patientAllergies.some(pa => pa.toLowerCase() === a.allergen.toLowerCase()) &&
    a.crossReacts.some(cr => medGeneric.toLowerCase().includes(cr.toLowerCase()) || cr.toLowerCase().includes(medGeneric.toLowerCase()))
  );
}
