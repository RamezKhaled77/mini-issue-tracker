---

description: "Task list for Keyboard Shortcuts implementation"

---

# Tasks — Spec 009: Keyboard Shortcuts

> Derived from the approved `spec.md` + `plan.md`. Each task is independently verifiable so
> every phase can be validated and committed in isolation. There is **no backend phase**:
> keyboard shortcuts are pure client interaction behavior (spec D-01). Backend is
> verification-only (no-change regression gate).

**Input**: Design documents from `/specs/009-keyboard-shortcuts/`

**Prerequisites**: `plan.md` (required), `spec.md` (required for behaviours + decisions),
`frontend/VISUAL_LANGUAGE.md` (visual source of truth)

**Tests**: Frontend unit + component + axe a11y (per `spec.md` §17); backend suite re-run as
a no-change regression gate.

**Format**: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- Include exact file paths in every description
- Decisions referenced as **D-##** / **§##** map to `spec.md`.

---

## Phase 0: Registry primitives (guard, platform, types)

**Purpose**: The single source of truth for shortcuts (spec FR-01, D-02, D-03).

- [x] T001 Create `frontend/src/lib/shortcuts.ts` — shortcut definition type (id, keys,
  context: `"global" | "issue"`, description, group, action, enabled, reserved), the
  `isTypingContext(active)` guard (`INPUT`/`TEXTAREA`/`SELECT`/`[contenteditable=true]`,
  spec FR-04, reusing the `Layout.tsx` pattern), `mod` detection (metaKey on macOS, ctrlKey
  elsewhere), the single `keydown` dispatcher (ordering: modifier rule → typing guard →
  modal guard → context match → enabled → single-key/sequence), and the sequence state
  machine (arm/cancel/timeout at `SEQUENCE_MS`).
- [x] T002 Create `frontend/src/lib/useKeyboardShortcuts.ts` — React hook that mounts the
  registry dispatcher once and exposes helpers for pages to register contextual bindings
  (e.g. `registerContextual({ context, bindings })`); honors cleanup on unmount (clears any
  pending sequence).
- [x] T003 Create `frontend/src/lib/kbd.ts` — pure display helpers: `kbdKey(key)` and
  `modLabel()` returning `⌘` on macOS and `Ctrl` otherwise (spec §7 FR-08, §12; the
  "Platform" testing requirement §17.7).
- [x] T004 Create `frontend/src/lib/modalLayer.ts` — modal-presence registry:
  `registerModal()/unregisterModal()` + `isModalOpen()` so the dispatcher can suppress all
  global/contextual shortcuts while a modal is open (spec FR-06).
- [x] T005 Unit tests: `frontend/tests/component/shortcuts.test.ts` (`isTypingContext`
  across element types; `mod` on mac/non-mac; sequence arm/cancel/timeout; dispatcher guard
  ordering incl. modal suppression) and `frontend/tests/component/kbd.test.ts` (`modLabel`
  `⌘`/`Ctrl`) and `frontend/tests/component/modal-layer.test.ts` (register/unregister
  brackets; `isModalOpen` toggles).

**Checkpoint**: unit tests green; `npm run typecheck -w frontend`, `npm run lint -w frontend`.

---

## Phase 1: Modal-presence wiring

**Purpose**: Let `Dialog` report open state so shortcuts never fire over a modal, and fix
the latent pre-existing `/`-over-dialog case (spec §3, FR-06).

- [x] T006 Modify `frontend/src/components/Dialog.tsx` — in the existing `useEffect([open])`,
  call `registerModal()`/`unregisterModal()` so opening a `Dialog` enables modal suppression
  and closing clears it (reuses the component's own lifecycle; Escape/Tab/focus-return
  behavior unchanged).
- [x] T007 Component test (`modal-layer.test.ts` or `dialog.test.tsx`): mounting an open
  `Dialog` flips `isModalOpen()` to true and unmount/close clears it; `Escape` still closes
  (no regression).

---

## Phase 2: Global shortcuts in the shell

**Purpose**: Replace the ad-hoc `Layout` listener with the registry and register shell-
scoped global bindings (spec §4, D-03, FR-02).

- [x] T008 Modify `frontend/src/components/Layout.tsx` — remove the inline `/`+`Ctrl/Cmd+K`
  `keydown` effect; register the **reserved** search bindings in the registry with identical
  semantics (`preventDefault`, typing-guard, open-state owned by `Layout`; D-03). Register
  global bindings: `?` → open help, `G` then `D` → `navigate("/")`, `G` then `M` →
  `navigate("/my-issues")`. Add a `helpOpen` state (mirroring `searchOpen`) and render the
  help dialog.
