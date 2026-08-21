# Spec 006 — Activity History (Issue Audit Trail)

## 1. Summary

Add a lightweight, immutable audit trail to issues showing **what changed, who changed it, and when**. Activity is system-generated (not user-authored like comments) and records only actual value changes from mutations — create, status, priority, assignee, due date, title, description, labels.

## 2. Motivation

- Users need to understand issue history without reading every comment
- Debugging: "Who changed the status to Closed and when?"
- Accountability: track assignments, priority escalations, due date shifts
- Foundation for future features (notifications, SLAs, retrospectives)

## 3. Scope (Stage 1)

**In scope:**
- New `activities` table with event records
- Activity events for all issue field mutations + label assignments
- API endpoint: `GET /api/issues/:id/activity` (paginated, reverse-chronological)
- Frontend: Activity panel in Issue Detail page (below Comments, above composer)
- Transactional consistency: activity recorded in same DB transaction as mutation
- Authorization: reuse existing membership checks (project access)

**Out of scope (explicitly deferred):**
- Organization-wide audit log
- Realtime/push updates
- Notifications/email digests
- Activity on comments (create/edit/delete)
- Activity on projects, workspaces, labels, users
- Filtering/grouping UI (v1 = flat list)
- Export/CSV
- Actor avatar in activity (text name only for v1)

## 4. Event Types

| Event Type | Trigger | Payload Fields |
|------------|---------|----------------|
| `issue.created` | POST `/projects/:projectId/issues` | — |
| `issue.updated` | PATCH `/issues/:id` (any field) | `field`, `from`, `to` |
| `issue.labels_added` | PATCH `/issues/:id` with `labelIds` | `labelIds[]`, `labelNames[]` |
| `issue.labels_removed` | PATCH `/issues/:id` with `labelIds` | `labelIds[]`, `labelNames[]` |
| `issue.deleted` | DELETE `/issues/:id` | — |

**Note:** `issue.updated` fires once per mutation request, with one entry per changed field. If a single PATCH changes status + priority + assignee, three `issue.updated` records are created.

## 5. Data Model

```sql
CREATE TABLE activities (
  id TEXT PRIMARY KEY NOT NULL,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                    -- 'issue.created' | 'issue.updated' | 'issue.labels_added' | 'issue.labels_removed' | 'issue.deleted'
  field TEXT,                            -- for 'issue.updated': 'status' | 'priority' | 'assignee' | 'due_date' | 'title' | 'description'
  from_value TEXT,                       -- previous value (null for create)
  to_value TEXT,                         -- new value (null for delete)
  label_ids TEXT,                        -- JSON array for label events
  label_names TEXT,                      -- JSON array for label events (denormalized for display)
  created_at INTEGER NOT NULL            -- unix ms
);

CREATE INDEX activities_issue_idx ON activities (issue_id);
CREATE INDEX activities_actor_idx ON activities (actor_id);
CREATE INDEX activities_created_idx ON activities (created_at DESC);
```

**Field mapping for `issue.updated`:**
- `status` → `from_value`/`to_value` = status string
- `priority` → `from_value`/`to_value` = priority string
- `assignee` → `from_value`/`to_value` = user ID (resolve to name on read)
- `due_date` → `from_value`/`to_value` = YYYY-MM-DD or null
- `title` → `from_value`/`to_value` = string
- `description` → `from_value`/`to_value` = string (truncated to 200 chars in payload)

## 6. API

### GET `/api/issues/:id/activity`

**Auth:** Bearer token (workspace member)

