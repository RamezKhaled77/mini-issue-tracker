---

description: "Task list for My Issues feature implementation"
---

# Tasks: My Issues

**Input**: Design documents from `/specs/005-my-issues/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included because the project constitution ("Test Critical Behavior") and the plan mandate them for the cross-workspace scope/isolation (the costliest failures to detect), plus axe coverage for the new UI.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Shared types**: `shared/index.ts`
- **Backend**: `backend/src/services/`, `backend/src/api/routes/`, `backend/src/api/validators/`, `backend/src/lib/`, `backend/tests/integration/`
- **Frontend**: `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/styles/`, `frontend/tests/component/`, `frontend/tests/accessibility/`

---

## Phase 1: Setup (Shared Contracts)

**Purpose**: The shared contract types the backend and frontend both consume. No user story can start until these exist.

- [x] T001 Add `MyIssue` (`extends Issue` + `workspaceId`, `projectName`, `workspaceName`), `MyIssuesOverview` (`total`, `byStatus: Record<IssueStatus, number>`, `overdue`), and `MyIssuesResponse` (`overview`, `items`) to `shared/index.ts`
- [x] T002 Verify shared contract compiles: `npm run build -w shared && npm run typecheck -w shared`

---

## Phase 2: Foundational (Backend Aggregation Endpoint)

**Purpose**: The read-only `GET /api/my-issues` endpoint that US1, US2, and US4 all depend on. No user story work begins until this phase is complete.

**⚠️ CRITICAL**: No user story can begin until this phase is complete.

- [x] T003 [P] Extract `buildLabelMap(db, labelIds)` verbatim from `backend/src/services/issue.ts` (lines 65-82) into a new `backend/src/lib/labels.ts`; refactor `services/issue.ts` to import it (no behavior change; run existing `issues.test.ts` to confirm)
- [x] T004 Create `createMyIssuesService` in `backend/src/services/myIssues.ts` (deps `{ db, membershipService }`) returning `getMyIssues(userId, { includeClosed })`: reachable workspace ids = owned ∪ member (same union as `workspaceService.listWorkspaces`); project ids in those workspaces; `issues` joined `projects` + `workspaces` + `leftJoin users` (assignee), filtered `inArray(issues.projectId, ...)` AND `eq(issues.assigneeId, userId)`; enrich labels via `lib/labels.ts`; derive `overdue` (`dueDate < today && status !== "Closed"`); sort overdue-first → dueDate asc (nulls last) → priority (Urgent→Low) → title; exclude Closed items when `includeClosed === false`; build `overview` over ALL statuses (total / byStatus / overdue)
- [x] T005 [P] Create query validator in `backend/src/api/validators/myIssues.ts`: `{ includeClosed: z.enum(["true","false"]).optional().default("false") }` transformed to boolean — **do NOT use `z.coerce.boolean()`** (coerces `"false"` → true)
- [x] T006 Create route file `backend/src/api/routes/myIssues.ts`: `GET /my-issues` → `requireAuth` → validate query → `200 { overview, items }` (contract: `contracts/my-issues-api.md`)
- [x] T007 Register `myIssuesRoutes` in `backend/src/api/routes/index.ts` with `createMyIssuesService({ db, membershipService })`
- [x] T008 Write integration tests in `backend/tests/integration/my-issues.test.ts` (reuse `signupAs`/`createWorkspace`/`createProject` from `tests/helpers.ts`): 401 without session; zeroed overview for no workspaces; cross-workspace aggregation with correct `workspaceName`/`projectName`/`workspaceId`; overdue derivation (past-due Open/In Progress counted; no-due-date and Closed excluded); default items exclude Closed and `?includeClosed=true` items == `overview.total`; second-user isolation + removed-member exclusion; sort order; `byStatus` sums to `total`

**Checkpoint**: Foundation ready — `GET /api/my-issues` returns correct overview + sorted, scoped items. User story implementation can begin.

---

## Phase 3: User Story 1 - See Your Personal Workload at a Glance (Priority: P1) 🎯 MVP

**Goal**: The My Issues page renders the title, the total ("N assigned to you"), and OPEN / IN PROGRESS / OVERDUE stat cells from real data, with loading, empty, and error states.

**Independent Test**: Sign in as a user with issues assigned across one or more workspaces → open My Issues → heading, total, and the three counts render correctly. A user with no assigned issues sees "0 assigned to you", zeroed stats, and the empty state (no errors, no fabricated numbers).

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation** (they mock `../../src/api/client.js`)

- [x] T009 [P] [US1] Component test in `frontend/tests/component/my-issues-page.test.tsx`: renders title "My Issues", total, and stat values from a mocked `MyIssuesResponse`; zero-data response renders "0 assigned to you" + empty state; error response renders the alert
- [x] T010 [P] [US1] A11y axe scan for `MyIssuesPage` (populated + empty) in `frontend/tests/accessibility/core.test.tsx`

### Implementation for User Story 1

- [x] T011 [US1] Create `frontend/src/pages/MyIssuesPage.tsx`: fetch `api.get<MyIssuesResponse>("/my-issues")`; render `page-header` title "My Issues", a `stat-strip` with three `.stat-cell`s (OPEN / IN PROGRESS / OVERDUE) and a `.stat-meta` total line "N assigned to you" (reuse existing stat-strip CSS)
- [x] T012 [P] [US1] Register route `my-issues` inside the `Layout` route in `frontend/src/App.tsx` (`<Route path="my-issues" element={<MyIssuesPage />} />`)
- [x] T013 [US1] Add feedback states to `MyIssuesPage.tsx`: loading via `SkeletonRows` (`.stat-skeleton`), error via existing `Alert` (`.page-alert`) with retry, empty via `EmptyState` ("No issues assigned to you")

**Checkpoint**: User Story 1 is fully functional and testable independently (summary works even before the ledger is rendered).

---

## Phase 4: User Story 2 - Browse All Issues Assigned to Me (Priority: P1)

**Goal**: The ticket ledger below the summary lists the user's assigned issues with project and workspace context on every row; activating a row opens the issue detail page.

**Independent Test**: With the default (active-only) ledger, every Open/In Progress issue assigned to the user across all workspaces appears in the ledger with `WorkspaceName / ProjectName` context; clicking a row opens `/workspaces/:workspaceId/issues/:id`. (Full all-status visibility lands with US4.)

### Tests for User Story 2 ⚠️

- [x] T014 [P] [US2] Component test in `frontend/tests/component/my-issues-page.test.tsx`: ledger rows render ticket key, title, status/priority badges, assignee, and the workspace/project context caption; activating a row routes to the correct issue detail URL

### Implementation for User Story 2

- [x] T015 [US2] Render the ticket ledger in `MyIssuesPage.tsx` reusing the `.ledger-row` markup from `WorkspacePage.tsx` (lines 280-324): `data-priority`, `.ticket-key` (via `issueKey`), `.ledger-main` title, `.ledger-meta` badges (status/priority/labels/assignee), `.ledger-chevron`; add the quiet mono context caption `WorkspaceName / ProjectName` (new `.ledger-context` span) before the badges
- [x] T016 [P] [US2] Add `.ledger-context` CSS in `frontend/src/styles/components.css` (mono `--text-mono`, muted/faint text, tabular-nums — same visual family as `.card-assignee` at components.css:1082-1090; **no new design tokens**)
- [x] T017 [US2] Wrap each ledger row in a `Link` to `/workspaces/${issue.workspaceId}/issues/${issue.id}` in `MyIssuesPage.tsx`

**Checkpoint**: User Stories 1 AND 2 work independently (summary + ledger browse + navigate).

---

## Phase 5: User Story 3 - Reach My Issues From the Sidebar (Priority: P1)

**Goal**: A keyboard-reachable "My Issues" navigation item with an active state, discoverable at every breakpoint where the sidebar is available.

**Independent Test**: Tab or click to the sidebar → "My Issues" item present under a `PERSONAL` eyebrow; activating it navigates to the page; the item shows the active state (petrol rule + tint) while on the page.

### Tests for User Story 3 ⚠️

- [x] T018 [P] [US3] Extend `frontend/tests/component/layout.test.tsx`: "My Issues" NavLink renders and is marked active on the my-issues route
- [x] T019 [P] [US3] A11y in `frontend/tests/accessibility/core.test.tsx`: sidebar "My Issues" link is keyboard-reachable and the Layout remains axe-clean with the new item

### Implementation for User Story 3

- [x] T020 [US3] Add a `PERSONAL` eyebrow and a "My Issues" `NavLink` (16px stroke icon, `sidebar-link` / `sidebar-link--active` classes, `isActive` handler) below the Workspaces link and above the footer in `frontend/src/components/Layout.tsx`
- [x] T021 [US3] Verify responsive sidebar behavior: new eyebrow/link collapse to the icon rail at ≤1024px and the top bar at ≤700px without layout breakage (existing `components.css` responsive rules)

**Checkpoint**: My Issues is reachable from navigation. Stories 1-3 work independently.

---

## Phase 6: User Story 4 - Include Closed Issues When Needed (Priority: P2)

**Goal**: The ledger defaults to active issues; an "Include closed" control reveals Closed issues so the list matches the total.

**Independent Test**: Default ledger shows only Open/In Progress; enabling the control refetches with `?includeClosed=true` and adds exactly the Closed issues so the count equals "N assigned to you"; disabling restores the active-only list; the summary counts never change.

### Tests for User Story 4 ⚠️

- [x] T022 [P] [US4] Component test in `frontend/tests/component/my-issues-page.test.tsx`: toggling "Include closed" calls `api.get` with `/my-issues?includeClosed=true`, the ledger then includes Closed issues, and the stat values stay unchanged (FR-012)

### Implementation for User Story 4

- [x] T023 [US4] Add the include-closed control to `MyIssuesPage.tsx`: a labelled `<input type="checkbox">` ("Include closed") bound to `includeClosed` state; refetch `api.get<MyIssuesResponse>(includeClosed ? "/my-issues?includeClosed=true" : "/my-issues")` on toggle via `useEffect`
- [x] T024 [P] [US4] Add control CSS in `frontend/src/styles/components.css` (labelled checkbox row, global 2px petrol focus-visible ring, 44px touch target under the existing `@media (pointer: coarse)` rule; **no new design tokens**)

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, visual-language consistency, and full verification across all stories.

- [x] T025 [P] Update `VISUAL_LANGUAGE.md`: §14 Sidebar (new `PERSONAL` eyebrow + My Issues item reusing `.sidebar-link` styling); §19/20 Ticket Ledger (document the `.ledger-context` mono workspace/project caption as the cross-workspace ledger extension); note My Issues as a new page instance of the editorial page structure (page-header → stat strip → ledger, not cards)
- [x] T026 [P] Add "My Issues — cross-workspace assigned workload" to the Features list in `README.md`
- [x] T027 [P] Responsive + reduced-motion review: stat cells wrap ≤700px, ledger rows wrap with ticket key visible, ≤375px stats stack, icon-rail/top-bar sidebar transitions; `prefers-reduced-motion` unaffected (no new motion added)
- [x] T028 Run full verification: `npm run typecheck && npm run lint && npm run build && npm test` plus `npm run test:a11y -w frontend`; confirm no regressions in existing `workspaces`, `issues`, `dashboard`, `labels`, `comments`, `projects`, `auth` integration tests and existing component/a11y tests
- [x] T029 Walk through `quickstart.md` end-to-end and apply the visual review checklist (VISUAL_LANGUAGE.md §40): hierarchy, rhythm, structure, typography, semantic color, components, interaction, responsive, a11y, data honesty

---

## Phase 8: Search, Filter & Sort Bar (enhancement)

**Purpose**: Client-side search/filter/sort on the My Issues ledger so the user can quickly reach a specific issue. No backend changes (the endpoint already returns the full assigned list); the summary strip stays global.

- [x] T030 [P] Create pure view helper `frontend/src/lib/myIssuesView.ts` (`applyMyIssuesView(items, view)`) mirroring the backend default order (overdue first → due date → priority → title) plus sort keys `due-asc|due-desc|priority-high|priority-low|title-az|title-za`, text search over title/description (case-insensitive), and exact status/priority filters
- [x] T031 [P] Unit test `frontend/tests/component/my-issues-view.test.ts` covering search, status/priority filters, default order, and each sort key
- [x] T032 Add a `filter-bar` to `frontend/src/pages/MyIssuesPage.tsx` reusing the workspace `filter-bar`/`field-grow`/`search-field`/`filter-meta`/`filter-count`/`filter-active`/`filter-clear` classes: search input, status select, priority select, sort select, result count, and `Clear filters`; render the ledger from `visibleItems`; filtered-empty state ("No matching issues")
- [x] T033 Component tests in `frontend/tests/component/my-issues-page.test.tsx`: search narrows by title/description, status/priority selects, title and due-date sorts, filtered empty state + clear restores, filter bar hidden while loading/on error
- [x] T034 [P] Update `VISUAL_LANGUAGE.md` §37 (My Issues search/filter/sort bar note reusing §29 patterns); no new design tokens, no new components
- [x] T035 Run full verification: `npm run typecheck && npm run lint && npm run build && npm test` plus `npm run test:a11y -w frontend`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (shared types T001). BLOCKS all user stories.
- **User Stories (Phases 3-6)**: All depend on Foundational completion.
  - US1 → US2 (US2 renders the ledger inside the page created by US1).
  - US3 is independent of US1/US2 and can run in parallel once Foundational is done.
  - US4 depends on US1 (same page) and the endpoint's `includeClosed` support (Foundational T004/T005).
- **Polish (Phase 7)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories (MVP).
- **User Story 2 (P1)**: Depends on US1 (same `MyIssuesPage.tsx`); independently testable via the default active ledger.
- **User Story 3 (P1)**: Can start after Foundational — fully independent (only touches `Layout.tsx`/tests).
- **User Story 4 (P2)**: Depends on US1; uses the endpoint's `includeClosed` flag (Foundational).

### Within Each User Story

- Tests are written FIRST and must FAIL before implementation (mocked API client makes this safe).
- Page/component implementation before wiring; core behavior before edge states.
- Story complete before moving to the next priority.

### Parallel Opportunities

- All [P]-marked tasks can run concurrently (different files, no dependencies).
- Phase 2: T003 (label helper), T005 (validator) are [P]; T004/T006/T007/T008 are sequential (service → route → registration → tests).
- Once Foundational is done: US1 and US3 can start in parallel (different files: `MyIssuesPage.tsx` vs `Layout.tsx`).
- US4 can be developed in parallel with US2/US3 (its changes are additive to `MyIssuesPage.tsx`).

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (mock the API client):
Task: "Component test for summary/empty/error in frontend/tests/component/my-issues-page.test.tsx"
Task: "A11y axe scan for MyIssuesPage in frontend/tests/accessibility/core.test.tsx"

# Then implement (route is independent of the page file):
Task: "Create MyIssuesPage.tsx (overview fetch + stat strip + total)"
Task: "Register route in App.tsx"
Task: "Add loading/error/empty states to MyIssuesPage.tsx"
```

