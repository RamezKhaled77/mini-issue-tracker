import { randomUUID } from "node:crypto";

export interface WorkspaceEntity {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationEntity {
  id: string;
  workspaceId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export function createWorkspaceRecord(name: string, ownerId: string): WorkspaceEntity {
  const now = new Date();
  return { id: randomUUID(), name, ownerId, createdAt: now, updatedAt: now };
}

export function createInvitationRecord(
  workspaceId: string,
  tokenHash: string,
  ttlMs: number
): InvitationEntity {
  const now = new Date();
  return {
    id: randomUUID(),
    workspaceId,
    tokenHash,
    expiresAt: new Date(now.getTime() + ttlMs),
    usedAt: null,
    createdAt: now,
  };
}