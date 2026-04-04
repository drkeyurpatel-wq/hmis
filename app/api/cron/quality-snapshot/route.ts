// app/api/cron/quality-snapshot/route.ts
// Vercel Cron — runs daily at 3:00 AM UTC (8:30 AM IST)
// Generates NABH quality snapshots for all active centres

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const vercelCron = request.headers.get('x-vercel-cron');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !vercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    // Get all active centres
    const { data: centres, error: centresError } = await sb
      .from('hmis_centres')
      .select('id')
      .eq('is_active', true);

    if (centresError) {
      return NextResponse.json(
        { error: 'Failed to fetch centres', detail: centresError.message },
        { status: 500 },
      );
    }

    if (!centres || centres.length === 0) {
      return NextResponse.json({ success: true, message: 'No active centres found', results: [] });
    }

    const results: { centreId: string; success: boolean; error?: string }[] = [];

    for (const centre of centres) {
      const { error: rpcError } = await sb.rpc('generate_nabh_quality_snapshot', {
        p_centre_id: centre.id,
      });

      if (rpcError) {
        results.push({ centreId: centre.id, success: false, error: rpcError.message });
      } else {
        results.push({ centreId: centre.id, success: true });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failed === 0,
      generatedAt: new Date().toISOString(),
      totalCentres: centres.length,
      succeeded,
      failed,
      results,
    });
  } catch (err: unknown) {
    console.error('[cron] quality-snapshot error:', err);
    return NextResponse.json(
      { error: 'Internal error', detail: String(err) },
      { status: 500 },
    );
  }
}