- [x] T009 Add the quiet Help affordance in the sidebar footer (button labelled "Keyboard
  shortcuts" / `?` hint, `sidebar-link` reset rules) that opens the same help dialog so `?`
  is never the only path (spec FR-09, D-06, plan §22 Q-04 default); verify it inherits
  icon-rail (≤1024px) and top-bar (≤700px) behavior and meets 44px coarse-pointer sizing
  where interactive.
- [x] T010 Component tests: new `frontend/tests/component/layout-shortcuts.test.tsx` — `/`
  opens search (regression), `Ctrl/Cmd+K` opens search (regression), `G D` navigates to `/`,
  `G M` navigates to `/my-issues`, `?` opens help, footer affordance opens help; typing in an
  `<input>` suppresses all; an open `Dialog` suppresses `G`/`?` (modal guard).

**Checkpoint**: shell shortcut suite green; existing `layout-search.test.tsx` +
`search-dialog.test.tsx` pass unmodified.

---

## Phase 3: Contextual issue shortcuts

**Purpose**: IssuePage-only actions that never bypass existing confirmation/auth (spec §5,
FR-03, §14).

- [x] T011 Modify `frontend/src/pages/IssuePage.tsx` — register contextual bindings via the
  hook, enabled only when the issue is loaded and no modal is open: `E` → `setEditOpen(true)`,
  `D` → `setDeleteOpen(true)` (confirmation only, never a direct `api.delete`; spec §13,
  §24), `C` → focus the comment composer `textarea` (add/attach a ref to the existing
  composer).
- [x] T012 Component tests: extend `frontend/tests/component/issue-page.test.tsx` — `E`
  opens the Edit dialog, `D` opens the Delete **confirmation** dialog without calling
  `api.delete`, `C` focuses the composer textarea; none fire while typing in the composer;
  none fire while a dialog is open; no-op while the issue is still loading.

**Checkpoint**: issue shortcut tests green; existing `issue-page.test.tsx` suite unchanged.
---

## Phase 4: Help dialog + key-cap pattern

**Purpose**: Compact, editorial, discoverable help that renders only real active shortcuts
(spec §7, §10, FR-08, D-08).

- [x] T013 Create `frontend/src/components/KeyboardShortcutsDialog.tsx` — composes the
  existing `Dialog` (title "Keyboard shortcuts", description), renders two groups (GLOBAL /
  ISSUE section eyebrows) as ruled rows; each row = `.kbd` key(s) + description text;
  renders platform-appropriate modifiers via `kbd.ts` (`⌘`/`Ctrl`); lists only registry
  bindings that are registered and active (never deferred/rejected; spec §7, §24); the `D`
  row notes it opens confirmation. Accepts `open`/`onClose` props.
- [x] T014 [P] Add the `.kbd` rule to `frontend/src/styles/components.css` — mono
  `--text-mono`, `--radius-sm`, subtle/hairline surface (existing surface/border token), no
  elevation, compact padding; tokens only (spec §10, D-08; no new colors/spacing/fonts).
- [x] T015 Component tests: `frontend/tests/component/keyboard-shortcuts-dialog.test.tsx` —
  renders known active shortcuts; does not render deferred/rejected (`J`/`K`, `G W`); shows
  `⌘` or `Ctrl` per platform; `Escape` closes; focus returns to the trigger.
- [x] T016 Axe: extend `frontend/tests/accessibility/core.test.tsx` — the open
  `KeyboardShortcutsDialog` is axe-clean with populated groups; keyboard-only operation
  (Tab through, `Escape` closes, focus returns).

**Checkpoint**: help dialog + `.kbd` pass component/axe tests; no new tokens introduced.

---

## Phase 5: Verification & documentation

**Purpose**: Whole-repo gates and visual-language bookkeeping (spec §19, §17, plan §13/§15).

- [x] T017 Full verification: `npm run typecheck -w frontend`, `npm run lint -w frontend`,
  `npm run test -w frontend`, `npm run build -w frontend`; backend typecheck + lint + full
  test suite as a no-change regression gate; confirm `git status`/`git diff` shows zero
  backend/shared diffs and no new package-lock dependency additions.
- [x] T018 Walk the Visual Review Checklist (§19, §10); update `frontend/VISUAL_LANGUAGE.md`
  to document the `.kbd` key-cap pattern (where used, spacing, typography, interaction, when
  NOT to use — never for Badge/status) since it is a genuinely new reusable pattern (D-08);
  confirm every other element reuses existing patterns, else state explicitly.
- [x] T019 Regression re-run of the **complete** frontend suite (incl. `layout-search.test.tsx`,
  `search-dialog.test.tsx`, Quick Edit suites) to prove `/`+`Ctrl/K` and modal behavior are
  unchanged; walk spec §18 acceptance scenarios manually.

**Checkpoint**: all suites pass; docs updated or explicitly unchanged; feature complete.

---

## Dependencies

`Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5`. T001–T004 are parallelizable
build blocks; T005 must follow T001–T004. T006/T007 (Phase 1) complete the modal guard
before Phase 2 relies on it. T008/T009 are parallel after T001–T005; T010 follows T008.
T011 (Phase 3) needs the hook (T002) and dispatcher (T001). T013 precedes T014/T015/T016
(same phase; T014 is parallelizable). T017–T019 (verification) run last.
**Checkpoint**: modal suppression active; existing Dialog/axe tests unchanged and green.