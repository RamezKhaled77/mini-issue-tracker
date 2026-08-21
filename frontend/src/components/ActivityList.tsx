import { useState } from "react";
import { api } from "../api/client.js";
import type { Activity } from "@mini-issue-tracker/shared";
import { ActivityRow } from "./ActivityRow.js";
import { EmptyState } from "./EmptyState.js";
import { SkeletonRows } from "./Skeleton.js";
import { Button } from "./Button.js";

interface ActivityListProps {
  issueId: string;
  initialItems: Activity[];
  initialTotal: number;
  initialPage: number;
}

export function ActivityList({ issueId, initialItems, initialTotal, initialPage }: ActivityListProps) {
  const [items, setItems] = useState<Activity[]>(initialItems);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotal);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await api.getActivity(issueId, { page: nextPage, pageSize: 50 });
      setItems((prev) => [...prev, ...res.items]);
      setPage(nextPage);
      setHasMore(res.items.length > 0 && items.length + res.items.length < res.total);
    } catch (err) {
      console.error("Failed to load activity:", err);
    } finally {
      setLoading(false);
    }
  }

  if (initialItems.length === 0 && initialTotal === 0 && page === 1) {
    return (
      <EmptyState title="No activity yet" description="Activity will appear here when changes are made to this issue." />
    );
  }

  return (
    <div className="activity-list">
      {items.length === 0 && page === 1 && (
        <SkeletonRows rows={3} />
      )}
      <ol className="activity-items">
        {items.map((activity) => (
          <li key={activity.id}>
            <ActivityRow activity={activity} />
          </li>
        ))}
      </ol>
      {hasMore && (
        <div className="activity-load-more">
          <Button type="button" variant="secondary" onClick={loadMore} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}