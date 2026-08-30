# Spec 010 — Mentions

## 1. Summary

Allow workspace members to mention other workspace members inside issue comments using `@DisplayName`. Mentions are visually distinguished within comment text and are backed by structured mention records stored alongside comments. The feature stays within the Comments system: no notifications, no threads, no user profiles, no social features.

Mentions reinforce collaboration, clarity, and accountability inside issue discussions without turning Mini Issue Tracker into a chat or social platform.

## 2. Motivation

- Collaboration: users can direct attention to specific teammates inside comments
- Clarity: `@Name` makes it explicit who is being addressed or assigned a task
- Accountability: a mention creates a persistent, auditable reference to a user inside a comment
- Lightweight: the feature lives entirely within the existing comment flow, requiring no new navigation, no new UI surfaces, and no new notification infrastructure

## 3. Scope (Stage 1)

**In scope:**
- Mention syntax `@DisplayName` in comment body
- Autocomplete/dropdown when typing `@` in the comment composer
- Server-side validation of mentioned users against workspace membership
- Structured `comment_mentions` records linked to comments
- Visual distinction of mentions in rendered comments (petrol text emphasis)
- Accessible combobox autocomplete pattern
- Atomic comment + mention persistence via existing `db.transaction()` pattern

**Out of scope (explicitly deferred):**
- Notifications (notification table, center, email, browser, push)
- Direct messages, threads, or any conversation features
- User profile pages or user popovers
- `@everyone` or `@here`
- Organization-wide or cross-workspace mentions
- Comment editing or deletion (comments are append-only)
- Activity History events for mentions
- Global Search indexing of mention text
- Reactions
- Customizable mention syntax
- Rich text editor; the composer remains a `<textarea>`
- Admin/user management UI for mentions

## 4. Mention Syntax

A mention is the `@` character immediately followed by a workspace member's **display name**.

```
@Ramez Khaled
```

### 4.1 Identifier

- The **display name** (`users.name`) is the visible identifier.
- The **user ID** (`users.id`) is the internal identifier stored in `comment_mentions`.
- The email is never used as a mention target.
- The user ID is never exposed in the `@...` syntax.

### 4.2 Matching rules

- Matching is **case-insensitive** (ASCII).
- Matching supports **prefix** and **substring** matching against the display name.
- Minimum query length to open suggestions: **1 character** after `@`.
- The `@` must be preceded by whitespace or be at the start of the comment (or immediately after another `@mention`).
- Punctuation immediately after a mention (periods, commas, etc.) is treated as non-part of the mention name.

### 4.3 Maximum mention length

A single mention name is capped at **100 characters** (matching the existing display name maximum).

## 5. Data Model

### 5.1 Existing comment model (unchanged)

The `comments` table stores plain text in the `body` column. The body contains the literal `@DisplayName` text. No changes to the `comments` table or `comments` domain entity.

### 5.2 New `comment_mentions` table

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

**Rationale for structured records (Option B):**

- Display names can change over time; storing the user ID preserves the semantic target independently of the display name.
- Future notification support becomes possible without further schema changes.
- Server-side validation can verify mention targets against workspace membership at write time.
- The `ON DELETE CASCADE` on `commentId` preserves the existing comment cascade pattern.
- The `ON DELETE CASCADE` on `mentionedUserId` means if a user is deleted, their mention records are removed — historical comment text remains intact, and the `@Name` text in the body stays as-is (see §10 on deleted/inaccessible members).

### 5.3 Shared types

Add to `shared/index.ts`:

```typescript
export interface CommentMention {
  commentId: string;
  mentionedUserId: string;
  mentionedByName: string;
}

export interface CommentWithMentions extends Comment {
  mentions: CommentMention[];
}
```

The existing `Comment` shape remains unchanged. Mentions are additive.

## 6. API Requirements

### 6.1 Create comment with mentions — `POST /api/issues/:issueId/comments`

**Request body:**

```typescript
{
  body: string,        // max 5000 chars, unchanged
  mentions?: string[]  // array of user IDs being mentioned; optional
}
```

**Validation:**

- `body` must contain `@Name` patterns corresponding to the `mentions` array, or `mentions` must be empty/omitted.
- Every user ID in `mentions` must be a member of the issue's workspace.
- The author must have access to the issue (existing `requireIssueAccess`).
- Duplicate mention IDs in the request must be deduplicated server-side.
- Unknown or non-member user IDs must be rejected with `422 VALIDATION`.
- The `mentions` array must not contain the author's own user ID (no self-mention).

