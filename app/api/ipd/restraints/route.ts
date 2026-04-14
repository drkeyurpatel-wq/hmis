// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
export async function GET(request: NextRequest) {
  const admissionId = request.nextUrl.searchParams.get('admission_id');
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (admissionId) {
    const { data } = await db.from('ipd_restraint_orders').select('*').eq('admission_id', admissionId).order('order_time', { ascending: false });
    return NextResponse.json(data || []);
  }
  if (centreId) {
    const { data } = await db.from('ipd_restraint_orders').select('*').eq('centre_id', centreId).eq('status', 'ACTIVE');
    return NextResponse.json(data || []);
  }
  return NextResponse.json({ error: 'admission_id or centre_id required' }, { status: 400 });
}
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await db.from('ipd_restraint_orders').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
