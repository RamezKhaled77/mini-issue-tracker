import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { activities, users } from "../db/schema.js";
import { resolveDisplayName } from "../lib/identity.js";
import type { MembershipService } from "./membership.js";
import type { ProjectService } from "./project.js";
import type { Activity, ActivityListResponse } from "@mini-issue-tracker/shared";

export interface ActivityServiceDeps {
  db: Db;
  membershipService: MembershipService;
  projectService: ProjectService;
}

export function createActivityService(deps: ActivityServiceDeps) {
  function requireIssueAccess(userId: string, issueId: string): string {
    const workspaceId = deps.projectService.getWorkspaceIdForIssue(issueId);
    deps.membershipService.requireMember(userId, workspaceId);
    return workspaceId;
  }

  function recordActivity(activity: Activity): void {
    deps.db.insert(activities).values({
      id: activity.id,
      issueId: activity.issueId,
      actorId: activity.actorId,
      type: activity.type,
      field: activity.field,
      fromValue: activity.fromValue,
      toValue: activity.toValue,
      labelIds: activity.labelIds ? JSON.stringify(activity.labelIds) : null,
      labelNames: activity.labelNames ? JSON.stringify(activity.labelNames) : null,
      createdAt: new Date(activity.createdAt),
    }).run();
  }

  function listActivities(issueId: string, userId: string, { page, pageSize }: { page: number; pageSize: number }): ActivityListResponse {
    requireIssueAccess(userId, issueId);

    const where = eq(activities.issueId, issueId);
    const total = deps.db.select({ count: sql<number>`count(*)` }).from(activities).where(where).get()?.count ?? 0;
    const offset = (page - 1) * pageSize;

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
      .leftJoin(users, eq(users.id, activities.actorId))
      .where(where)
      .orderBy(sql`${activities.createdAt} DESC, "activities".rowid DESC`)
      .limit(pageSize)
      .offset(offset)
      .all();

    const items: Activity[] = rows.map((row) => ({
      id: row.id,
      issueId: row.issueId,
      actorId: row.actorId,
      actorName: resolveDisplayName(row.actorName, row.actorEmail ?? ""),
      type: row.type as Activity["type"],
      field: row.field as Activity["field"] | undefined,
      fromValue: row.fromValue,
      toValue: row.toValue,
      labelIds: row.labelIds ? JSON.parse(row.labelIds) : null,
      labelNames: row.labelNames ? JSON.parse(row.labelNames) : null,
      createdAt: row.createdAt.toISOString(),
    }));

    // Resolve assignee IDs to names for issue.updated events with assignee field
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
      const assigneeMap = new Map(assigneeRows.map((r) => [r.id, resolveDisplayName(r.name, r.email ?? "")]));
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

    return { items, page, pageSize, total };
  }

  return { recordActivity, listActivities };
}

export type ActivityService = ReturnType<typeof createActivityService>;