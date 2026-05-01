// app/api/rcm/compute-settlement/route.ts
// Compute monthly settlement for a doctor at a centre
// Aggregates all payout items into pools, applies MGM/retainer/incentive/TDS

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeSettlement, generateBillBreakdown } from '@/lib/rcm/settlement-engine';
import {
  getActiveContract,
  getPayoutItemsForSettlement,
  upsertSettlement,
  linkPayoutItemsToSettlement,
  logPayoutAudit,
} from '@/lib/rcm/db';
import { requireAuth } from '@/lib/api/auth-guard';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { doctor_id, centre_id, month, cycle = 'full', user_id } = body;

    if (!doctor_id || !centre_id || !month) {
      return NextResponse.json(
        { error: 'doctor_id, centre_id, and month required' },
        { status: 400 }
      );
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'month must be in YYYY-MM format' },
        { status: 400 }
      );
    }

    // 1. Load contract
    const contract = await getActiveContract(sb, doctor_id, centre_id);
    if (!contract) {
      return NextResponse.json(
        { error: 'No active contract found for this doctor at this centre' },
        { status: 404 }
      );
    }

    // 2. Load payout items (unsettled)
    const payoutItems = await getPayoutItemsForSettlement(sb, doctor_id, centre_id, month);
    if (payoutItems.length === 0) {
      return NextResponse.json({
        message: 'No unsettled payout items found for this doctor/centre/month',
        doctor_id,
        centre_id,
        month,
      });
    }

    // 3. Compute settlement
    const result = computeSettlement({
      doctor_id,
      centre_id,
      contract,
      month,
      cycle: cycle as any,
      payout_items: payoutItems,
    });

    // 4. Generate bill breakdown for statement
    const bills = generateBillBreakdown(payoutItems);

    // 5. Upsert settlement
    const { id: settlementId, error: settleErr } = await upsertSettlement(
      sb, doctor_id, centre_id, contract.id, month, cycle, result, bills
    );

    if (settleErr) {
      return NextResponse.json({ error: `Settlement upsert failed: ${settleErr}` }, { status: 500 });
    }

    // 6. Link payout items to this settlement
    if (settlementId) {
      const linked = await linkPayoutItemsToSettlement(sb, doctor_id, centre_id, month, settlementId);

      // 7. Audit
      await logPayoutAudit(sb, user_id || null, 'settlement_computed', 'settlement', settlementId, {
        month, cycle, ...result, payout_items_linked: linked,
      });
    }

    return NextResponse.json({
      success: true,
      settlement_id: settlementId,
      doctor_id,
      centre_id,
      month,
      cycle,
      payout_items_count: payoutItems.length,
      ...result,
      bills_count: bills.length,
    });

  } catch (err: any) {
    console.error('RCM compute-settlement error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
