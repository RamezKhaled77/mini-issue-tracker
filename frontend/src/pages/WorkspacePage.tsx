import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { Issue, Project } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import { IssueForm } from "../components/IssueForm.js";
import { Invitations } from "../components/Invitations.js";
import { ProjectDialog } from "../components/ProjectDialog.js";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import type { BadgeTone } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { Field } from "../components/Field.js";
import { SkeletonRows } from "../components/Skeleton.js";

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
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    const res = await api.get<{ items: Issue[] }>(
      `/projects/${selectedProject}/issues${params.toString() ? `?${params}` : ""}`
    );
    setIssues(res.items);
  }

  async function loadStats() {
    try {
      const res = await api.get<DashboardStats>(`/workspaces/${workspaceId}/dashboard`);
      setStats(res);
    } catch {
      setStats(null);
    }
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
  }, [workspaceId]);

  useEffect(() => {
    loadIssues().catch((err) => setError(err.message));
  }, [selectedProject, search, statusFilter, priorityFilter]);

  const filtering = Boolean(search || statusFilter || priorityFilter);

  return (
    <section>
      <Link to="/" className="back-link">
        &larr; All workspaces
      </Link>
      <h1 className="page-title">{workspace?.name ?? "Workspace"}</h1>
      {error && (
        <Alert role="alert" className="page-alert">
          {error}
        </Alert>
      )}

      <section className="dashboard" aria-label="Issue statistics">
        <h2 className="section-title">Dashboard</h2>
        {stats ? (
          <>
            <div className="stat-grid">
              {ISSUE_STATUSES.map((s) => (
                <div key={s} className="stat">
                  <span className="stat-value">{stats.byStatus[s] ?? 0}</span>
                  <span className="stat-label">
                    <Badge tone={`status-${s.toLowerCase().replace(" ", "-")}` as BadgeTone}>{s}</Badge>
                  </span>
                </div>
              ))}
            </div>
            <div className="stat-grid stat-grid-priority">
              {ISSUE_PRIORITIES.map((p) => (
                <div key={p} className="stat">
                  <span className="stat-value">{stats.byPriority[p] ?? 0}</span>
                  <span className="stat-label">
                    <Badge tone={`priority-${p.toLowerCase()}` as BadgeTone}>{p}</Badge>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <SkeletonRows rows={2} className="stat-skeleton" />
        )}
      </section>

      <Invitations workspaceId={workspaceId!} isOwner={Boolean(workspace?.isOwner)} />

      <div className="two-col">
        <div>
          <h2 className="section-title">Projects</h2>
          <ProjectDialog
            workspaceId={workspaceId!}
            projects={projects}
            selectedProject={selectedProject}
            loading={loading}
            onSelectProject={setSelectedProject}
            onProjectsChanged={handleProjectsChanged}
          />
        </div>

        <div>
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
              <Field label="Search issues" srOnlyLabel className="field-grow">
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
              <div className="filter-meta">
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
            <ul className="card-list">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <Link to={`/workspaces/${workspaceId}/issues/${issue.id}`} className="card">
                    <span className="card-title">{issue.title}</span>
                    <span className="card-meta">
                      <Badge tone={`status-${issue.status.toLowerCase().replace(" ", "-")}` as BadgeTone}>
                        {issue.status}
                      </Badge>
                      <Badge tone={`priority-${issue.priority.toLowerCase()}` as BadgeTone}>
                        {issue.priority}
                      </Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}