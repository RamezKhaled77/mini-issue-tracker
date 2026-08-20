# Tasks: Labels — Mini Issue Tracker

**Input**: Design documents from `/specs/004-labels/`

**Prerequisites**: `spec.md` (approved), `plan.md` (approved)

**Tests**: Tests ARE included. The spec explicitly enumerates backend, frontend,
and accessibility test changes plus new tests (spec §7.15, SC-001…SC-009).

**Organization**: Tasks are grouped by the **10 implementation phases** defined
in `plan.md` and follow its dependency chain (Database → Domain/validation →
Services → API → Shared contracts → Frontend primitives → Label management UI →
Issue label interaction → Filtering → Ticket Ledger integration →
Accessibility/responsive → Documentation → Tests/verification).

**Note on paths**: `VISUAL_LANGUAGE.md` lives at the **repository root**
(`/VISUAL_LANGUAGE.md`, verified), despite AGENTS.md referring to it as
`frontend/VISUAL_LANGUAGE.md`. All frontend tasks reference the root file.
Shared types live in `shared/index.ts` (the `@mini-issue-tracker/shared`
package consumed by both backend and frontend).

**Format**: Each task is a checkbox line `- [ ] T### — Title` followed by
structured fields: **Objective** (what + why), **Files** (exact paths + action),
**Responsibility** (who/what layer), **Depends on** (prior tasks), **Preserve**
(existing behavior that must remain intact), **Considerations** (implementation
guidance, visual-language references), **Tests**, **Exit criteria** (how we know
the task is done).

---

## Phase 1 — Foundation / Data Model

**Purpose**: Add the additive `color` column, the shared palette constant, and
proof the migration is safe on existing databases. Everything downstream
compiles against `LabelColor` / `Label.color`, so the palette constant is pulled
forward into this phase (plan.md dependency-graph note).

- [ ] **T001** — Create migration `0003_label_color.sql`
  - **Objective**: Add the label color column to the existing `labels` table via
    the auto-applied migration runner (DM-001, NFR-003).
  - **Files**: CREATE `backend/src/db/migrations/0003_label_color.sql`
  - **Responsibility**: Backend / database migrations.
  - **Depends on**: none.
  - **Preserve**: Existing `labels_workspace_name_idx` unique index, `issue_labels`,
    and all other tables (DM-002/003). No timestamps added (D-2).
  - **Considerations**: SQLite cannot add a `NOT NULL` column without a default →
    `ALTER TABLE labels ADD COLUMN color TEXT NOT NULL DEFAULT 'violet';` The
    default applies to pre-existing rows only; the API always supplies a color on
    create (D-3). Numeric prefix `0003_` + `PRAGMA user_version` runner applies it
    on server open and on `:memory:` test databases with no manual step.
  - **Tests**: Covered by T004.
  - **Exit criteria**: File exists with the exact ALTER statement; `runMigrations`
    applies it and bumps `user_version` to 3.

- [ ] **T002** — Add `color` column to the `labels` table in the Drizzle schema
  - **Objective**: Mirror the migration in the ORM schema so Drizzle models the
    new column (DM-001, §7.6).
  - **Files**: MODIFY `backend/src/db/schema.ts` (`labels` table)
  - **Responsibility**: Backend / database schema.
  - **Depends on**: T001.
  - **Preserve**: All existing columns/relations/indices; `labelsRelations` unchanged.
  - **Considerations**: `color: text("color").notNull().default("violet")` — must
    exactly match the migration column and default.
  - **Tests**: `npm run typecheck -w backend`; covered by T004 migration test.
  - **Exit criteria**: Schema compiles; column definition matches the migration.

- [ ] **T003** — Add `LABEL_COLORS` constant and `LabelColor` type to shared
  - **Objective**: Define the fixed 6-color palette as the single source of truth
    consumed by validators, domain, API, and frontend (D-3, VL-002, DM-004).
  - **Files**: MODIFY `shared/index.ts`
  - **Responsibility**: Shared package.
  - **Depends on**: none (pulled forward per plan dependency-graph note).
  - **Preserve**: All existing shared exports (statuses, priorities, Identity,
    Issue, etc.) untouched.
  - **Considerations**: `export const LABEL_COLORS = ["violet", "magenta",
    "indigo", "olive", "sand", "plum"] as const;` and `export type LabelColor =
    (typeof LABEL_COLORS)[number];`. Keys are stable strings, not hex (spec §12
    risk note); actual hex values are a frontend-token concern (Phase 5). Palette
    is deliberately distinct from status/priority/petrol/coral families.
  - **Tests**: `npm run typecheck` across all workspaces.
  - **Exit criteria**: `LABEL_COLORS` / `LabelColor` exported and type-checked.

- [ ] **T004** — Extend the migration unit test for `0003`
  - **Objective**: Prove the migration applies cleanly to a 0001+0002 database
    and preserves legacy label rows with the default color (NFR-003, SC-007).
  - **Files**: MODIFY `backend/tests/unit/migration.test.ts`
  - **Responsibility**: Backend / tests.
  - **Depends on**: T001, T002.
  - **Preserve**: Existing 0002 migration tests unchanged.
  - **Considerations**: Follow the existing `migrationSql(version)` helper pattern
    in the file. Insert a legacy label row at schema 0001+0002 (with a workspace),
    run `runMigrations`, assert `user_version = 3`, the label keeps its id/name,
    and `color = 'violet'`; assert no other table changed (non-destructive).
  - **Tests**: `npm test -w backend` migration suite.
  - **Exit criteria**: New 0003 test passes; existing migration tests still pass.

**Phase 1 checkpoint**: `user_version` reaches 3; schema and migration agree;
`shared` exports `LABEL_COLORS`/`LabelColor`; migration unit test green.

---

## Phase 2 — Domain + Validation

**Purpose**: Single `Label` domain concept carrying `color`, plus authoritative
zod validation including the duplicate-`labelIds` guard (DM-004, §7.5, DI-004).

