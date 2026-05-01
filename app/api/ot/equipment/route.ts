// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  const type = request.nextUrl.searchParams.get('type');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  let q = db.from('ot_equipment_usage').select('*').eq('centre_id', centreId).order('usage_date', { ascending: false }).limit(100);
  if (type) q = q.eq('equipment_type', type);
  const { data } = await q;
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  if (body.start_time && body.end_time) {
    body.usage_minutes = Math.round((new Date(body.end_time).getTime() - new Date(body.start_time).getTime()) / 60000);
  }
  const { data, error } = await db.from('ot_equipment_usage').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
