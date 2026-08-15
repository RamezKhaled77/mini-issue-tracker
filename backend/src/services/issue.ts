import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { issueLabels, issues, labels, memberships, users } from "../db/schema.js";
import { createIssueRecord, createLabelRecord } from "../domain/issue.js";
import { resolveDisplayName } from "../lib/identity.js";
import { ApiError } from "../api/middleware/error-handler.js";
import type { MembershipService } from "./membership.js";
import type { ProjectService } from "./project.js";
import type { IssueQueryInput, UpdateIssueInput } from "../api/validators/issue.js";

export interface IssueServiceDeps {
  db: Db;
  membershipService: MembershipService;
  projectService: ProjectService;
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
    const found = deps.db
      .select({ id: labels.id })
      .from(labels)
      .where(inArray(labels.id, labelIds))
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
    deps.db.insert(issues).values(issue).run();
    if (input.labelIds?.length) {
      deps.db
        .insert(issueLabels)
        .values(input.labelIds.map((labelId) => ({ issueId: issue.id, labelId })))
        .run();
    }
    return getIssue(issue.id, userId);
  }

  function getIssue(issueId: string, userId: string) {
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
      .all();
    const { assigneeName, assigneeEmail, ...rest } = issue;
    return {
      ...rest,
      status: issue.status as never,
      priority: issue.priority as never,
      labelIds: labelRows.map((r) => r.labelId),
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
        .all();
      for (const p of pairs) {
        const arr = labelMap.get(p.issueId) ?? [];
        arr.push(p.labelId);
        labelMap.set(p.issueId, arr);
      }
    }

    return {
      items: rows.map((r) => {
        const { assigneeName, assigneeEmail, ...rest } = r;
        return {
          ...rest,
          status: r.status as never,
          priority: r.priority as never,
          labelIds: labelMap.get(r.id) ?? [],
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
    const existing = getIssue(issueId, userId);
    const workspaceId = getProjectWorkspace(existing.projectId);
    if (input.assigneeId !== undefined) validateAssignee(workspaceId, input.assigneeId);
    if (input.labelIds !== undefined) validateLabels(workspaceId, input.labelIds);

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
    return getIssue(issueId, userId);
  }

  function deleteIssue(issueId: string, userId: string) {
    getIssue(issueId, userId);
    deps.db.delete(issues).where(eq(issues.id, issueId)).run();
  }

  function createLabel(workspaceId: string, name: string, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    const label = createLabelRecord(workspaceId, name);
    try {
      deps.db.insert(labels).values(label).run();
    } catch {
      throw new ApiError(409, "CONFLICT", "A label with this name already exists");
    }
    return label;
  }

  function listLabels(workspaceId: string, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    return deps.db
      .select({ id: labels.id, workspaceId: labels.workspaceId, name: labels.name })
      .from(labels)
      .where(eq(labels.workspaceId, workspaceId))
      .all();
  }

  return {
    createIssue,
    getIssue,
    listIssues,
    updateIssue,
    deleteIssue,
    createLabel,
    listLabels,
  };
}

export type IssueService = ReturnType<typeof createIssueService>;