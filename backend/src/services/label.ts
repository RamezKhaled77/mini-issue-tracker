import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { labels } from "../db/schema.js";
import { createLabelRecord } from "../domain/label.js";
import { ApiError } from "../api/middleware/error-handler.js";
import type { MembershipService } from "./membership.js";
import type { CreateLabelInput, UpdateLabelInput } from "../api/validators/label.js";

export interface LabelServiceDeps {
  db: Db;
  membershipService: MembershipService;
}

export function createLabelService(deps: LabelServiceDeps) {
  function getWorkspaceIdForLabel(labelId: string): string {
    const row = deps.db
      .select({ workspaceId: labels.workspaceId })
      .from(labels)
      .where(eq(labels.id, labelId))
      .get();
    if (!row) throw new ApiError(404, "NOT_FOUND", "Label not found");
    return row.workspaceId;
  }

  function createLabel(workspaceId: string, input: CreateLabelInput, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    const label = createLabelRecord(workspaceId, input.name, input.color);
    try {
      deps.db.insert(labels).values(label).run();
    } catch {
      throw new ApiError(409, "CONFLICT", "A label with this name already exists");
    }
    return { id: label.id, workspaceId: label.workspaceId, name: label.name, color: label.color };
  }

  function listLabels(workspaceId: string, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    return deps.db
      .select({ id: labels.id, workspaceId: labels.workspaceId, name: labels.name, color: labels.color })
      .from(labels)
      .where(eq(labels.workspaceId, workspaceId))
      .orderBy(labels.name)
      .all();
  }

  function updateLabel(labelId: string, input: UpdateLabelInput, userId: string) {
    const workspaceId = getWorkspaceIdForLabel(labelId);
    deps.membershipService.requireMember(userId, workspaceId);
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.color !== undefined) updates.color = input.color;
    try {
      deps.db.update(labels).set(updates).where(eq(labels.id, labelId)).run();
    } catch {
      throw new ApiError(409, "CONFLICT", "A label with this name already exists");
    }
    const row = deps.db
      .select({ id: labels.id, workspaceId: labels.workspaceId, name: labels.name, color: labels.color })
      .from(labels)
      .where(eq(labels.id, labelId))
      .get();
    if (!row) throw new ApiError(404, "NOT_FOUND", "Label not found");
    return row;
  }

  function deleteLabel(labelId: string, userId: string) {
    const workspaceId = getWorkspaceIdForLabel(labelId);
    deps.membershipService.requireMember(userId, workspaceId);
    deps.db.delete(labels).where(eq(labels.id, labelId)).run();
  }

  return { createLabel, listLabels, updateLabel, deleteLabel, getWorkspaceIdForLabel };
}

export type LabelService = ReturnType<typeof createLabelService>;