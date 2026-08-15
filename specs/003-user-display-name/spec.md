# Feature Specification: User Display Name — Mini Issue Tracker

**Feature Branch**: `003-user-display-name`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "Add a user display name/profile identity to Mini
Issue Tracker so users can be identified by name throughout the application,
especially when shown as issue assignees and comment authors. Signup asks for a
full name (plus email, password, confirm password); the name is persisted on the
user and returned in safe user representations. Initials are derived from the
name for a small avatar. No profile photo, no username/handle, no public profile."

**Relationship to prior features**: Feature 001 built the MVP and feature 002 was
a presentation-only redesign. This feature intentionally changes the database
schema, backend, shared types, frontend, and tests. It is not presentation-only.

## Feature Overview

Today a user account has only an email address. Everywhere the app shows "who"
someone is — the header, issue assignees, and comment authors — it shows either
the raw email or the raw user id (UUID). This makes collaboration surfaces
ambiguous and unprofessional: assignees and comment authors appear as opaque ids
instead of recognizable people.

This feature adds a single persistent **display name** to each user account. The
name is captured at signup, stored on the user record, and returned in safe user
representations. It is a single reusable user-identity primitive shown wherever a
person is referenced: application header, issue assignee picker, issue list,
issue detail, comment authors, workspace/member listings, and initials avatars.
No profile photo, no avatar upload, no username/handle system, no public profile,
and no presence/online-status features are introduced.

The account's unique identity and sign-in credential remain the email address;
the name is display information only and does not affect authentication,
authorization, or any existing business rule.

## Current-State Findings

The following reflects the actual codebase inspected for this feature.

### What user data exists today

- `backend/src/db/schema.ts` — `users` table columns: `id`, `email`
  (`notNull`, unique index), `passwordHash` (`notNull`), `createdAt`,
  `updatedAt`. No name/display field exists.
- `backend/src/domain/user.ts` — `UserEntity` is `{ id, email, passwordHash,
  createdAt, updatedAt }`; `createUserRecord(email, passwordHash)` builds it.
- `shared/index.ts` — shared `User` type is `{ id: string; email: string }`.
- `backend/src/api/middleware/session.ts` — `SessionUser` is `{ id, email }`;
  the session middleware selects only `{ id, email }` from `users` and attaches
  it to `req.user`.
- `backend/src/services/auth.ts` — `AuthResult.user` is `{ id, email }`;
  `createSession` selects `{ id, email }` from `users`; `signup(email,
  password)` and `signin(email, password)` take no name.

### Where the email is used as identity/display information today

- `frontend/src/components/Layout.tsx` (line 24) — the signed-in user's **email**
  is shown in the header.
- `frontend/src/components/IssueForm.tsx` (line 143) — the assignee dropdown
  lists members by **email**.
- `frontend/src/pages/IssuePage.tsx` (line 165) — the issue **Assignee** field
  renders the raw `assigneeId` UUID when assigned, or "Unassigned".
- `frontend/src/pages/IssuePage.tsx` (line 246) — comment **authors** render the
  raw `authorId` UUID.
- `frontend/src/context/auth.tsx` — the signed-in `User` (id + email) is stored
  in auth context; `signup(email, password)` and `signin(email, password)` accept
  no name.

### Whether `assigneeId` is enough to resolve an assignee's email/name

No. The API returns only `assigneeId` (a UUID) on issue payloads
(`backend/src/services/issue.ts` selects `assigneeId` only; the shared `Issue`
type has only `assigneeId`). The frontend cannot resolve the assignee's identity
from an issue payload alone. The assignee can be resolved only by separately
loading `/workspaces/:id/members`, and today the IssuePage does not do so —
hence the raw UUID display.

### How assignees are currently fetched and returned

- `backend/src/services/issue.ts` — issue create/get/list/update return
  `assigneeId` with no join into `users`.
- `GET /workspaces/:id/members`
  (`backend/src/services/membership.ts` → `listMembers`) returns
  `{ userId, email }[]`. This is the only place member identity is resolved
  today, and `IssueForm.tsx` uses it to populate the assignee dropdown.
- There is no member-list or member-management UI in the workspace page; the
  members endpoint currently feeds only the issue form's assignee picker.

### How comment authors are currently fetched and returned

