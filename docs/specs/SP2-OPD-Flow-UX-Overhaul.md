# HMIS Sub-Project 2: OPD Flow UX Overhaul — Design Spec

**Version:** 1.0 | **Date:** 26 March 2026  
**Status:** DRAFT — Awaiting sign-off  
**Depends on:** Sub-Project 1 (Foundation) ✅ MERGED

---

## 1. Problem Statement

The entire OPD flow (Registration → Queue → Consultation → Billing → Pharmacy) is functionally
complete. All handlers work. Data flows end-to-end.

The problem is purely visual: every page uses ad-hoc teal/blue/gray colors, inline styles,
no H1 components, no loading/empty/error states, and no responsive optimization.
**Rating: 5/10. Target: 9/10.**

## 2. Scope

**5 pages, ~40 billing sub-components:**

| Page | Lines | Current State | Target |
|------|-------|--------------|--------|
| OPD Queue | 263L | Working, ad-hoc colors | H1 tokens, DataTable, ActionButton |
| Appointments | 464L | Working, ad-hoc colors | H1 tokens, DataTable, FormField |
| Billing (parent) | 386L | Working, delegates to 12 components | H1 tokens, tab styling |
| Billing (12 components) | 2,898L | Working, ad-hoc colors | H1 token color-swap |
| Pharmacy | 547L | Working, ad-hoc colors | H1 tokens, DataTable |
| Patient Registration | 231L | Working, ad-hoc colors | H1 FormField + ActionButton |

**Out of scope:** EMR v2 rebuild (Sub-Project 3), IPD flow (Sub-Project 6).

## 3. Approach

**For each page, the retrofit follows this exact sequence:**

1. Swap all `teal-*`, `blue-*`, `brand-*` color classes → `h1-navy`, `h1-teal`, `h1-red`, `h1-yellow` tokens
2. Replace `<button>` → `<ActionButton>` (with loading state on async actions)
3. Replace inline form fields → `<FormField>` + `<FormInput>` / `<FormSelect>` (errors near field)
4. Replace ad-hoc tables → `<DataTable>` (where appropriate — some complex tables stay custom)
5. Add `<LoadingState>` during data fetch (replace blank screens)
6. Add `<EmptyState>` when zero records
7. Replace emoji status indicators with `h1-badge-*` classes
8. Verify responsive at 375px / 768px
9. Verify `cursor-pointer` on all clickables, hover transitions

**No functional changes.** Same hooks, same data flow, same handlers. Visual-only.

## 4. Acceptance Criteria

- [ ] All 5 pages use H1 color tokens (zero teal-*, blue-* in OPD flow files)
- [ ] All async buttons use ActionButton with loading state
- [ ] All forms use FormField with error-near-field
- [ ] Loading skeleton on every data fetch
- [ ] Empty state when zero records
- [ ] Status badges use h1-badge-* classes
- [ ] Responsive at 375px (mobile) and 768px (tablet)
- [ ] Zero build errors
- [ ] No functional regressions (same handlers still fire)

---

## 5. Open Questions

None — this is a pure visual retrofit with no design decisions to make.
The design system is already defined in Sub-Project 1.
