import { randomUUID } from "node:crypto";
import type { LabelColor } from "@mini-issue-tracker/shared";

export interface LabelEntity {
  id: string;
  workspaceId: string;
  name: string;
  color: LabelColor;
}

export function createLabelRecord(workspaceId: string, name: string, color: LabelColor): LabelEntity {
  return { id: randomUUID(), workspaceId, name, color };
}