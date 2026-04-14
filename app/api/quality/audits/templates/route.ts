// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
export async function GET(request: NextRequest) {
  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const { data } = await db.from('quality_audit_templates').select('*, items:quality_audit_template_items(*)').eq('centre_id', centreId).eq('is_active', true).order('template_name');
  return NextResponse.json(data || []);
}
