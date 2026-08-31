# Stage 1 — Current State Audit (Frontend Redesign)

> **Status**: Audit only. No implementation, no design decisions, no stack choices.
> Every claim in this document is grounded in code inspected on branch `ui-re-design`
> at commit `2bf0b92` ("fix: the duplicated mention name issue").
>
> Inspected: `AGENTS.md`, `frontend/VISUAL_LANGUAGE.md` (all 1282 lines, §1–§42),
> `frontend/package.json`, all 43 files in `frontend/src/**`, all 3,717 lines of
> `frontend/src/styles/*.css`, `frontend/tests/**` (33 test files), spec folders
> `001`–`011`, recent git history.

---

## 1. Technology Baseline (verified)

| Concern | Current choice |
|---|---|
| Framework | React 18.3, TypeScript 5.5 |
| Routing | `react-router-dom` 6.26 (nested layout route) |
| Build | Vite 5.4 |
| Styling | Hand-rolled plain CSS — `tokens.css` (182 ln), `base.css` (87 ln), `components.css` (3,448 ln). No framework, no CSS modules, no CSS-in-JS. |
| UI/icon library | None. All icons are inline 16×16 SVGs written by hand in components. |
| Data fetching | Bare `fetch` wrapper (`src/api/client.ts`, 81 ln). No react-query/SWR. |
| State | One React context (`context/auth.tsx`). Everything else is per-page `useState`/`useEffect`. No global store, no cache. |
| Forms | Native `<form onSubmit>`, native `<select>`, native `input[type=date]`. No form library. |
| Testing | Vitest 2 + Testing Library + `vitest-axe` + `@axe-core/react` (dev runtime a11y). 33 test files incl. `tests/accessibility/core.test.tsx`. |
| Scripts | `dev`, `build` (tsc + vite), `test`, `test:a11y`, `lint` (eslint src), `typecheck`. |

**Implication**: the frontend is small (~8.5k lines TSX, 3.7k lines CSS). A redesign
is not a rewrite-scale effort; it is disciplined restyling of a well-tokenized
system plus judgment about CSS architecture (see §Design Debt).

## 2. Pages / Routes Inventory

Defined in `frontend/src/App.tsx`:

| Route | Page | Purpose |
|---|---|---|
| `/login` | `LoginPage` (90 ln) | Sign-in. Centered `auth-card`, brand mark, field-level error focus (`useFocusAlert`). |
| `/signup` | `SignupPage` (124 ln) | Name/email/password/confirm. Same auth-card pattern. |
| `/` (index) | `DashboardPage` (129 ln) | Workspace list as a **ledger** (`ledger-row` links with brand mark, Owner/Member badge, chevron) + "New workspace" dialog + `JoinWorkspace` section. |
| `/my-issues` | `MyIssuesPage` (514 ln) | Cross-workspace personal ledger: stats strip (OPEN / IN PROGRESS / OVERDUE + mono total), include-closed toggle, filter/sort bar (text, status, priority, sort asc/desc), bulk select, quick edit. |
| `/workspaces/:workspaceId` | `WorkspacePage` (643 ln) | The workbench: workspace masthead, statistics strip, projects rail, saved-views shelf, labels management (collapsible), project dialog, per-project filter bar, issue ledger with bulk selection + quick edit, invitations, new-issue dialog. |
| `/workspaces/:workspaceId/issues/:issueId` | `IssuePage` (592 ln) | Issue detail: back-link, masthead with monospace key, description, comment stream + composer with mention autocomplete, fact rail, activity panel (paginated, collapsible), edit dialog, delete confirm. |

Notable: **no 404 route**; **no settings pages** (Phases 4–5 not implemented, matching the brief); **no notifications UI**.

## 3. Layouts

