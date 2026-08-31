# Stage 2 — Redesign Architecture & Design Decisions

> **Status**: Decision document. No implementation performed. Every decision below is
> grounded in the Stage 1 audit (`specs/009-redesign/current-state-audit.md`, commit
> `2bf0b92`) and direct code inspection. This document is authoritative for the
> implementation stage: it should not need to reopen these questions.

---

## 1. Redesign Principles

**What it should feel like.** The existing identity — *"a dense editorial ticket ledger / workbench"* — is correct and differentiated. It survives; the redesign sharpens it, it does not replace it:

1. **The ledger is the product.** Every surface is a ledger, a document about a ledger entry, or a control surface for ledgers. The signature row (priority edge-bar + monospace key + confident title + quiet metadata + chevron) becomes one real component used everywhere.
2. **Rules over chrome.** Hairline rules, aligned columns, and typography do the structural work. No card-on-card, no floating chrome, near-zero elevation outside overlays.
3. **Calm surface, sharp hierarchy.** Warm paper stays; petrol stays singular; coral stays semantic. Emphasis is earned through hierarchy, not decoration.
4. **Density with rhythm.** Issue-heavy surfaces stay dense (ledger, search, My Issues); documents (issue detail) breathe; control surfaces are compact. Density is intentional per surface, never uniform clutter.
5. **Honest and quiet.** No fabricated counts, navigation, or metadata. Secondary information is genuinely quiet; primary information genuinely dominant.
6. **Same hand.** Any contributor must be able to build a new surface from tokens + primitives + page patterns and have it look native. That is the operational test of the whole redesign.

**What it should NOT feel like.** A generic SaaS dashboard; Linear/Vercel/Notion/Jira clone; card-grid admin panel; glassmorphic/gradient showcase; animation showcase; enterprise console. Banned concretely: gradients, glass, surface radii > `--radius-lg`, decorative color, shadow-driven hierarchy, marketing spacing.

**Differentiation from generic PM SaaS.** Generic PM tools show boards of cards and colorful chrome. Mini Issue Tracker shows a *ruled working document* of tickets with editorial typography and one brand color. The ledger signature, mono ticket key, paper surface, and restrained petrol are the moat — the redesign invests in them, not in trendy chrome.


---

**Balance.** Simplicity and usability win conflicts; density serves usability on issue-heavy surfaces; personality lives in typography, paper, and the ledger — never in decoration; professionalism comes from consistency.

---

## 2. Frontend Architecture

**Stack stays**: React 18 + TypeScript + react-router-dom 6 + Vite. No framework change, no state library, no data-fetching library (§17). Pages remain the owners of fetching/orchestration. The redesign's architectural work is **primitive extraction + in-page decomposition**, not new layers.

### 2.1 New reusable components (approved, with contracts)

| Component | Why it exists | Reused in | Owns | Must NOT own |
|---|---|---|---|---|
| **`LedgerRow`** | Signature is copy-pasted in 3 places and drifting (audit CRITICAL) | WorkspacePage, MyIssuesPage, SearchDialog, Dashboard (workspace variant) | Row anatomy: edge bar, key, title, meta slots, chevron; hover/focus/selected/overdue states; coarse-pointer targets | Data fetching, filtering, selection *logic* (renders a checkbox slot only), quick-edit *logic* (hosts editor slots only) |
| **`LedgerList`** | `ledger-list` + empty/loading wrappers repeated per page | Same four surfaces | List semantics, skeleton rows, `EmptyState` placement, count caption | Pagination decisions (page passes slices) |
| **`FilterBar`** | Two visually similar, logically different filter UIs (audit 8.5) | WorkspacePage, MyIssuesPage | Layout of search + selects + result count + clear affordance; controlled-value props | Filter application logic (stays in `lib/` per model) |
| **`PageHeader`** | Masthead/back-link re-implemented per page | Dashboard, My Issues, Workspace, Issue detail, Labels page | Title hierarchy, eyebrow, trailing action slot, bottom hairline, optional back-link | Page-specific metadata/actions |
| **`Input` / `Select` / `Textarea` / `Checkbox`** | No control primitives; element-selector styling causes ad-hoc overrides (audit HIGH) | Forms, filter bars, fact rail, bulk toolbar, dialogs | Height/radius/border/focus/disabled/error states; label association via `Field` | Validation logic, form state |
| **`FactRail`** | `fact-*` definition list is page-internal | IssuePage | dl semantics, label/value rhythm, editable-cue treatment for value controls | Issue-specific fields (declared by the page as items) |
| **`ConfirmDialog`** (Dialog variant) | Delete confirms re-implement the same pattern 3× | Issue/project/label/view/bulk delete | Danger intent, confirm/cancel contract; focus behavior inherited from `Dialog` | Business consequence text (passed in) |
| **`Icon`** module (`components/icons.tsx`) | Brand SVG duplicated 3× inline; no icon home | Sidebar, buttons, dialogs, empty states | 16×16 grid, 1.5 stroke, currentColor, one set (§5) | Per-use bespoke styling |
| **`WorkspaceSwitcher`** | No workspace context in shell (audit P1) | Sidebar | Real workspaces (`GET /workspaces`), current selection, active state | Any metadata the API doesn't return |