**Response:** `201` with the comment including a new `mentions` array:

```typescript
{
  comment: {
    id: string,
    issueId: string,
    authorId: string,
    author: { id: string; name: string },
    body: string,
    createdAt: string,
    mentions: Array<{ userId: string; name: string }>
  }
}
```

**Authorization:**

- The backend validates every mentioned user ID against the issue's workspace membership.
- The frontend suggestion list is a convenience only; the backend is authoritative.
- A client cannot submit arbitrary user IDs and have them persisted.

### 6.2 List comments — `GET /api/issues/:issueId/comments`

**Response shape changes:** Each comment now includes a `mentions` array:

```typescript
{
  items: Array<{
    ...existing Comment fields,
    mentions: Array<{ userId: string; name: string }>
  }>
}
```

**No new endpoint.** Mentions are returned as part of the existing comment list response.

### 6.3 No new API endpoint required for autocomplete

Workspace members are already available via `GET /workspaces/:id/members`. The frontend loads members once per issue/workspace and filters client-side as the user types. A dedicated member-search endpoint is **not** required for v1.

## 7. Authorization / Security

### 7.1 Server-side validation (non-negotiable)

When creating a comment containing mentions:

1. The author must be authenticated (existing session auth).
2. The author must have access to the issue (existing `requireIssueAccess`).
3. Every mentioned user ID must be verified as a member of the issue's workspace.
4. The author must not mention themselves.
5. Duplicate mention IDs must be deduplicated.

### 7.2 No information leakage

- A user cannot discover whether a user exists in another workspace by submitting fake IDs (rejected with generic `422`).
- The suggestion list only shows members of the current issue's workspace (reuse `listMembers`).
- Members from other workspaces are never exposed.

### 7.3 Transactional atomicity

Comment creation and mention persistence must be atomic using the existing `db.transaction()` pattern (as used in `issueService.createIssue` and `issueService.updateIssue`):

```typescript
db.transaction(() => {
  const comment = createCommentRecord(issueId, authorId, body);
  db.insert(comments).values(comment).run();
  for (const userId of validMentionIds) {
    db.insert(commentMentions).values({ commentId: comment.id, mentionedUserId: userId, createdAt: new Date() }).run();
  }
  return { comment, mentions };
});
```

If mention persistence fails, the entire comment creation rolls back. No partial mention state is created.

## 8. UX / UI Requirements

### 8.1 Autocomplete trigger

When the user types `@` in the comment composer textarea, a suggestion list appears below the textarea showing matching workspace members.

### 8.2 Suggestion list behavior

- Suggestions are filtered from the workspace member list loaded by `GET /workspaces/:id/members`.
- Filtering is case-insensitive substring matching against the member's display name.
- Maximum suggestions shown: **10**.
- Exact-name matches rank first, then alphabetical by name.
- Deterministic ordering.
- No results: show "No matching members" (honest empty state, no fabricated suggestions).

### 8.3 Selection

The user can:

- **ArrowDown / ArrowUp** to move through suggestions.
- **Enter** or **Tab** to select the highlighted suggestion.
- **Escape** to dismiss the suggestion list.
- **Click** a suggestion to select it.

After selection, the `@DisplayName` text is inserted into the textarea.

### 8.4 Multiple mentions

- Multiple `@mentions` in a single comment are supported.
- Each `@` triggers a new independent autocomplete.
- Duplicate mentions of the same user are allowed in the body but deduplicated server-side.

### 8.5 Coexistence with existing keyboard shortcuts

The mention autocomplete must coexist with:

- `/` — Global Search (already guarded by `isTypingContext`).
- `Ctrl/Cmd+K` — Global Search.
- `/` — Shortcuts dialog.
- `e` — Edit issue.
- `d` — Delete issue confirmation.
- `c` — Focus comment composer.
- ArrowUp / ArrowDown inside the autocomplete.
- Enter inside the autocomplete.
- Escape inside the autocomplete.

**Key rule:** When the suggestion list is open, `ArrowUp`, `ArrowDown`, `Enter`, and `Escape` are consumed by the autocomplete. When the suggestion list is closed, these keys behave normally (or are handled by the shortcut system with the existing `isTypingContext` guard).

