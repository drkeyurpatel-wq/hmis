// lib/brain/engine.ts
// Core calculation engine for Brain (Clinical AI) module.
// Rule-based scoring for readmission risk, antibiotic stewardship,
// LOS prediction, and quality indicators.

import type { RiskCategory, AntibioticAlertType, AlertSeverity, QualityGrade } from '@/types/database';

// ============================================================
// 1. READMISSION RISK SCORING
// ============================================================

const RISK_WEIGHTS = {
  age: 0.15,
  comorbidity: 0.20,
  prior_admissions: 0.20,
  los: 0.10,
  emergency: 0.10,
  abnormal_labs: 0.10,
  polypharmacy: 0.10,
  social_risk: 0.05,
} as const;

export interface ReadmissionInput {
  age: number | null;
  comorbidityCount: number;
  priorAdmissions12m: number;
  losDays: number;
  isEmergency: boolean;
  abnormalLabCount: number;
  dischargeMedCount: number;
  socialRiskFlag: boolean;
}

export interface ReadmissionScores {
  age_score: number;
  comorbidity_count: number;
  comorbidity_score: number;
  prior_admissions_12m: number;
  prior_admission_score: number;
  los_score: number;
  emergency_admission_score: number;
  abnormal_labs_at_discharge: number;
  abnormal_labs_score: number;
  polypharmacy_score: number;
  social_risk_score: number;
  total_risk_score: number;
  risk_category: RiskCategory;
}

function scoreAge(age: number | null): number {
  if (!age || age < 65) return 0;
  if (age < 75) return 0.5;
  return 1.0;
}

function scoreComorbidity(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 0.3;
  if (count <= 4) return 0.6;
  return 1.0;
}

function scorePriorAdmissions(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 0.5;
  return 1.0;
}

function scoreLOS(days: number): number {
  if (days <= 3) return 0;
  if (days <= 7) return 0.5;
  return 1.0;
}

function scoreAbnormalLabs(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 0.5;
  return 1.0;
}

function scorePolypharmacy(medCount: number): number {
  if (medCount <= 3) return 0;
  if (medCount <= 5) return 0.5;
  return 1.0;
}

function categorizeRisk(score: number): RiskCategory {
  if (score <= 2.5) return 'low';
  if (score <= 5.0) return 'moderate';
  if (score <= 7.5) return 'high';
  return 'very_high';
}

export function calculateReadmissionRisk(input: ReadmissionInput): ReadmissionScores {
  const ageScore = scoreAge(input.age);
  const comorbidityScore = scoreComorbidity(input.comorbidityCount);
  const priorScore = scorePriorAdmissions(input.priorAdmissions12m);
  const losScore = scoreLOS(input.losDays);
  const emergencyScore = input.isEmergency ? 1.0 : 0;
  const labsScore = scoreAbnormalLabs(input.abnormalLabCount);
  const polyScore = scorePolypharmacy(input.dischargeMedCount);
  const socialScore = input.socialRiskFlag ? 1.0 : 0;

  const totalRaw =
    ageScore * RISK_WEIGHTS.age +
    comorbidityScore * RISK_WEIGHTS.comorbidity +
    priorScore * RISK_WEIGHTS.prior_admissions +
    losScore * RISK_WEIGHTS.los +
    emergencyScore * RISK_WEIGHTS.emergency +
    labsScore * RISK_WEIGHTS.abnormal_labs +
    polyScore * RISK_WEIGHTS.polypharmacy +
    socialScore * RISK_WEIGHTS.social_risk;

  // Scale 0-1 weighted sum to 0-10
  const totalScore = Math.round(totalRaw * 10 * 100) / 100;

  return {
    age_score: ageScore,
    comorbidity_count: input.comorbidityCount,
    comorbidity_score: comorbidityScore,
    prior_admissions_12m: input.priorAdmissions12m,
    prior_admission_score: priorScore,
    los_score: losScore,
    emergency_admission_score: emergencyScore,
    abnormal_labs_at_discharge: input.abnormalLabCount,
    abnormal_labs_score: labsScore,
    polypharmacy_score: polyScore,
    social_risk_score: socialScore,
    total_risk_score: totalScore,
    risk_category: categorizeRisk(totalScore),
  };
}

// ============================================================
// 2. ANTIBIOTIC STEWARDSHIP
// ============================================================

