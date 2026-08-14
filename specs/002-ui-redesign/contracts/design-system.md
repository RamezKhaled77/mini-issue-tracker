# Design System Contract: UI Redesign

**Branch**: `002-ui-redesign` | **Date**: 2026-08-15

This is the interface contract for the redesigned presentation layer. It defines
the design tokens and the required component behavior that any implementation
(per [research.md](../research.md), plain CSS + CSS custom properties with
hand-rolled React components) MUST satisfy. The data/API contract is unchanged
from [feature 001](../001-mini-issue-tracker/contracts/api.md).

## 1. Design Tokens (CSS Custom Properties)

All visual values are defined once as semantic roles. Components MUST reference
roles, never raw values. Dark Mode (out of scope) is a role remapping only.

### 1.1 Color Roles — Light Mode (semantic, not exhaustive)

| Role | Purpose |
|------|---------|
| `--color-bg` | Page background (light, near-white) |
| `--color-surface` | Card / panel / input background (white) |
| `--color-surface-subtle` | Hover / selected tint (very light neutral or accent-tinted) |
| `--color-border` | Default hairline border |
| `--color-border-strong` | Focused / emphasized border |
| `--color-text` | Primary text (near-black) |
| `--color-text-muted` | Secondary text (gray) |
| `--color-text-faint` | Tertiary / placeholder (lighter gray) |
| `--color-accent` | Primary action (brand) |
| `--color-accent-hover` | Primary action hover |
| `--color-accent-text` | Text on accent (white) |
| `--color-success` | Success feedback / Closed status |
| `--color-warning` | Warning / In Progress status / High priority |
| `--color-danger` | Destructive actions / Urgent priority / errors |
| `--color-info` | Info / Open status |
| `--color-danger-bg` / `--color-success-bg` / `--color-warning-bg` / `--color-info-bg` | Badge/alert background tints |

**Rules**: All text meets WCAG AA in light mode (FR-047). Statuses and priorities
MUST be distinguishable by more than color (badges pair color with text; per
SC-006 the labels are always present).

### 1.2 Status / Priority Badge Mapping

| Status | Visual role |
|--------|-------------|
| Open | `--color-info` (tint bg + colored text) |
| In Progress | `--color-warning` |
| Closed | `--color-success` |

| Priority | Visual role |
|----------|-------------|
| Low | Neutral (gray) |
| Medium | `--color-warning` muted (amber) |
| High | `--color-warning` strong (orange) |
| Urgent | `--color-danger` |

Rule: the four priorities must remain visually distinct from one another and from
the three statuses (FR-003).

### 1.3 Typography Scale

| Token | Use |
|-------|-----|
| `--font-sans` | App font stack (system sans-serif, per research §6/§2) |
| `--text-display` | Page titles (workspace, issue detail heading) |
| `--text-title` | Section headings (Projects, Issues, Dashboard) |
| `--text-body` | Default body text |
| `--text-sm` | Meta lines, comments metadata |
| `--text-xs` | Badges, helper text |
| `--text-mono` | Invitation tokens (monospace) |

Rules: a clear hierarchy for page titles → section headings → body → labels →
helper (FR-001); line-height comfortable for reading; no horizontal overflow on
long strings (edge case).

### 1.4 Spacing Scale

`--space-1..--space-6` on a 4px base (4/8/12/16/24/32). Used consistently across
layout gutters, card padding, control padding, and list gaps (FR-004). The page
content column keeps a comfortable max width and generous horizontal padding.

### 1.5 Borders & Radius

- Borders: `--border-subtle` (hairline) for cards, inputs, lists; `--border-strong`
  for focus and selected states (FR-005).
- Radius: restrained — small on controls/badges (pills only for badges/tags),
  slightly larger on cards/dialogs; **no heavily rounded cards** (FR-005).

### 1.6 Elevation