- `backend/src/services/comment.ts` — `addComment` and `listComments` return
  `{ id, issueId, authorId, body, createdAt }` with no join into `users`; the
  shared `Comment` type mirrors this (`authorId` only).
- `frontend/src/pages/IssuePage.tsx` renders `c.authorId` (raw UUID).

### Whether workspace member information is already available anywhere

Partially. `listMembers` (`backend/src/services/membership.ts`) resolves member
ids to emails, exposed via `GET /workspaces/:id/members`. Workspace owner is
available as `ownerId` on workspace payloads. No member name exists anywhere.

### What changes a persistent display name actually requires

| Layer | Current | Required change |
|-------|---------|-----------------|
| Database schema | `users` has no name | Add a `name` column via a new migration (`0001_initial.sql` is the only migration; `backend/src/db/migrate.ts` versions files by numeric prefix) |
| Domain | `UserEntity` has no name | Add `name`; thread it through `createUserRecord` |
| Auth service | `signup(email, password)` | Accept name; persist it; return it in `AuthResult.user` |
| Session middleware | `SessionUser = { id, email }` | Add `name` to `SessionUser` and to the `users` select |
| Auth validators | `signupSchema` = email + password | Add a `name` field following existing zod conventions |
| Safe user DTOs | User serialized inline as `{ id, email }` | Always include `name`; never include `passwordHash` (already excluded) |
| Issue API | Returns `assigneeId` only | Also return the assignee's display identity (additive field) |
| Comment API | Returns `authorId` only | Also return the author's display identity (additive field) |
| Members API | Returns `{ userId, email }` | Also return the member's display name |
| Shared types | `User`, `Issue`, `Comment` lack name fields | Extend `User` with `name`; extend issue/comment shapes with assignee/author identity |
| Frontend | Signup has no name field; header/assignee/author show email or UUID | Add "Full name" to SignupPage; show name on header, assignee, comment author, assignee picker, member surfaces |
| Tests | Signup payloads and mocks use email/password only; IssuePage renders UUIDs | Extend signup payloads; assert name in auth/issue/comment/member responses; update UI assertions from UUID to name |

### Whether existing users can safely have a null/empty name during migration

Yes. The `name` column is added as **nullable** for backward compatibility and is
**never backfilled**. Because SQLite's `ALTER TABLE ADD COLUMN` cannot add a
`NOT NULL` column without a default, adding `name` as nullable is the correct
migration form. Existing rows keep a null `name`; at display time a deterministic
fallback is derived from the email **local-part** (the characters before the
`@`). This fallback is a presentation-time value only — it is never written back
to the database and never treated as the user's stored display name.

### Which API responses need to expose the display name

- `POST /auth/signup`, `POST /auth/signin`, `GET /auth/me` → the `user` object.
- Issue responses (`POST /projects/:projectId/issues`, `GET
  /projects/:projectId/issues`, `GET /issues/:id`, `PATCH /issues/:id`) → the
  assignee identity.
- Comment responses (`POST /issues/:issueId/comments`, `GET
  /issues/:issueId/comments`) → the author identity.
- `GET /workspaces/:id/members` → the member name.

### Which frontend surfaces should display the name

- Signup page — new "Full name" field (and confirm-password already exists).
- Header (`Layout.tsx`) — the signed-in user's name instead of (or alongside)
  the email.
- Issue detail (`IssuePage.tsx`) — assignee name instead of the raw UUID; comment
  author names instead of raw UUIDs.
- Issue list (`WorkspacePage.tsx`) — issue cards can surface the assignee's
  display name (currently cards show title and status/priority badges only).
- Issue form (`IssueForm.tsx`) — assignee dropdown lists member names.
- Workspace member surfaces — wherever members are listed (today the members
  endpoint feeds the assignee picker; if a member list UI is added it should use
  names).
- Avatar initials — derived from the display name in these surfaces.

### Whether avatar initials can be derived entirely from the display name

Yes. Initials can be computed from the stored name (first character of the first
and last word, uppercased, at most two characters), with a fallback to the email
local part when the name is empty. This requires no image storage, no upload, no
external service, and no new dependency — it is a pure derivation.

### What validation rules would be appropriate based on existing conventions

The project uses zod validators in `backend/src/api/validators/*.ts` with a
consistent `z.string().trim().min(1, "<label> is required").max(n)` pattern
(e.g., workspace/project name max 100, label max 50, issue title max 200). The
display name should follow the same pattern: required, trimmed, non-empty, with a
reasonable maximum length. See Validation Requirements below.

