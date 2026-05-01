import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const [nps, complaints, nurseCalls, foodOrders, breaches, feedback, visitors, escalations] = await Promise.all([
    db.from('px_nps_scores').select('nps_score, nps_category', { count: 'exact' }).eq('centre_id', centreId),
    db.from('hmis_px_complaints').select('id', { count: 'exact' }).eq('centre_id', centreId).not('status', 'eq', 'RESOLVED'),
    db.from('hmis_px_nurse_calls').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('hmis_px_food_orders').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('px_sla_breaches').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('status', 'OPEN'),
    db.from('hmis_px_feedback').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('hmis_visitor_passes').select('id', { count: 'exact' }).eq('centre_id', centreId),
    db.from('px_escalation_log').select('id', { count: 'exact' }).eq('centre_id', centreId).eq('resolved', false),
  ]);

  const npsData = nps.data || [];
  const promoters = npsData.filter(n => n.nps_category === 'PROMOTER').length;
  const detractors = npsData.filter(n => n.nps_category === 'DETRACTOR').length;
  const total = npsData.length;
  const npsScore = total > 0 ? Math.round((promoters/total - detractors/total) * 1000) / 10 : 0;

  return NextResponse.json({
    nps_score: npsScore,
    nps_responses: total,
    promoter_pct: total > 0 ? Math.round(promoters/total*100) : 0,
    detractor_pct: total > 0 ? Math.round(detractors/total*100) : 0,
    open_complaints: complaints.count || 0,
    open_sla_breaches: breaches.count || 0,
    pending_escalations: escalations.count || 0,
    total_nurse_calls: nurseCalls.count || 0,
    total_food_orders: foodOrders.count || 0,
    total_feedback: feedback.count || 0,
    total_visitors: visitors.count || 0,
  });
}
