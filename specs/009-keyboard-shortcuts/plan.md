# Implementation Plan — Spec 009: Keyboard Shortcuts

> Stage 1 only: plan. **No implementation code changes in this stage.** This plan guides the
> operator-approved implementation pass that follows review. It maps 1:1 to the 17 required
> plan sections and carries per-change file/responsibility/why/reuse/tests detail in each phase.

## Objectives

Add a small, deliberate keyboard-shortcut layer: a **centralized registry** (`lib/shortcuts.ts`)
plus a `useKeyboardShortcuts` hook as the single source of truth; **global** navigation
(`G` then `D` → `/`, `G` then `M` → `/my-issues`) and **help** (`?` → compact Dialog);
**contextual** issue actions (`E` Edit, `D` Delete-confirm, `C` focus comment) on IssuePage;
a shared **input/focus guard** and **modal-suppression** rule; a minimal reusable `.kbd`
key-cap pattern. The existing `/` and `Ctrl/Cmd+K` Global Search bindings are preserved
verbatim (spec D-03). No backend, database, shared-contract, or dependency changes (spec D-01).

## 1. Architecture

- **One registry module** owns all shortcut definitions and matching. A single `document`
  `keydown` listener is installed once by the shell (`Layout`); contextual bindings are
  registered by pages via the hook and matched against the current context.
- **The registry does not own modal keyboard behavior.** `Escape`, `Tab`, and the arrows
  inside `Dialog`/`SearchDialog`/Quick Edit keep their current owners (spec D-02).
- **A modal-presence registry** (a small module + effect in `Dialog.tsx`) lets the shortcut
  dispatcher know when a modal is open so global/contextual shortcuts are suppressed
  (spec FR-06); this also corrects the latent pre-existing case where `/` opened search on
  top of a non-input dialog.
- **Sequence engine** for `G then …` lives in the registry (short-lived pending state +
  timeout); typing and modal contexts never arm it (spec FR-07).
- Context scoping is declarative: each binding declares a `context` ("global" | "issue"), and
  pages call the hook with their active context. Global bindings run on any shell page;
  issue bindings only when the registered context is active AND no modal is open.

## 2. Existing keyboard behavior

| Location | Behavior | Notes |
|---|---|---|
| `Layout.tsx:26-37` | `/` and `Ctrl/Cmd+K` open search; local `isTypingContext` guard | To be absorbed into the registry (behavior identical, D-03). |
| `Dialog.tsx:29-54` | document Escape (close) + Tab focus trap | Untouched; must be reported to modal-presence registry. |
| `SearchDialog.tsx:93+` | ArrowUp/Down, Enter, Escape inside overlay | Untouched; overlay keeps focus in an input, which the guard already honors. |
| `QuickEditSelect/QuickEditPopover` | Escape to cancel | Untouched; focus in a control or the ledger; registry guard must not fire. |

No global listeners exist outside `Layout`. The plan adds none besides the single registry
listener — pages register, they do not add `window`/`document` listeners.

## 3. Proposed shortcut registry / design

Conceptual row per binding (typed in `lib/shortcuts.ts`):

```ts
interface ShortcutDef {
  id: string;              // unique, stable
  keys: string[];          // e.g. ["g","d"] sequence, ["e"] single, ["mod","k"] chord
  context: "global" | "issue";
  description: string;     // shown in help
  group: "Global" | "Issue";
  action: () => void;
  enabled: boolean | (() => boolean); // state-driven (e.g. loading issue)
  reserved?: boolean;      // true for / and Ctrl/Cmd+K (D-03)
}
```

- Definitions are data; help renders from the same list (never drifts).
- The dispatcher applies, in order: (1) `preventDefault`-safe modifier rules, (2) typing
  guard, (3) modal guard, (4) context match, (5) enabled check, (6) single-key or sequence
  execution.
- `Mod` (platform-independent) maps to `metaKey` on macOS and `ctrlKey` elsewhere, used only
  for the reserved Global Search and for display.


## 4. Global shortcuts

