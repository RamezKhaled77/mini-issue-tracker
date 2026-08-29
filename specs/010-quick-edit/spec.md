# Spec 010 — Quick Edit

## 1. Summary

Quick Edit lets a workspace member change one small field of an issue — status,
priority, assignee, labels, or due date — directly from the issue ledger, without
opening the Issue Detail page. Each editable value in a ledger row becomes a compact,
progressive control: the row stays calm until the user targets a field, a small
selector opens, the change is submitted through the **existing** `PATCH /issues/:id`
endpoint, and the row returns to its normal state.

This is deliberately small. Quick Edit is **not** a full edit form in the ledger, not
inline title/description editing, not a spreadsheet, and not a new mutation system. It
reuses the exact mutation path the IssuePage and Bulk Actions already use, so activity
history, authorization, and validation behave identically.

> Core principle: **Quick Edit is for small, frequent field changes — not full issue
> editing.** The ledger remains a reading surface; editing appears only on demand.

## 2. Motivation

The ledger is already the main work surface. Today, changing an issue's status means:
open issue → find the form → change a select → save → navigate back. For a change that
takes two seconds of intent, that is five steps of friction. Repeated across a triage
session, it dominates the workflow.

Quick Edit collapses that to: *see the row → click the value → pick the new one → done.*

The feature answers one question:

> "How do I change just this one thing, right here, without losing my place?"

## 3. Research findings (implementation-grounded)

### 3.1 The backend already fully supports partial updates

`PATCH /api/issues/:id` (`backend/src/api/routes/issues.ts:55-62`) validates with
`updateIssueSchema = createIssueSchema.partial()`
(`backend/src/api/validators/issue.ts:26`) — every field is optional. The service
(`backend/src/services/issue.ts` `updateIssue`, lines 245-281):

- authorizes via `getIssueWithLabels(issueId, userId)` → `requireProjectMember`
  (workspace-membership check; 404 for missing/inaccessible issues);
- validates `assigneeId` against workspace membership and `labelIds` against
  workspace-owned labels (422 with field errors otherwise);
- applies only the provided fields inside a transaction, always bumping `updatedAt`;
- replaces the label join set wholesale when `labelIds` is provided;
- records activity via `recordChanges(existing, after, userId)` — status, priority,
  assignee, due date, title, description changes each produce an `issue.updated`
  activity record, and label diffing produces `issue.labels_added` /
  `issue.labels_removed` records.

**Conclusion: no backend changes are required for Quick Edit.** Every candidate field
already has a validated, authorized, activity-recording mutation path. Bulk Actions
(Spec 007) deliberately reuses this same path (`bulkUpdate` calls the same validation
and `recordChanges`), proving the pattern.

### 3.2 Activity recording is complete for all candidate fields

`recordChanges` compares before/after for `status`, `priority`, `assigneeId`,
`dueDate` (plus title/description) and diffs label id sets. A Quick Edit mutation
therefore produces **identical** activity semantics to an IssuePage edit — because it
*is* the same call. No gap exists; nothing new must be recorded.

### 3.3 The ledger row is a single `<Link>` — the central UI constraint

Both ledgers render rows identically:

- `WorkspacePage.tsx:466-517`: `li.ledger-item` → `span.ledger-select` (checkbox) →
  `Link.ledger-row` containing `ticket-key`, `ledger-main` (title/subtitle),
  `ledger-meta` (Overdue badge, status badge, priority badge, up to 2 label badges,
  `+N more`, assignee `card-assignee`), `ledger-chevron`.
- `MyIssuesPage.tsx:320-375`: same anatomy plus a `ledger-context`
  (workspace / project) caption. `MyIssuesPage` has no `members`/workspace-scope
  guarantee for a single row beyond `issue.workspaceId`.

Because the whole row is one link, **interactive controls cannot simply live inside
it** (nested interactive elements break HTML semantics, keyboard behavior, and axe).
The implementation must restructure the row minimally: the `ledger-main` + chevron
remain the navigation link, while editable metadata moves into sibling interactive
spans — preserving the visual signature (edge bar, key, title, meta run, chevron,
ruled rows) exactly.

### 3.4 Metadata needed by Quick Edit is already in the ledger payload

`listIssues` returns per issue: `id, status, priority, assigneeId, assignee {id,
name}, labelIds, labels[{id, workspaceId, name, color}], dueDate`. `WorkspacePage`
already fetches `members` (for BulkToolbar and IssueForm) and workspace `labels`.
`MyIssuesPage` already fetches `members` and `wsLabels` for BulkToolbar. **No new
metadata fetch is required for status, priority, assignee, or labels.**