- [ ] **T005** — Create `backend/src/domain/label.ts`
  - **Objective**: Move label domain modeling to its own cohesive module (D-11,
    Constitution II) with color support (FR-001).
  - **Files**: CREATE `backend/src/domain/label.ts`
  - **Responsibility**: Backend / domain layer (storage- and presentation-free).
  - **Depends on**: T003 (`LabelColor`).
  - **Preserve**: The `LabelEntity` concept and `createLabelRecord` signature shape
    (minus the new color param) so existing call sites keep working after re-wiring.
  - **Considerations**: `export interface LabelEntity { id: string; workspaceId:
    string; name: string; color: LabelColor; }` and `export function
    createLabelRecord(workspaceId: string, name: string, color: LabelColor):
    LabelEntity { return { id: randomUUID(), workspaceId, name, color }; }`.
    No timestamps (D-2).
  - **Tests**: Typecheck; covered indirectly by T016 (integration) and T009 (unit).
  - **Exit criteria**: Module compiles; `createLabelRecord` returns `color`.

- [ ] **T006** — Remove `LabelEntity` / `createLabelRecord` from `domain/issue.ts`
  - **Objective**: Avoid two sources of truth for the label entity (DM-004,
    Constitution III).
  - **Files**: MODIFY `backend/src/domain/issue.ts`
  - **Responsibility**: Backend / domain layer.
  - **Depends on**: T005.
  - **Preserve**: All issue-domain code and exports; the module keeps its single
    issue-focused responsibility.
  - **Considerations**: Delete the `LabelEntity` interface and `createLabelRecord`
    function and their now-unused `randomUUID` import if nothing else uses it;
    update the sole importer (issue service, T013) to import from
    `../domain/label.js`.
  - **Tests**: `npm run typecheck -w backend`.
  - **Exit criteria**: No dangling imports; domain/issue.ts no longer defines label
    records.

- [ ] **T007** — Create `backend/src/api/validators/label.ts`
  - **Objective**: Authoritative zod schemas for label create/update following the
    existing validator conventions (D-11, §7.5, SEC-005 allowlist).
  - **Files**: CREATE `backend/src/api/validators/label.ts`
  - **Responsibility**: Backend / API validation.
  - **Depends on**: T003 (`LABEL_COLORS`).
  - **Preserve**: The exact name-validation convention already used inline in the
    label route: `z.string().trim().min(1, "Label name is required").max(50)`.
  - **Considerations**: `createLabelSchema = z.object({ name: <as above>, color:
    z.enum(LABEL_COLORS) })` (color required). `updateLabelSchema =
    createLabelSchema.partial().refine((v) => v.name !== undefined || v.color !==
    undefined, { message: "Provide a name or color" })` (at least one field, §7.4
    PATCH). Export `CreateLabelInput` / `UpdateLabelInput` types via `z.infer`.
  - **Tests**: Unit-tested in T009.
  - **Exit criteria**: Schemas compile and produce the exact 422 field errors
    specified in §7.5 (`name`, `color`).

- [ ] **T008** — Add duplicate-`labelIds` rejection to the issue validator
  - **Objective**: Reject repeated ids within one request before any write, so the
    `issue_labels` composite PK can never crash with a 500 (DI-004, §7.5).
  - **Files**: MODIFY `backend/src/api/validators/issue.ts` (`labelIds` field)
  - **Responsibility**: Backend / API validation.
  - **Depends on**: none.
  - **Preserve**: Existing `labelIds` `z.array(z.string().uuid("Invalid
    label")).max(50).optional()` behavior and all other issue-schema rules.
  - **Considerations**: Add a `superRefine` on the labelIds array that maps
    duplicates to a 422 field error on `labelIds` (message consistent with
    existing copy, e.g. "Labels must be unique"). Empty array stays allowed
    (issue with no labels).
  - **Tests**: Unit-level in T009; integration-level in T017.
  - **Exit criteria**: `["l1","l1"]` → 422 on `labelIds`; `["l1"]` and `[]` still pass.

- [ ] **T009** — Unit test the label schemas
  - **Objective**: Lock validation behavior without full HTTP (spec §7.15 optional
    backend unit validators test).
  - **Files**: CREATE `backend/tests/unit/label-validators.test.ts` (or add to an
    existing validators test file if present)
  - **Responsibility**: Backend / tests.
  - **Depends on**: T007, T008.
  - **Considerations**: Cover: blank/whitespace/over-50 name → fail; missing or
    invalid color → fail on `color`; valid name+color → pass; update with neither
    field → fail; update with only name or only color → pass; duplicate labelIds →
    fail on `labelIds`; duplicate `uuid` validation preserved.
  - **Tests**: `npm test -w backend` unit suite.
  - **Exit criteria**: All schema cases pass with expected field keys.

**Phase 2 checkpoint**: Domain + validators compile; duplicate ids rejected;
label name/color validation matches the exact existing copy; typecheck green.

---

## Phase 3 — Backend Services + API

**Purpose**: Full label CRUD, the workspace-scoping security fix, additive
embedded `labels` enrichment, and the complete label API (SEC-002/003/004/007,
FR-002…006/009/012, PERF-001/002).

- [ ] **T010** — Create `backend/src/services/label.ts` (`LabelService`)
  - **Objective**: Own label CRUD in a dedicated service (D-11, Constitution II).
  - **Files**: CREATE `backend/src/services/label.ts`
  - **Responsibility**: Backend / service layer.
  - **Depends on**: T001, T002, T005, T007; INSPECT `services/project.ts`
    (`getWorkspaceIdForProject` pattern) and `services/membership.ts`
    (`requireMember`).
  - **Preserve**: The existing create/list behavior the issue service currently
    exposes (create = requireMember + insert + 409-on-unique; list = requireMember
    + workspace filter). List ordering changes to name-ascending (additive,
    §7.4).
  - **Considerations**: Expose `createLabel(workspaceId, { name, color }, userId)`
    (201, 409 on duplicate), `listLabels(workspaceId, userId)` (name ascending,
    single indexed query — PERF-001), `updateLabel(labelId, patch, userId)`
    (resolve workspace **from the label row**, `requireMember` against it —
    SEC-003; rename-to-own-name is a valid no-op; duplicate rename → 409; 404 when
    label missing), `deleteLabel(labelId, userId)` (resolve + requireMember, delete
    → cascades `issue_labels`, 404 when missing). Include a private
    `getWorkspaceIdForLabel(labelId)` helper modeled on the project service. Return
    the full `Label` shape `{ id, workspaceId, name, color }`.
  - **Tests**: Exercised by T016/T017/T018.
  - **Exit criteria**: Service compiles; every method enforces membership and
    resolves workspace server-side.

