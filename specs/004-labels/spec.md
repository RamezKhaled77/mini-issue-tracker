# Feature Specification: Labels — Mini Issue Tracker

**Feature Branch**: `004-labels`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Introduce a proper workspace-level Label system.
Labels should allow teams to categorize issues using meaningful, reusable labels
such as bug, frontend, backend, documentation, enhancement, ui. The feature
should be useful immediately without becoming a large project-management
taxonomy system. The MVP must remain intentionally small."

**Relationship to prior features**: Feature 001 built the MVP (which already
shipped a minimal, non-visible labels table, `issue_labels` join table, and a
two-endpoint label API without a UI). Feature 002 was a presentation-only
redesign. Feature 003 added user display names. This feature turns the dormant
labels infrastructure into a complete, user-visible workspace-level label
system: label colors, rename/delete, ledger + detail + form integration, a
label management surface, and a label filter. It is not presentation-only.

## 1. Feature Overview

Today the data model and API already contain a minimal, **dormant** label
system that no user can see or manage:

- `labels` and `issue_labels` tables exist (migration `0001_initial.sql`).
- `POST /api/workspaces/:workspaceId/labels` and
  `GET /api/workspaces/:workspaceId/labels` exist and are wired.
- Issues already accept and return `labelIds: string[]` on create/get/list/
  update, and the workspace filter API already accepts `?labelId=`.
- The frontend already shows a checkbox label picker in the issue form and a
  neutral-grey label row in the issue detail fact rail.

But there is **no label color, no rename, no delete, no label management UI,
no labels in the issue ledger, and no label filter in the UI**. Worse, the
server-side label validator does **not** verify that the labels assigned to an
issue belong to the issue's workspace — a cross-workspace data-integrity hole.

This feature completes the label system into a coherent, intentionally small
MVP: workspace-owned labels with a name and a controlled palette color, fully
manageable, assignable to issues, rendered on every issue surface, and
filterable — all within the existing architecture, visual language, and
authorization model.

## 2. Problem Statement

Teams cannot categorize issues with reusable labels. Although the plumbing
exists, there is no way to:

- create a label in the UI (only via the raw API);
- give a label a visual color that fits the product's restrained palette;
- rename or delete a label;
- see which labels an issue carries in the issue list (ledger);
- manage workspace labels (create/edit/delete) from any surface;
- filter the issue ledger by a label;
- trust that a label assigned to an issue actually belongs to that issue's
  workspace.

The result is that the primary organizational affordance of an issue tracker —
categorization — is unusable, and the existing data path can silently associate
issues with labels from foreign workspaces.

## 3. Goals

- **G-001** Give each workspace its own set of reusable labels (name + color),
  usable across any project/issue in that workspace.
- **G-002** Let workspace members create, rename, re-color, and delete labels
  from the workspace surface, using the existing authorization model.
- **G-003** Make labels visible and assignable everywhere issues are
  represented: the issue ledger, the issue detail fact rail, and the issue
  create/edit form.
- **G-004** Let users filter the issue ledger by one label at a time, reusing
  the existing `labelId` query parameter.
- **G-005** Enforce workspace isolation for labels **server-side**: an issue
  may only carry labels from its own workspace, and label CRUD only affects
  labels the acting member can reach.
- **G-006** Keep the MVP intentionally small; add only what this feature
  requires, no taxonomy machinery.

## 4. Non-Goals

The following are explicitly **out of scope** for Feature 004 and may be future
features, not part of this MVP:

- saved filters / advanced filter builder (a single label dropdown filter is in
  scope; saved or combined/advanced filters are not);
- label analytics / label usage statistics / per-label counts;
- label hierarchy / nested labels / label groups / custom label ordering;
- label permissions (per-label access control);
- label subscriptions / notifications / automation;
- bulk issue editing;
- recurring issues;
- label icons;
- inline label creation from the issue form (labels are created in the
  workspace Labels section);
- free-form arbitrary hex colors for labels (controlled palette only);
- label description, slug, category, usage-count, creator, or owner fields;
- dark mode, real-time features, or any unrelated change to
  auth/status/priority/search/dashboard/projects/comments.

## 5. Current-State Findings

The following reflects the actual codebase inspected for this feature.

### Database schema (`backend/src/db/schema.ts`, migration `0001_initial.sql`)

- `labels`: `id` (PK), `workspace_id` (FK → `workspaces.id`,
  `ON DELETE CASCADE`), `name` (`notNull`). **No color, no timestamps.**
  `labels_workspace_name_idx` is a `UNIQUE` index on
  `(workspace_id, name)` — duplicates are already prevented **per workspace**.
- `issue_labels`: composite PK `(issue_id, label_id)`, both FKs `ON DELETE
  CASCADE` (deleting an issue or a label already removes the relationship).
  Indexed on both columns.
- Drizzle `relations` for labels/issueLabels already exist.
- Migration `0002_user_display_name.sql` is the only later migration; the
  runner (`backend/src/db/migrate.ts`) applies files by numeric prefix and
  `PRAGMA user_version`.

### Domain (`backend/src/domain/issue.ts`)

- `LabelEntity { id, workspaceId, name }` and `createLabelRecord(workspaceId,
  name)`. No color. No timestamp fields — the existing label tables were
  deliberately created without timestamps.

### API — existing label endpoints (`backend/src/api/routes/labels.ts`)

- `POST /workspaces/:workspaceId/labels` — body `{ name }`, returns `201`
  `{ label }`; `createLabelSchema = z.string().trim().min(1, "Label name is
  required").max(50)`; duplicate name throws `409` via catch on the unique
  index.
- `GET /workspaces/:workspaceId/labels` — returns `200` `{ items }`.
- No update, no delete, no color.

