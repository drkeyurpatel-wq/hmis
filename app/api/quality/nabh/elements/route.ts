import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  const chapterId = request.nextUrl.searchParams.get('chapter_id');
  const standardId = request.nextUrl.searchParams.get('standard_id');
  const level = request.nextUrl.searchParams.get('level');

  let query = db.from('quality_nabh_elements').select('*, standard:quality_nabh_standards(standard_code, title)');
  if (chapterId) query = query.eq('chapter_id', chapterId);
  if (standardId) query = query.eq('standard_id', standardId);
  if (level) query = query.eq('level', level);
  query = query.order('sort_order');

  const { data: elements, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with assessment if centre provided
  if (centreId && elements) {
    const elementIds = elements.map((e: any) => e.id);
    const { data: assessments } = await db.from('quality_nabh_assessments')
      .select('*').eq('centre_id', centreId).in('element_id', elementIds);
    const aMap = Object.fromEntries((assessments || []).map((a: any) => [a.element_id, a]));
    elements.forEach((e: any) => { e.assessment = aMap[e.id] || null; });
  }
  return NextResponse.json(elements || []);
}
