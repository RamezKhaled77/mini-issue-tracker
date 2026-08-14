import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import type { Workspace } from "@mini-issue-tracker/shared";
import { Invitations } from "../components/Invitations.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { Dialog } from "../components/Dialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { SkeletonRows } from "../components/Skeleton.js";
import { Field } from "../components/Field.js";

export function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await api.get<{ items: Workspace[] }>("/workspaces");
    setWorkspaces(res.items);
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.post("/workspaces", { name });
      setName("");
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Workspaces</h1>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          New workspace
        </Button>
      </div>

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create workspace"
        description="Create a workspace to organize your team's projects."
      >
        <form className="dialog-form" onSubmit={handleCreate}>
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              autoFocus
              required
            />
          </Field>
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>

      {loading ? (
        <SkeletonRows rows={3} className="workspace-skeleton" />
      ) : workspaces.length === 0 ? (
        <div className="dashboard-empty">
          <EmptyState
            title="No workspaces yet"
            description="Create your first workspace to start tracking issues."
          />
          <h2 className="section-title">Join a workspace</h2>
          <Invitations onJoined={load} />
        </div>
      ) : (
        <ul className="card-list">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link to={`/workspaces/${ws.id}`} className="card">
                <span className="card-title">{ws.name}</span>
                <Badge tone={ws.isOwner ? "status-open" : "neutral"}>
                  {ws.isOwner ? "Owner" : "Member"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}