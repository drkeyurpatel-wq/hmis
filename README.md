# HMIS/ERP — Hospital Management Information System

Full-stack Hospital Management Information System designed for multi-centre hospital groups. Covers the complete hospital workflow from patient registration to discharge, billing to analytics, across clinical, diagnostic, financial, and operational domains.

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, TailwindCSS |
| Backend | Supabase (PostgreSQL 17, Auth, Realtime, Storage, RLS) |
| Hosting | Vercel (Edge Functions, ISR) |
| State | Zustand |
| UI | Radix UI, Lucide Icons, Recharts |

## Modules (45 routes, 238 tables)

### Clinical
| Module | Description |
|--------|-------------|
| Patient Management | Registration, UHID, demographics, merge, ABDM/ABHA linking |
| OPD | Queue management, walk-in + appointments, token system |
| Appointments | Slot-based scheduling, leave-aware, multi-doctor, waiting time |
| EMR | SOAP notes, CDSS (NEWS2, drug interactions), Smart Complaint/Exam builders |
| Voice Notes | Browser speech-to-text → AI structuring → EMR save |
| IPD | Admission, bed management, transfers, discharge workflow |
| Nursing Station | Real-time vitals, NEWS2, medication administration (MAR), I/O chart |
| Shift Handover | Auto-generated from live data — census, critical patients, pending items |
| Emergency | Triage, ER tracking, disposition |
| Referrals | Internal/external, referring doctor master, fee calculation (percentage/flat/slab), TDS |

### Procedural
| Module | Description |
|--------|-------------|
| OT | Booking, WHO checklist, anaesthesia records, implant tracking |
| Cath Lab | Structured vessel findings, hemodynamics, stent tracking, implant inventory |
| Endoscopy | Region-aware findings, biopsy/polyp tracking, scope decontamination chain |
| Dialysis | Intra-dialytic monitoring, chronic patient profiles, adequacy (URR/Kt/V) |
| Physiotherapy | Sports medicine, FMS screening, return-to-sport protocol, prevention programs |
| CSSD | Sterility expiry tracking, recall workflow, issue/return chain, autoclave master |

### Diagnostics
| Module | Description |
|--------|-------------|
| Laboratory | LIMS with QC (Westgard), culture/sensitivity, histopathology, HL7 instrument interface |
| Radiology | PACS integration (Stradus), RIS workflow, structured reporting |
| Blood Bank | Donor management, component separation, cross-match, transfusion reactions |
| Pharmacy | Dispensing, controlled substances, returns, stock transfers, auto-reorder |

### Revenue
| Module | Description |
|--------|-------------|
| Billing | Multi-payor (self/insurance/PMJAY/CGHS/ESI/corporate), charge capture, auto-billing rules |
| Packages | Multi-rate tiers, inclusion/exclusion breakdown, utilization tracking with variance analysis |
| Insurance | Pre-auth, claim submission, TPA management, TAT tracking |
| Revenue Leakage | 10-point scanner (unbilled charges, missing room, OT unbilled, package overstay) |
| Accounting | Chart of accounts, journal entries, AR aging |

### Operations
| Module | Description |
|--------|-------------|
| Dietary | 7-meal Indian hospital schedule, kitchen production planning, veg/non-veg/Jain tracking |
| Procurement | Vendor management, purchase orders, GRN, payment cycles |
| Housekeeping | Room turnover tracking, cleaning schedules |
| Linen | Linen tracking, laundry cycles |
| Infection Control | HAI surveillance, antibiogram, hand hygiene audit |
| Biomedical | Equipment maintenance, AMC tracking |
| Assets | Fixed asset register, depreciation |
| CRM | Lead management, campaigns, patient engagement |
| Visitors | Visitor pass management |
| Ambulance | Fleet tracking, trip management |
| Quality | NABH indicators, clinical audit |

## Security & Compliance

- **Row Level Security (RLS)**: All tables enforce centre-level data isolation
- **RBAC**: 8 roles (super_admin, admin, doctor, nurse, pharmacist, lab_tech, receptionist, accountant)
- **Multi-centre**: Single deployment serves multiple hospital centres with data separation
- **Audit trail**: All clinical actions logged with timestamp + user
- **ABDM/ABHA**: Integration for India's Ayushman Bharat Digital Mission
- **NHCX**: National Health Claims Exchange sandbox support

## Multi-Tenant Architecture

Each hospital centre operates as an isolated tenant:
- All clinical, billing, and operational data is scoped by `centre_id`
- RLS policies enforce data isolation at the database level
- Staff can be assigned to one or multiple centres with per-centre role permissions
- New centres are onboarded via Settings → Hospital Setup (no code changes required)
- Centre-specific configuration: departments, wards, beds, tariffs, notification preferences

## Notification System

Production-grade multi-channel notifications:
- **WhatsApp**: via Meta Business API (appointment reminders, lab results, discharge alerts)
- **SMS**: via MSG91 (DLT-registered templates, transactional route)
- **Dispatch**: Per-centre, per-event channel preferences configurable via Settings → Notifications
- **Logging**: All notification attempts logged with status, error codes, and delivery tracking

## Getting Started

```bash
# Install
npm install

# Configure
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Run database migrations
# Open Supabase SQL Editor and run: sql/RUN_ALL_MIGRATIONS.sql

# Start development server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side operations |
| `ANTHROPIC_API_KEY` | No | AI features (Voice Notes, CDSS) |
| `MSG91_AUTH_KEY` | No | SMS notifications |
| `MSG91_SENDER_ID` | No | DLT-registered sender ID |
| `WHATSAPP_API_URL` | No | WhatsApp Business API endpoint |
| `WHATSAPP_ACCESS_TOKEN` | No | WhatsApp API token |
| `MEDPAY_SUPABASE_URL` | No | MedPay integration |
| `MEDPAY_SERVICE_ROLE_KEY` | No | MedPay service key |

## License

Proprietary. All rights reserved.
