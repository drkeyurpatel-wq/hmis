// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

function roundTwo(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

export async function GET(request: NextRequest) {
  const supabase = billingDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const dateStart = `${date}T00:00:00`, dateEnd = `${date}T23:59:59.999`;

  try {
    const { data: payments } = await supabase.from('billing_payments')
      .select('amount, payment_mode, payment_type').eq('centre_id', centreId)
      .eq('status', 'COMPLETED').gte('payment_date', dateStart).lte('payment_date', dateEnd);

    const collections = (payments || []).filter(p => ['COLLECTION', 'ADVANCE', 'DEPOSIT'].includes(p.payment_type));
    const refunds = (payments || []).filter(p => p.payment_type === 'REFUND');
    const totalCollection = roundTwo(collections.reduce((s, p) => s + p.amount, 0));
    const totalRefunds = roundTwo(refunds.reduce((s, p) => s + p.amount, 0));

    const modeMap: Record<string, { count: number; amount: number }> = {};
    collections.forEach(p => {
      if (!modeMap[p.payment_mode]) modeMap[p.payment_mode] = { count: 0, amount: 0 };
      modeMap[p.payment_mode].count++; modeMap[p.payment_mode].amount += p.amount;
    });
    const modeBreakup = Object.entries(modeMap)
      .map(([mode, s]) => ({ payment_mode: mode, count: s.count, amount: roundTwo(s.amount) }))
      .sort((a, b) => b.amount - a.amount);

    const { count: billsGenerated } = await supabase.from('billing_invoices')
      .select('id', { count: 'exact', head: true }).eq('centre_id', centreId)
      .gte('invoice_date', dateStart).lte('invoice_date', dateEnd);

    const { count: encountersCreated } = await supabase.from('billing_encounters')
      .select('id', { count: 'exact', head: true }).eq('centre_id', centreId)
      .gte('created_at', dateStart).lte('created_at', dateEnd);

    const { data: lineItems } = await supabase.from('billing_line_items')
      .select('department, gross_amount, discount_amount, net_amount')
      .eq('centre_id', centreId).eq('status', 'ACTIVE')
      .gte('service_date', dateStart).lte('service_date', dateEnd);

    const deptMap: Record<string, { items: number; gross: number; discounts: number; net: number }> = {};
    (lineItems || []).forEach(li => {
      if (!deptMap[li.department]) deptMap[li.department] = { items: 0, gross: 0, discounts: 0, net: 0 };
      deptMap[li.department].items++; deptMap[li.department].gross += li.gross_amount;
      deptMap[li.department].discounts += li.discount_amount; deptMap[li.department].net += li.net_amount;
    });
    const departmentBreakup = Object.entries(deptMap)
      .map(([dept, s]) => ({ department: dept, items: s.items, gross_revenue: roundTwo(s.gross), discounts: roundTwo(s.discounts), net_revenue: roundTwo(s.net) }))
      .sort((a, b) => b.net_revenue - a.net_revenue);

    return NextResponse.json({ date, total_collection: totalCollection, total_refunds: totalRefunds,
      net_collection: roundTwo(totalCollection - totalRefunds), bills_generated: billsGenerated || 0,
      encounters_created: encountersCreated || 0, mode_breakup: modeBreakup, department_breakup: departmentBreakup });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
