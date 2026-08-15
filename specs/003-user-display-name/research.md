# Research: User Display Name Design Decisions

**Branch**: `003-user-display-name` | **Date**: 2026-08-15

Phase 0 output for [plan.md](plan.md). Resolves the design decisions that the
spec intentionally left open (per the constitution's deferral of technology
choices to planning) and that arise from the current codebase. This is a
self-contained vertical slice across an existing, already-decided stack
(Express + Drizzle + SQLite backend, React SPA, shared TS types); every
decision below is grounded in the codebase inspected for the spec, so no
external research was required.

## 1. Where the email-local-part fallback is computed

- **Decision**: The fallback is resolved **server-side at serialization time**
  by a single shared helper, `resolveDisplayName(name, email)`. Every safe user
  representation returned by the API (auth `user`, issue `assignee`, comment
  `author`, member entries) carries a **non-null `name`** that is either the
  stored name or the deterministic email-local-part fallback. The DB column
  stays `NULL` for legacy users; nothing is ever written back.
- **Rationale**: The decided identity shape for assignees/authors is
  `{ id, name }` with **no email field** (spec API Behavior Requirements). If
  the API returned `name: null` for legacy users, the frontend would have no
  email in the payload to derive a fallback from, so it could not render a
  name for issue assignees or comment authors. Resolving on the server keeps
  the nested shape small, guarantees "no raw empty value in any response"
  (spec Error & Empty-State), and makes the frontend render `name` directly
  with no per-surface fallback logic. This satisfies FR-012 ("presentation-time
  value, never persisted") at the API boundary and honors SC-008.
- **Alternatives considered**: (a) Return `{ id, name, email }` so the client
  could compute the fallback — rejected: the spec explicitly chose the compact
  `{ id, name }` shape and there is no client need for the assignee/author
  email. (b) Frontend-only fallback — rejected: impossible for the nested
  shapes and would duplicate logic across every surface, violating FR-013's
  single-primitive requirement.

## 2. The identity helper lives in the backend, not shared

- **Decision**: `resolveDisplayName` lives in a new `backend/src/lib/identity.ts`
  (pure function; unit-testable without a DB). The frontend does **not** need it
  because the API always returns a resolved non-null `name`.
- **Rationale**: Only the backend serializes users to identity objects, so only
  the backend needs the resolver. Keeping it out of the `shared` package
  avoids expanding that public API surface without a consumer. FR-013's "single
  reusable primitive" is satisfied at the API boundary: one consistent
  `{ id, name }` shape and one resolver used by auth, session, issue, comment,
  and membership code.
- **Alternatives considered**: Putting `resolveDisplayName` in `shared/` — no
  frontend consumer exists, so rejected as unnecessary public surface.

## 3. Nested identity enrichment uses LEFT JOINs into `users`

- **Decision**: Issue and comment services enrich payloads with a
  `LEFT JOIN` on `users.id` (PK) selecting `users.name` and `users.email`, then
  build `{ id, name }` via the resolver. `assignee` is `null` when `assigneeId`
  is `null`; `author` is always present (authorId is NOT NULL).
- **Rationale**: The assignee/author email is required to compute the fallback,
  and a LEFT JOIN is one indexed PK lookup per row — negligible at the declared
  scale (~1,000 issues/project, paginated pageSize 50). This reuses the
  existing single-query style in `issue.ts`/`comment.ts` rather than introducing
  per-row second queries or an N+1 batch resolver.
- **Alternatives considered**: (a) Fetch all referenced users in a second
  `IN` query and map by id — rejected: more code, same cost, no benefit at this
  scale. (b) Drizzle relations `with:` — rejected: the services use explicit
  selects today and switching to relation loading would restructure queries
  more than a join.

## 4. Session middleware and auth service resolve at the same boundary

- **Decision**: `SessionUser` gains `name`; the middleware's `users` select adds
  `name` and builds `{ id, email, name: resolveDisplayName(name, email) }`.
  `AuthResult.user` gains `name` and `createSession` does the same. Signup
  accepts `name`, persists it, and returns it resolved (equal to the stored
  value for new users).
- **Rationale**: `GET /auth/me` returns `req.user` directly, and signup/signin
  return `AuthResult.user`, so resolving in both places guarantees the header
  and auth context always hold a non-null display name with no frontend
  fallback. This is the same "resolve at the boundary" rule as §1.
- **Alternatives considered**: Storing the raw nullable name on `SessionUser`
  and resolving in the frontend — rejected for the same reason as §1 (the
  frontend would need email + per-surface logic).

## 5. Members keep the flat shape with an additive `name`

- **Decision**: `listMembers` selects `users.name` alongside the existing
  `{ userId, email }` and returns `{ userId, email, name }` (resolved). No
  structural change to the members endpoint.
- **Rationale**: The spec decided members keep the flat `{ userId, email }`
  contract with an additive `name` to preserve existing consumers (the issue
  form's assignee picker reads `userId`/`email` today). The asymmetry vs. the
  nested `{ id, name }` for issues/comments is intentional and documented in
  the spec's Risks.
- **Alternatives considered**: Unifying members into the nested `{ id, name }`
  shape — rejected: would break the existing members contract and the
  assignee-picker binding to `userId`.

## 6. Migration form: new SQL file, nullable column, no backfill

- **Decision**: Add `backend/src/db/migrations/0002_user_display_name.sql`
  containing `ALTER TABLE users ADD COLUMN name TEXT;` and mirror it in
  `backend/src/db/schema.ts` (`name: text("name")`, nullable). `runMigrations`
  (numeric prefix, `PRAGMA user_version`) applies it automatically on server
  open and on `:memory:` test DBs. No backfill and no default.
- **Rationale**: SQLite `ALTER TABLE ADD COLUMN` cannot add a NOT NULL column
  without a default, and the spec requires a nullable column plus runtime-only
  fallback. This matches the existing 0001 convention exactly (one file, plain
  SQL, auto-applied). NFR-003 is satisfied with zero manual steps.
- **Alternatives considered**: (a) `name TEXT NOT NULL DEFAULT ''` — rejected:
  an empty-string default is semantically wrong and violates the "no
  backfill/no fabricated stored name" rule. (b) A backfill job — explicitly
  rejected by the spec (FR-012, NFR-005, SC-008).

## 7. Initials derivation algorithm

- **Decision**: A frontend util `initialsFromName(name)` derives initials as:
  split the trimmed name on whitespace, drop empty tokens; take the first
  character of the first token and, if more than one token, the first character
  of the last token; uppercase both; join (max 2 characters). If no tokens,
  return `"?"`. Rendered via a new `Avatar` component.
- **Rationale**: Because the API always returns a non-null resolved name
  (§1), the initials util needs only the name — no email fallback path in the
  frontend. This matches the spec's "first character of first and last word,
  uppercased, at most two characters" and its edge cases (single-word names,
  empty names must not crash).
- **Alternatives considered**: Client-side email-local-part fallback inside the
  initials util — rejected: unnecessary given server resolution, and would
  require email on every surface.

## 8. Avatar accessibility contract

- **Decision**: The `Avatar` component takes the person's `name` and a
  `decorative` flag. When shown beside visible name text (issue detail, comment
  meta, assignee picker), it is decorative: rendered initials are
  `aria-hidden` and the adjacent text carries the accessible name. In the
  header where the avatar is the identity marker, the component renders as
  `role="img"` with `aria-label={name}` so screen readers announce the person's
  name, not the letters.
- **Rationale**: Satisfies the spec's Accessibility Requirements (a purely
  decorative avatar must not be announced as initials) and WCAG AA on touched
  surfaces.
