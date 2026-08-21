import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { Issue, Activity } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import { Alert } from "../components/Alert.js";
import { Avatar } from "../components/Avatar.js";
import { Badge } from "../components/Badge.js";
import type { BadgeTone } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { Field } from "../components/Field.js";
import { IssueForm } from "../components/IssueForm.js";
import { SkeletonRows } from "../components/Skeleton.js";
import { ActivityPanel } from "../components/ActivityPanel.js";
import { issueKey } from "../lib/issueKey.js";
import { labelTone } from "../lib/labelTone.js";

interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  author: { id: string; name: string };
  body: string;
  createdAt: string;
}

export function IssuePage() {
  const { workspaceId, issueId } = useParams<{ workspaceId: string; issueId: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activityItems, setActivityItems] = useState<Activity[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [commentBody, setCommentBody] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  function loadIssue() {
    return api.get<{ issue: Issue }>(`/issues/${issueId}`).then((res) => {
      setIssue(res.issue);
      setStatus(res.issue.status);
      setPriority(res.issue.priority);
    });
  }

  function loadComments() {
    return api.get<{ items: Comment[] }>(`/issues/${issueId}/comments`).then((res) => setComments(res.items));
  }

  function loadActivity() {
    return api.getActivity(issueId!, { page: 1, pageSize: 50 })
      .then((res) => {
        setActivityItems(res.items);
        setActivityTotal(res.total);
        setActivityPage(res.page);
      })
      .catch((err) => {
        console.error("Failed to load activity:", err);
        setActivityItems([]);
        setActivityTotal(0);
        setActivityPage(1);
      });
  }

  useEffect(() => {
    Promise.all([loadIssue(), loadComments(), loadActivity()])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [issueId]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    api
      .get<{ workspace: { name: string } }>(`/workspaces/${workspaceId}`)
      .then((res) => {
        if (!cancelled && res.workspace) setWorkspaceName(res.workspace.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !issue?.projectId) return;
    let cancelled = false;
    api
      .get<{ items: { id: string; name: string }[] }>(`/workspaces/${workspaceId}/projects`)
      .then((res) => {
        if (cancelled) return;
        const found = (res.items ?? []).find((p) => p.id === issue.projectId);
        if (found) setProjectName(found.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId, issue?.projectId]);

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/issues/${issueId}/comments`, { body: commentBody });
      setCommentBody("");
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    }
  }

  async function handleChangeStatus(next: string) {
    setError(null);
    setSaved(false);
    try {
      await api.patch(`/issues/${issueId}`, { status: next });
      setStatus(next);
      setSaved(true);
      await loadIssue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleChangePriority(next: string) {
    setError(null);
    setSaved(false);
    try {
      await api.patch(`/issues/${issueId}`, { priority: next });
      setPriority(next);
      setSaved(true);
      await loadIssue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update priority");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/issues/${issueId}`);
      navigate(`/workspaces/${workspaceId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete issue");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <section>
        <SkeletonRows rows={4} />
      </section>
    );
  }

  const resolvedLabels = issue?.labels ?? [];

  return (
    <section>
      <Link to={`/workspaces/${workspaceId}`} className="back-link">
        {workspaceName && projectName
          ? `\u2190 ${workspaceName} / ${projectName}`
          : "\u2190 Back to workspace"}
      </Link>
      {error && (
        <Alert role="alert" className="page-alert">
          {error}
        </Alert>
      )}
      {issue && (
        <>
          <header className="issue-header">
            <div className="issue-heading">
              <p className="issue-eyebrow">
                <span className="issue-key">{issueKey(issue.id)}</span>
                {" \u00b7 "}
                <span>Issue</span>
              </p>
              <h1 className="page-title">{issue.title}</h1>
              <p className="issue-meta-line">
                <Badge tone={`status-${issue.status.toLowerCase().replace(" ", "-")}` as BadgeTone}>
                  {issue.status}
                </Badge>
                <Badge tone={`priority-${issue.priority.toLowerCase()}` as BadgeTone}>
                  {issue.priority}
                </Badge>
              </p>
            </div>
            <div className="issue-header-actions">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
                Edit issue
              </Button>
              <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                Delete issue
              </Button>
            </div>
          </header>

          {saved && (
            <Alert variant="success" className="success-notice">
              Saved
            </Alert>
          )}

          <div className="issue-layout">
            <div className="issue-reading">
              {issue.description && <p className="issue-description">{issue.description}</p>}

              <hr className="issue-divider" />

              <div className="comments-head">
                <h2 className="section-eyebrow">Comments</h2>
                <span className="comments-count">{comments.length}</span>
              </div>
              {comments.length === 0 ? (
                <EmptyState title="No comments yet" description="Be the first to comment on this issue." />
              ) : (
                <ul className="comment-list">
                  {comments.map((c) => (
                    <li key={c.id} className="comment">
                      <p className="comment-body">{c.body}</p>
                      <p className="comment-meta">
                        <span className="comment-author">
                          <Avatar name={c.author.name} decorative small />
                          {c.author.name}
                        </span>
                        {" \u00b7 "}
                        <span className="comment-date">{new Date(c.createdAt).toLocaleString()}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <hr className="issue-divider" />
              <ActivityPanel
                issueId={issueId!}
                initialItems={activityItems}
                initialTotal={activityTotal}
                initialPage={activityPage}
              />
              <div className="comment-composer">
                <form className="inline-form" onSubmit={handleAddComment}>
                  <Field label="Comment" srOnlyLabel className="field-grow">
                    <textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Add a comment"
                      required
                      rows={3}
                    />
                  </Field>
                  <Button type="submit" variant="primary">
                    Add comment
                  </Button>
                </form>
              </div>
            </div>

            <aside className="fact-rail">
              <h2 className="section-eyebrow">Details</h2>
              <dl className="fact-list">
                <div>
                  <dt className="fact-label">Status</dt>
                  <dd className="fact-value">
                    <select value={status} onChange={(e) => handleChangeStatus(e.target.value)} aria-label="Status">
                      {ISSUE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div>
                  <dt className="fact-label">Priority</dt>
                  <dd className="fact-value">
                    <select value={priority} onChange={(e) => handleChangePriority(e.target.value)} aria-label="Priority">
                      {ISSUE_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div>
                  <dt className="fact-label">Assignee</dt>
                  <dd className="fact-value">
                    {issue.assignee ? (
                      <span className="assignee-name">
                        <Avatar name={issue.assignee.name} decorative />
                        {issue.assignee.name}
                      </span>
                    ) : (
                      "Unassigned"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="fact-label">Due date</dt>
                  <dd className="fact-value">{issue.dueDate ? issue.dueDate : "No due date"}</dd>
                </div>
                {projectName && (
                  <div>
                    <dt className="fact-label">Project</dt>
                    <dd className="fact-value">{projectName}</dd>
                  </div>
                )}
                {resolvedLabels.length > 0 && (
                  <div>
                    <dt className="fact-label">Labels</dt>
                    <dd className="fact-value">
                      <span className="badge-row">
                        {resolvedLabels.map((label) => (
                          <Badge key={label.id} tone={labelTone(label.color)}>
                            {label.name}
                          </Badge>
                        ))}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </aside>
          </div>

          <Dialog
            open={editOpen}
            onClose={() => setEditOpen(false)}
            title="Edit issue"
            description="Update the details of this issue."
          >
            <IssueForm
              workspaceId={workspaceId!}
              projectId={issue.projectId}
              initial={issue}
              onCancel={() => setEditOpen(false)}
              onSubmit={async () => {
                setEditOpen(false);
                await loadIssue();
                await loadComments();
              }}
            />
          </Dialog>

          <Dialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            title="Delete issue"
            description={`Delete this issue and all its comments? This cannot be undone.`}
          >
            <div className="dialog-actions">
              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete issue confirmation"}
              </Button>
            </div>
          </Dialog>
        </>
      )}
    </section>
  );
}