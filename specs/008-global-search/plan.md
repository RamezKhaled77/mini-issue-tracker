# Implementation Plan — Spec 008: Global Search

> Stage 1 only: plan. **No implementation code changes in this stage.** This plan guides the
> operator-approved implementation pass that follows review.

## Objectives

Add cross-workspace issue search: a `sidebar-link`-family trigger plus `/` and Ctrl/Cmd+K
shortcuts open a Dialog-based search overlay; debounced queries hit `GET /api/search`,
which returns ranked, authorized issues (parameterized `LIKE` over title/description/
project name + ticket-key prefix matching); results render as a compact ledger-row variant
and navigate to the existing IssuePage.

## Guiding constraints

- Authorization reuses the `getReachableWorkspaceIds` boundary (memberships ∪ owned);
  isolation is enforced inside the SQL query, never by post-filtering.
- No schema migration, no FTS5, no new dependencies (spec D-01).
- Reuse: `Dialog`, `Field`/Input, `SkeletonRows`, `Alert`, `EmptyState` patterns,
  `.ledger-row` anatomy, `Badge`, `Avatar`, existing route/service/validator conventions.
- Extend, don't fork: the overlay composes the existing Dialog; result rows extend
  `.ledger-row`; the trigger extends `sidebar-link`.
- No Activity writes; no bulk selection on results.

## Phase 0 — Shared contract

**Files:** `shared/index.ts`

- Add `SearchIssue` and `SearchResponse` types (spec §10 shape) mirroring MyIssues item
  field names.
- Add `SEARCH_MIN_LENGTH = 2`, `SEARCH_MAX_LENGTH = 200`, `SEARCH_DEFAULT_LIMIT = 20`,
  `SEARCH_MAX_LIMIT = 50` constants (single source for validator + UI).

**Exit criteria:** shared typecheck passes; backend/frontend still compile.

## Phase 1 — Backend validator

**Files:** `backend/src/api/validators/search.ts` (new)

- `searchQuerySchema`: `q: z.string().trim().min(2).max(200)`;
  `limit: z.coerce.number().int().min(1).max(50).default(20)`.
- Unit tests (`backend/tests/unit/search-validator.test.ts`): min/max boundaries, coercion,
  whitespace-only rejection, defaults.

**Exit criteria:** validator unit tests green.

## Phase 2 — Backend service

**Files:** `backend/src/services/search.ts` (new)

- `createSearchService({ db, membershipService })`.
- Extract/reuse the reachable-workspace resolution from `myIssues.ts`
  (`memberships ∪ owned`) — factor into a small shared helper so both services use one
  boundary implementation (no duplicated authorization logic).
- `search(userId, q, limit)`:
  1. Resolve authorized workspace ids → project ids; empty → `{ total: 0, items: [] }`.
  2. Escape `%`/`_` in the needle; build parameterized conditions: title/description/
     project-name `%needle%` (+ key-prefix condition when the trimmed query matches the key
     shape `[0-9A-Fa-f]{1,6}` after an optional `#`).
  3. One query joining `projects`/`workspaces`/`users`: select ledger fields + ranking
     `CASE` tier; compute `total` with the same `WHERE`; order by
     `tier ASC, updated_at DESC, id ASC`; `LIMIT limit`.
  4. Batch-resolve labels for returned ids exactly like `myIssues` (one `inArray` query +
     `buildLabelMap`).
- Pure helpers (needle escaping, key-shape detection) exported for unit testing.

**Exit criteria:** helper unit tests green; integration tests in Phase 3 pass.

## Phase 3 — Route, wiring, backend tests

**Files:** `backend/src/api/routes/search.ts` (new), `backend/src/api/routes/index.ts`,
`backend/tests/integration/search.test.ts` (new)

- `router.get("/search", ...)`: `requireAuth` → parse query → `searchService.search(...)`
  → `200 { total, items }`. Register in `registerRoutes`.
- Integration tests (reuse `tests/helpers.ts`):
  - ranking tiers in order (key prefix > exact title > prefix > contains > description),
    recency tiebreak;
  - `#a1b2c3` / bare-hex key match; case-insensitivity;
  - literal `%`/`_` handling (no wildcard explosion);
  - isolation matrix: member-of-A never sees B's issues even on identical titles;
    owner-without-membership sees owned workspace issues; user with no workspaces → empty;
  - `401` unauthenticated; `422` short/long/invalid `q`, bad `limit`;
  - `total` reflects full authorized matches while `items` is capped at `limit`.

**Exit criteria:** backend typecheck + lint + full test suite green.

## Phase 4 — API client

**Files:** `frontend/src/api/client.ts`

- Extend internal `request()` to accept an optional `AbortSignal` (backward-compatible).
- Add `api.search(q, { signal?, limit? })` returning `SearchResponse`.

**Exit criteria:** frontend typecheck passes; existing client behavior unaffected.


