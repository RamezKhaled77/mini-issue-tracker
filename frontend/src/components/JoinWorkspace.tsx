import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client.js";
import { Button } from "./Button.js";
import { Field } from "./Field.js";

interface JoinWorkspaceProps {
  onJoined?: () => void | Promise<void>;
}

export function JoinWorkspace({ onJoined }: JoinWorkspaceProps) {
  const [joinToken, setJoinToken] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    </>
  );
}