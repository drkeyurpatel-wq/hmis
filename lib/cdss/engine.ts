// Health1 HMIS — Clinical Decision Support System (CDSS)
// Ported from Python (~1500 lines) to TypeScript
// Rule-based: vitals analysis, NEWS2, drug interactions, dose validation

import type { Vitals } from '@/types/database';

// ══════════════════════════════════════
// NEWS2 (National Early Warning Score 2)
// ══════════════════════════════════════

interface NEWS2Result {
  total: number;
  risk: 'low' | 'low_medium' | 'medium' | 'high';
  components: Record<string, number>;
  recommendation: string;
}

export function calculateNEWS2(vitals: Partial<Vitals>): NEWS2Result {
  const components: Record<string, number> = {};
  let total = 0;

  // Respiration rate
  if (vitals.resp_rate != null) {
    const rr = vitals.resp_rate;
    if (rr <= 8) components.resp_rate = 3;
    else if (rr <= 11) components.resp_rate = 1;
    else if (rr <= 20) components.resp_rate = 0;
    else if (rr <= 24) components.resp_rate = 2;
    else components.resp_rate = 3;
  }

  // SpO2 (Scale 1 — no supplemental O2)
  if (vitals.spo2 != null) {
    const sp = vitals.spo2;
    if (sp <= 91) components.spo2 = 3;
    else if (sp <= 93) components.spo2 = 2;
    else if (sp <= 95) components.spo2 = 1;
    else components.spo2 = 0;
  }

  // Systolic BP
  if (vitals.bp_systolic != null) {
    const sbp = vitals.bp_systolic;
    if (sbp <= 90) components.bp_systolic = 3;
    else if (sbp <= 100) components.bp_systolic = 2;
    else if (sbp <= 110) components.bp_systolic = 1;
    else if (sbp <= 219) components.bp_systolic = 0;
    else components.bp_systolic = 3;
  }

  // Pulse
  if (vitals.pulse != null) {
    const hr = vitals.pulse;
    if (hr <= 40) components.pulse = 3;
    else if (hr <= 50) components.pulse = 1;
    else if (hr <= 90) components.pulse = 0;
    else if (hr <= 110) components.pulse = 1;
    else if (hr <= 130) components.pulse = 2;
    else components.pulse = 3;
  }

  // Temperature
  if (vitals.temperature != null) {
    const t = vitals.temperature;
    if (t <= 95.0) components.temperature = 3;
    else if (t <= 96.8) components.temperature = 1;
    else if (t <= 100.4) components.temperature = 0;
    else if (t <= 102.2) components.temperature = 1;
    else components.temperature = 2;
  }

  // GCS (consciousness)
  if (vitals.gcs != null) {
    components.gcs = vitals.gcs === 15 ? 0 : 3;
  }

  total = Object.values(components).reduce((a, b) => a + b, 0);

  let risk: NEWS2Result['risk'];
  let recommendation: string;

  if (total >= 7) {
    risk = 'high';
    recommendation = 'Emergency response — continuous monitoring, senior clinical review immediately';
  } else if (total >= 5) {
    risk = 'medium';
    recommendation = 'Urgent response — increase monitoring frequency, urgent clinical review';
  } else if (Object.values(components).some((v) => v === 3)) {
    risk = 'low_medium';
    recommendation = 'Individual parameter score of 3 — urgent review of care plan';
  } else {
    risk = 'low';
    recommendation = 'Continue routine monitoring (minimum every 12 hours)';
  }

  return { total, risk, components, recommendation };
}

// ══════════════════════════════════════
// VITALS ANALYSIS
// ══════════════════════════════════════

export interface VitalAlert {
  parameter: string;
  value: number;
  severity: 'normal' | 'warning' | 'critical';
  message: string;
}

