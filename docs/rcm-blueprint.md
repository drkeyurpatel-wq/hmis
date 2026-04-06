# HMIS Full Revenue Cycle Management (RCM) Blueprint
## Eliminating MedPay — Doctor Payout Engine Inside HMIS

**Version:** 1.0 | **Date:** 6 Apr 2026 | **Author:** Claude for Dr. Keyur Patel
**Scope:** Full RCM module for HMIS (Supabase `bmuupgrzbfmddjwcqlss`) absorbing all MedPay (Supabase `kffuqxylyhpwecojnuou`) functionality

---

## 1. Current State Analysis

### What MedPay Does Today (199 doctors, 119,897 billing rows)

| Component | What It Handles |
|---|---|
| **Contract Engine** | 4 contract types (FFS×177, MGM×10, Retainer×11, FFS/ot_surgeon×1), 7 base methods (A/B/C/D/na/package_pct/B_pct/bill_minus_excluded), per-payor-pool percentages (cash/TPA/PMJAY/Govt), self vs other doctor splits |
| **Payout Computation** | Per-bill-item doctor share calculation using contract rules, department inclusion/exclusion map (20 departments), expense deduction engine, OPD separate from IPD logic |
| **MGM (Min Guaranteed Money)** | Floor guarantee (₹30K–₹4.5L/mo), threshold trigger, incentive % above threshold (70–90%) |
| **Retainer** | Fixed monthly + pool-based top-up, 4 modes (fixed/billable/procedures_only/pmjay_covered) |
| **Hold Bucket** | Payor-specific hold periods (PMJAY 2mo, Govt 3mo, TPA 1mo), release on collection |
| **Fixed Payouts** | Procedure-specific flat fees (CAG ₹800, PTCA 1-stent ₹17K, ESWL ₹7K, TKR ₹20K), payor-specific, doctor-specific, amount-range matched |
| **Settlement Pipeline** | Draft → approve → lock → pay, split-cycle support (first_half/second_half/full), TDS computation (per-doctor %), override with reason, UTR/payment tracking |
| **Cashless Formula** | TPA-specific bill deconstruction (approved_amount − implants − robotic − pharmacy − anesthesia − hospital_fixed = doctor PF) |
| **Doctor Portal** | Statement view, document storage, profile management |
| **Reporting** | Payslips, audit log (439 entries), actual vs calculated comparison |

### What HMIS Already Has

| Table | Purpose | Gap |
|---|---|---|
| `hmis_bills` | Bill header (patient, payor_type, amounts, status) | Has `medpay_synced` flag — currently pushes to MedPay |
| `hmis_bill_items` | Line items with `doctor_id`, `service_doctor_id`, `consulting_doctor_id`, `referring_doctor_id`, department, billing_category | **Has all the raw data needed** — just missing the computation engine |
| `hmis_payments` | Payment receipts against bills | Tracks collections but doesn't trigger doctor payouts |
| `hmis_tariff_master` | Service catalog with multi-payor rates (self/insurance/PMJAY/CGHS) | Good foundation for rate-based computations |
| `hmis_settlements` | Insurer/TPA settlement tracking | Only tracks hospital-side settlements, not doctor payouts |
| `hmis_medpay_doctor_map` | HMIS staff ↔ MedPay doctor mapping | Bridge table — will become unnecessary |
| `hmis_package_master` | Package definitions | Needed for package-based payout logic |

### The Gap

HMIS has **100% of the billing data** but **0% of the payout logic**. Today it exports billing rows to MedPay via file uploads. The entire MedPay value is in 3 things:
1. The `contracts` table (199 rows of complex rules)
2. The payout calculation engine (base method resolution + department filtering + expense deductions + hold logic + MGM/retainer/incentive)
3. The settlement workflow (draft → approve → pay → statement)

---

## 2. Target Architecture

### Design Principles

