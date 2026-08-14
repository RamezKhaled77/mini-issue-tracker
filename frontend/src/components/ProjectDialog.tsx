import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";
import type { Project } from "@mini-issue-tracker/shared";

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
  const [renamingProject, setRenamingProject] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ project: Project }>(`/workspaces/${workspaceId}/projects`, {
        name: projectName,
      });
      setProjectName("");
      await onProjectsChanged(res.project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  async function handleRenameProject(projectId: string) {
    setError(null);
    try {
      await api.patch(`/projects/${projectId}`, { name: renameValue });
      setRenamingProject(null);
      setRenameValue("");
      await onProjectsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename project");
    }
  }

  async function handleDeleteProject(projectId: string) {
    if (!window.confirm("Delete this project and all its issues?")) return;
    setError(null);
    try {
      await api.delete(`/projects/${projectId}`);
      if (selectedProject === projectId) onSelectProject("");
      await onProjectsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  return (
    <>
      {error && <p className="alert alert-error">{error}</p>}
      <form className="inline-form" onSubmit={handleCreateProject}>
        <label className="field field-grow">
          <span className="sr-only">Project name</span>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="New project name"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
      {loading ? (
        <p>Loading...</p>
      ) : projects.length === 0 ? (
        <p className="empty-state">No projects yet.</p>
      ) : (
        <ul className="card-list">
          {projects.map((p) => (
            <li key={p.id}>
              {renamingProject === p.id ? (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRenameProject(p.id);
                  }}
                >
                  <label className="field field-grow">
                    <span className="sr-only">Project name</span>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      required
                    />
                  </label>
                  <button type="submit" className="btn btn-primary">
                    Save
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setRenamingProject(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="card card-with-actions">
                  <button
                    type="button"
                    className={`card-selectable card-main${p.id === selectedProject ? " card-selected" : ""}`}
                    onClick={() => onSelectProject(p.id)}
                  >
                    <span className="card-title">{p.name}</span>
                  </button>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setRenamingProject(p.id);
                        setRenameValue(p.name);
                      }}
                    >
                      Rename
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => handleDeleteProject(p.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}