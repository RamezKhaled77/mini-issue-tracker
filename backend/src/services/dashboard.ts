import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import {
  activities,
  issueLabels,
  issues,
  projects,
  users,
  workspaces,
} from "../db/schema.js";
import { resolveDisplayName } from "../lib/identity.js";
import { buildLabelMap } from "../lib/labels.js";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import type { LabelColor } from "@mini-issue-tracker/shared";
import type { MembershipService } from "./membership.js";
import { ApiError } from "../api/middleware/error-handler.js";
import type {
  Activity,
  DashboardStats,
  WorkspaceDashboardData,
  WorkspaceDashboardIssue,
  WorkspaceDashboardProject,
} from "@mini-issue-tracker/shared";

export interface DashboardServiceDeps {
  db: Db;
  membershipService: MembershipService;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Matches the frontend isOverdue / backend myIssues logic exactly.
 */
function isOverdue(dueDate: string | null, status: string): boolean {
  return dueDate !== null && dueDate < todayString() && status !== "Closed";
}

/**
 * Build a full Issue-shaped row (with labels + assignee join) from the minimal
 * select rows used by the dashboard queries. Mirrors the shape returned by
 * issueService.getIssueWithLabels / myIssuesService.getMyIssues.
 */
function assembleIssue(
  r: {
    id: string;
    projectId: string;
    projectName: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assigneeId: string | null;
    dueDate: string | null;
    assigneeName: string | null;
    assigneeEmail: string | null;
  },
  labelMap: Map<string, { id: string; workspaceId: string; name: string; color: string }>,
  issueLabelMap: Map<string, string[]>
): WorkspaceDashboardIssue {
  const ids = issueLabelMap.get(r.id) ?? [];
  const labels = ids
    .map((id) => labelMap.get(id))
    .filter(
      (l): l is { id: string; workspaceId: string; name: string; color: string } => Boolean(l)
    );
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    title: r.title,
    description: r.description,
    status: r.status as never,
    priority: r.priority as never,
    assigneeId: r.assigneeId,
    assignee: r.assigneeId
      ? { id: r.assigneeId, name: resolveDisplayName(r.assigneeName, r.assigneeEmail ?? "") }
      : null,
    dueDate: r.dueDate,
    labelIds: ids,
    labels: labels as Array<{ id: string; workspaceId: string; name: string; color: LabelColor }>,
  };
}

export function createDashboardService(deps: DashboardServiceDeps) {
  /**
   * Returns aggregate issue counts for a workspace (used by the WorkspacePage
   * stat strip). Adds `overdue` to the existing shape.
   */
  function getStats(workspaceId: string, userId: string): DashboardStats {
    deps.membershipService.requireMember(userId, workspaceId);
    const projectRows = deps.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .all();
    const projectIds = projectRows.map((p) => p.id);

    const byStatus: Record<string, number> = Object.fromEntries(
      ISSUE_STATUSES.map((s) => [s, 0])
    );
    const byPriority: Record<string, number> = Object.fromEntries(
      ISSUE_PRIORITIES.map((p) => [p, 0])
    );
    let overdue = 0;

    if (projectIds.length === 0) {
      return { byStatus, byPriority, total: 0, overdue };
    }

    const rows = deps.db
      .select({
        status: issues.status,
        priority: issues.priority,
        dueDate: issues.dueDate,
      })
      .from(issues)
      .where(inArray(issues.projectId, projectIds))
      .all();

    let total = 0;
    for (const row of rows) {
      total += 1;
      if (row.status in byStatus) byStatus[row.status] += 1;
      if (row.priority in byPriority) byPriority[row.priority] += 1;
      if (isOverdue(row.dueDate, row.status)) overdue += 1;
    }
    return { byStatus, byPriority, total, overdue };
  }

  /**
   * Full workspace dashboard payload — a single call aggregating everything
   * the dashboard page needs: stats (with overdue), projects with issue counts,
   * my issues, overdue issues, and recent workspace activity.
   */
  function getWorkspaceDashboard(
    workspaceId: string,
    userId: string
  ): WorkspaceDashboardData {
    deps.membershipService.requireMember(userId, workspaceId);

    const workspace = deps.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerId: workspaces.ownerId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .get();
    if (!workspace) {
      throw new ApiError(404, "NOT_FOUND", "Workspace not found");
    }

    const projectRows = deps.db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .all();
    const projectIds = projectRows.map((p) => p.id);

    // ---- Issue stats + overdue count ------------------------------------------
    let byStatus: Record<string, number> = Object.fromEntries(
      ISSUE_STATUSES.map((s) => [s, 0])
    );
    let byPriority: Record<string, number> = Object.fromEntries(
      ISSUE_PRIORITIES.map((p) => [p, 0])
    );
    let total = 0;
    let overdue = 0;
    let myIssues: WorkspaceDashboardIssue[] = [];
    let overdueIssues: WorkspaceDashboardIssue[] = [];
    let recentActivity: Activity[] = [];
    let projectList: WorkspaceDashboardProject[] = [];

    if (projectIds.length > 0) {
      // All issues in the workspace (for stats, overdue, my issues).
      const allRows = deps.db
        .select({
          id: issues.id,
          projectId: issues.projectId,
          projectName: projects.name,
          title: issues.title,
          description: issues.description,
          status: issues.status,
          priority: issues.priority,
          assigneeId: issues.assigneeId,
          dueDate: issues.dueDate,
          assigneeName: users.name,
          assigneeEmail: users.email,
        })
        .from(issues)
        .innerJoin(projects, eq(issues.projectId, projects.id))
        .leftJoin(users, eq(users.id, issues.assigneeId))
        .where(inArray(issues.projectId, projectIds))
        .all();

      // Label resolution (batched for all issues at once).
      const issueIdList = allRows.map((r) => r.id);
      const labelPairs = deps.db
        .select({ issueId: issueLabels.issueId, labelId: issueLabels.labelId })
        .from(issueLabels)
        .where(inArray(issueLabels.issueId, issueIdList))
        .orderBy(sql`rowid`)
        .all();
      const issueLabelMap = new Map<string, string[]>();
      for (const p of labelPairs) {
        const arr = issueLabelMap.get(p.issueId) ?? [];
        arr.push(p.labelId);
        issueLabelMap.set(p.issueId, arr);
      }
      const allLabelIds = [...new Set([...issueLabelMap.values()].flat())];
      const labelsById = buildLabelMap(deps.db, allLabelIds);

      const allIssues = allRows.map((r) => assembleIssue(r, labelsById, issueLabelMap));

      // Stats
      for (const row of allRows) {
        total += 1;
        if (row.status in byStatus) byStatus[row.status] += 1;
        if (row.priority in byPriority) byPriority[row.priority] += 1;
        if (isOverdue(row.dueDate, row.status)) overdue += 1;
      }

      // My issues — limited to current workspace, capped at 6.
      myIssues = allIssues.filter((i) => i.assigneeId === userId).slice(0, 6);

      // Overdue issues — capped at 5.
      overdueIssues = allIssues.filter((i) => isOverdue(i.dueDate, i.status)).slice(0, 5);

      // Projects with issue counts and last activity.
      const projectActivity = listProjectActivities(workspaceId);
      projectList = projectRows.map((p) => ({
        id: p.id,
        name: p.name,
        issueCount: allRows.filter((r) => r.projectId === p.id).length,
        lastActivity: projectActivity.get(p.id) ?? null,
      }));

      // ---- Recent activity — last 15 activities across the workspace --------
      recentActivity = listWorkspaceActivity(workspaceId);
    }

    return {
      workspace: { ...workspace, isOwner: workspace.ownerId === userId },
      stats: { byStatus, byPriority, total, overdue } as DashboardStats,
      projects: projectList,
      myIssues,
      overdueIssues,
      recentActivity,
    };
  }

  /**
   * Query the activity table joined to issues→projects, filtered to this
   * workspace, ordered by recency, limited. Resolves assignee IDs to display
   * names for issue.updated/assignee events (mirrors ActivityService logic).
   */
  function listWorkspaceActivity(workspaceId: string): Activity[] {
    const rows = deps.db
      .select({
        id: activities.id,
        issueId: activities.issueId,
        actorId: activities.actorId,
        type: activities.type,
        field: activities.field,
        fromValue: activities.fromValue,
        toValue: activities.toValue,
        labelIds: activities.labelIds,
        labelNames: activities.labelNames,
        createdAt: activities.createdAt,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(activities)
      .innerJoin(issues, eq(activities.issueId, issues.id))
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .leftJoin(users, eq(users.id, activities.actorId))
      .where(
        inArray(projects.workspaceId, [workspaceId])
      )
      .orderBy(sql`${activities.createdAt} DESC, "activities".rowid DESC`)
      .limit(15)
      .all();

    const items: Activity[] = rows.map((row) => ({
      id: row.id,
      issueId: row.issueId,
      actorId: row.actorId,
      actorName: resolveDisplayName(row.actorName, row.actorEmail ?? ""),
      type: row.type as never,
      field: row.field as never,
      fromValue: row.fromValue ?? null,
      toValue: row.toValue ?? null,
      labelIds: row.labelIds ? (JSON.parse(row.labelIds) as string[]) : null,
      labelNames: row.labelNames
        ? (JSON.parse(row.labelNames) as string[])
        : null,
      createdAt: row.createdAt.toISOString(),
    }));

    // Resolve assignee IDs to display names for issue.updated/assignee events.
    const assigneeIds = new Set<string>();
    for (const item of items) {
      if (item.type === "issue.updated" && item.field === "assignee") {
        if (item.fromValue) assigneeIds.add(item.fromValue);
        if (item.toValue) assigneeIds.add(item.toValue);
      }
    }
    if (assigneeIds.size > 0) {
      const assigneeRows = deps.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, [...assigneeIds]))
        .all();
      const assigneeMap = new Map(
        assigneeRows.map((r) => [
          r.id,
          resolveDisplayName(r.name, r.email ?? ""),
        ])
      );
      for (const item of items) {
        if (item.type === "issue.updated" && item.field === "assignee") {
          if (item.fromValue && assigneeMap.has(item.fromValue)) {
            item.fromValue = assigneeMap.get(item.fromValue)!;
          }
          if (item.toValue && assigneeMap.has(item.toValue)) {
            item.toValue = assigneeMap.get(item.toValue)!;
          }
        }
      }
    }

    return items;
  }

  /**
   * Returns a map of projectId → latest activity timestamp across all issues
   * in that project (within the workspace). Used by the projects overview to
   * show last activity per project.
   */
  function listProjectActivities(workspaceId: string): Map<string, string> {
    const rows = deps.db
      .select({
        projectId: projects.id,
        lastActivity: sql`MAX(${activities.createdAt})`.as("last_activity"),
      })
      .from(activities)
      .innerJoin(issues, eq(activities.issueId, issues.id))
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .where(inArray(projects.workspaceId, [workspaceId]))
      .groupBy(projects.id)
      .all();

    const result = new Map<string, string>();
    for (const r of rows) {
      const ts = r.lastActivity instanceof Date ? r.lastActivity.toISOString() : null;
      if (ts !== null) {
        result.set(r.projectId, ts);
      }
    }
    return result;
  }

  return { getStats, getWorkspaceDashboard };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