### 3.5 Due date is shown, not editable, today

Neither ledger renders the due date as a control (only the derived Overdue badge via
`frontend/src/lib/isOverdue.ts`). The IssueForm uses a native
`<input type="date">` (`IssueForm.tsx:130`), and the backend accepts `YYYY-MM-DD` or
null. A native date input is the only date UI that exists; reusing it keeps the
system coherent.

### 3.6 Optimistic UI does not exist

All mutations in the app are await-then-refetch (`IssueForm.onSubmit` → parent
refetch; `BulkToolbar` → `handleBulkApply` → refetch; Saved Views → refetch). There
is no cache/invalidation layer. Quick Edit must follow the same **await-then-update**
convention — no optimistic updates, no new state architecture.

### 3.7 Error display conventions

`ApiError` (frontend `api/client.ts`) carries `fields` for 422 validation errors and
a message otherwise. `Alert` with `role="alert"` is the established error surface
(form alerts, page alerts, bulk errors). Field-level errors render under `Field`.

### 3.8 The existing Select is a native `<select>`

Status/priority/assignee pickers throughout the app are native selects inside `Field`
wrappers (`IssueForm.tsx:112-142`, `filter-bar` selects). Native selects give free
keyboard support, mobile picker sheets, and `aria` semantics. A custom listbox would
be a new component with new a11y obligations — unnecessary here.

## 4. Scope decision — supported fields

| Field | In v1 | Rationale |
|---|---|---|
| Status | **Yes** | The single most frequent triage change. Backend enum + activity already exist. Native `<select>` with `ISSUE_STATUSES` reuses the IssueForm model exactly. |
| Priority | **Yes** | Same shape as status; `ISSUE_PRIORITIES` enum; native select. |
| Assignee | **Yes** | Members list is already loaded on both pages (BulkToolbar). Native select with `Unassigned` option, identical to IssueForm. |
| Labels | **Yes** | Labels list already loaded on both pages. Reuses the IssueForm checkbox-chip picker (`label-picker` / `label-chip`) inside a small popover-style surface. |
| Due date | **Yes** | Native `<input type="date">` in a small popover; identical validation (`YYYY-MM-DD` or empty → null) as IssueForm. Overdue badge must recompute after change (it already derives from `dueDate` + `status`, so a refetch handles it). |
| Title | No | Text editing does not fit a compact row control; belongs to IssuePage. Explicitly out of scope. |
| Description | No | Multi-line editing; belongs to IssuePage. |
| Project transfer | No | Not supported by the update endpoint at all; out of scope. |
| Comments / Activity | No | Read/write surfaces of IssuePage. |

## 5. Who can Quick Edit?

Exactly whoever can already update the issue: any authenticated **member of the issue's
workspace** (via `requireProjectMember`). No new permission model. A user gains no
privilege from acting in the ledger — a 404/403 from the API is surfaced as a row-level
error exactly as the IssuePage surfaces it. Non-members see the ledger of projects they
cannot reach at all today, so no visibility change occurs.

## 6. Goals

1. Change status, priority, assignee, labels, or due date from any ledger row without
   navigating away.
2. Produce byte-identical activity history to an equivalent IssuePage edit.
3. Keep the ledger visually calm — progressive disclosure, no permanently editable
   rows, no hover toolbars.
4. Reuse the existing PATCH endpoint, native selects, label chips, date input,
   Dialog/Alert patterns, and refetch convention with zero backend changes.
5. Full keyboard and screen-reader operation with visible focus and 44px touch
   targets.
6. Preserve the Ticket Ledger signature (edge bar, key, title, meta, chevron, rules).

## 7. Non-goals

- Inline title/description/comment editing.
- A full IssueForm inside a ledger row.
- Bulk editing through Quick Edit (Bulk Actions already owns multi-issue changes).
- Optimistic updates, undo, autosave, offline editing, realtime conflict resolution.
- Drag-and-drop, spreadsheet UI, custom listbox/menu components.
- A new mutation framework or state library.
- Adding assignee/overdue filter predicates (unrelated to editing).

## 8. User stories

1. As a member, I click the **status badge** on a ledger row, choose "In Progress",
   and the row updates in place — I never left the list.
2. As a member, I click the **priority badge**, pick High, and the row's edge bar and
   badge change immediately.
3. As a member, I click the **assignee chip**, pick a teammate (or Unassigned), and
   the avatar/name updates.