### Issue ↔ label wiring (`backend/src/services/issue.ts`)

- `createIssue`/`updateIssue` accept `labelIds` and write/rewrite the
  `issue_labels` rows (update = delete-all + re-insert).
- `getIssue`/`listIssues` return `labelIds: string[]` (IDs only — no name or
  color). `listIssues` supports the `labelId` query filter.
- **BUG**: `validateLabels(workspaceId, labelIds)` selects labels by `id`
  **without any workspace filter**:
  `select({ id: labels.id }).from(labels).where(inArray(labels.id, labelIds))`.
  A label from another workspace is therefore accepted and attached to an issue
  in this workspace. This is the data-integrity hole Feature 004 must close
  (see §14, FR-009, DI-001).
- `createLabel`/`listLabels` live in the issue service (workspace-scoped).

### Shared types (`shared/index.ts`)

- `Label { id, workspaceId, name }` (no color).
- `Issue { …, labelIds: string[] }` (no embedded labels).
- `CreateLabelRequest { name }`.
- `IssueQueryParams` already has `labelId`.

### Authorization model

- Session middleware (`backend/src/api/middleware/session.ts`) attaches
  `req.user`; routes check `req.user` (401).
- `MembershipService.requireMember(userId, workspaceId)` → 403; `requireOwner`
  → 403. Project/issue/comment/label-scoped access resolves the workspace
  server-side from the resource, never from a client-supplied id.
- Project management (create/rename/delete) is **member-level**; only
  invitations and member removal are owner-only. Labels follow the project
  pattern: **member-level**.

### Frontend

- `frontend/src/components/IssueForm.tsx` — loads `/workspaces/:id/labels`,
  renders a checkbox `.label-chip` picker (hidden entirely when the workspace
  has no labels); a local `Label { id, name }` interface; submits `labelIds`.
- `frontend/src/pages/IssuePage.tsx` — fetches `/workspaces/:id/labels` to
  build a `labelNames` map and renders `Badge tone="neutral"` tags in the fact
  rail; the Labels row is **hidden** when the issue has no labels.
- `frontend/src/pages/WorkspacePage.tsx` — ledger rows show ticket key, title,
  description, status, priority, assignee, chevron. **No labels.** No label
  management surface. The left column is `Projects` rail → `Invitations`.
- `frontend/src/components/Badge.tsx` — `BadgeTone` = status/priority/neutral/
  accent tones; `components.css` defines `badge` anatomy (compact rectangular,
  `::before` 6px `currentColor` swatch, `--radius-sm`), `.badge-row`,
  `.label-picker`, `.label-chip`.
- `frontend/src/pages/DashboardPage.tsx`, `App.tsx` — unaffected routes.
- `frontend/tests/component/*` and `frontend/tests/accessibility/core.test.tsx`
  mock `/workspaces/:id/labels` returning `{ id, name }` items.

### Existing conventions reused by this feature

- Validation: `z.string().trim().min(1, "<label> is required").max(n)` across
  workspace/project/comment validators; zod field-error maps → `422`.
- Error handling: `ApiError` + single error shape (401/403/404/409/422).
- Service-per-resource structure (workspace, project, issue, comment,
  dashboard services) created in `routes/index.ts`.
- Destructive confirmations and CRUD dialogs: `Dialog` + `Field` + `Button`
  (see `ProjectDialog.tsx`).
- Frontend API client (`frontend/src/api/client.ts`), `api.get/post/patch/
  delete`.
- Migrations: numeric-prefixed `.sql` files, auto-applied by
  `runMigrations`.

## 6. User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Manage Workspace Labels (Priority: P1)

A workspace member opens the workspace, goes to the Labels section, and
creates/renames/re-colors/deletes the team's label set (bug, frontend,
backend, documentation, enhancement, ui), each with a color from the palette.

**Why this priority**: Label management is the foundation; every other surface
(assignment, ledger, detail, filter) depends on labels existing and being
maintainable.

**Independent Test**: Can be fully tested by creating a label from the Labels
section, seeing it appear in the list with its color, renaming/re-coloring it,
deleting it, and confirming the API returns the expected 201/200/204 responses.

**Acceptance Scenarios**:

1. **Given** a workspace with no labels, **When** a member opens the Labels
   section, **Then** they see an empty state and a "New label" action.
2. **Given** the new-label dialog, **When** the member enters a name and picks
   a palette color and saves, **Then** the label appears in the list with its
   name and color swatch.
3. **Given** a label in the list, **When** the member renames it or changes its
   color, **Then** the change persists and the list reflects it.
4. **Given** a label in the list, **When** the member deletes it, **Then** a
   confirmation dialog explains the behavior (removed from issues; issues
   unchanged) and, once confirmed, the label disappears.
5. **Given** a label name that already exists in the workspace, **When** the
   member tries to create/rename to that name, **Then** creation is blocked
   with a clear error and the form keeps their input.

### User Story 2 - Categorize Issues with Labels (Priority: P1)

A member creates or edits an issue and assigns zero, one, or several
workspace labels to it.

**Why this priority**: Assigning labels is the core value of the feature; it
depends on labels existing (User Story 1) and on the existing `labelIds` API
path.

**Independent Test**: Can be tested by opening the issue form, toggling
checkbox chips for multiple labels, saving, and confirming the issue carries
those labels on the ledger, detail, and API responses.

**Acceptance Scenarios**:

1. **Given** the issue form, **When** the member checks one or more label
   chips and saves, **Then** the issue is created/updated with those labels and
   the chips reflect the current selection.
2. **Given** an issue with labels, **When** the member opens it, **Then** the
   fact rail shows the labels as colored tags, or "No labels" when none are
   set.
