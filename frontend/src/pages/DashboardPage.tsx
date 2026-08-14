import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import type { Workspace } from "@mini-issue-tracker/shared";
import { Invitations } from "../components/Invitations.js";

export function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    try {
      await api.post("/workspaces", { name });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    }
  }

  return (
    <section>
      <h1 className="page-title">Workspaces</h1>
      {error && <p className="alert alert-error">{error}</p>}

      <form className="inline-form" onSubmit={handleCreate}>
        <label className="field field-grow">
          <span className="sr-only">Workspace name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New workspace name"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Create workspace
        </button>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : workspaces.length === 0 ? (
        <div>
          <p className="empty-state">No workspaces yet. Create your first workspace above.</p>
          <h2 className="section-title">Join a workspace</h2>
          <Invitations onJoined={load} />
        </div>
      ) : (
        <ul className="card-list">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link to={`/workspaces/${ws.id}`} className="card">
                <span className="card-title">{ws.name}</span>
                {ws.isOwner ? <span className="badge">Owner</span> : <span className="badge">Member</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}