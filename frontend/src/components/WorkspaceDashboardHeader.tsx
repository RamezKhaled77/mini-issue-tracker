import { Link } from "react-router-dom";
import { Button } from "./Button.js";

interface WorkspaceInfo {
  id: string;
  name: string;
}

export function WorkspaceDashboardHeader({
  workspace,
  onNewIssue,
}: {
  workspace: WorkspaceInfo | null;
  onNewIssue: () => void;
}) {
  return (
    <header className="dashboard-header">
      <Link to="/" className="back-link">
        ← All workspaces
      </Link>
      <div className="dashboard-header-row">
        <div className="dashboard-header-main">
          <h1 className="page-title">{workspace?.name ?? "Workspace"}</h1>
          <p className="dashboard-header-meta">
            Workspace Dashboard
            <span aria-hidden="true"> · </span> Updated just now
          </p>
        </div>
        <Button type="button" variant="primary" onClick={onNewIssue}>
          + New issue
        </Button>
      </div>
    </header>
  );
}
