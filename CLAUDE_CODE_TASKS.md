# Health1 HMIS — Claude Code Task Cards
## Run each in a separate terminal. Each is independent and self-contained.

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
- Sidebar: `components/layout/sidebar.tsx` has grouped nav — add new pages to the appropriate group
- NEVER create placeholder/shell code — every function must hit the database or do real work
- SQL migrations go in `sql/` directory — use CREATE TABLE IF NOT EXISTS, ON CONFLICT for idempotency
- Commit with detailed message showing what changed + line counts
- Push to main branch
```

---

## TASK 1: Patient Portal (Self-Service)

```
In this Next.js 14 + Supabase HMIS repo, build a patient-facing portal.

EXISTING: There's NO existing portal. Build from scratch.

CREATE:
1. `app/(portal)/layout.tsx` — separate layout (no sidebar, clean white + teal header with H1 logo)
2. `app/(portal)/portal/page.tsx` — portal home/dashboard after OTP login
3. `app/(portal)/portal/login/page.tsx` — phone OTP login using Supabase phone auth
4. `lib/portal/portal-hooks.ts` — hooks for patient data access

FEATURES (all query Supabase with RLS — patient sees only their own data):
- **OTP Login**: Enter phone → receive OTP → verify → land on portal dashboard
- **Dashboard**: upcoming appointments, recent bills, recent lab reports
- **Appointments**: view upcoming, book new (select department → doctor → date → available slot from hmis_doctor_schedules), cancel/reschedule
- **Lab Reports**: list all from hmis_lab_orders where status='completed', click to view results (no PDF generation yet, just show results in a card)
- **Bills**: list from hmis_bills, show net/paid/balance, payment button placeholder (show "Pay ₹X" button that shows "Razorpay integration coming soon" toast for now)
- **Prescriptions**: list from hmis_emr_encounters → prescriptions array, "Request Refill" button that inserts into hmis_prescription_refill_requests (create this table)
- **Feedback**: after completed visits, show rating form (1-5 stars + text), save to hmis_patient_feedback (create this table)

SQL MIGRATION (sql/portal_migration.sql):
- hmis_prescription_refill_requests (patient_id, encounter_id, prescription_data jsonb, status, requested_at)
- hmis_patient_feedback (patient_id, visit_id, rating integer, comment text, created_at)
- RLS policies: patients can only read/write their own rows

Design: clean, mobile-first, large touch targets, teal accent. Think eka.care patient app.
DO NOT add portal to the staff sidebar — it's a separate app layout.
```

---

## TASK 2: Doctor Mobile View / Responsive EMR

```
In this HMIS repo, the EMR at app/(dashboard)/emr-v2/page.tsx (384 lines) is desktop-only with an 8-step wizard. Build a mobile-responsive companion view.

CREATE:
1. `app/(dashboard)/emr-mobile/page.tsx` — simplified mobile EMR
2. `components/emr-mobile/quick-note.tsx` — quick clinical note
3. `components/emr-mobile/vitals-input.tsx` — vitals entry optimized for touch
4. `components/emr-mobile/order-quick.tsx` — quick lab/rad/med orders

The mobile EMR should:
- Show patient banner (name, UHID, age/gender, allergies, active admission)
- Vitals: large input fields, common vitals (BP, HR, Temp, SpO2, RR) with +/- buttons
- Quick note: free text that saves to hmis_emr_encounters.progress_notes
- Quick orders: search + select from hmis_tariff_master, auto-create via CPOE hooks (lib/cpoe/cpoe-hooks.ts)
- Recent orders: show last 5 lab/rad orders with status
- Active medications: from hmis_ipd_medication_orders where status='active'
- All data saves to the SAME tables as the desktop EMR — not separate
- Navigation: bottom tab bar (Vitals | Notes | Orders | Meds | History)
- Responsive: works on 375px+ width, large buttons, swipeable

Use existing hooks: lib/cpoe/cpoe-hooks.ts for orders, lib/nursing/nursing-station-hooks.ts for vitals.
Add "Mobile EMR" to sidebar under Clinical group.
```

---

## TASK 3: Discharge Summary PDF

```
In this HMIS repo, the discharge engine at components/ipd/discharge-engine.tsx (683 lines, 11 DB calls) handles the full discharge workflow but doesn't generate a PDF.

CREATE:
1. `lib/discharge/discharge-pdf.ts` — generates structured discharge summary PDF
2. Install jspdf + jspdf-autotable: `npm install jspdf jspdf-autotable`

