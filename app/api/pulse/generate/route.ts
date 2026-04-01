// app/api/pulse/generate/route.ts
// POST endpoint for generating pulse snapshots for all centres.
// Protected by auth — only admin/md/ceo roles allowed.
// Can be triggered manually from dashboard or via Vercel cron at 6:30 AM IST.

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const ALLOWED_ROLES = ['admin', 'md', 'ceo'];

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    const { data: staff } = await supabase
      .from('hmis_staff')
      .select('staff_type')
      .eq('auth_user_id', user.id)
      .single();

    if (!staff || !ALLOWED_ROLES.includes(staff.staff_type)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse date from body or default to yesterday
    let date: string;
    try {
      const body = await request.json();
      date = body.date || getYesterdayIST();
    } catch {
      date = getYesterdayIST();
    }

    // Call the RPC
    const { data, error: rpcError } = await supabase.rpc('generate_pulse_all_centres', {
      p_date: date,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({
      centres_processed: data || 0,
      date,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function getYesterdayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  istNow.setDate(istNow.getDate() - 1);
  return istNow.toISOString().split('T')[0];
}
