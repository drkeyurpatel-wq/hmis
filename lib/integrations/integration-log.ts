// lib/integrations/integration-log.ts
// Shared helper for logging integration sync attempts to hmis_integration_log.
// All three integrations (revenue, medpay, vpms) use this.

import { createClient } from '@supabase/supabase-js';

const HMIS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const HMIS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function hmisAdmin() {
  if (!HMIS_URL || !HMIS_KEY) throw new Error('HMIS Supabase not configured');
  return createClient(HMIS_URL, HMIS_KEY);
}

export type Integration = 'revenue' | 'medpay' | 'vpms' | 'patient_app';
export type SyncDirection = 'push' | 'pull';
export type SyncStatus = 'success' | 'partial' | 'failed';
export type SyncTrigger = 'cron' | 'manual' | 'webhook';

export interface IntegrationLogEntry {
  integration: Integration;
  direction?: SyncDirection;
  status: SyncStatus;
  records_sent?: number;
  records_failed?: number;
  error_message?: string;
  payload_summary?: Record<string, unknown>;
  duration_ms?: number;
  triggered_by?: SyncTrigger;
}

/**
 * Log an integration sync attempt. Non-throwing — errors are swallowed
 * so that a logging failure never blocks the actual sync.
 */
export async function logIntegrationSync(entry: IntegrationLogEntry): Promise<void> {
  try {
    const db = hmisAdmin();
    await db.from('hmis_integration_log').insert({
      integration: entry.integration,
      direction: entry.direction || 'push',
      status: entry.status,
      records_sent: entry.records_sent || 0,
      records_failed: entry.records_failed || 0,
      error_message: entry.error_message || null,
      payload_summary: entry.payload_summary || null,
      duration_ms: entry.duration_ms || null,
      triggered_by: entry.triggered_by || null,
    });
  } catch {
    // Logging failure must never block the integration
  }
}

/**
 * Get recent integration log entries for the monitoring dashboard.
 */
export async function getRecentLogs(
  integration?: Integration,
  limit: number = 20
): Promise<{ data: any[]; error: string | null }> {
  try {
    const db = hmisAdmin();
    let q = db.from('hmis_integration_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (integration) q = q.eq('integration', integration);

    const { data, error } = await q;
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (e: any) {
    return { data: [], error: e.message };
  }
}

/**
 * Get last sync status per integration (for dashboard cards).
 */
export async function getLastSyncPerIntegration(): Promise<Record<string, any>> {
  try {
    const db = hmisAdmin();
    const integrations: Integration[] = ['revenue', 'medpay', 'vpms'];
    const results: Record<string, any> = {};

    await Promise.all(integrations.map(async (intg) => {
      const { data } = await db.from('hmis_integration_log')
        .select('status, records_sent, records_failed, error_message, duration_ms, triggered_by, created_at')
        .eq('integration', intg)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      results[intg] = data || { status: 'never', records_sent: 0 };
    }));

    return results;
  } catch {
    return {};
  }
}