3. **Given** the issue ledger, **When** the workspace is displayed, **Then**
   each issue row shows its label tags alongside the existing status/priority/
   assignee metadata.
4. **Given** an issue with labels, **When** the API returns the issue, **Then**
   the payload includes both `labelIds` and the embedded `labels` (id, name,
   color).
5. **Given** a label assignment attempt, **When** the request names a label
   from another workspace, **Then** the server rejects it with `422`.

### User Story 3 - Filter Issues by Label (Priority: P2)

A member filters the issue ledger by one label to see just the issues carrying
that label.

**Why this priority**: Filtering is the payoff of categorization, and the API
already supports `?labelId=`; it ranks below assignment because it only matters
once issues are actually labeled.

**Independent Test**: Can be tested by selecting a label in the workspace
filter bar and confirming only issues with that label are listed.

**Acceptance Scenarios**:

1. **Given** the workspace filter bar, **When** the member selects a label,
   **Then** the ledger shows only issues carrying that label.
2. **Given** a label filter active, **When** the member clears filters, **Then**
   the full ledger returns.
3. **Given** a workspace with no labels, **When** the filter bar is rendered,
   **Then** no label filter control is shown.

### User Story 4 - Keep Labels Safe Across Workspaces (Priority: P1)

A user who is a member of multiple workspaces can never attach a label from one
workspace to an issue in another, and can never see or modify another
workspace's labels.

**Why this priority**: This is a security/data-integrity guarantee, not a
feature; it is enforced entirely server-side and must hold before anything else
is trusted.

**Independent Test**: Can be tested with two workspaces and a member of both:
attempting to assign a label of workspace A to an issue of workspace B must
fail with `422`, and label CRUD against workspace B's labels from workspace A's
context must fail with `403`.

**Acceptance Scenarios**:

1. **Given** a label belonging to workspace A, **When** it is passed in
   `labelIds` while creating/updating an issue in workspace B, **Then** the
   request fails with `422` and the issue is unchanged.
2. **Given** a label in workspace B, **When** a non-member of B attempts
   `PATCH`/`DELETE` on it, **Then** the request fails with `403`.
3. **Given** a deleted label, **When** issues that referenced it are loaded,
   **Then** the label no longer appears on them and no dangling reference
   exists.

### Edge Cases

- **Duplicate names**: same name twice in one workspace → `409` CONFLICT (create
  and rename). Same name in different workspaces → allowed.
- **Case sensitivity**: `Bug` and `bug` are **distinct** labels (case-sensitive
  uniqueness; SQLite default BINARY collation — see Explicit Decision D-4).
- **Blank / whitespace-only / over-length names**: rejected `422` (trimmed,
  min 1, max 50).
- **Repeated ids in `labelIds`** (`["l1","l1"]`): rejected `422` (would
  otherwise violate the `issue_labels` composite PK and 500).
- **Nonexistent label id** in `labelIds`: rejected `422`.
- **Empty `labelIds`**: allowed (issue with no labels).
- **Deleting a label referenced by issues**: relationship rows cascade-deleted;
  issues and all other issue data are unchanged (DI-003).
- **Label with no color / invalid color**: rejected `422` (color required,
  palette enum only).
- **Rename to the same current name**: allowed no-op.
- **Stale UI after a label is deleted elsewhere**: the labels list reloads and
  the tag simply no longer renders on issues.
- **Workspace with no labels**: Labels section empty state; issue form picker
  is hidden (existing behavior preserved); filter control is hidden.
- **Issue with no labels**: fact rail shows "No labels".
- **Long label names**: tag text wraps/truncates without breaking the ledger
  row (badge `white-space: nowrap` already bounded by flex wrap at narrow
  widths; 50-char max is enforced).

## 7. Requirements *(mandatory)*

### 7.1 Functional Requirements

- **FR-001**: System MUST store a label's **color** alongside its name, chosen
  from a fixed controlled palette defined as a shared constant (see D-3), and
  MUST return it in every label representation.
- **FR-002**: System MUST allow workspace members to **create** a label
  (name + color) in a workspace.
- **FR-003**: System MUST allow workspace members to **rename** a label.
- **FR-004**: System MUST allow workspace members to **change** a label's color.
- **FR-005**: System MUST allow workspace members to **delete** a label;
  deleting a label MUST remove the issue↔label relationship for every affected
  issue while leaving the issues themselves unchanged (DI-003).
- **FR-006**: System MUST prevent duplicate label names **within a workspace**
  (create and rename) with a `409` CONFLICT error; the same name in different
  workspaces MUST be allowed.
- **FR-007**: System MUST render labels on the **issue ledger** rows of the
  workspace page as compact colored tags alongside the existing status/priority/
  assignee metadata.
- **FR-008**: System MUST render labels on the **issue detail fact rail** as
  colored tags; the Labels row MUST always be visible, showing "No labels" when
  the issue has none.
- **FR-009**: System MUST enforce **server-side** that every label assigned to
  an issue belongs to that issue's workspace; labels from other workspaces MUST
  be rejected with `422` and MUST NOT be persisted.
- **FR-010**: System MUST allow assigning/removing labels on an issue via the
  existing issue create/update endpoints (`labelIds`), reusing the existing
  replace-all semantics; no new assignment-specific endpoints are added.
- **FR-011**: System MUST allow filtering the issue ledger by a single label
  via the existing `?labelId=` query parameter, exposed as a label dropdown in
  the workspace filter bar.
- **FR-012**: Issue API responses (create, list, get, update) MUST include an
  additive `labels` array (embedded label objects) in addition to the existing
  `labelIds`, so label name/color are available to every surface without extra
  requests.
