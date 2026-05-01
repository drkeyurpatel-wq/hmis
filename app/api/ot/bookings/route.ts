import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];
  const roomId = request.nextUrl.searchParams.get('room_id');
  let q = db.from('hmis_ot_bookings').select('*').eq('centre_id', centreId).eq('scheduled_date', date).order('scheduled_time');
  if (roomId) q = q.eq('ot_room_id', roomId);
  const { data } = await q;
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { data, error } = await db.from('hmis_ot_bookings').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
