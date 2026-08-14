import type { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
}

export function Skeleton({ className = "", children }: SkeletonProps) {
  return (
    <div className={["skeleton", className].filter(Boolean).join(" ")} aria-hidden="true">
      {children}
    </div>
  );
}

interface SkeletonRowsProps {
  rows?: number;
  className?: string;
}

export function SkeletonRows({ rows = 3, className = "" }: SkeletonRowsProps) {
  return (
    <div className={["skeleton-list", className].filter(Boolean).join(" ")}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="skeleton-row" />
      ))}
    </div>
  );
}