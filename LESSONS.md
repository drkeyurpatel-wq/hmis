# LESSONS.md — Health1 Error-to-Lesson Pipeline
# Read this file at session start. Add entries after every bug fix.
# Format: Date | Root Cause | Fix | Prevention Rule

## MedPay Lessons

### L001 — Doctor Amt vs Net Amt confusion (Mar 2026)
- **Root Cause**: OPD/IPD-Visit/WardProc payout base was using Doctor Amt instead of Net Amt
- **Fix**: Changed computation engine to use net_amount for OPD, IPD Visit, Ward Procedures
- **Prevention**: PAYOUT_RULES.md Rule R1-R3. Always verify base amount source in payout computation. Doctor Amt ≠ Net Amt for these categories.

### L002 — PMJAY IP echo hardcoded rate (Mar 2026)
- **Root Cause**: PMJAY IP echo was using percentage-based calculation instead of fixed ₹500
- **Fix**: Added special case in payout engine for PMJAY + echo combination
- **Prevention**: PAYOUT_RULES.md Rule R17. PMJAY IP echo is ALWAYS ₹500 fixed, regardless of contract percentage.

### L003 — Multi-centre MGM doctors settlement lock (Apr 2026)
- **Root Cause**: Settlement was locked without centre-wise pool breakdown for multi-centre MGM doctors
- **Fix**: Added confirmation gate requiring all centres to have data before lock
- **Prevention**: Krunal, Nidhi, Kriplani (NOT Milind — he moved to FFS) need centre-wise breakdown + combined MGM calc before lock.

### L004 — Float precision in financial calculations (Mar 2026)
- **Root Cause**: JavaScript float arithmetic causing ±₹0.01 discrepancies in payout totals
- **Fix**: Migrated all financial columns from float to numeric/decimal in Supabase
- **Prevention**: NEVER use float/real for money. Always numeric(12,2) or decimal. Apply Math.round() at display only.

### L005 — Service role key exposure in chat (Mar 2026)
- **Root Cause**: Supabase service role keys pasted in Claude chat during debugging
- **Fix**: Rotated keys immediately
- **Prevention**: NEVER paste service role keys in chat. Use env vars. If exposed, rotate within 1 hour.

## HMIS Lessons

### L006 — RLS bulk application crash (Mar 2026)
- **Root Cause**: Applying RLS policies to multiple tables in one migration caused auth failures
- **Fix**: Rolled back, applied one table at a time with user session testing
- **Prevention**: HMIS CRITICAL RULE — NEVER apply RLS/schema changes in bulk. One table, one test, one verify.

### L007 — EMR data loss on navigation (ongoing)
- **Root Cause**: Unsaved EMR form data lost when user navigates between tabs
- **Fix**: Pending EMR rebuild
- **Prevention**: All multi-step forms must auto-save to draft state. Never rely on user clicking Save.

## VPMS Lessons

### L008 — 3-way match tolerance (Mar 2026)
- **Root Cause**: PO→GRN→Invoice 3-way match was using exact match, rejecting legitimate ±2% variations
- **Fix**: Added configurable tolerance threshold per item category
- **Prevention**: Financial matching always needs tolerance. Default ±2% for consumables, exact for capital items.

## Cross-Ecosystem

### L009 — Vercel build not checked before push (recurring)
- **Root Cause**: Multiple times code was pushed that failed Vercel build
- **Fix**: Added Deploy Rule 1: npx next build before every push
- **Prevention**: This is non-negotiable. Build fail = DO NOT push. Period.

### L010 — Massive RLS gap across entire ecosystem (Apr 2026)
- **Root Cause**: All 5 Supabase projects had tables with RLS disabled since initial build. 84 tables publicly queryable.
- **Fix**: Enabled RLS + authenticated policies on all 84 tables, hardened 13 functions, fixed 9 views in one session.
- **Prevention**: Every new table MUST have RLS enabled at creation. Run Supabase security advisor monthly. Add to ECC v4 Rule 12.

---
# Add new lessons below this line. Increment L-number. Follow the format above.
