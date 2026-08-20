import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { issueLabels, issues, memberships, projects, users, workspaces } from "../db/schema.js";
import { resolveDisplayName } from "../lib/identity.js";
import { buildLabelMap } from "../lib/labels.js";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import type { MembershipService } from "./membership.js";

export interface MyIssuesServiceDeps {
  db: Db;
  membershipService: MembershipService;
}

export interface MyIssuesQuery {
  includeClosed: boolean;
}

const PRIORITY_ORDER: Record<string, number> = Object.fromEntries(
  ISSUE_PRIORITIES.map((p, i) => [p, i])
);

export function createMyIssuesService(deps: MyIssuesServiceDeps) {
  function todayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function isOverdue(dueDate: string | null, status: string): boolean {
    return dueDate !== null && dueDate < todayString() && status !== "Closed";
  }

  function getReachableWorkspaceIds(userId: string): string[] {
    const memberWorkspaceIds = deps.db
      .select({ workspaceId: memberships.workspaceId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .all()
      .map((r) => r.workspaceId);
    const owned = deps.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        or(eq(workspaces.ownerId, userId), inArray(workspaces.id, memberWorkspaceIds))
      )
      .all()
      .map((r) => r.id);
    return owned;
  }

  function getMyIssues(userId: string, query: MyIssuesQuery) {
    const workspaceIds = getReachableWorkspaceIds(userId);
    if (workspaceIds.length === 0) {
      return {
        overview: {
          total: 0,
          byStatus: Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0])),
          overdue: 0,
        },
        items: [],
      };
    }

    const projectRows = deps.db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.workspaceId, workspaceIds))
      .all();
    const projectIds = projectRows.map((p) => p.id);
    if (projectIds.length === 0) {
      return {
        overview: {
          total: 0,
          byStatus: Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0])),
          overdue: 0,
        },
        items: [],
      };
    }

    const rows = deps.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        title: issues.title,
        description: issues.description,
        status: issues.status,
        priority: issues.priority,
        assigneeId: issues.assigneeId,
        dueDate: issues.dueDate,
        workspaceId: projects.workspaceId,
        projectName: projects.name,
        workspaceName: workspaces.name,
        assigneeName: users.name,
        assigneeEmail: users.email,
      })
      .from(issues)
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
      .leftJoin(users, eq(users.id, issues.assigneeId))
      .where(and(inArray(issues.projectId, projectIds), eq(issues.assigneeId, userId)))
      .all();

    const issueIdList = rows.map((r) => r.id);
    const labelMap = new Map<string, string[]>();
    if (issueIdList.length) {
      const pairs = deps.db
        .select({ issueId: issueLabels.issueId, labelId: issueLabels.labelId })
        .from(issueLabels)
        .where(inArray(issueLabels.issueId, issueIdList))
        .orderBy(sql`rowid`)
        .all();
      for (const p of pairs) {
        const arr = labelMap.get(p.issueId) ?? [];
        arr.push(p.labelId);
        labelMap.set(p.issueId, arr);
      }
    }

    const allLabelIds = [...new Set([...labelMap.values()].flat())];
    const labelsById = buildLabelMap(deps.db, allLabelIds);

    const items = rows.map((r) => {
      const ids = labelMap.get(r.id) ?? [];
      const { assigneeName, assigneeEmail, ...rest } = r;
      return {
        ...rest,
        status: r.status as never,
        priority: r.priority as never,
        labelIds: ids,
        labels: ids
          .map((id) => labelsById.get(id))
          .filter((l): l is { id: string; workspaceId: string; name: string; color: string } => Boolean(l)),
        assignee: r.assigneeId
          ? { id: r.assigneeId, name: resolveDisplayName(assigneeName, assigneeEmail ?? "") }
          : null,
      };
    });

    const byStatus = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    let overdue = 0;
    for (const r of rows) {
      if (r.status in byStatus) byStatus[r.status] += 1;
      if (isOverdue(r.dueDate, r.status)) overdue += 1;
    }

    const filtered = query.includeClosed
      ? items
      : items.filter((i) => i.status !== "Closed");

    filtered.sort((a, b) => {
      const aOverdue = a.dueDate !== null && a.dueDate < todayString() && a.status !== "Closed";
      const bOverdue = b.dueDate !== null && b.dueDate < todayString() && b.status !== "Closed";
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const aDue = a.dueDate ?? "\uffff";
      const bDue = b.dueDate ?? "\uffff";
      if (aDue !== bDue) return aDue < bDue ? -1 : 1;
      const aPriority = PRIORITY_ORDER[a.priority] ?? 0;
      const bPriority = PRIORITY_ORDER[b.priority] ?? 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return a.title.localeCompare(b.title);
    });

    return {
      overview: {
        total: rows.length,
        byStatus: byStatus as Record<(typeof ISSUE_STATUSES)[number], number>,
        overdue,
      },
      items: filtered,
    };
  }

  return { getMyIssues };
}

export type MyIssuesService = ReturnType<typeof createMyIssuesService>;