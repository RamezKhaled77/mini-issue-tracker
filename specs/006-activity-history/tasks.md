---

description: "Task list for Activity History (Issue Audit Trail) feature implementation"
---

# Tasks: Activity History (Issue Audit Trail)

**Input**: Design documents from `/specs/006-activity-history/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), VISUAL_LANGUAGE.md (visual compliance)

**Tests**: Tests are included per the implementation plan (backend unit + integration tests)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for the new feature

- [X] T001 Create migration file `backend/src/db/migrations/0004_activities.sql` with activities table and indexes
- [X] T002 [P] Add Activity types (`Activity`, `ActivityType`, `ActivityField`, `ActivityListResponse`) to `shared/index.ts`
- [X] T003 [P] Update `backend/src/db/schema.ts` with activities table definition (drizzle-orm)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create domain module `backend/src/domain/activity.ts` with `createActivityRecord()`, `truncateDescription()`, and `resolveActorName()` helpers
- [X] T005 Create ActivityService `backend/src/services/activity.ts` with `recordActivity()` and `listActivities()` methods
- [X] T006 Wire ActivityService into `backend/src/api/routes/index.ts` (create service instance, pass to issueRoutes and new activityRoutes)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 — Core Activity Recording & API (Priority: P1) 🎯 MVP

**Goal**: Backend records all activity events for issue mutations and exposes paginated API endpoint

**Independent Test**: 
- Create issue → GET /api/issues/:id/activity returns "issue.created" event
- Update status → returns "issue.updated" with field/from/to
- Add/remove labels → returns "issue.labels_added"/"issue.labels_removed" with label names
- Non-member → 403 FORBIDDEN
- Pagination works (page, pageSize, total)

### Tests for User Story 1 (write first, ensure they FAIL before implementation)

- [X] T007 [P] [US1] Backend unit tests in `backend/tests/unit/activity.test.ts` for recordActivity, listActivities pagination, actorName enrichment, assignee ID resolution, authorization
- [X] T008 [P] [US1] Backend integration tests in `backend/tests/integration/activity.test.ts` for all event types (create, status, priority, assignee, due_date, title, description, labels_added, labels_removed, delete), no-op updates, CASCADE delete, pagination, non-member access

### Implementation for User Story 1

- [X] T009 [US1] Create validator `backend/src/api/validators/activity.ts` with `activityQuerySchema` (page, pageSize)
- [X] T010 [US1] Create API routes `backend/src/api/routes/activities.ts` with `GET /issues/:id/activity` endpoint
- [X] T011 [US1] Modify `backend/src/services/issue.ts` — wrap `createIssue` in transaction, call `activityService.recordActivity(issueId, userId, "issue.created")`
- [X] T012 [US1] Modify `backend/src/services/issue.ts` — wrap `updateIssue` in transaction, capture before/after state, diff fields (status, priority, assigneeId, dueDate, title, description), emit `issue.updated` per changed field, handle label additions/removals with `issue.labels_added`/`issue.labels_removed`
- [X] T013 [US1] Modify `backend/src/services/issue.ts` — wrap `deleteIssue` in transaction, call `activityService.recordActivity(issueId, userId, "issue.deleted")` before delete
- [X] T014 [US1] Register activityRoutes in `backend/src/api/routes/index.ts` at `/api`

**Checkpoint**: User Story 1 complete - backend records all activity events and API returns paginated results

---

## Phase 4: User Story 2 — Frontend Activity Panel (Priority: P1)

**Goal**: Display activity history in Issue Detail page with proper visual treatment per VISUAL_LANGUAGE.md

**Independent Test**:
- Navigate to issue detail → see "Activity" section between Comments and Composer
- Activity shows ruled rows with actor, action, timestamp
- Each event type renders correctly (created dot, updated field arrow, label chips, deleted dot)
- "Load more" button loads older items
- EmptyState shows when no activity
- SkeletonRows show during initial load

### Tests for User Story 2 (write first if frontend test setup exists)

- [X] T015 [P] [US2] Frontend component tests (if test setup exists) for ActivityRow rendering each type, ActivityList load more, EmptyState, SkeletonRows

### Implementation for User Story 2

- [X] T016 [P] [US2] Add `getActivity` method to `frontend/src/api/client.ts`
- [X] T017 [P] [US2] Create `frontend/src/components/ActivityRow.tsx` — renders single ruled row with variants for all 5 event types, petrol/coral dots, monospace fields, Badge chips for labels, relative timestamps
- [X] T018 [P] [US2] Create `frontend/src/components/ActivityList.tsx` — manages pagination state, "Load more" button, EmptyState, SkeletonRows
- [X] T019 [P] [US2] Create `frontend/src/components/ActivityPanel.tsx` — wrapper with "Activity" section eyebrow, renders ActivityList
- [X] T020 [US2] Modify `frontend/src/pages/IssuePage.tsx` — import ActivityPanel, add activity state, loadActivity() function, insert ActivityPanel between comments list and comment composer
- [X] T021 [US2] Add activity styles to `frontend/src/styles/components.css` — .activity-panel, .activity-list, .activity-row, .activity-actor, .activity-action, .activity-meta, .activity-field, .activity-arrow, .activity-labels, .activity-dot variants, mobile flex-wrap, reduced motion

**Checkpoint**: User Story 2 complete - activity panel displays in Issue Detail with correct visual treatment

---

## Phase 5: User Story 3 — Responsive & Accessibility Polish (Priority: P2)

**Goal**: Ensure activity panel works across all breakpoints and meets accessibility standards

**Independent Test**:
- Mobile (320px, 375px): activity stacks below comments, full width, 44px touch targets
- Tablet (768px): appropriate layout
- Desktop (1024px+): side-by-side with fact rail
- Keyboard navigation: focus order comments → activity → composer
- Screen reader: semantic `<ol>`, `<article>` with aria-label, `<time datetime>`
- Reduced motion: no animations

### Implementation for User Story 3

- [ ] T022 [P] [US3] Verify/responsive test ActivityRow at 320px, 375px, 768px, 1024px, 1440px — timestamp truncates to relative time on narrow
- [ ] T023 [P] [US3] Verify keyboard navigation — focus order, visible focus states (reuse existing focus rings)
- [ ] T024 [P] [US3] Verify screen reader accessibility — semantic ol/article, aria-label on rows, time datetime attributes
- [ ] T025 [P] [US3] Verify reduced motion — no transitions on load
- [ ] T026 [US3] Ensure 44px minimum touch targets on mobile for Load More button and interactive elements

---

## Phase 6: Verification & Documentation

**Purpose**: Final validation and documentation updates

- [X] T027 Run backend verification: `cd backend && npm run test && npm run typecheck && npm run lint && npm run build`
- [X] T028 Run frontend verification: `cd frontend && npm run typecheck && npm run lint && npm run build`
- [X] T029 Run database migration: `npm run db:migrate` (applies 0004_activities.sql)
- [X] T030 Manual smoke test per checklist in plan.md (create issue, change status, priority, assignee, due date, title, description, add/remove labels, load more, non-member access, mobile layout, reduced motion, keyboard nav)
- [X] T031 [P] Update `VISUAL_LANGUAGE.md` if new patterns introduced (ActivityRow ruled rows, label strikethrough pattern)
- [X] T032 [P] Add activity types to shared types documentation (if applicable)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion (can run in parallel with US1 if different developers)
- **User Story 3 (Phase 5)**: Depends on User Story 2 (Phase 4) completion
- **Verification (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1 - Core API)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1 - Frontend Panel)**: Can start after Foundational (Phase 2) - Depends on US1 API being available (can develop in parallel with mock data)
- **User Story 3 (P2 - Polish)**: Depends on US2 completion

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Domain/Service before Routes
- Components before Page integration
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003)
- All Foundational tasks marked [P] can run in parallel (none in this phase - sequential)
- Once Foundational phase completes, US1 and US2 can start in parallel (different developers)
- All tests for a user story marked [P] can run in parallel (T007, T008)
- Frontend component tasks marked [P] can run in parallel (T017, T018, T019)
- Polish tasks marked [P] can run in parallel (T022-T025)
- Verification tasks marked [P] can run in parallel (T031, T032)

---

## Parallel Example: User Story 1 (Backend)

```bash
# Launch all tests for User Story 1 together:
Task: "Backend unit tests in backend/tests/unit/activity.test.ts"
Task: "Backend integration tests in backend/tests/integration/activity.test.ts"

