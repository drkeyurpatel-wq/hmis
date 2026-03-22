# Implementation Playbook

Step-by-step guide for deploying the HMIS at a new hospital. No code changes required.

---

## Phase 1: Infrastructure Setup (Day 1)

### 1.1 Supabase Project
1. Create a new Supabase project (or use existing shared project)
2. Run `sql/REBUILD_FULL.sql` in SQL Editor (creates all 238 tables)
3. Run `sql/RUN_ALL_MIGRATIONS.sql` (adds module enhancements)
4. Note the project URL and anon/service keys

### 1.2 Vercel Deployment
1. Fork the repo to the customer's GitHub org
2. Connect to Vercel, set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` (for voice notes / CDSS)
3. Deploy — first build takes ~2 minutes

### 1.3 Custom Domain
- Point hospital's subdomain (e.g., `hmis.hospitaldomain.com`) to Vercel
- SSL is automatic via Vercel

---

## Phase 2: Hospital Configuration (Day 1-2)

### 2.1 Onboard Centre via API
```bash
curl -X POST https://your-hmis-domain.com/api/onboarding \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "hospital_name": "City Hospital",
    "short_code": "CH-001",
    "city": "Mumbai",
    "state": "Maharashtra",
    "address": "123 Main Road, Andheri",
    "phone": "+91-22-12345678",
    "email": "admin@cityhospital.com",
    "entity_type": "owned",
    "beds_licensed": 200,
    "beds_operational": 150,
    "admin_name": "Dr. Admin",
    "admin_email": "admin@cityhospital.com",
    "admin_phone": "+919876543210",
    "seed_departments": true,
    "seed_wards": true,
    "seed_roles": true,
    "seed_tariffs": true,
    "template_centre_id": "uuid-of-existing-centre"
  }'
```

This creates:
- Centre record
- Admin user (auth + staff)
- 30 standard departments
- 10 standard ward types
- 8 standard RBAC roles
- UHID/Bill/IPD number sequences
- Tariff master (copied from template)

### 2.2 Configure via Settings UI
Login as admin → Settings:

| Tab | What to configure |
|-----|------------------|
| Hospital Setup | Logo, address, GST, PAN, registration numbers |
| Departments | Add/edit/deactivate departments |
| Wards & Rooms | Create wards → rooms → beds |
| Staff | Add doctors, nurses, technicians, assign roles |
| Tariff Master | Set service rates (Self/Insurance/PMJAY/CGHS) |
| Billing Config | Bill numbering, discount rules, advance policies |
| Auto-Charge | Room charges, nursing charges, daily consumables |
| Integrations | MSG91 (SMS), WhatsApp, PACS, Lab instruments |
| Notifications | Enable/disable per event type per channel |
| Report Emails | Daily summary email recipients |

### 2.3 Create Rooms & Beds
Settings → Wards & Rooms:
1. Edit each ward to add rooms
2. Add beds to rooms (bed number, type, rate/day)
3. Beds auto-appear in bed management dashboard

---

## Phase 3: Data Migration (Day 2-3)

### 3.1 Patient Data
- Bulk import via CSV: UHID, name, DOB, phone, address, blood group
- API endpoint: `POST /api/patients/bulk` (batch upsert)
- Or enter manually as patients arrive (system generates UHIDs)

### 3.2 Staff Data
- Bulk import: name, type (doctor/nurse/tech), department, specialisation, phone, email
- Each staff member gets a login via Supabase Auth

### 3.3 Tariff Master
- Option A: Copy from template centre (via onboarding API)
- Option B: Upload CSV with service codes, names, rates
- Option C: Enter manually in Settings → Tariff Master

### 3.4 Package Master
- Enter packages via Packages module: name, inclusions, rates, LOS, doctor fees

---

## Phase 4: Go-Live Checklist (Day 3-4)

### Critical Path
- [ ] Admin can log in and see dashboard
- [ ] At least 1 doctor, 1 nurse, 1 receptionist created
- [ ] Beds showing correctly in bed management
- [ ] Patient registration → OPD visit → prescription works
- [ ] IPD admission → bed assignment → billing works
- [ ] Lab order → result entry → report works
- [ ] Pharmacy dispensing → stock deduction works
- [ ] Bill generation → payment → receipt works

### Optional but Recommended
- [ ] SMS/WhatsApp notifications tested
- [ ] Tariff master reviewed by finance team
- [ ] Auto-charge rules configured for room/nursing
- [ ] Doctor schedules set up in Appointments
- [ ] At least 1 OT room configured
- [ ] CSSD instrument sets registered
- [ ] Dietary menu items reviewed

### Training
| Role | Training Focus | Duration |
|------|---------------|----------|
| Receptionist | Registration, OPD, appointments, billing | 2 hours |
| Doctor | EMR, prescriptions, voice notes, referrals | 1 hour |
| Nurse | Nursing station, vitals, MAR, handover | 2 hours |
| Lab Tech | Orders, results, QC, critical alerts | 1 hour |
| Pharmacist | Dispensing, stock, returns | 1 hour |
| Admin | Settings, reports, revenue leakage | 1 hour |

---

## Phase 5: Ongoing Operations

### Daily
- Revenue leakage scan (auto-runs, review flagged items)
- Shift handover generation (auto from live data)
- CSSD cycle logging

### Weekly
- Package utilization review (variance analysis)
- Discharge TAT review
- Lab TAT review

### Monthly
- Tariff rate review
- Quality indicator review
- Report email subscription audit
- Staff access review

---

## Support Model

### Tier 1: Self-service
- Settings UI covers all routine configuration
- No code changes needed for departments, wards, beds, tariffs, users

### Tier 2: Configuration
- New module activation
- Integration setup (PACS, lab instruments, SMS gateway)
- Custom report templates

### Tier 3: Development
- Custom workflow modifications
- New module development
- Integration with external systems
