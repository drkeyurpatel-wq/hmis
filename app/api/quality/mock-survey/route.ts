import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const db = qualityDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  const surveyType = request.nextUrl.searchParams.get('type') || 'initial'; // initial | surveillance | re-accreditation
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  // NABH 6th Edition assessment rules:
  // Initial: ALL Core (105) + ALL Commitment (457) = 562 OEs
  // Surveillance: ALL Core (105) + ALL Commitment (457) + ALL Achievement (60) = 622 OEs
  // Re-accreditation: ALL 639 OEs including Excellence (17)
  let levelFilter: string[];
  switch (surveyType) {
    case 'initial': levelFilter = ['CORE', 'COMMITMENT']; break;
    case 'surveillance': levelFilter = ['CORE', 'COMMITMENT', 'ACHIEVEMENT']; break;
    case 're-accreditation': levelFilter = ['CORE', 'COMMITMENT', 'ACHIEVEMENT', 'EXCELLENCE']; break;
    default: levelFilter = ['CORE', 'COMMITMENT'];
  }

  // Get all applicable elements
  const { data: elements } = await db.from('quality_nabh_elements')
    .select('id, element_code, level, description, chapter_id')
    .in('level', levelFilter);

  // Get current assessments
  const elementIds = (elements || []).map((e: any) => e.id);
  const { data: assessments } = await db.from('quality_nabh_assessments')
    .select('element_id, score, status')
    .eq('centre_id', centreId)
    .in('element_id', elementIds);
  
  const aMap = Object.fromEntries((assessments || []).map((a: any) => [a.element_id, a]));

  // Random sample for mock survey (NABH assessors typically sample ~30-40% of non-core elements)
  const coreElements = (elements || []).filter((e: any) => e.level === 'CORE');
  const nonCoreElements = (elements || []).filter((e: any) => e.level !== 'CORE');
  
  // Shuffle non-core and take 40%
  const shuffled = nonCoreElements.sort(() => Math.random() - 0.5);
  const sampleSize = Math.ceil(shuffled.length * 0.4);
  const sampled = [...coreElements, ...shuffled.slice(0, sampleSize)];

  // Calculate mock scores
  const scored = sampled.map((e: any) => ({
    ...e,
    assessment: aMap[e.id] || null,
    score: aMap[e.id]?.score ? parseInt(aMap[e.id].score) : 0,
    gap: !aMap[e.id] || parseInt(aMap[e.id]?.score || '0') < 3,
  }));

  const totalSampled = scored.length;
  const totalScore = scored.reduce((s, e) => s + e.score, 0);
  const maxScore = totalSampled * 5;
  const compliancePct = maxScore > 0 ? Math.round(totalScore / maxScore * 10000) / 100 : 0;
  const gaps = scored.filter((e: any) => e.gap);
  const criticalGaps = gaps.filter((e: any) => e.level === 'CORE');

  return NextResponse.json({
    survey_type: surveyType,
    total_applicable: (elements || []).length,
    sampled_count: totalSampled,
    core_sampled: coreElements.length,
    compliance_pct: compliancePct,
    target_pct: 80,
    would_pass: compliancePct >= 80 && criticalGaps.length === 0,
    total_gaps: gaps.length,
    critical_gaps: criticalGaps.length,
    gap_elements: gaps.slice(0, 20).map((e: any) => ({ code: e.element_code, level: e.level, score: e.score })),
    sampled_elements: scored.length,
  });
}