Typing inside the comment composer must not trigger unrelated global shortcuts. The existing `isTypingContext` guard in `shortcuts.ts` already prevents shortcuts from firing in input/textarea/select/contenteditable contexts.

### 8.6 Comment submission

The comment is submitted with its body (containing `@DisplayName` text) and the array of mentioned user IDs. The `Add comment` button remains the primary submit action.

## 9. Comment Rendering

### 9.1 Visual treatment

Mentions in rendered comments use a **restrained, editorial treatment** consistent with the visual language:

- `@DisplayName` text rendered in **petrol** (`--color-accent`) and **semibold** (`--font-weight-semibold`).
- No background color, no pill shape, no border, no shadow.
- The mention sits inline within the comment body text, like a styled word.
- Hover state: subtle warm surface tint (existing `--color-surface-hover`).

### 9.2 Example

Comment body: `@Ramez can you take a look at the API?`

Rendered as: `@Ramez can you take a look at the API?` where `@Ramez` appears in petrol semibold inline with the surrounding text.

### 9.3 Do NOT use

- No colorful mention bubbles or chips.
- No social-media-style pills, badges, or chips.
- No gradients, shadows, or floating containers around mentions.
- No avatar next to the mention in the comment body.

### 9.4 Mention rendering approach

The comment body is plain text. The frontend receives the body and the `mentions` array. The frontend replaces each `@DisplayName` occurrence in the body with a `<span>` element styled with the mention classes. Text nodes outside mentions remain plain text.

## 10. Editing Comments

Comments are **append-only** in the current application. There is no comment editing functionality. Therefore:

- Mentions do not need to support editing.
- If comments are ever made editable in the future, mention records would need to be re-validated against the updated body. This is out of scope for v1.

## 11. Deleted / Removed Members

### 11.1 Display name changes

If a mentioned user changes their display name:

- The `@DisplayName` text in the comment body **is not rewritten**.
- The `comment_mentions` record remains valid (linked by user ID).
- On read, the current display name is resolved from the `comment_mentions` record and shown as the mention text.

Wait — actually, the body text contains the original `@OldName`. For consistency with the existing pattern (where comment bodies are immutable text), the body text stays as-is. However, the `mentions` array returned by the API provides the **current** display name.

**Decision:** The API returns the current display name in the `mentions` array. The frontend renders the mention using the current name from the `mentions` array, not the text embedded in the body. This means if `@OldName` appears in the body, the frontend will render it as `@CurrentName` based on the `mentions` metadata.

Actually, this creates a disconnect between body text and rendering. Let me reconsider.

**Revised decision:** The comment body stores the original `@DisplayName` text as written. The `comment_mentions` table stores the user ID. When rendering, the frontend uses the `mentions` array to know which user IDs are mentioned, and renders the **current display name** from the `mentions` array. The original body text is not parsed for rendering — the `mentions` array is the source of truth for which words are mentions.

Wait, this means the body text and the rendered mention names could diverge. That's confusing.

**Final decision:** The body text stores the original `@DisplayName`. The `mentions` array provides `{ userId, name }` where `name` is the display name **at the time the mention was created** (or the current name). The frontend renders the mention using the name from the `mentions` array. If the name changed, the rendered name reflects the current name, while the body text remains as originally typed. This is acceptable because the mention is a reference, not a static label.

Actually, the simplest and most honest approach: **The body text is the source of truth.** The `mentions` array is metadata. The frontend renders the body text as-is, and styles the `@Name` portions that match entries in the `mentions` array. If the name changed, the body still shows `@OldName`, but it is styled as a mention because the `mentions` array confirms it.

**Final final decision:** Keep it simple. The body text is rendered as-is. The `mentions` array provides the user IDs so the frontend knows which `@Name` spans to style as mentions. If the display name changed, the body text still shows `@OldName` but it is still styled as a mention. This preserves historical accuracy (the comment says exactly what was typed) and avoids any rewriting of comment content.

### 11.2 User leaves workspace or is removed

- The `comment_mentions` record uses `ON DELETE CASCADE` on `mentionedUserId`.
- If a user is deleted from the system, their mention records are cascade-deleted.
- The comment body text remains unchanged (historical accuracy).
- The mention in the rendered comment appears as plain `@Name` text without mention styling (because there is no longer a matching mention record). This gracefully degrades to plain text.

If a user leaves a workspace but their account remains:

