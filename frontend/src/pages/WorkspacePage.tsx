import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { Issue, Project } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import { IssueForm } from "../components/IssueForm.js";
import { Invitations } from "../components/Invitations.js";
import { ProjectDialog } from "../components/ProjectDialog.js";

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
      {error && <p className="alert alert-error">{error}</p>}

      {stats && (
        <section className="dashboard" aria-label="Issue statistics">
          <h2 className="section-title">Dashboard</h2>
          <div className="stat-grid">
            {ISSUE_STATUSES.map((s) => (
              <div key={s} className="stat">
                <span className={`stat-value`}>{stats.byStatus[s] ?? 0}</span>
                <span className="stat-label">{s}</span>
              </div>
            ))}
          </div>
          <div className="stat-grid stat-grid-priority">
            {ISSUE_PRIORITIES.map((p) => (
              <div key={p} className="stat">
                <span className={`stat-value`}>{stats.byPriority[p] ?? 0}</span>
                <span className="stat-label">{p}</span>
              </div>
            ))}
          </div>
        </section>
      )}

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
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                New issue
              </button>
            )}
          </div>

          {showForm && selectedProject && (
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
          )}

          {selectedProject && (
            <div className="filter-bar" role="search">
              <label className="field">
                <span className="sr-only">Search issues</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title or description"
                />
              </label>
              <label className="field">
                <span className="sr-only">Filter by status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="sr-only">Filter by priority</span>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                  <option value="">All priorities</option>
                  {ISSUE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {(filtering || issues.length > 0) && (
                <span className="filter-count">{issues.length} result{issues.length === 1 ? "" : "s"}</span>
              )}
            </div>
          )}

          {!selectedProject ? (
            <p className="empty-state">Select a project to see its issues.</p>
          ) : issues.length === 0 ? (
            <p className="empty-state">{filtering ? "No issues match your filters." : "No issues in this project."}</p>
          ) : (
            <ul className="card-list">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <Link to={`/workspaces/${workspaceId}/issues/${issue.id}`} className="card">
                    <span className="card-title">{issue.title}</span>
                    <span className="card-meta">
                      <span className={`badge badge-status-${issue.status.toLowerCase()}`}>{issue.status}</span>
                      <span className={`badge badge-priority-${issue.priority.toLowerCase()}`}>{issue.priority}</span>
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