/**
 * Shortcut display helpers (Spec 009 — Keyboard Shortcuts).
 *
 * Platform-aware, pure helpers for rendering keyboard keys in the help dialog and tooltips.
 * The underlying shortcut definitions are platform-independent; only the *display* of the
 * primary modifier differs (`⌘` on macOS, `Ctrl` elsewhere) — spec §7/§8, D-06.
 */

export function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().indexOf("mac") >= 0
  );
}

/** "⌘" on macOS, "Ctrl" elsewhere. */
export function modLabel(): string {
  return isMac() ? "\u2318" : "Ctrl";
}

/** Human display for a single key token: uppercase letters; literals (`/`, `?`) as-is. */
export function kbdKey(key: string): string {
  return key.length === 1 && /[a-z]/.test(key) ? key.toUpperCase() : key;
}

/**
 * Render tokens for a binding's `keys` array. For a modifier combo (`isMod`) the first token
 * is `modLabel()` and the remaining keys follow; otherwise each key is `kbdKey`-formatted.
 * Returns an array of display strings the UI renders as key-caps.
 */
export function keysToDisplay(keys: string[], isMod?: boolean): string[] {
  if (isMod) {
    return [modLabel(), ...keys.map((k) => kbdKey(k))];
  }
  return keys.map((k) => kbdKey(k));
}