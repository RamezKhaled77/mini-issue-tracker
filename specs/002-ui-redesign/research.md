# Research: UI Redesign Technology Decisions

**Branch**: `002-ui-redesign` | **Date**: 2026-08-15

Phase 0 output for [plan.md](plan.md). Resolves the presentation-layer technology
decisions that the spec intentionally deferred to the planning phase (per the
constitution and the spec's "Do not prescribe implementation technologies"
instruction). The backend, database, shared types, and API contracts are
unchanged from feature 001 and are not re-evaluated here.

## 1. Styling Approach: Plain CSS + CSS Custom Property Design Tokens

- **Decision**: Plain CSS with a design-token layer implemented as CSS custom
  properties (semantic color roles, type scale, spacing scale, radii, elevation,
  motion). The app's single `styles.css` is restructured into layered files
  (`tokens.css`, `base.css`, `components.css`).
- **Rationale**: The current app already uses plain CSS with a semantic class
  vocabulary (`.btn-primary`, `.badge-status-open`, `.field-label`, etc.), so this
  is the least disruptive path and honors Simplicity First (Principle I) and the
  constitution's "unnecessary dependencies MUST be avoided." CSS custom properties
  are the industry-standard mechanism for design tokens in 2026: they are native,
  runtime-resolvable, inherit through the tree, and — critically for this feature —
  make Dark Mode a matter of remapping role values (FR-007), exactly what the spec
  requires. No build step, preprocessor, or framework is introduced.
- **Alternatives considered**: Tailwind CSS v4 (utility-first, dominant ecosystem,
  excellent DX, but adds a build/config layer and a new mental model for an
  already-working, class-name-based stylesheet; rejected as unnecessary for this
  scale). CSS Modules (good scoping, but the app's existing global class vocabulary
  is simple and already consistent). Open Props (a curated custom-property library,
  but its 300+ tokens overlap with what we need to define ourselves; adopting it
  adds a dependency without meaningfully reducing work). Sass (adds a
  preprocessor; custom properties already cover runtime theming needs).
- **Constraint honored**: The spec forbids assuming Tailwind/shadcn/etc.; this
  decision is made here in the planning phase and documented.

## 2. Design Token Model: Semantic Roles, Not Raw Values

- **Decision**: Colors are defined as semantic roles (e.g., `--color-bg`,
  `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`,
  `--color-accent`, `--color-accent-hover`, `--color-danger`, `--color-warning`,
  `--color-success`, `--color-info`) mapped to light-mode values in one place.
  Components consume only roles, never raw hex values.
- **Rationale**: This is the mechanism that satisfies FR-002 and FR-007
  (Dark Mode readiness) without component changes: a future dark theme redefines
  the role values, and every surface updates automatically. It also enforces the
  "subtle borders, restrained elevation" direction (FR-005) by centralizing border
  and shadow tokens (`--border-subtle`, `--border-strong`, `--shadow-xs`,
  `--shadow-md`).
- **Alternatives considered**: Tailwind v4 `@theme` block (would bundle the token
  definition with the framework, rejecting plain CSS). Hard-coded values per
  component (rejected: violates FR-002, prevents Dark Mode). Style Dictionary /
  token JSON + build step (overkill for a single SPA with one theme).

## 3. Component Architecture: Hand-rolled React Components

- **Decision**: Reuse and restyle the app's existing hand-rolled React components
  rather than adopting a component library or headless primitives package.
- **Rationale**: The app has a small, well-understood component set (buttons,
  badges, fields, alerts, cards, forms, dialogs). Adding Radix UI or Base UI would
  add dependencies and a behavioral layer for a surface whose required behaviors
  (dialogs with focus trap/return, Escape-to-close, `aria-modal`, focus-visible
  indicators) are already partially implemented and modest in count. The spec's
  requirement (FR-033, FR-035) is behavioral, not "must use library X."
- **Alternatives considered**: Radix UI primitives (excellent accessibility, ~4M
  weekly downloads, actively maintained successor Base UI; rejected because the
  dialog/select surface here is small and hand-rolling keeps zero new deps per the
  constitution). shadcn/ui (copy-paste components; couples to Tailwind, rejected in
  §1). MUI / Ant Design / Chakra (pre-styled, opinionated visual languages that
  conflict with the custom "Clean SaaS + Modern Tech" direction; heavy).
