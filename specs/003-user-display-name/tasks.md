# Tasks: User Display Name — Mini Issue Tracker

**Input**: Design documents from `/specs/003-user-display-name/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (api.md, identity.md), quickstart.md

**Tests**: Tests ARE included. The spec explicitly enumerates backend and
frontend test changes and new tests (spec "What existing tests must change or
be extended", SC-003/SC-005/SC-007/SC-008).

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`, `shared/`, tests in `backend/tests/`, `frontend/tests/`
- Existing repo (features 001 + 002 implemented); no project scaffolding needed.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the `name` attribute to the data model, the shared identity
resolver, and the shared types that every story consumes.

- [x] T001 Create `backend/src/db/migrations/0002_user_display_name.sql` with `ALTER TABLE users ADD COLUMN name TEXT;` (nullable, no default, no backfill)
- [x] T002 [P] Add nullable `name: text("name")` column to the `users` table in `backend/src/db/schema.ts`
- [x] T003 [P] Add `name: string | null` to `UserEntity` and a `name` parameter to `createUserRecord` in `backend/src/domain/user.ts`
- [x] T004 [P] Create `backend/src/lib/identity.ts` exporting `resolveDisplayName(name: string | null, email: string): string` (stored name, else email local-part before first `@`)
- [x] T005 [P] Extend `shared/index.ts`: add `Identity { id, name }`, `WorkspaceMember { userId, email, name }`, `User.name: string`, `SignupRequest.name: string`, `Issue.assignee: Identity | null`, `Comment.author: Identity`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Keep the existing backend test suite green after the signup
contract change; every story's tests rely on `signupAs` sending a name.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Add an optional `name = "Test User"` parameter to `signupAs` in `backend/tests/helpers.ts` and send it in the signup body
- [x] T007 [P] Add a `name` field to the signup payloads in the local `signup` helper in `backend/tests/integration/performance.test.ts` and the raw payload in `backend/tests/unit/security.test.ts`

**Checkpoint**: Foundation ready — all existing tests still pass with the new
required `name` on signup; user story implementation can begin.

---

## Phase 3: User Story 1 - Sign Up with a Full Name (Priority: P1) 🎯 MVP

**Goal**: A new user signs up with a full name (plus email/password/confirm),
is signed in, and sees their name (with initials avatar) in the header; signup
and `/auth/me` return `user.name`.

**Independent Test**: `npm test -w backend` auth suite + `npm run test:ui -w frontend`:
submit signup with a full name, assert `user.name` on signup and `/auth/me`,
assert the header renders the name; submit without a name → `422`.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Update `backend/tests/api.test.ts`: signup payloads gain a name; assert `user.name` on signup and `/auth/me`; add a signup-without-name → `422` test; add a test asserting `passwordHash` never appears in auth responses; add a legacy fallback test (insert a user with null `name` directly, then assert `/auth/me` returns the email local-part)
- [x] T009 [P] [US1] Update `frontend/tests/component/auth.test.tsx`: fill the new "Full name" field in SignupPage tests and include `name` in signup mock payloads/assertions
- [x] T010 [P] [US1] Create `frontend/tests/component/layout.test.tsx` asserting the header shows the signed-in user's name and a decorative initials avatar
- [x] T011 [P] [US1] Create `frontend/tests/component/initials.test.ts` with unit tests for `initialsFromName` (multi-word, single-word, empty→"?")

### Implementation for User Story 1

- [x] T012 [US1] Add `name: z.string().trim().min(1, "Full name is required").max(100)` to `signupSchema` in `backend/src/api/validators/auth.ts`
- [x] T013 [P] [US1] Update `backend/src/services/auth.ts`: `signup(email, name, password)` persists name via `createUserRecord`; `AuthResult.user` gains `name`; `createSession` selects `users.name` and resolves it via `resolveDisplayName`
- [x] T014 [US1] Add `name` to `SessionUser` and to the `users` select in `backend/src/api/middleware/session.ts`; attach `name: resolveDisplayName(name, email)` to `req.user`
- [x] T015 [US1] Change `signup` signature to `signup(name, email, password)` and thread the name through in `frontend/src/context/auth.tsx`
- [x] T016 [US1] Add a "Full name" field above Email (order: Full name, Email, Password, Confirm password) in `frontend/src/pages/SignupPage.tsx` with the existing field/error/focus-`FormAlert` pattern (depends on T015)
- [x] T017 [P] [US1] Create `frontend/src/lib/initials.ts` exporting `initialsFromName(name)` per the identity contract (first of first/last word, uppercased, max 2, `"?"` if empty)
- [x] T018 [P] [US1] Create `frontend/src/components/Avatar.tsx` taking `name` and a `decorative` flag: decorative = `aria-hidden` initials; standalone = `role="img"` + `aria-label={name}`
- [x] T019 [US1] Update `frontend/src/components/Layout.tsx` to show `user.name` (email as secondary context) plus the `Avatar` in the header (depends on T017, T018)

