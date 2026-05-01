import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const status = request.nextUrl.searchParams.get('status');
  let q = db.from('quality_incidents').select('*').eq('centre_id', centreId).order('incident_date', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const body = await request.json();
  // Auto-generate incident number
  const { count } = await db.from('quality_incidents').select('id', { count: 'exact' }).eq('centre_id', body.centre_id);
  const num = String((count || 0) + 1).padStart(5, '0');
  body.incident_number = 'INC-' + new Date().getFullYear() + '-' + num;
  // Auto-calculate severity from SAC matrix
  if (body.sac_likelihood && body.sac_consequence) {
    const score = body.sac_likelihood * body.sac_consequence;
    body.severity = score >= 15 ? 'EXTREME' : score >= 8 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW';
  }
  const { data, error } = await db.from('quality_incidents').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
