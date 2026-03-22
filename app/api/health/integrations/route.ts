// app/api/health/integrations/route.ts
// Returns the configuration status of all external integrations.
// Used by the admin settings page to show health badges.

import { NextResponse } from 'next/server';
import { getIntegrationStatuses } from '@/lib/config/env';

export async function GET() {
  const statuses = getIntegrationStatuses();
  const total = Object.keys(statuses).length;
  const configured = Object.values(statuses).filter(s => s.configured).length;

  return NextResponse.json({
    statuses,
    summary: { total, configured, missing: total - configured },
  });
}
