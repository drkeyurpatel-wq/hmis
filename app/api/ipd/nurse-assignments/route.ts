// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  const wardId = request.nextUrl.searchParams.get('ward_id');
  const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  let q = db.from('ipd_nurse_assignments').select('*').eq('centre_id', centreId).eq('shift_date', date);
  if (wardId) q = q.eq('ward_id', wardId);
  const { data } = await q;
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  body.patient_count = (body.patient_ids || []).length;
  const { data, error } = await db.from('ipd_nurse_assignments').upsert(body, { onConflict: 'centre_id,ward_id,shift_date,shift,nurse_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
