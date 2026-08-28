# Spec 009 — Saved Views

## 1. Summary

Saved Views let a workspace member capture the current issue-filter configuration on
the **Workspace** ledger as a named, reusable filter preset, then restore it later in
one click. A Saved View is a **named, reusable filter configuration** — not a separate
issue list and not a copy of issues.

This is deliberately small. It does **not** add a second filtering model, a new page,
sharing/permissions, folders, analytics, or realtime. It attaches to the existing
per-project issue ledger and stores the **existing** filter representation the ledger
already sends to the server.

## 2. Motivation

Users repeatedly perform the same filtering operation: open a project, pick High
priority + a status + a label, scan, move on. Tomorrow they repeat it. Today each run
means re-police the same four controls. Saved Views collapse that to: *save once,
click the name later, see the filtered ledger immediately*.

The feature answers one question:

> "Which issues should I see?" — expressed as a named preset.

## 3. Research findings (implementation-grounded)

### 3.1 The two filter surfaces are NOT one shared model

The product currently has **two different** filter implementations:

1. **WorkspacePage (per-project, server-side).** Local React state
   (`search`, `statusFilter`, `priorityFilter`, `labelFilter`) plus a selected project
   row. Filters are serialized into **URL query params** on a single request:
   `GET /projects/:projectId/issues?search=&status=&priority=&labelId=`
   (`frontend/src/pages/WorkspacePage.tsx:76-87`). Backend validates via
   `issueQuerySchema` (`backend/src/api/validators/issue.ts:28-36`) and executes via
   `IssueService.listIssues` (`backend/src/services/issue.ts:160-249`).

2. **MyIssuesPage (cross-workspace, client-side).** Local state
   (`search`, `statusFilter`, `priorityFilter`, `sort`, `includeClosed`) applied
   **client-side** over the fully-fetched `MyIssuesResponse` list via
   `applyMyIssuesView()` (`frontend/src/lib/myIssuesView.ts:55-69`). It has its own
   model type (`MyIssuesView`), includes a **sort** key, and is implicitly scoped to
   "assigned to me" across every reachable workspace.

### 3.2 The canonical filter representation is `IssueQueryParams`

`shared/index.ts:201-209` defines the single convention both sides already agree on:

```
IssueQueryParams { search?, status?, priority?, assigneeId?, labelId?, page?, pageSize? }
```

This is exactly the payload `issueQuerySchema` validates and `listIssues` executes.
It is the model Saved Views should reuse — **not** `MyIssuesView` (which is a separate,
client-only shape).

### 3.3 What the workspace ledger actually exposes (v1 terminology)

The Workspace `filter-bar` renders **four functional controls**: text search, status
select, priority select, label select, plus the project selection in the left rail. The
backend also *accepts* `assigneeId`, but the Workspace ledger exposes **no** assignee
filter control today. There is **no** "overdue" filter predicate anywhere in the system
(`isOverdue` in `frontend/src/lib/isOverdue.ts` is derived for badges/sort only), and
**no** "unassigned" predicate (assignee is either a member UUID or absent; there is no
`assigneeId=null` branch in `issueQuerySchema`).

### 3.4 Filters and sort are not persisted in the URL — and sort is presentational

- Workspace filters live in component `useState`; the browser URL only encodes the
  route (`/workspaces/:id`). **Refresh resets filters.** There is no router
  query-param filtering.
- Sorting exists **only** on My Issues and is client-side presentation
  (`MyIssuesView.sort`). The Workspace ledger has **no** sort control; `listIssues`
  returns its default order.

### 3.5 Reusable CRUD / authorization / validation precedent — Labels

Labels are the closest existing resource to Saved Views (workspace-owned, small,
plain CRUD) and provide the exact template:

- Routes: `POST/GET /api/workspaces/:workspaceId/labels`, `PATCH/DELETE /api/labels/:id`
  (`backend/src/api/routes/labels.ts`).
- Auth: `membershipService.requireMember(userId, workspaceId)` on every operation;
  any member may create/update/delete any label in a workspace they can see.
- Duplicate name → `409 CONFLICT` (unique index `(workspace_id, name)` +
  catch → `ApiError(409, ...)`), backend `src/services/label.ts:25-64`.
- Validators return `422 VALIDATION` with per-field messages; update schema refines to
  require ≥1 field.
