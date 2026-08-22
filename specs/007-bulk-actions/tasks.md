---

description: "Task list for Bulk Actions implementation"

---

# Tasks: Bulk Actions

**Input**: Design documents from `/specs/007-bulk-actions/`

**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `frontend/VISUAL_LANGUAGE.md` (visual compliance)

**Tests**: Tests ARE included — backend unit + integration tests, frontend selection-helper unit + component tests, and axe a11y tests (per `spec.md` §24).

**Organization**: Tasks are grouped by implementation phase (per `plan.md`) and by user story (per `spec.md` §6) to enable independent implementation and testing. Backend must finish before frontend consumes the real endpoint, but the frontend selection/toolbar phase can run in parallel using a mocked `api`.

**Note on paths**: Shared types live in `shared/index.ts` (`@mini-issue-tracker/shared`). `frontend/VISUAL_LANGUAGE.md` is the permanent visual source of truth.

**Format**: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1–US8) or the phase it serves
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared contract additions and the bulk limit constant the whole feature compiles against.

- [X] T001 Add `BulkIssueAction`, `BulkIssueRequest`, `BulkIssueResponse` to `shared/index.ts`
- [X] T002 [P] Add `BULK_ISSUE_LIMIT = 20` constant (export from `shared/index.ts` so backend + frontend share one source)

**Checkpoint**: `npm run typecheck -w shared` passes; other packages still compile.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The backend validator, bulk service, route, and wiring that MUST exist before any user story can be exercised end-to-end.

**⚠️ CRITICAL**: No user story UI work can consume the real API until this phase completes (frontend may parallelize with a mocked `api`).

- [X] T003 Create validator `backend/src/api/validators/bulk.ts` — zod discriminated union on `action` (`setStatus`/`setPriority`/`assign`/`addLabels`/`removeLabels`); per-action value required (status/priority enum, UUID or null assignee, unique label UUIDs `1..50`); `issueIds` UUIDs, unique, `1..BULK_ISSUE_LIMIT`
- [X] T004 [P] Implement bulk mutation as a method on `issueService` (`backend/src/services/issue.ts`) — `bulkUpdate` reuses the existing `getIssueWithLabels` / `recordChanges` / `validateAssignee` / `validateLabels` helpers; resolves + authorizes every issue (single workspace or 4xx), one all-or-nothing `db.transaction()`, per-issue activity (reuse over duplication — no separate `bulk.ts` service)
- [X] T005 [P] Add `POST /issues/bulk` to `backend/src/api/routes/issues.ts` — `requireAuth` → `userId`, parse schema (422 + `validationFields`), return `200 { issueIds, count }`
- [X] T006 Wiring: `bulkUpdate` lives on the already-registered `issueService`, so no new service wiring is required in `backend/src/api/routes/index.ts`

**Checkpoint**: Endpoint wired; `npm run typecheck -w backend` + `npm run lint -w backend` pass.

---

## Phase 3: User Story 1 — Bulk API Behavior & Atomicity (Priority: P1) 🎯 MVP

**Goal**: The five bulk actions run via one endpoint with all-or-nothing safety and correct Activity History.

**Independent Test**:
- `setStatus` / `setPriority` / `assign` (null = unassign) / `addLabels` / `removeLabels` across a set → all updated
- One non-existent id → 404, **no** partial mutation on a control issue
- Mixed-workspace ids → 422; cross-workspace assignee / label → 422 with `fields`
- >20 ids / duplicate ids / empty ids → 422
- Each issue recorded its own activity; a no-op field emits no event

### Tests for User Story 1 (write first, ensure they FAIL before implementation)

- [X] T007 [P] [US1] Backend unit tests `backend/tests/unit/bulk-validators.test.ts` — each action requires its own value; unknown action rejected; duplicate issueIds, empty ids, >20 ids, and label/assignee UUID rules enforced
- [X] T008 [P] [US1] Backend integration tests `backend/tests/integration/bulk-issues.test.ts` — success per action, assign/unassign, all-or-nothing (bad id leaves a control issue unchanged), mixed-workspace `422`, cross-workspace assignee/label `422`, duplicates, >20 ids, activity rows + no-op emits nothing

### Implementation for User Story 1

- [X] T009 [US1] Refine `issueService.bulkUpdate` in `backend/src/services/issue.ts` against the integration suite — workspace grouping, atomicity, per-issue activity diffing (reuses `recordChanges` / update/label helpers)
- [X] T010 [US1] Return `BulkIssueResponse` with the exact updated issue set and `count` (verified in the integration suite)

**Checkpoint**: User Story 1 complete — one request atomically mutates a set with a clean audit trail.

---

## Phase 4: User Story 2 — Selection & Bulk Toolbar (Priority: P1) 🎯

**Goal**: Pure selection state, the API client method, and the reusable `BulkToolbar` (ruled bar) both ledgers will mount.

**Independent Test**:
- Selection helper: toggle, select-all (visible-only), clear, count, workspace grouping
- `api.bulkUpdate` posts to `POST /api/issues/bulk` once with `{ action, issueIds, ...value }`
- Toolbar renders only when `count > 0`, flex-wraps like `.filter-bar`, axe-clean, 44px coarse targets