- **App shell** (`Layout.tsx`, 196 ln): skip-link → collapsible `app-sidebar` (brand, "Workspaces", Search button, "My Issues", footer with user identity, shortcuts help, sign out) → `app-main` (Outlet). Hosts `SearchDialog` + `KeyboardShortcutsDialog`. Global shortcuts: `/`, `⌘/Ctrl+K`, `?`, `G D`, `G M`.
- **Sidebar**: icon + text; collapses to icon rail (`app-sidebar--collapsed`); tooltips (`data-sidebar-tooltip`) appear only in rail mode; same icon-rail language reused responsively.
- **Workbench layout**: masthead → statistics strip → two columns (projects rail + saved-views shelf | filter bar + ledger). Collapses at 1024/900px.
- **Issue detail layout**: main column (masthead, description, comments, activity) + right fact rail (`fact-*` definition list). Stacks on mobile.
- **Auth layout**: standalone centered `auth-card`, no shell.

## 4. Component Inventory

**Primitives**: `Button` (primary/secondary/ghost/danger + block), `Badge` (16 tones: 3 status, 4 priority, 6 label colors, neutral/accent/danger), `Avatar` (deterministic 6-tone initials; `decorative`, `small`), `Alert` (error/success/info, forwardRef), `Spinner`, `Skeleton`/`SkeletonRows`, `EmptyState`.

**Form controls**: `Field` (label wrapper), `FormAlert` (field-level error w/ focus), `IssueForm` (create/edit, 171 ln), native `input`/`select`/`textarea` styled globally — **there is no Input or Select component**.

**Dialogs/overlays**: `Dialog` (focus trap, Escape, focus return, registers in `modalLayer.ts`), `SearchDialog` (250ms debounce, abortable, keyboard-navigable result list, "the ledger, lifted"), `KeyboardShortcutsDialog` (grouped key-caps), `ProjectDialog`, `QuickEditPopover` (anchored hairline surface), `BulkToolbar` (action select + value + confirm-delete + apply).

**Navigation**: `Layout` (sidebar), `CollapsibleSection` (localStorage-persisted; used for labels management and activity panel).

**Issue-related**: ledger rows are **not a component** — inline JSX repeated in `WorkspacePage`, `MyIssuesPage`, `SearchDialog`, and (variant) `DashboardPage`, each hand-assembling `ledger-row` + `issue-key` + `Badge` + `card-assignee` + `ledger-chevron`. This is the largest duplication in the codebase.

**Quick edit**: `quickEdit.ts` (state machine), `QuickEditSelect` (status/priority/assignee), `QuickEditLabels`, `QuickEditDate`, `QuickEditPopover`. Mounted per-row in both ledgers; read-only degradation when a row's workspace data isn't loaded (documented, honest).

**Workspace/project**: `Invitations`, `JoinWorkspace`, `LabelsSection` (CRUD + color-picker swatches), `SavedViewsSection` (create/rename/delete/apply; owns its dialogs; driven by a `saveSignal` counter from the page).

**Collaboration**: comment composer + `MentionAutocomplete` (accessible combobox), `ActivityPanel`/`ActivityList`/`ActivityRow` (paginated), mention rendering via `renderMentionedBody` in `IssuePage`.

**Feedback states**: `EmptyState`, `Alert`, `FormAlert`, `SkeletonRows`, `Spinner`, row-local quick-edit errors (`qe-row-alert`), saved-view staleness note, bulk disabled note.

## 5. Styles Architecture

- `tokens.css` — single `:root`, semantic roles only: surfaces/borders/3-tier text, petrol family (`#087f73`), coral family (`#f05a47`), success/warning/info, badge mappings, avatar tones, type scale (`--text-display` 30px → `--text-mono` 13px), 4px spacing scale, `--layout-max-width: 1440px`, `--reading-measure: 68ch`, radii (2/4/6/8/pill), shadows xs–lg (used sparingly), focus ring, motion (120/180ms).
- `base.css` — reset, element defaults, `:focus-visible` 2px petrol outline offset 2, `.sr-only`, global `prefers-reduced-motion` kill-switch.
- `components.css` — **one 3,448-line file** organized by comment banners (Buttons → … → Quick Edit → Search dialog). Verified responsive layers:
  - `(max-width: 700px)` ×4 — sidebar→icon rail, masthead, ledger wrapping, filter-bar stacking
  - `(max-width: 375px)` — very narrow
  - `(max-width: 900px)` / `(max-width: 1024px)` — workbench column collapse
  - `(min-width: 1280px)` — wide-gutter desktop details
  - `(min-width: 600px)` / `(max-width: 599px)` — activity row
  - `(hover: hover) and (pointer: fine)` — hover-only affordances; `(pointer: coarse)` ×3 — 44px touch targets
  - `prefers-reduced-motion: reduce`