- **Behavioral floor**: The hand-rolled Dialog MUST implement: focus trap, focus
  return to trigger, Escape to close, `role="dialog"`/`aria-modal`, and
  `aria-labelledby` (FR-033, FR-035). This is specified as a hard requirement in
  the contract and validated by the a11y suite and quickstart keyboard scenarios.

## 4. Icons: Minimal Inline SVG (No Icon Library)

- **Decision**: Use a small set of hand-authored inline SVG icons where needed
  (e.g., status dots, empty-state glyphs, chevron for back), defined as local React
  components or inline markup.
- **Rationale**: The visual direction is "minimal, avoid decorative UI"; the app
  needs only a handful of simple glyphs. This avoids a dependency (Lucide or
  similar) and keeps bundle/asset surface trivial. Iconography must be consistent
  and accessible (FR-048; decorative icons hidden with `aria-hidden`, meaningful
  icons given accessible names).
- **Alternatives considered**: Lucide (nice, popular icon set; rejected to honor
  the no-unnecessary-dependency constraint and the minimal-icon direction).
  Emoji/glyph fonts (inconsistent rendering, accessibility issues).

## 5. Dialog & Focus Management: Hand-rolled, no headless lib

- **Decision**: Implement a single reusable `Dialog` component handling open/close,
  overlay, focus trap, focus return, Escape, and ARIA attributes, plus a
  `useFocusAlert`-style pattern (already in the codebase) for error focus.
- **Rationale**: Consistent with §3 (no new deps) and with the existing
  `useFocusAlert.ts` / `FormAlert.tsx` patterns the app already uses. One dialog
  component is reused for project create/rename, issue create/edit, destructive
  confirmations, and (in the future) auth flows.
- **Alternatives considered**: Native `<dialog>` element (browser support for
  focus/return behavior varies; custom implementation gives consistent behavior
  across evergreen browsers). Radix Dialog (rejected per §3).

## 6. Loading State Pattern: Skeleton + Button Inline State

- **Decision**: Use lightweight skeleton placeholders for initial page data loads
  and disabled/in-progress button labels ("Saving...", "Deleting...") for actions,
  matching the existing patterns but visually polished.
- **Rationale**: Satisfies FR-035/FR-036 and SC-008 (no jarring layout shift).
  Skeletons are implemented in CSS using the token system (shimmer via subtle
  background animation) and MUST respect reduced motion (FR-046).
- **Alternatives considered**: Spinner-only (no layout stability). Full-page
  loaders (disruptive). CSS libraries for skeletons (unnecessary dependency).

## 7. Accessibility Validation: Extend Existing axe-core Coverage

- **Decision**: Keep Vitest + React Testing Library + vitest-axe. Extend the
  existing `tests/accessibility/core.test.tsx` to cover the redesigned surfaces
  (workspace, issue detail, dialogs) and add keyboard-interaction assertions for
  dialogs (focus trap, focus return, Escape).
- **Rationale**: Preserves the feature-001 testing baseline (Principle V) and
  enforces SC-003/SC-004/FR-044–FR-047. No new test framework needed.
- **Alternatives considered**: Playwright E2E a11y (heavier; the existing
  jsdom + axe-core suite already gates WCAG AA).

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|------------|
| Styling | Plain CSS + CSS custom-property design tokens; no CSS framework |
| Component architecture | Hand-rolled React components; no component/headless library |
| Icons | Minimal inline SVG; no icon library |
| Dialogs/focus | Single reusable hand-rolled Dialog with focus trap/return/Escape; role + aria-modal |
| Loading | CSS skeletons + inline button states; reduced-motion aware |
| Testing | Existing Vitest/RTL/vitest-axe suites extended to new surfaces |
| Dark Mode readiness | Semantic color roles (FR-007); theme switch = role remap only |

## Explicitly Rejected

- **Tailwind CSS v4** — utility-first framework; adds build/config layer to an
  already-working semantic-class stylesheet; unnecessary for this scale.
- **shadcn/ui** — couples to Tailwind; visual and dependency cost not justified.
- **Radix UI / Base UI** — excellent, but the accessible primitives needed here
  (dialog, buttons, badges) are few and hand-rollable with zero new dependencies.
- **MUI / Ant / Chakra / React-Bootstrap** — pre-styled visual languages conflict
  with the custom design direction.
- **Lucide / icon libraries** — unnecessary for a minimal-icon, non-decorative UI.
- **Native `<dialog>` element** — inconsistent focus/return behavior across
  browsers vs. a small, consistent custom component.
- **Open Props / Sass / Style Dictionary** — added tooling/deps without
  proportional benefit for a single-light-theme SPA.