- The `comment_mentions` record remains (user ID still exists).
- The mention is still styled because the user still exists.
- The mention now references a non-member, which is acceptable for historical comments.

## 12. Activity History

**Mentions do NOT create Activity History events.**

Creating a mention inside a comment is part of the comment content. Activity History represents issue state changes (status, priority, assignee, etc.), not conversational details. Adding "Ramez mentioned Ahmed" to the activity stream would clutter the audit trail with conversational noise.

This is consistent with the existing Activity History scope (Spec 006), which explicitly excludes "Activity on comments (create/edit/delete)."

## 13. Global Search

**Mentions do NOT affect Global Search.**

Comment text remains outside Global Search v1 (Spec 008). Mentions therefore do not need to be searchable. This is explicitly documented and deferred.

## 14. Performance

### 14.1 Client-side filtering

- The authorized workspace member list is loaded once (via existing `GET /workspaces/:id/members`).
- Filtering happens client-side as the user types.
- No dedicated API endpoint is needed.
- No N+1 queries (members are loaded in a single query).

### 14.2 Maximum suggestion count

- Maximum **10 suggestions** displayed at a time.
- The workspace member list is expected to be small (tens of members, not thousands).
- Client-side filtering is instantaneous for this scale.

### 14.3 Load once per workspace

- Members are fetched once when the IssuePage loads (reuse existing member loading or fetch on first `@`).
- The member list is cached in component state for the lifetime of the page.

## 15. Responsive Behavior

- The suggestion list must remain within viewport bounds.
- On mobile (≤700px), the suggestion list appears below the textarea, spanning the full width.
- On narrow screens (≤375px), the suggestion list items must have ≥44px touch targets.
- No horizontal overflow from the suggestion list.
- The suggestion list must not cover the `Add comment` button or other important controls.
- The suggestion list should be positioned so it is usable near the bottom of the viewport.

## 16. Accessibility Requirements

### 16.1 Combobox / autocomplete semantics

The mention autocomplete follows the WAI-ARIA combobox pattern (listbox variant):

- The textarea has `aria-controls` pointing to the suggestion list.
- The suggestion list has `role="listbox"`.
- Each suggestion has `role="option"`.
- The active/highlighted option has `aria-selected="true"`.
- `aria-expanded` on the textarea or a wrapper reflects whether the list is open.
- A live region (`role="status"`, `aria-live="polite"`) announces result counts to screen readers.

### 16.2 Focus management

- The textarea remains the primary focus target at all times.
- The suggestion list does **not** trap focus.
- Focus stays on the textarea even when the list is open; the list uses `aria-activedescendant` to indicate the active option.
- **Important:** The suggestion list must not break the dialog focus trap if the comment composer is inside a dialog (it is not, but this must be verified).
- Escape dismisses the list and returns focus to the textarea.

### 16.3 Keyboard navigation

- `ArrowDown` / `ArrowUp` move the active option in the listbox.
- `Enter` or `Tab` selects the active option.
- `Escape` dismisses the list.
- These keys do not bubble to the global shortcut system while the list is open.

### 16.4 Screen reader announcements

- When suggestions appear, announce the count (e.g., "3 suggestions").
- When navigating, announce the current option and total count.
- When no results, announce "No matching members."

### 16.5 Touch targets

- Suggestion items must have ≥44px coarse-pointer targets.
- The textarea itself retains its existing 44px min-height on coarse pointers.

### 16.6 Existing accessibility guarantees

- Skip-link, focus-visible, reduced-motion, and axe tests must remain unaffected.
- The comment composer's existing `Field` + `textarea` anatomy is preserved.
- No new axe violations are introduced.

## 17. Visual Language Requirements

### 17.1 Mention styling

Follows the existing visual language (§25 Comments, §6 Brand Color — Petrol):

- Mention text: `--color-accent` (petrol), `--font-weight-semibold`.
- No new colors, radii, shadows, or spacing values.
- The mention treatment is inline typography, not a component container.
- It reads as editorial emphasis, not a social chip.

### 17.2 Suggestion list styling

- The suggestion list is positioned absolutely below the textarea.
- It uses the existing surface and border tokens: `--color-surface`, `--color-border`, `--shadow-sm` (minimal elevation for the dropdown).
- Suggestion items use `--text-body` for the name, with the `@` prefix in `--color-text-faint`.
- Hover/active states use `--color-surface-hover`.
- The list closes with a hairline top border if it appears above the textarea boundary (or below, depending on viewport).

