import type {
  ActivityListResponse,
  BulkIssueRequest,
  BulkIssueResponse,
  CreateSavedViewRequest,
  SavedView,
  SearchResponse,
  UpdateSavedViewRequest,
} from "@mini-issue-tracker/shared";

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error?.code ?? "ERROR", body.error?.message ?? "Request failed", body.error?.fields ?? {});
  }
  return body as T;
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  if (!params) return path;
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  getActivity: (issueId: string, params?: { page?: number; pageSize?: number }) =>
    request<ActivityListResponse>(buildUrl(`/issues/${issueId}/activity`, params as Record<string, unknown> | undefined)),
  bulkUpdate: (body: BulkIssueRequest) =>
    request<BulkIssueResponse>("/issues/bulk", { method: "POST", body: JSON.stringify(body) }),
  search: (q: string, options?: { limit?: number; signal?: AbortSignal }) =>
    request<SearchResponse>(
      buildUrl("/search", { q, limit: options?.limit }),
      options?.signal ? { signal: options.signal } : undefined
    ),
  getMembers: (workspaceId: string) =>
    request<{ items: { userId: string; name: string }[] }>(`/workspaces/${workspaceId}/members`),
  /* Saved Views (Spec 009). */
  listSavedViews: (workspaceId: string) =>
    request<{ items: SavedView[] }>(`/workspaces/${workspaceId}/views`),
  createSavedView: (workspaceId: string, body: CreateSavedViewRequest) =>
    request<{ view: SavedView }>(`/workspaces/${workspaceId}/views`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSavedView: (id: string, body: UpdateSavedViewRequest) =>
    request<{ view: SavedView }>(`/views/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSavedView: (id: string) => request<void>(`/views/${id}`, { method: "DELETE" }),
};
