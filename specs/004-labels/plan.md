# Implementation Plan: Labels — Mini Issue Tracker

**Branch**: `004-labels` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-labels/spec.md`

**Scope of this document**: The PLAN phase only. This file converts the approved
spec into phased, implementation-ready instructions. No application code,
database change, migration, API route, frontend component, CSS, or dependency
is modified by this plan. `tasks.md` is NOT created by this plan — it is the
output of a later `/speckit.tasks` step after this plan is approved.

## Summary

Turn the existing **dormant** label infrastructure into a complete, user-visible
workspace-level label system:

- `labels` / `issue_labels` tables and the two-endpoint label API already exist;
  issues already accept/return `labelIds` and the workspace filter API already
  accepts `?labelId=`. There is no color, no rename, no delete, no management
  UI, no ledger tags, and no filter UI — and `validateLabels` has a
  **cross-workspace data-integrity hole**.
- The plan adds: a `color` column (fixed 6-color muted palette) via migration
  `0003_label_color.sql`; a dedicated `LabelService`; `PATCH/DELETE
  /api/labels/:id`; workspace-scoped label validation with duplicate-id
  rejection; additive embedded `Issue.labels`; a Labels management section in
  the workspace left column; color-aware chips in the issue form; an
  always-visible Labels fact-rail row; colored tags in the ticket ledger; and a
  "Filter by label" dropdown.
- Reuses the existing visual system (compact rectangular badges, `--color-label-*`
  token family, `Badge` component, `.label-chip` picker, `Dialog`/`Field`/
  `Button` CRUD patterns, member-level authorization, additive payloads).
- Updates `VISUAL_LANGUAGE.md` (repo root) with a new **Label Color System**
  section — a genuinely new semantic color role (spec VL-006).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Node.js 22 LTS, Express 5, Vite 5 (existing, unchanged)

**Primary Dependencies**: No new dependencies (NFR-006). Existing: Express 5 +
Drizzle ORM 0.33 + better-sqlite3, zod (validation), argon2 (hashing); React 18
+ Vite + React Router; plain CSS with design tokens from feature 002.

**Storage**: SQLite via better-sqlite3 + Drizzle ORM. Schema in
`backend/src/db/schema.ts`; migrations as SQL files in
`backend/src/db/migrations/` applied automatically at server open by
`runMigrations` (`backend/src/db/migrate.ts`, versioned by numeric prefix via
`PRAGMA user_version`). Feature adds `0003_label_color.sql`.

**Testing**: Vitest + supertest (backend integration/unit), React Testing
Library (frontend component), vitest-axe / axe-core (accessibility). All
existing suites must stay green; extended per spec §7.15.

**Target Platform**: Linux/macOS server; evergreen browsers at desktop/tablet/mobile widths (feature 002).

**Project Type**: web application (React SPA + Express REST API + shared TS types workspace).

**Performance Goals**: No regression (NFR-002). Issue list/queries remain within
the feature-001 budget (< 2s for ~1,000 issues, paginated pageSize ≤ 100).
Label enrichment adds **one** additional indexed query per list (PERF-002), no
N+1. `listLabels` stays a single indexed query (PERF-001).

**Constraints**: Additive schema/API changes only; `color` required on create
with a `NOT NULL` column (SQLite default `'violet'` for legacy rows only); no
new tables; no timestamps; no label usage counts (NFR-007 / data honesty);
backend validation authoritative; member-level authZ (same as projects); no new
dependencies; WCAG AA + keyboard on touched surfaces (NFR-004).

**Scale/Scope**: ~25 members/workspace, ~1,000 issues/project, tens of labels
per workspace, a few labels per issue (PERF-004). Touched: 1 column on 1 table,
1 new migration, 1 new service, 1 new domain module, 1 new validator module,
2 label API routes + 2 rewired routes, shared `Label`/`Issue`/request types,
`Badge` tones, tokens + CSS, 3 workspace/issue surfaces, ~10 test files.

## Constitution Check

*GATE: Must pass before implementation. Re-check after each phase.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Simplicity First | PASS | Adds one column + palette constant + one service; reuses existing tables/join/API/filter param/picker; no taxonomy machinery, no new tables, no new deps |
| II. Modular & Maintainable Design | PASS | Dedicated `LabelService` + `domain/label.ts` + `validators/label.ts` (D-11); one `Label` type everywhere (DM-004); enrichment reuse of existing batch query pattern |
| III. Type Safety & Consistency | PASS | Shared `Label`/`LabelColor`/`Issue.labels`/`UpdateLabelRequest` defined once, consumed by backend + frontend; `labelIds` preserved |
| IV. Security by Default | PASS | `validateLabels` fixed to scope by workspace (SEC-004); workspace resolved from label row, never client id (SEC-003); allowlisted fields (SEC-005); duplicate ids rejected (DI-004) |
| V. Test Critical Behavior | PASS | New backend integration suite (labels + security), extended issue suite, migration unit test, frontend CRUD/ledger/filter/a11y tests per §7.15 |
| VI. User Experience & Accessibility | PASS | Native checkboxes + native radio group with visible color names; dialogs use existing focus-trap pattern; swatches aria-hidden; name text always present (NFR-005) |
| VII. Requirements Before Implementation | PASS | Full spec approved; this plan precedes any code; every requirement mapped to a phase (§Phase Traceability) |
| VIII. No Silent Assumptions | PASS | Palette hex values (start values only), case-sensitivity (D-4), default color, member-level authZ, no-op rename, ordering all documented |
| IX. Explicit Decisions | PASS | D-1…D-12 recorded in spec §10; plan maps each to implementation steps |

No gate violations. Complexity Tracking left empty (no unjustified complexity).

## Project Structure

### Documentation (this feature)

```text
specs/004-labels/
├── plan.md              # This file (PLAN phase output)
├── spec.md              # Approved specification (source of truth)
├── research.md          # Phase 0 output (if created later, optional)
├── data-model.md        # Phase 1 output (if created later, optional)
├── contracts/           # API/type contract deltas (if created later, optional)
├── quickstart.md        # Phase 1 output (if created later, optional)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created here)
```

### File Impact Map

Legend: **MODIFY** = edit existing file · **CREATE** = new file · **DELETE** =
remove · **INSPECT** = read/verify only, no edit (guide to implementation).

#### Backend

| Action | File | Change |
|--------|------|--------|
| CREATE | `backend/src/db/migrations/0003_label_color.sql` | `ALTER TABLE labels ADD COLUMN color TEXT NOT NULL DEFAULT 'violet';` (DM-001, NFR-003) |
| MODIFY | `backend/src/db/schema.ts` | `labels.color: text("color").notNull().default("violet")` (mirror migration) |
| CREATE | `backend/src/domain/label.ts` | `LabelEntity` gains `color`; `createLabelRecord(workspaceId, name, color)` (D-11, DM-004) |
| MODIFY | `backend/src/domain/issue.ts` | Remove `LabelEntity` / `createLabelRecord` (moved to `domain/label.ts`); update imports |
| CREATE | `backend/src/api/validators/label.ts` | `createLabelSchema { name, color }`, `updateLabelSchema` (partial + at-least-one refine) (D-11) |
| MODIFY | `backend/src/api/validators/issue.ts` | `labelIds`: add duplicate-id rejection → 422 (DI-004, §7.5) |
| CREATE | `backend/src/services/label.ts` | `createLabelService`: create/list (name asc)/update/delete; workspace resolved from label row; 409 on duplicate, 404 on missing (D-11, SEC-002/003/007, PERF-001) |
| MODIFY | `backend/src/services/issue.ts` | Remove `createLabel`/`listLabels`; **fix** `validateLabels` (workspace scope + duplicate rejection, SEC-004); enrich `getIssue`/`listIssues` with embedded `labels` (single extra indexed query, PERF-002) |
| MODIFY | `backend/src/api/routes/labels.ts` | Rewire to `labelService`; `color` in create; `GET` list ordered by name; **NEW** `PATCH /api/labels/:id`, `DELETE /api/labels/:id` (404/409/422/403) |
| MODIFY | `backend/src/api/routes/index.ts` | Instantiate + wire `labelService` |
| INSPECT | `backend/src/api/routes/issues.ts` | No change (routes already accept `labelIds`; reuse for assignment, D-8) |
| INSPECT | `backend/src/services/project.ts` | Copy the `getWorkspaceIdForProject` resolution pattern for label-scoped authZ |
| INSPECT | `backend/src/services/membership.ts` | Reuse `requireMember` (403) as-is |
| INSPECT | `backend/src/db/migrate.ts`, `0001_initial.sql`, `0002_user_display_name.sql` | Confirm runner auto-applies 0003 by prefix + `PRAGMA user_version` |
| INSPECT | `backend/src/api/middleware/error-handler.ts` | Reuse ApiError codes 401/403/404/409/422 + single error shape |
| CREATE | `backend/tests/integration/labels.test.ts` | Full label CRUD + security + color tests (spec §7.15 backend list) |
| MODIFY | `backend/tests/integration/issues.test.ts` | Embedded `labels` assertions; cross-workspace → 422; duplicate `labelIds` → 422; delete-cascade consistency |
| MODIFY | `backend/tests/api.test.ts` | Label create payloads gain `color`; assert embedded labels |
| MODIFY | `backend/tests/unit/migration.test.ts` | 0003 applies on 0001+0002 db; legacy label rows get `violet`; user_version = 3 |
| INSPECT | `backend/tests/helpers.ts` | `setupApp`, `signupAs`, `createWorkspace`, `createProject`, `joinWorkspace` reused as-is |

#### Shared

| Action | File | Change |
|--------|------|--------|
| MODIFY | `shared/index.ts` | **Phase 1**: `LABEL_COLORS` const (`["violet","magenta","indigo","olive","sand","plum"] as const`), `LabelColor` type. **Phase 4**: `Label.color: LabelColor`; `Issue.labels: Label[]` (additive); `CreateLabelRequest.color`; `UpdateLabelRequest`; `IssueQueryParams.labelId` (already exists, verify) |

#### Frontend

| Action | File | Change |
|--------|------|--------|
| MODIFY | `frontend/src/styles/tokens.css` | **Phase 5**: `--color-label-<key>-{bg,text,border}` token families for all 6 palette keys (VL-002, §12 risk 4) |
| MODIFY | `frontend/src/styles/components.css` | **Phase 5**: `.badge--label-<color>` tones (map to label tokens); color-aware `.label-chip` (label swatch + tinted selected state); label management section styles; label radio-swatch group. **Phase 8**: ledger tag placement rules (`ledger-meta` wrap). **Phase 9**: extend the coarse-pointer block with label chips/swatches/row actions (44px) |
| MODIFY | `frontend/src/components/Badge.tsx` | `BadgeTone` gains `label-<color>` tones (D-12, UI-009) |
| CREATE | `frontend/src/components/LabelsSection.tsx` | Labels management section: section title + compact list (color swatch + name + ghost Rename/Delete) + "New label" + empty state; create/rename/re-color/delete dialogs mirroring `ProjectDialog` anatomy (UI-001…004, ERR-001/003, A11Y-002/003/004) |
| MODIFY | `frontend/src/pages/WorkspacePage.tsx` | **Phase 5**: render `<LabelsSection/>` between Projects rail and Invitations (UI-001). **Phase 7**: "Filter by label" dropdown in filter bar (hidden when no labels; passes `labelId`; Clear filters resets) (UI-008, FR-011). **Phase 8**: render label tags in `ledger-meta` between priority badge and assignee (UI-006, FR-007) |
| MODIFY | `frontend/src/components/IssueForm.tsx` | Use shared `Label` (drop local interface); color-aware checkbox chips with swatch (UI-005, FR-010, A11Y-001) |
| MODIFY | `frontend/src/pages/IssuePage.tsx` | Use embedded `issue.labels`; remove `labelNames` map fetch; Labels row always visible with colored tags or "No labels" (UI-007, FR-008, ERR-002, PERF-003) |
| CREATE | `frontend/tests/component/labels.test.tsx` | LabelsSection CRUD, duplicate-name keeps dialog open, empty state, color radio group (spec §7.15 frontend list) |
| MODIFY | `frontend/tests/component/issue.test.tsx` | Label mock gains `color`; chips render swatches; `labelIds` submit |
| MODIFY | `frontend/tests/component/issue-page.test.tsx` | Fact rail tags from embedded `labels`; "No labels" row |
| MODIFY | `frontend/tests/component/workspace-page.test.tsx` | Ledger tags; label filter dropdown + `labelId` query; filter hidden when no labels |
| MODIFY | `frontend/tests/component/fallback.test.tsx` | Label mock gains `color` (type parity) |
| MODIFY | `frontend/tests/accessibility/core.test.tsx` | axe + keyboard + coarse-pointer assertions across labels surfaces (A11Y-008, SC-008) |
| INSPECT | `frontend/src/components/Dialog.tsx` | Reuse focus trap / Escape / focus return as-is |
| INSPECT | `frontend/src/components/Field.tsx` | Reuse `aria-invalid` + `aria-describedby` wiring for name/color fields |
| INSPECT | `frontend/src/components/Button.tsx` | Reuse `primary`/`secondary`/`ghost`/`danger` variants |
| INSPECT | `frontend/src/components/Alert.tsx` | Reuse `role="alert"` error pattern |
| INSPECT | `frontend/src/components/EmptyState.tsx` | Reuse compact empty-state anatomy for Labels section |
| INSPECT | `frontend/src/api/client.ts` | `api.get/post/patch/delete` used as-is |
| INSPECT | `frontend/src/App.tsx` | No route changes (labels live inside the workspace page) |

#### Documentation

| Action | File | Change |
|--------|------|--------|
| MODIFY | `VISUAL_LANGUAGE.md` (repo root) | **Phase 8**: add a **Label Color System** section (VL-006); touch §16 workspace structure, §19 ledger row order, §20 hierarchy note, §24 fact rail ("Labels" row always visible) |

**Structure Decision**: Keep the existing workspace structure (backend/frontend/
shared). The feature is a vertical slice through every layer with one new
service module and one new frontend section component; no new project/package.
The dedicated `LabelService`/`domain/label.ts`/`validators/label.ts` modules
(D-11) honor Constitution II without new dependencies.

## Dependency Graph

```
Phase 1  Foundation / data model
   ├──(shared LABEL_COLORS + LabelColor)──► Phase 2  Domain + validation
   │                                            │
   │                                            ▼
   │                                     Phase 3  Backend services + API
   │                                            │
   ├──(remaining shared types)──────────► Phase 4  Shared contracts ─┐
   │                                                              │
   └──► Phase 5  Frontend label management  ◄─────────────────────┘
              │
              ▼
        Phase 6  Issue label interaction (chips + fact rail)
              │
              ▼
        Phase 7  Label filtering
              │
              ▼
        Phase 8  Ticket Ledger visual integration + VISUAL_LANGUAGE.md
              │
              ▼
        Phase 9  Accessibility + responsive hardening
              │
              ▼
        Phase 10 Tests + full verification
