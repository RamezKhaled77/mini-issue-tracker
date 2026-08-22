import { useState } from "react";
import type { ReactNode } from "react";

interface CollapsibleSectionProps {
  id: string;
  label: string;
  count?: number;
  storageKey: string;
  className?: string;
  children: ReactNode;
}

function readStoredOpen(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) !== "closed";
  } catch {
    return true;
  }
}

export function CollapsibleSection({ id, label, count, storageKey, className, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(() => readStoredOpen(storageKey));

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "open" : "closed");
      } catch {
        // storage unavailable — state still toggles for this visit
      }
      return next;
    });
  }

  const classes = ["collapsible-section"];
  if (className) classes.push(className);
  if (!open) classes.push("collapsible-section--collapsed");

  return (
    <section className={classes.join(" ")}>
      <h2 className="section-eyebrow collapsible-heading">
        <button type="button" className="collapsible-toggle" onClick={toggle} aria-expanded={open} aria-controls={id}>
          <svg className="collapsible-caret" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{label}</span>
          {count !== undefined && <span className="section-count">{count}</span>}
        </button>
      </h2>
      <div id={id} className="collapsible-region" role="region" aria-label={label}>
        <div className="collapsible-inner">{children}</div>
      </div>
    </section>
  );
}
