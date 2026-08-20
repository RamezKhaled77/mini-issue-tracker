import { useState } from "react";
import { api } from "../api/client.js";
import { Button } from "./Button.js";

interface InvitationsProps {
  workspaceId: string;
  isOwner: boolean;
}

export function Invitations({ workspaceId, isOwner }: InvitationsProps) {
  const [inviteToken, setInviteToken] = useState("");
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

  return (
    <div className="invitations">
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      {isOwner && (
        <>
          <p className="workspace-tool-eyebrow">Workspace access</p>
          <div className="invite-row">
            <Button type="button" variant="secondary" onClick={handleGenerateInvite}>
              Generate invitation
            </Button>
            {inviteToken && (
              <input className="invite-token" readOnly value={inviteToken} aria-label="Invitation token" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
