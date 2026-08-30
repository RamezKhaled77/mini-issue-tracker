# Implementation Plan — Spec 010: Mentions

## Phase 0: Preparation

- [ ] Create migration file `backend/src/db/migrations/0007_comment_mentions.sql`
- [ ] Add `CommentMention`, `CommentWithMentions` to `shared/index.ts`
- [ ] Add `commentMentions` relation to `backend/src/db/schema.ts`

## Phase 1: Database & Domain

### 1.1 Migration (`backend/src/db/migrations/0007_comment_mentions.sql`)

```sql
CREATE TABLE comment_mentions (
  id TEXT PRIMARY KEY NOT NULL,
  commentId TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentionedUserId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt INTEGER NOT NULL
);

CREATE INDEX comment_mentions_comment_idx ON comment_mentions (commentId);
CREATE INDEX comment_mentions_user_idx ON comment_mentions (mentionedUserId);
```

### 1.2 Schema (`backend/src/db/schema.ts`)

- Add `commentMentions` table definition with drizzle-orm
- Add `commentMentions` relation to `usersRelations` and `commentsRelations`
- Export `CommentMention` type from schema

### 1.3 Shared Types (`shared/index.ts`)

- Add `CommentMention` interface: `{ commentId: string; mentionedUserId: string; mentionedByName: string }`
- Add `CommentWithMentions` interface extending `Comment` with `mentions: CommentMention[]`
- Update `CreateCommentRequest` to include optional `mentions?: string[]`

### 1.4 Domain (existing `comment.ts` unchanged)

- `createCommentRecord` remains unchanged (returns `CommentEntity`)
- Add `createCommentMentionRecord(commentId, mentionedUserId)` if needed for domain layer
- Existing `CommentEntity` does not need changes (mentions are a separate concern)

## Phase 2: Backend Services

### 2.1 Update Comment Service (`backend/src/services/comment.ts`)

**File:** `backend/src/services/comment.ts`
**Responsibility:** Create comment + mention records atomically
**Why needed:** Existing `addComment` only creates the comment; it must now also persist mentions
**Existing pattern reused:** `db.transaction()` from `issueService.createIssue` (Spec 006)

Changes:
- `addComment(issueId, authorId, body, mentionIds?: string[])` accepts optional mention IDs
- Validate mention IDs:
  - Fetch workspace members for the issue's workspace
  - Verify each mention ID is a member
  - Reject non-members with `422 VALIDATION`
  - Reject self-mentions
  - Deduplicate IDs
- Wrap in `db.transaction()`:
  - Create comment record
  - Insert comment
  - Insert `comment_mentions` records for each valid mention ID
  - Return comment + mentions metadata
- `listComments` enriches each comment with `mentions` array
  - Query `comment_mentions` joined with `users` for the issue
  - Resolve display names via `resolveDisplayName`
  - Return `{ id, issueId, authorId, author, body, createdAt, mentions }`

### 2.2 Update Comment Validators (`backend/src/api/validators/comment.ts`)

**File:** `backend/src/api/validators/comment.ts`
**Responsibility:** Validate comment creation input including mentions
**Why needed:** The request body now optionally includes `mentions`
**Existing pattern reused:** Zod validation conventions (`.trim().min(1).max()`)

Changes:
- `createCommentSchema` gains optional `mentions: z.array(z.string().uuid()).optional().default([])`
- Maximum body length unchanged (5000 chars)

### 2.3 Update Comment Routes (`backend/src/api/routes/comments.ts`)

**File:** `backend/src/api/routes/comments.ts`
**Responsibility:** Pass mentions from request to comment service
**Why needed:** The route handler must forward `mentions` to `addComment`
**Existing pattern reused:** Existing `requireAuth` and validation pattern

Changes:
- Extract `mentions` from `parsed.data`
- Pass to `commentService.addComment(issueId, userId, body, mentionIds)`
- Response already includes the comment object; the service adds `mentions`

### 2.4 Wire into `backend/src/api/routes/index.ts`

