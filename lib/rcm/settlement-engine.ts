// ============================================================
// HMIS RCM Settlement Engine — Monthly Pool Aggregation
//
// Takes all payout_items for a doctor+centre+month and produces
// a settlement with pool breakdown, MGM/retainer/incentive
// computation, TDS, and net payout.
// ============================================================

import type {
  DoctorContract,
  PayoutItemResult,
  SettlementInput,
  SettlementResult,
  SettlementCycle,
} from './types';

/** Round to 2 decimal places */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Compute a monthly settlement for one doctor at one centre.
 *
 * Input: all payout_items for the month (already computed by payout-engine).
 * Output: settlement with pool breakdown, MGM/retainer, TDS, net payout.
 */
export function computeSettlement(input: SettlementInput): SettlementResult {
  const { contract, payout_items, adjustments = [] } = input;

  // =====================================================
  // STEP 1: AGGREGATE POOLS (non-held items only for immediate)
  // =====================================================
  let cash_pool = 0;
  let tpa_pool = 0;
  let pmjay_pool = 0;
  let govt_pool = 0;
  let opd_amount = 0;
  let held_total = 0;

  for (const item of payout_items) {
    const amt = item.calculated_amount;

    if (item.is_held) {
      held_total += amt;

      // Still track which pool the held amount belongs to
      switch (item.payor_type) {
        case 'Cash': cash_pool += amt; break;
        case 'TPA': tpa_pool += amt; break;
        case 'PMJAY': pmjay_pool += amt; break;
        case 'Govt': govt_pool += amt; break;
      }
      continue;
    }

    switch (item.payor_type) {
      case 'Cash': cash_pool += amt; break;
      case 'TPA': tpa_pool += amt; break;
      case 'PMJAY': pmjay_pool += amt; break;
      case 'Govt': govt_pool += amt; break;
    }

    if (item.encounter_type === 'OPD') {
      opd_amount += amt;
    }
  }

  cash_pool = r2(cash_pool);
  tpa_pool = r2(tpa_pool);
  pmjay_pool = r2(pmjay_pool);
  govt_pool = r2(govt_pool);
  opd_amount = r2(opd_amount);
  held_total = r2(held_total);

  const total_pool = r2(cash_pool + tpa_pool + pmjay_pool + govt_pool);
  const immediate_pool = r2(total_pool - held_total);

  // =====================================================
  // STEP 2: MGM (Minimum Guaranteed Money)
  // =====================================================
  let mgm_triggered = false;
  let mgm_topup = 0;
  let incentive_triggered = false;
  let incentive_amount = 0;

  if (contract.contract_type === 'MGM') {
    if (total_pool < contract.mgm_amount && contract.mgm_amount > 0) {
      // Doctor earned less than guarantee — hospital tops up
      mgm_triggered = true;
      mgm_topup = r2(contract.mgm_amount - total_pool);
    } else if (total_pool > contract.mgm_threshold && contract.mgm_threshold > 0 && contract.incentive_pct > 0) {
      // Doctor earned above threshold — gets incentive on surplus
      incentive_triggered = true;
      incentive_amount = r2((total_pool - contract.mgm_threshold) * (contract.incentive_pct / 100));
    }
  }

  // Incentive can also be on FFS contracts (1 FFS doctor has incentive_pct > 0)
  if (contract.contract_type === 'FFS' && contract.incentive_pct > 0 && contract.mgm_threshold > 0) {
    if (total_pool > contract.mgm_threshold) {
      incentive_triggered = true;
      incentive_amount = r2((total_pool - contract.mgm_threshold) * (contract.incentive_pct / 100));
    }
  }

  // =====================================================
  // STEP 3: RETAINER
  // =====================================================
  let retainer_amount = 0;

  if (contract.contract_type === 'Retainer' && contract.retainer_amount > 0) {
    switch (contract.retainer_mode) {
      case 'fixed': {
        // Fixed monthly salary — added on top of pool (if pool > 0) or standalone
        retainer_amount = contract.retainer_amount;
        break;
      }
      case 'billable': {
        // Retainer is the floor — if pool > retainer, doctor gets pool
        // If pool < retainer, doctor gets retainer (and pool doesn't add to it)
        if (total_pool < contract.retainer_amount) {
          retainer_amount = contract.retainer_amount;
          // In billable mode, retainer replaces pool when pool is lower
          // The gross = retainer (not retainer + pool)
        } else {
          retainer_amount = 0;
          // Pool is higher than retainer, doctor gets pool only
        }
        break;
      }
      case 'procedures_only': {
        // Retainer covers OPD/consultation, procedures computed separately
        retainer_amount = contract.retainer_amount;
        break;
      }
      case 'pmjay_covered': {
        // Retainer covers PMJAY pool, other pools computed normally
        retainer_amount = contract.retainer_amount;
        // PMJAY pool is effectively replaced by retainer
        break;
      }
    }
  }

  // =====================================================
  // STEP 4: GROSS PAYOUT
  // =====================================================
  let gross_payout: number;

  if (contract.contract_type === 'Retainer' && contract.retainer_mode === 'billable') {
    // Billable retainer: MAX(pool, retainer)
    gross_payout = Math.max(total_pool, contract.retainer_amount) + incentive_amount;
  } else if (contract.contract_type === 'MGM' && mgm_triggered) {
    // MGM triggered: doctor gets mgm_amount (not pool + topup, just the guarantee)
    gross_payout = contract.mgm_amount;
  } else {
    // Standard: pool + extras
    gross_payout = total_pool + mgm_topup + incentive_amount + retainer_amount;
  }

  gross_payout = r2(gross_payout);

  // =====================================================
  // STEP 5: IMMEDIATE vs HELD
  // =====================================================
  const immediate_payout = r2(gross_payout - held_total);
  const held_payout = held_total;

  // =====================================================
  // STEP 6: ADJUSTMENTS
  // =====================================================
  let adjustmentTotal = 0;
  for (const adj of adjustments) {
    if (adj.type === 'deduction') {
      adjustmentTotal -= adj.amount;
    } else {
      adjustmentTotal += adj.amount;
    }
  }
  adjustmentTotal = r2(adjustmentTotal);

  // =====================================================
  // STEP 7: TDS
  // =====================================================
  const tds_pct = contract.tds_pct;
  // TDS applied on gross payout (excluding retainer if it's treated as salary)
  // For simplicity, applying on gross - this can be refined per tax rules
  const tds_amount = r2(gross_payout * (tds_pct / 100));

  // =====================================================
  // STEP 8: NET PAYOUT
  // =====================================================
  const net_payout = r2(gross_payout - tds_amount + adjustmentTotal);

  return {
    cash_pool,
    tpa_pool,
    pmjay_pool,
    govt_pool,
    total_pool,
    opd_amount,

    mgm_triggered,
    mgm_topup,
    incentive_triggered,
    incentive_amount,
    retainer_amount,

    gross_payout,
    immediate_payout: r2(Math.max(0, immediate_payout)),
    held_payout,

    tds_pct,
    tds_amount,
    net_payout: r2(Math.max(0, net_payout)),
  };
}

