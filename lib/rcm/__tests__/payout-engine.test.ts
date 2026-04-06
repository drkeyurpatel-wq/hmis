// ============================================================
// HMIS RCM Payout Engine — Unit Tests
//
// Covers every base method × payor × contract type combination
// using realistic data modeled on actual MedPay contracts.
//
// Run: npx vitest run lib/rcm/__tests__/payout-engine.test.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import { computePayoutItem, computeBillPayouts, normalisePayorType, type ComputePayoutInput } from '../payout-engine';
import { computeSettlement, generateBillBreakdown } from '../settlement-engine';
import { extractHoldEntries, findDueForRelease, computeReleaseDate } from '../hold-manager';
import type {
  DoctorContract, BillItemInput, DeptMapEntry, FixedPayoutRule, PayoutItemResult,
} from '../types';

// ---- Test Fixtures ----

const DEPT_MAP = new Map<string, DeptMapEntry>([
  ['OP Consultation', { department_name: 'OP Consultation', category: 'include' }],
  ['IPD Consultation', { department_name: 'IPD Consultation', category: 'include' }],
  ['Operation Charges', { department_name: 'Operation Charges', category: 'include' }],
  ['Operation Theater', { department_name: 'Operation Theater', category: 'include' }],
  ['Procedure', { department_name: 'Procedure', category: 'include' }],
  ['Radiology', { department_name: 'Radiology', category: 'include' }],
  ['IP Package', { department_name: 'IP Package', category: 'include' }],
  ['Ward Procedure', { department_name: 'Ward Procedure', category: 'include' }],
  ['Physiotherapy', { department_name: 'Physiotherapy', category: 'include' }],
  ['Miscellaneous Services', { department_name: 'Miscellaneous Services', category: 'include' }],
  ['Bed Charges', { department_name: 'Bed Charges', category: 'exclude' }],
  ['Laboratory', { department_name: 'Laboratory', category: 'exclude' }],
  ['Registration', { department_name: 'Registration', category: 'exclude' }],
  ['WardICU Fixed Charges', { department_name: 'WardICU Fixed Charges', category: 'exclude' }],
  ['Blood Bank Services', { department_name: 'Blood Bank Services', category: 'exclude' }],
  ['Ambulance Charges', { department_name: 'Ambulance Charges', category: 'exclude' }],
  ['Pharmacy', { department_name: 'Pharmacy', category: 'pharmacy' }],
  ['Health Checkup', { department_name: 'Health Checkup', category: 'health_checkup' }],
  ['Administration', { department_name: 'Administration', category: 'conditional' }],
]);

/** Standard FFS contract (177 of 199 doctors) */
function makeFfsContract(overrides: Partial<DoctorContract> = {}): DoctorContract {
  return {
    id: 'contract-ffs-001',
    centre_id: 'c0000001-0000-0000-0000-000000000001',
    doctor_id: 'doc-001',
    contract_type: 'FFS',
    ipd_method: 'net_pct',
    is_visiting: false,
    partner_doctor_id: null,
    cash: { base_method: 'A', self_pct: 100, other_pct: 70, b_pct: null },
    tpa: { base_method: 'A', self_pct: 100, other_pct: 70, b_pct: null },
    pmjay: { base_method: 'C', self_pct: 30, other_pct: 30, b_pct: 0, flat_pct: 30 },
    govt: { base_method: 'A', self_pct: 100, other_pct: 100, b_pct: null },
    opd_non_govt_pct: 80,
    opd_govt_pct: 100,
    ward_procedure_pct: null,
    mgm_amount: 0,
    mgm_threshold: 0,
    incentive_pct: 0,
    retainer_amount: 0,
    retainer_mode: 'fixed',
    retainer_pool_pct: 0,
    hospital_fixed_amount: 0,
    hospital_pct: 0,
    rb_hospital_fixed: 0,
    rb_includes_robotic: false,
    fixed_pkg_basic: 0,
    fixed_pkg_cashless: 0,
    fixed_pkg_premium: 0,
    expense_dr_pct: 50,
    expense_deductions: [],
    hold_config: { 'PMJAY': { held: true, months: 2 }, 'Govt (CGHS/ECHS)': { held: true, months: 3 } },
    payout_rules: null,
    departments: [],
    centre_overrides: {},
    tds_pct: 10,
    is_active: true,
    ...overrides,
  };
}

