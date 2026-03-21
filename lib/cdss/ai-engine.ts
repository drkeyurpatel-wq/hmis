// lib/cdss/ai-engine.ts
// Types match exactly what components/emr-v2/ai-copilot.tsx renders

export interface DDxResult {
  clinical_reasoning: string;
  differentials: { rank: number; diagnosis: string; probability: string; icd10: string; reasoning: string; distinguishing: string }[];
  recommended_investigations: string[];
  red_flags: string[];
}

export interface RxReviewResult {
  overall_score: string;
  summary: string;
  issues: { drug: string; type: string; message: string; severity: string }[];
  missing_medications: { drug: string; reason: string; urgency: string }[];
}

export interface CopilotResult {
  completeness: { score: number; missing: string[] };
  alerts: string[];
  suggestions: { priority: string; category: string; message: string; action?: string }[];
}

export function getDifferentialDiagnosis(params: {
  complaints: string[]; vitals: any; examFindings: any[];
  allergies: string[]; age: number | string; gender: string;
}): { result: DDxResult; error: string | null } {
  const cc = params.complaints.map(c => c.toLowerCase()).join(' ');
  const age = typeof params.age === 'string' ? parseInt(params.age) || 40 : params.age;
  const diffs: DDxResult['differentials'] = [];
  const invs: DDxResult['recommended_investigations'] = [];
  const flags: string[] = [];
  let reasoning = '';

  if (cc.includes('chest pain')) {
    reasoning = `Chest pain in ${age > 40 ? 'adult >40 years' : 'young adult'} — must rule out ACS first.`;
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Acute Coronary Syndrome', icd10: 'I21.9', reasoning: 'Must rule out ACS in chest pain', distinguishing: 'ECG changes, troponin elevation, diaphoresis', probability: age > 40 ? 'High' : 'Moderate' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'GERD', icd10: 'K21.0', reasoning: 'Burning retrosternal pain', distinguishing: 'Post-prandial, relieved by antacids', probability: 'Moderate' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Musculoskeletal Chest Pain', icd10: 'M79.3', reasoning: 'Chest wall tenderness', distinguishing: 'Reproducible on palpation, positional', probability: 'Low' });
    invs.push('ECG', 'Troponin I');
    if (age > 40) flags.push('Chest pain in >40 years — ACS until proven otherwise');
  } else if (cc.includes('headache')) {
    reasoning = 'Headache evaluation — determine primary vs secondary cause.';
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Tension-type Headache', icd10: 'G44.2', reasoning: 'Most common primary headache', distinguishing: 'Band-like, bilateral, pressure quality', probability: 'High' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Migraine', icd10: 'G43.9', reasoning: 'Episodic unilateral headache', distinguishing: 'Throbbing, nausea, photophobia, aura', probability: 'Moderate' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Secondary Headache', icd10: 'G44.8', reasoning: 'Red flags present', distinguishing: 'New onset, progressive, focal signs', probability: 'Low' });
    if (cc.includes('worst') || cc.includes('thunder')) { flags.push('Thunderclap headache — rule out SAH urgently'); invs.push('CT Brain (urgent)'); }
  } else if (cc.includes('fever')) {
    reasoning = 'Fever workup — identify focus of infection.';
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Viral Fever', icd10: 'B34.9', reasoning: 'Most common cause of acute fever', distinguishing: 'Body ache, self-limiting, no localising signs', probability: 'High' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Dengue Fever', icd10: 'A97.0', reasoning: 'Endemic area consideration', distinguishing: 'Retro-orbital pain, thrombocytopenia, rash', probability: 'Moderate' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Urinary Tract Infection', icd10: 'N39.0', reasoning: 'Fever with urinary symptoms', distinguishing: 'Dysuria, frequency, suprapubic pain', probability: cc.includes('burn') || cc.includes('urin') ? 'High' : 'Low' });
    invs.push('CBC', 'CRP');
    if (cc.includes('dengue') || cc.includes('endemic')) invs.push('Dengue NS1 + IgM');
  } else if (cc.includes('breathless') || cc.includes('dyspnea') || cc.includes('sob')) {
    reasoning = 'Dyspnea — cardiac vs respiratory evaluation.';
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Asthma / COPD Exacerbation', icd10: 'J45.9', reasoning: 'Obstructive airway disease', distinguishing: 'Wheeze, episodic, trigger-related', probability: 'High' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Heart Failure', icd10: 'I50.9', reasoning: 'Cardiac cause of dyspnea', distinguishing: 'Orthopnea, PND, pedal oedema, JVP', probability: age > 50 ? 'Moderate' : 'Low' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Pneumonia', icd10: 'J18.9', reasoning: 'Infective cause', distinguishing: 'Productive cough, fever, crackles', probability: cc.includes('cough') ? 'Moderate' : 'Low' });
    invs.push('Chest X-Ray', 'SpO2');
  } else if (cc.includes('abdominal') || cc.includes('stomach') || cc.includes('belly')) {
    reasoning = 'Abdominal pain — surgical vs medical cause.';
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Gastritis / Peptic Ulcer', icd10: 'K29.7', reasoning: 'Epigastric pain', distinguishing: 'Burning, meal-related, antacid response', probability: 'High' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Appendicitis', icd10: 'K35.8', reasoning: 'Acute surgical abdomen', distinguishing: 'RIF pain, guarding, rebound tenderness', probability: cc.includes('right') || cc.includes('rif') ? 'High' : 'Moderate' });
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Renal Colic', icd10: 'N23', reasoning: 'Ureteric stone', distinguishing: 'Colicky loin-to-groin pain, hematuria', probability: cc.includes('loin') || cc.includes('colicky') ? 'High' : 'Low' });
    invs.push('USG Abdomen');
  } else {
    reasoning = 'Further clinical evaluation needed for specific differential diagnosis.';
    diffs.push({ rank: diffs.length + 1, diagnosis: 'Undetermined - requires assessment', icd10: 'R69', reasoning: 'Insufficient data', distinguishing: 'Further history and examination needed', probability: 'N/A' });
    invs.push('CBC', 'RBS');
  }

  return { result: { clinical_reasoning: reasoning, differentials: diffs, recommended_investigations: invs, red_flags: flags }, error: null };
}

