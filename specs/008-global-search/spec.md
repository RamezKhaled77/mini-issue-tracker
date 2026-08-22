# Spec 008 — Global Search

## 1. Summary

Add a fast, focused **issue search** experience that spans every workspace the signed-in
user is authorized to access. A search trigger in the application shell (plus an optional
keyboard shortcut) opens a compact search overlay; typed queries return a short, ranked
list of issues rendered as a compact adaptation of the existing **Ticket Ledger** row.
Selecting a result navigates to that issue's detail page exactly as any other path would.

This is deliberately **not** a command palette, launcher, or universal navigation system.
It answers one question: *"I know roughly what this issue is called or contains — help me
find it quickly."*

## 2. Motivation

- Today, finding an issue requires knowing which workspace → project → filtered ledger it
  lives in. Users who remember only part of a title must click through the hierarchy.
- The My Issues page covers only *assigned* issues; there is no cross-workspace lookup for
  anything else.
- Search is the natural final piece of Phase 2: Activity History provides the audit trail,
  Bulk Actions provide mass mutation, and Global Search closes the discovery gap.

## 3. Research findings (implementation-grounded)

| Question | Finding |
|---|---|
| How are issues queried today? | Drizzle ORM over better-sqlite3; `IssueService.listIssues` builds composable `WHERE` conditions with parameterized `sql` fragments. |
| Existing search capability | `listIssues` supports a per-project `search` param implemented as `(title LIKE ? OR description LIKE ?)` — parameterized, case-insensitive for ASCII via SQLite `LIKE` semantics (`backend/src/services/issue.ts:163-168`). |
| Ticket keys | **Not stored.** Derived client-side: `issueKey(id)` = first 6 chars of the de-hyphenated UUID uppercased, rendered `#ABCDEF` (`frontend/src/lib/issueKey.ts`). |
| Cross-workspace boundary precedent | `MyIssuesService.getReachableWorkspaceIds(userId)` = workspace memberships ∪ owned workspaces → project ids → issue scope (`backend/src/services/myIssues.ts:31-77`). This is the exact authorization shape Global Search needs. |
| Result enrichment | `myIssues` joins `projects`, `workspaces`, `users` in one query and batches label lookup with a second `inArray` query — no N+1. Reusable pattern. |
| DB scale | Single-file SQLite, local app scale (hundreds–low thousands of issues). Full-table scans with `LIKE` are already accepted in `listIssues`. |
| FTS5 availability | SQLite builds ship FTS5, but it requires a virtual table + trigger/sync maintenance for marginal benefit at this dataset size. |

### Decision D-01 — Indexed parameterized `LIKE`, no FTS5

Global Search uses **parameterized `LIKE` conditions** over `issues.title`,
`issues.description`, `projects.name`, and the derived ticket-key prefix, inside the same
join shape `myIssues` already uses. Rationale:

1. The codebase already trusts `LIKE` for search (`listIssues`); consistency beats novelty.
2. Dataset size makes scan cost negligible (< a few ms for thousands of rows).
3. FTS5 would add a virtual table, sync triggers/migrations, tokenization behavior changes,
   and rollback surface — none justified by current scale.

**Revisit criterion:** if issue counts reach ~100k or search latency exceeds ~50 ms p95,
revisit FTS5 behind the same endpoint contract (the response shape must not change).

### Decision D-02 — Ticket-key matching via id-prefix expression

Because keys are derived, the backend matches a query that looks like a key
(`#abcdef`, `abc123`) against `upper(replace(issues.id, '-', ''))` using `LIKE '<KEY>%'`
(prefix only). This lets users paste or type the visible `#ABCDEF` key and find the exact
issue — high value, zero schema change.

## 4. Scope

### In scope

- Issues as the only searched entity, across **all authorized workspaces** (memberships ∪ owned).
- Searchable dimensions: issue **title**, issue **description**, **project name**,
  **ticket-key prefix** (D-02).
