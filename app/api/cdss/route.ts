// app/api/cdss/route.ts
// Server-side proxy to Anthropic Claude API for clinical decision support
// Set ANTHROPIC_API_KEY in Vercel environment variables

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-sonnet-4-20250514';

// GET — health check / debug
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  return NextResponse.json({
    status: 'ok',
    keyConfigured: !!ANTHROPIC_API_KEY,
    keyConfiguredFlag: !!ANTHROPIC_API_KEY,
    model: MODEL,
  });
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens: number = 1500): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured. Set it in Vercel environment variables.' });
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      // Retry on 529 (overloaded) or 429 (rate limit)
      if ((response.status === 529 || response.status === 429) && attempt < MAX_RETRIES) {
        const wait = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[CDSS] Anthropic API error:', response.status, errBody);
        return JSON.stringify({ error: `Anthropic API ${response.status}: ${errBody.substring(0, 200)}` });
      }

      const data = await response.json();
      if (data.content?.[0]?.text) return data.content[0].text;
      return JSON.stringify({ error: data.error?.message || JSON.stringify(data).substring(0, 200) });
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
        continue;
      }
      console.error('[CDSS] Fetch error:', err);
      return JSON.stringify({ error: `Network error: ${err.message}` });
    }
  }
  return JSON.stringify({ error: 'Failed after retries — API overloaded. Try again in a minute.' });
}

// ============================================================
// SYSTEM PROMPTS
// ============================================================

const DDX_SYSTEM = `You are an expert clinical decision support system for a multi-speciality hospital in India. 

Given patient demographics, chief complaints, vitals, and examination findings, provide:
1. Top 5 differential diagnoses ranked by probability
2. For each: ICD-10 code, reasoning (1-2 lines), key distinguishing features
3. Recommended investigations to narrow the differential
4. Red flags or urgent actions if any

Respond ONLY in valid JSON format:
{
  "differentials": [
    { "rank": 1, "diagnosis": "...", "icd10": "...", "probability": "high/moderate/low", "reasoning": "...", "distinguishing": "..." }
  ],
  "recommended_investigations": ["..."],
  "red_flags": ["..."],
  "clinical_reasoning": "Brief 2-3 sentence summary of clinical reasoning"
}

Be specific to Indian clinical practice. Consider tropical diseases, common Indian presentations, and local epidemiology. Never provide treatment recommendations in DDx — only diagnostic reasoning.`;

const RX_REVIEW_SYSTEM = `You are a clinical pharmacology expert reviewing prescriptions at a multi-speciality hospital in India.

Given diagnoses and prescribed medications, check:
1. Drug-diagnosis appropriateness — is each drug suitable for the diagnosis?
2. Missing standard-of-care medications — what should be prescribed but isn't?
3. Drug interactions — any dangerous combinations?
4. Dosage concerns — any doses outside normal range?
5. Contraindication flags based on patient profile (age, allergies, vitals)

Respond ONLY in valid JSON format:
{
  "overall_score": "safe/caution/warning/critical",
  "issues": [
    { "type": "interaction/missing/inappropriate/dosage/contraindication", "severity": "info/warning/critical", "drug": "...", "message": "..." }
  ],
  "missing_medications": [
    { "drug": "...", "reason": "Standard of care for ...", "urgency": "required/recommended/optional" }
  ],
  "summary": "Brief overall assessment"
}

Use Indian brand names where possible. Be practical — flag real clinical concerns, not theoretical ones.`;

const COPILOT_SYSTEM = `You are a real-time clinical copilot for a multi-speciality hospital.

Analyze the current encounter data (complaints, vitals, exam, diagnoses, investigations, prescriptions) and provide:
1. Clinical suggestions — what should the doctor consider next?
2. Documentation completeness — what's missing from the encounter?
3. Quality checks — NABH compliance, coding accuracy
4. Follow-up recommendations

Respond ONLY in valid JSON format:
{
  "suggestions": [
    { "category": "clinical/documentation/quality/followup", "priority": "high/medium/low", "message": "...", "action": "..." }
  ],
  "completeness": {
    "score": 0-100,
    "missing": ["..."]
  },
  "alerts": ["..."]
}

Be concise. Max 5 suggestions. Prioritize actionable items. Indian clinical context.`;

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data' }, { status: 400 });
    }

    let result: string;

    switch (type) {
      case 'ddx': {
        const userMsg = `Patient: ${data.age || '--'}yr ${data.gender || '--'}
Chief Complaints: ${(data.complaints || []).join(', ') || 'None specified'}
Vitals: ${data.vitals ? `BP ${data.vitals.systolic || '--'}/${data.vitals.diastolic || '--'}, HR ${data.vitals.heartRate || '--'}, SpO2 ${data.vitals.spo2 || '--'}%, Temp ${data.vitals.temperature || '--'}F, RR ${data.vitals.respRate || '--'}, Wt ${data.vitals.weight || '--'}kg` : 'Not recorded'}
Examination: ${(data.examFindings || []).map((e: any) => `${e.system}: ${e.findings || e.value || 'NAD'}`).join('; ') || 'Not done'}
Allergies: ${(data.allergies || []).join(', ') || 'NKDA'}
History: ${data.history || 'Not specified'}`;
        result = await callClaude(DDX_SYSTEM, userMsg, 1500);
        break;
      }

      case 'rx_review': {
        const userMsg = `Patient: ${data.age || '--'}yr ${data.gender || '--'}
Allergies: ${(data.allergies || []).join(', ') || 'NKDA'}
Vitals: ${data.vitals ? `BP ${data.vitals.systolic || '--'}/${data.vitals.diastolic || '--'}, HR ${data.vitals.heartRate || '--'}` : 'N/A'}
Diagnoses: ${(data.diagnoses || []).map((d: any) => `${d.code} ${d.label}`).join(', ') || 'None'}
Current Prescriptions:
${(data.prescriptions || []).map((p: any, i: number) => `${i + 1}. ${p.brand} (${p.generic}) ${p.strength} — ${p.dose} ${p.frequency} x ${p.duration}`).join('\n') || 'None'}`;
        result = await callClaude(RX_REVIEW_SYSTEM, userMsg, 1500);
        break;
      }

      case 'copilot': {
        const userMsg = `Current encounter state:
Patient: ${data.age || '--'}yr ${data.gender || '--'}
Complaints: ${(data.complaints || []).join(', ') || 'Empty'}
Vitals: ${data.vitals ? `BP ${data.vitals.systolic || '--'}/${data.vitals.diastolic || '--'}, HR ${data.vitals.heartRate || '--'}, SpO2 ${data.vitals.spo2 || '--'}%` : 'Not recorded'}
Examination: ${(data.examFindings || []).length} systems examined
Diagnoses: ${(data.diagnoses || []).map((d: any) => d.code + ' ' + d.label).join(', ') || 'None'}
Investigations ordered: ${(data.investigations || []).map((i: any) => i.name).join(', ') || 'None'}
Prescriptions: ${(data.prescriptions || []).length} medications
Advice given: ${(data.advice || []).length} items
Follow-up: ${data.followUp || 'Not set'}`;
        result = await callClaude(COPILOT_SYSTEM, userMsg, 1000);
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown type. Use: ddx, rx_review, copilot' }, { status: 400 });
    }

    // Try to parse as JSON, return raw if not
    try {
      const parsed = JSON.parse(result);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ raw: result });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
