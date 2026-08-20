# Implementation Plan: My Issues

**Branch**: `005-my-issues` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-my-issues/spec.md`

## Summary

My Issues adds a cross-workspace personal workload page reachable from a new
sidebar item. A read-only backend aggregation endpoint
(`GET /api/my-issues`) returns both the summary counts (total, Open, In
Progress, Overdue) and the sorted ledger of issues assigned to the signed-in
user across every workspace they can reach, with per-row workspace/project
context. The frontend reuses the existing stat strip, ticket ledger, empty
state, error, skeleton, and sidebar patterns; the only new UI elements are a
quiet `WorkspaceName / ProjectName` mono caption on ledger rows, an
"Include closed" control, and a new `PERSONAL` sidebar section. **No database
migration is required** — the feature aggregates existing tables
(`users`, `workspaces`, `memberships`, `projects`, `issues`, `labels`,
`issue_labels`).

User directive noted: the user has no sort-order preference and asked to keep
the UX quality high across all priorities — every user story carries the same
visual-language, accessibility, and responsive obligations; none are treated as
a reduced-quality stub.

## Technical Context

**Language/Version**: TypeScript 5.5 (ESM); Node.js 22 LTS (workspace `engines`).

**Primary Dependencies**: Backend — Express 5, Drizzle ORM + better-sqlite3,
zod. Frontend — React 18, React Router 6, Vite. Shared — the
`@mini-issue-tracker/shared` workspace package for cross-layer types.

**Storage**: SQLite (better-sqlite3, WAL) via Drizzle. **No migration for this
feature** — all required columns/indexes already exist
(`issues.assignee_id` + `issues_assignee_idx`, `issues.due_date`,
`issues.project_id` + `issues_project_idx`, `memberships` indexes).

**Testing**: Vitest + supertest (backend integration, in-memory DB via
`tests/helpers.ts`); React Testing Library + jsdom (frontend component);
vitest-axe (accessibility). Run via root `npm test`, `npm run test:ui`,
`npm run test:a11y`, `npm run lint`, `npm run typecheck`, `npm run build`.

**Target Platform**: Web SPA (Vite dev server at :5173) + Express API (:3000).

**Project Type**: Web application — single-page React frontend, REST API
backend, shared types workspace.

**Performance Goals**: Page renders with real data in under 2 seconds on a
typical connection (SC-005). The aggregation query is indexed on the
filtering columns; result set is a single user's assigned issues (small).

**Constraints**: Data honesty (FR-008) — no fabricated counts; summary and
ledger must always agree (FR-010, SC-002); reuse of the existing visual
language (AGENTS.md / VISUAL_LANGUAGE.md); no schema change; read-only
endpoint.

**Scale/Scope**: Small-team tracker; single-user personal workload views.
No pagination (explicit decision — see research.md §5).

All prior `NEEDS CLARIFICATION` items were resolved during `/speckit.specify`
(Q1=C active-by-default + Include-closed control; Q2=A informational stats)
and confirmed in the research phase. **No unresolved clarifications remain.**

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Pre-design assessment | Post-design verification |
|-----------|----------------------|--------------------------|
| I. Simplicity First | No schema change; reuse existing patterns | Aggregation service is a single read path; no new tables, no pagination machinery, no speculative fields (overdue not stored, not exposed per-row). **PASS** |
| II. Modular & Maintainable | New `myIssues` service + route + validator mirror existing `service → route` structure | Single-responsibility service; shared label-map helper extracted to avoid duplication (`backend/src/lib/labels.ts`). **PASS** |
| III. Type Safety & Consistency | Add `MyIssue extends Issue` + `MyIssuesOverview` to shared types | Frontend and backend share one contract; `byStatus` reuses the existing `ISSUE_STATUSES` enum keys. **PASS** |
| IV. Security by Default | Endpoint requires auth; user-scoped | Aggregation is keyed to `assigneeId = caller`; reachable-workspace set is identical to the existing sidebar list; outsider/leaver isolation is integration-tested. **PASS** |
| V. Test Critical Behavior | Integration tests for scope/isolation/overdue | Covered: cross-workspace aggregation, second-user isolation, overdue derivation, include-closed, sort, empty/error states. **PASS** |
| VI. User Experience & Accessibility | New page + nav must be keyboard-usable and axe-clean | Sidebar `NavLink`, link rows, labelled checkbox; axe scan + keyboard assertions planned; 44px touch targets via existing coarse-pointer rules. **PASS** |
| VII. Requirements Before Implementation | Spec approved with 12 FRs + 6 SCs | Every phase traces to FR/SC references. **PASS** |
| VIII. No Silent Assumptions | Sort order, overdue rule, scope, include-closed default | All documented as explicit decisions in research.md / data-model.md. **PASS** |
| IX. Explicit Decisions | Endpoint shape, no pagination, sidebar section, contract shape | Recorded with rationale + alternatives in research.md. **PASS** |

**Result**: No constitution violations. The `Complexity Tracking` table is not
needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-my-issues/
├── plan.md              # This file
├── research.md          # Phase 0 — resolved unknowns, decisions, rejected options
├── data-model.md        # Phase 1 — entities, derived concepts, contract types
├── quickstart.md        # Phase 1 — end-to-end validation guide
├── contracts/
│   └── my-issues-api.md # Phase 1 — GET /api/my-issues contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (15/15 pass)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code — File Impact Map

```text
shared/
└── index.ts                       # + MyIssue, MyIssuesOverview, MyIssuesResponse