1. **Contract-first, not formula-hardcoded** — every calculation rule stored as data in contract tables, never as code branching
2. **Real-time computation** — doctor share calculated at bill finalization, not batch-uploaded monthly
3. **Collection-aware** — hold/release logic tied to `hmis_payments` and `hmis_settlements`, not manual spreadsheet tracking
4. **Multi-centre native** — centre_overrides as first-class concept, not afterthought
5. **Audit-complete** — every payout calculation stores the formula used, inputs, and output for GT audit trail
6. **Backward-compatible** — MedPay's 119,897 historical billing rows importable for continuity

---

## 3. Schema Design — New Tables

### 3.1 Doctor Contract Tables

```sql
-- ============================================
-- TABLE: hmis_doctor_contracts
-- The heart of the system. One row per doctor per effective period.
-- Replaces MedPay's `contracts` table.
-- ============================================
CREATE TABLE hmis_doctor_contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id       uuid NOT NULL REFERENCES hmis_centres(id),
  doctor_id       uuid NOT NULL REFERENCES hmis_staff(id),
  
  -- Contract classification
  contract_type   text NOT NULL DEFAULT 'FFS'
                  CHECK (contract_type IN ('FFS','MGM','Retainer')),
  ipd_method      text NOT NULL DEFAULT 'net_pct'
                  CHECK (ipd_method IN ('net_pct','ot_surgeon','package_minus_expenses')),
  is_visiting     boolean NOT NULL DEFAULT false,
  partner_doctor_id uuid REFERENCES hmis_staff(id),
  
  -- Per-payor-pool base methods & percentages
  -- Base method: A = doctor_amt from billing
  --              B = net_amt (total bill - excluded depts)
  --              C = flat % of preauth/package amount (PMJAY)
  --              D = custom formula
  --              na = not applicable (doctor doesn't participate in this pool)
  --              package_pct = % of package amount
  --              B_pct = % of net bill
  --              bill_minus_excluded = bill total minus excluded departments
  
  cash_base_method    text DEFAULT 'A',
  cash_self_pct       numeric(6,2) DEFAULT 100,   -- when doctor is primary/self
  cash_other_pct      numeric(6,2) DEFAULT 100,   -- when doctor is service/other
  cash_b_pct          numeric(6,2),                -- used when base_method = B
  
  tpa_base_method     text DEFAULT 'A',
  tpa_self_pct        numeric(6,2) DEFAULT 100,
  tpa_other_pct       numeric(6,2) DEFAULT 100,
  tpa_b_pct           numeric(6,2),
  
  pmjay_base_method   text DEFAULT 'na',
  pmjay_pct           numeric(6,2) DEFAULT 0,      -- legacy flat % field
  pmjay_self_pct      numeric(6,2) DEFAULT 0,
  pmjay_other_pct     numeric(6,2) DEFAULT 0,
  pmjay_b_pct         numeric(6,2) DEFAULT 0,
  
  govt_base_method    text DEFAULT 'na',
  govt_self_pct       numeric(6,2) DEFAULT 100,
  govt_other_pct      numeric(6,2) DEFAULT 100,
  govt_b_pct          numeric(6,2),
  
  -- OPD percentages (separate from IPD)
  opd_non_govt_pct    numeric(6,2) DEFAULT 80,
  opd_govt_pct        numeric(6,2) DEFAULT 100,
  
  -- Ward procedure override
  ward_procedure_pct  numeric(6,2),
  
  -- MGM (Minimum Guaranteed Money)
  mgm_amount          numeric(12,2) DEFAULT 0,     -- monthly guarantee floor
  mgm_threshold       numeric(12,2) DEFAULT 0,     -- earnings above this trigger incentive
  incentive_pct       numeric(6,2) DEFAULT 0,       -- % above threshold
  
  -- Retainer
  retainer_amount     numeric(12,2) DEFAULT 0,      -- monthly fixed component
  retainer_mode       text DEFAULT 'fixed'
                      CHECK (retainer_mode IN ('fixed','billable','procedures_only','pmjay_covered')),
  retainer_pool_pct   numeric(6,2) DEFAULT 0,       -- % of pool covered by retainer
  
  -- Hospital deductions
  hospital_fixed_amount numeric(12,2) DEFAULT 0,    -- fixed amount deducted per case
  hospital_pct          numeric(6,2) DEFAULT 0,     -- % hospital keeps
  rb_hospital_fixed     numeric(12,2) DEFAULT 0,    -- robotic surgery hospital fixed
  rb_includes_robotic   boolean DEFAULT false,
  
  -- Fixed package rates (per-tier flat fees)
  fixed_pkg_basic     numeric(12,2) DEFAULT 0,
  fixed_pkg_cashless  numeric(12,2) DEFAULT 0,
  fixed_pkg_premium   numeric(12,2) DEFAULT 0,
  
  -- Expense handling
  expense_dr_pct      numeric(6,2) DEFAULT 50,      -- doctor's share of expenses
  expense_deductions  jsonb DEFAULT '[]',            -- ["Radiology","Pharmacy","Implants",...]
  
  -- Hold configuration (payor-specific hold periods)
  hold_config         jsonb DEFAULT '{}',
  -- Example: {"PMJAY": {"held": true, "months": 2}, "Govt (CGHS/ECHS)": {"held": true, "months": 3}}
  
  -- Advanced payout rules (scenario-based overrides)
  payout_rules        jsonb,
  -- Example: [{"scenario":"surgery_cash","method":"ot_surgeon","pct":100,"desc":"..."},...]
  
  -- Departments this contract covers (empty = all)
  departments         jsonb DEFAULT '[]',
  
  -- Centre-specific overrides
  centre_overrides    jsonb DEFAULT '{}',
  -- Example: {"Vastral": {"active": true}, "Shilaj": {"active": false}}
  
  -- TDS
  tds_pct             numeric(6,2) DEFAULT 10,
  
  -- Validity
  effective_from      date,
  effective_to        date,       -- NULL = currently active
  is_active           boolean NOT NULL DEFAULT true,
  
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES hmis_staff(id),
  
  -- Ensure one active contract per doctor per centre
  CONSTRAINT uq_active_contract UNIQUE (doctor_id, centre_id, effective_from)
);

CREATE INDEX idx_contracts_doctor ON hmis_doctor_contracts(doctor_id) WHERE is_active;
CREATE INDEX idx_contracts_centre ON hmis_doctor_contracts(centre_id) WHERE is_active;
```

