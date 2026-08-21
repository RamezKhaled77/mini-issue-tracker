# Implementation Plan — Spec 006: Activity History

## Phase 0: Preparation

- [ ] Create migration file `backend/src/db/migrations/0004_activities.sql`
- [ ] Add `Activity`, `ActivityType`, `ActivityField`, `ActivityListResponse` to `shared/index.ts`
- [ ] Update `backend/src/db/schema.ts` with activities table

## Phase 1: Database & Domain

### 1.1 Migration (0004_activities.sql)
```sql
CREATE TABLE activities (
  id TEXT PRIMARY KEY NOT NULL,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  field TEXT,
  from_value TEXT,
  to_value TEXT,
  label_ids TEXT,
  label_names TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX activities_issue_idx ON activities (issue_id);
CREATE INDEX activities_actor_idx ON activities (actor_id);
CREATE INDEX activities_created_idx ON activities (created_at DESC);
```

### 1.2 Schema (`backend/src/db/schema.ts`)
- Add `activities` table definition with drizzle-orm
- Export `activities` and `ActivitySelect` types

### 1.3 Domain (`backend/src/domain/activity.ts`)
- `createActivityRecord()` — builds activity entity
- `truncateDescription()` — helper for description field (200 chars)
- `resolveActorName()` — reuses `resolveDisplayName` from identity.ts

## Phase 2: Activity Service

### 2.1 Service (`backend/src/services/activity.ts`)
```typescript
interface ActivityServiceDeps { db: Db; membershipService: MembershipService }

function createActivityService(deps) {
  // recordActivity(issueId, actorId, type, options?)
  // listActivities(issueId, userId, { page, pageSize })
  // getActorName(userId) - joins users table
}
```
- `recordActivity`: inserts single activity row (called from issueService within transaction)
- `listActivities`: paginated, reverse-chronological, enriches actorName, resolves assignee IDs to names
- Authorization: `membershipService.requireMember(userId, workspaceId)` via issue → project → workspace

### 2.2 Wire into `backend/src/api/routes/index.ts`
- Create `createActivityService` in registerRoutes
- Pass to issueRoutes (for recording) and new activityRoutes

## Phase 3: Issue Service Integration

### 3.1 Modify `backend/src/services/issue.ts`

**Create Issue:**
```typescript
function createIssue(projectId, input, userId) {
  return db.transaction(() => {
    const issue = createIssueRecord(...);
    db.insert(issues).values(issue).run();
    activityService.recordActivity(issue.id, userId, "issue.created");
    return issue;
  });
}
```

**Update Issue:**
```typescript
function updateIssue(id, input, userId) {
  return db.transaction(() => {
    const before = getIssue(id); // with labels
    const updated = doUpdate(id, input); // existing logic
    const after = getIssue(id);
    recordChanges(before, after, userId);
    return updated;
  });
}

function recordChanges(before, after, actorId) {
  const changes = diffIssue(before, after);
  for (const change of changes) {
    activityService.recordActivity(issueId, actorId, "issue.updated", {
      field: change.field,
      from: change.from,
      to: change.to
    });
  }
  // Handle labels separately
  if (before.labelIds !== after.labelIds) {
    const added = after.labelIds.filter(id => !before.labelIds.includes(id));
    const removed = before.labelIds.filter(id => !after.labelIds.includes(id));
    if (added.length) recordLabelsAdded(added, actorId);
    if (removed.length) recordLabelsRemoved(removed, actorId);
  }
}
```

**Delete Issue:**
```typescript
function deleteIssue(id, userId) {
  return db.transaction(() => {
    const issue = getIssue(id);
    activityService.recordActivity(id, userId, "issue.deleted");
    db.delete(issues).where(eq(issues.id, id)).run();
  });
}
```

### 3.2 Diff Logic
- Compare each field: status, priority, assigneeId, dueDate, title, description
- Only emit if `before !== after` (strict equality, null handling)
- For description: store truncated (200 chars) in from/to
- For assignee: store user ID, resolve to name at read time

## Phase 4: API Routes

### 4.1 Validators (`backend/src/api/validators/activity.ts`)
```typescript
export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
```

