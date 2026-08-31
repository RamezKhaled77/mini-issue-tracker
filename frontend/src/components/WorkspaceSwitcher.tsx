import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Workspace } from "@mini-issue-tracker/shared";
import { Badge } from "./Badge.js";
import { IconChevron } from "./icons.js";

interface WorkspaceSwitcherProps {
  currentId?: string;
  workspaces: Workspace[];
  loading: boolean;
}

/**
 * Current-workspace identity + real workspace list in the sidebar.
 *
 * Data comes from `GET /workspaces` (the same call DashboardPage makes — no
 * new endpoint). The popover follows the QuickEditPopover contract: Escape
 * closes, focus returns to the trigger, click-outside closes,
 * `aria-expanded` on the trigger. Switching never leaks inaccessible
 * workspaces because the list comes from the authorized `/workspaces`
 * response.
 */
export function WorkspaceSwitcher({ currentId, workspaces, loading }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const current = workspaces.find((w) => w.id === currentId);
  const triggerLabel = current ? current.name : "Workspaces";

  // Focus management & click-outside.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="workspace-switcher">
      <button
        type="button"
        ref={triggerRef}
        className="workspace-switcher-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current ? `Switch workspace, currently ${current.name}` : "Switch workspace"}
        data-sidebar-tooltip="Switch workspace"
      >
        <span className="workspace-switcher-indicator" aria-hidden="true">
          {current ? current.name.charAt(0).toUpperCase() : "W"}
        </span>
        <span className="workspace-switcher-name">{triggerLabel}</span>
        <IconChevron size={14} className="workspace-switcher-caret" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="workspace-switcher-popover"
          role="listbox"
          aria-label="Workspaces"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
        >
          <span className="workspace-switcher-popover-eyebrow">Workspaces</span>
          <ul className="workspace-switcher-list">
            <li>
              <Link
                to="/"
                className={`workspace-switcher-item${!currentId ? " workspace-switcher-item--active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className="workspace-switcher-item-name">All workspaces</span>
              </Link>
            </li>
            {loading ? (
              <li className="workspace-switcher-empty">Loading…</li>
            ) : (
              workspaces.map((ws) => {
                const active = ws.id === currentId;
                return (
                  <li key={ws.id}>
                    <Link
                      to={`/workspaces/${ws.id}`}
                      className={`workspace-switcher-item${active ? " workspace-switcher-item--active" : ""}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <span className="workspace-switcher-item-name">{ws.name}</span>
                      <Badge tone="neutral">{ws.isOwner ? "Owner" : "Member"}</Badge>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}