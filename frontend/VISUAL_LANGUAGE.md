# Mini Issue Tracker — Visual Language & Design Direction

**Status**: Permanent. This is the visual source of truth for the product.

Every future feature, page, component, or refactor must produce UI that feels like
it was designed as part of the same product. When a design decision is unclear,
this document — not a generic design principle, not a popular SaaS convention, and
not a new aesthetic — is the authority.

> **The goal is not to make the interface look impressive.
> The goal is to make it look intentional, coherent, useful, and unmistakably
> Mini Issue Tracker.**

---

## 1. Purpose

Whenever we add a feature, create a page, modify a component, or refactor an
existing screen, the resulting UI must feel like it belongs to the same family:

> **warm paper + ink + petrol + hairline rules + editorial typography + dense
> ledger structure + restrained semantic color.**

This document captures that family as **rules**, not as a screenshot gallery. A
developer or agent should be able to produce consistent UI from this document
alone, months from now, without re-deriving the design from the code.

---

## 2. Source of Truth

The approved visual direction is **already implemented**. In priority order:

1. The currently implemented UI (`frontend/src`).
2. `frontend/src/styles/tokens.css` — the single source of every design value.
3. `frontend/src/styles/base.css` — reset, defaults, focus, reduced motion, global
   coarse-pointer touch targets.
4. The component CSS split (Workstream 1 of spec 012), imported via
   `frontend/src/styles/index.css` in this cascade order:
   - `layout.css` — app shell, sidebar/rail, page scaffolds, stat strip
   - `controls.css` — buttons, avatar, badges, fields, control primitives, shared control patterns
   - `ledger.css` — the ticket ledger signature, bulk selection layer, quick-edit row layer
   - `overlays.css` — dialogs, search overlay, popovers, mention autocomplete, key-caps
   - `pages/{dashboard,workspace,labels,my-issues,issue,auth}.css` — page-scoped composition
   Media queries live in the file that owns the component; each breakpoint value
   appears once per file. No raw hex outside `tokens.css`. Class-prefix ownership:
   `app-*`/`sidebar-*` (layout), `btn`/`badge`/`avatar`/`field`/`input`/`select`
   (controls), `ledger-*`/`qe-*`/`bulk-*` (ledger), `fact-*` (issue page).
5. Existing React components and pages.
6. Reference screenshots under `inspiration & references/`.

Do **not** replace this visual language with generic SaaS design principles.
Do **not** introduce a new aesthetic. Do **not** assume something is correct just
because it is common in modern dashboards.

If a principle in this document ever conflicts with the implemented code, the
implemented code wins — and this document should be corrected to match.

---

## 3. Core Design Direction

The product is:

> **A dense editorial workbench / ticket ledger for small teams.**

The visual character combines:

- editorial / document-like structure
- restrained neo-brutalist influence
- dense information hierarchy
- warm paper surfaces
- hairline rules
- confident typography
- minimal elevation
- strong alignment
- practical utility
- subtle personality

The UI should feel: **deliberate, calm, structured, tactile, professional,
slightly unconventional, information-dense without being cramped.**

It should **NOT** feel like:

- generic SaaS
- a template dashboard
- a card-heavy admin panel
- a Linear clone
- a Vercel clone
- a glassmorphism interface
- a gradient-heavy startup landing page
- a material-design application
- an overly rounded modern dashboard

---

## 4. The Most Important Visual Principle

> **The ledger is the visual signature of Mini Issue Tracker.**

The interface relies heavily on:

- ruled surfaces
- horizontal hairlines
- vertical dividers where appropriate
- strong alignment
- compact rows
- editorial typography
- restrained color

Always prefer:

- structural borders over shadows
- rows over cards
- whitespace + rules over decorative containers
- hierarchy through typography and alignment over excessive color

---

## 5. Visual Vocabulary

These are the recurring design primitives. They map 1:1 to tokens in `tokens.css`.

### Paper

The application uses a warm paper-like background. The background must never feel
pure-white and sterile.

| Role | Value | Token |
|------|-------|-------|
| Page background | `#F5F3EE` | `--color-bg` |
| White content surface | `#FFFFFF` | `--color-surface` |
| Subtle surface (hover/tint) | `#ECE9E2` | `--color-surface-subtle` |
| Row/surface hover | `#F5F3EE` | `--color-surface-hover` |

### Ink

Text hierarchy relies on contrast and weight, not on many colors.

| Role | Value | Token |
|------|-------|-------|
| Primary text | `#171714` | `--color-text` |
| Muted text | `#65625A` | `--color-text-muted` |
| Faint metadata / placeholders | `#8B877D` | `--color-text-faint` |

### Rules

Rules are a **major structural element**. They separate sections, rows,
metadata, comments, navigation items, stat groups, and fact-sheet fields.

| Role | Value | Token |
|------|-------|-------|
| Normal hairline border | `#D5D1C8` | `--color-border` |
| Strong border | `#B8B3A8` | `--color-border-strong` |

Do not turn every component into a bordered card. Use rules to connect a surface
into a document; reserve full bordered containers for things that genuinely need
them (dialogs, inputs, controls).

---

## 6. Brand Color — Petrol

Petrol is the product's single brand / interaction color.

| Role | Value | Token |
|------|-------|-------|
| Primary brand / interaction | `#087F73` | `--color-accent` |
| Hover / darker brand | `#06665D` | `--color-accent-hover` |
| Subtle brand surface | `#E7F3F0` | `--color-accent-subtle` |
| Text on accent | `#FFFFFF` | `--color-accent-text` |

Use petrol for:

- primary actions
- active navigation indicators
- selected project state
- brand marks
- important interactive emphasis
- selected / active UI states
- links, focus rings, the ticket key on the issue detail page

Do **not** use it everywhere. The interface stays predominantly
**paper + ink + rules**, with petrol as a deliberate accent.

---

## 7. Coral — Destructive / Attention

| Role | Value | Token |
|------|-------|-------|
| Coral | `#F05A47` | `--color-coral` |
| Coral hover | `#D64535` | `--color-coral-hover` |
| Coral tint background | `#FEF1EF` | `--color-coral-bg` |
| Coral border | `#FBC5BD` | `--color-coral-border` |

`--color-danger*` tokens map to coral.

Coral is for **destructive actions, delete actions, and attention states where
appropriate**. It is **NOT** a second brand color.

Delete buttons should be visually noticeable but not visually dominant. Prefer:

