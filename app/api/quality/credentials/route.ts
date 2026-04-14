// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
export async function GET(request: NextRequest) {
  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const expiring = request.nextUrl.searchParams.get('expiring');
  let q = db.from('quality_staff_credentials').select('*').eq('centre_id', centreId).order('expiry_date');
  if (expiring === 'true') {
    const in90days = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
    q = q.lte('expiry_date', in90days).neq('status', 'EXPIRED');
  }
  const { data } = await q;
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const db = qualityDb();
  const body = await request.json();
  const { data, error } = await db.from('quality_staff_credentials').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
