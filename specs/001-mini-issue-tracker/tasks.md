---

description: "Task list for implementing the Mini Issue Tracker"
---

# Tasks: Mini Issue Tracker

**Input**: Design documents from `/specs/001-mini-issue-tracker/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included for critical behavior (auth/permissions, persistence, API contracts, accessibility) per the project constitution Principle V (Test Critical Behavior) and the plan's test infrastructure (Vitest, React Testing Library, axe-core).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (frontend + backend)**: `backend/src/`, `frontend/src/`, `shared/`
- Backend: Express API + Drizzle/SQLite; Frontend: React SPA + Vite; Shared: cross-layer types

## Tech Stack (from research.md)

- TypeScript 5.x, Node.js 22, Express 5, Drizzle ORM + better-sqlite3 (SQLite WAL)
- React 18 + Vite, zod, Argon2id, session cookies
- Vitest + React Testing Library + axe-core

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create monorepo root with `package.json` (workspaces for backend, frontend, shared)
- [x] T002 Initialize backend TypeScript project in `backend/package.json` with Express 5, Drizzle ORM, better-sqlite3, zod, and argon2 dependencies
- [x] T003 Initialize frontend TypeScript project in `frontend/package.json` with React 18, Vite, and React Router dependencies
- [x] T004 Initialize shared package in `shared/package.json` for cross-layer types
- [x] T005 [P] Configure TypeScript base config in `tsconfig.base.json` (strict mode)
- [x] T006 [P] Configure linting and formatting (ESLint + Prettier) for all workspaces
- [x] T007 Configure environment management in `.env.example` (SESSION_SECRET, DB_PATH, PORT, FRONTEND_ORIGIN)
- [x] T008 Configure root scripts (`dev`, `build`, `test`, `db:migrate`) in root `package.json`
- [x] T009 Add `.gitignore` for node_modules, build output, and `data/` (SQLite files)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T010 Create database connection module in `backend/src/db/client.ts` (better-sqlite3, WAL mode)
- [x] T011 Create full Drizzle schema in `backend/src/db/schema.ts` (User, Session, Workspace, Membership, Invitation, Project, Issue, Comment, Label, IssueLabel per data-model.md)
- [x] T012 [P] Create SQLite migration for initial schema in `backend/src/db/migrations/`
- [x] T013 Implement session cookie middleware in `backend/src/api/middleware/session.ts` (HttpOnly, Secure, SameSite=Lax, session regeneration on sign-in)
- [x] T014 Implement error-handling middleware in `backend/src/api/middleware/error-handler.ts` (uniform error shape per contracts/api.md)
- [x] T015 Implement security middleware in `backend/src/api/middleware/security.ts` (helmet headers, CORS restricted to FRONTEND_ORIGIN, login rate limiting)
- [x] T016 Create shared zod schema library in `shared/index.ts` (IssueStatus, IssuePriority, request/response types)
- [x] T017 Implement base HTTP client for the SPA in `frontend/src/api/client.ts` (typed fetch, credentials, error handling)
- [x] T018 Create frontend app shell in `frontend/src/main.tsx` + `frontend/src/App.tsx` with React Router routes and an auth-guard layout
- [x] T019 Create auth context provider in `frontend/src/context/auth.tsx` (current user state, sign-in/sign-out methods)

**Checkpoint**: Foundation ready - user story implementation can now begin (US1 first, then the Core MVP chain US1 → US2 → US3 → US4)

---

## Phase 3: User Story 1 - Create Account and Sign In (Priority: P1) 🎯 First Vertical Slice

**Goal**: Users can sign up with email/password, sign in/out, and access their home area (FR-001, FR-002).

**Independent Test**: Sign up a fresh account, sign in/out repeatedly, confirm the home area shows only for the signed-in user; wrong password shows a clear error.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T020 [P] [US1] Contract test for signup/signin/signout/me endpoints in `backend/tests/api.test.ts`
- [x] T021 [P] [US1] Integration test for the sign-up → sign-in → sign-out journey in `backend/tests/api.test.ts`
- [x] T022 [P] [US1] Security test for password hashing and session cookie attributes in `backend/tests/api.test.ts`
- [x] T023 [P] [US1] Component test for the sign-in page form (validation, error display) in `frontend/tests/component/auth.test.tsx`

### Implementation for User Story 1

- [x] T024 [P] [US1] Create User and Session domain entities in `backend/src/domain/user.ts` (session record created here too)
- [x] T025 [P] [US1] Create zod validators for signup/signin in `backend/src/api/validators/auth.ts`
- [x] T026 [US1] Implement auth service in `backend/src/services/auth.ts` (Argon2id hashing, email normalization, session creation/rotation/deletion)
- [x] T027 [US1] Implement auth routes in `backend/src/api/routes/auth.ts` (POST /auth/signup, POST /auth/signin, POST /auth/signout, GET /auth/me)
- [x] T028 [P] [US1] Create sign-in page in `frontend/src/pages/LoginPage.tsx`
- [x] T029 [P] [US1] Create sign-up page in `frontend/src/pages/SignupPage.tsx`
- [x] T030 [P] [US1] Create home area page (lists workspaces) in `frontend/src/pages/DashboardPage.tsx`
- [x] T031 [US1] Wire auth pages and home area into the router with the auth guard in `frontend/src/App.tsx`
- [x] T032 [US1] Add keyboard navigation and focus management on auth forms (accessibility, SC-006)
**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Create and Join Workspaces (Priority: P1)

**Goal**: Users create workspaces, generate join invitations for existing users, and join via token; owner manages membership (FR-003, FR-003a, FR-004, FR-005).

**Independent Test**: User A creates a workspace, User B redeems a valid invitation and sees it; invalid/expired tokens fail clearly; non-owners cannot invite or remove.

### Tests for User Story 2

- [x] T033 [P] [US2] Contract test for workspace, invitation, join, and membership endpoints in `backend/tests/integration/workspaces.test.ts`
- [x] T034 [P] [US2] Integration test for the create-workspace → invite → join → remove journey in `backend/tests/integration/workspaces.test.ts`
- [x] T035 [P] [US2] Authorization test asserting owner-only access returns 403 in `backend/tests/integration/workspaces.test.ts`

### Implementation for User Story 2

- [x] T036 [P] [US2] Create Workspace, Membership, and Invitation domain entities in `backend/src/domain/workspace.ts` (invitation record here; membership logic in `backend/src/services/membership.ts`)
- [x] T037 [P] [US2] Create zod validators for workspace/invitation/join in `backend/src/api/validators/workspace.ts`
- [x] T038 [US2] Implement workspace service in `backend/src/services/workspace.ts` (create, list, invite token generation with expiry, join redemption, member removal)
- [x] T039 [US2] Implement workspace routes in `backend/src/api/routes/workspaces.ts` (create, list, invitations, join, remove member) with owner/member authorization
- [x] T040 [P] [US2] Create workspace list and creation UI in `frontend/src/pages/DashboardPage.tsx`
- [x] T041 [P] [US2] Create invite/join UI (generate token, redeem token) in `frontend/src/components/Invitations.tsx`
- [x] T042 [US2] Wire workspace pages into the home area navigation in `frontend/src/App.tsx`

**Checkpoint**: At this point, User Story 2 should work independently

---

## Phase 5: User Story 3 - Manage Projects (Priority: P1)

**Goal**: Workspace members create, view, rename, and delete projects (FR-006, FR-014).

**Independent Test**: Create a project in a workspace, view it in the list, rename it, and delete it (with confirmation) — non-members get 403.

### Tests for User Story 3

- [x] T043 [P] [US3] Contract test for project endpoints in `backend/tests/integration/projects.test.ts`
- [x] T044 [P] [US3] Integration test for create → rename → delete project in `backend/tests/integration/projects.test.ts`

### Implementation for User Story 3

- [x] T045 [P] [US3] Create Project domain entity in `backend/src/domain/project.ts`
- [x] T046 [P] [US3] Create zod validators for projects in `backend/src/api/validators/project.ts`
- [x] T047 [US3] Implement project service in `backend/src/services/project.ts` (scoped to workspace membership)
- [x] T048 [US3] Implement project routes in `backend/src/api/routes/projects.ts` (create, list, rename, delete)
- [x] T049 [P] [US3] Create project list page in `frontend/src/pages/WorkspacePage.tsx`
- [x] T050 [P] [US3] Add create/rename/delete project UI with confirmation dialog in `frontend/src/components/ProjectDialog.tsx`

**Checkpoint**: User Stories 1-3 work independently

---

## Phase 6: User Story 4 - Create, View, Edit, and Delete Issues (Priority: P1)

**Goal**: Members create, view, edit, and delete issues with title, description, status, priority, assignee, labels, and due date (FR-007, FR-008, FR-013, FR-014).

**Independent Test**: Create a fully populated issue, reopen it to verify all fields, edit each field, and delete it; blank required fields are rejected; out-of-workspace assignee is rejected.

### Tests for User Story 4

- [x] T051 [P] [US4] Contract test for issue endpoints (create/list/get/patch/delete) in `backend/tests/integration/issues.test.ts`
- [x] T052 [P] [US4] Integration test for the full issue lifecycle in `backend/tests/integration/issues.test.ts`
- [x] T053 [P] [US4] Validation test for required fields and assignee-membership rule in `backend/tests/integration/issues.test.ts`
- [x] T054 [P] [US4] Component test for the issue form (field validation) in `frontend/tests/component/issue.test.tsx`

### Implementation for User Story 4

- [x] T055 [P] [US4] Create Issue and Label domain entities in `backend/src/domain/issue.ts`
- [x] T056 [P] [US4] Create zod validators for issues in `backend/src/api/validators/issue.ts`
- [x] T057 [US4] Implement issue service in `backend/src/services/issue.ts` (create, list, get, update with allowlisted fields, delete, assignee validation)
- [x] T058 [US4] Implement label service in `backend/src/services/issue.ts` + `backend/src/api/routes/labels.ts` (create/list workspace-scoped labels)
- [x] T059 [US4] Implement issue routes in `backend/src/api/routes/issues.ts` (POST, GET, GET /:id, PATCH, DELETE)
- [x] T060 [P] [US4] Create issue list page with status/priority display in `frontend/src/pages/WorkspacePage.tsx`
- [x] T061 [P] [US4] Create issue detail page in `frontend/src/pages/IssuePage.tsx`
- [x] T062 [P] [US4] Create issue create/edit form in `frontend/src/components/IssueForm.tsx` (status/priority selectors, assignee, labels, due date)
- [x] T063 [US4] Wire issue routes into the SPA router in `frontend/src/App.tsx`

**Checkpoint**: User Stories 1-4 work independently — core tracking MVP complete

---

## Phase 7: User Story 5 - Comment on Issues (Priority: P2)

**Goal**: Members add and view comments on issues; comments persist for the issue lifetime (FR-009).

**Independent Test**: Add multiple comments to an issue, reopen the issue, confirm the thread persists.

### Tests for User Story 5

- [x] T064 [P] [US5] Contract test for comment endpoints in `backend/tests/integration/comments.test.ts`
- [x] T065 [P] [US5] Integration test for comment persistence in `backend/tests/integration/comments.test.ts`

### Implementation for User Story 5

- [x] T066 [P] [US5] Create Comment domain entity in `backend/src/domain/comment.ts`
- [x] T067 [P] [US5] Create zod validator for comments in `backend/src/api/validators/comment.ts`
- [x] T068 [US5] Implement comment service in `backend/src/services/comment.ts`
- [x] T069 [US5] Implement comment routes in `backend/src/api/routes/comments.ts` (POST, list with issue)
- [x] T070 [P] [US5] Add comment thread UI to the issue detail page in `frontend/src/pages/IssuePage.tsx`

**Checkpoint**: User Stories 1-5 work independently

---

## Phase 8: User Story 6 - Search and Filter Issues (Priority: P2)

**Goal**: Users search by text and filter by status, priority, assignee, and labels within the open project, combinable (FR-010, FR-011, SC-004, SC-005).

**Independent Test**: With varied issues in a project, confirm search text and each filter (and combined filters) narrow the list within the project only.

### Tests for User Story 6

- [x] T071 [P] [US6] Integration test for search and combined filters (including empty results) in `backend/tests/integration/issues.test.ts`

### Implementation for User Story 6

- [x] T072 [US6] Implement search/filter query support in `backend/src/services/issue.ts` (title/description search; status, priority, assigneeId, labelId filters; AND combination; pagination)
- [x] T073 [US6] Extend GET /projects/:projectId/issues route with search/filter query params in `backend/src/api/routes/issues.ts`
- [x] T074 [P] [US6] Add search box and filter controls to the issue list page in `frontend/src/pages/WorkspacePage.tsx`
- [x] T075 [P] [US6] Add accessibility attributes and keyboard support to search/filter controls in `frontend/src/pages/WorkspacePage.tsx`

**Checkpoint**: User Stories 1-6 work independently

---

## Phase 9: User Story 7 - View Issue Statistics Dashboard (Priority: P3)

**Goal**: Workspace members see issue counts by status and priority across the workspace's projects (FR-012).

**Independent Test**: With known statuses/priorities across projects, the dashboard counts match, and counts update when issues change.

### Tests for User Story 7

- [x] T076 [P] [US7] Contract test for the dashboard endpoint in `backend/tests/integration/dashboard.test.ts`
- [x] T077 [P] [US7] Integration test for dashboard counts reflecting issue changes in `backend/tests/integration/dashboard.test.ts`

### Implementation for User Story 7

- [x] T078 [US7] Implement dashboard aggregation in `backend/src/services/dashboard.ts` (counts by status and priority per workspace)
- [x] T079 [US7] Implement dashboard route in `backend/src/api/routes/dashboard.ts` (GET /workspaces/:id/dashboard)
- [x] T080 [P] [US7] Create dashboard page in `frontend/src/pages/WorkspacePage.tsx`
- [x] T081 [P] [US7] Add dashboard navigation link in `frontend/src/App.tsx`

**Checkpoint**: All user stories independently functional

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T082 [P] Add accessibility regression tests (axe-core) for core pages in `frontend/tests/accessibility/core.test.tsx`
- [x] T083 Add end-to-end smoke validation scenarios per `quickstart.md` (auth → workspace → project → issue → comment → search → dashboard) in `backend/tests/api.test.ts` and manual curl verification
- [x] T084 [P] Security hardening review (rate limiting, allowlisted fields, IDOR checks, secrets via env only) across `backend/src/api/`
- [x] T085 [P] Performance check: index filter/search columns and verify search/filter < 2s for 1,000 issues (SC-004) — DONE: filter columns indexed (`issues_project_idx`, `issues_status_idx`, `issues_priority_idx`, `issues_assignee_idx`, `issue_labels_label_idx`); measured on compiled server with 1,000 seeded issues in `backend/tests/integration/performance.test.ts` — search 14.4ms, combined filter 15.2ms, search+filter AND 13.0ms, page traversal (100/1000) 16.8ms (budget 2000ms)
- [x] T086 [P] Code cleanup and dead-code removal across `backend/` and `frontend/`
- [x] T087 Update documentation and README with run instructions matching `quickstart.md`
- [x] T088 Run full test suite, lint, and typecheck; fix all failures before completion

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - The Core MVP chain (US1 → US2 → US3 → US4) MUST run sequentially
  - US5, US6, US7 can run in parallel after their shared dependency US4 (if staffed)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

**Core MVP chain**: Foundation → US1 → US2 → US3 → US4

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (users must exist and sign in); independently testable
- **User Story 3 (P1)**: Depends on US2 (needs a workspace); independently testable
- **User Story 4 (P1)**: Depends on US3 (needs a project); independently testable
- **User Story 5 (P2)**: Depends on US4 (comments attach to issues)
- **User Story 6 (P2)**: Depends on US4 (search/filter operates on issues)
- **User Story 7 (P3)**: Depends on US4 (dashboard aggregates issues)

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- US1 starts immediately after Foundational; US2 can start only after US1, US3 after US2, US4 after US3 (Core MVP chain is strictly sequential)
- US5, US6, and US7 can each start after US4 and may run in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models and validators within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members (subject to the story dependencies above)

---

## Parallel Example: User Story 4

```bash
# Launch all tests for User Story 4 together:
Task: "Contract test for issue endpoints in backend/tests/integration/issues.test.ts"
Task: "Validation test for required fields in backend/tests/integration/issues.test.ts"

