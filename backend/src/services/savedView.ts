import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { labels, projects, savedViews } from "../db/schema.js";
import { createSavedViewRecord } from "../domain/savedView.js";
import { ApiError } from "../api/middleware/error-handler.js";
import { savedViewFiltersSchema } from "../api/validators/savedView.js";
import type { CreateSavedViewInput, UpdateSavedViewInput } from "../api/validators/savedView.js";
import type { MembershipService } from "./membership.js";
import type { SavedView, SavedViewFilters } from "@mini-issue-tracker/shared";

export interface SavedViewServiceDeps {
  db: Db;
  membershipService: MembershipService;
}

interface SavedViewRow {
  id: string;
  workspaceId: string;
  createdById: string;
  name: string;
  filters: string;
  createdAt: Date;
  updatedAt: Date;
}

const savedViewColumns = {
  id: savedViews.id,
  workspaceId: savedViews.workspaceId,
  createdById: savedViews.createdById,
  name: savedViews.name,
  filters: savedViews.filters,
  createdAt: savedViews.createdAt,
  updatedAt: savedViews.updatedAt,
};

export function createSavedViewService(deps: SavedViewServiceDeps) {
  function getWorkspaceIdForView(viewId: string): string {
    const row = deps.db
      .select({ workspaceId: savedViews.workspaceId })
      .from(savedViews)
      .where(eq(savedViews.id, viewId))
      .get();
    if (!row) throw new ApiError(404, "NOT_FOUND", "Saved view not found");
    return row.workspaceId;
  }

  /** Write-time guard: a newly persisted config must reference entities within the workspace. */
  function validateWorkspaceRefs(workspaceId: string, filters: SavedViewFilters): void {
    const project = deps.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, filters.projectId), eq(projects.workspaceId, workspaceId)))
      .get();
    if (!project) {
      throw new ApiError(422, "VALIDATION", "Invalid saved view filters", {
        "filters.projectId": "Project does not exist in this workspace",
      });
    }
    if (filters.labelId) {
      const label = deps.db
        .select({ id: labels.id })
        .from(labels)
        .where(and(eq(labels.id, filters.labelId), eq(labels.workspaceId, workspaceId)))
        .get();
      if (!label) {
        throw new ApiError(422, "VALIDATION", "Invalid saved view filters", {
          "filters.labelId": "Label does not exist in this workspace",
        });
      }
    }
  }

  /** Re-validate stored JSON on read (drift guard); undefined = unreadable view, config untouched. */
  function parseStoredFilters(raw: string): SavedViewFilters | undefined {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return undefined;
    }
    const result = savedViewFiltersSchema.safeParse(parsed);
    return result.success ? result.data : undefined;
  }

  function toSavedView(row: SavedViewRow): SavedView {
    const filters = parseStoredFilters(row.filters);
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      createdById: row.createdById,
      name: row.name,
      filters,
      filtersValid: filters !== undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  function createSavedView(workspaceId: string, input: CreateSavedViewInput, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    validateWorkspaceRefs(workspaceId, input.filters);
    const view = createSavedViewRecord(workspaceId, userId, input.name, input.filters);
    try {
      deps.db
        .insert(savedViews)
        .values({
          id: view.id,
          workspaceId: view.workspaceId,
          createdById: view.createdById,
          name: view.name,
          filters: JSON.stringify(view.filters),
          createdAt: view.createdAt,
          updatedAt: view.updatedAt,
        })
        .run();
    } catch {
      throw new ApiError(409, "CONFLICT", "A view with this name already exists");
    }
    return toSavedView({
      id: view.id,
      workspaceId: view.workspaceId,
      createdById: view.createdById,
      name: view.name,
      filters: JSON.stringify(view.filters),
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    });
  }

  function listSavedViews(workspaceId: string, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    const rows = deps.db
      .select(savedViewColumns)
      .from(savedViews)
      .where(eq(savedViews.workspaceId, workspaceId))
      .orderBy(savedViews.createdAt)
      .all();
    return rows.map(toSavedView);
  }

  function updateSavedView(viewId: string, input: UpdateSavedViewInput, userId: string) {
    const workspaceId = getWorkspaceIdForView(viewId);
    deps.membershipService.requireMember(userId, workspaceId);

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.filters !== undefined) {
      validateWorkspaceRefs(workspaceId, input.filters);
      updates.filters = JSON.stringify(input.filters);
    }
    updates.updatedAt = new Date();

    try {
      deps.db.update(savedViews).set(updates).where(eq(savedViews.id, viewId)).run();
    } catch {
      throw new ApiError(409, "CONFLICT", "A view with this name already exists");
    }
    const row = deps.db.select(savedViewColumns).from(savedViews).where(eq(savedViews.id, viewId)).get();
    if (!row) throw new ApiError(404, "NOT_FOUND", "Saved view not found");
    return toSavedView(row);
  }

  function deleteSavedView(viewId: string, userId: string) {
    const workspaceId = getWorkspaceIdForView(viewId);
    deps.membershipService.requireMember(userId, workspaceId);
    deps.db.delete(savedViews).where(eq(savedViews.id, viewId)).run();
  }

  return {
    createSavedView,
    listSavedViews,
    updateSavedView,
    deleteSavedView,
    getWorkspaceIdForView,
  };
}

export type SavedViewService = ReturnType<typeof createSavedViewService>;
