// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
export async function GET(request: NextRequest) {
  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data } = await db.from('quality_ipc_bundles').select('*').eq('centre_id', centreId).eq('is_active', true);
  return NextResponse.json(data || []);
}
