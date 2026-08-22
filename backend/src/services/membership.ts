import { and, eq, inArray, or } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { memberships, users, workspaces } from "../db/schema.js";
import { resolveDisplayName } from "../lib/identity.js";
import { ApiError } from "../api/middleware/error-handler.js";

export interface MembershipServiceDeps {
  db: Db;
}

export function createMembershipService(deps: MembershipServiceDeps) {
  function isMember(userId: string, workspaceId: string): boolean {
    const row = deps.db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)))
      .get();
    return Boolean(row);
  }

  function isOwner(userId: string, workspaceId: string): boolean {
    const ws = deps.db
      .select({ ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .get();
    return Boolean(ws && ws.ownerId === userId);
  }

  function requireMember(userId: string, workspaceId: string): void {
    if (!isMember(userId, workspaceId) && !isOwner(userId, workspaceId)) {
      throw new ApiError(403, "FORBIDDEN", "You are not a member of this workspace");
    }
  }

  function requireOwner(userId: string, workspaceId: string): void {
    if (!isOwner(userId, workspaceId)) {
      throw new ApiError(403, "FORBIDDEN", "Only the workspace owner can perform this action");
    }
  }

  function addMember(userId: string, workspaceId: string): void {
    deps.db
      .insert(memberships)
      .values({ userId, workspaceId, joinedAt: new Date() })
      .onConflictDoNothing()
      .run();
  }

  function removeMember(userId: string, workspaceId: string): void {
    deps.db
      .delete(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)))
      .run();
  }

  function listMemberIds(workspaceId: string): string[] {
    return deps.db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId))
      .all()
      .map((r) => r.userId);
  }

  function listMembers(workspaceId: string) {
    return deps.db
      .select({ userId: users.id, email: users.email, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.workspaceId, workspaceId))
      .all()
      .map((m) => ({ userId: m.userId, email: m.email, name: resolveDisplayName(m.name, m.email) }));
  }

  /**
   * Every workspace whose issues the user may see: memberships ∪ owned workspaces.
   * Single source of truth for cross-workspace scopes (My Issues, Global Search).
   */
  function getReachableWorkspaceIds(userId: string): string[] {
    return deps.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        or(
          eq(workspaces.ownerId, userId),
          inArray(
            workspaces.id,
            deps.db
              .select({ workspaceId: memberships.workspaceId })
              .from(memberships)
              .where(eq(memberships.userId, userId))
          )
        )
      )
      .all()
      .map((r) => r.id);
  }

  return {
    isMember,
    isOwner,
    requireMember,
    requireOwner,
    addMember,
    removeMember,
    listMemberIds,
    listMembers,
    getReachableWorkspaceIds,
  };
}

export type MembershipService = ReturnType<typeof createMembershipService>;