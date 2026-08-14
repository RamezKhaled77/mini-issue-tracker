# Tasks: UI Redesign — Mini Issue Tracker

**Input**: Design documents from `/specs/002-ui-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/design-system.md, quickstart.md

**Tests**: Test tasks are included because the spec explicitly requires extending
the accessibility test suite (SC-003, FR-044–FR-047, quickstart scenario 11) and
validating dialog keyboard behavior (FR-033, FR-035). Behavior tests from feature
001 must remain green — the redesign must not change any behavior.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/` — this feature is presentation-only; `backend/`,
  `shared/`, `frontend/src/api/`, and `frontend/src/context/` are NOT edited.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the baseline and establish the CSS layer structure before any
visual change. No behavior changes here.

- [x] T001 Verify baseline is green: run `npm test`, `npm run test:ui`, `npm run test:a11y`, `npm run lint`, `npm run typecheck` and record results before any edits
- [x] T002 [P] Create `frontend/src/styles/` with empty `tokens.css`, `base.css`, `components.css` layer files
- [x] T003 Update `frontend/src/main.tsx` to import the three CSS layers in order (`./styles/tokens.css`, `./styles/base.css`, `./styles/components.css`), replacing the single `./styles.css` import; app must render identically (no visual change yet)

**Checkpoint**: CSS layer structure loads; all baseline tests still pass.

---

## Phase 2: Foundational (Design System — Blocking Prerequisites)

**Purpose**: Design tokens, base styles, and reusable primitives that EVERY user
story depends on (contracts/design-system.md §1–§3).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Define ALL design tokens in `frontend/src/styles/tokens.css` per contracts/design-system.md §1: semantic color roles (bg, surface, border, text, accent, success/warning/danger/info + badge tints), status/priority badge mapping, type scale, spacing scale, border/radius, elevation, and motion tokens
- [x] T005 [P] Implement `frontend/src/styles/base.css`: reset, element defaults, global focus-visible ring, `.sr-only`, and `prefers-reduced-motion` handling (FR-046)
- [x] T006 [P] Create `Button` component (primary/secondary/ghost/danger variants + default/hover/focus-visible/active/disabled states) in `frontend/src/components/Button.tsx` (FR-006, FR-048)
- [x] T007 [P] Create `Badge` component with status (Open/In Progress/Closed) and priority (Low/Medium/High/Urgent) variants consuming status/priority tokens in `frontend/src/components/Badge.tsx` (FR-003, SC-006 — text always present, color never sole indicator)
- [x] T008 [P] Create `Field` component (label, control slot, helper/error text with `aria-invalid`/`aria-describedby`) in `frontend/src/components/Field.tsx` (FR-032, FR-037)
- [x] T009 [P] Create `Alert` component (error/success/info variants, `role="alert"`, supports focus via ref for existing `useFocusAlert` pattern) in `frontend/src/components/Alert.tsx` (FR-037)
- [x] T010 [P] Create `Dialog` component implementing focus trap, focus return to trigger, Escape-to-close, `role="dialog"`/`aria-modal="true"`/`aria-labelledby`, overlay scrim, and optional `aria-describedby` in `frontend/src/components/Dialog.tsx` (FR-033, FR-035)
- [x] T011 [P] Create `EmptyState` component (title, description, optional action) in `frontend/src/components/EmptyState.tsx` (FR-040)
- [x] T012 [P] Create `Spinner` and `Skeleton` components (CSS-based, reduced-motion aware) in `frontend/src/components/Spinner.tsx` and `frontend/src/components/Skeleton.tsx` (FR-035, SC-008)
- [x] T013 Write component styles consuming tokens for Button, Badge, Field, Alert, Dialog, EmptyState, Spinner, Skeleton in `frontend/src/styles/components.css` (FR-005: hairline borders, restrained elevation, minimal shadows)
- [x] T014 Extend `frontend/tests/accessibility/core.test.tsx` with axe checks for Button/Dialog/Badge/Field and a keyboard interaction test for Dialog (focus trap, focus return, Escape) (FR-033, FR-035, SC-003)