- **FR-013**: Workspace pages MUST expose a compact **Labels** management
  section where members can create, rename, re-color, and delete labels.

### 7.2 Non-Functional Requirements

- **NFR-001**: The feature MUST NOT alter authentication, membership, status/
  priority semantics, projects, comments, search, or the dashboard; it is
  additive to the existing label system.
- **NFR-002**: Issue list/query performance MUST remain within the feature-001
  budget (search/filter under 2s for ~1,000 issues, paginated pageSize ≤ 100);
  label enrichment MUST use at most one additional indexed query (no N+1).
- **NFR-003**: The database migration MUST be auto-applied by the existing
  runner with no manual step and MUST be safe on existing databases (existing
  labels receive a default color; no data loss).
- **NFR-004**: The feature MUST preserve WCAG AA accessibility, keyboard-only
  flows, and screen-reader semantics on all touched surfaces.
- **NFR-005**: No label color MAY be conveyed by color alone; the label **name
  text is always present** (color swatches are decorative reinforcement only).
- **NFR-006**: No new runtime dependency MUST be added.
- **NFR-007**: The MVP MUST introduce no label usage counts or statistics
  (data honesty — the API does not provide them).

### 7.3 Data Model Requirements

- **DM-001**: `labels` gains one additive column: `color` (`TEXT NOT NULL`),
  constrained by the shared palette. **No timestamps** are added — the existing
  `labels` table was deliberately created without them and none are required for
  the MVP (D-2).
- **DM-002**: `labels.workspace_id` and the unique index
  `(workspace_id, name)` are unchanged; workspace ownership and per-workspace
  uniqueness are already enforced.
- **DM-003**: `issue_labels` is unchanged; `ON DELETE CASCADE` on `label_id`
  already implements deletion behavior (DI-003).
- **DM-004**: `LabelEntity` (backend domain), the shared `Label` type, and the
  API label shapes MUST stay a single consistent concept (one `Label` type
  everywhere; Constitution III).
- **DM-005**: No new tables are created.
- **DM-006**: `Issue` gains an **additive** embedded `labels: Label[]` in the
  API/shared type; `labelIds` is preserved unchanged (backward compatible).

### 7.4 API Requirements

All endpoints require an authenticated session (`401` when absent). Base path
`/api`. Responses use the existing wrapper conventions. Errors use the single
existing shape (`error: { code, message, fields? }`).

#### Existing endpoints (unchanged routes, extended shapes)

- **`POST /api/workspaces/:workspaceId/labels`** — Create a label.
  - Auth: signed in. AuthZ: workspace member (`403`).
  - Body: `{ "name": string, "color": LabelColor }`.
  - `201` → `{ "label": Label }` where `Label = { id, workspaceId, name,
    color }`.
  - `409` on duplicate name in this workspace; `422` on invalid input
    (missing/blank/over-length name, invalid color).
- **`GET /api/workspaces/:workspaceId/labels`** — List labels.
  - Auth: signed in. AuthZ: workspace member (`403`).
  - `200` → `{ "items": Label[] }`, ordered by `name` ascending
    (deterministic ordering for stable pickers/lists).

#### New endpoints

- **`PATCH /api/labels/:id`** — Rename and/or change color.
  - Auth: signed in. AuthZ: member of the label's workspace (`403`). The
    workspace is resolved **from the label row**, never from the request body.
  - Body: partial `{ "name"?, "color"? }` (at least one field).
  - `200` → `{ "label": Label }`.
  - `404` if the label does not exist; `409` if the new name duplicates another
    label in the same workspace; `422` on invalid input.
  - Renaming to the label's own current name is a valid no-op.
- **`DELETE /api/labels/:id`** — Delete a label.
  - Auth: signed in. AuthZ: member of the label's workspace (`403`).
  - `204` on success (cascades to `issue_labels`; issues unchanged).
  - `404` if the label does not exist.

#### Reused endpoints (no new label-specific routes)

- **`POST /api/projects/:projectId/issues`** and
  **`PATCH /api/issues/:id`** — accept `labelIds` (existing). Responses gain
  the additive `labels` array.
- **`GET /api/projects/:projectId/issues`** — accepts `labelId` (existing);
  list responses gain the additive `labels` array.

#### Issue payload change

The `Issue` object on create/get/list/update gains additive `labels`:

```json
"labels": [ { "id": "…", "workspaceId": "…", "name": "bug", "color": "violet" } ]
```

`labelIds` is preserved. The embedded `labels` carry the same `Label` shape
returned by the labels endpoints (one type; DM-004).

### 7.5 Validation Requirements

Following the existing zod conventions:

- **Label name** — `z.string().trim().min(1, "Label name is required").max(50)`
  (the exact convention already used by the inline `createLabelSchema`).
  The 50-char maximum is the existing documented limit, not a new value.
- **Label color** — `z.enum(LABEL_COLORS)`; color is **required** on create and
  on update when present. Invalid or missing color → `422` field error on
  `color`.
- **`labelIds` on issue create/update** — each item `z.string().uuid(...)`,
  array `.max(50)` (existing), plus a **new** duplicate check: repeated ids
  within one request → `422` field error on `labelIds` (prevents a composite-PK
  crash → 500).
- Backend validation is authoritative; any client-side checks are non-blocking
  conveniences.

### 7.6 Migration & Backward-Compatibility Requirements

- A new migration **`0003_label_color.sql`**:
  `ALTER TABLE labels ADD COLUMN color TEXT NOT NULL DEFAULT 'violet';`
  (SQLite cannot add a `NOT NULL` column without a default; the default is the
  first palette color and is required for legacy rows only — the API always
  supplies a color on create).
