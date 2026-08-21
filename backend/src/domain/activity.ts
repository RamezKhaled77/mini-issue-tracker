import { randomUUID } from "node:crypto";
import type { Activity, ActivityType, ActivityField } from "@mini-issue-tracker/shared";
import { resolveDisplayName } from "../lib/identity.js";

export function createActivityRecord(
  issueId: string,
  actorId: string,
  type: ActivityType,
  options?: {
    field?: ActivityField;
    fromValue?: string | null;
    toValue?: string | null;
    labelIds?: string[];
    labelNames?: string[];
  }
): Activity {
  return {
    id: randomUUID(),
    issueId,
    actorId,
    actorName: "",
    type,
    field: options?.field,
    fromValue: options?.fromValue ?? null,
    toValue: options?.toValue ?? null,
    labelIds: options?.labelIds ?? null,
    labelNames: options?.labelNames ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function truncateDescription(text: string | null, maxLength = 200): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

export function resolveActorName(name: string | null, email: string): string {
  return resolveDisplayName(name, email);
}