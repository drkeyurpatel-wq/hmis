import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const admissionId = request.nextUrl.searchParams.get('admission_id');
  if (!admissionId) return NextResponse.json({ error: 'admission_id required' }, { status: 400 });
  const { data } = await db.from('ipd_discharge_checklist').select('*').eq('admission_id', admissionId).single();
  return NextResponse.json(data || {});
}
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const allClinical = body.doctor_clearance && body.vitals_stable && body.pain_controlled && body.diet_tolerated;
  const allDocs = body.discharge_summary_prepared && body.prescriptions_written && body.follow_up_scheduled;
  const allEducation = body.medication_counseling && body.diet_instructions && body.warning_signs_explained;
  const allAdmin = body.billing_cleared && body.transport_arranged;
  body.discharge_ready = allClinical && allDocs && allEducation && allAdmin;
  if (body.discharge_ready && !body.discharge_ready_at) body.discharge_ready_at = new Date().toISOString();
  const { data, error } = await db.from('ipd_discharge_checklist').upsert(body, { onConflict: 'admission_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