4. As a member, I click a **label badge** (or an "add label" affordance), toggle chips
   in the label picker, confirm, and the row's badges refresh.
5. As a member, I click the **due-date** area, pick a date in the native date input,
   confirm, and the Overdue badge appears/disappears correctly.
6. As a member, I press Escape mid-edit and the row returns to its previous state with
   nothing submitted.
7. As a keyboard user, I Tab to an editable field, press Enter/Space to open it, pick
   with arrows/Enter, and focus returns to the field afterwards.
8. As a member on a phone, I tap a value and get a usable picker with ≥44px targets.

## 9. Explicit decisions

- **D-01 — No backend changes.** `PATCH /issues/:id` already supports every field,
  validates them, authorizes them, and records activity. Quick Edit sends a minimal
  partial body (e.g. `{ "status": "In Progress" }`, `{ "labelIds": [...] }`,
  `{ "dueDate": null }`).
- **D-02 — Await-then-update, no optimistic UI.** The control enters a busy state,
  the PATCH resolves, the page refetches (existing convention), the row re-renders.
  Matches IssueForm and BulkToolbar exactly.
- **D-03 — Native controls over custom popovers.** Status/priority/assignee use a
  native `<select>` revealed in place (styled to read as a badge-sized control that
  expands, per §14). Labels and due date use a small anchored surface containing the
  existing `label-picker` checkboxes / a native date input, closed via Confirm or
  Escape. No custom listbox component is created.
- **D-04 — The row link is restructured, not nested.** `ledger-main` and the chevron
  become (or remain) the navigation `<Link>`; editable metadata controls are siblings
  of the link inside `ledger-item`, visually indistinguishable from today's meta run.
  The checkbox stays a sibling as it already is. No nested interactive elements.
- **D-05 — Progressive disclosure.** In the resting state the row renders exactly as
  today (badges, not buttons — with `data-quickedit` hooks and focusable buttons
  styled as badges). The row gains a quiet "editable" affordance on row hover/focus
  within (underline/dotted cue on editable values); the compact control appears only
  when a value is activated. The ledger never looks like a form.
- **D-06 — One edit at a time.** Opening a control closes any other open control
  (including across rows on the same page). Only one field of one row is ever in edit
  state.
- **D-07 — Labels submit as the full new set.** The picker toggles a working copy of
  `labelIds`; Confirm PATCHes the complete array (matching the endpoint's replace
  semantics). Cancel discards the working copy.
- **D-08 — Errors are row-local.** A failed mutation shows a compact `Alert`
  (`role="alert"`) anchored to the row (or the open control), the control stays open
  with the previous committed value preserved, and focus moves to the error. No toast
  system is introduced; no silent failure.
- **D-09 — Empty/null semantics match IssueForm.** Assignee `""` → `assigneeId`
  omitted → backend treats as null (unassign) exactly as IssueForm does; empty due
  date → `dueDate: null`.
- **D-10 — Both ledgers get Quick Edit (Workspace + My Issues).** Identical row
  anatomy; both already load members and labels. My Issues rows carry
  `issue.workspaceId` so the correct workspace's labels/members are resolvable
  (both pages already fetch per-workspace or reachable sets used by BulkToolbar).
- **D-11 — Concurrency is last-write-wins.** No locking, no versioning. If the issue
  changed server-side meanwhile, the field-level PATCH still applies; activity records
  both actors' changes truthfully. If the issue was deleted, the API returns 404 and
  the row shows the error and is removed on the next refetch.
- **D-12 — Duplicate rapid submissions.** While a mutation is in flight the control is
  disabled (`aria-busy`); further activations are ignored.

## 10. Data model requirements

None. No schema, migration, or shared-contract additions. The feature consumes
existing types: `Issue`, `Label`, `ISSUE_STATUSES`, `ISSUE_PRIORITIES` from
`@mini-issue-tracker/shared`.

## 11. API requirements

Existing endpoints only:

- `PATCH /api/issues/:id` with a partial body subset of
  `{ status?, priority?, assigneeId?, labelIds?, dueDate? }`. Response:
  `{ issue }` (the updated issue).
- Option data comes from data already in the page: workspace `labels`
  (`GET /workspaces/:id/labels`) and `members` (`GET /workspaces/:id/members`) —
  both already fetched by both ledger pages; **no new requests**.

No new routes. No shape changes.

## 12. Security / authorization requirements

