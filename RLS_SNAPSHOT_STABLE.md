# RLS Snapshot — Production State

**Last updated:** 2026-04-22 (post-Phase 1 hardening sweep)
**Production project:** `bmuupgrzbfmddjwcqlss`
**Authority:** this file is regenerated from live `pg_policies` state, not hand-edited. If production diverges from this file, production wins.

---

## Executive summary

| Metric | Value |
|---|---|
| Total `hmis_*` tables | 261 |
| Tables with RLS enabled | **261 (100%)** |
| Tables with RLS disabled | 0 |
| Tables without any policy (effectively closed) | 0 |
| Tables with at least one **strong** policy | 160 |
| Tables with at least one **weak** policy present | 128 |
| Tables hardened in Phase 1 (Apr 22, 2026) | 27 |

### Reading the numbers

- "Strong policy" = uses `hmis_get_user_centre_ids()`, `hmis_is_super_admin()`, or `has_role()`.
- "Weak policy" = uses `qual = 'true'` or `qual = '(auth.uid() IS NOT NULL)'`.
- **`160 strong + 128 weak` exceeds `261`** because some tables have BOTH a strong and a weak policy (PERMISSIVE overlap — the weaker one effectively wins). These are exactly the targets for Phase 1b.

---

## Phase 1 hardening — 27 tables moved to strong policies (Apr 22, 2026)

All 27 live as migrations in `bmuupgrzbfmddjwcqlss`. Mirror files in `sql/policies/<table>.rls.sql`.

### Group 1 — canonical centre scope (11 tables)
`hmis_controlled_substance_log`, `hmis_appointments`, `hmis_charge_log`, `hmis_consents`, `hmis_credit_notes`, `hmis_doctor_rounds`, `hmis_estimates`, `hmis_imaging_reports`, `hmis_imaging_studies`, `hmis_lab_critical_alerts`, `hmis_ipd_medication_orders`

### Group 2 — overlapping policy cleanup / append-only semantics (3 tables)
`hmis_audit_trail`, `hmis_diagnoses`, `hmis_consent_audit`

### Group 3 — join-based centre scope (8 tables, all empty pre-migration)
`hmis_icu_charts`, `hmis_icu_scores`, `hmis_io_chart` (via `admission`),
`hmis_lab_cultures`, `hmis_lab_histo_cases`, `hmis_lab_instrument_results` (via `lab_order`),
`hmis_anaesthesia_records` (via OT booking → OT room),
`hmis_discount_log` (via `bill`)

### Group 4 — business-sensitive, role-gated (5 tables)
`hmis_doctor_contracts`, `hmis_doctor_payout_items`, `hmis_doctor_hold_bucket`, `hmis_doctor_aliases`, `hmis_department_payout_map`

---

## Still weak — Phase 1b follow-on (128 tables)

Below tables still have ≥1 weak policy in production. Some also have a strong policy (PERMISSIVE overlap — weak one wins). Prioritized by clinical/PHI severity.

### 🔴 HIGH — clinical PHI / medication / monitoring

These should be next. Same canonical centre-scoped pattern applies.

- `hmis_vitals` — patient vitals
- `hmis_mar` — medication administration record
- `hmis_cpoe_orders` — physician order entry
- `hmis_cathlab_monitoring` — cath lab real-time monitoring
- `hmis_dialysis_monitoring` — dialysis session monitoring
- `hmis_surgery_notes`, `hmis_procedural_notes`, `hmis_ot_notes`, `hmis_ot_implants`, `hmis_ot_safety_checklist` — surgical record tables
- `hmis_bb_components`, `hmis_bb_crossmatch`, `hmis_bb_donations`, `hmis_bb_donors`, `hmis_bb_reactions`, `hmis_bb_requests`, `hmis_bb_transfusions` — blood bank (clinical PHI)
- `hmis_patient_allergies`, `hmis_patient_consents`, `hmis_patient_contacts`, `hmis_patient_documents`, `hmis_patient_emergency_contacts`, `hmis_patient_feedback`, `hmis_patient_insurance` — patient PHI sub-tables
- `hmis_bed_transfers`
- `hmis_incidents` — patient-safety incident reports

### 🟠 MEDIUM — money / settlements / claims periphery

