# Implementation Plan — Spec 007: Bulk Actions

> Stage 1 only: plan. **No implementation code changes in this stage.** This plan guides the
> operator-approved implementation pass that follows review.

## Objectives

Add a single-workspace bulk mutation workflow on the Workspace and My Issues ledgers:
select issues (native checkboxes, "Select all visible", clear, count) and run one of
`setStatus` / `setPriority` / `assign` / `addLabels` / `removeLabels` via one new
all-or-nothing endpoint `POST /api/issues/bulk`, with per-issue Activity History events.

## Guiding constraints

- Reuse `IssueService` mutation + authorization logic; do not duplicate it.
- No schema migration; only additive shared types.
- Extend the existing visual language (ledger / filter-bar family); do not introduce a new one.
- Never allow cross-workspace bulk; the server authorizes every ID.
- All-or-nothing transaction; activity is written in the same transaction.

## Phase 0 — Shared types & constants

**Files:** `shared/index.ts`

- Add `BulkIssueAction`, `BulkIssueRequest`, `BulkIssueResponse` and export them.
- Add a `BULK_ISSUE_LIMIT = 20` constant (single source; shared or a backend constant).

**Exit criteria:** `npm run typecheck -w shared` passes; other packages still compile.

## Phase 1 — Backend validator

**Files:** `backend/src/api/validators/bulk.ts` (new)

- Define a zod **discriminated union** on `action`:
  - `setStatus` requires `status: enum(ISSUE_STATUSES)`
  - `setPriority` requires `priority: enum(ISSUE_PRIORITIES)`
  - `assign` requires `assigneeId: uuid().nullable()`
  - `addLabels` / `removeLabels` require `labelIds: uuid[].min(1).max(50)` unique
- `issueIds`: `uuid[]`, `min(1)`, `max(BULK_ISSUE_LIMIT)`, unique (via `superRefine`).
- Reject an unknown `action`.

**Exit criteria:** unit tests pass (`backend/tests/unit/bulk-validators.test.ts`).

## Phase 2 — Backend service (`BulkIssueService`)

**Files:** `backend/src/services/bulk.ts` (new); optionally refactor reusable helpers in
`backend/src/services/issue.ts`.

- Reuse `projectService.getWorkspaceIdForIssue` + `membershipService.requireMember`.
- `bulkUpdate(issueIds, action, value, actorId)`:
  1. Resolve every issue's workspace (batched `inArray`); all must resolve and be the **same**
     workspace — mixed set → `422`, missing id → `404`.
  2. `requireMember` for the resolved workspace; assert each issue belongs to it (defense in depth).
  3. Validate the action value once: assignee is a workspace member; labels exist in the workspace.
  4. `db.transaction(() => { ... })`:
     - For each issue, load it (existing labelled loader), apply the field or label **delta**, set
       `updated_at`, and record per-issue activity (reuse `recordChanges` / label add/remove).
  5. Return `BulkIssueResponse`.
- Optional: extract a shared label-delta + activity helper so individual and bulk updates share
  one code path (reduces drift).

**Exit criteria:** service returns the correct response; atomicity test (Phase 4) passes.

## Phase 3 — Route & wiring

**Files:** `backend/src/api/routes/issues.ts` (add endpoint), `backend/src/api/routes/index.ts` (wire service).

- Add `router.post("/issues/bulk", ...)`:
  - `requireAuth` → `userId`
  - parse with the Phase 1 schema; on failure throw `422` + `validationFields`
  - call `bulkIssueService.bulkUpdate(...)`; respond `200 { issueIds, count }`.
- Create + register `BulkIssueService` in `registerRoutes`, passing `db`, `projectService`,
  `membershipService`, and the shared issue helper(s).

**Exit criteria:** backend `npm run typecheck` + `npm run lint` pass; endpoint wired.

## Phase 4 — Backend tests

**Files:** `backend/tests/integration/bulk-issues.test.ts` (new),
`backend/tests/unit/bulk-validators.test.ts` (new).

