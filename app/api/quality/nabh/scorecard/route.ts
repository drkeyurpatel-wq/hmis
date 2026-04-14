// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb, qualityRpc } from '@/lib/quality/api-helpers';

export async function GET(request: NextRequest) {
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const view = request.nextUrl.searchParams.get('view') || 'overall';

  if (view === 'chapter') {
    const { data, error } = await qualityRpc('quality_nabh_scorecard', { p_centre_id: centreId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }
  const { data, error } = await qualityRpc('quality_nabh_overall_score', { p_centre_id: centreId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