**Kept as-is (already primitives)**: `Button`, `Badge`, `Avatar`, `Alert`, `FormAlert`, `Field`, `Dialog`, `EmptyState`, `Spinner`, `Skeleton`, `CollapsibleSection`. Styling refreshes only; no API redesign — their tests survive.

**Deliberately NOT extracted**: `MentionAutocomplete` (single-use, complex contract), quick-edit field editors (stay as composition around `QuickEditPopover`), `ActivityRow` (already extracted), comment stream (page-specific document content), `JoinWorkspace`/`Invitations` (feature-scoped).

**Abstraction ceiling**: extract only when a component appears in **two or more pages** or owns a **named visual signature**. Nothing is extracted "for future reuse" without a current second consumer.

### 2.2 Page decomposition

Pages stay route-level owners but shed inline duplication:

- `WorkspacePage` (643 ln): keeps ledger orchestration; labels management moves to a sub-route (§9); invitations become a masthead-invoked dialog reusing existing content; projects rail and saved-views shelf become composed sections on the new primitives; the `saveSignal` counter prop is removed by lifting the "Save view" trigger into `SavedViewsSection`.
- `MyIssuesPage` / `IssuePage`: adopt primitives; logic (`bulkSelection`, `quickEdit`, `myIssuesView`) untouched.
- New: `NotFoundPage` + a top-level error boundary (pure React, no dependency).

---

## 3. CSS / Styling Architecture

**Decision: keep plain hand-written CSS — split by responsibility into multiple files with a single entry import. No Tailwind. No CSS Modules. No CSS-in-JS. No PostCSS.**

Rationale (measured against the audit, not popularity):
- The token system is already semantic and complete; Tailwind fights the token-role model; CSS Modules would force renaming every class string and rewriting 33 test files for zero visual gain.
- The actual pain (audit HIGH) is *file organization*, not scoping. Splitting files and co-locating media queries with their owning components solves it at near-zero migration risk.
- Zero dependency cost; exact visual control preserved; `:focus-visible`, reduced-motion, and coarse-pointer rules carry over untouched.

**Target structure** (all imported once from `styles/index.css` in `main.tsx`):

```
styles/
  tokens.css        (unchanged role model; value edits only per §7)
  base.css          (reset, element defaults, focus-visible, sr-only, reduced motion)
  layout.css        (app shell, sidebar/rail, workbench grid, document layout, scaffolds)
  controls.css      (Button, Input/Select/Textarea/Checkbox, Field, badges, avatar, alerts)
  ledger.css        (LedgerRow/LedgerList, overdue, selection layer, quick-edit row layer)
  overlays.css      (Dialog, SearchDialog, QuickEditPopover, popovers, tooltips)
  pages/            (dashboard.css, workspace.css, my-issues.css, issue.css, auth.css, labels.css)
```

**Rules**: media queries live inside the file that owns the component (no cross-file responsive overrides); each file styles only classes it owns (prefix rule: `ledger-*`, `qe-*`, `filter-*`, `fact-*`, …); `components.css` is deleted when the last consumer migrates (§18 forbids long coexistence); raw hex values remain illegal outside `tokens.css`.