## Phase 5 — Frontend search components

**Files:** `frontend/src/components/SearchDialog.tsx` (new), a small debounce hook
(colocated per repo convention), pure helpers with unit tests if extracted

- `SearchDialog({ open, onClose })` composing the existing `Dialog`:
  - input (Field styling, label "Search issues", first focusable), clear affordance;
  - states: initial hint (<2 chars), loading (`SkeletonRows` in a fixed-min-height region),
    error (`Alert`), honest no-results message, results list with quiet count line
    ("N results" / "showing first M of N");
  - result rows = compact `.ledger-row` variant: `data-priority` edge bar, `.ticket-key`
    (via `issueKey(id)`), `.ledger-main` title, `.ledger-context` caption, `.ledger-meta`
    badges, `data-overdue`; each row navigates to
    `/workspaces/:workspaceId/issues/:id` and calls `onClose()`;
  - ArrowUp/ArrowDown moves the active row, Enter opens it; counts/loading announced via
    `role="status"`; debounce 250ms; AbortController cancels superseded requests; stale
    responses discarded.
- Keep new CSS minimal and token-based (Phase 7).

**Exit criteria:** component tests green; overlay axe-clean while open.

## Phase 6 — Shell integration + keyboard shortcut

**Files:** `frontend/src/components/Layout.tsx`

- Add "Search" trigger as a third `sidebar-link` (WORKSPACE group) with a magnifier SVG
  consistent with existing icon style; verify icon-rail tooltip and ≤700px top-bar behavior
  come free from existing CSS (extend only if genuinely missing).
- Global `keydown` handler: `/` or Ctrl/Cmd+K opens the dialog **only** when the active
  element is not input/textarea/select/contenteditable; `preventDefault()` applied.
- Open-state lives in `Layout`; closing discards the transient query.

**Tests:** layout/shortcut tests following existing page-test mock conventions (API mocks
must include any newly used client methods): trigger click opens; `/` opens on page body;
`/` while typing in an input does not fire; Escape restores focus to the trigger.

**Exit criteria:** layout + shortcut tests and axe suite green.

## Phase 7 — Styles & visual language documentation

**Files:** `frontend/src/styles/components.css`, `frontend/VISUAL_LANGUAGE.md`

- CSS additions only where composition isn't enough: overlay width/density,
  fixed-min-height results region, compact ledger padding variant for rows inside the
  overlay, active-result treatment reusing focus-visible conventions. Tokens only — no new
  colors, radii, shadows, or font sizes.
- Responsive rules at ≤1024 / ≤700 / ≤375 per spec §19.
- Update `frontend/VISUAL_LANGUAGE.md` with a section documenting the implemented search
  pattern (trigger placement, Dialog composition, result-row relationship to the ledger
  signature, shortcut behavior) grounded in what actually shipped.

**Exit criteria:** build passes; breakpoint smoke documented.

## Phase 8 — Frontend tests & full verification

**Files:** `frontend/tests/component/search-dialog.test.tsx` (new), extended layout tests,
extended axe coverage

- Debounce coalesces (fake timers); stale response discarded; Enter navigation target;
  Escape/focus-return; loading/no-results/error renderings; shortcut typing-guard;
  count-line honesty (renders API `total`, nothing fabricated).
- Full verification: backend and frontend suites run **separately** (full monorepo runs
  exceed shell timeout), plus typecheck, lint, build, axe.

**Exit criteria:** everything green; spec §23 acceptance scenarios walked through manually.

## Dependencies & ordering

```
Phase 0 (shared) → Phase 1 (validator) → Phase 2 (service) → Phase 3 (route+tests)
Phase 0 → Phase 4 (client)
Phases 3+4 → Phase 5 (SearchDialog) → Phase 6 (shell+shortcut) → Phase 7 (styles/VL doc) → Phase 8 (verification)
```

## Risks

| Risk | Mitigation |
|---|---|
| Authorization leak via post-filter mistakes | Isolation lives entirely in the SQL boundary (shared helper); dedicated isolation integration tests |
| LIKE wildcards from user input | Escape `%`/`_` + explicit `ESCAPE` clause; tested |
| Stale/racing responses render wrong results | Debounce + AbortController + response-sequence guard; tested with fake timers |
| Shortcut interferes with typing | Active-element guard; tested across input contexts incl. dialogs |
| Overlay drifts into "generic command palette" aesthetic | Compose existing Dialog + ledger rows; VL review checklist before completion |
| Layout shift while loading | Fixed min-height results region; SkeletonRows |
| Focus trap vs arrow-key navigation conflict | Arrows are not Tab — no trap conflict; verified in tests |

## Performance notes

Single scan query + single batched labels query; payload bounded by `limit ≤ 50`;
debounce bounds request rate. Revisit FTS5 only per spec D-01 criterion (~100k issues or
>50ms p95).
