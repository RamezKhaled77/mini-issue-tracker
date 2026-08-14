import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";
import type { Issue } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";

export interface IssueFormData {
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string;
  labelIds: string[];
  dueDate: string;
}

export interface IssueFormProps {
  workspaceId: string;
  projectId: string;
  onSubmit: () => Promise<void> | void;
  onCancel: () => void;
  initial?: Issue | null;
}

interface Label {
  id: string;
  name: string;
}

interface Member {
  userId: string;
  email: string;
}

export function IssueForm({ workspaceId, projectId, onSubmit, onCancel, initial }: IssueFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<string>(initial?.status ?? "Open");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "Medium");
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId ?? "");
  const [labelIds, setLabelIds] = useState<string[]>(initial?.labelIds ?? []);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [labels, setLabels] = useState<Label[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<{ items: Label[] }>(`/workspaces/${workspaceId}/labels`)
      .then((res) => setLabels(res.items))
      .catch(() => setLabels([]));
    api
      .get<{ items: Member[] }>(`/workspaces/${workspaceId}/members`)
      .then((res) => setMembers(res.items))
      .catch(() => setMembers([]));
  }, [workspaceId]);

  function toggleLabel(id: string) {
    setLabelIds((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = {
      title,
      description: description.trim() === "" ? null : description,
      status,
      priority,
      dueDate: dueDate === "" ? null : dueDate,
    };
    if (assigneeId) body.assigneeId = assigneeId;
    if (labelIds.length) body.labelIds = labelIds;
    try {
      if (initial) {
        await api.patch(`/issues/${initial.id}`, body);
      } else {
        await api.post(`/projects/${projectId}/issues`, body);
      }
      await onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save issue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card issue-form" onSubmit={handleSubmit}>
      <h3 className="section-title">{initial ? "Edit issue" : "New issue"}</h3>
      {error && <p className="alert alert-error">{error}</p>}
      <label className="field">
        <span className="field-label">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {ISSUE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Due date</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      {members.length > 0 && (
        <label className="field">
          <span className="field-label">Assignee</span>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email}
              </option>
            ))}
          </select>
        </label>
      )}
      {labels.length > 0 && (
        <div className="field">
          <span className="field-label">Labels</span>
          <div className="label-picker">
            {labels.map((label) => (
              <label key={label.id} className="label-chip">
                <input
                  type="checkbox"
                  checked={labelIds.includes(label.id)}
                  onChange={() => toggleLabel(label.id)}
                />
                {label.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : initial ? "Save changes" : "Create issue"}
        </button>
      </div>
    </form>
  );
}