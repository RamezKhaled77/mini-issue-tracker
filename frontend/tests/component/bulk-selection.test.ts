import { describe, expect, it } from "vitest";
import { toggle, selectVisible, clear, count, partitionByWorkspace } from "../../src/lib/bulkSelection.js";

describe("bulkSelection", () => {
  describe("toggle", () => {
    it("adds an id when absent and removes it when present, immutably", () => {
      const base = new Set(["a", "b"]);
      const added = toggle(base, "c");
      expect(added.has("c")).toBe(true);
      expect(base.has("c")).toBe(false);

      const removed = toggle(added, "c");
      expect(removed.has("c")).toBe(false);
      expect(added.has("c")).toBe(true);
    });
  });

  describe("selectVisible", () => {
    it("selects all currently visible issues", () => {
      const next = selectVisible(new Set(), ["a", "b"]);
      expect(count(next)).toBe(2);
      expect(next.has("a")).toBe(true);
      expect(next.has("b")).toBe(true);
    });

    it("deselects all visible issues when all are already selected", () => {
      const next = selectVisible(new Set(["a", "b", "c"]), ["a", "b"]);
      expect(next.has("a")).toBe(false);
      expect(next.has("b")).toBe(false);
      expect(next.has("c")).toBe(true); // hidden issues preserved
    });

    it("preserves previously selected hidden issues", () => {
      const next = selectVisible(new Set(["hidden"]), ["a", "b"]);
      expect(next.has("hidden")).toBe(true);
      expect(next.has("a")).toBe(true);
    });

    it("does nothing for an empty visible set", () => {
      const next = selectVisible(new Set(["a"]), []);
      expect(count(next)).toBe(1);
    });
  });

  describe("clear", () => {
    it("returns an empty selection", () => {
      expect(count(clear())).toBe(0);
      expect(count(clear())).toBe(0);
    });
  });

  describe("count", () => {
    it("returns the size of the selection", () => {
      expect(count(new Set(["a", "b", "c"]))).toBe(3);
      expect(count(new Set())).toBe(0);
    });
  });

  describe("partitionByWorkspace", () => {
    const items = [
      { id: "i1", workspaceId: "ws-1" },
      { id: "i2", workspaceId: "ws-1" },
      { id: "i3", workspaceId: "ws-2" },
    ];

    it("groups only selected ids by workspace", () => {
      const map = partitionByWorkspace(new Set(["i1", "i3"]), items);
      expect(map.get("ws-1")).toEqual(["i1"]);
      expect(map.get("ws-2")).toEqual(["i3"]);
    });

    it("is empty when nothing is selected", () => {
      expect(partitionByWorkspace(new Set(), items).size).toBe(0);
    });
  });
});