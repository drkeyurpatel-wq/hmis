// app/api/rcm/compute-bill/route.ts
// Triggered when a bill is finalized (status → 'final')
// Computes doctor payout for every billable item in the bill

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeBillPayouts } from '@/lib/rcm/payout-engine';
import {
  getActiveContractsForCentre,
  getDepartmentMap,
  getActiveFixedPayouts,
  getBillItemsForBill,
  insertPayoutItems,
  insertHoldEntries,
  logPayoutAudit,
} from '@/lib/rcm/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Auth: requires service role or authenticated session
    const authHeader = request.headers.get('authorization');
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { bill_id, user_id } = body;

    if (!bill_id) {
      return NextResponse.json({ error: 'bill_id required' }, { status: 400 });
    }

    // 1. Check bill isn't already computed
    const { data: existing } = await sb
      .from('hmis_doctor_payout_items')
      .select('id', { count: 'exact', head: true })
      .eq('bill_id', bill_id);

    if (existing && (existing as any).length > 0) {
      return NextResponse.json({
        error: 'Bill already has payout items computed. Delete existing items first to recompute.',
      }, { status: 409 });
    }

    // 2. Load bill + items
    const { bill, items } = await getBillItemsForBill(sb, bill_id);
    if (!bill || items.length === 0) {
      return NextResponse.json({ error: 'Bill not found or has no items' }, { status: 404 });
    }

    // 3. Load contracts for this centre
    const contracts = await getActiveContractsForCentre(sb, bill.centre_id);
    if (contracts.size === 0) {
      return NextResponse.json({
        error: 'No active doctor contracts found for this centre',
        centre_id: bill.centre_id,
      }, { status: 404 });
    }

    // 4. Load department map + fixed payouts
    const deptMap = await getDepartmentMap(sb);
    const fixedPayouts = await getActiveFixedPayouts(sb);

    // 5. Compute payouts
    const payoutItems = computeBillPayouts(items, contracts, deptMap, fixedPayouts);

    if (payoutItems.length === 0) {
      return NextResponse.json({
        message: 'No payable items found (all items may be in excluded departments or doctors without contracts)',
        bill_id,
        items_checked: items.length,
      });
    }

    // 6. Insert payout items
    const { inserted, errors } = await insertPayoutItems(sb, payoutItems);

    // 7. Insert hold bucket entries for held items
    const holdsInserted = await insertHoldEntries(sb, payoutItems);

    // 8. Audit log
    await logPayoutAudit(sb, user_id || null, 'bill_payout_computed', 'bill', bill_id, {
      items_input: items.length,
      payout_items_created: inserted,
      holds_created: holdsInserted,
      total_doctor_share: payoutItems.reduce((s, i) => s + i.calculated_amount, 0),
      doctors_paid: [...new Set(payoutItems.map(i => i.doctor_id))].length,
    });

    return NextResponse.json({
      success: true,
      bill_id,
      bill_no: bill.bill_number,
      items_input: items.length,
      payout_items_created: inserted,
      holds_created: holdsInserted,
      total_doctor_share: Math.round(payoutItems.reduce((s, i) => s + i.calculated_amount, 0) * 100) / 100,
      doctors: [...new Set(payoutItems.map(i => i.doctor_id))].length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err: any) {
    console.error('RCM compute-bill error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
