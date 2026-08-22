import { ActivityList } from "./ActivityList.js";
import { CollapsibleSection } from "./CollapsibleSection.js";
import type { Activity } from "@mini-issue-tracker/shared";

interface ActivityPanelProps {
  issueId: string;
  initialItems: Activity[];
  initialTotal: number;
  initialPage: number;
}

export function ActivityPanel({ issueId, initialItems, initialTotal, initialPage }: ActivityPanelProps) {
  return (
    <CollapsibleSection
      className="activity-panel"
      id="activity-region"
      label="Activity"
      count={initialTotal}
      storageKey="mini-issue-tracker:activity"
    >
      <ActivityList
        issueId={issueId}
        initialItems={initialItems}
        initialTotal={initialTotal}
        initialPage={initialPage}
      />
    </CollapsibleSection>
  );
}
