import { afterEach, describe, expect, it, vi } from "vitest";
import { kbdKey, keysToDisplay, modLabel } from "../../src/lib/kbd.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("modLabel", () => {
  it("returns ⌘ on macOS", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(modLabel()).toBe("\u2318");
  });

  it("returns Ctrl elsewhere", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    expect(modLabel()).toBe("Ctrl");
  });
});

describe("kbdKey", () => {
  it("uppercases single letters", () => {
    expect(kbdKey("g")).toBe("G");
    expect(kbdKey("d")).toBe("D");
  });

  it("keeps literals as-is", () => {
    expect(kbdKey("/")).toBe("/");
    expect(kbdKey("?")).toBe("?");
  });
});

describe("keysToDisplay", () => {
  it("formats a sequence without a modifier", () => {
    expect(keysToDisplay(["g", "d"])).toEqual(["G", "D"]);
  });

  it("prepends the platform modifier for modifier combos", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(keysToDisplay(["k"], true)).toEqual(["\u2318", "K"]);
  });
});