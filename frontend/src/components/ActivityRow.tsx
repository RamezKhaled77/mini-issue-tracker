import type { Activity } from "@mini-issue-tracker/shared";
import { Badge } from "./Badge.js";

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getActorDisplay(activity: Activity): string {
  return activity.actorName || "Someone";
}

function renderCreated(_activity: Activity) {
  return (
    <span className="activity-action">
      <span className="activity-dot activity-dot--created" aria-hidden="true" />
      Created issue
    </span>
  );
}

function renderUpdated(activity: Activity) {
  const field = activity.field ? (
    <span className="activity-field">{activity.field}</span>
  ) : null;
  const from = activity.fromValue !== null && activity.fromValue !== undefined ? (
    <span className="activity-value">{activity.fromValue}</span>
  ) : (
    <span className="activity-value activity-value--empty">—</span>
  );
  const to = activity.toValue !== null && activity.toValue !== undefined ? (
    <span className="activity-value">{activity.toValue}</span>
  ) : (
    <span className="activity-value activity-value--empty">—</span>
  );

  return (
    <span className="activity-action">
      {field}
      <span className="activity-change">
        {from}
        <span className="activity-arrow" aria-hidden="true">→</span>
        {to}
      </span>
    </span>
  );
}

function renderLabelsAdded(activity: Activity) {
  const labels = activity.labelNames ?? [];
  return (
    <span className="activity-action">
      <span className="activity-dot activity-dot--added" aria-hidden="true" />
      Added labels
      {labels.length > 0 && (
        <span className="activity-labels">
          {labels.map((name, index) => (
            <Badge key={`${name}-${index}`} tone="label-violet" className="activity-badge">
              {name}
            </Badge>
          ))}
        </span>
      )}
    </span>
  );
}

function renderLabelsRemoved(activity: Activity) {
  const labels = activity.labelNames ?? [];
  return (
    <span className="activity-action">
      <span className="activity-dot activity-dot--removed" aria-hidden="true" />
      Removed labels
      {labels.length > 0 && (
        <span className="activity-labels">
          {labels.map((name, index) => (
            <Badge key={`${name}-${index}`} tone="label-violet" className="activity-badge activity-badge--removed">
              {name}
            </Badge>
          ))}
        </span>
      )}
    </span>
  );
}

function renderDeleted(_activity: Activity) {
  return (
    <span className="activity-action">
      <span className="activity-dot activity-dot--deleted" aria-hidden="true" />
      Deleted issue
    </span>
  );
}

function renderActivityContent(activity: Activity) {
  switch (activity.type) {
    case "issue.created":
      return renderCreated(activity);
    case "issue.updated":
      return renderUpdated(activity);
    case "issue.labels_added":
      return renderLabelsAdded(activity);
    case "issue.labels_removed":
      return renderLabelsRemoved(activity);
    case "issue.deleted":
      return renderDeleted(activity);
    default:
      return null;
  }
}

export function ActivityRow({ activity }: { activity: Activity }) {
  const content = renderActivityContent(activity);

  return (
    <article className="activity-row" aria-label={`${getActorDisplay(activity)} ${activity.type.replace(".", " ")}`}>
      <div className="activity-main">
        <span className="activity-actor">{getActorDisplay(activity)}</span>
        {content}
      </div>
      <time className="activity-meta" dateTime={activity.createdAt}>
        {formatTimestamp(activity.createdAt)}
      </time>
    </article>
  );
}