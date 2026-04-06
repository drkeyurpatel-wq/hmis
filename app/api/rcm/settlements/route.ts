// app/api/rcm/settlements/route.ts
// GET: list settlements (filters: doctor_id, centre_id, month, status)
// PATCH: update settlement status (approve, lock, mark paid)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logPayoutAudit } from '@/lib/rcm/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const doctorId = url.searchParams.get('doctor_id');
    const centreId = url.searchParams.get('centre_id');
    const month = url.searchParams.get('month');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let query = sb
      .from('hmis_doctor_settlements')
      .select('*, doctor:hmis_staff!hmis_doctor_settlements_doctor_id_fkey(id, full_name, specialisation, employee_code)')
      .order('month', { ascending: false })
      .order('created_at', { ascending: false });

    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (centreId) query = query.eq('centre_id', centreId);
    if (month) query = query.eq('month', month);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      settlements: data || [],
      total: data?.length ?? 0,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { settlement_id, action, user_id, paid_date, paid_utr, payment_mode, override_payout, override_reason } = body;

    if (!settlement_id || !action) {
      return NextResponse.json({ error: 'settlement_id and action required' }, { status: 400 });
    }

    // Load current settlement
    const { data: settlement } = await sb
      .from('hmis_doctor_settlements')
      .select('*')
      .eq('id', settlement_id)
      .single();

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    let updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'approve':
        if (settlement.status !== 'computed') {
          return NextResponse.json({ error: 'Can only approve computed settlements' }, { status: 400 });
        }
        updateData.status = 'approved';
        updateData.approved_by = user_id;
        updateData.approved_at = new Date().toISOString();
        break;

      case 'lock':
        if (settlement.status !== 'approved') {
          return NextResponse.json({ error: 'Can only lock approved settlements' }, { status: 400 });
        }
        updateData.status = 'locked';
        updateData.locked = true;
        break;

      case 'mark_paid':
        if (settlement.status !== 'locked' && settlement.status !== 'approved') {
          return NextResponse.json({ error: 'Can only mark locked/approved settlements as paid' }, { status: 400 });
        }
        updateData.status = 'paid';
        updateData.paid_date = paid_date || new Date().toISOString().substring(0, 10);
        updateData.paid_utr = paid_utr || null;
        updateData.payment_mode = payment_mode || null;
        break;

      case 'override':
        if (override_payout == null || !override_reason) {
          return NextResponse.json({ error: 'override_payout and override_reason required' }, { status: 400 });
        }
        updateData.override_payout = override_payout;
        updateData.override_reason = override_reason;
        // Recalculate net with override
        updateData.net_payout = Math.round((override_payout - Number(settlement.tds_amount)) * 100) / 100;
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const { error } = await sb
      .from('hmis_doctor_settlements')
      .update(updateData)
      .eq('id', settlement_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit
    await logPayoutAudit(sb, user_id || null, `settlement_${action}`, 'settlement', settlement_id, {
      previous_status: settlement.status,
      new_status: updateData.status || settlement.status,
      ...updateData,
    });

    return NextResponse.json({ success: true, action, settlement_id });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
