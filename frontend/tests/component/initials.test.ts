import { describe, expect, it } from "vitest";
import { initialsFromName } from "../../src/lib/initials.js";

describe("initialsFromName", () => {
  it("takes the first character of the first and last word for multi-word names", () => {
    expect(initialsFromName("Alice Smith")).toBe("AS");
    expect(initialsFromName("John Quincy Adams")).toBe("JA");
  });

  it("uses the first character only for single-word names", () => {
    expect(initialsFromName("Cher")).toBe("C");
  });

  it("uppercases the initials", () => {
    expect(initialsFromName("alice smith")).toBe("AS");
  });

  it("handles unusual spacing by trimming and splitting on whitespace", () => {
    expect(initialsFromName("  Alice   Smith  ")).toBe("AS");
  });

  it("returns '?' when the name is empty", () => {
    expect(initialsFromName("")).toBe("?");
  });

  it("returns '?' when the name is only whitespace", () => {
    expect(initialsFromName("   ")).toBe("?");
  });

  it("does not crash on names with multiple consecutive spaces", () => {
    expect(initialsFromName("Alice   ")).toBe("A");
  });
});