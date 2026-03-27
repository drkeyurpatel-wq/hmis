---
description: "Health1 UI/UX standards — healthcare accessible design"
globs: ["**/*.tsx", "**/*.jsx", "**/*.css"]
alwaysApply: false
---

# UI/UX Rules — Health1 Healthcare Stack

## Design System

- Healthcare = Accessible style. No neon/AI gradients/gamification on medical data.
- Master + Overrides design system pattern across apps
- Lucide SVG icons only — no emoji in UI
- cursor-pointer on all clickable elements
- Hover transitions: 150-300ms
- 4.5:1 contrast minimum (WCAG AA)
- Focus states on all interactive elements (keyboard navigation)

## Responsive Breakpoints

- 375px (mobile)
- 768px (tablet)
- 1024px (desktop)
- 1440px (wide)

## Loading & Error States

- Skeleton loading on all data-dependent views
- Empty states with user guidance (not just "No data")
- Errors displayed near the relevant field, not in global toast
- Disable button + show spinner on all async operations

## Charts & Data Visualization

- Visible legends on all charts
- Tooltips on data points
- Axis labels with units
- No chart without a clear title

## Forms

- Validation errors near the field
- Required fields clearly marked
- Autosave or unsaved-changes warning
- Disable submit + spinner during submission