## 6. Utilities & Data Layer

| Utility | Purpose |
|---|---|
| `issueKey.ts` | `#ABC123` — first 6 alnum chars of the UUID uppercased; used in ledgers, search, masthead. |
| `isOverdue.ts` | dueDate < today (string compare, UTC) && status ≠ Closed. |
| `labelTone.ts` / `initials.ts` | Label→BadgeTone; avatar initials. |
| `bulkSelection.ts` | Immutable Set helpers incl. `partitionByWorkspace` (cross-workspace bulk blocked). |
| `myIssuesView.ts` | Client-side filter/sort for My Issues. |
| `savedViewFilters.ts` | Resolve/validate view filter snapshots + staleness notes. |
| `shortcuts.ts` + `useKeyboardShortcuts.ts` | Centralized registry: typing guards, modal suppression, `G`-sequence engine. |
| `kbd.ts` / `modalLayer.ts` / `quickEdit.ts` | Platform key display; open-modal counter; one-field-at-a-time quick-edit state. |

`api/client.ts`: fetch wrapper, `ApiError` (status/code/fields), typed helpers for bulk, abortable search, members, saved views. Cookie session; `context/auth.tsx` bootstraps via `/auth/me`.

**State management verdict**: fetch-then-local-state everywhere; every page refetches on mount; after bulk apply / quick edit, lists reload wholesale. No cache invalidation strategy. Acceptable at this scale but relevant to any redesign adding heavier interactivity.

## 7. Feature → UI Surface Map (verified, exhaustive)

| Feature | Page / Surface | Components | Interactions |
|---|---|---|---|
| Authentication | `/login`, `/signup` | `LoginPage`, `SignupPage`, `Field`, `FormAlert`, `useFocusAlert` | Submit, field-error focus, protected routes, sidebar signout. |
| Workspaces | `/` + shell | Dashboard ledger, create dialog, `JoinWorkspace`, `Invitations` | Create (dialog), join by code, open, Owner/Member badge, invite-code display on workspace page. |
| Projects | Workspace left rail | `ProjectDialog`, `CollapsibleSection` | Create/edit project dialog; select project → scoped ledger. |
| Issues | Workspace + My Issues | `IssueForm` dialog, inline ledger rows, `IssuePage` | Create, browse, open detail, edit (dialog), delete (confirm dialog). |
| Comments | Issue detail | Composer, `MentionAutocomplete` | Post comment; `@` combobox (arrow keys, Enter); mention rendering in stream. |
| Labels | Workspace section + rows + detail | `LabelsSection`, `Badge`, color swatches | CRUD labels; assign via IssueForm, quick edit, bulk; 6-color muted palette; filter by label. |
| Advanced Filters | Workspace ledger + My Issues | filter bar (text, status, priority, label; sort on My Issues) | Server params (workspace) vs client-side (My Issues); result count; Clear filters. |
| My Issues | `/my-issues` | stats strip, ledger, filter/sort bar | OPEN/IN-PROGRESS/OVERDUE counts (informational, never filter); include-closed toggle; cross-workspace captions. |
| Overdue | Ledgers + search | `isOverdue` + coral row treatment | Coral attention inside rows; counted in My Issues stats. |
| Activity / History | Issue detail | `ActivityPanel/List/Row` | Paginated audit trail; collapsible (persisted). |
| Bulk Actions | Workspace ledger + My Issues | checkbox column, `BulkToolbar`, `bulkSelection.ts` | Select rows / select visible; status, priority, assignee, labels, delete-with-confirm; cross-workspace disabled with honest note. |
| Global Search | Shell (sidebar, `/`, `⌘K`) | `SearchDialog` | Debounced abortable search; keyboard-navigable lifted-ledger results. |
| Saved Views | Workspace projects column | `SavedViewsSection` | Save current filters, apply, rename, delete; staleness note on schema change. |
| Quick Edit | Both ledgers | `QuickEditSelect/Labels/Date/Popover`, `quickEdit.ts` | Click value → commit via PATCH; one field at a time; row-local error; read-only degradation. |
| Keyboard Shortcuts | Shell + Issue detail | `useKeyboardShortcuts`, `KeyboardShortcutsDialog` | `/`, `⌘/Ctrl+K`, `?`, `G D`, `G M`; Edit/Delete/Comment-focus on issue page; typing + modal guards. |
| Mentions | Issue comments | `MentionAutocomplete`, mention spans | `@Name` autocomplete; structured records; petrol emphasis. |

