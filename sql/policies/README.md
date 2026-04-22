# `sql/policies/` — RLS Policies Per Table

One file per table. Each file contains the **current production RLS policy** for that `hmis_*` table.

## Purpose

- **Source of truth in the repo** for every RLS policy.
- Produced from live production Supabase (`bmuupgrzbfmddjwcqlss`) via `pg_policies`.
- Applied as migrations in Supabase with names `phase1_NN_harden_<table>`.

## Canonical pattern

All policies must use one of these three shapes:

**Direct centre scope (majority of tables):**
```sql
USING ((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())
WITH CHECK ((centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())
```

**Join-based centre scope (for tables without `centre_id`):**
```sql
USING (EXISTS (
  SELECT 1 FROM <parent> p
  WHERE p.id = this_table.<fk>
    AND ((p.centre_id = ANY (hmis_get_user_centre_ids())) OR hmis_is_super_admin())
))
```

**Business-sensitive tables (payout data):**
```sql
USING (
  hmis_is_super_admin()
  OR ((centre_id = ANY (hmis_get_user_centre_ids())) AND has_role('accountant'))
  OR (doctor_id = get_my_staff_id())  -- own-row access
)
```

## Forbidden policy shapes

These have been explicitly removed during the Phase 1 hardening sweep:

- `USING (true)` — "allow all authenticated"
- `USING (auth.uid() IS NOT NULL)` — same as above, different syntax
- `INSERT` policies with `WITH CHECK IS NULL` — anyone can insert any centre's row
- Policies scoped by `{public}` role (should be `{authenticated}`)
- Multiple overlapping PERMISSIVE policies where one is weaker than another

## Rule: never bulk-apply

When a policy is changed in prod:
1. Change is applied via `Supabase:apply_migration` **one table at a time**.
2. Verify with a real user session for each role who touches the table.
3. Mirror the change into the corresponding `sql/policies/<table>.rls.sql` in this repo.
4. Commit with message `security(rls): <what changed> on <table>`.

See `CLAUDE.md` Hard Rule #4 (no bulk RLS) and L006 in `LESSONS.md`.

## Helper functions used

These live in the production DB; do not re-declare them in this folder:

- `hmis_get_user_centre_ids()` — `uuid[]` of the current user's assigned centres
- `hmis_is_super_admin()` — `boolean`, true if current user has `super_admin` role in any centre
- `has_role(text)` — `boolean`, true if current user has that role OR admin OR super_admin
- `get_my_staff_id()` — `uuid` of the current user's `hmis_staff.id` row

## Phase 1 hardening history

Applied on production 2026-04-22. 27 tables moved from weak policies to canonical patterns.
See migration names `phase1_01_*` through `phase1_27_*` in the Supabase migration history.

| Group | Tables | Pattern |
|---|---|---|
| 1 — direct centre | controlled_substance_log, appointments, charge_log, consents, credit_notes, doctor_rounds, estimates, imaging_reports, imaging_studies, lab_critical_alerts, ipd_medication_orders | Direct centre scope |
| 2 — overlap cleanup | audit_trail, diagnoses, consent_audit | Direct centre + append-only variants |
| 3 — join-based | icu_charts, icu_scores, io_chart, lab_cultures, lab_histo_cases, lab_instrument_results, anaesthesia_records, discount_log | Parent-table centre scope |
| 4 — business-sensitive | doctor_contracts, doctor_payout_items, doctor_hold_bucket, doctor_aliases, department_payout_map | Role-gated (accountant / admin) |