- Server-side only: unchanged `requireProjectMember` on every PATCH; assignee must be
  a workspace member; labels must belong to the workspace; 404 for inaccessible
  issues; 401 when unauthenticated. Quick Edit is a UI affordance over the same
  contract — tested for cross-workspace isolation exactly like the existing
  `issues.test.ts` coverage.

## 13. UI requirements

1. Ledger rows render status, priority, assignee, and labels as quiet editable
   controls (badge-styled buttons with accessible names like
   `"Change status, currently Open"`); due date gains a compact editable chip shown
   next to the meta run (its absence today is a gap this feature fills — the chip
   shows the date or `Due` placeholder, never fabricated).
2. Activating a control opens the D-03 selector in place; the rest of the row is
   inert; the row keeps its edge bar and overdue treatment.
3. Selecting a value submits immediately (status/priority/assignee); labels/due date
   confirm via a small Apply/Cancel pair; Escape cancels.
4. On success the page refetches and the row re-renders with new values; the active
   view/filters/pagination are preserved (client-side refetch only — filters are
   component state, unchanged by a mutation).
5. Selection checkboxes and bulk behavior are untouched; a Quick Edit interaction
   must not toggle selection and must not navigate.
6. Overdue recomputation is automatic (derived from refetched `dueDate`/`status`).
7. IssuePage and IssueForm are unchanged.

## 14. Visual language requirements

- Reuse existing tokens exclusively: badge tones, `--color-accent` (petrol) for the
  interactive/active cue, `--border-hairline`, paper surfaces, existing spacing and
  type scale. No new colors, radii, shadows, or fonts.
- The editable cue at rest is a **dotted underline in currentColor at reduced
  opacity** on hover/focus-within of the row — typography, not decoration. No color
  change of semantic badges.
- An open control is signalled by a petrol hairline ring (`:focus-visible` standard)
  plus the control's own surface — not by elevation or shadows beyond the existing
  popover/dialog treatment if any exists (prefer flat surfaces with hairline
  borders).
- Row height/ruled rhythm must not shift when a control opens (overlay/anchored
  surface, not in-flow expansion, where practical; if in-flow, the row may grow but
  rules stay aligned).
- If the implementation introduces a genuinely new reusable pattern (e.g. the
  "badge-styled inline editor"), document it in `VISUAL_LANGUAGE.md` during
  implementation with structure, tokens, states, responsive behavior, and reuse
  rules.

## 15. Responsive requirements

- Desktop / ≤1024px: inline controls as described; meta run wraps via existing
  `.ledger-row { flex-wrap: wrap }` behavior at ≤700px.
- ≤700px / ≤375px: controls remain inline but grow to ≥44px hit height
  (`min-height` on interactive elements under a coarse-pointer / narrow media
  query); the label picker and date surface span the row width; no horizontal
  overflow; ticket key and title hierarchy preserved.
- Native selects/date inputs invoke the platform picker on mobile — acceptable and
  preferred.
- No duplicate navigation or hidden information at any breakpoint.

## 16. Accessibility requirements

- Each editable value is a real `<button>` (or `select` when open) with an accessible
  name including field + current value; no color-only or hover-only affordances.
- Keyboard: Tab reaches editable fields in row order; Enter/Space opens; select
  keyboard behavior is native; Escape cancels and returns focus to the trigger;
  label/date surfaces trap focus via the existing Dialog when implemented as one, or
  provide Escape + focus return at minimum; focus moves to the error on failure.
- 44px coarse-pointer targets; visible focus everywhere; reduced-motion respected
  (no new animations beyond existing transitions).
- axe coverage extended for the ledger with Quick Edit in resting, open, error, and
  busy states.

## 17. Error handling

| Case | Behavior |
|---|---|
| Unauthenticated (401) | Row-level Alert with the API message; control closes to previous value. |
| Unauthorized / issue inaccessible (404) | Row-level Alert "Issue not found"; row removed on refetch. |
| Deleted during edit (404) | Same as above; no retry. |
| Invalid status/priority (422) | Not reachable via fixed enums, but if returned: field error shown in the row Alert; previous value preserved. |
| Assignee not a member (422) | Row Alert with backend field message; picker reopens on the assignee field with the committed value. |
| Inaccessible/invalid label (422) | Row Alert; working label set reset to committed value. |
| Invalid due date (422) | Field error in the date surface (client also pre-validates format). |
| Network failure / timeout | Row Alert with generic message; previous value preserved; control usable for retry. |
| Duplicate rapid submissions | Disabled while busy (D-12). |
| Membership changes mid-session | Server is the authority; 404/422 surfaced per above. |