### 17.3 Keyboard state

- The highlighted suggestion uses `--color-accent-subtle` background.
- The `@` prefix in the highlighted suggestion may use `--color-accent`.

### 17.4 When NOT to reuse

- This pattern is specific to mention autocomplete.
- Do NOT reuse it for other dropdowns, search results, or lists unless they follow the same combobox/listbox semantics.
- The existing SearchDialog overlay pattern (Spec 008) is a different interaction and must not be confused with the mention autocomplete.

## 18. Non-Functional Requirements

- **NFR-001:** The feature MUST NOT degrade existing comment creation or listing performance.
- **NFR-002:** Mention autocomplete filtering MUST feel instantaneous (client-side on a small member list).
- **NFR-003:** The database migration MUST apply automatically with no manual step.
- **NFR-004:** The feature MUST preserve existing accessibility guarantees on all touched surfaces.
- **NFR-005:** No new dependencies are introduced.
- **NFR-006:** The feature MUST work on desktop, tablet, and mobile.

## 19. Error / Edge Cases

### 19.1 Invalid mention targets

- If a client submits a user ID that is not a workspace member, the request returns `422 VALIDATION` with a field-level error on `mentions`.
- The error message must not reveal whether the user exists in the system (use a generic message like "One or more mentions are invalid").
- The comment is not created if any mention is invalid.

### 19.2 Self-mention

- A user cannot mention themselves. The backend rejects self-mentions with `422 VALIDATION`.

### 19.3 Duplicate mentions

- The server deduplicates mention IDs. If the same user ID appears multiple times in the request, it is stored once in `comment_mentions`.

### 19.4 Typing `@` but not selecting anyone

- If the user types `@` but dismisses the list (Escape) or continues typing without selecting, no mention is created.
- The `@` character remains in the comment body as plain text.

### 19.5 Multiple mentions

- Each `@Name` in the comment body can reference a different user.
- The `mentions` array in the request can contain multiple user IDs.
- Each unique user ID creates exactly one `comment_mentions` record per comment.

### 19.6 Punctuation after mentions

- `@Ramez.` — the period is not part of the mention name.
- `@Ramez, can you...` — the comma is not part of the mention name.
- The server validates that the `mentions` array contains user IDs, and the body text is accepted as-is.

### 19.7 Unknown `@name`

- If a user types `@unknownname` and does not select from suggestions, it is submitted as plain text.
- The backend does not validate text that does not correspond to a submitted `mentions` array entry.
- Only explicitly submitted mention user IDs are validated.

### 19.8 No matching members

- The suggestion list shows "No matching members" when the query matches no workspace members.
- The user can still type arbitrary text after `@`.

### 19.9 Comment body limits

- The existing 5000-character limit applies to the comment body, including mention text.

## 20. Testing Requirements

### 20.1 Backend

- Valid mention persistence (single mention).
- Multiple mentions in one comment.
- Duplicate mention handling (deduplication).
- Invalid user ID rejection (422).
- Cross-workspace mention rejection (user from another workspace).
- Non-member rejection.
- Unauthorized issue access (403).
- Comment + mention atomicity (mention failure rolls back comment).
- Self-mention rejection.
- Historical mentions after member removal (cascade behavior).
- Malformed mention payloads (malformed IDs, empty array).
- Comment listing includes mentions array.
- Legacy comment without mentions renders correctly (backward-compatible `mentions` field defaulting to empty array).

### 20.2 Frontend

- Typing `@` opens the suggestion list.
- Suggestion list filters as the user types.
- Selecting with keyboard (ArrowUp/ArrowDown, Enter, Tab).
- Selecting with mouse/touch.
- Escape dismisses the suggestion list.
- Multiple mentions in one comment.
- No-results state ("No matching members").
- Punctuation handling (mention boundary detection).
- Comment submission includes mentions array.
- Rendered mention styling (petrol, semibold, inline).
- Mention list is accessible (axe-clean).

### 20.3 Keyboard coexistence

- Typing `/` inside the composer does not open search.
- Ctrl/Cmd+K inside the composer does not open search.
- `e`, `d`, `c` shortcuts do not fire while typing in the composer.
- Arrow keys inside the autocomplete navigate suggestions; Arrow keys outside navigate normally.
- Enter inside the autocomplete selects; Enter outside submits the form or activates the shortcut.
- Escape inside the autocomplete dismisses the list; Escape outside closes dialogs.

