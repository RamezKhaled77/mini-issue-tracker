import { useEffect } from "react";
import type { DependencyList } from "react";
import {
  ensureDispatcher,
  registerBindings,
} from "./shortcuts.js";
import type { ShortcutBinding } from "./shortcuts.js";

/**
 * Mounts the shortcut dispatcher and registers the given bindings for the lifetime of the
 * caller (spec D-02). Re-runs whenever `deps` change, re-registering with fresh closures —
 * pass any state the `enabled`/`action` closures read (e.g. an issue being loaded).
 */
export function useKeyboardShortcuts(
  bindings: ShortcutBinding[],
  deps: DependencyList
): void {
  useEffect(() => {
    ensureDispatcher();
    return registerBindings(bindings);
    // The effect intentionally depends only on `deps`, which the caller supplies.
  }, deps);
}