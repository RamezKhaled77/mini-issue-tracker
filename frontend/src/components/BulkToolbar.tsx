import { useState } from "react";
import type { BulkIssueAction, BulkIssueRequest, IssuePriority, IssueStatus, Label } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@mini-issue-tracker/shared";
import { Button } from "./Button.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { Field } from "./Field.js";
import { Select } from "./Select.js";

export interface BulkMember {
  userId: string;
  name: string;
}

interface BulkToolbarProps {
  selectedIds: string[];
  selectedCount: number;
  members: BulkMember[];
  labels: Label[];
  disabled?: boolean;
  disabledNote?: string | null;
  applying?: boolean;
  onApply: (request: BulkIssueRequest) => void;
  onClear: () => void;
}

export function BulkToolbar({
  selectedIds,
  selectedCount,
  members,
  labels,
  disabled = false,
  disabledNote = null,
  applying = false,
  onApply,
  onClear,
}: BulkToolbarProps) {
  const [action, setAction] = useState<BulkIssueAction>("setStatus");
  const [statusValue, setStatusValue] = useState<IssueStatus>("Open");
  const [priorityValue, setPriorityValue] = useState<IssuePriority>("Medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleLabel(id: string) {
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  function buildRequest(): BulkIssueRequest | null {
    const base = { issueIds: selectedIds };
    switch (action) {
      case "setStatus":
        return { ...base, action: "setStatus", status: statusValue };
      case "setPriority":
        return { ...base, action: "setPriority", priority: priorityValue };
      case "assign":
        return { ...base, action: "assign", assigneeId: assigneeId === "" ? null : assigneeId };
      case "addLabels":
      case "removeLabels":
        return labelIds.length ? { ...base, action, labelIds } : null;
      case "delete":
        return null; // delete requests are built by the confirmation dialog
    }
  }

  const canApply =
    !disabled &&
    !applying &&
    (action === "addLabels" || action === "removeLabels" ? labelIds.length > 0 : true);

  function handlePrimary() {
    if (action === "delete") {
      setConfirmDelete(true);
      return;
    }
    const req = buildRequest();
    if (req) onApply(req);
  }

  return (
    <div className="bulk-toolbar" role="group" aria-label="Bulk actions" aria-disabled={disabled || undefined}>
      <span className="bulk-count" role="status">
        {selectedCount} selected
      </span>

      {disabledNote && <span className="bulk-note">{disabledNote}</span>}

      {!disabled && (
        <>
<Field label="Action" srOnlyLabel className="bulk-field">
             <Select
               value={action}
               onChange={(e) => {
                 setAction(e.target.value as BulkIssueAction);
                 setLabelIds([]);
               }}
               disabled={applying}
             >
               <option value="setStatus">Set status</option>
               <option value="setPriority">Set priority</option>
               <option value="assign">Assign to</option>
               <option value="addLabels">Add label</option>
               <option value="removeLabels">Remove label</option>
               <option value="delete">Delete</option>
             </Select>
           </Field>

          {action === "delete" && (
            <span className="bulk-note bulk-note--danger">Deleting cannot be undone.</span>
          )}

          {action === "setStatus" && (
<Field label="Status" srOnlyLabel className="bulk-field">
               <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value as IssueStatus)} disabled={applying}>
                 {ISSUE_STATUSES.map((s) => (
                   <option key={s} value={s}>
                     {s}
                   </option>
                 ))}
               </Select>
             </Field>
          )}

          {action === "setPriority" && (
<Field label="Priority" srOnlyLabel className="bulk-field">
               <Select value={priorityValue} onChange={(e) => setPriorityValue(e.target.value as IssuePriority)} disabled={applying}>
                 {ISSUE_PRIORITIES.map((p) => (
                   <option key={p} value={p}>
                     {p}
                   </option>
                 ))}
               </Select>
             </Field>
          )}

          {action === "assign" && (
<Field label="Assignee" srOnlyLabel className="bulk-field">
               <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} disabled={applying}>
                 <option value="">Unassigned</option>
                 {members.map((m) => (
                   <option key={m.userId} value={m.userId}>
                     {m.name}
                   </option>
                 ))}
               </Select>
             </Field>
          )}

          {(action === "addLabels" || action === "removeLabels") && labels.length > 0 && (
            <div className="bulk-labels field">
              <span className="field-label">{action === "addLabels" ? "Add labels" : "Remove labels"}</span>
              <div className="label-picker">
                {labels.map((label) => (
                  <label key={label.id} className={`label-chip label-chip--${label.color}`}>
                    <input
                      type="checkbox"
                      checked={labelIds.includes(label.id)}
                      onChange={() => toggleLabel(label.id)}
                      disabled={applying}
                    />
                    {label.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="bulk-actions">
        <Button type="button" variant="ghost" onClick={onClear}>
          Clear
        </Button>
        <Button type="button" variant={action === "delete" ? "danger" : "primary"} disabled={!canApply} onClick={handlePrimary}>
          {action === "delete" ? "Delete…" : applying ? "Applying…" : "Apply"}
        </Button>
      </div>

<ConfirmDialog
         open={confirmDelete}
         onClose={() => setConfirmDelete(false)}
         title={`Delete ${selectedCount} ${selectedCount === 1 ? "issue" : "issues"}?`}
         description="This permanently removes the selected issues. This cannot be undone."
         confirmLabel="Delete"
         busy={applying}
         busyLabel="Deleting…"
         onConfirm={() => {
           onApply({ issueIds: selectedIds, action: "delete" });
           setConfirmDelete(false);
         }}
       />
    </div>
  );
}