# Spec 009 — Keyboard Shortcuts

> **Stage 1 — research + specification only.** No implementation code is changed in
> this stage. This document defines the product intent; `plan.md` in this folder carries
> the implementation plan for the operator-approved pass that follows.

> **Naming note (explicit decision, per Constitution §IX).** This folder is named
> `009-keyboard-shortcuts` to follow the requested numbering, but a numbering collision
> exists: `specs/009-saved-views` and `specs/010-quick-edit` already occupy `009`/`010`.
> The next unused number in the existing sequence is **`011`**. Recommendation: if numeric
> ordering must be unique, rename this folder to `specs/011-keyboard-shortcuts` before
> implementation and update all cross-references. This is recorded in §20 (D-09) and
> flagged for operator review (§22 Q-01).

## 1. Summary

Add a small, deliberate set of **keyboard shortcuts** that make the Mini Issue Tracker
feel faster for keyboard-heavy users, layered on top of the existing interaction model.
The feature is an **interaction/productivity enhancement, not a visual redesign**.

It introduces:

- a **centralized shortcut registry** so shortcuts have one source of truth instead of
  scattered `keydown` listeners,
- a set of **global navigation shortcuts** (Dashboard, My Issues) plus a lightweight
  **`G` then … two-key sequence**,
- **contextual issue-page shortcuts** (Edit, Delete → confirmation only, Comment focus),
- a **Keyboard Shortcuts help dialog** opened by `?` for discoverability,
- a **shared input/focus guard** so no shortcut ever fires while a user is typing or inside
  a modal.

The **existing** Global Search shortcuts (`/` and `Ctrl/Cmd + K`) are reserved, preserved
verbatim, and deliberately **not** duplicated. The existing search overlay, `Dialog`
focus-trap/Escape/ArrowUp/ArrowDown/Enter/focus-return behavior remain untouched.

This is **not** a command palette, and it must never drift into one.

## 2. Motivation

- Today the only global shortcut is Global Search. Reaching the Dashboard, My Issues, or a
  contained issue action requires the mouse or Tab-heavy navigation.
- Keyboard shortcuts are the natural companion to a dense editorial workbench: they make
  repeated operations faster without changing the visual surface.
- There is currently **one** `keydown` listener in the shell (`Layout.tsx`) plus localized
  behavior in `Dialog.tsx` (Escape/Tab), `SearchDialog.tsx` (arrows/Enter), and Quick Edit
  (Escape). Adding more ad-hoc listeners across pages would create conflicting, duplicate,
  and undocumented bindings — the registry removes that risk up front.

## 3. Research findings (implementation-grounded)

| Question | Finding |
|---|---|
| Where does keyboard handling exist today? | `Layout.tsx:26-37` owns `/` (`key === "/"`, no ctrl/meta/alt) and `Ctrl/Cmd+K`, typing-guarded by a local `isTypingContext` (`INPUT`/`TEXTAREA`/`SELECT`/`contenteditable`). `Dialog.tsx:29-54` owns document-level Escape (`stopPropagation` + `onClose`) and Tab focus trap. `SearchDialog.tsx:93+` owns ArrowUp/ArrowDown/Enter inside the overlay. `QuickEditSelect.tsx` / `QuickEditPopover.tsx` own Escape. |
| What routes exist? | `/` → DashboardPage (workspace selector); `/my-issues` → MyIssuesPage; `/workspaces/:workspaceId` → WorkspacePage; `/workspaces/:workspaceId/issues/:issueId` → IssuePage. All under a `Protected` + `Layout` shell (`App.tsx`). |
| Is there a global "current workspace"? | No. Workspace identity is route-encoded (`:workspaceId`). There is no persisted or otherwise globally available "current workspace". `G then W` for a global target is therefore undefined. |
| Can `J/K` (previous/next issue) be derived today? | IssuePage loads a single issue by id (`api.get('/issues/:id')`) plus comments/activity. There is no global issue list, no deterministic cross-project ordering, and no ordering endpoint. Previous/next would require loading the parent project's list to derive order (extra fetch + ordering semantics) or a new endpoint (backend change). Awkward or fake at current scale. |
| What does `?` collide with? | `?` is `Shift + /` on US layouts. The current Layout handler matches only unshifted `/` (`event.key === "/"`); a Shift-pressed `/` reports key `"?"` and does **not** match. So `?` is currently unclaimed. Caveat: on many international layouts `/` or `?` require a modifier, so help must also be reachable by a visible UI affordance, never `?` alone. |
| Is there an existing key-cap/kbd visual pattern? | No `<kbd>` styles exist (`tokens.css`, `components.css` have none). Badges are semantic (status/priority/label) and would be overloaded if reused for keys. A minimal `.kbd` treatment is warranted but must use existing tokens. |
| Does a modal-close suppress global shortcuts today? | No. The `Layout` `/` handler checks only typing context, not "modal open". When a non-input dialog (e.g. delete/edit confirm) is open and focus sits on the panel (a `div`, not an input), `/` and `Ctrl+K` currently open search on top of the dialog. Latent pre-existing issue worth correcting. |
| Is there a modal-presence signal? | `Dialog.tsx` renders `role="dialog"` `aria-modal="true"` and manages its own listeners. There is no app-wide "a modal is open" signal; one is needed for a correct global-suppression rule. |