### What backward-compatibility concerns exist

- Adding fields to existing JSON responses (`user.name`, assignee/author
  identity) is additive and safe for existing clients and tests that read
  existing fields; none of the current tests assert exact whole-object equality
  on user/issue/comment payloads.
- Requiring `name` on `POST /auth/signup` is a **contract change**: requests
  without `name` will now fail validation. Existing accounts and existing
  sessions are unaffected; this change is intentional and documented in the API
  Behavior and Validation Requirements.
- `assigneeId` and `authorId` must remain in the API and shared types; the new
  identity fields are additive so any consumer depending on the current shape
  keeps working.
- Test helpers (`backend/tests/helpers.ts` `signupAs`, and the local `signup`
  helpers in `backend/tests/api.test.ts` and
  `backend/tests/integration/performance.test.ts`) must supply a name; the
  helper signature should gain an optional name parameter so existing callers
  keep working.

### What existing tests must change or be extended

- `backend/tests/helpers.ts` — `signupAs(email, password)` must send a name;
  add an optional `name` parameter.
- `backend/tests/api.test.ts` — signup requests must include a name; assert the
  returned `user.name` on signup and `/auth/me`.
- `backend/tests/integration/performance.test.ts` — its local `signup` helper
  must include a name.
- `backend/tests/integration/issues.test.ts` — extend to assert the assignee
  identity on create/get/list responses when an assignee is set.
- `backend/tests/integration/comments.test.ts` — extend to assert the author
  identity on add/list responses.
- `backend/tests/integration/workspaces.test.ts` — the members endpoint now also
  returns `name`; extend assertions.
- `backend/tests/unit/security.test.ts` — its raw signup payloads must include a
  name (it exercises rate limiting only).
- New backend tests: signup without a name → `422`; password hash never appears
  in any auth/issue/comment response.
- `frontend/tests/component/auth.test.tsx` — SignupPage tests must fill the new
  "Full name" field; signup mock payloads must include the name.
- `frontend/tests/component/issue-page.test.tsx`,
  `frontend/tests/component/workspace-page.test.tsx`, and
  `frontend/tests/accessibility/core.test.tsx` — mock issue/comment payloads
  gain the new identity fields; assertions that rendered raw UUIDs update to
  assert names.
- New frontend tests: name shown in header, issue list, assignee, and comment
  author surfaces; empty-name fallback behavior (email local-part, never
  persisted); initials derivation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign Up with a Full Name (Priority: P1)

A new user signs up providing their full name along with email and password, is
signed in, and sees their name in the application header.

**Why this priority**: The name must be captured at the first touchpoint; every
other identity surface depends on it existing.

**Independent Test**: Can be fully tested by submitting the signup form with a
full name, confirming the returned user includes the name, and confirming the
header shows the name.

**Acceptance Scenarios**:

1. **Given** a new visitor on the sign-up page, **When** they enter a full name,
   a valid email, a password, and a matching confirmation, **Then** an account is
   created with the name persisted and they are signed in.
2. **Given** a signed-up user, **When** they later sign in, **Then** the returned
   user includes their name and the header shows it.
3. **Given** the sign-up form, **When** the full name is blank or whitespace,
   **Then** submission is blocked with a clear, accessible error on the name
   field.
4. **Given** an existing account whose signup predates this feature, **When**
   they sign in, **Then** they are shown a deterministic fallback derived from
   the email local-part (never a raw empty value) in identity surfaces.

---

### User Story 2 - Identify the Assignee of an Issue (Priority: P1)

A member viewing an issue sees the assignee by name, and a member creating or
editing an issue picks an assignee from a list of member names.

**Why this priority**: Assignee identity is the primary collaboration surface
named in the feature request and currently shows a raw UUID.

**Independent Test**: Can be tested by assigning a workspace member to an issue,
then viewing the issue detail and confirming the member's name is shown, and by
confirming the assignee dropdown lists member names.

**Acceptance Scenarios**:

1. **Given** an issue assigned to a workspace member, **When** a member opens the
   issue, **Then** the Assignee field shows the assignee's display name.
2. **Given** an unassigned issue, **When** a member opens it, **Then** the
   Assignee field continues to show "Unassigned".