### 3.2 Fixed Payout Rules (Procedure-specific flat fees)

```sql
CREATE TABLE hmis_fixed_payouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       uuid REFERENCES hmis_staff(id),    -- NULL = applies to all doctors of specialty
  centre_id       uuid REFERENCES hmis_centres(id),   -- NULL = all centres
  
  package_name    text NOT NULL,                       -- "PTCA 1 Stent", "CAG", "ESWL"
  payor           text NOT NULL DEFAULT 'ALL',         -- "PMJAY", "ALL", "TPA"
  specialty       text,                                -- "Cardiology", "Orthopedics"
  
  amount_from     numeric(12,2) DEFAULT 0,             -- package amount range (min)
  amount_to       numeric(12,2) DEFAULT 0,             -- package amount range (max)
  doctor_payout   numeric(12,2) NOT NULL,              -- flat fee to doctor
  
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fixed_payouts_lookup ON hmis_fixed_payouts(payor, package_name) WHERE is_active;
```

### 3.3 Department Classification Map

```sql
CREATE TABLE hmis_department_payout_map (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name text NOT NULL UNIQUE,
  category        text NOT NULL DEFAULT 'include'
                  CHECK (category IN ('include','exclude','conditional','pharmacy','health_checkup')),
  notes           text
);

-- Seed with MedPay's 20 department classifications
```

### 3.4 Doctor Payout Ledger (The Computed Results)

