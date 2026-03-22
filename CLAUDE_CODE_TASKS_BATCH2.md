# Health1 HMIS — Claude Code Tasks Batch 2
## 11 Tier 2 Operational Modules + 10 Tier 3 Strategic Modules

---

## RULES (paste at top of EVERY prompt)

```
RULES FOR THIS REPO:
- Repo: drkeyurpatel-wq/hmis | Branch: main | Supabase: bmuupgrzbfmddjwcqlss (Mumbai region)
- Stack: Next.js 14 (App Router), Supabase (DB + Auth + Realtime), Tailwind CSS, recharts
- Build check: run `npx next build` before committing — ZERO errors required
- Design system: DM Sans body, Plus Jakarta Sans headings, teal-600 primary accent, emerald-600 for success/payment, rounded-2xl cards, h1-table and h1-badge-* CSS classes defined in globals.css
- Supabase client: use `createClient` from `@/lib/supabase/client` for hooks, `createBrowserClient` from `@supabase/ssr` for pages
- Auth: `useAuthStore` from `@/lib/store/auth` provides { staff, activeCentreId, hasPermission }
- RoleGuard: wrap page content in `<RoleGuard module="MODULE_NAME"><Inner /></RoleGuard>` from `@/components/ui/shared`
- Pattern: SQL in sql/, hooks in lib/MODULE/hooks.ts, page in app/(dashboard)/MODULE/page.tsx
- Sidebar: components/layout/sidebar.tsx — add new pages to the appropriate group (Clinical/Diagnostics/Revenue/Operations/Admin)
- NEVER create placeholder/shell code — every function must hit the database or do real work
- SQL: CREATE TABLE IF NOT EXISTS, proper foreign keys to hmis_centres/hmis_patients/hmis_staff/hmis_admissions
- Commit with detailed message showing what changed + line counts
- Push to main branch
```

---

## TASK 11: Biomedical Engineering / Equipment Maintenance

```
Build a biomedical engineering module for equipment AMC, preventive maintenance, and breakdown tracking.

CREATE:
1. sql/biomedical_migration.sql:
   - hmis_equipment (id, centre_id, name, category, brand, model, serial_number, location, department, purchase_date, purchase_cost, warranty_expiry, amc_vendor, amc_expiry, amc_cost, status: active/maintenance/condemned/out_of_order, last_pm_date, next_pm_date, criticality: high/medium/low, is_active)
   - hmis_equipment_maintenance (id, equipment_id, centre_id, type: preventive/breakdown/calibration/installation, reported_by, reported_at, issue_description, priority: emergency/high/medium/low, assigned_to, started_at, completed_at, resolution, parts_used jsonb, cost decimal, downtime_hours, status: open/in_progress/completed/pending_parts)
   - hmis_equipment_pm_schedule (id, equipment_id, centre_id, frequency: daily/weekly/monthly/quarterly/yearly, checklist jsonb, last_done, next_due, assigned_to)

2. lib/biomedical/biomedical-hooks.ts:
   - useEquipment(centreId) — CRUD, filter by status/department/criticality
   - useMaintenance(centreId) — open tickets, history, stats (MTBF, MTTR, uptime%)
   - usePMSchedule(centreId) — upcoming PMs, overdue PMs

3. app/(dashboard)/biomedical/page.tsx:
   - Tabs: Equipment Registry | Maintenance Log | PM Schedule | Analytics
   - KPI strip: total equipment, under maintenance, overdue PMs, avg downtime
   - Equipment table: filterable by department, status, criticality
   - Maintenance tickets: Kanban (Open→In Progress→Completed) or table
   - PM calendar: overdue in red, upcoming in amber, done in green
   - Analytics: downtime by department, MTBF/MTTR, cost trends

Add to sidebar under Operations group.
```

---

## TASK 12: Housekeeping Management

```
Build a housekeeping module for cleaning schedules, room turnover, and infection cleaning.

CREATE:
1. sql/housekeeping_migration.sql:
   - hmis_housekeeping_tasks (id, centre_id, task_type: routine/discharge/deep_clean/infection/spill/terminal, area_type: room/ward/ot/icu/common_area/toilet, area_name, room_id uuid, bed_id uuid, priority: emergency/high/routine, assigned_to uuid REFERENCES hmis_staff, requested_by uuid, requested_at, started_at, completed_at, verified_by uuid, verified_at, checklist jsonb, chemicals_used text[], status: pending/in_progress/completed/verified, notes, infection_type varchar)
   - hmis_housekeeping_schedules (id, centre_id, area_name, area_type, frequency: hourly/shift/daily/weekly, shift: morning/afternoon/night, assigned_team text[], checklist jsonb, is_active)

2. lib/housekeeping/housekeeping-hooks.ts:
   - useTasks(centreId) — today's tasks, filter by status/area/type
   - useSchedules(centreId) — recurring schedules
   - Stats: completed vs pending, avg turnaround time, overdue

3. app/(dashboard)/housekeeping/page.tsx:
   - Dashboard: tasks by status, turnaround time, overdue count
   - Task board: filterable list with quick status update
   - Discharge cleaning priority queue (auto-created when bed status → housekeeping)
   - Infection cleaning with special protocol checklist
   - Schedule management

Add to sidebar under Operations group.
```