Not implemented (per brief): Notifications, Comment edit/delete, Recently viewed, Workspace/Project settings, Member management.

## 8. Current UI/UX Problem Audit

### 8.1 Visual hierarchy
- **P1 — WorkspacePage is overloaded**: masthead, stats, projects, saved views, labels management, invitations, filter bar, bulk toolbar, ledger on one page. Labels management and invitations are management UI living inside the daily-work surface, diluting ledger focus.
- **P2 — Statistics strips are pure metadata** yet visually strong; they never filter, so their weight exceeds the filter bar (which *does* filter).
- **P2 — Issue detail fact rail**: status/priority are functional `<select>`s embedded in a definition list — editable fields styled as read-only facts, with no visible editable cue (the opposite of quick edit, which has a dotted cue).

### 8.2 Layout
- **P1 — `--layout-max-width: 1440px` cap**: on wide monitors the workbench doesn't use available width while the ledger wants it; the cap favors the issue document, costs the workbench.
- **P2 — Saved Views discoverability**: the shelf lives inside the projects rail; no global affordance.
- **P2 — Inconsistent content measures** across auth card, dashboard, workbench, issue doc; only `--reading-measure: 68ch` is tokenized.

### 8.3 Components
- **CRITICAL — No `LedgerRow` component.** The signature pattern is copy-pasted JSX in WorkspacePage, MyIssuesPage, SearchDialog (plus a Dashboard variant), with subtle drift (workspace captions only in My Issues; label badges capped at 2 only there). Every visual tweak must be replicated by hand.
- **HIGH — No Input/Select components**: inputs/selects styled by global element selectors with ad-hoc class overrides.
- **MEDIUM — Dialog-internal form layout** (`dialog-form`, `dialog-actions`) re-implemented per dialog instead of composed.
- **LOW — Sidebar/toggle/quick-edit triggers are raw `<button>`s with bespoke classes** beside the `Button` component — acceptable but inconsistent variant semantics.

### 8.4 Navigation
- **P1 — No workspace switcher in the shell**: switching workspaces is two hops through `/`; the sidebar's "Workspaces" link is the only path, and the sidebar has no current-workspace context.
- **P2 — Project/filter/view state is page-local**: reload loses selected project; no URL encoding of filter state (Saved Views compensate only within one workspace).
- **P3 — No issue-jump shortcut beyond search; `G` sequences cover only Dashboard/My Issues.**

### 8.5 Issue workflow friction
- Create → Browse: fine (dialog-based creation returns to ledger).
- Filter → Search: two different filter models (verified in Spec 009 research §3.1) with visually consistent but logically duplicated UI.
- Quick Edit: strong on both ledgers; **absent from SearchDialog results** (read-only).
- Bulk: good; but no persistent "N selected" affordance when the toolbar scrolls away on long ledgers.
- Edit: full edit dialog over the detail page is fine, but focus isn't returned to the initiating fact-rail field.

### 8.6 Information density
- Ledgers: correctly dense — the strongest surfaces. Issue detail: appropriately airy. Dashboard/auth: sparse relative to the workbench. Verdict: inconsistent between sparse and dense pages, not problematically within any page.

