import { and, eq, inArray, or } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db/client.js";
import { invitations, memberships, workspaces } from "../db/schema.js";
import { createInvitationRecord, createWorkspaceRecord } from "../domain/workspace.js";
import { ApiError } from "../api/middleware/error-handler.js";
import type { MembershipService } from "./membership.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface WorkspaceServiceDeps {
  db: Db;
  membershipService: MembershipService;
}

export function createWorkspaceService(deps: WorkspaceServiceDeps) {
  function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  function createWorkspace(name: string, ownerId: string) {
    const duplicate = deps.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.name, name), eq(workspaces.ownerId, ownerId)))
      .get();
    if (duplicate) {
      throw new ApiError(409, "CONFLICT", "You already own a workspace with this name");
    }
    const workspace = createWorkspaceRecord(name, ownerId);
    deps.db.insert(workspaces).values(workspace).run();
    deps.membershipService.addMember(ownerId, workspace.id);
    return { ...workspace, isOwner: true };
  }

  function listWorkspaces(userId: string) {
    const memberWorkspaceIds = deps.db
      .select({ workspaceId: memberships.workspaceId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .all()
      .map((r) => r.workspaceId);
    const rows = deps.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerId: workspaces.ownerId,
      })
      .from(workspaces)
      .where(
        or(
          eq(workspaces.ownerId, userId),
          inArray(workspaces.id, memberWorkspaceIds)
        )
      )
      .all();
    return rows.map((r) => ({ ...r, isOwner: r.ownerId === userId }));
  }

  function createInvitation(workspaceId: string, ownerId: string) {
    deps.membershipService.requireOwner(ownerId, workspaceId);
    const token = randomBytes(24).toString("base64url");
    const invitation = createInvitationRecord(workspaceId, hashToken(token), INVITATION_TTL_MS);
    deps.db.insert(invitations).values(invitation).run();
    return { token, expiresAt: invitation.expiresAt.toISOString() };
  }

  function joinWorkspace(token: string, userId: string) {
    const invitation = deps.db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashToken(token)))
      .get();
    if (!invitation) {
      throw new ApiError(422, "VALIDATION", "Invalid invitation");
    }
    if (invitation.usedAt) {
      throw new ApiError(422, "VALIDATION", "Invitation has already been used");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ApiError(422, "VALIDATION", "Invitation has expired");
    }
    deps.db
      .update(invitations)
      .set({ usedAt: new Date() })
      .where(eq(invitations.id, invitation.id))
      .run();
    deps.membershipService.addMember(userId, invitation.workspaceId);
    const workspace = deps.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerId: workspaces.ownerId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, invitation.workspaceId))
      .get();
    if (!workspace) throw new ApiError(404, "NOT_FOUND", "Workspace not found");
    return { ...workspace, isOwner: workspace.ownerId === userId };
  }

  function removeMember(workspaceId: string, ownerId: string, userIdToRemove: string) {
    deps.membershipService.requireOwner(ownerId, workspaceId);
    const ws = deps.db.select({ ownerId: workspaces.ownerId }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
    if (ws?.ownerId === userIdToRemove) {
      throw new ApiError(422, "VALIDATION", "The workspace owner cannot be removed");
    }
    deps.membershipService.removeMember(userIdToRemove, workspaceId);
  }

  function getWorkspace(workspaceId: string, userId: string) {
    deps.membershipService.requireMember(userId, workspaceId);
    const workspace = deps.db
      .select({ id: workspaces.id, name: workspaces.name, ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .get();
    if (!workspace) throw new ApiError(404, "NOT_FOUND", "Workspace not found");
    return { ...workspace, isOwner: workspace.ownerId === userId };
  }

  return {
    createWorkspace,
    listWorkspaces,
    createInvitation,
    joinWorkspace,
    removeMember,
    getWorkspace,
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;