- `backend/src/db/schema.ts` mirrors the column
  (`color: text("color").notNull().default("violet")`).
- **No backfill beyond the default**: existing rows get `'violet'` from the
  migration default; no data is destroyed.
- `labelIds` remains in the API and shared `Issue` type; `labels` is additive,
  so existing consumers reading existing fields keep working.
- The migration applies automatically on server open and on `:memory:` test
  databases (existing runner behavior).

### 7.7 Authorization & Security Requirements

- **SEC-001**: All label endpoints and the existing issue endpoints require a
  valid session (`401`). No new authentication mechanism is introduced.
- **SEC-002**: Label create/list require membership of the target workspace
  (`requireMember`, `403`); label update/delete require membership of the
  workspace resolved from the label row (`403`). Member-level, consistent with
  project management — no owner-only gate and no new permission system.
- **SEC-003**: IDOR prevention — `PATCH`/`DELETE /api/labels/:id` derive the
  workspace from the label record server-side and authorize against it; the
  client-supplied id is never used for authorization scoping.
- **SEC-004**: Cross-workspace issue-label assignment MUST be rejected
  server-side (`422`). This closes the existing `validateLabels` bug by scoping
  the existence check to the issue's workspace
  (`and(inArray(labels.id, labelIds), eq(labels.workspaceId, workspaceId))`).
- **SEC-005**: Mass assignment prevention — only allowlisted fields (`name`,
  `color` on labels; existing allowlist on issues) are accepted.
- **SEC-006**: Untrusted label names/colors are validated by zod and rendered
  as React text; no raw-HTML rendering, no injection surface.
- **SEC-007**: Deletion authorization = membership of the label's workspace
  (`403` otherwise); deletion itself removes only the label and its
  relationship rows, never issues.
- **SEC-008**: No secrets, no new third-party services, no privilege
  escalation.

### 7.8 Frontend Behavior Requirements

- **UI-001** — **Labels management section** (`WorkspacePage`, left column,
  between the Projects rail and Invitations): a "Labels" section title and a
  compact list of label rows (color swatch + name + ghost Rename/Delete
  actions), a "New label" button, and an empty state ("No labels yet"). The
  section mirrors the Projects rail anatomy and is reachable by all workspace
  members (no owner gating — D-6).
- **UI-002** — **Create label dialog**: name field + color radio group (palette
  swatches with visible color names); duplicate-name error keeps the dialog
  open and the input retained.
- **UI-003** — **Rename/re-color dialog**: pre-filled current values; save
  persists via `PATCH /labels/:id`.
- **UI-004** — **Delete label dialog**: destructive confirmation stating the
  label will be removed from issues using it and that issues are not deleted;
  safe cancel path; coral danger button (matches project/issue delete dialogs).
  No fabricated usage counts are shown (NFR-007).
- **UI-005** — **Issue form label picker**: existing checkbox-chip pattern is
  kept (native, accessible); chips become color-aware (label color swatch +
  tinted selected state). Hidden when the workspace has no labels (existing
  behavior preserved). Submits `labelIds` as today.
- **UI-006** — **Issue ledger**: each row renders the issue's label tags as
  compact colored badges within `ledger-meta`, between the priority badge and
  the assignee. The Ticket Ledger signature (priority edge bar, mono key, title,
  chevron) is untouched.
- **UI-007** — **Issue detail fact rail**: the Labels row is always visible,
  showing colored tags or "No labels". Uses the embedded `issue.labels`; the
  page's `labelNames` map fetch is removed.
- **UI-008** — **Label filter**: a "Filter by label" dropdown in the workspace
  filter bar (same `Field`+`select` pattern as status/priority), shown only when
  labels exist; passes `labelId`; participates in the existing Clear-filters
  action.
- **UI-009** — Ledger/fact-rail tags reuse the existing `Badge` component with
  new `label-<color>` tones (no new "almost-identical" tag component).

### 7.9 Visual Language Requirements

- **VL-001** — Labels belong to the existing "compact rectangular tag"
  vocabulary (`badge` anatomy: `--radius-sm`, `--text-label`, tabular numbers,
  `::before` swatch), NOT pill chips or decorative circles.
- **VL-002** — Label colors come from a **fixed controlled palette** of muted
  categorical colors (D-3), each mapped to a `--color-label-<key>-{bg,text,
  border}` token family. The palette is deliberately distinct from status
  colors (blue/amber/green), priority colors (grey/amber/orange/red), the
  petrol brand, and the coral danger color, so a label can never be mistaken
  for a status/priority/brand/destructive affordance.
- **VL-003** — Labels never outrank the ticket key, title, or status/priority
  badges in the ledger; they sit in the secondary metadata row (per the
  ledger hierarchy: ticket key → title → metadata).
- **VL-004** — No gradients, glass, shadows, new card patterns, or new radius/
  spacing values are introduced; existing tokens and the ledger language are
  reused.
- **VL-005** — The label tag color is always reinforced by the label **name
  text** (NFR-005); swatches are `aria-hidden` decoration.
- **VL-006** — `VISUAL_LANGUAGE.md` MUST be updated during implementation to
  document the new Label Color System (the palette keys, token roles, when to
  use them, and the "distinct from status/priority/brand/danger" rule), since
  this is a genuinely new semantic color role (AGENTS.md token rule).
- **VL-007** — If the default `'violet'` migration color is ever shown for a
  label whose stored value is unknown, the frontend must render it safely as a
  neutral/label tone; in practice the API always returns the stored palette
  value.

### 7.10 Accessibility Requirements

- **A11Y-001** — The issue-form label picker stays **native checkboxes**
  (keyboard: Tab + Space; labelled controls). No custom multi-select is
  introduced.
