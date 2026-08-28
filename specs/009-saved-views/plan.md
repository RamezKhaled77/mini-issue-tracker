# Implementation Plan — Spec 009: Saved Views

> Stage 1 only: plan. **No implementation code changes in this stage.** This plan guides
> the operator-approved implementation pass that follows review.

## Objectives

Add workspace-scoped **Saved Views** to the existing Workspace page: capture the current
per-project ledger filter configuration (search / status / priority / label + project)
as a versioned JSON preset; list them in a quiet "Saved views" shelf in the left rail;
restore/replace filters on selection; rename and delete with the Labels-style CRUD
conventions. Backend mirrors Labels routes/validators/auth and reuses the existing
`IssueQueryParams` model and `listIssues` unchanged. No new page, no new filter model,
no new visual language.

## Guiding constraints

- No new filtering model: reuse `IssueQueryParams` (`shared/index.ts`) + the read path
  `listIssues`; a view's config is stored as versioned JSON with no FK to project/label
  (spec D-06) so deletes never cascade a view.
- Authorization reuses `membershipService.requireMember` on every route (spec D-05).
- API mirrors Labels exactly (spec D-07): workspace-scoped create/list, id-scoped
  update/delete; duplicate name → 409.
- Reuse: `LabelsSection` shelf anatomy, `Dialog`, `Field`, `Button`, `Alert`,
  `EmptyState`, `SkeletonRows`, `useFocusAlert`, `.filter-bar`/`.filter-meta`,
  `.label-list`/`.label-row` family, `project.ts`/`label.ts` domain-record patterns.
- Extend, don't fork: a `SavedViewsSection` composes LabelsSection anatomy; "Save view"
  composes the shared Dialog into the filter bar.
- No Activity writes; no URL filter persistence (spec D-09); no counts (spec D-10).

## Phase 0 — Shared contract

**Files:** `shared/index.ts`

- Add `VIEW_NAME_MAX_LENGTH = 60` and `SAVED_VIEW_FILTERS_VERSION = 1` constants.
- Add `SavedViewFilters` (versioned, matching the workspace ledger filter fields:
  `{ version, projectId, search?, status?, priority?, labelId? }`).
- Add `SavedView` (`id, workspaceId, createdById, name, filters, createdAt, updatedAt`)
  with `filters` typed as parsed `SavedViewFilters`.
- Add `CreateSavedViewRequest`, `UpdateSavedViewRequest`.

**Exit criteria:** shared typecheck passes; backend/frontend still compile.

## Phase 1 — Migration + schema

**Files:** `backend/src/db/migrations/0006_saved_views.sql` (new),
`backend/src/db/schema.ts`, `backend/tests/unit/migration.test.ts`

- `CREATE TABLE saved_views(...)`: id TEXT PK; `workspace_id` NOT NULL FK CASCADE;
  `created_by_id` NOT NULL FK CASCADE; `name` TEXT NOT NULL; `filters` TEXT NOT NULL;
  `created_at`/`updated_at` INTEGER (timestamp). Unique index
  `saved_views_workspace_name_idx(workspace_id, name)`; indexes on `workspace_id` and
  `created_by_id`. Matches `0004_activities.sql` style.
- Add matching `savedViews` `sqliteTable` + relations in `schema.ts`.

**Exit criteria:** migration applies cleanly on the existing schema in the migration
unit test; typecheck green.

## Phase 2 — Domain + validator

**Files:** `backend/src/domain/savedView.ts` (new),
`backend/src/api/validators/savedView.ts` (new),
`backend/tests/unit/saved-views-validator.test.ts` (new)

- Domain: `createSavedViewRecord(workspaceId, createdById, name, filters) -> entity`
  (mirrors `label.ts`/`project.ts`; `randomUUID`; `filters` kept as the parsed object,
  serialized at the service boundary).
- Validator:
  - `savedViewFiltersSchema`: `version: z.literal(1)`; `projectId` uuid; `search`
    trimmed ≤200; `status`/`priority` enums; `labelId` uuid; reject extra keys.
  - `createSavedViewSchema`: `name` trimmed 1..60; `filters` = savedViewFiltersSchema.
  - `updateSavedViewSchema`: partial (name and/or filters) + `refine` ≥1 field.