```sql
-- ============================================
-- TABLE: hmis_doctor_payout_items
-- One row per bill_item per doctor with computed payout.
-- This is the "billing_rows matched with contract rules" output.
-- Replaces MedPay's billing_rows + computed columns.
-- ============================================
CREATE TABLE hmis_doctor_payout_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id         uuid NOT NULL REFERENCES hmis_centres(id),
  bill_id           uuid NOT NULL REFERENCES hmis_bills(id),
  bill_item_id      uuid REFERENCES hmis_bill_items(id),
  doctor_id         uuid NOT NULL REFERENCES hmis_staff(id),
  contract_id       uuid NOT NULL REFERENCES hmis_doctor_contracts(id),
  
  -- Source data snapshot (for audit — what was the input?)
  service_month     text NOT NULL,                     -- "2026-04"
  bill_date         date,
  patient_name      text,
  bill_no           text,
  ip_no             text,
  encounter_type    text,                              -- OPD / IPD
  payor_type        text NOT NULL,                     -- Cash / TPA / PMJAY / Govt
  payor_name        text,                              -- insurer name, scheme name
  department        text,
  service_name      text,
  billing_category  text,                              -- ECONOMY-1, ICU, SUITE, etc.
  case_type         text,                              -- Hospital Case / Ref Doctor Case
  package_name      text,
  
  -- Amounts from billing
  service_amt       numeric(12,2) DEFAULT 0,           -- total service amount
  doctor_amt        numeric(12,2) DEFAULT 0,           -- doctor column from HMIS bill item
  net_amt           numeric(12,2) DEFAULT 0,           -- net after exclusions
  hospital_amt      numeric(12,2) DEFAULT 0,           -- hospital share
  
  -- Computed payout
  base_method_used  text,                              -- which method was applied (A/B/C/D/...)
  pct_applied       numeric(6,2),                      -- what percentage was used
  is_self_case      boolean DEFAULT true,              -- self or other doctor case
  calculated_amount numeric(12,2) NOT NULL DEFAULT 0,  -- the doctor's computed share
  
  -- Expense deductions applied
  expense_deductions_applied jsonb DEFAULT '{}',        -- {"Pharmacy": 1200, "Implants": 5000}
  
  -- Fixed payout match (if applicable)
  fixed_payout_id   uuid REFERENCES hmis_fixed_payouts(id),
  
  -- Formula audit trail (human-readable)
  formula_description text,
  -- Example: "Cash Self: doctor_amt(3500) × 100% = 3500"
  -- Example: "PMJAY: preauth(91400) × 20% = 18280"
  -- Example: "TPA Method B: net_bill(45000) - Pharmacy(3200) - Implants(12000) = 29800 × 70% = 20860"
  
  -- Hold status
  is_held           boolean DEFAULT false,
  hold_reason       text,                              -- "PMJAY 2-month hold"
  hold_release_date date,
  released_at       timestamptz,
  
  -- Settlement link
  settlement_id     uuid REFERENCES hmis_doctor_settlements(id),
  
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payout_items_doctor_month ON hmis_doctor_payout_items(doctor_id, service_month);
CREATE INDEX idx_payout_items_settlement ON hmis_doctor_payout_items(settlement_id);
CREATE INDEX idx_payout_items_bill ON hmis_doctor_payout_items(bill_id);
CREATE INDEX idx_payout_items_held ON hmis_doctor_payout_items(is_held, hold_release_date) WHERE is_held;
```

### 3.5 Doctor Settlements (Monthly Payout Cycles)