---

## 4. Component Library / UI Primitives

**Decision: Option A — custom components, zero new UI dependencies.** Not headless (Radix/React Aria), not visual (shadcn/MUI/Ant).

- A headless library would buy dialog/combobox/popover behavior — but this codebase *already implements and tests exactly those behaviors* (`Dialog` focus trap/Escape/focus-return, `MentionAutocomplete` combobox, `QuickEditPopover`, `SearchDialog` listbox navigation; 33 test files assert them). Adopting one means rewriting working, tested a11y code and adding an uncontrolled dependency. Rejected.
- A visual library would immediately override or fight the paper/petrol/ledger identity. Rejected outright.
- Custom continuation keeps the visual language fully owned and the bundle flat.

Consequence: the implementation budget includes **porting behavior contracts onto the new primitives** (tests follow the components), and §14 names the accessibility baseline every custom control must meet.

---

## 5. Icon System

**Decision: keep custom inline SVGs, consolidated into one `components/icons.tsx` module. Do not adopt Lucide or any icon library.**

- The current set (~10 glyphs) is hand-drawn on a 16×16 grid with 1.5 stroke, `currentColor`, round caps — matching the hairline editorial language. Lucide's 24-grid/2-stroke default needs restyling anyway; importing a library for ten glyphs is cost without benefit (audit: icon debt is duplication, not quality).
- **Scale**: 16px standard (inline in text/rows); 14px allowed in dense metadata. No larger decorative icons.
- **Appropriate**: sidebar navigation, icon-only buttons (always `aria-label`ed), collapsible carets, search affordance, empty states (sparingly). **Not appropriate**: inside ledger rows (the ledger uses typography + edge bar, not icons), next to every label, as header decoration.
- **Conventions**: icon-only buttons ≥44px on coarse pointers (existing rule), always `aria-label`, always tooltip in rail mode (`data-sidebar-tooltip` convention continues).

---

## 6. Typography System

**Decision: keep the system-ui sans stack and the ui-monospace stack. Refine usage, not fonts.** No webfont is introduced: the editorial character comes from weight/size hierarchy and the mono key treatment, not a branded typeface; adding one would add load latency and asset questions for zero identity gain (system-ui *is* the current intentional look).

Refinements (all within the existing scale):
- Keep: display 30px (page titles), title 18px, strong 16px (issue titles), body 15px, meta 13px, label 12px, mono 13px.
- Tighten: page titles consistently `--font-weight-bold` + `--tracking-tight` (currently inconsistent across mastheads).
- Normalize: buttons/eyebrows/labels always `--text-label`/medium; counts always mono + `font-variant-numeric: tabular-nums` (stats strips, row counts).
- Issue detail masthead: the key + title lockup becomes the canonical pattern (§10) and is copied by search results.

---

## 7. Color System

**Decision: the existing palette survives essentially intact. Petrol `#087f73` and coral `#f05a47` remain the only brand/danger hues; status/priority/label mappings stay.**

- Stays: paper surfaces, 3-tier ink, hairline borders, petrol family, coral family, success/warning/info feedback, badge mappings, 6-color muted label palette, avatar tones.
- Expands: **nothing** — no new accent. The one legitimate addition is a *treatment*, not a color: overdue/selected row states formalized in `ledger.css` from existing coral/petrol tokens (already present, now documented as row contracts).
- Adjustments: none structural; any contrast fix found during implementation is a token-value edit inside `tokens.css`, never an ad-hoc override.

- **Dark mode: explicitly deferred.** Justification: single-theme audit found no contrast failures; tokens are role-based so dark mode remains a future remap; adding a second theme now would double the verification surface (every state × theme) without serving a current user need. Revisit after the redesign ships.

---

## 8. Application Shell / Navigation

**Decision: keep the single-sidebar shell (no top bar) and give it real workspace context.**

Target sidebar anatomy (top → bottom):

