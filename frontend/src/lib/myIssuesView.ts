import type { MyIssue } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES } from "@mini-issue-tracker/shared";
import { isOverdue } from "./isOverdue.js";

export type MyIssuesSortKey =
  | "default"
  | "due-asc"
  | "due-desc"
  | "priority-high"
  | "priority-low"
  | "title-az"
  | "title-za";

export interface MyIssuesView {
  search: string;
  status: string;
  priority: string;
  sort: MyIssuesSortKey;
}

const PRIORITY_ORDER: Record<string, number> = Object.fromEntries(
  ISSUE_PRIORITIES.map((p, i) => [p, i])
);

function comparePriority(a: MyIssue, b: MyIssue): number {
  return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
}

function compareTitle(a: MyIssue, b: MyIssue): number {
  return a.title.localeCompare(b.title);
}

function compareDueDate(a: MyIssue, b: MyIssue): number {
  const aDue = a.dueDate ?? "\uffff";
  const bDue = b.dueDate ?? "\uffff";
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;
  return 0;
}

const COMPARATORS: Record<MyIssuesSortKey, (a: MyIssue, b: MyIssue) => number> = {
  default: (a, b) => {
    const aOverdue = isOverdue(a.dueDate, a.status);
    const bOverdue = isOverdue(b.dueDate, b.status);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return compareDueDate(a, b) || comparePriority(a, b) || compareTitle(a, b);
  },
  "due-asc": (a, b) => compareDueDate(a, b) || comparePriority(a, b) || compareTitle(a, b),
  "due-desc": (a, b) => -compareDueDate(a, b) || comparePriority(a, b) || compareTitle(a, b),
  "priority-high": (a, b) => comparePriority(a, b) || compareDueDate(a, b) || compareTitle(a, b),
  "priority-low": (a, b) => -comparePriority(a, b) || compareDueDate(a, b) || compareTitle(a, b),
  "title-az": (a, b) => compareTitle(a, b) || compareDueDate(a, b) || comparePriority(a, b),
  "title-za": (a, b) => -compareTitle(a, b) || compareDueDate(a, b) || comparePriority(a, b),
};

export function applyMyIssuesView(items: MyIssue[], view: MyIssuesView): MyIssue[] {
  const q = view.search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (view.status && item.status !== view.status) return false;
    if (view.priority && item.priority !== view.priority) return false;
    if (q) {
      const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const comparator = COMPARATORS[view.sort] ?? COMPARATORS.default;
  return [...filtered].sort(comparator);
}