// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  const surgeonId = request.nextUrl.searchParams.get('surgeon_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  let q = db.from('ot_surgeon_preferences').select('*').eq('centre_id', centreId).eq('is_active', true);
  if (surgeonId) q = q.eq('surgeon_id', surgeonId);
  const { data } = await q;
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { data, error } = await db.from('ot_surgeon_preferences').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