**Query params:**
- `page` (default 1)
- `pageSize` (default 50, max 100)

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "issueId": "uuid",
      "actorId": "uuid",
      "actorName": "Display Name",
      "type": "issue.updated",
      "field": "status",
      "fromValue": "Open",
      "toValue": "In Progress",
      "labelIds": null,
      "labelNames": null,
      "createdAt": "2026-08-21T14:30:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 12
}
```

**Errors:**
- 401 UNAUTHORIZED
- 403 FORBIDDEN (not a project member)
- 404 NOT_FOUND (issue doesn't exist)

## 7. Frontend Integration

### Location
Issue Detail page (`/workspaces/:workspaceId/issues/:issueId`), inserted between:
- Comments list (existing)
- Comment composer (existing)

### Visual Treatment (per VISUAL_LANGUAGE.md)

- **Ruled rows** — consistent with comment list, ledger aesthetic
- **Hairline borders** — `var(--rule)` between rows
- **Typography hierarchy:**
  - Actor name: `var(--text-strong)` (semibold)
  - Action description: `var(--text)` (regular)
  - Timestamp: `var(--text-muted)` (monospace, tabular-nums)
- **Event type affordances:**
  - `issue.created` — petrol accent dot
  - `issue.updated` — field name in monospace, `from → to` with arrow
  - `issue.labels_added` — label chips (reuse Badge component)
  - `issue.labels_removed` — label chips with strikethrough
  - `issue.deleted` — coral accent dot (rare, shown in workspace context)
- **Empty state:** Reuse `EmptyState` component ("No activity yet")
- **Loading:** Reuse `SkeletonRows`
- **Pagination:** Simple "Load more" button (not infinite scroll)

### Responsive
- Desktop: side-by-side with fact rail (existing layout)
- Tablet/mobile: activity stacks below comments, full width
- Timestamp truncates to relative time on narrow (`2h ago`, `3d ago`)

### Accessibility
- Semantic `<ol>` for activity list
- Each row: `<article>` with `aria-label` describing the event
- Timestamps: `<time datetime="...">`
- Focus order: comments → activity → composer
- Reduced motion: no animations on load

## 8. Backend Integration Points

### Services to extend
1. **IssueService** — wrap mutations to capture before/after state, emit activity
2. **New ActivityService** — CRUD for activities, list with pagination
3. **IssueRoutes** — add `GET /issues/:id/activity` endpoint

### Transaction Strategy
```typescript
// In issueService.updateIssue:
return db.transaction(() => {
  const before = getIssue(id);
  const updated = doUpdate(id, input);
  const after = getIssue(id);
  recordActivity(before, after, actorId);
  return updated;
});
```

### Identity Enrichment
- `actorName` resolved via existing `resolveDisplayName(name, email)` at read time
- For assignee changes: resolve both `fromValue` and `toValue` user IDs to names

## 9. Shared Types (additions)

```typescript
// shared/index.ts
export type ActivityType =
  | "issue.created"
  | "issue.updated"
  | "issue.labels_added"
  | "issue.labels_removed"
  | "issue.deleted";

export type ActivityField =
  | "status"
  | "priority"
  | "assignee"
  | "due_date"
  | "title"
  | "description";

export interface Activity {
  id: string;
  issueId: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  field?: ActivityField;
  fromValue?: string | null;
  toValue?: string | null;
  labelIds?: string[] | null;
  labelNames?: string[] | null;
  createdAt: string; // ISO 8601
}

export interface ActivityListResponse {
  items: Activity[];
  page: number;
  pageSize: number;
  total: number;
}
```

## 10. Visual Language Compliance Checklist

- [ ] No new colors introduced (reuse petrol, coral, status/priority tokens)
- [ ] No new spacing values (use existing `--space-*` scale)
- [ ] No new border radii (use `--radius-sm` for chips, none for rows)
- [ ] No shadows/elevation (near-zero elevation preserved)
- [ ] Ruled rows, not cards (matches comment list, ledger rows)
- [ ] Monospace for ticket keys, timestamps, field names
- [ ] Strong actor name, quiet metadata
- [ ] Badge component reused for labels
- [ ] EmptyState component reused
- [ ] SkeletonRows reused for loading
- [ ] 44px touch targets on mobile
- [ ] Focus states preserved (reuse Button/Link focus rings)

## 11. Acceptance Criteria

1. Create issue → activity shows "Created issue" with actor + timestamp
2. Change status Open → In Progress → activity shows "Status: Open → In Progress"
3. Change priority Medium → High → activity shows "Priority: Medium → High"
4. Assign user → activity shows "Assignee: Unassigned → Jane Doe"
5. Set due date → activity shows "Due date: — → 2026-09-01"
6. Clear due date → activity shows "Due date: 2026-09-01 → —"
7. Edit title → activity shows "Title: [old] → [new]"
8. Edit description → activity shows "Description: [truncated old] → [truncated new]"
9. Add labels → activity shows label chips added
10. Remove labels → activity shows label chips removed (strikethrough)
11. Delete issue → activity recorded (visible in workspace context if implemented)
12. No activity for no-op updates (same value sent)
13. Activity ordered newest-first
14. Pagination works (page 2 loads older items)
15. Non-members cannot access activity (403)
16. Activity deleted when issue deleted (CASCADE)
17. Visual design matches VISUAL_LANGUAGE.md (ruled rows, typography, colors)
18. Responsive at all breakpoints
19. Keyboard navigable, screen reader friendly