export const BROAD_SPECTRUM_ANTIBIOTICS = [
  'meropenem', 'imipenem', 'doripenem', 'ertapenem',
  'piperacillin-tazobactam', 'pip-taz',
  'cefoperazone-sulbactam', 'ceftriaxone', 'cefepime',
  'vancomycin', 'linezolid', 'colistin', 'tigecycline',
];

export const RESTRICTED_ANTIBIOTICS = [
  'meropenem', 'imipenem', 'doripenem', 'colistin',
  'tigecycline', 'linezolid', 'daptomycin', 'caspofungin',
  'voriconazole', 'polymyxin b',
];

export const ANTIBIOTIC_CLASSES: Record<string, string> = {
  amoxicillin: 'penicillin', 'amoxicillin-clavulanate': 'penicillin',
  ampicillin: 'penicillin', 'piperacillin-tazobactam': 'penicillin',
  cephalexin: 'cephalosporin', cefuroxime: 'cephalosporin',
  ceftriaxone: 'cephalosporin', cefixime: 'cephalosporin',
  cefepime: 'cephalosporin', 'cefoperazone-sulbactam': 'cephalosporin',
  cefpodoxime: 'cephalosporin',
  meropenem: 'carbapenem', imipenem: 'carbapenem',
  doripenem: 'carbapenem', ertapenem: 'carbapenem',
  azithromycin: 'macrolide', clarithromycin: 'macrolide',
  erythromycin: 'macrolide',
  ciprofloxacin: 'fluoroquinolone', levofloxacin: 'fluoroquinolone',
  moxifloxacin: 'fluoroquinolone', ofloxacin: 'fluoroquinolone',
  norfloxacin: 'fluoroquinolone',
  doxycycline: 'tetracycline', minocycline: 'tetracycline',
  metronidazole: 'nitroimidazole', tinidazole: 'nitroimidazole',
  vancomycin: 'glycopeptide', teicoplanin: 'glycopeptide',
  linezolid: 'oxazolidinone',
  colistin: 'polymyxin', 'polymyxin b': 'polymyxin',
  clindamycin: 'lincosamide',
  cotrimoxazole: 'sulfonamide', 'trimethoprim-sulfamethoxazole': 'sulfonamide',
  nitrofurantoin: 'nitrofuran',
  gentamicin: 'aminoglycoside', amikacin: 'aminoglycoside',
  tobramycin: 'aminoglycoside',
  tigecycline: 'glycylcycline',
  daptomycin: 'lipopeptide',
  fosfomycin: 'fosfomycin',
};

export interface AntibioticPrescription {
  id: string;
  patient_id: string;
  admission_id: string | null;
  drug_name: string;
  route: string | null;
  prescribed_at: string;
  prescribing_doctor_id: string | null;
  duration_days: number | null;
  is_surgical_prophylaxis: boolean;
}

export interface AntibioticAlertResult {
  alert_type: AntibioticAlertType;
  drug_name: string;
  drug_class: string | null;
  severity: AlertSeverity;
  description: string;
  recommendation: string;
}

export function classifyAntibiotic(drugName: string): string | null {
  const normalized = drugName.toLowerCase().trim();
  return ANTIBIOTIC_CLASSES[normalized] || null;
}

export function isBroadSpectrum(drugName: string): boolean {
  return BROAD_SPECTRUM_ANTIBIOTICS.includes(drugName.toLowerCase().trim());
}

export function isRestricted(drugName: string): boolean {
  return RESTRICTED_ANTIBIOTICS.includes(drugName.toLowerCase().trim());
}

export function checkDurationExceeded(
  rx: AntibioticPrescription,
  hasCultureOrdered: boolean
): AntibioticAlertResult | null {
  if (!rx.duration_days || rx.duration_days <= 7) return null;
  if (hasCultureOrdered) return null;

  return {
    alert_type: 'duration_exceeded',
    drug_name: rx.drug_name,
    drug_class: classifyAntibiotic(rx.drug_name),
    severity: 'warning',
    description: `${rx.drug_name} prescribed for ${rx.duration_days} days without culture/sensitivity ordered.`,
    recommendation: 'Order culture and sensitivity before extending antibiotic beyond 7 days.',
  };
}

export function checkBroadSpectrumNoCulture(
  rx: AntibioticPrescription,
  hasCultureResult: boolean
): AntibioticAlertResult | null {
  if (!isBroadSpectrum(rx.drug_name)) return null;
  if (hasCultureResult) return null;

  return {
    alert_type: 'broad_spectrum_no_culture',
    drug_name: rx.drug_name,
    drug_class: classifyAntibiotic(rx.drug_name),
    severity: 'critical',
    description: `Broad-spectrum antibiotic ${rx.drug_name} prescribed without culture/sensitivity result.`,
    recommendation: 'Obtain culture before or immediately after starting broad-spectrum antibiotics. De-escalate when results available.',
  };
}