- restrained coral
- text-level coral
- subtle hover tint

over giant red blocks, unless the action genuinely requires strong emphasis.

---

## 8. Status Color System

Semantic status colors, used in status tags, status indicators, statistics, and
relevant metadata. Never as decorative page accents.

| Status | Foreground | Background | Border |
|--------|-----------|------------|--------|
| Open | `#2563EB` | `#EFF6FF` | `#BFDBFE` |
| In Progress | `#B45309` | `#FFF7ED` | `#FED7AA` |
| Closed | `#16A34A` | `#F0FDF4` | `#BBF7D0` |

Token roles: `--color-info*` (Open), `--color-warning*` (In Progress),
`--color-success*` (Closed). Badge roles: `--color-badge-info*`,
`--color-badge-warning*`, `--color-badge-success*`.

---

## 9. Priority Color System

| Priority | Value | Badge bg | Badge border | Token family |
|----------|-------|----------|--------------|--------------|
| Low | `#6B7280` | `--color-surface-subtle` | `--color-border` | `--color-badge-low*` |
| Medium | `#A16207` | `#FEF9EC` | `#F3E0AE` | `--color-badge-medium*` |
| High | `#C2410C` | `#FFF7ED` | `#FED7AA` | `--color-badge-high*` |
| Urgent | `#C2281D` | `#FEF1EF` | `#FBC5BD` | `--color-badge-urgent*` |

Priorities stay subordinate to the main content hierarchy. They use compact
rectangular tags / small swatches / edge indicators — **not** large colorful
badges.

---

## 9a. Label Color System

A fixed, muted categorical palette for workspace labels. Labels always show
their name as text, so color is a supporting cue — never the only indicator.
The palette is deliberately distinct from the brand (petrol), danger (coral),
status, and priority families.

| Color | Foreground | Background | Border | Token family |
|-------|-----------|------------|--------|--------------|
| Violet | `#5B3F9E` | `#F3EFFB` | `#D9CEF0` | `--color-label-violet-*` |
| Magenta | `#A21C6E` | `#FBEFF6` | `#EFCFE1` | `--color-label-magenta-*` |
| Indigo | `#4F46A3` | `#EEEDFA` | `#D4D2EF` | `--color-label-indigo-*` |
| Olive | `#566B1F` | `#F1F4E8` | `#DDE4C9` | `--color-label-olive-*` |
| Sand | `#7A5A2E` | `#F7F1E7` | `#EADCC6` | `--color-label-sand-*` |
| Plum | `#7A3B5C` | `#F6EEF2` | `#E8D4DE` | `--color-label-plum-*` |

Usage rules:

- Badge tones: `label-<color>` on `Badge` (e.g. `label-violet`).
- Color-aware chips in the issue form use a swatch dot plus a tinted selected
  state in the label's own color family (`.label-chip--<color>`).
- The label color picker and the management list use the same swatch tokens
  (`.color-radio-swatch--<color>`, `.label-swatch--<color>`).
- The mapping from a shared `LabelColor` to a badge tone lives in
  `frontend/src/lib/labelTone.ts`; unknown colors fall back to `neutral`.
- The fixed palette means labels are never a new arbitrary color per label.
  The `LABEL_COLORS` constant in `shared/index.ts` is the single source of
  truth for valid colors (also enforced by the backend validator).

---

## 10. Typography

Font stacks (tokens):

- Sans: system-ui stack (`--font-sans`)
- Mono: ui-monospace stack (`--font-mono`)

Type scale (token → use):

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `--text-display` | 30px | 700 | Page titles |
| `--text-title` | 18px | 650 (fallback 600/700) | Section headings |
| `--text-strong` | 16px | 600 | Issue titles / emphasis |
| `--text-body` | 15px | 400 | Body / default |
| `--text-meta` | 13px | 500 where appropriate | Metadata |
| `--text-label` | 12px | 500–600 | Labels / eyebrows |
| `--text-mono` | 13px | 600 | Ticket keys / counts |

Page titles use `letter-spacing: -0.02em` (`--tracking-tight`) and
`line-height: 1.15`.

### Ticket keys

Use the mono face, 13px, weight 600, tabular numbers, visually distinct from
prose. Ticket keys are **identifiers**, not ordinary text. The implemented
format is `#XXXXXX` (first six alphanumerics of the id, uppercased) — see
`frontend/src/lib/issueKey.ts`.

---

## 11. Editorial Typography Rules

Use typography to create hierarchy:

> **Page title → section title → content → metadata**

Avoid:

- excessive font sizes
- giant dashboard numbers
- too many bold elements
- excessive uppercase text
- decorative typography

Mono uppercase text should communicate **structure**, such as:

`WORKSPACE` · `ISSUE` · `COMMENTS` · `DETAILS` · `STATUS` · `PRIORITY` ·
`ASSIGNEE` · `PROJECT` · `DUE DATE`

It reads as editorial labeling, not decoration. In the implementation this is
the `.section-eyebrow`, `.sidebar-eyebrow`, `.stat-label`, and `.fact-label`
pattern: mono, uppercase, letter-spaced (`0.08em`–`0.1em`), faint.

---

## 12. Spacing System