- Shell-level search trigger (sidebar/top-bar placement per §13), optional keyboard shortcut.
- Compact search overlay reusing the existing **Dialog** primitive and visual language.
- Ranked results (§9), result count, empty/no-results/loading/error states.
- Click/Enter on a result → existing IssuePage route.

### Out of scope (explicit)

Comments, activity history, users, workspaces, projects/labels as independent result
entities, command execution/navigation commands/palette actions, notifications, saved or
recent searches, AI/semantic/fuzzy search, external search services, search analytics,
realtime collaboration, bulk selection/actions on search results (see D-05).

## 5. Non-goals

- No new authorization model (reuse membership ∪ owner boundary).
- No schema migration, no new tables, no FTS virtual tables (D-01).
- No ranking engine, no scoring library — deterministic SQL `CASE` tiers only (§9).
- No client-side filtering over a fully-loaded issue set; search is **server-side**.
- No Activity History writes for searching or opening results (§16).


## 6. User stories

- **US-1** — As a member of multiple workspaces, I type part of an issue title into global
  search and immediately see matching issues from all my workspaces, each labeled with its
  workspace/project so I know where it lives.
- **US-2** — As a user who noted a ticket key (`#A1B2C3`) from a comment or URL, I can type
  it into search and jump straight to that issue.
- **US-3** — As a keyboard user, I press `/` (or Ctrl/Cmd+K) anywhere, type a query, arrow
  through results, press Enter to open the issue — without touching the mouse.
- **US-4** — As a screen-reader user, I get announced result counts and a semantic result
  list; Escape returns me to where I was.
- **US-5** — As a non-member of workspace X, none of X's issues ever appear in my results,
  no matter what I type (enforced server-side).
- **US-6** — As a mobile user, I can open search from the top bar, type, read results, and
  open one, with ≥44px touch targets and no horizontal overflow.

## 7. Functional requirements

- **FR-01** — `GET /api/search?q=<query>` returns ranked, authorized issues (§10).
- **FR-02** — Authorization is enforced **in the database query**: only issues whose
  project belongs to a workspace the user is a member of or owns may be returned (§11).
- **FR-03** — Matching is case-insensitive (SQLite `LIKE` semantics), substring-based for
  title/description/project name, and prefix-based for ticket-key form input (§8.3).
- **FR-04** — Results include enough context to render a ledger row: id, projectId,
  workspaceId, title, status, priority, dueDate, labelIds + resolved labels, assignee
  display name, projectName, workspaceName.
- **FR-05** — Maximum `limit` results per request (default 20, max 50) plus a real `total`
  count of authorized matches; no pagination in v1 — when `total > items.length` the UI says so.
- **FR-06** — The frontend debounces input (~250ms), cancels superseded requests, and never
  renders stale results.
- **FR-07** — Selecting a result navigates to `/workspaces/:workspaceId/issues/:issueId`
  and closes the overlay; opening an issue via search creates **no** activity events.
- **FR-08** — Keyboard shortcut(s) open/focus search and never fire while typing in an
  input, textarea, select, or contenteditable element (§14).

## 8. Search semantics

### 8.1 Query handling

| Rule | Value |
|---|---|
| Minimum length | 2 characters after trimming (below that: no request; quiet hint "Type at least 2 characters") |
| Empty / whitespace-only | Treated as cleared: results hidden, initial state shown |
| Whitespace | Trimmed at ends; internal spaces preserved and matched literally |
| Case sensitivity | Case-insensitive (ASCII) via `LIKE`; no collation change |
| Tokens | NOT split — the whole trimmed string is one literal `LIKE` needle (predictable; avoids surprise OR-explosions) |
| Punctuation | Matched literally; `%` and `_` escaped (`\%`, `\_` with `ESCAPE '\'`) so users cannot inject wildcards |
| Max length | 200 characters, enforced by zod (mirrors `issueQuerySchema.search` cap); over → `422` |

### 8.2 Initial state

Overlay just opened / empty query: compact eyebrow ("SEARCH") and one line of guidance
("Find issues across your workspaces"). No fake suggestions, no fabricated recent searches.
Below minimum length: same panel plus the quiet hint.

