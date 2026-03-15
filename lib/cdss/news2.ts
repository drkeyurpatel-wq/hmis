// lib/cdss/news2.ts
// National Early Warning Score 2 — auto-calculated from vitals

export interface NEWS2Result {
  total: number;
  risk: 'low' | 'low-medium' | 'medium' | 'high';
  color: string;       // tailwind color class
  label: string;
  action: string;
  breakdown: { param: string; value: string; score: number }[];
}

function scoreRR(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

function scoreSpo2(spo2: number, onO2: boolean): number {
  // Scale 1 (no supplemental O2 / not hypercapnic)
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

function scoreSystolic(sys: number): number {
  if (sys <= 90) return 3;
  if (sys <= 100) return 2;
  if (sys <= 110) return 1;
  if (sys <= 219) return 0;
  return 3;
}

function scoreHR(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

function scoreTemp(temp: number): number {
  // temp in °C
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2;
}

function scoreConsciousness(isAlert: boolean): number {
  return isAlert ? 0 : 3;
}

function scoreO2Supplement(onO2: boolean): number {
  return onO2 ? 2 : 0;
}

export function calculateNEWS2(params: {
  respiratoryRate?: number;
  spo2?: number;
  systolic?: number;
  heartRate?: number;
  temperature?: number;    // in Celsius
  isAlert?: boolean;       // AVPU: true = Alert
  onSupplementalO2?: boolean;
}): NEWS2Result | null {
  const { respiratoryRate, spo2, systolic, heartRate, temperature, isAlert = true, onSupplementalO2 = false } = params;

  // Need at least 3 vital signs to be meaningful
  const available = [respiratoryRate, spo2, systolic, heartRate, temperature].filter(v => v !== undefined);
  if (available.length < 3) return null;

  const breakdown: { param: string; value: string; score: number }[] = [];
  let total = 0;

  if (respiratoryRate !== undefined) {
    const s = scoreRR(respiratoryRate);
    breakdown.push({ param: 'Respiratory Rate', value: `${respiratoryRate}/min`, score: s });
    total += s;
  }
  if (spo2 !== undefined) {
    const s = scoreSpo2(spo2, onSupplementalO2);
    breakdown.push({ param: 'SpO₂', value: `${spo2}%`, score: s });
    total += s;
  }
  if (onSupplementalO2) {
    const s = scoreO2Supplement(true);
    breakdown.push({ param: 'Supplemental O₂', value: 'Yes', score: s });
    total += s;
  }
  if (systolic !== undefined) {
    const s = scoreSystolic(systolic);
    breakdown.push({ param: 'Systolic BP', value: `${systolic} mmHg`, score: s });
    total += s;
  }
  if (heartRate !== undefined) {
    const s = scoreHR(heartRate);
    breakdown.push({ param: 'Heart Rate', value: `${heartRate}/min`, score: s });
    total += s;
  }
  if (temperature !== undefined) {
    const s = scoreTemp(temperature);
    breakdown.push({ param: 'Temperature', value: `${temperature}°C`, score: s });
    total += s;
  }
  {
    const s = scoreConsciousness(isAlert);
    breakdown.push({ param: 'Consciousness', value: isAlert ? 'Alert' : 'Not Alert (V/P/U)', score: s });
    total += s;
  }

  // Any single parameter score of 3 → medium risk minimum
  const hasExtreme = breakdown.some(b => b.score === 3);

  let risk: NEWS2Result['risk'];
  let color: string;
  let label: string;
  let action: string;

  if (total >= 7) {
    risk = 'high'; color = 'red'; label = 'HIGH';
    action = 'Emergency response — continuous monitoring, urgent senior clinical review, consider ICU transfer';
  } else if (total >= 5 || hasExtreme) {
    risk = 'medium'; color = 'orange'; label = 'MEDIUM';
    action = 'Urgent response — increase monitoring to minimum 1-hourly, urgent clinical review';
  } else if (total >= 1) {
    risk = 'low-medium'; color = 'yellow'; label = 'LOW-MEDIUM';
    action = 'Assessment by ward nurse, decide if increased frequency of monitoring or escalation needed';
  } else {
    risk = 'low'; color = 'green'; label = 'LOW';
    action = 'Continue routine monitoring (minimum 12-hourly)';
  }

  return { total, risk, color, label, action, breakdown };
}

// Convert Fahrenheit to Celsius for NEWS2
export function fahToCel(f: number): number {
  return Number(((f - 32) * 5 / 9).toFixed(1));
}