- No changes needed to route registration
- `commentService` already has access to `db` and `membershipService`

## Phase 3: Frontend — Types & API Client

### 3.1 Update Shared Types (already done in `shared/index.ts`)

### 3.2 Update API Client (`frontend/src/api/client.ts`)

**File:** `frontend/src/api/client.ts`
**Responsibility:** No new methods needed; `post` already sends arbitrary body
**Why needed:** The `post` call already sends `{ body, mentions }`; no API shape changes
**Existing pattern reused:** Existing `api.post` pattern

Changes:
- None required at the client level (the `post` method sends JSON as-is)
- The `Comment` type in the frontend may need to be extended with `mentions` if not already covered by shared types

### 3.3 Update Comment Interface (`frontend/src/pages/IssuePage.tsx`)

**File:** `frontend/src/pages/IssuePage.tsx`
**Responsibility:** Extend local `Comment` interface with `mentions`
**Why needed:** The IssuePage renders comments and needs to know about mentions
**Existing pattern reused:** Local `Comment` interface already exists

Changes:
- Extend local `Comment` interface: add `mentions: Array<{ userId: string; name: string }>`

## Phase 4: Frontend — Mention Autocomplete Component

### 4.1 New Component: `frontend/src/components/MentionAutocomplete.tsx`

**File:** `frontend/src/components/MentionAutocomplete.tsx`
**Responsibility:** Render the suggestion dropdown when the user types `@`
**Why needed:** The autocomplete is a new interaction pattern that needs its own component
**Existing patterns reused:** `Field`, `Avatar` (for member display), `Badge` styling conventions
**Decision:** This is a new component because it introduces a combobox/listbox interaction that doesn't exist in the current component library. However, it uses existing primitives (Avatar, CSS tokens, focus rings).

Props:
- `members: Array<{ userId: string; name: string; email: string }>` — authorized workspace members
- `query: string` — current filter text after `@`
- `activeIndex: number` — currently highlighted suggestion
- `onSelect: (member: { userId: string; name: string }) => void`
- `onDismiss: () => void`
- `containerRef: React.RefObject<HTMLDivElement>` — for positioning

Behavior:
- Filter members by display name (case-insensitive substring match)
- Limit to 10 results
- Exact matches rank first, then alphabetical
- Render each suggestion with Avatar (small) + `@DisplayName`
- Highlight active item with `--color-accent-subtle` background
- Use `role="listbox"`, `role="option"`, `aria-selected`, `aria-activedescendant`
- Use `aria-expanded` on the associated textarea
- Announce result count via `role="status"` live region
- Empty state: "No matching members"
- 44px min touch targets on coarse pointers

### 4.2 CSS for Mention Autocomplete

**File:** `frontend/src/styles/components.css`
**Responsibility:** Style the autocomplete dropdown and mention spans
**Why needed:** The dropdown needs surface/border styling; mentions need inline styling
**Existing pattern reused:** `.dialog` for dropdown surface (minimal elevation), `.avatar--sm` for member avatars, `--color-accent` for mention text

New CSS classes:
- `.mention-autocomplete` — absolute positioned dropdown, `--color-surface` background, `--color-border` border, `--shadow-sm`
- `.mention-autocomplete-item` — listbox option, 44px min height, padding
- `.mention-autocomplete-item--active` — `--color-accent-subtle` background
- `.mention-autocomplete-item .mention-name` — `--color-accent`, `--font-weight-semibold`
- `.mention-autocomplete-item .mention-at` — `--color-text-faint`
- `.mention-autocomplete-empty` — `.empty-state` variant
- `.mention` — inline span: `--color-accent`, `--font-weight-semibold`, no background, no border, no pill

### 4.3 Integrate with IssuePage Composer

**File:** `frontend/src/pages/IssuePage.tsx`
**Responsibility:** Wire up the mention autocomplete to the comment composer
**Why needed:** The `@` trigger must open the autocomplete from the textarea
**Existing pattern reused:** Existing `useState` for `commentBody`, `useRef` for `commentTextareaRef`

