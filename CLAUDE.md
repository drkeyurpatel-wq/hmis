# Health1 HMIS/ERP — Hospital Management Information System

## Stack

- Supabase (project: bmuupgrzbfmddjwcqlss, Mumbai region)
- Vercel: hmis-brown.vercel.app
- Repo: drkeyurpatel-wq/hmis

## Auth

- Working. Keyur UID: 4193cb77-92d8-4d85-b1eb-3a6ad8a1ef75

## Active Priority

- EMR rebuild to 9/10 quality (currently ~5/10, targeting Practo/eka.care-level UX)

## Modules That Carry Forward (DO NOT rebuild — extend)

- **CDSS engine:** NEWS2, vitals scoring, 20 drug interaction pairs, 19 dose validation rules, 55 ICD-10 codes
- **Smart Complaint Builder:** 12 templates
- **Smart Exam Builder:** 6 systems
- **Drug DB:** 50+ Indian drugs with brand names
- **Medication Set templates:** 10 pre-built sets

## Integrations

- Shilaj hematology analyzer: Mindray BC-5000 (HL7 v2.3.1, TCP port 5100, MLLP)
- HFR ID: IN2410013685
- NHCX sandbox registration pending

## Critical Rules — NON-NEGOTIABLE

- **NEVER apply RLS or DB schema changes in bulk** — test each change against a real user session first
- PHI/PII must be tagged at schema level
- Zero-error policy on mathematics and grammar — absolute, no exceptions
- Audit trail required for every data modification
- No PHI/PII in error messages, logs, or console output

## Development Rules

- TDD: RED → GREEN → REFACTOR — no code without a failing test first
- Brainstorm BEFORE code: context-prime → questions → approaches → spec → sign-off
- Decompose big asks: spec → plan → implement per sub-project
- Verify: proof, not claims. YAGNI. 1 file = 1 job.
- Debug: reproduce → evidence → root-cause → test-fix; 3+ fails = rethink architecture
- Two-stage review: spec compliance first, then quality

## Security — HIGHEST PRIORITY (PHI)

- All Supabase queries MUST go through RLS — no service_role key in client code
- Encrypt sensitive patient data at rest
- Session timeout for clinical users
- Audit log for all patient record access
- WCAG AA compliance (4.5:1 contrast minimum)
- Tag every PHI/PII column in schema with metadata

## UI/UX Rules

- Healthcare = Accessible style
- Lucide SVG icons only (no emoji)
- cursor-pointer, hover 150-300ms, focus states
- Responsive: 375/768/1024/1440 breakpoints
- Skeleton loading, empty states with guidance, errors near field
- Charts: visible legends, tooltips, axis labels with units
- No neon/AI gradients/gamification on medical data
- Disable button + spinner on async operations
