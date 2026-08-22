# Tasks — Spec 008: Global Search

> Derived from the approved `plan.md`. Each task is independently verifiable.

## Phase 0 — Shared contract

- [X] T0 Add `SearchIssue`, `SearchResponse` and constants (`SEARCH_MIN_LENGTH = 2`,
  `SEARCH_MAX_LENGTH = 200`, `SEARCH_DEFAULT_LIMIT = 20`, `SEARCH_MAX_LIMIT = 50`) to
  `shared/index.ts`; verify shared build + backend/frontend typecheck.

## Phase 1 — Backend validator

- [X] T1 Create `backend/src/api/validators/search.ts` (`q` trim min 2 max 200; `limit`
  coerce int 1–50 default 20). Unit tests in `backend/tests/unit/search-validator.test.ts`.

## Phase 2 — Authorization helper + service

- [X] T2 Extract the reachable-workspace boundary from `myIssues.ts` into a shared helper
  (memberships ∪ owned) used by both services — no duplicated authorization logic.
- [X] T3 Create `backend/src/services/search.ts`: escaped needles, key-shape detection,
  one ranking query (CASE tiers + total + LIMIT), batched label enrichment. Unit-test pure
  helpers in `backend/tests/unit/search-service.test.ts`.

## Phase 3 — Route + backend integration tests

- [X] T4 Create `backend/src/api/routes/search.ts` (`GET /search`, requireAuth, validator)
  and wire it in `routes/index.ts`.
- [X] T5 Integration tests `backend/tests/integration/search.test.ts`: ranking order,
  key-prefix match, wildcard escaping, title/description/project-name matching,
  cross-workspace isolation, owner visibility, empty-scope user, 401/422, limit vs total.

## Phase 4 — API client

- [X] T6 Extend `frontend/src/api/client.ts`: optional `AbortSignal` on `request()`
  (backward-compatible) and `api.search()`.

## Phase 5 — SearchDialog

- [X] T7 Create `frontend/src/components/SearchDialog.tsx` composing the existing Dialog:
  labelled input + clear, initial/loading/no-results/error/results states, compact
  ledger-row result variant with `.ledger-context` caption and badges, ArrowUp/Down +
  Enter navigation, `role="status"` announcements, 250ms debounce + abort + stale guard.

## Phase 6 — Shell trigger + shortcut

- [X] T8 Add "Search" sidebar-link trigger to `Layout.tsx` plus global `/` and Ctrl/Cmd+K
  handler guarded against typing contexts; open state lives in Layout.
- [X] T9 Layout/shortcut tests: click opens, `/` opens on body, `/` suppressed while typing
  in inputs, Escape restores focus to trigger.

## Phase 7 — Styles & visual language

- [X] T10 Token-based CSS for overlay width/density, fixed-min-height results region,
  compact ledger row variant, active-result treatment; responsive rules ≤1024/≤700/≤375.
- [X] T11 Document the implemented "ledger, lifted" pattern in `frontend/VISUAL_LANGUAGE.md`.

## Phase 8 — Frontend tests + full verification

- [X] T12 Component tests `frontend/tests/component/search-dialog.test.tsx`: states,
  debounce/stale protection, keyboard nav, Enter navigation, Escape/focus-return, count
  honesty; extend axe coverage for the open overlay.
- [X] T13 Run full verification separately per package: backend tests, frontend tests
  (component + a11y), typecheck, lint, build. Walk spec §23 acceptance scenarios that are
  verifiable without a browser; report honestly what was not visually verified.