1. **Brand** (unchanged).
2. **WorkspaceSwitcher** (new): shows the current workspace name when inside `/workspaces/:id`, opens a listing of *real* workspaces (`GET /workspaces` — the same data Dashboard already renders) plus "All workspaces" (→ `/`). If no workspace is active, it degrades to the existing "Workspaces" link. No fabricated items.
3. **Primary navigation** (unchanged, real): Workspaces (dashboard), Search (opens `SearchDialog`), My Issues. Active states strengthened: when on a workspace page, the workspace item shows the active state and the switcher carries the workspace name.
4. **Contextual workspace navigation** (new, only rendered inside a workspace, only backed by existing functionality): **Issues** (the ledger, i.e. the workspace index) and **Labels** (the new sub-route from §9). Nothing else — no fake settings, no fake members.
5. **Footer** (unchanged): user identity, keyboard-shortcuts help (`?`), sign out.

- **Global search** stays in the shell (`/`, `⌘K`, sidebar button). **Shortcuts** stay surfaced via `?` and the help dialog.
- **Mobile navigation**: keep the verified sidebar → icon rail transformation at 700px. The workspace switcher collapses into a compact current-workspace indicator at the rail top; its popover lists workspaces. Filters on mobile become a collapsible "Filters" disclosure above the ledger (real controls, collapsed by default at 700px) — fixing audit 8.7 without removing functionality.
- Sidebar collapse behavior (manual toggle + rail tooltips) is preserved as-is.

## 9. Information Architecture

**Decisions (reorganization only — no new functionality):**

