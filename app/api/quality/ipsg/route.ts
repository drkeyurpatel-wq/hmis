import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data } = await db.from('quality_ipsg_compliance').select('*').eq('centre_id', centreId).order('period', { ascending: false }).limit(60);
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const body = await request.json();
  if (body.numerator && body.denominator && body.denominator > 0) {
    body.compliance_pct = Math.round(body.numerator / body.denominator * 10000) / 100;
    body.met_target = body.compliance_pct >= (body.target_pct || 95);
  }
  const { data, error } = await db.from('quality_ipsg_compliance').upsert(body, { onConflict: 'centre_id,period,goal' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