```

**Ordering notes (explicit, not silent assumptions)**:

- `shared` is a workspace dependency of both backend and frontend. Backend
  validators (Phase 2) and services (Phase 3) must compile against
  `LABEL_COLORS` / `LabelColor` / `Label.color`, so those shared additions are
  pulled forward into **Phase 1** as data-model contracts (the palette is part
  of the data model, D-3). The remaining shared surface (`UpdateLabelRequest`,
  `CreateLabelRequest.color`, `Issue.labels`) lands in **Phase 4** ahead of its
  first frontend consumers (Phases 5+).
- Phase 5 introduces all new design tokens and badge tones; Phases 6–8 consume
  them (so no phase is blocked, and token definition happens once).
- Phase 8 is the dedicated ticket-ledger visual integration and the
  `VISUAL_LANGUAGE.md` update; it depends on Phase 5 tones and Phase 6 fact-rail
  work.
- Each phase must leave the repo green (typecheck + relevant tests) before the
  next begins.

## Implementation Phases

### Phase 1 — Foundation / Data Model

**Objective**: Add the additive `color` column and the palette constant as the
single source of truth; prove the migration is safe on existing databases.

**Files**:
- CREATE `backend/src/db/migrations/0003_label_color.sql`
- MODIFY `backend/src/db/schema.ts`
- MODIFY `shared/index.ts` (add `LABEL_COLORS`, `LabelColor`)
- MODIFY `backend/tests/unit/migration.test.ts`

**Responsibility**: Backend + shared. No frontend.

**Dependencies**: None (start of the feature).

**Considerations**:
- Migration: `ALTER TABLE labels ADD COLUMN color TEXT NOT NULL DEFAULT 'violet';`
  (SQLite cannot add `NOT NULL` without a default; the default applies to legacy
  rows only — the API always supplies a color on create, D-3).
- Schema mirrors it: `color: text("color").notNull().default("violet")`.
- No backfill beyond the default (NFR-003); no timestamps (DM-001, D-2);
  `issue_labels` and `labels_workspace_name_idx` untouched (DM-002/003).
- Palette keys are stable strings, not hex (VL-006, spec §12 risk note); hex is
  a frontend-token concern (Phase 5).
- The runner auto-applies by numeric prefix on server open and `:memory:` test
  databases (existing behavior).

**Tests**:
- Extend `backend/tests/unit/migration.test.ts`: `0003` applies cleanly on a
  `0001`+`0002` database; pre-existing labels receive `color = 'violet'`;
  `user_version = 3`; other tables untouched (non-destructive).

**Exit criteria**: `runMigrations` bumps to version 3; schema and migration
agree; `shared` exports `LABEL_COLORS` and `LabelColor`; migration unit test
green; typecheck green.

### Phase 2 — Domain + Validation

**Objective**: Single `Label` concept carrying `color`; zod authoritative
validation including the duplicate-`labelIds` guard.

**Files**:
- CREATE `backend/src/domain/label.ts`
- MODIFY `backend/src/domain/issue.ts`
- CREATE `backend/src/api/validators/label.ts`
- MODIFY `backend/src/api/validators/issue.ts`

**Responsibility**: Backend domain + validators.

**Dependencies**: Phase 1 (`LABEL_COLORS`, `LabelColor`).

**Considerations**:
- `LabelEntity { id, workspaceId, name, color: LabelColor }`;
  `createLabelRecord(workspaceId, name, color)` (DM-004). Move out of
  `domain/issue.ts` and update its importers (only the issue service imports
  `createLabelRecord` today).
- `createLabelSchema`: `name` `z.string().trim().min(1, "Label name is
  required").max(50)` (existing convention, §7.5); `color` `z.enum(LABEL_COLORS)`
  required.
- `updateLabelSchema`: partial `{ name?, color? }` with a
  `.refine((v) => v.name !== undefined || v.color !== undefined, { message:
  "Provide a name or color" })` (at least one field, §7.4 PATCH).
- `labelIds` on issue create/update: keep `z.array(z.string().uuid(...)).max(50)`
  and add a `superRefine` rejecting duplicates (`["l1","l1"]` → 422 on
  `labelIds`), preventing the `issue_labels` composite-PK crash (DI-004, §7.5).
- Backend validation is authoritative; no frontend mirror required.

**Tests**:
- Optional unit test for the label schemas (spec §7.15 allows).
- Existing `issues.test.ts` duplicate-`labelIds` case added in Phase 3 (needs
  service); schema-level rejection can be unit-tested here.

**Exit criteria**: New domain + validators compile; duplicate ids rejected;
label name/color validation matches the exact existing copy; typecheck green.

### Phase 3 — Backend Services + API

**Objective**: Full label CRUD API, the security fix, and additive embedded
`labels` enrichment on every issue payload.

**Files**:
- CREATE `backend/src/services/label.ts`
- MODIFY `backend/src/services/issue.ts`
- MODIFY `backend/src/api/routes/labels.ts`
- MODIFY `backend/src/api/routes/index.ts`
- CREATE `backend/tests/integration/labels.test.ts`
- MODIFY `backend/tests/integration/issues.test.ts`
- MODIFY `backend/tests/api.test.ts`

**Responsibility**: Backend services + routes.

**Dependencies**: Phase 1, Phase 2.

**Considerations**:
- **`LabelService`** (`createLabelService`): `createLabel(workspaceId, { name,
  color }, userId)` → `requireMember` + insert + catch unique-index → 409;
  `listLabels(workspaceId, userId)` → `requireMember` + `orderBy(labels.name)`
  ascending (deterministic pickers, §7.4); `updateLabel(labelId, patch, userId)`
  → resolve workspace from the label row, `requireMember` against it (SEC-003),
  catch duplicate rename → 409, own-name rename is a no-op; `deleteLabel(labelId,
  userId)` → resolve + `requireMember`, delete → cascades `issue_labels`
  (DI-003, SEC-007), 404 when missing. Returns `Label` shape with `color`.
  Model the workspace-resolution helper on `projectService.getWorkspaceIdForProject`.
- **`validateLabels` fix** in the issue service: scope the existence check to
  the issue's workspace
  (`and(inArray(labels.id, labelIds), eq(labels.workspaceId, workspaceId))`);
  also reject duplicates defensively (validator already catches; keep the guard).
  This closes SEC-004 / DI-001 / FR-009.
- **Enrichment**: in `getIssue` and `listIssues`, after the existing
  `issueLabels` batch query, collect label ids and run **one** additional
  indexed query `IN over labels.id` to build an id → `{ id, workspaceId, name,
  color }` map; attach as additive `labels` next to preserved `labelIds`
  (D-5, DM-006, PERF-002 — no N+1). Extract a small shared `buildLabelMap` helper
  inside the service to avoid duplicating between get/list.
- Remove `createLabel`/`listLabels` from the issue service; wire `labelService`
  in `routes/index.ts`.
- Routes: `POST /workspaces/:workspaceId/labels` now requires `{ name, color }`
  (422 on missing/invalid color); `GET` lists name-ascending; **NEW**
  `PATCH /api/labels/:id` and `DELETE /api/labels/:id` with 401/403/404/409/422
  per spec §7.4. Issue routes unchanged (D-8: assignment reuses
  `PATCH /issues/:id` `labelIds` replace-all).

**Tests** (backend integration, per spec §7.15):
- New `labels.test.ts`: create with color → 201 + full shape; missing/invalid
  color → 422 on `color`; blank/whitespace/over-50 name → 422; duplicate same
  workspace (create + rename) → 409; `Bug` vs `bug` both allowed; same name in
  two workspaces allowed; list ordered by name; rename → 200; re-color → 200;
  rename-to-own-name → 200 no-op; delete → 204 + gone from list; delete a label
  referenced by issues → issues remain, `labels`/`labelIds` consistent;
  unauthenticated → 401; non-member → 403; member of A vs B's label → 403;
  missing label id → 404.
- Extend `issues.test.ts`: create/update with a foreign-workspace label → 422
  (bug fix regression test); duplicate `labelIds` → 422; issue create/get/list/
  update return embedded `labels` alongside `labelIds`; assign/remove via
  `PATCH /issues/:id` replace-all.
- Extend `api.test.ts`: label payloads carry `color`; embedded labels asserted.

**Exit criteria**: All new + modified backend tests green; full backend suite
green; typecheck green.

### Phase 4 — Shared Contracts

**Objective**: Make the shared types match the API contract exactly so backend
payloads and frontend consumers share one shape (DM-004, §7.4).

**Files**:
- MODIFY `shared/index.ts` (complete the label surface)

**Responsibility**: Shared package.

**Dependencies**: Phase 1 (palette types); feeds Phases 5+.

**Considerations**:
- `Label` gains `color: LabelColor` (currently `{ id, workspaceId, name }`).
- `Issue` gains additive `labels: Label[]` (preserve `labelIds: string[]`).
- `CreateLabelRequest` gains `color: LabelColor`.
- Add `UpdateLabelRequest { name?: string; color?: LabelColor }`.
- `IssueQueryParams.labelId` already exists — verify and keep.
- No other type changes; status/priority/identity untouched (NFR-001).

**Tests**: Typecheck across all three workspaces is the gate; no runtime tests.

**Exit criteria**: `npm run typecheck` green in backend + frontend + shared;
payload shapes asserted by Phase 3 tests conform.

### Phase 5 — Frontend Label Management

**Objective**: The Labels management section in the workspace left column with
create / rename / re-color / delete, plus the design-token groundwork the whole
feature needs.

**Files**:
- MODIFY `frontend/src/styles/tokens.css`
- MODIFY `frontend/src/styles/components.css`
- MODIFY `frontend/src/components/Badge.tsx`
- CREATE `frontend/src/components/LabelsSection.tsx`
- MODIFY `frontend/src/pages/WorkspacePage.tsx` (render the section)
- CREATE `frontend/tests/component/labels.test.tsx`

**Responsibility**: Frontend.

**Dependencies**: Phase 3 (API), Phase 4 (shared types).

**Considerations**:
- **Design tokens (once, here)** — add `--color-label-<key>-{bg,text,border}`
  for `violet | magenta | indigo | olive | sand | plum`. Start values per spec
  §12 risk note (violet `#5B3F9E`, magenta `#A21C6E`, indigo `#4F46A3`, olive
  `#566B1F`, sand `#7A5A2E`, plum `#7A3B5C`, each with a light `bg` tint and
  muted `border`), each AA-checked before acceptance. These are deliberately
  distinct from status/priority/brand/danger families (VL-002, risk 4). No new
  radius/spacing/shadow tokens (VL-004).
- **Badge tones**: add `label-violet | label-magenta | label-indigo |
  label-olive | label-sand | label-plum` to `BadgeTone`; CSS maps each to its
  token family. The compact rectangular badge anatomy (incl. 6px `::before`
  swatch) is reused untouched (VL-001, D-12, UI-009). **No** new tag component.
- **`LabelsSection`** (mirrors `ProjectDialog` anatomy exactly):
  - Section title "Labels" (`section-title`), "New label" button, compact list:
    color swatch (`aria-hidden` decorative swatch, or badge-style) + label name
    + ghost Rename / Delete actions (quiet, subordinate — Projects rail rule).
  - Empty state via `EmptyState` ("No labels yet" + short explanation).
  - Create dialog: name `Field` + color radio group (`Fieldset`/native radios)
    with visible color names (Violet, Magenta, …) and swatches; preselect
    `violet`; duplicate-name 409 keeps the dialog open, input retained, `Alert`
    shows "A label with this name already exists" (ERR-003, A11Y-002).
  - Rename/re-color dialog: pre-filled values; saves via
    `PATCH /labels/:id` (UI-003).
  - Delete dialog: coral destructive confirmation stating the label is removed
    from issues and issues are not deleted; no fabricated usage counts
    (NFR-007, UI-004, DI-006).
  - All dialogs reuse `Dialog` (focus trap, Escape, focus return, labelled
    title) and `Field`/`Button`/`Alert` (A11Y-004/005).
  - Fetch labels once here and share the list with the filter dropdown in Phase 7
    (PERF-003).
- Workspace left column becomes: Projects rail → **Labels section** → Invitations
  (UI-001, D-9).

**Tests** (`labels.test.tsx`): empty state; create (name + color); rename;
re-color; delete with confirmation; duplicate-name error keeps dialog open;
color radio group renders names; swatches aria-hidden.

**Exit criteria**: Labels section fully functional; new component tests green;
typecheck + lint green; no new CSS values beyond the documented token block.

### Phase 6 — Issue Label Interaction

**Objective**: Color-aware chips in the issue form and the always-visible Labels
fact-rail row using embedded `issue.labels`.

**Files**:
- MODIFY `frontend/src/components/IssueForm.tsx`
- MODIFY `frontend/src/pages/IssuePage.tsx`
- MODIFY `frontend/tests/component/issue.test.tsx`
- MODIFY `frontend/tests/component/issue-page.test.tsx`

**Responsibility**: Frontend.

**Dependencies**: Phase 3 (API), Phase 4 (`Issue.labels`), Phase 5 (tokens,
chip styles).

**Considerations**:
- **IssueForm**: replace the local `Label { id, name }` interface with the
  shared `Label`; chips render a label-color swatch (from `label.color` via a
  helper mapping color → tone) and a tinted selected state using the label's own
  token family (UI-005). Keep the native checkbox `.label-chip` pattern and the
  "hidden when no labels" behavior (A11Y-001). Still submits `labelIds`.
- **IssuePage**: delete the `labelNames` map fetch and the whole
  `/workspaces/:id/labels` call in the project-name effect (PERF-003); render
  the fact-rail Labels row from `issue.labels` as colored `Badge` tags; the row
  is **always visible**, showing "No labels" when empty (FR-008, ERR-002,
  UI-007, VL §24 "empty values render honestly").
- A small shared frontend helper `labelTone(color): BadgeTone` (e.g. in
  `frontend/src/lib/labelTone.ts`) maps palette key → `label-<color>` tone and
  is reused by IssueForm chips, IssuePage tags, and the ledger (Phase 8).
  One definition, three consumers — no duplication.

**Tests**:
- `issue.test.tsx`: label mock gains `color`; chips render swatches;
  check/uncheck updates `labelIds`; submit posts `labelIds`.
- `issue-page.test.tsx`: fact rail tags from embedded `labels`; "No labels" when
  empty; no label-list fetch performed (assert `api.get` not called for
  `/labels`).

**Exit criteria**: Chips + fact rail render per UI-005/007; component tests
green; typecheck + lint green.

### Phase 7 — Label Filtering

**Objective**: Single "Filter by label" dropdown reusing the existing
`?labelId=` query param.

**Files**:
- MODIFY `frontend/src/pages/WorkspacePage.tsx`
- MODIFY `frontend/tests/component/workspace-page.test.tsx`

**Responsibility**: Frontend.

**Dependencies**: Phase 3 (existing `labelId` API), Phase 5 (labels list).

**Considerations**:
- Add `labelFilter` state; include `labelId` in the `loadIssues` query params
  when set (FR-011, D-10).
- "Filter by label" `Field` + `select` in the existing filter bar, same anatomy
  as status/priority (UI-008, §29); hidden when the workspace has no labels
  (ERR-001, US3 scenario 3).
- The filter participates in `filtering` state and the Clear-filters action
  (US3 scenario 2); at ≤375px it stacks with the rest of the filter bar
  (RES-004).
- Single-select only; no saved/advanced/combined filters (Non-Goals).

**Tests** (`workspace-page.test.tsx`): filter dropdown visible when labels
exist; selecting passes `labelId` query param; clear resets it; dropdown hidden
when no labels; count/empty-state text reflects filtering.

**Exit criteria**: Filtering works end-to-end; tests green; typecheck + lint
green.

### Phase 8 — Ticket Ledger Visual Integration + VISUAL_LANGUAGE.md

**Objective**: Render label tags in the ledger rows and document the new Label
Color System in `VISUAL_LANGUAGE.md`.

**Files**:
- MODIFY `frontend/src/pages/WorkspacePage.tsx`
- MODIFY `frontend/src/styles/components.css`
- MODIFY `VISUAL_LANGUAGE.md` (repo root)

**Responsibility**: Frontend + design-system documentation.

**Dependencies**: Phase 5 (tones), Phase 6 (helper), Phase 4 (`Issue.labels`).

**Considerations**:
- **Ledger**: render `issue.labels` as compact colored `Badge` tags inside
  `ledger-meta`, between the priority badge and the assignee (UI-006, FR-007,
  §19/§20 hierarchy: labels stay in the secondary metadata row, never outranking
  key/title/status/priority — VL-003). Tags wrap within `ledger-meta`
  (`flex-wrap`), no horizontal page overflow, mono key and title stay visible
  (RES-001/005). The priority edge bar, ticket key, title, and chevron are
  untouched.
- **VISUAL_LANGUAGE.md update strategy** (see dedicated section below) — add the
  Label Color System section and touch §16/§19/§20/§24. This is the single
  intentional documentation update for the feature (VL-006).
- Default/unknown stored color must render safely (VL-007): in practice the API
  always returns a palette key; if a non-palette value ever appears, the helper
  falls back to the neutral badge tone rather than crashing.

**Tests**: Ledger tag assertions added in `workspace-page.test.tsx` (multiple
labels render, order-independent); visual review against §19/§20.

**Exit criteria**: Ledger renders tags per UI-006; `VISUAL_LANGUAGE.md` updated
with the Label Color System; existing tests green.

### Phase 9 — Accessibility + Responsive Hardening

**Objective**: Verify and harden every touched surface for accessibility and
responsive behavior; no regressions.

**Files**:
- MODIFY `frontend/src/styles/components.css` (extend coarse-pointer block)
- MODIFY `frontend/tests/accessibility/core.test.tsx`
- MODIFY `frontend/tests/component/*` as needed for responsive assertions

**Responsibility**: Frontend.

**Dependencies**: Phases 5–8 (all touched surfaces exist).

**Considerations**:
- Extend the existing `@media (pointer: coarse)` block so label chips, color
  radio swatches, and label-row actions meet the 44px minimum touch target
  (A11Y-006, RES coarse-pointer rule).
- Native checkbox chips (Tab + Space) and native color radio group (arrow keys)
  with visible labels (A11Y-001/002); swatches `aria-hidden`, name text carries
  the accessible name (A11Y-003, NFR-005, SC-009).
- Dialogs: focus trap, Escape, focus return — inherited from the reused `Dialog`
  (A11Y-004); field errors via `Field` `aria-invalid`/`aria-describedby`,
  page/dialog errors via `role="alert"` (A11Y-005).
- No new motion; transitions use existing duration/easing tokens and respect
  `prefers-reduced-motion` (A11Y-007, §32).
- Responsive: Labels section participates in the ≤1100px two-column collapse and
  stacks naturally (RES-002); dialogs use the existing near-full-screen behavior
  ≤700px/≤375px (RES-003); filter bar stacks ≤375px (RES-004).
- Important label information is never hidden to fit (RES-005).

**Tests** (`core.test.tsx`): axe-clean on labels section, create/rename/re-color/
delete dialogs, ledger with labels, fact rail with labels, color radio group,
colored chips; keyboard flows (chips toggle with Space, radio arrows, dialog
trap/escape/focus-return, label-row actions reachable); coarse-pointer 44px
assertions where feasible.

**Exit criteria**: axe suite passes with no new violations; keyboard flows
complete; responsive review at 1280/1100/1024/700/375px; tests green.

### Phase 10 — Tests + Verification

**Objective**: Full verification against spec success criteria; close any gaps.

**Files**: All test files listed in the impact map.

**Responsibility**: Whole feature.

**Dependencies**: Phases 1–9.

**Considerations**:
- Run the complete backend, frontend, and accessibility suites; add any missing
  cases from spec §7.15 not covered earlier.
- Verify SC-001…SC-009 explicitly (see traceability table).
- Verify the acceptance scenarios in spec §8 end-to-end (API-level for 8/9,
  UI-level for the rest).
- Run `npm run db:migrate` on a scratch copy of a 0001+0002 database to confirm
  the 0003 apply path in a real file DB, not just `:memory:`.
- Final visual review against AGENTS.md's Visual Review Checklist (hierarchy,
  rhythm, structure, typography, color, components, interaction, responsive,
  accessibility, data).

