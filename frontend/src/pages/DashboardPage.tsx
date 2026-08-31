import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";
import type { Workspace } from "@mini-issue-tracker/shared";
import { JoinWorkspace } from "../components/JoinWorkspace.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { Dialog } from "../components/Dialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { SkeletonRows } from "../components/Skeleton.js";
import { Field } from "../components/Field.js";

import { PageHeader } from "../components/PageHeader.js";
import { LedgerList } from "../components/LedgerList.js";
import { LedgerRow } from "../components/LedgerRow.js";
import { Input } from "../components/Input.js";
import { refreshWorkspaceCache } from "../lib/workspaceCache.js";

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
    void refreshWorkspaceCache();
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
      <PageHeader
        title="Workspaces"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            New workspace
          </Button>
        }
      />

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
             <Input
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
        </div>
      ) : (
        <LedgerList
          ariaLabel="Workspaces"
          className="dashboard-ledger"
          rows={workspaces.map((ws) => (
            <LedgerRow
              key={ws.id}
              variant="workspace"
              to={`/workspaces/${ws.id}`}
              title={ws.name}
              meta={<Badge tone="neutral">{ws.isOwner ? "Owner" : "Member"}</Badge>}
            />
          ))}
        />
      )}

      <section className="dashboard-join">
        <h2 className="section-title">Join a workspace</h2>
        <JoinWorkspace onJoined={load} />
      </section>
    </section>
  );
}