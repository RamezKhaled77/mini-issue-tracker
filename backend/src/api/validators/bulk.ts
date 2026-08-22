import { z } from "zod";
import {
  BULK_ISSUE_LIMIT,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
} from "@mini-issue-tracker/shared";

const issueIdsSchema = z
  .array(z.string().uuid("Invalid issue id"))
  .min(1, "Select at least one issue")
  .max(BULK_ISSUE_LIMIT, `Too many issues for one bulk action (max ${BULK_ISSUE_LIMIT})`)
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ path: ["issueIds"], code: "custom", message: "Issue ids must be unique" });
    }
  });

const labelIdsSchema = z
  .array(z.string().uuid("Invalid label"))
  .min(1, "Select at least one label")
  .max(50, "Too many labels")
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ path: ["labelIds"], code: "custom", message: "Labels must be unique" });
    }
  });

export const bulkIssueSchema = z.discriminatedUnion("action", [
  z.object({
    issueIds: issueIdsSchema,
    action: z.literal("setStatus"),
    status: z.enum(ISSUE_STATUSES),
  }),
  z.object({
    issueIds: issueIdsSchema,
    action: z.literal("setPriority"),
    priority: z.enum(ISSUE_PRIORITIES),
  }),
  z.object({
    issueIds: issueIdsSchema,
    action: z.literal("assign"),
    assigneeId: z.string().uuid("Invalid assignee").nullable(),
  }),
  z.object({
    issueIds: issueIdsSchema,
    action: z.literal("addLabels"),
    labelIds: labelIdsSchema,
  }),
  z.object({
    issueIds: issueIdsSchema,
    action: z.literal("removeLabels"),
    labelIds: labelIdsSchema,
  }),
  z.object({
    issueIds: issueIdsSchema,
    action: z.literal("delete"),
  }),
]);

export type BulkIssueInput = z.infer<typeof bulkIssueSchema>;