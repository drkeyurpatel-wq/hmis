# Health1 HMIS/ERP

Full Hospital Management Information System for Health1 Super Speciality Hospitals.

## Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Hosting**: Vercel
- **State**: Zustand
- **UI**: Radix UI primitives, Lucide icons, Recharts

## Database

- **77 tables** across 22 modules
- **159 RLS policies** for multi-centre data isolation
- **5 centres**: Shilaj, Vastral, Modasa, Gandhinagar, Udaipur
- **8 RBAC roles**: super_admin, admin, doctor, nurse, pharmacist, lab_tech, receptionist, accountant

Supabase Project: `bmuupgrzbfmddjwcqlss` (Mumbai region)

## Getting Started

```bash
# Install dependencies
npm install

# Copy env file and fill in Supabase keys
cp .env.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
hmis/
├── app/
│   ├── auth/login/          # Login page
│   ├── (dashboard)/         # Protected layout with sidebar
│   │   ├── page.tsx         # Dashboard home
│   │   ├── patients/        # Patient management
│   │   ├── opd/             # OPD module
│   │   ├── ipd/             # IPD module
│   │   ├── billing/         # Billing & invoicing
│   │   ├── pharmacy/        # Pharmacy
│   │   ├── lab/             # Laboratory
│   │   ├── radiology/       # Radiology
│   │   ├── ot/              # OT scheduling
│   │   └── settings/        # Settings
│   ├── api/                 # API routes
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── components/
│   ├── ui/                  # Reusable UI components
│   ├── layout/              # Sidebar, header
│   ├── patients/            # Patient-specific components
│   └── emr/                 # EMR components
├── lib/
│   ├── supabase/            # Supabase client (browser + server)
│   ├── store/               # Zustand stores
│   └── utils.ts             # Utility functions
├── types/
│   └── database.ts          # TypeScript types
└── middleware.ts             # Auth middleware
```

## SQL Files (in /sql)

1. `h1_hmis_migration.sql` — 77-table DDL
2. `h1_hmis_seed.sql` — Master data (centres, roles, departments, sequences)
3. `h1_hmis_rls.sql` — 159 Row-Level Security policies

## Part of Health1 Digital Ecosystem

| System | Stack | Status |
|--------|-------|--------|
| H1 HMIS/ERP | Supabase + Next.js + Vercel | **This repo** |
| H1 VPMS | Supabase + Next.js + Vercel | Live (52 pages) |
| H1 CashFlow | Cloudflare Workers + D1 | Live |
| H1 MedPay | Cloudflare Workers + D1 | Live |
| H1 Capture | Cloudflare Pages + KV | Live |
| H1 Revenue Dashboard | Cloudflare Pages + KV | Live |

---

Health1 Super Speciality Hospitals Pvt. Ltd.
