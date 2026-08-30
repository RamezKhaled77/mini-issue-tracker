---

description: "Task list for Mentions feature implementation"

---

# Tasks — Spec 010: Mentions

> Derived from the approved `spec.md` + `plan.md`. Each task is independently
> verifiable so every phase can be validated and committed in isolation.

**Input**: Design documents from `/specs/010-mentions/`

**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories),
`frontend/VISUAL_LANGUAGE.md` (visual source of truth)

**Tests**: Backend unit + integration tests; frontend component + axe a11y tests.
Backend suite re-run as a no-change regression gate for frontend-only phases.

**Format**: `[ID] [P?] [Story]` Description

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec user stories / functional areas
- Include exact file paths in descriptions

---

## Phase 1: Database & Types

**Purpose**: Add the `comment_mentions` table and shared types. No service or
frontend work begins until the schema is in place.

- [ ] T001 Create migration `backend/src/db/migrations/0007_comment_mentions.sql`
  with `comment_mentions` table, `commentId` + `mentionedUserId` indexes,
  `ON DELETE CASCADE` on both foreign keys.
- [ ] T002 [P] Add `commentMentions` table definition and relations to
  `backend/src/db/schema.ts`. Export `CommentMention` type from schema.
- [ ] T003 [P] Add `CommentMention` and `CommentWithMentions` interfaces to
  `shared/index.ts`. Update `CreateCommentRequest` with optional `mentions?: string[]`.

**Checkpoint**: `cd backend && npm run typecheck`. Migration applies cleanly
via `npm run db:migrate`.

---

## Phase 2: Backend Service & Validation

**Purpose**: Atomic comment + mention creation, mention-enriched comment listing,
and server-side validation of mention targets.

- [ ] T004 [US1] Update `backend/src/services/comment.ts` — extend `addComment`
  to accept optional `mentionIds?: string[]`, validate every ID against the
  issue's workspace membership (reuse `membershipService.listMembers`), reject
  non-members and self-mentions with `422 VALIDATION`, deduplicate IDs, and
  persist `comment_mentions` records inside `db.transaction()`.
- [ ] T005 [US1] Update `backend/src/services/comment.ts` — extend
  `listComments` to return a `mentions` array per comment by joining
  `comment_mentions` with `users` and resolving display names via
  `resolveDisplayName`.
- [ ] T006 [US1] Update `backend/src/api/validators/comment.ts` — add optional
  `mentions: z.array(z.string().uuid()).optional().default([])` to
  `createCommentSchema`.
- [ ] T007 [US1] Update `backend/src/api/routes/comments.ts` — extract `mentions`
  from parsed request body and forward to `commentService.addComment`.

**Checkpoint**: Backend typecheck passes. Existing comment tests still pass
(backward compatibility — `mentions` defaults to empty array).

---

## Phase 3: Backend Tests

**Purpose**: Verify comment + mention atomicity, authorization, deduplication,
cascade behavior, and backward compatibility.

### Tests (write first — must FAIL before implementation)

- [ ] T008 [P] [US1] Backend unit tests in `backend/tests/unit/comment-mentions.test.ts`:
  single valid mention, multiple valid mentions, duplicate mention deduplication,
  invalid user ID rejection, cross-workspace rejection, non-member rejection,
  self-mention rejection, comment + mention atomicity (mention failure rolls back),
  historical mentions after member removal (cascade), malformed payloads,
  comment listing includes `mentions` array.
- [ ] T009 [P] [US1] Backend integration tests in
  `backend/tests/integration/comment-mentions.test.ts`:
  end-to-end comment creation with mentions, GET comments returns `mentions`,
  unauthorized access (403), invalid mention payload (422), backward-compatible
  comments without mentions.

### Verification

- [ ] T010 Run `cd backend && npm run test && npm run typecheck && npm run lint && npm run build`.
  All tests pass, zero lint errors, build succeeds.

**Checkpoint**: All backend tests green. No regressions in existing comment tests.

---

## Phase 4: Frontend — Autocomplete Component

**Purpose**: Build the mention autocomplete combobox and integrate it into the
comment composer. This is the primary new UI surface.

### Component

- [ ] T011 [P] [US2] Create `frontend/src/components/MentionAutocomplete.tsx`
  — combobox/listbox that filters workspace members by display name (case-insensitive
  substring), shows max 10 suggestions, supports ArrowUp/ArrowDown navigation,
  Enter/Tab selection, Escape dismissal, click selection, and empty state
  ("No matching members"). Uses `role="listbox"`, `role="option"`,
  `aria-activedescendant`, `aria-expanded`, and `role="status"` live region
  for result count announcements.
- [ ] T012 [P] [US2] Style `.mention-autocomplete` in
  `frontend/src/styles/components.css` — absolute positioned dropdown with
  `--color-surface` background, `--color-border` border, `--shadow-sm`,
  `.mention-autocomplete-item` with 44px min height on coarse pointers,
  `--color-accent-subtle` active state, `--color-accent` mention names,
  `--color-text-faint` `@` prefix.
- [ ] T013 [P] [US2] Add `.mention` inline style to `frontend/src/styles/components.css` —
  `color: var(--color-accent)`, `font-weight: var(--font-weight-semibold)`,
  no background/border/radius/shadow, hover `var(--color-surface-hover)`.

### Integration