export function reviewPrescription(params: {
  prescriptions: string[]; allergies: string[]; age: number | string;
  gender?: string; complaints?: string[]; vitals: any; diagnoses: any[];
}): { result: RxReviewResult; error: string | null } {
  const issues: RxReviewResult['issues'] = [];
  const missing: RxReviewResult['missing_medications'] = [];
  const rxLower = params.prescriptions.map(r => r.toLowerCase());
  const allergyLower = params.allergies.map(a => a.toLowerCase());
  const dx = (params.diagnoses || []).map((d: any) => (d.label || d.name || '').toLowerCase());

  // Allergy checks
  for (const rx of rxLower) {
    for (const al of allergyLower) {
      if (rx.includes(al) || (al.includes('penicillin') && (rx.includes('amoxicillin') || rx.includes('ampicillin')))) {
        issues.push({ drug: rx, type: 'allergy', message: `ALLERGY: Patient allergic to ${al} — ${rx} may cross-react`, severity: 'critical' });
      }
    }
  }
  // Interaction checks
  const hasNSAID = rxLower.some(r => r.includes('ibuprofen') || r.includes('diclofenac') || r.includes('nsaid') || r.includes('ketorolac'));
  const hasAnticoag = rxLower.some(r => r.includes('warfarin') || r.includes('aspirin') || r.includes('clopidogrel') || r.includes('heparin'));
  if (hasNSAID && hasAnticoag) issues.push({ drug: 'NSAID + Anticoagulant', type: 'interaction', message: 'NSAID + Anticoagulant/Antiplatelet — increased bleeding risk', severity: 'warning' });
  if (hasNSAID && params.vitals?.creatinine > 1.5) issues.push({ drug: 'NSAID', type: 'renal', message: 'NSAID with elevated creatinine — risk of AKI', severity: 'critical' });
  if (rxLower.some(r => r.includes('metformin')) && params.vitals?.creatinine > 1.5) issues.push({ drug: 'Metformin', type: 'renal', message: 'Metformin: check renal function — Cr elevated', severity: 'warning' });

  // Missing meds for diagnoses
  if (dx.some(d => d.includes('hypertension') || d.includes('htn')) && !rxLower.some(r => r.includes('amlodipine') || r.includes('losartan') || r.includes('telmisartan') || r.includes('enalapril')))
    missing.push({ drug: 'Antihypertensive', reason: 'Hypertension diagnosed but no antihypertensive prescribed', urgency: 'recommended' });
  if (dx.some(d => d.includes('diabetes') || d.includes('dm')) && !rxLower.some(r => r.includes('metformin') || r.includes('glimepiride') || r.includes('insulin')))
    missing.push({ drug: 'Antidiabetic', reason: 'Diabetes diagnosed but no antidiabetic prescribed', urgency: 'recommended' });

  const score = issues.some(i => i.severity === 'critical') ? 'danger' : issues.length > 0 ? 'warning' : 'safe';
  const summary = issues.length === 0 && missing.length === 0 ? 'Prescription appears safe. No interactions or allergy conflicts detected.' : `${issues.length} issue(s) and ${missing.length} missing medication(s) detected.`;

  return { result: { overall_score: score, summary, issues, missing_medications: missing }, error: null };
}

