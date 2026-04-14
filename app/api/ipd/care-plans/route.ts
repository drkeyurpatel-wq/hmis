// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const admissionId = request.nextUrl.searchParams.get('admission_id');
  if (!admissionId) return NextResponse.json({ error: 'admission_id required' }, { status: 400 });
  const { data } = await db.from('ipd_care_plans').select('*').eq('admission_id', admissionId).order('priority', { ascending: true });
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await db.from('ipd_care_plans').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