**Exit criteria**: `npm test`, `npm run lint`, `npm run typecheck`, `npm run
build` all green; every spec SC satisfied; no fabricated UI data.

## VISUAL_LANGUAGE.md Update Strategy

**Decision**: Yes — `VISUAL_LANGUAGE.md` receives one intentional, scoped update
during implementation (Phase 8). Reason: the label palette is a genuinely new
**semantic color role** distinct from status, priority, petrol brand, and coral
danger (VL-002, VL-006, AGENTS.md token rule). This is a documented new token
family, not a per-component one-off.

**What to add/edit** (implementation-time, matching actual shipped values):

1. **New section — "Label Color System"** (placed after §9 Priority Color
   System, before §10 Typography):
   - The 6 palette keys (`violet`, `magenta`, `indigo`, `olive`, `sand`,
     `plum`) as a table: key → `--color-label-<key>-{bg,text,border}` token
     roles → actual hex values (start values from spec §12, AA-verified during
     Phase 5).
   - Rules: labels use the compact rectangular badge anatomy (reuse §13
     `--radius-sm`, §12 spacing); colors are muted categorical tints; they are
     **never** used as status/priority indicators, buttons, or page accents; a
     label's color is always reinforced by its name text (NFR-005); swatches are
     `aria-hidden` decoration (A11Y-003).
   - Where to use: ledger metadata row (between priority and assignee), fact
     rail "Labels" row, issue-form chips, Labels management list.
   - Where NOT to use: status/priority/brand/danger surfaces; anything conveying
     meaning by color alone.