- Serialized arrays are already stored as `TEXT` columns (e.g.
  `activities.label_ids`, `activities.label_names` in `0004_activities.sql`), i.e. the
  project already trusts denormalized `TEXT` for small structured payloads.
- Frontend `LabelsSection.tsx` is a "compact ruled shelf in the left rail" with
  section header, section-title, `EmptyState`, ghost Rename/Delete `card-actions`,
  and create/edit/delete via the shared `Dialog` + `Field`.

### 3.6 Authorization boundaries

`membershipService.getReachableWorkspaceIds` (memberships ∪ owned) is the
cross-workspace boundary used by My Issues and Global Search
(`backend/src/services/membership.ts:80-98`). Per-workspace access is
`requireMember`. Any saved-view endpoint must re-check **the workspace**, never trust
its resource id alone.

## 4. Scope decision

**Saved Views attach to the Workspace ledger only** (the per-project, server-filtered
surface). Rationale:

- This is the only place "configure filters" is a first-class, meaningful, repeated
  workflow backed by the canonical `IssueQueryParams` model the server already
  validates and executes. Restoring a view can reuse `listIssues` **unchanged**.
- The Workspace ledger's filter state is the smallest, most durable thing worth saving
  (search / status / priority / label + project).
- My Issues filtering is **client-side presentation** over an implicitly "assigned to
  me" list; its model (`MyIssuesView`) includes a sort key and has no server filter
  round-trip. Saving it would mean building a **second** Saved Views model over a
  different shape — out of scope (see §9 decisions, Q-05).

### 4.1 What "configure filters" means here

The user configures the **existing** Workspace filter bar: search, status, priority,
label, and picks a project. "Save current filters as view" captures exactly those
controls into a versioned filter configuration (`§10`).

### 4.2 What is explicitly out of reach for v1 (and why)

- **Cross-project / workspace-wide saved views.** The Workspace ledger is per-project
  today; a view is anchored to a single project. A workspace-wide issue list + filter
  API is a separate feature and would create a new filtering surface.
- **"Assigned to me", "Unassigned", "Overdue" predicates.** None of these are
  expressible by the Workspace ledger's exposed controls (assignee has no control;
  `assigneeId=null` and overdue have no predicate). Adding them would extend the shared
  filter model, which is an **Advanced Filters** concern, not a Saved Views concern.
  See Q-06.
- **Saved Views on My Issues.** Different, client-side, sort-bearing, cross-workspace
  model → Q-05.

## 5. Who can see and use a Saved View?

**Scope: workspace-level, visible to every member of that workspace.**

A Saved View belongs to a `workspace_id` and is listed/restorable by **any member** of
that workspace. There are **no** sharing controls, no private/public flag, and no
per-view permissions in v1. This matches the product's flat member model: any member
who can see a workspace can create/read/mutate its labels, projects, and issues
(`membershipService.requireMember` is the uniform gate used by Labels and Issues).

`created_by_id` is recorded for audit/display but confers **no** exclusive permission.
Any member may rename/delete any view in the workspace (consistent with Labels, where
any member edits any label). Creator-only editing is flagged as an open question
(Q-02) but the implementation default is member-editable.

**Cross-workspace isolation is mandatory and server-enforced** (`§14`): a user must
never list/create/update/delete a view through a workspace they are not a member of.

## 6. Goals

- Capture the current Workspace ledger filter configuration as a named view.
- Select a saved view and restore its filters (project included) in one step.
- Rename and delete saved views.
- Reuse the existing `IssueQueryParams` filter model, `listIssues`, membership
  authorization, Labels-style CRUD/API/UI conventions, and the Dialog/Field/Button
  primitives.
- Remain dense, quiet, and ledger-native; Saved Views must never outshine the issue
  ledger.

## 7. Non-goals

Explicitly out of scope for v1:

- Shared/public views, view permissions, favorites, folders, nested views, duplication.
- Workspace-wide / cross-project saved views, custom columns, custom layouts, saved
  searches separate from saved views (a view's config is the search; there is no
  second "saved search" concept).
- "Assigned to me"/"Unassigned"/"Overdue" predicates (require filter-model extension).
- Saved views on **My Issues**.
- View analytics, scheduling, notifications, realtime sync, collaborative editing,
  arbitrary boolean filter expressions, complex query builders.
- Any new page; the feature lives in the existing Workspace page left rail + filter bar.

## 8. User stories

- US-1 — A member configures filters on a project, clicks **Save current filters**,
  names the view, and it appears in the workspace's Saved views shelf.
