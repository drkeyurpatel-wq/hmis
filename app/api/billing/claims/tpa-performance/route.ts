import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

export async function GET(request: NextRequest) {
  const supabase = billingDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const { data: claims } = await supabase
    .from('billing_claims')
    .select(`tpa_id, claimed_amount, settled_amount, deduction_amount, status,
      claim_submission_date, settlement_date, submission_to_settlement_days,
      billing_tpa_masters!inner (tpa_name, tpa_code)`)
    .eq('centre_id', centreId).not('tpa_id', 'is', null);

  if (!claims || claims.length === 0) return NextResponse.json([]);

  const tpaMap: Record<string, any> = {};
  claims.forEach((c: any) => {
    const id = c.tpa_id;
    if (!tpaMap[id]) tpaMap[id] = { tpa_name: c.billing_tpa_masters?.tpa_name || 'Unknown',
      total_claims: 0, approved_claims: 0, total_claimed: 0, total_settled: 0,
      total_deductions: 0, tat_days_sum: 0, tat_count: 0 };
    const t = tpaMap[id];
    t.total_claims++; t.total_claimed += c.claimed_amount || 0;
    if (['APPROVED', 'PARTIALLY_APPROVED', 'SETTLED'].includes(c.status)) t.approved_claims++;
    if (c.settled_amount) t.total_settled += c.settled_amount;
    if (c.deduction_amount) t.total_deductions += c.deduction_amount;
    if (c.submission_to_settlement_days) { t.tat_days_sum += c.submission_to_settlement_days; t.tat_count++; }
  });

  const result = Object.entries(tpaMap).map(([tpaId, t]: [string, any]) => ({
    tpa_id: tpaId, tpa_name: t.tpa_name, total_claims: t.total_claims,
    total_claimed: Math.round(t.total_claimed * 100) / 100,
    total_settled: Math.round(t.total_settled * 100) / 100,
    avg_tat_days: t.tat_count > 0 ? Math.round(t.tat_days_sum / t.tat_count) : 0,
    approval_rate: t.total_claims > 0 ? Math.round(t.approved_claims / t.total_claims * 10000) / 100 : 0,
    deduction_rate: t.total_claimed > 0 ? Math.round(t.total_deductions / t.total_claimed * 10000) / 100 : 0,
  })).sort((a, b) => b.total_claims - a.total_claims);

  return NextResponse.json(result);
}