### 8.7 Responsive UX
- Verified intentional handling: sidebar→icon rail at 700px, workbench stacking at 900/1024, activity-row wrap at 600, coarse-pointer 44px targets, 375px floor.
- **P2 — Mobile filter bars** stack 3–4 selects vertically above the ledger; results require scrolling.
- **P2 — Wrapped ledger rows + quick-edit triggers** produce uneven tap targets (mitigated by coarse-pointer rules but not eliminated).
- **P2 — No mobile story for workspace switching** (same root cause as 8.4).
- No horizontal-overflow hazards found in the reviewed rules.

### 8.8 Accessibility
Strengths (verified): skip link; global `:focus-visible`; Dialog focus trap + Escape + focus return; `role="alert"` error focus patterns; axe tests (`tests/accessibility/core.test.tsx`) + dev `@axe-core/react`; reduced-motion kill-switch; 44px coarse-pointer rules; sr-only spinner labels; `aria-expanded/controls` on collapsibles; mentions combobox; keyboard-navigable search results.

Gaps: fact-rail selects lack an editable cue; `QuickEditPopover` is a `role=group` div, not a listbox/combobox pattern; no `aria-live` for bulk apply outcomes; skeletons not wired to `aria-busy` on containers; label palette contrast is light-theme-only; no dark mode despite role-remap-ready tokens.

---

## 9. Visual Language Audit (`VISUAL_LANGUAGE.md` vs implementation)

The document is exceptionally implementation-grounded (42 sections) and, in spot checks, matches the code: token values match `tokens.css`; ledger anatomy (§19), quick-edit badge editors (§41.5), saved-views shelf (§41), keyboard help (§41.6), and the "ledger, lifted" search overlay (§19b) all exist as described, with supporting tests.

1. **Consistently implemented**: semantic token usage; petrol/coral discipline; ledger signature (priority edge-bar + mono key + chevron); near-zero elevation; radii restraint; focus/reduced-motion rules; stats strips; masthead patterns; empty states.
2. **Inconsistently implemented**: ledger row metadata drift between pages (§8.3); no Input/Select components despite §29 describing input anatomy; per-dialog form layout duplication.
3. **Outdated / evolving**: §31 Responsive Design predates the quick-edit and search-overlay coarse-pointer additions (those live in later sections instead of being folded back into §31). Spec numbering references in the doc ("Spec 009" for both Saved Views and Keyboard Shortcuts; two `010` folders) are genuinely ambiguous in the repo itself.
4. **Unnecessary constraints for a redesign**: the "one page should inherit existing structure" rules (§36–38) served feature-addition, not redesign; the hard 1440px cap is documented but worth re-examining; §35 "what NOT to do" should survive as guardrails.
5. **Should survive the redesign**: ledger signature; warm-paper + petrol + coral semantic system; token architecture (role-based, dark-mode ready); typography hierarchy; stats strips; masthead/back-link; "lifted ledger" overlay concept; accessibility behaviors; data honesty.
6. **Should be retired**: per-page hand-assembled ledger rows; global element-selector input styling; the single monolithic `components.css` organization.
7. **Should be evolved**: responsive section into a first-class breakpoint scale; input/badge/button component anatomy into actual components; possibly the workspace shell (persistent workspace context) — which the doc does not yet describe at all.

---

## 10. Design Debt Audit

| Severity | Finding | Why |
|---|---|---|
| CRITICAL | Ledger row markup duplicated in 3+ pages with behavioral drift | Highest-frequency UI; every redesign change multiplies; drift already observable |
| HIGH | Single 3,448-line `components.css` with page and component rules interleaved; multiple separate `@media` blocks for the same breakpoint scattered through the file | Any restyle risks collateral damage; no component-scoped ownership |
| HIGH | No Input/Select primitives; global element-selector styling | Ad-hoc overrides accumulate (`fact-value select`, filter selects, dialog selects) |
| MEDIUM | Dashboard page reuses `app-brand-mark` SVG inline (copied 3×: sidebar, dashboard rows, auth pages) | Icon duplication; no icon module |
| MEDIUM | `saveSignal` counter prop pattern between WorkspacePage and SavedViewsSection | Component-coupling hack replacing a shared state approach |
| MEDIUM | Quick edit mounted per-row in two pages with parallel error/busy state logic | Same state machine duplicated at page level |
| LOW | One-off classnames near the system (`qe-row-alert`, `card-assignee`, `dashboard-join`, `workspace-skeleton`) | Token-compliant but unmapped in the docs' component taxonomy |
| LOW | Spec folder numbering collisions (`009`, `010` ×2) | Documentation drift risk; flagged in spec 011 itself |
| LOW | No `Input`, `Select`, `LedgerRow`, `PageHeader` components; page mastheads re-implemented per page | §37 tells authors to reuse patterns that are copy-paste, not components |


