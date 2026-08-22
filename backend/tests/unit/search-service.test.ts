import { describe, expect, it } from "vitest";
import { escapeLikeNeedle, extractTicketKeyPrefix } from "../../src/services/search.js";

describe("escapeLikeNeedle", () => {
  it("escapes backslash, percent and underscore", () => {
    expect(escapeLikeNeedle("100%_done\\")).toBe("100\\%\\_done\\\\");
    expect(escapeLikeNeedle("plain text")).toBe("plain text");
  });
});

describe("extractTicketKeyPrefix", () => {
  it("accepts 1-6 hex characters with or without a leading '#'", () => {
    expect(extractTicketKeyPrefix("#a1b2c3")).toBe("A1B2C3");
    expect(extractTicketKeyPrefix("A1B2C3")).toBe("A1B2C3");
    expect(extractTicketKeyPrefix("ab")).toBe("AB");
  });

  it("rejects non-key-shaped queries", () => {
    expect(extractTicketKeyPrefix("login")).toBeNull();
    expect(extractTicketKeyPrefix("a1b2c34")).toBeNull(); // 7 chars
    expect(extractTicketKeyPrefix("xyz")).toBeNull(); // non-hex
    expect(extractTicketKeyPrefix("##ab")).toBeNull();
  });
});