```sql
CREATE TABLE hmis_doctor_settlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id         uuid NOT NULL REFERENCES hmis_centres(id),
  doctor_id         uuid NOT NULL REFERENCES hmis_staff(id),
  contract_id       uuid NOT NULL REFERENCES hmis_doctor_contracts(id),
  
  -- Period
  month             text NOT NULL,                     -- "2026-04"
  cycle             text NOT NULL DEFAULT 'full'
                    CHECK (cycle IN ('full','first_half','second_half')),
  cycle_start       date,
  cycle_end         date,
  
  -- Pool breakdown
  cash_pool         numeric(12,2) DEFAULT 0,
  tpa_pool          numeric(12,2) DEFAULT 0,
  pmjay_pool        numeric(12,2) DEFAULT 0,
  govt_pool         numeric(12,2) DEFAULT 0,
  total_pool        numeric(12,2) DEFAULT 0,
  
  -- OPD separate
  opd_amount        numeric(12,2) DEFAULT 0,
  
  -- MGM / Incentive
  mgm_triggered     boolean DEFAULT false,
  mgm_topup         numeric(12,2) DEFAULT 0,          -- if pool < mgm_amount, topup = mgm_amount - pool
  incentive_triggered boolean DEFAULT false,
  incentive_amount  numeric(12,2) DEFAULT 0,           -- if pool > threshold, incentive = (pool - threshold) × incentive_pct
  
  -- Retainer
  retainer_amount   numeric(12,2) DEFAULT 0,
  
  -- Final computation
  gross_payout      numeric(12,2) DEFAULT 0,           -- total_pool + mgm_topup + incentive + retainer
  immediate_payout  numeric(12,2) DEFAULT 0,           -- released portion
  held_payout       numeric(12,2) DEFAULT 0,           -- held portion
  
  -- Deductions
  tds_pct           numeric(6,2) DEFAULT 10,
  tds_amount        numeric(12,2) DEFAULT 0,
  
  -- Adjustments (ad-hoc additions/deductions)
  adjustments       jsonb DEFAULT '[]',
  -- [{"type":"deduction","description":"Equipment rent","amount":5000},...]
  
  -- Final
  net_payout        numeric(12,2) DEFAULT 0,           -- after TDS and adjustments
  
  -- Override
  override_payout   numeric(12,2),
  override_reason   text,
  
  -- Workflow
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','computed','approved','locked','paid','disputed')),
  computed_at       timestamptz,
  approved_by       uuid REFERENCES hmis_staff(id),
  approved_at       timestamptz,
  locked            boolean DEFAULT false,
  
  -- Payment
  paid_date         date,
  paid_utr          text,
  payment_mode      text,
  
  -- Bill details snapshot
  bills             jsonb DEFAULT '[]',                -- line-item breakdown for statement
  
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_settlement UNIQUE (doctor_id, centre_id, month, cycle)
);

CREATE INDEX idx_settlements_status ON hmis_doctor_settlements(status) WHERE status != 'paid';
CREATE INDEX idx_settlements_doctor ON hmis_doctor_settlements(doctor_id, month);
```

### 3.6 Hold Bucket (Payor-specific held amounts pending collection)

```sql
CREATE TABLE hmis_doctor_hold_bucket (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id         uuid NOT NULL REFERENCES hmis_staff(id),
  centre_id         uuid NOT NULL REFERENCES hmis_centres(id),
  payout_item_id    uuid REFERENCES hmis_doctor_payout_items(id),
  
  service_month     text NOT NULL,
  patient_name      text,
  bill_no           text,
  ip_no             text,
  payor_type        text NOT NULL,
  payor_name        text,
  
  calculated_amount numeric(12,2) NOT NULL DEFAULT 0,
  
  -- Release tracking
  status            text NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','RECEIVED','RELEASED','WRITTEN_OFF')),
  expected_release  date,                              -- computed from hold_config months
  received_date     date,
  received_amount   numeric(12,2),
  released_to_settlement uuid REFERENCES hmis_doctor_settlements(id),
  released_at       timestamptz,
  
  -- Payment to doctor after release
  paid_date         date,
  paid_amount       numeric(12,2),
  utr               text,
  
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hold_bucket_pending ON hmis_doctor_hold_bucket(doctor_id, status) WHERE status = 'PENDING';
```

### 3.7 Doctor Aliases (Name matching from external systems)

```sql
CREATE TABLE hmis_doctor_aliases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid NOT NULL REFERENCES hmis_staff(id),
  alias       text NOT NULL UNIQUE,                    -- alternate name spellings
  created_at  timestamptz DEFAULT now()
);
```

### 3.8 Cashless Case Formulas (TPA-specific deconstruction)

