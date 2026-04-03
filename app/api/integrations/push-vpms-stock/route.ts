export const dynamic = 'force-dynamic';
// app/api/integrations/push-vpms-stock/route.ts
// POST: Push pharmacy dispensing events from HMIS to VPMS.
// Reduces stock in VPMS item ledger. Auto-generates purchase indents
// when stock falls below reorder level.
//
// Trigger: End-of-day batch (MVP) or Supabase webhook on dispensing (future).
// Flow: HMIS pharmacy → VPMS stock ledger + auto-indent

import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret, requireAdmin } from '@/lib/api/auth-guard';
import { createClient } from '@supabase/supabase-js';
import { logIntegrationSync } from '@/lib/integrations/integration-log';
import type { SyncTrigger } from '@/lib/integrations/integration-log';

const HMIS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HMIS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VPMS_URL = process.env.VPMS_SUPABASE_URL || '';
const VPMS_KEY = process.env.VPMS_SUPABASE_SERVICE_KEY || '';

function hmis() {
  return createClient(HMIS_URL, HMIS_KEY);
}

function vpms() {
  if (!VPMS_URL || !VPMS_KEY) throw new Error('VPMS Supabase not configured');
  return createClient(VPMS_URL, VPMS_KEY);
}

// HMIS centre ID → VPMS centre code mapping
const CENTRE_MAP: Record<string, string> = {
  'c0000001-0000-0000-0000-000000000001': 'SHI',
  'c0000001-0000-0000-0000-000000000002': 'VAS',
  'c0000001-0000-0000-0000-000000000003': 'MOD',
  'c0000001-0000-0000-0000-000000000004': 'GAN',
  'c0000001-0000-0000-0000-000000000005': 'UDA',
};

interface DispensingEvent {
  id: string;
  item_code: string;
  item_name: string;
  quantity_dispensed: number;
  centre_id: string;
  dispensed_at: string;
}

interface AggregatedConsumption {
  item_code: string;
  item_name: string;
  centre_code: string;
  centre_id: string;
  quantity_consumed: number;
  dispensing_ids: string[];
}

/**
 * Fetch unsynced dispensing events from HMIS.
 */
async function getUnsyncedDispensing(db: ReturnType<typeof hmis>): Promise<DispensingEvent[]> {
  const { data, error } = await db.from('hmis_pharmacy_dispensing')
    .select('id, item_code, item_name, quantity_dispensed, centre_id, dispensed_at')
    .eq('synced_to_vpms', false)
    .order('dispensed_at', { ascending: true })
    .limit(2000);

  if (error) throw new Error(`Failed to fetch dispensing: ${error.message}`);
  return (data || []) as DispensingEvent[];
}

/**
 * Aggregate dispensing by item + centre.
 */
function aggregateByItemCentre(events: DispensingEvent[]): AggregatedConsumption[] {
  const map = new Map<string, AggregatedConsumption>();

  for (const evt of events) {
    const centreCode = CENTRE_MAP[evt.centre_id] || 'UNK';
    const key = `${evt.item_code}|${centreCode}`;

    if (!map.has(key)) {
      map.set(key, {
        item_code: evt.item_code,
        item_name: evt.item_name,
        centre_code: centreCode,
        centre_id: evt.centre_id,
        quantity_consumed: 0,
        dispensing_ids: [],
      });
    }

    const agg = map.get(key)!;
    agg.quantity_consumed += evt.quantity_dispensed;
    agg.dispensing_ids.push(evt.id);
  }

  return Array.from(map.values());
}

/**
 * Resolve VPMS centre ID from centre code.
 */
async function resolveVPMSCentreId(
  vpmsDb: ReturnType<typeof vpms>,
  centreCode: string
): Promise<string | null> {
  const { data } = await vpmsDb.from('centres')
    .select('id')
    .eq('code', centreCode)
    .single();
  return data?.id || null;
}

/**
 * Update stock in VPMS and check reorder levels.
 * Returns list of auto-generated indent IDs.
 */