### Decision D-01 — No backend changes

Keyboard shortcuts are pure client interaction behavior. There is no database table, API
endpoint, or shared backend contract change. `J/K` would require backend/API support and is
rejected for v1 (§4.3); nothing else needs it.

### Decision D-02 — Centralized shortcut registry (frontend only)

Introduce a single module (`frontend/src/lib/shortcuts.ts`) plus a `useKeyboardShortcuts`
hook as the **one** source of truth for shortcut definitions, guards, context scoping, and
sequence handling. This replaces the ad-hoc `Layout` listener and gives pages a way to
register contextual shortcuts. It **does not** claim ownership of `Escape`, `Tab`, or the
arrow navigation inside `Dialog` / `SearchDialog`; it coexists with, and defers to, those
existing components.

### Decision D-03 — `/` and `Ctrl/Cmd+K` remain reserved by Global Search

Global Search's two shortcuts and their exact behavior (typing-guard, `preventDefault`,
open-state owned by `Layout`) are preserved verbatim. The registry treats them as
**reserved, non-overridable** bindings. The registry may *host* the definitions for a single
list (so Help can display them) but must not alter behavior.


## 4. Proposed shortcut set and decision per candidate

Legend: **v1** = include now · **defer** = agreed later, documented · **reject** = not now.

| Shortcut | Action | Verdict | Reason |
|---|---|---|---|
| `/` | Open search | existing (reserved) | Already implemented (Spec 008). Do not duplicate. |
| `Ctrl/Cmd + K` | Open search | existing (reserved) | Already implemented. Do not duplicate. |
| `G` then `D` | Dashboard / workspace selector (`/`) | **v1** | Static route in shell; safe, deterministic, type-guarded + modal-guarded. |
| `G` then `M` | My Issues (`/my-issues`) | **v1** | Static route in shell; safe and deterministic. |
| `G` then `W` | "Current workspace" | **defer** | No global "current workspace" exists (route-encoded only). A contextual variant could be added later; not in v1. |
| `E` | Edit current issue (IssuePage) | **v1** | Opens the existing Edit dialog (`setEditOpen(true)`). Non-destructive, no browser conflict. |
| `D` | Delete current issue (IssuePage) | **v1** | Opens the existing Delete **confirmation** dialog (`setDeleteOpen(true)`). Never deletes directly. |
| `C` | Focus comment composer (IssuePage) | **v1** | Focuses the existing comment textarea. Safe, no browser conflict. |
| `J` / `K` | Previous / next issue | **reject** | Requires a source list or ordering the current model doesn't provide (D-01/D-04). Would be fake or awkward. |
| `Esc` | Close active dialog / temporary UI | existing (reserved) | Owned by `Dialog`, Quick Edit, etc. **Not** globally hijacked. |
| `?` | Open Keyboard Shortcuts help | **v1** | Primary discoverability; typing- and modal-guarded, never the only path. |

### 4.1 Why the chosen set feels like Mini Issue Tracker

The set is deliberately small and context-scoped: two global navigation sequences, three
issue-page actions, and help. It reinforces fast, predictable, discoverable, unobtrusive
behavior without creating a command-palette. No mysterious single-key actions in loose
contexts.

### 4.2 Evaluation notes against existing routes

- `G then D` and `G then M` map to existing, static, always-reachable routes under the
  shell; no extra data is needed and no authorization is bypassed (both routes are already
  protected and the shell is required for the listener to exist).
- `G then W` is undefined globally (no current-workspace concept) — the honest choice is to
  defer rather than invent a target.

