import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { issueLabels, issues, projects, users, workspaces } from "../db/schema.js";
import { resolveDisplayName } from "../lib/identity.js";
import { buildLabelMap } from "../lib/labels.js";
import type { MembershipService } from "./membership.js";
import type { IssuePriority, IssueStatus, Label, SearchResponse } from "@mini-issue-tracker/shared";

export interface SearchServiceDeps {
  db: Db;
  membershipService: MembershipService;
}

/** Escape LIKE wildcards so user input matches literally (used with ESCAPE '\'). */
export function escapeLikeNeedle(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Detects ticket-key-shaped queries: optional leading '#', then 1–6 hex characters.
 * These match the derived client-side issue key (`#ABCDEF` = first 6 UUID chars).
 */
export function extractTicketKeyPrefix(query: string): string | null {
  const candidate = query.startsWith("#") ? query.slice(1) : query;
  return /^[0-9a-fA-F]{1,6}$/.test(candidate) ? candidate.toUpperCase() : null;
}

export function createSearchService(deps: SearchServiceDeps) {
  function search(userId: string, rawQuery: string, limit: number): SearchResponse {
    const query = rawQuery.trim();
    const workspaceIds = deps.membershipService.getReachableWorkspaceIds(userId);
    if (workspaceIds.length === 0) return { total: 0, items: [] };

    const projectIds = deps.db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.workspaceId, workspaceIds))
      .all()
      .map((p) => p.id);
    if (projectIds.length === 0) return { total: 0, items: [] };

    // Authorization boundary lives entirely in these conditions.
    const scopeCondition = inArray(issues.projectId, projectIds);

    const containsNeedle = `%${escapeLikeNeedle(query)}%`;
    const prefixNeedle = `${escapeLikeNeedle(query)}%`;
    const keyPrefix = extractTicketKeyPrefix(query);
    const keyCondition = keyPrefix
      ? sql`upper(replace(${issues.id}, '-', '')) LIKE ${`${keyPrefix}%`}`
      : sql`0`;
    const matchCondition = sql`(
      ${issues.title} LIKE ${containsNeedle} ESCAPE '\\'
      OR ${issues.description} LIKE ${containsNeedle} ESCAPE '\\'
      OR ${projects.name} LIKE ${containsNeedle} ESCAPE '\\'
      OR ${keyCondition}
    )`;

    const where = and(scopeCondition, matchCondition);

    // Deterministic ranking: key prefix > exact title > title prefix > title contains >
    // description/project name; recency within tier; stable id tiebreak.
    const tierExpression = sql<number>`CASE
      WHEN ${keyCondition} THEN 1
      WHEN lower(${issues.title}) = ${query.toLowerCase()} THEN 2
      WHEN ${issues.title} LIKE ${prefixNeedle} ESCAPE '\\' THEN 3
      WHEN ${issues.title} LIKE ${containsNeedle} ESCAPE '\\' THEN 4
      ELSE 5
    END`;

    const total =
      deps.db
        .select({ count: sql<number>`count(*)` })
        .from(issues)
        .innerJoin(projects, eq(issues.projectId, projects.id))
        .where(where)
        .get()?.count ?? 0;

    const rows = deps.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        title: issues.title,
        status: issues.status,
        priority: issues.priority,
        assigneeId: issues.assigneeId,
        dueDate: issues.dueDate,
        updatedAt: issues.updatedAt,
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
      .where(where)
      .orderBy(tierExpression, sql`${issues.updatedAt} DESC`, issues.title)
      .limit(limit)
      .all();

    const labelMap = new Map<string, string[]>();
    if (rows.length) {
      const pairs = deps.db
        .select({ issueId: issueLabels.issueId, labelId: issueLabels.labelId })
        .from(issueLabels)
        .where(inArray(issueLabels.issueId, rows.map((r) => r.id)))
        .orderBy(sql`rowid`)
        .all();
      for (const p of pairs) {
        const arr = labelMap.get(p.issueId) ?? [];
        arr.push(p.labelId);
        labelMap.set(p.issueId, arr);
      }
    }
    const labelsById = buildLabelMap(
      deps.db,
      [...new Set([...labelMap.values()].flat())]
    );

    const items = rows.map((r) => {
      const ids = labelMap.get(r.id) ?? [];
      const labels = ids
        .map((id) => labelsById.get(id))
        .filter((l): l is NonNullable<ReturnType<typeof labelsById.get>> => Boolean(l)) as Label[];
      return {
        id: r.id,
        projectId: r.projectId,
        workspaceId: r.workspaceId,
        title: r.title,
        status: r.status as IssueStatus,
        priority: r.priority as IssuePriority,
        dueDate: r.dueDate,
        labelIds: ids,
        labels,
        assignee: r.assigneeId
          ? { id: r.assigneeId, name: resolveDisplayName(r.assigneeName, r.assigneeEmail ?? "") }
          : null,
        projectName: r.projectName,
        workspaceName: r.workspaceName,
      };
    });

    return { total, items };
  }

  return { search };
}

export type SearchService = ReturnType<typeof createSearchService>;