export function getCopilotSuggestions(params: {
  complaints: string[]; vitals: any; examFindings: any[];
  diagnoses: { code: string; label: string; type: string }[];
  investigations: any[]; prescriptions: any[];
  allergies?: string[]; age: number | string; gender: string;
  advice?: string[]; followUp?: string;
}): { result: CopilotResult; error: string | null } {
  const missing: string[] = [];
  const alerts: CopilotResult['alerts'] = [];
  const suggestions: CopilotResult['suggestions'] = [];
  let score = 0;
  const total = 8;

  // Completeness check
  if (params.complaints.length > 0) score++; else missing.push('Chief complaints');
  if (params.vitals?.systolic) score++; else missing.push('Blood pressure');
  if (params.vitals?.heartRate) score++; else missing.push('Heart rate');
  if (params.vitals?.temperature) score++; else missing.push('Temperature');
  if (params.diagnoses?.length > 0) score++; else missing.push('Diagnosis');
  if (params.prescriptions?.length > 0) score++; else missing.push('Prescription');
  if (params.investigations?.length > 0) score++; else missing.push('Investigations');
  if (params.followUp) score++; else missing.push('Follow-up date');

  const pct = Math.round((score / total) * 100);

  // Alerts
  const rxCheck = reviewPrescription({ prescriptions: params.prescriptions.map(String), allergies: params.allergies || [], age: params.age, vitals: params.vitals, diagnoses: params.diagnoses });
  if (rxCheck.result.issues.length > 0) {
    for (const issue of rxCheck.result.issues) alerts.push(`⚠️ ${issue.drug}: ${issue.message}`);
  }
  if (params.vitals?.systolic > 180) alerts.push(`🔴 Systolic BP ${params.vitals.systolic} — hypertensive urgency`);
  if (params.vitals?.spo2 && parseFloat(params.vitals.spo2) < 92) alerts.push(`🔴 SpO2 ${params.vitals.spo2}% — hypoxia, consider O2`);

  // Suggestions
  if (params.diagnoses.length === 0 && params.complaints.length > 0) suggestions.push({ priority: 'high', category: 'clinical', message: 'Add a working diagnosis based on complaints', action: 'Go to Diagnosis tab' });
  if (params.complaints.length > 0 && params.investigations.length === 0) suggestions.push({ priority: 'medium', category: 'clinical', message: 'Consider ordering investigations for presenting complaints', action: 'Go to Investigations tab' });
  if (!params.followUp) suggestions.push({ priority: 'low', category: 'documentation', message: 'Set a follow-up date for the patient', action: 'Go to Follow-up tab' });

  return { result: { completeness: { score: pct, missing }, alerts, suggestions }, error: null };
}