export function checkDuplicateClass(
  rx: AntibioticPrescription,
  otherActiveRx: AntibioticPrescription[]
): AntibioticAlertResult | null {
  const rxClass = classifyAntibiotic(rx.drug_name);
  if (!rxClass) return null;

  const duplicate = otherActiveRx.find(
    (other) => other.id !== rx.id && classifyAntibiotic(other.drug_name) === rxClass
  );

  if (!duplicate) return null;

  return {
    alert_type: 'duplicate_class',
    drug_name: rx.drug_name,
    drug_class: rxClass,
    severity: 'warning',
    description: `Duplicate ${rxClass} class: ${rx.drug_name} and ${duplicate.drug_name} prescribed concurrently.`,
    recommendation: `Review need for two ${rxClass} antibiotics. Consider discontinuing one.`,
  };
}

export function checkIVToOralOpportunity(
  rx: AntibioticPrescription,
  daysSinceStart: number
): AntibioticAlertResult | null {
  if (!rx.route || rx.route.toLowerCase() !== 'iv') return null;
  if (daysSinceStart < 2) return null;

  return {
    alert_type: 'iv_to_oral_opportunity',
    drug_name: rx.drug_name,
    drug_class: classifyAntibiotic(rx.drug_name),
    severity: 'info',
    description: `${rx.drug_name} IV for ${daysSinceStart} days. Consider step-down to oral if clinically stable.`,
    recommendation: 'Evaluate for IV-to-oral switch if patient is tolerating oral intake and clinically improving.',
  };
}

export function checkProphylaxisExceeded(
  rx: AntibioticPrescription,
  hoursSinceSurgery: number
): AntibioticAlertResult | null {
  if (!rx.is_surgical_prophylaxis) return null;
  if (hoursSinceSurgery <= 24) return null;

  return {
    alert_type: 'prophylaxis_exceeded',
    drug_name: rx.drug_name,
    drug_class: classifyAntibiotic(rx.drug_name),
    severity: 'warning',
    description: `Surgical prophylaxis ${rx.drug_name} continuing beyond 24 hours post-surgery.`,
    recommendation: 'Discontinue prophylactic antibiotic. Evidence does not support prophylaxis beyond 24 hours for most surgeries.',
  };
}

export function checkRestrictedAntibiotic(
  rx: AntibioticPrescription
): AntibioticAlertResult | null {
  if (!isRestricted(rx.drug_name)) return null;

  return {
    alert_type: 'restricted_antibiotic',
    drug_name: rx.drug_name,
    drug_class: classifyAntibiotic(rx.drug_name),
    severity: 'critical',
    description: `Restricted antibiotic ${rx.drug_name} prescribed. Requires antimicrobial stewardship approval.`,
    recommendation: 'Obtain infectious disease or antimicrobial stewardship team approval within 24 hours.',
  };
}

// ============================================================
// 3. LOS PREDICTION
// ============================================================

export interface LOSInput {
  diagnosisCode: string | null;
  procedureType: string | null;
  age: number | null;
  comorbidityCount: number;
  admissionType: string;
  payorType: string | null;
}

export interface LOSBenchmark {
  avg_los: number;
  stddev_los: number | null;
}

export function predictLOS(input: LOSInput, benchmark: LOSBenchmark | null): {
  predicted_los_days: number;
  prediction_confidence: number;
  age_group: string;
} {
  // Base from benchmark or default
  let baseLOS = benchmark?.avg_los ?? 5.0;
  let confidence = benchmark ? 0.7 : 0.3;

  // Age adjustment
  let ageGroup = 'adult';
  if (input.age !== null) {
    if (input.age < 18) { ageGroup = 'pediatric'; baseLOS *= 0.8; }
    else if (input.age >= 65 && input.age < 75) { ageGroup = 'elderly'; baseLOS *= 1.2; }
    else if (input.age >= 75) { ageGroup = 'very_elderly'; baseLOS *= 1.4; }
  }

  // Comorbidity adjustment
  if (input.comorbidityCount >= 3) baseLOS *= 1.3;
  else if (input.comorbidityCount >= 1) baseLOS *= 1.1;

  // Emergency admissions tend to be longer
  if (input.admissionType === 'emergency') baseLOS *= 1.2;

  // Round to 1 decimal
  const predictedLOS = Math.round(baseLOS * 10) / 10;

  return {
    predicted_los_days: predictedLOS,
    prediction_confidence: confidence,
    age_group: ageGroup,
  };
}

