import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data } = await db.from('quality_audit_runs').select('*, template:quality_audit_templates(template_name, template_code)').eq('centre_id', centreId).order('audit_date', { ascending: false }).limit(50);
  return NextResponse.json(data || []);
}
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const body = await request.json();
  const { data: template } = await db.from('quality_audit_template_items').select('id', { count: 'exact' }).eq('template_id', body.template_id);
  body.total_items = template?.length || 0;
  body.status = 'IN_PROGRESS';
  const { data, error } = await db.from('quality_audit_runs').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
