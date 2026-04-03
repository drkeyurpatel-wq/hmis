// tests/brain-engine.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateReadmissionRisk,
  classifyAntibiotic, isBroadSpectrum, isRestricted,
  checkDurationExceeded, checkBroadSpectrumNoCulture,
  checkDuplicateClass, checkIVToOralOpportunity,
  checkProphylaxisExceeded, checkRestrictedAntibiotic,
  predictLOS, isLOSOutlier,
  calculateQualityScore, getIndicatorStatus,
  type ReadmissionInput, type AntibioticPrescription,
} from '@/lib/brain/engine';

// ============================================================
// READMISSION RISK
// ============================================================

describe('calculateReadmissionRisk', () => {
  it('returns low risk for a young healthy patient with short stay', () => {
    const input: ReadmissionInput = {
      age: 35, comorbidityCount: 0, priorAdmissions12m: 0,
      losDays: 2, isEmergency: false, abnormalLabCount: 0,
      dischargeMedCount: 2, socialRiskFlag: false,
    };
    const result = calculateReadmissionRisk(input);
    expect(result.risk_category).toBe('low');
    expect(result.total_risk_score).toBe(0);
  });

  it('returns very_high risk for an elderly patient with many risk factors', () => {
    const input: ReadmissionInput = {
      age: 80, comorbidityCount: 6, priorAdmissions12m: 3,
      losDays: 14, isEmergency: true, abnormalLabCount: 5,
      dischargeMedCount: 8, socialRiskFlag: true,
    };
    const result = calculateReadmissionRisk(input);
    expect(result.risk_category).toBe('very_high');
    expect(result.total_risk_score).toBe(10);
  });

  it('returns moderate risk for a mixed-factor patient', () => {
    const input: ReadmissionInput = {
      age: 70, comorbidityCount: 2, priorAdmissions12m: 1,
      losDays: 5, isEmergency: false, abnormalLabCount: 1,
      dischargeMedCount: 4, socialRiskFlag: false,
    };
    const result = calculateReadmissionRisk(input);
    expect(result.risk_category).toBe('moderate');
    expect(result.total_risk_score).toBeGreaterThan(2.5);
    expect(result.total_risk_score).toBeLessThanOrEqual(5.0);
  });

  it('correctly scores age thresholds', () => {
    const base: ReadmissionInput = {
      age: 50, comorbidityCount: 0, priorAdmissions12m: 0,
      losDays: 1, isEmergency: false, abnormalLabCount: 0,
      dischargeMedCount: 0, socialRiskFlag: false,
    };
    expect(calculateReadmissionRisk({ ...base, age: 50 }).age_score).toBe(0);
    expect(calculateReadmissionRisk({ ...base, age: 65 }).age_score).toBe(0.5);
    expect(calculateReadmissionRisk({ ...base, age: 75 }).age_score).toBe(1.0);
    expect(calculateReadmissionRisk({ ...base, age: null }).age_score).toBe(0);
  });

  it('correctly scores comorbidity thresholds', () => {
    const base: ReadmissionInput = {
      age: null, comorbidityCount: 0, priorAdmissions12m: 0,
      losDays: 1, isEmergency: false, abnormalLabCount: 0,
      dischargeMedCount: 0, socialRiskFlag: false,
    };
    expect(calculateReadmissionRisk({ ...base, comorbidityCount: 0 }).comorbidity_score).toBe(0);
    expect(calculateReadmissionRisk({ ...base, comorbidityCount: 2 }).comorbidity_score).toBe(0.3);
    expect(calculateReadmissionRisk({ ...base, comorbidityCount: 4 }).comorbidity_score).toBe(0.6);
    expect(calculateReadmissionRisk({ ...base, comorbidityCount: 5 }).comorbidity_score).toBe(1.0);
  });

  it('correctly scores polypharmacy thresholds', () => {
    const base: ReadmissionInput = {
      age: null, comorbidityCount: 0, priorAdmissions12m: 0,
      losDays: 1, isEmergency: false, abnormalLabCount: 0,
      dischargeMedCount: 0, socialRiskFlag: false,
    };
    expect(calculateReadmissionRisk({ ...base, dischargeMedCount: 3 }).polypharmacy_score).toBe(0);
    expect(calculateReadmissionRisk({ ...base, dischargeMedCount: 5 }).polypharmacy_score).toBe(0.5);
    expect(calculateReadmissionRisk({ ...base, dischargeMedCount: 6 }).polypharmacy_score).toBe(1.0);
  });

  it('weights sum to 1.0 (max score = 10)', () => {
    const maxInput: ReadmissionInput = {
      age: 80, comorbidityCount: 10, priorAdmissions12m: 5,
      losDays: 30, isEmergency: true, abnormalLabCount: 10,
      dischargeMedCount: 10, socialRiskFlag: true,
    };
    const result = calculateReadmissionRisk(maxInput);
    expect(result.total_risk_score).toBe(10);
  });
});

