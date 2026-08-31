# Implementation Plan — Frontend Redesign

> **Status**: Planning only. No code written. Sources: Stage 1 audit
> (`current-state-audit.md`) and Stage 2 decisions (`redesign-decisions.md`), both
> verified against the code at commit `2bf0b92`. `frontend/VISUAL_LANGUAGE.md`
> (1282 lines, §1–§42) re-read; `AGENTS.md` re-read. Where this plan names files,
> selectors, or behaviors, they were verified to exist in the repository.

## 1. Objective

Execute the approved redesign as eight incremental workstreams that (a) extract the
approved primitives with written contracts, (b) reorganize the CSS into the approved
file structure, (c) decompose the overloaded workspace surface, (d) add real shell
workspace context and URL-encoded filter state, and (e) polish responsiveness and
accessibility — with zero new dependencies, zero backend changes, and no feature
regressions. End state = §20 acceptance criteria.

## 2. Constraints

- Stack frozen: React 18 + TS + Router 6 + Vite; plain CSS + custom properties; custom
  SVG icons; system-ui/ui-monospace; no new runtime or dev dependencies; dark mode
  deferred (decisions §7, §17).
- Backend, `@mini-issue-tracker/shared` contracts, auth, authorization, and all Phase
  1–3 feature behavior unchanged.
- Accessibility contracts immutable (audit §8.8 strengths; decisions §14).
- Abstraction ceiling: extract only with 2+ current consumers (decisions §2.1).
- No dual design systems: no new rules in `components.css` after Workstream 1's split;
  migrated surfaces drop legacy markup in the same pass (decisions §18).
- Every intentional visual change updates `VISUAL_LANGUAGE.md` in the same commit.

## 3. Current Architecture Summary (verified)

- 5 routes (`App.tsx`), 1 shell (`Layout.tsx`, sidebar-only, global shortcuts `/`,
  `⌘K`, `?`, `G D`, `G M`), 31 components, 6 pages, 12 lib/util modules, cookie auth
  context, bare fetch client.
- Ledger row markup hand-assembled in `WorkspacePage`, `MyIssuesPage`, `SearchDialog`
  (plus a workspace variant in `DashboardPage`); known drift: workspace captions only
  in My Issues, label badges capped at 2 only there.
- No `Input`/`Select`/`Textarea`/`Checkbox`/`PageHeader` components; controls styled by
  global element selectors in `components.css`.
- `components.css` = 3,448 lines, 17 media-query blocks for 8 distinct breakpoint/
  pointer conditions scattered through the file.
- WorkspacePage (643 ln) hosts labels management (`LabelsSection`, collapsible) and
  `Invitations` inline; `SavedViewsSection` coupled via a `saveSignal` counter prop.
- No 404 route, no error boundary.

## 4. Target Architecture

- **Primitives** (`frontend/src/components/`): `LedgerRow`, `LedgerList`, `FilterBar`,
  `PageHeader`, `Input`, `Select`, `Textarea`, `Checkbox`, `FactRail`, `ConfirmDialog`,
  `icons.tsx`, `WorkspaceSwitcher` — contracts in §5.
- **CSS** (`frontend/src/styles/`): `tokens.css` (unchanged roles), `base.css`
  (unchanged), `index.css` (new entry, imported by `main.tsx`), `layout.css`,
  `controls.css`, `ledger.css`, `overlays.css`, `pages/{dashboard,workspace,my-issues,issue,auth,labels}.css`.
- **Routing**: add `/workspaces/:workspaceId/labels` (nested under the shell layout
  route), a catch-all `*` → `NotFoundPage`, and URL search-params for filter state (§10).
- **Shell**: sidebar gains `WorkspaceSwitcher` + contextual workspace nav (Issues,
  Labels); active states per §7.
- Everything else (state patterns, api client, lib modules, auth context) unchanged.

## 5. Primitive Contracts

Format per primitive: purpose / consumers / API shape / visual + a11y + responsive
responsibility / not-owned / test migration. All primitives are typed, token-only, and
get dedicated component tests (§17).

### 5.1 `Icon` (`components/icons.tsx`)
- **Purpose**: single home for the 16×16 / stroke-1.5 / currentColor SVG set
  (`brand`, `search`, `issue`, `help`, `signout`, `workspaces`, `chevron`, plus any
  glyph needed later).
- **Consumers today**: brand mark duplicated inline in `Layout.tsx`, `DashboardPage.tsx`,
  `LoginPage.tsx`, `SignupPage.tsx`; sidebar icons in `Layout.tsx`; carets in
  `CollapsibleSection.tsx`.
- **API**: named per-glyph exports (e.g. `IconBrand`, `IconSearch`) — not a string-map
  `<Icon name>`; keeps typing/tree-shaking trivial. Props: `className?`, `size?: 14 | 16`.
- **Owns**: geometry, stroke, currentColor. **Not owned**: color (context decides);
  semantics (glyphs are `aria-hidden`; buttons carry `aria-label`).
- **Migration**: replace the four duplicated brand-mark copies in the same pass.

### 5.2 `PageHeader`
- **Purpose**: canonical masthead — optional back-link, title, optional eyebrow, trailing
  action slot, bottom hairline. Replaces per-page `page-header` markup (Dashboard,
  My Issues, Workspace masthead, Issue masthead wrapper, new Labels page).
- **API**: `{ backTo?: { to: string; label: string }; title: ReactNode; eyebrow?: string;
  meta?: ReactNode; actions?: ReactNode; id?: string }`.
