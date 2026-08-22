import { describe, expect, it } from "vitest";
import { bulkIssueSchema } from "../../src/api/validators/bulk.js";
import { BULK_ISSUE_LIMIT } from "@mini-issue-tracker/shared";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const ids = (n: number): string[] =>
  Array.from({ length: n }, (_, i) =>
    `123e4567-e89b-12d3-a456-42661417${String(i).padStart(4, "0")}`
  );

describe("bulkIssueSchema", () => {
  it("accepts a valid setStatus action", () => {
    const r = bulkIssueSchema.safeParse({
      action: "setStatus",
      issueIds: ids(2),
      status: "Open",
    });
    expect(r.success).toBe(true);
  });

  it("rejects setStatus without a status value", () => {
    const r = bulkIssueSchema.safeParse({ action: "setStatus", issueIds: ids(2) });
    expect(r.success).toBe(false);
  });

  it("rejects setStatus with an invalid status", () => {
    const r = bulkIssueSchema.safeParse({
      action: "setStatus",
      issueIds: ids(2),
      status: "Pending",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid setPriority action", () => {
    const r = bulkIssueSchema.safeParse({
      action: "setPriority",
      issueIds: ids(2),
      priority: "Urgent",
    });
    expect(r.success).toBe(true);
  });

  it("accepts an assign action with a null assigneeId (unassign)", () => {
    const r = bulkIssueSchema.safeParse({
      action: "assign",
      issueIds: ids(2),
      assigneeId: null,
    });
    expect(r.success).toBe(true);
  });

  it("accepts an assign action with a UUID assigneeId", () => {
    const r = bulkIssueSchema.safeParse({
      action: "assign",
      issueIds: ids(2),
      assigneeId: UUID,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an assign action with a non-UUID assigneeId", () => {
    const r = bulkIssueSchema.safeParse({
      action: "assign",
      issueIds: ids(2),
      assigneeId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("accepts addLabels and removeLabels with unique label ids", () => {
    const labelIds = [UUID, "123e4567-e89b-12d3-a456-426614174001"];
    expect(
      bulkIssueSchema.safeParse({ action: "addLabels", issueIds: ids(2), labelIds }).success
    ).toBe(true);
    expect(
      bulkIssueSchema.safeParse({ action: "removeLabels", issueIds: ids(2), labelIds }).success
    ).toBe(true);
  });

  it("rejects duplicate label ids", () => {
    const r = bulkIssueSchema.safeParse({
      action: "addLabels",
      issueIds: ids(2),
      labelIds: [UUID, UUID],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a label action without labels", () => {
    const r = bulkIssueSchema.safeParse({
      action: "removeLabels",
      issueIds: ids(2),
      labelIds: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown action", () => {
    const r = bulkIssueSchema.safeParse({
      action: "nuke",
      issueIds: ids(2),
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty issueIds", () => {
    const r = bulkIssueSchema.safeParse({ action: "setStatus", issueIds: [], status: "Open" });
    expect(r.success).toBe(false);
  });

  it("rejects more than BULK_ISSUE_LIMIT issue ids", () => {
    const r = bulkIssueSchema.safeParse({
      action: "setStatus",
      issueIds: ids(BULK_ISSUE_LIMIT + 1),
      status: "Open",
    });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate issue ids", () => {
    const r = bulkIssueSchema.safeParse({
      action: "setStatus",
      issueIds: [UUID, UUID],
      status: "Open",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-UUID issue id", () => {
    const r = bulkIssueSchema.safeParse({
      action: "setStatus",
      issueIds: ["not-a-uuid", UUID],
      status: "Open",
    });
    expect(r.success).toBe(false);
  });
});