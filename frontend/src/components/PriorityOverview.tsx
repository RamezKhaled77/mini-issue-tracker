import type { DashboardStats } from "@mini-issue-tracker/shared";
import { ISSUE_PRIORITIES } from "@mini-issue-tracker/shared";

const PRIORITY_META = {
  urgent: { label: "URGENT", dot: "urgent-dot" },
  high: { label: "HIGH", dot: "high-dot" },
  medium: { label: "MEDIUM", dot: "medium-dot" },
  low: { label: "LOW", dot: "low-dot" },
} as const;

type PriorityKey = keyof typeof PRIORITY_META;

const MAX_BAR = 12;

export function PriorityOverview({ stats }: { stats: DashboardStats }) {
  const { byPriority } = stats;
  const maxCount = Math.max(...ISSUE_PRIORITIES.map((p) => byPriority[p] ?? 0), 1);

  return (
    <section className="dashboard-section" aria-label="Priority distribution">
      <h2 className="section-eyebrow">PRIORITY</h2>
      <div className="priority-overview">
        {ISSUE_PRIORITIES.map((priority) => {
          const count = byPriority[priority] ?? 0;
          const barWidth = (count / maxCount) * MAX_BAR;
          const key = priority.toLowerCase() as PriorityKey;
          const meta = PRIORITY_META[key];
          return (
            <div key={priority} className="priority-row">
              <div className="priority-label-group">
                <span className={`priority-dot ${meta.dot}`} aria-hidden="true" />
                <span className="priority-name">{meta.label}</span>
              </div>
              <div className="priority-bar-track">
                <div
                  className="priority-bar-fill"
                  style={{ width: `${(barWidth / MAX_BAR) * 100}%` }}
                  title={`${count} ${priority} issues`}
                />
              </div>
              <dt className="priority-count">{count}</dt>
            </div>
          );
        })}
      </div>
    </section>
  );
}