- **Global level**: Dashboard (workspaces), My Issues, Search. Unchanged.
- **Workspace level**: issues ledger (index), projects rail, saved-views shelf, **Labels page (new route `/workspaces/:workspaceId/labels`)**, invitations (dialog from masthead), new-issue/project creation.
- **Project level**: project scoping of the ledger, per-project filters. Unchanged.
- **Issue level**: document + fact rail + comments + activity. Unchanged.
- **WorkspacePage decomposition** (audit P1 fix): the daily surface keeps masthead → stats strip → projects/saved-views rail → filter bar → ledger. Labels management (a management task, not a daily-workflow task) moves out of the page into the labels sub-route, reachable from the sidebar workspace section and from the projects rail; the existing `LabelsSection` content is reused in the new page. Invitations move behind a quiet "Invite" action in the workspace masthead, presented in the existing `Dialog`. Net effect: the workbench shows only what daily triage needs; management tasks remain one click away.
- **Saved Views** stay in the projects rail (they are workspace-scoped ledger presets — relocation would imply cross-workspace scope the data model doesn't have).
- **URL-encoded filter state (new)**: workspace route gains query params for project + filters + active view (`?project=&status=&priority=&label=&view=`); My Issues gains `?q=&status=&priority=&sort=&closed=`. Saved Views remain the named-preset layer on top; URLs are the shareable ad-hoc layer. Both filter models keep their existing application logic (`savedViewFilters`, `myIssuesView`, server params) — the UI contract is unified by `FilterBar`, not by merging the models (merging would change API behavior, which is out of scope).
- **Dashboard** stays the workspace ledger + join/create. It remains intentionally sparse.

---

## 10. Issue Ledger Architecture (canonical `LedgerRow`)

The ledger is the signature. `LedgerRow` becomes the single implementation; pages configure it, never re-implement it.

**Anatomy (left → right, one ruled row):**

1. **Selection slot** (optional): checkbox column; present only when bulk mode is available. Rendered by `LedgerRow`, owned by the page.
2. **Priority edge-bar**: 3px left border in the priority token; structural, always rendered.
3. **Ticket key**: mono, `issueKey()` output, faint ink. Structural; never omitted (visibility is a CSS decision per variant, not per page — the key stays visible at all current breakpoints).
4. **Title**: `--text-strong`, medium/semibold. Truncates with ellipsis; full title in `title` attr.
5. **Context caption slot** (optional): cross-workspace caption (My Issues), project caption (search), or overdue tag. One slot only — pages may not add bespoke metadata lines.
6. **Metadata cluster slot** (optional): status badge, priority badge (compact variant), up to 2 label badges, assignee chip (avatar + name), due date. Order fixed by the component; the page supplies content via typed props, not arbitrary children.
7. **Quick-edit slot** (optional): the existing `QuickEditSelect/Labels/Date` hosts replace the corresponding metadata values. The row stays a reading surface; editors appear on demand (existing behavior preserved).
8. **Chevron** `→`: trailing directional affordance. Structural, `aria-hidden`.

**States (all owned by the component, tested once):** default; hover (paper-hover background, chevron nudge — hover-only on fine pointers); keyboard focus (visible ring on the row link); selected (petrol treatment, additive to the signature); overdue (coral attention treatment); loading (row-height skeleton via `LedgerList`); empty (`LedgerList` renders `EmptyState` with a real action, e.g. create issue / clear filters).

**Variants (props, not subclasses):** `default` (workbench/My Issues), `compact` (SearchDialog — tighter padding, reduced metadata), `context="workspace" | "cross-workspace"` (controls the caption slot). Nothing else; new variants require a new entry in this document.

**Interactivity contract:** the row remains a single link/navigational element (existing pattern); interactive widgets inside it (checkbox, quick-edit triggers) stop propagation and are ≥44px on coarse pointers. Focus order: checkbox → quick-edit triggers (DOM order) → row link. The component owns nothing about how issues are fetched, filtered, or mutated.

**`LedgerList` contract:** `<ul>` with `ledger-list` semantics; props: `rows`, `loading` (renders `SkeletonRows`), `empty` (title/description/action), optional caption (result count, mono). Pagination is explicitly out of `LedgerList`'s scope (§21: ledger pagination is deferred — it is a feature/data-layer change, not a visual one).

---

## 11. Forms and Controls

**Reusable control system** (all built on tokens; native elements wrapped by components; existing a11y contracts preserved):

| Property | Decision |
|---|---|
| Height | Standard 36px (`min-height: 2.25rem`, matches current `.btn`); dense/ledger contexts may use a 32px compact variant; touch targets ≥44px on coarse pointers via padding |
| Radius | `--radius-sm` (4px) everywhere; pill only for badges |
| Border | `--border-subtle` default; `--border-strong` on hover; `--border-accent` + focus ring on focus |
| Focus | Global `:focus-visible` outline (2px petrol, offset 2) — unchanged; no per-control reinvention |
| Disabled | `opacity: .55` + `cursor: not-allowed` (current behavior) |
| Pressed | `translateY(1px)` (current `.btn` convention, extended to controls) |
| Error | `aria-invalid` + coral border + `FormAlert` association via `aria-describedby`; error receives focus (existing `useFocusAlert` contract) |
| Loading | `Spinner` (sr-only label) in buttons; `disabled` while pending; no skeleton controls |
| Keyboard | Native semantics only: `<button>`, `<select>`, `<input type=checkbox>`; custom popovers keep Escape-cancel + focus-return (`QuickEditPopover` contract) |

- **Dialogs**: `Dialog` (behavior unchanged) + `ConfirmDialog` variant for destructive confirms; `dialog-form`/`dialog-actions` become composable parts of the dialog family instead of per-dialog class re-implementations.
- **Toggles**: the only toggle-like control today is the include-closed checkbox; it stays a checkbox (no switch component is invented).
- **Do not over-style**: no floating labels, no custom select dropdowns (native `<select>` retained everywhere; a custom listbox is out of scope), no animated inputs.

---

## 12. Page Composition System

Four canonical layouts; every page must be an instance of one:

1. **`AuthLayout`** — centered `auth-card` on paper. Login, signup.
2. **`WorkbenchLayout`** — shell sidebar + masthead/stats + optional left rail (projects, saved views) + main column (FilterBar + LedgerList). Dashboard (no rail), My Issues (no rail, with stats strip), Workspace (full), Labels (no rail).
3. **`DocumentLayout`** — issue detail: masthead (key + title lockup) → description → comments → activity; `FactRail` right; stacks below 1024/900.
4. **`Overlay`** — `Dialog` / SearchDialog patterns over any layout ("the ledger, lifted").

No further layout abstractions are created; `PageHeader` + `FactRail` are the shared building blocks *within* layouts.

---

## 13. Responsive System

**Decision: keep the existing verified breakpoint set; add nothing.**

| Breakpoint | Behavior |
|---|---|
| ≥1280px | Wide gutter; workbench grid uses fluid width up to `--layout-max-width` with the ledger column allowed to grow; issue document keeps its reading measure |
| 1024–1279px | Workbench two-column intact; standard gutter |
| 900–1023px | Workbench columns begin collapsing (existing verified rules) |
| 700–899px | Rail stacks above ledger; issue detail single column |
| ≤700px | Sidebar → icon rail; workspace switcher → compact indicator; filter bar → collapsed "Filters" disclosure; ledger rows wrap per existing verified rules; dialogs near-fullscreen |
| 600px | Activity row wrap (existing) |
| ≤375px | Very-narrow floor (existing rules); no horizontal overflow |
| Pointer | `(pointer: coarse)`: ≥44px targets (existing rules extended to new controls); `(hover: none)`: hover affordances disabled, per existing pattern |

---

## 14. Accessibility Strategy

**Baseline: nothing regresses; existing contracts become the architectural tests of the new primitives.**

- Keyboard: every new control is keyboard-operable with native semantics; ledger rows keep their single-link model; popover Escape/focus-return contracts carry over verbatim.
- Focus: global `:focus-visible` unchanged; Dialog focus trap/return unchanged; `role="alert"` + focus-on-error unchanged (`FormAlert`, `useFocusAlert`); row-local quick-edit errors keep focus behavior.
- Semantics: `LedgerList` renders a real `<ul>`; `FactRail` a real `<dl>`; nav landmarks (`aria-label="Primary"`/"Personal") preserved; skip link preserved.
- Additions (gap fixes from audit 8.8): `aria-live="polite"` region for bulk-apply and quick-edit outcomes; `aria-busy` on containers while skeletons show; `aria-expanded` on `QuickEditPopover` triggers (a full custom listbox pattern remains out of scope — native controls are kept).
- Reduced motion: global kill-switch unchanged; any new motion (e.g., disclosure animation) must define a reduced-motion static state.
- Coarse pointer: ≥44px rules extend to all new controls and the workspace switcher.
- Contrast: palette unchanged; any value change is a `tokens.css` edit verified against AA.
- **Tests that become architectural contracts** (must stay green, adapted only where structure changed): `tests/accessibility/core.test.tsx` (axe), `layout.test.tsx` + `layout-shortcuts.test.tsx` + `layout-search.test.tsx`, `issue-page.test.tsx`, `bulk-toolbar.test.tsx`, `quick-edit*.test.tsx`, `search-dialog.test.tsx`, `keyboard-shortcuts-dialog.test.tsx`, `mention-*.test.tsx`, `saved-views-section.test.tsx`, `labels.test.tsx`, `dashboard.test.tsx`, `my-issues-page.test.tsx`, `workspace-page.test.tsx`, plus pure-logic tests (`shortcuts`, `kbd`, `modal-layer`, `bulk-selection`, `saved-view-filters`, `my-issues-view`, `issueKey`, `is-overdue`, `initials`) which should pass **unchanged**.

---

## 15. Visual Language Strategy

`VISUAL_LANGUAGE.md` stays the single source of truth and is updated **incrementally per workstream, in the same commit as the change** — never retroactively, never left stale:

- **Survives in principle**: core direction, ledger signature, petrol/coral/status/priority/label systems, typography hierarchy, spacing/radius/elevation rules, accessibility & data-honesty sections, "what NOT to do".
- **Gets rewritten**: §14 Sidebar (workspace switcher + contextual workspace nav), §31 Responsive (consolidated breakpoint table + disclosure pattern), §29 Inputs (component anatomy instead of element-selector description), §36–37 New Component/Page Rules (now name the real primitives and the four layouts).
- **New sections required**: canonical `LedgerRow`/`LedgerList` contract (anatomy, variants, states — §10 above); workspace switcher; labels page; URL-encoded filter state; `aria-live`/`aria-busy` conventions; icon module conventions.

- **Deprecated**: references to per-page ledger markup and the `saveSignal` pattern; spec-numbering ambiguities corrected to folder names.

---

## 16. Design System Documentation

`VISUAL_LANGUAGE.md` remains the one document (no separate storybook/docs site in scope). It must document, implementation-grounded with exact token values: tokens; typography; colors; spacing; radii; shadows; control anatomy + states; ledger anatomy/variants/states; navigation (shell, switcher, rail); the four page layouts; responsive table; interaction states; accessibility conventions (focus, alerts, live regions, coarse-pointer); and the icon module. Each section names its owning CSS file and component file so drift is detectable.

---

## 17. Dependency Policy

**Decision: zero new runtime dependencies. Zero new dev dependencies.** The current set (react, react-dom, react-router-dom, `@mini-issue-tracker/shared`, `@axe-core/react`, testing libs, vite, vitest, TS) is sufficient for every decision above.

Rejected, with reasons: Tailwind (fights token roles; large migration), CSS Modules (rename churn for a scoping problem we don't have), Radix/React Aria (would replace tested a11y code), Lucide (ten glyphs don't justify it), react-query/SWR (pages refetch wholesale today; a redesign must not change data behavior), form libraries (native forms + `ApiError` field mapping already work), state stores (no cross-page state need beyond auth), date libraries (string dates + UTC compare already in `isOverdue`).

Going forward: any proposed dependency must name the problem, why existing code can't solve it, and its bundle/a11y/maintenance cost — recorded in this folder before adoption.

---

## 18. Migration Strategy

**Incremental, workstream-ordered, no big-bang.** Each workstream leaves the app fully working, tests green, and is a separate reviewable pass:

1. **Foundations** — split CSS into the §3 structure (mechanical move, no visual change); add `styles/index.css`; add the `Icon` module (replace the 3 duplicated brand SVGs); add `Input`/`Select`/`Textarea`/`Checkbox` with tests; add `PageHeader`; add `NotFoundPage` + error boundary.
2. **Ledger** — build `LedgerRow`/`LedgerList` with tests; migrate SearchDialog first (smallest consumer), then MyIssuesPage, then WorkspacePage, then the Dashboard variant. Delete per-page row markup in the same pass.
3. **Shell** — WorkspaceSwitcher + contextual workspace nav + active states; URL-encoded filter state (workspace + My Issues).
4. **Workbench decomposition** — labels sub-route; invitations dialog; `saveSignal` removal; `FilterBar` adoption on both ledgers.
5. **Issue detail** — `FactRail`, `ConfirmDialog`, masthead lockup, `aria-live` additions.
6. **Auth + Dashboard polish; responsive sweep** (mobile filter disclosure, switcher indicator); final cleanup.

**Coexistence rule**: old and new patterns may coexist *between* workstreams (un-migrated pages keep working off `components.css`), but **never within a workstream** — a migrated surface must not keep its old markup. No new code may add to `components.css` from workstream 2 onward; it is deleted at the end of workstream 6. This prevents two competing design systems by making the new one the only legal target, workstream by workstream.

---

## 19. Testing Strategy

- **Always green**: full frontend `vitest` suite (behavior tests adapted only where structure changed — e.g., querying `LedgerRow` instead of page markup), `test:a11y` (axe), `typecheck`, `lint`, `build`; backend/shared tests untouched and green.
- **New tests required per workstream**: primitives (`Input`/`Select`/`Checkbox`; `LedgerRow` states incl. selected/overdue/compact; `LedgerList` loading/empty; `FilterBar` controlled props; `WorkspaceSwitcher`; `ConfirmDialog`; labels route).
- **Responsive verification**: asserted via Testing Library where feasible (existing patterns); breakpoint behavior is additionally verified manually in the browser during each workstream. **No screenshot or visual-regression tooling is added** (dependency policy), and no automated visual claim is made.
- **Keyboard/reduced-motion verification**: existing shortcut and dialog tests extended to the shell changes; reduced motion covered by the global CSS kill-switch plus a static-state rule per new animated disclosure.
- The honest-reporting rule carries over: no verification claims beyond what was actually run.

---

## 20. Acceptance Bar

"Redesign complete" means **all** of:

1. Every page is an instance of one of the four canonical layouts; no page-local reimplementations of masthead/ledger/filter anatomy.
2. Zero duplicated ledger markup: `LedgerRow`/`LedgerList` are the only implementations; SearchDialog, WorkspacePage, MyIssuesPage, Dashboard all consume them.
3. All controls route through the control primitives; no element-selector styling remains; `components.css` no longer exists.
4. Media queries co-located per component file; no cross-file responsive overrides; no raw hex outside `tokens.css`.
5. Zero new runtime/dev dependencies; bundle not materially larger (no webfonts, no icon library).
6. Shell shows real workspace context (switcher, contextual workspace nav, active states); URL-encoded filter state survives reload/back.
7. WorkspacePage shows only daily-workflow surfaces; labels and invitations remain one click away via documented routes/dialog.
8. Full Phase 1–3 feature parity verified by the §14 contract test list — no feature regressions.
9. Accessibility: axe green; §14 baseline (incl. `aria-live`/`aria-busy` additions) verified; coarse-pointer targets intact.
10. Responsive behavior intentional at 1280/1024/900/700/600/375 + coarse pointer; no horizontal overflow at any width.
11. `VISUAL_LANGUAGE.md` fully updated to describe the shipped system, section by section, with owning files named.
12. Lint/typecheck/build clean; dark mode still deferred; no fabricated data anywhere.

---

## 21. Out of Scope (deliberate decisions)

**Out**: backend rewrite; database/schema changes; new features (notifications, comment edit/delete, recently viewed, member management, full settings pages); dark mode (deferred, §7); ledger pagination (data-layer change; `LedgerList` is only kept pagination-ready); replacing React or the router; Tailwind/CSS Modules/any CSS framework; component or headless libraries; icon libraries; webfonts; data-fetching/state libraries; realtime; analytics; mobile app; i18n; theming beyond the existing light theme; visual-regression tooling.

**In (explicitly, because they are reorganization, not features)**: labels sub-route; invitations dialog; workspace switcher; URL filter state; `NotFoundPage`; error boundary; mobile filter disclosure. Each uses only existing APIs and data.

---

## 22. Final Recommendation

1. **Stack**: React 18 + TS + react-router-dom 6 + Vite — unchanged.
2. **Components**: 100% custom primitives; extract `LedgerRow`, `LedgerList`, `FilterBar`, `PageHeader`, `Input`/`Select`/`Textarea`/`Checkbox`, `FactRail`, `ConfirmDialog`, `WorkspaceSwitcher`, `Icon`; keep all existing primitives; abstraction ceiling enforced (§2.1).
3. **Icons**: custom 16px/1.5-stroke inline SVGs in one `icons.tsx` module; no icon library.
4. **CSS**: plain CSS split into `tokens/base/layout/controls/ledger/overlays/pages/*`, media queries co-located, entry via `styles/index.css`; `components.css` deleted at the end.
5. **Design system**: the existing warm-paper/petrol/coral editorial ledger language, sharpened — no new colors, no new fonts, no new accent; typography and control refinements only.
6. **Shell**: single sidebar + `WorkspaceSwitcher` + contextual workspace nav (Issues, Labels); icon rail ≤700px; search (`/`, `⌘K`) and `?` help unchanged.
7. **Ledger**: one canonical `LedgerRow` (slots, variants, states per §10) + `LedgerList`; pagination deferred.
8. **Responsive**: keep 1280/1024/900/700/600/375 + pointer queries; mobile filter disclosure; no new breakpoints.
9. **Accessibility**: current contracts immutable; add `aria-live` mutation region, `aria-busy`, `aria-expanded` on popover triggers; axe suite is the gate.
10. **Documentation**: `VISUAL_LANGUAGE.md` updated in the same commit as each visual change; remains the single source of truth.
11. **Migration**: six incremental workstreams (§18), no big-bang; no dual implementations within a workstream; old CSS file deleted at the end.
12. **Not adopting**: Tailwind, CSS Modules, CSS-in-JS, Radix/React Aria/shadcn/MUI/Ant, Lucide, webfonts, react-query/SWR/Redux/Zustand, form libraries, date libraries, any new feature scope.

---

*End of Stage 2. No implementation, no code, no dependency changes, no VISUAL_LANGUAGE.md edits. Awaiting approval for Stage 3 (implementation planning).*
