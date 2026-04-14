// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { qualityDb } from '@/lib/quality/api-helpers';

export async function GET(request: NextRequest) {
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const db = qualityDb();

  const [assessments, incidents, audits, ipcChecks, overdueCapa, sentinel, nearMiss, mortality] = await Promise.all([
    db.from('quality_nabh_assessments').select('score', { count: 'exact' }).eq('centre_id', centreId),
    db.from('quality_incidents').select('id', { count: 'exact' }).eq('centre_id', centreId).not('status', 'eq', 'CLOSED'),
    db.from('quality_audit_runs').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'COMPLETED'),
    db.from('quality_ipc_bundle_checks').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('quality_incident_capa').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'OVERDUE'),
    db.from('quality_sentinel_events').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('quality_near_misses').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('quality_mortality_reviews').select('id', { count: 'exact' }).eq('centre_id', centreId),
  ]);

  // Calculate NABH compliance
  const { data: scoreData } = await db.from('quality_nabh_assessments')
    .select('score').eq('centre_id', centreId).neq('score', '0');
  const totalAssessed = scoreData?.length || 0;
  const totalScore = scoreData?.reduce((s, r) => s + parseInt(r.score), 0) || 0;
  const maxScore = totalAssessed * 5;
  const compliancePct = maxScore > 0 ? Math.round(totalScore / maxScore * 100 * 100) / 100 : 0;

  return NextResponse.json({
    nabh_compliance_pct: compliancePct,
    total_elements: 639,
    assessed_count: assessments.count || 0,
    open_incidents: incidents.count || 0,
    completed_audits: audits.count || 0,
    ipc_checks_total: ipcChecks.count || 0,
    overdue_capa: overdueCapa.count || 0,
    sentinel_events: sentinel.count || 0,
    near_misses: nearMiss.count || 0,
    mortality_reviews: mortality.count || 0,
  });
}
