# API Contract: Mini Issue Tracker

**Branch**: `001-mini-issue-tracker` | **Date**: 2026-08-14

The web application's external interface is a JSON REST API consumed by the
React SPA. All endpoints are JSON; errors follow a single shape (see
[#errors](#errors)). Auth is session-cookie based.

Base path: `/api`.

## Conventions

- **Authentication**: Required on all endpoints except `POST /auth/signup`,
  `POST /auth/signin`. Unauthenticated requests → `401`.
- **Authorization**: Workspace-scoped resources require membership; membership
  management requires the workspace owner → `403` otherwise (FR-003,
  FR-003a).
- **Pagination**: List endpoints accept `?page=1&pageSize=50` and return
  `{ items, page, pageSize, total }`.
- **Validation**: Invalid bodies → `422` with a field-error map (FR-013).

## Auth

### POST /auth/signup

Create an account (FR-001).

Request: `{ "email": string, "password": string }`

Rules: email required/valid/unique; password required, minimum 8 characters.

Response `201`: `{ "user": { "id", "email" } }` (creates a session).

### POST /auth/signin

Sign in (FR-002).

Request: `{ "email": string, "password": string }`

Response `200`: `{ "user": { "id", "email" } }` (rotates session id).

Error `401`: invalid credentials.

### POST /auth/signout

Sign out (FR-002). Response `204`.

### GET /auth/me

Return the current user (used by SPA on load).

Response `200`: `{ "user": { "id", "email" } }`.

## Workspaces

### POST /workspaces

Create a workspace (FR-004). Request: `{ "name": string }`. Response `201`:
`{ "workspace": Workspace }`.

### GET /workspaces

List workspaces the user owns or belongs to (FR-003).

Response `200`: `{ "items": Workspace[] }`.

### POST /workspaces/:id/invitations

Owner only. Generate a join invitation (FR-005).

Response `201`: `{ "invitation": { "token": string, "expiresAt": string } }`.

### POST /workspaces/join

Join a workspace with a valid invitation (FR-005). Must be signed in.

Request: `{ "token": string }`.

Response `200`: `{ "workspace": Workspace }`.

Error `422`: invalid, expired, or already-used invitation.

### DELETE /workspaces/:id/members/:userId

Owner only. Remove a member (FR-005). Response `204`. The owner cannot be
removed (edge case).

## Projects

### POST /workspaces/:workspaceId/projects

Member. Create a project (FR-006). Request: `{ "name": string }`. Response
`201`: `{ "project": Project }`.

### GET /workspaces/:workspaceId/projects

Member. List projects (FR-006). Response `200`: `{ "items": Project[] }`.

### PATCH /projects/:id

Member. Rename a project (FR-006). Request: `{ "name": string }`. Response
`200`: `{ "project": Project }`.

### DELETE /projects/:id

Member. Delete a project and its issues (FR-006, FR-014). Response `204`.

## Issues

### POST /projects/:projectId/issues

Member. Create an issue (FR-007, FR-008).

Request:

```json
{
  "title": "string (required)",
  "description": "string?",
  "status": "Open | In Progress | Closed",
  "priority": "Low | Medium | High | Urgent",
  "assigneeId": "uuid?",
  "labelIds": ["uuid"],
  "dueDate": "yyyy-mm-dd?"
}
```

Response `201`: `{ "issue": Issue }`.

### GET /projects/:projectId/issues

Member. List issues (FR-008).

Query params (FR-010, FR-011): `search`, `status`, `priority`, `assigneeId`,
`labelId`, `page`, `pageSize`. Filters combine with AND.

Response `200`: `{ "items": Issue[], "page", "pageSize", "total" }`.

### GET /issues/:id

Member. View an issue (FR-008).

Response `200`: `{ "issue": Issue, "comments": Comment[] }`.

### PATCH /issues/:id

Member. Edit any issue field (FR-008). Request: partial of the create shape.
Response `200`: `{ "issue": Issue }`.

### DELETE /issues/:id

Member. Delete an issue (FR-008, FR-014). Response `204`.

## Comments

### POST /issues/:issueId/comments

Member. Add a comment (FR-009). Request: `{ "body": string (required) }`.
Response `201`: `{ "comment": Comment }`.

## Dashboard

### GET /workspaces/:id/dashboard

Member. Issue statistics across the workspace's projects (FR-012).

Response `200`:

```json
{
  "byStatus": { "Open": 12, "In Progress": 3, "Closed": 40 },
  "byPriority": { "Low": 10, "Medium": 20, "High": 15, "Urgent": 10 },
  "total": 55
}
```

## Shared Shapes

- **Workspace**: `{ "id", "name", "ownerId", "isOwner": boolean }`
- **Project**: `{ "id", "workspaceId", "name" }`
- **Issue**: `{ "id", "projectId", "title", "description", "status",
  "priority", "assigneeId", "labelIds", "dueDate" }`
- **Comment**: `{ "id", "issueId", "authorId", "body", "createdAt" }`

## Errors

All errors share one shape:

```json
{
  "error": { "code": "VALIDATION|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT", "message": "string", "fields": {} }
}
```

- `401` UNAUTHORIZED — not signed in.
- `403` FORBIDDEN — not a member or not the owner.
- `404` NOT_FOUND — resource does not exist or is not accessible.
- `409` CONFLICT — duplicate workspace name, duplicate email.
- `422` VALIDATION — invalid input with per-field messages.

## Cross-Cutting Rules

- All list/scoped queries are bound to the authenticated user's memberships
  (IDOR prevention).
- Mass assignment prevented: only allowlisted fields are accepted on create
  and update.
- Destructive operations (project/issue delete) may require a confirmation
  flag in the SPA before the request is sent (FR-014); the API always deletes
  on receipt.