- **Owns**: `page-header`/`page-title` classes, display-size/weight hierarchy (decisions §6),
  hairline. **Not owned**: stats strips (pages compose them below), page-specific controls.
- **A11y**: renders `<h1>`; back-link is a real `Link` keeping the `back-link` class contract.
- **CSS home**: `layout.css`. **Tests**: new `page-header.test.tsx` (title, back-link,
  action render); page tests unchanged (text-based queries).

### 5.3 Controls: `Input`, `Select`, `Textarea`, `Checkbox`
- **Purpose**: wrap native elements; eliminate element-selector styling.
- **API**: thin wrappers extending native props: `Input({ invalid?, ...})`,
  `Select({ children, invalid?, ...})`, `Textarea(...)`, `Checkbox({ label, ...})`
  (Checkbox renders its own `<label>` wrapper). `Field` keeps composing label + control;
  `aria-describedby` → `FormAlert` wiring stays with callers (unchanged LoginPage pattern).
- **Owns**: height (36px standard, 32px `size="compact"` for dense contexts), radius
  `--radius-sm`, border states, `aria-invalid` → coral border, disabled, pressed.
- **Not owned**: validation, form state, focus-error choreography (`useFocusAlert`).
- **Migration**: forms/filter bars/fact rail adopt per workstream; global
  `input/select/textarea` element selectors are removed from the CSS in Workstream 8
  only after a repo-wide grep proves zero bare usages remain.
- **Tests**: `controls.test.tsx` (ref/prop forwarding, invalid state, label association).

### 5.4 `FilterBar`
- **Purpose**: one visual contract for the two filter models. NOT a filter engine.
- **API** (controlled, model-agnostic):
  `{ query?: { value, onChange, placeholder, label }; selects?: Array<{ id, label,
  value, options, onChange }>; sort?: { value, options, onChange }; resultCount?:
  ReactNode; onClear?: () => void; actions?: ReactNode }`.
  Workspace passes status/priority/label selects; My Issues passes status/priority + sort.
- **Owns**: layout, label association, ≤700px "Filters" disclosure (collapsed by
  default; `aria-expanded` on the toggle; controls stay mounted), count + clear affordances.
- **Not owned**: applying filters (lib modules), URL sync (pages), Saved Views.
- **Responsive**: disclosure only ≤700px; ≥701px always open (verified behavior preserved).
- **Tests**: `filter-bar.test.tsx` (controlled updates, clear, disclosure + `aria-expanded`).

### 5.5 `LedgerRow` / `LedgerList`
Full anatomy, variants, states, and migration order in §9.

### 5.6 `FactRail`
- **Purpose**: issue-detail fact definition list, with a visible editable cue on value controls.
- **API**: `{ items: Array<{ id, label, value: ReactNode }>; labelledBy?: string }`.
  IssuePage declares status/priority (`Select`), assignee, due date, project, labels.
- **Owns**: `fact-*` dl semantics, label/value rhythm, editable cue (dotted underline on
  hover/focus — reuses the quick-edit cue language). **Not owned**: mutations, dialogs.
- **A11y**: `<dl>` preserved; selects keep `aria-label`.
- **Tests**: migrate fact-rail assertions from `issue-page.test.tsx` (they are
  text/label-based → minimal churn); add `fact-rail.test.tsx`.

### 5.7 `ConfirmDialog`
- **Purpose**: wraps `Dialog` for destructive confirms (issue, project, label, saved-view,
  bulk delete).
- **API**: `{ open, onClose, title, description, confirmLabel, busy?, onConfirm }`;
  Cancel + danger Button in `dialog-actions`; confirm shows busy label.
- **Owns**: danger intent, busy/disabled. **Not owned**: consequence wording, mutation.
- **Tests**: `confirm-dialog.test.tsx` (escape, cancel, confirm, busy); existing
  delete-flow assertions in page tests keep passing.

### 5.8 `WorkspaceSwitcher`
- **Purpose**: current-workspace identity + real workspace list in the sidebar.
- **Data**: `GET /workspaces` (`{ items: Workspace[] }` — the exact call `DashboardPage`
  already makes; no new endpoint). Current workspace resolved from
  `useParams().workspaceId`. Owner/Member badge uses existing payload fields.
- **API**: `{ currentId?: string; workspaces: Workspace[]; loading: boolean }`; the shell
  fetches once per session (module-scope cache) — no new state layer.
- **Owns**: trigger (current workspace name, or "Workspaces" when not in a workspace),
  popover listing workspaces + "All workspaces" (→ `/`), active state on the current one.
  Popover follows the `QuickEditPopover` contract: Escape closes, focus returns to
  trigger, click-outside closes, `aria-expanded` on trigger.
- **Not owned**: workspace creation (stays on Dashboard), role display beyond existing badge.
- **Responsive**: ≤700px compact indicator at rail top; popover unchanged.
- **Tests**: `workspace-switcher.test.tsx` (list from mock api, active state, escape,
  focus return, navigation); `layout.test.tsx` gains switcher assertions.

## 6. CSS Architecture

**Entry**: `main.tsx` imports `styles/index.css`; `index.css` `@import`s in cascade
order: `tokens.css`, `base.css`, `layout.css`, `controls.css`, `ledger.css`,
`overlays.css`, `pages/*.css` (page files last; safe because they own only
page-prefixed classes).