**Checkpoint**: Design system foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Sign In and Sign Up in the Redesigned Auth Flow (Priority: P1) 🎯 MVP

**Goal**: Polished, centered auth cards with the same fields and validation as today (FR-011, FR-012).

**Independent Test**: Render `/login` and `/signup`; verify new layout, labels, accessible error handling, and that sign-in/sign-up still work end-to-end (quickstart scenario 2).

### Implementation for User Story 1

- [x] T015 [US1] Refactor `frontend/src/pages/LoginPage.tsx` to use `Field`, `Alert`/`FormAlert`, and `Button` with the centered auth card layout (FR-011, FR-012)
- [x] T016 [P] [US1] Refactor `frontend/src/pages/SignupPage.tsx` to use `Field`, `Alert`, and `Button` with the same layout; keep confirm-password validation (FR-011)
- [x] T017 [US1] Style auth pages (centered card, brand identity, focus states) in `frontend/src/styles/components.css` (FR-011)
- [x] T018 [US1] Update `frontend/tests/accessibility/core.test.tsx` login/signup axe coverage for the redesigned markup (SC-003)

**Checkpoint**: Auth flow fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 — Navigate the Redesigned Application Shell (Priority: P1)

**Goal**: Persistent professional app header with product identity, user identity, sign-out, and skip-to-content (FR-008–FR-010).

**Independent Test**: Navigate across all authenticated pages; header consistent, product identity returns to dashboard, sign-out works, skip link is first focusable (quickstart scenario 3).

### Implementation for User Story 2

- [x] T019 [US2] Redesign `frontend/src/components/Layout.tsx` header (product identity → dashboard link, user email, sign-out `Button`, skip-to-content link) and content container (FR-008–FR-010)
- [x] T020 [US2] Style app shell/header (hairline bottom border, small elevation, responsive behavior) in `frontend/src/styles/components.css` (FR-008, contracts §4)
- [x] T021 [US2] Add keyboard/focus assertion: skip link first focusable; header focus order logical — extend `frontend/tests/accessibility/core.test.tsx` (FR-010, FR-044)

**Checkpoint**: Shell consistent across all pages; keyboard navigation works.

---

## Phase 5: User Story 3 — Manage Workspaces on the Redesigned Dashboard (Priority: P1)

**Goal**: Clean dashboard with workspace list (Owner/Member tags), create-workspace flow, join flow, and helpful empty state (FR-013–FR-015).

**Independent Test**: Create a workspace, join via invitation token, open a workspace; empty state for a new user (quickstart scenario 4).

### Implementation for User Story 3

- [x] T022 [US3] Redesign `frontend/src/pages/DashboardPage.tsx`: workspace list rows with `Badge` Owner/Member, create-workspace dialog (reuse `Dialog`), join-workspace input with inline feedback, `EmptyState` for no workspaces, `Skeleton` loading (FR-013–FR-015, FR-019)
- [x] T023 [US3] Style dashboard list, create/join controls, and empty state in `frontend/src/styles/components.css` (FR-013, FR-015)
- [x] T024 [US3] Add `frontend/tests/accessibility/core.test.tsx` axe coverage for the redesigned dashboard (SC-003)

**Checkpoint**: Dashboard fully functional and independently testable.

---

## Phase 6: User Story 4 — Manage Projects in the Redesigned Workspace (Priority: P1)

**Goal**: Project list with clear selected state, create/rename/delete via dialogs, and readable dashboard statistics (FR-016–FR-019).

**Independent Test**: Create, select, rename, delete a project; selection persists across reloads; stats render (quickstart scenarios 5, 10).

**Note**: This story and US5 both edit `frontend/src/pages/WorkspacePage.tsx` — implement US4 before US5 to avoid same-file conflicts.

### Implementation for User Story 4

