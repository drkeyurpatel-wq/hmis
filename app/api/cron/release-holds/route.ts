// app/api/cron/release-holds/route.ts
// Daily cron — releases PMJAY and Govt holds when calendar period expires
// Vercel cron: runs daily at 6:00 AM IST (00:30 UTC)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Auth: CRON_SECRET for Vercel cron jobs
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().substring(0, 10);

    // 1. Find all PENDING holds where expected_release <= today
    const { data: dueHolds, error: findErr } = await sb
      .from('hmis_doctor_hold_bucket')
      .select('id, doctor_id, centre_id, payout_item_id, calculated_amount, payor_type, service_month')
      .eq('status', 'PENDING')
      .lte('expected_release', today);

    if (findErr) {
      return NextResponse.json({ error: `Failed to query holds: ${findErr.message}` }, { status: 500 });
    }

    if (!dueHolds || dueHolds.length === 0) {
      return NextResponse.json({ message: 'No holds due for release', checked_date: today });
    }

    // 2. Release each hold
    let released = 0;
    let errors: string[] = [];

    for (const hold of dueHolds) {
      // Update hold bucket
      const { error: updateErr } = await sb
        .from('hmis_doctor_hold_bucket')
        .update({
          status: 'RELEASED',
          released_at: new Date().toISOString(),
        })
        .eq('id', hold.id);

      if (updateErr) {
        errors.push(`Hold ${hold.id}: ${updateErr.message}`);
        continue;
      }

      // Update payout item
      if (hold.payout_item_id) {
        await sb
          .from('hmis_doctor_payout_items')
          .update({
            is_held: false,
            released_at: new Date().toISOString(),
          })
          .eq('bill_item_id', hold.payout_item_id);
      }

      released++;
    }

    // 3. Audit log
    await sb.from('hmis_payout_audit_log').insert({
      action: 'holds_released_cron',
      entity: 'hold_bucket',
      details: {
        date: today,
        total_due: dueHolds.length,
        released,
        errors: errors.length > 0 ? errors : undefined,
        total_amount: dueHolds.reduce((s, h) => s + Number(h.calculated_amount), 0),
      },
    });

    return NextResponse.json({
      success: true,
      date: today,
      holds_checked: dueHolds.length,
      released,
      total_amount_released: Math.round(dueHolds.reduce((s, h) => s + Number(h.calculated_amount), 0) * 100) / 100,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err: any) {
    logger.error('RCM release-holds cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
