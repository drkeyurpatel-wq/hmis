// ============================================================
// HMIS RCM Engine — Type Definitions
// ============================================================

export type ContractType = 'FFS' | 'MGM' | 'Retainer';
export type IpdMethod = 'net_pct' | 'ot_surgeon' | 'package_minus_expenses';
export type BaseMethod = 'A' | 'B' | 'C' | 'D' | 'na' | 'package_pct' | 'B_pct' | 'bill_minus_excluded';
export type PayorType = 'Cash' | 'TPA' | 'PMJAY' | 'Govt';
export type DeptCategory = 'include' | 'exclude' | 'conditional' | 'pharmacy' | 'health_checkup';
export type RetainerMode = 'fixed' | 'billable' | 'procedures_only' | 'pmjay_covered';
export type PayoutRole = 'primary' | 'referral' | 'assistant' | 'anesthetist';
export type SettlementStatus = 'draft' | 'computed' | 'approved' | 'locked' | 'paid' | 'disputed';
export type HoldStatus = 'PENDING' | 'RELEASED' | 'WRITTEN_OFF';
export type SettlementCycle = 'full' | 'first_half' | 'second_half';

// ---- Contract (from hmis_doctor_contracts) ----

export interface PayorConfig {
  base_method: BaseMethod;
  self_pct: number;
  other_pct: number;
  b_pct: number | null;
}

export interface HoldConfigEntry {
  held: boolean;
  months: number;
}

export interface PayoutRule {
  scenario: string;        // opd, ipd_consult, surgery_cash, surgery_tpa, surgery_tpa_no_formula, pmjay, govt, cathlab
  method: string;          // net_pct, ot_surgeon, cashless_formula, package_minus_expenses, pmjay_preauth
  pct: number;
  desc: string;
  label?: string;
  expense_deductions?: string[];
}

export interface DoctorContract {
  id: string;
  centre_id: string;
  doctor_id: string;
  contract_type: ContractType;
  ipd_method: IpdMethod;
  is_visiting: boolean;
  partner_doctor_id: string | null;

  // Per-payor configs
  cash: PayorConfig;
  tpa: PayorConfig;
  pmjay: PayorConfig & { flat_pct: number };   // pmjay_pct legacy field
  govt: PayorConfig;

  // OPD
  opd_non_govt_pct: number;
  opd_govt_pct: number;

  // Ward procedure override
  ward_procedure_pct: number | null;

  // MGM
  mgm_amount: number;
  mgm_threshold: number;
  incentive_pct: number;

  // Retainer
  retainer_amount: number;
  retainer_mode: RetainerMode;
  retainer_pool_pct: number;

  // Hospital deductions
  hospital_fixed_amount: number;
  hospital_pct: number;
  rb_hospital_fixed: number;
  rb_includes_robotic: boolean;

  // Fixed package rates
  fixed_pkg_basic: number;
  fixed_pkg_cashless: number;
  fixed_pkg_premium: number;

  // Expenses
  expense_dr_pct: number;
  expense_deductions: string[];

  // Hold config
  hold_config: Record<string, HoldConfigEntry>;

  // Advanced
  payout_rules: PayoutRule[] | null;
  departments: string[];
  centre_overrides: Record<string, { active: boolean }>;

  tds_pct: number;
  is_active: boolean;
}

// ---- Bill Item (input to payout engine) ----

export interface BillItemInput {
  id: string;                        // hmis_bill_items.id
  bill_id: string;
  centre_id: string;
  bill_date: string;                 // ISO date
  bill_no: string;
  patient_name: string;
  ip_no: string | null;
  encounter_type: 'OPD' | 'IPD';
  payor_type: PayorType;
  payor_name: string | null;
  billing_category: string | null;   // ECONOMY-1, ICU, SUITE, etc.
  case_type: string;                 // 'Hospital Case' | 'Ref Doctor Case'
  package_name: string | null;
  package_amount: number;            // total package amount if applicable

  // Doctor attribution
  service_doctor_id: string | null;
  consulting_doctor_id: string | null;
  referring_doctor_id: string | null;

  // Amounts
  department: string;
  service_name: string;
  service_amt: number;
  doctor_amt: number;                // doctor column from HMIS
  net_amt: number;
  hospital_amt: number;
  quantity: number;
}

// ---- Payout Item (output from payout engine) ----

export interface PayoutItemResult {
  bill_id: string;
  bill_item_id: string;
  doctor_id: string;
  contract_id: string;
  centre_id: string;
  payout_role: PayoutRole;

  service_month: string;
  bill_date: string;
  patient_name: string;
  bill_no: string;
  ip_no: string | null;
  encounter_type: string;
  payor_type: PayorType;
  payor_name: string | null;
  department: string;
  service_name: string;
  billing_category: string | null;
  case_type: string;
  package_name: string | null;

  service_amt: number;
  doctor_amt: number;
  net_amt: number;
  hospital_amt: number;