---

## 11. Architecture Audit (redesign suitability)

**Strengths**
- Clear separation: pages / components / lib / api / context / styles; shared types come from `@mini-issue-tracker/shared` (single source of truth with the backend).
- Strong accessibility test culture (axe in CI; dialog/shortcut/quick-edit/search behavior tests) — a redesign can be verified against real contracts.
- Pure logic extracted (`bulkSelection`, `quickEdit`, `savedViewFilters`, `shortcuts`) — UI-agnostic and redesign-safe.
- Tokens are fully semantic; dark mode is a remap, not a rework.

**Weaknesses / constraints**
- The signature ledger is markup, not a component — the biggest blocker to restyling safely.
- Monolithic CSS; media queries for the same breakpoint scattered across the file.
- Pages are large stateful monoliths (643/592/514 lines) mixing fetching, filtering, selection, quick-edit orchestration.
- No data-layer abstraction beyond the fetch wrapper — every page owns loading/error/refetch choreography.
- All state is local; cross-component coordination uses hacks (`saveSignal` counter).
- No 404 route, no error boundary.

**Verdict**: suitable for a redesign without a framework swap being forced by pain — but the redesign must introduce `LedgerRow`, `Input`/`Select`, `PageHeader`, and a reorganized CSS structure as its first workstream, otherwise every visual change is manual multiplication.

---

## 12. Redesign Constraints — must preserve

- All backend/API behavior and `@mini-issue-tracker/shared` contracts (filter representations, saved-view schema version, bulk request shape, search limits).
- Issue key semantics (`#ABC123`), overdue definition, label palette semantics, status/priority vocabularies.
- Feature behavior: saved views (incl. staleness notes), quick edit (one field, row-local errors, read-only degradation), bulk (cross-workspace block), keyboard shortcuts (`/`, `⌘K`, `?`, `G D`, `G M`, issue-page set, typing/modal guards), global search (debounce/abort/keyboard nav), mention rendering, activity pagination, invitations/join, labels CRUD, include-closed toggle, My Issues stats honesty.
- Accessibility contracts: skip link, focus trap/return, `role=alert` focus, focus-visible, reduced motion, 44px coarse targets, axe tests passing.
- Existing tests where they assert behavior rather than styling.
- Data honesty: no fabricated stats/navigation/counts.

**Safe to change**: all visual styling; CSS architecture; component internals; adding missing primitives (`LedgerRow`, `Input`, `Select`, `PageHeader`); layout implementation; typography within hierarchy; spacing; breakpoint *behavior* (keeping intent); icon treatment (keeping one consistent set); shell structure (adding workspace context) as long as every surface above remains reachable.

---

## 13. Redesign Opportunities (prioritized)

- **P0 — Componentize the signature**: extract `LedgerRow` (selection + quick-edit + overdue + workspace-caption variants) and `Input`/`Select` primitives; reorganize CSS into per-concern files with a coherent breakpoint layer. Nothing else is safe without this.
- **P0 — Shell with workspace context**: persistent workspace/project awareness in the sidebar (switcher + active states), fixing the navigation P1s without fabricating navigation.
- **P1 — Workbench decomposition**: move labels management + invitations out of the daily surface (a settings-shaped surface, still real-data-driven); make stats strips quieter or filter-linked.
- **P1 — Filter state in the URL** (project, filters, view) for shareable/reloadable ledger state; unify the two filter models behind one UI contract.
- **P1 — Wide-screen ledger density**: revisit the 1440px cap and workbench column behavior; keep the issue-document measure.
- **P2 — Fact rail interaction model**: visible editable cues consistent with quick-edit language; `aria-live` for mutations; mobile filter-bar consolidation.
- **P2 — Dashboard/auth polish** to close the sparse/dense gap without card-ification.
- **P3 — Icon module; dark mode (tokens ready); typographic empty states retained.**