# After tests written and failing, launch implementation:
Task: "Create validator backend/src/api/validators/activity.ts"
Task: "Create API routes backend/src/api/routes/activities.ts"
```

---

## Parallel Example: User Story 2 (Frontend)

```bash
# Launch all component implementations together:
Task: "Create frontend/src/components/ActivityRow.tsx"
Task: "Create frontend/src/components/ActivityList.tsx"
Task: "Create frontend/src/components/ActivityPanel.tsx"
Task: "Add getActivity to frontend/src/api/client.ts"
```

---

## Parallel Example: User Story 3 (Polish)

```bash
# Launch all verification tasks together:
Task: "Verify responsive at 320px, 375px, 768px, 1024px, 1440px"
Task: "Verify keyboard navigation focus order"
Task: "Verify screen reader accessibility"
Task: "Verify reduced motion behavior"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Backend API)
4. **STOP and VALIDATE**: Test API independently with curl/Postman
   - Create issue → verify activity recorded
   - Update fields → verify activity recorded with diffs
   - Pagination → verify page 2 loads older items
   - Non-member → verify 403

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Backend API) → Test independently → API works!
3. Add User Story 2 (Frontend Panel) → Test independently → UI works!
4. Add User Story 3 (Polish) → Test independently → Accessible & responsive!
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (or sequentially)
2. Once Foundational is done:
   - Developer A: User Story 1 (Backend - API, service, database)
   - Developer B: User Story 2 (Frontend - components, integration, styles)
3. Once US1 API is available, Developer B integrates real API
4. Developer A or C: User Story 3 (Polish - responsive, a11y)
5. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach for test tasks)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Follow VISUAL_LANGUAGE.md strictly - no new colors, spacing, radii, shadows
- Reuse existing components: Badge, EmptyState, SkeletonRows, Avatar
- Transaction consistency: activity recorded in same DB transaction as mutation