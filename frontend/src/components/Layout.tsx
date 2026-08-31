import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import type { Workspace } from "@mini-issue-tracker/shared";
import { useAuth } from "../context/auth.js";
import { Button } from "./Button.js";
import { Avatar } from "./Avatar.js";
import { SearchDialog } from "./SearchDialog.js";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog.js";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.js";
import { useKeyboardShortcuts } from "../lib/useKeyboardShortcuts.js";
import { initWorkspaceCache } from "../lib/workspaceCache.js";
import {
  IconBrand,
  IconSearch,
  IconIssue,
  IconWorkspaces,
  IconHelp,
  IconSignout,
  IconLabels,
} from "./icons.js";

export function Layout() {
  const { user, signout } = useAuth();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoading, setWsLoading] = useState(true);

  useEffect(() => {
    initWorkspaceCache()
      .then(setWorkspaces)
      .finally(() => setWsLoading(false));
  }, []);

  // Single source of truth for the shell's shortcuts (Spec 009, D-02/D-03):
  // `/` + Ctrl/Cmd+K are preserved verbatim; `?`, `G D`, `G M` are new. Guards
  // (typing, modal) and the sequence engine live in the registry.
  useKeyboardShortcuts(
    [
      {
        id: "search.slash",
        keys: ["/"],
        context: "global",
        group: "Global",
        description: "Search issues",
        action: () => setSearchOpen(true),
      },
      {
        id: "search.modk",
        keys: ["k"],
        context: "global",
        group: "Global",
        isMod: true,
        description: "Search issues",
        action: () => setSearchOpen(true),
      },
      {
        id: "help",
        keys: ["?"],
        context: "global",
        group: "Global",
        description: "Open keyboard shortcuts",
        action: () => setHelpOpen(true),
      },
      {
        id: "nav.dashboard",
        keys: ["g", "d"],
        context: "global",
        group: "Global",
        description: "Go to Dashboard",
        action: () => navigate("/"),
      },
      {
        id: "nav.myissues",
        keys: ["g", "m"],
        context: "global",
        group: "Global",
        description: "Go to My Issues",
        action: () => navigate("/my-issues"),
      },
    ],
    []
  );

  async function handleSignout() {
    await signout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={`app-sidebar${sidebarCollapsed ? " app-sidebar--collapsed" : ""}`} id="app-sidebar">
        <Link to="/" className="app-brand" data-sidebar-tooltip="Mini Issue Tracker">
          <span className="app-brand-mark" aria-hidden="true">
            <IconBrand />
          </span>
          <span className="app-brand-text">
            <span className="app-brand-name">Mini</span>
            <span className="app-brand-sub">Issue Tracker</span>
          </span>
        </Link>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          aria-controls="app-sidebar"
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-sidebar-tooltip={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <WorkspaceSwitcher
          currentId={workspaceId}
          workspaces={workspaces}
          loading={wsLoading}
        />
        <nav className="sidebar-nav" aria-label="Main">
          <span className="sidebar-eyebrow">Workspace</span>
          <NavLink
            to="/"
            end
            data-sidebar-tooltip="Workspaces"
            className={({ isActive }) =>
              isActive ? "sidebar-link sidebar-link--active" : "sidebar-link"
            }
          >
            <IconWorkspaces />
            <span className="sidebar-text">Workspaces</span>
          </NavLink>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            data-sidebar-tooltip="Search (/)"
            className="sidebar-link"
            aria-label="Search issues"
          >
            <IconSearch />
            <span className="sidebar-text">Search</span>
          </button>
        </nav>
        <nav className="sidebar-nav" aria-label="Personal">
          <span className="sidebar-eyebrow">Personal</span>
          <NavLink
            to="/my-issues"
            data-sidebar-tooltip="My Issues"
            className={({ isActive }) =>
              isActive ? "sidebar-link sidebar-link--active" : "sidebar-link"
            }
          >
            <IconIssue />
            <span className="sidebar-text">My Issues</span>
          </NavLink>
        </nav>
        {workspaceId && (
          <nav className="sidebar-nav sidebar-nav--contextual" aria-label="Workspace">
            <span className="sidebar-eyebrow">Workspace</span>
            <NavLink
              to={`/workspaces/${workspaceId}`}
              end
              data-sidebar-tooltip="Issues"
              className={({ isActive }) =>
                isActive ? "sidebar-link sidebar-link--active" : "sidebar-link"
              }
            >
              <IconIssue />
              <span className="sidebar-text">Issues</span>
            </NavLink>
            <NavLink
              to={`/workspaces/${workspaceId}/labels`}
              data-sidebar-tooltip="Labels"
              className={({ isActive }) =>
                isActive ? "sidebar-link sidebar-link--active" : "sidebar-link"
              }
            >
              <IconLabels />
              <span className="sidebar-text">Labels</span>
            </NavLink>
          </nav>
        )}
        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <Avatar name={user.name} />
              <span className="app-user">
                <span className="app-user-name">{user.name}</span>
                <span className="app-user-email">{user.email}</span>
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setHelpOpen(true)}
            className="sidebar-help"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
            data-sidebar-tooltip="Keyboard shortcuts (?)"
          >
            <IconHelp />
            <span className="sidebar-signout-text">Keyboard shortcuts</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleSignout}
            className="sidebar-signout"
            aria-label="Sign out"
            data-sidebar-tooltip="Sign out"
          >
            <IconSignout />
            <span className="sidebar-signout-text">Sign out</span>
          </Button>
        </div>
      </aside>
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