- [x] T025 [US4] Redesign project list column and create/rename/delete flows in `frontend/src/components/ProjectDialog.tsx` and the projects column of `frontend/src/pages/WorkspacePage.tsx`: `Button`/`Badge`/`Dialog`/`EmptyState`/`Skeleton`; selected state visually distinct (FR-017–FR-019)
- [x] T026 [US4] Redesign dashboard statistics card (counts by status and priority) in `frontend/src/pages/WorkspacePage.tsx` + styles in `frontend/src/styles/components.css`; data and stat labels unchanged (FR-016)
- [x] T027 [US4] Add axe coverage for the redesigned project dialog and workspace project column in `frontend/tests/accessibility/core.test.tsx` (SC-003)

**Checkpoint**: Projects fully functional and independently testable.

---

## Phase 7: User Story 5 — Browse, Search, and Filter Issues (Priority: P1)

**Goal**: Issue rows with identifiable status/priority badges, project-scoped search + status/priority filters, result count, active-filter indication, and distinct empty states (FR-020–FR-026).

**Independent Test**: Create varied issues; confirm search and each filter narrow the list; combined filters AND; empty states (quickstart scenario 6).

**Note**: Edit the issues column of `frontend/src/pages/WorkspacePage.tsx` (US4 completed first).

### Implementation for User Story 5

- [x] T028 [US5] Redesign issue list rows (title + status/priority `Badge`) in `frontend/src/pages/WorkspacePage.tsx` issues column + styles in `frontend/src/styles/components.css` (FR-020, FR-021)
- [x] T029 [US5] Redesign filter bar (search input, status/priority selects, result count, active-filter indication, clear-filters action) in `frontend/src/pages/WorkspacePage.tsx` + styles; search/filter behavior unchanged and project-scoped (FR-023–FR-026)
- [x] T030 [US5] Add axe coverage for the redesigned workspace page (filters + issue list) in `frontend/tests/accessibility/core.test.tsx` (SC-003)

**Checkpoint**: Issue browsing/search/filtering fully functional and independently testable.

---

## Phase 8: User Story 6 — View and Manage an Issue (Priority: P1)

**Goal**: Focused issue detail with all fields, immediate status/priority save-on-change, comment thread + add form, and delete confirmation (FR-027–FR-030).

**Independent Test**: Open an issue; change status/priority (saves immediately); add a comment; delete via confirmation dialog (quickstart scenario 7).

**Note**: This story and US7 both touch issue surfaces — implement US6 before US7.

### Implementation for User Story 6

- [x] T031 [US6] Redesign `frontend/src/pages/IssuePage.tsx`: main content (title, description) + meta region (status, priority, assignee, labels, due date — "Unassigned"/"No due date" when empty), save-on-change selectors with success feedback (FR-027, FR-028)
- [x] T032 [US6] Redesign comment thread (author, timestamp, `EmptyState` when none) and add-comment form in `frontend/src/pages/IssuePage.tsx` + styles in `frontend/src/styles/components.css` (FR-029)
- [x] T033 [US6] Replace delete `window.confirm` with `Dialog` confirmation ("Delete this issue and all its comments?") with safe cancel; add axe + keyboard coverage in `frontend/tests/accessibility/core.test.tsx` (FR-030, FR-041, FR-033)

**Checkpoint**: Issue detail fully functional and independently testable.

---

## Phase 9: User Story 7 — Create and Edit Issues via Redesigned Forms (Priority: P1)

**Goal**: Consistent issue create/edit form with all current fields and field-level validation (FR-031, FR-032, FR-038, FR-034).

**Independent Test**: Create a fully populated issue; edit each field; required-field validation blocks; API field errors map to correct fields (quickstart scenario 8).

### Implementation for User Story 7

- [x] T034 [US7] Refactor `frontend/src/components/IssueForm.tsx` to use `Field`/`Button`/`Badge` and token-driven styles; keep ALL fields (title, description, status, priority, assignee, labels, due date) and label-chip picker (FR-031, FR-032)
- [x] T035 [US7] Render issue form in a `Dialog` for both create and edit entry points (`frontend/src/pages/WorkspacePage.tsx`, `frontend/src/pages/IssuePage.tsx`); map API `fields` errors to matching `Field` error text; disable submit while saving (FR-033, FR-035, FR-038, FR-034)
- [x] T036 [US7] Add axe coverage for the redesigned issue form in `frontend/tests/accessibility/core.test.tsx` (existing issue-form test updated to new markup) (SC-003)

