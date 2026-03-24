# Health1 HMIS — PX Module Integration Guide

## Overview
- **7 new Supabase tables** + 4 RPC functions + 7 RLS policies
- **6 patient-facing pages** (public, no auth, `/px/[token]/...`)
- **4 staff-facing pages** (inside dashboard, auth required)
- **2 hook libraries** (patient-hooks.ts, staff-hooks.ts)
- **1 type file** (types.ts)
- **25 food menu items** seeded for Shilaj

---

## Step 1: Database Migration

> ⚠️ CRITICAL: Run on **staging first** (project `pcldnxssdxwxhwmasdhv`), verify, then production.

File: `sql/001_px_module.sql`

Run via Supabase SQL Editor or CLI:
```bash
supabase db push --db-url "postgresql://..." < sql/001_px_module.sql
```

**Verify after migration:**
```sql
-- Check tables created
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'hmis_px_%' ORDER BY table_name;
-- Expected: 7 tables

-- Check menu seeded
SELECT count(*) FROM hmis_px_food_menu;
-- Expected: 25

-- Check RPC exists
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE 'px_%';
-- Expected: px_validate_token, px_generate_token, px_expire_token, px_can_create_nurse_call

-- Test token generation (use a real admission_id from hmis_admissions)
SELECT px_generate_token(
  'ADMISSION_UUID_HERE'::uuid,
  'PATIENT_UUID_HERE'::uuid,
  'c0000001-0000-0000-0000-000000000001'::uuid
);
```

---

## Step 2: File Placement in HMIS Repo

```
hmis/
├── lib/px/
│   ├── types.ts              ← types/px-types.ts
│   ├── patient-hooks.ts      ← lib/patient-hooks.ts
│   └── staff-hooks.ts        ← lib/staff-hooks.ts
│
├── app/px/[token]/
│   ├── layout.tsx            ← patient-pages/layout.tsx
│   ├── page.tsx              ← patient-pages/page.tsx
│   ├── food/page.tsx         ← patient-pages/food-page.tsx
│   ├── nurse-call/page.tsx   ← patient-pages/nurse-call-page.tsx
│   ├── complaint/page.tsx    ← patient-pages/complaint-page.tsx
│   ├── feedback/page.tsx     ← patient-pages/feedback-page.tsx
│   └── status/page.tsx       ← patient-pages/status-page.tsx
│
├── app/(dashboard)/
│   ├── px-nursing/page.tsx   ← staff-pages/px-nursing-page.tsx
│   ├── px-kitchen/page.tsx   ← staff-pages/px-kitchen-page.tsx
│   ├── px-coordinator/page.tsx ← staff-pages/px-coordinator-page.tsx
│   └── px-feedback/page.tsx  ← staff-pages/px-feedback-page.tsx
```

**IMPORTANT**: The patient pages at `/px/[token]/...` are **outside** the `(dashboard)` route group, so they bypass HMIS auth middleware. Make sure your middleware config in `middleware.ts` excludes the `/px` path:

```typescript
// In middleware.ts — add to public routes
export const config = {
  matcher: [
    // ... existing matchers
    '/((?!_next/static|_next/image|favicon.ico|px/).*)',
  ],
};
```

Or if using route-based auth checks:
```typescript
if (request.nextUrl.pathname.startsWith('/px/')) {
  return NextResponse.next(); // Public route — no auth
}
```

---

## Step 3: Sidebar Updates

Add PX pages to the sidebar config. In your sidebar component, add under the relevant role sections:

```typescript
// For Admin/IPD Coordinator role
{ label: 'PX Dashboard', href: '/px-coordinator', icon: StarIcon },
{ label: 'PX Feedback', href: '/px-feedback', icon: ChatBubbleIcon },

// For Nurse role
{ label: 'PX Nursing', href: '/px-nursing', icon: BellAlertIcon },

// For Kitchen role (if applicable) or under Admin
{ label: 'PX Kitchen', href: '/px-kitchen', icon: FireIcon },
```

---

## Step 4: Wire Token Generation into Admission Flow

In the IPD Admission Wizard (or wherever admissions are confirmed), add token generation:

```typescript
// After admission is confirmed and bed is assigned
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

// Generate PX token
const { data: token } = await supabase.rpc('px_generate_token', {
  p_admission_id: admission.id,
  p_patient_id: admission.patient_id,
  p_centre_id: admission.centre_id,
  p_bed_id: admission.bed_id,
  p_ward_id: admission.ward_id,
  p_created_by: currentStaff.id,
});

// token is a 12-char string
// QR URL: https://hmis-brown.vercel.app/px/${token}
console.log('PX Token:', token);
console.log('QR URL:', `https://hmis-brown.vercel.app/px/${token}`);
```

For QR code on wristband printout, use a QR library:
```bash
npm install qrcode
```

```typescript
import QRCode from 'qrcode';

const qrDataUrl = await QRCode.toDataURL(
  `https://hmis-brown.vercel.app/px/${token}`,
  { width: 200, margin: 1 }
);
// Use qrDataUrl in wristband print template
```

---

## Step 5: Wire Token Expiry into Discharge Flow

In the discharge workflow, expire the token:

```typescript
// On discharge confirmation
await supabase.rpc('px_expire_token', {
  p_admission_id: admission.id,
});
```

---

## Step 6: Module Config

Add PX module entries to `hmis_module_config`:

```sql
INSERT INTO hmis_module_config (centre_id, module_key, module_name, is_enabled) VALUES
('c0000001-0000-0000-0000-000000000001', 'px_nursing', 'PX Nursing Station', true),
('c0000001-0000-0000-0000-000000000001', 'px_kitchen', 'PX Kitchen Display', true),
('c0000001-0000-0000-0000-000000000001', 'px_coordinator', 'PX Coordinator', true),
('c0000001-0000-0000-0000-000000000001', 'px_feedback', 'PX Feedback Manager', true);
```

---

## Step 7: Google Reviews Integration (Future)

The feedback table has `google_review_status` and `google_review_url` columns ready.

Current flow:
1. Patient rates 4-5 stars → success screen shows "Write a Google Review" link
2. Link points to `https://g.page/health1shilaj/review` (update with actual Google place ID)
3. Staff can mark feedback as "prompted" for tracking

Future enhancement:
- Google Business API integration to auto-post verified reviews
- SMS/WhatsApp reminder to patients post-discharge with review link

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth for patient pages | None (token-based) | Patients shouldn't need to create accounts |
| Token format | 12-char alphanumeric | Short enough for QR, not predictable |
| Food approval flow | Patient → Nurse → Kitchen | Prevents dietary conflicts for admitted patients |
| Polling vs websocket | Polling (5-15s) | Simpler, reliable, sufficient for this use case |
| Tables in same project | Yes (HMIS Supabase) | Shared patient/admission/bed data, no API bridge needed |
| Denormalized patient_name/bed | Yes, on every table | Kitchen/nursing see names instantly without joins |

---

## File Count Summary
- SQL: 1 migration file (7 tables, 4 RPCs, 7 RLS policies, 25 seed rows)
- TypeScript: 3 files (types, patient-hooks, staff-hooks)
- Pages: 10 (6 patient + 4 staff)
- **Total: 14 files**