  base_method_used: string;
  pct_applied: number;
  is_self_case: boolean;
  calculated_amount: number;

  expense_deductions_applied: Record<string, number>;
  fixed_payout_id: string | null;
  formula_description: string;

  is_held: boolean;
  hold_reason: string | null;
  hold_release_date: string | null;   // ISO date
}

// ---- Settlement computation ----

export interface SettlementInput {
  doctor_id: string;
  centre_id: string;
  contract: DoctorContract;
  month: string;                     // "2026-04"
  cycle: SettlementCycle;
  payout_items: PayoutItemResult[];
  adjustments?: { type: 'deduction' | 'addition'; description: string; amount: number }[];
}

export interface SettlementResult {
  cash_pool: number;
  tpa_pool: number;
  pmjay_pool: number;
  govt_pool: number;
  total_pool: number;
  opd_amount: number;

  mgm_triggered: boolean;
  mgm_topup: number;
  incentive_triggered: boolean;
  incentive_amount: number;
  retainer_amount: number;

  gross_payout: number;
  immediate_payout: number;
  held_payout: number;

  tds_pct: number;
  tds_amount: number;
  net_payout: number;
}

// ---- Fixed Payout rule ----

export interface FixedPayoutRule {
  id: string;
  doctor_id: string | null;
  centre_id: string | null;
  package_name: string;
  payor: string;
  specialty: string | null;
  amount_from: number;
  amount_to: number;
  doctor_payout: number;
}

// ---- Department Map entry ----

export interface DeptMapEntry {
  department_name: string;
  category: DeptCategory;
}

// ---- DB row → DoctorContract mapper ----

export function mapDbRowToContract(row: any): DoctorContract {
  return {
    id: row.id,
    centre_id: row.centre_id,
    doctor_id: row.doctor_id,
    contract_type: row.contract_type,
    ipd_method: row.ipd_method,
    is_visiting: row.is_visiting,
    partner_doctor_id: row.partner_doctor_id,

    cash: {
      base_method: row.cash_base_method ?? 'A',
      self_pct: Number(row.cash_self_pct ?? 100),
      other_pct: Number(row.cash_other_pct ?? 100),
      b_pct: row.cash_b_pct != null ? Number(row.cash_b_pct) : null,
    },
    tpa: {
      base_method: row.tpa_base_method ?? 'A',
      self_pct: Number(row.tpa_self_pct ?? 100),
      other_pct: Number(row.tpa_other_pct ?? 100),
      b_pct: row.tpa_b_pct != null ? Number(row.tpa_b_pct) : null,
    },
    pmjay: {
      base_method: row.pmjay_base_method ?? 'na',
      self_pct: Number(row.pmjay_self_pct ?? 0),
      other_pct: Number(row.pmjay_other_pct ?? 0),
      b_pct: row.pmjay_b_pct != null ? Number(row.pmjay_b_pct) : null,
      flat_pct: Number(row.pmjay_pct ?? 0),
    },
    govt: {
      base_method: row.govt_base_method ?? 'na',
      self_pct: Number(row.govt_self_pct ?? 100),
      other_pct: Number(row.govt_other_pct ?? 100),
      b_pct: row.govt_b_pct != null ? Number(row.govt_b_pct) : null,
    },

    opd_non_govt_pct: Number(row.opd_non_govt_pct ?? 80),
    opd_govt_pct: Number(row.opd_govt_pct ?? 100),
    ward_procedure_pct: row.ward_procedure_pct != null ? Number(row.ward_procedure_pct) : null,

    mgm_amount: Number(row.mgm_amount ?? 0),
    mgm_threshold: Number(row.mgm_threshold ?? 0),
    incentive_pct: Number(row.incentive_pct ?? 0),

    retainer_amount: Number(row.retainer_amount ?? 0),
    retainer_mode: row.retainer_mode ?? 'fixed',
    retainer_pool_pct: Number(row.retainer_pool_pct ?? 0),

    hospital_fixed_amount: Number(row.hospital_fixed_amount ?? 0),
    hospital_pct: Number(row.hospital_pct ?? 0),
    rb_hospital_fixed: Number(row.rb_hospital_fixed ?? 0),
    rb_includes_robotic: row.rb_includes_robotic ?? false,

    fixed_pkg_basic: Number(row.fixed_pkg_basic ?? 0),
    fixed_pkg_cashless: Number(row.fixed_pkg_cashless ?? 0),
    fixed_pkg_premium: Number(row.fixed_pkg_premium ?? 0),

    expense_dr_pct: Number(row.expense_dr_pct ?? 50),
    expense_deductions: row.expense_deductions ?? [],

    hold_config: row.hold_config ?? {},
    payout_rules: row.payout_rules ?? null,
    departments: row.departments ?? [],
    centre_overrides: row.centre_overrides ?? {},

    tds_pct: Number(row.tds_pct ?? 10),
    is_active: row.is_active ?? true,
  };
}
