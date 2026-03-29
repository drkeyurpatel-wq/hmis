# HMIS Commercial Grade Tasks — March 29, 2026
# Priority: P0 = blocks go-live, P1 = should fix before pilot, P2 = polish

## P0 — BLOCKS LIVE PATIENT DATA

### 1. Run DAY1_RLS_CRITICAL.sql on Supabase (MANUAL — not code)
- Run sql/DAY1_RLS_CRITICAL.sql one section at a time
- Test each section with a real user login
- 22 tables: patients, opd_visits, admissions, bills, bill_items, payments,
  lab_orders, lab_results, lab_samples, radiology_orders, prescriptions,
  nursing_notes, beds, drug_master, ot_bookings, ot_rooms, pre_auth_requests,
  claims, lab_test_master, departments, insurers, module_config

### 2. Run DAY1_AUDIT_TRIGGERS.sql on Supabase (MANUAL)
- Safe to run all at once
- Creates AFTER triggers on 15 core tables
- Verify: register test patient, check hmis_audit_trail

### 3. Doctor → Department Mapping (MANUAL — need data from Keyur)
- Every doctor in hmis_staff has department_id = NULL
- Breaks: OPD filtering, billing attribution, reports
- Need: doctor name → department for all Shilaj doctors

### 4. Tariff Import (MANUAL)
- Run sql/comprehensive_tariff_2000.sql (998 services)
- Verify 10 common services match Shilaj fee schedule

---

## P1 — FIX BEFORE PILOT (Claude Code can do these)

### 5. Add RoleGuard to unguarded pages
Pages missing RoleGuard wrapping:
- app/(dashboard)/bed-management/page.tsx → module="ipd"
- app/(dashboard)/emr-v2/page.tsx → module="emr"
- app/(dashboard)/settings/tariffs/page.tsx → module="settings"
Command: Add `<RoleGuard module="X">` wrapper to each page's default export.

### 6. Input validation on core forms
Wire validatePatientForm/validatePaymentForm from lib/validation.ts:
- app/(dashboard)/opd/page.tsx — quick register form (lines ~240-250)
- app/(dashboard)/billing/page.tsx — payment collection
- app/(dashboard)/ipd/page.tsx — admission form
Currently these have basic checks but don't use the central validation library.

### 7. Loading states for pages with load:0
Add skeleton/spinner loading states to:
- ambulance, assets, blood-bank, crm, cssd, digital-consent, documents,
  emergency, equipment-lifecycle, grievances, homecare, infection-control,
  packages, physiotherapy, referrals, telemedicine, visitors, vpms
Pattern: `{loading ? <TableSkeleton /> : <actual content>}`

### 8. Error toast on DB write failures
Several hooks swallow errors silently. Pattern fix needed:
```typescript
// BEFORE: if (!error) load();
// AFTER:  if (error) { flash(error.message || 'Operation failed'); } else { load(); flash('Success'); }
```
Priority files: lib/billing/billing-hooks.ts, lib/lab/lims-hooks.ts

### 9. cursor-pointer sweep
Search all .tsx files for `<button` and `<Link` elements missing cursor-pointer.
Command: `grep -rn "<button.*className" --include="*.tsx" | grep -v cursor-pointer | wc -l`
Add cursor-pointer to all interactive elements.

### 10. Disable buttons during async operations
Find submit buttons without disabled={loading} pattern:
- All "Create", "Save", "Submit", "Post", "Collect" buttons should be:
  `disabled={loading}` + show spinner text

---

## P2 — POLISH (do after pilot starts)

### 11. Mobile responsiveness audit
Pages that need mobile fixes (375px viewport):
- billing/page.tsx — table overflows
- lab/page.tsx — 12 tabs overflow
- settings/tariffs/page.tsx — wide table
- pnl/page.tsx — charts need responsive container
Fix: Add `overflow-x-auto` to tables, make tab bars scrollable.

### 12. Empty state quality
Add helpful empty states with action buttons:
- "No patients registered yet. Register your first patient →"
- "No lab orders pending. Orders will appear when doctors create them."
Pattern: Use CheckCircle icon + descriptive text + primary action button.

### 13. Print preview
All print functions currently open a new window directly.
For commercial grade: add print preview modal with "Print" and "Download PDF" buttons.
Files: components/billing/bill-pdf.ts, lib/lab/report-templates.ts, lib/discharge/discharge-pdf.ts

### 14. Session activity logging
Track which pages users visit, how long they spend:
- lib/hooks/use-page-tracker.ts (create new)
- Log to hmis_audit_trail with action='view'
- Shows up in admin analytics

### 15. Keyboard shortcuts
Already have ⌘K command palette. Add:
- ⌘N → New patient registration
- ⌘B → New bill
- ⌘L → Lab worklist
Already partially in components/ui/keyboard-shortcuts.tsx — verify and complete.

### 16. Dark mode
DarkModeToggle exists in header but dark mode CSS is incomplete.
Either: complete dark mode implementation OR remove the toggle.

### 17. NABH compliance headers
Add NABH required fields to print outputs:
- Hospital registration number
- Patient rights notice on admission forms
- Consent attestation on all procedure forms
- Quality indicator dashboards (already exists at /quality)

### 18. ABDM integration
- Wire ABHA number verification OTP flow
- Connect HFR ID (IN2410013685) to live ABDM gateway
- NHCX sandbox registration
Files: lib/abdm/*, app/api/abdm/route.ts

---

## Architecture Notes

### Files that should NOT be modified without testing:
- lib/billing/billing-hooks.ts — core revenue engine
- lib/bridge/clinical-event-bridge.ts — EMR→Lab→Pharmacy→Billing pipeline
- lib/cdss/ — clinical decision support (NEWS2, drug interactions)
- lib/patient/patient-hooks.ts — patient registration with UHID generation

### Test after ANY change to these:
1. Register patient → OPD → EMR → Sign → Verify lab order created
2. Create bill → Add items → Collect payment → Print receipt
3. IPD admit → Ward board shows → Discharge → Final bill
