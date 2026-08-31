import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../api/client.js";
import type { Issue, Label } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import { Alert } from "./Alert.js";
import { Button } from "./Button.js";
import { Field } from "./Field.js";
import { Input } from "./Input.js";
import { Select } from "./Select.js";
import { Textarea } from "./Textarea.js";

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

interface Member {
  userId: string;
  email: string;
  name: string;
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    setFieldErrors({});
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
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : "Failed to save issue");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="issue-form" onSubmit={handleSubmit}>
      {error && (
        <Alert role="alert" className="form-alert">
          {error}
        </Alert>
      )}
<Field label="Title" error={fieldErrors.title}>
         <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
       </Field>
<Field label="Description" error={fieldErrors.description}>
         <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
       </Field>
      <div className="field-row">
<Field label="Status" error={fieldErrors.status}>
         <Select value={status} onChange={(e) => setStatus(e.target.value)}>
             {ISSUE_STATUSES.map((s) => (
               <option key={s} value={s}>
                 {s}
               </option>
             ))}
           </Select>
       </Field>
<Field label="Priority" error={fieldErrors.priority}>
         <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
             {ISSUE_PRIORITIES.map((p) => (
               <option key={p} value={p}>
                 {p}
               </option>
             ))}
           </Select>
       </Field>
<Field label="Due date" error={fieldErrors.dueDate}>
         <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
       </Field>
      </div>
{members.length > 0 && (
         <Field label="Assignee" error={fieldErrors.assigneeId}>
           <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
             <option value="">Unassigned</option>
             {members.map((m) => (
               <option key={m.userId} value={m.userId}>
                 {m.name}
               </option>
             ))}
           </Select>
         </Field>
       )}
      {labels.length > 0 && (
        <div className="field">
          <span className="field-label">Labels</span>
          <div className="label-picker">
            {labels.map((label) => (
              <label key={label.id} className={`label-chip label-chip--${label.color}`}>
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
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Saving..." : initial ? "Save changes" : "Create issue"}
        </Button>
      </div>
    </form>
  );
}