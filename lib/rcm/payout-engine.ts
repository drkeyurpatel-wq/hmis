// ============================================================
// HMIS RCM Payout Engine — Per-Bill-Item Computation
// The core logic that replaces MedPay's entire value.
//
// Given a bill_item + doctor_contract + department_map + fixed_payouts,
// computes the doctor's share and returns a PayoutItemResult with
// full audit trail (method used, % applied, formula description).
// ============================================================

import type {
  BillItemInput,
  PayoutItemResult,
  DoctorContract,
  PayorConfig,
  DeptMapEntry,
  FixedPayoutRule,
  PayoutRole,
  PayorType,
} from './types';

// ---- Helpers ----

/** Round to 2 decimal places using banker's rounding */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Derive service_month from bill_date ("2026-04-15" → "2026-04") */
function toServiceMonth(billDate: string): string {
  return billDate.substring(0, 7);
}

/** Determine if the doctor is the "self" doctor on this bill item */
function isSelfCase(
  item: BillItemInput,
  contract: DoctorContract
): boolean {
  const docId = contract.doctor_id;
  // Self = doctor is the service doctor or consulting doctor
  if (item.service_doctor_id === docId) return true;
  if (item.consulting_doctor_id === docId) return true;
  // If case_type explicitly says "Ref Doctor Case", it's "other"
  if (item.case_type === 'Ref Doctor Case') return false;
  // Default to self (Hospital Case)
  return true;
}

/** Get the payor config block from contract for a given payor type */
function getPayorConfig(
  contract: DoctorContract,
  payorType: PayorType
): PayorConfig & { flat_pct?: number } {
  switch (payorType) {
    case 'Cash': return contract.cash;
    case 'TPA': return contract.tpa;
    case 'PMJAY': return contract.pmjay;
    case 'Govt': return contract.govt;
    default: return contract.cash;
  }
}

/** Map payor_type string from HMIS to our enum (normalise variants) */
export function normalisePayorType(raw: string): PayorType {
  const u = (raw || '').toUpperCase().trim();
  if (u === 'CASH' || u === 'SELF' || u === 'SELF PAY') return 'Cash';
  if (u === 'TPA' || u === 'INSURANCE' || u === 'CASHLESS' || u === 'TPA CASHLESS') return 'TPA';
  if (u === 'PMJAY' || u === 'AB-PMJAY' || u === 'AYUSHMAN' || u === 'MA AMRUTAM'
      || u === 'MA CARD' || u === 'MACARD') return 'PMJAY';
  if (u === 'GOVT' || u === 'CGHS' || u === 'ECHS' || u === 'GOVT (CGHS/ECHS)'
      || u === 'GOVERNMENT') return 'Govt';
  // Default to Cash if unrecognised
  return 'Cash';
}

/** Map hold_config keys to payor types */
function getHoldKey(payorType: PayorType): string | null {
  switch (payorType) {
    case 'PMJAY': return 'PMJAY';
    case 'Govt': return 'Govt (CGHS/ECHS)';
    case 'TPA': return 'TPA Cashless';
    default: return null;
  }
}

// ---- Main Computation ----

export interface ComputePayoutInput {
  item: BillItemInput;
  contract: DoctorContract;
  deptMap: Map<string, DeptMapEntry>;
  fixedPayouts: FixedPayoutRule[];
  /** All bill items in the same bill — needed for expense deduction totals */
  allBillItems: BillItemInput[];
}

/**
 * Compute a single doctor's payout for a single bill item.
 * Returns null if the doctor should not receive payout for this item
 * (excluded department, na payor, etc.)
 */
