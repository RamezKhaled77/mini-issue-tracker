---

description: "Task list for Saved Views implementation"

---

# Tasks — Spec 009: Saved Views

> Derived from the approved `spec.md` + `plan.md`. Each task is independently verifiable so
> every phase can be validated and committed in isolation. Backend must finish before the
> frontend consumes the real endpoints, but frontend component work can run in parallel
> against a mocked `api`.

**Input**: Design documents from `/specs/009-saved-views/`

**Prerequisites**: `plan.md` (required), `spec.md` (required for behaviours + decisions),
`frontend/VISUAL_LANGUAGE.md` (visual source of truth)

**Tests**: Backend unit + integration, frontend component + axe a11y (per `spec.md` §21).

**Format**: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- Include exact file paths in every description
- Decisions referenced as **D-##** / **§##** map to `spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared contract additions the whole feature compiles against — no backend or
frontend code can typecheck until these exist. Spec: §10–§11, D-01.

- [x] T001 Add `SavedViewFilters`, `SavedView`, `CreateSavedViewRequest`,
  `UpdateSavedViewRequest` and constants `VIEW_NAME_MAX_LENGTH = 60`,
  `SAVED_VIEW_FILTERS_VERSION = 1` to `shared/index.ts`; `SavedView.filters` typed as the
  parsed `SavedViewFilters` (versioned, `{ version, projectId, search?, status?, priority?,
  labelId? }`). Verify shared build + backend/frontend typecheck.

**Checkpoint**: `api` typecheck passes; other packages still compile.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migration + schema + domain + validator that MUST exist before any route or
UI work can consume the resource. Spec: §10 (data model), §12 (security), D-06/D-08.

- [x] T002 [P] Create `backend/src/db/migrations/0006_saved_views.sql` — `saved_views`
  (id TEXT PK; `workspace_id` FK CASCADE; `created_by_id` FK CASCADE; `name`;
  `filters` TEXT NOT NULL versioned JSON; `created_at`/`updated_at` INTEGER), unique index
  `saved_views_workspace_name_idx(workspace_id, name)` (D-08 → 409), indexes on
  `workspace_id` and `created_by_id`. Matches `0004_activities.sql` style (D-06).
- [x] T003 [P] Add matching `savedViews` `sqliteTable` + relations to
  `backend/src/db/schema.ts`.
- [x] T004 Create `backend/src/domain/savedView.ts` — `createSavedViewRecord(workspaceId,
  createdById, name, filters)` mirroring `label.ts`/`project.ts` (`randomUUID`; `filters`
  kept as the parsed object, serialized at the service boundary).
- [x] T005 Create `backend/src/api/validators/savedView.ts` — `savedViewFiltersSchema`
  (`version: z.literal(1)`; `projectId`/`labelId` uuid; `search` trimmed ≤200; enums for
  status/priority; reject extra keys), `createSavedViewSchema` (name trimmed 1..60),
  `updateSavedViewSchema` (partial + `refine` ≥1 field).
- [x] T006 [P] Unit tests `backend/tests/unit/saved-views-validator.test.ts` — name
  bounds/whitespace, version rejection, enum/length/extra-key validation, ≥1-field update.
- [x] T007 Extend `backend/tests/unit/migration.test.ts` — `0006` applies cleanly on the
  existing schema.

**Checkpoint**: migration + validator unit tests green; `npm run typecheck -w backend` +
`npm run lint -w backend` pass.

---

## Phase 3: Backend Service & API (P1) 🎯 MVP

**Goal**: A member can create, list, rename, and delete workspace-scoped Saved Views with
server-enforced authorization and duplicate handling. Spec: §11–§13, D-05/D-07/D-08.

**Independent Test**: Integration coverage (T010) stands alone — create/list/rename/delete
shapes, 409 duplicates, 403 cross-workspace, 422 validation, stale refs returned as stored.

- [x] T008 Create `backend/src/services/savedView.ts` — `createSavedViewService({ db,
  membershipService })` with `getWorkspaceIdForView` (mirrors
  `LabelService.getWorkspaceIdForLabel`), `create`/`list`/`update`/`delete`; every route
  `requireMember` (D-05); write-time validation that `projectId` is in the workspace and
  `labelId` (if given) is a label in the workspace (mirror `IssueService` label
  validation); serialize filters JSON on write, parse + re-validate on read (unparseable →
  safe unreadable marker, never a crash); duplicate unique violation →
  `409 CONFLICT` "A view with this name already exists"; bump `updated_at` on rename.
- [x] T009 Create `backend/src/api/routes/savedViews.ts` and wire in
  `backend/src/api/routes/index.ts` — `POST/GET /workspaces/:workspaceId/views`,
  `PATCH/DELETE /views/:id`; `requireAuth`; zod `safeParse` → `422 VALIDATION` with the
  standard `fields` map; 403 for non-member / 404 for missing view (mirrors labels.ts).