- Unit tests: name bounds/whitespace, version rejection, enum/length validation,
  extra-key rejection, update ≥1-field refinement.

**Exit criteria:** validator unit tests green.

## Phase 3 — Backend service

**Files:** `backend/src/services/savedView.ts` (new)

- `createSavedViewService({ db, membershipService })`.
- `getWorkspaceIdForView(viewId)` → 404 or workspace id (mirrors
  `LabelService.getWorkspaceIdForLabel`).
- `create(workspaceId, input, userId)`: `requireMember`; validate filters against the
  workspace (project exists in workspace; labelId, if present, is a label in this
  workspace — reuse the `IssueService` label-validation shape); serialize filters to
  JSON; insert; catch unique violation → 409 `CONFLICT` "A view with this name already
  exists".
- `list(workspaceId, userId)`: `requireMember`; select where workspace, order by
  `created_at`; parse + re-validate each JSON (unparseable → surfaced as a safe
  unreadable marker, never a crash).
- `update(viewId, input, userId)`: resolve workspace via `getWorkspaceIdForView`;
  `requireMember`; apply name and/or filters (re-validated); bump `updated_at`; 409 on
  duplicate rename; 404 on missing.
- `delete(viewId, userId)`: resolve workspace; `requireMember`; delete; 404 on missing.
- No transactions needed beyond single inserts/updates (atomic in SQLite).

**Exit criteria:** service compiles; integration tests in Phase 4 pass.

## Phase 4 — Route, wiring, backend tests

**Files:** `backend/src/api/routes/savedViews.ts` (new), `backend/src/api/routes/index.ts`,
`backend/tests/integration/saved-views.test.ts` (new)

- Routes mirror Labels: `POST/GET /workspaces/:workspaceId/views`,
  `PATCH/DELETE /views/:id`; `requireAuth`; zod `safeParse` → 422 with `fields`; register
  in `registerRoutes` (`app.use("/api", savedViewRoutes({...}))`).
- Integration tests (modeled on `labels.test.ts`): create/list/update/delete shapes;
  duplicate create + rename → 409; name/filter validation → 422; missing workspace →
  403; nonexistent view → 404; cross-workspace isolation (member A cannot read/write B's
  views; owner-without-membership on B → 403); stale refs returned as stored; malformed
  stored JSON handled safely.

**Exit criteria:** backend suite green (run the `backend` test + typecheck separately to
avoid the monorepo timeout).

## Phase 5 — API client + Saved Views UI

**Files:** `frontend/src/api/client.ts`,
`frontend/src/components/SavedViewsSection.tsx` (new),
`frontend/src/lib/savedViewFilters.ts` (new),
`frontend/src/pages/WorkspacePage.tsx`, `frontend/src/styles/components.css`

- Client: add `listSavedViews`, `createSavedView`, `updateSavedView`,
  `deleteSavedView` methods reusing `get/post/patch/delete`.
- `SavedViewsSection`: a compact shelf mirroring `LabelsSection` — `section-header` +
  `section-title` "Saved views", rows in the `.label-list`/`.label-row` family
  (`.view-list`/`.view-row` only if needed), active row (`aria-current` + petrol
  treatment), ghost **Edit** (rename Dialog) + confirm-gated **Delete** Dialog, empty
  state + skeleton. Props: `views`, `activeViewId`, `loading`, `onApply`, `onChange`.
- Resolve helper `lib/savedViewFilters.ts`: given a config + loaded projects + labels,
  return `{ projectId?, appliedFilters, stale: { project?, label? } }` (spec §13).
- WorkspacePage: load views alongside labels; wire selection → resolve → set
  `selectedProject`/`search`/`statusFilter`/`priorityFilter`/`labelFilter` and clear
  bulk selection (replaces, D-04); add the **Save view** ghost button in `filter-meta`
  → Dialog with a name `Field` → POST → refresh shelf.
