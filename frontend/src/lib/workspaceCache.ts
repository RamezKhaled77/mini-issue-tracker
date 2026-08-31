import type { Workspace } from "@mini-issue-tracker/shared";
import { api } from "../api/client.js";

/**
 * Module-scope workspace list cache for the shell (WorkspaceSwitcher).
 * The Dashboard page refetches locally on create/join; this cache is exposed
 * so mutations elsewhere can refresh it (spec 012 §23.1). No new state layer.
 */
let cachedWorkspaces: Workspace[] | null = null;

export function getCachedWorkspaces(): Workspace[] {
  return cachedWorkspaces ?? [];
}

export function refreshWorkspaceCache(): Promise<void> {
  return api
    .get<{ items: Workspace[] }>("/workspaces")
    .then((res) => {
      cachedWorkspaces = res.items;
    })
    .catch(() => {
      /* keep the last known list on failure — never fabricate membership */
    });
}

export function initWorkspaceCache(): Promise<Workspace[]> {
  if (cachedWorkspaces) return Promise.resolve(cachedWorkspaces);
  return refreshWorkspaceCache().then(() => cachedWorkspaces ?? []);
}