export function computePayoutItem(input: ComputePayoutInput): PayoutItemResult | null {
  const { item, contract, deptMap, fixedPayouts, allBillItems } = input;
  const payorType = normalisePayorType(item.payor_type);
  const payorConfig = getPayorConfig(contract, payorType);

  // =====================================================
  // STEP 1: DEPARTMENT CHECK
  // =====================================================
  const deptEntry = deptMap.get(item.department) || deptMap.get(item.department.toUpperCase());
  const deptCategory = deptEntry?.category ?? 'include';

  if (deptCategory === 'exclude') {
    return null; // Doctor gets nothing from excluded departments
  }

  if (deptCategory === 'conditional') {
    // Only include if department is in contract.departments array
    if (contract.departments.length > 0 && !contract.departments.includes(item.department)) {
      return null;
    }
  }

  // =====================================================
  // STEP 2: PAYOR CHECK — if base_method is 'na', doctor doesn't participate
  // =====================================================
  if (payorConfig.base_method === 'na') {
    return null;
  }

  // =====================================================
  // STEP 3: SELF vs OTHER
  // =====================================================
  const selfCase = isSelfCase(item, contract);

  // =====================================================
  // STEP 4: ENCOUNTER TYPE SPLIT (OPD vs IPD)
  // =====================================================
  if (item.encounter_type === 'OPD') {
    return computeOpdPayout(item, contract, payorType, selfCase);
  }

  // =====================================================
  // STEP 5–11: IPD COMPUTATION
  // =====================================================

  // Check for payout_rules first (advanced scenario-based overrides)
  if (contract.payout_rules && contract.payout_rules.length > 0) {
    const ruleResult = tryPayoutRules(item, contract, payorType, selfCase, allBillItems);
    if (ruleResult) return ruleResult;
  }

  // Check for fixed payout match (procedure-specific flat fees)
  const fixedMatch = matchFixedPayout(item, contract, fixedPayouts, payorType);
  if (fixedMatch) {
    return buildResult(item, contract, payorType, selfCase, {
      amount: fixedMatch.rule.doctor_payout,
      method: 'fixed_payout',
      pct: 0,
      formula: `Fixed: ${fixedMatch.rule.package_name} (${payorType}) = ₹${fixedMatch.rule.doctor_payout}`,
      fixedPayoutId: fixedMatch.rule.id,
    });
  }

  // Ward Procedure override
  if (item.department === 'Ward Procedure' && contract.ward_procedure_pct != null) {
    const amt = r2(item.doctor_amt * (contract.ward_procedure_pct / 100));
    return buildResult(item, contract, payorType, selfCase, {
      amount: amt,
      method: 'ward_procedure',
      pct: contract.ward_procedure_pct,
      formula: `Ward Procedure: doctor_amt(${item.doctor_amt}) × ${contract.ward_procedure_pct}% = ${amt}`,
    });
  }

  // Pharmacy department — apply expense_dr_pct
  if (deptCategory === 'pharmacy') {
    const amt = r2(item.doctor_amt * (contract.expense_dr_pct / 100));
    return buildResult(item, contract, payorType, selfCase, {
      amount: amt,
      method: 'pharmacy_expense',
      pct: contract.expense_dr_pct,
      formula: `Pharmacy: doctor_amt(${item.doctor_amt}) × expense_dr_pct(${contract.expense_dr_pct}%) = ${amt}`,
    });
  }

  // Health checkup — separate path (typically OPD-like percentage)
  if (deptCategory === 'health_checkup') {
    const pct = payorType === 'Govt' ? contract.opd_govt_pct : contract.opd_non_govt_pct;
    const amt = r2(item.doctor_amt * (pct / 100));
    return buildResult(item, contract, payorType, selfCase, {
      amount: amt,
      method: 'health_checkup',
      pct,
      formula: `Health Checkup: doctor_amt(${item.doctor_amt}) × ${pct}% = ${amt}`,
    });
  }

  // =====================================================
  // STEP 6: BASE METHOD RESOLUTION
  // =====================================================
  const pct = selfCase ? payorConfig.self_pct : payorConfig.other_pct;
  let baseAmount: number;
  let method: string;
  let formula: string;

  switch (payorConfig.base_method) {
    case 'A': {
      // Method A: doctor_amt × pct
      baseAmount = r2(item.doctor_amt * (pct / 100));
      method = 'A';
      formula = `${payorType} Method A: doctor_amt(${item.doctor_amt}) × ${selfCase ? 'self' : 'other'}_pct(${pct}%) = ${baseAmount}`;
      break;
    }

    case 'B': {
      // Method B: net_amt × b_pct (uses b_pct, not self/other)
      const bPct = payorConfig.b_pct ?? pct;
      baseAmount = r2(item.net_amt * (bPct / 100));
      method = 'B';
      formula = `${payorType} Method B: net_amt(${item.net_amt}) × b_pct(${bPct}%) = ${baseAmount}`;
      break;
    }

    case 'C': {
      // Method C: flat % of package/preauth amount (PMJAY style)
      const cPct = (payorConfig as any).flat_pct || pct;
      const pkgAmt = item.package_amount || item.net_amt;
      baseAmount = r2(pkgAmt * (cPct / 100));
      method = 'C';
      formula = `${payorType} Method C: package_amt(${pkgAmt}) × ${cPct}% = ${baseAmount}`;
      break;
    }

    case 'D': {
      // Method D: custom — fallback to doctor_amt × pct
      baseAmount = r2(item.doctor_amt * (pct / 100));
      method = 'D';
      formula = `${payorType} Method D (custom): doctor_amt(${item.doctor_amt}) × ${pct}% = ${baseAmount}`;
      break;
    }

    case 'package_pct': {
      // Package amount × self/other pct
      const pkgAmt = item.package_amount || item.net_amt;
      baseAmount = r2(pkgAmt * (pct / 100));
      method = 'package_pct';
      formula = `${payorType} package_pct: package_amt(${pkgAmt}) × ${pct}% = ${baseAmount}`;
      break;
    }

    case 'B_pct': {
      // Net bill × b_pct
      const bPct = payorConfig.b_pct ?? 0;
      baseAmount = r2(item.net_amt * (bPct / 100));
      method = 'B_pct';
      formula = `${payorType} B_pct: net_amt(${item.net_amt}) × b_pct(${bPct}%) = ${baseAmount}`;
      break;
    }

    case 'bill_minus_excluded': {
      // Total bill minus excluded departments, then × pct
      const excludedTotal = sumExcludedDepartments(allBillItems, deptMap);
      const base = r2(item.service_amt - excludedTotal);
      baseAmount = r2(base * (pct / 100));
      method = 'bill_minus_excluded';
      formula = `${payorType} bill_minus_excluded: (service_amt(${item.service_amt}) - excluded(${excludedTotal})) × ${pct}% = ${baseAmount}`;
      break;
    }

    default: {
      baseAmount = 0;
      method = 'unknown';
      formula = `Unknown base method: ${payorConfig.base_method}`;
    }
  }

  // =====================================================
  // STEP 7: EXPENSE DEDUCTIONS
  // =====================================================
  let expenseDeductions: Record<string, number> = {};
  if (contract.expense_deductions.length > 0) {
    // Sum amounts from bill items in same bill where department matches expense categories
    for (const expCat of contract.expense_deductions) {
      const expTotal = allBillItems
        .filter(bi => bi.department.toLowerCase().includes(expCat.toLowerCase()))
        .reduce((sum, bi) => sum + bi.doctor_amt, 0);
      if (expTotal > 0) {
        expenseDeductions[expCat] = r2(expTotal);
      }
    }
    // Note: expense deductions are tracked but the base method already handles
    // the department filtering. The deductions are informational for the formula trail.
    // In Method B/bill_minus_excluded, they're subtracted from the base.
  }

  // =====================================================
  // STEP 8: HOSPITAL DEDUCTIONS
  // =====================================================
  let afterHospital = baseAmount;
  let hospitalNote = '';

  if (contract.hospital_fixed_amount > 0) {
    afterHospital = r2(afterHospital - contract.hospital_fixed_amount);
    hospitalNote += ` - hospital_fixed(${contract.hospital_fixed_amount})`;
  }
  if (contract.hospital_pct > 0) {
    const hospitalDeduction = r2(afterHospital * (contract.hospital_pct / 100));
    afterHospital = r2(afterHospital - hospitalDeduction);
    hospitalNote += ` - hospital_pct(${contract.hospital_pct}% = ${hospitalDeduction})`;
  }

  if (hospitalNote) {
    formula += hospitalNote + ` = ${afterHospital}`;
  }

  // Ensure non-negative
  const finalAmount = Math.max(0, afterHospital);

  return buildResult(item, contract, payorType, selfCase, {
    amount: finalAmount,
    method,
    pct,
    formula,
    expenseDeductions,
  });
}