- US-2 — A member clicks a saved view name and the ledger immediately applies that
  project + those filters.
- US-3 — A member renames a saved view.
- US-4 — A member deletes a saved view (with confirmation).
- US-5 — A member of a workspace sees only that workspace's views; never another
  workspace's views.
## 9. Explicit decisions

- **D-01 — Reuse the existing filter model.** A Saved View stores the workspace
  ledger's server-side filter representation (`search`, `status`, `priority`,
  `labelId`) plus `projectId`, not the `MyIssuesView` client shape. No second filter
  model is created.
- **D-02 — Sorting is NOT persisted.** Sorting is presentation state, not "which issues
  should I see". The Workspace ledger has no sort control today. Restoring a view never
  changes sort; the default ledger order is used. (My Issues sort remains a local,
  unsaved preference.)
- **D-03 — Overdue / unassigned / assignee are NOT persisted in v1.** They are not
  expressible by the Workspace ledger's exposed controls or its existing query
  predicates. Capturing them would extend `issueQuerySchema` — a separate concern.
- **D-04 — Restoring a view REPLACES current filter state**, it does not merge. It sets
  the project selection and overwrites search/status/priority/label deterministically.
- **D-05 — View scope is workspace-level, member-visible, member-editable.** Matches the
  product's flat member model and the Labels precedent (no per-role matrix, no sharing
  UI). `created_by_id` is recorded but grants no exclusive rights.
- **D-06 — Filters are stored as versioned JSON in a `TEXT` column**, not normalized
  relational columns. Rationale: referenced entities (project, label) can be deleted
  later; a fixed FK/cascade would delete or silently mutate the view on delete, which
  the stale-reference requirement (§13) forbids. Storing ids inside JSON keeps the
  config intact and lets the apply-time resolver tolerate missing references. This
  matches the codebase's existing precedent of storing small serialized payloads in
  `TEXT` (activities label arrays). A `version` field guards future shape changes.
- **D-07 — API mirrors Labels** exactly: workspace-scoped create/list
  (`POST/GET /api/workspaces/:workspaceId/views`), id-scoped update/delete
  (`PATCH/DELETE /api/views/:id`). No extra endpoints.
- **D-08 — Duplicate names are rejected with `409 CONFLICT`**, unique per workspace
  (unique index `(workspace_id, name)`), mirroring Labels.
- **D-09 — Selecting a view does NOT change the browser URL.** The current app never
  persists workspace filters to the URL (refresh resets them); introducing URL filter
  persistence is a separate, pre-existing gap. v1 restores component state only, so no
  refresh/back/forward URL guarantees are added. See Q-01.
- **D-10 — No issue counts in the UI.** Data honesty: a view shows its name and active
  state only; it never fabricates a result count.
- **D-11 — Saving with an empty filter set is valid.** The minimum config is always
  `{ version, projectId }` (a project is always selected in the Workspace UI); all
  other fields null = "all issues in this project". A name is always required.

## 10. Data model requirements

### 10.1 Table

New table `saved_views`, added as **migration `0006_saved_views.sql`** (schema mirrors
existing conventions).

```
saved_views
  id             TEXT PRIMARY KEY            -- randomUUID (domain record pattern)
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
  created_by_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  name           TEXT NOT NULL               -- trimmed, 1..60
  filters        TEXT NOT NULL               -- versioned JSON (D-06)
  created_at     INTEGER (timestamp) NOT NULL
  updated_at     INTEGER (timestamp) NOT NULL

UNIQUE INDEX  saved_views_workspace_name_idx (workspace_id, name)   -- D-08 (409)
INDEX         saved_views_workspace_idx      (workspace_id)         -- cheap list
INDEX         saved_views_created_by_idx     (created_by_id)        -- audit/display
```

Design notes:

- `workspace_id` and `created_by_id` cascade (a deleted workspace removes its views; a
  deleted user removes their created views — but removing a **membership** does not,
  so a de-membered member's views remain usable by remaining members, which is the
  desired stale-user behavior §13).
- The **referenced project and label are only stored inside the `filters` JSON as
  plain ids — no FK**. Deleting a project/label therefore never cascades or mutates the
  view (D-06, §13).
- `filters` must be validated by the service **before** write and re-validated on read.

### 10.2 `filters` schema (versioned, matches IssueQueryParams)

