# Data Model: UI Redesign — Presentation Mapping

**Branch**: `002-ui-redesign` | **Date**: 2026-08-15

Phase 1 output for [plan.md](plan.md).

## Scope Statement

This feature is presentation-only. The application's data model, storage layer,
validation rules, and state transitions are **unchanged** from feature 001. The
authoritative data model is
[`specs/001-mini-issue-tracker/data-model.md`](../001-mini-issue-tracker/data-model.md);
this document maps each existing entity and field to its redesigned presentation
surface so that the UI redesign can be verified as complete and non-destructive
(FR-049, SC-001, SC-002).

## No Data Changes

- No tables, columns, relationships, or validation rules change.
- No migrations are required. No new entities are introduced.
- The API contract is unchanged (see
  [`specs/001-mini-issue-tracker/contracts/api.md`](../001-mini-issue-tracker/contracts/api.md)).
- Shared TypeScript types (`shared/index.ts`) are unchanged.

## Presentation Mapping

### User

| Field | Presentation in redesigned UI |
|-------|-------------------------------|
| id | Internal; never shown directly |
| email | Shown in the app header user identity; used as the assignee option label in issue forms |
| createdAt / updatedAt | Not currently surfaced; unchanged |

Surfaces: header identity (FR-008), auth pages (sign-in/sign-up identity),
assignee selector options (FR-031).

### Workspace

| Field | Presentation in redesigned UI |
|-------|-------------------------------|
| id | Internal (route param `/workspaces/:id`) |
| name | Workspace page title and dashboard list rows |
| ownerId | Determines Owner vs Member tag on dashboard rows (FR-013) |
| isOwner | Drives the Owner/Member badge and owner-only invitation controls (FR-013) |

Surfaces: dashboard workspace list (FR-013–FR-015), workspace page (FR-017),
invitations area (owner-only generate) (FR-014).

### Membership

No direct presentation; drives whether a workspace appears in a user's list and
whether the user is an owner or member. Unchanged.

### Invitation

| Field | Presentation in redesigned UI |
|-------|-------------------------------|
| token | Join input placeholder + read-only generated token display; long tokens must wrap or truncate without breaking layout (edge case) |
| expiresAt | Error message on invalid/expired join (server-driven); unchanged behavior |

Surfaces: join-workspace flow and owner "generate invitation" control (FR-014).

### Project

| Field | Presentation in redesigned UI |
|-------|-------------------------------|
| id | Internal (selects the issue list) |
| workspaceId | Internal (route scope) |
| name | Project list rows; rename input; active-selection label above the issue list |

Surfaces: project list with clear selected state (FR-017), create/rename/delete
(FR-018), active-project indication (FR-021), issue scope indicator.

### Issue

| Field | Presentation in redesigned UI |
|-------|-------------------------------|
| id | Internal (route param) |
| projectId | Internal (scope of the list) |
| title | Issue list row title + issue detail heading; long titles wrap/truncate gracefully |
| description | Issue detail description block (pre-wrap) |
| status | Badge in list and detail; selector on detail (immediate save-on-change, FR-028); dashboard stat buckets |
| priority | Badge in list and detail; selector on detail (FR-028); dashboard stat buckets |
| assigneeId | Detail metadata line + form selector (labels "Unassigned" when empty) |
| labelIds | Form label chips + detail metadata |
| dueDate | Detail metadata line ("No due date" when empty) |

Surfaces: issue list (FR-020), issue detail (FR-027), issue form (FR-031),
dashboard statistics (FR-016).

### Comment

| Field | Presentation in redesigned UI |
|-------|-------------------------------|
| id | Internal |
| issueId | Internal |
| authorId | Comment metadata (email) on the thread |
| body | Comment body text |
| createdAt | Comment timestamp (localized) |

Surfaces: issue detail comment thread + add-comment form (FR-029).

### Label

| Field | Presentation in redesigned UI |
|-------|-------------------------------|
| id | Internal |
| workspaceId | Internal (workspace-scoped) |
| name | Form label chips (checkbox toggles) + issue detail metadata |

Surfaces: issue form label picker + issue detail (FR-031, FR-027).

## Validation Rules (unchanged, presentation affects display only)

All validation and business rules from feature 001 remain authoritative. The
redesign only changes how violations are surfaced:

- Field-level validation errors from the API (`fields` map) MUST be shown against
  the matching form fields (FR-038).
- Destructive actions (delete project, delete issue) require in-app confirmation
  describing the consequence (FR-041); the underlying deletion rule is unchanged.

## State Transitions (unchanged)

Issue status transitions (Open → In Progress → Closed, plus re-open) are unchanged;
the UI presents them via the status selector and badges without altering the
transition rules.