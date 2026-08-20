import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import { Button } from "./Button.js";
import { Avatar } from "./Avatar.js";

export function Layout() {
  const { user, signout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 5h8M4 8h8M4 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
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
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 4h8M4 7h8M4 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="sidebar-text">Workspaces</span>
          </NavLink>
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
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 2.5h10v11H3zM3 6h10M6.5 9.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sidebar-text">My Issues</span>
          </NavLink>
        </nav>
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
            onClick={handleSignout}
            className="sidebar-signout"
            aria-label="Sign out"
            data-sidebar-tooltip="Sign out"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3H3.5v10H6M10.5 5.5 13 8l-2.5 2.5M13 8H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sidebar-signout-text">Sign out</span>
          </Button>
        </div>
      </aside>
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