export function analyzeVitals(vitals: Partial<Vitals>): VitalAlert[] {
  const alerts: VitalAlert[] = [];

  if (vitals.bp_systolic != null && vitals.bp_diastolic != null) {
    const sbp = vitals.bp_systolic;
    const dbp = vitals.bp_diastolic;
    if (sbp >= 180 || dbp >= 120)
      alerts.push({ parameter: 'Blood pressure', value: sbp, severity: 'critical', message: `Hypertensive crisis: ${sbp}/${dbp} mmHg — immediate intervention required` });
    else if (sbp >= 140 || dbp >= 90)
      alerts.push({ parameter: 'Blood pressure', value: sbp, severity: 'warning', message: `Hypertension Stage ${sbp >= 160 ? '2' : '1'}: ${sbp}/${dbp} mmHg` });
    else if (sbp < 90 || dbp < 60)
      alerts.push({ parameter: 'Blood pressure', value: sbp, severity: 'critical', message: `Hypotension: ${sbp}/${dbp} mmHg — assess for shock` });
    else
      alerts.push({ parameter: 'Blood pressure', value: sbp, severity: 'normal', message: `${sbp}/${dbp} mmHg — normal` });
  }

  if (vitals.pulse != null) {
    const hr = vitals.pulse;
    if (hr > 150 || hr < 40)
      alerts.push({ parameter: 'Heart rate', value: hr, severity: 'critical', message: `${hr > 150 ? 'Severe tachycardia' : 'Severe bradycardia'}: ${hr} bpm` });
    else if (hr > 100 || hr < 50)
      alerts.push({ parameter: 'Heart rate', value: hr, severity: 'warning', message: `${hr > 100 ? 'Tachycardia' : 'Bradycardia'}: ${hr} bpm` });
    else
      alerts.push({ parameter: 'Heart rate', value: hr, severity: 'normal', message: `${hr} bpm — normal` });
  }

  if (vitals.spo2 != null) {
    const sp = vitals.spo2;
    if (sp < 90)
      alerts.push({ parameter: 'SpO₂', value: sp, severity: 'critical', message: `Severe hypoxemia: ${sp}% — immediate O₂ supplementation` });
    else if (sp < 94)
      alerts.push({ parameter: 'SpO₂', value: sp, severity: 'warning', message: `Low SpO₂: ${sp}% — monitor closely` });
    else
      alerts.push({ parameter: 'SpO₂', value: sp, severity: 'normal', message: `${sp}% — normal` });
  }

  if (vitals.temperature != null) {
    const t = vitals.temperature;
    if (t >= 104)
      alerts.push({ parameter: 'Temperature', value: t, severity: 'critical', message: `Hyperpyrexia: ${t}°F — emergency cooling required` });
    else if (t >= 100.4)
      alerts.push({ parameter: 'Temperature', value: t, severity: 'warning', message: `Fever: ${t}°F` });
    else if (t < 95)
      alerts.push({ parameter: 'Temperature', value: t, severity: 'critical', message: `Hypothermia: ${t}°F — active rewarming needed` });
    else
      alerts.push({ parameter: 'Temperature', value: t, severity: 'normal', message: `${t}°F — normal` });
  }

  if (vitals.resp_rate != null) {
    const rr = vitals.resp_rate;
    if (rr > 30 || rr < 8)
      alerts.push({ parameter: 'Resp. rate', value: rr, severity: 'critical', message: `${rr > 30 ? 'Severe tachypnea' : 'Bradypnea'}: ${rr}/min` });
    else if (rr > 20 || rr < 12)
      alerts.push({ parameter: 'Resp. rate', value: rr, severity: 'warning', message: `Abnormal respiratory rate: ${rr}/min` });
    else
      alerts.push({ parameter: 'Resp. rate', value: rr, severity: 'normal', message: `${rr}/min — normal` });
  }

  if (vitals.blood_sugar != null) {
    const bs = vitals.blood_sugar;
    if (bs < 54)
      alerts.push({ parameter: 'Blood sugar', value: bs, severity: 'critical', message: `Severe hypoglycemia: ${bs} mg/dL — IV dextrose STAT` });
    else if (bs < 70)
      alerts.push({ parameter: 'Blood sugar', value: bs, severity: 'warning', message: `Hypoglycemia: ${bs} mg/dL` });
    else if (bs > 400)
      alerts.push({ parameter: 'Blood sugar', value: bs, severity: 'critical', message: `Severe hyperglycemia: ${bs} mg/dL — assess for DKA/HHS` });
    else if (bs > 200)
      alerts.push({ parameter: 'Blood sugar', value: bs, severity: 'warning', message: `Hyperglycemia: ${bs} mg/dL` });
    else
      alerts.push({ parameter: 'Blood sugar', value: bs, severity: 'normal', message: `${bs} mg/dL — normal` });
  }

  if (vitals.gcs != null) {
    const gcs = vitals.gcs;
    if (gcs <= 8)
      alerts.push({ parameter: 'GCS', value: gcs, severity: 'critical', message: `GCS ${gcs} — severe impairment, consider intubation` });
    else if (gcs <= 12)
      alerts.push({ parameter: 'GCS', value: gcs, severity: 'warning', message: `GCS ${gcs} — moderate impairment` });
    else
      alerts.push({ parameter: 'GCS', value: gcs, severity: 'normal', message: `GCS ${gcs}/15 — ${gcs === 15 ? 'alert and oriented' : 'mild impairment'}` });
  }

  return alerts;
}

