import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { WorkspaceDashboardData } from "@mini-issue-tracker/shared";
import type { BadgeTone } from "../components/Badge.js";
import { Alert } from "../components/Alert.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { IssueForm } from "../components/IssueForm.js";
import { LedgerList } from "../components/LedgerList.js";
import { LedgerRow } from "../components/LedgerRow.js";
import { SkeletonRows } from "../components/Skeleton.js";
import { isOverdue } from "../lib/isOverdue.js";
import { issueKey } from "../lib/issueKey.js";
import { labelTone } from "../lib/labelTone.js";
import { WorkspaceDashboardHeader } from "../components/WorkspaceDashboardHeader.js";
import { DashboardHealth } from "../components/DashboardHealth.js";
import { PriorityOverview } from "../components/PriorityOverview.js";
import { ProjectOverview } from "../components/ProjectOverview.js";
import { RecentActivity } from "../components/RecentActivity.js";

function statusTone(status: string): BadgeTone {
  if (status === "Open") return "status-open";
  if (status === "In Progress") return "status-in-progress";
  if (status === "Closed") return "status-closed";
  return "neutral";
}

function priorityTone(priority: string): BadgeTone {
  return `priority-${priority.toLowerCase()}` as BadgeTone;
}

/** Maps a full WorkspaceDashboardData.dashboardIssue to the props expected by LedgerRow. */
function dashboardIssueRowProps(
  issue: WorkspaceDashboardData["myIssues"][number],
  workspaceId: string,
) {
  return {
    to: `/workspaces/${workspaceId}/issues/${issue.id}` as const,
    issueKey: issueKey(issue.id),
    title: issue.title,
    caption: issue.description,
    statusBadge: { tone: statusTone(issue.status), label: issue.status } as const,
    priority: { tone: priorityTone(issue.priority), label: issue.priority } as const,
    labels: issue.labels.map((l) => ({
      id: l.id,
      tone: labelTone(l.color),
      name: l.name,
    })),
    assignee: issue.assignee ? { name: issue.assignee.name } : undefined,
    dueDate: issue.dueDate ?? null,
    overdue: isOverdue(issue.dueDate, issue.status),
  };
}

function DashboardIssueSection({
  title,
  issues,
  workspaceId,
  emptyTitle,
  emptyDescription,
  viewAllTo,
  viewAllLabel,
}: {
  title: string;
  issues: WorkspaceDashboardData["myIssues"];
  workspaceId: string;
  emptyTitle: string;
  emptyDescription: string;
  viewAllTo: string;
  viewAllLabel: string;
}) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <h2 className="section-eyebrow">{title}</h2>
        {issues.length > 0 && (
          <Link to={viewAllTo} className="dashboard-view-all">
            {viewAllLabel}
          </Link>
        )}
      </div>
      {issues.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <LedgerList
          ariaLabel={title}
          rows={issues.map((issue) => (
            <LedgerRow key={issue.id} {...dashboardIssueRowProps(issue, workspaceId)} />
          ))}
          caption={
            <Link to={viewAllTo} className="dashboard-view-all">
              {viewAllLabel}
            </Link>
          }
        />
      )}
    </section>
  );
}

export function WorkspaceDashboardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [data, setData] = useState<WorkspaceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setLoading(true);
    api
      .getWorkspaceOverview(workspaceId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load workspace dashboard");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Load projects for the "New issue" dialog project selector.
  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<{ items: { id: string; name: string }[] }>(`/workspaces/${workspaceId}/projects`)
      .then((res) => setProjects(res.items))
      .catch(() => setProjects([]));
  }, [workspaceId]);

  function refreshData() {
    if (!workspaceId) return;
    api
      .getWorkspaceOverview(workspaceId)
      .then((res) => setData(res))
      .catch(() => {});
  }

  if (!workspaceId) return null;

  return (
    <section className="workspace-dashboard">
      <WorkspaceDashboardHeader
        workspace={data?.workspace ?? null}
        onNewIssue={() => setCreateOpen(true)}
      />

      {error && (
        <Alert role="alert" className="page-alert">
          {error}
        </Alert>
      )}

      {loading || !data ? (
        <SkeletonRows rows={10} className="dashboard-skeleton" />
      ) : (
        (() => {
          const { workspace, stats, projects: projectList, myIssues, overdueIssues, recentActivity } = data;
          return (
            <>
              {/* Issue Health Overview */}
              <DashboardHealth stats={stats} />

              {/* My Issues + Overdue (two-column on desktop) */}
              <div className="dashboard-issue-columns">
                <div className="dashboard-my-issues">
                  <DashboardIssueSection
                    title="MY ISSUES"
                    issues={myIssues}
                    workspaceId={workspaceId}
                    emptyTitle="NO ISSUES ASSIGNED"
                    emptyDescription="You have no issues assigned in this workspace."
                    viewAllTo={`/workspaces/${workspaceId}`}
                    viewAllLabel="View all my issues →"
                  />
                </div>
                <div className="dashboard-overdue">
                  <DashboardIssueSection
                    title="OVERDUE"
                    issues={overdueIssues}
                    workspaceId={workspaceId}
                    emptyTitle="NO OVERDUE ISSUES"
                    emptyDescription="Everything is on track."
                    viewAllTo={`/workspaces/${workspaceId}`}
                    viewAllLabel="View all overdue →"
                  />
                </div>
              </div>

              {/* Priority + Projects (two-column on desktop) */}
              <div className="dashboard-secondary-columns">
                <div className="dashboard-priority">
                  <PriorityOverview stats={stats} />
                </div>
                <div className="dashboard-projects">
                  <ProjectOverview projects={projectList} workspaceId={workspaceId} />
                </div>
              </div>

              {/* Recent Activity */}
              <RecentActivity items={recentActivity} />
            </>
          );
        })()
      )}

      {/* New Issue Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New issue"
        description="Create a new issue in this workspace."
      >
        <IssueForm
          workspaceId={workspaceId}
          projectId={projects.length > 0 ? projects[0].id : ""}
          onSubmit={refreshData}
          onCancel={() => setCreateOpen(false)}
        />
      </Dialog>
    </section>
  );
}
