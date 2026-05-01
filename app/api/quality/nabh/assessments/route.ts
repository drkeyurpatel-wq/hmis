// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data, error } = await db.from('quality_nabh_assessments')
    .select('*, element:quality_nabh_elements(element_code, description, level)')
    .eq('centre_id', centreId).order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const body = await request.json();
  const { centre_id, element_id, score, status, evidence_summary, gap_notes, action_plan, action_deadline, assessed_by } = body;
  if (!centre_id || !element_id) return NextResponse.json({ error: 'centre_id and element_id required' }, { status: 400 });

  const { data, error } = await db.from('quality_nabh_assessments')
    .upsert({
      centre_id, element_id, score: score || '1', status: status || 'ASSESSED',
      evidence_summary, gap_notes, action_plan, action_deadline,
      assessed_by, assessed_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, { onConflict: 'centre_id,element_id' })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