- [ ] **T011** — Fix `validateLabels` workspace scoping in the issue service
  - **Objective**: Close the cross-workspace data-integrity hole (SEC-004,
    DI-001, FR-009) — a label from workspace A must never attach to an issue in
    workspace B.
  - **Files**: MODIFY `backend/src/services/issue.ts` (`validateLabels`)
  - **Responsibility**: Backend / service layer.
  - **Depends on**: none (independent of T010; must land before T017 regression test).
  - **Preserve**: The `validateLabels(workspaceId, labelIds)` signature and its
    422 error shape; rejection of nonexistent label ids (FR-009, §7.5).
  - **Considerations**: Change the select to
    `where(and(inArray(labels.id, labelIds), eq(labels.workspaceId, workspaceId)))`
    so existence is proven **within the issue's workspace**. Keep the missing-id
    rejection for ids not found in-workspace (covers foreign + nonexistent). Add a
    defensive duplicate-id guard (validator T008 is authoritative; keep the guard
    for direct service callers).
  - **Tests**: Regression test in T017 (foreign-workspace label → 422); direct
    service test optional.
  - **Exit criteria**: A label from workspace A in `labelIds` for an issue in
    workspace B → 422 and nothing persisted.

- [ ] **T012** — Enrich `getIssue` / `listIssues` with embedded `labels`
  - **Objective**: Add additive `labels: Label[]` to every issue payload so name/
    color are available everywhere without extra requests (FR-012, D-5, DM-006).
  - **Files**: MODIFY `backend/src/services/issue.ts` (`getIssue`, `listIssues`)
  - **Responsibility**: Backend / service layer.
  - **Depends on**: T005 (`LabelEntity`/shape), T011 (workspace-scoped validation
    semantics unchanged).
  - **Preserve**: `labelIds` unchanged and still returned; all existing issue
    fields/assignee enrichment; pagination and filters (including the existing
    `labelId` filter in `listIssues`).
  - **Considerations**: After the existing `issueLabels` batch query, collect the
    label ids and run **one** additional indexed query `IN over labels.id`
    selecting `{ id, workspaceId, name, color }`; build an id → Label map and
    attach `labels` in the same order as `labelIds` (or in query order — tests
    must be order-independent). Shared `buildLabelMap` helper inside the service
    to avoid duplicating between get/list. **No N+1** (PERF-002).
  - **Tests**: T017 (embedded labels asserted on create/get/list/update), T018.
  - **Exit criteria**: Every issue response carries `labelIds` + `labels` with the
    full Label shape; list stays within the one-extra-query budget.

- [ ] **T013** — Remove `createLabel` / `listLabels` from the issue service
  - **Objective**: Eliminate duplicated label logic now that `LabelService` owns it
    (D-11).
  - **Files**: MODIFY `backend/src/services/issue.ts`
  - **Responsibility**: Backend / service layer.
  - **Depends on**: T010 (replacement exists), T006 (domain import fix), T015
    (route wiring uses the new service).
  - **Preserve**: The `IssueService` public surface for issues (`createIssue`,
    `getIssue`, `listIssues`, `updateIssue`, `deleteIssue`) unchanged.
  - **Considerations**: Delete `createLabel`/`listLabels` from the returned object;
    remove the now-unused `labels` table import and `createLabelRecord` import
    (re-import from `../domain/label.js` if T006 already did; drop `labels` from
    the schema import list if unused). Verify no other caller references these
    methods (only the labels route does — rewired in T014).
  - **Tests**: `npm run typecheck -w backend`; full backend suite after T014–T018.
  - **Exit criteria**: Issue service no longer exposes label CRUD; no broken imports.

