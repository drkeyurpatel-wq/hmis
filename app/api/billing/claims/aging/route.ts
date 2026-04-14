import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

export async function GET(request: NextRequest) {
  const supabase = billingDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const { data: claims } = await supabase
    .from('billing_claims')
    .select('claimed_amount, claim_submission_date')
    .eq('centre_id', centreId)
    .not('status', 'in', '("SETTLED","WRITTEN_OFF","REJECTED")');

  const buckets: Record<string, { count: number; amount: number }> = {
    '0-30': { count: 0, amount: 0 }, '31-60': { count: 0, amount: 0 },
    '61-90': { count: 0, amount: 0 }, '91-120': { count: 0, amount: 0 },
    '120+': { count: 0, amount: 0 },
  };

  const now = Date.now();
  (claims || []).forEach((c: any) => {
    if (!c.claim_submission_date) return;
    const days = Math.round((now - new Date(c.claim_submission_date).getTime()) / 86400000);
    const bucket = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : days <= 120 ? '91-120' : '120+';
    buckets[bucket].count++;
    buckets[bucket].amount += c.claimed_amount || 0;
  });

  const total = Object.values(buckets).reduce((s, b) => s + b.amount, 0);
  return NextResponse.json(
    Object.entries(buckets).map(([bucket, stats]) => ({
      aging_bucket: bucket, claim_count: stats.count,
      total_amount: Math.round(stats.amount * 100) / 100,
      percentage: total > 0 ? Math.round(stats.amount / total * 10000) / 100 : 0,
    }))
  );
}
