import { describe, expect, it } from "vitest";
import { isOverdue } from "../../src/lib/isOverdue.js";

describe("isOverdue", () => {
  it("is overdue when due date is before today and status is not Closed", () => {
    expect(isOverdue("2000-01-01", "Open")).toBe(true);
    expect(isOverdue("2000-01-01", "In Progress")).toBe(true);
  });

  it("is not overdue when the due date is today or later", () => {
    expect(isOverdue("2099-01-01", "Open")).toBe(false);
  });

  it("is not overdue when there is no due date", () => {
    expect(isOverdue(null, "Open")).toBe(false);
  });

  it("is not overdue when the issue is Closed, regardless of due date", () => {
    expect(isOverdue("2000-01-01", "Closed")).toBe(false);
  });
});