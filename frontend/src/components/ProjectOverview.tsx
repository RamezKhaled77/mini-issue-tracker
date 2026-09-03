import { Link } from "react-router-dom";
import type { WorkspaceDashboardData } from "@mini-issue-tracker/shared";

type DashboardProject = WorkspaceDashboardData["projects"][number];

export function ProjectOverview({
  projects,
  workspaceId,
}: {
  projects: DashboardProject[];
  workspaceId: string;
}) {
  return (
    <section className="dashboard-section" aria-label="Projects">
      <div className="project-overview-header">
        <h2 className="section-eyebrow">PROJECTS</h2>
        {projects.length > 0 && (
          <Link to={`/workspaces/${workspaceId}/projects`} className="dashboard-view-all">
            View all projects →
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <p className="project-empty">No active projects in this workspace.</p>
      ) : (
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.id} className="project-row">
              <Link to={`/workspaces/${workspaceId}/projects/${project.id}`} className="project-name">
                {project.name}
              </Link>
              <span className="project-meta">
                <span className="project-issue-count">{project.issueCount} issues</span>
                {project.lastActivity && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <time dateTime={project.lastActivity}>
                      Updated {formatDate(project.lastActivity)}
                    </time>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
