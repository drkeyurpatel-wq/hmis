// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';

export async function GET(request: NextRequest) {
  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data } = await db.from('quality_sentinel_events').select('*').eq('centre_id', centreId).order('event_date', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const db = qualityDb();
  const body = await request.json();
  const { data, error } = await db.from('quality_sentinel_events').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