- `G` then `D` → `navigate("/")`.
- `G` then `M` → `navigate("/my-issues")`.
- `?` → open help dialog.
- `/` and `Ctrl/Cmd+K` → reserved Global Search, preserved verbatim by the registry (D-03).
- **New**: a quiet sidebar-footer help affordance (recommended placement per spec Q-04) that
  opens the same help dialog, so `?` is never the only path (FR-09).

## 5. Contextual shortcuts

Registered only while `IssuePage` is mounted and not loading:

- `E` → `setEditOpen(true)` (opens existing Edit dialog).
- `D` → `setDeleteOpen(true)` (opens existing Delete confirmation; never deletes).
- `C` → focus the comment composer textarea.

These are single keys with no modifier; the typing + modal guards ensure they only fire in a
neutral, non-input context on the issue page.

## 6. Sequence handling

- `G` arms a pending state when the event is a bare `g` (no modifiers) in a non-typing,
  non-modal context.
- A following `d`/`m` within `SEQUENCE_MS` (default **800ms**, spec D-07) executes and clears.
- An unrelated key, a timeout, an open modal, or focus entering an input clears the pending
  state with no action (no stuck state, no visible UI).
- The pending state is cleared on the shell's unmount to avoid leaks.

## 7. Help dialog

- Opened by `?` (global) and the footer affordance.
- Composes the existing `Dialog`. Groups: **Global** (Search, Dashboard, My Issues) and
  **Issue** (Edit, Delete, Comment). Rows with `.kbd` keys + description text.
- Lists only registry entries whose context is active (global always; issue group shown as
  "on the issue page" or hidden when not on an issue). Deferred/rejected shortcuts never
  appear.
- `Escape`/overlay/focus-return via `Dialog`; close happens through `Dialog` only.

## 8. Input / focus guards

One reusable guard in `lib/shortcuts.ts`: `isTypingContext(active)` returns true for
`INPUT`/`TEXTAREA`/`SELECT`/`[contenteditable="true"]`. It is applied to `document.activeElement`
for every global binding and reused by both the dispatcher and the sequence arming. No
scattered per-page `tagName` checks. The reserved `/`+`Ctrl/K` binding keeps exactly its
current typed-guard semantics.

## 9. Accessibility

- Help dialog inherits `Dialog` focus trap / `aria-modal` / Escape / focus-return.
- No per-keypress SR announcements; navigation already announces page titles.
- `.kbd` uses text + subtle surface, never color alone.
- Keyboard-only operation of the dialog (Tab/Escape) verified by tests.
- Every shortcut action remains reachable through existing buttons/links.

## Phase 0 — Registry primitives (guard, platform, types)

**Files (new):** `frontend/src/lib/shortcuts.ts` (definitions, guard, dispatcher, sequence
engine), `frontend/src/lib/useKeyboardShortcuts.ts` (hook), `frontend/src/lib/kbd.ts`
(display helpers: `kbdKey`, `modLabel()`).

- **Responsibility:** single source of truth; `isTypingContext`; `mod` detection; sequence
  state machine (`arm`, `cancel`, `timeout`); dispatcher applying guards → context → enabled.
- **Why:** satisfies one-source-of-truth goal (spec FR-01, D-02) and gives pages a clean API.
- **Reuses:** the guard logic pattern already in `Layout.tsx` `isTypingContext`; no component.
- **Tests:** `shortcuts.test.ts` — `isTypingContext` across element types; `mod` on
  mac/non-mac; sequence arm/cancel/timeout; dispatcher ordering (guards before match).

**Exit criteria:** unit tests green under `frontend`

## Phase 1 — Modal-presence registry

**Files:** `frontend/src/lib/modalLayer.ts` (new), modify `frontend/src/components/Dialog.tsx`.

- **Responsibility:** a tiny register/unregister API plus `isModalOpen()`; `Dialog` reports its
  open state via an effect (`useEffect` on `open`).
- **Why:** the registry must know an async overlay is open to suppress global/contextual
  shortcuts (spec FR-06) and to prevent the latent `/`-over-dialog bug.