### 4.3 `J/K` rejection rationale (decision)

IssuePage has only the single issue by id. To navigate previous/next cleanly the app would
need a deterministic ordering over a known list. Project issue lists exist but are
project-scoped, and My Issues lists are workspace-mixed with configurable sorting — no
single global order exists. Deriving "next" from whichever list the user last saw is not
tracked and would be fake. Adding an order endpoint is an unapproved backend change (D-01).
As a result `J/K` is **rejected** rather than faux-implemented. If a future
"related/recent issues" source of truth emerges, revisit behind a real data model.

## 5. Non-goals

This feature MUST NOT include:

- command palette / launcher
- customizable shortcuts or user-defined mappings
- Vim mode, macro recording
- shortcut analytics or synchronization
- organization-wide shortcut configuration
- a shortcut for every button
- a global Delete or global Edit shortcut
- `J`/`K` previous/next navigation in v1
- realtime collaboration
- backend/database/API/shared-contract changes (D-01)

## 6. User stories

- **US-1** — As a keyboard-heavy user, I press `G` then `D` from the workspace or issue page
  and land on the Dashboard / workspace selector without using the mouse.
- **US-2** — As a keyboard-heavy user, I press `G` then `M` and land on My Issues.
- **US-3** — As a user on an issue page, I press `E` to open Edit, `D` to open the Delete
  confirmation, and `C` to focus the comment composer — without touching the mouse.
- **US-4** — As a user, pressing `D` never deletes directly; it only opens the existing
  confirmation dialog, so destructive action stays gated.
- **US-5** — As a new user, I press `?` and see a compact, honest list of the shortcuts that
  are actually active right now, with platform-appropriate modifiers (`⌘` on macOS, `Ctrl`
  elsewhere).
- **US-6** — As a user typing anywhere (input, textarea, select, contenteditable, comment
  composer, dialog fields), no shortcut fires and my typing is never interrupted.
- **US-7** — As a screen-reader user, the help dialog is fully keyboard accessible and no
  noisy readings are triggered on every keypress; every shortcut action remains available
  through the normal UI.


## 7. Functional requirements

### FR-01 Centralized registry
There is exactly one source of truth for shortcut definitions (id, key, modifiers,
context, description, action, enabled state) plus the shared guards. No page adds its own
`window/keydown` listener for shortcut purposes.

### FR-02 Global shortcuts
- `G` then `D` → navigate to `/`.
- `G` then `M` → navigate to `/my-issues`.
- `?` → open the Keyboard Shortcuts help dialog.
- `/` and `Ctrl/Cmd + K` → retained exactly as implemented (Spec 008), reserved and
  non-overridable.

### FR-03 Contextual shortcuts (IssuePage only)
- `E` → open the existing Edit dialog.
- `D` → open the existing Delete **confirmation** dialog (never a direct delete).
- `C` → focus the comment composer textarea.

### FR-04 Input / focus guard (centralized, reusable)
Shortcuts MUST NOT fire while focus is in: `input`, `textarea`, `select`,
`contenteditable`, the search field, the comment composer, or any dialog form field.
Exception only for shortcuts explicitly designed for typing contexts (none in v1).

### FR-05 Modifier safety
Do not intercept when the event is part of a `Ctrl`/`Cmd` or `Alt` combination unless that
combination is explicitly owned (`Ctrl/Cmd + K` is the approved exception). No v1 shortcut
uses `Alt`, or relies on `Shift` other than `?` (`Shift + /`, see D-06), or binds `Tab`,
`Space`, or the arrows.

### FR-06 Modal suppression
While any `Dialog` (or equivalent modal overlay) is open, all Global and Contextual
shortcuts are suppressed. `Escape` and the modal's own internal keyboard behavior remain
owned by the modal. `?` is also suppressed while a modal is open.

### FR-07 Sequence handling (`G` then key)
- Pressing `G` (in a non-typing, non-modal context) arms a short-lived pending state.
- A second valid key (`D` or `M`) within the window executes and clears the state.
- An unrelated key clears the pending state without action.
- A timeout clears the pending state (default derived in D-07).
- Typing inside inputs or opening a modal never arms the sequence.
- No visible UI disruption and no stuck pending state.

### FR-08 Help dialog
- Opened by `?` and by a visible UI affordance (see FR-09).
- Reuses the existing `Dialog`.
- Groups shortcuts: **Global** (Search, Dashboard, My Issues) and **Issue** (Edit, Delete,
  Comment).