### Tests for User Story 2 (write first, ensure they FAIL before implementation)

- [X] T011 [P] [US2] Frontend unit tests `frontend/tests/component/bulk-selection.test.ts` — `toggle`, `selectVisible` (visible set only), `clear`, `count`, `partitionByWorkspace`
- [X] T012 [P] [US2] Axe/component test for `BulkToolbar` (accessible names, selected count) in `frontend/tests/component/bulk-toolbar.test.tsx`

### Implementation for User Story 2

- [X] T013 [P] [US2] Add `bulkUpdate(body)` to `frontend/src/api/client.ts` → `request<BulkIssueResponse>('/issues/bulk', { method: 'POST', body })`
- [X] T014 [P] [US2] Create pure selection helpers `frontend/src/lib/bulkSelection.ts` (`toggle`, `selectVisible`, `clear`, `count`, `partitionByWorkspace`) over an immutable `Set<string>` (unit-tested)
- [X] T015 [P] [US2] Create `frontend/src/components/BulkToolbar.tsx` — action select, per-action value control (status/priority select, assignee select + "Unassigned", label chip multi-select), primary **Apply**, **Clear selection**, selected count; reuse `Field`/`Button`/native selects and the `.label-chip` pattern
- [X] T016 [US2] Add bulk styles to `frontend/src/styles/components.css` — `.bulk-toolbar` (ruled bar, `.filter-bar` family), `.ledger-row--selected` (petrol `--color-accent-subtle` bg + `--color-accent-border`, preserving the priority edge bar), `.ledger-select` slot, 44px coarse registration, ≤375 column-stack

**Checkpoint**: User Story 2 complete — reusable, accessible selection + toolbar primitives exist and are tested in isolation.

---

## Phase 5: User Story 3 — WorkspacePage Integration (Priority: P1)

**Goal**: The Workspace (project) ledger gains row checkboxes, select-all/clear, and the bulk toolbar driving the real list.

**Independent Test**:
- Row checkbox toggles selection without navigating to the issue detail page
- Select-all picks only visible (filtered) issues; shows indeterminate when partial
- Toolbar appears when selection ≥1 and disappears on clear
- Apply performs one `api.bulkUpdate`; on success ledger + stats reload and selection clears; on error `Alert` shows while selection/values remain

### Implementation for User Story 3

- [X] T017 [US3] Modify `frontend/src/pages/WorkspacePage.tsx` — selection state (`Set<string>`), leading native checkbox per `.ledger-row` (labelled, stops propagation so it does not navigate), select-all/clear in the ledger header, mount `BulkToolbar` above the ledger, wire action → `BulkIssueRequest` → `api.bulkUpdate`, then `loadIssues()` + `loadStats()` and clear selection
- [X] T018 [US3] Add component tests in `frontend/tests/component/workspace-page.test.tsx` — selection toggle/count, select-all/indeterminate, Apply makes one call, error `Alert`, toolbar visibility, checkbox does not navigate

**Exit criteria**: Component tests green (9/9). Manual desktop/mobile smoke still recommended (see T022).

---

## Phase 6: User Story 4 — MyIssuesPage Integration + Cross-workspace Guard (Priority: P2)

**Goal**: Selection works on the cross-workspace **My Issues** ledger with a strict single-workspace rule.

**Independent Test**:
- Selection over `visibleItems` works with `.ledger-context` preserved
- When the selected set spans >1 workspace, toolbar actions are **disabled** with the quiet single-workspace note (F-05)
- Within one workspace, `api.bulkUpdate` runs; `/my-issues` re-fetches and selection clears

### Implementation for User Story 4

- [X] T019 [US4] Modify `frontend/src/pages/MyIssuesPage.tsx` — selection state over `visibleItems`, per-row checkboxes, `partitionByWorkspace` guard (disable toolbar + note on mixed sets), fetch members/labels for the single selected workspace on demand, re-fetch `/my-issues` + clear selection after Apply
- [X] T020 [US4] Add component tests in `frontend/tests/component/my-issues-page.test.tsx` — selection/count, mixed-workspace disables toolbar, single-workspace Apply calls `api.bulkUpdate` once

**Checkpoint**: Cross-workspace safety is verified by the server AND enforced in the UI.

---

## Phase 7: User Story 5 — Accessibility & Responsive Polish (Priority: P2)

**Goal**: Selection is fully keyboard/screen-reader accessible and responsive at every existing breakpoint.

**Independent Test**:
- Tab + Space toggles native checkboxes; select-all reflects indeterminate; count announced via `aria-live`
- No destructive action → no confirmation Dialog needed; focus-visible, skip-link, and reduced-motion preserved
- Mobile (320/375): no horizontal overflow, 44px targets, toolbar stacked; tablet icon-rail / rail-collapse cases fine

### Implementation / Verification for User Story 5

