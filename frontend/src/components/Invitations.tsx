import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";

interface InvitationsProps {
  workspaceId?: string;
  isOwner?: boolean;
  onJoined?: () => void | Promise<void>;
}

export function Invitations({ workspaceId, isOwner, onJoined }: InvitationsProps) {
  const [inviteToken, setInviteToken] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateInvite() {
    setError(null);
    try {
      const res = await api.post<{ invitation: { token: string } }>(
        `/workspaces/${workspaceId}/invitations`
      );
      setInviteToken(res.invitation.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invitation");
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/workspaces/join", { token: joinToken });
      setJoinToken("");
      await onJoined?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join workspace");
    }
  }

  return (
    <>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="workspace-tools">
        <form className="inline-form" onSubmit={handleJoin}>
          <label className="field field-grow">
            <span className="sr-only">Invitation token</span>
            <input
              value={joinToken}
              onChange={(e) => setJoinToken(e.target.value)}
              placeholder="Paste an invitation token to join"
            />
          </label>
          <button type="submit" className="btn">
            Join workspace
          </button>
        </form>
        {workspaceId && isOwner && (
          <div className="invite-row">
            <button type="button" className="btn" onClick={handleGenerateInvite}>
              Generate invitation
            </button>
            {inviteToken && (
              <input className="invite-token" readOnly value={inviteToken} aria-label="Invitation token" />
            )}
          </div>
        )}
      </div>
    </>
  );
}