import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";
import type { Label } from "@mini-issue-tracker/shared";
import { LABEL_COLORS } from "@mini-issue-tracker/shared";
import type { LabelColor } from "@mini-issue-tracker/shared";
import { Alert } from "./Alert.js";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";
import { EmptyState } from "./EmptyState.js";
import { Field } from "./Field.js";
import { SkeletonRows } from "./Skeleton.js";

export interface LabelsSectionProps {
  workspaceId: string;
  labels: Label[];
  loading: boolean;
  onChange: () => Promise<void>;
}

export function LabelsSection({ workspaceId, labels, loading, onChange }: LabelsSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState<LabelColor>("violet");
  const [editing, setEditing] = useState<Label | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<LabelColor>("violet");
  const [deleting, setDeleting] = useState<Label | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/workspaces/${workspaceId}/labels`, {
        name: createName,
        color: createColor,
      });
      setCreateName("");
      setCreateColor("violet");
      setCreateOpen(false);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create label");
    }
  }

  function openEdit(label: Label) {
    setEditing(label);
    setEditName(label.name);
    setEditColor(label.color);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      await api.patch(`/labels/${editing.id}`, {
        name: editName,
        color: editColor,
      });
      setEditing(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update label");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setError(null);
    try {
      await api.delete(`/labels/${deleting.id}`);
      setDeleting(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete label");
    }
  }

  const colorRadios = (name: string, value: LabelColor, onChangeValue: (c: LabelColor) => void) =>
    LABEL_COLORS.map((color) => (
      <label key={color} className="color-radio">
        <input
          type="radio"
          name={name}
          value={color}
          checked={value === color}
          onChange={() => onChangeValue(color)}
        />
        <span className={`color-radio-swatch color-radio-swatch--${color}`} aria-hidden="true" />
        {color}
      </label>
    ));

  return (
    <div className="labels-panel">
      <div className="section-header">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          New label
        </Button>
      </div>

      {error && <Alert role="alert" className="project-alert">{error}</Alert>}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create label"
        description="Create a label for issues in this workspace."
      >
        <form className="dialog-form" onSubmit={handleCreate}>
          <Field label="Label name">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. bug, backend, design"
              autoFocus
              required
            />
          </Field>
          <Field label="Label color">
            <div className="color-radios">{colorRadios("label-color-create", createColor, setCreateColor)}</div>
          </Field>
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit label"
        description="Change this label's name or color."
      >
        <form className="dialog-form" onSubmit={handleEdit}>
          <Field label="Label name">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="Label color">
            <div className="color-radios">{colorRadios("label-color-edit", editColor, setEditColor)}</div>
          </Field>
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete label"
        description={`Delete "${deleting?.name ?? ""}"? Issues will keep their content but lose this label.`}
      >
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete}>
            Delete label
          </Button>
        </div>
      </Dialog>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : labels.length === 0 ? (
        <EmptyState
          title="No labels yet"
          description="Create labels to categorize issues in this workspace."
        />
      ) : (
        <ul className="label-list">
          {labels.map((label) => (
            <li key={label.id} className="label-row">
              <span className={`label-swatch label-swatch--${label.color}`} aria-hidden="true" />
              <span className="label-row-name">{label.name}</span>
              <div className="card-actions">
                <Button type="button" variant="ghost" onClick={() => openEdit(label)}>
                  Edit
                </Button>
                <Button type="button" variant="danger" onClick={() => setDeleting(label)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}