- Shows platform-appropriate modifiers (`⌘` on macOS, `Ctrl` otherwise).
- Lists only shortcuts actually active in the current app; never displays deferred/rejected.
- Keyboard-key visual treatment (`.kbd`) consistent with product typography/tokens.
- `Escape` closes it; focus returns to the element that opened it.

### FR-09 Discoverability beyond `?`
`?` must not be the only way. Help is reachable via a normal UI trigger (see §10), so
international-layout users are not locked out.

## 8. Non-functional requirements

- **Performance:** one registry `keydown` listener; matching O(bindings); one sequence
  timeout; no new network requests; no per-keystroke re-render storms.
- **Consistency:** shortcut semantics stable and documented in one place; help renders from
  the registry so they can never drift apart.
- **Maintainability:** definitions are typed data (add a shortcut = add one entry).
- **Accessibility:** see §12.
- **Platform:** nominal macOS (`⌘`) and Windows/Linux (`Ctrl`) display; definitions use a
  platform-independent `Mod` modifier shorthand.
- **No data fabrication:** every help line corresponds to a real, active shortcut backed by
  real state.

## 9. UX requirements

- **Discoverable, not memorized:** help dialog is primary; sidebar tooltips mention primary
  navigation where natural (never regress the existing "Search (/)" tooltip).
- **Predictable:** same key, same action, same context, every time; semantics change only by
  context (IssuePage vs shell).
- **Reversible / safe:** destructive (`D`) only opens a confirm dialog; navigation is
  standard route changes (browser Back works).
- **Unobtrusive:** no toast, no flashy hint on every keypress. A quiet, short-lived,
  reduced-motion-safe hint may confirm a registered shortcut's action but is not required.
- Never break normal UI paths; shortcuts are additive, not replacements.

## 10. Visual language requirements

Per `frontend/VISUAL_LANGUAGE.md` the change must extend, not replace, the editorial
workbench language. Existing patterns that apply:

- **Dialog** (`.dialog-overlay` / `.dialog`, focus trap, Escape, focus return) for the help
  surface — §19b shows how Dialog composes a compact surface.
- **Section eyebrows / mono uppercase labels** (`section-eyebrow`) for group headings
  ("GLOBAL", "ISSUE").
- **Ruled rows / hairline borders** for grouped shortcut lists, echoing ledger rhythm (§19,
  §25) — not a card grid.
- **Typography scale** (§10): `--text-meta`/`--text-label` for labels; `--text-mono` for keys.
- **Tokens** — colors, spacing, radii, borders only from `tokens.css`; no new colors.

New reusable pattern (genuinely required, D-08): a minimal **key-cap** treatment (`.kbd`:
mono type, `--radius-sm`, hairline/subtle surface, no elevation) for key names in the help
dialog and any tooltip. Rationale: no existing pattern fits (Badge is semantic; plain text
reads poorly). It stays visually quiet and is documented in `VISUAL_LANGUAGE.md`.

The help dialog stays **compact and editorial**; a settings page or launcher is out of
scope.


## 11. Responsive requirements

- The help dialog reuses `Dialog` responsive behavior: at ≤700px it fills width; at ≤375px
  it goes near-full-screen (§31). No horizontal overflow.
- Key-cap rows reflow to stacked rows on narrow widths, keeping the key and its label
  visible (never hide the key).
- Coarse pointers: any interactive element in the dialog must meet the 44px touch-target
  rule.
- Shortcuts are a **progressive enhancement**: they operate wherever a hardware keyboard
  emits events (including tablets with external keyboards) and need no touch-specific work;
  touch users still reach all features through the normal UI.

## 12. Accessibility requirements

Preserve and extend existing behavior:

- Dialog focus trap, `role="dialog"` + `aria-modal="true"`, labelled title, focus-return,
  Escape-close — all inherited from `Dialog`.
- Keyboard-only operation of the help dialog (Tab, Escape, focus).
- Skip link, focus-visible outlines, reduced-motion all unchanged.
- Input/focus guard prevents interference with typing anywhere (§FR-04).
- Modal suppression prevents shortcut/underlying-page conflicts (§FR-06).
- No color alone communicates shortcuts; keys are text/mono plus the `.kbd` treatment.
- Screen readers receive **no** per-keypress announcements for shortcuts that don't change
  focus; navigation via `react-router` already announces page titles. The help dialog is
  semantic (headings, list items).