- [ ] **T014** — Rewire the label routes (color, ordering, PATCH, DELETE)
  - **Objective**: Full label API per §7.4: extended create/list, new
    update/delete endpoints with correct status codes and authZ.
  - **Files**: MODIFY `backend/src/api/routes/labels.ts`
  - **Responsibility**: Backend / API routes.
  - **Depends on**: T010 (`LabelService`), T007 (validators), T015 (wiring).
  - **Preserve**: Route paths `/workspaces/:workspaceId/labels` (POST/GET), the 401
    when unsigned, the single-error response shape, and the 409/422 semantics.
  - **Considerations**: Use `createLabelSchema`/`updateLabelSchema` from the new
    validators (drop the inline schema). POST body is now `{ name, color }` (422 on
    invalid/missing color); GET returns items ordered by name ascending. **NEW**
    `PATCH /labels/:id` (body `{ name?, color? }`, at-least-one via schema; 404
    missing; 409 duplicate rename; 200 `{ label }`) and `DELETE /labels/:id`
    (204; 404 missing). AuthZ handled inside the service (`requireMember` against
    the label's workspace — SEC-002/003/007). Route `deps` swaps `issueService`
    for `labelService`.
  - **Tests**: T016 (full labels integration suite).
  - **Exit criteria**: All §7.4 endpoints behave per spec (201/200/204/401/403/
    404/409/422).

- [ ] **T015** — Wire `LabelService` in the route index
  - **Objective**: Instantiate and register the new service so routes and tests can
    use it.
  - **Files**: MODIFY `backend/src/api/routes/index.ts`
  - **Responsibility**: Backend / composition root.
  - **Depends on**: T010.
  - **Preserve**: All other service wiring and mount paths.
  - **Considerations**: `const labelService = createLabelService({ db: deps.db,
    membershipService });` and pass it to `labelRoutes({ db, labelService,
    membershipService })` (update `LabelRouteDeps` in `routes/labels.ts`
    accordingly).
  - **Tests**: `npm run typecheck -w backend`; backend suite after T016.
  - **Exit criteria**: App boots; label routes resolve the new service.

- [ ] **T016** — Create `backend/tests/integration/labels.test.ts`
  - **Objective**: Full backend coverage of label CRUD, authorization, and edge
    cases (spec §7.15 backend list, SC-002/003/004).
  - **Files**: CREATE `backend/tests/integration/labels.test.ts`
  - **Responsibility**: Backend / tests.
  - **Depends on**: T010, T014, T015, T016-style helpers (`tests/helpers.ts`:
    `setupApp`, `signupAs`, `createWorkspace`, `createProject`, `joinWorkspace`).
  - **Preserve**: Existing integration test conventions (supertest, `setupApp`).
  - **Considerations**: Cover: create with color → 201 + `{ id, workspaceId, name,
    color }`; create missing/invalid color → 422 on `color`; blank/whitespace/over-50
    name → 422; duplicate name same workspace (create and rename) → 409; `Bug` vs
    `bug` both creatable (case-sensitive, D-4); same name in two workspaces allowed;
    list → 200 ordered by name; rename → 200; re-color → 200; rename to own name →
    200 no-op; delete → 204 + gone from list; delete a label referenced by issues →
    issues remain and their `labels`/`labelIds` consistent (DI-003, SC-004);
    unauthenticated create/list/patch/delete → 401; non-member create/list/patch/
    delete → 403; member of A cannot patch/delete B's label → 403 (US4); nonexistent
    id on patch/delete → 404.
  - **Tests**: `npm test -w backend` integration suite.
  - **Exit criteria**: All label cases pass; no 500s (duplicates rejected before
    write).

- [ ] **T017** — Extend the issue integration tests for labels
  - **Objective**: Prove the security fix and additive enrichment on issue
    endpoints (FR-009/012, US2/US4 scenarios).
  - **Files**: MODIFY `backend/tests/integration/issues.test.ts`
  - **Responsibility**: Backend / tests.
  - **Depends on**: T011 (fix), T012 (enrichment), T008 (validator).
  - **Preserve**: All existing issue tests (filters, pagination, assignee,
    comments) unchanged.
  - **Considerations**: Add: issue create/update with a label from another
    workspace → 422 and no relationship persisted (bug-fix regression, US4
    scenario 1); duplicate `labelIds` in one request → 422 (DI-004); issue
    create/get/list/update return embedded `labels` (id, name, color) alongside
    preserved `labelIds`; assign/remove labels via `PATCH /issues/:id` replace-all
    (D-8, FR-010); deleting a referenced label leaves issues intact and
    `labelIds`/`labels` consistent (US4 scenario 3).
  - **Tests**: `npm test -w backend` integration suite.
  - **Exit criteria**: New assertions pass; the foreign-workspace case can never
    persist a cross-workspace relationship.

- [ ] **T018** — Extend `backend/tests/api.test.ts` for labels
  - **Objective**: Keep the end-to-end smoke/API suite in sync with the new shape.
  - **Files**: MODIFY `backend/tests/api.test.ts`
  - **Responsibility**: Backend / tests.
  - **Depends on**: T014 (color in create), T012 (embedded labels).
  - **Preserve**: Existing API test flow and assertions.
  - **Considerations**: Label creation payloads gain `color`; assert embedded
    `labels` on the issue created with labels; assert `labelId` filter still works.
  - **Tests**: `npm test -w backend` API suite.
  - **Exit criteria**: API suite green with color-aware payloads.

**Phase 3 checkpoint**: Full label API live; cross-workspace assignment rejected;
issue payloads enriched additively; backend suite green.

---

## Phase 4 — Shared Contracts

**Purpose**: Complete the shared type surface so backend payloads and frontend
consumers share exactly one shape (DM-004, §7.4). The palette types already
landed in Phase 1 (T003); this phase adds the remaining request/payload types.

- [ ] **T019** — Complete shared label/issue types
  - **Objective**: One `Label` type everywhere; additive `Issue.labels`; typed
    request bodies (DM-004/006, FR-012).
  - **Files**: MODIFY `shared/index.ts`
  - **Responsibility**: Shared package.
  - **Depends on**: T003 (`LABEL_COLORS`, `LabelColor`); INSPECT backend payloads
    from T012/T014 for conformance.
  - **Preserve**: `Issue.labelIds: string[]`, `IssueQueryParams.labelId`, and every
    other existing shared type unchanged (NFR-001).
  - **Considerations**: `Label` gains `color: LabelColor`; `Issue` gains additive
    `labels: Label[]`; `CreateLabelRequest` gains `color: LabelColor`; add
    `UpdateLabelRequest { name?: string; color?: LabelColor }`. Verify
    `IssueQueryParams.labelId` already exists (it does) and leave it.
  - **Tests**: `npm run typecheck` across backend + frontend + shared (the gate).
  - **Exit criteria**: Shared types compile; backend responses conform to them;
    frontend can consume `issue.labels` / `label.color`.

**Phase 4 checkpoint**: One `Label` shape everywhere; additive `Issue.labels`
typed; `labelIds` preserved.

---

## Phase 5 — Frontend Label Management

**Purpose**: The Labels management section in the workspace left column with
create/rename/re-color/delete, plus the design-token and `Badge`-tone groundwork
the whole feature needs (UI-001…004, FR-013, D-9/D-12, VL-001/002/004).
All frontend tasks reference `VISUAL_LANGUAGE.md` (repo root).

- [ ] **T020** — Add label color tokens to `tokens.css`
  - **Objective**: Define the `--color-label-*` token families once so the palette
    is a role-remappable design-system concept (VL-002, §39 token rule).
  - **Files**: MODIFY `frontend/src/styles/tokens.css`
  - **Responsibility**: Frontend / design tokens.
  - **Depends on**: T003 (palette keys).
  - **Preserve**: All existing tokens (brand petrol, coral, status, priority,
    badge mappings, avatar tones) untouched; no new radius/spacing/shadow tokens
    (VL-004).
  - **Considerations**: For each of `violet | magenta | indigo | olive | sand |
    plum` add `--color-label-<key>-bg`, `--color-label-<key>-text`,
    `--color-label-<key>-border`. Start values from spec §12 risk note (violet
    `#5B3F9E`, magenta `#A21C6E`, indigo `#4F46A3`, olive `#566B1F`, sand
    `#7A5A2E`, plum `#7A3B5C`, each with a light bg tint and muted border). Each
    must pass an axe/AA contrast check before acceptance; hues are deliberately
    distinct from status (blue/amber/green), priority (grey/amber/orange/red),
    petrol, and coral (VL-002).
  - **Tests**: Visual + contrast verification; covered by T025/T035 (axe).
  - **Exit criteria**: Six token families present and used only by label surfaces.

- [ ] **T021** — Add label badge tones, color-aware chip styles, and section styles
  to `components.css`
  - **Objective**: Extend the existing compact rectangular badge/chip vocabulary to
    labels — no new tag component, no pills, no decorative circles (VL-001, D-12).
  - **Files**: MODIFY `frontend/src/styles/components.css`
  - **Responsibility**: Frontend / styles.
  - **Depends on**: T020 (tokens).
  - **Preserve**: `.badge` anatomy (radius-sm, `--text-label`, tabular-nums, 6px
    `::before` swatch), `.label-picker`/`.label-chip` (native checkbox) pattern,
    and all existing badge tones.
  - **Considerations**: Add `.badge--label-<key>` rules mapping each key to its
    token family (bg/border/text). Make `.label-chip` color-aware: render a small
    swatch in the label's color and tint the selected state (checked) with that
    label's token family instead of the petrol accent (UI-005). Add styles for the
    Labels management section (compact list rows: swatch + name + quiet ghost
    Rename/Delete, mirroring the Projects rail anatomy, §18) and the color radio
    group (native radios with visible swatches + color-name labels, A11Y-002).
    Swatches are `aria-hidden` decoration (A11Y-003).
  - **Tests**: Visual review; component tests T025/T028; axe T035.
  - **Exit criteria**: Labels render as compact colored tags/chips using only
    existing anatomy + new label tokens; selected chips tint by label color.

- [ ] **T022** — Add `label-<color>` tones to `Badge.tsx` and a `labelTone` helper
  - **Objective**: Expose the new tones through the existing `Badge` API and give
    surfaces one helper to map `color → tone` (UI-009, D-12).
  - **Files**: MODIFY `frontend/src/components/Badge.tsx`; CREATE
    `frontend/src/lib/labelTone.ts`
  - **Responsibility**: Frontend / components + lib.
  - **Depends on**: T003 (`LabelColor`), T020 (tokens exist), T021 (CSS tones).
  - **Preserve**: `Badge` props/API and all existing `BadgeTone` members unchanged;
    ledger/status/priority tones untouched.
  - **Considerations**: Extend `BadgeTone` with `"label-violet" | "label-magenta" |
    "label-indigo" | "label-olive" | "label-sand" | "label-plum"`. `labelTone(color:
    LabelColor): BadgeTone` maps palette key → `label-<color>`; for any unknown
    value it must fall back safely to `"neutral"` (VL-007) rather than crash. This
    helper is reused by IssueForm chips (T026), IssuePage tags (T027), and the
    ledger (T032) — one definition, three consumers.
  - **Tests**: Unit test for `labelTone` (add to `labels.test.tsx` or a small
    `labelTone.test.ts`); typecheck.
  - **Exit criteria**: `labelTone` exported and unit-tested; `BadgeTone` accepts
    label tones.

- [ ] **T023** — Create `frontend/src/components/LabelsSection.tsx`
  - **Objective**: The compact Labels management surface: list + create/rename/
    re-color/delete dialogs with empty and error states (UI-001…004, FR-013,
    ERR-001/003, A11Y-004/005).
  - **Files**: CREATE `frontend/src/components/LabelsSection.tsx`
  - **Responsibility**: Frontend / components.
  - **Depends on**: T022 (tones), T019 (shared `Label`), T014 (API); INSPECT
    `ProjectDialog.tsx` (anatomy to mirror) and `Dialog.tsx`/`Field.tsx`/
    `Button.tsx`/`Alert.tsx`/`EmptyState.tsx` (reused components).
  - **Preserve**: The Projects-rail anatomy pattern; no new dialog/button/field
    components; no fabricated usage counts (NFR-007, DI-006).
  - **Considerations**: Fetch labels via `api.get<{ items: Label[] }>
    (/workspaces/:id/labels)` once (shared with the Phase 7 filter dropdown —
    PERF-003). Render a "Labels" `section-title` + "New label" `Button` + compact
    list rows (color swatch via `labelTone`/tokens + name + ghost Rename/Delete
    actions, quiet and subordinate per §18). Empty state via `EmptyState` ("No
    labels yet" + short explanation, ERR-001). Dialogs: create (name `Field` +
    native color radio group with visible names, preselect `violet`, duplicate-409
    keeps dialog open with input retained and `Alert` "A label with this name
    already exists" — ERR-003), rename/re-color (pre-filled, saves via
    `PATCH /labels/:id`), delete (coral destructive confirmation stating the label
    is removed from issues and issues are not deleted — UI-004, DI-003). All dialogs
    reuse `Dialog` (focus trap/Escape/focus return). Handle 403/404 via the
    existing alert pattern (ERR-005/006).
  - **Tests**: T025 (dedicated component suite).
  - **Exit criteria**: Full CRUD works from the section; empty/duplicate/error
    states render correctly; keyboard-complete.

- [ ] **T024** — Render `LabelsSection` in the workspace page
  - **Objective**: Place label management between the Projects rail and Invitations
    in the workspace left column (UI-001, D-9).
  - **Files**: MODIFY `frontend/src/pages/WorkspacePage.tsx`
  - **Responsibility**: Frontend / page composition.
  - **Depends on**: T023.
  - **Preserve**: Projects rail and Invitations placement; workspace layout
    structure; all existing page behavior.
  - **Considerations**: Render `<LabelsSection workspaceId={workspaceId!} />`
    inside `.projects-column` between `ProjectDialog` and `Invitations`. The
    section is reachable by all workspace members (member-level, D-6 — no owner
    gating).
  - **Tests**: Covered by T025 / T031.
  - **Exit criteria**: Section renders in the left column with correct order and
    responsiveness (RES-002).

- [ ] **T025** — Create `frontend/tests/component/labels.test.tsx`
  - **Objective**: Component coverage of the Labels section (spec §7.15 frontend
    list).
  - **Files**: CREATE `frontend/tests/component/labels.test.tsx`
  - **Responsibility**: Frontend / tests.
  - **Depends on**: T023, T024; INSPECT existing component test conventions
    (`issue.test.tsx`, mock `api` module).
  - **Preserve**: Existing mock style (`vi.mock("../../src/api/client.js")`).
  - **Considerations**: Mock `/workspaces/:id/labels` returning `{ id, name,
    color }` items. Cover: empty state + "New label" action; create with name +
    color → POST body asserted; rename; re-color; delete with confirmation →
    DELETE asserted; duplicate-name 409 keeps dialog open with input retained;
    color radio group renders visible color names; swatches `aria-hidden`.
  - **Tests**: `npm run test:ui -w frontend` labels suite.
  - **Exit criteria**: All LabelsSection behaviors covered and green.

**Phase 5 checkpoint**: Labels section fully functional; new tokens + tones in
place; component tests green; typecheck + lint green.

---

## Phase 6 — Issue Label Interaction

**Purpose**: Color-aware chips in the issue form and the always-visible Labels
fact-rail row driven by embedded `issue.labels` (UI-005/007, FR-008/010,
ERR-002, PERF-003).

- [ ] **T026** — Make the issue-form label picker color-aware
  - **Objective**: Existing checkbox chips gain label color swatches and
    color-tinted selected state; form still submits `labelIds` (UI-005, A11Y-001).
  - **Files**: MODIFY `frontend/src/components/IssueForm.tsx`
  - **Responsibility**: Frontend / components.
  - **Depends on**: T019 (shared `Label`), T022 (`labelTone`), T021 (chip styles).
  - **Preserve**: Native checkbox `.label-chip` pattern (Tab + Space keyboard),
    the "hidden when the workspace has no labels" behavior (ERR-001), and the
    `labelIds` submit path (FR-010).
  - **Considerations**: Replace the local `interface Label { id; name }` with the
    shared `Label` type; render a swatch using the chip's label color (via
    `labelTone`) and tint the selected state with that label's token family.
  - **Tests**: T028 (mocks gain color; chips render swatches; `labelIds` submit).
  - **Exit criteria**: Chips render color swatches; selection reflects in
    `labelIds`; no behavior change for no-label workspaces.