- **A11Y-002** — Color selection uses a **native radio group** with visible
  color-name labels ("Violet", "Magenta", …); the color is never selectable by
  swatch alone.
- **A11Y-003** — Color swatches (chips, tags, rail rows) are `aria-hidden`;
  the adjacent label name text carries the accessible name.
- **A11Y-004** — Create/rename/re-color/delete use the existing `Dialog`
  (focus trap, Escape closes, focus returns to trigger, `role="dialog"`,
  `aria-modal`, labelled title).
- **A11Y-005** — Field-level errors use the existing `Field` `aria-invalid` +
  `aria-describedby` wiring; page/dialog-level errors use `role="alert"` via
  the existing `Alert`/`useFocusAlert` pattern.
- **A11Y-006** — `@media (pointer: coarse)` MUST give label chips, radio
  swatches, and label-row actions a 44px minimum touch target (extend the
  existing coarse-pointer block).
- **A11Y-007** — No new motion; any transitions use existing duration/easing
  tokens and respect `prefers-reduced-motion`.
- **A11Y-008** — All touched surfaces MUST pass the axe suite with no new
  violations, and keyboard-only flows must remain complete.

### 7.11 Responsive Requirements

- **RES-001** — Ledger label tags wrap within the existing `ledger-meta`
  (`flex-wrap`); the mono ticket key and title remain visible; no horizontal
  page overflow.
- **RES-002** — The Labels section participates in the existing workspace
  two-column collapse (≤1100px) and stacks naturally at narrow widths.
- **RES-003** — Dialogs (create/rename/delete label) use the existing
  near-full-screen behavior ≤700px / ≤375px.
- **RES-004** — The label filter dropdown participates in the existing filter
  bar stacking at ≤375px.
- **RES-005** — Important label information is never hidden to make a layout
  fit; tags truncate/wrap per existing badge rules.

### 7.12 Error & Empty-State Requirements

- **ERR-001** — Workspace with no labels: Labels section empty state ("No
  labels yet" + short explanation + "New label" action); issue-form picker and
  label filter are hidden.
- **ERR-002** — Issue with no labels: fact rail shows "No labels".
- **ERR-003** — Duplicate label name: `409` → inline dialog alert
  ("A label with this name already exists"), dialog stays open, input retained.
- **ERR-004** — Invalid/missing color: `422` field error on `color`; invalid
  name: `422` field error on `name`.
- **ERR-005** — Unauthorized (not signed in): `401`; non-member: `403` —
  rendered via the existing alert pattern; the UI does not fabricate any
  alternative message.
- **ERR-006** — Nonexistent label on `PATCH`/`DELETE`: `404`; the UI reloads
  the list and the stale row disappears.
- **ERR-007** — Cross-workspace label assignment: `422` on the issue form field
  `labelIds` (message consistent with existing validation copy).
- **ERR-008** — All messaging uses the existing concise product voice; no
  marketing copy.

### 7.13 Data Integrity Requirements

- **DI-001** — A user MUST never attach a label from workspace A to an issue in
  workspace B; enforced server-side in `validateLabels` (SEC-004), never by
  frontend filtering.
- **DI-002** — Labels are owned by exactly one workspace (`workspace_id`
  FK, `ON DELETE CASCADE` when the workspace is deleted).
- **DI-003** — Deleting a label removes only the `issue_labels` relationship
  rows (FK cascade); issues and all other issue data remain unchanged; no
  dangling label references can exist.
- **DI-004** — Malformed/nonexistent label ids and duplicate ids in a request
  are rejected before any write (`422`).
- **DI-005** — Duplicate names within a workspace are prevented by the unique
  index (`409`); cross-workspace names are independent.
- **DI-006** — Every displayed label name/color in the UI is backed by real
  application data from the API; nothing is fabricated client-side (NFR-007,
  data honesty).

### 7.14 Performance Requirements

- **PERF-001** — `listLabels` is a single indexed query.
- **PERF-002** — Issue payload label enrichment reuses the existing
  `issueLabels` batch query and adds **one** additional indexed query on
  `labels.id` (IN over the collected label ids) to build the `labels` map;
  there is **no N+1** across list rows.
- **PERF-003** — WorkspacePage fetches the workspace label list once (shared by
  the Labels section and the filter dropdown); IssuePage needs no label-list
  fetch (labels are embedded); IssueForm keeps its existing single labels fetch
  for the picker.
- **PERF-004** — MVP scale assumption: tens of labels per workspace and a small
  number of labels per issue; no caching infrastructure is introduced.

### 7.15 Testing Requirements

#### Backend (new `backend/tests/integration/labels.test.ts`; extend
`backend/tests/integration/issues.test.ts`)

- Label create (with color) → `201`, returns `{ id, workspaceId, name, color }`.
- Label create missing/invalid color → `422` field error on `color`.
- Label create blank/whitespace/over-50 name → `422`.
- Duplicate name same workspace (create and rename) → `409`.
- `Bug` vs `bug` both creatable in one workspace (case-sensitive).
- Same label name in two different workspaces → both allowed.
- List labels → `200` `{ items }`, ordered by name.
- Rename label → `200`; change color → `200`.
- Rename label to its own current name → `200` no-op.
- Delete label → `204`; label no longer in list.
- Delete a label referenced by issues → issues remain; their `labels` no longer
  include it; `labelIds`/`labels` are consistent.
- Unauthenticated create/list/patch/delete → `401`.
- Non-member create/list/patch/delete → `403`.
- Cross-workspace: member of A cannot patch/delete B's label → `403`.
- Nonexistent label id on patch/delete → `404`.
- Issue create/update with a label from another workspace → `422` (bug fix).
- Issue create/update with duplicate `labelIds` → `422`.
- Issue create/get/list/update return embedded `labels` (id, name, color)
  alongside preserved `labelIds`.
