---
pattern: "hmis-no-bulk-rls-changes"
confidence: 1.0
source: "2026-03-27"
tags: ["hmis", "supabase", "rls", "safety"]
---

# Pattern: Never Apply RLS/Schema Changes in Bulk

## Trigger
When making any Supabase schema changes or RLS policy modifications in HMIS.

## Action
Apply ONE change at a time. After each change:
1. Test with a real authenticated user session
2. Verify the change works as expected
3. Verify no existing functionality is broken
4. Only then proceed to the next change

## Evidence
This is a non-negotiable Health1 rule. HMIS handles PHI — a broken RLS policy means patient data could be exposed or inaccessible to clinicians. Bulk changes make it impossible to identify which change caused the problem.

## Anti-pattern
Do NOT apply multiple ALTER TABLE or CREATE POLICY statements in a single migration. Do NOT run a migration script that modifies multiple tables at once.
