# Data Model: User Display Name — Mini Issue Tracker

**Branch**: `003-user-display-name` | **Date**: 2026-08-15

Phase 1 output for [plan.md](plan.md). Derives the entity/attribute changes from
[spec.md](spec.md). Storage is SQLite via Drizzle ORM (see
[research.md](research.md)); the authoritative base model is
[`specs/001-mini-issue-tracker/data-model.md`](../001-mini-issue-tracker/data-model.md).
All relationships and entities are **unchanged** from feature 001 except the
single additive attribute below and the identity projections described here.

## Entities

### User (changed — one additive attribute)

Represents an account that signs in and belongs to workspaces.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | Primary key |
| email | string | Unique, normalized lowercase, valid email format (unchanged; remains the account identifier) |
| passwordHash | string | Argon2id hash; never stored in plaintext (unchanged) |
| **name** | **string \| null** | **NEW, nullable.** Required, non-empty for newly created accounts; may remain `null` only for accounts created before this feature. Stored trimmed; max 100 characters. NEVER backfilled. |
| createdAt | timestamp | Set on creation (unchanged) |
| updatedAt | timestamp | Updated on changes (unchanged) |

Display-name resolution: at serialization time the API returns the **resolved
display name** — the stored `name`, or a deterministic fallback derived from
the email **local-part** (characters before `@`) when `name` is null. The
fallback is presentation-time only; it is never written to the database and is
never treated as the stored display name (FR-012, NFR-005, SC-008). See
[contracts/identity.md](contracts/identity.md).

Relationships: unchanged (owns 0..n Workspaces, member of 0..n Workspaces via
Membership, assignee of 0..n Issues, author of 0..n Comments).

### Workspace, Project, Label, IssueLabel, Invitation (unchanged)

No attribute or relationship changes.

### Issue (unchanged attributes; additive assignee identity projection)

| Field | Type | Rules |
|-------|------|-------|
| … (all existing fields) | — | Unchanged (title, description, status, priority, assigneeId, labelIds, dueDate, timestamps) |
| **assignee** (API projection, NOT a column) | `{ id, name } \| null` | **NEW additive.** Derived at serialization from `assigneeId` LEFT JOIN `users`. `null` when unassigned; otherwise the assignee's resolved display name. `assigneeId` is preserved unchanged. |

The `users` row referenced by `assigneeId` provides the id, stored name, and
email (email only to compute the fallback; it is not exposed).

### Comment (unchanged attributes; additive author identity projection)

| Field | Type | Rules |
|-------|------|-------|
| … (all existing fields) | — | Unchanged (id, issueId, authorId, body, createdAt) |
| **author** (API projection, NOT a column) | `{ id, name }` | **NEW additive.** Derived at serialization from `authorId` LEFT JOIN `users`. Always present (authorId is NOT NULL); carries the author's resolved display name. `authorId` is preserved unchanged. |

### Membership (unchanged; additive member identity in the projection)

| Field | Type | Rules |
|-------|------|-------|
| … (userId, workspaceId, joinedAt) | — | Unchanged |
| **name** (API projection, NOT a column) | string | **NEW additive** in the `listMembers` projection: `{ userId, email, name }`. Resolved display name of each member. |

## Identity Primitive

A single reusable shape used for assignees and comment authors (FR-013):

```ts
interface Identity {
  id: string;   // the user id (equals assigneeId / authorId)
  name: string; // resolved display name (stored name, or email-local-part fallback)
}
```

Members use the existing flat shape with an additive field:
`{ userId: string, email: string, name: string }`. This asymmetry is
intentional (preserves the members endpoint contract) and documented in the
spec's Risks/Open Questions and in [contracts/identity.md](contracts/identity.md).

## Validation Rules

- **User name**: required at signup, trimmed, non-empty, max 100 characters;
  validated by `signupSchema` per the exact zod convention
  `z.string().trim().min(1, "Full name is required").max(100)`. Backend
  validation is authoritative (422 field error on `name`). No other entity's
  validation changes.
- The name is display information only: it is NOT used for uniqueness, lookup,
  authentication, or authorization. Email remains the identifier.

## State Transitions

Unchanged. Issue status transitions, invitation lifecycle, and session
lifecycle are unaffected by this feature (NFR-001).

## Relationships Overview

```text
User ──assignee/author──> (identity projection) { id, name }
users.name ◄──LEFT JOIN── issues.assigneeId / comments.authorId
users.name ◄──LEFT JOIN── memberships.userId (listMembers projection)
```

## Scale Assumptions

Unchanged from feature 001 (~25 members/workspace, ~1,000 issues/project, ~10
workspaces/user). The added LEFT JOINs are indexed PK lookups on `users.id`
with negligible cost within the feature-001 performance budget (NFR-002).