### 4.2 Routes (`backend/src/api/routes/activities.ts`)
```typescript
router.get("/issues/:id/activity", (req, res) => {
  const userId = requireAuth(req);
  const parsed = activityQuerySchema.safeParse(req.query);
  const { items, total } = activityService.listActivities(req.params.id, userId, parsed.data);
  res.json({ items, page: parsed.data.page, pageSize: parsed.data.pageSize, total });
});
```

### 4.3 Wire into `backend/src/api/routes/index.ts`
- Import `activityRoutes`
- Register at `/api` (same as other routes)

## Phase 5: Frontend — Types & API Client

### 5.1 Types (`frontend/src/types/activity.ts` or extend shared)
- Mirror shared types for Activity, ActivityListResponse

### 5.2 API Client (`frontend/src/api/client.ts`)
```typescript
export const api = {
  // ...existing
  getActivity: (issueId, params) => 
    get<ActivityListResponse>(`/issues/${issueId}/activity`, params)
};
```

## Phase 6: Frontend — Components

### 6.1 ActivityRow (`frontend/src/components/ActivityRow.tsx`)
- Props: `activity: Activity`
- Renders single ruled row
- Visual variants per type:
  - `issue.created`: petrol dot + "Created issue"
  - `issue.updated`: monospace field + "from → to"
  - `issue.labels_added`: "Added labels" + Badge chips
  - `issue.labels_removed`: "Removed labels" + Badge chips (strikethrough)
  - `issue.deleted`: coral dot + "Deleted issue"
- Timestamp: `<time dateTime={iso}>{relativeOrAbsolute}</time>`
- Actor name: strong, with fallback to "Someone"

### 6.2 ActivityList (`frontend/src/components/ActivityList.tsx`)
- Props: `issueId`, `initialItems`, `initialTotal`, `initialPage`
- State: items, page, loading, hasMore
- Load more button (calls api.getActivity with page+1, appends)
- EmptyState when 0 items
- SkeletonRows while loading initial

### 6.3 ActivityPanel (`frontend/src/components/ActivityPanel.tsx`)
- Wrapper with section eyebrow "Activity"
- Renders ActivityList
- Consistent spacing with comments section

## Phase 7: Frontend — IssuePage Integration

### 7.1 Modify `frontend/src/pages/IssuePage.tsx`
- Add `import { ActivityPanel } from "../components/ActivityPanel"`
- Add state: `activityItems`, `activityPage`, `activityTotal`, `activityLoading`
- Add `loadActivity()` function (page 1)
- Insert `<ActivityPanel>` between comments list and comment composer
- Pass `issueId`, initial data from load
- Add "Load more" handling

### 7.2 CSS (`frontend/src/styles/components.css`)
- `.activity-panel` — section spacing matching comments
- `.activity-list` — ruled rows (`border-top: var(--rule)`)
- `.activity-row` — flex layout, gap, padding `var(--space-3) var(--space-4)`
- `.activity-actor` — `font-weight: 600`, `color: var(--text-strong)`
- `.activity-action` — `color: var(--text)`
- `.activity-meta` — `color: var(--text-muted)`, `font-variant-numeric: tabular-nums`
- `.activity-field` — `font-family: var(--font-mono)`, `font-size: var(--text-sm)`
- `.activity-arrow` — `color: var(--text-muted)`
- `.activity-labels` — flex wrap, gap `var(--space-1)`
- `.activity-dot` — width/height 6px, border-radius 50%
- `.activity-dot--created` — `background: var(--petrol)`
- `.activity-dot--deleted` — `background: var(--coral)`
- Mobile: `.activity-row` flex-wrap, timestamp wraps below action
- Reduced motion: no transitions on load

## Phase 8: Tests

### 8.1 Backend Unit (`backend/tests/unit/activity.test.ts`)
- `recordActivity` inserts correct row
- `listActivities` paginates correctly
- `listActivities` enriches actorName
- `listActivities` resolves assignee IDs to names
- Authorization: non-member gets 403

### 8.2 Backend Integration (`backend/tests/integration/activity.test.ts`)
- Create issue → activity recorded
- Update status → activity recorded with from/to
- Update priority → activity recorded
- Update assignee → activity recorded (IDs resolved to names)
- Update due date → activity recorded (null handling)
- Update title → activity recorded
- Update description → activity recorded (truncated)
- Add labels → labels_added event with names
- Remove labels → labels_removed event with names
- No-op update → no activity
- Delete issue → activity recorded + CASCADE delete
- Pagination: page 1, page 2, empty page
- Non-member cannot access