- [ ] **T027** — Drive the fact rail Labels row from embedded `labels`
  - **Objective**: Always-visible Labels row with colored tags or "No labels";
    remove the IssuePage label-list fetch (UI-007, FR-008, ERR-002, PERF-003).
  - **Files**: MODIFY `frontend/src/pages/IssuePage.tsx`
  - **Responsibility**: Frontend / page.
  - **Depends on**: T019 (`Issue.labels`), T022 (`labelTone`).
  - **Preserve**: The fact-rail anatomy (§24), "No labels" honesty for empty
    values (§24), and all other rail rows (Status/Priority/Assignee/Due/Project).
  - **Considerations**: Delete the `labelNames` map state and the
    `/workspaces/:id/labels` fetch in the project-name effect. Render the Labels
    row always: map `issue.labels` to `Badge` tags with `labelTone(label.color)`;
    when `issue.labels.length === 0` render "No labels" (ERR-002). Swatches
    remain `aria-hidden` (A11Y-003); name text always present (NFR-005).
  - **Tests**: T029 (embedded-labels mocks; "No labels" when empty; no `/labels`
    fetch asserted).
  - **Exit criteria**: Fact rail renders colored tags or "No labels"; no label-list
    request from IssuePage.

- [ ] **T028** — Update `issue.test.tsx` for color-aware chips
  - **Objective**: Keep the IssueForm suite in sync with the shared `Label` shape.
  - **Files**: MODIFY `frontend/tests/component/issue.test.tsx`
  - **Responsibility**: Frontend / tests.
  - **Depends on**: T026.
  - **Preserve**: Existing IssueForm tests (title/status/priority/member picker,
    submit).
  - **Considerations**: Label mock items gain `color`; assert chips render the
    swatch/color; assert checking/unchecking updates `labelIds` and submit posts
    `labelIds`.
  - **Tests**: `npm run test:ui -w frontend` issue suite.
  - **Exit criteria**: IssueForm suite green with color-aware labels.