The established scale (4px base):

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`

Tokens: `--space-1` (4) → `--space-9` (64). A `--space-4-5` (20px) token exists.

Rules:

- Keep a consistent rhythm; do not introduce arbitrary values without a clear
  structural reason.
- The interface is compact and vertically connected.
- Avoid excessive empty vertical space that makes the app feel like a landing
  page.
- Layout: `--layout-max-width: 1440px`, `--layout-gutter: 1.5rem`,
  `--layout-gutter-wide: 2.5rem` (at ≥1280px), and
  `--reading-measure: 68ch`. The wider cap is for working surfaces with a
  navigation rail and ledger; individual reading content remains bounded by
  the reading measure.

---

## 13. Borders, Radii & Elevation

Approved radii:

| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 2px | 3px edge bars, tiny swatches, compact row actions |
| `--radius-sm` | 4px | Controls, badges, inputs, buttons |
| `--radius-md` | 6px | Surfaces |
| `--radius-lg` | 8px | Dialogs / large overlays |
| `--radius-pill` | 999px | Avatars only (50%) |

Avoid:

- 12–24px rounded cards
- pill-shaped containers everywhere
- excessive softness

Shadows are intentionally minimal (`--shadow-xs/sm/md/lg`, all derived from
ink `rgba(23,23,20,…)`). Use elevation primarily for dialogs, overlays, and
elements that genuinely need separation. Normal application surfaces rely on
**paper + borders + spacing**, not shadows.

---

## 14. The Sidebar

The sidebar is intentionally quiet. It contains only what the product really
has:

- Mini / Issue Tracker wordmark
- `WorkspaceSwitcher` (current-workspace identity + real workspace list)
- `WORKSPACE` eyebrow — Workspaces navigation, Search
- `PERSONAL` eyebrow — My Issues navigation
- **Contextual workspace nav** (`WORKSPACE` eyebrow, rendered only when the
  route is inside a workspace): Issues → `/workspaces/:id`, Labels →
  `/workspaces/:id/labels`
- user identity
- sign out

The wordmark is more visually important than the navigation.

- Desktop: 240px wide, white surface, hairline right border.
- Wordmark: petrol 28px ledger-mark (4px radius) + stacked `Mini` (16px bold)
  / `Issue Tracker` (12px semibold uppercase).
- Navigation: grouped under uppercase mono eyebrows (`WORKSPACE`,
  `PERSONAL`), reusing the same `.sidebar-link` / `.sidebar-link--active`
  treatment for both groups. **My Issues** (a 16px stroke inbox-style icon +
  label) sits under `PERSONAL`, directly below Workspaces and above the
  footer. It collapses to the icon rail at ≤1024px and to the top bar at
  ≤700px exactly like the rest of the navigation.
- Active navigation state: **subtle petrol left accent rule + subtle tint**
  (`--color-accent-subtle` background, 3px petrol left rule, petrol text,
  semibold) — **not** a large rounded pill.
- Hover: quiet warm surface tint.
- Footer, separated by a hairline, holds the avatar + name/email and a ghost
  sign-out button.
- The wordmark has a closing hairline below it. The `PERSONAL` navigation
  group begins after its own hairline and `--space-4` separation, so the two
  real navigation contexts are structurally distinct without adding routes.
- At desktop widths, a small bordered chevron control on the sidebar edge
  collapses it to the existing 56px icon rail. Width, labels, and the chevron
  animate with the existing 180ms standard motion; the main workbench expands
  naturally through the flex layout. The control has an accessible expanded
  state and is hidden at ≤1024px because that breakpoint already enforces the
  icon rail. It is also absent from the ≤700px top bar.
- In every icon-rail state (manual desktop collapse and the ≤1024px responsive
  rail), interactive sidebar items—brand, collapse control, navigation links,
  and sign-out—show a compact paper-and-rule tooltip on hover or keyboard
  focus. Tooltip text repeats the existing accessible name; it adds no unique
  information. Tooltips are hover/fine-pointer only and are suppressed in the
  ≤700px mobile top bar.
- The `WorkspaceSwitcher` sits directly below the wordmark and precedes the
  `WORKSPACE` nav group. It collapses to a compact indicator in the ≤700px top
  bar; its popover contract (Escape / focus-return / click-outside /
  `aria-expanded`) is shared with the quick-edit popover family.

Do not invent navigation items. Do not add fake `Recent`, `Current workspace`,
fake project navigation, analytics, settings, or notifications unless the
application actually gains those features. **Visual design must reflect real
product data and real navigation.** `PERSONAL → My Issues` exists because the
product genuinely aggregates the signed-in user's assigned issues. The
contextual `WORKSPACE` nav exists only while a workspace route is active and
lists only real, implemented workspace surfaces (Issues, Labels).

---

## 15. Workspace Selector

The workspace selector is now the **`WorkspaceSwitcher`** in the sidebar: a
bordered trigger (`.workspace-switcher-trigger`) showing the current workspace
name (or "Workspaces" when not in one), a small petrol initial indicator, and
a caret. Activating it opens a paper popover listing the authorized
`GET /workspaces` results, each with its Owner/Member neutral badge, plus an
"All workspaces" entry linking to `/`.

- The list is **never** fabricated: it is exactly the authorized `/workspaces`
  response (same call the Dashboard uses), so switching can never leak
  inaccessible workspaces.
- Current workspace carries `aria-current` and the petrol active treatment.
- Popover = Escape closes / focus returns to trigger / click-outside closes /
  `aria-expanded` on the trigger (shared with the quick-edit popover family).
- Data freshness: the shell caches the list per session; the Dashboard
  refreshes the cache after creating or joining a workspace.

Avoid turning workspaces into large cards. Do not fabricate project counts,
issue counts, activity, avatars, or statistics if the API does not provide
them. **Data honesty is part of the visual language.**

## 15a. Labels route

Labels management lives on a dedicated route (`/workspaces/:id/labels`) via
`LabelsPage` (spec 012 §7). It is the `LabelsSection` component rendered on the
workbench layout without the project rail: a `PageHeader` (workspace name,
mono `Workspace` eyebrow, back-link) above the ruled label list and color
picker. The contextual workspace nav keeps Labels reachable from within a
workspace.

---

## 16. Workspace Workbench

The workspace page is the primary workbench. Its structure, top to bottom:

1. Breadcrumb / back link
2. Workspace title
3. Status statistics strip
4. Priority metadata line
5. Projects rail
6. Issues ledger
7. Invitations live behind an "Invite" button in the workspace masthead
   (accessible only to the owner), and Labels management moved to the dedicated
   `/workspaces/:id/labels` route — neither the manage list nor invitations
   occupy the daily-workflow rail anymore.

The page is **one connected working surface**. The statistics are a ruled strip
attached to the page — **not** a large "Dashboard" card. There is no generic
`Dashboard` card anywhere.

On desktop the workbench uses a `minmax(236px, 280px)` project rail and a
flexible issue ledger, separated by `--space-6` and a rail-side hairline. The
rail keeps its project list sticky while the ledger has room to scan. This is a
workspace composition, not a card layout. The rail collapses below 900px.

---

## 17. Statistics Strip

Statistics are a ruled editorial data strip.

Each status cell contains:

- the **count** above (22px, bold, tabular numbers)
- a **quiet mono label** below (`OPEN`, `IN PROGRESS`, `CLOSED`)

Cells are separated by subtle **vertical hairlines**; the first has none. The
strip closes with a hairline.

Priority totals sit underneath as subtle metadata: a mono line of small swatch +
`n Low / n Medium / n High / n Urgent`, plus a total. It reads like a caption,
not widgets.

The strip has a hairline above and below, with `--space-3` top breathing room.
Counts use 24px bold tabular type. The count itself may use its existing
semantic status color (Open/info, In Progress/warning, Closed/success; the My
Issues overdue count/danger); labels remain faint mono so color never replaces
the textual status.

---

## 18. Projects Rail

Projects are **navigation, not cards**.

- horizontal ruled rows
- selected row: 3px petrol left rule + subtle petrol tint + petrol project name
- hover: warm surface tint

The selected project does **not** need a "Selected" badge, a heavy outline, a
large card, or a shadow.

Project names dominate. Rename/Delete controls stay subordinate: quiet ghost /
faint text at rest, coral tint + coral text on delete hover.

---

## 19. Ticket Ledger

This is the most important component in the product.

The ledger signature is implemented once as the canonical `LedgerRow`
(`frontend/src/components/LedgerRow.tsx`, CSS in `ledger.css`) and consumed by
every surface: the Workspace project ledger, My Issues, global Search
(compact variant), and the Dashboard workspace list (workspace variant).
Multiple historical copies were consolidated (Workstream 2 of spec 012);
**page ledger row markup must not be hand-assembled again** — always mount
`LedgerRow`.

Each issue row communicates, in order:

1. **Priority** through a small vertical **edge bar** (3px, priority color).
2. Ticket key (mono).
3. Issue title (600).
4. **Caption slot** for an optional short description or project name — the
   single caption location for any consumer (replaces the previously
   inconsistent `ledger-context` styling).
5. Status.
6. Priority.
7. Label chips (**capped at two** across all surfaces — a consistent rule that
   previously only applied to My Issues), in the label's own color tone.
8. Assignee.
9. Due date (default variant only; the **compact** search variant hides it).
10. Directional chevron.

The row feels like a real ledger entry. Use a **56px minimum row height** on
desktop with 12px vertical padding; a wrapped title may naturally make it
taller. This preserves scan rhythm while giving the primary title and its
secondary detail enough separation.

The priority edge bar is one of the product's strongest visual signatures. It
should appear consistently across the issue list, hover states, and the issue
detail identity where appropriate.

### Anatomy & ownership

`LedgerRow` owns the row structure, visual/interaction states, responsive wrap
and row semantics (`<li class="ledger-item">` with `data-priority` /
`data-overdue`). Pages compute and pass: `issueKey`, `isOverdue`, label tones,
bulk-selection state, and quick-edit state — **business logic does not live in
the row**. Label badges are capped at two inside the component.

For page ledgers (Workspace / My Issues) the **metadata run is rendered outside
the navigation link** (preserving the quick-edit contract that editing must
never trigger navigation); overlay (search) and Dashboard workspace rows keep
metadata inside the single link.

### Cross-workspace ledger (My Issues)

When a ledger mixes rows from several workspaces (the **My Issues** page), each
row carries a quiet **workspace/project context caption** (`.ledger-context`,
`WorkspaceName / ProjectName`) placed directly before the status badge. It
uses the same visual family as the assignee caption: mono (`--text-mono`),
faint `--color-text-faint`, tabular-nums, `white-space: nowrap`. It must stay
quieter than the status/priority badges so the title and metadata hierarchy
from §20 is preserved.

This extension applies wherever a cross-workspace ledger appears (issue lists,
search results, related references). Rows still open the normal issue detail
page via `/workspaces/:workspaceId/issues/:id`.

### Overdue ledger rows

An issue is **overdue** when its due date is before today and it is not
`Closed` (derived client-side via `frontend/src/lib/isOverdue.ts`; the
definition matches the backend `overview.overdue` count). Overdue rows get a
**coral attention treatment** on every ledger that renders issues — the My
Issues ledger and the workspace project issue ledger:

- a restrained **1px inset coral rule** (`--color-danger-border`, deepening to
  `--color-danger` on hover), so the normal row separators and ledger geometry
  remain intact
- a **coral tint background** (`--color-danger-bg`)
- a **coral `Overdue` badge** (`badge--danger`) placed before the status badge

This is the established semantic role of coral in the system (attention
states, §7) applied to the ledger signature. The priority edge bar, ticket
key, and other row anatomy remain unchanged — the coral treatment is additive,
never decorative, and never replaces status/priority colors.

---

## 19b. Global Search — "the ledger, lifted" (overlay pattern)

Global Search is an **overlay composition of existing primitives**, not a new
component family. It is the product's only intentional "ledger, lifted"
surface.

**Trigger.** A `sidebar-link`-class button ("Search", magnifier icon) in the
WORKSPACE nav group. It inherits all sidebar responsive states (full label →
icon-rail tooltip at ≤1024px → top bar at ≤700px) via the `button.sidebar-link`
reset rule. Tooltip text documents the shortcut: "Search (/)".

**Overlay structure.** The search overlay **composes the existing Dialog**
(`.dialog-overlay` / `.dialog`, full focus trap + Escape + focus-return
contract). Inside: a labelled text input with a quiet × clear control, a
hairline top rule, then a results region with a fixed minimum height (180px)
so loading skeletons never shift layout. ~640px wide on desktop; at ≤700px the
overlay anchors toward the top as a near-full-width sheet
(`:has(.search-dialog)` scoping only). No gradients, glass, or palette
aesthetics.

**Result rows.** A compact ledger variant, `.ledger-row--search`:
`data-priority` edge bar, `.ticket-key`, `.ledger-main` title,
`.ledger-context` workspace/project caption, `.ledger-meta` badges
(status → priority → labels → assignee), `data-overdue` treatment. Slightly
reduced vertical padding versus page ledgers; hover/active treatment is
`--color-surface-hover` plus petrol key (`.ledger-row--active` for the
keyboard-driven active row). The whole row is the link; no chevron.

**States.** Idle = mono petrol SEARCH eyebrow + one guidance line; loading =
existing SkeletonRows; counts/errors announced politely (`role="status"`).
Counts come from the API — never fabricated.

**Keyboard.** `/` and Ctrl/Cmd+K open search from anywhere except typing
contexts (input/textarea/select/contenteditable); ArrowUp/ArrowDown move the
active result; Enter activates; Escape closes with focus return.

**Reuse when:** building any transient cross-context lookup over
ledger-shaped data. **Do NOT reuse** to bolt command execution or navigation
shortcuts onto search — this pattern is lookup-only, not a launcher.

## 19a. Bulk Selection & Actions (ledger interaction layer)

Bulk Actions are an **interaction layer over the ticket ledger**, not a new
surface. The ledger signature (priority edge bar, ticket key, title, metadata,
assignee, chevron) is untouched; selection adds a quiet leading column.

### Anatomy

1. **Selection column** — each ledger row (`<li class="ledger-item">`) leads
   with a compact native checkbox slot (`.ledger-select`) before the row link.
   The checkbox uses `accent-color: var(--color-accent)` and carries an
   accessible name (`Select <issue title>`). It never navigates.
2. **Select-all bar** — a ruled strip above the ledger
   (`.bulk-selection-bar`: hairlines top/bottom, mono uppercase label) holding
   a single **"Select all visible"** checkbox (`.bulk-select-all`). It reflects
   only the currently visible (post-filter) issues and supports an
   **indeterminate** state when the selection covers part of the visible set.
3. **Selected row** — the row link gains `.ledger-row--selected`:
   `--color-accent-subtle` background with an inset 1px
   `--color-accent-border` ring. The priority edge bar and all row anatomy stay
   intact. **Coral is never used for selection** (petrol = interactive
   emphasis; coral stays destructive/attention).
4. **Bulk toolbar** — appears only while ≥1 issue is selected. A ruled bar
   (`.bulk-toolbar`) in the same family as the filter bar: hairlines top and
   bottom, paper surface, compact padding. Contents, left to right:
   - a quiet mono/tabular selected count (`.bulk-count`,
     `role="status"` — announced politely);
   - a labelled native **Action** select (Set status / Set priority / Assign to /
     Add label / Remove label);
   - one action-specific value control (status or priority select, assignee
     select with an explicit **Unassigned** option, or the existing
     `.label-chip` checkbox picker for labels);
   - trailing **Clear** (ghost) + **Apply** (primary petrol) buttons.
   On My Issues, when the selection spans more than one workspace the toolbar's
   controls are replaced by a quiet note ("Bulk actions need issues from a
   single workspace.") and Apply is disabled — cross-workspace bulk is not a
   product capability.
5. **Destructive action (bulk delete)** — choosing **Delete** turns the toolbar
   trigger coral (`btn--danger`, labelled "Delete…") with a quiet coral note
   ("Deleting cannot be undone.", `.bulk-note--danger`). Confirming opens the
   standard **Dialog** ("Delete N issues?" + explanation) whose confirm button
   is coral and which always offers **Cancel**. This is the only place coral
   appears in the bulk layer; selection itself stays petrol.

### Where to reuse

Any future ledger of issues (search results, saved views) should mount the same
selection column + toolbar rather than inventing a new selection UI.

### When NOT to use

Do not add bulk controls to non-ledger lists (projects rail, workspace
selector, activity rows). Do not use the toolbar as a general page-level action
bar; it exists only for a live multi-row selection.

### Responsive & motion

- Coarse pointers: `.bulk-select-all`, `.ledger-select`, toolbar selects and
  buttons sit in the existing 44px touch-target rule.
- ≤375px: `.bulk-toolbar` stacks to a column (like `.filter-bar`) with
  full-width fields and right-aligned actions; no horizontal overflow.
- Appearance/disappearance is instant; no entrance animation beyond the
  standard color transitions (reduced-motion safe).

---

## 20. Issue Row Hierarchy

Intended hierarchy: **ticket key → issue title → metadata**.

- Ticket key: mono, compact, strong enough to scan, not overly faint. On row
  hover and `:focus-within`, the key shifts toward the accent (`--color-accent`)
  to signal the row is interactive.
- Title: 600 weight, primary visual content.
- Metadata (status / priority / label chips / assignee): must not overpower
  the title.

The trailing arrow is subtle by default (faint, 45% opacity). On hover it
strengthens slightly, moves a couple of pixels, and turns petrol; the row gains
a warm tint. Avoid dramatic animations.

---

## 21. Issue Detail Page

The issue page is a **document/workbench**, not a form.

Structure:

- breadcrumb / back link
- issue identity eyebrow
- large issue title
- status/priority metadata
- actions
- divider
- reading surface (description)
- comments + composer
- fact rail

The issue key is visually prominent. Pattern:

`#XXXXXX · ISSUE`