- [x] T010 Integration tests `backend/tests/integration/saved-views.test.ts` (modeled on
  `labels.test.ts`): create 201 shape / list order / rename 200 / delete 204; duplicate
  create + rename → 409; blank/whitespace/over-length name → 422; invalid filters (bad
  enum, foreign project, foreign label, unknown version, extra keys) → 422; missing
  workspace → 403; nonexistent view → 404; **cross-workspace isolation** (member A cannot
  read/write B's views; owner-without-membership on B → 403); stale refs + malformed stored
  JSON handled safely.

**Checkpoint**: endpoint wired; backend typecheck + lint + `integration/saved-views.test.ts`
+ unit suites green. FEATURE IS END-TO-END TESTABLE VIA API.

---

## Phase 4: API Client + Resolve Helper

**Purpose**: The frontend contract layer + pure filter-resolution logic every UI task uses,
independently testable. Spec: §13 (stale references), D-01/D-04.

- [x] T011 [P] Extend `frontend/src/api/client.ts` — `listSavedViews`, `createSavedView`,
  `updateSavedView`, `deleteSavedView` reusing the existing `get`/`post`/`patch`/`delete`.
- [x] T012 [P] Create `frontend/src/lib/savedViewFilters.ts` — pure resolver given a
  `SavedViewFilters` config + loaded projects + labels, returning
  `{ projectId?, appliedFilters, stale: { project?, label? } }` (spec §13); never injects
  replacement values. Unit tests in `frontend/tests/component/saved-view-filters.test.ts`.

**Checkpoint**: client + resolver unit tests green; no UI yet.

---

## Phase 5: Saved Views Shelf (UI) — Restore / Rename / Delete

**Goal**: A compact "Saved views" shelf in the workspace left rail (mirroring
`LabelsSection`) that lists views, applies one on selection, and supports rename/delete
with the shared Dialog. Spec: §14–§17, D-05/D-09/D-10.

**Independent Test**: `SavedViewsSection` renders/operates standalone via a mocked `api`;
workspace-page integration (T017) verifies apply-to-issues.

- [x] T013 [P] Create `frontend/src/components/SavedViewsSection.tsx` — `section-header` +
  `section-title` "Saved views", rows in the `.label-list`/`.label-row` family
  (`.view-list`/`.view-row` only if a distinct class is warranted, styled from the same
  tokens), `EmptyState` ("No saved views yet") + `SkeletonRows`; ghost **Edit** (rename via
  shared `Dialog` + `Field`, Escape/focus-return) and **Delete** destructive-gated via the
  shared `Dialog` (danger button, Cancel path); per-row quiet stale "unavailable" note
  (§13). Props: `views`, `activeViewId`, `loading`, `onApply`, `onChange`.
- [x] T014 [P] CSS in `frontend/src/styles/components.css` — `.view-row--active` (existing
  petrol tokens), any `.view-unavailable` quiet note, 44px coarse-pointer registration,
  ≤375/≤700 stacking (reuse `.filter-bar`/`.label-list` responsive rules; no new
  colors/spacing/radii/shadows).
- [x] T015 [P] Component tests `frontend/tests/component/saved-views-section.test.tsx` —
  empty/loading/error states; rename (PATCH) + delete (confirm → DELETE); keyboard
  (Tab, Enter select, Escape); axe-clean shelf + rename/delete dialogs.

**Checkpoint**: shelf component green + axe-clean in isolation.

---

## Phase 6: WorkspacePage Integration — Save + Apply Path

**Goal**: "Save view" from the ledger filter bar + one-click restore that replaces the
current filters and refetches via the existing `listIssues`. Spec: §14–§15 (UI),
§22 (default view), D-04/D-11.

**Independent Test**: End-to-end workspace-page tests (T019): saving captures the exact
current filters; selecting a view replaces state and refetches; stale project/label
behave per §13.

- [x] T016 Extend `frontend/src/pages/WorkspacePage.tsx` — load views alongside labels;
  render `SavedViewsSection` in the left rail; track `activeViewId`.
- [x] T017 Add the **Save view** affordance (ghost `Button`, per spec §14.2) in the
  `filter-meta` region of the existing `filter-bar` — opens the shared `Dialog` with a
  labelled name `Field` (`autoFocus`, `required`), **Cancel**, primary **Save**; captures
  the exact current `{ search, status, priority, labelId }` + `selectedProject` at open
  time; POST on submit; refresh shelf. Saving with empty filters is valid (D-11).
- [x] T018 Wire selection → resolve (`lib/savedViewFilters.ts`) → `setSelectedProject` +
  set `search`/`statusFilter`/`priorityFilter`/`labelFilter` (replaces, D-04) + clear bulk
  selection; stale project → defer with quiet "unavailable" + safe back-out; stale label →
  drop label + quiet note; rely on the existing `loadIssues` effect (no new query path).
- [x] T019 Extend `frontend/tests/component/workspace-page.test.tsx` — apply restores
  project+filters and refetches; replace-preconditions; stale project (no crash) + stale
  label (applied w/o label + note); saving empty filters is valid; error states.

**Checkpoint**: AS-1/AS-2/AS-6/AS-7/AS-8 behave per `spec.md` §23; defaults unchanged (§22).

---

## Phase 7: Accessibility & Responsive Polish

**Purpose**: Full keyboard / screen-reader / reduced-motion correctness and breakpoint
behavior for the shelf + dialogs. Spec: §16–§17.

- [x] T020 [P] Extend `frontend/tests/accessibility/core.test.tsx` — axe audit of the
  shelf, Save/Rename dialogs, and active-view treatment (`aria-current` + petrol, never
  color-only); keep existing accessibility tests green.
- [x] T021 Responsive smoke in component tests at ≤375 / ≤700 — shelf stacks within the
  single-column rail, no horizontal overflow, 44px touch targets, filter-bar Save-view
  stacks (`frontend/tests/component/workspace-page.test.tsx` + saved-views tests).

**Checkpoint**: axe + responsive tests green; keyboard flow (open Save view → type → Enter
→ focus returns; tab through shelf; rename; confirm delete; Escape closes) verified.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Final style review against `VISUAL_LANGUAGE.md`, docs only if a genuinely new
pattern ships, and full automated verification. Spec: §15, §24.

- [x] T022 Review the finished UI against the visual-review checklist (§15): hierarchy,
  rhythm, structure, typography, color, reuse, accessibility, responsiveness. Confirm the
  ledger remains the primary surface; no cards/shadows/new tokens.
- [x] T023 Update `frontend/VISUAL_LANGUAGE.md` ONLY if implementation introduced a genuinely
  new reusable pattern (view-shelf anatomy / active-view treatment / Save-view
  affordance) — document exact structure, tokens, spacing, states, responsive + a11y
  behavior, where to reuse / when not to. Otherwise record "No visual language changes were
  introduced; the existing system was extended."
- [x] T024 Run full verification **separately per package** to avoid the monorepo timeout:
  backend tests, frontend tests (component + a11y), typecheck (shared/backend/frontend),
  lint, build. Walk `spec.md` §23 acceptance scenarios; report honestly what was not
  verified without a browser.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS backend (Phases 3+) and the
  frontend client (Phase 4).
- **Phase 3 (Backend MVP)**: Depends on Phase 2.
- **Phase 4 (Client + Resolver)**: Depends on Phase 1 (contract) + Phase 2 types; can run
  in parallel with Phase 3 against a mocked `api`.
- **Phase 5 (Shelf)**: Depends on Phases 4 (client + resolver).
- **Phase 6 (WorkspacePage)**: Depends on Phases 3 (real endpoint) + 5 (shelf).
- **Phase 7 (A11y/Responsive)**: Depends on Phases 5 + 6.
- **Phase 8 (Verification)**: Depends on all prior phases complete.

### Parallel Opportunities

- T002/T003 (migration + schema) parallel.
- T006/T007 (validator + migration unit tests) parallel with T004/T005.
- T011/T012 (client + resolver) parallel.
- T013/T014/T015 (shelf component, CSS, component tests) parallel within Phase 5.
- T020/T021 (axe + responsive) parallel.

### Within Each Phase

- Domain/service before route; component before page integration; tests are written first
  and must FAIL before their implementation (backend integration + frontend component).

---

## Implementation Strategy

### MVP First

1. Complete Phases 1–2 (contract, schema, validator).
2. Complete Phase 3 (backend service + API) — the feature is fully testable via API.
3. Complete Phase 4 (client + resolver).
4. **STOP and VALIDATE** the backend MVP + resolver tests.
5. Phase 5–6 (shelf + workspace integration) → Phase 7 a11y → Phase 8 verification.

### Incremental Delivery

- Phase 3 ends with an independently tested API (create/list/rename/delete).
- Phase 5 ends with a standalone, axe-clean shelf.
- Phase 6 ends with the full save/restore workflow on the Workspace page.
- Each phase is committed and verified before the next.

---

## Notes

- **No second filtering model** — a view stores exactly the existing `IssueQueryParams`
  fields (`search/status/priority/labelId` + `projectId`), versioned JSON in a `TEXT`
  column (D-01/D-06). Applying reuses `listIssues` unchanged.
- **Sorting is not persisted** (D-02); **overdue/unassigned/assignee are out of v1**
  (D-03); **no URL filter persistence** (D-09); **no fabricated counts** (D-10).
- **Scope**: workspace-level, member-visible/member-editable (D-05); cross-workspace is
  never allowed and is server-enforced on every route.
- **Stale refs** (§13): stored filters are never mutated on read/delete; apply-time drops
  or defers a stale reference with a quiet note — never invented values.
- Reuse existing components + tokens: `LabelSection` shelf anatomy, `Dialog`, `Field`,
  `Button`, `Alert`, `EmptyState`, `SkeletonRows`, `.filter-bar`/`.filter-meta`,
  `.label-list`/`.label-row`; label `project.ts`/`label.ts` domain + route/validator/service
  conventions.
- `frontend/VISUAL_LANGUAGE.md` is the permanent visual source of truth for any UI change;
  update it only if a genuinely new reusable pattern ships (T023).
- Commit after each task or logical group; then run a manual smoke per the checkpoint.