- **Alternatives considered**: Always `aria-label` the initials — rejected:
  would double-announce names next to visible text.

## 9. Validation and contract deltas

- **Decision**: `signupSchema` gains
  `name: z.string().trim().min(1, "Full name is required").max(100)` following
  the exact workspace/project convention (`createWorkspaceSchema`,
  `createProjectSchema` both use `.trim().min(1, …).max(100)`). Backend
  validation is authoritative; missing/blank/over-length names → `422` with a
  field-level error on `name`. Shared types add `SignupRequest.name`,
  `User.name: string`, `Identity { id, name }`,
  `Issue.assignee: Identity | null`, `Comment.author: Identity`, and
  `WorkspaceMember { userId, email, name }`.
- **Rationale**: `name` must be required at signup (FR-001/FR-002) and the max
  length is a documented decision matching the codebase's established zod
  pattern. Shared types are extended additively so consumers reading existing
  fields keep working; the new required-on-create `name` is an intentional,
  spec-approved contract change.
- **Alternatives considered**: Optional `name` on signup — rejected by the
  spec (name is required for new accounts).

## 10. Test strategy

- **Decision**: Extend, don't replace. `signupAs(email, password, name = "Test User")`
  gains an optional name default so all existing callers keep working. The local
  `signup` in `performance.test.ts` and the raw payloads in `security.test.ts`
  gain `name`. Backend integration tests assert `assignee`/`author`/member
  identity and that `passwordHash` never appears. Frontend component/a11y tests
  gain the new identity fields in mocked payloads and assert names instead of
  raw UUIDs. New focused tests cover: signup without a name → `422`, header
  name, issue-list assignee, initials derivation, and fallback for legacy
  (null-name) users.
- **Rationale**: Preserves the feature-001/002 testing baseline (Principle V)
  and the spec's enumerated test changes; the optional-name helper default keeps
  churn minimal.
- **Alternatives considered**: A separate shared test helper package — rejected:
  the existing per-workspace helpers are sufficient.

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|------------|
| Fallback location | Server-side at serialization; API `name` always non-null |
| Identity helper location | `backend/src/lib/identity.ts` (pure function) |
| Assignee/author enrichment | LEFT JOIN `users` (PK) in issue/comment queries |
| Session/auth resolution | `SessionUser`/`AuthResult.user` carry resolved `name` |
| Members shape | Flat `{ userId, email, name }`, additive |
| Migration | `0002_user_display_name.sql`, `ALTER TABLE … ADD COLUMN name TEXT`; auto-applied |
| Initials | `initialsFromName` frontend util + `Avatar` component |
| Avatar a11y | Decorative vs `role="img"`/`aria-label` based on context |
| Validation | zod `trim().min(1,"Full name is required").max(100)`, backend authoritative |
| Tests | Extend existing suites + add identity/fallback/initials assertions |

## Explicitly Rejected

- **Client-side fallback computation** — impossible for the nested
  `{ id, name }` shapes (no email in payload) and duplicates logic per surface.
- **Nested `{ id, name }` for members** — breaks the existing members contract
  and the assignee-picker binding.
- **Backfilling legacy names or a `DEFAULT ''` column** — violates FR-012,
  NFR-005, SC-008 and the spec's no-fabricated-stored-name rule.
- **Putting `resolveDisplayName` in `shared/`** — no frontend consumer; would
  expand shared's public surface unnecessarily.
- **Drizzle relations `with:` / second batch query for identities** — more
  restructuring or code than a single PK LEFT JOIN at this scale.