### 8.3 Matching dimensions (one query, `OR`-combined)

```
issues.title        LIKE %q%      (primary identity)
issues.description  LIKE %q%
projects.name       LIKE %q%      (join already exists for context)
upper(replace(issues.id,'-','')) LIKE 'KEY%'   -- only when q looks like a key
```

"Looks like a key": after stripping an optional leading `#`, the query is 1–6 hex-ish
characters (`[0-9A-Fa-f]{1,6}`). Assignee names and label names are **not** matched in v1
(documented limitation, see §22 D-06).

## 9. Ranking strategy

Deterministic SQL `CASE` tiers, then recency. One query, no post-processing:

| Tier | Condition | Rationale |
|---|---|---|
| 1 | exact ticket-key prefix match | Typing a key is unambiguous intent |
| 2 | `lower(title) = lower(q)` | Exact-title hit is almost certainly the target |
| 3 | `title LIKE 'q%'` | Title starts with the query |
| 4 | `title LIKE '%q%'` | Title contains the query |
| 5 | description / project-name matches | Weakest identity signals |

Within a tier: `updated_at DESC`; remaining ties break by title A→Z (fully
deterministic even when timestamps collide). No fuzzy matching, no relevance
scores exposed to the client.


## 10. API contract

Follows existing conventions (`/api` prefix, session auth, error envelope
`error: { code, message, fields? }`).

### `GET /api/search?q=<string>&limit=<int>`

- Auth: required session → `401` otherwise (same per-route `requireAuth` convention).
- Validation (`backend/src/api/validators/search.ts`):
  - `q`: `z.string().trim().min(2).max(200)`
  - `limit`: `z.coerce.number().int().min(1).max(50).default(20)`
  - failure → `422 VALIDATION` with field errors, like every other validator.
- Response `200`:

```ts
interface SearchResponse {
  total: number;          // real count of authorized matches
  items: SearchIssue[];   // min(total, limit), ranked per §9
}
interface SearchIssue {   // ledger-row-shaped; field names mirror MyIssues items
  id: string;
  projectId: string;
  workspaceId: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  dueDate: string | null;
  labelIds: string[];
  labels: Label[];
  assignee: { id: string; name: string } | null;
  projectName: string;
  workspaceName: string;
}
```

- New files: `backend/src/api/routes/search.ts`, `backend/src/services/search.ts`,
  `backend/src/api/validators/search.ts`; wired in `registerRoutes` like the others.
- Deliberately **one** endpoint; no entity-specific search endpoints.

## 11. Authorization & security

- **Query-boundary isolation (server-side, non-negotiable):** resolve
  `workspaceIds = memberships(user) ∪ workspaces WHERE ownerId = user` (exact reuse of the
  `getReachableWorkspaceIds` logic), then constrain issues to projects in those workspaces.
  A non-member's issues are unreachable by construction — there is no post-filter to get wrong.
- Session auth identical to every other route; unauthenticated → `401`.
- All needles are bound parameters; `%`/`_` escaped with an explicit `ESCAPE` clause; no
  string interpolation into SQL.
- Query capped at 200 chars, `limit` at 50 — bounds worst-case scan and payload.
- No new identifiers exposed; workspace metadata of non-member workspaces cannot leak
  because the join cannot produce it.
- Abuse posture: local app behind session auth + helmet; length caps plus debounced UI
  suffice. No additional rate limiting in v1 (consistent with the existing API surface).

## 12. Data model

**No migration.** Search reads existing tables through existing indexes
(`issues_project_idx`, `memberships_user_idx`, etc.). Ticket-key matching is a computed
expression on `issues.id`, not a column (D-02). Rollback/compatibility surface: zero.

## 13. UX / UI requirements

- **Trigger:** a "Search" control in the app shell navigation — a `sidebar-link` sibling
  under the WORKSPACE group (with icon-rail tooltip behavior and ≤700px top-bar variant).
  Not a floating button.
