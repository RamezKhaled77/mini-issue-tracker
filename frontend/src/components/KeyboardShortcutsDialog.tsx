import { Fragment } from "react";
import { Dialog } from "./Dialog.js";
import { getRegisteredShortcuts } from "../lib/shortcuts.js";
import type { ShortcutBinding } from "../lib/shortcuts.js";
import { keysToDisplay } from "../lib/kbd.js";

/**
 * Keyboard Shortcuts help (Spec 009).
 *
 * A compact, editorial reference that composes the existing `Dialog` and renders ONLY
 * shortcuts that are currently registered and enabled — it never lists deferred or rejected
 * shortcuts (spec §7, FR-08, §24). The Issue group appears only while an issue page is
 * mounted (its contextual bindings are registered then). Platform modifiers come from
 * `kbd.ts` (`⌘` on macOS, `Ctrl` elsewhere).
 */
export function KeyboardShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const registered = getRegisteredShortcuts();
  const isActive = (binding: ShortcutBinding) =>
    !binding.enabled || binding.enabled();

  const global = registered.filter(
    (b) => b.group === "Global" && isActive(b)
  );
  const issue = registered.filter((b) => b.group === "Issue" && isActive(b));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Every action below is also available through the normal interface."
    >
      <div className="shortcuts-dialog">
        {global.length > 0 && (
          <section className="shortcuts-group-section">
            <h3 className="section-eyebrow">Global</h3>
            <ul className="shortcut-group">
              {global.map((b) => (
                <ShortcutRow key={b.id} binding={b} />
              ))}
            </ul>
          </section>
        )}
        {issue.length > 0 && (
          <section className="shortcuts-group-section">
            <h3 className="section-eyebrow">Issue</h3>
            <ul className="shortcut-group">
              {issue.map((b) => (
                <ShortcutRow key={b.id} binding={b} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </Dialog>
  );
}

function ShortcutRow({ binding }: { binding: ShortcutBinding }) {
  const display = keysToDisplay(binding.keys, binding.isMod);
  const separator = binding.isMod
    ? "+"
    : binding.keys.length > 1
      ? "then"
      : "";

  return (
    <li className="shortcut-row">
      <span className="shortcut-keys">
        {display.map((key, index) => (
          <Fragment key={`${binding.id}-${key}-${index}`}>
            {index > 0 && separator && (
              <span className="shortcut-sep" aria-hidden="true">
                {separator}
              </span>
            )}
            <kbd className="kbd">{key}</kbd>
          </Fragment>
        ))}
      </span>
      <span className="shortcut-desc">{binding.description}</span>
    </li>
  );
}