The PDF must include (data comes from hmis_ipd_admissions + hmis_emr_encounters + related tables):
- Hospital header: Health1 Super Speciality Hospital, Shilaj — with teal accent bar
- Patient details: Name, UHID, Age/Gender, IPD#, Admission Date, Discharge Date
- Admitting Doctor, Primary Doctor, Department
- Diagnosis: Primary + Secondary (ICD-10 codes)
- History of presenting illness
- Examination findings
- Investigation summary (lab results table)
- Treatment given (procedures, medications administered)
- Condition at discharge
- Discharge medications (table: Drug, Dose, Route, Frequency, Duration)
- Follow-up instructions + date
- Diet/activity advice
- Emergency warning signs
- Doctor signature line
- Page numbers + "Generated by Health1 HMIS"

Wire it into the discharge engine — add a "Download Discharge Summary" button that calls the PDF generator.
The discharge engine loads all this data already in its state — read the component to understand what's available.

Also add a "Print" button that opens the same content in a print-friendly window (like bill-pdf.ts does).
```

---

## TASK 4: CPOE Orders from EMR Encounter

```
In this HMIS repo, CPOE hooks exist at lib/cpoe/cpoe-hooks.ts (169 lines) and the cross-module bridge at lib/bridge/cross-module-bridge.ts auto-posts charges when orders are placed. But the EMR encounter flow (app/(dashboard)/emr-v2/page.tsx) has an "Investigations" step that only stores data locally — it doesn't actually create orders.

FIX the EMR encounter flow so that:
1. When a doctor adds investigations in the EMR (step 6: investigations), on "Save" it should:
   - Create hmis_lab_orders for each lab test (via smartPostLabCharge in bridge)
   - Create hmis_radiology_orders for each imaging study (via smartPostRadiologyCharge in bridge)
   - These orders appear in the Lab worklist and Radiology worklist immediately

2. When a doctor writes prescriptions in the EMR (step 5: Rx), on "Save" it should:
   - Create hmis_pharmacy_dispensing records (via routeCPOEOrder in bridge)
   - These appear in the Pharmacy dispensing queue

3. The existing encounter save function is in the EMR page — find `saveEncounter` and wire it to call the bridge functions.

READ these files carefully:
- app/(dashboard)/emr-v2/page.tsx (the saveEncounter function)
- lib/bridge/cross-module-bridge.ts (smartPostLabCharge, smartPostRadiologyCharge, routeCPOEOrder)
- lib/cpoe/cpoe-hooks.ts (placeOrder function)
- components/emr-v2/investigation-panel.tsx (67 lines — the UI for adding investigations)
- components/emr-v2/prescription-builder.tsx (178 lines — the Rx UI)

The encounter already stores investigations[] and prescriptions[] in state. On save, iterate through them and call the bridge functions. Don't change the UI — just wire the backend.
```

---

## TASK 5: Automated Daily Reports / Scheduled Emails

```
In this HMIS repo, there are 12 report types in lib/reports/report-engine.ts (487 lines, 51 DB calls) that run on-demand. Build automated daily email reports.

CREATE:
1. `app/api/cron/daily-report/route.ts` — Vercel Edge Function (or serverless) that:
   - Runs daily at 8 AM IST (configure via vercel.json cron)
   - Queries yesterday's data for each active centre
   - Generates a summary: Revenue (gross/net/collected), OPD count, IPD census, Lab orders, new admissions, discharges, outstanding collections
   - Sends via email using Resend (npm install resend)
   - Recipients: from hmis_report_subscriptions table

2. `sql/report_subscriptions.sql`:
   - hmis_report_subscriptions (centre_id, email, report_type, frequency: 'daily'|'weekly'|'monthly', is_active, created_at)
   - Seed with: keyaboratory@gmail.com for Shilaj centre, daily frequency

3. `vercel.json` — add cron configuration:
   ```json
   { "crons": [{ "path": "/api/cron/daily-report", "schedule": "30 2 * * *" }] }
   ```
   (2:30 UTC = 8:00 AM IST)

4. Add a "Report Subscriptions" section to the settings page (app/(dashboard)/settings/page.tsx):
   - List current subscriptions
   - Add new: select report type, enter email, select frequency
   - Toggle active/inactive

The email should be HTML formatted with teal branding, tables for data, and a link to the HMIS reports page.
Use the same Supabase queries as report-engine.ts — just run them server-side.
```

---

## TASK 6: Drug Interaction & Allergy Alerts in Prescription Builder

```
In this HMIS repo, CDSS data exists:
- lib/cdss/medications.ts (249 lines) — 50+ Indian drugs with interactions
- lib/cdss/allergies.ts (95 lines) — allergy cross-reactivity data
- lib/cdss/engine.ts (404 lines) — checkDrugInteractions(), validateDose()

But the prescription builder at components/emr-v2/prescription-builder.tsx (178 lines) does NOT call any of these.