- CSS: `.view-row--active` (existing petrol tokens), optional `.view-unavailable` quiet
  note, Save-view spacing in `filter-meta`; register any new interactive class in the
  existing 44px coarse-pointer rule; ≤375/≤700 stacking.

**Exit criteria:** feature usable end-to-end; component tests drafted first and green.

## Phase 6 — Integration into the issues column (apply path)

**Files:** `frontend/src/pages/WorkspacePage.tsx`,
`frontend/src/components/SavedViewsSection.tsx`

- Selecting a view runs the resolve step (stale project → quiet "unavailable" state with
  safe back-out; stale label → drop label + quiet note) then relies on the existing
  `loadIssues` effect (no new query logic).
- Active-view marking tied to the last-applied view id; editing filters via controls
  clears the active marking (the ledger no longer matches the view exactly).
- Apply-time flushing of previous selection; no fabricated counts.

**Exit criteria:** AS-1/AS-2/AS-6/AS-7/AS-8 behave per spec; defaults unchanged.

## Phase 7 — Frontend tests & accessibility

**Files:** `frontend/tests/component/saved-views.test.tsx` (new), extended
`frontend/tests/component/workspace-page.test.tsx`, extended
`frontend/tests/accessibility/core.test.tsx`

- Component: shelf render/empty/loading/error; create flow (Save view → dialog → POST →
  refresh); validation error in dialog; apply restores project+filters and refetches;
  replace-preconditions; rename; delete confirmation; stale project (unavailable, no
  crash) + stale label (applied w/o label + note); keyboard (open/enter/escape);
  responsive smoke ≤375/≤700 (no overflow, stacking, 44px targets).
- Axe: shelf, Save/Rename dialogs, active-view treatment.

**Exit criteria:** frontend suite + axe green; existing accessibility tests preserved.

## Phase 8 — Styles finalization & full verification

**Files:** `frontend/src/styles/components.css`, `frontend/VISUAL_LANGUAGE.md` (only if
implementation introduces a genuinely new reusable pattern)

- Review against the visual-review checklist (hierarchy, rhythm, structure, typography,
  color, reuse, accessible, responsive).
- If a genuinely new pattern exists (view-shelf anatomy / active-view treatment /
  Save-view affordance), document it in `VISUAL_LANGUAGE.md` grounded in what shipped;
  otherwise note "No visual language changes were introduced; the existing system was
  extended."
- Full verification: backend and frontend suites run **separately**, plus typecheck,
  lint, build, axe. Walk through spec §23 acceptance scenarios manually.

**Exit criteria:** everything green; spec §23 walked manually.

## Dependencies & ordering

```
Phase 0 (shared) → Phase 2 (validator) → Phase 3 (service) → Phase 4 (route+tests)
Phase 0 → Phase 1 (migration/schema) → Phase 3 (service needs schema)
Phases 0+3+4 → Phase 5 (client + UI) → Phase 6 (apply path)
Phases 5+6 → Phase 7 (frontend tests + axe) → Phase 8 (styles/doc/verification)
```

## Risks

| Risk | Mitigation |
|---|---|
| Drifting into a second filter model | Store exactly the existing `IssueQueryParams` fields; apply path reuses `listIssues`; My Issues excluded |
| Deleted project/label crash or cascade-deletes a view | JSON refs, no FK (D-06); apply-time resolver drops/deffers; tested stale-ref cases |
| Cross-workspace leak | `requireMember` on every route + `getWorkspaceIdForView`; isolation integration tests |
| View shelf/affordance outshines the ledger | Compose LabelsSection/filter-bar anatomy; VL review checklist; no cards/shadows/tokens |
| Validation vs stored-JSON drift | Same zod schema for write + read-parse; version literal guard |
| Rename/duplicate UX confusion | 409 CONFLICT → friendly dialog field error; mirror Labels behavior |
| Monorepo test timeout | Run backend and frontend suites separately |

## Performance notes

Single indexed list query per workspace; no joins required in v1; applying reuses
`listIssues`; JSON is one small object parsed on read/apply. No polling, no realtime,
no prefetch. Revisit only at thousands of views per workspace (out of scope).