3. **Given** the issue form, **When** a member opens the assignee dropdown,
   **Then** each option shows the member's display name (email remains available
   as secondary context if desired).
4. **Given** an issue list or issue response, **When** an assignee is set,
   **Then** the response includes the assignee's display name.

---

### User Story 3 - Identify the Author of a Comment (Priority: P2)

A member reading a comment thread sees each comment's author by name.

**Why this priority**: Comment authorship is the second named collaboration
surface and currently shows a raw UUID; it ranks below assignee because comments
are a P2 feature in the base product.

**Independent Test**: Can be tested by adding a comment to an issue and
confirming the comment shows the author's display name in the thread.

**Acceptance Scenarios**:

1. **Given** an issue with comments, **When** a member opens it, **Then** each
   comment shows its author's display name.
2. **Given** a new comment is added, **When** the thread refreshes, **Then** the
   new comment shows the current user's display name.
3. **Given** a comment API response, **When** it is returned, **Then** it
   includes the author's display name.

---

### User Story 4 - Identify Members of a Workspace (Priority: P3)

A member sees workspace members by name wherever members are surfaced, starting
with the assignee picker, and the members API returns names.

**Why this priority**: Member identity is broadly useful but there is no member
list UI today; the members API already feeds the assignee picker, so enriching it
is low-cost, while a dedicated member management UI is out of scope.

**Independent Test**: Can be tested by listing workspace members and confirming
the response includes each member's display name.

**Acceptance Scenarios**:

1. **Given** a workspace with members, **When** the members endpoint is queried,
   **Then** each member includes their display name.
2. **Given** a workspace member, **When** they appear in the issue form assignee
   dropdown, **Then** their display name is shown.

---

### Edge Cases

- What happens when the display name is missing for legacy users (users created
  before this feature)? The UI must fall back to a deterministic value derived
  from the email local-part; the fallback is a presentation-time value and is
  never persisted or treated as the stored display name.
- What happens if a legacy user is asked to display a name? Their stored `name`
  remains null indefinitely; no migration or backfill writes a name for them.
- What happens when a name is all whitespace, contains only spaces, or exceeds
  the maximum length? Validation must reject it with a clear field error.
- What happens when an issue is assigned to a user whose name is empty? The
  assignee identity must still resolve (id + fallback name).
- What happens when a comment author's name is empty? Same fallback rule.
- What happens when an assignee is unassigned (`assigneeId` null)? The assignee
  identity must be `null` and the UI must keep showing "Unassigned".
- What happens to names with multiple words or unusual spacing? The name is
  stored as entered (trimmed); initials derivation must not crash on empty or
  single-word names.
- How are long names handled in compact surfaces (header, comment meta, avatar)?
  They must wrap or truncate without breaking layout (consistent with existing
  long-email handling from feature 002).
- Do existing sessions and cookies remain valid after the migration? Yes — the
  session flow is unchanged; only the user projection adds a field.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST capture a full name during signup, alongside email and
  password (and the existing password confirmation).
- **FR-002**: System MUST persist the display name on the user account so it
  survives sign-out and sign-in.
- **FR-003**: System MUST return the display name in every safe user
  representation (signup, signin, current-user).
- **FR-004**: System MUST expose the assignee's display identity in issue
  responses (create, list, get, update) when an assignee is set.
- **FR-005**: System MUST expose the author's display identity in comment
  responses (create, list).
- **FR-006**: System MUST expose the display name in workspace member responses.
- **FR-007**: System MUST show the signed-in user's display name in the
  application header.
- **FR-008**: System MUST show the assignee's display name on the issue detail
  page, keeping "Unassigned" for unassigned issues.
- **FR-009**: System MUST show each comment author's display name in the comment
  thread.
- **FR-010**: System MUST list workspace members by display name in the assignee
  picker.
- **FR-011**: System MUST display a small initials avatar derived from the
  display name wherever a person is identified; no image upload or storage is
  involved.
- **FR-012**: System MUST fall back to a deterministic name-like value derived
  from the email local-part when a user has no display name; this fallback MUST
  be a presentation-time value and MUST NOT be persisted or treated as the
  stored display name.
- **FR-013**: System MUST treat the display name as a single reusable
  user-identity primitive exposed through one consistent safe identity shape and
  used across the application header, issue assignee picker, issue list, issue
  detail, comment authors, workspace/member UI, and avatar initials.
