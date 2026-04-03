export const dynamic = 'force-dynamic';
// app/api/integrations/push-revenue/route.ts
// POST: Push daily billing/collection totals per centre to H1 Revenue Worker.
// Triggered by Vercel cron (daily at 11 PM IST) or manually from Pulse dashboard.
//
// Flow: HMIS → H1 Revenue Worker KV
// Data: MTD billing, MTD collections, occupancy %, ARPOB per centre

import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret, requireAdmin } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import { logIntegrationSync } from '@/lib/integrations/integration-log';
import type { SyncTrigger } from '@/lib/integrations/integration-log';

const HMIS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HMIS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const REVENUE_WORKER_URL = process.env.REVENUE_WORKER_URL || '';
const REVENUE_SYNC_API_KEY = process.env.REVENUE_SYNC_API_KEY || '';

function hmis() {
  return createClient(HMIS_URL, HMIS_KEY);
}

// Centre ID → code mapping (matches H1 Revenue KV keys)
const CENTRE_CODES: Record<string, string> = {
  'c0000001-0000-0000-0000-000000000001': 'shilaj',
  'c0000001-0000-0000-0000-000000000002': 'vastral',
  'c0000001-0000-0000-0000-000000000003': 'modasa',
  'c0000001-0000-0000-0000-000000000004': 'gandhinagar',
  'c0000001-0000-0000-0000-000000000005': 'udaipur',
};

interface CentreData {
  mtd_billing: number;
  mtd_collections: number;
  occupancy: number;
  arpob: number;
  ipd_revenue: number;
  occupied_bed_days: number;
}

/**
 * Query MTD billing and collections for a centre.
 */
async function getCentreMTD(
  db: ReturnType<typeof hmis>,
  centreId: string,
  year: number,
  month: number
): Promise<{ billing: number; collections: number }> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

  const [billsRes, paymentsRes] = await Promise.all([
    db.from('hmis_bills')
      .select('net_amount')
      .eq('centre_id', centreId)
      .gte('bill_date', monthStart)
      .lte('bill_date', monthEnd)
      .in('status', ['final', 'paid', 'partially_paid']),
    db.from('hmis_payments')
      .select('amount')
      .eq('centre_id', centreId)
      .gte('payment_date', monthStart)
      .lte('payment_date', monthEnd)
      .eq('status', 'completed'),
  ]);

  const billing = (billsRes.data || []).reduce(
    (sum: number, b: any) => sum + (parseFloat(b.net_amount) || 0), 0
  );
  const collections = (paymentsRes.data || []).reduce(
    (sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0
  );

  return { billing, collections };
}

/**
 * Query bed occupancy for a centre.
 */
async function getCentreOccupancy(
  db: ReturnType<typeof hmis>,
  centreId: string
): Promise<{ occupancy: number; occupiedBeds: number; totalBeds: number }> {
  const { data: beds } = await db.from('hmis_beds')
    .select('id, status')
    .eq('centre_id', centreId);

  const total = (beds || []).length;
  const occupied = (beds || []).filter((b: any) => b.status === 'occupied').length;
  const occupancy = total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0;

  return { occupancy, occupiedBeds: occupied, totalBeds: total };
}

/**
 * Calculate ARPOB (Average Revenue Per Occupied Bed) for the month.
 * ARPOB = IPD revenue / occupied bed-days in the month so far.
 */
async function getCentreARPOB(
  db: ReturnType<typeof hmis>,
  centreId: string,
  year: number,
  month: number,
  dayOfMonth: number
): Promise<{ arpob: number; ipdRevenue: number; occupiedBedDays: number }> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

  // IPD revenue for the month
  const { data: ipdBills } = await db.from('hmis_bills')
    .select('net_amount')
    .eq('centre_id', centreId)
    .eq('bill_type', 'ipd')
    .gte('bill_date', monthStart)
    .lte('bill_date', monthEnd)
    .in('status', ['final', 'paid', 'partially_paid']);

  const ipdRevenue = (ipdBills || []).reduce(
    (sum: number, b: any) => sum + (parseFloat(b.net_amount) || 0), 0
  );

  // Occupied bed-days: try pulse_daily_snapshots first, fall back to current beds * days
  const { data: snapshots } = await db.from('pulse_daily_snapshots')
    .select('occupied_beds')
    .eq('centre_id', centreId)
    .gte('snapshot_date', monthStart)
    .lte('snapshot_date', monthEnd);

  let occupiedBedDays: number;
  if (snapshots && snapshots.length > 0) {
    occupiedBedDays = snapshots.reduce(
      (sum: number, s: any) => sum + (parseInt(s.occupied_beds) || 0), 0
    );
  } else {
    // Fallback: current occupied beds * days elapsed
    const { data: beds } = await db.from('hmis_beds')
      .select('id, status')
      .eq('centre_id', centreId);
    const occupied = (beds || []).filter((b: any) => b.status === 'occupied').length;
    occupiedBedDays = occupied * dayOfMonth;
  }

  const arpob = occupiedBedDays > 0 ? Math.round(ipdRevenue / occupiedBedDays) : 0;

  return { arpob, ipdRevenue, occupiedBedDays };
}

