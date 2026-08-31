import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState.js";
import { SkeletonRows } from "./Skeleton.js";

/**
 * Canonical ledger list wrapper (spec 012 §9.6): list semantics, skeleton
 * rows while loading, EmptyState when empty, mono count caption.
 * Pagination decisions stay with the page (deferred feature).
 */
export interface LedgerListProps {
  rows: ReactNode[];
  loading?: boolean;
  empty?: { title: string; description?: string; action?: ReactNode };
  /** Mono count caption rendered under the list. */
  caption?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function LedgerList({
  rows,
  loading = false,
  empty,
  caption,
  className = "",
  ariaLabel,
}: LedgerListProps) {
  if (loading) {
    return (
      <div aria-busy="true">
        <SkeletonRows rows={4} className={className} />
      </div>
    );
  }

  if (rows.length === 0 && empty) {
    return (
      <div className={className}>
        <EmptyState title={empty.title} description={empty.description} action={empty.action} />
      </div>
    );
  }

  return (
    <>
      <ul className={`ledger-list${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
        {rows}
      </ul>
      {caption && <p className="ledger-count">{caption}</p>}
    </>
  );
}