- [ ] T014 [US2] Update `frontend/src/pages/IssuePage.tsx` — load workspace
  members (reuse `GET /workspaces/:id/members`), detect `@` trigger in
  textarea input, open/close autocomplete, track selected mentions
  (`Map<string, string>` of userId → name), consume ArrowUp/Down/Enter/Tab/Escape
  when autocomplete is open, insert `@Name` on selection, pass
  `mentions` array on form submission.
- [ ] T015 [US2] Update local `Comment` interface in `IssuePage.tsx` to include
  `mentions: Array<{ userId: string; name: string }>`.

**Checkpoint**: `cd frontend && npm run typecheck && npm run lint`. Autocomplete
opens on `@`, filters, selects, and submits mentions correctly.

---

## Phase 5: Frontend — Mention Rendering

**Purpose**: Render `@Name` mentions as styled inline spans in the comment thread.

- [ ] T016 [US2] Update comment rendering in `frontend/src/pages/IssuePage.tsx` —
  for each comment, iterate the `mentions` array and replace `@${name}`
  occurrences in the body with `<span className="mention">@${name}</span>`.
  Render the body using React children composition (not `dangerouslySetInnerHTML`).
  Comments without mentions render unchanged.
- [ ] T017 [US2] Verify backward compatibility: existing comments without a
  `mentions` array (or empty array) render the body as plain text with no
  mention spans.

**Checkpoint**: Mentions render in petrol semibold inline. Non-mention text is
unaffected. No layout regressions.

---

## Phase 6: Frontend Tests

**Purpose**: Verify autocomplete behavior, rendering, accessibility, and
keyboard coexistence.

### Tests (write first — must FAIL before implementation)

- [ ] T018 [P] [US2] Frontend component tests in
  `frontend/tests/component/mention-autocomplete.test.tsx`:
  typing `@` opens list, filtering works, keyboard selection (ArrowUp/Down,
  Enter, Tab), mouse/touch selection, Escape dismisses, multiple mentions,
  no-results state, punctuation handling, comment submission includes mentions,
  rendered mention styling.
- [ ] T019 [P] [US2] Frontend component tests in
  `frontend/tests/component/mention-rendering.test.tsx`:
  single mention renders as styled span, multiple mentions, comment without
  mentions renders plain text, backward compatibility.
- [ ] T020 [P] [US2] Extend `frontend/tests/accessibility/core.test.tsx` —
  axe audit of the mention autocomplete (open, with results, empty state),
  keyboard-only operation, combobox/listbox semantics, focus preserved on
  textarea, 44px touch targets on coarse pointers.

### Keyboard Coexistence

- [ ] T021 [P] [US2] Extend `frontend/tests/component/issue-page.test.tsx` —
  verify `/` does not open search while typing in composer, Ctrl/Cmd+K does
  not open search while typing in composer, `e`/`d`/`c` shortcuts do not fire
  while autocomplete is open, Arrow keys inside autocomplete navigate
  suggestions, Escape inside autocomplete dismisses list.

**Checkpoint**: All new component and a11y tests pass. Existing test suite
unchanged and passing.

---

## Phase 7: Verification & Documentation

**Purpose**: Whole-repo gates and visual-language bookkeeping.

- [ ] T022 Run full verification: `cd backend && npm run test && npm run typecheck && npm run lint && npm run build`,
  `cd frontend && npm run test && npm run typecheck && npm run lint && npm run build`.
  All suites pass.
- [ ] T023 [P] Walk the Visual Review Checklist (§14 of `frontend/VISUAL_LANGUAGE.md`).
  Update `frontend/VISUAL_LANGUAGE.md` only if `.mention` inline styling and
  `.mention-autocomplete` dropdown constitute genuinely new reusable patterns
  (structure, tokens, states, responsive, reuse rules); otherwise state
  explicitly that no visual language changes were introduced.
- [ ] T024 Confirm `git status` shows only the expected spec, plan, tasks, and
  source file changes. No unexpected modifications.

**Checkpoint**: All suites pass; docs updated or explicitly unchanged; feature complete.

---

## Dependencies

`Phase 1 → Phase 2 → Phase 3` (backend chain).
`Phase 1 → Phase 4 → Phase 5 → Phase 6` (frontend chain).
Phase 3 (backend tests) and Phase 4 (frontend component) can run in parallel
after Phase 2 is complete.
Phase 7 depends on all prior phases.

### Within Each Phase

- Tests (where marked) MUST be written and FAIL before implementation (TDD).
- Schema/domain before service/routes.
- Components before page integration.
- Core implementation before integration tests.
- Story complete before moving to next phase.

### Parallel Opportunities

- T002 and T003 can run in parallel (schema and shared types).
- T008 and T009 can run in parallel (unit and integration tests).
- T011, T012, T013 can run in parallel (component, styles).
- T018, T019, T020, T021 can run in parallel (frontend test files).
- T023 can run in parallel with T022 (documentation review).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps task to spec functional areas for traceability.
- Each task is independently verifiable so it can be committed in isolation.
- Verify tests fail before implementing (TDD approach for test tasks).
- Commit after each task or logical group.
- Stop at each checkpoint to validate independently.
- Avoid: vague tasks, same-file conflicts, cross-phase dependencies that break independence.
- Follow `VISUAL_LANGUAGE.md` strictly — no new colors, spacing, radii, shadows.
- Reuse existing components: `Avatar`, `Field`, `Button`, `useKeyboardShortcuts`, `isTypingContext`.
- Backend validation is authoritative — never trust the frontend member list.
- The `comment_mentions` table uses `ON DELETE CASCADE` — no orphan records.
- Comments are append-only — no mention editing support in v1.
