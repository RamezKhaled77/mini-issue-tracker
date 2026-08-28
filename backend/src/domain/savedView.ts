import { randomUUID } from "node:crypto";
import type { SavedViewFilters } from "@mini-issue-tracker/shared";

export interface SavedViewEntity {
  id: string;
  workspaceId: string;
  createdById: string;
  name: string;
  filters: SavedViewFilters;
  createdAt: Date;
  updatedAt: Date;
}

export function createSavedViewRecord(
  workspaceId: string,
  createdById: string,
  name: string,
  filters: SavedViewFilters
): SavedViewEntity {
  const now = new Date();
  return {
    id: randomUUID(),
    workspaceId,
    createdById,
    name,
    filters,
    createdAt: now,
    updatedAt: now,
  };
}