- **Overlay:** reuses the existing `Dialog` primitive (`dialog-overlay`/`dialog`: focus
  trap, Escape, overlay-click close, focus return). Inside: search input (existing Field/
  Input styling) at top, hairline rule, results region. No second dialog implementation.
- **Results:** compact ledger-row adaptation (§17): mono ticket key, strong title, quiet
  `WorkspaceName / ProjectName` caption, status/priority badges, assignee, priority edge
  bar. Each row links to the issue page.
- **Result count:** one quiet meta line above the list ("N results", plus "showing first M"
  when truncated). Counts come from the API `total` — never fabricated.
- **Clear:** a clear affordance resets the query to the initial state; closing the overlay
  also discards the transient query.
- **Loading:** fixed-min-height results region with existing `SkeletonRows`; no layout shift.
- **No results:** honest concise message ("No issues match “q”"); no fabricated suggestions.

## 14. Keyboard shortcut

**Decision D-03 — support both `/` and `Ctrl/Cmd+K`.**

- `/` is primary (cheap, discoverable, shown in the trigger tooltip); Ctrl/Cmd+K is the
  secondary for habituated users.
- One `keydown` listener at the `Layout` level. Fires only when `document.activeElement`
  is not an input/textarea/select/contenteditable — never interferes with typing anywhere.
- `preventDefault()` so `/` doesn't trigger Firefox Quick Find and Ctrl+K doesn't jump to
  the browser address/search bar.
- Opening focuses the query input (Dialog focuses its panel; keep the input first focusable).
- Escape closes via the existing Dialog behavior, which already restores focus.
- Reduced motion: no entrance-animation dependency; existing Dialog motion rules apply
  unchanged.
- The shortcut is a convenience only; everything is reachable through the visible trigger.

## 15. Visual language requirements

- Warm paper surfaces, hairline rules, petrol only for interactive emphasis (input focus,
  hover key tint) — no new colors, radii, shadows, gradients, or glass effects.
- The overlay reads as "the ledger, lifted": same row anatomy, slightly denser vertical
  rhythm allowed because it is transient; the signature (edge bar → mono key → title →
  badges) stays intact.
- Typography: existing scale only (`--text-mono` keys, body titles, `--text-meta`
  captions); no new sizes or weights.
- The trigger inherits `sidebar-link` styling exactly, including icon-rail and top-bar
  responsive variants. No bespoke trigger chrome.
- If implementation reveals a genuinely reusable new pattern (the "search overlay"
  composition), `frontend/VISUAL_LANGUAGE.md` must gain a section documenting implemented
  rules; it must not be touched merely because a feature exists.

## 16. Activity / History integration

None. Search performs reads only. No activity records are created for opening search,
typing queries, viewing results, or navigating via a result. Navigation lands on the
standard IssuePage route and behaves identically to any other entry path.

## 17. Result UI relationship to the ledger signature

The result row is a **compact variant** of `.ledger-row`; the exact relationship:

- Keeps: `data-priority` edge bar, `.ticket-key`, `.ledger-main` title,
  `.ledger-context` workspace/project caption, `.ledger-meta` badges
  (status → priority → labels → assignee), hover treatment (paper tint + petrol key).
- Differs from page ledgers: no chevron affordance (the whole row is the link), slightly
  reduced vertical padding (overlay density), description is matched but never rendered
  (identity-first rows, D-06), overdue state conveyed via the existing `data-overdue`
  treatment when due date < today and status ≠ Closed.

## 18. Accessibility requirements

- Trigger: real `<button>` named "Search"; icon-rail/top-bar variants keep an accessible
  name via `aria-label`.
- Overlay: `role="dialog"` + `aria-modal` from the existing Dialog; the query input has a
  programmatic label ("Search issues"); results render as a semantic list of links — final
  listbox-vs-list choice is made during implementation and documented, but arrow-key
  navigation + Enter activation are required either way.
- Arrow Up/Down moves the active result; Enter opens it. Active-result visuals follow
  existing `focus-visible` conventions.
- `role="status"` politely announces counts ("5 results" / "No results") and loading
  ("Searching…").