2. **§16 Workspace Workbench**: structure list gains "Labels section" between
   "Projects rail" and "Issues ledger".
3. **§19 Ticket Ledger**: note label tags in the metadata row (order: status →
   priority → labels → assignee) without disturbing the signature (priority edge
   bar, mono key, title, chevron).
4. **§20 Issue Row Hierarchy**: explicit note that labels live in the secondary
   metadata row and never outrank key/title/status/priority.
5. **§24 Fact Rail**: "Labels" row is always visible; empty renders honestly as
   "No labels".

**When NOT to update**: routine component styling, spacing tweaks, or
non-semantic polish should not touch `VISUAL_LANGUAGE.md`; only the above
intentional additions are made here.

## Risk Analysis

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **Existing label functionality overlap** — dormant create/list API, `labelIds` plumbing, issue-form picker, fact-rail tags already exist; a naive implementation could duplicate or regress them | High | Medium | Inventory mapped in this plan (File Impact Map); reuse existing tables/API/picker/filter param; extract to `LabelService` without reimplementing behavior; update (not duplicate) existing tests |
| 2 | **Cross-workspace validation bug** — `validateLabels` selects labels by id with no workspace filter, so foreign labels can be attached | Certain (known) | High (data integrity) | Phase 3 scopes the check to the issue's workspace (`and(inArray(...), eq(labels.workspaceId, workspaceId))`); regression test: create/update with foreign label → 422 (US4, SC-003) |
| 3 | **Existing consumers/tests depend on `labelIds`** — shared `Issue`, frontend mocks, backend fixtures all reference the current shape | High | Medium | `labels` is additive; `labelIds` preserved untouched (DM-006, NFR-001); all test mocks updated to include `color`; full suite run each phase |
| 4 | **Label colors conflicting with status/priority semantics** — a careless palette could be mistaken for Open/In-Progress/Closed or Low→Urgent | Medium | Medium (visual integrity) | Dedicated muted palette distinct from reserved families (VL-002); token families documented; name text always present (NFR-005); visual review in Phase 8/10 |
| 5 | **Ledger visual noise** — colored tags could crowd or outrank the ticket key/title/status/priority | Medium | Medium | Tags live only in the secondary `ledger-meta` row between priority and assignee (VL-003, §19/§20); compact badge anatomy; flex-wrap prevents overflow (RES-001) |
| 6 | **Delete leaving invalid relationships** — deleting a label while issues reference it | Medium | High (data integrity) | FK `ON DELETE CASCADE` on `issue_labels.label_id` already implemented (DM-003); tests assert issues remain, labels/`labelIds` consistent, no dangling refs (SC-004, US4 scenario 3) |
| 7 | **N+1 label loading** — per-row label queries in `listIssues` would breach the performance budget | Medium | Medium | One additional indexed `IN` query over collected label ids per list (PERF-002); `listLabels` stays a single indexed query (PERF-001); performance test kept within budget |
| 8 | **Tests asserting exact DOM/strings** — existing frontend tests mock `/workspaces/:id/labels` as `{ id, name }` and assert text; shape changes could break brittle assertions | High | Low | Update all mocks to include `color` (issue, issue-page, workspace-page, fallback, a11y); assert by role/accessible-name; add new labels tests in the same style; run full suite each phase |