- **FR-014**: System MUST show the assignee's display name on the issue list
  when an assignee is set (in addition to the issue detail page).

### Non-Functional Requirements

- **NFR-001**: The change MUST NOT alter authentication, authorization,
  membership, or any existing business rule; it is additive identity display.
- **NFR-002**: Adding identity fields MUST NOT degrade existing endpoint
  performance beyond current budgets (feature 001 SC-004: project search/filter
  under 2 seconds for ~1,000 issues; lists remain paginated).
- **NFR-003**: The database migration MUST be applied automatically by the
  existing migration runner with no manual step and MUST be safe on an existing
  database (no data loss, no destructive change).
- **NFR-004**: The feature MUST preserve existing accessibility guarantees
  (WCAG AA, keyboard-only flows, screen-reader semantics) on all touched
  surfaces.
- **NFR-005**: The runtime fallback MUST be a presentation-time value; the
  database MUST NOT be written for legacy users during normal operation (no
  backfill).

### Data & Identity Requirements

- The **display name** is a single string on the User entity; it is display
  information only and is NOT an identifier.
- The **email remains the unique account identifier** and the sign-in
  credential; the name is never used for lookup, uniqueness, or auth.
- The display name MAY be null only for accounts created before this feature;
  all newly created accounts MUST have a non-empty name.
- The name MUST be stored trimmed; internal formatting is preserved as entered.
- The stored `name` for legacy users remains null; a deterministic runtime
  fallback (email local-part) is computed at display time only and is NEVER
  persisted back to the database.
- No new tables, relations, or identity entities are required — one column on
  the existing users table.

### API Behavior Requirements

- `POST /auth/signup` — request gains `name` (required). Response `201` user
  includes `name`.
- `POST /auth/signin`, `GET /auth/me` — user includes `name`.
- Issue endpoints — issue payloads gain an additive **nested** assignee identity:
  `assignee: { id, name }` when assigned, otherwise `null`. The existing
  `assigneeId` field is preserved unchanged for backward compatibility.
- Comment endpoints — comment payloads gain an additive **nested** author
  identity: `author: { id, name }`. The existing `authorId` field is preserved
  unchanged for backward compatibility.
- The nested `{ id, name }` object is the single reusable safe identity shape
  used for assignees and comment authors. For members, the existing flat
  `{ userId, email }` shape is preserved and gains an additive `name` field.
- No response in any endpoint includes `passwordHash` or any session secret.
- `GET /workspaces/:id/members` — each member gains a display name.
- Error behavior is unchanged: validation failures return `422` with the
  existing field-error map; the name field reports its own message.
- No other endpoint contract changes; search/filter/dashboard/workspace/project
  behavior is untouched.

### Validation Requirements

Following the existing zod conventions (`trim().min(1, "<label> is required")
.max(n)`):

- `name` MUST follow the exact convention:
  `z.string().trim().min(1, "Full name is required").max(100)`.
- The maximum length is **100 characters**, chosen to match the existing
  workspace and project name convention (`createWorkspaceSchema` and
  `createProjectSchema` both use `.max(100)`).
- **Backend validation is authoritative**: the server MUST reject missing,
  blank, or over-length names with a `422` field-level error on `name`,
  regardless of any client-side checks.
- Validation failure MUST return a field-level error on `name` via the existing
  `422` field-error map, displayed inline on the signup form like other fields.
- The signup form MUST prevent submission while the name is empty and show the
  field error accessibly (matching the existing focus/alert pattern).

### Migration & Backward-Compatibility Requirements

- A new SQL migration following the existing numeric-prefix convention MUST add
  the display-name column to `users` without touching other tables.
- The column MUST be added **nullable**; existing rows remain valid and keep a
  null `name`. A default value is not needed because the fallback is
  runtime-only.
- **No backfill**: legacy rows are NOT backfilled from email. Their `name`
  remains null; a deterministic runtime fallback (email local-part) is used at
  display time only and is never persisted.
- Existing accounts with no name MUST render a fallback identity; the fallback
  MUST be deterministic and derived from the email local-part.
- Existing sessions and cookies MUST remain valid across the migration.
- `assigneeId` and `authorId` MUST remain in the API and shared types.
- All additive response fields MUST NOT break consumers that read existing
  fields only.