## Parallel Example: Foundational (Backend)

```bash
# Independent files first:
Task: "Extract buildLabelMap into backend/src/lib/labels.ts + refactor services/issue.ts"
Task: "Create includeClosed query validator in backend/src/api/validators/myIssues.ts"

# Sequential chain after that:
Task: "Create createMyIssuesService in backend/src/services/myIssues.ts"
Task: "Create GET /api/my-issues route in backend/src/api/routes/myIssues.ts"
Task: "Register route in backend/src/api/routes/index.ts"
Task: "Integration tests in backend/tests/integration/my-issues.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Shared contracts (T001-T002).
2. Complete Phase 2: Foundational endpoint (T003-T008).
3. Complete Phase 3: User Story 1 (T009-T013).
4. **STOP and VALIDATE**: Test the workload summary independently.
5. Deploy/demo if ready — the page already shows real counts with loading/empty/error states.

### Incremental Delivery

1. Setup + Foundational → endpoint returns correct overview + ledger items.
2. Add US1 → summary page → Test independently → Demo (MVP!).
3. Add US3 → sidebar navigation → Test independently → Demo.
4. Add US2 → cross-workspace ledger browse → Test independently → Demo.
5. Add US4 → Include closed control → Test independently → Demo.
6. Polish (Phase 7) → docs + full verification.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (shared types + endpoint).
2. Once Foundational is done:
   - Developer A: User Story 1 (page + stats + states)
   - Developer B: User Story 3 (sidebar navigation)
3. Developer A continues with US2 (ledger) and US4 (include-closed); Developer B picks up polish/tests.
4. Stories integrate independently; integration tests guard the shared endpoint.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps the task to its spec user story for traceability.
- Each user story is independently completable and testable.
- Tests must fail before implementation; the mocked `api` client in `frontend/tests` makes this safe.
- **No database migration is required** — do not create one.
- **No new design tokens** — reuse existing CSS variables; only `.ledger-context` and the include-closed control CSS are added.
- Commit after each task or logical group.
- Stop at any checkpoint to validate the story independently.
- Avoid: vague tasks, same-file conflicts (respect [P]/sequential marks), cross-story dependencies that break independence.