## Implementation Discipline

- **No speculative scope**: implement only spec FR/NFR/DM/API/UI/VL/A11Y/RES/ERR/
  DI/PERF and decisions D-1…D-12. Non-Goals (saved filters, counts, hierarchy,
  permissions, inline creation, arbitrary hex, dark mode, etc.) are not built.
- **Token → component → pattern order**: before adding any CSS value, confirm no
  existing token/component/pattern covers it; new values only for the palette
  token family, added once in Phase 5 and documented in `VISUAL_LANGUAGE.md`.
- **Reuse over duplication**: `Badge` (+ tones), `Dialog`, `Field`, `Button`,
  `Alert`, `EmptyState`, `Avatar`, `.label-chip`, `labelId` API, `api.get/post/
  patch/delete`, `requireMember`, the Projects-rail anatomy for the Labels
  section, the `getWorkspaceIdForProject` pattern for label-scoped authZ.
- **Data honesty**: every displayed label name/color comes from the API; no
  fabricated counts or statistics (NFR-007, DI-006).
- **Green per phase**: typecheck/lint/tests pass at the end of each phase before
  moving on; never ship a phase that breaks the existing suite.
- **Backend authoritative**: client-side checks are conveniences only; security
  (SEC-003/004) is enforced server-side regardless of UI.
