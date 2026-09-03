import type { Activity } from "@mini-issue-tracker/shared";
import { ActivityRow } from "./ActivityRow.js";
import { SkeletonRows } from "./Skeleton.js";

export function RecentActivity({
  items,
  loading,
}: {
  items: Activity[];
  loading?: boolean;
}) {
  return (
    <section className="dashboard-section" aria-label="Recent activity">
      <h2 className="section-eyebrow">RECENT ACTIVITY</h2>
      {loading ? (
        <SkeletonRows rows={5} />
      ) : items.length === 0 ? (
        <p className="activity-empty">No recent activity in this workspace.</p>
      ) : (
        <ul className="activity-list">
          {items.map((item) => (
            <ActivityRow key={item.id} activity={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