- Escape: existing Dialog close + focus return. Skip-link, reduced-motion, focus-visible
  untouched. Touch targets ≥44px on coarse pointers (rows, clear control).

## 19. Responsive requirements

Existing breakpoints (VISUAL_LANGUAGE §Responsive: 1280 / 1024 / 700 / 375):

- **≥1280px:** centered overlay panel ~640px max-width, comfortable density.
- **≤1024px:** panel adapts to gutters; rows wrap per existing ledger wrapping rules.
- **≤700px:** near-full-width sheet anchored toward the top; the shell's top-bar Search
  item is the trigger; key + title always visible; badges wrap.
- **≤375px:** stacked row anatomy allowed (context caption may take its own line); no
  horizontal overflow; ≥44px touch rows.
- Important information (key, title, workspace/project) is never hidden to fit.

## 20. Performance

- One SQL query for matches + tier ordering + `total`; one batched labels query for the
  result set (mirrors `myIssues`). Zero N+1, no enrichment round-trips.
- Full scan of authorized issues with parameterized `LIKE` — negligible at current scale
  (D-01); `limit` bounds payload size.
- Frontend: 250ms debounce; `AbortController` cancellation (requires extending the tiny
  `request()` helper to accept a `signal` — additive and backward-compatible).
- No prefetching or caching layer in v1.

- **Error:** existing `Alert` styling inside the results region; editing the query retries.


## 21. Testing requirements

Backend: validator unit tests (min/max/escape/limit coercion); integration tests for
ranking tiers, key-prefix matching (`#a1b2c3` and bare hex), wildcard escaping, cross-
workspace isolation (member of A never sees B; owner-without-membership sees owned),
no-workspace user → empty, `401`, `422`, `total` vs truncated `items`.

Frontend: component tests (trigger opens overlay; debounce coalesces requests; stale
response never renders; results show ledger anatomy + context caption; Enter navigates;
Escape closes and refocuses; loading/no-results/error states; shortcut suppressed while
typing in inputs); axe audit extended to the open overlay; unit tests for pure helpers
(e.g., key-shape detection).

## 22. Explicit decisions & open questions

Decisions:
- **D-01** — Parameterized `LIKE`, no FTS5 (rationale + revisit criterion §3).
- **D-02** — Ticket-key search via id-prefix expression; keys stay derived/unstored.
- **D-03** — Shortcuts `/` + `Ctrl/Cmd+K`, typing-guarded, preventDefault applied.
- **D-04** — Whole-string literal matching; no tokenization/fuzziness.
- **D-05** — Bulk selection/actions on search results **excluded**: search is a transient
  navigation surface; selection state belongs to persistent ledgers.
- **D-06** — Description is matched but not rendered in results (identity-first rows).

Open questions (operator review):
- **Q-01** — Default `limit` 20 vs higher? Recommendation: keep 20 (overlay scroll budget).
- **Q-02** — Include project-name matching in v1? Recommendation: yes (free via join).
- **Q-03** — Approve both shortcuts, or `/` only?

## 23. Acceptance scenarios

1. Member of two workspaces types "login" → matching issues from both appear, each
   captioned with its workspace/project; count matches reality.
2. Types `#a1b2c3` → that exact issue ranks first; Enter opens its IssuePage.
3. Non-member searches a term matching foreign issues → they never appear.
4. Types `%` → literal match, no wildcard explosion, valid results or empty state.
5. Presses `/` while focused in an input → shortcut does not fire.
6. Presses `/` on page body → overlay opens focused; type → skeleton → results;
   arrows + Enter navigate; Escape closes and restores focus.
7. No-match query → honest no-results message; nothing fabricated.
8. 320–1280px: no horizontal overflow, ≥44px touch targets, key+title always visible.

## 24. Success criteria

- Any authorized issue reachable within seconds from partial memory alone.
- p95 server latency < 50ms at current dataset scale; UI feels instant after debounce.
- Zero authorization leakage, proven by tests.
- Search results read as the same visual family as the existing ledgers.
- Backend/frontend suites, typecheck, lint, build, axe audits all green.
