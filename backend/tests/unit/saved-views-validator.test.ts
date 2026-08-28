import { describe, expect, it } from "vitest";
import {
  createSavedViewSchema,
  savedViewFiltersSchema,
  updateSavedViewSchema,
} from "../../src/api/validators/savedView.js";

const VALID_ID = "3f0e4f9a-0000-4000-8000-000000000001";
const LABEL_ID = "3f0e4f9a-0000-4000-8000-000000000002";

function validFilters(overrides: Record<string, unknown> = {}) {
  return { version: 1, projectId: VALID_ID, ...overrides };
}

describe("savedViewFiltersSchema", () => {
  it("accepts a v1 filter with just a project", () => {
    expect(savedViewFiltersSchema.parse({ version: 1, projectId: VALID_ID })).toEqual({
      version: 1,
      projectId: VALID_ID,
    });
  });

  it("accepts all optional filter fields and trims search", () => {
    const parsed = savedViewFiltersSchema.parse(
      validFilters({
        search: "  login page  ",
        status: "Open",
        priority: "High",
        labelId: LABEL_ID,
      })
    );
    expect(parsed.search).toBe("login page");
    expect(parsed.status).toBe("Open");
    expect(parsed.priority).toBe("High");
    expect(parsed.labelId).toBe(LABEL_ID);
  });

  it("rejects an unsupported version", () => {
    expect(() => savedViewFiltersSchema.parse(validFilters({ version: 2 }))).toThrow();
  });

  it("requires projectId and validates it as a uuid", () => {
    expect(() => savedViewFiltersSchema.parse({ version: 1 })).toThrow();
    expect(() => savedViewFiltersSchema.parse(validFilters({ projectId: "not-a-uuid" }))).toThrow();
  });

  it("validates labelId as a uuid", () => {
    expect(() => savedViewFiltersSchema.parse(validFilters({ labelId: "bad" }))).toThrow();
  });

  it("validates status and priority enums", () => {
    expect(() => savedViewFiltersSchema.parse(validFilters({ status: "Waffle" }))).toThrow();
    expect(() => savedViewFiltersSchema.parse(validFilters({ priority: "Urgent" }))).not.toThrow();
    expect(() => savedViewFiltersSchema.parse(validFilters({ priority: "P0" }))).toThrow();
  });

  it("rejects search longer than 200 trimmed characters", () => {
    expect(() => savedViewFiltersSchema.parse(validFilters({ search: "x".repeat(201) }))).toThrow();
    expect(savedViewFiltersSchema.parse(validFilters({ search: "x".repeat(200) })).search).toHaveLength(200);
  });

  it("rejects unknown keys", () => {
    expect(() => savedViewFiltersSchema.parse(validFilters({ assigneeId: VALID_ID }))).toThrow();
    expect(() => savedViewFiltersSchema.parse(validFilters({ sort: "createdAt" }))).toThrow();
  });
});

describe("createSavedViewSchema", () => {
  it("accepts a name and valid filters", () => {
    const parsed = createSavedViewSchema.parse({
      name: "  My High Priority  ",
      filters: validFilters({ priority: "High" }),
    });
    expect(parsed.name).toBe("My High Priority");
  });

  it("rejects blank and whitespace-only names", () => {
    expect(() => createSavedViewSchema.parse({ name: "", filters: validFilters() })).toThrow();
    expect(() => createSavedViewSchema.parse({ name: "   ", filters: validFilters() })).toThrow();
  });

  it("rejects names longer than 60 characters", () => {
    expect(() => createSavedViewSchema.parse({ name: "x".repeat(61), filters: validFilters() })).toThrow();
    expect(createSavedViewSchema.parse({ name: "x".repeat(60), filters: validFilters() }).name).toHaveLength(60);
  });

  it("requires filters", () => {
    expect(() => createSavedViewSchema.parse({ name: "View" })).toThrow();
  });
});

describe("updateSavedViewSchema", () => {
  it("accepts a rename-only update", () => {
    expect(updateSavedViewSchema.parse({ name: "Renamed" }).name).toBe("Renamed");
  });

  it("accepts a filters-only update", () => {
    expect(updateSavedViewSchema.parse({ filters: validFilters({ status: "Closed" }) }).filters?.status).toBe(
      "Closed"
    );
  });

  it("rejects an empty update", () => {
    expect(() => updateSavedViewSchema.parse({})).toThrow();
  });

  it("validates a supplied filters object", () => {
    expect(() => updateSavedViewSchema.parse({ filters: { version: 9 } })).toThrow();
  });

  it("rejects unknown top-level keys", () => {
    expect(() => updateSavedViewSchema.parse({ name: "Renamed", color: "violet" })).toThrow();
  });
});