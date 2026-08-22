// Pure selection helpers for bulk actions (Spec 007).
// Selection is an immutable Set<string> of issue IDs, independent of filters,
// sort, and current visibility (see spec §8 / §9).

/** Toggle a single issue id in the selection. */
export function toggle(sel: Set<string>, id: string): Set<string> {
  const next = new Set(sel);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Toggle an entire visible set at once. Operates on the currently visible
 * (post-filter) ids only; previously selected hidden issues are preserved.
 * If every visible id is already selected, they are all deselected; otherwise
 * they are all selected.
 */
export function selectVisible(sel: Set<string>, visibleIds: string[]): Set<string> {
  const next = new Set(sel);
  const allVisible = visibleIds.length > 0 && visibleIds.every((id) => sel.has(id));
  for (const id of visibleIds) {
    if (allVisible) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** Return an empty selection. */
export function clear(): Set<string> {
  return new Set();
}

/** Selected count. */
export function count(sel: Set<string>): number {
  return sel.size;
}

/**
 * Group the selected ids by their issue's workspace. `items` must carry
 * `id` + `workspaceId` (e.g. MyIssue). Used to enforce the single-workspace
 * bulk rule.
 */
export function partitionByWorkspace(
  sel: Set<string>,
  items: { id: string; workspaceId: string }[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const item of items) {
    if (sel.has(item.id)) {
      const arr = map.get(item.workspaceId) ?? [];
      arr.push(item.id);
      map.set(item.workspaceId, arr);
    }
  }
  return map;
}