- Every shortcut action remains available through the normal UI (buttons/links already
  exist for Dashboard, My Issues, Edit, Delete, Comment, Search).

### Axe

The help dialog open (with content) must be axe-clean; extend
`frontend/tests/accessibility/core.test.tsx`.

## 13. Error / edge cases

- **Shortcut while typing**: guard suppresses it; characters still type (no `preventDefault`).
- **Shortcut while modal open**: suppressed; modal behavior wins.
- **`G` press then timeout / unrelated key / new modal**: pending state cleared; no action,
  no stuck state.
- **`?` on international layout**: may be `Shift+/`; a visible UI affordance still opens
  help (D-06).
- **`D` pressed but delete fails server-side**: the existing delete-dialog error path runs;
  the shortcut only opened the dialog, it never owns the outcome.
- **IssuePage context**: if the issue is still loading, `E`/`D`/`C` are no-ops (no dialog to
  open / no composer yet).
- **Help open, `?` pressed again**: suppressed (modal rule); help closes only via `Escape`,
  overlay/focus-outside, or the close action, per `Dialog`.
- **Browser reserved combos**: v1 avoids `Ctrl/Cmd+` beyond `K` and never binds F-keys,
  `Space`, `Tab`, or arrows globally.

## 14. Security considerations

- No new surface: shortcuts only invoke existing, authorized routes and existing dialogs.
- `D` (Delete) never bypasses confirmation; the destructive API call still goes through the
  existing button flow and server-side authorization.
- Navigation shortcuts call `navigate(...)` to already-protected routes; targets are static
  constants, never user input.
- No new data read/write, no payload, nothing to sanitize beyond existing behavior.

## 15. Data considerations

- **No backend, database, or shared-contract changes** (D-01). No new endpoints, tables, or
  types.
- The registry's definitions and help text are static data authored in code — real and
  honest; help lists only shortcuts that are registered and active.
- No invented routes, ordering, or navigation targets (the reason `G then W` is deferred
  and `J/K` rejected).


## 16. Performance considerations

- A single `document` `keydown` listener (replacing/absorbing the current one in `Layout`)
  runs guard + registry matching; O(bindings) per event, negligible.
- Sequence state uses one timeout; cleared on unmount to avoid leaks.
- No extra renders beyond the affected component setting its normal state (open dialog /
  navigate); no network requests.

## 17. Testing requirements

The plan must cover automated tests for:

1. **Global**: `/` opens search; `Ctrl/Cmd+K` opens search; existing search behavior
   unchanged (Layout + SearchDialog suites stay green).
2. **Input protection**: shortcuts do not fire inside `input`, `textarea`, `select`,
   `contenteditable`, search field, comment composer, dialog fields.
3. **Context**: issue shortcuts only on IssuePage; global shortcuts work from normal
   application pages; dialog shortcuts do not leak into the underlying page (modal
   suppression).
4. **Destructive action**: `D` opens the existing confirmation dialog and never deletes
   directly.
5. **Sequence**: `G then D`, `G then M` work; invalid second key cancels; timeout resets;
   typing does not start a sequence; an open dialog does not start a sequence.
6. **Help**: `?` opens the dialog; lists only active shortcuts; `Escape` closes; focus
   returns correctly.
7. **Platform**: macOS shows `⌘`, Windows/Linux shows `Ctrl`.
8. **Accessibility**: axe coverage for the help dialog; keyboard-only operation.
9. **Regression**: complete existing frontend + backend suites, typecheck, lint, build.

## 18. Acceptance scenarios

1. From `/workspaces/ws-1` I press `G` then `D` → I land on `/` (workspace selector).
2. From `/workspaces/ws-1/issues/iss-1` I press `G` then `M` → I land on `/my-issues`.
3. On IssuePage, `E` opens Edit; `D` opens Delete confirmation; `C` focuses the comment
   composer. None fire while I'm typing in the composer textarea.
4. Pressing `D` alone never deletes; only the confirmation button performs the delete
   (server-authorized as today).
5. While a dialog is open, `G`, `?`, `E`, `D` do nothing to the underlying page.
6. `?` opens help; it lists Search (`/`, `Ctrl/⌘ + K`), Dashboard `G D`, My Issues `G M`,
   and Issue actions `E`/`D`/`C`, with `Ctrl` vs `⌘` correct for the platform. `Escape`
   closes; focus returns to the trigger.
