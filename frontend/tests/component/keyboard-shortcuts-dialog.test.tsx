import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KeyboardShortcutsDialog } from "../../src/components/KeyboardShortcutsDialog.js";
import { registerBindings } from "../../src/lib/shortcuts.js";
import type { ShortcutBinding } from "../../src/lib/shortcuts.js";
import { resetModalLayer } from "../../src/lib/modalLayer.js";

function binding(partial: Partial<ShortcutBinding> & { id: string }): ShortcutBinding {
  return {
    keys: ["?"],
    context: "global",
    group: "Global",
    description: partial.id,
    action: () => {},
    ...partial,
  };
}

let dispose: () => void;

beforeEach(() => {
  dispose = registerBindings([
    binding({ id: "search.slash", keys: ["/"], description: "Search issues" }),
    binding({ id: "search.modk", keys: ["k"], isMod: true, description: "Search issues" }),
    binding({ id: "help", keys: ["?"], description: "Open keyboard shortcuts" }),
    binding({ id: "nav.dashboard", keys: ["g", "d"], description: "Go to Dashboard" }),
    binding({ id: "issue.edit", keys: ["e"], context: "issue", group: "Issue", description: "Edit this issue" }),
  ]);
  resetModalLayer();
});

afterEach(() => {
  dispose();
  document.body.innerHTML = "";
  resetModalLayer();
});

function renderOpen() {
  return render(
    <KeyboardShortcutsDialog open={true} onClose={vi.fn()} />
  );
}

describe("KeyboardShortcutsDialog", () => {
  it("renders global and issue groups with active shortcuts only", () => {
    renderOpen();
    expect(screen.getByRole("heading", { level: 3, name: "Global" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Issue" })).toBeInTheDocument();
    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Edit this issue")).toBeInTheDocument();
    // Keys rendered as key-caps.
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("shows platform-appropriate modifier tokens (Ctrl on this env)", () => {
    renderOpen();
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("never lists deferred or rejected shortcuts", () => {
    renderOpen();
    expect(screen.queryByText("Previous issue")).not.toBeInTheDocument();
    expect(screen.queryByText("Next issue")).not.toBeInTheDocument();
    expect(screen.queryByText("Go to Workspace")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsDialog open={true} onClose={onClose} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the trigger after closing", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} onClick={() => setOpen(true)}>
            Open help
          </button>
          <KeyboardShortcutsDialog open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open help" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog");
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });
});