- Cover spec §24: success per action, assign unassign, all-or-nothing `404` with no partial
  mutation, mixed-workspace `422`, cross-workspace assignee/label `422`, duplicate ids, >20 ids,
  activity rows / no-op emits nothing.
- Assert a control issue is **unchanged** when the request that includes a bad id fails.

**Exit criteria:** `npm run test -w backend` passes (existing + new).

## Phase 5 — Frontend selection helper + api client

**Files:** `frontend/src/lib/bulkSelection.ts` (new), `frontend/src/lib/bulkSelection.test.ts`,
`frontend/src/api/client.ts`.

- `bulkSelection.ts`: pure helpers over an immutable `Set<string>` — `toggle(sel,id)`,
  `selectVisible(sel, visibleIds)`, `clear(sel)`, `count(sel)`, `partitionByWorkspace(sel, items)`
  (My Issues single-workspace enforcement).
- API client: `bulkUpdate(body)` → `request<BulkIssueResponse>('/issues/bulk', { method: 'POST',
  body })`.

**Exit criteria:** helper unit tests pass; client type-checks.

## Phase 6 — BulkToolbar component + selection CSS

**Files:** `frontend/src/components/BulkToolbar.tsx` (new), `frontend/src/styles/components.css`.

- Rendered only when `count > 0`; ruled bar reusing `.filter-bar` anatomy (hairlines, paper).
- Props: `selectedCount`, `workspaceName?`, `loading`/error, `onApply`, `onClear`; internal state
  for action + value; reuse `Field` / native select / `Button`; label picker reuses the `.label-chip`
  checkbox pattern (Spec 004) loaded on demand.
- CSS: `.bulk-toolbar`, `.ledger-row--selected`, `.ledger-select` (fixed-width slot); register new
  controls in the coarse-pointer `44px` rule; column-stack at `≤375px`.

**Exit criteria:** component renders standalone + axe-clean.

## Phase 7 — WorkspacePage integration

**Files:** `frontend/src/pages/WorkspacePage.tsx`.

- Add selection state; a leading native checkbox per ledger row (labelled, stops propagation so it
  does not navigate); a select-all / indeterminate control in the ledger header; render
  `BulkToolbar` above the ledger when selection ≥1.
- Build the `BulkIssueRequest` from the chosen action + selected IDs; on success call `loadIssues()`
  + `loadStats()`, then clear selection; on error show `Alert` and keep the selection.
- Members/labels: the page already loads labels; confirm assignee/label options are sourced from the
  selected project's workspace endpoints.

**Exit criteria:** manual smoke on desktop + mobile; covered by Phase 9 tests.

## Phase 8 — MyIssuesPage integration

**Files:** `frontend/src/pages/MyIssuesPage.tsx`.

- Add selection state over `visibleItems`; per-row checkboxes (preserve `.ledger-context`).
- Enforce single-workspace: if `partitionByWorkspace(selected)` spans >1 workspace, render the
  toolbar **disabled** with the quiet single-workspace note (F-05); otherwise allow that workspace's
  actions.
- Fetch members/labels on demand for the single selected workspace when the assign/label action is
  chosen.
- On success re-fetch `/my-issues` and clear selection.

**Exit criteria:** cross-workspace disable path works; responsive; covered by Phase 9 tests.

## Phase 9 — Frontend tests & accessibility

**Files:** `frontend/tests/component/*` (Workspace + My Issues cases), `frontend/src/lib/bulkSelection.test.ts`,
`frontend/tests/accessibility/core.test.tsx`.

- Selection toggle, select-all / indeterminate, count, toolbar visibility, single HTTP call, error
  path via `Alert`, mixed-workspace disable, keyboard + axe checks (spec §24).

**Exit criteria:** `npm run test -w frontend` + `npm run test:a11y -w frontend` pass.

## Phase 10 — Verification & documentation