### UI Requirements

- **Signup**: add a "Full name" field above Email (order: Full name, Email,
  Password, Confirm password), with the same field anatomy, focus management,
  and error alert pattern as the existing auth pages.
- **Header**: show the signed-in user's display name (falling back per
  FR-012) in the existing user-identity area; email MAY be shown as secondary
  context or replaced.
- **Issue detail**: Assignee field shows the assignee's display name (or
  "Unassigned"); comment meta shows each author's display name.
- **Issue list**: issue cards show the assignee's display name when an assignee
  is set (currently cards show title plus status/priority badges only).
- **Issue form**: assignee dropdown options show member display names (email MAY
  be secondary context).
- **Workspace/member UI**: any member listing surfaces the member's display
  name (today the members endpoint feeds only the assignee picker).
- **Initials avatar**: a compact initials marker derived from the name, rendered
  with the existing badge/avatar styling conventions; no image handling.
- All other pages (dashboard, workspace list, project list, dashboard stats,
  invitations) keep their current behavior; only identity-related text changes
  where it appears.

### Accessibility Requirements

- The new name field MUST have a visible label, `aria-invalid`/`aria-describedby`
  wiring, and participate in the existing focus-to-error behavior.
- Names MUST be conveyed as text; a purely decorative initials avatar MUST be
  marked so screen readers read the accessible name, not the letters.
- Keyboard-only signup and navigation must remain fully completable with the new
  field (matching feature 002 guarantees).
- No new axe violations on any touched surface.

### Security Requirements

- `passwordHash` and any session secret MUST NEVER be exposed in any response;
  the display name must be returned only through safe user representations that
  never include credentials. Nested identity objects MUST be built from a safe
  user projection that excludes `passwordHash`.
- The display name is untrusted user input: it MUST be validated and rendered
  as text (the app's existing React text rendering and zod validation already
  prevent injection; no new raw-HTML rendering is introduced).
- The runtime fallback MUST be derived at presentation time and MUST NOT be
  written to the database; no transformation of user data is persisted beyond
  the user's stored name.
- Adding the name MUST NOT relax the existing signup rate limit, validation, or
  session controls.
- No new secrets, keys, or third-party identity services are introduced.

### Error & Empty-State Behavior

- Blank/invalid name at signup: inline field error, focus moved to the alert,
  submission blocked (matches existing auth error behavior).
- Legacy user with no name: never render an empty value; always show the
  deterministic email local-part fallback, which is never persisted.
- Unassigned issue: Assignee shows "Unassigned" (unchanged).
- A user referenced by an issue/comment whose account was deleted cannot occur
  (assignee `onDelete: set null`, comment author `onDelete: cascade`), so no
  dangling-name state needs handling beyond the existing rules.
- Failed signup for any reason keeps the entered values and shows the existing
  error alert; no data is silently lost.

### Key Entities

- **User**: gains one display attribute — `name` (display-only; email remains
  the unique identity). Relationships are unchanged: owns 0..n Workspaces,
  member of 0..n Workspaces, assignee of 0..n Issues, author of 0..n Comments.
- **Issue**: unchanged attributes; its assignee relationship now surfaces the
  assignee's display name (additive).
- **Comment**: unchanged attributes; its author relationship now surfaces the
  author's display name (additive).
- **Membership**: unchanged; the members projection now includes the display
  name (additive).

## Acceptance Scenarios

End-to-end scenarios consolidating the user-story acceptance criteria:

1. **Given** the sign-up page, **When** a visitor submits a full name, valid
   email, password, and matching confirmation, **Then** the account is created
   with the name persisted, the user is signed in, and the header shows the name.
2. **Given** the sign-up page, **When** the full name is blank, **Then**
   submission is blocked with a clear, accessible field error on "Full name".
3. **Given** an assigned issue, **When** a member opens it or views the issue
   list, **Then** the assignee's display name is shown (never a raw UUID or
   email).
4. **Given** a comment thread, **When** a member opens it, **Then** each comment
   shows its author's display name.
5. **Given** a workspace with members, **When** the members endpoint is queried,
   **Then** each member includes their display name, and the assignee picker
   lists member display names.
6. **Given** any user, **When** they are identified anywhere in the app, **Then**
   a small initials avatar derived from their name is shown and, for legacy users
   without a name, a deterministic email local-part fallback is shown.
