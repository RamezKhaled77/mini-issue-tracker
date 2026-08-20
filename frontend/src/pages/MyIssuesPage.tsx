import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import type { MyIssuesResponse } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import { Alert } from "../components/Alert.js";
import { Avatar } from "../components/Avatar.js";
import { Badge } from "../components/Badge.js";
import type { BadgeTone } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { EmptyState } from "../components/EmptyState.js";
import { Field } from "../components/Field.js";
import { SkeletonRows } from "../components/Skeleton.js";
import { issueKey } from "../lib/issueKey.js";
import { isOverdue } from "../lib/isOverdue.js";
import { labelTone } from "../lib/labelTone.js";
import { applyMyIssuesView } from "../lib/myIssuesView.js";
import type { MyIssuesSortKey } from "../lib/myIssuesView.js";

export function MyIssuesPage() {
  const [data, setData] = useState<MyIssuesResponse | null>(null);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sort, setSort] = useState<MyIssuesSortKey>("default");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const visibleItems = useMemo(
    () => applyMyIssuesView(data?.items ?? [], { search, status: statusFilter, priority: priorityFilter, sort }),
    [data, search, statusFilter, priorityFilter, sort]
  );
  const filtering = Boolean(search || statusFilter || priorityFilter || sort !== "default");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    api
      .get<MyIssuesResponse>(
        includeClosed ? "/my-issues?includeClosed=true" : "/my-issues"
      )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your issues");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [includeClosed, reloadKey]);

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">My Issues</h1>
      </div>

      {error && (
        <Alert role="alert" className="page-alert">
          {error}
        </Alert>
      )}

      <section className="stat-strip" aria-label="Your issue statistics">
        {data ? (
          <>
            <div className="stat-cells">
              <div className="stat-cell">
                <span className="stat-value">{data.overview.byStatus.Open}</span>
                <span className="stat-label">Open</span>
              </div>
              <div className="stat-cell">
                <span className="stat-value">{data.overview.byStatus["In Progress"]}</span>
                <span className="stat-label">In Progress</span>
              </div>
              <div className="stat-cell">
                <span className="stat-value">{data.overview.overdue}</span>
                <span className="stat-label">Overdue</span>
              </div>
            </div>
            <div className="stat-meta">
              <span className="stat-meta-total">{data.overview.total} assigned to you</span>
            </div>
          </>
        ) : (
          <SkeletonRows rows={1} className="stat-skeleton" />
        )}
      </section>

      <div className="my-issues-toolbar">
        <label className="include-closed">
          <input
            type="checkbox"
            checked={includeClosed}
            onChange={(e) => setIncludeClosed(e.target.checked)}
          />
          Include closed
        </label>
      </div>

      {data && (
        <div className="filter-bar" role="search">
          <Field label="Search your issues" srOnlyLabel className="field-grow search-field">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or description"
            />
          </Field>
          <Field label="Filter by status" srOnlyLabel>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {ISSUE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Filter by priority" srOnlyLabel>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">All priorities</option>
              {ISSUE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort by" srOnlyLabel>
            <select value={sort} onChange={(e) => setSort(e.target.value as MyIssuesSortKey)}>
              <option value="default">Default order</option>
              <option value="due-asc">Due date: earliest first</option>
              <option value="due-desc">Due date: latest first</option>
              <option value="priority-high">Priority: highest first</option>
              <option value="priority-low">Priority: lowest first</option>
              <option value="title-az">Title: A–Z</option>
              <option value="title-za">Title: Z–A</option>
            </select>
          </Field>
          <div className="filter-meta">
            <span className="filter-count">
              {visibleItems.length} result{visibleItems.length === 1 ? "" : "s"}
            </span>
            {filtering && (
              <span className="filter-active">
                Filtering
                <Button
                  type="button"
                  variant="ghost"
                  className="filter-clear"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                    setPriorityFilter("");
                    setSort("default");
                  }}
                >
                  Clear filters &amp; sort
                </Button>
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="my-issues-retry">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Try again
          </Button>
        </div>
      )}

      {loading && !data ? (
        <SkeletonRows rows={4} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          title="No issues assigned to you"
          description="Issues assigned to you across your workspaces will appear here."
        />
      ) : data && visibleItems.length === 0 ? (
        <EmptyState
          title="No matching issues"
          description="No issues match your search or filters."
        />
      ) : data ? (
        <ul className="ledger-list">
          {visibleItems.map((issue) => (
            <li key={issue.id}>
              <Link
                to={`/workspaces/${issue.workspaceId}/issues/${issue.id}`}
                className="ledger-row"
                data-priority={issue.priority.toLowerCase()}
                data-overdue={isOverdue(issue.dueDate, issue.status) ? "true" : undefined}
              >
                <span className="ticket-key">{issueKey(issue.id)}</span>
                <span className="ledger-main">
                  <span className="ledger-title">{issue.title}</span>
                  {issue.description && (
                    <span className="ledger-subtitle">{issue.description}</span>
                  )}
                </span>
                <span className="ledger-meta">
                  <span className="ledger-context">
                    {issue.workspaceName} / {issue.projectName}
                  </span>
                  {isOverdue(issue.dueDate, issue.status) && (
                    <Badge tone="danger">Overdue</Badge>
                  )}
                  <Badge tone={`status-${issue.status.toLowerCase().replace(" ", "-")}` as BadgeTone}>
                    {issue.status}
                  </Badge>
                  <Badge tone={`priority-${issue.priority.toLowerCase()}` as BadgeTone}>
                    {issue.priority}
                  </Badge>
                  {(issue.labels ?? []).slice(0, 2).map((label) => (
                    <Badge key={label.id} tone={labelTone(label.color)}>
                      {label.name}
                    </Badge>
                  ))}
                  {(issue.labels ?? []).length > 2 && (
                    <span className="ledger-more-labels">
                      +{issue.labels.length - 2} more
                    </span>
                  )}
                  {issue.assignee && (
                    <span className="card-assignee">
                      <Avatar name={issue.assignee.name} decorative small />
                      {issue.assignee.name}
                    </span>
                  )}
                </span>
                <span className="ledger-chevron" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}