---

## 14. What the Redesign Should NOT Become

A generic SaaS dashboard; Linear/Vercel/Notion/Jira clone; card-on-card stacks; gradients/glassmorphism; oversized radii/shadows; animation showcase; enterprise admin panel; a "command center" with fabricated widgets. Specifically: keep the ledger (not boards/card grids) as the primary surface; keep petrol singular; keep coral semantic; keep dense editorial typography; keep near-zero elevation. Evolving the identity is in scope (the visual language doc itself says implemented code wins); abandoning the identity is not.

---

## 15. Final Audit Summary

### Current strengths
Coherent, tokenized, accessibility-tested editorial design; the ledger genuinely works; pure logic well-extracted; shared types with backend; honest data everywhere; behavior tests cover shortcuts, quick edit, search, bulk, and a11y.

### Biggest problems
1. Signature pattern exists as copy-paste markup (CRITICAL debt).
2. Monolithic CSS; no Input/Select primitives.
3. Workspace page overload; labels/invitations inside the work surface.
4. No workspace context in the shell; no URL-encoded filter state.
5. No ledger pagination; wide-screen space underused.

### Highest-impact redesign opportunities
P0 componentization (`LedgerRow`, `Input`/`Select`, CSS reorg) + shell workspace context; then workbench decomposition and URL filter state.

### Technical constraints
React 18 + Router 6 + hand-rolled CSS + fetch layer; cookie auth; shared types package; vitest/axe suite; ~8.5k TSX / 3.7k CSS — small enough to restyle thoroughly.

### Features that must be preserved
The full Phase 1–3 feature set and its accessibility contracts (§12).

### Visual patterns worth preserving
Ledger signature; warm paper + petrol + coral semantics; token architecture; typography hierarchy; stats strips; mastheads/back-links; "ledger, lifted" search overlay; quick-edit badge editors; key-cap help; empty states.

### Visual patterns worth retiring
Per-page ledger markup; element-selector input styling; the single 3.4k-line CSS file; inline-duplicated brand SVGs; the `saveSignal` prop hack.

### Questions that must be answered before implementation
1. Is a CSS-architecture change in scope (CSS modules, component-scoped files) or is the constraint "plain CSS, better organized"?
2. Is `VISUAL_LANGUAGE.md` rewritten as part of the redesign, or updated incrementally per stage?
3. Is dark mode in scope or deferred?
4. Are structural navigation changes (persistent workspace context, settings surfaces) in scope, or visual-only?
5. Are existing tests preserved verbatim (style-agnostic) or is test rework budgeted?
6. What is the acceptance bar — all pages, or prioritized surfaces first?
7. Resolve the spec folder numbering collisions before creating `009-redesign` siblings? (This audit currently lives in a third `009` folder.)

### Recommended redesign sequence (high-level only)
1. Foundations: tokens audit, CSS reorganization, primitives (`Input`/`Select`/`LedgerRow`/`PageHeader`), icon module.
2. Shell & navigation: workspace context, active states, responsive rail.
3. Workbench: workspace page decomposition, filter bar, ledger on the new `LedgerRow`, bulk + quick edit re-verified.
4. My Issues + Dashboard + Auth on the same ledger/page patterns.
5. Issue detail: fact-rail interaction model, comments/mentions, activity.
6. Overlays: search, dialogs, shortcuts help on the new primitives.
7. Responsive + accessibility sweep; `VISUAL_LANGUAGE.md` updated at each stage where the system intentionally changes.

---

*End of Stage 1 audit. No implementation tasks, no plan.md, no stack decision. Awaiting approval for Stage 2.*