- Assign/remove labels via `PATCH /issues/:id` (`labelIds` replace-all).
- Extend `backend/tests/unit/migration.test.ts`: `0003` applies cleanly on a
  `0001`+`0002` database; pre-existing labels receive the default color.
- Optional `backend/tests/unit` validators test for the label schema.

#### Frontend (new `frontend/tests/component/labels.test.tsx`; extend
`issue.test.tsx`, `issue-page.test.tsx`, `workspace-page.test.tsx`)

- Labels section: empty state; create label (name + color); rename; re-color;
  delete with confirmation; duplicate-name error keeps dialog open.
- Issue form: chips render color swatches; checking/unchecking updates
  `labelIds`; submit posts `labelIds`.
- Issue page: fact rail renders label tags from embedded `labels`; "No labels"
  when empty.
- Workspace page: ledger rows render label tags; label filter dropdown filters
  (asserts `labelId` query param); label filter hidden when no labels.
- Multiple labels on one issue render correctly (order independent).
- Error states: duplicate name alert; `422`/`403`/`404` surfaced per existing
  alert pattern.

#### Accessibility (`frontend/tests/accessibility/core.test.tsx`)

- axe-clean: labels section, create/rename/re-color/delete dialogs, ledger with
  labels, fact rail with labels, color radio group, colored chips.
- Keyboard: chips toggle with Space; radio group arrows; dialogs trap/escape/
  focus-return; label-row actions reachable.
- Swatch `aria-hidden` + accessible name from visible text.
- Coarse-pointer 44px targets asserted where feasible.

### 7.16 Key Entities

- **Label** — `{ id, workspaceId, name, color }`. Workspace-scoped;
  reusable by any issue in the workspace; `(workspaceId, name)` unique.
  Relationships: belongs to 1 Workspace; applied to 0..n Issues via
  `IssueLabel`.
- **IssueLabel** — unchanged join (issueId, labelId); cascade on both sides.
- **Issue** — unchanged attributes; `labelIds` preserved; gains additive
  `labels` projection.

## 8. Acceptance Scenarios

1. **Given** a workspace, **When** a member opens it, **Then** a Labels section
   lists the workspace's labels with names and color swatches, and supports
   create/rename/re-color/delete.
2. **Given** the new-label dialog, **When** the member enters a valid name and
   a palette color, **Then** `201` returns `{ label: { id, workspaceId, name,
   color } }` and the label appears immediately.
3. **Given** a workspace, **When** a member tries to create two labels with the
   same name, **Then** the second attempt fails with `409` and no duplicate
   exists.
4. **Given** an issue form, **When** the member checks several label chips and
   saves, **Then** the issue carries those labels; the ledger row and fact rail
   render them as colored tags with names.
5. **Given** an issue API payload, **When** it is returned, **Then** it contains
   `labelIds` and an additive `labels` array with `{ id, name, color }`.
6. **Given** a label filter selected in the workspace, **When** the ledger
   loads, **Then** only issues with that label appear.
7. **Given** a label referenced by issues, **When** it is deleted after
   confirmation, **Then** the label disappears from every issue and every
   surface, and the issues themselves are untouched.
8. **Given** a label from workspace A, **When** it is submitted in `labelIds`
   for an issue in workspace B, **Then** the server rejects the request with
   `422` and no relationship is created.
9. **Given** a label in workspace B, **When** a user who is not a member of B
   attempts to update or delete it, **Then** the request fails with `403`.

## 9. Success Criteria *(mandatory)*

- **SC-001**: A workspace member can create a label with a name and color,
  assign it to an issue, and see it in the ledger and detail page in under
  2 minutes.
- **SC-002**: 100% of labels have a valid palette color (validation + NOT NULL
  column; verified by tests).
- **SC-003**: The server rejects every cross-workspace label assignment with
  `422` and every unauthorized label CRUD with `403` (verified by tests).
- **SC-004**: Deleting a label leaves all affected issues intact with no
  dangling label reference (verified by tests).
- **SC-005**: Issue list queries gain at most one extra query and remain within
  the feature-001 performance budget.
- **SC-006**: All existing backend, frontend, and accessibility tests pass after
  the change, plus the new label tests.
- **SC-007**: The `0003` migration applies cleanly to a database at the `0001`
  + `0002` schema; existing labels are preserved with the default color.
- **SC-008**: All touched surfaces pass the axe suite with no new violations;
  keyboard-only flows (form chips, color radios, dialogs) remain complete.
- **SC-009**: No label color is conveyed by color alone — label name text is
  always present.

## 10. Explicit Decisions

- **D-1 — Label ownership is workspace-level**: a label belongs to exactly one
  workspace and is reusable by any project/issue in it. This is already the
  implemented model (`labels.workspace_id`, `issue_labels`) and is preserved
  unchanged.
- **D-2 — Label properties are `id`, `workspaceId`, `name`, `color` only**.
  **No timestamps**: the existing `labels` table was deliberately created
  without them and the MVP needs none (additive timestamps would be a
  speculative migration). **No description, slug, icon, category, ordering,
  usage count, creator, or permissions** (all in Non-Goals).
- **D-3 — Label color is a fixed controlled palette of 6 muted categorical
  colors**, not arbitrary hex, not the status/priority/brand/danger families.
  Keys: `violet`, `magenta`, `indigo`, `olive`, `sand`, `plum`. Rationale: the
  architecture has no arbitrary-color support; the design system's existing
  semantic families (status blue/amber/green, priority grey/amber/orange/red,
  petrol brand, coral danger) are all semantically reserved, so a dedicated
  muted label palette (distinct hues, new `--color-label-*` token family,
  AA-compliant, warm-paper harmonious) is genuinely required. This adds a new
  semantic color role → `VISUAL_LANGUAGE.md` MUST be updated during
  implementation (VL-006). Color is **required** on create; the UI preselects
  `violet`; the migration default is `violet` for legacy rows.
