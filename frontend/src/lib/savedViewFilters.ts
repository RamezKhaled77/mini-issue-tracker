import type { SavedView } from "@mini-issue-tracker/shared";

/**
 * Resolve a stored Saved View config into the workspace ledger's filter state.
 *
 * The existing filtering system stays the source of truth: applying a view
 * simply sets the ledger's own filter state. References are validated against
 * the entities currently known to the frontend — stale references are surfaced
 * to the caller instead of being fabricated or silently applied.
 */
export interface ResolvedSavedView {
  projectId: string;
  search: string;
  status: string;
  priority: string;
  labelId: string;
  /** The view's project no longer exists in this workspace. */
  staleProject: boolean;
  /** The view's label no longer exists in this workspace (dropped on apply). */
  staleLabel: boolean;
}

export function resolveSavedViewFilters(
  view: SavedView,
  projectIds: ReadonlySet<string>,
  labelIds: ReadonlySet<string>
): ResolvedSavedView | null {
  // Unreadable stored config — the view cannot be applied (it can still be
  // renamed or deleted).
  if (!view.filters || !view.filtersValid) return null;
  const filters = view.filters;
  return {
    projectId: filters.projectId,
    search: filters.search ?? "",
    status: filters.status ?? "",
    priority: filters.priority ?? "",
    labelId: filters.labelId ?? "",
    staleProject: !projectIds.has(filters.projectId),
    staleLabel: filters.labelId !== undefined && !labelIds.has(filters.labelId),
  };
}

export function savedViewAvailabilityNote(resolved: ResolvedSavedView): string | null {
  if (resolved.staleProject) return "project unavailable";
  if (resolved.staleLabel) return "label unavailable";
  return null;
}
