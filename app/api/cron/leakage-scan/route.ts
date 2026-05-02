// app/api/cron/leakage-scan/route.ts
// Daily revenue leakage scan — creates alerts for unbilled items
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  let totalLeaks = 0;

  // Get all active centres
  const { data: centres } = await sb.from('hmis_centres').select('id').eq('is_active', true);

  for (const centre of (centres || [])) {
    const cid = centre.id;

    // 1. Unbilled charges older than 24h
    const { count: unbilledCharges } = await sb.from('hmis_charge_log')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', cid).is('bill_id', null).neq('status', 'reversed')
      .lte('created_at', new Date(Date.now() - 86400000).toISOString());

    // 2. Active admissions without today's room charge (batch query — no N+1)
    const { data: admissions } = await sb.from('hmis_admissions')
      .select('id').eq('centre_id', cid).eq('status', 'active');
    let missingRoom = 0;
    const admIds = (admissions || []).map(a => a.id);
    if (admIds.length > 0) {
      const { data: chargedAdmissions } = await sb.from('hmis_charge_log')
        .select('admission_id').in('admission_id', admIds)
        .eq('category', 'room').eq('service_date', todayStr);
      const chargedSet = new Set((chargedAdmissions || []).map(c => c.admission_id));
      missingRoom = admIds.filter(id => !chargedSet.has(id)).length;
    }

    // 3. Completed labs not billed
    const { count: unbilledLabs } = await sb.from('hmis_lab_orders')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', cid).eq('status', 'completed').is('bill_id', null)
      .gte('created_at', weekAgo + 'T00:00:00');

    const leakCount = (unbilledCharges || 0) + missingRoom + (unbilledLabs || 0);
    totalLeaks += leakCount;

    // Create alert if leaks found
    if (leakCount > 0) {
      await sb.from('hmis_clinical_alerts').insert({
        centre_id: cid, alert_type: 'revenue_leakage',
        severity: leakCount > 10 ? 'critical' : 'warning',
        title: `Revenue Leakage: ${leakCount} items`,
        description: `Unbilled charges: ${unbilledCharges || 0}, Missing room charges: ${missingRoom}, Unbilled labs: ${unbilledLabs || 0}`,
        source: 'cron', status: 'active',
      });
    }
  }

  return NextResponse.json({ success: true, totalLeaks, scannedAt: now.toISOString() });
  } catch (err: unknown) {
    logger.error("[cron] Error", { error: String(err) });
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
