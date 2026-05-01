import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireAuth(_req);
  if (authError) return authError;

  const db = qualityDb();
  const { data, error } = await db.from('quality_incident_capa').select('*').eq('incident_id', params.id).order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const body = await request.json();
  body.incident_id = params.id;
  const { data, error } = await db.from('quality_incident_capa').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Update incident status
  await db.from('quality_incidents').update({ status: 'CAPA_ASSIGNED', updated_at: new Date().toISOString() }).eq('id', params.id);
  return NextResponse.json(data, { status: 201 });
}
