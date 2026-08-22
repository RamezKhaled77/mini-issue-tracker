# Spec 007 — Bulk Actions

## 1. Summary

Add a lightweight, single-workspace **bulk mutation** workflow to the existing ticket
ledgers. Users select multiple issues from an issue ledger and perform one of a small,
coherent set of actions at once — change status, change priority, assign/unassign to a
team member, or add/remove labels — instead of opening each issue individually.

Bulk Actions are an **additional interaction layer on top of the existing ledger**, not a
redesign. They reuse the existing issue mutation, authorization, and Activity History
systems. This is deliberately **not** a full project-management bulk-editing suite.

## 2. Motivation

- Users repeatedly apply the same status/priority/assignee/label change to several issues.
- Doing this via the issue detail page one-by-one is slow and error-prone.
- A single coherent bulk operation is faster, reduces API round-trips, and keeps the audit
  trail honest (each issue gets its own activity event).

## 3. Scope

### In scope (Stage 1)

- Native-checkbox selection of issue rows on the **Workspace** ledger and the **My Issues**
  ledger.
- **Select all visible** / **clear** controls, a **selected count**, and a compact bulk
  toolbar shown only when issues are selected.
- Five bulk actions, all **single-workspace**:
  1. Set status
  2. Set priority
  3. Assign / unassign
  4. Add labels
  5. Remove labels
- One coherent bulk mutation endpoint (`POST /api/issues/bulk`) with server-side
  authorization for **every** affected issue.
- Activity recording via the existing **Activity History** system (per-issue events).
- Full keyboard, screen-reader, and reduced-motion accessibility; functional at all
  existing breakpoints.

### Out of scope (explicitly deferred / rejected for v1)

These are kept out unless research proved them naturally supported and genuinely small
(they are not for v1):

- **Bulk move** between workspaces or projects (requires new relationships & safety).
- **Bulk edit** of title / description.
- **Bulk due-date** editing.
- **Bulk comments**, **bulk notifications**, **bulk activity grouping UI**.
- **Cross-workspace bulk mutation** (**never allowed**, see C-01/C-02 and §10).
- Saved bulk-action presets, undo history, scheduled bulk runs, background jobs,
  realtime collaboration, drag-and-drop bulk management.

## 4. Role & permission model

Roles are unchanged from the rest of the product:

- A **Workspace Member** (any `memberships` row) or the workspace **Owner** may view and
  mutate issues in that workspace.
- Individual issue mutation permissions (`membershipService.requireMember(userId,
  workspaceId)`) are reused exactly as in `IssueService.updateIssue`.

There is **no** per-role action matrix for bulk actions: any member who may edit an
individual issue may use that same mutation inside a bulk operation. Bulk never grants
more than individual mutation.

## 5. Action research & decisions

Research (Spec 006 / schema / issue service) confirmed the issue model safely supports:

| Candidate | Supported by existing model? | Decision |
|-----------|------------------------------|----------|
| Set status | Yes — `status` is a validated enum on `issues` | **Included** |
| Set priority | Yes — `priority` is a validated enum on `issues` | **Included** |
| Assign / unassign | Yes — `assign_id` on `issues`; assignee must be workspace member | **Included** |
| Add labels | Yes — `issue_labels` join table, workspace-scoped `labels` | **Included** |
| Remove labels | Yes — `issue_labels` join table | **Included** |
| Bulk delete | Supported by `DELETE /issues/:id` | **Included** (approved after Stage 1; destructive path with mandatory confirmation, D-01 rev.) |
| Bulk move (project/workspace) | Requires new relationships & re-authorization | **Deferred** |
| Bulk due date | Model supports it, but adds a sixth orthogonal action | **Deferred**, optional future |
| Bulk title/description | No repo evidence of a need; high data-collision risk | **Deferred** |
| Bulk comments | Not an issue-field mutation; separate subsystem | **Deferred** |

### Decision: action set for v1

The five selected actions map one-to-one onto the existing, individually-validated
mutation path (`IssueService.updateIssue` controls + workspace-scoped label validation).
No new database columns, relationships, or authorization concepts are required.

