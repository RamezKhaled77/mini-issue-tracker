import { inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { labels } from "../db/schema.js";

export function buildLabelMap(
  db: Db,
  labelIds: string[]
): Map<string, { id: string; workspaceId: string; name: string; color: string }> {
  const map = new Map<string, { id: string; workspaceId: string; name: string; color: string }>();
  if (!labelIds.length) return map;
  const rows = db
    .select({
      id: labels.id,
      workspaceId: labels.workspaceId,
      name: labels.name,
      color: labels.color,
    })
    .from(labels)
    .where(inArray(labels.id, labelIds))
    .all();
  for (const r of rows) map.set(r.id, r);
  return map;
}