- `npm run lint`, `npm run typecheck`, `npm run build` all green.
- Update **`frontend/VISUAL_LANGUAGE.md`** with the new interaction layer:
  - row selection control at the ledger leading edge;
  - the selected-row treatment (petrol `--color-accent-subtle` + border, preserving the edge bar);
  - the bulk toolbar (ruled bar family, mono count consistent with `.filter-count`);
  - say that this extends §19 (Ticket Ledger) and the filter-bar; no new tokens/colors.
- Do **not** create `tasks.md` unless the project workflow explicitly requires it.

**Exit criteria:** docs updated, full suite green, manual smoke (desktop + mobile + keyboard).

## File summary

**New files:**
- `backend/src/api/validators/bulk.ts`
- `backend/src/services/bulk.ts`
- `backend/tests/integration/bulk-issues.test.ts`
- `backend/tests/unit/bulk-validators.test.ts`
- `frontend/src/lib/bulkSelection.ts`
- `frontend/src/lib/bulkSelection.test.ts`
- `frontend/src/components/BulkToolbar.tsx`
- `frontend/tests/component/bulk-actions.test.tsx` (if a dedicated file is preferred)

**Modified files:**
- `shared/index.ts` — Bulk types + action limit
- `backend/src/services/issue.ts` — optional shared helper extraction (reuse-only)
- `backend/src/api/routes/issues.ts` — `POST /issues/bulk`
- `backend/src/api/routes/index.ts` — wire bulk service
- `frontend/src/api/client.ts` — `bulkUpdate`
- `frontend/src/pages/WorkspacePage.tsx` — selection + toolbar
- `frontend/src/pages/MyIssuesPage.tsx` — selection + toolbar + workspace enforcement
- `frontend/src/styles/components.css` — toolbar + selection + 44px + responsive
- `frontend/VISUAL_LANGUAGE.md` — document the new interaction layer

## Dependencies between phases

```
0 → 1 → 2 → 3 → 4
0 ────────────→ 5 → 6 → 7 ──┐
                          8 ─┼→ 9 → 10
                        4 ────┘
```

## Estimated effort

| Phase | Backend | Frontend | Total |
|-------|---------|----------|-------|
| 0     | 0.5h    | 0.5h     | 1h    |
| 1     | 1h      | -        | 1h    |
| 2     | 2.5h    | -        | 2.5h  |
| 3     | 1h      | -        | 1h    |
| 4     | 2h      | -        | 2h    |
| 5     | -       | 1h       | 1h    |
| 6     | -       | 2h       | 2h    |
| 7     | -       | 2h       | 2h    |
| 8     | -       | 2h       | 2h    |
| 9     | -       | 2.5h     | 2.5h  |
| 10    | -       | -        | 2h    |
| **Total** | **8h** | **11h** | **19h** |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Refactor of `issue.ts` helpers drifts activity behavior | Keep extraction additive; re-run `issues.test.ts`; activity diff unchanged. |
| All-or-nothing fails on one stale id | 20-id cap; UI pre-validates from its own ledger; clear error + preserved selection. |
| My Issues mixed-workspace confusion | Disable toolbar + quiet note (F-05); server also enforces (A-03). |
| Label delta vs set semantics confusion | Document in code (bulk = union/subtract, individual = set); unit-test both paths. |
| Cross-workspace label/assignee bypass | Reuse workspace-scoped validation (A-04) + foreign-label regression test. |
| Toolbar overflow / touch targets | Reuse `.filter-bar` wrap + existing 44px coarse rule; test at ≤375px. |
| Selection-persistence surprises | Implement exactly the F-01..F-05 rules; covered by selection unit + component tests. |

## VISUAL_LANGUAGE.md update

Required: Phase 10 must add the bulk selection layer (row checkbox, selected-row petrol treatment,
ruled bulk toolbar) to `frontend/VISUAL_LANGUAGE.md`, extending §19 (Ticket Ledger). No new design
tokens or colors.