---

## TASK 13: Linen & Laundry Management

```
Build linen tracking for soiled/clean cycle management.

CREATE:
1. sql/linen_migration.sql:
   - hmis_linen_inventory (id, centre_id, item_type: bedsheet/pillow_cover/blanket/curtain/towel/gown/drape, total_qty, in_circulation, in_laundry, damaged, ward varchar)
   - hmis_linen_exchange (id, centre_id, ward varchar, exchange_date date, exchange_type: routine/discharge/emergency, soiled_count integer, clean_received integer, damaged_count integer, exchanged_by uuid, notes)

2. lib/linen/linen-hooks.ts + app/(dashboard)/linen/page.tsx:
   - Inventory by ward, daily exchange log, shortage alerts
   - Ward-wise soiled/clean tracking

Add to sidebar under Operations group.
```

---

## TASK 14: Mortuary Management

```
Build mortuary tracking for body storage, release, documentation.

CREATE:
1. sql/mortuary_migration.sql:
   - hmis_mortuary (id, centre_id, patient_id, admission_id, death_certificate_number, cause_of_death, time_of_death, declared_by uuid, body_received_at, storage_unit varchar, embalming_done boolean, post_mortem_required boolean, post_mortem_done boolean, police_intimation boolean, released_to varchar, released_at, release_authorized_by uuid, id_proof_collected boolean, noc_from_police boolean, status: received/stored/post_mortem/released, notes)

2. lib/mortuary/mortuary-hooks.ts + app/(dashboard)/mortuary/page.tsx:
   - Current occupancy, body tracking, release checklist, documentation

Add to sidebar under Operations group.
```

---

## TASK 15: Ambulance & Transport

```
Build ambulance fleet management and patient transport.

CREATE:
1. sql/ambulance_migration.sql:
   - hmis_ambulances (id, centre_id, vehicle_number, type: als/bls/patient_transport/neonatal, driver_name, driver_phone, status: available/on_trip/maintenance, current_location, equipment_checklist jsonb, last_sanitized, is_active)
   - hmis_transport_requests (id, centre_id, request_type: emergency_pickup/inter_hospital/discharge/dialysis, patient_id, pickup_location, drop_location, ambulance_id, requested_by uuid, requested_at, dispatched_at, arrived_at, completed_at, distance_km, status: requested/dispatched/en_route/arrived/completed/cancelled, notes)

2. lib/ambulance/ambulance-hooks.ts + app/(dashboard)/ambulance/page.tsx:
   - Fleet status grid, dispatch board, trip history, response time tracking

Add to sidebar under Operations group.
```

---

## TASK 16: Visitor Management

```
Build visitor pass system with ICU visitor control.

CREATE:
1. sql/visitor_migration.sql:
   - hmis_visitor_passes (id, centre_id, patient_id, admission_id, visitor_name, visitor_phone, relation, id_proof_type, id_proof_number, photo_url, pass_type: regular/icu/nicu/emergency, valid_from, valid_until, max_visitors_at_time integer DEFAULT 2, issued_by uuid, status: active/expired/revoked, check_in_time, check_out_time, ward varchar, notes)

2. lib/visitor/visitor-hooks.ts + app/(dashboard)/visitors/page.tsx:
   - Pass issuance, active visitor board, ICU visitor slots, check-in/out tracking

Add to sidebar under Operations group.
```

---

## TASK 17: Asset Management

```
Build hospital asset tracking with depreciation.

CREATE:
1. sql/asset_migration.sql:
   - hmis_assets (id, centre_id, asset_tag varchar UNIQUE, name, category: furniture/it/medical_equipment/vehicle/building/other, department, location, purchase_date, purchase_cost, vendor, warranty_expiry, useful_life_years integer, depreciation_method: straight_line/wdv, current_book_value, salvage_value, status: in_use/in_storage/maintenance/condemned/disposed, disposed_date, disposal_value, custodian_id uuid, notes)

2. lib/assets/asset-hooks.ts + app/(dashboard)/assets/page.tsx:
   - Asset registry, depreciation schedule, audit trail, AMC tracking
   - Dashboard: total asset value, depreciation this year, assets by category

Add to sidebar under Admin group.
```

