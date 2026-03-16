// lib/cdss/ai-engine.ts
// Client-side AI Clinical Decision Support — calls /api/cdss

export interface DDxResult {
  differentials: { rank: number; diagnosis: string; icd10: string; probability: string; reasoning: string; distinguishing: string }[];
  recommended_investigations: string[];
  red_flags: string[];
  clinical_reasoning: string;
}

export interface RxReviewResult {
  overall_score: 'safe' | 'caution' | 'warning' | 'critical';
  issues: { type: string; severity: string; drug: string; message: string }[];
  missing_medications: { drug: string; reason: string; urgency: string }[];
  summary: string;
}

export interface CopilotResult {
  suggestions: { category: string; priority: string; message: string; action: string }[];
  completeness: { score: number; missing: string[] };
  alerts: string[];
}

async function callCDSS<T>(type: string, data: any): Promise<{ result?: T; error?: string; loading: boolean }> {
  try {
    const response = await fetch('/api/cdss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    });
    const json = await response.json();
    if (json.error) return { error: json.error, loading: false };
    if (json.raw) {
      // Try to extract JSON from raw text
      const match = json.raw.match(/\{[\s\S]*\}/);
      if (match) return { result: JSON.parse(match[0]), loading: false };
      return { error: 'Could not parse AI response', loading: false };
    }
    return { result: json as T, loading: false };
  } catch (err: any) {
    return { error: err.message || 'Network error', loading: false };
  }
}

// ============================================================
// AI Differential Diagnosis
// ============================================================
export async function getDifferentialDiagnosis(data: {
  age?: number | string; gender?: string; complaints: string[];
  vitals?: any; examFindings?: any[]; allergies?: string[]; history?: string;
}): Promise<{ result?: DDxResult; error?: string }> {
  return callCDSS<DDxResult>('ddx', data);
}

// ============================================================
// AI Prescription Review
// ============================================================
export async function reviewPrescription(data: {
  age?: number | string; gender?: string; allergies?: string[];
  vitals?: any; diagnoses: { code: string; label: string }[];
  prescriptions: { brand: string; generic: string; strength: string; dose: string; frequency: string; duration: string }[];
}): Promise<{ result?: RxReviewResult; error?: string }> {
  return callCDSS<RxReviewResult>('rx_review', data);
}

// ============================================================
// AI Clinical Copilot
// ============================================================
export async function getCopilotSuggestions(data: {
  age?: number | string; gender?: string; complaints: string[];
  vitals?: any; examFindings?: any[]; diagnoses?: any[];
  investigations?: any[]; prescriptions?: any[];
  advice?: string[]; followUp?: string;
}): Promise<{ result?: CopilotResult; error?: string }> {
  return callCDSS<CopilotResult>('copilot', data);
}