### 8.3 Frontend Component Tests (if test setup exists)
- ActivityRow renders each type correctly
- ActivityList loads more on button click
- EmptyState shows when no activity
- Skeleton shows while loading

## Phase 9: Verification

### 9.1 Commands to run
```bash
# Backend
cd backend && npm run test          # all tests pass
npm run typecheck                   # no TS errors
npm run lint                        # no lint errors
npm run build                       # builds successfully

# Frontend
cd frontend && npm run test         # if tests exist
npm run typecheck
npm run lint
npm run build

# Full stack
npm run db:migrate                  # applies 0004_activities.sql
npm run dev                         # manual smoke test
```

### 9.2 Manual Smoke Test Checklist
- [ ] Create issue → see "Created issue" in activity
- [ ] Change status → see "Status: Open → In Progress"
- [ ] Change priority → see "Priority: Medium → High"
- [ ] Assign user → see "Assignee: Unassigned → Name"
- [ ] Set due date → see "Due date: — → 2026-09-01"
- [ ] Clear due date → see "Due date: 2026-09-01 → —"
- [ ] Edit title → see "Title: old → new"
- [ ] Edit description → see truncated diff
- [ ] Add label → see label chip added
- [ ] Remove label → see label chip removed (strikethrough)
- [ ] Load more → older items append
- [ ] Non-member → 403 on activity endpoint
- [ ] Mobile layout → stacks correctly, touch targets 44px
- [ ] Reduced motion → no animations
- [ ] Keyboard nav → focus order correct

## Phase 10: Documentation Update

- [ ] Update `VISUAL_LANGUAGE.md` if new patterns introduced (ActivityRow, label strikethrough)
- [ ] Add activity types to shared types documentation

## File Summary

**New files:**
- `backend/src/db/migrations/0004_activities.sql`
- `backend/src/domain/activity.ts`
- `backend/src/services/activity.ts`
- `backend/src/api/validators/activity.ts`
- `backend/src/api/routes/activities.ts`
- `frontend/src/components/ActivityRow.tsx`
- `frontend/src/components/ActivityList.tsx`
- `frontend/src/components/ActivityPanel.tsx`
- `backend/tests/unit/activity.test.ts`
- `backend/tests/integration/activity.test.ts`

**Modified files:**
- `shared/index.ts` — add Activity types
- `backend/src/db/schema.ts` — add activities table
- `backend/src/services/issue.ts` — integrate activity recording
- `backend/src/api/routes/index.ts` — wire activity service + routes
- `frontend/src/api/client.ts` — add getActivity
- `frontend/src/pages/IssuePage.tsx` — integrate ActivityPanel
- `frontend/src/styles/components.css` — activity styles
- `VISUAL_LANGUAGE.md` — if new patterns documented

## Dependencies Between Phases

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
                                              ↓
Phase 5 → Phase 6 → Phase 7 ← Phase 8 (tests parallel)
                                              ↓
                                        Phase 9 → Phase 10
```

## Estimated Effort

| Phase | Backend | Frontend | Total |
|-------|---------|----------|-------|
| 0-1   | 2h      | 0.5h     | 2.5h  |
| 2     | 1.5h    | -        | 1.5h  |
| 3     | 2h      | -        | 2h    |
| 4     | 1h      | -        | 1h    |
| 5     | -       | 0.5h     | 0.5h  |
| 6     | -       | 2h       | 2h    |
| 7     | -       | 1h       | 1h    |
| 8     | 2h      | 1h       | 3h    |
| 9     | -       | -        | 1h    |
| 10    | -       | -        | 0.5h  |
| **Total** | **8.5h** | **5h** | **13.5h** |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Transaction complexity in issueService | Use `db.transaction()` callback pattern; test thoroughly |
| Assignee name resolution at read time | Join users table in listActivities; cache if needed |
| Label name denormalization | Store labelNames JSON at write time (avoids N+1 reads) |
| Description truncation loss | Document 200-char limit; full history in DB if needed later |
| Mobile layout regression | Test at 320px, 375px, 768px, 1024px, 1440px |
| Performance on high-activity issues | Index on (issue_id, created_at DESC); pageSize max 100 |