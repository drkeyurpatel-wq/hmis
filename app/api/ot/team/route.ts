// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('booking_id');
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 });
  const { data } = await db.from('ot_team_assignments').select('*').eq('booking_id', bookingId).order('role');
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await db.from('ot_team_assignments').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
