# Research: My Issues (Feature 005)

**Branch**: `005-my-issues` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

This document resolves every technical unknown for the My Issues feature and
records decisions with rationale and alternatives, per the constitution's
"Explicit Decisions" and "No Silent Assumptions" principles.

---

## 1. Scope of "workspaces the user can reach"

**Decision**: My Issues includes issues from every workspace the user can reach
under the product's existing definition — the union of workspaces the user
**owns** and workspaces where they have a **membership** row. This is exactly
what `workspaceService.listWorkspaces(userId)` already returns
(`backend/src/services/workspace.ts:36-58`, `or(eq(ownerId, userId),
inArray(id, memberWorkspaceIds))`).

**Rationale**: The sidebar's "Workspaces" list is the de-facto definition of
"my workspaces"; My Issues must not show issues from a workspace the user can
no longer reach. Since `createWorkspace` always inserts an owner membership
(`workspace.ts:32`), owned workspaces are normally also memberships, but using
the same union keeps behavior identical to the existing navigation and immune
to any future removal path. FR-001 ("workspaces the user is currently a member
of") is satisfied: the union never includes foreign workspaces.

**Alternatives considered**:
- Only `memberships` rows: simpler, and currently equivalent in practice, but
  drifts from `listWorkspaces` semantics if ownership and membership ever
  diverge. Rejected to keep a single definition of "reachable workspace".
- Asking the user to pick a workspace scope: rejected — the feature is
  explicitly cross-workspace.

## 2. Where the aggregation lives (new endpoint vs. client fan-out)

**Decision**: A single new backend endpoint `GET /api/my-issues` that computes
both the overview counts and the ledger rows server-side.

**Rationale**: The existing client fetches per-project issue lists; fan-out
across every project of every workspace (N requests, then merging, sorting,
counting, and cross-workspace filtering on the client) is complex, slow, and
would duplicate aggregation logic. The dashboard service
(`backend/src/services/dashboard.ts`) already proves the product computes
counts server-side; a read-only aggregation service fits the existing
`service → route` architecture exactly.

**Alternatives considered**:
- Client fan-out over existing `/projects/:id/issues` endpoints: rejected
  (N+1, no server-enforced cross-workspace consistency, harder to test).
- Reusing `GET /workspaces/:id/dashboard` per workspace and merging: rejected
  (still fan-out, no ledger rows, no overdue concept, no workspace/project
  context per issue).

## 3. Overdue semantics

**Decision**: Overdue is a **derived, overlapping flag**, never stored: an
issue is Overdue when it has a `dueDate` strictly earlier than today's date
and its `status` is not `Closed`. An issue with no `dueDate` is never Overdue.
The `overview.overdue` count and the sort order are both computed from this
rule. No schema change, no new status value.

**Rationale**: Spec FR-004 mandates this exact derivation and forbids storage.
`dueDate` is stored as `text("due_date")` in `YYYY-MM-DD`
(`backend/src/db/schema.ts:88`, validated at
`backend/src/api/validators/issue.ts:19-24`), so a lexicographic/string
comparison against today's `YYYY-MM-DD` is correct and timezone-safe enough for
this product (dates are date-only, no times).

**Alternatives considered**:
- SQL `date('now')` comparison in the query: viable and keeps pagination in
  SQL, but the sort needs the flag anyway and the row volume is small (a single
  user's workload), so computing in JS is simpler and testable.
- Store an `is_overdue` column: rejected — violates FR-004 and adds a
  background-maintenance problem.

## 4. Sorting

**Decision**: Sort order for the ledger: **Overdue first → due date ascending
(earliest first, no-due-date last) → priority (Urgent, High, Medium, Low) →
title (case-insensitive)**. Sorting happens in JS after enrichment, before any
pagination slicing.

**Rationale**: Spec assumption (confirmed by the user: "I don't have any
preference") — the user delegated the sort choice; this order surfaces what
needs attention first. Overdue and due date give the "what's pressing" signal;
priority then title give a stable deterministic tiebreak. JS sorting over a
small personal-workload result set is simple, avoids fragile CASE expressions
in SQL, and is directly unit-testable.

**Alternatives considered**:
- SQL `ORDER BY` with CASE mapping for priority: rejected (overdue flag + null
  handling + priority map in SQL is more machinery than needed at this scale).
- Sort by `updatedAt` descending: rejected — least useful for a workload view.

## 5. Pagination

**Decision**: No pagination for My Issues. The response is `{ overview, items }`
where `items` is the complete sorted list in the requested scope (active or
all).

**Rationale**: Constitution "Simplicity First" + scale: a single user's assigned
issues is a naturally bounded, small set, and the existing workspace page
already fetches a full issue list per project (default `pageSize` 50 is simply
ignored by the page — `WorkspacePage.tsx:72-76`). Introducing LIMIT/OFFSET plus
a paginated wrapper would force the sort to happen in SQL or before slicing for
no present user need. Documented as an explicit decision; a cap can be added
later if a user accumulates hundreds of assigned issues.

**Alternatives considered**:
- Reuse the `Paginated<T>` shape with `page`/`pageSize` like `listIssues`:
  rejected (sort must precede pagination; no UI consumes pages today).
- Server-side LIMIT with SQL sort: rejected (needs the overdue flag computed
  in SQL or a second pass; more complexity than the scale warrants).

## 6. Response contract and row shape

**Decision**: A dedicated, additive shared contract (see
[contracts/my-issues-api.md](./contracts/my-issues-api.md) and `data-model.md`):

```ts
interface MyIssuesOverview {
  total: number;                       // all assigned issues, all statuses
  byStatus: Record<IssueStatus, number>;
  overdue: number;                     // derived subset of Open/In Progress
}
interface MyIssue extends Issue {
  workspaceId: string;
  projectName: string;
  workspaceName: string;
}
interface MyIssuesResponse {
  overview: MyIssuesOverview;
  items: MyIssue[];
}
```

**Rationale**: The shared `Issue` type already carries everything a ledger row
needs (id, title, status, priority, labels, assignee, dueDate, projectId). The
only additions are the cross-workspace context required by FR-005/SC-003:
`workspaceId` (also needed for the FR-006 detail link
`/workspaces/:workspaceId/issues/:id`), plus project and workspace display
names. `overview.byStatus` retains the existing `{ Open, "In Progress",
Closed }` keys so the frontend reuses the same status-enum mapping as the
workspace stat strip; `overdue` is its own derived number so the three stat
cells are trivial to render.

**Alternatives considered**:
- Mutating the shared `Issue` type to always include workspace/project names:
  rejected — that would widen every existing issue payload for the majority of
  surfaces that do not need it.
- A flat `{ id, title, ... workspaceName, projectName }` DTO without extending
  `Issue`: rejected — extending `Issue` keeps type-safety (III) and lets the
  frontend reuse the existing ledger rendering without a parallel type.

## 7. Query flag: `includeClosed`

**Decision**: `GET /api/my-issues?includeClosed=true|false`, default `false`.
Validated as an explicit `"true"`/`"false"` enum, **not** `z.coerce.boolean()`
(which would coerce the literal string `"false"` to `true`).

**Rationale**: FR-011 default is the active-only ledger; the control is a
single boolean. Existing query validators use `z.coerce.number` for pages
(`backend/src/api/validators/issue.ts:34-35`), but boolean coercion is a known
trap, so the validator explicitly maps the enum to a boolean. The frontend
toggles the flag and refetches (`/my-issues` vs `/my-issues?includeClosed=true`).

**Alternatives considered**:
- A `status` query param (`status=Open&status=In Progress`): more general but
  invites arbitrary filter combinations the spec explicitly excludes
  (FR-011/FR-012, "minimal filter surface").
- Frontend-only filtering of a full fetch: rejected — the overview must always
  reflect all statuses while the list defaults to active, and filtering
  client-side would break the SC-002 agreement between summary and list.

## 8. Project/workspace context on the row and ledger navigation

**Decision**: The My Issues ledger reuses the existing `.ledger-row` component
with `data-priority` (edge bar), `.ticket-key`, `.ledger-main` title,
`.ledger-meta` badges, and `.ledger-chevron` (the workspace ledger markup,
`WorkspacePage.tsx:280-324`). Cross-workspace context is added as a quiet mono
caption — `WorkspaceName / ProjectName` — rendered in the `.ledger-meta`
cluster before the badges (same visual family as `.card-assignee`,
`components.css:1082-1090`). Each row links to
`/workspaces/${workspaceId}/issues/${issue.id}` (the canonical issue-detail
URL used today by `WorkspacePage.tsx:283-287`).

**Rationale**: FR-005/FR-006/SC-003 require per-row workspace+project identity
and navigation. Reusing the exact ledger markup preserves the product's
strongest visual signature (VISUAL_LANGUAGE §19-20); the mono context caption
is a minimal, quiet addition that follows the existing quiet-metadata pattern
and needs at most one new small CSS class (`.ledger-context`) built from
existing tokens — no new visual language.

**Alternatives considered**:
- Subtitle line under the title (`ledger-subtitle`): rejected — it competes
  with the issue description for the secondary line and pushes the title
  farther from the ticket key.
- A grouped/tree layout (by workspace): rejected — spec assumption "one
  unified ledger, not grouped".
- Badge-style chips for workspace/project: rejected — they would compete with
  the semantic status/priority/label badges.

## 9. Sidebar navigation structure

**Decision**: Add a second sidebar section under a new quiet eyebrow,
`PERSONAL`, containing the "My Issues" link, placed **below** the existing
`WORKSPACE` → Workspaces link and **above** the footer. The link reuses the
exact `.sidebar-link` / `.sidebar-link--active` styling (including the petrol
3px active left rule and `--color-accent-subtle` tint) and the same 16px icon
sizing (`components.css:639-680`).

**Rationale**: My Issues is cross-workspace personal workload, not a workspace
scoped surface; placing it under the existing `WORKSPACE` eyebrow would be
semantically dishonest. A `PERSONAL` eyebrow reuses the established eyebrow
pattern exactly (`components.css:629-637`) and honestly separates the two
navigation intents. FR-007 requires keyboard reachability and active state —
`NavLink` provides both. This is an **intentional sidebar evolution** and is
therefore documented in `VISUAL_LANGUAGE.md` §14.

**Alternatives considered**:
- Same `WORKSPACE` eyebrow, second link: minimal markup, but mislabels a
  cross-workspace surface; rejected.
- Renaming `WORKSPACE` to a neutral eyebrow: rejected — loses the useful
  separation and is a gratuitous change.

## 10. Closed-inclusion control styling

**Decision**: A compact labelled checkbox row under the stat strip, labeled
"Include closed", implemented with a real `<input type="checkbox">` in a small
`Field`-style row. It inherits global focus-visible (2px petrol outline) and
the coarse-pointer 44px touch-target rule; no new design token.

**Rationale**: FR-011 needs a visible, accessible control. The existing
checkbox precedent is the label-chip picker in the issue form
(`IssueForm.tsx:150-157`); a simple labelled checkbox is the lightest honest
control and trivially axe-clean. The `@media (pointer: coarse)` block
(`components.css` ~2134) already enforces 44px targets on form inputs.

**Alternatives considered**:
- A status `<select>` like the workspace filter bar: heavier than the single
  boolean, invites "All statuses" ambiguity; rejected.
- A toggle switch: new visual component with no existing precedent; rejected.

## 11. Frontend data flow and state

**Decision**: `MyIssuesPage` fetches `GET /api/my-issues` on mount and whenever
`includeClosed` changes (`useEffect` keyed on the flag, mirroring
`WorkspacePage.tsx:110-112`). Overview and items come from the **same single
response**, guaranteeing the SC-002 summary/list agreement. Loading uses
`SkeletonRows` for the stat strip (`.stat-skeleton`) and the ledger
(`.skeleton-list`); errors use the existing `Alert` page pattern; empty states
use the existing `EmptyState` component.

**Rationale**: One request per scope keeps summary and ledger consistent by
construction (FR-010, SC-002), reuses every existing feedback pattern, and
requires no new components.

**Alternatives considered**:
- Separate `/overview` + `/issues` endpoints: rejected (two round trips,
  possible drift).
- Client-side computation of overview from the ledger: rejected (counts must
  include Closed even when the default list does not).

## 12. No database migration required

**Decision**: This feature adds **no schema change and no migration**.
`issues.assignee_id` (indexed, `schema.ts:87,96`), `issues.due_date`
(`schema.ts:88`), `projects.workspace_id`, `memberships`, and the existing
label join tables are all present and sufficient. The feature is a read-only
aggregation.

**Rationale**: Constitution "Simplicity First". Verification: the 004 labels
feature's `getIssue`/`listIssues` already enrich labels and assignee identity
from these tables; the aggregation query needs only new `projects`/`workspaces`
joins on existing keys. Indexes already cover the query shape
(`issues_project_idx`, `issues_assignee_idx`, `memberships_user_idx`,
`memberships_workspace_idx`).

## 13. Testing strategy

**Decision**:
- **Backend integration** (`backend/tests/integration/my-issues.test.ts`,
  supertest against `setupApp()`, reuse `signupAs`/`createWorkspace`/
  `createProject`/`joinWorkspace` helpers from `tests/helpers.ts`): auth
  required; cross-workspace aggregation and isolation (FR-001); overview counts
  (FR-002/003); overdue derivation incl. no-due-date and Closed exclusions
  (FR-004); default active-only + `includeClosed=true` (FR-011); sort order
  (assumption); summary/list scope agreement (FR-010/SC-002); outsider 403 and
  second-user isolation.
- **Frontend component** (`frontend/tests/component/my-issues-page.test.tsx`):
  renders title/total/stats from mocked `api`; ledger rows with workspace and
  project context; empty state; toggling "Include closed" refetches with the
  query param and updates the list; error state. Mirrors the established
  `vi.mock("../../src/api/client.js")` pattern.
- **Accessibility** (`frontend/tests/accessibility/core.test.tsx`): `axe()`
  scan of `MyIssuesPage` (empty + populated), keyboard reachability of the
  sidebar "My Issues" link and the include-closed checkbox.
- **Layout/sidebar**: extend `layout.test.tsx` to assert the My Issues NavLink
  renders and activates.

**Rationale**: Constitution "Test Critical Behavior" (V) — the cross-workspace
scope and isolation are the costliest things to get wrong and are covered at
the integration level; UX (VI) is covered by axe + keyboard assertions.

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|------------|
| Workspace scope for aggregation | Union of owned + member workspaces (same as `listWorkspaces`) |
| New endpoint vs client fan-out | New `GET /api/my-issues` aggregation endpoint |
| Overdue definition | Derived: `dueDate < today && status !== "Closed"`; no due date → never overdue |
| Sort order | Overdue first → due date asc (nulls last) → priority (Urgent→Low) → title |
| Pagination | None; complete sorted list; documented explicit decision |
| Row shape | `MyIssue extends Issue` + `workspaceId`/`projectName`/`workspaceName` |
| Closed-inclusion control | `?includeClosed=true|false`, default `false`, enum-validated (never `z.coerce.boolean()`) |
| Ledger context display | Quiet mono `WorkspaceName / ProjectName` caption in `.ledger-meta` (new `.ledger-context` class) |
| Sidebar structure | New `PERSONAL` eyebrow above the footer; My Issues reuses `.sidebar-link` |
| Schema change | None — no migration |
| Tests | Backend integration + frontend component + axe + layout |

## Explicitly Rejected

- Client-side fan-out or per-workspace aggregation (fragile, N+1, no server
  consistency).
- Storing an `is_overdue` column (violates FR-004; adds maintenance).
- Pagination wrapper `Paginated<T>` (unneeded at this scale; complicates sort).
- Mutating the shared `Issue` type globally (widens unrelated payloads).
- `z.coerce.boolean()` for the query flag (coerces `"false"` to `true`).
- Grouped/tree ledger, badge chips for workspace/project, status `<select>`,
  toggle switch.
- Placing My Issues under the existing `WORKSPACE` eyebrow.