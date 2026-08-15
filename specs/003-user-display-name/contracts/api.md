# API Contract Deltas: User Display Name — Mini Issue Tracker

**Branch**: `003-user-display-name` | **Date**: 2026-08-15

Phase 1 output for [plan.md](plan.md). This document describes the **deltas** to
the authoritative
[`specs/001-mini-issue-tracker/contracts/api.md`](../001-mini-issue-tracker/contracts/api.md)
introduced by feature 003. All endpoints, status codes, error shapes,
authentication, authorization, and pagination rules not listed here are
**unchanged**. Base path remains `/api`.

## New Identity Primitive

```ts
interface Identity {
  id: string;   // user id; equals assigneeId / authorId
  name: string; // resolved display name — stored name, or email-local-part fallback
}
```

- `name` is **always a non-empty string** in every safe user representation
  (the server resolves the fallback; it never returns null/empty names).
- `passwordHash` and session secrets are never present in any response.
- See [identity.md](identity.md) for the full primitive contract.

## Auth

### POST /auth/signup

Request gains `name` (**required**):

```json
{ "name": "string", "email": "string", "password": "string" }
```

Rules (additive): `name` required, trimmed, non-empty, max 100 characters.
Missing/blank/over-length → `422` with field error on `name`.

Response `201` gains `user.name`:

```json
{ "user": { "id", "email", "name" } }
```

### POST /auth/signin

Response `200` gains `user.name`: `{ "user": { "id", "email", "name" } }`.

### GET /auth/me

Response `200` gains `user.name`: `{ "user": { "id", "email", "name" } }`.

## Issues

All four issue endpoints (`POST /projects/:projectId/issues`,
`GET /projects/:projectId/issues`, `GET /issues/:id`, `PATCH /issues/:id`)
gain an additive `assignee` field on the `Issue` object:

```json
"assignee": { "id", "name" } | null
```

- `assignee` is `null` when the issue is unassigned (`assigneeId` null).
- `assigneeId` remains in the payload unchanged.
- Request bodies are unchanged (no new inputs).

## Comments

Both comment endpoints (`POST /issues/:issueId/comments`,
`GET /issues/:issueId/comments`) gain an additive `author` field on the
`Comment` object:

```json
"author": { "id", "name" }
```

- `author` is always present (`authorId` is NOT NULL).
- `authorId` remains in the payload unchanged.
- Request bodies are unchanged (only `body`).

## Workspaces

### GET /workspaces/:id/members

Each member gains an additive `name` field. The flat shape is preserved:

```json
{ "items": [ { "userId", "email", "name" }, … ] }
```

## Shared Shapes (TypeScript `shared/index.ts`)

Additive changes:

```ts
interface User { id: string; email: string; name: string }
interface Identity { id: string; name: string }
interface Issue { …; assignee: Identity | null }        // assigneeId preserved
interface Comment { …; author: Identity }               // authorId preserved
interface WorkspaceMember { userId: string; email: string; name: string }
interface SignupRequest { name: string; email: string; password: string }
```

## Error Behavior

Unchanged. Validation failures return `422` with the existing field-error map;
`name` reports its own field-level message. All other codes and rules are
unchanged.