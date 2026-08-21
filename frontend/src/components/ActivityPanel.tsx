import { ActivityList } from "./ActivityList.js";
import type { Activity } from "@mini-issue-tracker/shared";

interface ActivityPanelProps {
  issueId: string;
  initialItems: Activity[];
  initialTotal: number;
  initialPage: number;
}

export function ActivityPanel({ issueId, initialItems, initialTotal, initialPage }: ActivityPanelProps) {
  return (
    <section className="activity-panel">
      <h2 className="section-eyebrow">Activity</h2>
      <ActivityList
        issueId={issueId}
        initialItems={initialItems}
        initialTotal={initialTotal}
        initialPage={initialPage}
      />
    </section>
  );
}