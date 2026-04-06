// app/api/rcm/payout-items/route.ts
// GET: list computed payout items with filters

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const billId = url.searchParams.get('bill_id');
    const payorType = url.searchParams.get('payor_type');
    const isHeld = url.searchParams.get('is_held');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = sb
      .from('hmis_doctor_payout_items')
      .select('*, doctor:hmis_staff!hmis_doctor_payout_items_doctor_id_fkey(id, full_name, specialisation)')
      .order('bill_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (centreId) query = query.eq('centre_id', centreId);
    if (month) query = query.eq('service_month', month);
    if (billId) query = query.eq('bill_id', billId);
    if (payorType) query = query.eq('payor_type', payorType);
    if (isHeld === 'true') query = query.eq('is_held', true);
    if (isHeld === 'false') query = query.eq('is_held', false);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Summary stats
    const totalAmount = (data || []).reduce((s, i) => s + Number(i.calculated_amount ?? 0), 0);
    const heldAmount = (data || []).filter(i => i.is_held).reduce((s, i) => s + Number(i.calculated_amount ?? 0), 0);

    return NextResponse.json({
      items: data || [],
      total: data?.length ?? 0,
      offset,
      limit,
      summary: {
        total_amount: Math.round(totalAmount * 100) / 100,
        held_amount: Math.round(heldAmount * 100) / 100,
        immediate_amount: Math.round((totalAmount - heldAmount) * 100) / 100,
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