```sql
CREATE TABLE hmis_cashless_case_formulas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id         uuid NOT NULL REFERENCES hmis_centres(id),
  bill_id           uuid NOT NULL REFERENCES hmis_bills(id),
  doctor_id         uuid NOT NULL REFERENCES hmis_staff(id),
  
  month             text NOT NULL,
  patient_name      text,
  case_type         text,
  
  total_bill        numeric(12,2) DEFAULT 0,
  approved_amount   numeric(12,2) DEFAULT 0,
  mou_discount      numeric(12,2) DEFAULT 0,
  implant_bill      numeric(12,2) DEFAULT 0,
  robotic_charge    numeric(12,2) DEFAULT 0,
  pharmacy          numeric(12,2) DEFAULT 0,
  anaesthetic_charge numeric(12,2) DEFAULT 0,
  hospital_fixed    numeric(12,2) DEFAULT 0,
  
  formula_description text,                            -- human-readable
  calculated_pf     numeric(12,2) DEFAULT 0,           -- doctor PF
  payable_amount    numeric(12,2) DEFAULT 0,
  
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

### 3.9 Payout Audit Log

```sql
CREATE TABLE hmis_payout_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES hmis_staff(id),
  action      text NOT NULL,                           -- 'contract_created', 'settlement_approved', 'hold_released', etc.
  entity      text,                                    -- 'contract', 'settlement', 'hold_bucket'
  entity_id   uuid,
  details     jsonb,                                   -- full before/after snapshot
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payout_audit_entity ON hmis_payout_audit_log(entity, entity_id);
```

---

## 4. Payout Computation Engine — Algorithm

### 4.1 Trigger Point

The payout engine fires when:
- A bill is **finalized** (status → `final`) → computes doctor share for each bill_item
- A settlement is **computed** → aggregates payout_items into monthly pools
- A collection is **received** (hmis_payments/hmis_settlements) → releases held items

### 4.2 Per-Bill-Item Computation Flow

```
INPUT: bill_item + doctor_contract + department_map

1. DEPARTMENT CHECK
   → Look up department in hmis_department_payout_map
   → If 'exclude' → skip (doctor_share = 0)
   → If 'pharmacy' → apply expense_dr_pct
   → If 'health_checkup' → separate path
   → If 'conditional' → check contract.departments array
   → If 'include' → proceed

2. PAYOR CLASSIFICATION
   → Determine pool: Cash / TPA / PMJAY / Govt
   → From hmis_bills.payor_type

3. ENCOUNTER TYPE SPLIT
   → OPD: use opd_non_govt_pct or opd_govt_pct
   → IPD: use pool-specific base method

4. BASE METHOD RESOLUTION (for IPD)
   
   Method A: doctor_amt × self_pct (or other_pct if case_type = "Ref Doctor Case")
   Method B: net_amt × b_pct
   Method C: preauth_amount × pmjay_pct (flat % of package)
   Method D: custom formula from payout_rules
   Method na: 0 (doctor not participating)
   Method package_pct: package_amount × self/other_pct
   Method B_pct: net_bill × b_pct
   Method bill_minus_excluded: total_bill - SUM(excluded_dept_amounts) × pct

5. SELF vs OTHER DETERMINATION
   → If bill_item.service_doctor_id = contract.doctor_id → self_pct
   → If bill_item.consulting_doctor_id = contract.doctor_id → self_pct
   → Else → other_pct

6. EXPENSE DEDUCTIONS (if contract.expense_deductions is not empty)
   → For each deduction category in contract.expense_deductions:
     → Sum bill_items in same bill where department matches
     → Subtract from base before applying percentage
   → OR apply expense_dr_pct to those amounts

7. HOSPITAL DEDUCTIONS
   → If hospital_fixed_amount > 0: subtract from computed amount
   → If hospital_pct > 0: computed × (1 - hospital_pct)
   → If rb_hospital_fixed > 0 and surgery is robotic: subtract

8. FIXED PAYOUT CHECK
   → Query hmis_fixed_payouts matching:
     doctor_id (or NULL), payor, package_name keyword match,
     amount_from <= package_amount <= amount_to
   → If match found: OVERRIDE computed amount with flat fee

9. PAYOUT RULES CHECK (advanced scenarios)
   → If contract.payout_rules is not null:
     → Match scenario (opd / ipd_consult / surgery_cash / surgery_tpa / pmjay / govt / cathlab)
     → Apply scenario-specific method and percentage
     → Example: surgery_tpa → use cashless_formula if exists, else package_minus_expenses