Changes:
- Add state: `mentionMembers` (cached workspace members), `mentionQuery`, `mentionActiveIndex`, `mentionOpen`
- Add state: `mentionContainerRef` for positioning
- Load workspace members on mount (or lazy on first `@`)
- On textarea `input` event:
  - Detect if text before cursor ends with `@` + query
  - If so, open autocomplete with the query and filtered members
  - Otherwise, close autocomplete
- On keyboard event in textarea:
  - If autocomplete is open, consume ArrowDown/Up, Enter, Tab, Escape
  - Otherwise, let shortcuts handle it (existing `isTypingContext` guard)
- On select: insert `@Name` at cursor position, close autocomplete
- On dismiss (Escape): close autocomplete, return focus to textarea
- On form submit: include `mentions` array (extract from `@Name` patterns in body, or track selected members separately)

### 4.4 Track Selected Mentions

**Approach:** Maintain a set of selected `{ userId, name }` objects in component state. When the user types `@Name` and selects a member, add it to the set. When the form is submitted, send `mentions: [selectedUserId1, selectedUserId2, ...]`.

Actually, a simpler approach: parse the body text for `@Name` patterns and match against the loaded members. But this is fragile.

**Better approach:** Track selected mentions as a `Map<string, string>` (userId → name). When a member is selected, add to the map. When rendering the body, replace `@Name` with `@CurrentName` from the map. When submitting, send the map's keys as the `mentions` array.

Wait, even simpler: track selected members as an array of `{ userId, name }`. When submitting, filter comments by checking which user IDs appear in the body. Actually, the cleanest approach:

**Final approach:**
- Maintain `selectedMentions: Map<string, string>` (userId → name)
- When the user selects a member from the autocomplete, add them to the map
- When the textarea content changes, detect if a new `@Name` was typed and if it matches a known member, add it to the map
- Actually, just add to the map when the user selects from the autocomplete
- When submitting, send `mentions: Array.from(selectedMentions.keys())`
- When rendering, use the `mentions` array from the API response to know which names to highlight

Hmm, but the user might type `@Name` directly without selecting from autocomplete. In that case, we need to handle it gracefully:
- If the user types `@unknown` and submits, the body contains `@unknown` but `mentions` is empty
- The backend validates the `mentions` array, not the body text
- This is the correct approach per the spec

**Simplified approach for tracking:**
- `selectedMentions: string[]` (array of user IDs)
- When a member is selected from autocomplete, add their userId to the array (if not already present)
- When submitting, send `mentions: selectedMentions`
- When inserting `@Name` into the textarea, append the name to the body
- The `selectedMentions` array stays in sync because we only add on selection

Actually, there's a subtlety: if the user types `@Name` manually (without autocomplete), we shouldn't add it to `mentions`. The `mentions` array should only contain explicitly selected members. This means:

- The textarea contains the full text including `@Name` patterns
- The `mentions` array contains only user IDs of members selected from the autocomplete
- On form submit, send both `body` and `mentions`
- The backend validates that each user ID in `mentions` is valid

This is the cleanest approach. The `selectedMentions` state tracks user IDs of selected members.

## Phase 5: Frontend — Mention Rendering

### 5.1 Update Comment Rendering in `IssuePage.tsx`

**File:** `frontend/src/pages/IssuePage.tsx`
**Responsibility:** Render `@Name` mentions as styled spans
**Why needed:** Mentions need visual distinction in the comment body
**Existing pattern reused:** Comment body rendering at `.comment-body`

Changes:
- In the comment list render, replace `@Name` patterns with `<span className="mention">@Name</span>`
- Use the `mentions` array to know which names are mentions
- The mention name should come from the `mentions` array (current display name), not parsed from the body
- Actually, render the body as-is and highlight the `@Name` portions that match entries in the `mentions` array
- Use the name from the `mentions` array for the displayed text (to handle display name changes)

