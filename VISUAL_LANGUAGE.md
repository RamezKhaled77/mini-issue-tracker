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
3. `frontend/src/styles/base.css` — reset, defaults, focus, reduced motion.
4. `frontend/src/styles/components.css` — component and page anatomy.
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
- Layout: `--layout-max-width: 1200px`, `--layout-gutter: 1.5rem`,
  `--reading-measure: 68ch`.

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
- `WORKSPACE` eyebrow
- Workspaces navigation
- user identity
- sign out

The wordmark is more visually important than the navigation.

- Desktop: 232px wide, white surface, hairline right border.
- Wordmark: petrol 28px ledger-mark (4px radius) + stacked `Mini` (16px bold)
  / `Issue Tracker` (12px semibold uppercase).
- Active navigation state: **subtle petrol left accent rule + subtle tint**
  (`--color-accent-subtle` background, 3px petrol left rule, petrol text,
  semibold) — **not** a large rounded pill.
- Hover: quiet warm surface tint.
- Footer, separated by a hairline, holds the avatar + name/email and a ghost
  sign-out button.

Do not invent navigation items. Do not add fake `Recent`, `Current workspace`,
fake project navigation, analytics, settings, or notifications unless the
application actually gains those features. **Visual design must reflect real
product data and real navigation.**

---

## 15. Workspace Selector

The workspace selector feels like a **navigation ledger**:

- ruled rows (hairline separators between them)
- compact height
- strong workspace name
- Owner/Member as a quiet neutral badge
- aligned trailing chevron

Avoid turning workspaces into large cards. Do not fabricate project counts,
issue counts, activity, avatars, or statistics if the API does not provide
them. **Data honesty is part of the visual language.**

---

## 16. Workspace Workbench

The workspace page is the primary workbench. Its structure, top to bottom:

1. Breadcrumb / back link
2. Workspace title
3. Status statistics strip
4. Priority metadata line
5. Projects rail
6. Issues ledger
7. Labels rail (management list + color picker)

The page is **one connected working surface**. The statistics are a ruled strip
attached to the page — **not** a large "Dashboard" card. There is no generic
`Dashboard` card anywhere.

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

Each issue row communicates, in order:

1. **Priority** through a small vertical **edge bar** (3px, priority color).
2. Ticket key (mono).
3. Issue title (600).
4. Optional short description.
5. Status.
6. Priority.
7. Label chips (up to two, in the label's own color tone; a `+N more` text
   appears when the issue has more).
8. Assignee.
9. Directional chevron.

The row feels like a real ledger entry. Use approximately **44px row height**
on desktop.

The priority edge bar is one of the product's strongest visual signatures. It
should appear consistently across the issue list, hover states, and the issue
detail identity where appropriate.

---

## 20. Issue Row Hierarchy

Intended hierarchy: **ticket key → issue title → metadata**.

- Ticket key: mono, compact, strong enough to scan, not overly faint. On row
  hover it turns petrol.
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
- bounded by top/bottom hairlines, sticky on desktop

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

## 26. Comment Composer

The composer is **connected to the comment stream**:

- a hairline rule separates it from the previous comments
- textarea
- bottom-aligned `Add comment` primary button

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

- **≤1100px**: workspace two-column layout collapses; projects panel stops
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

## 41. Final Principle

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