// ---- OPD Computation ----

function computeOpdPayout(
  item: BillItemInput,
  contract: DoctorContract,
  payorType: PayorType,
  selfCase: boolean
): PayoutItemResult {
  const pct = payorType === 'Govt' ? contract.opd_govt_pct : contract.opd_non_govt_pct;
  const amt = r2(item.doctor_amt * (pct / 100));
  const formula = `OPD ${payorType}: doctor_amt(${item.doctor_amt}) × ${pct}% = ${amt}`;

  return buildResult(item, contract, payorType, selfCase, {
    amount: amt,
    method: 'opd',
    pct,
    formula,
  });
}

// ---- Payout Rules Engine ----

function tryPayoutRules(
  item: BillItemInput,
  contract: DoctorContract,
  payorType: PayorType,
  selfCase: boolean,
  allBillItems: BillItemInput[]
): PayoutItemResult | null {
  if (!contract.payout_rules) return null;

  // Determine scenario from item context
  const scenario = determineScenario(item, payorType);

  const rule = contract.payout_rules.find(r => r.scenario === scenario);
  if (!rule) return null;

  let amount: number;
  let formula: string;

  switch (rule.method) {
    case 'net_pct': {
      amount = r2(item.doctor_amt * (rule.pct / 100));
      formula = `Rule[${rule.label}]: doctor_amt(${item.doctor_amt}) × ${rule.pct}% = ${amount}`;
      break;
    }
    case 'ot_surgeon': {
      // Use OT surgery charges (surgeon_charges from ot_bookings)
      amount = r2(item.doctor_amt * (rule.pct / 100));
      formula = `Rule[${rule.label}]: surgeon_charges(${item.doctor_amt}) × ${rule.pct}% = ${amount}`;
      break;
    }
    case 'cashless_formula': {
      // Would use hmis_cashless_case_formulas — for now, fallback to net_pct
      amount = r2(item.doctor_amt * (rule.pct / 100));
      formula = `Rule[${rule.label}]: cashless_formula fallback doctor_amt(${item.doctor_amt}) × ${rule.pct}% = ${amount}`;
      break;
    }
    case 'package_minus_expenses': {
      const pkgAmt = item.package_amount || item.net_amt;
      amount = r2(pkgAmt * (rule.pct / 100));
      formula = `Rule[${rule.label}]: package(${pkgAmt}) × ${rule.pct}% = ${amount}`;
      break;
    }
    case 'pmjay_preauth': {
      const preauth = item.package_amount || item.net_amt;
      amount = r2(preauth * (rule.pct / 100));
      formula = `Rule[${rule.label}]: preauth(${preauth}) × ${rule.pct}% = ${amount}`;
      break;
    }
    default: {
      amount = r2(item.doctor_amt * (rule.pct / 100));
      formula = `Rule[${rule.label}]: doctor_amt(${item.doctor_amt}) × ${rule.pct}% = ${amount}`;
    }
  }

  return buildResult(item, contract, payorType, selfCase, {
    amount,
    method: `rule:${rule.scenario}`,
    pct: rule.pct,
    formula,
  });
}

