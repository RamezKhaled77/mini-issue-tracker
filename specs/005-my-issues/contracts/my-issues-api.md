# API Contract: `GET /api/my-issues`

**Feature**: 005-my-issues | **Status**: Proposed | **Spec**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

The personal, cross-workspace workload endpoint. Returns the summary counts and
the sorted ledger of issues assigned to the signed-in user, across every
workspace they can reach (owned ∪ member), plus per-row project/workspace
context.

## Endpoint

```
GET /api/my-issues
```

## Authentication

Required. A valid session cookie must be present.

| Condition | Status | Body |
|-----------|--------|------|
| No valid session | 401 | `{ "error": { "code": "UNAUTHORIZED", "message": "Not signed in" } }` |

This endpoint is user-scoped: there is no workspace path parameter and no
permission check beyond authentication, because the result set is derived from
the caller's own identity and memberships. A caller can never see another
user's issues through this endpoint (isolation is enforced by
`assigneeId = caller`).

## Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `includeClosed` | `"true"` \| `"false"` | no | `"false"` | When `false` (default), `items` contains only the caller's Open and In Progress issues. When `true`, `items` contains every assigned issue (Open, In Progress, Closed). The `overview` always reflects all statuses regardless of this flag. |

Validation: any other value (e.g. `includeClosed=yes`, `includeClosed=1`) →
422:

```json
{ "error": { "code": "VALIDATION", "message": "Invalid query", "fields": { "includeClosed": "..." } } }
```

> Implementation note: parse the flag as an explicit `"true"`/`"false"` enum
> and map to a boolean. Do **not** use `z.coerce.boolean()` — it would coerce
> the literal string `"false"` to `true`.

## Response — `200 OK`

```json
{
  "overview": {
    "total": 12,
    "byStatus": { "Open": 7, "In Progress": 4, "Closed": 1 },
    "overdue": 2
  },
  "items": [
    {
      "id": "8f1a...",
      "projectId": "proj-a",
      "title": "Fix checkout retry",
      "description": "Retry loop drops the last request.",
      "status": "In Progress",
      "priority": "Urgent",
      "assigneeId": "u1",
      "assignee": { "id": "u1", "name": "Alice Smith" },
      "labelIds": ["lbl-1"],
      "labels": [{ "id": "lbl-1", "workspaceId": "ws-1", "name": "bug", "color": "coral" }],
      "dueDate": "2026-08-18",
      "workspaceId": "ws-1",
      "projectName": "App One",
      "workspaceName": "Team Alpha"
    }
  ]
}
```

### `overview`

| Field | Type | Meaning |
|-------|------|---------|
| `total` | number | Every issue assigned to the caller across all statuses (anchor for "N assigned to you"). |
| `byStatus` | `Record<"Open" \| "In Progress" \| "Closed", number>` | Counts over the same all-status scope. Keys match the shared `ISSUE_STATUSES` enum so the frontend can reuse its existing status mapping. |
| `overdue` | number | Derived count: assigned issues with `dueDate < today` and `status !== "Closed"`. Overlaps Open/In Progress (may exceed the sum of the two). |

### `items[]` (each element is a `MyIssue`)

| Field | Type | Source |
|-------|------|--------|
| All `Issue` fields | as shared `Issue` | `issues` row + existing label/assignee enrichment (`labelIds`, `labels`, `assignee`). |
| `workspaceId` | string | `projects.workspaceId` — also used to build the issue-detail link. |
| `projectName` | string | `projects.name`. |
| `workspaceName` | string | `workspaces.name`. |

### `items` ordering

Stable sort, applied server-side, before response assembly:

1. Overdue first
2. `dueDate` ascending (earliest first; no-due-date last)
3. Priority: Urgent → High → Medium → Low
4. Title (case-insensitive)

## Edge Semantics

- **No assigned issues**: `overview.total = 0`, all `byStatus` values `0`,
  `overdue = 0`, `items = []` (frontend renders the empty state).
- **Only Closed issues assigned, `includeClosed=false`**: `overview` still
  reports the real totals; `items` is empty (default view) — the frontend
  shows the "no active issues" empty state and the "Include closed" control
  reveals the items.
- **User in no workspaces**: same zeroed response as "no assigned issues"
  (no membership rows ⇒ no project ids ⇒ no issue rows).
- **Overdue**: never includes no-due-date issues; never includes Closed.

## Consistent With Existing Conventions

- Success/error shapes match the existing API (`ApiErrorShape` in
  `shared/index.ts`; errors thrown through the app error middleware).
- Response is wrapped in a plain JSON object like other read endpoints
  (e.g. `GET /workspaces/:id/dashboard` returns its payload directly; this
  endpoint returns `{ overview, items }`).
- The frontend accesses it as `api.get<MyIssuesResponse>("/my-issues")` and
  `api.get<MyIssuesResponse>("/my-issues?includeClosed=true")` (the `api`
  client prefixes `/api`).