- `hmis_refunds`, `hmis_settlements`, `hmis_doctor_settlements`, `hmis_fixed_payouts`, `hmis_payout_audit_log`
- `hmis_journal_lines`, `hmis_auto_charge_runs`, `hmis_billing_auto_rules`, `hmis_billing_category_map`, `hmis_cashless_case_formulas`, `hmis_govt_scheme_config`, `hmis_pmjay_packages`
- `hmis_packages`, `hmis_package_utilization`, `hmis_referral_fee_slabs`, `hmis_referring_doctors`
- `hmis_ar_entries`, `hmis_ar_followups`, `hmis_loyalty_cards`
- `hmis_insurance_documents`, `hmis_insurers`, `hmis_tpas`, `hmis_corporate_employees`, `hmis_corporates`
- `hmis_pharmacy_grn`, `hmis_pharmacy_po`, `hmis_pharmacy_returns`, `hmis_pharmacy_transfers`
- `hmis_prescription_refill_requests`
- `hmis_physio_fms`, `hmis_physio_outcomes` — clinical

### 🟡 MEDIUM — homecare (all patient-facing, same pattern)

`hmis_hc_bills`, `hmis_hc_enrollments`, `hmis_hc_equipment`, `hmis_hc_med_admin`, `hmis_hc_medications`, `hmis_hc_rates`, `hmis_hc_visits`, `hmis_hc_wound_care`

### 🟡 MEDIUM — lab reference / audit / quality

- `hmis_lab_antibiogram`, `hmis_lab_antibiotic_panels`, `hmis_lab_antibiotics`, `hmis_lab_audit_log`, `hmis_lab_culture_isolates`, `hmis_lab_ncr`, `hmis_lab_organisms`, `hmis_lab_outsourced`, `hmis_lab_profile_tests`, `hmis_lab_profiles`, `hmis_lab_qc_lots`, `hmis_lab_qc_results`, `hmis_lab_ref_ranges`, `hmis_lab_reflex_rules`, `hmis_lab_sample_log`, `hmis_lab_sensitivity`, `hmis_lab_test_master`, `hmis_lab_test_parameters`
- `hmis_cdss_overrides`, `hmis_cdss_usage`

### 🟡 MEDIUM — radiology periphery

`hmis_radiology_reports`, `hmis_radiology_rooms`, `hmis_radiology_templates`, `hmis_radiology_test_master`, `hmis_pacs_config`

### 🟢 LOW — operational / reference tables

- `hmis_appointment_slots`, `hmis_doctor_leaves`, `hmis_doctor_schedules`, `hmis_housekeeping_schedules`, `hmis_linen_exchange`
- `hmis_equipment`, `hmis_equipment_calibration`, `hmis_equipment_pm_schedule`
- `hmis_centres`, `hmis_consent_templates`, `hmis_chart_of_accounts`, `hmis_fiscal_periods`, `hmis_rooms`, `hmis_menu_master`, `hmis_module_config`, `hmis_role_permissions`, `hmis_roles`, `hmis_staff`
- `hmis_integration_bridge`, `hmis_integration_config`, `hmis_notification_log`, `hmis_notification_preferences`, `hmis_notification_templates`, `hmis_medpay_doctor_map`, `hmis_nhcx_transactions`
- `hmis_cost_centre_expenses`, `hmis_cost_centre_maps`, `hmis_cost_centres`
- `hmis_orders`
- `hmis_conversion_followups`
- `hmis_portal_access_log`, `hmis_portal_appointments`, `hmis_portal_feedback`, `hmis_portal_tokens`
- `hmis_quality_indicators`, `hmis_report_subscriptions`

---

## Canonical policy patterns (current)

All hardened policies use one of:

```sql
-- Direct centre scope (most common)
USING ((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())
WITH CHECK ((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())

-- Join-based centre scope (no centre_id on table itself)
USING (EXISTS (
  SELECT 1 FROM <parent_table> p
  WHERE p.id = <this_table>.<fk>
    AND ((p.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())
))

-- Role-gated (payout / finance tables)
USING (
  hmis_is_super_admin()
  OR ((centre_id = ANY (hmis_get_user_centre_ids())) AND has_role('accountant'))
  OR (doctor_id = get_my_staff_id())
)

-- Append-only audit semantics
-- (scoped INSERT, super-admin-only UPDATE/DELETE, scoped SELECT)
```

## Helper functions

All production-hosted in `public` schema:

- `hmis_get_user_centre_ids()` → `uuid[]` of current user's assigned centres
- `hmis_is_super_admin()` → `boolean`
- `has_role(text)` → `boolean` (true for target role OR admin OR super_admin)
- `get_my_staff_id()` → `uuid` of current user's staff row

## CRITICAL RULES (non-negotiable)

1. **NEVER apply RLS or schema changes in bulk** — one table, one test, one verify (L006).
2. Policy changes mirror into `sql/policies/<table>.rls.sql` in the same commit.
3. Production is source of truth. This file is regenerated from `pg_policies`.
4. PHI/PII must be tagged with `COMMENT ON COLUMN`.
