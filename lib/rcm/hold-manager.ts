// ============================================================
// HMIS RCM Hold Manager — Calendar-Based Hold/Release
//
// PMJAY: 2-month hold after billing month
// Govt (CGHS/ECHS): 2–3 month hold after billing month
// Cash/TPA: No hold (immediate)
//
// Release is purely time-based — no collection dependency.
// A cron job calls releaseDueHolds() daily/weekly.
// ============================================================

import type { PayoutItemResult } from './types';

export interface HoldBucketEntry {
  doctor_id: string;
  centre_id: string;
  payout_item_id: string;
  service_month: string;
  patient_name: string;
  bill_no: string;
  ip_no: string | null;
  payor_type: string;
  payor_name: string | null;
  calculated_amount: number;
  expected_release: string;   // ISO date
}

/**
 * Extract hold bucket entries from computed payout items.
 * Only items where is_held = true get a hold bucket entry.
 */
export function extractHoldEntries(
  payoutItems: PayoutItemResult[]
): HoldBucketEntry[] {
  return payoutItems
    .filter(item => item.is_held && item.hold_release_date)
    .map(item => ({
      doctor_id: item.doctor_id,
      centre_id: item.centre_id,
      payout_item_id: item.bill_item_id,
      service_month: item.service_month,
      patient_name: item.patient_name,
      bill_no: item.bill_no,
      ip_no: item.ip_no,
      payor_type: item.payor_type,
      payor_name: item.payor_name,
      calculated_amount: item.calculated_amount,
      expected_release: item.hold_release_date!,
    }));
}

/**
 * Check which hold bucket entries are due for release.
 * Called by cron — returns IDs of entries where expected_release <= today.
 *
 * SQL equivalent:
 * SELECT id FROM hmis_doctor_hold_bucket
 * WHERE status = 'PENDING' AND expected_release <= CURRENT_DATE;
 */
export function findDueForRelease(
  entries: Array<{ id: string; expected_release: string; status: string }>,
  asOfDate?: Date
): string[] {
  const today = asOfDate || new Date();
  const todayStr = today.toISOString().substring(0, 10);

  return entries
    .filter(e => e.status === 'PENDING' && e.expected_release <= todayStr)
    .map(e => e.id);
}

/**
 * Compute the expected release date given a service month and hold months.
 *
 * service_month: "2026-04"
 * hold_months: 2
 * → release: "2026-06-01" (first day of month after hold period)
 */
export function computeReleaseDate(serviceMonth: string, holdMonths: number): string {
  const [year, month] = serviceMonth.split('-').map(Number);
  const releaseDate = new Date(year, month - 1 + holdMonths, 1);
  return releaseDate.toISOString().substring(0, 10);
}

/**
 * Summary of held amounts for a doctor, grouped by payor type.
 * Used for the hold bucket dashboard.
 */
export function summariseHolds(
  entries: Array<{
    payor_type: string;
    calculated_amount: number;
    status: string;
    expected_release: string;
  }>
): {
  total_pending: number;
  by_payor: Record<string, { count: number; amount: number; earliest_release: string }>;
} {
  const byPayor: Record<string, { count: number; amount: number; earliest_release: string }> = {};
  let total = 0;

  for (const entry of entries.filter(e => e.status === 'PENDING')) {
    total += entry.calculated_amount;

    if (!byPayor[entry.payor_type]) {
      byPayor[entry.payor_type] = {
        count: 0,
        amount: 0,
        earliest_release: entry.expected_release,
      };
    }

    const group = byPayor[entry.payor_type];
    group.count++;
    group.amount += entry.calculated_amount;
    if (entry.expected_release < group.earliest_release) {
      group.earliest_release = entry.expected_release;
    }
  }

  // Round amounts
  total = Math.round(total * 100) / 100;
  for (const key of Object.keys(byPayor)) {
    byPayor[key].amount = Math.round(byPayor[key].amount * 100) / 100;
  }

  return { total_pending: total, by_payor: byPayor };
}

/**
 * SQL template for the daily cron that releases holds.
 * This would be run as a Supabase Edge Function or pg_cron job.
 */
export const RELEASE_HOLDS_SQL = `
-- Release all PENDING holds where expected_release has passed
-- Run this daily via cron

WITH released AS (
  UPDATE hmis_doctor_hold_bucket
  SET status = 'RELEASED',
      released_at = now()
  WHERE status = 'PENDING'
    AND expected_release <= CURRENT_DATE
  RETURNING id, payout_item_id
)
UPDATE hmis_doctor_payout_items
SET is_held = false,
    released_at = now()
WHERE id IN (SELECT payout_item_id FROM released);
`;
