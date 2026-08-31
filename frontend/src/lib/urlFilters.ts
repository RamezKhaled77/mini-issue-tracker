/**
 * Pure URL filter helpers (spec 012 §10).
 *
 * The two ledger filter models stay logically separate; the URL is a
 * *projection* of applied filter state. These helpers only read/write
 * URLSearchParams per a declared key schema — they apply no filter logic.
 * Unknown keys are ignored on read so the URL can tolerate extra params.
 */

export function readFilters(
  searchParams: URLSearchParams,
  keys: readonly string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null && value !== "") out[key] = value;
  }
  return out;
}

export function writeFilters(
  filters: Record<string, string | undefined>,
  keys: readonly string[]
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }
  return params;
}

/** Workspace ledger (server-parameterized) filter keys. */
export const WORKSPACE_FILTER_KEYS = [
  "project",
  "status",
  "priority",
  "label",
  "view",
] as const;

/** My Issues (client-side) filter keys. */
export const MY_ISSUES_FILTER_KEYS = ["q", "status", "priority", "sort", "closed"] as const;