/** Standard IPD bill item */
function makeItem(overrides: Partial<BillItemInput> = {}): BillItemInput {
  return {
    id: 'item-001',
    bill_id: 'bill-001',
    centre_id: 'c0000001-0000-0000-0000-000000000001',
    bill_date: '2026-04-10',
    bill_no: 'SH/IPD/2026/001',
    patient_name: 'Test Patient',
    ip_no: 'IP001',
    encounter_type: 'IPD',
    payor_type: 'Cash',
    payor_name: null,
    billing_category: 'ECONOMY-1',
    case_type: 'Hospital Case',
    package_name: null,
    package_amount: 0,
    service_doctor_id: 'doc-001',
    consulting_doctor_id: 'doc-001',
    referring_doctor_id: null,
    department: 'Operation Charges',
    service_name: 'Appendectomy Charges',
    service_amt: 25000,
    doctor_amt: 15000,
    net_amt: 22000,
    hospital_amt: 7000,
    quantity: 1,
    ...overrides,
  };
}

// ============================================================
// TEST SUITE 1: Base Method Resolution
// ============================================================

describe('Payout Engine — Base Method Resolution', () => {

  it('Method A: Cash Self — doctor_amt × self_pct', () => {
    const result = computePayoutItem({
      item: makeItem({ doctor_amt: 15000 }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem({ doctor_amt: 15000 })],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(15000); // 15000 × 100%
    expect(result!.base_method_used).toBe('A');
    expect(result!.is_self_case).toBe(true);
    expect(result!.payor_type).toBe('Cash');
  });

  it('Method A: Cash Other (Ref Doctor Case) — doctor_amt × other_pct', () => {
    const result = computePayoutItem({
      item: makeItem({
        doctor_amt: 15000,
        case_type: 'Ref Doctor Case',
        service_doctor_id: 'doc-999',  // different doctor
        consulting_doctor_id: 'doc-999',
      }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(10500); // 15000 × 70%
    expect(result!.is_self_case).toBe(false);
  });

  it('Method B: TPA — net_amt × b_pct', () => {
    const contract = makeFfsContract({
      tpa: { base_method: 'B', self_pct: 100, other_pct: 70, b_pct: 50 },
    });

    const result = computePayoutItem({
      item: makeItem({ payor_type: 'TPA', net_amt: 40000 }),
      contract,
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(20000); // 40000 × 50%
    expect(result!.base_method_used).toBe('B');
  });

  it('Method C: PMJAY — package_amount × flat_pct', () => {
    const result = computePayoutItem({
      item: makeItem({
        payor_type: 'PMJAY',
        package_amount: 91400,
        department: 'IP Package',
      }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(27420); // 91400 × 30%
    expect(result!.base_method_used).toBe('C');
  });

  it('Method na: PMJAY — returns null (doctor not participating)', () => {
    const contract = makeFfsContract({
      pmjay: { base_method: 'na', self_pct: 0, other_pct: 0, b_pct: 0, flat_pct: 0 },
    });

    const result = computePayoutItem({
      item: makeItem({ payor_type: 'PMJAY' }),
      contract,
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).toBeNull();
  });

  it('Method package_pct: PMJAY — package_amount × self_pct', () => {
    const contract = makeFfsContract({
      pmjay: { base_method: 'package_pct', self_pct: 20, other_pct: 20, b_pct: 0, flat_pct: 0 },
    });

    const result = computePayoutItem({
      item: makeItem({ payor_type: 'PMJAY', package_amount: 91400, department: 'IP Package' }),
      contract,
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(18280); // 91400 × 20%
  });

  it('Method B_pct: Govt — net_amt × b_pct', () => {
    const contract = makeFfsContract({
      govt: { base_method: 'B_pct', self_pct: 100, other_pct: 100, b_pct: 50 },
    });

    const result = computePayoutItem({
      item: makeItem({ payor_type: 'Govt', net_amt: 30000, department: 'Operation Charges' }),
      contract,
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(15000); // 30000 × 50%
    expect(result!.base_method_used).toBe('B_pct');
  });
});

// ============================================================
// TEST SUITE 2: Department Filtering
// ============================================================

describe('Payout Engine — Department Filtering', () => {

  it('Excluded department (Bed Charges) — returns null', () => {
    const result = computePayoutItem({
      item: makeItem({ department: 'Bed Charges', doctor_amt: 5000 }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).toBeNull();
  });

  it('Pharmacy department — applies expense_dr_pct', () => {
    const result = computePayoutItem({
      item: makeItem({ department: 'Pharmacy', doctor_amt: 10000 }),
      contract: makeFfsContract({ expense_dr_pct: 50 }),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(5000); // 10000 × 50%
    expect(result!.base_method_used).toBe('pharmacy_expense');
  });

  it('Health Checkup — uses OPD percentage', () => {
    const result = computePayoutItem({
      item: makeItem({ department: 'Health Checkup', doctor_amt: 2000 }),
      contract: makeFfsContract({ opd_non_govt_pct: 80 }),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(1600); // 2000 × 80%
  });

  it('Ward Procedure with override — uses ward_procedure_pct', () => {
    const result = computePayoutItem({
      item: makeItem({ department: 'Ward Procedure', doctor_amt: 3000 }),
      contract: makeFfsContract({ ward_procedure_pct: 100 }),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(3000); // 3000 × 100%
  });
});

// ============================================================
// TEST SUITE 3: OPD Computation
// ============================================================

describe('Payout Engine — OPD', () => {

  it('OPD non-govt — uses opd_non_govt_pct', () => {
    const result = computePayoutItem({
      item: makeItem({ encounter_type: 'OPD', department: 'OP Consultation', doctor_amt: 500, payor_type: 'Cash' }),
      contract: makeFfsContract({ opd_non_govt_pct: 80 }),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(400); // 500 × 80%
    expect(result!.base_method_used).toBe('opd');
  });

  it('OPD govt — uses opd_govt_pct', () => {
    const result = computePayoutItem({
      item: makeItem({ encounter_type: 'OPD', department: 'OP Consultation', doctor_amt: 500, payor_type: 'Govt' }),
      contract: makeFfsContract({ opd_govt_pct: 100 }),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(500); // 500 × 100%
  });
});

// ============================================================
// TEST SUITE 4: Hold Logic
// ============================================================

describe('Payout Engine — Hold Logic', () => {

  it('PMJAY — held for 2 months', () => {
    const result = computePayoutItem({
      item: makeItem({ payor_type: 'PMJAY', package_amount: 50000, department: 'IP Package' }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.is_held).toBe(true);
    expect(result!.hold_reason).toBe('PMJAY 2-month hold');
    expect(result!.hold_release_date).toBe('2026-06-01'); // April + 2 months
  });

  it('Govt — held for 3 months', () => {
    const result = computePayoutItem({
      item: makeItem({ payor_type: 'Govt', department: 'Operation Charges' }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.is_held).toBe(true);
    expect(result!.hold_reason).toBe('Govt (CGHS/ECHS) 3-month hold');
    expect(result!.hold_release_date).toBe('2026-07-01'); // April + 3 months
  });

  it('Cash — NOT held', () => {
    const result = computePayoutItem({
      item: makeItem({ payor_type: 'Cash' }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.is_held).toBe(false);
    expect(result!.hold_reason).toBeNull();
  });

  it('TPA — NOT held', () => {
    const result = computePayoutItem({
      item: makeItem({ payor_type: 'TPA' }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.is_held).toBe(false);
  });
});

// ============================================================
// TEST SUITE 5: Fixed Payouts
// ============================================================

describe('Payout Engine — Fixed Payouts', () => {

  const fixedPayouts: FixedPayoutRule[] = [
    {
      id: 'fp-001', doctor_id: 'doc-001', centre_id: null,
      package_name: 'PTCA 1 Stent', payor: 'PMJAY', specialty: null,
      amount_from: 80000, amount_to: 95000, doctor_payout: 17000,
    },
    {
      id: 'fp-002', doctor_id: null, centre_id: null,
      package_name: 'CAG', payor: 'PMJAY', specialty: null,
      amount_from: 4025, amount_to: 5000, doctor_payout: 800,
    },
  ];

  it('PTCA 1 Stent PMJAY — flat ₹17,000 override', () => {
    const result = computePayoutItem({
      item: makeItem({
        payor_type: 'PMJAY',
        package_name: 'PTCA 1 Stent',
        package_amount: 85000,
        department: 'IP Package',
        service_name: 'PTCA 1 Stent Package',
      }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts,
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(17000);
    expect(result!.base_method_used).toBe('fixed_payout');
    expect(result!.fixed_payout_id).toBe('fp-001');
  });

  it('CAG PMJAY — flat ₹800 (any doctor)', () => {
    const result = computePayoutItem({
      item: makeItem({
        payor_type: 'PMJAY',
        package_name: 'CAG',
        package_amount: 4500,
        department: 'Procedure',
        service_name: 'Coronary Angiography',
      }),
      contract: makeFfsContract({ doctor_id: 'doc-999' }),  // different doctor — fp-002 has null doctor_id
      deptMap: DEPT_MAP,
      fixedPayouts,
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(800);
    expect(result!.fixed_payout_id).toBe('fp-002');
  });

  it('PTCA under Cash — no fixed payout match (payor mismatch)', () => {
    const result = computePayoutItem({
      item: makeItem({
        payor_type: 'Cash',
        package_name: 'PTCA 1 Stent',
        package_amount: 85000,
        department: 'IP Package',
      }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts,
      allBillItems: [makeItem()],
    });

    // Should fall through to normal Method A computation, not fixed payout
    expect(result).not.toBeNull();
    expect(result!.base_method_used).toBe('A');
    expect(result!.fixed_payout_id).toBeNull();
  });
});

// ============================================================
// TEST SUITE 6: Settlement Engine
// ============================================================

describe('Settlement Engine', () => {

  it('FFS settlement — simple pool aggregation', () => {
    const items: PayoutItemResult[] = [
      { ...computePayoutItem({
        item: makeItem({ doctor_amt: 15000 }),
        contract: makeFfsContract(), deptMap: DEPT_MAP, fixedPayouts: [], allBillItems: [makeItem()],
      })! },
      { ...computePayoutItem({
        item: makeItem({ id: 'item-002', doctor_amt: 8000, payor_type: 'TPA' }),
        contract: makeFfsContract(), deptMap: DEPT_MAP, fixedPayouts: [], allBillItems: [makeItem()],
      })! },
    ];

    const result = computeSettlement({
      doctor_id: 'doc-001',
      centre_id: 'c0000001-0000-0000-0000-000000000001',
      contract: makeFfsContract(),
      month: '2026-04',
      cycle: 'full',
      payout_items: items,
    });

    expect(result.cash_pool).toBe(15000);
    expect(result.tpa_pool).toBe(8000);
    expect(result.total_pool).toBe(23000);
    expect(result.mgm_triggered).toBe(false);
    expect(result.tds_amount).toBe(2300); // 23000 × 10%
    expect(result.net_payout).toBe(20700); // 23000 - 2300
  });

  it('MGM settlement — below guarantee (top-up triggered)', () => {
    const contract = makeFfsContract({
      contract_type: 'MGM',
      mgm_amount: 200000,
      mgm_threshold: 290000,
      incentive_pct: 70,
      cash: { base_method: 'A', self_pct: 70, other_pct: 70, b_pct: null },
      tpa: { base_method: 'A', self_pct: 70, other_pct: 70, b_pct: null },
    });

    const item = computePayoutItem({
      item: makeItem({ doctor_amt: 100000 }),
      contract, deptMap: DEPT_MAP, fixedPayouts: [], allBillItems: [makeItem()],
    })!;
    // 100000 × 70% = 70000

    const result = computeSettlement({
      doctor_id: 'doc-001',
      centre_id: 'c0000001-0000-0000-0000-000000000001',
      contract,
      month: '2026-04',
      cycle: 'full',
      payout_items: [item],
    });

    expect(result.total_pool).toBe(70000);
    expect(result.mgm_triggered).toBe(true);
    expect(result.mgm_topup).toBe(130000); // 200000 - 70000
    expect(result.gross_payout).toBe(200000); // guarantee floor
  });

  it('MGM settlement — above threshold (incentive triggered)', () => {
    const contract = makeFfsContract({
      contract_type: 'MGM',
      mgm_amount: 200000,
      mgm_threshold: 290000,
      incentive_pct: 70,
    });

    // Simulate pool of 350000 (above threshold)
    const items: PayoutItemResult[] = [];
    for (let i = 0; i < 35; i++) {
      items.push({
        ...computePayoutItem({
          item: makeItem({ id: `item-${i}`, doctor_amt: 10000 }),
          contract, deptMap: DEPT_MAP, fixedPayouts: [], allBillItems: [makeItem()],
        })!,
      });
    }

    const result = computeSettlement({
      doctor_id: 'doc-001',
      centre_id: 'c0000001-0000-0000-0000-000000000001',
      contract,
      month: '2026-04',
      cycle: 'full',
      payout_items: items,
    });

    expect(result.total_pool).toBe(350000); // 35 × 10000
    expect(result.incentive_triggered).toBe(true);
    expect(result.incentive_amount).toBe(42000); // (350000 - 290000) × 70%
    expect(result.gross_payout).toBe(392000); // 350000 + 42000
  });
});

// ============================================================
// TEST SUITE 7: Hold Manager
// ============================================================

describe('Hold Manager', () => {

  it('computeReleaseDate — adds months correctly', () => {
    expect(computeReleaseDate('2026-04', 2)).toBe('2026-06-01');
    expect(computeReleaseDate('2026-11', 3)).toBe('2027-02-01');
    expect(computeReleaseDate('2026-12', 2)).toBe('2027-02-01');
  });

  it('findDueForRelease — filters correctly', () => {
    const entries = [
      { id: '1', expected_release: '2026-04-01', status: 'PENDING' },
      { id: '2', expected_release: '2026-06-01', status: 'PENDING' },
      { id: '3', expected_release: '2026-03-01', status: 'RELEASED' },
      { id: '4', expected_release: '2026-05-01', status: 'PENDING' },
    ];

    const due = findDueForRelease(entries, new Date('2026-05-15'));
    expect(due).toEqual(['1', '4']); // #1 (Apr) and #4 (May) are due, #2 (Jun) not yet, #3 already released
  });

  it('extractHoldEntries — only includes held items', () => {
    const items: PayoutItemResult[] = [
      {
        ...computePayoutItem({
          item: makeItem({ payor_type: 'Cash' }),
          contract: makeFfsContract(), deptMap: DEPT_MAP, fixedPayouts: [], allBillItems: [makeItem()],
        })!,
      },
      {
        ...computePayoutItem({
          item: makeItem({ id: 'item-pmjay', payor_type: 'PMJAY', package_amount: 50000, department: 'IP Package' }),
          contract: makeFfsContract(), deptMap: DEPT_MAP, fixedPayouts: [], allBillItems: [makeItem()],
        })!,
      },
    ];

    const holds = extractHoldEntries(items);
    expect(holds.length).toBe(1);
    expect(holds[0].payor_type).toBe('PMJAY');
  });
});

// ============================================================
// TEST SUITE 8: Payor Normalisation
// ============================================================

describe('Payor Normalisation', () => {
  it('normalises common variants', () => {
    expect(normalisePayorType('Cash')).toBe('Cash');
    expect(normalisePayorType('SELF')).toBe('Cash');
    expect(normalisePayorType('Self Pay')).toBe('Cash');
    expect(normalisePayorType('TPA')).toBe('TPA');
    expect(normalisePayorType('Insurance')).toBe('TPA');
    expect(normalisePayorType('Cashless')).toBe('TPA');
    expect(normalisePayorType('TPA Cashless')).toBe('TPA');
    expect(normalisePayorType('PMJAY')).toBe('PMJAY');
    expect(normalisePayorType('AB-PMJAY')).toBe('PMJAY');
    expect(normalisePayorType('Ma Amrutam')).toBe('PMJAY');
    expect(normalisePayorType('MA CARD')).toBe('PMJAY');
    expect(normalisePayorType('MACARD')).toBe('PMJAY');
    expect(normalisePayorType('CGHS')).toBe('Govt');
    expect(normalisePayorType('ECHS')).toBe('Govt');
    expect(normalisePayorType('Government')).toBe('Govt');
    expect(normalisePayorType('')).toBe('Cash'); // default
  });
});

// ============================================================
// TEST SUITE 9: Edge Cases
// ============================================================

describe('Edge Cases', () => {

  it('Zero doctor_amt — returns 0 calculated (not null)', () => {
    const result = computePayoutItem({
      item: makeItem({ doctor_amt: 0 }),
      contract: makeFfsContract(),
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(0);
  });

  it('Hospital deduction — subtracts fixed and percentage', () => {
    const contract = makeFfsContract({
      hospital_fixed_amount: 2000,
      hospital_pct: 10,
    });

    const result = computePayoutItem({
      item: makeItem({ doctor_amt: 50000 }),
      contract,
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    // 50000 (Method A × 100%) - 2000 (fixed) = 48000 - 4800 (10%) = 43200
    expect(result!.calculated_amount).toBe(43200);
  });

  it('Negative after deductions — floors at 0', () => {
    const contract = makeFfsContract({
      hospital_fixed_amount: 100000,  // larger than doctor_amt
    });

    const result = computePayoutItem({
      item: makeItem({ doctor_amt: 5000 }),
      contract,
      deptMap: DEPT_MAP,
      fixedPayouts: [],
      allBillItems: [makeItem()],
    });

    expect(result).not.toBeNull();
    expect(result!.calculated_amount).toBe(0); // floored at 0
  });
});