**What moves where** (from `components.css`, by its existing comment banners):
- Buttons, badges, avatar, alerts, search control, input/select element rules → `controls.css`
- App shell, sidebar/rail + tooltips, mastheads, workbench grid, document grid, page scaffolds → `layout.css`
- Ledger rows, overdue treatment, selection layer, bulk toolbar, `qe-*` row layer → `ledger.css`
- Dialogs, search dialog, `qe-popover`, key-caps → `overlays.css`
- Page-scoped rules (`dashboard-*`, workspace workbench, My Issues strip, issue detail
  `fact-*`/comments/activity, `auth-*`, labels management) → respective `pages/*.css`

**Rules enforced in review**: each breakpoint value appears once per file, inside the
file owning the component; class-prefix ownership (`ledger-*`, `qe-*`, `filter-*`,
`fact-*`, `app-*`/`sidebar-*`, `btn`/`badge`/`alert`); no raw hex outside
`tokens.css`; no selector targets another file's prefix.

**Retirement**: Workstream 1 performs a *mechanical* split (copy selectors verbatim, no
rewrites) and `components.css` is deleted at the end of Workstream 1 once typecheck /
tests / build pass — avoiding two competing systems from day one. Renames happen later
only where a primitive changes markup (e.g., `LedgerRow` formalizes the `ledger-row`
substructure). This tightens the decisions doc's "coexist between workstreams"
allowance in a safer direction: **zero legacy CSS file after WS1**; coexistence is
per-surface markup only, never per-CSS-file.

## 7. Shell / Information Architecture

**Sidebar anatomy after Workstream 3** (top → bottom): Brand → `WorkspaceSwitcher` →
Primary nav (Workspaces, Search, My Issues — existing items, stronger active states) →
Contextual workspace nav (rendered only when `useParams().workspaceId` is present:
**Issues** → `/workspaces/:id`, **Labels** → `/workspaces/:id/labels`) → footer
(user, `?` help, sign out).

- **Routing changes** (`App.tsx`): add `<Route path="labels" element={<LabelsPage />}/>`
  inside `workspaces/:workspaceId`; add `<Route path="*" element={<NotFoundPage />} />`.
- **WorkspaceSwitcher data**: `GET /workspaces` (same call as Dashboard); current id from
  route params; no membership/role endpoints added (nothing fabricated).
- **Active states**: switcher trigger shows the current workspace name; Issues link uses
  `NavLink` active state on the workspace index; Labels link active on the labels route;
  existing "Workspaces" nav active on `/`.
- **Keyboard/a11y**: switcher popover = Escape closes / focus returns / click-outside
  closes / `aria-expanded` trigger (QuickEditPopover contract); contextual nav is a
  `<nav aria-label="Workspace">`; all items keyboard-reachable in DOM order; icon-rail
  tooltips (`data-sidebar-tooltip`) apply to the new items too.
- **Mobile**: ≤700px the sidebar becomes the icon rail (existing verified behavior);
  switcher collapses to a compact current-workspace indicator (initial + short name)
  whose popover is unchanged; contextual workspace nav collapses to two icon entries.
- **Invitations**: moved behind a quiet "Invite" button in the workspace masthead opening
  a `Dialog` hosting the existing `Invitations` content (component reused unchanged).

## 8. Page Migration Matrix

| Surface | Current structure (verified) | Target structure | Reused / introduced | CSS home | Regression risks |
|---|---|---|---|---|---|
| Dashboard `/` | page-header + workspace `ledger-row` list + create dialog + JoinWorkspace | `PageHeader` + `LedgerList` (workspace variant rows) + dialog + JoinWorkspace | Reuse: Dialog, EmptyState, Badge. New: PageHeader, LedgerList/Row, Icon | `pages/dashboard.css` | Row variant must keep Owner/Member badge + chevron |
| Workspace `/workspaces/:id` | masthead, stats strip, projects rail, saved-views shelf, labels section, invitations, filter bar, ledger, quick edit, bulk | masthead (PageHeader + Invite dialog trigger) → stats → projects/saved-views rail → FilterBar → LedgerList; labels + invitations relocated | Reuse: ProjectDialog, SavedViewsSection (de-`saveSignal`ed), BulkToolbar, QuickEdit*. New: PageHeader, FilterBar, LedgerRow/List, ConfirmDialog | `pages/workspace.css` + `ledger.css` | Saved-view apply/rename/delete; quick edit; bulk; project select |
| Labels `/workspaces/:id/labels` | inside WorkspacePage (`LabelsSection` collapsible) | dedicated page: PageHeader + `LabelsSection` (reused unchanged) on workbench layout w/o rail | Reuse: LabelsSection, ConfirmDialog (replaces its inline delete confirm) | `pages/labels.css` | Label CRUD + color-picker behavior; tests rehomed from `labels.test.tsx` context |
| My Issues `/my-issues` | stats strip, include-closed, filter/sort bar, cross-workspace ledger w/ captions, bulk, quick edit | PageHeader → stats strip → FilterBar (query+selects+sort) → LedgerList (cross-workspace context) | Reuse: BulkToolbar, QuickEdit*, `myIssuesView`. New: PageHeader, FilterBar, LedgerRow/List | `pages/my-issues.css` | Stats honesty; cross-workspace captions; read-only degradation rows |
| Search overlay | SearchDialog: debounced abortable search, keyboard-navigable lifted-ledger results | Same dialog; results become `LedgerRow variant="compact"` | New: LedgerRow compact | `overlays.css` | Debounce/abort/stale-response guard; listbox keyboard nav |
| Issue detail | back-link, masthead, description, comments+mentions, activity panel, fact rail, edit/delete dialogs | PageHeader (key+title lockup) → description → comments → activity; `FactRail`; `ConfirmDialog` for delete | Reuse: ActivityPanel, MentionAutocomplete, IssueForm, Dialog. New: PageHeader, FactRail, ConfirmDialog | `pages/issue.css` | Mention rendering; activity pagination; focus-on-error; shortcuts |
| Login / Signup | standalone auth-card forms | unchanged structure; Icon for brand; controls adopted | New: Icon, Input (Button exists) | `pages/auth.css` | Field-error focus contract |
| Dialogs/overlays | Dialog, SearchDialog, ProjectDialog, KeyboardShortcutsDialog, QuickEditPopover | `ConfirmDialog` variant added; markup otherwise preserved | New: ConfirmDialog | `overlays.css` | Focus trap/return, `modalLayer` registration |
| Responsive shell | sidebar→icon rail ≤700px; workbench collapse 900/1024 | unchanged breakpoints + switcher indicator + filter disclosure | New: FilterBar disclosure, switcher indicator | `layout.css` | Touch targets; row wrap; no hidden info |