**Checkpoint**: Issue create/edit fully functional and independently testable.

---

## Phase 10: User Story 8 — Consistent Feedback, Empty, Loading, and Destructive States (Priority: P2)

**Goal**: Every state — loading, error, success, empty, destructive — uses consistent, accessible patterns app-wide (FR-035–FR-041).

**Independent Test**: Exercise each state across pages (load, fail, succeed, empty, delete) — quickstart scenario 9.

### Implementation for User Story 8

- [x] T037 [US8] Standardize loading: page-level `Skeleton` for initial loads (no "Loading..." text, no layout shift) and `Button` disabled/progress labels ("Saving...", "Deleting...") across all pages/components (FR-035, FR-036, SC-008)
- [x] T038 [US8] Standardize error presentation: page/alert `Alert` with `role="alert"` + `useFocusAlert` focus management, and field-level errors via `Field` across all forms and pages (FR-037, FR-038)
- [x] T039 [US8] Standardize success feedback on create/update (updated list/state, inline confirmation, or dismissible transient notice) — no backend notifications (FR-039)
- [x] T040 [US8] Standardize `EmptyState` across dashboard (no workspaces), projects (none), issues (none / no matches — distinct messages), and comments (none) (FR-040, FR-022)
- [x] T041 [US8] Replace ALL remaining `window.confirm` calls with `Dialog` confirmations stating exact consequences ("Delete this project and all its issues?") and safe cancel; verify `frontend/tests/component/` and `frontend/tests/accessibility/` stay green (FR-041, FR-034)

**Checkpoint**: All feedback states consistent and accessible across the app.

---

## Phase 11: User Story 9 — Responsive and Accessible Redesign (Priority: P2)

**Goal**: Usable at desktop/tablet/mobile widths; fully keyboard- and screen-reader-accessible; reduced-motion respected (FR-042–FR-047).

**Independent Test**: Resize to 1280/768/375px with no horizontal scroll; complete all core flows keyboard-only; a11y suite green (quickstart scenarios 10, 11).

### Implementation for User Story 9

- [x] T042 [US9] Implement responsive breakpoints (≥1280 / ~768 / ≤375) in `frontend/src/styles/components.css`: workspace two-column collapses to single column, stat grids reflow to 2-col, issue detail main|meta stacks, dialogs near-full-screen on mobile, touch targets ≥44px (FR-042, FR-043, FR-044)
- [x] T043 [US9] Add/update axe coverage for responsive and dialog surfaces and a keyboard-only flow walkthrough assertion in `frontend/tests/accessibility/core.test.tsx` (SC-003, SC-004)
- [x] T044 [US9] Verify WCAG AA contrast of all light-mode tokens and text; fix any token contrast failures in `frontend/src/styles/tokens.css` (FR-047, SC-003)

**Checkpoint**: Responsive + accessible across all viewports and input modes.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, quality, and Dark-Mode-readiness audit.

