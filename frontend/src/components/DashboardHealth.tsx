import type { DashboardStats } from "@mini-issue-tracker/shared";

const META_LABELS = {
  open: "OPEN",
  inProgress: "IN PROGRESS",
  closed: "CLOSED",
  overdue: "OVERDUE",
} as const;

export function DashboardHealth({ stats }: { stats: DashboardStats }) {
  const { byStatus, overdue } = stats;
  return (
    <section className="dashboard-health" aria-label="Issue health">
      <div className="health-rule" />
      <dl className="health-metrics">
        <div className="health-metric">
          <dt className="metric-count">{byStatus.Open ?? 0}</dt>
          <dd className="metric-label open-dot" />
          <div className="metric-name">{META_LABELS.open}</div>
        </div>
        <div className="health-rule-vertical" />
        <div className="health-metric">
          <dt className="metric-count">{byStatus["In Progress"] ?? 0}</dt>
          <dd className="metric-label in-progress-dot" />
          <div className="metric-name">{META_LABELS.inProgress}</div>
        </div>
        <div className="health-rule-vertical" />
        <div className="health-metric">
          <dt className="metric-count">{byStatus.Closed ?? 0}</dt>
          <dd className="metric-label closed-dot" />
          <div className="metric-name">{META_LABELS.closed}</div>
        </div>
        <div className="health-rule-vertical" />
        <div className="health-metric">
          <dt className="metric-count metric-count--alert">{overdue}</dt>
          <dd className="metric-label overdue-dot" />
          <div className="metric-name">{META_LABELS.overdue}</div>
        </div>
      </dl>
    </section>
  );
}