**Implementation approach:**
- For each comment, iterate through the `mentions` array
- For each mention, find `@${mention.name}` in the body and replace with `<span className="mention">@${mention.name}</span>`
- Use `dangerouslySetInnerHTML` or a safer text-parsing approach
- Better: split the body text into segments, replacing mention portions with styled spans

Actually, the safest approach is to render the body as text nodes and insert mention spans using React children. But this requires parsing the body text.

**Simplest safe approach:**
- Split the body by mention patterns
- Render segments as text or styled spans

### 5.2 CSS Mention Span

- `.mention` — `color: var(--color-accent); font-weight: var(--font-weight-semibold);`
- No background, no border, no border-radius, no shadow
- Inline display, inherits font from parent
- Hover: subtle warm surface tint via `--color-surface-hover`

## Phase 6: Backend Tests

### 6.1 Backend Unit Tests (`backend/tests/unit/comment-mentions.test.ts`)

- `addComment` with valid single mention → creates comment + mention record
- `addComment` with multiple valid mentions → creates all mention records
- `addComment` with duplicate mention IDs → deduplicates, creates one record
- `addComment` with invalid user ID → `422 VALIDATION`
- `addComment` with cross-workspace user ID → `422 VALIDATION`
- `addComment` with non-member user ID → `422 VALIDATION`
- `addComment` with self-mention → `422 VALIDATION`
- `addComment` without mentions → creates comment, no mention records
- `listComments` returns `mentions` array for each comment
- Transaction rollback on mention persistence failure

### 6.2 Backend Integration Tests (`backend/tests/integration/comment-mentions.test.ts`)

Create a new test file extending the existing `comments.test.ts` pattern:

- Valid mention persistence
- Multiple mentions
- Duplicate mention handling
- Invalid user ID rejection
- Cross-workspace mention rejection
- Non-member rejection
- Unauthorized issue access
- Comment + mention atomicity
- Historical mentions after member removal (cascade behavior)
- Malformed mention payloads
- Comment listing includes mentions array
- Backward compatibility (comments without mentions)

## Phase 7: Frontend Tests

### 7.1 Component Tests (`frontend/tests/component/mention-autocomplete.test.tsx`)

- Typing `@` opens the suggestion list
- Suggestion list filters as the user types
- Selecting with keyboard (ArrowUp/ArrowDown, Enter, Tab)
- Selecting with mouse/touch
- Escape dismisses the suggestion list
- Multiple mentions in one comment
- No-results state ("No matching members")
- Punctuation handling
- Comment submission includes mentions array
- Rendered mention styling

### 7.2 Accessibility Tests (`frontend/tests/accessibility/mention-autocomplete.test.tsx`)

- axe audit of the mention autocomplete
- Keyboard-only operation
- Appropriate combobox/listbox semantics
- Focus preserved on textarea
- Screen-reader-friendly state
- 44px touch targets on coarse pointers

### 7.3 Keyboard Coexistence Tests

- Typing `/` inside the composer does not open search
- Ctrl/Cmd+K inside the composer does not open search
- `e`, `d`, `c` shortcuts do not fire while using autocomplete
- Arrow keys inside autocomplete navigate suggestions; Arrow keys outside navigate normally
- Enter inside autocomplete selects; Enter outside submits form
- Escape inside autocomplete dismisses list; Escape outside closes dialogs

## Phase 8: Regression Testing

### 8.1 Commands to Run

```bash
# Backend
cd backend && npm run test
npm run typecheck
npm run lint
npm run build

# Frontend
cd frontend && npm run test
npm run typecheck
npm run lint
npm run build

# Full stack
npm run db:migrate
npm run dev
```

### 8.2 Manual Smoke Test Checklist