### 20.4 Accessibility

- axe audit extended to the mention autocomplete.
- Keyboard-only operation verified.
- Appropriate combobox/listbox semantics.
- Focus preserved on the textarea.
- Screen-reader-friendly state announcements.
- 44px touch targets on coarse pointers.

### 20.5 Regression

- Backend tests pass.
- Frontend tests pass.
- Accessibility tests pass.
- Typecheck passes.
- Lint passes.
- Production build passes.

## 21. Acceptance Scenarios

1. A member types `@Ra` in the comment composer → suggestion list shows matching workspace members.
2. The member selects a member with ArrowDown + Enter → `@Ramez Khaled` is inserted into the textarea.
3. The member submits the comment → the comment is created with the mention record.
4. Another member opens the issue → the comment shows `@Ramez Khaled` styled in petrol semibold.
5. A member types `@unknown` and submits → the comment is created with `@unknown` as plain text (no mention record).
6. A member tries to mention a user from another workspace → `422 VALIDATION` error.
7. A member types `@` and presses Escape → no suggestion, no mention created.
8. A member creates a comment with multiple `@mentions` → all valid mentions are recorded.
9. A mentioned user changes their display name → the mention still appears (using current name).
10. The mention autocomplete is accessible and works with screen readers.
11. Existing comments without mentions render correctly with an empty `mentions` array.
12. Typing shortcuts (`/`, `Ctrl+K`, `e`, `d`, `c`) are not triggered while using the mention autocomplete.

## 22. Success Criteria

- **SC-001:** A member can mention another workspace member by typing `@` and selecting from suggestions.
- **SC-002:** Mentions are validated server-side against workspace membership.
- **SC-003:** Comment creation and mention persistence are atomic.
- **SC-004:** Mentions are visually distinguished in rendered comments using the editorial visual language.
- **SC-005:** The mention autocomplete is keyboard-navigable and accessible.
- **SC-006:** All existing tests continue to pass.
- **SC-007:** No new dependencies are introduced.
- **SC-008:** The feature works on desktop, tablet, and mobile.

## 23. Explicit Decisions

| Decision | Reason | Alternatives Considered |
|---|---|---|
| **Structured mention records (Option B)** | Display name robustness, future notification support, data integrity via foreign keys, atomic writes with existing transaction pattern | Option A (plain text only) — simpler but breaks on name changes and cannot support future notifications; Option C (structured markup in body) — requires parsing HTML-like syntax in a textarea |
| **Display name as visible identifier** | The display name is already the established identity primitive (Spec 003); no new username field needed | Could add a dedicated username/handle — explicitly rejected per Spec 003 non-goals |
| **Client-side filtering for autocomplete** | Workspace member lists are small; no dedicated endpoint needed; instant filtering | Dedicated API endpoint — unnecessary for this scale |
| **No Activity History events** | Mentions are conversational, not state changes; consistent with Spec 006 excluding comment activity | Could add mention activity events — would clutter audit trail |
| **No Global Search integration** | Comment text stays outside search v1; consistent with Spec 008 scope | Could index mentions — out of scope |
| **Mentions not clickable** | No user profile/popover system exists; adding one would be a new feature | Could make mentions navigable — requires a profile destination |
| **Comments are append-only** | No comment editing exists; mentions don't need editing support | Could add comment editing — separate feature |
| **Mentions use display name, not user ID** | Display names are human-readable and already used throughout the app | Could use @user-id format — less user-friendly |
| **Mention validation on the backend** | Frontend autocomplete is a convenience; backend is authoritative | Client-side only — security risk |
| **ON DELETE CASCADE for mentionedUserId** | Historical accuracy is preserved via body text; cascade removes orphan records | Could keep records as unresolved — unnecessary complexity |
| **Self-mentions rejected** | A user mentioning themselves provides no value and could be confusing | Allow self-mentions — no practical benefit |

## 24. Open Questions

