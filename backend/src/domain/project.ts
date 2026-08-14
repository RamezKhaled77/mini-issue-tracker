import { randomUUID } from "node:crypto";

export interface ProjectEntity {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createProjectRecord(workspaceId: string, name: string): ProjectEntity {
  const now = new Date();
  return { id: randomUUID(), workspaceId, name, createdAt: now, updatedAt: now };
}