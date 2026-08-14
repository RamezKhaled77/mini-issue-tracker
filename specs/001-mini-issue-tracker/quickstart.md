# Quickstart: Mini Issue Tracker Validation Guide

**Branch**: `001-mini-issue-tracker` | **Date**: 2026-08-14

This guide validates the feature end-to-end. It is a run/validation guide only;
implementation detail lives in tasks.md and the codebase. See
[data-model.md](data-model.md) and [contracts/api.md](contracts/api.md) for
the underlying model and contract.

## Prerequisites

- Node.js 22 LTS and a package manager (npm).
- A Linux/macOS host (SQLite is file-based; WSL on Windows).
- No external services required (all in-scope features are self-contained).

## Setup

```sh
# Install dependencies (root workspace installs backend + frontend)
npm install

# Create local environment file
cp .env.example .env
#   - set SESSION_SECRET (long random value)
#   - set DB_PATH (defaults to ./data/app.db)

# Run database migrations
npm run db:migrate
```

## Start the application

```sh
npm run dev
# Backend API at http://localhost:3000/api
# Frontend SPA at http://localhost:5173
```

## Run the test suites

```sh
npm test            # unit + integration (Vitest)
npm run test:ui     # component tests (React Testing Library)
npm run test:a11y   # accessibility assertions (axe-core)
```

## Validation scenarios (end-to-end)

Perform these against a running instance with two browser profiles (User A and
User B).

### 1. Authentication (FR-001, FR-002)

1. Sign up User A with a valid email and password → account created, signed in.
2. Sign out and sign back in with the same credentials → home area shown.
3. Sign in with a wrong password → clear error, no data exposed.
4. Open the app signed-out → redirected to sign in (no content).

### 2. Workspaces & membership (FR-003a, FR-004, FR-005)

1. User A creates a workspace "Alpha" → appears in home area; A is owner.
2. User A generates an invitation and shares it with User B.
3. Sign in as User B and redeem the token → "Alpha" appears for B.
4. User B tries to create an invitation → `403` (only owner can).
5. User B uses an expired/invalid token → `422` with a clear message.
6. User A removes User B → B no longer sees "Alpha".
7. A signed-out user opening the invitation is asked to sign in first.

### 3. Projects (FR-006)

1. User A creates project "Frontend" in Alpha → listed.
2. Rename to "Frontend App" → name updated everywhere.
3. Delete a project (with confirmation) → project and its issues disappear.

### 4. Issues (FR-007, FR-008)

1. Create an issue with title, description, status, priority, assignee,
   labels, and a due date → appears in the project.
2. Reopen it → all fields preserved.
3. Edit status to "In Progress", priority to "High" → values updated.
4. Attempt to save with a blank title → blocked with a field error (FR-013).
5. Assign an issue to a user outside the workspace → rejected (edge case).
6. Delete the issue (with confirmation) → removed.

### 5. Comments (FR-009)

1. Add a comment to the issue → appears in the thread.
2. Reopen the issue later → comment persists.

### 6. Search & filters (FR-010, FR-011)

1. With 5+ issues in the project, search a keyword → only matches shown.
2. Filter by status, then priority, then assignee, then label → list narrows.
3. Combine two filters → results satisfy both (AND).
4. Search/filter within the project only; other projects unaffected.

### 7. Dashboard (FR-012)

1. Create issues with known statuses and priorities across projects.
2. Open the workspace dashboard → counts match by status and priority.
3. Change an issue's status → dashboard count updates.

### 8. Accessibility (SC-006)

1. Complete the sign-up, create-issue, and filter flows using keyboard only.
2. Run `npm run test:a11y` → no axe-core violations on core pages.

### 9. Performance (SC-004)

1. Load a project with ~1,000 issues (seed script or bulk create).
2. Run a search and a combined filter → results return in under 2 seconds.

## Expected outcomes

- All scenarios complete without unhandled errors; every failure shows a
  clear, user-facing message.
- All acceptance scenarios in [spec.md](spec.md) user stories pass.
- Test suites and accessibility assertions are green.

## Troubleshooting

- **Port in use**: adjust `PORT` in `.env`.
- **Migrations not applied**: run `npm run db:migrate`; check `DB_PATH`.
- **Login rate-limited**: wait for the window to reset (or reset the counter
  in the rate-limit store for local dev).