WIRE IT:
1. Import checkDrugInteractions and validateDose from lib/cdss/engine.ts
2. Import allergy data from lib/cdss/allergies.ts
3. When a doctor adds/changes a prescription:
   - Run checkDrugInteractions() on ALL current prescriptions → show interaction warnings
   - Run validateDose() on the new drug → show dose warnings
   - Check patient allergies (passed as props) against the drug → show allergy alert
4. Display alerts INLINE in the prescription builder:
   - Red banner for critical (allergy match, severe interaction)
   - Amber banner for warnings (moderate interaction, dose borderline)
   - Each alert: icon + message + "Override" button (doctor can acknowledge and proceed)
5. Track overrides: when a doctor overrides an alert, log it to hmis_cdss_overrides (create this table in SQL migration)

The prescription builder receives `allergies: string[]` as a prop — use it.
The existing drug list in medications.ts has interaction pairs and dose ranges — use them.

Also wire the same alerts into components/emr-v2/ai-copilot.tsx which already imports from lib/cdss/ai-engine.ts — make sure the copilot's Rx review uses the same data.
```

---

## TASK 7: Insurance Pre-Auth Workflow UI

```
In this HMIS repo, NHCX integration exists:
- lib/nhcx/nhcx-client.ts (322 lines) — API client for NHA Health Claims Exchange
- lib/nhcx/fhir-bundles.ts (324 lines) — FHIR bundle builders
- Revenue cycle hooks: lib/billing/revenue-cycle-hooks.ts has useCashlessWorkflow() with submitPreAuth, updatePreAuth
- Insurance cashless component: components/billing/insurance-cashless.tsx (516 lines)

But there's no dedicated pre-auth management UI. Build one:

CREATE:
1. `app/(dashboard)/insurance/page.tsx` — full insurance management page

FEATURES:
- **Pre-Auth Dashboard**: counts by status (pending/approved/queried/rejected/expired)
- **New Pre-Auth**: select patient → select admission → select procedure from tariff → enter estimated cost → submit to insurer (via NHCX or manual)
- **Pre-Auth List**: table with filters (status, insurer, date range)
  - Each row: patient, insurer, procedure, amount, status badge, TAT
  - Click → detail view
- **Detail View**: 
  - Timeline of status changes
  - Document upload (Supabase storage) — ID proof, insurance card, investigation reports
  - Query management: when insurer sends query, log it, respond, track
  - Approval: enter approved amount, note any exclusions
  - Enhancement: request additional amount for same case
- **Claim Submission**: after discharge, convert pre-auth to claim
  - Attach discharge summary, final bill, investigation reports
  - Track claim status (submitted/under_review/settled/denied)
- **Settlement Tracking**: TDS, disallowance, net settlement amount
- **Analytics**: TAT by insurer, approval rates, top rejection reasons

SQL: Create hmis_insurance_documents (pre_auth_id, document_type, file_url, uploaded_by, uploaded_at)
Add this page to sidebar under Revenue group as "Insurance".
```

---

## TASK 8: SMS Channel for Notifications

```
In this HMIS repo, notification system exists:
- lib/notifications/whatsapp.ts (221 lines) — WhatsApp message templates
- lib/notifications/notification-dispatcher.ts (94 lines) — dispatcher

Add SMS channel:

CREATE:
1. `lib/notifications/sms.ts` — SMS sender using MSG91 API (popular Indian SMS gateway)
   - sendSMS(phone, templateId, variables): POST to MSG91 API
   - Templates: appointment_reminder, lab_ready, pharmacy_ready, discharge_summary, payment_receipt, otp
   
2. Update `lib/notifications/notification-dispatcher.ts`:
   - Add SMS as a channel alongside WhatsApp
   - Check hmis_notification_preferences for which channel(s) to use per event
   - If both WhatsApp + SMS enabled, send both
   
3. `sql/notification_preferences.sql`:
   - CREATE TABLE IF NOT EXISTS hmis_notification_preferences (centre_id, event_type varchar, whatsapp_enabled boolean DEFAULT true, sms_enabled boolean DEFAULT false, email_enabled boolean DEFAULT false, template_text text, created_at)
   - Seed with default preferences for all event types

4. Add a "Notifications" tab to settings page (app/(dashboard)/settings/page.tsx):
   - Toggle WhatsApp/SMS/Email per event type
   - Configure MSG91 API key + sender ID
   - Test send button

MSG91 API: POST https://control.msg91.com/api/v5/flow/ with authkey header
Config stored in hmis_integration_config with provider='msg91'.
```

---

## TASK 9: Digital Consent Forms

```
In this HMIS repo, build digital consent management for OT, procedures, blood transfusion, etc.