**Checkpoint**: At this point, User Story 1 is fully functional and testable
independently (MVP).

---

## Phase 4: User Story 2 - Identify the Assignee of an Issue (Priority: P1)

**Goal**: Issue payloads expose the assignee identity (`assignee: { id, name } | null`,
`assigneeId` preserved); issue detail and issue list render the assignee's
display name; the assignee picker lists member display names.

**Independent Test**: Assign a workspace member to an issue, then assert
`assignee: { id, name }` in create/get/list/update responses, the issue detail
shows the name (not a UUID), "Unassigned" for unassigned, and the dropdown
lists member names. Frontend component tests assert names instead of UUIDs.

### Tests for User Story 2 ⚠️

- [x] T020 [P] [US2] Update `backend/tests/integration/issues.test.ts`: assert `assignee: { id, name }` (or `null`) on create/get/list/update when assigned, and that `passwordHash` never appears in issue responses
- [x] T021 [P] [US2] Update `frontend/tests/component/issue-page.test.tsx`: mock issue payloads gain `assignee`; assert the Assignee field renders the assignee name and "Unassigned" when null
- [x] T022 [P] [US2] Update `frontend/tests/component/workspace-page.test.tsx`: mock issue payloads gain `assignee`; assert issue cards show the assignee name when set

### Implementation for User Story 2

- [x] T023 [US2] Update `backend/src/services/issue.ts` to LEFT JOIN `users` on `assigneeId` in `getIssue`/`listIssues` (and through create/update which return via `getIssue`) selecting `users.name` + `users.email`, building `assignee: assigneeId ? { id, name: resolveDisplayName(...) } : null`
- [x] T024 [US2] Update `backend/src/api/routes/workspaces.ts`/`membership.ts` dependency: `listMembers` must already return `name` (see T032, US4) — after US4, the IssueForm picker reads it; update the `Member` interface to `{ userId, email, name }` in `frontend/src/components/IssueForm.tsx` and render `m.name` in the assignee dropdown options (depends on US4 T032)
- [x] T025 [US2] Update `frontend/src/pages/IssuePage.tsx`: render `issue.assignee?.name` in the Assignee field (or "Unassigned"), with the `Avatar` next to it
- [x] T026 [US2] Update `frontend/src/pages/WorkspacePage.tsx`: issue cards show `issue.assignee?.name` when set (with optional `Avatar`)

**Checkpoint**: At this point, User Stories 1 AND 2 work independently.

---

## Phase 5: User Story 3 - Identify the Author of a Comment (Priority: P2)

**Goal**: Comment payloads expose the author identity (`author: { id, name }`,
`authorId` preserved); comment threads render each author's display name.

**Independent Test**: Add a comment, then assert `author: { id, name }` in
add/list responses and the thread renders the author's name (not a UUID).

> **NOTE**: `IssuePage.tsx` and `issue-page.test.tsx` are shared with US2 —
> US3 must be sequenced after US2 for those two files.

### Tests for User Story 3 ⚠️

- [x] T027 [P] [US3] Update `backend/tests/integration/comments.test.ts`: assert `author: { id, name }` on add/list, and that `passwordHash` never appears in comment responses
- [x] T028 [P] [US3] Update `frontend/tests/component/issue-page.test.tsx` (same file as T021): mock comment payloads gain `author`; assert each comment shows its author's display name (after US2)

### Implementation for User Story 3

