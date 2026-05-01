// app/api/rcm/hold-bucket/route.ts
// GET: list held amounts with filters and summary by payor

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth-guard';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const doctorId = url.searchParams.get('doctor_id');
    const centreId = url.searchParams.get('centre_id');
    const status = url.searchParams.get('status') || 'PENDING';

    let query = sb
      .from('hmis_doctor_hold_bucket')
      .select('*, doctor:hmis_staff!hmis_doctor_hold_bucket_doctor_id_fkey(id, full_name, specialisation)')
      .eq('status', status)
      .order('expected_release', { ascending: true });

    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (centreId) query = query.eq('centre_id', centreId);

    const { data, error } = await query.limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Summary by payor
    const byPayor: Record<string, { count: number; amount: number; earliest_release: string }> = {};
    let totalPending = 0;

    for (const entry of data || []) {
      const payor = entry.payor_type;
      const amt = Number(entry.calculated_amount ?? 0);
      totalPending += amt;

      if (!byPayor[payor]) {
        byPayor[payor] = { count: 0, amount: 0, earliest_release: entry.expected_release };
      }
      byPayor[payor].count++;
      byPayor[payor].amount += amt;
      if (entry.expected_release < byPayor[payor].earliest_release) {
        byPayor[payor].earliest_release = entry.expected_release;
      }
    }

    // Round amounts
    for (const key of Object.keys(byPayor)) {
      byPayor[key].amount = Math.round(byPayor[key].amount * 100) / 100;
    }

    return NextResponse.json({
      holds: data || [],
      total: data?.length ?? 0,
      summary: {
        total_pending: Math.round(totalPending * 100) / 100,
        by_payor: byPayor,
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
