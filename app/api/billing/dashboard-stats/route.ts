import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const today = new Date().toISOString().split('T')[0];
  try {
    const [paymentsRes, billsRes, pendingRes, insuranceRes, advancesRes, opdRes, ipdRes] =
      await Promise.all([
        supabase.from('billing_payments').select('amount').eq('centre_id', centreId)
          .eq('status', 'COMPLETED').in('payment_type', ['COLLECTION', 'ADVANCE', 'DEPOSIT'])
          .gte('payment_date', `${today}T00:00:00`).lt('payment_date', `${today}T23:59:59.999`),
        supabase.from('billing_invoices').select('id', { count: 'exact', head: true })
          .eq('centre_id', centreId).gte('invoice_date', `${today}T00:00:00`),
        supabase.from('billing_encounters').select('id', { count: 'exact', head: true })
          .eq('centre_id', centreId).eq('status', 'OPEN').gt('net_amount', 0),
        supabase.from('billing_claims').select('claimed_amount').eq('centre_id', centreId)
          .not('status', 'in', '("SETTLED","WRITTEN_OFF","REJECTED")'),
        supabase.from('billing_payments').select('advance_balance').eq('centre_id', centreId)
          .eq('is_advance', true).eq('status', 'COMPLETED').gt('advance_balance', 0),
        supabase.from('billing_encounters').select('id', { count: 'exact', head: true })
          .eq('centre_id', centreId).eq('encounter_type', 'OPD').gte('created_at', `${today}T00:00:00`),
        supabase.from('billing_encounters').select('id', { count: 'exact', head: true })
          .eq('centre_id', centreId).in('encounter_type', ['IPD', 'ER', 'DAYCARE']).eq('status', 'OPEN'),
      ]);

    return NextResponse.json({
      today_collection: (paymentsRes.data || []).reduce((s: number, p: any) => s + (p.amount || 0), 0),
      today_bills: billsRes.count || 0, pending_bills: pendingRes.count || 0,
      insurance_pending_count: insuranceRes.data?.length || 0,
      insurance_pending_amount: (insuranceRes.data || []).reduce((s: number, c: any) => s + (c.claimed_amount || 0), 0),
      advance_balance: (advancesRes.data || []).reduce((s: number, a: any) => s + (a.advance_balance || 0), 0),
      opd_count: opdRes.count || 0, ipd_active: ipdRes.count || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
