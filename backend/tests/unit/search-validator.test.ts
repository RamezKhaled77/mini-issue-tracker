import { describe, expect, it } from "vitest";
import { searchQuerySchema } from "../../src/api/validators/search.js";

describe("search query validator", () => {
  it("accepts a valid query and applies the default limit", () => {
    const parsed = searchQuerySchema.parse({ q: "  login bug  " });
    expect(parsed.q).toBe("login bug");
    expect(parsed.limit).toBe(20);
  });

  it("coerces and bounds the limit", () => {
    expect(searchQuerySchema.parse({ q: "abc", limit: "7" }).limit).toBe(7);
    expect(() => searchQuerySchema.parse({ q: "abc", limit: 0 })).toThrow();
    expect(() => searchQuerySchema.parse({ q: "abc", limit: 51 })).toThrow();
  });

  it("rejects queries shorter than 2 trimmed characters", () => {
    expect(() => searchQuerySchema.parse({ q: "" })).toThrow();
    expect(() => searchQuerySchema.parse({ q: "   a   " })).toThrow();
  });

  it("rejects queries longer than 200 characters", () => {
    expect(() => searchQuerySchema.parse({ q: "x".repeat(201) })).toThrow();
    expect(searchQuerySchema.parse({ q: "x".repeat(200) }).q).toHaveLength(200);
  });

  it("requires the query parameter", () => {
    expect(() => searchQuerySchema.parse({})).toThrow();
  });
});
