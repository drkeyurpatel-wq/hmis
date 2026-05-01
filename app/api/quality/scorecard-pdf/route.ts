import { NextRequest, NextResponse } from 'next/server';
import { qualityDb, qualityRpc } from '@/lib/quality/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });
  const db = qualityDb();

  // Get chapter-wise scorecard
  const { data: chapterScores } = await qualityRpc('quality_nabh_scorecard', { p_centre_id: centreId });
  const { data: overallScores } = await qualityRpc('quality_nabh_overall_score', { p_centre_id: centreId });
  const { data: chapters } = await db.from('quality_nabh_chapters').select('*').order('sort_order');

  // Get incident summary
  const { count: openIncidents } = await db.from('quality_incidents').select('id', { count: 'exact' }).eq('centre_id', centreId).not('status', 'eq', 'CLOSED');
  const { count: totalIncidents } = await db.from('quality_incidents').select('id', { count: 'exact' }).eq('centre_id', centreId);
  const { count: overdueCapa } = await db.from('quality_incident_capa').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'OVERDUE');

  // Build printable HTML scorecard
  const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  
  const chapterRows = (chapters || []).map((ch: any) => {
    const scores = (chapterScores || []).filter((s: any) => s.chapter_code === ch.code);
    const totalAssessed = scores.reduce((s: number, r: any) => s + Number(r.assessed_count || 0), 0);
    const avgCompliance = scores.length > 0 ? (scores.reduce((s: number, r: any) => s + Number(r.compliance_pct || 0), 0) / scores.length).toFixed(1) : '0.0';
    return '<tr><td style="padding:6px;border:1px solid #ddd">' + ch.code + '</td><td style="padding:6px;border:1px solid #ddd">' + ch.name + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + ch.total_elements + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + totalAssessed + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center;font-weight:bold;color:' + (Number(avgCompliance) >= 80 ? '#16a34a' : '#dc2626') + '">' + avgCompliance + '%</td></tr>';
  }).join('');

  const overallRows = (overallScores || []).map((s: any) => {
    return '<tr><td style="padding:6px;border:1px solid #ddd;font-weight:bold">' + s.level + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + s.total_elements + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + s.assessed + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + s.score_achieved + '/' + s.score_possible + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center;font-weight:bold;color:' + (s.meets_target ? '#16a34a' : '#dc2626') + '">' + s.compliance_pct + '%</td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + (s.meets_target ? '✅' : '❌') + '</td></tr>';
  }).join('');

  const html = '<!DOCTYPE html><html><head><title>NABH Quality Scorecard — Health1 Shilaj</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a2e}h1{color:#1a1a2e;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#1a1a2e;color:white;padding:8px;text-align:left;border:1px solid #ddd}@media print{body{margin:20px}}</style></head><body><h1>NABH 6th Edition — Quality Scorecard</h1><p style="color:#666;margin-top:0">Health1 Super Speciality Hospital, Shilaj | Generated: ' + now + '</p><h2>Overall Compliance by Level</h2><table><tr><th>Level</th><th>Total OEs</th><th>Assessed</th><th>Score</th><th>Compliance</th><th>Target 80%</th></tr>' + overallRows + '</table><h2>Chapter-wise Summary</h2><table><tr><th>Code</th><th>Chapter</th><th>OEs</th><th>Assessed</th><th>Compliance</th></tr>' + chapterRows + '</table><h2>Quality Indicators</h2><table><tr><th>Indicator</th><th>Value</th></tr><tr><td style="padding:6px;border:1px solid #ddd">Total Incidents</td><td style="padding:6px;border:1px solid #ddd">' + totalIncidents + '</td></tr><tr><td style="padding:6px;border:1px solid #ddd">Open Incidents</td><td style="padding:6px;border:1px solid #ddd">' + openIncidents + '</td></tr><tr><td style="padding:6px;border:1px solid #ddd">Overdue CAPA</td><td style="padding:6px;border:1px solid #ddd;color:' + ((overdueCapa || 0) > 0 ? '#dc2626' : '#16a34a') + '">' + overdueCapa + '</td></tr></table><p style="color:#999;font-size:12px;margin-top:40px">NABH 6th Edition (January 2025) • Excellence Target: 80% of 639 OEs (2556/3195 points) • This is a self-assessment scorecard and does not represent official NABH accreditation status.</p></body></html>';

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