```json
{
  "version": 1,
  "projectId": "<uuid in workspace>",
  "search": "<trimmed string ≤200> | null",
  "status": "Open" | "In Progress" | "Closed" | null,
  "priority": "Low" | "Medium" | "High" | "Urgent" | null,
  "labelId": "<uuid of a label in workspace> | null"
}
```

Validation at write (service, zod):

- `version` must equal `1` (reject unknown versions → 422, future-proofing).
- `projectId` required, must belong to the workspace.
- `status`/`priority` must be valid enums.
- `labelId` optional; if present must be a label in the workspace (reject foreign/stale
  **write-time** refs with 422, mirroring label validation in `IssueService`).
- `search` trimmed ≤200.
- Extra/unknown keys are rejected (no silent drift).

### 10.3 Compatibility / evolution

- `version` is checked on every read; the service returns the config as stored and the
  frontend tolerates unknown future fields. There is no migration-time transformation
  in v1 (0 stored versions exist beyond 1).
- If a future Advanced Filters concern adds a predicate, a new version (e.g. `2`) can
  extend the schema without a table change.
## 11. API requirements

Mirrors Labels (§3.5, D-07). All endpoints require auth; every request re-checks
workspace membership.

### 11.1 Endpoints

| Method | Path | Auth | Success | Notes |
|---|---|---|---|---|
| POST | `/api/workspaces/:workspaceId/views` | member of workspace | `201 { view }` | create |
| GET | `/api/workspaces/:workspaceId/views` | member of workspace | `200 { items: view[] }` | list (ordered by `created_at`) |
| PATCH | `/api/views/:id` | member of the view's workspace | `200 { view }` | rename (and optionally filters) |
| DELETE | `/api/views/:id` | member of the view's workspace | `204` | delete |

### 11.2 Request bodies

- `POST` — `{ name: string, filters: SavedViewFilters }`
  - `name`: trimmed, 1..60.
  - `filters`: validated per §10.2.
- `PATCH` — `{ name?: string, filters?: SavedViewFilters }`, at least one field
  required (mirrors `updateLabelSchema.refine`). v1 UI primarily renames; `filters` is
  accepted so the contract does not preclude "overwrite a view from current filters" if
  approved (Q-07).

### 11.3 Response shape

```
View {
  id: string;
  workspaceId: string;
  createdById: string;
  name: string;
  filters: SavedViewFilters;   // parsed JSON, re-validated
  createdAt: string;
  updatedAt: string;
}
```

`createdById` is returned; the frontend may cross-reference the already-fetched members
list for a quiet creator caption, or omit it. No fabricated counts or enrichment.

### 11.4 Error responses (existing `ApiError` conventions)

- `401 UNAUTHORIZED` — not signed in.
- `403 FORBIDDEN` — signed in but not a member of the target workspace (list/create) or
  of the view's workspace (update/delete); also guards cross-workspace tampering.
- `404 NOT_FOUND` — view id does not exist (update/delete); inaccessible workspace on
  GET/POST is treated as `403` (matching Labels), not 404.
- `422 VALIDATION` — invalid name/filters/version; field-level messages via the
  standard `fields` map.
- `409 CONFLICT` — duplicate name within the workspace (create/rename).

### 11.5 No fabricated/stale mutation

The server never resolves or mutates referenced project/label on read or delete. If a
referenced id no longer exists, it is returned as stored; the frontend resolver handles
it (§13).

## 12. Security requirements

- Never cross workspace boundaries. Every route resolves the view's `workspace_id`
  server-side and calls `membershipService.requireMember(userId, workspaceId)`
  (mirroring `LabelService.getWorkspaceIdForLabel`, `backend/src/services/label.ts:15-23`).
- Filters are validated server-side; `projectId` and `labelId` must belong to the
  workspace being written to (no foreign-project/label writes).
- JSON in `filters` is parsed + validated on read (never trusted from storage blindly)
  and on write (zod).
- All authorization in the service layer, not the frontend.

## 13. Saved View validity / stale references