export function isLOSOutlier(
  actualDays: number,
  predictedDays: number,
  stddev: number | null
): boolean {
  const threshold = stddev ? predictedDays + 2 * stddev : predictedDays * 1.5;
  return actualDays > threshold;
}

// ============================================================
// 4. QUALITY SCORECARD
// ============================================================

export interface QualityScoreInput {
  fall_rate: number;
  medication_error_rate: number;
  wrong_site_surgery_count: number;
  mortality_rate: number;
  readmission_30_day_rate: number;
  ssi_rate: number;
  antibiotic_prophylaxis_compliance: number;
  surgical_safety_checklist_compliance: number;
  ed_wait_time_avg_min: number;
  patient_satisfaction_score: number;
}

// NABH benchmark thresholds (green = good, red = needs improvement)
const QUALITY_BENCHMARKS = {
  fall_rate: { good: 1.0, acceptable: 3.0 },              // per 1000 patient-days
  medication_error_rate: { good: 0.5, acceptable: 2.0 },
  mortality_rate: { good: 1.0, acceptable: 3.0 },
  readmission_30_day_rate: { good: 5.0, acceptable: 10.0 },
  ssi_rate: { good: 2.0, acceptable: 5.0 },
  antibiotic_prophylaxis_compliance: { good: 95, acceptable: 80 },
  surgical_safety_checklist_compliance: { good: 95, acceptable: 85 },
  ed_wait_time_avg_min: { good: 30, acceptable: 60 },
  patient_satisfaction_score: { good: 8.0, acceptable: 6.0 },
} as const;

export function calculateQualityScore(input: QualityScoreInput): {
  overall_quality_score: number;
  overall_grade: QualityGrade;
} {
  // Score each indicator 0-100 based on benchmarks, then weighted average
  const scores: number[] = [];

  // Lower-is-better metrics
  const lowerBetter = (val: number, good: number, acceptable: number) => {
    if (val <= good) return 100;
    if (val <= acceptable) return 70;
    return Math.max(0, 40 - (val - acceptable) * 10);
  };

  // Higher-is-better metrics
  const higherBetter = (val: number, good: number, acceptable: number) => {
    if (val >= good) return 100;
    if (val >= acceptable) return 70;
    return Math.max(0, 40 - (acceptable - val) * 2);
  };

  scores.push(lowerBetter(input.fall_rate, 1.0, 3.0));
  scores.push(lowerBetter(input.medication_error_rate, 0.5, 2.0));
  scores.push(input.wrong_site_surgery_count === 0 ? 100 : 0);
  scores.push(lowerBetter(input.mortality_rate, 1.0, 3.0));
  scores.push(lowerBetter(input.readmission_30_day_rate, 5.0, 10.0));
  scores.push(lowerBetter(input.ssi_rate, 2.0, 5.0));
  scores.push(higherBetter(input.antibiotic_prophylaxis_compliance, 95, 80));
  scores.push(higherBetter(input.surgical_safety_checklist_compliance, 95, 85));
  scores.push(lowerBetter(input.ed_wait_time_avg_min, 30, 60));
  scores.push(higherBetter(input.patient_satisfaction_score, 8.0, 6.0));

  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;

  let grade: QualityGrade;
  if (overall >= 90) grade = 'A';
  else if (overall >= 75) grade = 'B';
  else if (overall >= 60) grade = 'C';
  else if (overall >= 40) grade = 'D';
  else grade = 'F';

  return { overall_quality_score: overall, overall_grade: grade };
}

export function getIndicatorStatus(
  value: number,
  metric: keyof typeof QUALITY_BENCHMARKS,
  direction: 'lower' | 'higher' = 'lower'
): 'green' | 'yellow' | 'red' {
  const bench = QUALITY_BENCHMARKS[metric];
  if (!bench) return 'yellow';

  if (direction === 'lower') {
    if (value <= bench.good) return 'green';
    if (value <= bench.acceptable) return 'yellow';
    return 'red';
  } else {
    if (value >= bench.good) return 'green';
    if (value >= bench.acceptable) return 'yellow';
    return 'red';
  }
}