async function updateStockAndCheckReorder(
  vpmsDb: ReturnType<typeof vpms>,
  item: AggregatedConsumption,
  vpmsCentreId: string | null
): Promise<{ updated: boolean; indent_created: boolean; error?: string }> {
  // Find item in VPMS item_master by code
  const { data: vpmsItem } = await vpmsDb.from('item_master')
    .select('id, item_name, available_qty, reorder_level, unit')
    .eq('item_code', item.item_code)
    .eq('is_active', true)
    .single();

  if (!vpmsItem) {
    return { updated: false, indent_created: false, error: `Item ${item.item_code} not found in VPMS` };
  }

  // Reduce stock
  const newQty = Math.max(0, (vpmsItem.available_qty || 0) - item.quantity_consumed);
  const { error: updateErr } = await vpmsDb.from('item_master')
    .update({ available_qty: newQty, updated_at: new Date().toISOString() })
    .eq('id', vpmsItem.id);

  if (updateErr) {
    return { updated: false, indent_created: false, error: `Stock update failed: ${updateErr.message}` };
  }

  // Insert stock ledger entry
  await vpmsDb.from('stock_ledger').insert({
    item_id: vpmsItem.id,
    centre_id: vpmsCentreId,
    transaction_type: 'consumption',
    quantity: -item.quantity_consumed,
    balance_qty: newQty,
    reference: `HMIS dispensing sync`,
    source: 'hmis_auto',
    created_at: new Date().toISOString(),
  }).then(() => {}).catch(() => {});

  // Check reorder level — auto-generate indent if below threshold
  let indentCreated = false;
  const reorderLevel = vpmsItem.reorder_level || 0;

  if (newQty < reorderLevel && reorderLevel > 0) {
    // Calculate suggested order quantity (reorder level * 2 - current stock)
    const suggestedQty = Math.max(reorderLevel * 2 - newQty, reorderLevel);

    const { error: indentErr } = await vpmsDb.from('purchase_requisitions').insert({
      item_id: vpmsItem.id,
      item_name: vpmsItem.item_name,
      item_code: item.item_code,
      centre_id: vpmsCentreId,
      requested_qty: suggestedQty,
      unit: vpmsItem.unit || 'units',
      current_stock: newQty,
      reorder_level: reorderLevel,
      status: 'pending_approval',
      auto_generated: true,
      source: 'hmis_auto',
      notes: `Auto-generated: stock (${newQty}) below reorder level (${reorderLevel}). Consumed ${item.quantity_consumed} units via HMIS pharmacy.`,
      created_at: new Date().toISOString(),
    });

    if (!indentErr) indentCreated = true;
  }

  return { updated: true, indent_created: indentCreated };
}

// ── POST handler ──
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let triggeredBy: SyncTrigger = 'manual';

  // Auth: cron secret OR admin session
  const cronAuth = requireCronSecret(request);
  if (cronAuth.valid) {
    triggeredBy = 'cron';
  } else {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;
    triggeredBy = 'manual';
  }

  if (!VPMS_URL || !VPMS_KEY) {
    return NextResponse.json(
      { error: 'VPMS not configured. Set VPMS_SUPABASE_URL and VPMS_SUPABASE_SERVICE_KEY.' },
      { status: 500 }
    );
  }

  try {
    const db = hmis();
    const vpmsDb = vpms();

    // Step 1: Get unsynced dispensing events
    const events = await getUnsyncedDispensing(db);
    if (events.length === 0) {
      return NextResponse.json({ message: 'No unsynced dispensing events', synced: 0 });
    }

    // Step 2: Aggregate by item + centre
    const aggregated = aggregateByItemCentre(events);

    // Step 3: Resolve VPMS centre IDs (cache per code)
    const centreIdCache = new Map<string, string | null>();
    for (const item of aggregated) {
      if (!centreIdCache.has(item.centre_code)) {
        centreIdCache.set(item.centre_code, await resolveVPMSCentreId(vpmsDb, item.centre_code));
      }
    }

    // Step 4: Process each aggregated item
    let itemsSynced = 0;
    let itemsFailed = 0;
    let indentsGenerated = 0;
    const errors: string[] = [];
    const syncedDispensingIds: string[] = [];

    for (const item of aggregated) {
      const vpmsCentreId = centreIdCache.get(item.centre_code) || null;
      const result = await updateStockAndCheckReorder(vpmsDb, item, vpmsCentreId);

      if (result.updated) {
        itemsSynced++;
        syncedDispensingIds.push(...item.dispensing_ids);
        if (result.indent_created) indentsGenerated++;
      } else {
        itemsFailed++;
        if (result.error) errors.push(result.error);
        // Don't mark these dispensing IDs as synced — they'll retry next run
      }
    }

    // Step 5: Mark synced dispensing events in HMIS
    if (syncedDispensingIds.length > 0) {
      // Batch in chunks of 500
      for (let i = 0; i < syncedDispensingIds.length; i += 500) {
        const chunk = syncedDispensingIds.slice(i, i + 500);
        await db.from('hmis_pharmacy_dispensing')
          .update({ synced_to_vpms: true, vpms_synced_at: new Date().toISOString() })
          .in('id', chunk);
      }
    }

    const durationMs = Date.now() - startTime;
    const status = itemsFailed > 0 ? (itemsSynced > 0 ? 'partial' : 'failed') : 'success';

    await logIntegrationSync({
      integration: 'vpms',
      status,
      records_sent: itemsSynced,
      records_failed: itemsFailed,
      error_message: errors.length > 0 ? errors.join('; ') : undefined,
      payload_summary: {
        dispensing_events: events.length,
        items_aggregated: aggregated.length,
        items_synced: itemsSynced,
        indents_generated: indentsGenerated,
      },
      duration_ms: durationMs,
      triggered_by: triggeredBy,
    });

    return NextResponse.json({
      success: itemsFailed === 0,
      status,
      dispensing_events: events.length,
      items_synced: itemsSynced,
      items_failed: itemsFailed,
      indents_auto_generated: indentsGenerated,
      duration_ms: durationMs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    await logIntegrationSync({
      integration: 'vpms',
      status: 'failed',
      error_message: e.message,
      duration_ms: Date.now() - startTime,
      triggered_by: triggeredBy,
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
