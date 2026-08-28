---

description: "Task list for Quick Edit implementation"

---

# Tasks — Spec 010: Quick Edit

> Derived from the approved `spec.md` + `plan.md`. Each task is independently verifiable so
> every phase can be validated and committed in isolation. There is **no backend phase**:
> `PATCH /api/issues/:id` already supports every field with authorization, validation, and
> activity recording (spec §3.1–§3.2, D-01). Backend work is verification-only.

**Input**: Design documents from `/specs/010-quick-edit/`

**Prerequisites**: `plan.md` (required), `spec.md` (required for behaviours + decisions),
`frontend/VISUAL_LANGUAGE.md` (visual source of truth)

**Tests**: Frontend component + axe a11y (per `spec.md` §20); backend suite re-run as a
no-change regression gate.

**Format**: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- Include exact file paths in every description
- Decisions referenced as **D-##** / **§##** map to `spec.md`.

---

## Phase 1: Row restructure foundation

**Purpose**: Make ledger metadata interactive-safe (siblings of the navigation link, not
nested inside it) without changing resting visuals. Spec: §3.3, §9 D-04, §14.

- [ ] T001 In `frontend/src/pages/WorkspacePage.tsx`, split the row so `Link` wraps only
  `ticket-key` + `ledger-main` + `ledger-chevron` (navigation), while `ledger-meta`
  (badges, assignee chip) becomes a sibling inside `li.ledger-item`. Add `data-quickedit`
  attributes per field as markup hooks, no behavior yet. Keep every existing class name and
  resting DOM contract.
- [ ] T002 In `frontend/src/pages/MyIssuesPage.tsx`, apply the same split (additionally
  preserving `ledger-select` checkbox sibling and `ledger-context` caption).
- [ ] T003 [P] Adjust `frontend/src/styles/components.css` so the visual run is identical:
  priority edge bar (`::before`) and `data-overdue` treatment move to the row wrapper if
  needed; preserve `.ledger-row` flex order, ≤700px wrap behavior, hover/focus-visible
  states, and chevron affordance.
- [ ] T004 Verify `frontend/tests/component/workspace-page.test.tsx` and the My Issues
  component tests pass unmodified; add a test asserting the meta is NOT inside the link
  and that navigating from title/key still works.

**Checkpoint**: `npm run typecheck -w frontend`, component tests, `npm run lint -w
frontend`, and axe suites green; ledger renders visually unchanged; no nested interactive
elements.

---

## Phase 2: Inline editor primitives

**Purpose**: Reusable, token-faithful editing controls. Spec: §9 D-03/D-05/D-12, §14, §16.

- [ ] T005 Create `frontend/src/components/quickEdit.ts` — shared types + state helper
  (`QuickEditField`, `QuickEditState = { issueId, field } | null`) enforcing one-edit-at-a-
  time semantics (D-06).
- [ ] T006 Create `frontend/src/components/QuickEditSelect.tsx` — badge-styled trigger
  button (accessible name `"Change <field>, currently <value>"`) that swaps to a native
  `<select>` (autofocus) on activation; commit on change; Escape restores trigger and focus;
  busy state disables resubmission with `aria-busy` (D-03, D-12).
- [ ] T007 Create `frontend/src/components/QuickEditPopover.tsx` — anchored hairline surface
  hosting (a) the existing `label-picker` checkbox chips over a working copy of `labelIds`
  with Apply/Cancel (D-07), or (b) a native `<input type="date">` with clear + Apply/Cancel
  (D-09). Escape cancels; focus returns to trigger; busy state as above.
- [ ] T008 [P] Style both in `frontend/src/styles/components.css` using existing tokens only
  (spec §14): dotted-underline hover/focus-within cue, petrol focus ring, ≥44px
  coarse-pointer sizing, flat surfaces with hairline borders, no new colors/radii/shadows.
- [ ] T009 Component tests for primitives (new test file under `frontend/tests/component/`):
  accessible names; open/commit/cancel per control; Escape restores focus with no request;
  busy disables resubmission; label working copy discards on cancel; date clear commits
  `null`.

**Checkpoint**: primitives green in isolation; axe clean in resting/open/busy states;
typecheck + lint green.

---

## Phase 3: Workspace ledger integration 🎯 MVP

**Goal**: A workspace member can change status, priority, assignee, labels, and due date
from the Workspace ledger without navigating away. Spec: §5–§8, §9 D-01/D-02/D-08/D-09,
§11, §13, §18.

