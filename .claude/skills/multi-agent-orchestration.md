---
name: multi-agent-orchestration
description: "Coordinate multiple agents for complex Health1 features. Plan → Implement → Review → Verify pipeline with parallel tracks for independent modules."
version: "1.0.0"
observe: "PostToolUse"
feedback: "manual"
rollback: "git revert"
---

# Multi-Agent Orchestration — Health1

## When to Use

- Features spanning 3+ files or 2+ modules
- Any change touching financial calculations (needs independent verification)
- Schema changes (needs DB review + security review + code review)
- EMR features (needs clinical safety review + security review)
- Cross-repo changes (VPMS + HMIS, MedPay + CashFlow)

## Pipeline: Sequential

For most features, run agents in sequence:

```
1. /plan "feature description"
   → planner agent creates implementation blueprint
   → Get approval before proceeding

2. /tdd
   → tdd-guide agent enforces RED → GREEN → REFACTOR
   → Tests written first, then implementation

3. Database changes? → database-reviewer agent
   → Schema drift check
   → RLS policy audit
   → Migration safety verification

4. /code-review
   → code-reviewer agent checks quality
   → Business logic verification
   → Math verification (zero-error policy)

5. HMIS code? → hmis-reviewer agent
   → CDSS accuracy check
   → Drug interaction verification
   → Clinical safety assessment

6. /security-scan (or security-reviewer agent)
   → PHI/PII exposure check
   → Secret detection
   → RLS audit

7. /verify
   → Verification loop: build → typecheck → lint → test → security → accessibility
```

## Pipeline: Parallel (Complex Features)

For features with independent modules, run parallel tracks:

```
                    ┌── Track A: Backend ──┐
/plan ─── approve ──┤                      ├── /code-review ── /verify
                    └── Track B: Frontend ─┘
```

### Example: HMIS EMR Encounter Module

```
Track A (Backend):
  1. planner → Schema design for encounters table
  2. database-reviewer → RLS policies for PHI
  3. tdd-guide → API route tests + implementation
  4. security-reviewer → PHI exposure audit

Track B (Frontend):
  1. planner → Component tree for encounter flow
  2. tdd-guide → Component tests + implementation
  3. code-reviewer → Accessibility, UX quality

Merge:
  4. Integration test (API + UI)
  5. hmis-reviewer → Clinical safety verification
  6. /verify → Full verification loop
```

## Orchestration Commands

```
/plan "Add patient encounter flow to HMIS"
  → Creates blueprint with parallel tracks identified

/orchestrate --parallel
  → Spawns separate agent contexts for each track
  → Each track runs its own TDD → Review → Verify cycle
  → Merge step runs after all tracks complete

/orchestrate --sequential
  → Default: runs plan → implement → review → verify in order
```

## Cross-Repo Orchestration

When a change spans repos (e.g., VPMS purchase triggers CashFlow expense):

```
1. Plan in primary repo (VPMS)
2. Identify cross-repo touchpoints
3. Implement in primary repo with interface contracts
4. Implement in secondary repo (CashFlow) matching the contract
5. Integration verification across repos
```

**Rule:** Each repo must be independently deployable. No cross-repo runtime dependencies. Use API contracts or event-driven patterns.

## Agent Selection Matrix

| Situation | Primary Agent | Supporting Agents |
|-----------|--------------|-------------------|
| New feature | planner → tdd-guide | code-reviewer |
| Schema change | database-reviewer | security-reviewer, code-reviewer |
| EMR feature | planner → tdd-guide | hmis-reviewer, security-reviewer |
| Bug fix | build-error-resolver | tdd-guide (regression test) |
| Security audit | security-reviewer | database-reviewer |
| Financial logic | planner → tdd-guide | code-reviewer (math verification) |
| Refactor | code-reviewer | tdd-guide (coverage check) |
