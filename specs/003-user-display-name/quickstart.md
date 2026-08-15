# Quickstart: User Display Name Validation Guide

**Branch**: `003-user-display-name` | **Date**: 2026-08-15

This guide validates the user-display-name feature end-to-end. It is a
run/validation guide only; implementation detail lives in tasks.md and the
codebase. The data-model and contract deltas are in
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), and
[contracts/identity.md](contracts/identity.md).

## Prerequisites

- Existing repo state (features 001 and 002 implemented) with Node.js 22 LTS
  and npm.
- No new dependencies are installed by this feature.

## Setup

```sh
npm install
cp .env.example .env   # set SESSION_SECRET
npm run db:migrate     # applies 0001 + new 0002_user_display_name.sql
```

The new `0002_user_display_name.sql` migration adds a nullable `name` column to
`users`; `runMigrations` also applies it automatically at server start.

## Start the application

```sh
npm run dev
# Backend API at http://localhost:3000/api
# Frontend SPA at http://localhost:5173
```

## Run the test suites

```sh
npm test            # backend + frontend
npm run test:ui     # component tests (React Testing Library)
npm run test:a11y   # accessibility assertions (axe-core) — extended to name surfaces
npm run lint
npm run typecheck
```

## Validation scenarios (end-to-end)

### 1. Sign-up with a full name (SC-001, SC-002, FR-001–FR-003)

1. Visit `/signup`. The form order is Full name, Email, Password, Confirm
   password.
2. Enter a full name and valid credentials → account created, signed in, header
   shows the name (initials avatar included).
3. The signup API response and `GET /auth/me` return `user.name`.
4. Sign out and sign back in → the header still shows the name.

### 2. Name validation (FR-001, FR-012, SC-002)

1. Submit signup with a blank/whitespace Full name → submission blocked with a
   clear, accessible field error on "Full name"; API returns `422` with a
   `name` field error.
2. Submit a name longer than 100 characters → `422` with a `name` field error.
3. Confirm the signup form remains fully keyboard-completable with the new
   field (tab order: Full name, Email, Password, Confirm password, submit).

### 3. Assignee identity on issue detail and list (SC-004, FR-004, FR-008, FR-014)

1. Assign a workspace member to an issue (create or edit). The issue detail
   Assignee field shows the member's display name — never a raw UUID.
2. On an unassigned issue, the Assignee field continues to show "Unassigned".
3. On the workspace issue list, cards show the assignee's display name when an
   assignee is set.
4. The issue API responses (`POST /projects/:id/issues`,
   `GET /projects/:id/issues`, `GET /issues/:id`, `PATCH /issues/:id`) include
   `assignee: { id, name }` (or `null`) alongside the preserved `assigneeId`.

### 4. Comment author identity (SC-004, FR-005, FR-009)

1. Add a comment on an issue → the thread shows the author's display name,
   never a raw UUID.
2. The comment API responses (`POST /issues/:id/comments`,
   `GET /issues/:id/comments`) include `author: { id, name }` alongside the
   preserved `authorId`.

### 5. Workspace members (FR-006, FR-010)

1. `GET /workspaces/:id/members` returns each member as
   `{ userId, email, name }`.
2. In the issue form's assignee dropdown, options list member display names
   (email may appear as secondary context).

### 6. Initials avatar (FR-011)

1. A small initials avatar derived from the name appears wherever a person is
   identified (header, issue detail assignee, comment author).
2. Single-word and multi-word names produce correct initials; a blank name (not
   reachable via the API, but guarded in the util) yields `"?"` without
   crashing.

### 7. Legacy-user fallback (SC-006, SC-008, FR-012, NFR-005)

1. Apply the migration to a database populated with the 0001 schema: existing
   rows remain readable and their stored `name` stays `null`.
2. For a legacy user (no stored name), every identity surface shows the
   deterministic email local-part fallback — never a raw empty value.
3. Confirm the fallback is never written back: the user's stored `name` remains
   `null` after any API interaction (no backfill).
4. Existing sessions/cookies remain valid across the migration.

### 8. Security: no password hash leakage (SC-003)

1. After signup, `/auth/me`, issue, comment, and member responses contain
   display names but never `passwordHash` or session secrets.
2. New backend tests assert this explicitly.

### 9. Accessibility (SC-007, FR-011 a11y contract)

1. Run `npm run test:a11y` → no axe violations on signup, header, issue detail,
   issue list, and issue form.
2. The Full name field has a visible label, `aria-invalid`/`aria-describedby`
   wiring, and participates in focus-to-error behavior.
3. Decorative initials beside visible text are `aria-hidden`; the standalone
   header avatar is announced by the person's name, not the letters.

### 10. Functional non-regression

Repeat the feature-001 and feature-002 quickstart scenarios against this
feature: auth, workspaces/invitations, projects, issue CRUD with all fields,
comments, search/filter, and dashboard counts must behave identically
(NFR-001). The feature-001 performance budget (search/filter < 2s for ~1,000
issues) must hold (NFR-002).

## Expected outcomes

- All sign-up/assignee/author/member/avatar/fallback scenarios above pass.
- All feature-001/002 scenarios still pass (no behavior regression).
- Test suites (unit, component, a11y), lint, and typecheck are green.
- All acceptance scenarios in [spec.md](spec.md) user stories pass.

## Troubleshooting

- **Migrations not applied**: run `npm run db:migrate`; check `DB_PATH`.
  The `0002` migration only adds a nullable column, so it is non-destructive.
- **Old signup payloads failing**: `POST /auth/signup` now requires `name`
  (intentional contract change). Update test helpers/payloads to include a
  name.
- **Raw UUIDs still visible**: the issue/comment payloads are only enriched
  after the backend change; ensure the dev server restarted and the frontend
  reads the new `assignee`/`author`/`name` fields.