- **Do not redesign**: the ledger signature, workspace layout, fact rail,
  filter bar, and dialog anatomy are preserved; the feature extends the existing
  system.

## Final Plan Quality Check

**Requirement → Phase traceability** (every spec requirement covered):

| Requirement group | Covered in |
|-------------------|------------|
| FR-001 (color storage) | P1, P3 |
| FR-002/003/004/005 (create/rename/re-color/delete) | P3 (API) + P5 (UI) |
| FR-006 (dup names 409) | P3 + P5 (dialog alert) |
| FR-007 (ledger tags) | P8 |
| FR-008 (fact-rail tags + "No labels") | P6 |
| FR-009 / SEC-004 / DI-001 (cross-workspace rejection) | P3 |
| FR-010 (assign via existing endpoints) | P3 (verified) + P6 (form) |
| FR-011 (filter via `labelId`) | P7 |
| FR-012 (additive `labels` payload) | P3 (service) + P4 (types) |
| FR-013 (Labels management section) | P5 |
| NFR-001 (additive only) | all phases |
| NFR-002 / PERF-001/002 (performance) | P3, verified P10 |
| NFR-003 (auto-applied safe migration) | P1 |
| NFR-004/005, SC-008/009 (a11y, text-always) | P9 |
| NFR-006 (no new deps) | global |
| NFR-007 (no counts) | P5, P10 review |
| DM-001…006 (data model) | P1, P2, P4 |
| §7.4 API contract (extended + new endpoints) | P3 |
| §7.5 validation | P2 |
| §7.6 migration/backward-compat | P1 |
| SEC-001/002/003/005/006/007/008 | P3 (+ P5/P7 UI), P10 review |
| UI-001…009 | P5, P6, P7, P8 |
| VL-001…007 | P5 (tokens), P8 (ledger + VL.md) |
| A11Y-001…008 | P5, P6, P9 |
| RES-001…005 | P7, P8, P9 |
| ERR-001…008 | P5, P6, P7 |
| DI-001…006 | P3, P5, P10 |
| §7.15 testing | P1–P10 (per-phase + final) |
| §8 acceptance scenarios | P3 (8/9), P5–P8 (1–7), P10 (end-to-end) |
| SC-001…009 | P10 |
| D-1…D-12 | mapped in Summary / phases |

**Open items that are deliberately deferred** (documented in spec §12, not
silent): exact palette hex values finalized at Phase 5 with AA check; compact
`{ id, name, color }` issue-projection follow-up if payload size ever matters;
case-insensitive uniqueness as a separate future feature.

**Verification commands** (Phase 10):

```bash
npm test                 # backend + frontend + shared
npm run lint
npm run typecheck
npm run build
npm run db:migrate       # on a scratch 0001+0002 db copy to confirm 0003
```

## Report

When this plan is executed (a later step, not now), report per spec §13: what
changed; which existing visual patterns were reused; whether `VISUAL_LANGUAGE.md`
needed updating (yes — Label Color System, done in Phase 8); any new design
decisions introduced; responsive considerations; accessibility considerations;
and verification results (tests / typecheck / lint / build).