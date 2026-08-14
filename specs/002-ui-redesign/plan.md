# Implementation Plan: UI Redesign — Mini Issue Tracker

**Branch**: `002-ui-redesign` | **Date**: 2026-08-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-ui-redesign/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Redesign the existing Mini Issue Tracker's frontend presentation layer into a
polished, professional "Clean SaaS + Modern Tech" product (light mode) while
preserving every existing behavior: authentication, workspaces, invitations,
projects, issue CRUD, statuses (Open / In Progress / Closed), priorities (Low /
Medium / High / Urgent), assignees, labels, due dates, comments, project-scoped
search/filters, and dashboard statistics. Backend, database, shared types, API
contracts, permissions, and business rules are untouched; this is a
presentation-only change. The design system must be built on semantic color
roles so Dark Mode can be added later by remapping role values only (Dark Mode
itself is out of scope). No new product functionality.

Technical approach: keep the existing React 18 + Vite SPA and its single-language
TypeScript stack. Rebuild the styling around CSS custom properties as design
tokens (semantic color roles, type scale, spacing, radii, elevation, interactive
states) layered over plain CSS, with hand-rolled React components following the
app's existing patterns. No new runtime dependencies are introduced; the
existing Vitest + React Testing Library + axe-core suites remain the testing
baseline and are extended for the redesigned surfaces. Technology decisions are
resolved in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Node.js 22 LTS (existing, unchanged)

**Primary Dependencies**: None added. Existing React 18 + Vite + React Router;
plain CSS with CSS custom properties for design tokens (no CSS framework, no
component library, no icon library). `@axe-core/react` and `vitest-axe` for
accessibility assertions.

**Storage**: N/A — no data changes; SQLite/Drizzle layer in feature 001 is untouched.

**Testing**: Vitest (existing suites stay green), React Testing Library (component),
vitest-axe / axe-core (accessibility; extended to redesigned surfaces).

**Target Platform**: Evergreen browsers at desktop (≥1280px), tablet (~768px), and
mobile (~375px) widths.

**Project Type**: web application (frontend SPA) — presentation-only change.

**Performance Goals**: No regression from current behavior (SC-004 from feature
001: project search/filter < 2s); loading states introduce no jarring layout shift
(SC-008).

**Constraints**: Presentation-only — no backend/API/data/permission/business-rule
changes; WCAG AA in light mode; full keyboard navigation; reduced-motion support;
semantic color roles structured for future Dark Mode; no unnecessary new
dependencies (constitution).

**Scale/Scope**: Existing app surface — 5 pages, ~8 shared components, 1 global
stylesheet restructured into token-driven layers.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Simplicity First | PASS | No new runtime deps; CSS custom-property tokens over plain CSS; reuse existing component patterns |
| II. Modular & Maintainable Design | PASS | Token/component/page layering keeps presentation cohesive; domain/data untouched |
| III. Type Safety & Consistency | PASS | No new data types; shared/ types unchanged; component props remain typed |
| IV. Security by Default | PASS | No changes to auth, session, permissions, or validation surfaces |
| V. Test Critical Behavior | PASS | Existing suites must stay green; a11y suite extended to new surfaces |
| VI. User Experience & Accessibility | PASS | The feature's entire purpose; WCAG AA + keyboard + reduced motion are explicit requirements |
| VII. Requirements Before Implementation | PASS | Spec exists with all requirements and clarifications before this plan |
| VIII. No Silent Assumptions | PASS | Presentation-only scope and light-mode/dark-mode readiness documented in spec assumptions |
| IX. Explicit Decisions | PASS | CSS/component architecture decisions recorded in research.md with rationale and alternatives |

No gate violations. Complexity Tracking left empty (no unjustified
complexity).

**Post-Phase 1 re-check**: The design (research decisions, presentation mapping,
design-system contract, quickstart) was reviewed against every principle again
after Phase 1. No new violations surfaced:

- I. Simplicity First: plain CSS + CSS custom-property tokens, hand-rolled
  components, zero new runtime dependencies (research.md §1–§7).
- II. Modular & Maintainable Design: token layer (`tokens.css`) separated from
  component/page styling; components keep current names/responsibilities so
  routing and behavioral tests stay intact (plan.md structure, data-model.md).
- III. Type Safety & Consistency: no new types; `shared/` and API contract
  unchanged (data-model.md scope statement).
- IV. Security by Default: no changes to auth, sessions, permissions, or
  validation; destructive actions still authorized server-side (contract §6).
- V. Test Critical Behavior: existing suites must stay green; a11y suite extended
  to redesigned surfaces (research.md §7, quickstart scenario 11).
- VI. User Experience & Accessibility: WCAG AA, keyboard flows, reduced motion,
  dialog focus contract all specified as hard requirements (contract §3, §5).
- VII. Requirements Before Implementation: every contract/quickstart scenario
  traces to a spec FR or user story (spec.md FR-001…FR-049).
- VIII. No Silent Assumptions: presentation-only scope and Dark Mode readiness
  documented in spec assumptions and data-model.md; tech decisions recorded with
  alternatives in research.md.
- IX. Explicit Decisions: all tech choices (CSS approach, components, icons,
  dialogs, loading) recorded in research.md with rationale and explicitly rejected
  options.

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-redesign/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── design-system.md # design token + component contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/                  # UNCHANGED — no edits (feature 001)
shared/                   # UNCHANGED — no edits (feature 001)
frontend/
├── src/
│   ├── main.tsx          # unchanged (imports styles)
│   ├── App.tsx           # routing unchanged
│   ├── context/auth.tsx  # unchanged
│   ├── api/client.ts     # unchanged
│   ├── styles/           # NEW token-driven CSS layers
│   │   ├── tokens.css    # semantic color roles, type scale, spacing, radii, elevation, motion
│   │   ├── base.css      # reset, element defaults, focus-visible, sr-only
│   │   └── components.css# component + page styles consuming tokens
│   ├── components/       # redesigned shared components
│   │   ├── Button.tsx, Badge.tsx, Field.tsx, Alert.tsx,
│   │   ├── Dialog.tsx, EmptyState.tsx, Spinner.tsx, Skeleton.tsx,
│   │   ├── Layout.tsx, FormAlert.tsx, useFocusAlert.ts (preserved)
│   │   ├── IssueForm.tsx, ProjectDialog.tsx, Invitations.tsx (redesigned)
│   └── pages/            # Login, Signup, Dashboard, Workspace, Issue (redesigned)
└── tests/
    ├── component/        # existing suites updated only where presentation changes break queries
    └── accessibility/    # existing axe suites + coverage for new surfaces
```

**Structure Decision**: Keep the existing SPA structure and replace the single
`styles.css` with layered CSS files driven by design tokens defined as CSS custom
properties. This honors the constitution's deferral of technology choice to
planning (plain CSS chosen in research.md), avoids new dependencies, and makes
Dark Mode a future role remapping. Component and page files keep their current
names/responsibilities so behavioral tests and routing stay intact; only markup
and styling change.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Not applicable.