- **D-4 — Label names are case-sensitive**: `Bug` and `bug` are distinct
  labels. Rationale: the existing unique index uses SQLite's default BINARY
  collation; case-insensitive uniqueness would require changing the collation
  of an existing column and adds normalization machinery for no MVP benefit.
  Documented, not accidental. Names are stored trimmed; internal case is
  preserved as entered.
- **D-5 — Issue payloads are enriched additively with `labels`** (embedded
  `Label[]`) while `labelIds` is preserved. Rationale: consistent with Feature
  003's server-side identity enrichment (`assignee`/`author`); it makes label
  name/color available to the ledger, detail, and search surfaces without
  per-page resolution or extra requests, and removes the IssuePage label-name
  fetch. One extra indexed query per list, within budget (PERF-002).
- **D-6 — Label management is member-level** (`requireMember`), matching
  project management. No owner-only gate, no new permission system.
- **D-7 — Deleting a label cascades the relationship away from issues and
  leaves issues unchanged** — the existing FK `ON DELETE CASCADE` on
  `issue_labels.label_id` already implements this; no dangling references are
  possible. UI shows a destructive confirmation.
- **D-8 — No dedicated add/remove-label endpoints**: assignment is reused via
  the existing `PATCH /issues/:id` `labelIds` (replace-all semantics).
- **D-9 — Label management lives in a compact Labels section in the workspace
  page left column** (mirroring the Projects rail anatomy), not a new settings
  system. It is the smallest consistent surface the architecture already
  implies.
- **D-10 — A single "Filter by label" dropdown is in scope** (reuses the
  existing `labelId` API). Saved/advanced/combined filters are Non-Goals.
- **D-11 — A dedicated `LabelService`** (`backend/src/services/label.ts`) owns
  label CRUD; `createLabel`/`listLabels` are extracted from `issueService` into
  it (modularity, Constitution II). `validateLabels` stays in the issue service
  but is fixed to scope by workspace (SEC-004). Label validators move to a
  dedicated `backend/src/api/validators/label.ts`.
- **D-12 — Label rendering reuses the existing `Badge`** with new
  `label-<color>` tones (no new tag component) and the existing `.label-chip`
  checkbox picker pattern (no custom multi-select).

## 11. Assumptions

> These are assumptions made for this specification, not confirmed product
> decisions.

- **The example label names** (bug, frontend, backend, documentation,
  enhancement, ui) are illustrative; no seeded/default labels are created.
  Labels start empty in each workspace.
- **Color is required** on label create and update-when-present; the UI
  preselects the first palette color.
- **Label tags in the ledger** sit in the secondary metadata row (between
  priority and assignee); exact placement follows the implementation while
  preserving the ledger signature.
- **The issue-form label picker remains hidden when the workspace has no
  labels** (existing behavior preserved); discovery happens through the Labels
  section.
- **Issue-page fact-rail change** (always-visible "Labels" row with "No
  labels") is a deliberate consistency fix aligned with VISUAL_LANGUAGE §24
  ("empty values render honestly"), not a regression.
- **The default migration color `'violet'`** applies only to pre-existing
  label rows; new labels always carry an explicit palette color.
- **Label list ordering** by name ascending is an additive, non-breaking
  improvement to make pickers/lists deterministic.
- **A member with access to a workspace can manage its labels**; no
  owner-only gate exists today and none is introduced.

## 12. Risks / Open Questions

- **Label palette exact hex values**: the palette keys and their required
  properties (muted, distinct from reserved families, AA-compliant,
  warm-paper harmonious) are fixed here, but the exact `--color-label-*` hex
  values are design tokens finalized at implementation time when `tokens.css`
  and `VISUAL_LANGUAGE.md` are updated. Recommended starting values (subject to
  an axe/AA pass): violet `#5B3F9E`, magenta `#A21C6E`, indigo `#4F46A3`,
  olive `#566B1F`, sand `#7A5A2E`, plum `#7A3B5C`, each with a light bg tint
  and muted border.
- **`Issue.labels` embedded size**: embedding full `Label` objects (including
  `workspaceId`) is mildly redundant per issue row. Accepted for MVP for a
  single shared type (DM-004); if payload size ever matters, a compact
  `{ id, name, color }` projection can be introduced as a documented follow-up.
- **Case-insensitive label uniqueness** was rejected for the MVP (D-4); if the
  product later wants `Bug` ≡ `bug`, it requires a collation change to the
  existing table — a separate, deliberate feature.
- **Label filter is single-select only**; multi-label filtering is out of
  scope (Non-Goals) and the API's single `labelId` param already matches.
- **Legacy label rows** receive `'violet'` via the migration default; if the
  palette changes later, existing stored keys are preserved (keys are stable
  strings, not hex), so remapping is a frontend-token concern only.

## 13. Out of Scope

- Saved filters, advanced filter builders, multi-label AND/OR filtering.
- Label analytics / usage counts / statistics (data honesty — not provided by
  the API).
- Label hierarchy, nested labels, groups, custom ordering, icons.
- Label-level permissions, subscriptions, notifications, automation.
- Bulk issue editing, recurring issues.
- Free-form arbitrary label colors; dark mode; real-time; billing;
  integrations; AI.
- Inline label creation from the issue form.
- Any change to authentication, membership, status/priority enums, search,
  dashboard, projects, or comments beyond what this feature requires.