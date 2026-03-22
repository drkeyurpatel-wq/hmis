# Compliance & Data Governance

## 1. Data Security Architecture

### Row Level Security (RLS)
Every clinical and financial table in the HMIS has RLS enabled. Policies enforce that:
- **Clinical data** (patients, encounters, vitals, orders) is accessible only to authenticated staff linked to the relevant centre
- **Financial data** (bills, payments, settlements) follows the same centre-scoped access
- **Admin operations** (settings, roles, tariffs) are restricted to staff with admin/super_admin role

### Authentication
- Supabase Auth (JWT-based) with email/password for admin staff and phone OTP for clinical staff
- Session tokens are short-lived (1 hour) with automatic refresh
- All API routes validate the JWT before processing

### Encryption
- **At rest**: Supabase encrypts all data at rest using AES-256 (AWS infrastructure)
- **In transit**: All connections use TLS 1.2+. No HTTP endpoints exposed.
- **Secrets**: API keys, service role keys, and integration credentials stored as Vercel environment variables (encrypted at rest, never committed to repo)

### Audit Trail
- `hmis_audit_trail` table logs all CREATE/UPDATE/DELETE operations with:
  - Staff ID, timestamp, IP address
  - Table name, record ID
  - Old and new values (JSON diff)
- Clinical-critical operations (medication administration, discharge, consent) are logged with additional context

---

## 2. RBAC (Role-Based Access Control)

### Architecture
- `hmis_roles` — Role definitions per centre (8 standard roles seeded on onboarding)
- `hmis_role_permissions` — Granular permission matrix: `{ module: [actions] }`
- `hmis_staff_centres` — Staff-to-centre linkage (multi-centre staff supported)

### Standard Roles
| Role | Access Scope |
|------|-------------|
| Super Admin | Full system access, all centres |
| Doctor | EMR, OPD, IPD, orders (view lab/radiology/pharmacy) |
| Nurse | IPD (vitals, MAR, IO, notes), view EMR/patients |
| Receptionist | Registration, appointments, billing |
| Lab Technician | Lab orders, results, QC |
| Pharmacist | Dispensing, stock, returns |
| Radiologist | Reporting, PACS integration |
| Accountant | Billing, collections, MIS reports |

### Permission Enforcement
- **Frontend**: `RoleGuard` component wraps every page, checks `hasPermission(module, action)`
- **Backend**: Supabase RLS policies enforce the same rules at database level
- **API routes**: JWT validated + staff record checked before any mutation

---

## 3. Regulatory Compliance

### NABH (National Accreditation Board for Hospitals)
The HMIS supports NABH documentation requirements:
- **Patient rights**: Consent management (`hmis_consents`), grievance tracking (`hmis_grievances`)
- **Clinical care**: Structured EMR with chief complaints, examination, diagnosis (ICD-10), orders, prescriptions
- **Infection control**: HAI surveillance, hand hygiene audits, antibiogram (`hmis_hai_surveillance`, `hmis_hand_hygiene_audit`)
- **Quality indicators**: Configurable quality metrics (`hmis_quality_indicators`)
- **Medication safety**: CDSS with drug interactions (20 pairs), dose validation (19 rules), allergy cross-check
- **Laboratory**: QC tracking (Westgard rules), critical value alerts, TAT monitoring
- **Blood bank**: Crossmatch, component tracking, transfusion reactions
- **CSSD**: Sterilization cycle logging, BI test tracking, recall workflow, instrument lifecycle

### ABDM (Ayushman Bharat Digital Mission)
- **ABHA linking**: Patient registration supports ABHA number and address
- **HFR registration**: Health Facility Registry ID stored per centre
- **NHCX**: Insurance claim exchange API routes built (`/api/nhcx`)
- **FHIR readiness**: EMR data structured for FHIR R4 export (encounter, condition, medication, observation)

### PMJAY / Government Schemes
- **PMJAY package mapping**: Package master supports PMJAY rates
- **Pre-auth workflow**: `hmis_pre_auth_requests` for insurance pre-authorization
- **CGHS/ESI/ECHS**: Multi-rate tariff support per payor type
- **Claim tracking**: `hmis_claims` with status lifecycle

### IT Act / Data Protection
- No patient data stored in browser localStorage or cookies (only auth tokens)
- PHI (Protected Health Information) never exposed in URLs or query parameters
- Patient portal uses separate auth flow with phone OTP
- Document access logged in `hmis_portal_access_log`

---

## 4. Backup & Disaster Recovery

### Database
- Supabase provides automated daily backups with 7-day retention (Pro plan: 14-day, point-in-time)
- WAL archiving enables point-in-time recovery

### Application
- Vercel deployments are immutable — every deploy is a snapshot
- Git-based version control with full commit history
- Rollback to any previous deployment in <30 seconds via Vercel dashboard

---

## 5. Incident Response

### Clinical Safety
- `hmis_cdss_alerts` flags drug interactions and dose validation issues in real-time
- `hmis_critical_findings` escalates lab/radiology critical values
- NEWS2 scoring on nursing station with auto-flagging of deteriorating patients
- Revenue leakage detector identifies unbilled services

### System Monitoring
- Vercel provides edge function monitoring, error tracking, and performance metrics
- Supabase dashboard shows database performance, connection counts, and query patterns
- API routes return structured error responses (never raw stack traces to client)