- [x] T029 [US3] Update `backend/src/services/comment.ts`: `listComments` LEFT JOINs `users` on `authorId` selecting `users.name` + `users.email`; `addComment` returns `author: { id, name: resolveDisplayName(...) }` (query the author after insert, or join the inserted row)
- [x] T030 [US3] Update `frontend/src/pages/IssuePage.tsx` (same file as T025): render `c.author.name` in comment meta with the `Avatar`, and add the `author` field to the local `Comment` interface (after US2)

**Checkpoint**: At this point, User Stories 1–3 all work independently.

---

## Phase 6: User Story 4 - Identify Members of a Workspace (Priority: P3)

**Goal**: The members endpoint returns each member's display name
(`{ userId, email, name }`); member names feed the assignee picker.

**Independent Test**: `GET /workspaces/:id/members` returns each member with a
`name`; the assignee picker lists member display names.

### Tests for User Story 4 ⚠️

- [x] T031 [P] [US4] Update `backend/tests/integration/workspaces.test.ts`: assert each member in the members response includes a `name` (resolved)

### Implementation for User Story 4

- [x] T032 [US4] Update `backend/src/services/membership.ts` `listMembers` to select `users.name` and return `{ userId, email, name: resolveDisplayName(name, email) }` (prerequisite for US2 picker T024)

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T033 [P] Update `frontend/tests/accessibility/core.test.tsx`: mocked issue/comment payloads gain `assignee`/`author`; assert no axe violations on the name field and decorative-vs-announced avatar semantics
- [x] T034 [P] Add a backend migration test (in `backend/tests/integration/` or `backend/tests/unit/`) asserting `0002_user_display_name.sql` applies cleanly to a 0001-schema DB and existing rows keep a null `name` (SC-006)
- [x] T035 [P] Add `frontend/tests/component/fallback.test.tsx` verifying no empty name renders anywhere (identity surfaces always show the email local-part fallback; SC-008)
- [x] T036 Run `specs/003-user-display-name/quickstart.md` validation scenarios 1–10 end-to-end
- [x] T037 Run full verification: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:a11y`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately (T002–T005 run in parallel after/with T001)
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational completion
  - US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5) → US4 (Phase 6) in priority order
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories (MVP)
- **User Story 2 (P1)**: Depends on US1 (auth/`SessionUser.name` baseline). Its assignee-picker task (T024) additionally depends on US4's members `name` change (T032); issue-detail/list UI (T025, T026) do NOT.
- **User Story 3 (P2)**: Depends on US1 + US2. Shares `IssuePage.tsx` and `issue-page.test.tsx` with US2 — MUST be sequenced after US2 for those files (T028 after T021, T030 after T025).
- **User Story 4 (P3)**: Depends on US1. Its backend change (T032) is a prerequisite for US2's picker (T024).

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Shared types (T005) → service layer → API → frontend integration
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005 run in parallel (different files, no deps)
- Phase 2: T007 [P] after T006 (different files)
- Phase 3: T008–T011 (tests) in parallel; T013, T017, T018 in parallel
- Phase 4: T020–T022 (tests) in parallel; T025, T026 in parallel after T023
- Phase 5: T027–T028 in parallel; T029, T030 after US2 completes
- Phase 6: T031, T032 in parallel
- Phase 7: T033–T035 in parallel

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Update backend/tests/api.test.ts (name assertions, 422, passwordHash, legacy fallback)"
Task: "Update frontend/tests/component/auth.test.tsx (Full name field, mock payloads)"
Task: "Create frontend/tests/component/layout.test.tsx (header name + avatar)"
Task: "Create frontend/tests/component/initials.test.ts (initialsFromName)"

# Launch parallel implementation files:
Task: "Update backend/src/services/auth.ts (signup/name/AuthResult.user.name)"
Task: "Create frontend/src/lib/initials.ts"
Task: "Create frontend/src/components/Avatar.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T007) (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (T008–T019)
4. **STOP and VALIDATE**: Run `npm test -w backend` + `npm run test:ui -w frontend`; sign up with a name and see it in the header
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2 (backend, issue list/detail UI — after US1)
   - Developer C: User Story 4 (members) — its T032 unblocks US2's picker
   - Developer D: User Story 3 (after US2, for shared `IssuePage.tsx`/tests)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts (US2/US3 share `IssuePage.tsx` and `issue-page.test.tsx`), cross-story dependencies that break independence