- [x] T045 [P] Confirm components reference ONLY semantic color roles (no raw hex outside `tokens.css`) — Dark Mode readiness smoke check (FR-007, SC-009); fix any violations
- [x] T046 [P] Verify feature-001 functional scenarios still pass (sign in/out, workspace, project, issue CRUD, comments, search/filter, dashboard) — no behavior regression (SC-001, SC-002)
- [x] T047 [P] Run `npm run lint` and `npm run typecheck`; fix all issues
- [x] T048 Run full suites `npm test`, `npm run test:ui`, `npm run test:a11y` — all green
- [x] T049 Run `specs/002-ui-redesign/quickstart.md` validation scenarios end-to-end against a running instance
- [x] T050 Update feature documentation pointers if any copy/labels changed intentionally; confirm no backend/API/shared changes were made (`git status` shows only `frontend/src` and `frontend/tests` changes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational completion.
  - US1–US4 (P1) proceed in priority order; US4 before US5; US6 before US7 (shared-file sequencing).
  - US8, US9 (P2) after P1 stories, and benefit from all surfaces existing.
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational; independent (auth pages only).
- **US2 (P1)**: After Foundational; independent (shell only) — can run parallel to US1/US3+.
- **US3 (P1)**: After Foundational; independent (dashboard only).
- **US4 (P1)**: After Foundational; edits `WorkspacePage.tsx` — must precede US5.
- **US5 (P1)**: Depends on US4 (same file `WorkspacePage.tsx`); otherwise independent.
- **US6 (P1)**: After Foundational; edits `IssuePage.tsx` — must precede US7.
- **US7 (P1)**: Depends on US6 (issue surfaces); otherwise independent.
- **US8 (P2)**: After all P1 stories (touches every page/component).
- **US9 (P2)**: After all P1 stories (styles across surfaces).

### Within Each User Story

- Primitives (Phase 2) before any page refactor.
- Refactor page → style → a11y coverage.
- Story complete before moving to the next priority.

### Parallel Opportunities

- Phase 2 tasks T005–T012 are all `[P]` (different component files); T004 (tokens) and T013 (component styles) anchor them.
- US1, US2, US3, US6, and US4 can run in parallel on different files/pages (as team capacity allows).
- T015/T016 (auth pages) are `[P]` (different files).
- A11y/test tasks (T018, T021, T024, T027, T030, T036, T043) are independent once their surface exists.
- Polish tasks T045–T047 are `[P]` after all stories.

## Parallel Example: Foundational Phase

```bash
# Launch primitives together (different files):
Task: "Create Button component in frontend/src/components/Button.tsx"
Task: "Create Badge component in frontend/src/components/Badge.tsx"
Task: "Create Field component in frontend/src/components/Field.tsx"
Task: "Create Alert component in frontend/src/components/Alert.tsx"
Task: "Create Dialog component in frontend/src/components/Dialog.tsx"
Task: "Create EmptyState component in frontend/src/components/EmptyState.tsx"
Task: "Create Spinner and Skeleton components"
```

## Parallel Example: Auth Pages (US1)

```bash
Task: "Refactor LoginPage.tsx to use Field/Alert/Button"
Task: "Refactor SignupPage.tsx to use Field/Alert/Button"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify baseline, CSS layer structure).
2. Complete Phase 2: Foundational design system (tokens, primitives, Dialog) — CRITICAL.
3. Complete Phase 3: User Story 1 (auth redesign).
4. **STOP and VALIDATE**: sign in/sign up work, a11y green, baseline suites green.
5. Deploy/demo if ready — this is the MVP increment.

### Incremental Delivery

1. Setup + Foundational → design system ready.
2. Add US1 (auth) → test independently → Demo (MVP!).
3. Add US2 (shell) → test independently → Demo.
4. Add US3 (dashboard) → test independently → Demo.
5. Add US4 + US5 (projects + issues/filters) → test independently → Demo.
6. Add US6 + US7 (issue detail + forms) → test independently → Demo.
7. Add US8 + US9 (feedback states + responsive/a11y) → final validation.
8. Run Polish phase and quickstart.md scenarios.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together.
2. Once Foundation is done: Developer A = US1, B = US2, C = US3, D = US4, E = US6.
3. Then US5 (after US4) and US7 (after US6) integrate.
4. US8/US9 by anyone as a final sweep.

---

## Notes

- [P] tasks = different files, no dependencies. Same-file conflicts: US4→US5 and
  US6→US7 are sequential; the two WorkspacePage stories and two IssueForm/IssuePage
  stories must not run in parallel on the same file.
- [Story] label maps task to the specific user story for traceability.
- Behavior is immutable: the redesign must not change any functionality, API
  usage, data, permissions, or business rules (FR-049).
- If a feature-001 test fails because it queried markup/class names, update the
  test to the new accessible structure — behavior assertions must NOT change.
- Commit after each task or logical group.
- Stop at any checkpoint to validate the story independently.