(mono eyebrow — key in petrol, `ISSUE` in faint), followed by the issue title
as the page heading, then a status + priority badge line.

---

## 22. Issue Description

The description is part of the **reading surface**.

- Do **NOT** put the description inside another floating card.
- No card-inside-card, no shadow container, no large bordered description
  panel.
- Use readable line-height (1.6), comfortable measure (`68ch` max), normal
  body typography, generous but controlled whitespace.

The content should feel like a document.

---

## 23. Issue Actions

Edit and Delete live in the issue **masthead** (header), right-aligned.

- Edit: **neutral** button (secondary).
- Delete: **coral** destructive action (danger).

The actions must not compete with the issue title.

---

## 24. Fact Rail

The right-hand Details section is a structured **fact sheet**, not a floating
card.

- hairline separators between fields
- mono uppercase labels (`STATUS`, `PRIORITY`, `ASSIGNEE`, `DUE DATE`,
  `PROJECT`, `LABELS`)
- clear values
- the `LABELS` value renders each label as a `label-<color>` badge (see
  §9a), so label color identity is preserved on the issue detail page.
- compact spacing
- strong top rule, bottom hairline, and a left hairline that separates the
  inspector from the reading surface; sticky on desktop

Typical fields: Status, Priority, Assignee, Due date, Project, Labels.
The rail feels like metadata in an editorial document. Empty values render
honestly as "Unassigned" / "No due date".

