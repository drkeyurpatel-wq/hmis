---
description: "Health1 ENGINEERING v3 coding standards — applies to all Health1 repositories"
alwaysApply: true
---

# ENGINEERING v3 — Health1 Super Speciality Hospitals

## Core Development (from v2)

1. **Brainstorm BEFORE code** — context-prime → questions → approaches → spec → sign-off
2. **Decompose big asks** — spec → plan → implement per sub-project
3. **Granular plans** — bite-sized tasks, file paths, verify steps
4. **TDD: RED → GREEN → REFACTOR** — delete pre-test code after writing proper tests
5. **Two-stage review** — spec compliance first, then quality
6. **Debug** — reproduce → evidence → root-cause → test-fix; 3+ fails = rethink architecture
7. **Verify** — proof, not claims. YAGNI. 1 file = 1 job. Surface assumptions.

## ECC Additions (v3)

8. **CLAUDE.md** — every repo MUST have CLAUDE.md with stack, business rules, DB schema, critical rules
9. **Agent delegation** — use database-reviewer before schema changes; security-reviewer before delivery
10. **Hook enforcement** — TDD not just instructional — enforced at tool level via hooks
11. **Strategic compaction** — /compact at logical breakpoints (after research, after milestones, after failed approaches)
12. **Session persistence** — save/load session context via hooks — no re-priming between sessions
13. **Security scanning** — run security review before any deployment touching PHI/PII

## Supplements

- **Context isolation** — each task gets only the context it needs
- **Status signals** — DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT; never force through blockers
- **Hard-to-test = bad design** — refactor until testable
- **Sunk cost = delete + redo with TDD** — no patching bad foundations
- **Self-improve** — learn from corrections, prevent repeats
- **Autonomous bug fix** — just fix obvious bugs, don't ask
- **Spec reviewer flags "Extra" features as violations** — build what was specced, nothing more
- **No code without failing test first**
- **Tag PHI/PII at schema level**

## Zero-Error Policy

- **Mathematics** — absolute, no exceptions. Verify every calculation.
- **Grammar** — no spelling or grammatical errors in any output.