/**
 * Generate a per-bill breakdown suitable for storing in settlement.bills JSONB.
 * Groups payout items by bill, sums per bill.
 */
export function generateBillBreakdown(
  items: PayoutItemResult[]
): Array<{
  bill_no: string;
  bill_date: string;
  patient_name: string;
  payor_type: string;
  encounter_type: string;
  total_service: number;
  doctor_share: number;
  is_held: boolean;
  items: Array<{
    department: string;
    service_name: string;
    amount: number;
    method: string;
    formula: string;
  }>;
}> {
  const billMap = new Map<string, typeof items>();

  for (const item of items) {
    const key = item.bill_no || item.bill_id;
    if (!billMap.has(key)) billMap.set(key, []);
    billMap.get(key)!.push(item);
  }

  return Array.from(billMap.entries()).map(([billNo, billItems]) => {
    const first = billItems[0];
    return {
      bill_no: billNo,
      bill_date: first.bill_date,
      patient_name: first.patient_name,
      payor_type: first.payor_type,
      encounter_type: first.encounter_type,
      total_service: r2(billItems.reduce((s, i) => s + i.service_amt, 0)),
      doctor_share: r2(billItems.reduce((s, i) => s + i.calculated_amount, 0)),
      is_held: billItems.some(i => i.is_held),
      items: billItems.map(i => ({
        department: i.department,
        service_name: i.service_name,
        amount: i.calculated_amount,
        method: i.base_method_used,
        formula: i.formula_description,
      })),
    };
  });
}
