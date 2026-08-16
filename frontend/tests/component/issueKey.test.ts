import { describe, expect, it } from "vitest";
import { issueKey } from "../../src/lib/issueKey.js";

describe("issueKey", () => {
  it("derives a short uppercase key from the real issue id", () => {
    expect(issueKey("1f2e3d4c-b5a6-7890-abcd-ef0123456789")).toBe("#1F2E3D");
  });

  it("strips separators before shortening", () => {
    expect(issueKey("abc_def-1234567")).toBe("#ABCDEF");
  });

  it("handles short ids without padding", () => {
    expect(issueKey("abc")).toBe("#ABC");
  });
});