export const dynamic = 'force-dynamic';
// app/api/integrations/log/route.ts
// GET: Integration monitoring dashboard data.
// Returns last sync status per integration + recent log entries.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-guard';
import { getRecentLogs, getLastSyncPerIntegration } from '@/lib/integrations/integration-log';
import type { Integration } from '@/lib/integrations/integration-log';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const integration = searchParams.get('integration') as Integration | null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

  try {
    const [lastSync, logs] = await Promise.all([
      getLastSyncPerIntegration(),
      getRecentLogs(integration || undefined, limit),
    ]);

    return NextResponse.json({
      last_sync: lastSync,
      logs: logs.data,
      error: logs.error,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
