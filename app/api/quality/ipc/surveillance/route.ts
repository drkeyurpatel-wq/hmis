// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
export async function GET(request: NextRequest) {
  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data } = await db.from('quality_ipc_surveillance').select('*').eq('centre_id', centreId).order('onset_date', { ascending: false }).limit(100);
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const db = qualityDb();
  const body = await request.json();
  if (body.device_insertion_date && body.onset_date) {
    body.device_days = Math.ceil((new Date(body.onset_date).getTime() - new Date(body.device_insertion_date).getTime()) / 86400000);
  }
  const { data, error } = await db.from('quality_ipc_surveillance').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
