import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const admissionId = request.nextUrl.searchParams.get('admission_id');
  if (!admissionId) return NextResponse.json({ error: 'admission_id required' }, { status: 400 });
  const { data } = await db.from('ipd_pressure_ulcer_risk').select('*').eq('admission_id', admissionId).order('assessed_at', { ascending: false });
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { data, error } = await db.from('ipd_pressure_ulcer_risk').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
