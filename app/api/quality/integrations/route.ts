import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  const source = request.nextUrl.searchParams.get('source');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const results: Record<string, any> = {};

  if (!source || source === 'hand_hygiene') {
    const { data } = await db.from('quality_hand_hygiene_summary').select('*').eq('centre_id', centreId).order('period', { ascending: false }).limit(12);
    results.hand_hygiene = data || [];
  }
  if (!source || source === 'hai_rates') {
    const { data } = await db.from('quality_hai_rates').select('*').eq('centre_id', centreId).order('period', { ascending: false }).limit(24);
    results.hai_rates = data || [];
  }
  if (!source || source === 'antibiogram') {
    const { data } = await db.from('quality_antibiogram_summary').select('*').eq('centre_id', centreId).order('year', { ascending: false }).limit(50);
    results.antibiogram = data || [];
  }
  if (!source || source === 'brain_indicators') {
    const { data } = await db.from('quality_brain_indicators').select('*').eq('centre_id', centreId).order('period', { ascending: false }).limit(12);
    results.brain_indicators = data || [];
  }
  if (!source || source === 'incident_trends') {
    const { data } = await db.from('quality_incident_trends').select('*').eq('centre_id', centreId).order('period', { ascending: false }).limit(24);
    results.incident_trends = data || [];
  }
  return NextResponse.json(results);
}