- **Reuses:** existing `Dialog` lifecycle (its own `useEffect([open])`).
- **Tests:** `modal-layer.test.ts` — register/unregister brackets; `isModalOpen` toggles;
  Dialog mounting updates signal.

**Exit criteria:** unit tests green.

## Phase 2 — Global shortcuts in the shell

**Files:** modify `frontend/src/components/Layout.tsx`; add footer help affordance.

- **Responsibility:** replace the inline `/`+`Ctrl/K` listener with the registry (behavior
  unchanged, D-03); register global bindings (`?`, `G D`, `G M`); wire sequence + help state
  (help-open state lives here like `searchOpen`).
- **Why:** one listener; global shortcuts only active inside the shell; open-state owned here
  as today.
- **Reuses:** existing `Dialog`/`SearchDialog` placement pattern and `searchOpen` state style.
- **Tests:** extend `layout-search.test.tsx` + new `layout-shortcuts.test.tsx` — `/` opens
  search, `Ctrl+K` opens search (regression), `G D`/`G M` navigate, `?` opens help, typing
  informs guard, dialog-open suppresses.

**Exit criteria:** shell shortcut suite green; existing layout/search suites unchanged.

## Phase 3 — Contextual issue shortcuts

**Files:** modify `frontend/src/pages/IssuePage.tsx`.

- **Responsibility:** register `E`/`D`/`C` when the issue is loaded and no modal is open;
  `C` focuses the composer textarea ref.
- **Why:** these are the IssuePage-only actions; keeps them out of the global scope.
- **Reuses:** existing `editOpen`/`deleteOpen` state and the composer `textarea`.
- **Tests:** extend `issue-page.test.tsx` — `E` opens Edit, `D` opens confirm (never calls
  `api.delete`), `C` focuses composer; suppressed while typing/dialog open.

**Exit criteria:** issue shortcut tests green; existing issue-page suite unchanged.


## 10. Responsive behavior

- Help dialog inherits `Dialog` rules (fills width ≤700px, near-full-screen ≤375px, §31); no
  new breakpoints.
- `.kbd` rows reflow to stacked rows on narrow widths; key + label always visible, no
  horizontal overflow.
- Footer help affordance respects icon-rail (≤1024px) and top-bar (≤700px) sidebar
  transitions for free (it reuses a bare text/icon hint that follows the sidebar reset rules);
  ≥44px touch target on coarse pointers where interactive.
- Shortcuts are progressive enhancement; touch users unaffected.

## 11. Visual language integration

- **New reusable pattern:** `.kbd` key-cap (spec D-08). One minimal CSS rule from existing
  tokens: mono `--text-mono`, `--radius-sm`, `--color-border`/subtle surface, no elevation.
  Used in the help dialog rows and (optionally) sidebar tooltip hints.
- Everything else composes existing patterns: `Dialog`, `section-eyebrow` group headings,
  hairline/ruled-row grouping, `--text-meta` labels.
- **`VISUAL_LANGUAGE.md` update:** add a short section documenting `.kbd` (where used,
  spacing, typography, interaction, when NOT to use — e.g. never for badges/status). Only
  this one new pattern is documented; the rest is reuse.

## 12. Testing strategy

- **Unit:** `shortcuts.test.ts`, `modal-layer.test.ts`, `kbd.test.ts` (mod label / key display).
- **Component (global):** `layout-shortcuts.test.tsx` — `/`, `Ctrl+K`, `G D`, `G M`, `?`;
  typing guard; dialog-open suppression; footer affordance.
- **Component (issue):** extend `issue-page.test.tsx` — `E`, `D` (confirm only), `C`;
  suppressed in input/modal; no direct `delete` call.
- **Help:** `keyboard-shortcuts-dialog.test.tsx` — lists only active; `Escape` closes; focus
  return; platform label (`⌘` vs `Ctrl`).
- **Axe:** extend `frontend/tests/accessibility/core.test.tsx` for the open help dialog.

## 13. Regression strategy