---

## 25. Comments

Comments are **ruled rows**, not individual cards.

Each comment contains:

- body
- avatar
- author
- timestamp

Hierarchy: **comment body > author > timestamp**.

- Author: semibold.
- Timestamp: faint.
- Small decorative avatar inline with the author.
- The list is bordered top and between rows, like a chronological record.

Avoid speech bubbles, chat-style rounded cards, excessive avatars, and large
comment containers.

---

## 25a. Activity History (Issue Audit Trail)

The Activity panel shows an immutable, chronological audit trail of what changed
on an issue. It follows the same ruled-row ledger language as comments.

Each activity row contains:

- **Event type indicator**: a 6px colored dot left of the content — petrol for
  creation/updates, coral for deletions/removals.
- **Event label**: concise mono uppercase label (`.activity-type`): `CREATED`,
  `UPDATED`, `LABEL ADDED`, `LABEL REMOVED`, `DELETED`.
- **Actor**: display name in semibold, mono timestamp faint to the right.
- **Change detail** (for `UPDATED`):
  - Field name in mono (`--text-mono`, `--color-text-muted`): `status`,
    `priority`, `assignee`, `due_date`, `title`, `description`, `labels`.
  - Old value (struck through, coral) → New value (petrol, semibold).
  - Labels render as label-tone badges; removed labels show strikethrough.
