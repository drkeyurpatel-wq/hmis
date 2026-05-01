// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const admissionId = request.nextUrl.searchParams.get('admission_id');
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (admissionId) {
    const { data } = await db.from('ipd_fall_risk_scores').select('*').eq('admission_id', admissionId).order('assessed_at', { ascending: false });
    return NextResponse.json(data || []);
  }
  if (centreId) {
    const { data } = await db.from('ipd_fall_risk_scores').select('*').eq('centre_id', centreId).eq('risk_level', 'HIGH').order('assessed_at', { ascending: false }).limit(50);
    return NextResponse.json(data || []);
  }
  return NextResponse.json({ error: 'admission_id or centre_id required' }, { status: 400 });
}
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { data, error } = await db.from('ipd_fall_risk_scores').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
