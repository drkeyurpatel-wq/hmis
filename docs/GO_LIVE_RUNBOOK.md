# Health1 HMIS — 10-Day Go-Live Runbook
## Target: Live patient data by March 30 (pilot), Full launch by April 8

---

## DAY 1 (March 30) — Database + First Test

### Step 1: Run RLS Migration (Supabase SQL Editor)
- Open: https://supabase.com/dashboard/project/bmuupgrzbfmddjwcqlss/sql
- Run `sql/DAY1_RLS_CRITICAL.sql` — ONE SECTION AT A TIME
- After each section: login as Keyur, verify data still loads
- If any page breaks → check which table's RLS is too restrictive → rollback that section

### Step 2: Run Audit Triggers (Supabase SQL Editor)
- Run `sql/DAY1_AUDIT_TRIGGERS.sql` — all at once (triggers don't break reads)
- Verify: register a test patient, check `hmis_audit_trail` for the entry

### Step 3: Create Staff Test Accounts
Run in Supabase SQL Editor (replace passwords):
```sql
-- Use the /api/staff/create endpoint from the HMIS UI instead
-- Settings → Staff → Create User
-- Create 5 accounts: 1 doctor, 1 nurse, 1 receptionist, 1 lab_tech, 1 pharmacist
```
Or use the Staff page in HMIS (Settings → Staff → Create).

### Step 4: Doctor → Department Mapping
Keyur to provide: each doctor's name → department.
Then run:
```sql
UPDATE hmis_staff SET department_id = '<dept_uuid>'
WHERE full_name = '<doctor_name>' AND staff_type IN ('doctor', 'consultant');
```

### Step 5: First End-to-End Test
1. Login as receptionist → Register patient → Get UHID
2. Login as receptionist → Create OPD visit with token
3. Login as doctor → OPD Queue → Click patient → EMR opens
4. In EMR: add complaints, diagnosis, investigation (CBC), prescription (Paracetamol)
5. Sign & Complete → verify lab order appears in Lab, pharmacy in Pharmacy
6. Login as lab_tech → Lab → Collect sample → Enter result → Mark complete
7. Login as pharmacist → Pharmacy → Dispense medications
8. Login as receptionist → Billing → Create bill → Collect payment → Print receipt
9. Verify: receipt shows "Health1 Super Speciality Hospitals", correct GSTIN

---

## DAY 2-3 (March 31 - April 1) — Data Import

### Tariffs
- Run `sql/comprehensive_tariff_2000.sql` (998 services already prepared)
- Verify in Billing: search for common services, check rates match Shilaj fee schedule
- If rates are wrong → update via Settings → Tariffs

### Drug Master
- Export current pharmacy drug list from existing software (Excel/CSV)
- Format: drug_name, generic_name, category, unit, mrp, purchase_rate, stock_qty, batch_no, expiry_date, rack_location
- Import via SQL or build a CSV import page

### Bed Configuration
- Verify bed data in Supabase: `SELECT * FROM hmis_beds WHERE centre_id = '<shilaj_uuid>'`
- Should have all wards with correct bed numbers
- If missing → add via Bed Management page

---

## DAY 4-5 (April 2-3) — Parallel Run (Shadow Mode)

### Receptionist Pilot
- 2-3 receptionists register ALL patients in HMIS alongside existing system
- Track: registration time, UHID generation, any errors
- Fix issues same day

### Doctor Pilot
- 1-2 doctors use EMR for real consultations (in addition to existing system)
- Focus on: complaint entry, prescription, investigation ordering
- Track: EMR completion time, missing drugs, missing investigations

### Lab Pilot
- Lab receives orders from EMR
- Enter results in HMIS alongside existing LIS
- Track: result entry time, missing test parameters

---

## DAY 6-7 (April 4-5) — Fix and Polish

### Based on pilot feedback:
- Add missing drugs to drug master
- Add missing tariff items
- Fix any UI issues reported by staff
- Add missing doctor schedules for appointment booking

### Configure Notifications (if MSG91 ready)
- Set MSG91 API key in Vercel env vars
- Test appointment reminder SMS
- Test lab result ready SMS

---

## DAY 8-9 (April 6-7) — IPD + Billing Full Test

### IPD Workflow
1. Admit a test patient → 5-step wizard → bed assignment
2. Doctor rounds → nursing notes → vitals → I/O chart
3. Lab orders from IPD → radiology orders
4. Daily auto-charges verify (check cron ran at 18:30 IST)
5. Discharge → summary → final bill → payment → receipt

### Billing Reconciliation
- Compare HMIS bills with existing billing system for same-day patients
- Verify: totals match, GSTIN correct, receipt numbers sequential

---

## DAY 10 (April 8) — Full Launch

### Morning Checklist
- [ ] All receptionists trained and logged in
- [ ] All OPD doctors using EMR
- [ ] Lab receiving orders from EMR
- [ ] Pharmacy dispensing from EMR prescriptions
- [ ] Billing generating real bills
- [ ] IPD admissions through HMIS
- [ ] Auto-charge cron verified
- [ ] Print headers showing Health1 branding
- [ ] Backup of existing system data taken

### Monitoring
- Watch Supabase dashboard for errors
- Check `hmis_audit_trail` for activity
- Monitor Vercel deployment logs
- Keep existing system running in parallel for 2 weeks

---

## Environment Variables (Vercel)

Required for go-live:
```
NEXT_PUBLIC_SUPABASE_URL=https://bmuupgrzbfmddjwcqlss.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
NEXT_PUBLIC_APP_URL=https://hmis-brown.vercel.app
```

Optional but recommended:
```
MSG91_AUTH_KEY=<for SMS notifications>
CRON_SECRET=<for securing cron endpoints>
MEDPAY_SUPABASE_URL=<if MedPay integration active>
MEDPAY_SERVICE_ROLE_KEY=<if MedPay integration active>
```

---

## Emergency Rollback

If HMIS causes issues during go-live:
1. Tell staff to stop using HMIS and revert to existing system
2. No patient data is lost — everything is in Supabase
3. Fix the issue, redeploy on Vercel
4. Resume when ready
