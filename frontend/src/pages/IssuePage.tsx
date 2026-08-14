import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import type { Issue } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";

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
    try {
      await api.patch(`/issues/${issueId}`, { status: next });
      setStatus(next);
      await loadIssue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleChangePriority(next: string) {
    setError(null);
    try {
      await api.patch(`/issues/${issueId}`, { priority: next });
      setPriority(next);
      await loadIssue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update priority");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this issue and all its comments?")) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/issues/${issueId}`);
      navigate(`/workspaces/${workspaceId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete issue");
      setDeleting(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <section>
      <Link to={`/workspaces/${workspaceId}`} className="back-link">
        &larr; Back to workspace
      </Link>
      {error && <p className="alert alert-error">{error}</p>}
      {issue && (
        <>
          <h1 className="page-title">{issue.title}</h1>
          <div className="issue-meta">
            <div className="field-row">
              <label className="field">
                <span className="field-label">Status</span>
                <select value={status} onChange={(e) => handleChangeStatus(e.target.value)}>
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Priority</span>
                <select value={priority} onChange={(e) => handleChangePriority(e.target.value)}>
                  {ISSUE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {issue.description && <p className="issue-description">{issue.description}</p>}
          {issue.dueDate && <p className="issue-meta-line">Due: {issue.dueDate}</p>}
          {issue.assigneeId && <p className="issue-meta-line">Assignee id: {issue.assigneeId}</p>}

          <div className="issue-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete issue"}
            </button>
          </div>

          <h2 className="section-title">Comments</h2>
          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.id} className="comment">
                <p className="comment-body">{c.body}</p>
                <p className="comment-meta">{new Date(c.createdAt).toLocaleString()}</p>
              </li>
            ))}
            {comments.length === 0 && <li className="empty-state">No comments yet.</li>}
          </ul>
          <form className="inline-form" onSubmit={handleAddComment}>
            <label className="field field-grow">
              <span className="sr-only">Comment</span>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment"
                required
                rows={3}
              />
            </label>
            <button type="submit" className="btn btn-primary">
              Add comment
            </button>
          </form>
        </>
      )}
    </section>
  );
}