7. **Given** any auth/issue/comment/member response, **When** it is returned,
   **Then** it contains display names in the nested `{ id, name }` shape (with
   `assigneeId`/`authorId` preserved) and never contains the password hash.
8. **Given** a legacy account, **When** the app displays their identity, **Then**
   the email local-part fallback is shown at presentation time and their stored
   `name` remains null (never backfilled or written).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create an account with a full name and immediately
  see their name in the header, in under 2 minutes.
- **SC-002**: 100% of newly created accounts have a non-empty stored display
  name.
- **SC-003**: No API response in auth, issue, or comment surfaces exposes the
  password hash (verified by test assertions).
- **SC-004**: Issue detail, issue list, comment thread, header, and assignee
  picker display names instead of raw UUIDs or bare emails.
- **SC-005**: All existing backend, frontend, and accessibility tests pass after
  the change, plus the new name-related tests.
- **SC-006**: The migration applies cleanly to a database populated with the
  0001 schema; existing rows remain readable and their stored `name` stays null.
- **SC-007**: All touched surfaces pass the axe accessibility suite with no new
  violations, and the signup flow remains keyboard-completable.
- **SC-008**: Legacy accounts are never backfilled; identity surfaces always show
  the deterministic email local-part fallback and the database is never written
  for legacy users during normal operation.

## Assumptions

> These are assumptions made for this specification, not confirmed product
> decisions.

- **Field order on signup**: Full name, Email, Password, Confirm password, as
  described in the feature idea.
- **Name is display-only**: The name never participates in authentication,
  authorization, uniqueness, or lookup; email remains the account identifier.
- **Initials avatar is derived, not uploaded**: initials come from the name with
  a deterministic algorithm (e.g., first character of first and last word,
  uppercased, max two characters); fallback derives from the email local part.
  No photo upload, storage, or third-party service.
- **Name is required for new signups**: `POST /auth/signup` requires `name`;
  backend validation is authoritative. This is an intentional contract change for
  new accounts; existing accounts and sessions are unaffected.
- **Legacy users get a runtime display fallback, never a backfill**: `name` is
  nullable in the database; legacy rows are never backfilled from email. A
  deterministic fallback derived from the email local-part is computed at
  presentation time and is never persisted or treated as the stored display
  name.
- **Name maximum length**: 100 characters, chosen to match the existing
  workspace and project name convention (`.max(100)`); this is a documented
  decision, not a placeholder.
- **Email MAY remain secondary context** in the header and assignee picker; the
  name is primary.
- **No new user-management UI**: a dedicated workspace member-list/management
  page is out of scope; only the existing members endpoint and assignee picker
  are enriched.
- **No authentication changes**: sessions, cookies, rate limiting, and
  password hashing are unchanged.

## Risks / Open Questions

The decisions in this revision resolved the previously open questions: the
backfill strategy (no backfill; nullable column + runtime email local-part
fallback), `name` required at signup with backend validation authoritative, and
the identity response shape (nested `{ id, name }` with `assigneeId`/`authorId`
preserved). Two minor items remain genuinely unresolved:

- **Fallback display formatting**: whether the email local-part is shown as
  stored (e.g., `alice`) or capitalized (e.g., `Alice`) in identity surfaces.
  This is cosmetic and is resolved at UI implementation; the fallback value
  itself remains deterministic either way.
- **Member identity shape asymmetry**: members keep the existing flat
  `{ userId, email }` shape plus an additive `name` field, while issues and
  comments use nested `{ id, name }` objects. This asymmetry is intentional to
  preserve the members endpoint contract, but it means two related identity
  shapes exist in the API.

## Out of Scope

- Profile photos.
- Avatar image uploads and storage (initials are derived, not uploaded).
- Username/handle system, display-name-based login, or name-based uniqueness.
- Public profiles.
- Presence / online-status indicators.
- Social or profile features (e.g., bios, follower/social links, status messages).
- Editing or changing the display name after signup (no profile settings UI).
- Workspace member management UI beyond the existing invitations surface.
- Password reset, email verification, or any other authentication change.
- Unrelated business-logic changes: authentication, authorization, membership,
  status/priority enums, search/filter, dashboard, projects, and comment
  semantics remain unchanged.
- Dark mode, notifications, real-time features, billing, integrations, AI
  (unchanged from prior features).