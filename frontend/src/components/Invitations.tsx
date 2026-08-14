import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";
import { Button } from "./Button.js";
import { Field } from "./Field.js";

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
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      <div className="workspace-tools">
        <form className="inline-form" onSubmit={handleJoin}>
          <Field label="Invitation token" className="field-grow" srOnlyLabel>
            <input
              value={joinToken}
              onChange={(e) => setJoinToken(e.target.value)}
              placeholder="Paste an invitation token to join"
            />
          </Field>
          <Button type="submit" variant="secondary">
            Join workspace
          </Button>
        </form>
        {workspaceId && isOwner && (
          <div className="invite-row">
            <Button type="button" variant="secondary" onClick={handleGenerateInvite}>
              Generate invitation
            </Button>
            {inviteToken && (
              <input className="invite-token" readOnly value={inviteToken} aria-label="Invitation token" />
            )}
          </div>
        )}
      </div>
    </>
  );
}