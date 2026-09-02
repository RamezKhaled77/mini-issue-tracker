import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "./Badge.js";
import type { BadgeTone } from "./Badge.js";
import { Avatar } from "./Avatar.js";
import { IconBrand } from "./icons.js";

/**
 * Canonical ticket-ledger row (spec 012 §9).
 *
 * LedgerRow owns structure, visual states, interaction states, responsive
 * behavior and row semantics. Pages keep all computation (issueKey,
 * isOverdue, labelTone, filtering, bulk selection, quick-edit state) and pass
 * the results in. Business logic must NOT live here.
 *
 * Anatomy: selection slot → priority edge bar → ticket key → title →
 * caption slot → metadata slot (fixed order: overdue, status, priority,
 * ≤2 labels, assignee, due date) → trailing chevron.
 *
 * Variants:
 *  - "default"    — full-page ledgers (Workspace, My Issues)
 *  - "compact"    — overlay density ("ledger, lifted"); hides the due date
 *  - "workspace"  — Dashboard workspace list (brand mark + role badge)
 */
export interface LedgerRowProps {
  to: string;
  title: ReactNode;
  issueKey?: string;
  /** Caption slot under the title (ONE slot, e.g. issue description). */
  caption?: ReactNode;
  /**
   * Page-composed metadata slot. Quick-edit pages pass their QuickEdit*
   * components here (renders inside `[data-quickedit="meta"]`).
   */
  meta?: ReactNode;
  /** Canonical metadata composition (used when `meta` is omitted). */
  statusBadge?: { tone: BadgeTone; label: string };
  priority?: { tone: BadgeTone; label: string };
  labels?: Array<{ id: string; tone: BadgeTone; name: string }>; // capped at 2
  assignee?: { name: string };
  dueDate?: string | null;
  overdue?: boolean;
  selectable?: { checked: boolean; onChange: () => void; label: string };
  /** Row-local error line (quick-edit contract: focus managed by the page). */
  rowError?: ReactNode;
  selected?: boolean;
  /** Keyboard/hover highlight used by the search overlay listbox. */
  active?: boolean;
  onHover?: () => void;
  /** Invoked after navigation (e.g. search dialog closes itself). */
  onNavigate?: () => void;
  variant?: "default" | "compact" | "workspace";
}

const LABEL_CAP = 2;

export function LedgerRow({
  to,
  title,
  issueKey,
  caption,
  meta,
  statusBadge,
  priority,
  labels,
  assignee,
  dueDate,
  overdue = false,
  selectable,
  rowError,
  selected = false,
  active = false,
  onHover,
  onNavigate,
  variant = "default",
}: LedgerRowProps) {
  const priorityAttr = priority?.label.toLowerCase();
  const compact = variant === "compact";
  const workspace = variant === "workspace";

  const liClass = [
    "ledger-item",
    selected ? "ledger-item--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Compact (overlay) rows carry the priority/overdue attributes on the link;
  // page ledgers carry them on the li (edge-bar treatment lives there).
  const linkAttrs =
    compact || workspace
      ? {
          "data-priority": compact ? priorityAttr : undefined,
          "data-overdue": compact && overdue ? "true" : undefined,
        }
      : {};

  const linkClass = compact
    ? `ledger-row ledger-row--search${active ? " ledger-row--active" : ""}`
    : workspace
      ? "ledger-row"
      : "ledger-row-link";

  const metaContent =
    meta !== undefined ? (
      meta
    ) : (
      <>
        {overdue && <Badge tone="danger">Overdue</Badge>}
        {statusBadge && <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>}
        {priority && <Badge tone={priority.tone}>{priority.label}</Badge>}
        {(labels ?? []).slice(0, LABEL_CAP).map((label) => (
          <Badge key={label.id} tone={label.tone}>
            {label.name}
          </Badge>
        ))}
        {assignee && (
          <span className="ledger-assignee">
            <Avatar name={assignee.name} decorative small />
            {assignee.name}
          </span>
        )}
        {!compact && dueDate && <span className="ledger-due">{dueDate}</span>}
      </>
    );

  return (
    <li
      className={liClass}
      {...(compact || workspace
        ? {}
        : { "data-priority": priorityAttr, "data-overdue": overdue ? "true" : undefined })}
    >
      {selectable && (
        <span className="ledger-select">
          <input
            type="checkbox"
            checked={selectable.checked}
            onChange={selectable.onChange}
            aria-label={selectable.label}
          />
        </span>
      )}
      <Link
        to={to}
        className={linkClass}
        {...linkAttrs}
        onMouseEnter={onHover}
        onClick={onNavigate}
      >
        {workspace ? (
          <span className="app-brand-mark" aria-hidden="true">
            <IconBrand />
          </span>
        ) : (
          <span className="ticket-key">{issueKey}</span>
        )}
        <span className="ledger-main">
          <span className="ledger-title">{title}</span>
          {caption && <span className="ledger-subtitle">{caption}</span>}
          {(compact || workspace) && (
            <span className="ledger-meta" data-quickedit={meta !== undefined ? "meta" : undefined}>
              {workspace ? meta : metaContent}
            </span>
          )}
        </span>
        <span className="ledger-chevron" aria-hidden="true">
          &rarr;
        </span>
      </Link>
      {/* Page ledgers keep the meta run OUTSIDE the navigation link so
          quick-edit controls never trigger navigation (Spec 007/010 contract);
          overlay/workspace rows keep it inside the single link. */}
      {!compact && !workspace && (
        <>
          <span className="ledger-meta" data-quickedit={meta !== undefined ? "meta" : undefined}>
            {meta !== undefined ? meta : metaContent}
          </span>
          <span className="ledger-chevron" aria-hidden="true">
            &rarr;
          </span>
        </>
      )}
      {rowError}
    </li>
  );
}