// ============================================================
// ANTIBIOTIC STEWARDSHIP
// ============================================================

describe('classifyAntibiotic', () => {
  it('classifies known antibiotics', () => {
    expect(classifyAntibiotic('amoxicillin')).toBe('penicillin');
    expect(classifyAntibiotic('ceftriaxone')).toBe('cephalosporin');
    expect(classifyAntibiotic('meropenem')).toBe('carbapenem');
    expect(classifyAntibiotic('ciprofloxacin')).toBe('fluoroquinolone');
    expect(classifyAntibiotic('vancomycin')).toBe('glycopeptide');
    expect(classifyAntibiotic('linezolid')).toBe('oxazolidinone');
  });

  it('returns null for unknown drugs', () => {
    expect(classifyAntibiotic('paracetamol')).toBeNull();
    expect(classifyAntibiotic('aspirin')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(classifyAntibiotic('MEROPENEM')).toBe('carbapenem');
    expect(classifyAntibiotic('Amoxicillin')).toBe('penicillin');
  });
});

describe('isBroadSpectrum', () => {
  it('identifies broad-spectrum antibiotics', () => {
    expect(isBroadSpectrum('meropenem')).toBe(true);
    expect(isBroadSpectrum('piperacillin-tazobactam')).toBe(true);
    expect(isBroadSpectrum('ceftriaxone')).toBe(true);
  });

  it('returns false for narrow-spectrum antibiotics', () => {
    expect(isBroadSpectrum('amoxicillin')).toBe(false);
    expect(isBroadSpectrum('nitrofurantoin')).toBe(false);
  });
});

describe('isRestricted', () => {
  it('identifies restricted antibiotics', () => {
    expect(isRestricted('meropenem')).toBe(true);
    expect(isRestricted('colistin')).toBe(true);
    expect(isRestricted('linezolid')).toBe(true);
  });

  it('returns false for unrestricted antibiotics', () => {
    expect(isRestricted('amoxicillin')).toBe(false);
    expect(isRestricted('azithromycin')).toBe(false);
  });
});

describe('antibiotic alert rules', () => {
  const baseRx: AntibioticPrescription = {
    id: 'rx-1',
    patient_id: 'p-1',
    admission_id: 'adm-1',
    drug_name: 'amoxicillin',
    route: 'oral',
    prescribed_at: new Date().toISOString(),
    prescribing_doctor_id: 'doc-1',
    duration_days: 5,
    is_surgical_prophylaxis: false,
  };

  it('checkDurationExceeded fires when duration >7 days without culture', () => {
    const rx = { ...baseRx, duration_days: 10 };
    const alert = checkDurationExceeded(rx, false);
    expect(alert).not.toBeNull();
    expect(alert!.alert_type).toBe('duration_exceeded');
  });

  it('checkDurationExceeded does not fire when culture is ordered', () => {
    const rx = { ...baseRx, duration_days: 10 };
    expect(checkDurationExceeded(rx, true)).toBeNull();
  });

  it('checkDurationExceeded does not fire for short courses', () => {
    const rx = { ...baseRx, duration_days: 5 };
    expect(checkDurationExceeded(rx, false)).toBeNull();
  });

  it('checkBroadSpectrumNoCulture fires for broad-spectrum without culture', () => {
    const rx = { ...baseRx, drug_name: 'meropenem' };
    const alert = checkBroadSpectrumNoCulture(rx, false);
    expect(alert).not.toBeNull();
    expect(alert!.alert_type).toBe('broad_spectrum_no_culture');
    expect(alert!.severity).toBe('critical');
  });

  it('checkBroadSpectrumNoCulture does not fire with culture result', () => {
    const rx = { ...baseRx, drug_name: 'meropenem' };
    expect(checkBroadSpectrumNoCulture(rx, true)).toBeNull();
  });

  it('checkDuplicateClass detects same-class prescriptions', () => {
    const rx1 = { ...baseRx, id: 'rx-1', drug_name: 'ceftriaxone' };
    const rx2 = { ...baseRx, id: 'rx-2', drug_name: 'cefepime' };
    const alert = checkDuplicateClass(rx1, [rx1, rx2]);
    expect(alert).not.toBeNull();
    expect(alert!.alert_type).toBe('duplicate_class');
  });

  it('checkDuplicateClass does not fire for different classes', () => {
    const rx1 = { ...baseRx, id: 'rx-1', drug_name: 'amoxicillin' };
    const rx2 = { ...baseRx, id: 'rx-2', drug_name: 'ciprofloxacin' };
    expect(checkDuplicateClass(rx1, [rx1, rx2])).toBeNull();
  });

  it('checkIVToOralOpportunity fires after 48h IV', () => {
    const rx = { ...baseRx, route: 'iv' };
    const alert = checkIVToOralOpportunity(rx, 3);
    expect(alert).not.toBeNull();
    expect(alert!.alert_type).toBe('iv_to_oral_opportunity');
    expect(alert!.severity).toBe('info');
  });

  it('checkIVToOralOpportunity does not fire for oral route', () => {
    expect(checkIVToOralOpportunity({ ...baseRx, route: 'oral' }, 3)).toBeNull();
  });

  it('checkIVToOralOpportunity does not fire within first 48h', () => {
    expect(checkIVToOralOpportunity({ ...baseRx, route: 'iv' }, 1)).toBeNull();
  });

  it('checkProphylaxisExceeded fires after 24h', () => {
    const rx = { ...baseRx, is_surgical_prophylaxis: true };
    const alert = checkProphylaxisExceeded(rx, 30);
    expect(alert).not.toBeNull();
    expect(alert!.alert_type).toBe('prophylaxis_exceeded');
  });

  it('checkProphylaxisExceeded does not fire within 24h', () => {
    const rx = { ...baseRx, is_surgical_prophylaxis: true };
    expect(checkProphylaxisExceeded(rx, 20)).toBeNull();
  });

  it('checkRestrictedAntibiotic fires for restricted drugs', () => {
    const rx = { ...baseRx, drug_name: 'colistin' };
    const alert = checkRestrictedAntibiotic(rx);
    expect(alert).not.toBeNull();
    expect(alert!.alert_type).toBe('restricted_antibiotic');
    expect(alert!.severity).toBe('critical');
  });

  it('checkRestrictedAntibiotic does not fire for unrestricted drugs', () => {
    expect(checkRestrictedAntibiotic({ ...baseRx, drug_name: 'amoxicillin' })).toBeNull();
  });
});

// ============================================================
// LOS PREDICTION
// ============================================================

describe('predictLOS', () => {
  it('uses benchmark avg_los as base when available', () => {
    const result = predictLOS(
      { diagnosisCode: 'J18', procedureType: null, age: 45, comorbidityCount: 0, admissionType: 'elective', payorType: 'insurance' },
      { avg_los: 7.0, stddev_los: 2.0 }
    );
    expect(result.predicted_los_days).toBe(7.0);
    expect(result.prediction_confidence).toBe(0.7);
  });

  it('uses default 5.0 when no benchmark available', () => {
    const result = predictLOS(
      { diagnosisCode: null, procedureType: null, age: 45, comorbidityCount: 0, admissionType: 'elective', payorType: null },
      null
    );
    expect(result.predicted_los_days).toBe(5.0);
    expect(result.prediction_confidence).toBe(0.3);
  });

  it('increases LOS for elderly patients', () => {
    const base = predictLOS(
      { diagnosisCode: null, procedureType: null, age: 45, comorbidityCount: 0, admissionType: 'elective', payorType: null },
      null
    );
    const elderly = predictLOS(
      { diagnosisCode: null, procedureType: null, age: 70, comorbidityCount: 0, admissionType: 'elective', payorType: null },
      null
    );
    expect(elderly.predicted_los_days).toBeGreaterThan(base.predicted_los_days);
    expect(elderly.age_group).toBe('elderly');
  });

  it('increases LOS for patients with comorbidities', () => {
    const healthy = predictLOS(
      { diagnosisCode: null, procedureType: null, age: 45, comorbidityCount: 0, admissionType: 'elective', payorType: null },
      null
    );
    const comorbid = predictLOS(
      { diagnosisCode: null, procedureType: null, age: 45, comorbidityCount: 4, admissionType: 'elective', payorType: null },
      null
    );
    expect(comorbid.predicted_los_days).toBeGreaterThan(healthy.predicted_los_days);
  });

  it('increases LOS for emergency admissions', () => {
    const elective = predictLOS(
      { diagnosisCode: null, procedureType: null, age: 45, comorbidityCount: 0, admissionType: 'elective', payorType: null },
      null
    );
    const emergency = predictLOS(
      { diagnosisCode: null, procedureType: null, age: 45, comorbidityCount: 0, admissionType: 'emergency', payorType: null },
      null
    );
    expect(emergency.predicted_los_days).toBeGreaterThan(elective.predicted_los_days);
  });

  it('classifies pediatric patients correctly', () => {
    const result = predictLOS(
      { diagnosisCode: null, procedureType: null, age: 10, comorbidityCount: 0, admissionType: 'elective', payorType: null },
      null
    );
    expect(result.age_group).toBe('pediatric');
  });
});

describe('isLOSOutlier', () => {
  it('flags outlier when actual exceeds predicted + 2 SD', () => {
    expect(isLOSOutlier(15, 5, 3)).toBe(true); // 15 > 5 + 6 = 11
  });

  it('does not flag when within range', () => {
    expect(isLOSOutlier(8, 5, 3)).toBe(false); // 8 < 11
  });

  it('uses 1.5x predicted when no stddev available', () => {
    expect(isLOSOutlier(9, 5, null)).toBe(true);  // 9 > 7.5
    expect(isLOSOutlier(7, 5, null)).toBe(false);  // 7 < 7.5
  });
});

// ============================================================
// QUALITY SCORECARD
// ============================================================

describe('calculateQualityScore', () => {
  it('returns grade A for excellent indicators', () => {
    const result = calculateQualityScore({
      fall_rate: 0.5, medication_error_rate: 0.2,
      wrong_site_surgery_count: 0, mortality_rate: 0.5,
      readmission_30_day_rate: 3.0, ssi_rate: 1.0,
      antibiotic_prophylaxis_compliance: 98,
      surgical_safety_checklist_compliance: 98,
      ed_wait_time_avg_min: 20, patient_satisfaction_score: 9.0,
    });
    expect(result.overall_grade).toBe('A');
    expect(result.overall_quality_score).toBeGreaterThanOrEqual(90);
  });

  it('returns grade F when wrong-site surgery occurs', () => {
    const result = calculateQualityScore({
      fall_rate: 5.0, medication_error_rate: 5.0,
      wrong_site_surgery_count: 1, mortality_rate: 5.0,
      readmission_30_day_rate: 15.0, ssi_rate: 8.0,
      antibiotic_prophylaxis_compliance: 50,
      surgical_safety_checklist_compliance: 50,
      ed_wait_time_avg_min: 120, patient_satisfaction_score: 3.0,
    });
    expect(result.overall_grade).toBe('F');
    expect(result.overall_quality_score).toBeLessThan(40);
  });

  it('returns grade C for mixed indicators', () => {
    const result = calculateQualityScore({
      fall_rate: 1.5, medication_error_rate: 1.0,
      wrong_site_surgery_count: 0, mortality_rate: 1.5,
      readmission_30_day_rate: 7.0, ssi_rate: 3.0,
      antibiotic_prophylaxis_compliance: 85,
      surgical_safety_checklist_compliance: 90,
      ed_wait_time_avg_min: 40, patient_satisfaction_score: 7.0,
    });
    expect(result.overall_grade).toBe('C');
    expect(result.overall_quality_score).toBeGreaterThanOrEqual(60);
    expect(result.overall_quality_score).toBeLessThan(75);
  });
});

describe('getIndicatorStatus', () => {
  it('returns green for fall rate below good threshold', () => {
    expect(getIndicatorStatus(0.5, 'fall_rate', 'lower')).toBe('green');
  });

  it('returns yellow for fall rate between good and acceptable', () => {
    expect(getIndicatorStatus(2.0, 'fall_rate', 'lower')).toBe('yellow');
  });

  it('returns red for fall rate above acceptable threshold', () => {
    expect(getIndicatorStatus(5.0, 'fall_rate', 'lower')).toBe('red');
  });

  it('handles higher-is-better metrics correctly', () => {
    expect(getIndicatorStatus(98, 'antibiotic_prophylaxis_compliance', 'higher')).toBe('green');
    expect(getIndicatorStatus(85, 'antibiotic_prophylaxis_compliance', 'higher')).toBe('yellow');
    expect(getIndicatorStatus(70, 'antibiotic_prophylaxis_compliance', 'higher')).toBe('red');
  });
});
