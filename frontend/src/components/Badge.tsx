import type { ReactNode } from "react";

export type BadgeTone =
  | "status-open"
  | "status-in-progress"
  | "status-closed"
  | "priority-low"
  | "priority-medium"
  | "priority-high"
  | "priority-urgent"
  | "neutral"
  | "accent";

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone, children, className = "" }: BadgeProps) {
  const classes = ["badge", `badge--${tone}`, className].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}