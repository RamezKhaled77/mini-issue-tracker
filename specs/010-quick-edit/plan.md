# Plan 010 — Quick Edit

Inputs: `specs/010-quick-edit/spec.md`. Guiding constraints:

- **Zero backend changes.** `PATCH /issues/:id` + `updateIssueSchema` already support
  every field, authorization, and activity recording (spec §3.1, §3.2, D-01).
- Reuse native `<select>`, existing `label-picker` chips, native date input, `Alert`,
  existing refetch convention. No new state library, no optimistic UI (D-02).
- Preserve the Ticket Ledger signature; the only structural change is the row-link
  restructure (D-04).
- Every phase ends green: `npm run typecheck -w <pkg>`, targeted vitest, and lint.

## Phase 0 — Architecture audit & row restructure foundation

**Objective**: Confirm assumptions (members/labels availability on My Issues; native
control styling) and restructure the ledger row so metadata controls can be siblings
of the navigation link without changing resting visuals.

**Files likely affected**: `frontend/src/pages/WorkspacePage.tsx`,
`frontend/src/pages/MyIssuesPage.tsx`, `frontend/src/styles/components.css`,
`frontend/tests/component/workspace-page.test.tsx`, `my-issues.test.tsx`.

**Responsibility**: Split `Link.ledger-row` into: `Link.ledger-row-link`
(ticket-key + ledger-main + chevron) and a sibling `span.ledger-meta` moved out of the
link, containing the existing badges. Introduce a presentational
`EditableValue`-ready markup hook (`data-quickedit` attributes) with **no behavior
yet** — badges render exactly as today.

**Dependencies**: none.

**Considerations**: CSS must keep the visual run identical (flex order, wrap at
≤700px, edge-bar `::before` sits on `ledger-item` or an equivalent wrapper so it
covers the full row regardless of link split). Selection checkbox untouched.

**Tests**: existing workspace-page + my-issues component tests pass unmodified
(visual/DOM contract preserved apart from internal nesting); new test asserting the
meta is not inside the link and navigation still works from title/key.

**Exit criteria**: typecheck + component tests + lint green; row renders pixel-
identical by class structure; no nested interactive elements (axe stays green).

## Phase 1 — Inline editor primitives

**Objective**: Build the small, reusable editing controls (D-03).

**Files likely affected** (new): `frontend/src/components/QuickEditSelect.tsx`,
`frontend/src/components/QuickEditPopover.tsx` (label/date surface),
`frontend/src/components/quickEdit.ts` (shared types/state helper:
`{ issueId, field } | null`), `frontend/src/styles/components.css`.

**Responsibility**:
- `QuickEditSelect`: badge-styled trigger button → swaps to a native `<select>`
  (autofocused) → change submits via `onCommit(value)`; Escape returns to trigger;
  busy/disabled state (`aria-busy`).
- `QuickEditPopover`: anchored hairline surface hosting the existing
  `label-picker` checkbox chips (working copy + Apply/Cancel) or a native date input
  (+ clear + Apply/Cancel); Escape cancels; focus returns to trigger; Dialog-level
  focus handling reused only if a Dialog-based implementation is chosen.

**Dependencies**: Phase 0.

**Considerations**: Use existing tokens only (spec §14); dotted-underline hover cue;
petrol focus ring; ≥44px coarse-pointer sizing; no new colors.

**Tests** (component): trigger accessible name (`"Change status, currently Open"`);
open/commit/cancel; Escape restores focus; busy disables resubmission; label working
copy discards on cancel; date clear → null commit.

**Exit criteria**: primitives green in isolation; axe clean on each state.

## Phase 2 — Workspace ledger integration

**Objective**: Wire Quick Edit into `WorkspacePage` rows.

**Files likely affected**: `frontend/src/pages/WorkspacePage.tsx`,
`frontend/src/styles/components.css`, `frontend/tests/component/workspace-page.test.tsx`.

**Responsibility**: Replace status/priority badges, assignee chip, label badges, and
add the due-date chip with the Phase 1 primitives; single `quickEdit` state
(`{issueId, field} | null`, D-06); commit → `api.patch('/issues/:id', body)` per D-01
→ existing refetch; row-local `Alert` on failure (D-08) preserving committed values;
no navigation, no selection side effects.

**Dependencies**: Phases 0–1.

**Considerations**: patch bodies: `{status}`, `{priority}`, `{assigneeId: id | null}`
(omit when empty per D-09), `{labelIds: [...]}` full set (D-07), `{dueDate: 'YYYY-MM-DD' | null}`.
Preserve filters/pagination (client state unaffected).

**Tests**: per-field change updates row after refetch (mocked api.patch + refetch);
overdue badge recomputes after due-date change; error → Alert + value preserved;
Escape = no request; checkbox unaffected; no navigation.

**Exit criteria**: full Quick Edit works on Workspace ledger; suite green.

## Phase 3 — My Issues integration

**Objective**: Same wiring on `MyIssuesPage`, resolving per-row workspace data.

**Files likely affected**: `frontend/src/pages/MyIssuesPage.tsx`, its tests.

**Dependencies**: Phase 2 (reuse patterns verbatim).

**Considerations**: verify `wsLabels`/`members` coverage per row's `workspaceId`
(spec §23); if a row's workspace labels are not loaded, render labels read-only for
that row and never fabricate options (document in code + spec addendum if needed).
Status/priority/assignee/due-date have no workspace-data dependency beyond members.

**Tests**: same matrix as Phase 2 scoped to My Issues; mixed-workspace selection
still disables bulk toolbar as before.

**Exit criteria**: both ledgers support Quick Edit; suites green.

## Phase 4 — Accessibility, responsive, error polish

**Objective**: Close all a11y/responsive obligations.

**Files likely affected**: `frontend/tests/accessibility/core.test.tsx`, CSS,
possibly primitives.

**Responsibility**: axe coverage for ledger in resting/open/error/busy states;
keyboard walkthrough test (Tab → Enter → arrows → Enter; Escape → focus return);
44px coarse-pointer assertions; ≤700px/≤375px wrap/overflow checks; reduced-motion
unchanged.

**Dependencies**: Phases 2–3.

**Exit criteria**: all axe suites green; keyboard-only scenario passes; no overflow
at 375px.

## Phase 5 — Verification & documentation

**Objective**: Whole-repo verification and visual-language documentation.

**Files likely affected**: `frontend/VISUAL_LANGUAGE.md` (document the badge-styled
inline editor + due-date chip if introduced as a new reusable pattern, per spec §14),
`specs/010-quick-edit/tasks.md` (created only after Stage-1 approval).

**Responsibility**: run `typecheck`, `lint`, `test`, `build` for frontend and backend
(backend unchanged — confirm no diff); walk the Visual Review Checklist; update
`VISUAL_LANGUAGE.md` only for genuinely new implemented patterns.

**Exit criteria**: all suites pass; docs updated or explicitly unchanged; tasks
checked off.

## Dependencies between phases

`Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5`. Phases 2 and 3 share
primitives but can proceed in either order after Phase 1; Phase 2 first is
recommended (simpler workspace-scoped data).

## Risks

- **Row restructure regressions** (Phase 0): mitigated by keeping class names and
  resting DOM contract stable; existing component tests guard.
- **Native select styling mismatch**: badge-sized selects may look odd across
  browsers; mitigated by trigger-button → select swap rather than permanent selects.
- **My Issues workspace-data gaps** (Phase 3): honest degradation (read-only labels)
  rather than fabrication; may be trimmed per Q-04.
- **Anchor/overflow of popovers** near viewport edges: keep surfaces full-row-width
  on narrow screens (spec §15).
