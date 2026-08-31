import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { BulkIssueRequest, Label, MyIssuesResponse } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import { Alert } from "../components/Alert.js";
import { Avatar } from "../components/Avatar.js";
import { Badge } from "../components/Badge.js";
import type { BadgeTone } from "../components/Badge.js";
import { LedgerList } from "../components/LedgerList.js";
import { LedgerRow } from "../components/LedgerRow.js";
import { Button } from "../components/Button.js";
import { EmptyState } from "../components/EmptyState.js";
import { FilterBar } from "../components/FilterBar.js";
import { Checkbox } from "../components/Checkbox.js";
import { SkeletonRows } from "../components/Skeleton.js";
import { BulkToolbar } from "../components/BulkToolbar.js";
import type { BulkMember } from "../components/BulkToolbar.js";
import { QuickEditSelect } from "../components/QuickEditSelect.js";
import { QuickEditLabels } from "../components/QuickEditLabels.js";
import { QuickEditDate } from "../components/QuickEditDate.js";
import {
  openQuickEdit,
  closeQuickEdit,
  isQuickEditing,
} from "../components/quickEdit.js";
import type { QuickEditField, QuickEditState } from "../components/quickEdit.js";
import { issueKey } from "../lib/issueKey.js";
import { isOverdue } from "../lib/isOverdue.js";
import { labelTone } from "../lib/labelTone.js";
import { applyMyIssuesView } from "../lib/myIssuesView.js";
import type { MyIssuesSortKey } from "../lib/myIssuesView.js";
import { toggle, selectVisible, partitionByWorkspace } from "../lib/bulkSelection.js";
import { readFilters, writeFilters, MY_ISSUES_FILTER_KEYS } from "../lib/urlFilters.js";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlInitRef = useRef(false);

  // URL-encoded filter state (spec 012 §10). Read once on mount, then project
  // the client-side filter state onto the URL with replace.
  useEffect(() => {
    if (urlInitRef.current) return;
    urlInitRef.current = true;
    const filters = readFilters(searchParams, MY_ISSUES_FILTER_KEYS);
    if (filters.q) setSearch(filters.q);
    if (filters.status) setStatusFilter(filters.status);
    if (filters.priority) setPriorityFilter(filters.priority);
    if (filters.sort) setSort(filters.sort as MyIssuesSortKey);
    if (filters.closed === "true") setIncludeClosed(true);
  }, [searchParams]);

  useEffect(() => {
    if (!urlInitRef.current) return;
    const filters: Record<string, string | undefined> = {
      q: search,
      status: statusFilter,
      priority: priorityFilter,
      sort: sort === "default" ? undefined : sort,
      closed: includeClosed ? "true" : undefined,
    };
    setSearchParams(writeFilters(filters, MY_ISSUES_FILTER_KEYS), { replace: true });
  }, [search, statusFilter, priorityFilter, sort, includeClosed, setSearchParams]);

  // Bulk selection state (Spec 007). Cross-workspace selections are disabled.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<BulkMember[]>([]);
  const [wsLabels, setWsLabels] = useState<Label[]>([]);
  const [applying, setApplying] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Quick Edit state (Spec 010). One edit at a time (D-06); busy blocks
  // duplicate submissions (D-12); errors are row-local (D-08).
  //
  // D-10 limitation (spec §23 addendum): members/wsLabels are only fetched for
  // the single selected workspace (`singleWorkspaceId`). Rows outside that
  // workspace render their assignee chip / label badges read-only rather than
  // fabricating option data.
  const [quickEdit, setQuickEdit] = useState<QuickEditState | null>(null);
  const [qeBusy, setQeBusy] = useState(false);
  const [qeError, setQeError] = useState<{ issueId: string; message: string } | null>(null);
  const qeAlertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (qeError) {
      qeAlertRef.current?.focus();
    }
  }, [qeError]);

  function openField(issueId: string, field: QuickEditField) {
    setQeError(null);
    setQuickEdit((prev) => openQuickEdit(prev, issueId, field));
  }

  function closeField(issueId: string, field: QuickEditField) {
    setQuickEdit((prev) => closeQuickEdit(prev, issueId, field));
  }

  /** Commit a Quick Edit change through the existing PATCH endpoint (D-01/D-02). */
  async function commitQuickEdit(issueId: string, body: Record<string, unknown>) {
    setQeBusy(true);
    setQeError(null);
    try {
      await api.patch(`/issues/${issueId}`, body);
      setQuickEdit(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      // D-08: row-local Alert; the control stays open with the committed value.
      setQeError({
        issueId,
        message: err instanceof Error ? err.message : "Could not update the issue",
      });
    } finally {
      setQeBusy(false);
    }
  }

  const visibleItems = useMemo(
    () => applyMyIssuesView(data?.items ?? [], { search, status: statusFilter, priority: priorityFilter, sort }),
    [data, search, statusFilter, priorityFilter, sort]
  );
  const filtering = Boolean(search || statusFilter || priorityFilter || sort !== "default");

  // Bulk: group the selection by workspace over ALL fetched items (selected
  // issues hidden by filters still belong to the operation).
  const allItems = data?.items ?? [];
  const workspaceGroups = useMemo(
    () => partitionByWorkspace(selected, allItems),
    [selected, allItems]
  );
  const workspaceIds = [...workspaceGroups.keys()];
  const mixedSelection = workspaceIds.length > 1;
  const singleWorkspaceId = workspaceIds.length === 1 ? workspaceIds[0] : null;
  const singleWorkspaceName =
    singleWorkspaceId !== null
      ? (allItems.find((i) => i.workspaceId === singleWorkspaceId)?.workspaceName ?? null)
      : null;

  useEffect(() => {
    if (singleWorkspaceId === null) {
      setMembers([]);
      setWsLabels([]);
      return;
    }
    let cancelled = false;
    api
      .get<{ items: BulkMember[] }>(`/workspaces/${singleWorkspaceId}/members`)
      .then((res) => {
        if (!cancelled) setMembers(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    api
      .get<{ items: Label[] }>(`/workspaces/${singleWorkspaceId}/labels`)
      .then((res) => {
        if (!cancelled) setWsLabels(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setWsLabels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [singleWorkspaceId]);

  const visibleIds = visibleItems.map((i) => i.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [visibleIds, selected, someVisibleSelected, allVisibleSelected]);

  function handleSelectAll() {
    setSelected((prev) => selectVisible(prev, visibleIds));
  }

  async function handleBulkApply(request: BulkIssueRequest) {
    setApplying(true);
    setBulkError(null);
    try {
      await api.bulkUpdate(request);
      setReloadKey((k) => k + 1);
      setSelected(new Set());
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setApplying(false);
    }
  }

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
              <div className="stat-cell stat-cell--open">
                <span className="stat-value">{data.overview.byStatus.Open}</span>
                <span className="stat-label">Open</span>
              </div>
              <div className="stat-cell stat-cell--in-progress">
                <span className="stat-value">{data.overview.byStatus["In Progress"]}</span>
                <span className="stat-label">In Progress</span>
              </div>
              <div className="stat-cell stat-cell--overdue">
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
         <Checkbox
           label="Include closed"
           checked={includeClosed}
           onChange={(e) => setIncludeClosed(e.target.checked)}
         />
       </div>

      {data && (
        <FilterBar
          query={{
            value: search,
            onChange: setSearch,
            placeholder: "Search title or description",
            label: "Search your issues",
          }}
          selects={[
            {
              id: "status",
              label: "Filter by status",
              value: statusFilter,
              options: [{ value: "", label: "All statuses" }, ...ISSUE_STATUSES.map((s) => ({ value: s, label: s }))],
              onChange: setStatusFilter,
            },
            {
              id: "priority",
              label: "Filter by priority",
              value: priorityFilter,
              options: [{ value: "", label: "All priorities" }, ...ISSUE_PRIORITIES.map((p) => ({ value: p, label: p }))],
              onChange: setPriorityFilter,
            },
          ]}
          sort={{
            label: "Sort by",
            value: sort,
            options: [
              { value: "default", label: "Default order" },
              { value: "due-asc", label: "Due date: earliest first" },
              { value: "due-desc", label: "Due date: latest first" },
              { value: "priority-high", label: "Priority: highest first" },
              { value: "priority-low", label: "Priority: lowest first" },
              { value: "title-az", label: "Title: A–Z" },
              { value: "title-za", label: "Title: Z–A" },
            ],
            onChange: (value) => setSort(value as MyIssuesSortKey),
          }}
          resultCount={
            <span className="filter-count">
              {visibleItems.length} result{visibleItems.length === 1 ? "" : "s"}
            </span>
          }
          isFiltering={filtering}
          onClear={() => {
            setSearch("");
            setStatusFilter("");
            setPriorityFilter("");
            setSort("default");
          }}
          clearLabel="Clear filters &amp; sort"
        />
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
        <>
          <div className="bulk-selection-bar">
<label className="bulk-select-all">
               <Checkbox
                 ref={selectAllRef}
                 label="Select all visible"
                 checked={allVisibleSelected}
                 onChange={handleSelectAll}
               />
             </label>
          </div>

          {bulkError && (
            <Alert role="alert" className="page-alert">
              {bulkError}
            </Alert>
          )}

          {selected.size > 0 && (
            <BulkToolbar
              selectedIds={[...selected]}
              selectedCount={selected.size}
              members={members}
              labels={wsLabels}
              disabled={mixedSelection}
              disabledNote={
                mixedSelection
                  ? "Bulk actions need issues from a single workspace."
                  : singleWorkspaceName
              }
              applying={applying}
              onApply={handleBulkApply}
              onClear={() => setSelected(new Set())}
            />
          )}

          <LedgerList
            ariaLabel="My issues"
            rows={visibleItems.map((issue) => (
              <LedgerRow
                key={issue.id}
                to={`/workspaces/${issue.workspaceId}/issues/${issue.id}`}
                issueKey={issueKey(issue.id)}
                title={issue.title}
                caption={issue.description}
                priority={{ tone: "neutral" as BadgeTone, label: issue.priority }}
                overdue={isOverdue(issue.dueDate, issue.status)}
                selected={selected.has(issue.id)}
                selectable={{
                  checked: selected.has(issue.id),
                  onChange: () => setSelected((prev) => toggle(prev, issue.id)),
                  label: `Select ${issue.title}`,
                }}
                meta={
                  <>
                    <span className="ledger-context">
                      {issue.workspaceName} / {issue.projectName}
                    </span>
                    {isOverdue(issue.dueDate, issue.status) && (
                      <Badge tone="danger">Overdue</Badge>
                    )}
                    <QuickEditSelect
                      field="status"
                      open={isQuickEditing(quickEdit, issue.id, "status")}
                      busy={qeBusy}
                      value={issue.status}
                      displayValue={issue.status}
                      tone={`status-${issue.status.toLowerCase().replace(" ", "-")}`}
                      options={ISSUE_STATUSES.map((s) => ({ value: s, label: s }))}
                      onOpen={() => openField(issue.id, "status")}
                      onCommit={(status) => commitQuickEdit(issue.id, { status })}
                      onCancel={() => closeField(issue.id, "status")}
                    />
                    <QuickEditSelect
                      field="priority"
                      open={isQuickEditing(quickEdit, issue.id, "priority")}
                      busy={qeBusy}
                      value={issue.priority}
                      displayValue={issue.priority}
                      tone={`priority-${issue.priority.toLowerCase()}`}
                      options={ISSUE_PRIORITIES.map((p) => ({ value: p, label: p }))}
                      onOpen={() => openField(issue.id, "priority")}
                      onCommit={(priority) => commitQuickEdit(issue.id, { priority })}
                      onCancel={() => closeField(issue.id, "priority")}
                    />
                    {wsLabels.length > 0 ? (
                      <QuickEditLabels
                        open={isQuickEditing(quickEdit, issue.id, "labels")}
                        busy={qeBusy}
                        labels={wsLabels}
                        selected={issue.labels ?? []}
                        onOpen={() => openField(issue.id, "labels")}
                        onApply={(labelIds) => commitQuickEdit(issue.id, { labelIds })}
                        onCancel={() => closeField(issue.id, "labels")}
                      />
                    ) : (
                      /* Read-only degradation (spec §23 addendum): this row's
                         workspace labels are not loaded — never fabricate options. */
                      (issue.labels ?? []).slice(0, 2).map((label) => (
                        <Badge key={label.id} tone={labelTone(label.color)}>
                          {label.name}
                        </Badge>
                      ))
                    )}
                    {members.length > 0 && (
                      <QuickEditSelect
                        field="assignee"
                        open={isQuickEditing(quickEdit, issue.id, "assignee")}
                        busy={qeBusy}
                        value={issue.assignee?.id ?? ""}
                        displayValue={issue.assignee?.name ?? "Unassigned"}
                        tone="neutral"
                        triggerContent={
                          issue.assignee ? (
                            <span className="card-assignee">
                              <Avatar name={issue.assignee.name} decorative small />
                              {issue.assignee.name}
                            </span>
                          ) : (
                            "Unassigned"
                          )
                        }
                        options={[
                          { value: "", label: "Unassigned" },
                          ...members.map((m) => ({ value: m.userId, label: m.name })),
                        ]}
                        onOpen={() => openField(issue.id, "assignee")}
                        onCommit={(assigneeId) =>
                          commitQuickEdit(issue.id, { assigneeId: assigneeId || null })
                        }
                        onCancel={() => closeField(issue.id, "assignee")}
                      />
                    )}
                    {members.length === 0 && issue.assignee && (
                      <span className="card-assignee">
                        <Avatar name={issue.assignee.name} decorative small />
                        {issue.assignee.name}
                      </span>
                    )}
                    <QuickEditDate
                      open={isQuickEditing(quickEdit, issue.id, "dueDate")}
                      busy={qeBusy}
                      dueDate={issue.dueDate}
                      onOpen={() => openField(issue.id, "dueDate")}
                      onApply={(dueDate) => commitQuickEdit(issue.id, { dueDate })}
                      onCancel={() => closeField(issue.id, "dueDate")}
                    />
                  </>
                }
                rowError={
                  qeError?.issueId === issue.id ? (
                    <Alert
                      ref={qeAlertRef}
                      role="alert"
                      tabIndex={-1}
                      className="qe-row-alert"
                    >
                      {qeError.message}
                    </Alert>
                  ) : undefined
                }
              />
            ))}
          />
        </>
      ) : null}
    </section>
  );
}