---

## TASK 18: Infection Control (HICC)

```
Build Hospital Infection Control Committee surveillance module.

CREATE:
1. sql/infection_control_migration.sql:
   - hmis_hai_surveillance (id, centre_id, patient_id, admission_id, infection_type: ssi/cauti/clabsi/vap/bsi/cdi/mrsa/other, site varchar, organism varchar, sensitivity_pattern jsonb, onset_date, culture_date, culture_result varchar, device_related boolean, device_type varchar, device_days integer, outcome: resolved/ongoing/death, reported_by uuid, status, notes)
   - hmis_antibiogram (id, centre_id, year integer, organism varchar, antibiotic varchar, samples_tested integer, sensitive_count integer, resistant_count integer, intermediate_count integer)
   - hmis_hand_hygiene_audit (id, centre_id, ward varchar, audit_date date, opportunities_observed integer, compliant integer, auditor_id uuid, notes)

2. lib/infection-control/hicc-hooks.ts + app/(dashboard)/infection-control/page.tsx:
   - HAI rates by type, device-associated infection rates
   - Antibiogram heatmap
   - Hand hygiene compliance rates by ward
   - Outbreak detection alerts

Add to sidebar under Operations group (Quality & NABH submenu or standalone).
```

---

## TASK 19: Patient Grievance System

```
Build NABH-required patient grievance/complaint tracking.

CREATE:
1. sql/grievance_migration.sql:
   - hmis_grievances (id, centre_id, patient_id, complainant_name, complainant_phone, complaint_type: clinical/billing/behavior/facility/food/delay/other, department, description text, severity: minor/major/critical, source: in_person/phone/email/online/suggestion_box, assigned_to uuid, acknowledged_at, investigated_by uuid, investigation_notes, resolution text, resolved_at, patient_satisfied boolean, escalated boolean, escalated_to uuid, status: received/acknowledged/investigating/resolved/closed/escalated, created_at)

2. lib/grievance/grievance-hooks.ts + app/(dashboard)/grievances/page.tsx:
   - Complaint registration form
   - Tracking board: received→acknowledged→investigating→resolved
   - TAT tracking (acknowledgment <24h, resolution <7 days per NABH)
   - Analytics: by type, department, TAT compliance

Add to sidebar under Admin group.
```

---

## TASK 20: Telemedicine

```
Build a telemedicine module for video consults.

CREATE:
1. sql/telemedicine_migration.sql:
   - hmis_teleconsults (id, centre_id, patient_id, doctor_id, appointment_id, scheduled_at, started_at, ended_at, duration_minutes, room_url varchar, status: scheduled/waiting/in_progress/completed/no_show/cancelled, chief_complaint, consultation_notes, prescriptions jsonb, follow_up_date, recording_url, billing_done boolean, created_at)

2. lib/telemedicine/tele-hooks.ts + app/(dashboard)/telemedicine/page.tsx:
   - Schedule teleconsult (links to appointments)
   - Waiting room: patients who've joined
   - Video call: embed Jitsi Meet or Daily.co iframe (use NEXT_PUBLIC_JITSI_DOMAIN env var, default: meet.jit.si)
   - Post-consult: notes, e-prescription, follow-up
   - Today's schedule, completed count, no-show rate

Add to sidebar under Clinical group.
```

---

## TASK 21: Document / SOP Management

```
Build NABH-required document control system.

CREATE:
1. sql/document_mgmt_migration.sql:
   - hmis_documents (id, centre_id, doc_type: policy/sop/protocol/guideline/form/manual, department, title, doc_number, version integer DEFAULT 1, content_html text, file_url text, approved_by uuid, approved_at, effective_date date, review_date date, status: draft/under_review/approved/superseded/archived, created_by uuid, tags text[], created_at)

2. lib/documents/document-hooks.ts + app/(dashboard)/documents/page.tsx:
   - Document registry with version control
   - Review due alerts
   - Department-wise document library
   - Upload/download, approval workflow

Add to sidebar under Admin group.
```

---

## EXECUTION ORDER

**Batch A (no dependencies, run in parallel):**
- Task 11: Biomedical Engineering
- Task 12: Housekeeping
- Task 13: Linen & Laundry
- Task 14: Mortuary

**Batch B (run after Batch A):**
- Task 15: Ambulance/Transport
- Task 16: Visitor Management
- Task 17: Asset Management
- Task 18: Infection Control

**Batch C (run after Batch B):**
- Task 19: Patient Grievance
- Task 20: Telemedicine
- Task 21: Document/SOP Management