CREATE:
1. `sql/consent_migration.sql`:
   - hmis_consent_templates (id, name, category: 'surgical'|'procedure'|'transfusion'|'general'|'anesthesia', content_html text, is_active, version integer)
   - hmis_patient_consents (id, patient_id, admission_id, template_id, consent_html text, signature_data text, -- base64 PNG from canvas, witnessed_by uuid, witness_signature text, signed_at timestamp, ip_address varchar, is_valid boolean DEFAULT true, revoked_at timestamp, centre_id)
   - Seed 10 consent templates: General Consent for Treatment, Surgical Consent, Anesthesia Consent, Blood Transfusion Consent, High-Risk Procedure Consent, LAMA (Leave Against Medical Advice), Refusal of Treatment, Research/Clinical Trial Consent, Photography/Recording Consent, COVID-19 Vaccination Consent

2. `lib/consent/consent-hooks.ts`:
   - useConsentTemplates(centreId) — list templates
   - usePatientConsents(patientId) — list signed consents
   - signConsent(patientId, templateId, signatureData, witnessId, witnessSignature) — create record
   - revokeConsent(consentId, reason) — mark invalid

3. `components/consent/consent-form.tsx`:
   - Shows consent template content (rendered HTML)
   - Canvas-based signature pad (use react-signature-canvas or build with HTML Canvas)
   - Witness signature pad
   - Patient name + date auto-filled
   - "Sign & Submit" button
   - After signing → generates PDF (jspdf) with consent text + signature image

4. `components/consent/consent-list.tsx`:
   - List of signed consents for a patient
   - Status badges: signed/revoked
   - Click to view/download PDF
   - Revoke button (with reason)

5. Wire into:
   - OT detail page (app/(dashboard)/ot/[id]/page.tsx) — add "Consents" tab, pre-surgical consent required before surgery can proceed
   - IPD detail page (app/(dashboard)/ipd/[id]/page.tsx) — add "Consents" tab
   - Install: npm install react-signature-canvas (or build canvas manually)
```

---

## TASK 10: Dashboard Alerts & Clinical Escalations

```
In this HMIS repo, clinical scoring exists but isn't surfaced:
- lib/cdss/news2.ts (145 lines) — calculateNEWS2() returns score + clinical response
- lib/cdss/engine.ts (404 lines) — analyzeVitals() returns VitalAlert[]
- Nursing station: app/(dashboard)/nursing-station/page.tsx (187 lines)
- Dashboard: app/(dashboard)/page.tsx (257 lines)

Build a real-time clinical alert system:

CREATE:
1. `sql/clinical_alerts.sql`:
   - hmis_clinical_alerts (id, centre_id, patient_id, admission_id, alert_type: 'news2_high'|'critical_lab'|'vital_abnormal'|'overdue_med'|'deteriorating', severity: 'info'|'warning'|'critical'|'emergency', title varchar, description text, data jsonb, status: 'active'|'acknowledged'|'resolved', acknowledged_by uuid, acknowledged_at timestamp, resolved_by uuid, resolved_at timestamp, created_at)

2. `lib/alerts/alert-engine.ts`:
   - generateVitalAlerts(patientId, vitals) — calls calculateNEWS2(), if score >= 5 creates alert
   - generateLabAlerts(patientId, labResult) — if value outside critical range, creates alert
   - generateMedAlerts(centreId) — finds overdue medications from hmis_ipd_medication_orders
   - detectDeterioration(patientId) — compares last 3 vital sets, if trending worse, creates alert

3. `components/alerts/alert-banner.tsx`:
   - Fixed top bar that shows when there are active critical/emergency alerts
   - Red pulsing for emergency, amber for critical
   - Click to see details + acknowledge

4. `components/alerts/alert-panel.tsx`:
   - Full list of active alerts for a centre
   - Filter by severity, type, ward
   - Acknowledge button (requires staff ID)
   - Resolve button (with resolution note)

5. Wire into:
   - Dashboard (page.tsx) — show alert count in header, alert banner if any emergency
   - Nursing station — show alerts for their ward, auto-refresh every 30 seconds
   - IPD detail — show patient-specific alerts
   - When vitals are saved (nursing station hooks), run generateVitalAlerts()
   - When lab results are entered (lab hooks), run generateLabAlerts()

6. Supabase Realtime: subscribe to hmis_clinical_alerts table for live updates across all open tabs.

The alert engine should be called server-side too — create app/api/alerts/check/route.ts that can be called by a cron to scan for overdue meds and deteriorating patients.
```

---

## EXECUTION ORDER (suggested parallel batches)

**Batch 1 (no dependencies):**
- Task 3: Discharge Summary PDF
- Task 6: Drug Interaction Alerts
- Task 8: SMS Channel
- Task 9: Digital Consent Forms

**Batch 2 (after Batch 1):**
- Task 1: Patient Portal
- Task 2: Doctor Mobile EMR
- Task 4: CPOE from EMR
- Task 10: Dashboard Alerts

**Batch 3 (after Batch 2):**
- Task 5: Automated Daily Reports
- Task 7: Insurance Pre-Auth UI