backend/src/
├── lib/
│   └── labels.ts                  # NEW — extract buildLabelMap helper (shared with issue service)
├── services/
│   ├── issue.ts                   # refactor: use shared label helper (no behavior change)
│   └── myIssues.ts                # NEW — createMyIssuesService (aggregation + overview + sort)
├── api/
│   ├── validators/
│   │   └── myIssues.ts            # NEW — includeClosed query validator (enum, not z.coerce.boolean)
│   ├── routes/
│   │   ├── myIssues.ts            # NEW — GET /api/my-issues route
│   │   └── index.ts               # register myIssuesRoutes
│   └── routes (existing)          # untouched

backend/tests/
└── integration/
    └── my-issues.test.ts          # NEW — scope, isolation, overdue, include-closed, sort

frontend/src/
├── pages/
│   └── MyIssuesPage.tsx           # NEW — stats strip + ledger + include-closed control
├── App.tsx                        # + <Route path="my-issues" element={<MyIssuesPage />} />
├── components/
│   └── Layout.tsx                 # + PERSONAL eyebrow + "My Issues" NavLink
└── styles/
    └── components.css             # + .ledger-context, include-closed control, responsive tweaks

frontend/tests/
├── component/
│   ├── my-issues-page.test.tsx    # NEW — render, toggle, empty/error
│   └── layout.test.tsx            # extend — My Issues nav renders + activates
└── accessibility/
    └── core.test.tsx              # extend — MyIssuesPage axe scan

docs
├── VISUAL_LANGUAGE.md             # §14 sidebar, §19/20 ledger context — intentional extensions
└── README.md                      # feature list note (optional)
```

**Structure Decision**: The repository is already organized as
`backend/` + `frontend/` + `shared/` workspaces (root `package.json`). The
feature slots into that structure: backend gains one service + validator +
route module and one test file; frontend gains one page, one route, and one
sidebar link; shared gains three additive types. No new top-level structure is
introduced.

## Dependency Graph

```
shared types (MyIssue, MyIssuesOverview, MyIssuesResponse)
        │  (must build first — both workspaces import them)
        ▼
backend: myIssues service ─► api/validators/myIssues ─► api/routes/myIssues ─► routes/index
        │                                                        ▲
        └─ lib/labels (extract helper; issue.ts refactor)        │
                                                                 │
frontend: MyIssuesPage ── uses api client + shared types ◄───────┘
        ├─ App.tsx route
        └─ Layout.tsx sidebar item
        └─ components.css (.ledger-context, control)
tests: backend integration (depends on backend complete)
       frontend component + a11y + layout (depend on frontend page)
