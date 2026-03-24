# HMIS Page Audit — March 24, 2026

## Summary
- **76 total pages** (63 dashboard + 7 PX patient + 6 other)
- **All 63 dashboard pages** have hooks with real DB operations
- **All required tables exist** in Supabase (209 tables)
- **Root cause of "dead buttons"**: silent failures from `sb()` null checks and unhandled RLS errors

## Root Cause Analysis

### Problem 1: Silent `sb()` null returns
Every hook starts with `if (!sb()) return;` — if the browser client isn't initialized, the function exits silently. The user clicks a button and nothing happens, no error, no feedback.

**Fix**: Replace `if (!sb()) return;` with a helper that shows an error toast.

### Problem 2: Unhandled Supabase errors
Most hooks do: `await sb()!.from('table').update({...})` without checking the error response. If RLS blocks the write, the error is silently swallowed.

**Fix**: Wrap all DB calls with `safeDb()` helper (already exists at `lib/utils/safe-db.ts`) that returns `{ data, error }` and shows toast on error.

### Problem 3: After status changes, list filters hide the updated record
Example: IPD `initiateDischarge` changes status to `discharge_initiated`, then reloads with `loadAdmissions('active')` — the record disappears from the active list. User thinks nothing happened.

**Fix**: After status transitions, briefly show a success banner or switch the filter to show the updated record.

---

## Page-by-Page Status

### CORE WORKFLOW (OPD Pilot) — WORKING ✅
| Page | Status | Notes |
|------|--------|-------|
| Dashboard (/) | ✅ Working | Role-based work queue, auto-refresh 90s |
| Patient List | ✅ Working | Search, registration, OPD/EMR quick actions |
| Patient Registration | ✅ Working | UHID auto-generates |
| Patient 360 (/patients/[id]) | ✅ Working | 3-column workspace, 15+ parallel queries |
| OPD Queue (/opd) | ✅ Working | Kanban: waiting→checked_in→with_doctor→completed |
| EMR v2 (/emr-v2) | ✅ Working | CDSS, Smart Builders, Drug DB, AI Copilot |
| Ward Board (/ward-board) | ✅ Working | Real-time bed grid, 30s refresh |

### IPD & NURSING — MOSTLY WORKING
| Page | Status | Issues |
|------|--------|--------|
| IPD List (/ipd) | ✅ Working | Admit, list, filter by status all work |
| IPD Detail (/ipd/[id]) | ✅ Working | 16 clinical tabs, rounds, meds, MAR, vitals |
| IPD Discharge | ⚠️ Silent | `initiateDischarge` works but row disappears from active filter |
| Discharge Engine | ✅ Working | Full 3-step: Review Journey → Edit Summary → Preview & Print |
| Nursing Station | ✅ Working | Patient cards, vitals, MAR, I/O, notes — all wired |
| Bed Management | ✅ Working | Real bed grid via hooks |

### DIAGNOSTICS — WORKING
| Page | Status | Issues |
|------|--------|--------|
| Lab Worklist | ✅ Working | Sample collection, result entry, critical alerts |
| Radiology | ⚠️ Partial | Worklist loads, but report entry may fail silently |
| Pharmacy | ✅ Working | Dispensing queue, drug master, stock |
| Blood Bank | ⚠️ Minimal | Hook exists but page is 59 lines — very basic |

### BILLING & REVENUE — WORKING
| Page | Status | Issues |
|------|--------|--------|
| Billing | ✅ Working | Bill generation, search, advance collection |
| Insurance | ✅ Working | Claims, cashless tracking |
| P&L | ✅ Working | Revenue analytics |
| Revenue Leakage | ⚠️ Basic | Detection logic exists, display only |

### SPECIALTY MODULES — HOOKS WIRED, SILENT ERRORS
These all have hooks with full CRUD. Buttons SHOULD work but errors fail silently.

