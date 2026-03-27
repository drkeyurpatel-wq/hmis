---
name: continuous-learning
description: "Auto-extract patterns from successful sessions into reusable instincts. Run /learn after solving tricky problems."
---

# Continuous Learning — Health1

## Purpose

After solving a complex problem, extract the pattern so it becomes reusable knowledge. Instincts are lightweight pattern files that accumulate over time.

## When to Extract

- After debugging a non-obvious issue (especially schema drift, RLS, HL7)
- After discovering a performance optimization
- After finding a security vulnerability pattern
- After implementing a complex business rule
- After a successful architecture decision

## Instinct Format

Save to `.claude/instincts/` with YAML frontmatter:

```markdown
---
pattern: "descriptive-slug"
confidence: 0.8
source: "session-date"
tags: ["supabase", "rls", "vpms"]
---

# Pattern: [Name]

## Trigger
When you see [this situation]...

## Action
Do [this specific thing]...

## Evidence
This worked because [reason]. Verified on [date] in [repo].

## Anti-pattern
Do NOT [common mistake that looks similar].
```

## Confidence Scoring

| Score | Meaning |
|-------|---------|
| 0.3–0.5 | Observed once, might be coincidence |
| 0.5–0.7 | Seen 2-3 times, likely a real pattern |
| 0.7–0.9 | Proven pattern, used successfully multiple times |
| 0.9–1.0 | Core principle, never failed |

## Health1 Instinct Categories

### Supabase Patterns
- Schema drift detection and resolution
- RLS policy patterns for PHI/PII tables
- Type generation and sync workflows
- Migration safety patterns

### Financial Calculation Patterns
- MedPay payout engine rules
- CashFlow D1 data integrity patterns
- Revenue reconciliation patterns

### Clinical Safety Patterns
- CDSS validation patterns
- Drug interaction checking patterns
- HL7 message parsing patterns
- Audit trail implementation patterns

### UI/UX Patterns
- Healthcare-accessible component patterns
- Form validation patterns for clinical data
- Loading state patterns for large datasets

## Evolution

When 3+ instincts share a tag, consider clustering them into a full skill:

```
/evolve --tag supabase-rls
```

This creates a new `.claude/skills/supabase-rls-patterns.md` from the instincts.

## Storage

```
.claude/instincts/
  supabase-schema-drift-fix.md
  medpay-net-amt-rule.md
  hmis-rls-phi-pattern.md
  cashflow-d1-verify-after-write.md
  ...
```

Instincts are committed to git so they persist across sessions and team members.