- Default separation via borders, not shadows (FR-005).
- Small elevation (`--shadow-sm`) for the app header/sticky elements.
- Modest elevation (`--shadow-md`) only for dialogs/popovers/overlays so they
  clearly float above content.

### 1.7 Motion

- `--duration-fast` (~150ms) for hover/focus transitions; slower only where
  meaningful. Respect `prefers-reduced-motion` (FR-046); skeleton shimmer must be
  static or removed under reduced motion.

## 2. Interactive States (FR-006, FR-048)

Every control MUST define, at minimum:

| State | Requirement |
|-------|-------------|
| Default | Resting appearance |
| Hover | Subtle background or border change |
| Focus-visible | Visible focus ring (2px offset) on keyboard focus (FR-044) |
| Active/Pressed | Slight visual press |
| Disabled | Muted, non-interactive, no hover/focus effects |
| Selected (list items) | Accent-tinted background + accent border |

Buttons use a single vocabulary: **primary** (filled accent), **secondary/ghost**
(border or transparent), **danger** (destructive). Danger actions are visually
distinct from primary (FR-041).

## 3. Required Component Behaviors

### 3.1 Dialog (FR-033, FR-035)

Reusable for project create/rename, issue create/edit, and destructive
confirmations. MUST implement:

- Focus trap while open (Tab cycles within the dialog).
- Focus returns to the trigger on close.
- Escape closes the dialog.
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing to a visible
  title; optional `aria-describedby`.
- Overlay scrim that blocks interaction with content behind.
- In-dialog title and cancel path.
- On mobile, the dialog expands to a near-full-screen panel (FR-044).

### 3.2 Empty State (FR-040)

Each empty state shows a clear message and, where applicable, a direct action
(e.g., "Create your first project", "Clear filters"). Distinct messaging between
"no issues in this project" and "no issues match filters" (FR-022).

### 3.3 Loading (FR-035, FR-036)

- Initial page loads: skeleton placeholders matching layout; no plain "Loading..."
  text; no layout shift (SC-008).
- In-progress actions: submit buttons disabled with a progress label
  ("Saving...", "Deleting..."); double-submit prevented (FR-034).

### 3.4 Errors & Validation (FR-037, FR-038)

- Field-level: invalid field gets `aria-invalid` and an associated message via
  `aria-describedby`; API `fields` map errors render against matching fields.
- Page/alert-level: `role="alert"` with the existing `useFocusAlert` focus
  management preserved (FR-044).

### 3.5 Success Feedback (FR-039)

Clear, non-disruptive confirmation on create/update: updated list/state, inline
confirmation, or dismissible transient notice. No backend notifications.

### 3.6 Destructive Confirmations (FR-041)

In-app confirmation dialog stating exactly what will be removed ("Delete this
project and all its issues?", "Delete this issue and all its comments?") with a
safe cancel path. No browser `confirm()`.

## 4. Layout & Responsive (FR-042, FR-043)

| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥1280px) | Multi-column workspace (projects | issues), issue detail (main | meta sidebar), dashboard stat grids |
| Tablet (~768px) | Columns narrow; two-col workspace collapses if needed; no horizontal scroll |
| Mobile (~375px) | Single column; dialogs near-full-screen; stat grids 2-col; touch targets ≥44px |

The app header must remain usable at all widths (identity, user, sign-out
collapsible if required).

## 5. Accessibility Contract (FR-044–FR-047)

- WCAG AA text contrast in light mode.
- Full keyboard navigation of every core flow.
- Preserve existing: screen-reader-only labels, `aria-invalid`/`aria-describedby`,
  `role="alert"`, focus-on-error.
- Skip-to-content link (FR-010).
- Respect `prefers-reduced-motion` (FR-046).
- Status/priority never conveyed by color alone (SC-006).

## 6. Non-Goals / Invariants

- NO changes to API, data, permissions, or business rules (FR-049).
- No new functionality, real-time, notifications, uploads, billing, integrations,
  AI, or Dark Mode implementation.
- No new runtime dependencies (per constitution; see research.md).