| Page | Lines | Hook | INSERT | UPDATE | SELECT |
|------|-------|------|--------|--------|--------|
| Cathlab | 448 | cathlab-hooks (227L) | 3 | 2 | 3 |
| Endoscopy | 466 | endoscopy-hooks (149L) | 2 | 1 | 3 |
| Dialysis | 438 | dialysis-hooks (223L) | 3 | 3 | 5 |
| Physiotherapy | 511 | physio-hooks (148L) | 4 | 2 | 3 |
| OT Schedule | 350 | ot-hooks (varies) | ✅ | ✅ | ✅ |
| Surgical Planning | 343 | surgical-planning-hooks | ✅ | ✅ | ✅ |
| Digital Consent | 437 | digital-consent-hooks | ✅ | ✅ | ✅ |

### OPERATIONS MODULES — HOOKS WIRED, SILENT ERRORS
| Page | Lines | Hook | INSERT | UPDATE | SELECT |
|------|-------|------|--------|--------|--------|
| CSSD | 405 | cssd-hooks (270L) | 4 | 10 | 7 |
| Housekeeping | 295 | housekeeping-hooks (222L) | 2 | 4 | 2 |
| CRM | 506 | crm-hooks (208L) | 3 | 4 | 5 |
| Dietary | 410 | dietary-hooks (191L) | 2 | 1 | 3 |
| Duty Roster | 339 | duty-roster-hooks | ✅ | ✅ | ✅ |
| Linen | 222 | linen-hooks (136L) | 1 | 2 | 3 |
| Equipment Lifecycle | 353 | equipment-lifecycle-hooks (219L) | 2 | 4 | 9 |
| Biomedical | 368 | biomedical-hooks (254L) | 3 | 8 | 3 |
| Ambulance | 192 | ambulance-hooks (95L) | 2 | 5 | 2 |
| Mortuary | 305 | mortuary-hooks (109L) | 1 | 2 | 1 |
| Visitors | 173 | visitor-hooks (66L) | 1 | 3 | 1 |
| Homecare | 73 | homecare-hooks (272L) | 7 | 7 | 10 |
| Infection Control | 140 | infection-hooks | ✅ | ✅ | ✅ |
| Quality | 284 | quality-hooks | ✅ | ✅ | ✅ |
| Grievances | 160 | grievance-hooks | ✅ | ✅ | ✅ |
| Referrals | 487 | referral-hooks | ✅ | ✅ | ✅ |

### ADMIN & OTHER
| Page | Status | Notes |
|------|--------|-------|
| Settings | ✅ Working | 13+ direct sb() calls |
| Module Config | ✅ Working | Toggle modules per centre |
| Staff | ⚠️ Basic | List only, limited editing |
| Reports | ✅ Working | PDF/Excel export engine |
| Command Centre | ⚠️ Basic | Overview stats only |
| Accounting | ⚠️ Basic | Minimal, 1 mock array |
| Pulse | ✅ Working | Real-time analytics dashboard |
| Telemedicine | ⚠️ Partial | Session management, video link |
| Voice Notes | ⚠️ Partial | Recording works, transcription basic |

---

## Fix Priority

### Phase 1: Error handling (fixes "dead button" perception)
- Wrap sb() calls with error-visible helper
- Show toast on every save success/failure
- ~2 hours across all hooks

### Phase 2: IPD discharge flow (specific user complaint)
- After `initiateDischarge`, switch filter to show `discharge_initiated`
- Add confirmation dialog before discharge
- Show progress indicator during discharge
- ~30 min

### Phase 3: Cross-module navigation
- After lab order from EMR, link to lab worklist
- After discharge, link to billing
- After OPD complete, link to Patient 360
- ~1 hour

### Phase 4: Pages with minimal functionality
- Blood bank (59 lines) — needs full build
- Homecare (73 lines page, 272 line hooks) — wire hooks to page
- Infection Control (140 lines) — expand
- Accounting (175 lines, mock data) — replace with real P&L