## 9. Ledger Migration Strategy

**Canonical anatomy** (decisions §10, binding): selection slot → priority edge-bar →
ticket key → title → caption slot → metadata slot (status badge, priority badge, ≤2
label badges, assignee chip, due date — fixed order) → quick-edit slot → chevron.

**API**:
```ts
interface LedgerRowProps {
  to: string;                       // row link target (unchanged navigation)
  issueKey: string;                 // via lib/issueKey — behavior unchanged
  title: string;
  statusBadge: BadgeTone; statusLabel: string;   // explicit, no inference
  priority?: { tone: BadgeTone; label: string };
  labels?: Array<{ id: string; tone: BadgeTone; name: string }>;  // component caps at 2
  assignee?: { name: string };      // renders Avatar + name
  dueDate?: string | null;
  overdue?: boolean;                // page computes via lib/isOverdue — unchanged
  caption?: ReactNode;              // cross-workspace / project caption (ONE slot)
  selectable?: { checked: boolean; onChange: () => void; label: string };
  quickEdit?: ReactNode;            // hosts existing QuickEdit* components
  variant?: "default" | "compact";
  selected?: boolean;
}
```

**Safety rules**:
1. Pages keep all computation: `issueKey()`, `isOverdue()`, `labelTone()`, filter/sort,
   selection logic (`bulkSelection`), quick-edit state (`quickEdit.ts`). `LedgerRow` renders only.
2. Migration order (smallest consumer first): **SearchDialog → MyIssuesPage →
   WorkspacePage → DashboardPage**. One commit per consumer; that page's tests green
   before moving on.
3. Drift resolutions (documented, applied globally): captions become a `caption` slot
   available to any consumer (My Issues keeps using it; search passes project name);
   the ≤2-label cap applies everywhere (previously inconsistent); compact variant hides
   the due date (matches current search density).
4. Bulk selection: checkbox is the `selectable` slot; `selectVisible` still receives the
   page's visible-id list. Quick edit: the `quickEdit` slot hosts the existing
   `QuickEditSelect/Labels/Date` unmodified — one-field-at-a-time, busy, row-local error,
   and focus-return contracts untouched.
5. Mobile: row-wrap rules move verbatim into `ledger.css`; the key stays visible at all
   breakpoints; coarse-pointer 44px rules cover checkbox + quick-edit triggers.
6. **`LedgerList`**: `{ rows, loading?, empty?: { title, description?, action? }, caption? }`
   renders `<ul class="ledger-list">`, `SkeletonRows` while loading, `EmptyState` when
   empty, mono count caption. Dashboard workspace list and SearchDialog results consume it too.


**Anti-duplication check**: after WS2, `grep -rn "ledger-row" frontend/src --include="*.tsx"`
must return matches only inside `LedgerRow.tsx`/`LedgerList.tsx`.

## 10. Filter / URL State Strategy

**Principle**: the two filter models stay logically separate; the URL and `FilterBar`
unify only the *presentation* and *addressability*.

