# Data Model: My Issues (Feature 005)

**Branch**: `005-my-issues` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

## Overview

My Issues is a **read-only aggregation** over the existing data model. It adds
**no tables, no columns, and no migration** — the feature derives its summary
and its cross-workspace ledger from data that already exists
(see [research.md](./research.md) §12).

The only new types are **contract-level** shared types (defined in
`shared/index.ts`) that shape the API response consumed by the frontend. They
are not persisted anywhere.

---

## Entities Involved (existing, unchanged)

### User
- `id`, `email`, `name` (`users` table).
- The signed-in person; My Issues is scoped to this single user's assignee
  relationships. Identity is resolved via the existing `resolveDisplayName`
  fallback for legacy users without a `name`.

### Workspace
- `id`, `name`, `ownerId` (`workspaces` table).
- The tenant. A workspace is *reachable* by the user when the user is its owner
  **or** holds a `memberships` row — the exact same definition as the
  sidebar's Workspaces list (`workspaceService.listWorkspaces`).

### Membership
- `userId`, `workspaceId` (`memberships` table).
- Defines the reachable workspace set for the aggregation. Issues in
  non-reachable workspaces are excluded by construction (FR-001).

### Project
- `id`, `workspaceId`, `name` (`projects` table).
- Connects each issue to its workspace; `projects.name` supplies the row's
  project context.

### Issue
- `id`, `projectId`, `title`, `description`, `status`, `priority`,
  `assigneeId`, `dueDate` (`issues` table).
- The work item being aggregated. Only rows with `assigneeId = current user`
  qualify for My Issues.
- `status` ∈ {Open, In Progress, Closed}; `priority` ∈ {Low, Medium, High,
  Urgent} (shared enums).
- `dueDate` is date-only `YYYY-MM-DD` text (nullable).

### Label / IssueLabel
- `labels` (`id`, `workspaceId`, `name`, `color`) and `issue_labels`
  (`issueId`, `labelId`).
- Row label chips are enriched exactly as `listIssues` does today (batched
  `buildLabelMap`), preserving the existing ledger label rendering.

---

## Derived Concepts (computed, never stored)

### Overdue flag (per issue)
An issue assigned to the user is **Overdue** when:
- `dueDate` is non-null **and**
- `dueDate < today (YYYY-MM-DD)` **and**
- `status !== "Closed"`.

No due date → never Overdue. Overdue is an overlapping subset of
Open/In Progress (FR-004; the three stat values may sum to more than the
total).

### MyIssuesOverview (per user, per request)
```
{
  total: number,                 // all assigned issues, all statuses (SC-002 anchor)
  byStatus: { Open, "In Progress", Closed },   // counts, always all statuses
  overdue: number,               // derived count (subset of Open/In Progress)
}
```
The overview always counts **all statuses** so that the stat strip and the
ledger-with-closed agree with the total (FR-010, SC-002), regardless of the
list's active-only default.

### Sort order (assumption, documented)
1. Overdue first
2. `dueDate` ascending (earliest first; no-due-date last)
3. Priority: Urgent → High → Medium → Low
4. Title (case-insensitive)

Deterministic tiebreak; applied after enrichment, before response assembly.

### Scope filter (FR-011)
- Default (`includeClosed=false`): `status ∈ {Open, In Progress}`.
- `includeClosed=true`: all statuses.

---

## New Contract Types (`shared/index.ts`)

```ts
export interface MyIssue extends Issue {
  workspaceId: string;      // used for the issue-detail link (FR-006)
  projectName: string;      // row context (FR-005, SC-003)
  workspaceName: string;    // row context (FR-005, SC-003)
}

export interface MyIssuesOverview {
  total: number;
  byStatus: Record<IssueStatus, number>;
  overdue: number;
}

export interface MyIssuesResponse {
  overview: MyIssuesOverview;
  items: MyIssue[];
}
```

### Why `MyIssue extends Issue`
The shared `Issue` type already carries everything a ledger row needs
(`id`, `projectId`, `title`, `description`, `status`, `priority`,
`assigneeId`, `assignee`, `labelIds`, `labels`, `dueDate`). Extending it
preserves type safety (constitution III) and lets the frontend reuse its
existing ledger rendering. The three added fields are the only information
that does not exist on an ordinary issue payload today.

---

## Validation Rules

- `includeClosed` query flag: accepted values `"true"` | `"false"`; anything
  else → 422 VALIDATION. Default `false`.
- No other input. The endpoint is read-only (no body, no writes).

## State Transitions

None. My Issues introduces no state transitions and no mutations; it is a pure
read path over existing data.
