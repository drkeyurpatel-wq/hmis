// app/api/ai/structure-note/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { transcript, patient } = await req.json();
  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const prompt = `You are a clinical documentation AI for an Indian hospital HMIS. Extract structured clinical data from this doctor's voice note.

Patient: ${patient || 'Unknown'}

Voice transcript:
"${transcript.trim()}"

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "chief_complaints": ["complaint 1", "complaint 2"],
  "history": "narrative history of presenting illness",
  "vitals": {"bp": "120/80", "pulse": "78", "temp": "98.6", "spo2": "98", "rr": "18", "weight": "70"},
  "examination": "examination findings in clinical format",
  "diagnosis": {"primary": "diagnosis name", "icd10": "code", "secondary": ["other diagnoses"]},
  "investigations": ["CBC", "RBS", "ECG"],
  "prescriptions": [{"drug": "drug name", "dose": "500mg", "route": "oral", "frequency": "BD", "duration": "5 days"}],
  "plan": "management plan",
  "follow_up": "after 1 week",
  "advice": "patient advice"
}

Rules:
- Extract only what is mentioned. Leave empty string/array if not mentioned.
- Use standard Indian clinical abbreviations (BD, TDS, OD, SOS, etc.)
- For vitals, only include what was explicitly stated.
- ICD-10 codes if you can infer from the diagnosis.
- Drug names should be generic Indian names (not brand).
- Be concise and clinical.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ structured: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
