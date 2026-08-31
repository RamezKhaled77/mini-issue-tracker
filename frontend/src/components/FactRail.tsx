import type { ReactNode } from "react";

export interface FactRailItem {
  id: string;
  label: string;
  value: ReactNode;
}

interface FactRailProps {
  title?: ReactNode;
  items: FactRailItem[];
  className?: string;
  labelledBy?: string;
}

/**
 * Canonical issue-detail fact sheet: a structured <dl> of label/value pairs
 * laid out as ruled rows. Reuses the existing `.fact-rail` / `.fact-list` /
 * `.fact-label` / `.fact-value` rules from `pages/issue.css`.
 *
 * Presentation-only. The page owns:
 *   - the data, mutation logic, API calls, permissions
 *   - option generation (status/priority enumerations)
 *   - label/assignee/due-date semantics
 *
 * Each item is rendered as a row of:
 *   - <dt class="fact-label">  quiet mono uppercase label
 *   - <dd class="fact-value">  the value, which may be plain text or a control
 *
 * Empty / falsy values render the item unchanged so the page can express
 * "Unassigned" / "No due date" honestly.
 */
export function FactRail({ title = "Details", items, className, labelledBy }: FactRailProps) {
  if (items.length === 0) {
    return (
      <aside className={["fact-rail", className].filter(Boolean).join(" ")}>
        <h2 className="section-eyebrow" id={labelledBy}>
          {title}
        </h2>
      </aside>
    );
  }
  return (
    <aside className={["fact-rail", className].filter(Boolean).join(" ")}>
      <h2 className="section-eyebrow" id={labelledBy}>
        {title}
      </h2>
      <dl className="fact-list">
        {items.map((item) => (
          <div key={item.id}>
            <dt className="fact-label">{item.label}</dt>
            <dd className="fact-value">{item.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
