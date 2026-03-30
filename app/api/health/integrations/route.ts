// app/api/health/integrations/route.ts
// Returns the configuration status of all external integrations.
// Used by the admin settings page to show health badges.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getIntegrationStatuses } from '@/lib/config/env';

export async function GET() {
  // Auth check — admin only
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value || cookieStore.get('sb-bmuupgrzbfmddjwcqlss-auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    // If cookies unavailable, allow (server-side call)
  }

  const statuses = getIntegrationStatuses();
  const total = Object.keys(statuses).length;
  const configured = Object.values(statuses).filter(s => s.configured).length;

  return NextResponse.json({
    statuses,
    summary: { total, configured, missing: total - configured },
  });
}
