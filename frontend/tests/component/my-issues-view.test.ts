import { describe, expect, it } from "vitest";
import type { MyIssue } from "@mini-issue-tracker/shared";
import { applyMyIssuesView } from "../../src/lib/myIssuesView.js";
import type { MyIssuesView } from "../../src/lib/myIssuesView.js";

function makeIssue(over: Partial<MyIssue>): MyIssue {
  return {
    id: "iss-1",
    projectId: "proj-1",
    title: "Fix login",
    description: null,
    status: "Open",
    priority: "Medium",
    assigneeId: null,
    assignee: null,
    dueDate: null,
    labelIds: [],
    labels: [],
    workspaceId: "ws-1",
    projectName: "Frontend",
    workspaceName: "Alpha",
    ...over,
  };
}

const view: MyIssuesView = {
  search: "",
  status: "",
  priority: "",
  sort: "default",
};

function titles(items: MyIssue[]): string[] {
  return items.map((i) => i.title);
}

describe("applyMyIssuesView", () => {
  it("returns items unchanged for an empty view", () => {
    const items = [makeIssue({ id: "a" }), makeIssue({ id: "b" })];
    expect(applyMyIssuesView(items, view)).toEqual(items);
  });

  it("searches title and description case-insensitively", () => {
    const items = [
      makeIssue({ id: "a", title: "Fix login", description: "OAuth flow broken" }),
      makeIssue({ id: "b", title: "Ship nav", description: "Add the header" }),
    ];
    const result = applyMyIssuesView(items, { ...view, search: "oauth" });
    expect(titles(result)).toEqual(["Fix login"]);
    const byTitle = applyMyIssuesView(items, { ...view, search: "ship" });
    expect(titles(byTitle)).toEqual(["Ship nav"]);
  });

  it("filters by status and priority", () => {
    const items = [
      makeIssue({ id: "a", title: "Open high", status: "Open", priority: "High" }),
      makeIssue({ id: "b", title: "Progress high", status: "In Progress", priority: "High" }),
      makeIssue({ id: "c", title: "Closed low", status: "Closed", priority: "Low" }),
    ];
    expect(titles(applyMyIssuesView(items, { ...view, status: "Open" }))).toEqual(["Open high"]);
    const byPriority = applyMyIssuesView(items, { ...view, priority: "Low" });
    expect(titles(byPriority)).toEqual(["Closed low"]);
  });

  it("default sort puts overdue first, then due date, then priority, then title", () => {
    const items = [
      makeIssue({ id: "a", title: "Zulu", priority: "Low" }),
      makeIssue({ id: "b", title: "Bravo", priority: "Urgent", dueDate: "2025-01-01" }),
      makeIssue({ id: "c", title: "Alpha", priority: "Urgent", dueDate: "2024-01-01" }),
      makeIssue({ id: "d", title: "Delta", priority: "Medium", dueDate: "2020-01-01" }),
    ];
    const result = applyMyIssuesView(items, view);
    expect(result[0].id).toBe("d");
    expect(titles(result.slice(1))).toEqual(["Alpha", "Bravo", "Zulu"]);
  });

  it("sorts by due date ascending with nulls last", () => {
    const items = [
      makeIssue({ id: "a", title: "No date" }),
      makeIssue({ id: "b", title: "Later", dueDate: "2026-01-01" }),
      makeIssue({ id: "c", title: "Earlier", dueDate: "2025-01-01" }),
    ];
    const result = applyMyIssuesView(items, { ...view, sort: "due-asc" });
    expect(titles(result)).toEqual(["Earlier", "Later", "No date"]);
  });

  it("sorts by priority high-to-low then title", () => {
    const items = [
      makeIssue({ id: "a", title: "Beta", priority: "Low" }),
      makeIssue({ id: "b", title: "Alpha", priority: "High" }),
      makeIssue({ id: "c", title: "Gamma", priority: "Urgent" }),
    ];
    const result = applyMyIssuesView(items, { ...view, sort: "priority-high" });
    expect(titles(result)).toEqual(["Gamma", "Alpha", "Beta"]);
  });

  it("sorts by title A-Z and Z-A", () => {
    const items = [
      makeIssue({ id: "a", title: "Charlie" }),
      makeIssue({ id: "b", title: "Alpha" }),
      makeIssue({ id: "c", title: "Bravo" }),
    ];
    expect(titles(applyMyIssuesView(items, { ...view, sort: "title-az" }))).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
    expect(titles(applyMyIssuesView(items, { ...view, sort: "title-za" }))).toEqual([
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
  });
});