- [ ] Type `@` in comment composer → suggestion list appears
- [ ] Type query → suggestions filter
- [ ] Select with keyboard → mention inserted
- [ ] Select with mouse → mention inserted
- [ ] Escape → list dismisses
- [ ] Submit comment → mention recorded and displayed
- [ ] Mention renders in petrol semibold
- [ ] Invalid mention → 422 error
- [ ] Cross-workspace mention → 422 error
- [ ] `/` shortcut still works from page body
- [ ] `e`, `d`, `c` shortcuts still work
- [ ] axe audit passes
- [ ] Mobile layout works correctly

## Phase 9: Documentation Update

- Update `frontend/VISUAL_LANGUAGE.md` if new visual patterns are introduced (mention styling, autocomplete list)
- Update `VISUAL_LANGUAGE.md` §25 Comments to mention mention support
- Add a section on mention autocomplete in the visual language if it constitutes a new reusable pattern

## File Summary

**New files:**
- `backend/src/db/migrations/0007_comment_mentions.sql`
- `backend/tests/integration/comment-mentions.test.ts`
- `backend/tests/unit/comment-mentions.test.ts`
- `frontend/src/components/MentionAutocomplete.tsx`
- `frontend/tests/component/mention-autocomplete.test.tsx`
- `frontend/tests/accessibility/mention-autocomplete.test.tsx`

**Modified files:**
- `backend/src/db/schema.ts` — add `commentMentions` table and relations
- `backend/src/services/comment.ts` — add mention validation and atomic writes
- `backend/src/api/validators/comment.ts` — add `mentions` field
- `backend/src/api/routes/comments.ts` — pass mentions to service
- `backend/src/api/routes/index.ts` — no changes needed
- `shared/index.ts` — add `CommentMention`, `CommentWithMentions` types
- `frontend/src/pages/IssuePage.tsx` — add mention autocomplete integration and rendering
- `frontend/src/api/client.ts` — no changes needed
- `frontend/src/styles/components.css` — add `.mention`, `.mention-autocomplete-*` styles
- `frontend/VISUAL_LANGUAGE.md` — document new mention patterns if introduced

## Dependencies

- No new dependencies
- Reuses existing: `db.transaction()`, `membershipService.listMembers`, `resolveDisplayName`, `Avatar`, `Field`, `useKeyboardShortcuts`, `isTypingContext`

## Migration Strategy

1. Migration `0007_comment_mentions.sql` creates the `comment_mentions` table.
2. The migration is backward-compatible: existing comments have no mentions (the `mentions` array defaults to empty).
3. No data migration is needed.
4. The migration applies automatically via `runMigrations` on app startup.
5. Rollback: drop the `comment_mentions` table (no data loss since comments are unaffected).

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Mention autocomplete conflicts with global shortcuts | Use existing `isTypingContext` guard; consume keys when autocomplete is open |
| `dangerouslySetInnerHTML` for mention rendering introduces XSS | Parse and sanitize mention names; use React children approach instead of raw HTML |
| Mobile autocomplete keyboard overlap | Position list above keyboard; use `getBoundingClientRect` for viewport-aware positioning |
| Display name changes create visual disconnect | Document behavior; body text preserved; `mentions` array provides current name |
| Adding `comment_mentions` table increases schema complexity | One simple table; benefits outweigh costs; atomic writes reuse existing patterns |
| Screen reader complexity with combobox pattern | Follow WAI-ARIA listbox variant; test with actual screen readers |
| Touch target sizes on mobile | Enforce 44px min on suggestion items per coarse-pointer rule |
| Performance with large member lists | Client-side filtering on small lists; max 10 suggestions |

## Exit Criteria

- [ ] All backend tests pass
- [ ] All frontend tests pass
- [ ] All accessibility tests pass (axe audits)
- [ ] Typecheck passes (backend + frontend)
- [ ] Lint passes (backend + frontend)
- [ ] Production build succeeds
- [ ] Manual smoke test checklist completed
- [ ] No new dependencies introduced
- [ ] `frontend/VISUAL_LANGUAGE.md` updated if new visual patterns introduced
- [ ] Specification (`specs/010-mentions/spec.md`) complete
- [ ] Plan (`specs/010-mentions/plan.md`) complete
