/**
 * Modal-presence registry (Spec 009 — Keyboard Shortcuts / FR-06).
 *
 * A tiny register/unregister counter so the shortcut dispatcher knows a modal overlay is
 * open and can suppress all global/contextual shortcuts (and never arm a sequence). The
 * `Dialog` component reports its open state here via React effects. Escape/Tab/focus-return
 * remain owned by `Dialog`.
 */

let openCount = 0;

export function registerModal(): void {
  openCount += 1;
}

export function unregisterModal(): void {
  if (openCount > 0) openCount -= 1;
}

export function isModalOpen(): boolean {
  return openCount > 0;
}

/** Test-only reset. */
export function resetModalLayer(): void {
  openCount = 0;
}