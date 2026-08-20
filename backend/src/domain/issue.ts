import { randomUUID } from "node:crypto";
import type { IssuePriority, IssueStatus } from "@mini-issue-tracker/shared";

export interface IssueEntity {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createIssueRecord(
  projectId: string,
  input: {
    title: string;
    description?: string | null;
    status: IssueStatus;
    priority: IssuePriority;
    assigneeId?: string | null;
    dueDate?: string | null;
  }
): IssueEntity {
  const now = new Date();
  return {
    id: randomUUID(),
    projectId,
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    priority: input.priority,
    assigneeId: input.assigneeId ?? null,
    dueDate: input.dueDate ?? null,
    createdAt: now,
    updatedAt: now,
  };
}