- **OQ-01:** Should the suggestion list load members eagerly when the IssuePage mounts, or lazily on first `@`? **Recommendation:** Load on first `@` to avoid unnecessary requests, but cache for the page lifetime.
- **OQ-02:** Should the mention name in the body match the display name exactly, or should there be a normalization step? **Recommendation:** The body stores whatever the user types; the `mentions` array maps user IDs to names. The frontend renders names from the `mentions` array.
- **OQ-03:** What happens if `mentions` array in the request does not match `@Name` patterns in the body? **Recommendation:** The backend validates that every user ID in `mentions` is valid, but does not strictly enforce a 1:1 text-to-record correspondence. The body is accepted as text; the `mentions` array drives the structured records and rendering.
- **OQ-04:** Should mention rendering use the name from the `mentions` array or parse it from the body? **Recommendation:** Use the name from the `mentions` array to handle display name changes gracefully.

## 25. Out of Scope

- Notifications of any kind.
- Notification center, email, browser, or push notifications.
- Direct messages, threads, or chat features.
- `@everyone`, `@here`, or organization-wide mentions.
- Cross-workspace mentions.
- User profiles or user popovers.
- Reactions.
- Comment editing or deletion.
- Activity History events for mentions.
- Global Search indexing of mentions.
- Rich text editor.
- Customizable mention syntax (e.g., `@userId` or `#name`).
- Social features (bios, follower counts, status messages).
- Admin/user management UI for mentions.
- Mention analytics or reporting.

## 26. Risks

| Risk | Mitigation |
|---|---|
| Display name changes cause visual disconnect between body text and rendered mention name | The `mentions` array provides the current name; body text is preserved as-is for historical accuracy. Document this behavior clearly. |
| Mention autocomplete conflicts with global shortcuts | Rely on existing `isTypingContext` guard; add explicit handling when autocomplete is open to consume ArrowUp/Down/Enter/Escape. |
| Adding `comment_mentions` table increases schema complexity | One simple table with two foreign keys; the benefit of data integrity outweighs the cost. |
| Transactional writes add complexity to `commentService` | Reuse the existing `db.transaction()` pattern from `issueService`. |
| Mobile autocomplete usability (viewport keyboard overlap) | Position the list above the keyboard when near the bottom; ensure 44px touch targets. |
| Screen reader complexity with combobox pattern | Follow the WAI-ARIA listbox variant pattern; test with actual screen readers; use `aria-activedescendant` to keep focus on textarea. |

## 27. Proposed v1 Scope

The v1 implementation includes:

1. `comment_mentions` database table + migration.
2. `CommentMention` shared type.
3. Updated `commentService.addComment` with atomic comment + mention writes.
4. Updated `commentService.listComments` to return `mentions` array.
5. Updated comment validators to accept optional `mentions: string[]`.
6. Backend validation of mention targets against workspace membership.
7. Frontend mention autocomplete component (combobox pattern).
8. Frontend mention rendering (petrol semibold inline spans).
9. Accessibility audit of the autocomplete.
10. Tests (backend + frontend + accessibility).

Not included in v1:
- Notifications.
- Activity History events.
- Global Search integration.
- Clickable mentions / user profiles.
- Comment editing.
- Any rich text editor features.

## 28. Deferred / Rejected Ideas

- **Option A (plain text only):** Rejected because display name changes would break mention semantics and future notifications would require retroactive schema changes.
- **Option C (markup in body):** Rejected because introducing structured markup inside a textarea is complex and fragile.
- **Mention notifications:** Deferred to a future feature. The architecture (structured `comment_mentions` records) supports future notification queries.
- **Clickable mentions:** Deferred because no user profile/popover system exists. Adding one would be a separate feature.
- **Activity History for mentions:** Deferred because mentions are conversational, not state changes.
- **Global Search for mentions:** Deferred because comment text stays outside search v1.
- **Username/handle system:** Rejected per Spec 003 non-goals. Display names are the established identity primitive.
- **`@everyone` / `@here`:** Rejected as a feature not requested and inconsistent with the lightweight collaboration goal.
- **Rich text editor:** Rejected because the existing textarea is sufficient and the project values simplicity.

## 29. Specification File Reference

This specification follows the structure and terminology established by:

- Spec 006 (Activity History) — for activity decisions and testing structure.
- Spec 008 (Global Search) — for search/authorization patterns and keyboard shortcut coexistence.
- Spec 003 (User Display Name) — for identity model and display name conventions.
- Spec 010 (Quick Edit) — for visual language compliance and component reuse patterns.
- `frontend/VISUAL_LANGUAGE.md` — for all visual design decisions.