// ── POST handler ──
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let triggeredBy: SyncTrigger = 'manual';

  // Auth: accept cron secret OR admin user session
  const cronAuth = requireCronSecret(request);
  if (cronAuth.valid) {
    triggeredBy = 'cron';
  } else {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;
    triggeredBy = 'manual';
  }

  if (!REVENUE_WORKER_URL || !REVENUE_SYNC_API_KEY) {
    return NextResponse.json(
      { error: 'Revenue Worker not configured. Set REVENUE_WORKER_URL and REVENUE_SYNC_API_KEY.' },
      { status: 500 }
    );
  }

  try {
    const db = hmis();

    // Get current date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth() + 1;
    const day = istNow.getUTCDate();

    // Get active centres
    const { data: centres } = await db.from('hmis_centres')
      .select('id, name, code')
      .eq('is_active', true);

    // Fall back to hardcoded map if hmis_centres table not populated
    const centreList = (centres && centres.length > 0)
      ? centres.map((c: any) => ({ id: c.id, code: c.code?.toLowerCase() || CENTRE_CODES[c.id] || 'unknown' }))
      : Object.entries(CENTRE_CODES).map(([id, code]) => ({ id, code }));

    const centreResults: Record<string, CentreData> = {};
    const errors: string[] = [];

    // Process all centres in parallel
    await Promise.all(centreList.map(async (centre: { id: string; code: string }) => {
      try {
        const [mtd, occ, arpobData] = await Promise.all([
          getCentreMTD(db, centre.id, year, month),
          getCentreOccupancy(db, centre.id),
          getCentreARPOB(db, centre.id, year, month, day),
        ]);

        centreResults[centre.code] = {
          mtd_billing: Math.round(mtd.billing * 100) / 100,
          mtd_collections: Math.round(mtd.collections * 100) / 100,
          occupancy: occ.occupancy,
          arpob: arpobData.arpob,
          ipd_revenue: Math.round(arpobData.ipdRevenue * 100) / 100,
          occupied_bed_days: arpobData.occupiedBedDays,
        };
      } catch (e: any) {
        errors.push(`${centre.code}: ${e.message}`);
      }
    }));

    if (Object.keys(centreResults).length === 0) {
      await logIntegrationSync({
        integration: 'revenue',
        status: 'failed',
        error_message: 'No centre data collected',
        duration_ms: Date.now() - startTime,
        triggered_by: triggeredBy,
      });
      return NextResponse.json({ error: 'No centre data collected', errors }, { status: 500 });
    }

    // Push to H1 Revenue Worker
    const payload = {
      month,
      year,
      day,
      centres: centreResults,
    };

    const workerResponse = await fetch(`${REVENUE_WORKER_URL}/api/sync-from-hmis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': REVENUE_SYNC_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const durationMs = Date.now() - startTime;

    if (!workerResponse.ok) {
      const errBody = await workerResponse.text();
      await logIntegrationSync({
        integration: 'revenue',
        status: 'failed',
        records_sent: Object.keys(centreResults).length,
        error_message: `Worker returned ${workerResponse.status}: ${errBody}`,
        payload_summary: { centres: Object.keys(centreResults).length, day, month, year },
        duration_ms: durationMs,
        triggered_by: triggeredBy,
      });
      return NextResponse.json(
        { error: `Revenue Worker returned ${workerResponse.status}`, detail: errBody },
        { status: 502 }
      );
    }

    const workerResult = await workerResponse.json();
    const status = errors.length > 0 ? 'partial' : 'success';

    await logIntegrationSync({
      integration: 'revenue',
      status,
      records_sent: Object.keys(centreResults).length,
      records_failed: errors.length,
      error_message: errors.length > 0 ? errors.join('; ') : undefined,
      payload_summary: { centres: Object.keys(centreResults).length, day, month, year },
      duration_ms: durationMs,
      triggered_by: triggeredBy,
    });

    return NextResponse.json({
      success: true,
      status,
      centres_pushed: Object.keys(centreResults).length,
      day,
      month,
      year,
      duration_ms: durationMs,
      worker_response: workerResult,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    await logIntegrationSync({
      integration: 'revenue',
      status: 'failed',
      error_message: e.message,
      duration_ms: Date.now() - startTime,
      triggered_by: triggeredBy,
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── GET handler — for Vercel Cron (crons call GET by default) ──
export async function GET(request: NextRequest) {
  // Vercel cron triggers GET. Forward to POST handler with same auth.
  return POST(request);
}