7. Typing `G` then `X` (unrelated) does nothing and the pending state clears; typing `G`
   inside a field never arms a sequence.
8. Screen readers: help dialog is axe-clean and keyboard-operable; no per-keypress
   announcements.

## 19. Success criteria

- A keyboard user can open Search, Dashboard, My Issues and perform Edit / Delete / Comment
  focusing entirely from the keyboard.
- Zero interference with typing or modal behavior (proven by tests).
- No destructive shortcut bypasses confirmation.
- The help dialog renders only real, active shortcuts and is axe-clean.
- The visual language is extended (`.kbd`) but not replaced; `VISUAL_LANGUAGE.md` documents
  the new pattern (D-08).
- Frontend suites, backend suites (unchanged), typecheck, lint, build, and axe all green.

## 20. Explicit decisions

- **D-01** — No backend/database/shared-contract changes.
- **D-02** — Centralized shortcut registry + `useKeyboardShortcuts` hook as one source of
  truth; `Escape`/`Tab`/arrows remain owned by `Dialog`/`SearchDialog`/Quick Edit.
- **D-03** — `/` + `Ctrl/Cmd+K` reserved by Global Search, preserved verbatim, displayed in
  help but not reimplemented.
- **D-04** — `J/K` rejected for v1 (no deterministic order; D-01).
- **D-05** — `G then W` deferred (no global "current workspace"; route-encoded only).
- **D-06** — `?` opens help but is never the only discovery path (international layouts);
  a visible UI affordance opens help too. `?` is typing- and modal-guarded.
- **D-07** — Sequence timeout default. There is no prior keyboard "short-lived pending"
  convention in the app, so a constant is genuinely new and documented: an **`800ms`**
  window (between the 120–180ms transitions and the 250ms search debounce; deliberate
  two-key `G…M` feels responsive without being a hidden combo). Recorded as a named
  constant in the registry module; revisit only if evidence shows it's fragile.
- **D-08** — A minimal reusable `.kbd` key-cap pattern is required (no existing fit);
  documented in `VISUAL_LANGUAGE.md`; the help dialog otherwise reuses `Dialog`, eyebrows,
  ruled-row/hairline rhythm, and existing tokens.
- **D-09** — Folder naming collision: preferred next number is `011` (see §22 Q-01).

## 21. Alternatives considered

- **One `keydown` listener per component** — rejected: duplicates definitions, conflicts,
  hidden shortcuts, violates the one-source-of-truth goal (D-02).
- **Using Badge for key display in help** — rejected: Badge is semantic (status/priority/
  label); overloading corrupts meaning. `.kbd` is cleaner (D-08).
- **Global `G then D/M/W` including W** — `W` partially rejected/deferred (no current
  workspace); the two static targets are safe.
- **Previous/next via project-list fetch** — rejected: extra per-page fetch, ambiguous
  order, fake semantics (D-04).
- **No help dialog, tooltips only** — rejected: discoverability and a11y favor a compact
  reference surface.
- **Guard as a helper vs a hook** — the guard is centralized regardless; chosen as a plain
  testable guard function in `lib/shortcuts.ts` plus the hook (guard is stateless and
  belongs with the definitions).

## 22. Open questions (operator review)

- **Q-01** — Folder number: keep `009` (requested) or rename to `011` for uniqueness?
  Recommendation: `011-keyboard-shortcuts`.
- **Q-02** — Confirm the `800ms` sequence window (D-07) or prefer a different value.
- **Q-03** — Should v1 also accept a contextual `G W` on workspace-scoped routes as an
  additive, honest variant?
- **Q-04** — Where should the visible non-`?` help affordance live (e.g. quiet footer hint,
  dashboard header button)? Recommendation: a quiet sidebar-footer help hint consistent
  with icon-rail/top-bar responsive behavior.

## 23. Out of scope

Command palette, custom mappings, Vim/macros, analytics/sync, org-wide config, per-button
shortcuts, global Delete/Edit, `J/K`, backend/data changes, visual redesign, and any
shortcut that hijacks browser/system bindings beyond the approved set.

## 24. Hard requirement for Stage 2

- No shortcut may bypass an existing confirmation or authorization gate.
- Every shortcut action must remain reachable through the normal UI.
- The registry is the only place shortcuts are defined; help renders from it.

---

*End of spec.md (Stage 1). The implementation plan lives in `plan.md` in this folder.
No implementation code was changed in this stage.*