// ══════════════════════════════════════
// DRUG INTERACTION CHECKER (top 50 pairs)
// ══════════════════════════════════════

export interface DrugInteraction {
  drug_a: string;
  drug_b: string;
  severity: 'mild' | 'moderate' | 'severe' | 'contraindicated';
  description: string;
  recommendation: string;
}

const INTERACTIONS: DrugInteraction[] = [
  { drug_a: 'warfarin', drug_b: 'aspirin', severity: 'severe', description: 'Increased bleeding risk', recommendation: 'Avoid combination or monitor INR closely' },
  { drug_a: 'warfarin', drug_b: 'ibuprofen', severity: 'severe', description: 'Increased bleeding risk and GI complications', recommendation: 'Use paracetamol instead for pain' },
  { drug_a: 'warfarin', drug_b: 'metronidazole', severity: 'severe', description: 'Metronidazole inhibits warfarin metabolism', recommendation: 'Monitor INR, may need dose reduction' },
  { drug_a: 'metformin', drug_b: 'iodinated contrast', severity: 'severe', description: 'Risk of lactic acidosis', recommendation: 'Hold metformin 48h before and after contrast' },
  { drug_a: 'ace_inhibitor', drug_b: 'potassium', severity: 'severe', description: 'Risk of hyperkalemia', recommendation: 'Monitor potassium levels closely' },
  { drug_a: 'ace_inhibitor', drug_b: 'spironolactone', severity: 'severe', description: 'Additive hyperkalemia risk', recommendation: 'Monitor electrolytes frequently' },
  { drug_a: 'digoxin', drug_b: 'amiodarone', severity: 'severe', description: 'Amiodarone increases digoxin levels by 70-100%', recommendation: 'Reduce digoxin dose by 50%, monitor levels' },
  { drug_a: 'digoxin', drug_b: 'verapamil', severity: 'severe', description: 'Verapamil increases digoxin levels', recommendation: 'Reduce digoxin dose, monitor levels' },
  { drug_a: 'simvastatin', drug_b: 'clarithromycin', severity: 'severe', description: 'Risk of rhabdomyolysis', recommendation: 'Avoid combination. Use azithromycin instead.' },
  { drug_a: 'simvastatin', drug_b: 'amlodipine', severity: 'moderate', description: 'Increased statin exposure', recommendation: 'Limit simvastatin to 20mg daily' },
  { drug_a: 'clopidogrel', drug_b: 'omeprazole', severity: 'moderate', description: 'Omeprazole reduces clopidogrel activation', recommendation: 'Use pantoprazole instead' },
  { drug_a: 'ciprofloxacin', drug_b: 'theophylline', severity: 'severe', description: 'Ciprofloxacin inhibits theophylline metabolism', recommendation: 'Monitor theophylline levels, reduce dose' },
  { drug_a: 'ciprofloxacin', drug_b: 'antacids', severity: 'moderate', description: 'Antacids reduce ciprofloxacin absorption', recommendation: 'Take ciprofloxacin 2h before or 6h after antacids' },
  { drug_a: 'ssri', drug_b: 'tramadol', severity: 'severe', description: 'Risk of serotonin syndrome', recommendation: 'Avoid combination or monitor closely' },
  { drug_a: 'ssri', drug_b: 'maoi', severity: 'contraindicated', description: 'Fatal serotonin syndrome risk', recommendation: 'NEVER combine. 14-day washout between drugs.' },
  { drug_a: 'methotrexate', drug_b: 'nsaid', severity: 'severe', description: 'NSAIDs reduce methotrexate clearance', recommendation: 'Avoid NSAIDs or monitor methotrexate levels' },
  { drug_a: 'lithium', drug_b: 'nsaid', severity: 'severe', description: 'NSAIDs increase lithium levels', recommendation: 'Monitor lithium levels, avoid if possible' },
  { drug_a: 'lithium', drug_b: 'ace_inhibitor', severity: 'severe', description: 'ACE inhibitors increase lithium levels', recommendation: 'Monitor lithium levels closely' },
  { drug_a: 'insulin', drug_b: 'beta_blocker', severity: 'moderate', description: 'Beta-blockers mask hypoglycemia symptoms', recommendation: 'Use cardioselective beta-blockers, monitor glucose' },
  { drug_a: 'heparin', drug_b: 'aspirin', severity: 'severe', description: 'Greatly increased bleeding risk', recommendation: 'Monitor closely if combination required' },
];

