import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";
import type { Label, Project, SavedView } from "@mini-issue-tracker/shared";
import { Alert } from "./Alert.js";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";
import { EmptyState } from "./EmptyState.js";
import { Field } from "./Field.js";
import { SkeletonRows } from "./Skeleton.js";
import { resolveSavedViewFilters, savedViewAvailabilityNote } from "../lib/savedViewFilters.js";

export interface SavedViewsSectionProps {
  workspaceId: string;
  views: SavedView[];
  projects: Project[];
  labels: Label[];
  loading: boolean;
  activeViewId: string | null;
  /**
   * Incremented by the page's "Save view" affordance to open the create
   * dialog here (the section owns all Saved View dialogs).
   */
  saveSignal: number;
  /** Current ledger filters, captured when a new view is saved. */
  getFilters: () => unknown;
  onSelect: (view: SavedView) => void;
  onChange: () => Promise<void>;
}

export function SavedViewsSection({
  workspaceId,
  views,
  projects,
  labels,
  loading,
  activeViewId,
  saveSignal,
  getFilters,
  onSelect,
  onChange,
}: SavedViewsSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [editing, setEditing] = useState<SavedView | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<SavedView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (saveSignal > 0) {
      setCreateName("");
      setError(null);
      setCreateOpen(true);
    }
  }, [saveSignal]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createSavedView(workspaceId, {
        name: createName,
        filters: getFilters() as Parameters<typeof api.createSavedView>[1]["filters"],
      });
      setCreateName("");
      setCreateOpen(false);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save view");
    }
  }

  function openEdit(view: SavedView) {
    setEditing(view);
    setEditName(view.name);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      await api.updateSavedView(editing.id, { name: editName });
      setEditing(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update view");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setError(null);
    try {
      await api.deleteSavedView(deleting.id);
      setDeleting(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete view");
    }
  }

  const projectIds = new Set(projects.map((p) => p.id));
  const labelIds = new Set(labels.map((l) => l.id));

  return (
    <div className="saved-views-panel">
      <div className="section-header">
        <h2 className="section-title">Saved views</h2>
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Save view"
        description="Save the current issue filters as a named view."
      >
        <form className="dialog-form" onSubmit={handleCreate}>
          {error && <Alert role="alert">{error}</Alert>}
          <Field label="View name">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. My high priority"
              autoFocus
              required
              maxLength={60}
            />
          </Field>
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save view
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Rename view"
        description="Change this view's name. Its filters stay unchanged."
      >
        <form className="dialog-form" onSubmit={handleEdit}>
          {error && <Alert role="alert">{error}</Alert>}
          <Field label="View name">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              required
              maxLength={60}
            />
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
        title="Delete view"
        description={`Delete "${deleting?.name ?? ""}"? Issues are not affected.`}
      >
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete}>
            Delete view
          </Button>
        </div>
      </Dialog>

      {loading ? (
        <SkeletonRows rows={2} />
      ) : views.length === 0 ? (
        <EmptyState
          title="No saved views yet"
          description="Save the current filters from the issue toolbar to reuse them later."
        />
      ) : (
        <ul className="view-list">
          {views.map((view) => {
            const resolved = resolveSavedViewFilters(view, projectIds, labelIds);
            const note = resolved ? savedViewAvailabilityNote(resolved) : "unavailable";
            const applicable = resolved !== null && !resolved.staleProject;
            const active = activeViewId === view.id;
            return (
              <li key={view.id} className={`view-row${active ? " view-row--active" : ""}`}>
                <button
                  type="button"
                  className="view-row-name"
                  onClick={() => onSelect(view)}
                  disabled={!applicable}
                  aria-current={active ? "true" : undefined}
                  title={note ?? undefined}
                >
                  {view.name}
                </button>
                {note && <span className="view-row-note">{note}</span>}
                <div className="view-row-actions">
                  <Button type="button" variant="ghost" onClick={() => openEdit(view)}>
                    Edit
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setDeleting(view)}>
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