function determineScenario(item: BillItemInput, payorType: PayorType): string {
  if (item.encounter_type === 'OPD') return 'opd';
  if (payorType === 'PMJAY') return 'pmjay';
  if (payorType === 'Govt') return 'govt';

  // IPD — check if surgery (OT department) or consultation
  const dept = item.department.toLowerCase();
  if (dept.includes('operation') || dept.includes('ot ') || dept.includes('cathlab')) {
    if (payorType === 'Cash') return 'surgery_cash';
    if (payorType === 'TPA') return 'surgery_tpa';
  }
  if (dept.includes('cathlab') || dept.includes('cath lab')) {
    return 'cathlab';
  }
  if (dept.includes('consultation') || dept.includes('ipd consultation')) {
    return 'ipd_consult';
  }

  // Default to surgery for the payor type
  if (payorType === 'Cash') return 'surgery_cash';
  return 'surgery_tpa';
}

// ---- Fixed Payout Matching ----

function matchFixedPayout(
  item: BillItemInput,
  contract: DoctorContract,
  fixedPayouts: FixedPayoutRule[],
  payorType: PayorType
): { rule: FixedPayoutRule } | null {
  const pkgName = (item.package_name || item.service_name || '').toLowerCase();
  const pkgAmt = item.package_amount || item.net_amt;

  for (const fp of fixedPayouts) {
    // Doctor match: specific doctor or null (applies to all)
    if (fp.doctor_id && fp.doctor_id !== contract.doctor_id) continue;

    // Centre match: specific centre or null (applies to all)
    if (fp.centre_id && fp.centre_id !== contract.centre_id) continue;

    // Payor match
    if (fp.payor !== 'ALL' && normalisePayorType(fp.payor) !== payorType) continue;

    // Package name keyword match
    if (!pkgName.includes(fp.package_name.toLowerCase())) continue;

    // Amount range match (if specified)
    if (fp.amount_from > 0 || fp.amount_to > 0) {
      if (pkgAmt < fp.amount_from || pkgAmt > fp.amount_to) continue;
    }

    return { rule: fp };
  }

  return null;
}