export function checkDrugInteractions(drugNames: string[]): DrugInteraction[] {
  const normalized = drugNames.map((d) => d.toLowerCase().trim());
  const found: DrugInteraction[] = [];

  for (const interaction of INTERACTIONS) {
    const aMatch = normalized.some((d) => d.includes(interaction.drug_a) || interaction.drug_a.includes(d));
    const bMatch = normalized.some((d) => d.includes(interaction.drug_b) || interaction.drug_b.includes(d));
    if (aMatch && bMatch) {
      found.push(interaction);
    }
  }

  return found;
}

// ══════════════════════════════════════
// DOSE VALIDATION (common medications)
// ══════════════════════════════════════

interface DoseRange {
  drug: string;
  route: string;
  min_mg: number;
  max_mg: number;
  max_daily_mg: number;
  frequency_max: number;
  notes?: string;
}

const DOSE_RANGES: DoseRange[] = [
  { drug: 'paracetamol', route: 'oral', min_mg: 325, max_mg: 1000, max_daily_mg: 4000, frequency_max: 4 },
  { drug: 'ibuprofen', route: 'oral', min_mg: 200, max_mg: 800, max_daily_mg: 3200, frequency_max: 4 },
  { drug: 'amoxicillin', route: 'oral', min_mg: 250, max_mg: 1000, max_daily_mg: 3000, frequency_max: 3 },
  { drug: 'metformin', route: 'oral', min_mg: 250, max_mg: 1000, max_daily_mg: 2550, frequency_max: 3, notes: 'Take with meals' },
  { drug: 'amlodipine', route: 'oral', min_mg: 2.5, max_mg: 10, max_daily_mg: 10, frequency_max: 1 },
  { drug: 'atorvastatin', route: 'oral', min_mg: 10, max_mg: 80, max_daily_mg: 80, frequency_max: 1, notes: 'Take at bedtime' },
  { drug: 'metoprolol', route: 'oral', min_mg: 12.5, max_mg: 200, max_daily_mg: 400, frequency_max: 2 },
  { drug: 'pantoprazole', route: 'oral', min_mg: 20, max_mg: 40, max_daily_mg: 80, frequency_max: 2, notes: 'Take 30min before meals' },
  { drug: 'clopidogrel', route: 'oral', min_mg: 75, max_mg: 300, max_daily_mg: 300, frequency_max: 1, notes: '300mg loading dose only' },
  { drug: 'enoxaparin', route: 'sc', min_mg: 20, max_mg: 150, max_daily_mg: 300, frequency_max: 2, notes: 'Dose by weight: 1mg/kg BD or 1.5mg/kg OD' },
  { drug: 'insulin', route: 'sc', min_mg: 1, max_mg: 100, max_daily_mg: 300, frequency_max: 6, notes: 'Units, not mg. Titrate per blood sugar.' },
  { drug: 'morphine', route: 'iv', min_mg: 1, max_mg: 15, max_daily_mg: 60, frequency_max: 6, notes: 'Titrate for pain. Watch respiratory depression.' },
  { drug: 'ondansetron', route: 'iv', min_mg: 4, max_mg: 8, max_daily_mg: 24, frequency_max: 3 },
  { drug: 'ciprofloxacin', route: 'oral', min_mg: 250, max_mg: 750, max_daily_mg: 1500, frequency_max: 2 },
  { drug: 'azithromycin', route: 'oral', min_mg: 250, max_mg: 500, max_daily_mg: 500, frequency_max: 1, notes: '5-day course typically' },
  { drug: 'prednisolone', route: 'oral', min_mg: 5, max_mg: 60, max_daily_mg: 80, frequency_max: 1, notes: 'Taper, do not stop abruptly' },
  { drug: 'aspirin', route: 'oral', min_mg: 75, max_mg: 325, max_daily_mg: 325, frequency_max: 1, notes: 'Enteric-coated preferred' },
  { drug: 'furosemide', route: 'oral', min_mg: 20, max_mg: 80, max_daily_mg: 600, frequency_max: 3 },
  { drug: 'furosemide', route: 'iv', min_mg: 20, max_mg: 200, max_daily_mg: 600, frequency_max: 4, notes: 'IV push max 4mg/min' },
];

