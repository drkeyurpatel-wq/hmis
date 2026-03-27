---
name: verification-loop
description: "Automated verification loop: build → typecheck → lint → test → security check. Run after completing any feature."
version: "1.0.0"
observe: "PostToolUse"
feedback: "manual"
rollback: "git revert"
---

# Verification Loop — Health1

Run this checklist after completing any feature, before committing.

## Steps (in order)

### 1. Build Check

```bash
# Next.js repos (VPMS, HMIS, HRMS)
npx next build

# Cloudflare Workers (CashFlow)
npx wrangler deploy --dry-run
```

**Pass criteria:** Zero build errors.

### 2. TypeScript Check

```bash
npx tsc --noEmit
```

**Pass criteria:** Zero type errors. No `any` types introduced.

### 3. Lint Check

```bash
npx next lint
# or
npx eslint .
```

**Pass criteria:** Zero errors. Warnings acceptable but should be addressed.

### 4. Test Suite

```bash
npx jest --coverage
# or
npx vitest --coverage
```

**Pass criteria:** All tests pass. Coverage >= 80% on changed files.

### 5. Security Check

Run the security-reviewer agent checklist:

- [ ] No PHI/PII in logs, errors, or console output
- [ ] No service_role key in client code
- [ ] No hardcoded credentials
- [ ] RLS enabled on new/modified tables
- [ ] Input validation on new forms/endpoints
- [ ] Audit trail for data modifications (HMIS only)

### 6. Accessibility Check

- [ ] New UI has 4.5:1 contrast (WCAG AA)
- [ ] Focus states work with keyboard navigation
- [ ] Skeleton loading states present
- [ ] Error messages near relevant fields

## When to Run

- After completing any feature (before commit)
- After fixing a bug (to verify no regressions)
- Before any deployment
- After resolving merge conflicts

## Output

```
## Verification: [feature name]

| Check | Status | Details |
|-------|--------|---------|
| Build | PASS/FAIL | ... |
| TypeScript | PASS/FAIL | ... |
| Lint | PASS/FAIL | ... |
| Tests | PASS/FAIL | Coverage: X% |
| Security | PASS/FAIL | ... |
| Accessibility | PASS/FAIL | ... |

### Verdict: READY TO COMMIT / NEEDS FIXES
```