```

- Backend integration tests are blocked until the route is registered.
- Frontend page depends on the shared types and the API response shape.
- The label-helper refactor is low-risk and independent; do it first so both
  services consume the same helper.
- Sidebar, CSS, and docs are leaf work and can proceed in parallel with tests.

## Implementation Phases

Each phase is independently runnable and traceable to the spec (FR/SC
references in parentheses).

### Phase 1 — Shared Contracts

- Add to `shared/index.ts`: `MyIssue extends Issue` (`workspaceId`,
  `projectName`, `workspaceName`), `MyIssuesOverview` (`total`, `byStatus:
  Record<IssueStatus, number>`, `overdue`), `MyIssuesResponse`
  (`overview`, `items`).
- Verify: `npm run build -w shared`; `npm run typecheck -w shared`.
- *FR-005, FR-010; data-model.md.*

### Phase 2 — Backend Service + Validator

- NEW `backend/src/lib/labels.ts`: extract `buildLabelMap(db, labelIds)` from
  `services/issue.ts:65-82`; update `issue.ts` to import it (no behavior
  change).
- NEW `backend/src/services/myIssues.ts`:
  - Reachable workspace ids = union of owned + member (same query as
    `workspaceService.listWorkspaces`, research.md §1).
  - Project ids in those workspaces → join `issues` → `projects` →
    `workspaces`, `leftJoin users` (assignee identity), where
    `inArray(projectId)` **and** `eq(assigneeId, userId)`.
  - Enrich labels via shared helper (batched).
  - Derive `overdue` per row (`dueDate < today && status !== "Closed"`).
  - Sort: overdue first → dueDate asc (nulls last) → priority
    (Urgent→Low) → title (research.md §4).
  - Filter items when `includeClosed === false` to Open/In Progress.
  - Build `overview` over **all** statuses (total / byStatus / overdue).
- NEW `backend/src/api/validators/myIssues.ts`: `{ includeClosed:
  z.enum(["true","false"]).optional().default("false") }` transformed to
  boolean — never `z.coerce.boolean()` (research.md §7).
- NEW `backend/src/api/routes/myIssues.ts`: `GET /my-issues` → requireAuth →
  validate query → `200 { overview, items }`.
- Register in `backend/src/api/routes/index.ts` with `createMyIssuesService`
  (deps: `db`, `membershipService`).
- *FR-001–FR-004, FR-008, FR-010, FR-011; contracts/my-issues-api.md.*

### Phase 3 — Backend Integration Tests

- NEW `backend/tests/integration/my-issues.test.ts` (supertest, reuse
  `signupAs`/`createWorkspace`/`createProject` helpers):
  - 401 without a session.
  - Zeroed overview + empty items for a user with no workspaces.
  - Aggregation across two workspaces; overview matches fixtures; items carry
    `workspaceName`/`projectName`/`workspaceId`.
  - Overdue: past-due Open/In Progress counted; no-due-date and Closed
    excluded (FR-004).
  - Default items exclude Closed; `?includeClosed=true` includes them and the
    item count equals `overview.total` (FR-011, SC-002).
  - Isolation: a second user sees only their own assigned issues; a removed
    member no longer sees that workspace's issues (FR-001).
  - Sort order assertions (research.md §4).
  - Stat strip consistency: `byStatus.Open + "In Progress" + Closed === total`.
- Verify: `npm run test -w backend`.
- *FR-001–FR-004, FR-008, FR-011; SC-002.*

### Phase 4 — Frontend Page

- NEW `frontend/src/pages/MyIssuesPage.tsx`:
  - Fetch `api.get<MyIssuesResponse>("/my-issues")` (and
    `?includeClosed=true` when toggled); refetch on flag change via
    `useEffect` (pattern: `WorkspacePage.tsx:110-112`).
  - Layout: `page-header` → title "My Issues"; `stat-strip` with three
    `.stat-cell`s (OPEN / IN PROGRESS / OVERDUE) and a `.stat-meta` total line
    "N assigned to you"; include-closed control; then the ticket ledger.
  - Ledger: reuse `.ledger-row` markup (`data-priority`, `.ticket-key`,
    `.ledger-main`, `.ledger-meta`, `.ledger-chevron`) from
    `WorkspacePage.tsx:280-324`; each row links to
    `/workspaces/${workspaceId}/issues/${id}`; add the `.ledger-context` mono
    caption `WorkspaceName / ProjectName` before the badges.
  - Loading: `SkeletonRows` (`.stat-skeleton` + `.skeleton-list`). Error:
    existing `Alert` (`.page-alert`) with recovery (retry). Empty states:
    `EmptyState` — "No issues assigned to you" (total 0) and "No active
    issues" (active-only empty when Closed exist). All data from the response
    only (FR-008).
- Add route `my-issues` under the `Layout` route in `App.tsx`.
- *FR-002, FR-003, FR-005, FR-006, FR-009, FR-010, FR-011, FR-012.*

### Phase 5 — Sidebar Navigation

- `frontend/src/components/Layout.tsx`: add a `PERSONAL` eyebrow and a
  `NavLink` to `/my-issues` (label "My Issues", 16px stroke icon) below the
  Workspaces link and above the footer; `isActive` → `sidebar-link--active`
  (same styling as Workspaces).
- Confirm the new eyebrow inherits the existing responsive hiding at ≤1024px
  (icon rail) and ≤700px (top bar).
- *FR-007; SC-006.*

### Phase 6 — CSS + Visual-Language Extension

- `frontend/src/styles/components.css`:
  - `.ledger-context`: quiet mono caption (existing `--text-mono`,
    `--color-text-muted`/`--color-text-faint`, `font-variant-numeric:
    tabular-nums`) for the workspace/project context — same visual family as
    `.card-assignee` (components.css:1082-1090). **No new tokens.**
  - Include-closed control: small labelled checkbox row reusing `Field` +
    global focus-visible + existing coarse-pointer 44px rule. **No new
    tokens.**
  - Verify responsive: ledger rows wrap (≤700px), stat cells wrap, sidebar
    eyebrow/link behavior at ≤1024px and ≤700px.
- *FR-005, FR-011; VISUAL_LANGUAGE.md §19/20.*

### Phase 7 — Frontend Tests

- NEW `frontend/tests/component/my-issues-page.test.tsx` (mock
  `../../src/api/client.js` per the established pattern):
  - renders title, total, stat values, ledger rows with workspace/project
    context; empty state (total 0); "no active issues" state when only Closed;
    toggling "Include closed" refetches with `?includeClosed=true` and updates
    the list; error state renders the alert; data never fabricated.
- Extend `frontend/tests/component/layout.test.tsx`: My Issues NavLink renders
  and is active on the page.
- Extend `frontend/tests/accessibility/core.test.tsx`: `axe()` scan of
  `MyIssuesPage` (populated + empty); checkbox labelled; sidebar link
  keyboard-reachable.
- Verify: `npm run test:ui -w frontend`, `npm run test:a11y -w frontend`.
- *FR-007, FR-009, FR-011; SC-006.*

### Phase 8 — Documentation

- `VISUAL_LANGUAGE.md`:
  - §14 Sidebar — document the new `PERSONAL` eyebrow + "My Issues" item
    (real navigation, same `.sidebar-link` styling).
  - §19/20 Ticket Ledger — document the cross-workspace context caption
    (`.ledger-context`, mono, quiet) as the ledger extension used by
    cross-workspace surfaces.
  - Note My Issues as a new page instance of the editorial page structure
    (§37) reusing the stat strip (§17) and ledger (§19).
- `README.md` (optional): add "My Issues — cross-workspace assigned workload"
    to the Features list.
- *Constitution IX (documentation alongside code).*

### Phase 9 — Accessibility + Responsive Hardening

- Keyboard: sidebar link, ledger links, include-closed checkbox (focus
  visible). Skip-link and dialog behaviors unaffected.
- Reduced motion: no new motion beyond existing transitions.
- Responsive: ≤1024px icon rail (new eyebrow/link collapse to icon),
  ≤700px top bar + ledger wrapping + stat cell wrap, ≤375px stat stack.
- Data honesty: every rendered value comes from the response; no decorative
  counts.
- *FR-007, FR-008, FR-012; SC-006.*

### Phase 10 — Tests + Verification

- Root verification suite:
  `npm run typecheck && npm run lint && npm run build && npm test` (backend +
  frontend) and `npm run test:a11y -w frontend`.
- Confirm no regressions in `workspaces`, `issues`, `dashboard`, `labels`,
  `comments`, `projects`, `auth` integration tests and existing component/a11y
  tests.
- *Constitution V; AGENTS.md final-output requirement.*

## VISUAL_LANGUAGE.md Update Strategy

The feature **extends** the existing system; it does not introduce a new
visual language.

1. **Sidebar (§14)**: new `PERSONAL` eyebrow + My Issues nav item — reuses
   `.sidebar-link` / active petrol rule + tint exactly. Intentional evolution
   because My Issues is a real, non-workspace navigation destination.
2. **Ticket Ledger (§19/20)**: `.ledger-context` mono caption
   (`WorkspaceName / ProjectName`) for cross-workspace ledgers — quiet
   metadata, same family as `.card-assignee`; ledger row signature (edge bar,
   ticket key, title, badges, chevron) unchanged.
3. **Statistics Strip (§17)**: My Issues instantiates the strip with
   OPEN / IN PROGRESS / OVERDUE cells + a total caption line — no change to
   the strip's tokens or structure.
4. **New Page (§37)**: My Issues follows the editorial page structure
   (page-header → stat strip → ledger), the stat-strip → ruled ledger surface
   (not cards).

No new design tokens, radii, shadows, colors, or spacing values are
introduced anywhere in this feature.

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| Summary/list scope drift (SC-002) | Single response returns both `overview` and `items`; integration test asserts `byStatus` sums to `total` and item count matches with `includeClosed`. |
| Overdue definition drift | Central rule in the service; integration tests for past-due/no-due-date/Closed cases (FR-004). |
| Cross-workspace data leak | Reachable-workspace set mirrors `listWorkspaces`; `assigneeId = caller` filter; isolation tests (outsider + removed member). |
| Boolean query parsing bug | Enum validator explicitly maps `"true"`/`"false"`; rejects `z.coerce.boolean()` (research.md §7). |
| Ledger context clutter | `.ledger-context` is a quiet mono caption; responsive row-wrapping already supported; visual review checklist applied. |
| Label-helper refactor regression | Extract verbatim, same types, existing issue tests + listIssues tests guard behavior. |
| Low user data at first | Zeroed overview + empty states cover no-workspaces, no-assigned, only-closed cases (FR-009). |

## Implementation Discipline

- **Reuse over invention**: existing ledger row, stat strip, empty state,
  alert, skeleton, sidebar link, shared `Issue` type. New CSS is limited to
  `.ledger-context` and the include-closed control; no new tokens.
- **Data honesty**: no fabricated counts/navigation; all values from the
  response (FR-008).
- **Test-first for critical paths**: write the integration tests in Phase 3
  against the contract before finishing frontend work.
- **Traceability**: every phase references its FR/SC.
- **A11y is part of correctness**: keyboard paths and axe scans ship in the
  same phase as the UI (per user directive: UX up at all priorities).
- **Verification before completion**: typecheck, lint, build, full test suite,
  and visual review checklist (VISUAL_LANGUAGE.md §40).

## Final Plan Quality Check

- [x] All `NEEDS CLARIFICATION` resolved (specify Q1/Q2 + research).
- [x] Technical Context has no `NEEDS CLARIFICATION` entries.
- [x] Constitution gates evaluated pre- and post-design; no violations.
- [x] File impact map lists real paths only.
- [x] Dependency graph is acyclic and matches phase ordering.
- [x] Every phase is independently runnable and traceable to FR/SC.
- [x] VISUAL_LANGUAGE.md update strategy is scoped to intentional extensions.
- [x] Risks identified with mitigations.
- [x] Test strategy covers scope, isolation, overdue, include-closed, sort,
      empty/error, a11y, and regressions.
- [x] No new design tokens introduced.

## Report

- **Branch**: `005-my-issues`
- **Spec**: `specs/005-my-issues/spec.md`
- **Plan**: `specs/005-my-issues/plan.md`
- **Artifacts**: `research.md`, `data-model.md`, `contracts/my-issues-api.md`,
  `quickstart.md` — all generated.
- **Constitution check**: PASS (pre- and post-design). Complexity Tracking
  omitted (no violations).
- **Next**: `/speckit.tasks` to decompose into tasks; then `/speckit.implement`.