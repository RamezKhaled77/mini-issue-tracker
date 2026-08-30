import { isModalOpen } from "./modalLayer.js";

/**
 * Shortcut registry (Spec 009 — Keyboard Shortcuts).
 *
 * Single source of truth for keyboard shortcut definitions, matching, guards, and the
 * short-lived `G then …` sequence engine. Owns exactly one `document` `keydown` listener
 * (installed once by `ensureDispatcher`). It does NOT claim ownership of `Escape`, `Tab`,
 * or arrow navigation inside existing surfaces (Dialog, SearchDialog, Quick Edit) — those
 * remain owned by their components (spec D-02).
 *
 * Design decisions referenced: D-02, D-03, D-07 (`SEQUENCE_MS`), FR-01, FR-04, FR-05,
 * FR-06, FR-07.
 */

/** Two-key sequence window (spec D-07). */
export const SEQUENCE_MS = 800;

export type ShortcutContext = "global" | "issue";
export type ShortcutGroup = "Global" | "Issue";

export interface ShortcutBinding {
  /** Unique, stable id — also the registry key / help-key. */
  id: string;
  /**
   * Key sequence. Single-element = single key; multi-element = sequence (e.g. `["g","d"]`).
   * Letters are case-insensitive. Non-letter keys use the literal `event.key` value (`/`, `?`).
   */
  keys: string[];
  context: ShortcutContext;
  description: string;
  group: ShortcutGroup;
  /** Require Ctrl/Cmd (reserved modifier combos only, e.g. Ctrl/Cmd+K). */
  isMod?: boolean;
  /** Optional gate evaluated at dispatch time (e.g. issue loaded). */
  enabled?: () => boolean;
  action: (event: KeyboardEvent) => void;
}

const bindings = new Map<string, ShortcutBinding>();

let installed = false;
let pendingSequences: ShortcutBinding[] | null = null;
let pendingIndex = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** Central reusable input guard (spec FR-04). */
export function isTypingContext(element: Element | null | undefined): boolean {
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    element.getAttribute("contenteditable") === "true"
  );
}

function normalizeKey(key: string): string {
  return key.length === 1 && /[A-Za-z]/.test(key) ? key.toLowerCase() : key;
}

function acceptsModifiers(binding: ShortcutBinding, event: KeyboardEvent): boolean {
  // Never intercept Ctrl/Cmd/Alt combinations unless this binding explicitly owns a
  // modifier combo (spec FR-05). `?` via Shift is allowed (Shift is not a control modifier).
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return binding.isMod === true;
  }
  return true;
}

function modifierSatisfied(binding: ShortcutBinding, event: KeyboardEvent): boolean {
  if (!binding.isMod) return true;
  return (event.ctrlKey || event.metaKey) && !event.altKey;
}

function matchSingle(binding: ShortcutBinding, event: KeyboardEvent, key: string): boolean {
  if (normalizeKey(binding.keys[0]) !== key) return false;
  if (!acceptsModifiers(binding, event)) return false;
  if (!modifierSatisfied(binding, event)) return false;
  return true;
}

function armTimer() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => cancelPendingSequence(), SEQUENCE_MS);
}

/** Cancel any armed `G then …` sequence (spec FR-07). */
export function cancelPendingSequence() {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  pendingSequences = null;
  pendingIndex = 0;
}

function handleKeyDown(event: KeyboardEvent) {
  // Input + modal safety always win: never start or keep a sequence in these contexts.
  if (isTypingContext(document.activeElement) || isModalOpen()) {
    cancelPendingSequence();
    return;
  }

  const key = normalizeKey(event.key);

  // Pending sequence: try to extend.
  if (pendingSequences) {
    const index = pendingIndex;
    const candidates = pendingSequences.filter(
      (b) => normalizeKey(b.keys[index]) === key
    );
    if (candidates.length) {
      cancelPendingSequence();
      if (candidates.length === 1 && index + 1 >= candidates[0].keys.length) {
        event.preventDefault();
        candidates[0].action(event);
      } else {
        pendingSequences = candidates;
        pendingIndex = index + 1;
        armTimer();
      }
      return;
    }
    cancelPendingSequence(); // unrelated key cancels
  }

  const active = bindings.values();

  for (const binding of active) {
    if (binding.keys.length !== 1) continue;
    if (!matchSingle(binding, event, key)) continue;
    if (binding.enabled && !binding.enabled()) continue;
    event.preventDefault();
    binding.action(event);
    return;
  }

  // Sequence starters (e.g. `G`): arm a short-lived pending state.
  const starters = Array.from(bindings.values()).filter(
    (b) =>
      b.keys.length > 1 &&
      normalizeKey(b.keys[0]) === key &&
      (!b.enabled || b.enabled())
  );
  if (starters.length) {
    cancelPendingSequence();
    pendingSequences = starters;
    pendingIndex = 1;
    armTimer();
    event.preventDefault();
  }
}

/** Idempotent — installs the single dispatcher listener once (module singleton). */
export function ensureDispatcher(): void {
  if (installed) return;
  installed = true;
  document.addEventListener("keydown", handleKeyDown);
}

/**
 * Register shortcut bindings. Returns a dispose function that removes exactly these ids,
 * so hooks can clean up on unmount / re-register on dependency change.
 */
export function registerBindings(entries: ShortcutBinding[]): () => void {
  const ids = entries.map((e) => e.id);
  for (const e of entries) bindings.set(e.id, e);
  return () => {
    for (const id of ids) bindings.delete(id);
    // If no sequence starter remains registered, no pending action can be meaningful.
    const stillHasSequence = Array.from(bindings.values()).some((b) => b.keys.length > 1);
    if (!stillHasSequence) cancelPendingSequence();
  };
}

/** Snapshot of registered shortcuts (used by the help dialog). */
export function getRegisteredShortcuts(): ShortcutBinding[] {
  return Array.from(bindings.values());
}