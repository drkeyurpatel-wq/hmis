import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');

  const { data: chapters } = await db.from('quality_nabh_chapters')
    .select('*').order('sort_order');

  if (centreId && chapters) {
    // Enrich with assessment progress per chapter
    for (const ch of chapters) {
      const { count: assessed } = await db.from('quality_nabh_assessments')
        .select('id', { count: 'exact' })
        .eq('centre_id', centreId)
        .in('element_id', 
          (await db.from('quality_nabh_elements').select('id').eq('chapter_id', ch.id)).data?.map((e: any) => e.id) || []
        );
      ch.assessed_count = assessed || 0;
    }
  }
  return NextResponse.json(chapters || []);
}