- `setStatus`   → value `status: IssueStatus`
- `setPriority` → value `priority: IssuePriority`
- `assign`      → value `assigneeId: string | null` (`null` = unassign)
- `addLabels`   → value `labelIds: string[]` (union with each issue's current labels)
- `removeLabels`→ value `labelIds: string[]` (subtract from each issue's current labels;
  idempotent — absent labels are ignored)

Labels are intentionally **additive / removal delta** operations for bulk (each issue may
start with different labels). This differs from the individual `updateIssue` **set**
semantics and is required for a sensible batch. The delta is applied before diffing for
activity, so the audit trail stays correct.

## 6. User stories

- **US-1** — As a workspace member viewing a project's issues, I can select several rows
  and set them all to a single status so I can close a batch of completed work without
  opening each one.
- **US-2** — As a workspace member, I can select several issues and raise them all to a
  single priority to signal urgency in one step.
- **US-3** — As a workspace member/owner, I can assign (or unassign) several issues to one
  member in one step.
- **US-4** — As a workspace member, I can add a commonly-used label to several issues at
  once.
- **US-5** — As a workspace member, I can remove a label from several issues at once.
- **US-6** — As a user on **My Issues**, I can bulk-edit issues assigned to me, but the
  selected set must belong to a single workspace (cross-workspace bulk is never allowed).
- **US-7** — As a keyboard/screen-reader user, I can select rows and run a bulk action
  without a mouse and with correct announced state.
- **US-8** — As a mobile user, I can select rows and run a bulk action at ≥44px touch
  targets with no horizontal overflow.

## 7. Functional requirements

- **FR-01** — Each issue ledger row gains a **native checkbox** (row selection control).
- **FR-02** — A **"Select all"** control toggles selection of **exactly the currently
  visible (filtered) issues** on the current loading view. See §8 for the precise
  definition.
- **FR-03** — A **"Clear selection"** control resets the selection to empty.
- **FR-04** — A **selected count** is displayed and stays truthful (derived from the local
  selection, not an estimated server total).
- **FR-05** — A **bulk toolbar appears only when at least one issue is selected**, is hidden
  otherwise, and disappears when selection becomes empty.
- **FR-06** — The bulk toolbar exposes the five actions (status, priority, assign/unassign,
  add label, remove label). Only one is chosen and applied per request.
- **FR-07** — After a successful bulk action, the affected ledgers and any statistics
  (status strip, priority metadata, overdue) are refreshed using real server data.
- **FR-08** — After a bulk action, the selection is cleared and the toolbar hides.

## 8. Selection model

- **FR-09** — Selection is an in-memory **set of issue IDs**, independent of filters, sort,
  and pagination.
- **FR-10** — "Select all" selects **only the currently visible (post-filter) issues on the
  current ledger** — **never** every issue in the workspace/database.
  - On the Workspace ledger, "visible" = the issues returned for the selected project and
    current server-side filters (within the loaded page, page size 50 default).
  - On My Issues, "visible" = the issues produced by `applyMyIssuesView` after the
    client-side search/status/priority/sort.
- **FR-11** — The "Select all" control shows an **indeterminate** state when only some of
  the visible issues are selected and acts as a toggle (select-all / clear-all-visible).
- **FR-12** — Selected rows are visually distinct without altering the row lead structure.

## 9. Filter / selection interaction

The product already filters in two places: the Workspace ledger (server-side query
`/projects/:id/issues?search&status&priority&labelId`) and My Issues (client-side
`applyMyIssuesView`). The interaction is deliberately **simple and predictable**:

- **F-01** — Filtering/search/sort changes **do not** clear the selection. Selection is a
  set of IDs independent of visibility.
- **F-02** — If a selected issue is hidden by a filter change, it **remains selected** and
  **remains a member of the bulk operation** (its ID is still in the set).
- **F-03** — **"Select all"** operates on **current visible issues only** at the moment it
  is toggled. Previously selected hidden issues are not implicitly added.
- **F-04** — Bulk actions operate on the selected **IDs regardless of current visibility**
  (the server re-validates each selected ID; it never relies on what is currently
  rendered).
- **F-05** — On My Issues, if the selected set resolves to **more than one workspace**, the
  bulk toolbar actions are **disabled** and a quiet note explains that bulk actions require
  a single workspace (the server also rejects any mixed-workspace request).

This rule set is the single source of truth for selection behavior. There is exactly one
"select all" and it means **current visible issues on the current ledger** — documented,
not approximated.

## 10. Cross-workspace & cross-project boundaries

- **C-01** — A single bulk request must target issues that all belong to **the same
  workspace**. The backend derives each issue's workspace from
  `issue.project_id → project.workspace_id` and rejects mixed sets.
- **C-02** — **Cross-workspace bulk mutation is never allowed, by construction** (server
  enforces C-01; the frontend additionally disables the toolbar on mixed-workspace
  selections).
- **C-03** — A single bulk request may span multiple **projects within the same workspace**
  only because the issue IDs already resolve there. In practice the Workspace ledger is a
  single project; My Issues may cross projects but must stay within one workspace (C-01).
- **C-04** — The backend never trusts the frontend's selection. Authorization and
  workspace resolution always run server-side for **every** selected ID.

## 11. Data model

**No schema change is required.** Bulk actions operate entirely on existing tables:

- `issues` — mutated fields: `status`, `priority`, `assignee_id`, `updated_at`.
- `issue_labels` — join rows added/removed for label actions.
- `activities` — per-issue activity events (see §15).
- `labels`, `projects`, `workspaces`, `memberships` — read for validation only.

No new columns, tables, indexes, or migrations. No shared contract is broken; only new
request/response and action types are added (§12).

## 12. API contract

The project already treats each mutation as `PATCH /api/issues/:id` (one issue) and create
as `POST /api/projects/:projectId/issues`. Rather than creating five thin bulk endpoints
(`/bulk-status`, `/bulk-priority`, ...), the API exposes **one coherent bulk endpoint**.
`POST` is used (not `PATCH`) because it targets a collection, not a single resource — this
keeps it distinct from the single-issue `PATCH` convention.

### 12.1 Endpoint

```
POST /api/issues/bulk
```

### 12.2 Shared types (additions to `shared/index.ts`)

```ts
export type BulkIssueAction =
  | "setStatus"
  | "setPriority"
  | "assign"
  | "addLabels"
  | "removeLabels";

export interface BulkIssueRequest {
  action: BulkIssueAction;
  issueIds: string[];              // 1..20, unique UUIDs
  // action-specific (exactly the one matching `action`):
  status?: IssueStatus;           // setStatus
  priority?: IssuePriority;       // setPriority
  assigneeId?: string | null;     // assign (null = unassign)
  labelIds?: string[];            // addLabels | removeLabels (1..50, unique)
}

export interface BulkIssueResponse {
  issueIds: string[];             // the issue IDs that were updated (all, on success)
  count: number;                  // issueIds.length
}
```

### 12.3 Request validation

A discriminated union (or a single schema with a required `action` plus per-action field
presence) enforces that exactly the matching value is supplied. `issueIds.length` `1..20`
is the enforced cap (perf & safety; see Performance). `assigneeId` is UUID or `null`.
`status` is `enum(ISSUE_STATUSES)`, `priority` is `enum(ISSUE_PRIORITIES)`, `labelIds` are
UUIDs, unique, `1..50` (mirrors existing label validation).

### 12.4 Response (success 200)

```json
{ "issueIds": ["<uuid>", ...], "count": <number> }
```

`issueIds` equals the input set (all-or-nothing; no partial success, see §14).

### 12.5 Error behavior (summary)

| Condition | HTTP | code |
|-----------|------|------|
| Not signed in | 401 | `UNAUTHORIZED` |
| Malformed body (bad action/values, empty `issueIds`, >20 ids, dup ids) | 422 | `VALIDATION` |
| Any `issueId` does not exist | 404 | `NOT_FOUND` |
| User not a member of an issue's workspace | 403 | `FORBIDDEN` |
| `issueIds` resolve to >1 workspace | 422 | `VALIDATION` |
| Assignee not a member of the workspace | 422 | `VALIDATION` (field `assigneeId`) |
| A label does not exist in the workspace | 422 | `VALIDATION` (field `labelIds`) |

All error responses reuse the existing `ApiErrorShape`:
`{ error: { code, message, fields? } }`.

### 12.6 Success-path semantics

On success every issue in `issueIds` was updated and **all-or-nothing** holds: either the
whole set is applied or none is. The endpoint never reports partial per-item failures in a
mixed-success body (see §14 for rationale).

## 13. Authorization / security

- **A-01** — `requireAuth` reads the authenticated session; the **actor is always
  `req.user.id`**; the frontend never supplies an actor.
- **A-02** — The backend resolves each `issueId` → `project_id` → `workspace_id`
  (`projectService.getWorkspaceIdForIssue`) and calls
  `membershipService.requireMember(userId, workspaceId)` for **every** issue — never just
  the first.
- **A-03** — All issues must resolve to the **same workspace** (C-01); otherwise 422.
  Membership is checked per issue so a hidden cross-workspace ID (even into another
  workspace the user also belongs to) is rejected.
- **A-04** — Action values are validated server-side:
  - assignee must be a **member of that workspace**;
  - labels must **exist in that workspace** (the exact workspace-scoped check that the
    Labels feature introduced — see integration test `cross-workspace isolation`); a
    foreign label is rejected with `422 + field: labelIds`.
- **A-05** — The frontend selection is **never trusted**; it is only a convenience. The
  backend independently resolves and authorizes each ID.

## 14. Transaction / atomicity

**Decision: all-or-nothing — the entire bulk operation runs in one database transaction.**

The existing mutation convention is `IssueService.updateIssue` wrapping each issue update
(plus activity) in a single `db.transaction()`. A homogeneous bulk operation (one action,
one workspace) is the natural extension: it should not introduce a second, more complex
failure model.

Concretely (pseudo):

```
function bulkUpdate(issueIds, action, value, actorId):
  // 1. resolve + authorize every issue
  require all issueIds resolve to the same workspace; else 4xx
  validate the action value once (assignee / labels)
  return db.transaction(() => {
    for each issueId:
      load issue (with labels, member check in getIssueWithLabels)
      apply action (field update or label delta)
      set updated_at
      record per-issue activity (diffing, reuse recordChanges)
  })
```

- Each issue is still membership-checked as it is modified inside the transaction.
- If any resolve/validation step throws `4xx`, **no rows change** — callers see a clean
  error, never a silent partial mutation.
- Rationale for choosing all-or-nothing over per-item partial-success:
  - Matches the existing single-transaction convention (Spec 006 provided the same
    consistency guarantee for activity).
  - A partial-success body would require inventing a new response shape and per-item
    error protocol that is not used anywhere else in the product.
  - For ≤20 homogeneous IDs in one workspace, a single short transaction is fast and
    predictable.
- **Trade-off**: with all-or-nothing, one stale/non-member ID fails the whole request.
  This is intentionally predictable; the UI pre-validates from its own ledger so this is
  rare. The 20-ID cap bounds the blast radius. Flagged in Risks.

## 15. Activity History integration

**Decision: each affected issue records its own activity event(s) using the existing
activity system — no new "group bulk" event type.**

- Bulk `setStatus` / `setPriority` / `assign` reuse the same `recordChanges` diff logic and
  emit `issue.updated` records (field/from/to) per issue, exactly as an individual
  `updateIssue` would. Bulk only reaches the `status`, `priority`, and `assignee` fields.
- Bulk label actions reuse `issue.labels_added` / `issue.labels_removed` with
  `labelIds` / `labelNames` for the actual added/removed delta per issue.
- The **actor is always the authenticated session** (`req.user.id`); it is never
  client-supplied.
- All activity writes happen **inside the same transaction** as the mutation (§14), so the
  audit trail cannot diverge from the data (same guarantee Spec 006 established).
- Grouped/bulk-level activity events are **rejected** for v1: they would require new schema,
  new rendering, and would break the flat reverse-chronological issue feed. Each issue
  simply shows its own history as if edited individually — the approach that best fits the
  existing `activities` model and `ActivityList` UI.

## 16. UX / UI requirements

- **UX-01** — Selection is an additional layer over the ledger. The ledger signature
  (priority edge bar, ticket key, title, metadata, assignee) stays intact; it is not
  restructured.
- **UX-02** — A compact selection control sits at the leading edge of each row; activating
  it never navigates to the issue detail page.
- **UX-03** — A compact **bulk toolbar** appears only while the selection is ≥1 (directly
  above or below the ledger) holding: selected count, an action select (native), an
  action-specific value control (status/priority select, assignee select + "Unassigned",
  label multi-chip picker), a primary **Apply** button, and a **Clear selection** link.
- **UX-04** — The toolbar is a **ruled bar** in the same family as `.filter-bar`, not a
  floating card or giant panel.
- **UX-05** — While idle the toolbar is absent; the page visual hierarchy (title → stats →
  ledger) is unchanged.
- **UX-06** — After a successful apply the ledger + stats refresh with real data; feedback
  is light (no modal, no animation for non-destructive actions).
- **UX-07** — The only destructive action is **bulk delete** (D-01 rev.). It is gated behind
  a coral danger trigger ("Delete…") with a quiet coral "Deleting cannot be undone." note,
  and opens the existing Dialog (focus trap, Escape, focus return) with a safe **Cancel**
  path before any request is sent. Non-destructive actions apply without a dialog.

## 17. Visual language requirements

Bulk Actions must feel like a natural extension of the **Ticket Ledger** (§19 of
`frontend/VISUAL_LANGUAGE.md`), never a generic admin-table makeover.

- **VL-01** — The ledger row keeps its anatomy: `::before` priority edge bar, `.ticket-key`,
  `.ledger-main` (title/subtitle), `.ledger-meta` badges, `.ledger-chevron`. Selection adds a
  compact control at the leading edge (before the ticket key), not a redesign.
- **VL-02** — Selected rows get a **selected treatment** using existing tokens only —
  petrol-tinted background/border (e.g. `--color-accent-subtle` background with
  `--color-accent-border`), preserving the priority edge bar and hairline rules. Coral is
  **not** used for selection.
- **VL-03** — The **bulk toolbar** is a ruled bar reusing the `filter-bar` anatomy
  (hairlines top/bottom, paper surface, compact padding, functional mono labels/count), not
  a floating panel or card.
- **VL-04** — Selection controls use native controls (checkbox/select) styled with existing
  tokens; no new colors, gradients, radii, shadows, or motion values.
- **VL-05** — The selected count is a quiet mono/tabular figure, consistent with `.filter-count`.
- **VL-06** — Destructive language (coral) is absent in v1; **Apply** is the existing primary
  `Button` (petrol).
- **VL-07** — When nothing is selected the toolbar is not rendered; no placeholder chrome.

Because this introduces a genuinely new interaction layer (row selection + bulk toolbar),
the implementation phase **must document it in `frontend/VISUAL_LANGUAGE.md`** (a new
section reusing §19 and filter-bar terminology).

## 18. Accessibility requirements (WCAG AA baseline)

Selection must be fully keyboard accessible and preserve every existing a11y contract
(skip-link, `:focus-visible`, Dialog focus trap, Escape, reduced-motion, ARIA).

- **AX-01** — Row selection uses **native `<input type="checkbox">`** with an accessible
  name (issue title or "Select <title>"). Native checkboxes give Tab + Space and correct
  semantics for free.
- **AX-02** — **Select all** is a native checkbox labelled "Select all visible issues",
  supports **indeterminate** state (via ref), and reflects selection of visible issues only.
- **AX-03** — The **selected count** is announced via `aria-live="polite"` (`role="status"`)
  on the toolbar.
- **AX-04** — Rows remain natively focusable; row selection never routes through the row
  link. Checkbox `onChange` stops propagation so it does not navigate.
- **AX-05** — Toolbar controls use existing `Field` (labelled) + `Button`/native select
  patterns; focus-visible rings preserved.
- **AX-06** — Bulk delete is the only destructive action and always requires the existing
  Dialog confirmation (focus trap + Escape + focus return) with a safe **Cancel** path;
  the confirm button uses the coral `btn--danger` variant. Non-destructive actions open no
  dialog.
- **AX-07** — `prefers-reduced-motion` respected (toolbar appears/disappears; the existing
  120ms color transitions already honor reduced-motion in `base.css`).
- **AX-08** — Toolbar controls and row-navigation links have distinct, unique accessible
  names (independently tabbable).
- **AX-09** — Result feedback (success/error) is a bounded polite message; server errors
  reuse `Alert`.

## 19. Responsive requirements

Bulk selection must work at every existing breakpoint and must not shrink desktop controls
blindly. Breakpoints from `VISUAL_LANGUAGE.md`: ≥1280, 1024–1280 (icon rail), 900–1024,
700–900, ≤700 (top bar), ≤599, ≤375.

- **RP-01** — Row selection control is shown at all widths (primary interaction).
- **RP-02** — **44px touch targets** on coarse pointers for row checkboxes, select-all,
  Apply, and Clear (register new controls under the existing `@media (pointer: coarse)` rule).
- **RP-03** — The bulk toolbar **flex-wraps** like `.filter-bar` (stacks to a column at
  ≤375) so it never overflows horizontally.
- **RP-04** — Ticket keys and important metadata are preserved; the toolbar never hides them.
  The row wraps its meta (`flex-wrap`) exactly as today.
- **RP-05** — On ≤700 (mobile top bar) and icon-rail/tablet, the toolbar remains one compact
  ruled bar above/below the ledger — no drawer, no floating panel.
- **RP-06** — No horizontal ledger overflow from the added selection column (fixed-width
  checkbox, remaining content flexes).

## 20. Error behavior

- **EB-01** — Client-side pre-validation disables **Apply** until the action and its value
  are valid (e.g. the value select would be empty).
- **EB-02** — Server 422/403/404 errors surface in the existing `Alert` / `FormAlert`
  pattern with the surfaced `message` + relevant `fields`; no fabricated per-item detail is
  invented.
- **EB-03** — Because it is all-or-nothing, a failing request leaves the ledger unchanged;
  the toolbar stays open with the user's selection/values so they can correct and retry.
- **EB-04** — During Apply the button is disabled ("Applying…") and a second request cannot
  be issued for the same selection (no double-submit).

## 21. Data integrity

- **DI-01** — Bulk never fabricates counts: the selected count is the length of the local
  selection; the response `count` is the server-authoritative updated total.
- **DI-02** — All-or-nothing prevents partial row state (e.g. status changed but label not)
  on error.
- **DI-03** — `updated_at` is bumped for every changed issue (matches `updateIssue`).
- **DI-04** — Label deltas are idempotent: `addLabels` of an already-present label is a
  no-op; `removeLabels` of an absent label is a no-op.
- **DI-05** — Activity events always match final data (written in the same transaction).

## 22. Performance

- **PF-01** — One request for the whole bulk; **no per-issue HTTP fan-out**, no N+1
  selects. Issue lists are modest and the cap bounds work.
- **PF-02** — **Cap `issueIds` at 20 per request** (a configurable constant). Above that the
  API returns `422 "Too many issues for one bulk action."` This keeps the transaction short
  and the error blast-radius bounded.
- **PF-03** — Backend uses batched selects (`inArray`) for issue + workspace resolution and
  label existence, then runs the transaction. Per-issue membership uses cached workspace
  resolution where safe.
- **PF-04** — The Workspace ledger loads its current page (default page size 50). Bulk
  operates on the loaded visible rows; additional pagination improvements are out of scope.
- **PF-05** — Expected list sizes are small (single project/workspace); no background jobs
  or queueing are required.

## 23. Non-functional requirements

- **NFR-01** — No new backend or frontend dependency.
- **NFR-02** — Compliance with the project `AGENTS.md` and `frontend/VISUAL_LANGUAGE.md`
  (no new design language; extend the ledger).
- **NFR-03** — All mutating paths (individual & bulk) share the same authorization and
  activity guarantees.
- **NFR-04** — Type safety: new shared types exported and consumed by backend + frontend;
  `npm run typecheck` clean.
- **NFR-05** — Response shape stable, documented, backward compatible (only additions to
  shared types; no changes to existing responses).

## 24. Testing requirements

### Backend — integration (`backend/tests/integration/`)
- A new `bulk-issues.test.ts` (or additions to `issues.test.ts`):
  - success: `setStatus` / `setPriority` / `assign` / `addLabels` / `removeLabels` across a set.
  - assign unassign (`assigneeId: null`).
  - all-or-nothing: include one non-existent id → entire request 404, **no** partial rows
    changed (assert a control issue unaffected).
  - mixed-workspace selection → 422; cross-workspace isolation preserved.
  - assignee from another workspace → 422 (field `assigneeId`).
  - label from another workspace → 422 (field `labelIds`); duplicate ids rejected.
  - >20 ids → 422.
  - activity: each issue produced `issue.updated` / `issue.labels_*` rows; no-op fields emit
    no activity.

- Backend unit (`backend/tests/unit/`): `bulk-validators.test.ts` for the discriminated-union
  schema (each action requires its own value; rejects unknown action / duplicates / cap).

### Frontend
- Pure selection-helper unit test (`bulk-selection.test.ts`): toggle, select-all
  (visible-only), clear, count, workspace-grouping.
- Component tests (Workspace & My Issues): checkbox toggles selection without navigating;
  select-all / indeterminate; selected count; toolbar appears/disappears; Apply calls
  `api.post('/issues/bulk', …)` once; error surfaces in `Alert`; My Issues mixed-workspace
  disables the toolbar.
- Accessibility (`frontend/tests/accessibility/core.test.tsx`): axe-clean ledger + toolbar;
  select-all accessible name; `aria-live` count.

## 25. Acceptance scenarios

- **AS-1** — Two Open issues selected → set to In Progress → both update in the ledger and
  stats; each shows an `issue.updated` status event; selection clears.
- **AS-2** — Three Medium issues → set to Urgent → all update; priority metadata/stats refresh.
- **AS-3** — Two unassigned issues → assign to a member → both show that assignee; unassign
  sets both back to null.
- **AS-4** — Add a shared label to three issues → all three carry the label; a `+N more`
  overflow still renders.
- **AS-5** — Remove a label → it disappears from all selected issues; removed-label activity
  recorded.
- **AS-6** — Select "all visible", apply a filter, then run a bulk action → the originally
  selected (now partially hidden) IDs are still affected (per selected-ID semantics).
- **AS-7** — On My Issues, select all but one in a second workspace → toolbar actions
  disabled with the quiet single-workspace note.
- **AS-8** — Keyboard: Tab through checkboxes / Select-all / Apply; Space toggles; count
  announced; axe has no violations.
- **AS-9** — ≤375px mobile: no horizontal overflow, 44px targets, toolbar stacked.
- **AS-10** — Mixed-workspace API call → 422 and **no partial mutation** (all-or-nothing).

## 26. Success criteria

- Bulk reduces a batch of edits to one request + one response with all-or-nothing safety.
- Existing individual issue mutation and Activity History behavior is unchanged.
- No schema migrations; one new endpoint; no new visual language (ledger extended only).
- All existing tests pass; new tests cover contract, auth, atomicity, activity, selection,
  a11y, and responsive.

## 27. Explicit decisions

- **D-01 — Bulk delete is INCLUDED** (revised after Stage 1 operator approval).
  It runs through the same all-or-nothing transaction, authorizes every issue, and is
  destructive-gated in the UI: choosing **Delete** turns the toolbar trigger coral
  (`btn--danger`) with a quiet coral "Deleting cannot be undone." note, and Apply opens the
  existing Dialog (focus trap, Escape, focus return) with a safe **Cancel** path before any
  request is sent. Per-issue `issue.deleted` activity is recorded, mirroring single delete.
- **D-02 — One coherent endpoint** `POST /api/issues/bulk`, not five per-action endpoints.
- **D-03 — Selection is a persistent ID-set** independent of filters; "Select all" = current
  visible issues only.
- **D-04 — Single-workspace per request**; cross-workspace bulk never allowed (server-enforced).
- **D-05 — All-or-nothing transaction**; no partial-success body.
- **D-06 — Per-issue activity events** reusing the existing `recordChanges`/label helpers; no
  "group bulk" activity type.
- **D-07 — 20-ID cap** per request (perf/safety).
- **D-08 — Visual extension**; ruled bars, native controls, petrol Apply, no new design
  language.

## 28. Open questions (require operator approval)

- **Q-01** — Bulk delete: **RESOLVED — approved and implemented** (see D-01 rev.).
- **Q-02** — Should the cap be `20` or higher (e.g. `50`)? It is configurable; confirm default.
- **Q-03** — On My Issues, a mixed-workspace selection disables the toolbar (recommended). A
  future "auto-group-by-workspace" is scoped out but flagged for consideration.
- **Q-04** — Lightweight **undo**: deferred in plan (out of scope), but worth a product
  decision; bulk operations are not trivially reversible.

## 29. Out of scope (consolidated)

Bulk move between workspaces/projects, bulk edit title/description, bulk
due-date, bulk comments, bulk notifications, bulk activity grouping, cross-workspace bulk,
saved presets, undo history, scheduled jobs, background workers, realtime, drag-and-drop.