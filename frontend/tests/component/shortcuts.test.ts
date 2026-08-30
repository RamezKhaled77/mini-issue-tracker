import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import {
  SEQUENCE_MS,
  cancelPendingSequence,
  ensureDispatcher,
  isTypingContext,
  registerBindings,
} from "../../src/lib/shortcuts.js";
import type { ShortcutBinding } from "../../src/lib/shortcuts.js";
import { registerModal, resetModalLayer, unregisterModal } from "../../src/lib/modalLayer.js";

afterEach(() => {
  document.body.innerHTML = "";
  resetModalLayer();
  cancelPendingSequence();
});

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document.body, { key, ...init });
}

function binding(partial: Partial<ShortcutBinding> & { id: string }): ShortcutBinding {
  return {
    keys: ["e"],
    context: "issue",
    group: "Issue",
    description: partial.id,
    action: () => {},
    ...partial,
  };
}

describe("isTypingContext", () => {
  it("returns true for input/textarea/select/contenteditable", () => {
    const input = document.createElement("input");
    expect(isTypingContext(input)).toBe(true);
    const textarea = document.createElement("textarea");
    expect(isTypingContext(textarea)).toBe(true);
    const select = document.createElement("select");
    expect(isTypingContext(select)).toBe(true);
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(isTypingContext(editable)).toBe(true);
  });

  it("returns false for neutral elements and null", () => {
    const div = document.createElement("div");
    expect(isTypingContext(div)).toBe(false);
    expect(isTypingContext(null)).toBe(false);
  });
});

describe("dispatcher", () => {
  it("fires a single-key binding in a neutral context", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([binding({ id: "t.e", action })]);
    press("e");
    expect(action).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("does not fire while focus is inside an input", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([binding({ id: "t.e", action })]);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    press("e");
    expect(action).not.toHaveBeenCalled();
    dispose();
  });

  it("does not fire while a modal is open (FR-06)", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([binding({ id: "t.e", action })]);
    registerModal();
    press("e");
    expect(action).not.toHaveBeenCalled();
    unregisterModal();
    press("e");
    expect(action).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("respects an enabled gate that returns false", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([
      binding({ id: "t.e", enabled: () => false, action }),
    ]);
    press("e");
    expect(action).not.toHaveBeenCalled();
    dispose();
  });

  it("matches Ctrl/Cmd+K but ignores plain/alt variants (FR-05)", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([
      binding({
        id: "t.k",
        keys: ["k"],
        isMod: true,
        group: "Global",
        context: "global",
        action,
      }),
    ]);
    press("k", { ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
    press("k", { metaKey: true });
    expect(action).toHaveBeenCalledTimes(2);
    // Naked k is not the combo.
    press("k");
    // Alt combos are never hijacked.
    press("k", { ctrlKey: true, altKey: true });
    expect(action).toHaveBeenCalledTimes(2);
    dispose();
  });

  it("matches / and ? (shift key ignored for ?)", () => {
    const slash = vi.fn();
    const help = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([
      binding({ id: "t.slash", keys: ["/"], group: "Global", context: "global", action: slash }),
      binding({ id: "t.q", keys: ["?"], group: "Global", context: "global", action: help }),
    ]);
    press("/");
    expect(slash).toHaveBeenCalledTimes(1);
    press("?", { shiftKey: true });
    expect(help).toHaveBeenCalledTimes(1);
    dispose();
  });
});

describe("sequence handling (G then …)", () => {
  it("executes G then D", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([
      binding({ id: "t.d", keys: ["g", "d"], group: "Global", context: "global", action }),
    ]);
    press("g");
    expect(action).not.toHaveBeenCalled();
    press("d");
    expect(action).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("cancels on an unrelated second key", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([
      binding({ id: "t.d", keys: ["g", "d"], group: "Global", context: "global", action }),
    ]);
    press("g");
    press("x");
    press("d");
    expect(action).not.toHaveBeenCalled();
    dispose();
  });

  it("times out after SEQUENCE_MS", () => {
    vi.useFakeTimers();
    try {
      const action = vi.fn();
      ensureDispatcher();
      const dispose = registerBindings([
        binding({ id: "t.d", keys: ["g", "d"], group: "Global", context: "global", action }),
      ]);
      press("g");
      vi.advanceTimersByTime(SEQUENCE_MS + 1);
      press("d");
      expect(action).not.toHaveBeenCalled();
      dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never arms a sequence while typing in an input (FR-07)", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([
      binding({ id: "t.d", keys: ["g", "d"], group: "Global", context: "global", action }),
    ]);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    press("g"); // silently ignored while typing
    input.blur();
    press("d");
    expect(action).not.toHaveBeenCalled();
    dispose();
  });

  it("never arms a sequence while a modal is open (FR-07)", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([
      binding({ id: "t.d", keys: ["g", "d"], group: "Global", context: "global", action }),
    ]);
    registerModal();
    press("g");
    unregisterModal();
    press("d");
    expect(action).not.toHaveBeenCalled();
    dispose();
  });
});

describe("registerBindings", () => {
  it("returns a dispose that removes exactly the registered ids", () => {
    const action = vi.fn();
    ensureDispatcher();
    const dispose = registerBindings([binding({ id: "t.e", action })]);
    press("e");
    expect(action).toHaveBeenCalledTimes(1);
    dispose();
    press("e");
    expect(action).toHaveBeenCalledTimes(1);
  });
});