- [ ] **T029** — Update `issue-page.test.tsx` for embedded labels
  - **Objective**: Keep the IssuePage suite in sync with `Issue.labels`.
  - **Files**: MODIFY `frontend/tests/component/issue-page.test.tsx`
  - **Responsibility**: Frontend / tests.
  - **Depends on**: T027.
  - **Preserve**: Existing IssuePage tests (status/priority/assignee/comments).
  - **Considerations**: Mock issue payloads gain `labels: [{ id, workspaceId,
    name, color }]`; assert the Labels row renders colored tags; assert "No
    labels" when empty; assert no `/workspaces/:id/labels` GET is issued.
  - **Tests**: `npm run test:ui -w frontend` issue-page suite.
  - **Exit criteria**: IssuePage suite green; embedded-labels rendering covered.

**Phase 6 checkpoint**: Chips + fact rail render per UI-005/007; component tests
green; typecheck + lint green.

---

## Phase 7 — Label Filtering

**Purpose**: Single "Filter by label" dropdown reusing the existing `?labelId=`
query parameter (UI-008, FR-011, D-10).

- [ ] **T030** — Add the label filter dropdown to the workspace filter bar
  - **Objective**: Filter the ledger by one label via the existing API param;
    participate in Clear filters; hidden when the workspace has no labels
    (US3, ERR-001, RES-004).
  - **Files**: MODIFY `frontend/src/pages/WorkspacePage.tsx`
  - **Responsibility**: Frontend / page.
  - **Depends on**: T019 (`Label` type), T023 (labels list to share), T014
    (existing `labelId` API — no backend change).
  - **Preserve**: The existing filter bar anatomy (Field + select pattern for
    status/priority, §29), the `filtering` state, Clear-filters action, and the
    result-count display.
  - **Considerations**: Add `labelFilter` state; pass `labelId` in `loadIssues`
    URL params when set; add a "Filter by label" `Field`+`select` (options "All
    labels" + label names) rendered only when labels exist; include `labelFilter`
    in `filtering` and reset it in Clear filters. Single-select only — no saved/
    advanced/combined filters (Non-Goals). Reuse the labels list fetched by
    `LabelsSection` (lift it up or fetch once in WorkspacePage and pass down) to
    avoid a duplicate request (PERF-003).
  - **Tests**: T031.
  - **Exit criteria**: Selecting a label filters the ledger via `labelId`; Clear
    restores the full ledger; control hidden with no labels; stacks at ≤375px.

- [ ] **T031** — Update `workspace-page.test.tsx` for label filtering and tags
  - **Objective**: Cover the filter dropdown and its interaction (spec §7.15
    frontend list, US3 scenarios).
  - **Files**: MODIFY `frontend/tests/component/workspace-page.test.tsx`
  - **Responsibility**: Frontend / tests.
  - **Depends on**: T030; also asserts ledger tags from T032 if already landed
    (otherwise tag assertions move to T032's suite).
  - **Preserve**: Existing workspace-page tests (projects, issue list, stats,
    empty states).
  - **Considerations**: Mock `/workspaces/:id/labels` with `{ id, name, color }`;
    assert the filter dropdown renders when labels exist; selecting it issues a
    GET with `labelId`; Clear resets it; dropdown hidden when no labels.
  - **Tests**: `npm run test:ui -w frontend` workspace-page suite.
  - **Exit criteria**: Filter behavior covered and green.

**Phase 7 checkpoint**: Single-label filtering works end-to-end; tests green;
typecheck + lint green.

---

## Phase 8 — Ticket Ledger Integration + Documentation

**Purpose**: Render label tags in the ledger rows and give the feature its single
intentional `VISUAL_LANGUAGE.md` update (UI-006, FR-007, VL-001…007).

- [ ] **T032** — Render label tags in the ticket ledger rows
  - **Objective**: Each ledger row shows its labels as compact colored tags in the
    secondary metadata row without disturbing the Ticket Ledger signature (UI-006,
    FR-007, §19/§20, VL-003).
  - **Files**: MODIFY `frontend/src/pages/WorkspacePage.tsx`; MODIFY
    `frontend/src/styles/components.css` (ledger-meta wrap rules)
  - **Responsibility**: Frontend / page + styles.
  - **Depends on**: T019 (`Issue.labels`), T022 (`labelTone`), T021 (badge tones).
  - **Preserve**: Priority edge bar, mono ticket key, title, description,
    status/priority badges, assignee, chevron, and the ~44px row height (§19).
    Labels stay in the metadata row and never outrank key/title/status/priority
    (VL-003, §20).
  - **Considerations**: In the `.ledger-meta` span, render `issue.labels.map(l =>
    <Badge tone={labelTone(l.color)}>{l.name}</Badge>)` between the priority badge
    and the assignee (order: status → priority → labels → assignee). Ensure
    `.ledger-meta` uses `flex-wrap` so tags wrap at narrow widths with no
    horizontal page overflow; mono key and title remain visible (RES-001/005).
    Unknown stored color falls back to neutral tone (VL-007).
  - **Tests**: Extend `workspace-page.test.tsx` (or `labels.test.tsx`) to assert
    multiple labels render on a row, order-independent; visual review vs §19/§20.
  - **Exit criteria**: Ledger renders colored label tags per UI-006; no layout
    regressions; existing tests green.

- [ ] **T033** — Update `VISUAL_LANGUAGE.md` with the Label Color System
  - **Objective**: Document the genuinely new semantic color role so the system
    grows more coherent, not more one-off (VL-006, §39 token rule).
  - **Files**: MODIFY `VISUAL_LANGUAGE.md` (repo root)
  - **Responsibility**: Documentation (design-system source of truth).
  - **Depends on**: T020 (final token values), T032 (ledger placement).
  - **Preserve**: All existing sections and terminology; only additive edits.
  - **Considerations**: Add a **Label Color System** section (after §9 Priority
    Color System, before §10 Typography) with: the 6 palette keys as a table
    (key → `--color-label-<key>-{bg,text,border}` token roles → actual hex values);
    the rules — compact rectangular badge anatomy, muted categorical tints,
    color never used as status/priority/brand/danger indicator, color always
    reinforced by name text (NFR-005), swatches `aria-hidden` (A11Y-003); where to
    use (ledger metadata row between priority and assignee, fact-rail Labels row,
    issue-form chips, Labels management list); where NOT to use. Touch §16
    (Workspace Workbench structure gains Labels section), §19 (ledger metadata row
    order), §20 (labels stay in secondary metadata), §24 (Labels row always
    visible; "No labels" honesty). Match actual shipped token values from T020.
  - **Tests**: Manual review that the doc matches the implementation; no code test.
  - **Exit criteria**: Document reflects the implemented palette, tokens, and
    placement rules exactly; terminology consistent with the rest of the doc.

**Phase 8 checkpoint**: Ledger tags live; `VISUAL_LANGUAGE.md` documents the
Label Color System; existing tests green.

---

## Phase 9 — Accessibility + Responsive Hardening

**Purpose**: Verify and harden every touched surface; no a11y/responsive
regressions (A11Y-001…008, RES-001…005, SC-008/009).

- [ ] **T034** — Extend the coarse-pointer touch-target block
  - **Objective**: 44px minimum targets for label chips, color radio swatches, and
    label-row actions on coarse pointers (A11Y-006, §31 coarse rule).
  - **Files**: MODIFY `frontend/src/styles/components.css`
    (`@media (pointer: coarse)` block, currently includes `.btn`, `.label-chip`,
    `.card-main`, field controls)
  - **Responsibility**: Frontend / styles.
  - **Depends on**: T021 (chip/section/radio styles), T023 (label row actions).
  - **Preserve**: Existing coarse-pointer rules and the 44px convention (§31).
  - **Considerations**: Add the label color-radio swatches and label-row action
    buttons to the block with `min-height: 44px` (and adequate padding where the
    default is too tight, mirroring the existing `.card-actions .btn` rule).
  - **Tests**: Manual touch-target inspection; T035 where feasible.
  - **Exit criteria**: All label controls meet 44px on coarse pointers; no other
    rules altered.

- [ ] **T035** — Update `frontend/tests/accessibility/core.test.tsx`
  - **Objective**: Axe-clean + keyboard-complete across all labels surfaces
    (A11Y-008, SC-008, §7.15 accessibility list).
  - **Files**: MODIFY `frontend/tests/accessibility/core.test.tsx`
  - **Responsibility**: Frontend / tests.
  - **Depends on**: T023, T026, T027, T032 (surfaces exist).
  - **Preserve**: Existing a11y tests and mock conventions; the axe setup.
  - **Considerations**: Cover axe-clean: Labels section, create/rename/re-color/
    delete dialogs, ledger with labels, fact rail with labels, color radio group,
    colored chips. Keyboard: chips toggle with Space; radio group arrows; dialogs
    trap/Escape/focus-return; label-row actions reachable. Assert swatches are
    `aria-hidden` and the visible name carries the accessible name (SC-009); assert
    color never conveyed by color alone. Coarse-pointer 44px asserted where
    feasible.
  - **Tests**: `npm run test:a11y -w frontend`.
  - **Exit criteria**: No new axe violations; keyboard flows complete; SC-009 holds.

- [ ] **T036** — Responsive verification of label surfaces
  - **Objective**: Verify the feature at every breakpoint with no information loss
    (RES-001…005).
  - **Files**: INSPECT `WorkspacePage.tsx`, `IssuePage.tsx`, `LabelsSection.tsx`,
    `components.css` (no code change unless a gap is found)
  - **Responsibility**: Frontend / QA.
  - **Depends on**: T023, T026, T027, T030, T032.
  - **Preserve**: Existing breakpoints (§31: ≤1100 collapse, ≤1024 icon rail,
    ≤700 mobile top bar, ≤375 stacks/near-full-screen dialogs).
  - **Considerations**: Verify: ledger tags wrap within `ledger-meta` with the mono
    key/title visible; Labels section stacks in the ≤1100 two-column collapse and
    at narrow widths; label dialogs near-full-screen ≤700/≤375; filter dropdown
    stacks ≤375; important label info never hidden to fit (RES-005).
  - **Tests**: Manual responsive review; adjust CSS only if a real gap is found
    (extending existing rules, never new values).
  - **Exit criteria**: All label UI behaves intentionally at 1280/1100/1024/700/375px.

**Phase 9 checkpoint**: axe + keyboard + responsive verification green; no
information hidden; no new motion/values.

---

## Phase 10 — Tests + Verification

**Purpose**: Full verification against the spec's success criteria and acceptance
scenarios; close any coverage gaps (SC-001…009, §8, §7.15).

- [ ] **T037** — Full regression suite, acceptance scenarios, and build verification
  - **Objective**: Prove the whole feature meets every success criterion and
    existing behavior is preserved.
  - **Files**: All files from Phases 1–9 (no new implementation unless a gap is
    found); INSPECT `package.json` for script names
  - **Responsibility**: Whole feature / final QA.
  - **Depends on**: all prior tasks.
  - **Preserve**: Everything — this is the regression gate.
  - **Considerations**:
    - Run the complete backend, frontend, shared, and accessibility suites
      (`npm test`, `npm run test:a11y`).
    - Run `npm run typecheck`, `npm run lint`, `npm run build`.
    - Run `npm run db:migrate` against a scratch copy of a 0001+0002 database to
      confirm the 0003 apply path on a real file DB (SC-007).
    - Walk spec §8 acceptance scenarios: 1–7 via UI + API, 8–9 via API (cross-
      workspace rejection, non-member 403).
    - Verify SC-001…SC-009 explicitly (trace to tests/behavior).
    - Final visual review against AGENTS.md's Visual Review Checklist (hierarchy,
      rhythm, structure, typography, color, components, interaction, responsive,
      accessibility, data) and confirm no fabricated UI data (DI-006, NFR-007).
  - **Tests**: Full suite; this task is the gate.
  - **Exit criteria**: All commands green; every SC satisfied; acceptance scenarios
    pass; no unexpected diffs to untouched areas.

**Phase 10 checkpoint**: Feature complete, verified, and ready for review/merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** — no dependencies (starts immediately)
- **Phase 2** — depends on Phase 1 (`LabelColor`/`LABEL_COLORS`)
- **Phase 3** — depends on Phase 1 + Phase 2 (services + API)
- **Phase 4** — depends on Phase 1 (palette types already landed); completes the
  shared surface ahead of its first consumers (Phase 5+)
- **Phase 5** — depends on Phase 3 (API) + Phase 4 (shared types)
- **Phase 6** — depends on Phase 5 (tokens/tones) + Phase 4 (`Issue.labels`)
- **Phase 7** — depends on Phase 5 (labels list) + Phase 3 (existing `labelId`
  API)
- **Phase 8** — depends on Phase 5 (tones) + Phase 6 (fact rail) + Phase 4
- **Phase 9** — depends on Phases 5–8 (all touched surfaces)
- **Phase 10** — depends on all phases

### Within-Phase Ordering

- Tests may be written and expected to fail before implementation (red-green),
  per 003 convention; the final green gate is the exit criterion.
- Backend: migration → schema → shared palette → domain → validators → services →
  routes → wiring → integration tests.
- Frontend: tokens → CSS tones → Badge/helper → section component → page
  composition → interaction → filtering → ledger → a11y.

### Parallel Opportunities

- Phase 1: T001/T003 in parallel; T002 after T001; T004 after T001+T002.
- Phase 2: T007/T008 in parallel; T005 before T006; T009 after T007/T008.
- Phase 3: T011 is independent (can start immediately); T010 before T014/T015;
  T012 parallel to T010 (different concerns, same file — sequence T011→T012→T013
  to avoid `issue.ts` conflicts); T016/T017/T018 after their dependencies.
- Phase 4: T019 single task.
- Phase 5: T020/T022 in parallel; T021 after T020; T023 after T022; T024 after
  T023; T025 after T023+T024.
- Phase 6: T026/T027 in parallel (different files); T028 after T026; T029 after
  T027.
- Phase 7: T030 then T031.
- Phase 8: T032 then T033.
- Phase 9: T034/T035/T036 mostly independent after their surfaces exist.
- Phase 10: single gate.

### Key Files with Multiple Touch Points (sequence carefully)

- `backend/src/services/issue.ts` — T011, T012, T013 (sequence in order).
- `frontend/src/pages/WorkspacePage.tsx` — T024, T030, T032 (sequence in order).
- `frontend/src/styles/components.css` — T021, T032, T034 (sequence in order).
- `shared/index.ts` — T003 (Phase 1) then T019 (Phase 4).
- `backend/tests/integration/issues.test.ts` — T017 only.

## Implementation Strategy

1. Complete Phase 1 → migrate to version 3 (SC-007).
2. Complete Phase 2 → validation locked (SC-002).
3. Complete Phase 3 → security fix + API + enrichment (SC-003/004/005).
4. Complete Phase 4 → shared types aligned.
5. Complete Phase 5 → label management UI (US1, FR-013).
6. Complete Phase 6 → assignment + detail (US2, FR-008/010).
7. Complete Phase 7 → filtering (US3, FR-011).
8. Complete Phase 8 → ledger integration + `VISUAL_LANGUAGE.md` (UI-006, VL-006).
9. Complete Phase 9 → a11y + responsive (SC-008/009).
10. Complete Phase 10 → full verification (SC-001…009).

**STOP and VALIDATE** at each phase checkpoint before proceeding.

## Notes

- Preserve existing behavior/contracts at every step (Badge API, `labelIds`,
  `?labelId=`, membership authZ, session auth, API conventions, visual language).
- The `validateLabels` workspace-scoping fix (T011) is a security/data-integrity
  gate: do not defer it.
- No new runtime dependencies (NFR-006). No label usage counts or statistics
  (NFR-007). No speculative scope (Non-Goals list in spec §4).
- Commit after each task or logical group.
- Final report on completion must note: changes made, visual patterns reused,
  whether `VISUAL_LANGUAGE.md` was updated (yes — T033), new design decisions,
  responsive/a11y considerations, and verification results.