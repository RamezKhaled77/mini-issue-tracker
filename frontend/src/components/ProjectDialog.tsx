import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";
import type { Project } from "@mini-issue-tracker/shared";
import { Alert } from "./Alert.js";
import { Button } from "./Button.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { Dialog } from "./Dialog.js";
import { EmptyState } from "./EmptyState.js";
import { Field } from "./Field.js";
import { Input } from "./Input.js";
import { SkeletonRows } from "./Skeleton.js";

export interface ProjectDialogProps {
  workspaceId: string;
  projects: Project[];
  selectedProject: string;
  loading: boolean;
  onSelectProject: (id: string) => void;
  onProjectsChanged: (createdId?: string) => Promise<void>;
}

export function ProjectDialog({
  workspaceId,
  projects,
  selectedProject,
  loading,
  onSelectProject,
  onProjectsChanged,
}: ProjectDialogProps) {
  const [projectName, setProjectName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ project: Project }>(`/workspaces/${workspaceId}/projects`, {
        name: projectName,
      });
      setProjectName("");
      setCreateOpen(false);
      await onProjectsChanged(res.project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  async function handleRenameProject(e: FormEvent) {
    e.preventDefault();
    if (!renamingProject) return;
    setError(null);
    try {
      await api.patch(`/projects/${renamingProject.id}`, { name: renameValue });
      setRenamingProject(null);
      setRenameValue("");
      await onProjectsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename project");
    }
  }

  async function handleDeleteProject() {
    if (!deletingProject) return;
    setError(null);
    try {
      await api.delete(`/projects/${deletingProject.id}`);
      if (selectedProject === deletingProject.id) onSelectProject("");
      setDeletingProject(null);
      await onProjectsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  function openRename(project: Project) {
    setRenamingProject(project);
    setRenameValue(project.name);
  }

  return (
    <div className="projects-panel">
      <div className="section-header">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          New project
        </Button>
      </div>

      {error && (
        <Alert role="alert" className="project-alert">
          {error}
        </Alert>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create project"
        description="Create a project inside this workspace."
      >
        <form className="dialog-form" onSubmit={handleCreateProject}>
<Field label="Project name">
             <Input
               value={projectName}
               onChange={(e) => setProjectName(e.target.value)}
               placeholder="New project name"
               autoFocus
               required
             />
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
        open={Boolean(renamingProject)}
        onClose={() => setRenamingProject(null)}
        title="Rename project"
        description="Change the name of this project."
      >
        <form className="dialog-form" onSubmit={handleRenameProject}>
<Field label="Project name">
             <Input
               value={renameValue}
               onChange={(e) => setRenameValue(e.target.value)}
               autoFocus
               required
             />
           </Field>
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={() => setRenamingProject(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </form>
      </Dialog>

<ConfirmDialog
         open={Boolean(deletingProject)}
         onClose={() => setDeletingProject(null)}
         title="Delete project"
         description={`Delete "${deletingProject?.name ?? ""}" and all its issues? This cannot be undone.`}
         confirmLabel="Delete project"
         onConfirm={handleDeleteProject}
       />

      {loading ? (
        <SkeletonRows rows={3} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start tracking issues."
        />
      ) : (
        <ul className="card-list">
          {projects.map((p) => {
            const selected = p.id === selectedProject;
            return (
              <li key={p.id} className="card card-with-actions">
                <button
                  type="button"
                  className={`card-selectable card-main${selected ? " card-selected" : ""}`}
                  onClick={() => onSelectProject(p.id)}
                  aria-pressed={selected}
                  title={p.name}
                >
                  <span className="card-title">{p.name}</span>
                </button>
                <div className="card-actions">
                  <Button type="button" variant="ghost" onClick={() => openRename(p)}>
                    Rename
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setDeletingProject(p)}>
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