# Launch domain entities and validators together:
Task: "Create Issue/Label/IssueLabel domain entities in backend/src/domain/issue.ts"
Task: "Create zod validators for issues in backend/src/api/validators/issue.ts"
```

---

## Implementation Strategy

### MVP First (Core MVP: User Stories 1-4)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (auth) — first vertical slice
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Complete User Stories 2 (workspaces), 3 (projects), and 4 (issues CRUD) in
   sequence, validating each independently
6. **Core MVP complete**: authentication + workspaces + projects + issues
   tracking — deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (auth) → Test independently (first vertical slice, not the MVP)
3. Add User Story 2 (workspaces) → Test independently → Deploy/Demo
4. Add User Story 3 (projects) → Test independently → Deploy/Demo
5. Add User Story 4 (issues CRUD) → Test independently → Deploy/Demo (**Core MVP!**)
6. Add User Story 5 (comments), US6 (search/filter), US7 (dashboard) → Test independently → Deploy/Demo

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Core MVP chain is strictly sequential (US1 → US2 → US3 → US4); each story
   is a checkpoint. Within a story, [P]-marked tasks can be split between
   developers (e.g., backend and frontend tasks for that story).
3. After US4 completes, US5, US6, and US7 can each be assigned to a developer
   and run in parallel
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence