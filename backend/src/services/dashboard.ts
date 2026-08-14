import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { issues, projects } from "../db/schema.js";
import type { MembershipService } from "./membership.js";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";

export interface DashboardServiceDeps {
  db: Db;
  membershipService: MembershipService;
}

export function createDashboardService(deps: DashboardServiceDeps) {
  function getStats(workspaceId: string, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    const projectRows = deps.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .all();
    const projectIds = projectRows.map((p) => p.id);

    const byStatus: Record<string, number> = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0]));
    const byPriority: Record<string, number> = Object.fromEntries(ISSUE_PRIORITIES.map((p) => [p, 0]));

    if (projectIds.length === 0) {
      return { byStatus, byPriority, total: 0 };
    }

    const rows = deps.db
      .select({ status: issues.status, priority: issues.priority })
      .from(issues)
      .where(inArray(issues.projectId, projectIds))
      .all();

    let total = 0;
    for (const row of rows) {
      total += 1;
      if (row.status in byStatus) byStatus[row.status] += 1;
      if (row.priority in byPriority) byPriority[row.priority] += 1;
    }
    return { byStatus, byPriority, total };
  }

  return { getStats };
}

export type DashboardService = ReturnType<typeof createDashboardService>;