- **Workspace ledger** (server params today): new `URLSearchParams` keys
  `project`, `status`, `priority`, `label`, `view` (saved-view id). Pages read params on
  mount as the initial state (replacing today's `useState("")` defaults) and
  `setSearchParams` with `replace: true` on change (so filter typing doesn't spam
  history; explicit navigation still creates entries). A `view` param, when present and
  resolvable via `savedViewFilters`, applies the view's snapshot on top; manual filter
  edits clear `view` and show the existing staleness semantics unchanged.
- **My Issues** (client-side today): params `q`, `status`, `priority`, `sort`, `closed`.
  Same read-on-mount / replace-on-change pattern; `myIssuesView.ts` continues to apply
  them — it gains no new filter semantics.
- **Search**: not URL-encoded (it is an overlay with transient state by design — verified
  current behavior; query resets on close). Out of scope to change.
- **Reset**: `FilterBar.onClear` → `setSearchParams({})` (or model defaults), preserving
  the existing "Clear filters" affordance and result-count behavior.
- **Deep-linking/browser back**: params are the single source of truth once WS3 ships;
  reload/back/forward restore filters. Saved-view application also updates params so a
  shared URL reproduces a view.
- **Implementation home**: a tiny `lib/urlFilters.ts` with pure
  `readFilters(searchParams, schema)` / `writeFilters(filters, schema)` helpers per
  model — unit-tested, no router coupling beyond passing `URLSearchParams`.
- **Saved Views compatibility**: `SAVED_VIEW_FILTERS_VERSION` and snapshot shape are
  untouched; the URL is a *projection* of applied filters, never a new storage format.

## 11. Responsive Strategy

Breakpoints stay exactly as verified: 1280 / 1024 / 900 / 700 / 600 / 375 + pointer
media queries. Changes are behavior additions, not new breakpoints:

| Range | Behavior |
|---|---|
| ≥1280 | Workbench ledger column allowed to grow (fluid up to `--layout-max-width`); issue document keeps reading measure |
| 1024–1279 | Workbench two-column intact (existing) |
| 900–1023 | Workbench columns begin collapsing (existing) |
| 700–899 | Rail stacks; issue detail single column (existing) |
| ≤700 | Icon rail (existing); switcher → compact indicator; **FilterBar → "Filters" disclosure (new)**; row wrap (existing); dialogs near-fullscreen (existing) |
| 600 | Activity row wrap (existing) |
| ≤375 | Existing floor rules; no horizontal overflow |
| Coarse pointer | ≥44px targets on checkbox, quick-edit triggers, switcher, disclosure toggle (existing rules extended) |

Non-negotiables: no information hidden (disclosures collapse controls, not data); the
ticket key stays visible in wrapped rows; hover affordances remain `@media (hover:hover)`.

## 12. Accessibility Strategy

**Immutable contracts** (carried verbatim): skip link, global `:focus-visible`, Dialog
focus trap/Escape/focus-return + `modalLayer` registration, `role="alert"` + focus on
error (`FormAlert`/`useFocusAlert`), quick-edit row-local error focus, shortcuts
typing/modal guards, landmark structure (`nav` labels, skip target `#main-content`),
reduced-motion kill-switch, coarse-pointer 44px.

**Gaps fixed during the redesign (scoped)**:
1. `aria-live="polite"` region announcing bulk-apply results and quick-edit commits
   (added in WS4/WS5; text-only, no visual change).
2. `aria-busy` on ledger containers while `SkeletonRows` render (WS2).
3. `aria-expanded` on `QuickEditPopover` triggers (WS5).
4. Fact-rail editable cue for value controls (WS5) — visual + focusable, no ARIA change
   needed because the controls are already real selects.
5. `FilterBar` disclosure exposes `aria-expanded` + labelled region (WS4).
6. `WorkspaceSwitcher` popover follows the popover contract incl. `aria-expanded` (WS3).

**Primitive a11y contracts** are listed per primitive in §5; each new primitive test
file asserts its contract, and `tests/accessibility/core.test.tsx` (axe) must pass after
every workstream.

## 13. VISUAL_LANGUAGE.md Strategy

Update in the same commit as the change it documents; never wholesale:

| Workstream | VL sections updated |
|---|---|
| WS1 CSS split | §2 Source of Truth (file list), §39 Token Rule (naming file homes) |
| WS2 Ledger | §19 Ticket Ledger + §19a/§20 rewritten around `LedgerRow`/`LedgerList` (anatomy/variants/states incl. ≤2-label cap and caption slot); §19b references compact variant |
| WS3 Shell | §14 Sidebar + §15 Workspace Selector rewritten (switcher, contextual workspace nav, active states); new short §15a for the labels route link |
| WS4 Workbench | §16/§18 updated (Invite dialog, labels moved out); new `filter-bar` contract note in §29 area; `saveSignal` references removed |
| WS5 Issue detail | §24 Fact Rail (component + editable cue), §23 Issue Actions (ConfirmDialog), §41.5 (aria-expanded) |
| WS6 Controls/overlays | §28 Buttons / §29 Inputs rewritten around the control primitives + `ConfirmDialog` |
| WS7 Responsive/a11y | §31 Responsive (consolidated table + disclosure), §33 Accessibility (live regions, aria-busy) |
| WS8 Cleanup | §37 New Page Rule now names the four layouts + primitives; remove deprecated per-page-markup references |


## 14. Workstreams

Every workstream: tests green (`vitest run`, `test:a11y`, `typecheck`, `lint`, `build`)
before merge; one reviewable PR; VL updates in the same commit; rollback = `git revert`
the PR (workstreams are ordered so later ones don't mask earlier regressions).

### WS1 — Foundations (CSS split + smallest primitives)
- **Objective**: approved CSS structure with zero visual change; Icon, PageHeader,
  controls primitives; NotFoundPage + error boundary.
- **Create**: `styles/index.css`, `styles/{layout,controls,ledger,overlays}.css`,
  `styles/pages/{dashboard,workspace,my-issues,issue,auth}.css`,
  `components/icons.tsx`, `components/PageHeader.tsx`, `components/Input.tsx`,
  `components/Select.tsx`, `components/Textarea.tsx`, `components/Checkbox.tsx`,
  `pages/NotFoundPage.tsx`, tests (`controls`, `page-header`).
- **Modify**: `main.tsx` (single import), `App.tsx` (404 route + error boundary),
  `Layout.tsx` / `DashboardPage.tsx` / `LoginPage.tsx` / `SignupPage.tsx` (brand SVG →
  Icon; PageHeader on Dashboard), `tokens.css`/`base.css` (content unchanged).
- **Remove**: `styles/components.css` (after mechanical split verified).
- **Unchanged behavior**: every pixel rule and media query copied verbatim in WS1; auth
  error focus; shortcuts.
- **VL**: §2, §39. **Exit criteria**: `components.css` deleted; grep for raw hex outside
  `tokens.css` = 0; all suites green.
- **Risk**: mechanical split misses a selector → mitigated by counting selectors before/
  after (must match) plus full test + axe suite.

### WS2 — Canonical Ledger
- **Objective**: single `LedgerRow`/`LedgerList`; remove duplication.
- **Create**: `components/LedgerRow.tsx`, `components/LedgerList.tsx`,
  `tests/component/ledger-row.test.tsx`, `tests/component/ledger-list.test.tsx`.
- **Modify** (in §9 order): `SearchDialog.tsx`, `MyIssuesPage.tsx`, `WorkspacePage.tsx`,
  `DashboardPage.tsx`; `aria-busy` on list containers; `ledger.css` gains formalized row
  substructure classes.
- **Unchanged**: issueKey, isOverdue, labelTone, quick-edit contracts, bulk selection
  logic, search keyboard nav, mobile wrap, coarse-pointer targets.
- **VL**: §19, §19a, §19b, §20. **Exit criteria**: §9 grep anti-duplication check
  passes; `search-dialog`, `my-issues-page`, `workspace-page`, `dashboard` tests green.

### WS3 — Shell / Navigation
- **Objective**: workspace context in the shell; labels route; 404 (route from WS1).
- **Create**: `components/WorkspaceSwitcher.tsx`, `pages/LabelsPage.tsx`,
  `lib/urlFilters.ts`, tests (`workspace-switcher`, `url-filters`, `labels-page`),
  `styles/pages/labels.css`.
- **Modify**: `Layout.tsx` (switcher + contextual workspace nav), `App.tsx` (labels
  route), `WorkspacePage.tsx` (labels section removed; "Invite" dialog), URL params in
  `WorkspacePage.tsx` + `MyIssuesPage.tsx`, `styles/layout.css`.
- **Unchanged**: saved-view semantics (`savedViewFilters`, `SAVED_VIEW_FILTERS_VERSION`),
  invitations content (entry point moved only), shortcuts, icon rail.
- **VL**: §14, §15 (+ new §15a). **Exit criteria**: deep link with filters restores
  state; back/forward works; label CRUD green from the new route; switcher popover

### WS4 — Workbench decomposition
- **Objective**: WorkspacePage shows daily workflow only; FilterBar on both ledgers;
  `saveSignal` removed.
- **Create**: `components/FilterBar.tsx`, `tests/component/filter-bar.test.tsx`.
- **Modify**: `WorkspacePage.tsx` (PageHeader + FilterBar composition; URL param state
  from WS3), `SavedViewsSection.tsx` (owns its "Save view" trigger; drop `saveSignal`),
  `MyIssuesPage.tsx` (FilterBar), `styles/pages/workspace.css`, `styles/pages/my-issues.css`.
- **Unchanged**: filter application logic; saved-view create/rename/delete/apply +
  staleness notes; bulk toolbar; stats honesty.
- **VL**: §16, §18, §29 (FilterBar contract note). **Exit criteria**:
  `saved-views-section`, `saved-view-filters`, `bulk-toolbar`, `workspace-page`,
  `my-issues-page` tests green; no `saveSignal` references remain.

### WS5 — Issue Detail
- **Objective**: FactRail, ConfirmDialog, masthead lockup, a11y additions.
- **Create**: `components/FactRail.tsx`, `components/ConfirmDialog.tsx`, tests
  (`fact-rail`, `confirm-dialog`).
- **Modify**: `IssuePage.tsx` (PageHeader key+title lockup, FactRail, ConfirmDialog for
  delete, `aria-live` region for mutations), `styles/pages/issue.css`.
- **Unchanged**: comments/mentions rendering, activity pagination + collapse, edit
  dialog flow, delete confirmation wording, issue-page shortcuts.
- **VL**: §21 (masthead lockup), §23, §24, §41.5 (aria-expanded). **Exit criteria**:
  `issue-page`, `mention-*`, keyboard-shortcuts tests green.

### WS6 — Controls / overlays sweep
- **Objective**: all forms/dialogs on the primitives.
- **Modify**: `IssueForm.tsx`, `ProjectDialog.tsx`, `LabelsSection.tsx` (delete →
  ConfirmDialog), `BulkToolbar.tsx` (Select/Checkbox), `JoinWorkspace.tsx`,
  `Invitations.tsx`, `SearchDialog.tsx` (Input), auth pages (Input),
  `styles/controls.css`, `styles/overlays.css`; `KeyboardShortcutsDialog.tsx` inspect-only.
- **Unchanged**: `ApiError` field-mapping → `FormAlert` focus contract; native
  `<select>`/date inputs.
- **VL**: §28, §29. **Exit criteria**: grep shows bare `<input|select|textarea>` only
  inside the four control primitives; suites green.

### WS7 — Responsive + accessibility polish
- **Objective**: FilterBar disclosure, switcher mobile indicator, `aria-live`
  verification, coarse-pointer audit, wide-screen workbench growth.
- **Modify**: `styles/{layout,ledger,controls}.css`, `styles/pages/*.css` (media queries
  consolidated per file), `Layout.tsx` (switcher indicator), `FilterBar.tsx` (disclosure).
- **Verification**: manual browser pass at 1280/1024/768/480/375 + touch emulation
  (reported honestly, not automated); axe suite; keyboard-only pass over ledger → quick
  edit → bulk → search → dialogs.
- **VL**: §31, §33. **Exit criteria**: no horizontal overflow at any breakpoint; 44px
  rules present for all new interactive elements.

### WS8 — Cleanup + final consolidation
- **Objective**: remove dead selectors/classes and element-selector styling; final VL pass.
- **Modify**: all CSS files (orphan removal via per-prefix grep; remove global
  `input/select/textarea` rules), `VISUAL_LANGUAGE.md` §37 (four layouts + primitives).
- **Exit criteria**: orphan-selector grep clean; §20 acceptance criteria met.

## 15. Dependency Graph

```
WS1 Foundations ──► WS2 Canonical Ledger ──► WS4 Workbench decomposition ──► WS6 Controls sweep
      │                                        ▲                                    │
      │                                        └── WS3 Shell/Navigation (URL params)│
      │                                                   │                        │
      └───────────────────────────────────────────────────┴──► WS5 Issue Detail ────┤
                                                                           ▼
                                              WS7 Responsive + a11y polish ──► WS8 Cleanup
```

Hard edges: WS2 needs WS1 (CSS structure, Icon). WS3 needs WS1 (Icon, PageHeader) and
supplies URL params to WS4. WS4 needs WS2 (FilterBar wraps a ledger) + WS3 (params).
WS5 needs WS1 (primitives) and is cleaner after WS2. WS6 needs WS1 controls and lands

## 16. File Impact Map

**Create**
- CSS: `styles/index.css`, `layout.css`, `controls.css`, `ledger.css`, `overlays.css`, `pages/{dashboard,workspace,my-issues,issue,auth,labels}.css`
- Components: `icons.tsx`, `PageHeader.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Checkbox.tsx`, `LedgerRow.tsx`, `LedgerList.tsx`, `FilterBar.tsx`, `FactRail.tsx`, `ConfirmDialog.tsx`, `WorkspaceSwitcher.tsx`
- Pages: `NotFoundPage.tsx`, `LabelsPage.tsx`
- Lib: `lib/urlFilters.ts`
- Tests: `controls`, `page-header`, `ledger-row`, `ledger-list`, `filter-bar`, `fact-rail`, `confirm-dialog`, `workspace-switcher`, `url-filters`, `labels-page` (+ `icons` render test)

**Modify**
- `App.tsx` (labels route, 404, error boundary), `main.tsx` (CSS entry)
- Pages: `DashboardPage.tsx`, `WorkspacePage.tsx`, `MyIssuesPage.tsx`, `IssuePage.tsx`, `LoginPage.tsx`, `SignupPage.tsx`
- Components: `Layout.tsx`, `SearchDialog.tsx`, `SavedViewsSection.tsx`, `LabelsSection.tsx`, `IssueForm.tsx`, `ProjectDialog.tsx`, `BulkToolbar.tsx`, `Invitations.tsx`, `JoinWorkspace.tsx`
- CSS: `tokens.css` (import entry only; values unchanged), `base.css` (unchanged content)
- Tests: `layout*`, `search-dialog`, `my-issues-page`, `workspace-page`, `dashboard`, `issue-page`, `labels`, `saved-views-section` (adapt queries only where structure intentionally changed)
- Docs: `frontend/VISUAL_LANGUAGE.md` (per §13 table)

**Delete**
- `styles/components.css` (end of WS1)

**Inspect-only (no changes expected)**
- `api/client.ts`, `context/auth.tsx`, all `lib/*` except the new `urlFilters.ts`, `Dialog.tsx`, `Button.tsx`, `Badge.tsx`, `Avatar.tsx`, `Alert.tsx`, `FormAlert.tsx`, `Field.tsx`, `EmptyState.tsx`, `Spinner.tsx`, `Skeleton.tsx`, `CollapsibleSection.tsx`, `MentionAutocomplete.tsx`, `QuickEdit*.tsx`/`quickEdit.ts`, `Activity*.tsx`, `KeyboardShortcutsDialog.tsx`, `useFocusAlert.ts`, `initials.ts`, all pure-logic tests, and the entire `backend/` + `shared/`.

## 17. Test Migration Strategy

- **Unit tests (pure, unchanged)**: `issueKey`, `is-overdue`, `initials`, `kbd`, `shortcuts`, `modal-layer`, `bulk-selection`, `saved-view-filters`, `my-issues-view`. They must pass untouched — they are the feature-behavior contracts.
- **New unit tests**: `url-filters` (read/write round-trip per schema, unknown-param tolerance, defaults).
- **Component tests (new)**: the §16 create list; each asserts its §5 contract (rendering, states, ARIA), not implementation details.
- **Component tests (adapted)**: page tests keep text/role/label queries; only queries tied to removed wrapper markup change (e.g., ledger rows become `getByRole('listitem')` inside `LedgerList`). Brittle selectors are replaced, not preserved — each replacement recorded in the PR description.
- **Accessibility tests**: `tests/accessibility/core.test.tsx` (axe) runs after every workstream; switcher popover, filter disclosure, and ConfirmDialog get explicit keyboard/ARIA assertions.
- **Integration tests**: only for changed behavior — labels-route navigation, URL-param round-trip (apply → reload → restored), saved-view ↔ URL projection, 404 route.
- **Backend/shared**: untouched; run to confirm green.

## 18. Risk Register

| # | Risk | Sev | Likelihood | Mitigation | Verification |
|---|---|---|---|---|---|
| 1 | Ledger behavior regression (keys, overdue, labels, assignee) | High | Med | Pages keep computing; LedgerRow renders only; drift resolutions documented in §9 | `ledger-row` tests + page tests + grep gate |
| 2 | Bulk selection regression | High | Low | `bulkSelection` untouched; checkbox is a slot; cross-workspace block preserved | `bulk-toolbar` + `bulk-selection` tests; manual select-all pass |
| 3 | Quick edit regression | High | Low | QuickEdit* components mounted unmodified via slot; `quickEdit.ts` untouched | `quick-edit*` tests; manual commit/cancel pass |
| 4 | Search regression (debounce/abort/keyboard) | High | Low | SearchDialog logic untouched; only row markup swaps | `search-dialog` tests incl. keyboard nav |
| 5 | Saved Views regression | High | Med | Snapshot shape/version untouched; URL is a projection only | `saved-views-section` + `saved-view-filters` tests; apply→reload→apply pass |
| 6 | URL filter regression (lost/stale state) | Med | Med | Pure `urlFilters` helpers, unit-tested; `replace: true` semantics; unknown params ignored | `url-filters` tests + integration round-trip |
| 7 | Workspace switching data leakage | High | Low | Switcher uses the same `GET /workspaces` the Dashboard uses; no new endpoints or membership data | `workspace-switcher` tests; manual cross-account spot check |
| 8 | Responsive regression | Med | Med | Breakpoints unchanged; media rules moved verbatim in WS1; disclosure is additive | WS7 manual pass at 5 widths + touch |
| 9 | Accessibility regression | High | Med | Contracts immutable; axe after every WS; new a11y only additive | axe suite + keyboard-only pass |
| 10 | CSS cascade conflicts after split | Med | Med | Mechanical verbatim split; prefix ownership; selector-count check | selector-count diff; full suite; visual spot check |
| 11 | Duplicate component implementations creeping in | High | Med | §9 grep gate; no dual implementation within a workstream | grep gates in each WS exit criteria |
| 12 | VISUAL_LANGUAGE.md drift | Med | Med | Same-commit updates per §13 table; final §37 pass in WS8 | AGENTS.md review checklist |
| 13 | Test brittleness | Med | Med | Adapt only queries tied to removed markup; record each replacement | PR-documented test diffs |

## 19. Verification Plan

Per workstream: `npm run test`, `npm run test:a11y`, `npm run typecheck`, `npm run lint`,
`npm run build` (frontend), plus the backend test suite confirmed unchanged-green. Grep
gates per WS exit criteria (§14). WS7 adds the manual responsive/keyboard pass — reported
as manual, never claimed as automated. No screenshot tooling; no unperformed
verification claims.

## 20. Acceptance Criteria

1. Backend + shared tests green (unchanged).
2. Full frontend suite + axe green.
3. `typecheck`, `lint`, `build` clean.
4. No raw hex outside `tokens.css`; no orphan selectors; no undefined token references.
5. `components.css` gone; ledger markup exists only in `LedgerRow`/`LedgerList` (grep-proven).
6. All controls via primitives (grep-proven).
7. Zero new dependencies; no webfonts; no icon libraries.
8. URL filter state round-trips on reload/back for both ledgers.
9. Labels reachable at `/workspaces/:id/labels`; WorkspacePage hosts only daily-workflow
   surfaces; no `saveSignal`.
10. Responsive verified at 1280/1024/768/480/375 + coarse pointer (manual, reported honestly).
11. Keyboard navigation + reduced-motion verified.
12. `VISUAL_LANGUAGE.md` matches the shipped system (§13 table complete).
13. No backend/API behavior changes.

## 21. Rollback / Recovery Strategy

Each WS is one revertible PR merged only when its exit criteria pass; later WSs are not
started until the previous exits clean, so reverts never cascade. If the WS1 CSS split
causes a defect discovered late, verify via the selector-count diff rather than reverting
wholesale. Tag `pre-redesign-baseline` on the branch point for emergency comparison.

## 22. Scope Guardrails

Out of scope (hard): notifications, comment edit/delete, recently viewed, workspace/
project settings pages, member management, realtime, dark mode, analytics, i18n, mobile
app, ledger pagination, backend/database changes, new dependencies, custom listboxes.
In scope (reorganization only): labels route, invite dialog, switcher, URL filter state,
404 + error boundary, mobile filter disclosure. Any discovered backend dependency is
recorded as a blocker in this folder — never implemented silently.

## 23. Open Questions

1. **Switcher data freshness** — should the shell refetch `GET /workspaces` after a
   workspace is created/joined (Dashboard currently refetches locally)? *Why it matters*:
   the switcher caches per session and could go stale. *Recommended*: expose a tiny
   `refreshWorkspaces()` on the shell's module-scope cache, called after create/join.
   *Impact*: ~10 lines; no API change.
2. **Saved-view URL param name** — use `view=<id>`? *Recommended*: yes; IDs are already
   the stable handle. *Impact*: none on the API or snapshot format.
3. **Spec folder numbering** — `009-redesign` collides with `009-saved-views`. *Why it
   matters*: documentation drift only. *Recommended*: keep `009-redesign` (as spec 011
   also did) rather than churn cross-references. *Impact*: none on code.

## 24. Final Implementation Order

WS1 → WS2 (SearchDialog → MyIssuesPage → WorkspacePage → DashboardPage) → WS3 → WS4 →
WS5 → WS6 → WS7 → WS8. One PR per workstream, one green suite per PR, one VL update set
per PR. `tasks.md` will be derived from this document only after approval.








