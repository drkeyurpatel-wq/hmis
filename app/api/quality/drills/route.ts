// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
export async function GET(request: NextRequest) {
  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data } = await db.from('quality_safety_drills').select('*').eq('centre_id', centreId).order('drill_date', { ascending: false }).limit(50);
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const db = qualityDb();
  const body = await request.json();
  if (body.response_time_seconds && body.target_response_seconds) {
    body.met_target = body.response_time_seconds <= body.target_response_seconds;
  }
  const { data, error } = await db.from('quality_safety_drills').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
