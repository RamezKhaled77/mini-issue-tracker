import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import type {
  Issue,
  IssuePriority,
  IssueStatus,
  Label,
  Project,
  BulkIssueRequest,
  SavedView,
  SavedViewFilters,
} from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, SAVED_VIEW_FILTERS_VERSION } from "@mini-issue-tracker/shared";
import { IssueForm } from "../components/IssueForm.js";
import { Invitations } from "../components/Invitations.js";
import { SavedViewsSection } from "../components/SavedViewsSection.js";
import { resolveSavedViewFilters } from "../lib/savedViewFilters.js";
import { ProjectDialog } from "../components/ProjectDialog.js";
import { Alert } from "../components/Alert.js";
import { Avatar } from "../components/Avatar.js";
import { Badge } from "../components/Badge.js";
import type { BadgeTone } from "../components/Badge.js";
import { LedgerList } from "../components/LedgerList.js";
import { LedgerRow } from "../components/LedgerRow.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { Checkbox } from "../components/Checkbox.js";
import { FilterBar } from "../components/FilterBar.js";
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
import { toggle, selectVisible } from "../lib/bulkSelection.js";
import { readFilters, writeFilters, WORKSPACE_FILTER_KEYS } from "../lib/urlFilters.js";

interface WorkspaceDetail {
  id: string;
  name: string;
  ownerId: string;
  isOwner: boolean;
}

interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Saved Views state (Spec 009).
  const [views, setViews] = useState<SavedView[]>([]);
  const [viewsLoading, setViewsLoading] = useState(true);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const appliedSnapshotRef = useRef("");
  const [searchParams, setSearchParams] = useSearchParams();
  const urlInitRef = useRef(false);
  const viewApplyRef = useRef(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Read-once: initialize filter state from the URL (spec 012 §10). The text
  // search stays local (workspace search is a tool input, not part of the
  // addressable workspace filter schema).
  useEffect(() => {
    if (urlInitRef.current) return;
    urlInitRef.current = true;
    const filters = readFilters(searchParams, WORKSPACE_FILTER_KEYS);
    if (filters.project) setSelectedProject(filters.project);
    if (filters.status) setStatusFilter(filters.status);
    if (filters.priority) setPriorityFilter(filters.priority);
    if (filters.label) setLabelFilter(filters.label);
  }, [searchParams]);

  // Project the filter state onto the URL (replace: typing doesn't spam
  // history). `view` is emitted only while a saved view is active; manual
  // edits clear it via the staleness effect below.
  useEffect(() => {
    if (!urlInitRef.current) return;
    const filters: Record<string, string | undefined> = {
      project: selectedProject,
      status: statusFilter,
      priority: priorityFilter,
      label: labelFilter,
      view: activeViewId ?? undefined,
    };
    setSearchParams(writeFilters(filters, WORKSPACE_FILTER_KEYS), { replace: true });
  }, [selectedProject, statusFilter, priorityFilter, labelFilter, activeViewId, setSearchParams]);

  // Deep-link a saved `view` param: once projects/labels/views are loaded,
  // resolve and apply it (guarded so it runs exactly once per mount).
  useEffect(() => {
    if (viewApplyRef.current) return;
    if (viewsLoading || loading) return;
    const viewId = readFilters(searchParams, WORKSPACE_FILTER_KEYS).view;
    if (!viewId) return;
    const target = views.find((v) => v.id === viewId);
    if (target) {
      viewApplyRef.current = true;
      handleSelectView(target);
    }
  }, [views, viewsLoading, loading]);

  // Bulk selection state (Spec 007).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<BulkMember[]>([]);
  const [applying, setApplying] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Quick Edit state (Spec 010). One edit at a time (D-06); busy blocks
  // duplicate submissions (D-12); errors are row-local (D-08).
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
      await loadIssues();
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

  async function loadProjects(): Promise<Project[]> {
    const res = await api.get<{ items: Project[] }>(`/workspaces/${workspaceId}/projects`);
    setProjects(res.items);
    return res.items;
  }

  async function handleProjectsChanged(createdId?: string) {
    const items = await loadProjects();
    if (createdId) {
      setSelectedProject(createdId || (items.length ? items[0].id : ""));
    }
    await loadStats();
  }

  async function loadIssues() {
    if (!selectedProject) return;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (labelFilter) params.set("labelId", labelFilter);
    const res = await api.get<{ items: Issue[] }>(
      `/projects/${selectedProject}/issues${params.toString() ? `?${params}` : ""}`
    );
    setIssues(res.items);
  }

  async function loadLabels() {
    const res = await api.get<{ items: Label[] }>(`/workspaces/${workspaceId}/labels`);
    setLabels(res.items);
  }

  async function loadStats() {
    try {
      const res = await api.get<DashboardStats>(`/workspaces/${workspaceId}/dashboard`);
      setStats(res);
    } catch {
      setStats(null);
    }
  }

  async function loadViews() {
    const res = await api.listSavedViews(workspaceId!);
    setViews(res.items);
  }

  useEffect(() => {
    api
      .get<{ workspace: WorkspaceDetail }>(`/workspaces/${workspaceId}`)
      .then((res) => setWorkspace(res.workspace))
      .catch((err) => setError(err.message));
    loadStats();
  }, [workspaceId]);

  useEffect(() => {
    loadProjects()
      .then((items) => {
        if (items.length > 0) setSelectedProject((prev) => prev || items[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    loadLabels().catch((err) => setError(err.message));
    loadViews()
      .catch((err) => setError(err.message))
      .finally(() => setViewsLoading(false));
        api
      .get<{ items: BulkMember[] }>(`/workspaces/${workspaceId}/members`)
      .then((res) => setMembers(res.items ?? []))
      .catch(() => setMembers([]));
  }, [workspaceId]);

  useEffect(() => {
    loadIssues().catch((err) => setError(err.message));
  }, [selectedProject, search, statusFilter, priorityFilter, labelFilter]);

  const filtering = Boolean(search || statusFilter || priorityFilter || labelFilter);

  // Saved Views (Spec 009): applying a view writes its snapshot here so manual
  // filter changes afterwards are detected and deactivate the active view.
  const filterSnapshot = [selectedProject, search, statusFilter, priorityFilter, labelFilter].join("|");
  useEffect(() => {
    if (appliedSnapshotRef.current && appliedSnapshotRef.current !== filterSnapshot) {
      setActiveViewId(null);
      setStaleNote(null);
    }
    appliedSnapshotRef.current = filterSnapshot;
  }, [filterSnapshot]);

  function currentFilters(): SavedViewFilters {
    const filters: SavedViewFilters = {
      version: SAVED_VIEW_FILTERS_VERSION,
      projectId: selectedProject,
    };
    if (search) filters.search = search;
    if (statusFilter) filters.status = statusFilter as IssueStatus;
    if (priorityFilter) filters.priority = priorityFilter as IssuePriority;
    if (labelFilter) filters.labelId = labelFilter;
    return filters;
  }

  function handleSelectView(view: SavedView) {
    const resolved = resolveSavedViewFilters(
      view,
      new Set(projects.map((p) => p.id)),
      new Set(labels.map((l) => l.id))
    );
    if (!resolved) return;
    if (resolved.staleProject) {
      // Deferred: the view's project is gone — nothing to switch to, config untouched.
      setStaleNote(
        `"${view.name}" references a project that is no longer available.`
      );
      return;
    }
    setSelectedProject(resolved.projectId);
    setSearch(resolved.search);
    setStatusFilter(resolved.status);
    setPriorityFilter(resolved.priority);
    setLabelFilter(resolved.staleLabel ? "" : resolved.labelId);
    setActiveViewId(view.id);
    appliedSnapshotRef.current = [
      resolved.projectId,
      resolved.search,
      resolved.status,
      resolved.priority,
      resolved.staleLabel ? "" : resolved.labelId,
    ].join("|");
    setStaleNote(
      resolved.staleLabel
        ? `A label in "${view.name}" is no longer available and was ignored.`
        : null
    );
  }

  const visibleIds = issues.map((i) => i.id);
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
      await loadIssues();
      await loadStats();
      setSelected(new Set());
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section>
      <div className="workspace-masthead">
        <Link to="/" className="back-link">
          &larr; All workspaces
        </Link>
        <div className="workspace-masthead-row">
          <h1 className="page-title">{workspace?.name ?? "Workspace"}</h1>
          {workspace?.isOwner && (
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(true)}>
              Invite
            </Button>
          )}
        </div>
        <Dialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          title="Invite to workspace"
          description="Share an invitation token with teammates to grant access."
        >
          <Invitations workspaceId={workspaceId!} isOwner={Boolean(workspace?.isOwner)} />
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
              Close
            </Button>
          </div>
        </Dialog>
      </div>
      {error && (
        <Alert role="alert" className="page-alert">
          {error}
        </Alert>
      )}

      <section className="stat-strip" aria-label="Issue statistics">
        {stats ? (
          <>
            <div className="stat-cells">
              {ISSUE_STATUSES.map((s) => (
                <div key={s} className={`stat-cell stat-cell--${s.toLowerCase().replace(" ", "-")}`}>
                  <span className="stat-value">{stats.byStatus[s] ?? 0}</span>
                  <span className="stat-label">{s}</span>
                </div>
              ))}
            </div>
            <div className="stat-meta">
              <span className="stat-meta-total">{stats.total} total</span>
              {ISSUE_PRIORITIES.map((p) => (
                <span
                  key={p}
                  className={`stat-meta-item stat-meta-item--${p.toLowerCase()}`}
                >
                  {stats.byPriority[p] ?? 0} {p}
                </span>
              ))}
            </div>
          </>
        ) : (
          <SkeletonRows rows={1} className="stat-skeleton" />
        )}
      </section>

      <div className="grid grid-cols-[minmax(260px,300px)_1fr] lg:grid-cols-[1fr]">
        <div className="projects-column min-w-0 border-r var(--border-subtle) pr-6">
          <h2 className="section-title">Projects</h2>
          <ProjectDialog
            workspaceId={workspaceId!}
            projects={projects}
            selectedProject={selectedProject}
            loading={loading}
            onSelectProject={setSelectedProject}
            onProjectsChanged={handleProjectsChanged}
          />
          <SavedViewsSection
            workspaceId={workspaceId!}
            views={views}
            projects={projects}
            labels={labels}
            loading={loading || viewsLoading}
            activeViewId={activeViewId}
            getFilters={currentFilters}
            onSelect={handleSelectView}
            onChange={loadViews}
          />
        </div>

        <div className="issues-column min-w-0">
          <div className="section-header">
            <h2 className="section-title">Issues</h2>
            {selectedProject && !showForm && (
              <Button type="button" variant="primary" onClick={() => setShowForm(true)}>
                New issue
              </Button>
            )}
          </div>

          {showForm && selectedProject && (
            <Dialog
              open
              onClose={() => setShowForm(false)}
              title="New issue"
              description="Create a new issue in this project."
            >
              <IssueForm
                workspaceId={workspaceId!}
                projectId={selectedProject}
                onCancel={() => setShowForm(false)}
                onSubmit={async () => {
                  setShowForm(false);
                  await loadIssues();
                  await loadStats();
                }}
              />
            </Dialog>
          )}

          {selectedProject && (
            <FilterBar
              query={{
                value: search,
                onChange: setSearch,
                placeholder: "Search title or description",
                label: "Search issues",
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
                ...(labels.length > 0
                  ? [
                      {
                        id: "label",
                        label: "Filter by label",
                        value: labelFilter,
                        options: [{ value: "", label: "All labels" }, ...labels.map((label) => ({ value: label.id, label: label.name }))],
                        onChange: setLabelFilter,
                      },
                    ]
                  : []),
              ]}
              resultCount={
                filtering || issues.length > 0 ? (
                  <span className="filter-count">
                    {issues.length} result{issues.length === 1 ? "" : "s"}
                  </span>
                ) : null
              }
              actions={
                staleNote ? (
                  <span className="filter-active" role="status">
                    {staleNote}
                  </span>
                ) : null
              }
              isFiltering={filtering}
              onClear={() => {
                setSearch("");
                setStatusFilter("");
                setPriorityFilter("");
                setLabelFilter("");
              }}
              clearLabel="Clear filters"
            />
          )}

          {!selectedProject ? (
            <EmptyState title="Select a project" description="Select a project to see its issues." />
          ) : issues.length === 0 ? (
            <EmptyState
              title={filtering ? "No matching issues" : "No issues yet"}
              description={filtering ? "No issues match your filters." : "Create your first issue in this project."}
            />
          ) : (
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
                  labels={labels}
                  applying={applying}
                  onApply={handleBulkApply}
                  onClear={() => setSelected(new Set())}
                />
              )}

              <LedgerList
                ariaLabel="Project issues"
                rows={issues.map((issue) => (
                  <LedgerRow
                    key={issue.id}
                    to={`/workspaces/${workspaceId}/issues/${issue.id}`}
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
                      <QuickEditLabels
                        open={isQuickEditing(quickEdit, issue.id, "labels")}
                        busy={qeBusy}
                        labels={labels}
                        selected={issue.labels ?? []}
                        onOpen={() => openField(issue.id, "labels")}
                        onApply={(labelIds) => commitQuickEdit(issue.id, { labelIds })}
                        onCancel={() => closeField(issue.id, "labels")}
                      />
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
                              <span className="ledger-assignee">
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
                        <span className="ledger-assignee">
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
          )}
        </div>
      </div>
    </section>
  );
}