- **Timestamp**: relative time (`formatRelative`), faint mono.

Rows are bordered top and between rows (hairline `--color-border`). The panel
uses a top hairline to separate from Comments, and an eyebrow `ACTIVITY`
(mono uppercase, faint). Empty state uses the compact EmptyState pattern:
title "No activity yet" with explanation "Changes to this issue will appear
here."

Do not use cards for activity entries. The ruled row pattern matches the
comment stream and ticket ledger — a continuous document surface.

---

## 26. Comment Composer

The composer is **connected to the comment stream**:

- a hairline rule separates it from the previous comments
- textarea
- bottom-aligned `Add comment` primary button

Comment rows use `--space-4` vertical padding to give authored activity a
clearer reading rhythm without turning entries into cards.

It must not look like a detached card.

---

## 27. Avatars

Avatars are initials in a circular mark, **28px** (1.75rem) default, 22px
(`--avatar--sm`) in dense rows.

- Deterministic muted tones derived from a hash of the name (6 tone options,
  defaulting to petrol) — see `frontend/src/components/Avatar.tsx`.
- Tones use the existing semantic tint pairs (info, warning, success, coral,
  neutral) — harmonious with paper/petrol.
- Avatars are supporting metadata, not decoration.

Do not use neon avatars, random gradients, or loud profile colors.

---

## 28. Buttons

Buttons are compact and functional.

| Variant | Appearance |
|---------|------------|
| Primary | petrol fill, white text, semibold |
| Secondary | white surface, strong border, ink text |
| Ghost | transparent, faint-to-muted text |
| Danger | coral fill, white text, semibold |

- Min height 36px desktop; **44px on coarse pointers**.
- 4px radius, 13px medium text.
- Real press state: `translateY(1px)`.
- Disabled: 55% opacity, no hover/focus effects.
- Bottom-aligned danger buttons in dialogs; in rows, danger is text-level coral
  at rest and tints on hover.

Avoid oversized CTA buttons, pills, gradients, and excessive shadows. Button
hierarchy must reflect action importance.

---

## 29. Inputs & Search

- Inputs use **stronger borders than generic minimal SaaS inputs**
  (`--color-border`, strengthening to `--color-border-strong` on hover).
- White surface, 4px radius, 36px min-height (44px on coarse pointers).
- Focus: border turns petrol + `--focus-ring` (3px petrol-subtle ring).
- Invalid fields: coral border.
- Selects are custom-styled with a chevron (`appearance: none`) — no
  browser-default appearance.
- Search has a quiet magnifier glyph and belongs to the toolbar.
- Toolbar controls share equal height, aligned borders, consistent radius,
  coherent spacing.
- The toolbar is a single workbench control surface: it uses `--space-2`
  internal padding and only top/bottom hairlines on a white surface. Search
  takes flexible priority (`flex: 2`), then filters, then the quiet result
  count/clear state. Do not split its controls into independent cards.
- Field anatomy: label (13px medium) → control → hint/error (13px, faint /
  coral), with proper `aria-invalid` / `aria-describedby`.

---

## 30. Empty States

Empty states are **compact**:

- a short semibold title
- a short explanation
- ruled top/bottom boundaries when appropriate
- optional single action

Do NOT add decorative circles, illustrations, giant icons, or unnecessary
graphics. The empty state communicates the absence of data without becoming a
feature of its own.

---

## 31. Responsive Design

The visual language must survive from 1280px down to 375px. Responsive behavior
preserves the same language — it never becomes a different mobile design.

- **≤900px**: workspace two-column layout collapses; projects panel stops
  sticking.
- **≤1024px**: sidebar becomes a compact **icon rail** (56px) — brand, nav,
  user, sign-out keep only icons; issue detail collapses to single column; fact
  rail un-sticks.
- **≤700px**: mobile top bar — sidebar becomes a horizontal bar (brand left,
  nav + user + sign-out right). Ledger rows may wrap; ticket keys must remain
  visible. Issue header/actions stack. Stats cells wrap (≈3 per row). Dialog
  fills width.
- **≤375px**: stats stack vertically, page/section headers stack, filter bar
  stacks; dialogs go near-full-screen (full height, no radius).
- Coarse pointers: interactive controls get **44px min touch targets**.

---

## 32. Interaction Language

Interactions are subtle.

- Short transitions around **120ms** (`--duration-fast`; 180ms for larger).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Hover communicates clickable / selected / available without being theatrical.
- Hover language: warm surface tints, border strengthening, petrol text; the
  ledger chevron shifts 2px.
- Press: 1px downward shift.
- Respect `prefers-reduced-motion` (all animation/transition durations collapse;
  skeleton shimmer stops).

Avoid bouncing, dramatic scaling, large transforms, excessive motion, and
animated gradients.

---

## 33. Accessibility Is Part of the Visual System

A component is not visually correct if it becomes inaccessible. Preserve:

- visible focus states (2px petrol outline with 2px offset globally; petrol
  border + focus ring on fields)
- WCAG AA text contrast in light mode
- keyboard navigation of every core flow
- skip-to-content link (top-left, appears on focus)
- semantic labels, `role="alert"` for errors, `aria-invalid`/`aria-describedby`
  on fields
- focus management: dialogs trap focus, return focus on close, Escape closes;
  errors focus the alert
- status/priority never conveyed by color alone (text always present in badges;
  edge bars are redundant reinforcement)
- 44px touch targets on coarse pointers
- reduced-motion support
- `aria-hidden` on decorative icons/avatars; meaningful avatars get accessible
  names

---

## 34. Data Honesty

**Never invent visual information just to make the interface look richer.**

Do not fabricate:

- counts
- activity
- avatars
- project metadata
- issue metadata
- navigation items
- labels
- statistics

If the backend does not provide something, the UI must not pretend it exists.
The product should feel intentionally minimal, not artificially populated.