export interface DoseAlert {
  drug: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export function validateDose(drug: string, dose_mg: number, route: string, frequency: number): DoseAlert[] {
  const alerts: DoseAlert[] = [];
  const normalized = drug.toLowerCase().trim();
  const match = DOSE_RANGES.find((d) => normalized.includes(d.drug) && d.route === route.toLowerCase());

  if (!match) return alerts;

  if (dose_mg > match.max_mg) {
    alerts.push({ drug, severity: 'critical', message: `Single dose ${dose_mg}mg exceeds max ${match.max_mg}mg for ${match.drug} (${route})` });
  } else if (dose_mg < match.min_mg) {
    alerts.push({ drug, severity: 'warning', message: `Dose ${dose_mg}mg below typical minimum ${match.min_mg}mg for ${match.drug}` });
  }

  const daily = dose_mg * frequency;
  if (daily > match.max_daily_mg) {
    alerts.push({ drug, severity: 'critical', message: `Daily total ${daily}mg exceeds max ${match.max_daily_mg}mg/day` });
  }

  if (frequency > match.frequency_max) {
    alerts.push({ drug, severity: 'warning', message: `Frequency ${frequency}x/day exceeds typical max ${match.frequency_max}x/day` });
  }

  if (match.notes) {
    alerts.push({ drug, severity: 'info', message: match.notes });
  }

  return alerts;
}

// ══════════════════════════════════════
// ICD-10 COMMON CODES (Indian hospital top 100)
// ══════════════════════════════════════

export interface ICD10Code {
  code: string;
  description: string;
  category: string;
}

export const ICD10_CODES: ICD10Code[] = [
  // Cardiovascular
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular' },
  { code: 'I11.9', description: 'Hypertensive heart disease without heart failure', category: 'Cardiovascular' },
  { code: 'I20.9', description: 'Angina pectoris, unspecified', category: 'Cardiovascular' },
  { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', category: 'Cardiovascular' },
  { code: 'I25.10', description: 'Atherosclerotic heart disease', category: 'Cardiovascular' },
  { code: 'I48.91', description: 'Atrial fibrillation', category: 'Cardiovascular' },
  { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular' },
  { code: 'I63.9', description: 'Cerebral infarction, unspecified (stroke)', category: 'Cardiovascular' },
  // Endocrine
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Endocrine' },
  { code: 'E11.22', description: 'Type 2 diabetes mellitus with diabetic CKD', category: 'Endocrine' },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', category: 'Endocrine' },
  { code: 'E05.90', description: 'Thyrotoxicosis, unspecified', category: 'Endocrine' },
  { code: 'E78.5', description: 'Dyslipidemia, unspecified', category: 'Endocrine' },
  // Respiratory
  { code: 'J06.9', description: 'Acute upper respiratory infection', category: 'Respiratory' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Respiratory' },
  { code: 'J44.1', description: 'COPD with acute exacerbation', category: 'Respiratory' },
  { code: 'J45.909', description: 'Asthma, unspecified', category: 'Respiratory' },
  { code: 'J96.00', description: 'Acute respiratory failure', category: 'Respiratory' },
  // GI
  { code: 'K21.0', description: 'GERD with esophagitis', category: 'GI' },
  { code: 'K29.70', description: 'Gastritis, unspecified', category: 'GI' },
  { code: 'K35.80', description: 'Acute appendicitis', category: 'GI' },
  { code: 'K40.90', description: 'Inguinal hernia', category: 'GI' },
  { code: 'K80.20', description: 'Calculus of gallbladder without obstruction', category: 'GI' },
  { code: 'K92.2', description: 'GI hemorrhage, unspecified', category: 'GI' },
  // Renal
  { code: 'N18.3', description: 'Chronic kidney disease, stage 3', category: 'Renal' },
  { code: 'N18.5', description: 'Chronic kidney disease, stage 5', category: 'Renal' },
  { code: 'N17.9', description: 'Acute kidney failure, unspecified', category: 'Renal' },
  { code: 'N20.0', description: 'Calculus of kidney (renal stones)', category: 'Renal' },
  { code: 'N39.0', description: 'Urinary tract infection', category: 'Renal' },
  // Neuro
  { code: 'G40.909', description: 'Epilepsy, unspecified', category: 'Neuro' },
  { code: 'G43.909', description: 'Migraine, unspecified', category: 'Neuro' },
  { code: 'G20', description: "Parkinson's disease", category: 'Neuro' },
  { code: 'G30.9', description: "Alzheimer's disease, unspecified", category: 'Neuro' },
  // Ortho
  { code: 'M17.11', description: 'Primary osteoarthritis, right knee', category: 'Ortho' },
  { code: 'M17.12', description: 'Primary osteoarthritis, left knee', category: 'Ortho' },
  { code: 'M54.5', description: 'Low back pain', category: 'Ortho' },
  { code: 'S72.001A', description: 'Fracture of neck of femur', category: 'Ortho' },
  { code: 'S82.001A', description: 'Fracture of tibia', category: 'Ortho' },
  // Infectious
  { code: 'A09', description: 'Infectious gastroenteritis (AGE)', category: 'Infectious' },
  { code: 'A41.9', description: 'Sepsis, unspecified organism', category: 'Infectious' },
  { code: 'B20', description: 'HIV disease', category: 'Infectious' },
  { code: 'A16.2', description: 'Pulmonary tuberculosis', category: 'Infectious' },
  { code: 'A91', description: 'Dengue hemorrhagic fever', category: 'Infectious' },
  { code: 'B50.9', description: 'Plasmodium falciparum malaria', category: 'Infectious' },
  // Surgery
  { code: 'Z96.641', description: 'Presence of right artificial knee joint (post-TKR)', category: 'Surgery' },
  { code: 'Z96.642', description: 'Presence of left artificial knee joint (post-TKR)', category: 'Surgery' },
  { code: 'Z95.1', description: 'Presence of coronary bypass graft (post-CABG)', category: 'Surgery' },
  { code: 'Z95.5', description: 'Presence of coronary stent (post-PTCA)', category: 'Surgery' },
  // Other common
  { code: 'D64.9', description: 'Anemia, unspecified', category: 'Hematology' },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'Symptoms' },
  { code: 'R51', description: 'Headache', category: 'Symptoms' },
  { code: 'R06.02', description: 'Shortness of breath', category: 'Symptoms' },
  { code: 'R07.9', description: 'Chest pain, unspecified', category: 'Symptoms' },
  { code: 'R10.9', description: 'Abdominal pain, unspecified', category: 'Symptoms' },
  { code: 'Z87.891', description: 'Personal history of COVID-19', category: 'Other' },
];

export function searchICD10(query: string): ICD10Code[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return ICD10_CODES.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
  ).slice(0, 15);
}
