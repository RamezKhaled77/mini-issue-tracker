import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { issueLabels, issues, labels, memberships, projects, users } from "../db/schema.js";
import { createIssueRecord } from "../domain/issue.js";
import { createActivityRecord, truncateDescription } from "../domain/activity.js";
import { resolveDisplayName } from "../lib/identity.js";
import { buildLabelMap } from "../lib/labels.js";
import { ApiError } from "../api/middleware/error-handler.js";
import type { MembershipService } from "./membership.js";
import type { ProjectService } from "./project.js";
import type { ActivityService } from "./activity.js";
import type { IssueQueryInput, UpdateIssueInput } from "../api/validators/issue.js";
import type { BulkIssueInput } from "../api/validators/bulk.js";
import type { ActivityField, BulkIssueResponse } from "@mini-issue-tracker/shared";

export interface IssueServiceDeps {
  db: Db;
  membershipService: MembershipService;
  projectService: ProjectService;
  activityService: ActivityService;
}

export interface IssueQuery extends IssueQueryInput {}

export function createIssueService(deps: IssueServiceDeps) {
  function getProjectWorkspace(projectId: string): string {
    return deps.projectService.getWorkspaceIdForProject(projectId);
  }

  function requireProjectMember(userId: string, projectId: string) {
    const workspaceId = getProjectWorkspace(projectId);
    deps.membershipService.requireMember(userId, workspaceId);
    return workspaceId;
  }

  function validateAssignee(workspaceId: string, assigneeId: string | null) {
    if (!assigneeId) return;
    const member = deps.db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.userId, assigneeId), eq(memberships.workspaceId, workspaceId)))
      .get();
    if (!member) {
      throw new ApiError(422, "VALIDATION", "Assignee must be a member of the workspace", {
        assigneeId: "Assignee is not a member of this workspace",
      });
    }
  }

  function validateLabels(workspaceId: string, labelIds: string[]) {
    if (!labelIds.length) return;
    if (new Set(labelIds).size !== labelIds.length) {
      throw new ApiError(422, "VALIDATION", "One or more labels are invalid", {
        labelIds: "Labels must be unique",
      });
    }
    const found = deps.db
      .select({ id: labels.id })
      .from(labels)
      .where(and(inArray(labels.id, labelIds), eq(labels.workspaceId, workspaceId)))
      .all();
    const foundIds = new Set(found.map((l) => l.id));
    const missing = labelIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new ApiError(422, "VALIDATION", "One or more labels are invalid", {
        labelIds: "A label does not exist in this workspace",
      });
    }
  }

  function createIssue(
    projectId: string,
    input: {
      title: string;
      description?: string | null;
      status: string;
      priority: string;
      assigneeId?: string | null;
      labelIds?: string[];
      dueDate?: string | null;
    },
    userId: string
  ) {
    const workspaceId = requireProjectMember(userId, projectId);
    validateAssignee(workspaceId, input.assigneeId ?? null);
    validateLabels(workspaceId, input.labelIds ?? []);
    
    const issue = createIssueRecord(projectId, {
      title: input.title,
      description: input.description,
      status: input.status as never,
      priority: input.priority as never,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
    });
    
    return deps.db.transaction(() => {
      deps.db.insert(issues).values(issue).run();
      if (input.labelIds?.length) {
        deps.db
          .insert(issueLabels)
          .values(input.labelIds.map((labelId) => ({ issueId: issue.id, labelId })))
          .run();
      }
      // Record activity
      deps.activityService.recordActivity(
        createActivityRecord(issue.id, userId, "issue.created")
      );
      return getIssueWithLabels(issue.id, userId);
    });
  }

  function getIssue(issueId: string, userId: string) {
    return getIssueWithLabels(issueId, userId);
  }

  function getIssueWithLabels(issueId: string, userId: string) {
    const issue = deps.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
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
      .leftJoin(users, eq(users.id, issues.assigneeId))
      .where(eq(issues.id, issueId))
      .get();
    if (!issue) throw new ApiError(404, "NOT_FOUND", "Issue not found");
    requireProjectMember(userId, issue.projectId);
    const labelRows = deps.db
      .select({ labelId: issueLabels.labelId })
      .from(issueLabels)
      .where(eq(issueLabels.issueId, issueId))
      .orderBy(sql`rowid`)
      .all();
    const labelIds = labelRows.map((r) => r.labelId);
    const labelMap = buildLabelMap(deps.db, labelIds);
    const { assigneeName, assigneeEmail, ...rest } = issue;
    return {
      ...rest,
      status: issue.status as never,
      priority: issue.priority as never,
      labelIds,
      labels: labelIds
        .map((id) => labelMap.get(id))
        .filter((l): l is { id: string; workspaceId: string; name: string; color: string } => Boolean(l)),
      assignee: issue.assigneeId
        ? { id: issue.assigneeId, name: resolveDisplayName(assigneeName, assigneeEmail ?? "") }
        : null,
    };
  }

  function listIssues(projectId: string, userId: string, query: IssueQuery) {
    requireProjectMember(userId, projectId);
    const conditions = [eq(issues.projectId, projectId)];
    if (query.search) {
      const like = `%${query.search}%`;
      conditions.push(
        sql`(${issues.title} LIKE ${like} OR ${issues.description} LIKE ${like})`
      );
    }
    if (query.status) conditions.push(eq(issues.status, query.status));
    if (query.priority) conditions.push(eq(issues.priority, query.priority));
    if (query.assigneeId) conditions.push(eq(issues.assigneeId, query.assigneeId));
    if (query.labelId) {
      const ids = deps.db
        .select({ issueId: issueLabels.issueId })
        .from(issueLabels)
        .where(eq(issueLabels.labelId, query.labelId))
        .all()
        .map((r) => r.issueId);
      if (ids.length === 0) {
        return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
      }
      conditions.push(inArray(issues.id, ids));
    }

    const where = and(...conditions);
    const total = deps.db.select({ count: sql<number>`count(*)` }).from(issues).where(where).get()?.count ?? 0;
    const offset = (query.page - 1) * query.pageSize;
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
        assigneeName: users.name,
        assigneeEmail: users.email,
      })
      .from(issues)
      .leftJoin(users, eq(users.id, issues.assigneeId))
      .where(where)
      .limit(query.pageSize)
      .offset(offset)
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

    return {
      items: rows.map((r) => {
        const { assigneeName, assigneeEmail, ...rest } = r;
        const ids = labelMap.get(r.id) ?? [];
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
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  function updateIssue(issueId: string, input: UpdateIssueInput, userId: string) {
    const existing = getIssueWithLabels(issueId, userId);
    const workspaceId = getProjectWorkspace(existing.projectId);
    if (input.assigneeId !== undefined) validateAssignee(workspaceId, input.assigneeId);
    if (input.labelIds !== undefined) validateLabels(workspaceId, input.labelIds);

    return deps.db.transaction(() => {
      const updates: Record<string, unknown> = {};
      for (const key of ["title", "description", "status", "priority", "assigneeId", "dueDate"] as const) {
        if (input[key] !== undefined) updates[key] = input[key];
      }
      updates.updatedAt = new Date();
      deps.db.update(issues).set(updates).where(eq(issues.id, issueId)).run();

      if (input.labelIds !== undefined) {
        deps.db.delete(issueLabels).where(eq(issueLabels.issueId, issueId)).run();
        if (input.labelIds.length) {
          deps.db
            .insert(issueLabels)
            .values(input.labelIds.map((labelId) => ({ issueId, labelId })))
            .run();
        }
      }

      // Record activities after update
      const after = getIssueWithLabels(issueId, userId);
      recordChanges(existing, after, userId);

      return after;
    });
  }

  function recordChanges(before: ReturnType<typeof getIssueWithLabels>, after: ReturnType<typeof getIssueWithLabels>, actorId: string) {
    const issueId = before.id;
    const changes: Array<{ field: ActivityField; from: string | null; to: string | null }> = [];

    // Compare scalar fields
    const fieldMap: Array<[ActivityField, "status" | "priority" | "assigneeId" | "dueDate" | "title" | "description"]> = [
      ["status", "status"],
      ["priority", "priority"],
      ["assignee", "assigneeId"],
      ["due_date", "dueDate"],
      ["title", "title"],
      ["description", "description"],
    ];

    for (const [field, key] of fieldMap) {
      const beforeVal = before[key];
      const afterVal = after[key];
      if (beforeVal !== afterVal) {
        let from: string | null = null;
        let to: string | null = null;
        
        if (field === "description") {
          from = truncateDescription(beforeVal as string | null);
          to = truncateDescription(afterVal as string | null);
        } else if (field === "assignee") {
          from = beforeVal ?? null;
          to = afterVal ?? null;
        } else {
          from = beforeVal ?? null;
          to = afterVal ?? null;
        }
        
        changes.push({ field, from, to });
      }
    }

    for (const change of changes) {
      deps.activityService.recordActivity(
        createActivityRecord(issueId, actorId, "issue.updated", {
          field: change.field,
          fromValue: change.from,
          toValue: change.to,
        })
      );
    }

    // Handle labels
    if (before.labelIds.length !== after.labelIds.length || 
        !before.labelIds.every((id, i) => id === after.labelIds[i])) {
      const beforeLabelIds = new Set(before.labelIds);
      const afterLabelIds = new Set(after.labelIds);
      
      const added = after.labelIds.filter((id) => !beforeLabelIds.has(id));
      const removed = before.labelIds.filter((id) => !afterLabelIds.has(id));
      
      if (added.length) {
        const labelMap = buildLabelMap(deps.db, added);
        const labelNames = added.map((id) => labelMap.get(id)?.name).filter(Boolean) as string[];
        deps.activityService.recordActivity(
          createActivityRecord(issueId, actorId, "issue.labels_added", {
            labelIds: added,
            labelNames,
          })
        );
      }
      
      if (removed.length) {
        const labelMap = buildLabelMap(deps.db, removed);
        const labelNames = removed.map((id) => labelMap.get(id)?.name).filter(Boolean) as string[];
        deps.activityService.recordActivity(
          createActivityRecord(issueId, actorId, "issue.labels_removed", {
            labelIds: removed,
            labelNames,
          })
        );
      }
    }
  }

  function deleteIssue(issueId: string, userId: string) {
    const issue = getIssueWithLabels(issueId, userId);
    
    return deps.db.transaction(() => {
      deps.activityService.recordActivity(
        createActivityRecord(issue.id, userId, "issue.deleted")
      );
      deps.db.delete(issues).where(eq(issues.id, issueId)).run();
    });
  }

  // Bulk Actions (Spec 007). All issues must share one workspace; the whole
  // operation is all-or-nothing in a single transaction. Reuses the same
  // per-issue mutation + activity path as updateIssue.
  function bulkUpdate(input: BulkIssueInput, userId: string): BulkIssueResponse {
    const { issueIds, action } = input;

    // Resolve every issue's workspace in one batched query.
    const rows = deps.db
      .select({ id: issues.id, workspaceId: projects.workspaceId })
      .from(issues)
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .where(inArray(issues.id, issueIds))
      .all();
    const foundIds = new Set(rows.map((r) => r.id));
    const missing = issueIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new ApiError(404, "NOT_FOUND", "Issues not found");
    }
    const workspaceIds = new Set(rows.map((r) => r.workspaceId));
    if (workspaceIds.size > 1) {
      throw new ApiError(422, "VALIDATION", "All issues must belong to the same workspace");
    }
    const workspaceId = rows[0].workspaceId;

    // Validate the single action value against the workspace once.
    if (action === "assign") validateAssignee(workspaceId, input.assigneeId);
    if (action === "addLabels" || action === "removeLabels") validateLabels(workspaceId, input.labelIds);

    deps.membershipService.requireMember(userId, workspaceId);

    return deps.db.transaction(() => {
      for (const issueId of issueIds) {
        // Member check + 404 for every issue, including deletions.
        const existing = getIssueWithLabels(issueId, userId);

        if (action === "delete") {
          deps.activityService.recordActivity(
            createActivityRecord(issueId, userId, "issue.deleted")
          );
          deps.db.delete(issues).where(eq(issues.id, issueId)).run();
          continue;
        }

        const updates: Record<string, unknown> = {};
        if (action === "setStatus") updates.status = input.status;
        else if (action === "setPriority") updates.priority = input.priority;
        else if (action === "assign") updates.assigneeId = input.assigneeId ?? null;
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date();
          deps.db.update(issues).set(updates).where(eq(issues.id, issueId)).run();
        }

        let nextLabelIds: string[] | null = null;
        if (action === "addLabels") {
          nextLabelIds = [...new Set([...existing.labelIds, ...input.labelIds])];
        } else if (action === "removeLabels") {
          const remove = new Set(input.labelIds);
          nextLabelIds = existing.labelIds.filter((id) => !remove.has(id));
        }
        if (nextLabelIds !== null) {
          deps.db.delete(issueLabels).where(eq(issueLabels.issueId, issueId)).run();
          if (nextLabelIds.length) {
            deps.db
              .insert(issueLabels)
              .values(nextLabelIds.map((labelId) => ({ issueId, labelId })))
              .run();
          }
        }

        const after = getIssueWithLabels(issueId, userId);
        recordChanges(existing, after, userId);
      }
      return { issueIds, count: issueIds.length };
    });
  }

  return {
    createIssue,
    getIssue,
    listIssues,
    updateIssue,
    deleteIssue,
    bulkUpdate,
  };
}

export type IssueService = ReturnType<typeof createIssueService>;