- [X] T021 [US5] Axe a11y in `frontend/tests/accessibility/core.test.tsx` — ledger with an active bulk selection + `BulkToolbar` has no axe violations; row checkboxes have accessible names; the selected count uses `role="status"`; skip-link/focus-visible contracts untouched
- [ ] T022 [US5] **Manual** responsive verification at 320, 375, 768, 1024, 1280 (CSS shipped: coarse-pointer 44px targets for the new controls; ≤375 column-stack). Not visually verified in this pass.
- [ ] T023 [US5] **Manual** `prefers-reduced-motion` confirmation (toolbar appear/disappear is instant by design; no new animation added). Not visually verified in this pass.

---

## Phase 8: Verification & Documentation

**Purpose**: Final validation and the visual-source-of-truth update.

- [X] T024 Backend verification: `npm run typecheck -w backend`, `npm run lint -w backend`, `npm run test -w backend` — **187 passed (16 files)**
- [X] T025 Frontend verification: `npm run test -w frontend` — **153 passed (20 files)**; `npm run typecheck` clean across all workspaces; `npm run lint` clean; `npm run build` succeeds
- [X] T026 Update `frontend/VISUAL_LANGUAGE.md` — new §19a documents the bulk selection layer: leading checkbox column (`.ledger-select`), select-all bar (`.bulk-selection-bar`), petrol selected-row treatment (`.ledger-row--selected`), ruled bulk toolbar (`.bulk-toolbar`) with mono count, reuse/when-not-to-use guidance, responsive & motion notes. No new tokens or colors.

---

## Phase 9: Bulk Delete (approved after Stage 1 — D-01 rev.)

**Purpose**: Add destructive **bulk delete** to the same all-or-nothing pipeline, gated behind
a mandatory confirmation dialog using the existing coral danger language.

- [X] T027 Backend: extend `BulkIssueAction` with `"delete"` (`shared/index.ts`) and add the
  `delete` variant to `backend/src/api/validators/bulk.ts`; in `issueService.bulkUpdate`
  (`backend/src/services/issue.ts`) handle deletion inside the same transaction — per-issue
  `getIssueWithLabels` member check, `issue.deleted` activity, then delete (mirrors single
  `deleteIssue`)
- [X] T028 [P] Backend tests in `backend/tests/integration/bulk-issues.test.ts` — deletes all
  selected issues; all-or-nothing rollback when one id is bad (control issue survives);
  mixed-workspace delete rejected with no mutation
- [X] T029 Frontend: `BulkToolbar.tsx` adds the Delete option — coral `btn--danger` trigger
  ("Delete…"), `.bulk-note--danger` warning, confirmation via the existing `Dialog`
  (focus trap / Escape / focus return) with Cancel + danger Delete; styles for
  `.bulk-note--danger`; component tests in `frontend/tests/component/bulk-toolbar.test.tsx`
  (cancel aborts, confirm sends `{ action: "delete" }`) and an end-to-end dialog test in
  `frontend/tests/component/workspace-page.test.tsx`

**Exit criteria**: backend **190 tests passed**; frontend **155 tests passed** (component 127 +
a11y 28); typecheck/lint/build clean; docs updated (spec D-01 rev./UX-07/AX-06, §19a).

**Exit criteria**: Full automated suite green; `frontend/VISUAL_LANGUAGE.md` updated. Manual smoke (desktop + mobile + keyboard, T022/T023) remains open.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS ALL
- **Backend MVP (Phase 3 / US1)**: Depends on Phase 2
- **Selection + Toolbar (Phase 4 / US2)**: Depends on Phase 2 — can run in **parallel** with Phase 3 via a mocked `api`
- **WorkspacePage (Phase 5 / US3)**: Depends on Phases 3 + 4
- **MyIssuesPage (Phase 6 / US4)**: Depends on Phases 3 + 4
- **Polish (Phase 7 / US5)**: Depends on Phases 5 + 6
- **Verification (Phase 8)**: Depends on all user stories complete

### User Story Dependencies / Parallel

- US1 and US2 start in parallel after Phase 2 (different layers/files).
- US3 (Workspace) and US4 (My Issues) depend on the real endpoint + toolbar; they may run in parallel.
- US5 depends on both page integrations.

### Within Each User Story

- Tests (when included) are written first and must FAIL before their implementation.
- Service before route; component before page integration; core before integration.

---

## Notes

- [P] tasks = different files, run in parallel; no same-file conflicts.
- [Story] labels map to `spec.md` §6 user stories for traceability.
- Reuse existing components and tokens: native checkbox/select, `Button`/`Field`/`Alert`, `.filter-bar`, `.ledger-row`, `.label-chip`; **no new colors, spacing, radii, or shadows**.
- Activity must record per-issue inside the same transaction as the mutation; the actor is the authenticated session, never client-supplied.
- All-or-nothing only: a failing 4xx leaves no partial mutation.
- Cross-workspace bulk is never allowed — server-enforced and mirrored in the UI.
- `frontend/VISUAL_LANGUAGE.md` is the permanent visual source of truth; update it (T026) for the new selection + bulk-toolbar interaction layer.
- Commit after each task or logical group; then run a manual smoke per the phase exit criteria.