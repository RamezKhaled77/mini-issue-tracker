import { describe, expect, it } from "vitest";
import { createLabelSchema, updateLabelSchema } from "../../src/api/validators/label.js";
import { createIssueSchema } from "../../src/api/validators/issue.js";

describe("createLabelSchema", () => {
  it("accepts a valid name and color", () => {
    const result = createLabelSchema.safeParse({ name: "bug", color: "violet" });
    expect(result.success).toBe(true);
  });

  it("rejects a blank or whitespace-only name", () => {
    expect(createLabelSchema.safeParse({ name: "", color: "violet" }).success).toBe(false);
    expect(createLabelSchema.safeParse({ name: "   ", color: "violet" }).success).toBe(false);
  });

  it("rejects a name longer than 50 characters", () => {
    expect(
      createLabelSchema.safeParse({ name: "x".repeat(51), color: "violet" }).success
    ).toBe(false);
  });

  it("rejects a missing or invalid color", () => {
    const missing = createLabelSchema.safeParse({ name: "bug" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues.some((i) => i.path[0] === "color")).toBe(true);
    }
    expect(createLabelSchema.safeParse({ name: "bug", color: "hotpink" }).success).toBe(false);
  });
});

describe("updateLabelSchema", () => {
  it("requires at least one field", () => {
    expect(updateLabelSchema.safeParse({}).success).toBe(false);
  });

  it("accepts only a name or only a color", () => {
    expect(updateLabelSchema.safeParse({ name: "renamed" }).success).toBe(true);
    expect(updateLabelSchema.safeParse({ color: "plum" }).success).toBe(true);
  });

  it("rejects an invalid color", () => {
    expect(updateLabelSchema.safeParse({ color: "navy" }).success).toBe(false);
  });
});

describe("createIssueSchema labelIds", () => {
  it("rejects duplicate label ids", () => {
    const result = createIssueSchema.safeParse({
      title: "T",
      status: "Open",
      priority: "Medium",
      labelIds: ["11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111111"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const labelField = result.error.issues.find((i) => i.path.join(".") === "labelIds");
      expect(labelField).toBeDefined();
    }
  });

  it("accepts unique or empty label ids", () => {
    const ok = createIssueSchema.safeParse({
      title: "T",
      status: "Open",
      priority: "Medium",
      labelIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    expect(ok.success).toBe(true);
    expect(
      createIssueSchema.safeParse({ title: "T", status: "Open", priority: "Medium" }).success
    ).toBe(true);
  });

  it("rejects an invalid uuid", () => {
    expect(
      createIssueSchema.safeParse({
        title: "T",
        status: "Open",
        priority: "Medium",
        labelIds: ["not-a-uuid"],
      }).success
    ).toBe(false);
  });
});