# Quickstart — My Issues (Feature 005)

**Branch**: `005-my-issues` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/my-issues-api.md](./contracts/my-issues-api.md) | **Data model**: [data-model.md](./data-model.md)

Runnable validation guide for the My Issues feature. This proves the feature
works end-to-end; it is not an implementation reference (see `tasks.md`).

## Prerequisites

- Node.js 22 LTS + npm, `npm install` already run.
- `.env` present with a `SESSION_SECRET` (see root `README.md` → Setup).
- No database migration is required for this feature (read-only aggregation
  over existing tables — [data-model.md](./data-model.md)).

## Setup

```sh
npm run dev
# Backend API at http://localhost:3000/api
# Frontend SPA at http://localhost:5173
```

## Run the test suites

```sh
npm run test -w backend      # includes integration/my-issues.test.ts
npm run test:ui -w frontend  # includes component/my-issues-page.test.tsx
npm run test:a11y -w frontend # includes MyIssuesPage axe scan
npm run lint                 # ESLint (all workspaces)
npm run typecheck            # TypeScript (all workspaces)
```

## Validation scenarios (end-to-end)

### 1. Cross-workspace workload summary (SC-001, SC-002, FR-001–FR-003, FR-010)

1. Sign up as `alice@example.com`.
2. Create workspace **Team Alpha**, project **App One**.
3. Create 3 issues assigned to Alice: one Open (no due date), one In Progress
   with due date in the past, one Closed.
4. Create a second workspace **Team Beta** (same user), project **App Two**;
   create one Open issue assigned to Alice with a future due date.
5. Open the **My Issues** page from the sidebar.

**Expected**: title "My Issues"; "4 assigned to you"; stat strip `OPEN 3` /
`IN PROGRESS 1` / `OVERDUE 1`; ledger defaults to the 3 Open/In Progress
issues; each row shows ticket key, title, status, priority, assignee, and
`Team Alpha / App One` or `Team Beta / App Two` context; the Overdue issue
(`In Progress`, past due) sorts first.

### 2. Overdue derivation (FR-004)

1. In **App One**, set an Open issue's due date to a past date.
2. Refresh My Issues.

**Expected**: `OVERDUE` count includes the past-due Open issue. An issue with
no due date is never counted; a Closed issue with a past due date is never
counted.

### 3. Include closed (FR-011, SC-002)

1. With the default ledger visible, enable the **Include closed** control.

**Expected**: the ledger now lists all 4 assigned issues (the Closed issue
appears) and the row count equals the "N assigned to you" total. Disabling the
control returns the active-only list. The summary counts never change when the
control is toggled (FR-012).

### 4. Cross-workspace isolation (FR-001, edge: leaving a workspace)

1. Sign up as `bob@example.com`; create a workspace with one Open issue
   assigned to Bob.
2. Sign in as Alice and open My Issues.

**Expected**: Bob's workspace/issues never appear (only Alice's 4 issues).
3. Join Alice's workspace via invitation, then have the owner remove Bob.

**Expected**: issues assigned to Bob inside that workspace no longer appear in
Bob's My Issues.

### 5. Empty states (FR-009, edge cases)

1. Sign up as `carol@example.com` (no workspaces, no assigned issues).

**Expected**: My Issues shows "0 assigned to you", zeroed stats, and the empty
state — no error.
2. Assign Carol only a Closed issue.

**Expected**: default active-only ledger shows the "no active issues" empty
state while the summary still reports the real total; enabling **Include
closed** reveals the Closed issue.

### 6. Navigation (FR-007, SC-004, SC-006)

1. Tab to the sidebar; the **My Issues** link (under the `PERSONAL` eyebrow) is
   reachable by keyboard and shows the active state when on the page.
2. From any ledger row, activate it.

**Expected**: opens the issue detail page at
`/workspaces/<workspaceId>/issues/<id>`.

### 7. Error state (FR-009)

1. Stop the backend, then load My Issues.

**Expected**: a clear, recoverable error alert (existing `Alert` pattern), not
partial or fabricated counts.

### 8. Accessibility (SC-006, §33 of VISUAL_LANGUAGE)

1. Run `npm run test:a11y -w frontend`.

**Expected**: `MyIssuesPage` has no axe violations; the include-closed checkbox
is labelled; the sidebar link and ledger links are keyboard-operable; on a
coarse-pointer device the control meets the 44px touch target.

## Expected outcomes

- All scenario expectations above hold with **real data only** (FR-008).
- The page reuses the existing ticket ledger, stat strip, empty state, error,
  skeleton, and sidebar navigation patterns — no new visual language.
- `overview.byStatus` and the ledger agree with the total per SC-002.

## Troubleshooting

- **Counts look wrong**: verify due dates are `YYYY-MM-DD` and that overdue
  excludes Closed; confirm the issue is assigned to the signed-in user.
- **Ledger shows issues from a foreign workspace**: re-check the user's
  memberships/ownership — the aggregation uses the same workspace set as the
  sidebar Workspaces list.
- **`includeClosed` ignored**: confirm the request uses `?includeClosed=true`
  (the literal string), not a truthy number.