10. WARD PROCEDURE OVERRIDE
    → If department = "Ward Procedure" and ward_procedure_pct is set:
      → Use ward_procedure_pct instead of normal pool percentage

11. HOLD CHECK
    → Look up contract.hold_config for this payor_type
    → If held: create hmis_doctor_hold_bucket row, mark payout_item as is_held
    → Compute hold_release_date = service_month + hold_months

12. WRITE RESULT
    → Insert into hmis_doctor_payout_items with full audit trail:
      base_method_used, pct_applied, is_self_case, calculated_amount,
      expense_deductions_applied, formula_description
```

### 4.3 Monthly Settlement Computation

```
INPUT: doctor_id + centre_id + month + cycle

1. AGGREGATE POOLS
   → SUM(calculated_amount) from hmis_doctor_payout_items
     GROUP BY payor_type, WHERE is_held = false
   → cash_pool, tpa_pool, pmjay_pool, govt_pool
   → total_pool = sum of all

2. OPD AMOUNT
   → SUM from payout_items WHERE encounter_type = 'OPD'

3. MGM CHECK (if contract_type = 'MGM')
   → If total_pool < mgm_amount:
     → mgm_triggered = true
     → mgm_topup = mgm_amount - total_pool
   → If total_pool > mgm_threshold:
     → incentive_triggered = true
     → incentive_amount = (total_pool - mgm_threshold) × incentive_pct

4. RETAINER (if contract_type = 'Retainer')
   → Mode 'fixed': retainer_amount added regardless
   → Mode 'billable': retainer_amount is floor, pool tops up
   → Mode 'procedures_only': retainer covers OPD, procedures computed separately
   → Mode 'pmjay_covered': retainer covers PMJAY pool, other pools computed normally

5. GROSS PAYOUT
   → = total_pool + mgm_topup + incentive_amount + retainer_amount

6. IMMEDIATE vs HELD
   → immediate_payout = gross - held amounts
   → held_payout = SUM of held payout_items

7. ADJUSTMENTS
   → Apply any ad-hoc adjustments (equipment rent, prior period corrections)

8. TDS
   → tds_amount = (gross_payout - retainer if retainer is salary) × tds_pct

9. NET PAYOUT
   → = gross_payout - tds_amount + adjustments

10. GENERATE BILL BREAKDOWN
    → Serialize per-bill summary into settlement.bills JSONB