A view may reference a project or label that is later deleted or becomes inaccessible
(e.g. a member's assignee who is de-membered — though assignee is not stored in v1).

**Behavior:**

- The stored `filters` are **never mutated** when a referenced entity is deleted
  (no FK cascade, D-06). The view stays listed and restorable.
- On restore, the frontend **resolves** the config against the currently loaded
  workspace data:
  - `projectId` not found → the view does not activate; the shelf marks it as
    unavailable with a quiet note (e.g. an inline "Project removed" caption) and a
    Clear/back-to-previous-filters affordance. The stored config is untouched.
  - `labelId` not found → apply project/status/priority/search; drop just the stale
    label filter; surface a quiet note "Label no longer available" so the user
    understands why.
  - Unknown JSON `version` → treat the view as unavailable (cannot safely interpret),
    quiet note, stored config untouched.
- **No fabricated replacement values** are injected. If a reference can't resolve, the
  corresponding filter is dropped (or the whole view defers) — never guessed.
- The server is not required to resolve refs; this is purely an apply-time concern in
  the frontend so the workspace API stays cheap (§16).
## 14. UI requirements

Saved Views integrate into the **existing WorkspacePage** in two places. No new page.

### 14.1 The Saved views shelf (left rail)

A compact **"Saved views"** section in the `.projects-column`, rendered below the
Project selector and above Labels (final slot per §18). It mirrors `LabelsSection`
anatomy exactly:

- `section-header` with a `section-title` ("Saved views") — a **quiet, subordinate
  shelf**, never louder than the Issues ledger.
- a `card-actions` ghost **Edit** (rename) and a Confirm-gated **Delete** per row,
  matching the Labels rows; **Delete** is destructive-gated via the shared Dialog
  (danger button).
- Selecting a row **applies** the view: sets `selectedProject` and the four filter
  states, then reloads issues (§14.3). The active view is marked with `aria-current`
  + a petrol active treatment (not color-only).
- Empty state (`EmptyState`, "No saved views yet") and a load skeleton
  (`SkeletonRows`), matching Labels.
- Rows reuse the `.label-list` / `.label-row` family; add a `.view-list` /
  `.view-row` only if a distinct class is warranted, styled from the same tokens.
## 15. Visual language requirements

Governing file: `frontend/VISUAL_LANGUAGE.md` (read completely). The feature extends
the established system; it does **not** invent a new visual style.

The likely implementation direction — **"a quiet reusable filter shelf"** — must reuse:

- Ruled `section-header` + `section-title`, `.projects-column` rail structure.
- `LabelsSection` shelf anatomy (`label-list`/`label-row`, `card-actions` ghost
  buttons, `EmptyState`, `SkeletonRows`).
- `Button` (`secondary`/`ghost` for Save view, `danger` for delete), `Dialog`, `Field`.
- The `filter-bar` / `filter-meta` region for the Save-view affordance.
- Composition over decoration: hairlines, paper surfaces, restrained petrol for the
  active view, no cards, no shadows, no new tokens/colors unless genuinely required.

**No new visual language is required for v1** unless implementation proves a genuinely
reusable pattern; if it does, that pattern must be recorded in `VISUAL_LANGUAGE.md`
during implementation (active-view treatment, view-shelf anatomy, Save-view affordance
placement, responsive behavior, reuse/anti-reuse guidance).

## 16. Responsive requirements

Respect existing breakpoints (`VISUAL_LANGUAGE.md` §31; CSS `components.css`):

- **≥900px**: shelf renders as part of the left rail; no overflow.
- **≤900px**: the workspace two-column layout collapses to one column
  (`components.css:2367-2382`); the Saved views shelf stacks within the single column
  like the rest of the rail. No horizontal overflow.
- **≤700px**: mobile top bar; ledger rows may wrap; the Save-view affordance stacks in
  the `filter-bar` column (`components.css:2630`); dialogs fill width. **44px coarse
  touch targets** for shelf rows, Save-view, rename/delete, and save-dialog actions
  (register any new interactive class in the existing coarse-pointer rule).
- **≤375px**: filter bar stacks fully; stats stack; dialogs near-full-screen. The shelf
  is a normal stacked list — never a duplicate of the sidebar navigation (non-goal).

Important mobile invariants: ticket keys stay visible; the ledger remains the primary
surface; Saved Views never create duplicate navigation, cramped dropdowns, or
overflowing rows.

## 17. Accessibility requirements

Reuse existing patterns intact:

- **Dialog**: focus trap, `Escape` closes, focus returns to the trigger on close
  (`Dialog.tsx`).
- **Save/rename dialog**: labelled name `Field` with `aria-invalid`/`aria-describedby`;
  server field errors shown via the existing error alert + field error; focus moves to
  the alert on error (existing `useFocusAlert` pattern).
- **Shelf rows**: real interactive elements (buttons) with accessible names; active
  view conveyed by `aria-current="true"` **and** a petrol treatment (never color only).
- **Ghost actions**: labelled (e.g. `aria-label="Rename <view name>"`).
- **Delete**: destructive-gated Dialog with a clear coral cancel-able path (mirrors
  Labels + Bulk delete confirmation).
- **States**: loading skeleton, empty state, error states all announced/render with
  `role="alert"` where appropriate; no reliance on color for errors/saved state.
- **Keyboard**: full flow operable by keyboard (open save dialog from the filter bar,
  tab through shelf, select a view, rename, confirm delete). Coarse-pointer 44px
  targets.
- **Screen reader**: after a view is selected, the active state is announced (via
  `aria-current` on the row; optionally an `aria-live` note of the applied filters).
- **Reduced motion**: no new animation; any transition reuses existing durations and
  respects `prefers-reduced-motion`.
- Run/keep the existing axe coverage; add the new shelf + dialogs to it.

### 14.2 "Save current filters" affordance (in the filter bar)

A small secondary/ghost **"Save view"** button placed in the `filter-meta` region of
the Workspace `filter-bar` (next to the count and Clear filters). Enabled only when
`selectedProject` is set. Clicking opens the shared **Dialog** with a single labelled
name `Field` (`autoFocus`, `required`), **Cancel**, and a primary **Save** submit. On
success it closes the dialog and refreshes the shelf.

- Saving with **no filters** is allowed (D-11): the stored config is
  `{ version, projectId }` with other fields null (valid — "all issues in this
  project").
- The **exact current filter values are captured**: the dialog is fed
  `{ search, status, priority, labelId }` at open time, unchanged by later edits.

### 14.3 Applying / restoring (replaces, D-04)

Selecting a view deterministically:

1. Resolve the config (§13) against the loaded projects + labels.
2. If `projectId` resolves → `setSelectedProject(projectId)`; else defer (§13).
3. Set `search`, `statusFilter`, `priorityFilter`, `labelFilter` from the resolved
   config (stale label dropped with a quiet note).
4. Clear the bulk selection (the visible set changes) and rely on the existing
   `loadIssues` effect to refetch. No new query path — `listIssues` reused unchanged.
## 18. Error handling

- **Create**: name blank/whitespace-only → 422 on `name` ("View name is required");
  too long → 422; duplicate → 409. Invalid/foreign `filters` → 422 field errors.
- **Rename**: empty body → 422; duplicate → 409; nonexistent id → 404.
- **Delete**: nonexistent id → 404.
- **Auth**: not signed in → 401; non-member of the workspace → 403 (list/create); not a
  member of the view's workspace → 403 (update/delete).
- **Frontend**: reuse `Alert role="alert"` + Field errors in the Save/Rename dialog;
  `useFocusAlert` for focus-to-error; shelf shows a quiet per-row unavailable note for
  stale/unknown configs (§13) with a safe Clear path — never a crash, never fabricated
  values.
- Error handling must never render invalid filters as success, and a stale ref must
  surface as a calm, recoverable note.

## 19. Data integrity

- `filters` validated by zod on write (§10.2) and re-validated on read.
- Unique `(workspace_id, name)` enforced by index + 409 on create/rename.
- Timestamps: `created_at`/`updated_at` mirror existing tables; `updated_at` bumps on
  rename.
- No FK on the project/label referenced inside `filters` (D-06) — deletes never cascade.
- Stored config is never mutated by read/delete operations; stale refs only affect
  apply-time resolution (§13).

## 20. Performance

- **Listing views is cheap**: a single indexed `WHERE workspace_id = ? ORDER BY
  created_at` query; one row per view; no joins required for v1 (creator resolution is
  optional frontend-side against the already-fetched members list, or a tiny
  `leftJoin` if approved). No N+1.
- **Applying a view reuses the existing issue query** (`listIssues`); Saved Views add no
  new query logic and no extra issue fetches.
- No polling, no subscriptions, no prefetch, no realtime.
- JSON parse/validation is a single small object; negligible at this scale.
- Revisit only if workspaces grow to thousands of views (unbounded — out of scope).

## 21. Testing requirements

### Backend

- **Integration** (`tests/integration/saved-views.test.ts`, mirroring `labels.test.ts`):
  create → 201 full shape; list ordered; rename → 200; delete → 204; duplicate create
  and rename → 409; blank/whitespace/over-length name → 422; invalid filters (bad enum,
  foreign project, foreign label, unknown version, extra keys) → 422; missing
  workspace → 403; nonexistent view → 404; **cross-workspace isolation** (member of A
  cannot list/create/update/delete B's views; owner-without-membership on B → 403);
  stale refs are returned as stored (no server-side mutation/crash); malformed stored
  JSON surfaces safely (treated as an unreadable view, config untouched).
- **Validator unit** (`tests/unit/saved-views-validator.test.ts`): name bounds,
  `filters` version/enum/length/foreign-ref validation, PATCH ≥1 field refinement.
- **Migration unit** (`tests/unit/migration.test.ts`): `0006` applies cleanly on the
  existing schema.

### Frontend

- **Component** (`tests/component/saved-views.test.tsx` for the shelf, plus extensions
  to `workspace-page.test.tsx`):
  - shelf renders views; empty state; loading skeleton; error state.
  - create flow: "Save view" → dialog → name → POST → shelf refresh.
  - validation error shown in dialog (server field error).
  - selecting a view restores project + filters (asserts the four state values and that
    `listIssues` is refetched).
  - replacing current filters works (pre-warning: apply after a non-default state).
  - rename (PATCH) and delete (confirm → DELETE).
  - stale project → quiet "unavailable" state, no crash; stale label → applied without
    that label + note.
  - keyboard interaction (open dialog, tab, enter select, escape).
  - responsive smoke at ≤375 / ≤700 where practicable (no overflow; shelf stacking).
- **Accessibility**: extend the axe suite to the shelf, Save/Rename dialogs, and the
  active-view treatment. Keep existing accessibility tests green.

## 22. Default / empty view model

The Workspace page today opens on the first project with no filters (a real default).
Saved Views are an **optional layer** on top; there is no "All Issues / Saved Views"
navigation reshuffle. The default unfiltered project view remains exactly as today.
Selecting "Clear filters" returns to that default (filters cleared; project unchanged);
selecting a view is an explicit opt-in.

## 23. Acceptance scenarios

- AS-1 — Member sets search=x, status=Open, priority=High, label=bug on project P,
  clicks **Save view**, names "My High Bugs" → appears in the shelf; stored filters
  match the four controls + project.
- AS-2 — Member clicks "My High Bugs" after changing filters → project becomes P and
  all four controls restore to the saved values; ledger refetches; `aria-current` marks
  the row.
- AS-3 — Renaming to a duplicate name in the same workspace → 409 with a friendly
  error; original name unchanged.
- AS-4 — Delete with confirmation → row removed; no issues deleted.
- AS-5 — A member of this workspace sees only this workspace's views; a view in another
  workspace is never listed and cannot be created/updated/deleted cross-workspace.
- AS-6 — A view references a project that was deleted → the row is shown with a quiet
  "unavailable" note; selecting it does not crash and offers a safe back-out. No
  replacement values are invented.
- AS-7 — A view references a deleted label → project/status/priority/search still
  apply; the label filter is dropped with a quiet "Label no longer available" note.
- AS-8 — View with empty filters → restores "all issues in project" (project applied,
  filters cleared).
- AS-9 — Keyboard: Tab to "Save view", Enter opens the dialog, type name, Enter saves,
  focus returns; shelf rows tabbable; Delete confirm focus-trapped (Dialog); Escape
  closes. axe has no new violations.
- AS-10 — ≤375px / ≤700px: shelf stacks, no horizontal overflow, 44px targets, dialog
  usable; ledger key/title always visible.
## 24. Success criteria

- Saved Views present **real, reusable filter configs** backed by real data — no
  fabricated counts, projects, labels, or issue previews.
- Restoring a view deterministically re-applies project + filters to the existing
  Workspace ledger and **reuses the existing issue query** unchanged.
- The feature is a quiet, ruled shelf + a save affordance; the ledger stays the primary
  surface; no new page, cards, shadows, or tokens.
- Workspace isolation is proven by tests; a member can never touch another
  workspace's views.
- Stale references degrade safely (quiet note, no crash, no fabricated values).
- Backend/frontend suites, typecheck, lint, build, and the axe accessibility audits are
  all green.

## 25. Final report notes

1. **Specification file created** — `specs/009-saved-views/spec.md`.
2. **Plan file created** — `specs/009-saved-views/plan.md`.
3. **Architecture inspected** — DB schema + migrations, issue service
   (`listIssues`/`issueQuerySchema`), my-issues service + client view model, membership
   authorization, label CRUD/route/validator/service, shared contracts, frontend
   WorkspacePage/MyIssuesPage/Filter bar/LabelsSection/Dialog/Field/Layout, VISUAL_LANGUAGE.
4. **Existing filter model discovered** — the canonical `IssueQueryParams`
   (`shared/index.ts`) used by the per-project Workspace ledger; a separate client-only
   `MyIssuesView` exists for My Issues.
5. **Exact Saved View scope** — Workspace ledger only; workspace-scoped; member-visible;
   single-project anchor; reused `IssueQueryParams` fields.
6. **Data model decision** — new `saved_views` table; versioned JSON `filters` `TEXT`
   column; unique `(workspace_id, name)`; `workspace_id` + `created_by_id` cascade;
   project/label refs inside JSON with no FK (D-06).
7. **API decision** — mirrors Labels: `POST/GET /api/workspaces/:workspaceId/views`,
   `PATCH/DELETE /api/views/:id` (D-07).
8. **Authorization decision** — any member of the workspace may create/list/update/
   delete; `membershipService.requireMember` on every route; cross-workspace forbidden
   (D-05).
9. **Filter serialization decision** — versioned JSON matching `IssueQueryParams`
   (`search/status/priority/labelId + projectId`); assignee/overdue/unassigned excluded
   (D-01..D-03).
10. **Sorting decision** — not persisted; presentation state (D-02).
11. **Stale-reference behavior** — stored config untouched; apply-time resolve drops or
   defers stale refs with quiet notes; never fabricated (§13).
12. **UI integration decision** — "Saved views" shelf in the left rail + a "Save view"
   affordance in the filter bar; no new page (§14).
13. **Responsive approach** — reuses existing breakpoints (≤900 stack, ≤700 top bar,
   ≤375 stack), 44px targets, no new navigation pattern (§16).
14. **Accessibility approach** — reuse Dialog trap/Escape/focus return, labelled Field,
   `aria-current` + petrol active state, confirm-gated delete, axe coverage (§17).
15. **Testing strategy** — backend integration + validator/migration unit, frontend
   component + workspace-page extensions, axe (§21).

## 26. Assumptions

- The Workspace ledger and its filter bar remain the product's primary filtering
  surface; Saved Views are a thin layer over it.
- A view without explicit filters (= "all issues in the selected project") is a valid,
  useful view.
- Workspaces have modest view counts; JSON parse + indexed list are negligible.
- The frontend already has the workspace's projects and labels loaded (it does, to
  render the ledger and label shelf); restore-time resolution adds no new fetch.

## 27. Open questions (require operator approval)

- **Q-01 — URL / deep-linking.** v1 keeps filters out of the URL (D-09, consistent with
  today). Should Saved Views additionally persist the resolved filter state to the
  browser URL (and/or include `?view=<id>`) for refresh/back/forward? Recommendation:
  defer; it implies introducing URL filter persistence the app doesn't have.
- **Q-02 — Creator-only edit/delete vs member-editable.** Default is member-editable
  (D-05, Labels precedent). Approve member-editable, or restrict update/delete to the
  creator?
- **Q-03 — Work on My Issues?** Deferred (Q-05 in §9). Confirm My Issues saved views
  are out of scope for v1.
- **Q-04 — Workspace-wide / cross-project views.** Deferred (client model is per-
  project). Confirm v1 is per-project; a workspace-wide issue list is a separate feature.
- **Q-05 — "Assigned to me" / "Unassigned" / "Overdue" predicates.** Deferred: they
  require extending `issueQuerySchema` (an Advanced Filters concern). Confirm exclusion
  for v1.
- **Q-06 — PATCH `filters` support.** Accepted in the contract (§11.2) but the v1 UI
  only exposes rename. Approve including an occasional "overwrite view from current
  filters" (Update view) action, or leave filters immutable per view?
- **Q-07 — Creator display.** Show a quiet "by <name>" caption on shelf rows using the
  already-fetched members list, or keep rows name-only in v1?

## 28. Out of scope (consolidated)

Shared/public views, view permissions/favorites/folders/duplication, workspace-wide/
cross-project views, custom columns/layouts, saved searches as a separate concept,
"assigned to me"/"unassigned"/"overdue" predicates, My Issues saved views, analytics,
scheduling, notifications, realtime/collaborative editing, complex/boolean query
builders, URL filter persistence (Q-01), any new page or navigation reshuffle.