- [ ] T010 Wire `quickEdit` state into `frontend/src/pages/WorkspacePage.tsx` and replace
  the status badge with `QuickEditSelect` (`ISSUE_STATUSES`; commit body `{ status }`).
- [ ] T011 Replace the priority badge with `QuickEditSelect` (`ISSUE_PRIORITIES`; body
  `{ priority }`).
- [ ] T012 Replace the assignee chip with `QuickEditSelect` over already-fetched `members`
  with an `Unassigned` option; empty selection omits/nulls `assigneeId` per D-09 (body
  `{ assigneeId }` or omit — match IssueForm semantics).
- [ ] T013 Replace the label badges with a labels control (first badge / `+N more` entry
  point) opening `QuickEditPopover` over already-fetched workspace `labels`; confirm PATCHes
  the full `{ labelIds }` set (D-07).
- [ ] T014 Add a compact due-date chip in `ledger-meta` (real date or quiet `Due`
  placeholder — never fabricated, §13.1) opening the date variant of `QuickEditPopover`;
  commit `{ dueDate: 'YYYY-MM-DD' | null }`.
- [ ] T015 Implement the commit path: disable control while in flight (D-12) →
  `api.patch('/issues/:id', body)` → existing page refetch on success (D-02); on failure
  render a row-local `Alert` (`role="alert"`, D-08) preserving the committed value, moving
  focus to the error; handle 401/404/422/network per spec §17.
- [ ] T016 Verify selection checkboxes, bulk actions, filters, and active saved view are
  unaffected by a Quick Edit interaction; no navigation occurs (§13.5).
- [ ] T017 Component tests (`workspace-page.test.tsx` extensions): per-field change updates
  the row after refetch; overdue badge recomputes after due-date/status change; error →
  Alert + value preserved; Escape sends no request; busy blocks duplicate submission;
  checkbox unaffected; focus returns to trigger.

**Checkpoint**: full Quick Edit works on the Workspace ledger; typecheck + component
 + axe tests + lint green.

---

## Phase 4: My Issues integration

**Purpose**: Same behavior on the cross-workspace ledger, with honest degradation where
workspace data is unavailable. Spec: §9 D-10, §23, plan Phase 3.

- [ ] T018 Verify `MyIssuesPage` `members`/`wsLabels` coverage per row's `workspaceId`;
  if a row's workspace labels are not loaded, render its label control read-only (never
  fabricate options) and record the limitation in code + a spec §23 addendum note.
- [ ] T019 Apply T010–T016 patterns to `frontend/src/pages/MyIssuesPage.tsx` verbatim,
  preserving `ledger-context` and mixed-workspace bulk-disable behavior.
- [ ] T020 Component tests for the My Issues ledger mirroring T017.

**Checkpoint**: both ledgers support Quick Edit; suites green.

---

## Phase 5: Accessibility, responsive, error polish

**Purpose**: Close all §15–§17 obligations.

- [ ] T021 Extend `frontend/tests/accessibility/core.test.tsx` with the ledger in
  resting, open, error, and busy Quick Edit states (axe).
- [ ] T022 Add a keyboard walkthrough test: Tab to editable field → Enter opens → pick →
  Enter commits; Escape cancels and returns focus to the trigger (§16).
- [ ] T023 Responsive checks: controls wrap correctly at ≤700px, ≥44px targets and
  full-width surfaces at ≤375px, no horizontal overflow, ticket-key/title hierarchy
  intact (§15).

**Checkpoint**: all axe suites green; keyboard-only scenario passes; 375px clean.

---

## Phase 6: Verification & documentation

**Purpose**: Whole-repo gates and visual-language bookkeeping. Spec: §22, §14, plan Phase 5.

- [ ] T024 Run full verification: `npm run typecheck -w frontend`, `npm run lint -w
  frontend`, `npm run test -w frontend`, `npm run build -w frontend`; backend typecheck +
  lint + full test suite as a no-change regression gate; confirm `git status` shows zero
  backend diffs.
- [ ] T025 Walk the Visual Review Checklist (§14); update `frontend/VISUAL_LANGUAGE.md`
  only if the badge-styled inline editor / due-date chip constitutes a genuinely new
  reusable pattern (structure, tokens, states, responsive, reuse rules); otherwise state
  explicitly that no visual language changes were introduced.

**Checkpoint**: all suites pass; docs updated or explicitly unchanged; feature complete.

---

## Dependencies

`Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6`. Within Phase 2, T005
precedes T006/T007; T006/T007/T008 are parallelizable. T010–T014 are parallelizable after
T005–T007; T015/T016 complete the wiring before T017.
