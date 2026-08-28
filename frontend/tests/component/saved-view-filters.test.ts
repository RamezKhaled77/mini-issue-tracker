import { describe, expect, it } from "vitest";
import { resolveSavedViewFilters, savedViewAvailabilityNote } from "../../src/lib/savedViewFilters.js";
import type { SavedView } from "@mini-issue-tracker/shared";

const projectIds = new Set(["proj-1"]);
const labelIds = new Set(["lab-1"]);

function view(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: "v1",
    workspaceId: "ws-1",
    createdById: "u1",
    name: "V",
    filters: { version: 1, projectId: "proj-1" },
    filtersValid: true,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("resolveSavedViewFilters", () => {
  it("resolves a full config into ledger filter state", () => {
    const resolved = resolveSavedViewFilters(
      view({
        filters: { version: 1, projectId: "proj-1", search: "bug", status: "Open", priority: "High", labelId: "lab-1" },
      }),
      projectIds,
      labelIds
    );
    expect(resolved).toEqual({
      projectId: "proj-1",
      search: "bug",
      status: "Open",
      priority: "High",
      labelId: "lab-1",
      staleProject: false,
      staleLabel: false,
    });
  });

  it("defaults absent fields to unfiltered", () => {
    const resolved = resolveSavedViewFilters(view(), projectIds, labelIds);
    expect(resolved).toMatchObject({ search: "", status: "", priority: "", labelId: "" });
  });

  it("flags a stale project and stale label", () => {
    const resolved = resolveSavedViewFilters(
      view({ filters: { version: 1, projectId: "gone", labelId: "gone" } }),
      projectIds,
      labelIds
    );
    expect(resolved?.staleProject).toBe(true);
    expect(resolved?.staleLabel).toBe(true);
    expect(savedViewAvailabilityNote(resolved!)).toBe("project unavailable");
  });

  it("returns null for unreadable configs", () => {
    expect(resolveSavedViewFilters(view({ filtersValid: false, filters: undefined }), projectIds, labelIds)).toBeNull();
  });

  it("returns null when filters are absent", () => {
    expect(resolveSavedViewFilters(view({ filters: undefined }), projectIds, labelIds)).toBeNull();
  });
});
