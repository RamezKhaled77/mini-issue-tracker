import { describe, expect, it } from "vitest";
import {
  readFilters,
  writeFilters,
  WORKSPACE_FILTER_KEYS,
  MY_ISSUES_FILTER_KEYS,
} from "../../src/lib/urlFilters.js";

describe("readFilters", () => {
  it("reads present, non-empty keys", () => {
    const params = new URLSearchParams("project=p1&status=Open&label=&view=v1");
    expect(readFilters(params, WORKSPACE_FILTER_KEYS)).toEqual({
      project: "p1",
      status: "Open",
      view: "v1",
    });
  });

  it("ignores empty and missing keys", () => {
    const params = new URLSearchParams("");
    expect(readFilters(params, WORKSPACE_FILTER_KEYS)).toEqual({});
  });

  it("tolerates unknown params and returns default for My Issues", () => {
    const params = new URLSearchParams("q=login&unknown=x&closed=true");
    expect(readFilters(params, MY_ISSUES_FILTER_KEYS)).toEqual({ q: "login", closed: "true" });
  });
});

describe("writeFilters", () => {
  it("writes only present, non-empty values for the schema keys", () => {
    const params = writeFilters(
      { project: "p1", status: "Open", label: "", view: undefined },
      WORKSPACE_FILTER_KEYS
    );
    expect(params.toString()).toBe("project=p1&status=Open");
  });

  it("round-trips through readFilters", () => {
    const filters = { q: "login", status: "Open", priority: "high", sort: "due-asc" };
    const params = writeFilters(filters, MY_ISSUES_FILTER_KEYS);
    expect(readFilters(params, MY_ISSUES_FILTER_KEYS)).toEqual(filters);
  });

  it("produces an empty query string when nothing is set", () => {
    const params = writeFilters({}, WORKSPACE_FILTER_KEYS);
    expect(params.toString()).toBe("");
  });
});