Run the **complete** suites separately (per established convention): `npm run test -w frontend`
and `npm run test -w backend`, plus `npm run typecheck`, `npm run lint`, `npm run build`.
Confirm the existing Global Search suites (`layout-search.test.tsx`, `search-dialog.test.tsx`)
and `Dialog`/core axe tests still pass unmodified — proving `/`+`Ctrl/K` and modal behavior
are unchanged.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Registry changes `/`/`Ctrl+K` behavior | Behavior kept identical (D-03); existing search suites guard it. |
| Shortcuts fire while typing | Central `isTypingContext` guard reused everywhere; per-context tests. |
| Shortcut fires over an open modal | Modal-presence suppression (Phase 1); also fixes latent `/`-over-dialog bug; tests. |
| `G` sequence stuck/leaks | Timeout + cancel on unrelated key/modal/input/form + unmount cleanup; tests. |
| Help lists fabricated/inactive shortcuts | Rendering from the registry only; tests assert active set. |
| New `.kbd` drifts from design system | Tokens only, minimal rule, documented in VL; axe + review checklist. |
| International `?` unreachable | Visible footer affordance is a first-class trigger, not a fallback. |

## 15. Files to create / modify

Create:
- `frontend/src/lib/shortcuts.ts` — registry, guard, dispatcher, sequence engine.
- `frontend/src/lib/useKeyboardShortcuts.ts` — React hook to mount/register bindings.
- `frontend/src/lib/modalLayer.ts` — modal-presence register/isModalOpen.
- `frontend/src/lib/kbd.ts` — key display + `modLabel()`.
- `frontend/src/components/KeyboardShortcutsDialog.tsx` — help dialog.
- Tests: `shortcuts.test.ts`, `modal-layer.test.ts`, `kbd.test.ts`,
  `layout-shortcuts.test.tsx`, `keyboard-shortcuts-dialog.test.tsx`.

Modify:
- `frontend/src/components/Dialog.tsx` — report open state to `modalLayer`.
- `frontend/src/components/Layout.tsx` — move `/`+`Ctrl/K` into registry; register global
  bindings; open-state for help; footer affordance.
- `frontend/src/pages/IssuePage.tsx` — register `E`/`D`/`C`; composer ref for `C`.
- `frontend/src/styles/components.css` — `.kbd` rule (tokens only).
- `frontend/tests/component/issue-page.test.tsx`, `frontend/tests/accessibility/core.test.tsx`.
- `frontend/VISUAL_LANGUAGE.md` — document `.kbd` (single new reusable pattern).

## 16. Dependencies

- Library dependencies: **none** (React Router `useNavigate` already present; no new package).
- Phase order: `Phase 0 → 1 → 2 → 3 → 4 → 5`. `Phase 0,1` block `2`; `Phase 2` blocks `3`
  (needs the hook + dispatcher); `Phase 4` (dialog) can start after `Phase 2`; `Phase 5`
  (styles/VL/test) last.

## 17. Exit criteria

- All new tests (unit + component + axe) green; all existing frontend/backend suites
green; `typecheck`, `lint`, `build` pass.
- `/` and `Ctrl/Cmd+K` behave exactly as before (verified, not assumed).
- `G D`, `G M`, `E`, `D`-confirm-only, `C`, `?` all work and are suppressed correctly in
typing and modal contexts.
- Help dialog lists only active shortcuts, shows `⌘`/`Ctrl` correctly, is axe-clean, and is
reachable without `?`.
- No backend/database/shared-contract changes; no new dependencies.
- `VISUAL_LANGUAGE.md` documents the `.kbd` pattern; no other visual language changes.

## Dependencies & ordering

```
Phase 0 (registry/guard/platform)
  └─> Phase 1 (modalLayer + Dialog reporting)
        └─> Phase 2 (Layout global bindings + footer affordance)
              ├─> Phase 3 (IssuePage contextual)  [needs hook from Phase 0 + dispatcher]
              └─> Phase 4 (Help dialog + .kbd component)
                    └─> Phase 5 (styles, VL doc, tests, axe, verification)
```

---

*End of plan.md (Stage 1). Does not create `tasks.md` until the spec + plan are approved.
No implementation code was changed in this stage.*