---

## 35. What NOT To Do

Future UI work must avoid these patterns unless there is an explicit product
requirement.

**No generic dashboard cards** — avoid `[ 12 Open ] [ 4 Closed ] [ 8 Projects ]`.

**No excessive rounded cards** — avoid turning every section into
`border-radius: 16px`.

**No gradients** — no decorative gradients (the only gradient in the codebase
is the skeleton shimmer, which respects reduced motion).

**No glassmorphism** — no backdrop blur, translucent glass panels, or frosted
navigation.

**No giant shadows** — structure comes from rules and spacing.

**No pill-everything design** — tags are compact rectangular; controls do not
automatically become pills.

**No excessive color** — the UI stays mostly **paper + ink + rules + petrol**,
with semantic status/priority colors.

**No decorative illustrations** unless explicitly required — the application is
a workbench, not a marketing page.

**No fake Linear/Vercel imitation** — do not copy visual conventions from other
developer tools. The product retains its own editorial ledger identity.

---

## 36. New Component Rule

Whenever a new component is created, ask:

1. Does this component need a container at all?
2. Can hierarchy be achieved with typography and spacing?
3. Can a hairline rule do the structural work?
4. Does it belong to the ledger language?
5. Is the component using existing design tokens?
6. Is the color semantic?
7. Is the component visually subordinate to the main content?
8. Does it look like it belongs to the existing application?
9. Does it introduce a new radius, shadow, color, spacing value, or typography
   pattern unnecessarily?
10. Does it preserve accessibility?

If the answer to any is no, reconsider the implementation.

---

## 37. New Page Rule

Whenever a new page is added, it should inherit the existing editorial
structure — do not start from a blank generic dashboard layout.

Reuse:

- page masthead (page-header with bottom hairline, or workspace-masthead)
- breadcrumb treatment (`back-link`)
- ruled sections
- typography hierarchy (page-title → section-title → body → meta)
- paper foundation
- petrol interactions
- compact metadata
- ledger-like rows
- fact-sheet patterns

A new page should feel like another chapter of the same product.

The **My Issues** page is an instance of the standard editorial page
structure: `page-header` ("My Issues") → statistics strip (OPEN / IN
PROGRESS / OVERDUE counts plus an "N assigned to you" mono total) → include-
closed control → ticket ledger (reusing `.ledger-row`, see §19). It is a
ruled ledger surface, not a dashboard of cards. Its stats are informational
and never filter the ledger.

The My Issues page also hosts a **search / filter / sort bar** (reusing the
`filter-bar` pattern from the workspace issues column, see §29): a text
search on title/description, status and priority selects, and a sort select
(default order, due date, priority, title — each ascending or descending).
Narrowing is client-side over the already-fetched list; the summary strip
keeps reporting the real global totals. A quiet mono result count and a
`Clear filters` affordance close the bar.

---

## 38. New Feature Rule

When adding a feature:

1. **First** — reuse an existing visual pattern.
2. **Second** — compose existing primitives.
3. **Third** — extend the design system only when necessary.
4. **Last** — introduce a new visual pattern.

New visual patterns should be rare. The goal is **consistency through reuse**,
not endless component invention.

---

## 39. Design Token Rule

Future styling should prefer existing CSS variables from `tokens.css`.

- Do not introduce arbitrary hard-coded colors.
- Do not create duplicate versions of existing tokens.
- Before adding a token, verify that an existing semantic token cannot
  represent the requirement.
- Components reference **roles**, never raw values — this is what makes Dark
  Mode a future role-remap only.
- Raw values live only in `tokens.css` (and inline SVG data URIs used for
  control glyphs). Component CSS files reference tokens exclusively.
- New shared primitives own their classes in a named CSS file:
  `Input`/`Select`/`Textarea`/`Checkbox` → `controls.css`;
  `PageHeader` → `layout.css`; `LedgerRow`/`LedgerList` → `ledger.css`.

---

## 40. Visual Review Checklist

Before considering any future UI work complete, verify:

- [ ] Does the screen still feel like a warm-paper editorial workbench?
- [ ] Is the ledger language present where appropriate?
- [ ] Are rules doing structural work?
- [ ] Is typography creating hierarchy?
- [ ] Are colors semantic?
- [ ] Is petrol still the primary brand accent?
- [ ] Is coral reserved for destructive/attention states?
- [ ] Are cards being avoided unless genuinely necessary?
- [ ] Are shadows restrained?
- [ ] Are radii restrained?
- [ ] Is spacing consistent with the established scale?
- [ ] Are metadata labels appropriately quiet?
- [ ] Are ticket keys visually consistent?
- [ ] Are issue rows dense but readable?
- [ ] Does the page avoid generic SaaS-dashboard aesthetics?
- [ ] Is data being represented honestly?
- [ ] Does the component work responsively?
- [ ] Are touch targets accessible?
- [ ] Are focus states preserved?
- [ ] Does reduced-motion behavior remain intact?
- [ ] Does the new UI look like it existed in the application from day one?

---

## 41. Saved Views Shelf (Spec 009)

The workspace page's left column hosts a **Saved Views** shelf
(`.saved-views-panel`), placed after Labels. It is a quiet ruled-row list in the
same family as the labels panel — not a card grid, not a widget.

Structure:

- `section-header` + `section-title` ("Saved views") — same as other side
  sections; no separate primary button (the create affordance lives in the
  issue toolbar's `filter-meta` as a ghost "Save view" button).
- `view-list` / `view-row` rows: hairline `border-top` rules, first row
  borderless — identical rhythm to `.label-row`.
- Row anatomy: a text **button** with the view name (`view-row-name`, meta
  size, semibold, ellipsis), an optional quiet `view-row-note`
  (`"project unavailable"` / `"label unavailable"` / `"unavailable"`), and
  trailing ghost Edit / danger Delete actions (`view-row-actions`).

States:

- **Active view**: the applied view's name button turns petrol
  (`--color-accent`) via `.view-row--active` and carries
  `aria-current="true"` — state is communicated by color *and* semantics.
- **Unavailable** (unreadable config or deleted project): name button is
  disabled, rendered in `--color-text-muted`, with the quiet note as the
  non-color signal (`title` mirrors the note).
- Hover on applicable rows: `--color-accent-hover`. No elevation, no new
  tokens.

Reuse this pattern for any future "small named, activatable resource list"
inside a workspace column. Do **not** use it for primary navigation, do not
add counts or decorative icons, and do not promote rows to cards.

---

## 41.5 Quick Edit — Badge-Styled Inline Editors (Spec 010)

Quick Edit adds one genuinely new reusable pattern to the ledger: the
**badge-styled inline editor**. Everything else reuses existing patterns
(badges, `label-picker` chips, native inputs, `Alert`).

### Split row anatomy (structural change)

In a ledger row, the navigation `<Link>` (class `ledger-row-link`) wraps only
`ticket-key` + `ledger-main`. The metadata run (`ledger-meta`, with the
editable controls) and the `ledger-chevron` are **siblings** of the link inside
`li.ledger-item`. The chevron is decorative (`aria-hidden`) and stays the
trailing element so the resting visual order is unchanged: key → main → meta →
chevron. Row chrome (surface, priority edge bar via `.ledger-item::before`,
`data-overdue` coral treatment, `data-priority` bar color, `.ledger-item--selected`
petrol treatment) lives on the **item**, so it spans the full row regardless of
the link split. The Global Search overlay keeps the single-link `.ledger-row`
anatomy — do not convert it.

Do NOT nest interactive controls inside the row link; checkboxes and Quick Edit
controls must remain siblings of it (accessibility rule: no nested interactive
elements).

### The badge-styled inline editor pattern

Resting state: the editable value renders as the ordinary semantic badge
(`.badge--status-*`, `.badge--priority-*`, `.badge--label-*`, `.badge--neutral`
for assignee/due date) applied to a real `<button class="badge … qe-trigger">`
with an accessible name of the form `"Change <field>, currently <value>"`. The
due-date chip shows the real date or a quiet `Due` placeholder — never
fabricated.

Editable cue: on row hover or focus-within, triggers gain a **dotted underline
in currentColor** (`text-decoration: underline dotted`, 1px, offset 3px) —
typography, not decoration. Semantic badge colors never change.

Open state: select-type fields (status/priority/assignee) swap in a native
`<select class="qe-select">` with a petrol border; popover-type fields (labels,
due date) open `.qe-popover` — a flat, absolutely-anchored surface with a
hairline `--border-subtle` border, no shadow/elevation — hosting the existing
`label-picker` chips or a native date input plus Apply/Cancel
(`.qe-popover-actions`). Row rhythm never shifts (the popover is anchored, not
in-flow).

States and semantics:

- **Busy**: control disabled + `aria-busy`; no duplicate submissions.
- **Error**: row-local `Alert` (`role="alert"`, `.qe-row-alert` spans the row
  below the content); the control stays open with the committed value; focus
  moves to the error.
- **Escape**: cancels with no request and returns focus to the trigger.
- **One edit at a time** across the whole page (`{ issueId, field } | null`).

Reuse rules: use this pattern only inside ledger meta runs (workspace ledger,
My Issues ledger; future ticket-related lists). Do NOT use it for full forms,
and never convert title/description into inline editors. When My Issues rows
belong to a workspace whose labels/members are not loaded, render those values
read-only — honest degradation, never fabricated options.

Responsive: at ≤700px the meta run wraps right-aligned; popovers span the row
width (`left/right: var(--space-4)`); triggers and selects grow to ≥44px height
under `(pointer: coarse)` or ≤700px. No new colors, radii, shadows, or fonts —
existing tokens only.

---

## 41.6 Keyboard Shortcuts — Help Dialog & Key-Caps (Spec 009)

Keyboard shortcuts are an **interaction layer**, not a visual feature. They add one
genuinely new reusable pattern (the key-cap) and compose everything else from existing
pieces. The centralized registry (`frontend/src/lib/shortcuts.ts` + `useKeyboardShortcuts`)
is the single source of truth; `Escape`, `Tab`, and arrow navigation inside `Dialog` /
`SearchDialog` / Quick Edit remain owned by those components.

### The key-cap (`.kbd`)

A minimal treatment for displaying a keyboard key name — used only inside the shortcuts
help dialog (and any quiet tooltip hint). It is a **label**, not an interactive control:

- Mono face (`--text-mono`), `--text-label` size, semibold, ink `--color-text`.
- `--radius-sm` on a `--color-surface` fill with a hairline `--border-subtle`; a slightly
  heavier bottom border (2px) gives a quiet keycap read. No elevation, no color.
- Compact padding (`0.125rem 0.375rem`), `nowrap`, `line-height: 1.25`.

Modifiers are platform-appropriate: `⌘` on macOS, `Ctrl` elsewhere (from
`frontend/src/lib/kbd.ts`). Combo/separation tokens between keys render as a quiet mono
"+" (modifier combos) or "then" (two-key sequences).

**Reuse when:** displaying a shortcut elsewhere (tooltips). **Do NOT use** for badges,
status/priority/labels, button text, or anything interactive — badges stay semantic (§28).

### The shortcuts help dialog

Composes the existing `Dialog` (`.dialog-overlay` / `.dialog`) with two ruled groups
(GLOBAL / ISSUE) introduced by `section-eyebrow` headings. Each row is a flex ledger-style
row: leading key-cap run (`.shortcut-keys`, fixed ~7rem) plus meta description
(`.shortcut-desc`, `--text-meta`, muted), separated by a hairline `--border-subtle` like the
comment/activity streams (§25). It lists **only** shortcuts that are registered and active —
deferred or rejected shortcuts are never shown.

- Focus trap, Escape close, and focus-return come free from `Dialog`.
- The Issue group appears only while an issue page (its contextual bindings) is mounted.
- Responsive: key-cap rows reflow to stacked rows on narrow widths; the key and its label
  are never hidden; ≤700px dialog fills width, ≤375px near-full-screen (§31).
- No new colors, radii, shadows, or fonts — existing tokens only.

---

## 42. Final Principle


The most important rule in this document:

> **Do not redesign the visual language every time you add a feature. Extend it.**

Mini Issue Tracker should become **more** visually recognizable as it grows, not
less. Every new screen should belong to the same family:

**warm paper + ink + petrol + hairline rules + editorial typography + dense
ledger structure + restrained semantic color.**

When uncertain between a flashy modern UI pattern and a quieter
ledger/document pattern, prefer the quieter ledger/document pattern.

The goal is not to make the interface look impressive.

The goal is to make it look **intentional, coherent, useful, and unmistakably
Mini Issue Tracker.**
