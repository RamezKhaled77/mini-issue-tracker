import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { Issue } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { Field } from "../components/Field.js";
import { IssueForm } from "../components/IssueForm.js";
import { SkeletonRows } from "../components/Skeleton.js";

interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export function IssuePage() {
  const { workspaceId, issueId } = useParams<{ workspaceId: string; issueId: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    Promise.all([loadIssue(), loadComments()])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [issueId]);

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

  return (
    <section>
      <Link to={`/workspaces/${workspaceId}`} className="back-link">
        &larr; Back to workspace
      </Link>
      {error && (
        <Alert role="alert" className="page-alert">
          {error}
        </Alert>
      )}
      {issue && (
        <>
          <h1 className="page-title">{issue.title}</h1>

          {saved && (
            <Alert variant="success" className="success-notice">
              Saved
            </Alert>
          )}

          <div className="issue-meta">
            <dl className="issue-meta-list">
              <div className="issue-meta-item">
                <dt className="issue-meta-label">Status</dt>
                <dd className="issue-meta-value">
                  <select value={status} onChange={(e) => handleChangeStatus(e.target.value)} aria-label="Status">
                    {ISSUE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div className="issue-meta-item">
                <dt className="issue-meta-label">Priority</dt>
                <dd className="issue-meta-value">
                  <select value={priority} onChange={(e) => handleChangePriority(e.target.value)} aria-label="Priority">
                    {ISSUE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div className="issue-meta-item">
                <dt className="issue-meta-label">Assignee</dt>
                <dd className="issue-meta-value">
                  {issue.assigneeId ? issue.assigneeId : "Unassigned"}
                </dd>
              </div>
              <div className="issue-meta-item">
                <dt className="issue-meta-label">Due date</dt>
                <dd className="issue-meta-value">{issue.dueDate ? issue.dueDate : "No due date"}</dd>
              </div>
              {issue.labelIds.length > 0 && (
                <div className="issue-meta-item">
                  <dt className="issue-meta-label">Labels</dt>
                  <dd className="issue-meta-value">
                    <span className="badge-row">
                      {issue.labelIds.map((id) => (
                        <Badge key={id} tone="neutral">
                          {id}
                        </Badge>
                      ))}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {issue.description && <p className="issue-description">{issue.description}</p>}

          <div className="issue-actions">
            <div className="issue-actions-row">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
                Edit issue
              </Button>
              <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                Delete issue
              </Button>
            </div>
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

          <h2 className="section-title">Comments</h2>
          {comments.length === 0 ? (
            <EmptyState title="No comments yet" description="Be the first to comment on this issue." />
          ) : (
            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id} className="comment">
                  <p className="comment-body">{c.body}</p>
                  <p className="comment-meta">
                    <span className="comment-author">{c.authorId}</span>
                    {" · "}
                    <span className="comment-date">{new Date(c.createdAt).toLocaleString()}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
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
        </>
      )}
    </section>
  );
}