```

---

## 5. Module Architecture (HMIS Pages/Routes)

### 5.1 New Routes

| Route | Purpose |
|---|---|
| `/rcm/contracts` | Contract management — list, create, edit, version history |
| `/rcm/contracts/[id]` | Contract detail with formula simulator |
| `/rcm/fixed-payouts` | Fixed payout rules CRUD |
| `/rcm/department-map` | Department inclusion/exclusion classification |
| `/rcm/payout-items` | Real-time payout ledger — searchable by doctor/month/payor |
| `/rcm/settlements` | Settlement dashboard — draft/compute/approve/pay workflow |
| `/rcm/settlements/[id]` | Settlement detail with line-item breakdown |
| `/rcm/hold-bucket` | Held amounts dashboard with release tracking |
| `/rcm/cashless-formulas` | TPA cashless case deconstruction |
| `/rcm/doctor-portal` | Doctor-facing statement view (reuse existing portal pattern) |
| `/rcm/audit` | Full payout audit log |
| `/rcm/analytics` | Doctor-wise, department-wise, payor-wise payout analytics |

### 5.2 Integration Points

| Event | Trigger | Action |
|---|---|---|
| Bill finalized | `hmis_bills.status → 'final'` | Run payout engine for all bill_items |
| Payment received | `hmis_payments` insert | Check if held items can be released |
| Insurer settlement | `hmis_settlements` insert | Match to held payout_items, release |
| Month close | Manual / cron | Auto-compute draft settlements for all active doctors |
| Contract change | `hmis_doctor_contracts` update | Version old contract (effective_to), create new |

---

## 6. Migration Plan — MedPay → HMIS

### Phase 1: Schema + Seed Data (Sprint 1 — ~3 days)

1. Create all 9 tables above via `apply_migration`
2. Migrate `contracts` (199 rows) → `hmis_doctor_contracts` with doctor_id mapped via `hmis_medpay_doctor_map`
3. Migrate `fixed_payouts` (18 rows) → `hmis_fixed_payouts`
4. Migrate `department_map` (20 rows) → `hmis_department_payout_map`
5. Migrate `doctor_aliases` (383 rows) → `hmis_doctor_aliases`

### Phase 2: Computation Engine (Sprint 2 — ~5 days)

1. Build `lib/rcm/payout-engine.ts` — the core computation function
2. Build `lib/rcm/settlement-engine.ts` — monthly aggregation
3. Build `lib/rcm/hold-manager.ts` — hold/release logic
4. Wire to bill finalization trigger (edge function or DB trigger)
5. Unit tests: 30+ test cases covering every base method × payor combination

### Phase 3: UI (Sprint 3 — ~5 days)

1. Contract management pages
2. Settlement workflow pages
3. Hold bucket dashboard
4. Doctor portal integration
5. Payout analytics dashboard

### Phase 4: Historical Data + Validation (Sprint 4 — ~3 days)

1. Import MedPay's `billing_rows` (119,897) as historical `hmis_doctor_payout_items`
2. Import `settlements` (13) and `doctor_payslips` (15) as historical records
3. Run parallel computation: compute April 2026 payouts in both MedPay and HMIS, compare results to ₹0 variance
4. Import `hold_bucket`, `cashless_cases`, `pmjay_cases`, `govt_cases` for continuity

### Phase 5: Go-Live + MedPay Sunset (Sprint 5 — ~2 days)

1. Remove `medpay_synced` flag and sync logic from HMIS
2. Set MedPay to read-only mode
3. Redirect doctor portal to HMIS
4. Statement generation (WhatsApp/email) moved to HMIS

---

## 7. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Wrong payout computation | Parallel run (Phase 4) comparing MedPay vs HMIS for same month, ₹0 tolerance |
| Contract migration errors | Automated validation: re-compute 3 months of historical payouts using migrated contracts, compare to MedPay actuals |
| Doctor portal disruption | Keep MedPay read-only for 2 months post-migration as fallback |
| Performance (119K+ rows) | Indexed queries, monthly partitioning consideration, compute on bill finalize not batch |
| Audit trail for GT | Every payout_item stores formula_description — auditor can trace any amount to its calculation |

---

## 8. Estimated Effort

| Phase | Days | Dependencies |
|---|---|---|
| Schema + seed | 3 | None |
| Computation engine | 5 | Schema complete |
| UI pages | 5 | Engine complete |
| Historical migration + validation | 3 | Engine + UI complete |
| Go-live + sunset | 2 | Validation pass |
| **Total** | **18 working days** | **~4 sprints** |

---

## 9. What MedPay Did That HMIS Will NOT Need

| MedPay Feature | Why Not Needed in HMIS |
|---|---|
| File upload parsing (DW/SW Excel) | HMIS generates billing data natively — no file import needed |
| Doctor name fuzzy matching | HMIS has structured `doctor_id` on every bill_item |
| Alias management for name variants | Still needed for external data (PMJAY portal exports), but much simpler |
| `medpay_users` auth system | HMIS already has auth — RCM uses same roles |
| Monthly batch computation | Replaced by real-time compute-on-finalize |

---

## 10. Open Questions for Keyur

1. **Referral commission engine** — should referring doctor payouts (the 40/40/20 SSI Mantra split, 50/50 Cuvis) be computed in this same engine? The schema supports it via `referring_doctor_id` on bill_items — just need to decide if referral commissions get their own contract or a separate table.

2. **Collection-based vs billing-based trigger** — MedPay currently computes on billing. Should HMIS compute doctor share at billing but only release/settle on collection? This changes the hold logic significantly for cash cases.

3. **Multi-centre consolidation** — some doctors operate at multiple centres. Should settlements be per-centre (as in MedPay today) or offer a consolidated view?

4. **Doctor portal scope** — full self-service (view statements, download PDFs, raise disputes) or view-only initially?