## 18. Activity / history integration

Inherited, not implemented: every Quick Edit PATCH flows through `updateIssue` →
`recordChanges`, producing `issue.updated` (status/priority/assignee/due_date) and
`issue.labels_added`/`issue.labels_removed` records identical to an IssuePage edit.
Tests must assert activity equivalence (same records for the same change regardless
of entry point). No separate activity path exists or may be created.

## 19. Performance

- Zero additional network requests for option data (§11).
- One PATCH per confirmed change; one list refetch per successful change (existing
  convention).
- No new global state; edit state is local to the page (a single
  `quickEdit: { issueId, field } | null` value).
- Ledger render cost unchanged at rest (buttons replace spans; same DOM depth).

## 20. Testing requirements

**Backend (verification only — no changes expected):** existing `issues.test.ts`
already covers partial updates, authorization, validation, and activity; add
cases only if gaps are found for single-field PATCHes of each Quick Edit field and
activity generation per field.

**Frontend:**
- Editable fields render with accessible names; resting row matches current visuals.
- Open/select flows for status, priority, assignee; label toggle + confirm; date
  confirm + clear.
- Successful mutation refetches and updates the row; overdue badge recomputes.
- Error path: API failure shows row Alert, preserves value, restores focus.
- Escape cancels with no request; busy state disables resubmission.
- No navigation on control click; selection checkbox unaffected.
- Focus returns to trigger after close.

**Accessibility:** axe on ledger (resting, open, error, busy); keyboard walkthrough;
coarse-pointer target assertions where practical.

## 21. Acceptance scenarios

1. Change status from the Workspace ledger → row badge updates, activity shows
   `issue.updated status Open → In Progress`.
2. Change priority on My Issues → edge bar and badge update.
3. Assign then unassign an issue → assignee chip appears then clears; activity
   records both.
4. Add and remove a label in one edit → one PATCH, both activity records.
5. Set a past due date → Overdue badge appears; clear it → badge disappears.
6. Escape mid-edit → nothing submitted, focus restored.
7. Simulate 422 → row Alert, value preserved.
8. Keyboard-only full edit of a status → completes without mouse.
9. 375px viewport → no overflow, ≥44px targets, row hierarchy intact.

## 22. Success criteria

- Any Quick Edit field can be changed from either ledger in under 3 interactions.
- Activity history is indistinguishable from IssuePage edits.
- Zero backend changes shipped.
- Ledger resting visuals unchanged (diff-limited to affordance cues and the new due-
  date chip).
- All existing tests, typecheck, lint, build, and axe suites pass.

## 23. Assumptions

- Native selects and the native date input are acceptable UX (consistent with the
  rest of the product).
- Refetch-after-mutation remains acceptable for freshness (no cache layer exists).
- `members`/`labels` already fetched on both pages suffice (no per-row fetching).
- My Issues `wsLabels`/`members` are fetched for the reachable workspace set and are
  adequate for row editing (verify during Phase 0 of the plan; if a row's workspace
  labels are not resolvable, restrict My Issues label Quick Edit to workspaces whose
  labels are loaded — surfaced honestly, never fabricated).
- **Implementation addendum (Spec 010)**: on My Issues, `members`/`wsLabels` are only
  fetched when the selection/filter resolves to a **single** workspace
  (`singleWorkspaceId`). Rows whose `workspaceId !== singleWorkspaceId` render their
  label badges and assignee chip **read-only** (plus a read-only `+N more` where
  applicable) instead of fabricating option data; status/priority/due-date Quick Edit
  remain available on every row. Recorded in `frontend/src/pages/MyIssuesPage.tsx`.

## 24. Open questions (require operator approval)

- Q-01: Confirm all five fields are in v1, or trim due date / labels for a smaller
  first slice.
- Q-02: Confirm the due-date chip may be *added* to the row meta (it does not exist
  today) vs. deferring due-date editing entirely.
- Q-03: Confirm the row-link restructure (D-04) — the only structural DOM change to
  the ledger signature.
- Q-04: My Issues scope: ship Quick Edit on both ledgers (D-10) or Workspace ledger
  only for v1 (smaller risk; My Issues row → workspace data resolution needs
  verification).

## 25. Out of scope (consolidated)

Inline title/description/comment editing; full form in rows; project transfer;
drag-and-drop; spreadsheet UI; bulk editing via Quick Edit; optimistic updates; undo;
autosave; offline; realtime; custom listbox/menu/date components; new state
libraries; new backend endpoints, schema, or contracts.
