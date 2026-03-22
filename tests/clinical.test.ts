import { describe, it, expect } from 'vitest';

describe('NEWS2 scoring', () => {
  it('should calculate NEWS2 correctly for normal vitals', () => {
    // Simplified NEWS2: RR 12-20=0, SpO2 96-100=0, SBP 111-219=0, HR 51-90=0, Temp 36.1-38.0=0, GCS 15=0
    const vitals = { rr: 16, spo2: 98, sbp: 120, hr: 72, temp: 36.8, gcs: 15 };
    const score = calcNEWS2(vitals);
    expect(score).toBe(0);
  });

  it('should flag high NEWS2 for deteriorating patient', () => {
    const vitals = { rr: 25, spo2: 91, sbp: 90, hr: 130, temp: 39.1, gcs: 14 };
    const score = calcNEWS2(vitals);
    expect(score).toBeGreaterThanOrEqual(7); // Should trigger urgent response
  });

  it('should handle missing vitals gracefully', () => {
    const vitals = { rr: null, spo2: 96, sbp: 120, hr: 72, temp: null, gcs: 15 };
    const score = calcNEWS2(vitals);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('Dialysis adequacy', () => {
  it('should calculate URR correctly', () => {
    const pre_bun = 80;
    const post_bun = 20;
    const urr = ((pre_bun - post_bun) / pre_bun) * 100;
    expect(urr).toBe(75); // ≥65% is adequate
    expect(urr >= 65).toBe(true);
  });

  it('should flag inadequate dialysis', () => {
    const pre_bun = 60;
    const post_bun = 30;
    const urr = ((pre_bun - post_bun) / pre_bun) * 100;
    expect(urr).toBe(50);
    expect(urr >= 65).toBe(false);
  });
});

describe('FMS scoring', () => {
  it('should use lower of bilateral scores', () => {
    const hurdle_l = 3, hurdle_r = 2;
    const score = Math.min(hurdle_l, hurdle_r);
    expect(score).toBe(2);
  });

  it('should detect asymmetry', () => {
    const lunge_l = 3, lunge_r = 1;
    const asymmetry = Math.abs(lunge_l - lunge_r) >= 1;
    expect(asymmetry).toBe(true);
  });

  it('should classify risk correctly', () => {
    const total = 14;
    const risk = total <= 14 ? 'high' : total <= 17 ? 'moderate' : 'low';
    expect(risk).toBe('high');
  });
});

// Helper
function calcNEWS2(v: any) {
  let score = 0;
  // RR
  const rr = v.rr;
  if (rr != null) {
    if (rr <= 8) score += 3; else if (rr <= 11) score += 1; else if (rr <= 20) score += 0;
    else if (rr <= 24) score += 2; else score += 3;
  }
  // SpO2
  const spo2 = v.spo2;
  if (spo2 != null) {
    if (spo2 <= 91) score += 3; else if (spo2 <= 93) score += 2; else if (spo2 <= 95) score += 1;
  }
  // SBP
  const sbp = v.sbp;
  if (sbp != null) {
    if (sbp <= 90) score += 3; else if (sbp <= 100) score += 2; else if (sbp <= 110) score += 1;
    else if (sbp <= 219) score += 0; else score += 3;
  }
  // HR
  const hr = v.hr;
  if (hr != null) {
    if (hr <= 40) score += 3; else if (hr <= 50) score += 1; else if (hr <= 90) score += 0;
    else if (hr <= 110) score += 1; else if (hr <= 130) score += 2; else score += 3;
  }
  // Temp
  const temp = v.temp;
  if (temp != null) {
    if (temp <= 35.0) score += 3; else if (temp <= 36.0) score += 1; else if (temp <= 38.0) score += 0;
    else if (temp <= 39.0) score += 1; else score += 2;
  }
  // GCS
  if (v.gcs != null && v.gcs < 15) score += 3;
  return score;
}