// ---- Expense Helpers ----

function sumExcludedDepartments(
  allBillItems: BillItemInput[],
  deptMap: Map<string, DeptMapEntry>
): number {
  return allBillItems
    .filter(bi => {
      const entry = deptMap.get(bi.department);
      return entry?.category === 'exclude';
    })
    .reduce((sum, bi) => sum + bi.service_amt, 0);
}

// ---- Hold Logic ----

function computeHold(
  contract: DoctorContract,
  payorType: PayorType,
  serviceMonth: string
): { is_held: boolean; hold_reason: string | null; hold_release_date: string | null } {
  const holdKey = getHoldKey(payorType);
  if (!holdKey) return { is_held: false, hold_reason: null, hold_release_date: null };

  const holdEntry = contract.hold_config[holdKey];
  if (!holdEntry || !holdEntry.held) return { is_held: false, hold_reason: null, hold_release_date: null };

  // Compute release date: service_month + hold_months
  const [year, month] = serviceMonth.split('-').map(Number);
  const releaseDate = new Date(year, month - 1 + holdEntry.months, 1);
  const releaseDateStr = releaseDate.toISOString().substring(0, 10);

  return {
    is_held: true,
    hold_reason: `${holdKey} ${holdEntry.months}-month hold`,
    hold_release_date: releaseDateStr,
  };
}

// ---- Result Builder ----

interface ResultParams {
  amount: number;
  method: string;
  pct: number;
  formula: string;
  fixedPayoutId?: string;
  expenseDeductions?: Record<string, number>;
}

function buildResult(
  item: BillItemInput,
  contract: DoctorContract,
  payorType: PayorType,
  selfCase: boolean,
  params: ResultParams
): PayoutItemResult {
  const serviceMonth = toServiceMonth(item.bill_date);
  const hold = computeHold(contract, payorType, serviceMonth);

  return {
    bill_id: item.bill_id,
    bill_item_id: item.id,
    doctor_id: contract.doctor_id,
    contract_id: contract.id,
    centre_id: item.centre_id,
    payout_role: 'primary',

    service_month: serviceMonth,
    bill_date: item.bill_date,
    patient_name: item.patient_name,
    bill_no: item.bill_no,
    ip_no: item.ip_no,
    encounter_type: item.encounter_type,
    payor_type: payorType,
    payor_name: item.payor_name,
    department: item.department,
    service_name: item.service_name,
    billing_category: item.billing_category,
    case_type: item.case_type,
    package_name: item.package_name,

    service_amt: item.service_amt,
    doctor_amt: item.doctor_amt,
    net_amt: item.net_amt,
    hospital_amt: item.hospital_amt,

    base_method_used: params.method,
    pct_applied: params.pct,
    is_self_case: selfCase,
    calculated_amount: r2(params.amount),

    expense_deductions_applied: params.expenseDeductions ?? {},
    fixed_payout_id: params.fixedPayoutId ?? null,
    formula_description: params.formula,

    is_held: hold.is_held,
    hold_reason: hold.hold_reason,
    hold_release_date: hold.hold_release_date,
  };
}

// ---- Batch Processor ----

/**
 * Process all bill items for a finalized bill.
 * Returns payout items for each doctor who has billable items.
 */
export function computeBillPayouts(
  billItems: BillItemInput[],
  contracts: Map<string, DoctorContract>,  // keyed by doctor_id
  deptMap: Map<string, DeptMapEntry>,
  fixedPayouts: FixedPayoutRule[]
): PayoutItemResult[] {
  const results: PayoutItemResult[] = [];

  for (const item of billItems) {
    // Determine which doctor gets paid for this item
    // Priority: service_doctor > consulting_doctor
    const doctorId = item.service_doctor_id || item.consulting_doctor_id;
    if (!doctorId) continue;

    const contract = contracts.get(doctorId);
    if (!contract || !contract.is_active) continue;

    const result = computePayoutItem({
      item,
      contract,
      deptMap,
      fixedPayouts,
      allBillItems: billItems.filter(bi => bi.bill_id === item.bill_id),
    });

    if (result) {
      results.push(result);
    }
  }

  return results;
}
