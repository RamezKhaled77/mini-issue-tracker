import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { LabelsSection } from "../components/LabelsSection.js";
import { SavedViewsSection } from "../components/SavedViewsSection.js";
import { resolveSavedViewFilters } from "../lib/savedViewFilters.js";
import { ProjectDialog } from "../components/ProjectDialog.js";
import { Alert } from "../components/Alert.js";
import { Avatar } from "../components/Avatar.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { Field } from "../components/Field.js";
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
  const [saveSignal, setSaveSignal] = useState(0);
  const appliedSnapshotRef = useRef("");

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
        <h1 className="page-title">{workspace?.name ?? "Workspace"}</h1>
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

      <div className="workspace-layout">
        <div className="projects-column">
          <h2 className="section-title">Projects</h2>
          <ProjectDialog
            workspaceId={workspaceId!}
            projects={projects}
            selectedProject={selectedProject}
            loading={loading}
            onSelectProject={setSelectedProject}
            onProjectsChanged={handleProjectsChanged}
          />
          <Invitations workspaceId={workspaceId!} isOwner={Boolean(workspace?.isOwner)} />
          <LabelsSection
            workspaceId={workspaceId!}
            labels={labels}
            loading={loading}
            onChange={loadLabels}
          />
          <SavedViewsSection
            workspaceId={workspaceId!}
            views={views}
            projects={projects}
            labels={labels}
            loading={loading || viewsLoading}
            activeViewId={activeViewId}
            saveSignal={saveSignal}
            getFilters={currentFilters}
            onSelect={handleSelectView}
            onChange={loadViews}
          />
        </div>

        <div className="issues-column">
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
            <div className="filter-bar" role="search">
              <Field label="Search issues" srOnlyLabel className="field-grow search-field">
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
              {labels.length > 0 && (
                <Field label="Filter by label" srOnlyLabel>
                  <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)}>
                    <option value="">All labels</option>
                    {labels.map((label) => (
                      <option key={label.id} value={label.id}>
                        {label.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="filter-meta">
                {staleNote && (
                  <span className="filter-active" role="status">
                    {staleNote}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSaveSignal((n) => n + 1)}
                  disabled={!selectedProject}
                >
                  Save view
                </Button>
                {(filtering || issues.length > 0) && (
                  <span className="filter-count">
                    {issues.length} result{issues.length === 1 ? "" : "s"}
                  </span>
                )}
                {filtering && (
                  <span className="filter-active">
                    Filtering
                    <Button type="button" variant="ghost" className="filter-clear" onClick={() => {
                      setSearch("");
                      setStatusFilter("");
                      setPriorityFilter("");
                      setLabelFilter("");
                    }}>
                      Clear filters
                    </Button>
                  </span>
                )}
              </div>
            </div>
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
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allVisibleSelected}
                    onChange={handleSelectAll}
                  />
                  Select all visible
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

              <ul className="ledger-list">
                {issues.map((issue) => (
                  <li
                    key={issue.id}
                    className={`ledger-item${selected.has(issue.id) ? " ledger-item--selected" : ""}`}
                    data-priority={issue.priority.toLowerCase()}
                    data-overdue={isOverdue(issue.dueDate, issue.status) ? "true" : undefined}
                  >
                    <span className="ledger-select">
                      <input
                        type="checkbox"
                        checked={selected.has(issue.id)}
                        onChange={() => setSelected((prev) => toggle(prev, issue.id))}
                        aria-label={`Select ${issue.title}`}
                      />
                    </span>
                    <Link
                      to={`/workspaces/${workspaceId}/issues/${issue.id}`}
                      className="ledger-row-link"
                    >
                      <span className="ticket-key">{issueKey(issue.id)}</span>
                      <span className="ledger-main">
                        <span className="ledger-title">{issue.title}</span>
                        {issue.description && (
                          <span className="ledger-subtitle">{issue.description}</span>
                        )}
                      </span>
                    </Link>
                    <span className="ledger-meta" data-quickedit="meta">
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
                    </span>
                    <span className="ledger-chevron" aria-hidden="true">
                      &rarr;
                    </span>
                    {qeError?.issueId === issue.id && (
                      <Alert
                        ref={qeAlertRef}
                        role="alert"
                        tabIndex={-1}
                        className="qe-row-alert"
                      >
                        {qeError.message}
                      </Alert>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
